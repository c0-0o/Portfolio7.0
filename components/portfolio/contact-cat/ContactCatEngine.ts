/**
 * Framework-free engine for the shared contact-section cat.
 * One inline SVG, one eye rig, 13 moods. No React / framer-motion needed.
 * Usage: const cat = mountCat({ section, host, email, arrow, headline }); ... cat.destroy();
 */
export type Mood =
  | "neutral" | "goofy" | "bored" | "annoyed" | "starry" | "food" | "happy"
  | "surprised" | "sleepy" | "love" | "wink" | "mischievous";

export type Opts = {
  section: HTMLElement; // pointer area (the whole contact section)
  host: HTMLElement; // empty div the cat is drawn into
  email?: HTMLElement | null;
  arrow?: HTMLElement | null;
  delay?: number; // ms between "section visible" and the pop-up (default 1100)
  onMood?: (mood: Mood, why: string) => void; // for debugging / HUDs
};
export type CatApi = { destroy: () => void; setMood: (m: Mood, ms?: number) => void; replay: () => void };
const mountedCats = new WeakMap<HTMLElement, CatApi>();

/* ───────────── tuning ───────────── */
const IDLE_FIRST = [5000, 8000]; // quiet time after the pop-up / any interaction before an idle expression
const IDLE_HOLD = [2500, 4000]; // how long one idle expression lasts
const IDLE_GAP = [6000, 10000]; // quiet time after an idle expression before the next one
const NAP_AFTER = 18000; // no interaction for this long -> sleep
const TWITCH = [6000, 12000]; // little twitch while asleep
const PET_AFTER = 1500; // hover the head this long -> happy
const CLICK_WINDOW = 2500; // clicks counted inside this window
const ANNOYED_AT = 3; // 1-2 clicks = wink, 3+ = annoyed
const IDLE_POOL: Mood[] = ["goofy", "bored", "mischievous"]; // never the same one twice in a row
const TRACK = 9; // max pupil travel in px (SVG units) before per-mood scaling

/* ───────────── mood controller: one table describes every mood ─────────────
 * prio  higher wins; a lower priority can never replace a higher one that is still wanted
 * min   minimum display time (ms) once a mood is showing
 * fade  transition time into the mood (ms)
 * lock  while inside its minimum time only annoyed may interrupt it
 * cd    cooldown (ms) before the mood can trigger again                          */
type Def = { prio: number; min: number; fade: number; lock?: boolean; cd?: number };
const idleDef: Def = { prio: 2, min: 2500, fade: 400 };
export const DEF: Record<Mood, Def> = {
  annoyed: { prio: 9, min: 2000, fade: 220, lock: true, cd: 1500 },
  love: { prio: 8, min: 2000, fade: 300 },
  starry: { prio: 7, min: 500, fade: 300 },
  wink: { prio: 6, min: 1200, fade: 200, lock: true, cd: 600 },
  surprised: { prio: 6, min: 900, fade: 180, lock: true }, // pop-up + wake-up
  happy: { prio: 5, min: 900, fade: 350 },
  goofy: { prio: 4, min: 1500, fade: 250, cd: 3000 },
  bored: idleDef, mischievous: idleDef, food: idleDef,
  sleepy: { prio: 1, min: 0, fade: 900 }, // slow, gradual eyelid close
  neutral: { prio: 0, min: 0, fade: 350 },
};

/* ───────────── eye rig: every mood is a set of numbers ───────────── */
type Eye = {
  open: number; smile: number; sleep: number; heart: number; star: number; // layer opacities / scales
  pr: number; px: number; py: number; // pupil radius + resting offset from iris centre
  cr: number; cx: number; cy: number; // catchlight (relative to pupil)
  c2: number; c2x: number; c2y: number; // small second catchlight
  lo: number; li: number; // eyelid edge y: outer / inner (-34 = lid fully up)
  tr: number; // how much the pupil follows the cursor (0..1)
};
const D: Eye = { open: 1, smile: 0, sleep: 0, heart: 0, star: 0, pr: 19.6, px: 1.9, py: 1.9, cr: 6.5, cx: -6.5, cy: -8.4, c2: 0, c2x: 0, c2y: 0, lo: -34, li: -34, tr: 1 };
const e = (o: Partial<Eye> = {}): Eye => ({ ...D, ...o });
const both = (o: Partial<Eye>): [Eye, Eye] => [e(o), e(o)];

