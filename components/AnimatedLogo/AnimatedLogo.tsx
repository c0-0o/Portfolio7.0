"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import styles from "./animated-logo.module.css";
import {
  ASPECT,
  BODY_LOWER,
  BODY_UPPER,
  CLIP_W,
  EAR_BIG,
  EAR_SMALL,
  EYE_A,
  EYE_B,
  MASK_RECT,
  VIEWBOX,
  VIEW_H,
  VIEW_W,
} from "./logo-paths";
import { LogoController } from "./logo-controller";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Below this rendered height (px) the static compact logo is used. */
export const DEFAULT_BREAKPOINT = 38;

export type AnimatedLogoProps = {
  /** Rendered HEIGHT of the logo (number = px, string = any CSS length). Width follows the artwork's aspect ratio. */
  size?: number | string;
  /** Optional independent width/height. If both are given the artwork is fitted inside (never stretched). */
  width?: number | string;
  height?: number | string;
  /** Hover / keyboard focus / tap reveals the cat. */
  interactive?: boolean;
  /** Occasionally turns into the cat on its own. */
  idleAnimation?: boolean;
  /** Idle timing in ms. */
  idleMinDelay?: number;
  idleMaxDelay?: number;
  /** How long the cat stays after the morph finishes (ms). */
  idleHoldMin?: number;
  idleHoldMax?: number;
  /** Let only one logo on the page idle-animate at a time. Default true. */
  coordinate?: boolean;
  /** Rendered height (px) under which the compact logo is used. Default 38. */
  breakpoint?: number;
  /** Master switch: false = always the static logo. */
  animate?: boolean;
  /** Externally pin the cat (e.g. a loader or a section reveal). */
  showCat?: boolean;
  /** Skip the post-hydration idle deferral and start immediately (use for above-the-fold logos). */
  priority?: boolean;
  /** Renders a Next.js <Link> when set. */
  href?: string;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  /** Override brand colours (defaults are the exact supplied values). */
  color?: string;
  eyeColor?: string;
};

function toCss(v: number | string | undefined) {
  return typeof v === "number" ? `${v}px` : v;
}

function numeric(v: number | string | undefined): number | undefined {
  return typeof v === "number" ? v : undefined;
}

