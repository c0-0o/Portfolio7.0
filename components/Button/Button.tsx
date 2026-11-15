"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { CATS, FX_CSS, type IdleCatKey, SCRATCH_OVERLAY, catFocus, loadingCatMarkup, runDistance, slamBody, slamDefs } from "./buttonCats";
import { useCatScheduler, type CatTiming } from "./useCatScheduler";

/* ───────────────────────── tokens ───────────────────────── */
const C = { lime: "#ADEB66", ink: "#141712", paper: "#FCFDF8", hoverText: "#EEF9DE" } as const;
const H = 52;
const STYLE_ID = "mbc-button-styles";

type Visual = "default" | "hover" | "smashed";

/* ───────────────────────── squish geometry ───────────────────────── */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

type Pt = [number, number];
const baseCache = new Map<number, Pt[]>();
function getBase(W: number): Pt[] {
  const hit = baseCache.get(W);
  if (hit) return hit;
  const p: Pt[] = [];
  for (let i = 0; i <= 14; i++) p.push([24 + (i * (W - 48)) / 14, 3]);
  for (let i = 1; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    p.push([W - 24 + 22 * Math.cos(a), 25 + 22 * Math.sin(a)]);
  }
  for (let i = 0; i <= 14; i++) p.push([W - 24 - (i * (W - 48)) / 14, 47]);
  for (let i = 1; i < 8; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 8;
    p.push([24 + 22 * Math.cos(a), 25 + 22 * Math.sin(a)]);
  }
  baseCache.set(W, p);
  return p;
}

function smooth(p: Pt[]): string {
  const n = p.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}

/** Outline dented toward (cx0, cy). h = hover amount 0..1, s = smash amount 0..1 */
function outlinePoints(W: number, cx0: number, cy: number, h: number, s: number): Pt[] {
  const w = Math.max(80, Math.round(W));
  const cx = clamp(cx0, 30, w - 30);
  const wT = clamp(1.15 - cy / H, 0.3, 1);
  const wB = clamp(0.15 + cy / H, 0.3, 1);
  return getBase(w).map(([x, y]) => {
      const g = Math.exp(-((x - cx) ** 2) / (2 * 26 * 26));
      const top = y < 25;
      const env = smoothstep(14, 40, x) * smoothstep(14, 40, w - x);
      const dent = (7 * h + 9 * s) * g * env * (top ? wT : wB);
      let ny = top ? y + dent : y - dent;
      ny = 47 + (ny - 47) * (1 - 0.45 * s);
      return [x + ((x - w / 2) / (w / 2)) * (3 * h + 8 * s), ny] as Pt;
  });
}

function squishPath(W: number, cx0: number, cy: number, h: number, s: number): string {
  return smooth(outlinePoints(W, cx0, cy, h, s));
}

/**
 * The cat rides the button surface: it sinks with the dent and is clipped by the live top outline,
 * so nothing is ever visible below / inside the button (no cut-off, no floating head).
 */
function catRide(W: number, cx0: number, cy: number, h: number, s: number): { dip: number; clip: string } {
  const w = Math.max(80, Math.round(W));
  const pts = outlinePoints(w, cx0, cy, h, s);
  const ox = 95 - w / 2;
  const oy = 88;
  const dip = pts[7][1] - 3; // top-edge centre
  const P = (i: number) => `${(pts[i][0] + ox).toFixed(1)} ${(pts[i][1] + oy - dip).toFixed(1)}`;
  const order = [17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 43, 42, 41];
  const yEdge = (pts[17][1] + oy - dip).toFixed(1);
  const yEdgeL = (pts[41][1] + oy - dip).toFixed(1);
  return {
    dip,
    clip: `path("M -400 -300 H 700 V ${yEdge} ${order.map((i) => `L ${P(i)}`).join(" ")} L -400 ${yEdgeL} Z")`,
  };
}