export const MOODS: Record<Mood, [Eye, Eye]> = {
  neutral: both({}),
  goofy: [e({ px: 12.7, py: -6.5, pr: 12.1, cr: 3.9, cx: -3.9, cy: -5.3, tr: 0.35 }), e({ px: -9, py: 6.75, pr: 18, cr: 5.8, cx: -5.8, cy: -7.9, tr: 0.35 })],
  bored: both({ pr: 19.7, px: 1.7, py: 1.7, cr: 3.4, cx: -6.2, cy: 11.2, lo: 0.6, li: 0.6, tr: 0.4 }),
  annoyed: [e({ pr: 19.7, px: 1.7, py: 1.7, cr: 3.4, cx: -10.1, cy: 10.1, lo: -12.9, li: 9, tr: 0.5 }), e({ pr: 19.7, px: 1.7, py: 1.7, cr: 3.4, cx: 6.2, cy: 10.1, lo: -12.9, li: 9, tr: 0.5 })],
  starry: both({ pr: 19.7, px: 1.7, py: 1.7, cr: 0, star: 1 }),
  food: both({ pr: 23.9, px: 0.8, py: -4.2, cr: 7.65, cx: -7.6, cy: -10.5, c2: 3.1, c2x: 11.3, c2y: 1.1, tr: 0.2 }),
  happy: both({ open: 0, smile: 1, tr: 0 }),
  surprised: both({ pr: 7.9, px: 0, py: -0.6, cr: 2.5, cx: -2.5, cy: -3.4, tr: 0.8 }),
  sleepy: both({ open: 0, sleep: 1, tr: 0 }),
  love: both({ heart: 1, pr: 19.7, px: 0, py: 0, cr: 6.3, cx: -4.6, cy: -7, tr: 0.4 }),
  wink: [e({ pr: 19.7, px: 1.7, py: 1.7, cr: 6.3, cx: -6.3, cy: -8.7 }), e({ open: 0, smile: 1, tr: 0 })],
  mischievous: both({ pr: 16, px: 8.2, py: 4.2, cr: 3.4, cx: 0.9, cy: 5.4, lo: -12.4, li: 0.6, tr: 0.35 }),
};

/* ───────────── drawing ───────────── */
const HEART = "M0 18.28C-6.19 12.65-20.25 3.09-20.25-8.72C-20.25-19.97-5.63-22.22 0-12.1C5.63-22.22 20.25-19.97 20.25-8.72C20.25 3.09 6.19 12.65 0 18.28Z";
const STAR = "M0-17.4L4.5-4.5L17.4 0L4.5 4.5L0 17.4L-4.5 4.5L-17.4 0L-4.5-4.5Z";
const SMILE = "M-23.6 9C-20.25-15.75 20.25-15.75 23.6 9C11.25-3.94-11.25-3.94-23.6 9Z";
const SLEEP = "M-23.6-3.4C-10.7 9.56 10.7 9.56 23.6-3.4C18 16.3-18 16.3-23.6-3.4Z";
const HEAD = "M18.3 260L29.375 33.4885C32.5 20 40.3125 16.6279 52.8125 23.3721L127.812 73.9541C155.938 67.2098 184.062 67.2098 212.188 73.9541L287.188 23.3721C299.688 16.6279 307.5 20 310.625 33.4885L321.7 260H18.3Z";
let counter = 0;
const KEYS = Object.keys(D) as (keyof Eye)[];
const PARTS = ["open", "pupil", "heart", "c1", "c2", "star", "lid", "smile", "sleep"];

