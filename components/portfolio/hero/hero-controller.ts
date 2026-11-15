/**
 * hero-controller.ts  -  framework-free behaviour for the hero.
 *
 * One instance owns: the tile grid (built imperatively so React never re-renders it),
 * the smoothed scroll exit and the optional curved-lines canvas. A single
 * requestAnimationFrame loop drives all of it and
 * pauses when the hero is off-screen or the tab is hidden.
 */
import { HeroConfig, TONES } from "./hero-config";

export interface HeroPlayOptions {
  /** Tiles are already in place (hand-off from the loader): animate only the type. */
  skip?: boolean;
}

interface Tile {
  el: HTMLElement;
  back: HTMLElement;
  pic: HTMLElement;
  /** 0..1 scroll flip-back */
  f: number;
  /** order along the diagonal, 0..1 */
  order: number;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (v: number, t: number, dt: number, tau: number) => {
  const n = v + (t - v) * (1 - Math.exp(-dt / tau));
  return Math.abs(n - t) < 0.004 ? t : n;
};
const smooth = (x: number) => x * x * (3 - 2 * x);

export class HeroController {
  private tiles: Tile[] = [];
  private mode: "d" | "m" = "d";
  private cols = 6;
  private rows = 4;
  private started = false;
  private visible = true;
  private tabOn = true;
  private raf = 0;
  private last = 0;
  private destroyed = false;

  // scroll
  private pTarget = 0;
  private p = 0;

  // lines canvas
  private ctx: CanvasRenderingContext2D | null;
  private cw = 0;
  private ch = 0;

  private mq: MediaQueryList;
  private reduce: MediaQueryList;
  private io: IntersectionObserver;
  private ro: ResizeObserver;

  constructor(
    private root: HTMLElement,
    private grid: HTMLElement,
    private canvas: HTMLCanvasElement | null,
    private cfg: HeroConfig
  ) {
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.mq = matchMedia(`(max-width:${cfg.mobileBreakpoint}px)`);
    this.reduce = matchMedia("(prefers-reduced-motion:reduce)");

    addEventListener("scroll", this.onScroll, { passive: true });
    document.addEventListener("visibilitychange", this.onVis);
    this.mq.addEventListener("change", this.onBreakpoint);
    this.reduce.addEventListener("change", this.onMotionPref);
    this.io = new IntersectionObserver((e) => {
      this.visible = e[0].isIntersecting;
      this.last = 0;
      this.run();
    });
    this.io.observe(root);
    this.ro = new ResizeObserver(() => {
      this.layout();
      this.sizeCanvas();
    });
    this.ro.observe(root);

    this.build();
    this.sizeCanvas();
    this.onScroll();
  }

  /* ------------------------------------------------------------ public API */

  get columns() {
    return this.cols;
  }
  get isMobile() {
    return this.mode === "m";
  }
  tileBack(i: number): HTMLElement | null {
    return this.tiles[i]?.back ?? null;
  }
  show() {
    this.root.classList.add("show");
  }
  hide() {
    this.started = false;
    this.root.classList.remove("go", "show", "skip");
  }
  play(o: HeroPlayOptions = {}) {
    this.started = true;
    this.root.classList.toggle("skip", !!o.skip);
    this.root.classList.remove("go");
    void this.root.offsetWidth; // restart the CSS animations
    this.root.classList.add("go");
    this.run();
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener("scroll", this.onScroll);
    document.removeEventListener("visibilitychange", this.onVis);
    this.mq.removeEventListener("change", this.onBreakpoint);
    this.reduce.removeEventListener("change", this.onMotionPref);
    this.io.disconnect();
    this.ro.disconnect();
    this.grid.innerHTML = "";
    this.root.style.removeProperty("--p");
  }

  /* ----------------------------------------------------------------- tiles */

