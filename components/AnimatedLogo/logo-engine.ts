/**
 * LogoEngine – drives the actual SVG artwork.
 *
 * - Ears are a genuine path morph (normal -> cat), interpolated number by number.
 * - Eyes are revealed from a slit (scaleY) and blink with the same mechanism.
 * - Everything is written straight to the DOM (no React re-renders).
 * - A single requestAnimationFrame loop runs ONLY while a tween is active.
 */
import {
  EAR_BIG,
  EAR_SMALL,
  EYE_A_CENTER,
  EYE_B_CENTER,
} from "./logo-paths";

export type Ease = (t: number) => number;

/* ------------------------------------------------------------------ easing */

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 20; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      if (e > 0) hi = t;
      else lo = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const EASE = {
  linear: ((t: number) => t) as Ease,
  inOut: cubicBezier(0.65, 0, 0.35, 1),
  /** Subtle anticipation (small dip) + a hair of overshoot, then settles. */
  riseBig: cubicBezier(0.5, -0.22, 0.22, 1.1),
  riseSmall: cubicBezier(0.5, -0.16, 0.25, 1.07),
  fall: cubicBezier(0.55, 0, 0.25, 1),
  eyeOpen: cubicBezier(0.2, 0.75, 0.3, 1),
  eyeClose: cubicBezier(0.5, 0, 0.9, 0.6),
  lidClose: cubicBezier(0.45, 0, 0.85, 0.5),
  lidOpen: cubicBezier(0.15, 0.6, 0.35, 1),
};

/* -------------------------------------------------------------- path lerp */

type Piece = string | readonly [number, number];

const TOKEN = /[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g;

function compile(a: string, b: string): Piece[] {
  const ta = a.match(TOKEN) ?? [];
  const tb = b.match(TOKEN) ?? [];
  if (ta.length !== tb.length) {
    throw new Error("[AnimatedLogo] Paths are not morph-compatible.");
  }
  return ta.map((tok, i) => {
    if (/[a-zA-Z]/.test(tok)) {
      if (tok !== tb[i]) throw new Error("[AnimatedLogo] Path commands differ.");
      return tok;
    }
    return [parseFloat(tok), parseFloat(tb[i])] as const;
  });
}

function lerpPath(pieces: Piece[], t: number): string {
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (typeof p === "string") {
      out += p;
    } else {
      const v = p[0] + (p[1] - p[0]) * t;
      out += (Math.round(v * 1000) / 1000).toString() + " ";
    }
  }
  return out;
}

const BIG = compile(EAR_BIG.normal, EAR_BIG.cat);
const SMALL = compile(EAR_SMALL.normal, EAR_SMALL.cat);

/* ------------------------------------------------------------------ engine */

interface Tween {
  from: number;
  to: number;
  t0: number;
  dur: number;
  ease: Ease;
  done?: () => void;
}

interface Channel {
  value: number;
  tw: Tween | null;
}

type ChannelName = "big" | "small" | "eye" | "lid";

export interface TweenOpts {
  duration: number;
  delay?: number;
  ease?: Ease;
  done?: () => void;
}

export interface EngineElements {
  earBig: SVGPathElement;
  earSmall: SVGPathElement;
  eyes: SVGGElement;
  eyeA: SVGPathElement;
  eyeB: SVGPathElement;
}

const MIN_LID = 0.03;

export class LogoEngine {
  private ch: Record<ChannelName, Channel> = {
    big: { value: 0, tw: null },
    small: { value: 0, tw: null },
    eye: { value: 0, tw: null },
    lid: { value: 1, tw: null },
  };
  private raf = 0;
  private destroyed = false;
  private last = { big: "", small: "", eyeOpacity: "", eyeA: "", eyeB: "" };

  constructor(private els: EngineElements) {
    this.render(true);
  }

  /** 0 = normal logo, 1 = cat. */
  get morph() {
    return this.ch.big.value;
  }
  get eyesOpen() {
    return this.ch.eye.value;
  }
  get busy() {
    return Object.values(this.ch).some((c) => c.tw);
  }

  /* ------------------------------------------------------------ public API */

