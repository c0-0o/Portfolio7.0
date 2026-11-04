"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import {
  registerTarget,
  setTargetActive,
  updateTargetOptions,
  type RegisterTargetOptions,
} from "./engine/targetRegistry";

export interface UseMagneticTargetOptions extends RegisterTargetOptions {
  id: string;
}

/**
 * Registers an element as a magnetic target. The element supplies its own
 * geometry (via getBoundingClientRect, kept fresh by ResizeObserver /
 * IntersectionObserver / scroll+resize listeners in the registry) — you never
 * enter x/y/width/height by hand.
 *
 * Works for both HTML and SVG elements: `useMagneticTarget<SVGGElement>(...)`.
 */
export function useMagneticTarget<T extends Element>(options: UseMagneticTargetOptions) {
  const ref = useRef<T | null>(null);
  const { id, magnetic, strength, radius, priority } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const unregister = registerTarget(id, el, { magnetic, strength, radius, priority });

    const activate = () => setTargetActive(id, true);
    const deactivate = () => setTargetActive(id, false);

    el.addEventListener("pointerenter", activate);
    el.addEventListener("pointerleave", deactivate);
    el.addEventListener("focus", activate, true);
    el.addEventListener("blur", deactivate, true);
    el.addEventListener("touchstart", activate, { passive: true });
    el.addEventListener("touchend", deactivate);
    el.addEventListener("touchcancel", deactivate);

    return () => {
      el.removeEventListener("pointerenter", activate);
      el.removeEventListener("pointerleave", deactivate);
      el.removeEventListener("focus", activate, true);
      el.removeEventListener("blur", deactivate, true);
      el.removeEventListener("touchstart", activate);
      el.removeEventListener("touchend", deactivate);
      el.removeEventListener("touchcancel", deactivate);
      unregister();
    };
    // Re-register only if the id changes; live option tweaks are pushed via the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    updateTargetOptions(id, { magnetic, strength, radius, priority });
  }, [id, magnetic, strength, radius, priority]);

  return ref;
}

export interface MagneticTargetProps extends UseMagneticTargetOptions {
  children: ReactNode;
  /** Wrapper element type. Defaults to "span" with display:contents so it never affects layout. */
  as?: ElementType;
}

/** Convenience wrapper: `<MagneticTarget id="hero-title">LET'S</MagneticTarget>` */
export function MagneticTarget({ id, magnetic, strength, radius, priority, children, as }: MagneticTargetProps) {
  const Tag = (as ?? "span") as ElementType;
  const ref = useMagneticTarget<HTMLElement>({ id, magnetic, strength, radius, priority });
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} style={{ display: "inline-block" }} data-magnetic-target={id}>
      {children}
    </Tag>
  );
}
