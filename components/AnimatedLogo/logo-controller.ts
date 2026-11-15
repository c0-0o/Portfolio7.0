/**
 * LogoController – behaviour layer for ONE logo instance.
 *
 * Owns: hover/focus/touch priority, the randomized idle scheduler, eye-blink
 * scheduling, visibility/viewport pausing, reduced-motion handling and
 * complete cleanup. Each instance has its own controller (no shared state
 * except the optional idle coordinator).
 *
 * Priority:  hover/focus/pinned  >  idle  >  rest
 */
import { LogoEngine, EASE, type EngineElements } from "./logo-engine";
import { idleCoordinator } from "./logo-coordinator";

export interface IdleConfig {
  enabled: boolean;
  /** ms */
  minDelay: number;
  maxDelay: number;
  /** ms the cat stays visible after the morph finishes (idle only). */
  holdMin: number;
  holdMax: number;
  /** Share a single idle slot between all logos on the page. */
  coordinate: boolean;
}

export const DEFAULT_IDLE: IdleConfig = {
  enabled: true,
  minDelay: 8000,
  maxDelay: 20000,
  holdMin: 600,
  holdMax: 1200,
  coordinate: true,
};

type Phase = "rest" | "idle" | "hover";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export interface ControllerElements extends EngineElements {
  root: Element;
}

export class LogoController {
  private engine: LogoEngine;
  private cfg: IdleConfig;
  private timers = new Set<number>();
  private idleTimer = 0;
  private sources = new Set<string>();
  private phase: Phase = "rest";
  private docVisible = true;
  private inView = true;
  private active = true;
  private reduced = false;
  private io: IntersectionObserver | null = null;
  private mql: MediaQueryList | null = null;
  private destroyed = false;