/* ───────────────────────── default arrow icon ───────────────────────── */
export const ArrowIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M6.5 17.5L17 7M8.5 6.8h8.7V15.5" stroke={C.lime} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ───────────────────────── face (the squishy pill) ───────────────────────── */
interface FaceProps {
  W: number;
  wMv: MotionValue<number>;
  cx: MotionValue<number>;
  cy: MotionValue<number>;
  hover: MotionValue<number>;
  smash: MotionValue<number>;
  loading: boolean;
}
function Face({ W, wMv, cx, cy, hover, smash, loading }: FaceProps) {
  const d = useTransform([cx, cy, hover, smash, wMv], (v: number[]) =>
    squishPath(v[4], v[0], v[1], v[2], v[3]),
  );
  const edgeOpacity = useTransform(hover, [0, 1], [0.55, 1]);
  const edgeY = useTransform(smash, [0, 1], [3, 4.5]);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}
    >
      <motion.path d={d} fill={C.lime} style={{ opacity: edgeOpacity, y: edgeY }} />
      <motion.path
        d={d}
        initial={false}
        animate={{ fill: loading ? C.lime : C.ink }}
        transition={{ duration: 0.2 }}
        stroke="#38442D"
        strokeOpacity={0.6}
        strokeWidth={0.65}
      />
    </svg>
  );
}

/* ───────────────────────── component ───────────────────────── */
export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "style" | "className" | "onClick" | "disabled" | "type"> {
  /** label (ignored if children is given) */
  text?: string;
  children?: ReactNode;
  leftIcon?: ReactNode;
  /** defaults to the arrow icon; pass null for no right icon */
  rightIcon?: ReactNode | null;
  /** pin a visual state (useful for docs / Storybook) */
  property1?: Visual;
  loading?: boolean;
  /** show the cat while loading (default true) */
  loadingCat?: boolean;
  /** enables the random idle cat system; off = completely normal button */
  catAnimation?: boolean;
  /** restrict which idle cats can appear (default: all nine) */
  cats?: IdleCatKey[];
  /** override how long cats stay / wait (ms) */
  catTiming?: CatTiming;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  style?: CSSProperties;
}