const eyeSvg = (i: number, x: number, id: string) => `
<g data-eye="${i}" transform="translate(${x} 132.425)">
  <clipPath id="${id}"><circle r="28.125"/></clipPath>
  <g data-k="open"><circle r="28.125" fill="#CBEF92"/>
    <g clip-path="url(#${id})"><circle data-k="pupil" fill="#050604"/><path data-k="heart" fill="#050604" d="${HEART}"/>
    <circle data-k="c1" fill="#fff"/><circle data-k="c2" fill="#fff"/><path data-k="star" fill="#fff" d="${STAR}"/></g>
    <path data-k="lid" fill="#141712"/></g>
  <path data-k="smile" fill="#CBEF92" d="${SMILE}"/><path data-k="sleep" fill="#CBEF92" d="${SLEEP}"/>
</g>`;

const markup = (uid: number) => `<svg viewBox="16 12 308 208" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="transform-origin:50% 83.4%">
<path data-k="head" fill="#141712" d="${HEAD}"/><g data-k="eyes">${eyeSvg(0, 109.065, `cc${uid}a`)}${eyeSvg(1, 230.935, `cc${uid}b`)}</g></svg>`;

const f = (n: number) => n.toFixed(2);
const rnd = (r: number[]) => r[0] + Math.random() * (r[1] - r[0]);

/* ───────────── engine ───────────── */
type Req = { m: Mood; until: number; why: string; src: string; prio: number };