  morphTo(target: 0 | 1, opts: TweenOpts) {
    const rising = target === 1;
    const fresh = Math.abs(this.ch.big.value - (rising ? 0 : 1)) < 0.02;
    const delay = opts.delay ?? 0;
    // Staggered ears: the big ear leads on the way up, the small one follows.
    const bigEase = opts.ease ?? (rising ? (fresh ? EASE.riseBig : EASE.inOut) : EASE.fall);
    const smallEase = opts.ease ?? (rising ? (fresh ? EASE.riseSmall : EASE.inOut) : EASE.fall);
    this.start("big", target, { ...opts, ease: bigEase, delay: delay + (rising ? 0 : 40) });
    this.start("small", target, {
      ...opts,
      ease: smallEase,
      delay: delay + (rising ? 70 : 0),
      done: undefined,
    });
  }

  eyeTo(target: 0 | 1, opts: TweenOpts) {
    this.start("eye", target, {
      ...opts,
      ease: opts.ease ?? (target === 1 ? EASE.eyeOpen : EASE.eyeClose),
    });
  }

  /** One complete blink (close fast, open slightly slower). */
  blink(total: number, done?: () => void) {
    const closeMs = total * 0.42;
    const openMs = total * 0.58;
    this.start("lid", 0, {
      duration: closeMs,
      ease: EASE.lidClose,
      done: () => {
        this.start("lid", 1, { duration: openMs, ease: EASE.lidOpen, done });
      },
    });
  }

  /** Cancel a running blink and reopen the lids quickly. */
  stopBlink() {
    if (this.ch.lid.value < 1 || this.ch.lid.tw) {
      this.start("lid", 1, { duration: 80, ease: EASE.lidOpen });
    }
  }

  snap(cat: boolean) {
    const v = cat ? 1 : 0;
    for (const k of ["big", "small", "eye"] as const) {
      this.ch[k].value = v;
      this.ch[k].tw = null;
    }
    this.ch.lid.value = 1;
    this.ch.lid.tw = null;
    this.render();
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const c of Object.values(this.ch)) c.tw = null;
  }

  /* ------------------------------------------------------------- internals */

  private start(name: ChannelName, to: number, o: TweenOpts) {
    if (this.destroyed) return;
    const c = this.ch[name];
    c.tw = {
      from: c.value,
      to,
      t0: performance.now() + (o.delay ?? 0),
      dur: Math.max(1, o.duration),
      ease: o.ease ?? EASE.inOut,
      done: o.done,
    };
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.destroyed) return;
    const finished: Array<() => void> = [];
    let active = false;

    for (const c of Object.values(this.ch)) {
      const tw = c.tw;
      if (!tw) continue;
      if (now < tw.t0) {
        active = true;
        continue;
      }
      const p = (now - tw.t0) / tw.dur;
      if (p >= 1) {
        c.value = tw.to;
        c.tw = null;
        if (tw.done) finished.push(tw.done);
      } else {
        c.value = tw.from + (tw.to - tw.from) * tw.ease(p);
        active = true;
      }
    }

    this.render();
    for (const fn of finished) fn();
    // `done` callbacks may have started new tweens (and a new frame).
    if (!this.raf && (active || this.busy)) this.raf = requestAnimationFrame(this.tick);
  };

  private render(force = false) {
    const { big, small, eye, lid } = this.ch;
    const { earBig, earSmall, eyes, eyeA, eyeB } = this.els;

    const dBig = lerpPath(BIG, big.value);
    if (force || dBig !== this.last.big) {
      earBig.setAttribute("d", dBig);
      this.last.big = dBig;
    }
    const dSmall = lerpPath(SMALL, small.value);
    if (force || dSmall !== this.last.small) {
      earSmall.setAttribute("d", dSmall);
      this.last.small = dSmall;
    }

    const open = Math.min(1, Math.max(0, eye.value));
    const opacity = open <= 0.001 ? "0" : String(Math.min(1, open * 3));
    if (force || opacity !== this.last.eyeOpacity) {
      eyes.setAttribute("opacity", opacity);
      this.last.eyeOpacity = opacity;
    }
    const s = Math.max(MIN_LID, open * lid.value);
    const ta = pivotScale(EYE_A_CENTER, s);
    if (force || ta !== this.last.eyeA) {
      eyeA.setAttribute("transform", ta);
      this.last.eyeA = ta;
    }
    const tb = pivotScale(EYE_B_CENTER, s);
    if (force || tb !== this.last.eyeB) {
      eyeB.setAttribute("transform", tb);
      this.last.eyeB = tb;
    }
  }
}

function pivotScale(c: readonly [number, number], sy: number) {
  const f = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${c[0]} ${c[1]}) scale(1 ${f(sy)}) translate(${-c[0]} ${-c[1]})`;
}