export const Button = ({
  text = "Primary Button",
  children,
  leftIcon,
  rightIcon,
  property1 = "default",
  loading = false,
  loadingCat = true,
  catAnimation = false,
  cats,
  catTiming,
  disabled = false,
  type = "button",
  onClick,
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  className,
  style,
  ...rest
}: ButtonProps): React.ReactElement => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const catRef = useRef<SVGSVGElement>(null);
  const rootRectRef = useRef<DOMRect | null>(null);
  const buttonRectRef = useRef<DOMRect | null>(null);
  const updateRects = useCallback(() => {
    rootRectRef.current = rootRef.current?.getBoundingClientRect() ?? null;
    buttonRectRef.current = btnRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const [W, setW] = useState(190);
  const [hovered, setHovered] = useState(false);
  const [smashed, setSmashed] = useState(false);
  const [hitKey, setHitKey] = useState(0);
  const [printPos, setPrintPos] = useState({ x: 95, y: 26 });
  const loadTailRef = useRef(false);
  const inert = loading || disabled;

  /* springs */
  const wMv = useMotionValue(190);
  const cx = useSpring(95, { stiffness: 300, damping: 28 });
  const cy = useSpring(26, { stiffness: 300, damping: 28 });
  const hover = useSpring(0, { stiffness: 260, damping: 20 });
  const smash = useSpring(0, { stiffness: 520, damping: 11, mass: 0.8 });
  const { cat, react } = useCatScheduler({
    enabled: catAnimation && !reduce,
    paused: loading,
    rootRef,
    cats,
    timing: catTiming,
    hold: hovered && !inert,
  });
  const showLoadingCat = loading && loadingCat && !reduce;
  const catVisible = showLoadingCat || Boolean(cat && !loading);
  const px = useTransform([cx, wMv], (v: number[]) => clamp(v[0], 45, v[1] - 45) - v[1] / 2);
  const py = useTransform(cy, (v: number) => (clamp(v, 14, 38) - 30) * 0.5);
  const ride = useTransform([cx, cy, hover, smash, wMv], (v: number[]) =>
    catVisible ? catRide(v[4], v[0], v[1], v[2], v[3]) : { dip: 0, clip: "" },
  );
  const catY = useTransform(ride, (r: { dip: number }) => r.dip);
  const catClip = useTransform(ride, (r: { clip: string }) => r.clip);

  const visual: Visual = loading
    ? "default"
    : property1 !== "default"
      ? property1
      : smashed
        ? "smashed"
        : hovered
          ? "hover"
          : "default";

  /* one-time CSS injection (client only → no hydration mismatch) */
  useEffect(() => {
    if (!document.getElementById(STYLE_ID)) {
      const el = document.createElement("style");
      el.id = STYLE_ID;
      el.textContent = FX_CSS;
      document.head.appendChild(el);
    }
  }, []);

  /* hug the content: measure real width */
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      updateRects();
      if (w > 0) {
        setW((p) => (p === w ? p : w));
        wMv.set(w);
        cx.set(w / 2);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [wMv, cx, updateRects]);

  /* visual → springs */
  useEffect(() => {
    hover.set(visual === "default" ? 0 : 1);
    if (visual !== "smashed") {
      smash.set(0);
      return;
    }
    smash.set(0);
    const t = window.setTimeout(() => smash.set(1), 70);
    return () => window.clearTimeout(t);
  }, [visual, hover, smash, hitKey]);

  /* auto release after a click */
  useEffect(() => {
    if (!smashed || property1 === "smashed") return;
    const t = window.setTimeout(() => setSmashed(false), 700);
    return () => window.clearTimeout(t);
  }, [smashed, property1]);

  /* loading: random cat each time (cute / with tail) */
  useEffect(() => {
    if (loading) {
      loadTailRef.current = Math.random() < 0.5;
    }
  }, [loading]);

  // The random tail choice is tied to the loading lifecycle and is intentionally cached
  // outside render so the button does not re-randomize on each re-render.
  // eslint-disable-next-line react-hooks/refs
  const effectiveLoadTail = loading ? loadTailRef.current : false;

  const track = useCallback(
    (e: PointerEvent<HTMLButtonElement>) => {
      const r = buttonRectRef.current ?? e.currentTarget.getBoundingClientRect();
      if (!r.width || !r.height) return;
      cx.set(((e.clientX - r.left) / r.width) * W);
      cy.set(((e.clientY - r.top) / r.height) * H);
    },
    [cx, cy, W],
  );

  /** cursor → cat (pupils follow, catch-paw position, side-peek runs away). No re-renders. */
  const feedCat = (e: PointerEvent<HTMLButtonElement>) => {
    const svg = catRef.current;
    const root = rootRef.current;
    if (!svg || !root || !cat) return;
    const rr = rootRectRef.current ?? root.getBoundingClientRect();
    const sx = e.clientX - (rr.left + rr.width / 2 - 95);
    const sy = e.clientY - (rr.top - 88);
    const f = catFocus(cat.key, W);
    let lx = clamp((sx - f.x) / 18, -1, 1) * 1.9;
    const ly = clamp((sy - f.y) / 18, -1, 1) * 1.5;
    svg.style.setProperty("--cpx", String(Math.round(clamp(sx, 95 - W / 2 + 16, 95 + W / 2 - 16))));
    if (cat.key === "walk") {
      const frac = rr.width ? (e.clientX - rr.left) / rr.width : 0.5;
      const onRight = svg.dataset.side === "right";
      if (!onRight && frac < 0.4) {
        svg.dataset.side = "right";
        svg.style.setProperty("--run", String(runDistance(W)));
        svg.style.setProperty("--flip", "-1");
      } else if (onRight && frac > 0.6) {
        svg.dataset.side = "left";
        svg.style.setProperty("--run", "0");
        svg.style.setProperty("--flip", "1");
      }
      if (svg.dataset.side === "right") lx = -lx;
    }
    if (cat.key === "peek") {
      svg.dataset.side = sx < 95 ? "l" : "r";
      svg.style.setProperty("--angl", String(Math.round(clamp((sx - 62) * 1.1, -70, 70))));
      svg.style.setProperty("--angr", String(Math.round(clamp((sx - 128) * 1.1, -70, 70))));
    }
    svg.style.setProperty("--lx", lx.toFixed(2));
    svg.style.setProperty("--ly", ly.toFixed(2));
  };

  const handlePointerEnter = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerEnter?.(e);
    if (inert) return;
    updateRects();
    track(e);
    feedCat(e);
    setHovered(true);
  };
  const handlePointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerMove?.(e);
    if (!inert) {
      track(e);
      feedCat(e);
    }
  };
  const handlePointerLeave = (e: PointerEvent<HTMLButtonElement>) => {
    onPointerLeave?.(e);
    setHovered(false);
    setSmashed(false);
  };

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const kb = e.detail === 0; // keyboard "click"
    const x = kb || !r.width ? W / 2 : ((e.clientX - r.left) / r.width) * W;
    const y = kb || !r.height ? H / 2 : ((e.clientY - r.top) / r.height) * H;
    cx.set(x);
    cy.set(y);
    setPrintPos({ x: clamp(x, 18, W - 18), y: clamp(y, 16, 36) });
    setHitKey((k) => k + 1);
    setSmashed(true);
    if (!reduce && typeof el.animate === "function") {
      el.animate(
        [
          { transform: "none" },
          { transform: "translate(-8px,2px) rotate(-2.2deg)", offset: 0.25 },
          { transform: "translate(4px,-1px) rotate(1deg)", offset: 0.5 },
          { transform: "translate(-2px,0)", offset: 0.75 },
          { transform: "none" },
        ],
        { duration: 400, delay: 50 },
      );
    }
    react();
    onClick?.(e);
  };

  /* cat layers */
  const catVars = (cat
    ? { "--d": `${cat.duration}ms`, "--bd": `${-cat.seed.toFixed(2)}s` }
    : {}) as CSSProperties;
  const catMarkup = showLoadingCat
    ? loadingCatMarkup(effectiveLoadTail)
    : cat && !loading
      ? CATS[cat.key].render(W)
      : null;
  const catClass = showLoadingCat
    ? "mbc-cat mbc-v-ld"
    : cat
      ? `mbc-cat mbc-v-${cat.key}${hovered && !inert ? " mbc-hov" : ""}${cat.phase === "rx" ? " mbc-rx" : ""}${cat.phase === "fl" ? " mbc-fl" : ""}`
      : "";
  const layer: CSSProperties = {
    position: "absolute",
    left: "50%",
    marginLeft: -95,
    top: -88,
    width: 190,
    height: 100,
    overflow: "visible",
    pointerEvents: "none",
  };

  const smashedNow = visual === "smashed";
  const showRight = rightIcon !== null;
  const right = rightIcon === undefined ? <ArrowIcon /> : rightIcon;
  const tailPlay = hovered && !loading && cat?.key === "tail";
  const iconBase: CSSProperties = { display: "inline-flex", alignItems: "center", fontSize: 21, fontWeight: 400, lineHeight: 1, color: C.lime };

  return (
    <span
      ref={rootRef}
      className={[className, smashedNow ? "mbc-hit" : ""].filter(Boolean).join(" ") || undefined}
      style={{ position: "relative", display: "inline-flex", verticalAlign: "top", ...style }}
    >
      {catMarkup && (
        <motion.svg
          key={showLoadingCat ? `loading-${effectiveLoadTail ? 1 : 0}` : `cat-${cat?.id}`}
          ref={catRef}
          className={catClass}
          viewBox="0 0 190 100"
          aria-hidden="true"
          focusable="false"
          style={{ ...layer, zIndex: 0, y: catY, clipPath: catClip, ...catVars }}
          dangerouslySetInnerHTML={{ __html: catMarkup }}
        />
      )}

      <button
        {...rest}
        ref={btnRef}
        type={type}
        disabled={disabled}
        aria-busy={loading || undefined}
        className="mbc-btn"
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          position: "relative",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: H,
          width: "100%",
          padding: "0 28px",
          border: 0,
          margin: 0,
          background: "none",
          color: visual === "hover" ? C.hoverText : C.paper,
          font: "inherit",
          fontSize: 14,
          fontWeight: 700,
          whiteSpace: "nowrap",
          cursor: disabled ? "not-allowed" : loading ? "progress" : "pointer",
          opacity: disabled ? 0.5 : 1,
          transition: "color .2s",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <Face W={W} wMv={wMv} cx={cx} cy={cy} hover={hover} smash={smash} loading={loading} />
        <span
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: smashedNow || loading ? 0 : 1,
            transition: "opacity .12s",
          }}
        >
          {leftIcon != null && (
            <motion.span
              aria-hidden="true"
              style={iconBase}
              animate={{ rotate: visual === "hover" ? 20 : 0, scale: visual === "hover" ? 1.1 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 14 }}
            >
              {leftIcon}
            </motion.span>
          )}
          {children ?? text}
          {showRight && (
            <motion.span
              aria-hidden="true"
              style={iconBase}
              animate={
                tailPlay
                  ? { rotate: [0, -18, 12, -18, 0], x: 2, y: -2 }
                  : { rotate: 0, x: visual === "hover" ? 2 : 0, y: visual === "hover" ? -2 : 0 }
              }
              transition={
                tailPlay
                  ? { duration: 0.45, repeat: Infinity, ease: "easeInOut" }
                  : { type: "spring", stiffness: 400, damping: 14 }
              }
            >
              {right}
            </motion.span>
          )}
        </span>
        {loading && (
          <span
            className="mbc-dots"
            aria-hidden="true"
            style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, pointerEvents: "none" }}
          >
            {[0, 1, 2].map((i) => (
              <i key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: C.ink, display: "block" }} />
            ))}
          </span>
        )}
      </button>

      {/* paw print left where you clicked */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        style={{
          position: "absolute",
          zIndex: 2,
          left: printPos.x,
          top: printPos.y,
          width: 26,
          margin: "-13px 0 0 -13px",
          fill: C.lime,
          pointerEvents: "none",
          opacity: smashedNow ? 1 : 0,
          transform: smashedNow ? "none" : "scale(.6)",
          transition: "opacity .14s .14s, transform .2s .14s",
        }}
      >
        <ellipse cx="12" cy="16" rx="6" ry="5" />
        <circle cx="5" cy="9" r="2.4" />
        <circle cx="10" cy="5.5" r="2.4" />
        <circle cx="15" cy="5.5" r="2.4" />
        <circle cx="20" cy="9" r="2.4" />
      </svg>

      {/* paw slam + rays (restarts on every click) */}
      {(hitKey > 0 || property1 === "smashed") && (
        <svg
          key={`slam-${hitKey}`}
          className="mbc-slam"
          viewBox="0 0 190 52"
          aria-hidden="true"
          focusable="false"
          style={{ ...layer, top: 0, height: 52, zIndex: 3 }}
        >
          <defs dangerouslySetInnerHTML={{ __html: slamDefs(uid) }} />
          <motion.g style={{ x: px, y: py }}>
            <g dangerouslySetInnerHTML={{ __html: slamBody(uid) }} />
          </motion.g>
        </svg>
      )}

      {/* angry scratch: paws + claw marks drawn over the button */}
      {cat?.key === "atk" && !loading && (
        <svg
          key={`scratch-${cat.id}`}
          className="mbc-scr mbc-v-atk"
          viewBox="0 0 190 100"
          aria-hidden="true"
          focusable="false"
          style={{ ...layer, zIndex: 4, ...catVars }}
          dangerouslySetInnerHTML={{ __html: SCRATCH_OVERLAY }}
        />
      )}
    </span>
  );
};

export default Button;