  constructor(private els: ControllerElements, cfg: Partial<IdleConfig> = {}) {
    this.cfg = { ...DEFAULT_IDLE, ...cfg };
    this.engine = new LogoEngine(els);

    this.docVisible = typeof document === "undefined" ? true : !document.hidden;
    document.addEventListener("visibilitychange", this.onVisibility);

    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1];
          this.inView = last.isIntersecting;
          this.syncActive();
        },
        { threshold: 0.01 }
      );
      this.io.observe(els.root);
      this.inView = false; // wait for the first observer callback
    }

    if (typeof matchMedia !== "undefined") {
      this.mql = matchMedia("(prefers-reduced-motion: reduce)");
      this.reduced = this.mql.matches;
      this.mql.addEventListener("change", this.onMotionPref);
    }

    this.active = this.docVisible && this.inView;
    if (this.active) this.scheduleIdle();
  }

  /* ----------------------------------------------------------- public API */

  configure(cfg: Partial<IdleConfig>) {
    const wasEnabled = this.cfg.enabled;
    this.cfg = { ...this.cfg, ...cfg };
    if (!this.cfg.enabled) {
      this.clearIdleTimer();
      if (this.phase === "idle") this.abortIdle(false);
    } else if (!wasEnabled || !this.idleTimer) {
      this.scheduleIdle();
    }
  }

  /** Pointer hover, keyboard focus or an external pin ("pinned"). */
  enter(source: string) {
    if (this.destroyed) return;
    const wasHovering = this.sources.size > 0;
    this.sources.add(source);
    if (wasHovering) return;

    // Hover takes priority: drop any idle sequence + pending idle timers.
    this.clearTimers();
    this.clearIdleTimer();
    idleCoordinator.release(this, 1500);
    this.phase = "hover";

    const { revealMs } = this.showCat();
    if (!this.reduced) this.hoverBlinkLoop(revealMs + rand(160, 300));
  }

  leave(source: string) {
    if (this.destroyed) return;
    if (!this.sources.delete(source)) return;
    if (this.sources.size > 0) return;

    // Cancel pending hover blink sequences, then reverse smoothly.
    this.clearTimers();
    this.phase = "rest";
    const ms = this.hideCat();
    this.scheduleIdle(ms + 200);
  }

  /** Touch devices have no hover: tapping shows the cat briefly. */
  peek() {
    if (this.destroyed || this.sources.has("touch")) return;
    this.enter("touch");
    this.after(rand(1500, 2100), () => this.leave("touch"));
  }

  destroy() {
    this.destroyed = true;
    this.clearTimers();
    this.clearIdleTimer();
    idleCoordinator.release(this, 0);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.mql?.removeEventListener("change", this.onMotionPref);
    this.io?.disconnect();
    this.engine.destroy();
  }

  /* ------------------------------------------------------------ cat states */

  private showCat(): { revealMs: number } {
    const e = this.engine;
    if (this.reduced) {
      e.morphTo(1, { duration: 160, ease: EASE.linear });
      e.eyeTo(1, { duration: 160, ease: EASE.linear });
      return { revealMs: 160 };
    }
    const m = clamp01(e.morph);
    const full = rand(480, 620);
    const dur = m < 0.02 ? full : Math.max(240, full * (1 - m) * 1.1);
    e.morphTo(1, { duration: dur });
    // Eyes appear once the ears are mostly up, from a slit, never before.
    const eyeDelay = m > 0.98 ? 0 : dur * 0.52;
    const eyeDur = 200;
    if (e.eyesOpen < 0.98) e.eyeTo(1, { duration: eyeDur, delay: eyeDelay });
    return { revealMs: m > 0.98 && e.eyesOpen >= 0.98 ? 0 : eyeDelay + eyeDur };
  }

  /** @returns the duration of the return transition in ms. */
  private hideCat(): number {
    const e = this.engine;
    e.stopBlink();
    if (this.reduced) {
      e.eyeTo(0, { duration: 100, ease: EASE.linear });
      e.morphTo(0, { duration: 160, ease: EASE.linear });
      return 160;
    }
    const dur = rand(400, 540);
    e.eyeTo(0, { duration: 140 });
    e.morphTo(0, { duration: dur, delay: 70 });
    return dur + 110;
  }

  /* --------------------------------------------------------------- blinking */

  private blinkSeq(count: 1 | 2) {
    const dur = rand(120, 180);
    this.engine.blink(dur);
    if (count === 2) {
      this.after(dur + rand(70, 140), () => this.engine.blink(dur * rand(0.85, 1)));
    }
  }

  /** Irregular blinking for as long as the pointer stays on the logo. */
  private hoverBlinkLoop(wait: number) {
    this.after(wait, () => {
      if (this.phase !== "hover") return;
      this.blinkSeq(Math.random() < 0.2 ? 2 : 1);
      // Mostly calm gaps; now and then a quick follow-up. Never constant.
      const next = Math.random() < 0.15 ? rand(900, 1600) : rand(2300, 5600);
      this.hoverBlinkLoop(next);
    });
  }

  /* ------------------------------------------------------------------ idle */

  private canIdle() {
    return (
      this.cfg.enabled &&
      !this.reduced &&
      this.active &&
      this.sources.size === 0 &&
      this.phase === "rest" &&
      !this.destroyed
    );
  }

  private scheduleIdle(extra = 0) {
    this.clearIdleTimer();
    if (!this.canIdle()) return;
    const { minDelay, maxDelay } = this.cfg;
    const lo = Math.min(minDelay, maxDelay);
    const hi = Math.max(minDelay, maxDelay);
    const ms = Math.max(1500, rand(lo, hi)) + extra;
    this.idleTimer = window.setTimeout(this.tryIdle, ms);
  }

  private tryIdle = () => {
    this.idleTimer = 0;
    if (!this.canIdle()) return;
    if (this.cfg.coordinate && !idleCoordinator.acquire(this)) {
      // Another logo is mid-animation: try again shortly, not on a fixed beat.
      this.idleTimer = window.setTimeout(this.tryIdle, rand(1500, 3500));
      return;
    }
    this.runIdle();
  };

  private runIdle() {
    this.phase = "idle";
    const { revealMs } = this.showCat();
    // Eyes open -> short pause -> one blink (sometimes two) -> hold -> back.
    const blinkAt = revealMs + rand(180, 380);
    this.after(blinkAt, () => this.blinkSeq(Math.random() < 0.28 ? 2 : 1));

    const morphMs = 620; // upper bound of showCat()'s duration
    const holdUntil = Math.max(morphMs + rand(this.cfg.holdMin, this.cfg.holdMax), blinkAt + 520);
    this.after(holdUntil, () => this.endIdle());
  }

  private endIdle() {
    if (this.phase !== "idle") return;
    this.phase = "rest";
    const ms = this.hideCat();
    idleCoordinator.release(this);
    this.scheduleIdle(ms);
  }

  /** Stop an idle sequence immediately (hidden / off-screen / disabled). */
  private abortIdle(snap: boolean) {
    this.clearTimers();
    this.phase = "rest";
    idleCoordinator.release(this, 1000);
    if (snap) this.engine.snap(false);
    else this.hideCat();
  }

  /* --------------------------------------------------------- environment */

  private onVisibility = () => {
    this.docVisible = !document.hidden;
    this.syncActive();
  };

  private onMotionPref = (ev: MediaQueryListEvent) => {
    this.reduced = ev.matches;
    this.clearTimers();
    this.clearIdleTimer();
    if (this.sources.size > 0) {
      // Re-enter in the right style.
      const { revealMs } = this.showCat();
      if (!this.reduced) this.hoverBlinkLoop(revealMs + rand(160, 300));
    } else {
      this.phase = "rest";
      this.engine.snap(false);
      this.scheduleIdle();
    }
  };

  private syncActive() {
    const next = this.docVisible && this.inView;
    if (next === this.active) return;
    this.active = next;
    if (!next) {
      this.clearIdleTimer();
      if (this.phase === "idle") this.abortIdle(true);
    } else {
      this.scheduleIdle();
    }
  }

  /* -------------------------------------------------------------- timers */

  private after(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      if (!this.destroyed) fn();
    }, ms);
    this.timers.add(id);
  }

  private clearTimers() {
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
  }

  private clearIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = 0;
  }
}