export function mountCat(o: Opts): CatApi {
  mountedCats.get(o.host)?.destroy();
  const reduce = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const now = () => performance.now();
  o.host.innerHTML = markup(++counter);
  const svg = o.host.firstElementChild as SVGSVGElement;
  const q = (el: Element, k: string) => el.querySelector(`[data-k="${k}"]`) as SVGElement;
  const head = q(svg, "head");
  const eyesG = q(svg, "eyes");
  const parts = [0, 1].map((i) => {
    const g = svg.querySelector(`[data-eye="${i}"]`)!;
    const r: Record<string, SVGElement> = {};
    PARTS.forEach((k) => (r[k] = q(g, k)));
    return r;
  });

  /* state. Face: mood/target. Eyes: gx/gy (gaze). They never touch each other. */
  const cur: Eye[] = [{ ...D }, { ...D }];
  let mood: Mood = "neutral", target = MOODS.neutral, shownAt = 0, curPrio = 0, curSrc = "";
  let gx = 0, gy = 0, tgx = -0.6, tgy = -0.3;
  let shown = false, started = false, vis = false, inside = false, asleep = false;
  let enterAt = 0, lastAct = now(), idleAt = 0, lastIdle: Mood | "" = "";
  let nextGlance = now() + 2500, nextTwitch = 0, nextBlink = now() + 3500, blinkAt = -1;
  let headSince = 0, inZone = false, clicks: number[] = [];
  let raf = 0, last = 0;
  const reqs = new Map<string, Req>(); // one request per source; the controller picks the winner
  const cool: Partial<Record<Mood, number>> = {};
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(
    el: EventTarget | null | undefined,
    ev: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ) => {
    if (!el) return;
    const listener: EventListener = (event) => fn(event as HTMLElementEventMap[K]);
    el.addEventListener(ev, listener);
    off.push(() => el.removeEventListener(ev, listener));
  };

  /* ── the mood controller: the only place that changes the face ── */
  const request = (src: string, m: Mood, ms = 0, why = src) => {
    if (now() < (cool[m] || 0)) return;
    // priority belongs to the request: an idle goofy is still just "idle" (2), so any real interaction outranks it
    const prio = src === "idle" ? 2 : src === "force" || src === "wake" ? 10 : DEF[m].prio;
    reqs.set(src, { m, until: ms ? now() + ms : 0, why, src, prio }); // ms = 0 -> held until released
  };
  const release = (src: string) => void reqs.delete(src);
  const wanted = (m: Mood) => [...reqs.values()].some((r) => r.m === m);
  const control = (n: number) => {
    reqs.forEach((r, k) => { if (r.until && n >= r.until) reqs.delete(k); });
    let best: Req | null = null;
    reqs.forEach((r) => { if (!best || r.prio >= best.prio) best = r; });
    const want: Mood = best ? (best as Req).m : "neutral";
    if (want === mood) return;
    const c = DEF[mood], bp = best ? (best as Req).prio : 0, hi = bp > curPrio, el = n - shownAt;
    if (wanted(mood) && !hi) return; // current mood still wanted and not outranked
    if (el < c.min && (!hi || (c.lock && bp < 9))) return; // honour minimum display time
    cool[mood] = n + (c.cd || 0);
    if (mood !== "neutral" && mood !== "sleepy") idleAt = n + rnd(curSrc === "idle" ? IDLE_GAP : IDLE_FIRST);
    mood = want; target = MOODS[want]; shownAt = n; curPrio = bp; curSrc = best ? (best as Req).src : "";
    o.onMood?.(want, best ? (best as Req).why : "back to neutral");
  };
  const activity = () => { // any real interaction: resets the nap timer, wakes the cat
    lastAct = now();
    idleAt = Math.max(idleAt, lastAct + IDLE_FIRST[0]); // idle expressions need >= 5s of quiet
    if (asleep) {
      asleep = false;
      release("sleep");
      blinkAt = -1;
      request("wake", "surprised", 900, "woke up");
      poke("squash");
    }
  };

  /* gaze + little physical reactions */
  const aim = (x: number, y: number) => {
    const r = svg.getBoundingClientRect();
    const dx = x - (r.left + r.width * (154 / 308)), dy = y - (r.top + r.height * (120.4 / 208));
    const d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 170);
    tgx = (dx / d) * m; tgy = (dy / d) * m;
  };
  const toSvg = (x: number, y: number) => { const m = svg.getScreenCTM(); return m ? new DOMPoint(x, y).matrixTransform(m.inverse()) : null; };
  const poke = (kind: "shake" | "squash" | "twitch") => {
    if (reduce) return;
    const k: Record<string, Keyframe[]> = {
      shake: [{ transform: "translateX(0)" }, { transform: "translateX(-5px) rotate(-1deg)" }, { transform: "translateX(5px) rotate(1deg)" }, { transform: "translateX(-4px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
      squash: [{ transform: "scale(1,1)" }, { transform: "scale(1.035,0.94)" }, { transform: "scale(1,1)" }],
      twitch: [{ transform: "rotate(0)" }, { transform: "rotate(-2.2deg) translateY(-1px)" }, { transform: "rotate(0)" }],
    };
    svg.animate(k[kind], { duration: kind === "shake" ? 420 : kind === "twitch" ? 340 : 260, easing: "ease-out" });
  };

  /* ── events only *request* moods; they never set the face directly ── */
  const point = (ev: PointerEvent) => { inside = true; activity(); aim(ev.clientX, ev.clientY); };
  on(o.section, "pointermove", point);
  on(o.section, "pointerdown", point);
  on(o.section, "pointerleave", () => { // eyes drift a little as the cursor leaves
    inside = false;
    tgx = tgx * 0.35 + (Math.random() - 0.5) * 0.5; tgy = tgy * 0.35 + (Math.random() - 0.5) * 0.4;
    nextGlance = now() + rnd([1800, 3200]);
  });

  [o.email, o.arrow].forEach((el) => {
    let over = 0;
    const set = (d: number) => {
      over = Math.max(0, over + d);
      if (over > 0) { activity(); request("cta", "starry", 0, "hovering / focusing the email or arrow"); } else release("cta");
    };
    on(el, "pointerenter", () => set(1)); on(el, "pointerleave", () => set(-1));
    on(el, "focusin", () => set(1)); on(el, "focusout", () => set(-1));
    on(el, "click", () => { activity(); request("ctaClick", "love", 2300, "clicked the email / arrow"); });
  });

  on(head, "pointerenter", () => { headSince = now(); });
  on(head, "pointerleave", () => { headSince = 0; inZone = false; release("pet"); });
  on(head, "pointermove", (ev: PointerEvent) => {
    const p = toSvg(ev.clientX, ev.clientY);
    const z = !!p && p.x > 136 && p.x < 204 && p.y > 92 && p.y < 172; // the gap between the eyes
    if (z && !inZone && !reqs.has("eyes")) request("eyes", "goofy", 1800, "cursor between the eyes");
    inZone = z;
  });
  on(head, "click", () => {
    const n = now();
    activity();
    clicks = clicks.filter((t) => n - t < CLICK_WINDOW);
    clicks.push(n);
    if (clicks.length >= ANNOYED_AT) { request("click", "annoyed", 2600, `clicked ${clicks.length}x in a row`); poke("shake"); }
    else if (!reqs.has("click")) { request("click", "wink", 1400, `clicked x${clicks.length}`); poke("squash"); }
  });

  /* ── per-frame draw (unchanged artwork) ── */
  /* per-frame draw */
  const draw = (i: number, s: Eye, t: number, bl: number) => {
    const p = parts[i];
    const R = TRACK * s.tr;
    const ox = s.px + gx * R, oy = s.py + gy * R;
    const wob = reduce ? 0 : 1;
    p.open.setAttribute("opacity", f(s.open));
    p.smile.setAttribute("opacity", f(s.smile));
    p.sleep.setAttribute("opacity", f(s.sleep));
    p.pupil.setAttribute("cx", f(ox)); p.pupil.setAttribute("cy", f(oy)); p.pupil.setAttribute("r", f(s.pr));
    p.pupil.setAttribute("opacity", f(1 - s.heart));
    p.heart.setAttribute("transform", `translate(${f(ox)} ${f(oy)}) scale(${f(Math.max(0.001, s.heart * (1 + 0.06 * wob * Math.sin(t * 7))))})`);
    p.star.setAttribute("transform", `translate(${f(ox)} ${f(oy)}) scale(${f(Math.max(0.001, s.star * (1 + 0.1 * wob * Math.sin(t * 5))))}) rotate(${f(6 * wob * Math.sin(t * 3))})`);
    p.c1.setAttribute("cx", f(ox + s.cx)); p.c1.setAttribute("cy", f(oy + s.cy)); p.c1.setAttribute("r", f(Math.max(0, s.cr)));
    p.c2.setAttribute("cx", f(ox + s.c2x)); p.c2.setAttribute("cy", f(oy + s.c2y)); p.c2.setAttribute("r", f(Math.max(0, s.c2)));
    // eyelid: outer edge is the left edge on the left eye, the right edge on the right eye
    let a = i === 0 ? s.lo : s.li, b = i === 0 ? s.li : s.lo;
    a += (30 - a) * bl * s.open; b += (30 - b) * bl * s.open;
    const sl = (b - a) / 56.25;
    p.lid.setAttribute("d", `M-30-40H30V${f(b + sl * 1.875)}L-30 ${f(a - sl * 1.875)}Z`);
  };
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    const k = 1 - Math.exp((-dt * 3000) / DEF[mood].fade); // ~95% settled after the mood's fade time
    const kg = 1 - Math.exp(-dt * 10);
    gx += (tgx - gx) * kg; gy += (tgy - gy) * kg;
    let bl = 0; // blinking only closes the lid; it never changes or resets the mood
    if (blinkAt < 0 && t > nextBlink) blinkAt = t;
    if (blinkAt >= 0) {
      const pr = (t - blinkAt) / 150;
      if (pr >= 1) { blinkAt = -1; nextBlink = t + (Math.random() < 0.2 ? 260 : 3000 + Math.random() * 3000); }
      else bl = Math.sin(pr * Math.PI);
    }
    const s = t / 1000;
    // head follows the cursor a hair; breathing is barely there when awake, slow and visible when asleep
    svg.style.transform = reduce ? "" : `rotate(${f(gx * 1.1)}deg) scale(1,${(1 + (0.004 + 0.014 * cur[0].sleep) * Math.sin(s * 1.6)).toFixed(4)})`;
    eyesG.setAttribute("transform", `translate(${f(gx * 4)} ${f(gy * 3)})`);
    for (let i = 0; i < 2; i++) {
      const c = cur[i], g = target[i];
      KEYS.forEach((key) => (c[key] += (g[key] - c[key]) * k));
      draw(i, c, s, bl);
    }
  };

  /* ── one slow tick runs everything time-based ── */
  const tick = () => {
    const n = now();
    if (enterAt && n >= enterAt) {
      enterAt = 0; shown = true; lastAct = n; idleAt = n + 1300 + rnd(IDLE_FIRST);
      request("enter", "surprised", 1300, "popped up");
      if (reduce) { o.host.style.transform = "none"; o.host.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); }
      else o.host.animate([{ transform: "translateY(112%)" }, { transform: "translateY(-5%)", offset: 0.62 }, { transform: "translateY(0)" }], { duration: 900, easing: "cubic-bezier(.3,.7,.3,1)", fill: "both" });
    }
    if (!shown) return;
    if (headSince && !reqs.has("pet") && n - headSince > PET_AFTER) request("pet", "happy", 0, "petting (head hovered)");
    const calm = reqs.size === 0 && mood === "neutral" && !asleep;
    if (calm && vis && n >= idleAt) { // idle personality: only when nothing at all is going on
      let m: Mood;
      do { m = IDLE_POOL[Math.floor(Math.random() * IDLE_POOL.length)]; } while (m === lastIdle);
      lastIdle = m;
      request("idle", m, rnd(IDLE_HOLD), "idle personality");
    } else if (calm && n - lastAct > NAP_AFTER && n - shownAt > 1500) { // sleep: deliberate, after long inactivity
      asleep = true; nextTwitch = n + rnd(TWITCH);
      request("sleep", "sleepy", 0, "nap time");
    }
    if (asleep && n >= nextTwitch) { poke("twitch"); nextTwitch = n + rnd(TWITCH); }
    if (!inside && !asleep && n >= nextGlance) { // looks around on its own when the cursor is away
      tgx = (Math.random() * 2 - 1) * 0.8; tgy = (Math.random() * 2 - 1) * 0.5 - 0.1;
      nextGlance = n + rnd([2200, 4700]);
    }
    control(n);
  };
  const tickT = setInterval(tick, 120);

  const io = new IntersectionObserver((es) => {
    for (const en of es) {
      vis = en.isIntersecting;
      if (vis && !raf) { last = now(); raf = requestAnimationFrame(frame); }
      if (!vis && raf) { cancelAnimationFrame(raf); raf = 0; }
      if (en.intersectionRatio >= 0.25 && !started) { started = true; enterAt = now() + (o.delay ?? 1100); }
    }
  }, { threshold: [0, 0.25] });
  io.observe(o.section);
  o.onMood?.("neutral", "waiting for the section to appear");

  const api: CatApi = {
    setMood: (m, ms = 2500) => request("force", m, ms, "forced (preview)"),
    replay: () => {
      o.host.getAnimations().forEach((a) => a.cancel());
      o.host.style.transform = "";
      shown = asleep = false; reqs.clear(); mood = "neutral"; target = MOODS.neutral;
      enterAt = now() + 250;
    },
    destroy: () => {
      cancelAnimationFrame(raf); clearInterval(tickT); io.disconnect();
      off.forEach((fn) => fn()); o.host.innerHTML = "";
      if (mountedCats.get(o.host) === api) mountedCats.delete(o.host);
    },
  };
  mountedCats.set(o.host, api);
  return api;
}