  private build() {
    const { layout, entrance } = this.cfg;
    this.mode = this.mq.matches ? "m" : "d";
    const L = this.mode === "m" ? layout.mobile : layout.desktop;
    this.cols = L.cols;
    this.rows = L.rows;
    this.grid.innerHTML = "";
    this.tiles = [];
    this.grid.style.setProperty("--cols", String(this.cols));
    this.grid.style.setProperty("--rows", String(this.rows));

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const el = document.createElement("div");
        el.className = "h-card";
        // diagonal wave + tiny deterministic variation (never random positions)
        el.style.setProperty("--d", `${entrance.base + (c + r) * entrance.stagger + ((c * 7 + r * 13) % 5) * entrance.jitter}ms`);
        const tone = TONES[L.tones[r * this.cols + c]] ?? "transparent";
        el.innerHTML =
          '<div class="h-tilt"><div class="h-inner"><div class="h-face h-front"></div>' +
          `<div class="h-face h-back" style="background:${tone}"><i class="pic"></i></div></div></div>`;
        this.grid.appendChild(el);
        const back = el.querySelector(".h-back") as HTMLElement;
        this.tiles.push({
          el, back, pic: back.firstElementChild as HTMLElement, f: 0,
          order: (c + r) / (this.cols + this.rows - 2),
        });
      }
    }
    this.layout();
  }

  /** One shared image coordinate system: every tile shows its slice of ONE portrait. */
  private layout() {
    const W = this.grid.clientWidth;
    const H = this.grid.clientHeight;
    const { width, height, desktop, mobile } = this.cfg.portrait;
    const ratio = width / height;
    let iw: number, ih: number, il: number, it: number;
    if (this.mode === "m") {
      iw = W * mobile.widthScale; ih = iw / ratio; il = W * mobile.left; it = W * mobile.top;
    } else {
      ih = H * desktop.heightScale; iw = ih * ratio;
      il = W * desktop.anchor - desktop.faceX * (ih / height); it = H * desktop.top;
    }
    for (const t of this.tiles) {
      t.pic.style.backgroundSize = `${iw}px ${ih}px`;
      t.pic.style.backgroundPosition = `${il - t.el.offsetLeft}px ${it - t.el.offsetTop}px`;
    }
  }

  /* ----------------------------------------------------------------- events */

  private onScroll = () => {
    this.pTarget = this.reduce.matches ? 0 : clamp(scrollY / (innerHeight * this.cfg.scroll.range), 0, 1);
    this.run();
  };
  private onVis = () => {
    this.tabOn = !document.hidden;
    this.last = 0;
    this.run();
  };
  private onBreakpoint = () => {
    this.build();
    if (this.started) this.play({ skip: this.root.classList.contains("skip") });
  };
  private onMotionPref = () => {
    this.sizeCanvas();
    this.onScroll();
    this.run();
  };

  /* --------------------------------------------------------------- the loop */

  private run() {
    if (!this.raf && !this.destroyed && this.visible && this.tabOn && this.started && !this.reduce.matches) {
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  private tick = (now: number) => {
    this.raf = 0;
    const dt = Math.min(50, now - (this.last || now - 16));
    this.last = now;
    this.scrollExit(dt);
    if (this.ctx && this.cfg.lines.enabled) this.drawLines(now / 1000);
    // keep running only while something can still change
    const idle = !this.cfg.lines.enabled && this.p === this.pTarget;
    if (!idle) this.run();
  };

  /**
   * Scroll exit. Progress is smoothed (inertia), then drives:
   *  - CSS var --p  -> grid rises, tiles spread, type leaves at three different speeds and fades (hero.css)
   *  - per-tile --f -> EVERY tile flips back to the page colour in a diagonal wave (mirrors the entrance)
   */
  private scrollExit(dt: number) {
    this.p = this.reduce.matches ? 0 : ease(this.p, this.pTarget, dt, this.cfg.scroll.smoothing);
    const p = this.p;
    this.root.style.setProperty("--p", p.toFixed(4));
    const { flipSpread, flipLength } = this.cfg.scroll;
    for (const s of this.tiles) {
      const f = smooth(clamp((p - 0.04 - s.order * flipSpread) / flipLength, 0, 1));
      if (Math.abs(f - s.f) > 0.002) {
        s.f = f;
        s.el.style.setProperty("--f", f.toFixed(3));
      }
    }
  }

  /* ------------------------------------------- optional curved-lines canvas */

  private sizeCanvas() {
    if (!this.canvas || !this.ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.cw = this.root.clientWidth;
    this.ch = this.root.clientHeight;
    this.canvas.width = this.cw * dpr;
    this.canvas.height = this.ch * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.cfg.lines.enabled && this.reduce.matches) this.drawLines(0);
  }

  private drawLines(T: number) {
    const ctx = this.ctx!;
    const W = this.cw, H = this.ch;
    ctx.clearRect(0, 0, W, H);
    const curves = [
      { y: 0.14, a: 0.05, f: 1.1, s: 0.05, p: 0, o: 0.07 }, { y: 0.3, a: 0.07, f: 0.7, s: -0.04, p: 1.7, o: 0.06 },
      { y: 0.46, a: 0.05, f: 1.6, s: 0.06, p: 3.1, o: 0.05 }, { y: 0.6, a: 0.08, f: 0.9, s: -0.05, p: 0.6, o: 0.07, g: 1 },
      { y: 0.74, a: 0.06, f: 1.3, s: 0.04, p: 2.4, o: 0.06 }, { y: 0.88, a: 0.05, f: 0.8, s: -0.06, p: 4.2, o: 0.05 },
    ];
    const list = this.mq.matches ? curves.filter((_, i) => i % 2 === 0) : curves;
    ctx.lineWidth = 1;
    for (const c of list) {
      ctx.strokeStyle = c.g ? `rgba(116,199,22,${c.o * 2.2})` : `rgba(20,24,14,${c.o * 1.15})`;
      ctx.beginPath();
      for (let i = 0; i <= 56; i++) {
        const x = (i / 56) * (W + 40) - 20, u = (x / W) * Math.PI * 2;
        const y = H * (c.y + c.a * Math.sin(u * c.f + T * c.s * 3 + c.p) + c.a * 0.5 * Math.sin(u * c.f * 2.1 - T * c.s * 2));
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
}
