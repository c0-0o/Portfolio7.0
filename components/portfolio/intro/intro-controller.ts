/**
 * intro-controller.ts  -  the opening scene (your portfolio-opening), as a framework-free class.
 *
 *   loader grid pops in -> PORTFOLIO letters rise -> (min 8s, waits for fonts + images)
 *   -> spinner stops, "Loading" becomes "Ready" -> content leaves -> one small bounce
 *   -> flat cards flip outward from the icon, each around its own radial axis
 *   -> on desktop the backs of those cards ARE the hero tiles -> hand-off to <Hero/>
 */
import type { HeroHandle } from "../hero/Hero";

export interface IntroOptions {
  getHero: () => HeroHandle | null;
  onStart?: () => void;
  /** Play only on the first visit of a browser session. */
  once: boolean;
  skipOnClientNavigation: boolean;
  /** Minimum time the loader stays up (ms). */
  minDuration: number;
  replayButton: HTMLButtonElement | null;
  storageKey: string;
  onComplete: () => void;
}

interface Cell {
  r: number;
  c: number;
  a: HTMLElement;
  d: number;
  ax: number;
  ay: number;
}

class Cancelled extends Error {}

const TONES = ["#F1F2EC", "#F4F5F0", "#EFF0EA", "#F6F7F2", "#F2F3EE"];
const EASE = "cubic-bezier(.45,.05,.25,1)";
const ROWS = 5; // 1 header row + 4 tile rows (same rows as the hero grid)
const hash = (r: number, c: number) => {
  let h = (r * 73856093) ^ (c * 19349663);
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h >>> 0) % 100;
};
const q = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector<HTMLElement>("[data-portfolio-intro]")?.querySelector<T>(sel) ?? null;

export class IntroController {
  private cells: Cell[] = [];
  private cols = 6;
  private dead = false;
  private mobileBp = 760;

  constructor(private o: IntroOptions) {
    if (o.replayButton) o.replayButton.onclick = () => void this.run();
    addEventListener("keydown", this.onKey);
  }

  /* ------------------------------------------------------------ public API */

  start() {
    if (this.o.skipOnClientNavigation) {
      this.skip();
      return;
    }

    let seen = false;
    try {
      seen = this.o.once && !!sessionStorage.getItem(this.o.storageKey);
    } catch {
      /* storage blocked: just play */
    }
    if (seen) this.skip();
    else void this.run();
  }

  destroy() {
    this.dead = true;
    removeEventListener("keydown", this.onKey);
    if (this.o.replayButton) this.o.replayButton.onclick = null;
    this.setActive(false);
  }

  /* ------------------------------------------------------------- internals */

  private onKey = (e: KeyboardEvent) => {
    const b = this.o.replayButton;
    if (b && !b.disabled && (e.key === "r" || e.key === "R")) void this.run();
  };

  private reduced() {
    return matchMedia("(prefers-reduced-motion:reduce)").matches;
  }
  private wait = async (ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    if (this.dead) throw new Cancelled();
  };
  private cancelAnimations() {
    for (const el of [q("#gA"), q("#open")]) {
      el?.getAnimations({ subtree: true }).forEach((animation) => {
        if ("animationName" in animation) return;
        animation.cancel();
      });
    }
  }

  private centerLoaderLayers() {
    const svg = q("#ico")?.querySelector("svg");
    if (!svg) throw new Error("Opening loader SVG is missing");

    const { x, y, width, height } = svg.viewBox.baseVal;
    if (width === 0 || height === 0) throw new Error("Opening loader SVG has an empty viewBox");
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const paths = [...svg.querySelectorAll<SVGGraphicsElement>("path")];
    if (paths.length !== 3) throw new Error(`Expected 3 opening loader layers, found ${paths.length}`);

    for (const path of paths) {
      const bounds = path.getBBox();
      if (bounds.width === 0 || bounds.height === 0) throw new Error("Opening loader layer has empty bounds");
      const dx = (centerX - bounds.x - bounds.width / 2) / bounds.width * 100;
      const dy = (centerY - bounds.y - bounds.height / 2) / bounds.height * 100;
      path.style.setProperty("--center-x-offset", `${dx}%`);
      path.style.setProperty("--center-y-offset", `${dy}%`);
    }
  }

  private setActive(active: boolean) {
    const intro = document.querySelector<HTMLElement>("[data-portfolio-intro]");
    intro?.toggleAttribute("data-active", active);
    intro?.toggleAttribute("data-opening", active);
    document.documentElement.classList.toggle("lock", active);
    if (!active) this.cancelAnimations();
  }

  /** Repeat visitor / no intro: show the page straight away (the hero still plays its own tile entrance). */
  private skip() {
    q("#open")?.classList.add("gone");
    q("#gA")?.classList.add("hid");
    this.setActive(false);
    const hero = this.o.getHero();
    hero?.show();
    hero?.play();
    this.o.onComplete();
  }