export default function AnimatedLogo({
  size = 48,
  width,
  height,
  interactive = false,
  idleAnimation = false,
  idleMinDelay = 8000,
  idleMaxDelay = 20000,
  idleHoldMin = 600,
  idleHoldMax = 1200,
  coordinate = true,
  breakpoint = DEFAULT_BREAKPOINT,
  animate = true,
  showCat,
  priority = false,
  href,
  onClick,
  className,
  style,
  ariaLabel,
  color,
  eyeColor,
}: AnimatedLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `alogo-clip-${uid}`;
  const maskId = `alogo-mask-${uid}`;

  /* ---- sizing -------------------------------------------------------- */
  const h = height ?? (width === undefined ? size : undefined);
  const cssHeight = toCss(h);
  const cssWidth = toCss(width);

  // Best guess for SSR; corrected after mount from the real rendered size.
  const nH = numeric(h);
  const nW = numeric(width);
  const guessH = nH ?? (nW !== undefined ? nW / ASPECT : undefined);
  const [large, setLarge] = useState(guessH === undefined ? true : guessH >= breakpoint);

  const rootRef = useRef<HTMLElement | null>(null);

  useIsoLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Fractional LAYOUT size (unaffected by transforms, unlike getBoundingClientRect,
    // and unlike offsetWidth it is not rounded to whole pixels). The artwork is
    // "meet"-fitted, so the effective height is the smaller of height and width / aspect.
    const apply = (w: number, h: number) => {
      if (!w && !h) return;
      const eff = Math.min(h || Infinity, w ? w / ASPECT : Infinity);
      setLarge(eff >= breakpoint - 0.01);
    };
    if (typeof ResizeObserver === "undefined") {
      apply(el.clientWidth, el.clientHeight);
      return;
    }
    const ro = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1].contentRect;
      apply(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [breakpoint, cssHeight, cssWidth]);

  /* ---- controller ---------------------------------------------------- */
  const earBigRef = useRef<SVGPathElement>(null);
  const earSmallRef = useRef<SVGPathElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const eyeARef = useRef<SVGPathElement>(null);
  const eyeBRef = useRef<SVGPathElement>(null);
  const ctl = useRef<LogoController | null>(null);

  // Latest options, readable from the (possibly deferred) controller boot.
  const optsRef = useRef({ idleAnimation, idleMinDelay, idleMaxDelay, idleHoldMin, idleHoldMax, coordinate, showCat });
  useEffect(() => {
    optsRef.current = { idleAnimation, idleMinDelay, idleMaxDelay, idleHoldMin, idleHoldMax, coordinate, showCat };
  }, [idleAnimation, idleMinDelay, idleMaxDelay, idleHoldMin, idleHoldMax, coordinate, showCat]);

  const animated = animate && large;
  const wantsMotion = animated && (interactive || idleAnimation || showCat !== undefined);

  useEffect(() => {
    if (!wantsMotion) return;
    const root = rootRef.current;
    const earBig = earBigRef.current;
    const earSmall = earSmallRef.current;
    const eyes = eyesRef.current;
    const eyeA = eyeARef.current;
    const eyeB = eyeBRef.current;
    if (!root || !earBig || !earSmall || !eyes || !eyeA || !eyeB) return;

    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const boot = () => {
      if (cancelled) return;
      const o = optsRef.current;
      const c = new LogoController(
        { root, earBig, earSmall, eyes, eyeA, eyeB },
        {
          enabled: o.idleAnimation,
          minDelay: o.idleMinDelay,
          maxDelay: o.idleMaxDelay,
          holdMin: o.idleHoldMin,
          holdMax: o.idleHoldMax,
          coordinate: o.coordinate,
        }
      );
      ctl.current = c;
      if (o.showCat) c.enter("pinned");
    };

    // Don't compete with hydration: start on idle unless `priority`.
    if (priority) boot();
    else if (typeof requestIdleCallback !== "undefined") {
      idleHandle = requestIdleCallback(boot, { timeout: 1200 });
    } else {
      timeoutHandle = window.setTimeout(boot, 250);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && typeof cancelIdleCallback !== "undefined") cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
      ctl.current?.destroy();
      ctl.current = null;
    };
    // The controller is created once per mode; live options go through configure().
     
  }, [wantsMotion, priority]);

  useEffect(() => {
    ctl.current?.configure({
      enabled: idleAnimation,
      minDelay: idleMinDelay,
      maxDelay: idleMaxDelay,
      holdMin: idleHoldMin,
      holdMax: idleHoldMax,
      coordinate,
    });
  }, [idleAnimation, idleMinDelay, idleMaxDelay, idleHoldMin, idleHoldMax, coordinate, wantsMotion]);

  // Externally pinned state (loaders etc.)
  useEffect(() => {
    if (showCat === undefined) return;
    const c = ctl.current;
    if (showCat) c?.enter("pinned");
    else c?.leave("pinned");
    return () => c?.leave("pinned");
  }, [showCat, wantsMotion]);

  /* ---- events -------------------------------------------------------- */
  const onPointerEnter = useCallback(
    (e: PointerEvent) => {
      if (e.pointerType !== "touch") ctl.current?.enter("pointer");
    },
    []
  );
  const onPointerLeave = useCallback((e: PointerEvent) => {
    if (e.pointerType !== "touch") ctl.current?.leave("pointer");
  }, []);
  const onPointerDown = useCallback((e: PointerEvent) => {
    if (e.pointerType === "touch") ctl.current?.peek();
  }, []);
  const onFocus = useCallback((e: { currentTarget: Element }) => {
    // Keyboard users get the same moment as pointer users.
    if (e.currentTarget.matches(":focus-visible")) ctl.current?.enter("focus");
  }, []);
  const onBlur = useCallback(() => ctl.current?.leave("focus"), []);

  /* ---- root element -------------------------------------------------- */
  const label = ariaLabel ?? (href ? "Home" : "Logo");
  const rootStyle: CSSProperties = {
    height: cssHeight,
    width: cssWidth,
    aspectRatio: `${VIEW_W} / ${VIEW_H}`,
    ...(color ? ({ "--alogo-body": color, "--alogo-ear": color } as CSSProperties) : null),
    ...(eyeColor ? ({ "--alogo-eye": eyeColor } as CSSProperties) : null),
    ...style,
  };
  const isActionable = Boolean(href || onClick);
  const common = {
    className: [styles.root, interactive || isActionable ? styles.interactive : "", className]
      .filter(Boolean)
      .join(" "),
    style: rootStyle,
    "data-alogo": animated ? "full" : "compact",
    ...(interactive && animated
      ? { onPointerEnter, onPointerLeave, onPointerCancel: onPointerLeave, onPointerDown, onFocus, onBlur }
      : null),
  };

  const svg = (
    <svg
      className={styles.svg}
      viewBox={VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      role={isActionable ? undefined : "img"}
      aria-hidden={isActionable ? true : undefined}
      aria-label={isActionable ? undefined : label}
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect width={CLIP_W} height={VIEW_H} fill="white" />
        </clipPath>
        <mask id={maskId} style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="38" width="44" height="33">
          <path d={MASK_RECT} fill="white" />
        </mask>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Draw order is identical to the supplied SVGs. */}
        <path ref={earSmallRef} className={styles.ear} d={EAR_SMALL.normal} />
        <g mask={`url(#${maskId})`}>
          <path className={styles.body} d={BODY_LOWER} />
        </g>
        <path className={styles.body} d={BODY_UPPER} />
        <path ref={earBigRef} className={styles.ear} d={EAR_BIG.normal} />
        {animated && (
          <g ref={eyesRef} opacity="0">
            <path ref={eyeARef} className={styles.eye} d={EYE_A} />
            <path ref={eyeBRef} className={styles.eye} d={EYE_B} />
          </g>
        )}
      </g>
    </svg>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={label}
        onClick={onClick as unknown as (e: MouseEvent<HTMLAnchorElement>) => void}
        ref={rootRef as React.Ref<HTMLAnchorElement>}
        {...common}
      >
        {svg}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} ref={rootRef as React.Ref<HTMLButtonElement>} {...common}>
        {svg}
      </button>
    );
  }
  return (
    <span ref={rootRef as React.Ref<HTMLSpanElement>} {...common}>
      {svg}
    </span>
  );
}

export { AnimatedLogo };
