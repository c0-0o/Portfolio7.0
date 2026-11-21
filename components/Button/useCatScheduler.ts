"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CATS, IDLE_CATS, type CatKey, type IdleCatKey } from "./buttonCats";
import { playCatCue } from "@/lib/audio/portfolioAudio";

export type CatPhase = "play" | "rx" | "fl";

export interface ActiveCat {
  id: number;
  key: CatKey;
  /** total time the cat stays, ms */
  duration: number;
  /** random offset (s) so blinks / looks never sync between buttons */
  seed: number;
  phase: CatPhase;
}

export interface CatTiming {
  dwell: readonly [number, number]; // how long a cat stays out
  gap: readonly [number, number]; // idle time before the next cat
  first: readonly [number, number]; // random initial delay
}

export const DEFAULT_CAT_TIMING: CatTiming = {
  dwell: [24000, 34000],
  gap: [5000, 8000],
  first: [1000, 7000],
};

// shared across all buttons so two buttons never show the same cat at once
const busy = new Set<IdleCatKey>();
let lastStart = 0;
let lastStartedCat: IdleCatKey | null = null;
let counter = 0;

const rand = (r: readonly [number, number]) => r[0] + Math.random() * (r[1] - r[0]);

interface Options {
  enabled: boolean;
  paused?: boolean;
  rootRef: RefObject<HTMLElement | null>;
  timing?: CatTiming;
  /** limit which idle cats may appear (default: all) */
  cats?: readonly IdleCatKey[];
  /** while true (user hovering the button) the cat stays and its leave-timer is paused */
  hold?: boolean;
}

export function useCatScheduler({ enabled, paused = false, rootRef, timing = DEFAULT_CAT_TIMING, cats, hold = false }: Options) {
  const [cat, setCat] = useState<ActiveCat | null>(null);
  const timingRef = useRef(timing);
  const catsRef = useRef(cats);
  const reactRef = useRef<(() => void) | null>(null);
  const holdRef = useRef(hold);
  const holdApplyRef = useRef<((h: boolean) => void) | null>(null);

  useEffect(() => {
    timingRef.current = timing;
  }, [timing]);

  useEffect(() => {
    catsRef.current = cats;
  }, [cats]);

  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);

  useEffect(() => {
    if (!enabled || paused) return;

    let timer = 0;
    let visible = false;
    let cur: ActiveCat | null = null;
    let held: IdleCatKey | null = null;
    let last: IdleCatKey | null = null;
    let timerOn = false; // is the leave-timer running?
    let endAt = 0;
    let remaining = 0; // time left while paused
    let holding = holdRef.current;

    const set = (c: ActiveCat | null) => {
      cur = c;
      setCat(c);
    };
    const schedule = (ms: number) => {
      timer = window.setTimeout(attempt, ms);
    };
    const arm = (ms: number) => {
      window.clearTimeout(timer);
      timerOn = true;
      endAt = performance.now() + ms;
      timer = window.setTimeout(end, ms);
    };
    const pause = () => {
      if (timerOn) remaining = Math.max(0, endAt - performance.now());
      window.clearTimeout(timer);
      timerOn = false;
    };
    const end = () => {
      timerOn = false;
      if (held) busy.delete(held);
      held = null;
      set(null);
      schedule(rand(timingRef.current.gap));
    };
    const play = (key: CatKey, duration: number) => {
      set({ id: ++counter, key, duration, seed: Math.random() * 5, phase: "play" });
      playCatCue("appear");
      const idle = key !== "surp" && key !== "atk";
      if (idle && holding) {
        remaining = duration; // cat appears under the cursor: stay until the hover is gone
        timerOn = false;
      } else arm(duration);
    };
    function attempt() {
      if (!visible || document.hidden || performance.now() - lastStart < 1500) {
        schedule(700 + Math.random() * 800);
        return;
      }
      const available = [...new Set(catsRef.current?.length ? catsRef.current : IDLE_CATS)]
        .filter((key) => !busy.has(key));
      if (!available.length) {
        schedule(700 + Math.random() * 800);
        return;
      }
      const withoutRepeat = available.filter((key) => key !== last);
      const localPool = withoutRepeat.length ? withoutRepeat : available;
      const withoutGlobalRepeat = localPool.filter((key) => key !== lastStartedCat);
      const pool = withoutGlobalRepeat.length ? withoutGlobalRepeat : localPool;
      const key = pool[Math.floor(Math.random() * pool.length)];
      last = key;
      lastStartedCat = key;
      held = key;
      busy.add(key);
      lastStart = performance.now();
      play(key, rand(timingRef.current.dwell));
    }

    // click on a visible cat: react first, then leave (never just vanish)
    reactRef.current = () => {
      if (!cur || cur.phase !== "play" || cur.key === "surp" || cur.key === "atk") return;
      playCatCue("react");
      if (cur.key === "peek") return play("surp", CATS.surp.duration ?? 1400);
      if (cur.key === "sleep") return play("atk", CATS.atk.duration ?? 3400);
      pause(); // keep the remaining time; react, then stay (hovering) or leave
      set({ ...cur, phase: "rx" });
      timer = window.setTimeout(() => {
        if (!cur) return;
        if (holding) {
          set({ ...cur, phase: "play" });
        } else {
          set({ ...cur, phase: "fl" });
          timer = window.setTimeout(end, 360);
        }
      }, 900);
    };

    // hover on / off: freeze or resume the leave-timer
    holdApplyRef.current = (h: boolean) => {
      holding = h;
      if (!cur || cur.key === "surp" || cur.key === "atk" || cur.phase !== "play") return;
      if (h) {
        pause();
        if (remaining < 600) {
          // too close to the exit animation: bring the cat back in and let it linger a bit after the hover
          set({ ...cur, id: ++counter, duration: 3000 });
          remaining = 3000;
        }
      } else if (!timerOn) {
        arm(remaining);
      }
    };

    let io: IntersectionObserver | undefined;
    const el = rootRef.current;
    if (el && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver((entries) => {
        visible = entries[entries.length - 1]?.isIntersecting ?? false;
      });
      io.observe(el);
    } else {
      visible = true;
    }

    schedule(rand(timingRef.current.first));

    return () => {
      window.clearTimeout(timer);
      io?.disconnect();
      if (held) busy.delete(held);
      reactRef.current = null;
      holdApplyRef.current = null;
      setCat(null);
    };
  }, [enabled, paused, rootRef]);

  useEffect(() => {
    holdApplyRef.current?.(hold);
  }, [hold]);

  const react = useCallback(() => reactRef.current?.(), []);
  return { cat, react };
}