  private build() {
    this.cols = innerWidth <= this.mobileBp ? 4 : 6;
    const g = q("#gA")!;
    g.innerHTML = "";
    g.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
    this.cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < this.cols; c++) {
        const d = document.createElement("div");
        d.className = "card";
        d.innerHTML =
          `<div class="f fa" style="--t:${TONES[hash(r, c) % 5]}"><span class="intro-card-shadow" aria-hidden="true"></span></div>` +
          `<div class="b fb"></div>`;
        g.appendChild(d);
        this.cells.push({ r, c, a: d, d: 0, ax: 0, ay: 1 });
      }
    }
  }

  private async run() {
    const btn = this.o.replayButton;
    try {
      this.dead = false;
      this.setActive(true);
      this.o.onStart?.();
      const hero = this.o.getHero();
      this.build();
      if (btn) btn.disabled = true;
      hero?.hide();
      scrollTo(0, 0);
      const lp = q("#ld p");
      if (lp) lp.innerHTML = 'Loading<span class="dots"></span>';
      q("#ico")?.querySelectorAll("path").forEach((path) => (path.style.animationPlayState = ""));
      document.documentElement.classList.add("lock");
      const gA = q("#gA")!;
      gA.style.perspective = "";
      this.cancelAnimations();
      q("#open")?.classList.remove("gone");
      this.centerLoaderLayers();
      gA.classList.remove("hid");
      const ico = q("#ico");
      if (ico) ico.style.opacity = "1";

      if (this.reduced()) {
        q("#open")?.classList.add("gone");
        gA.classList.add("hid");
        hero?.show();
        hero?.play();
        this.setActive(false);
        this.finish();
        return;
      }

      while (document.visibilityState !== "visible") await this.wait(200);
      await this.wait(400);
      const t0 = performance.now();
      this.intro();
      const imgs = [...(document.querySelector("[data-portfolio-intro]")?.querySelectorAll<HTMLImageElement>("img") ?? [])]
        .filter((img) => !img.complete)
        .map((img) => new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); }));
      await Promise.all([document.fonts.ready, ...imgs]);
      await this.wait(Math.max(0, this.o.minDuration - (performance.now() - t0)));
      await this.outro();
      this.setActive(false);
      this.finish();
    } catch (e) {
      if (e instanceof Cancelled) return;
      this.setActive(false);
      this.o.onComplete();
      throw e;
    }
  }

  private finish() {
    if (this.o.once) {
      try {
        sessionStorage.setItem(this.o.storageKey, "1");
      } catch {
        /* ignore */
      }
    }
    if (this.o.replayButton) this.o.replayButton.disabled = false;
    this.o.onComplete();
  }

  /* ----------------------------------------------------- opening choreography */

  private intro() {
    const L = [...(document.querySelector("[data-portfolio-intro]")?.querySelectorAll<HTMLElement>("[data-l]") ?? [])];
    // grid cards pop up one by one, randomly, with a slight 3D tilt
    const order = this.cells.map((_, i) => i).sort(() => Math.random() - 0.5);
    order.forEach((ci, n) => {
      const f = this.cells[ci].a.firstElementChild as HTMLElement;
      const shadow = f.querySelector<HTMLElement>(".intro-card-shadow");
      const delay = 700 + (n / order.length) * 4300 + Math.random() * 350;
      f.style.transformOrigin = "50% 100%";
      f.animate(
        [
          { opacity: 0, transform: "perspective(900px) rotateX(-42deg) translateZ(-110px) scale(.86)" },
          { opacity: 1, transform: "perspective(900px) rotateX(7deg) translateZ(16px) scale(1.012)", offset: 0.62 },
          { opacity: 1, transform: "perspective(900px) rotateX(0) translateZ(0) scale(1)" },
        ],
        { duration: 1400, delay, easing: "cubic-bezier(.33,0,.2,1)", fill: "backwards" }
      );
      shadow?.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }],
        { duration: 1400, delay, easing: "cubic-bezier(.33,0,.2,1)", fill: "backwards" }
      );
    });
    // letters rise up out of the floor in 3D, then keep a gentle float
    L.forEach((el, i) => {
      const isP = i === 0, d = 900 + i * 170, dur = isP ? 1500 : 1100;
      el.style.transformOrigin = "50% 100%";
      const pop = el.animate(
        [
          { opacity: 0, transform: `perspective(700px) rotateX(-75deg) translateY(${isP ? 60 : 44}px) scale(.7)${isP ? " rotate(-14deg)" : ""}` },
          { opacity: 1, transform: `perspective(700px) rotateX(8deg) translateY(-10px) scale(1.04)${isP ? " rotate(4deg)" : ""}`, offset: 0.64 },
          { opacity: 1, transform: "perspective(700px) rotateX(0) translateY(0) scale(1)" },
        ],
        { duration: dur, delay: d, easing: "cubic-bezier(.3,.9,.4,1)", fill: "both" }
      );
      pop.finished
        .then(() => {
          el.style.opacity = "1";
          pop.cancel();
          el.animate([{ transform: "translateY(0)" }, { transform: "translateY(calc(-5*var(--u)))" }, { transform: "translateY(0)" }], { duration: 3600, delay: i * 140, iterations: Infinity, easing: "ease-in-out" });
        })
        .catch(() => {});
    });

    // star twinkles in
    const star = q("#star");
    star
      ?.animate([{ opacity: 0, transform: "scale(0) rotate(-140deg)" }, { opacity: 1, transform: "scale(1) rotate(0)" }], { duration: 1300, delay: 3300, easing: "cubic-bezier(.34,1.45,.64,1)", fill: "forwards" })
      .finished.then(() =>
        star.animate([{ transform: "scale(1) rotate(0)", opacity: 1 }, { transform: "scale(.74) rotate(25deg)", opacity: 0.65 }, { transform: "scale(1) rotate(0)", opacity: 1 }], { duration: 2200, iterations: Infinity, easing: "ease-in-out" })
      )
      .catch(() => {});
    q("#ld")?.animate([{ transform: "translateX(-50%) translateY(18px) scale(.85)" }, { transform: "translateX(-50%)" }], { duration: 1200, delay: 2300, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
    q("#hint")?.animate([{ opacity: 0, transform: "translateX(-50%) translateY(8px)" }, { opacity: 1, transform: "translateX(-50%)" }], { duration: 1200, delay: 3800, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
  }

  /* ---------------------------------------------------------- the finish */

  private async outro() {
    const L = [...(document.querySelector("[data-portfolio-intro]")?.querySelectorAll<HTMLElement>("[data-l]") ?? [])];
    const ico = q("#ico")!, lp = q("#ld p")!, gA = q("#gA")!;
    const dur = innerWidth <= 700 ? 650 : 800;

    // 1 loading is done: the spinner stops and the text swaps to "Ready" with a pop
    ico.querySelectorAll("path").forEach((path) => (path.style.animationPlayState = "paused"));
    await lp.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-12px)" }], { duration: 240, easing: "ease-in", fill: "forwards" }).finished;
    lp.textContent = "Ready";
    lp.animate([{ opacity: 0, transform: "translateY(14px) scale(.85)" }, { opacity: 1, transform: "translateY(-3px) scale(1.1)", offset: 0.6 }, { opacity: 1, transform: "none" }], { duration: 560, easing: "cubic-bezier(.3,.9,.4,1)", fill: "forwards" });
    await this.wait(520);

    // 2 content leaves
    L.forEach((el, i) => el.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-26px) scale(.85)" }], { duration: 650, delay: i * 40, easing: "cubic-bezier(.64,0,.78,0)", fill: "forwards" }));
    for (const s of ["#star", "#hint"]) {
      const el = q(s);
      el?.animate([{ opacity: getComputedStyle(el).opacity }, { opacity: 0 }], { duration: 400, fill: "forwards" });
    }
    await this.wait(560);

    // 3 one small bounce
    await ico.animate([{ transform: "scale(1)" }, { transform: "scale(.84,1.12)", offset: 0.22 }, { transform: "scale(1.12,.9)", offset: 0.5 }, { transform: "scale(.97)", offset: 0.75 }, { transform: "scale(1)" }], { duration: 620, easing: "ease-out" }).finished;

    // 4 ripple: FLAT cards flip outward from the icon, each around the axis perpendicular to its direction from the icon
    const hero = this.o.getHero();
    const ir = ico.getBoundingClientRect(), cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    const seamless = !!hero && !hero.mobile && hero.cols === this.cols;
    gA.style.perspective = "7000px";
    let maxD = 1;
    for (const o of this.cells) {
      const R = o.a.getBoundingClientRect(), dx = R.left + R.width / 2 - cx, dy = R.top + R.height / 2 - cy, d = Math.hypot(dx, dy);
      o.d = d; o.ax = d > 1 ? -dy / d : 0; o.ay = d > 1 ? dx / d : 1;
      maxD = Math.max(maxD, d);
      const b = o.a.querySelector<HTMLElement>(".b")!;
      b.style.transform = `rotate3d(${o.ax.toFixed(4)},${o.ay.toFixed(4)},0,180deg) translateZ(2px)`;
      // desktop: the back of each loader card is a copy of the matching hero tile -> pixel-identical hand-off
      if (seamless && o.r >= 1) {
        const hb = hero!.tileBack((o.r - 1) * this.cols + o.c);
        if (hb) {
          b.style.background = hb.style.background;
          if (hb.firstElementChild) b.appendChild(hb.firstElementChild.cloneNode(true));
        }
      }
    }
    q("#ld")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: 120, fill: "forwards" });
    const flips = this.cells.map((o) =>
      o.a.animate(
        [{ transform: `rotate3d(${o.ax.toFixed(4)},${o.ay.toFixed(4)},0,0deg)` }, { transform: `rotate3d(${o.ax.toFixed(4)},${o.ay.toFixed(4)},0,180deg)` }],
        { duration: dur, delay: Math.pow(o.d / maxD, 0.85) * 950, easing: EASE, fill: "forwards" }
      )
    );
    await Promise.all(flips.map((a) => a.finished));
    if (this.dead) throw new Cancelled();

    // 5 hand-off (same frame): hero shows, loader layer disappears -> identical pixels on desktop
    hero?.show();
    hero?.play({ skip: seamless });
    gA.classList.add("hid");
    q("#open")?.classList.add("gone");
    await this.wait(seamless ? 1600 : 2400);
  }
}
