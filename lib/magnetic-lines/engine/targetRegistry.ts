// ============================================================================
// Target registry — the single runtime source of truth for registered
// magnetic targets. Deliberately NOT React state: reads/writes here never
// trigger a React render. The animation loop polls this registry directly.
// ============================================================================

import type { MagneticTargetConfig, TargetActivation } from "../types";

export interface TargetRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface RegisterTargetOptions {
  magnetic?: boolean;
  strength?: number;
  radius?: number;
  priority?: number;
  activations?: Array<"hover" | "focus" | "click" | "touch">;
  clickBehavior?: "press" | "toggle";
}

export interface TargetRuntime {
  id: string;
  el: Element;
  rect: TargetRect | null;
  active: boolean;
  visible: boolean;
  magnetic: boolean;
  strength: number;
  radius: number;
  priority: number;
  activations: Set<"hover" | "focus" | "click" | "touch">;
  clickBehavior: "press" | "toggle";
  activeSources: Set<string>;
  resizeObserver?: ResizeObserver;
  intersectionObserver?: IntersectionObserver;
}

const registry = new Map<string, TargetRuntime>();
let remeasureScheduled = false;

function measure(t: TargetRuntime) {
  const r = t.el.getBoundingClientRect();
  t.rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
}

function scheduleRemeasureAll() {
  if (remeasureScheduled) return;
  remeasureScheduled = true;
  requestAnimationFrame(() => {
    remeasureScheduled = false;
    registry.forEach(measure);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("scroll", scheduleRemeasureAll, { passive: true, capture: true });
  window.addEventListener("resize", scheduleRemeasureAll);
  window.addEventListener("orientationchange", scheduleRemeasureAll);
  const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
  fonts?.ready?.then(() => scheduleRemeasureAll());
}

export function registerTarget(id: string, el: Element, opts: RegisterTargetOptions = {}): () => void {
  const runtime: TargetRuntime = {
    id,
    el,
    rect: null,
    active: false,
    visible: true,
    magnetic: opts.magnetic ?? true,
    strength: opts.strength ?? 1,
    radius: opts.radius ?? 0,
    priority: opts.priority ?? 0,
    activations: new Set(opts.activations ?? ["hover", "focus", "touch"]),
    clickBehavior: opts.clickBehavior ?? "press",
    activeSources: new Set(),
  };
  measure(runtime);

  if (typeof ResizeObserver !== "undefined") {
    runtime.resizeObserver = new ResizeObserver(() => measure(runtime));
    runtime.resizeObserver.observe(el);
  }
  if (typeof IntersectionObserver !== "undefined") {
    runtime.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          runtime.visible = entry.isIntersecting;
          if (!entry.isIntersecting) {
            runtime.activeSources.clear();
            runtime.active = false;
          }
        }
      },
      { threshold: 0 }
    );
    runtime.intersectionObserver.observe(el);
  }

  registry.set(id, runtime);

  const setSourceActive = (source: string, active: boolean) => {
    if (active) runtime.activeSources.add(source);
    else runtime.activeSources.delete(source);
    runtime.active = runtime.activeSources.size > 0;
  };
  const onPointerEnter: EventListener = (event) => {
    const pointerType = "pointerType" in event ? event.pointerType : "";
    if (pointerType !== "touch" && runtime.activations.has("hover")) setSourceActive("hover", true);
  };
  const onPointerLeave = () => {
    setSourceActive("hover", false);
    setSourceActive("click-press", false);
    setSourceActive("touch", false);
  };
  const onFocus = () => {
    if (runtime.activations.has("focus")) setSourceActive("focus", true);
  };
  const onBlur = () => setSourceActive("focus", false);
  const onPointerDown: EventListener = (event) => {
    const pointerType = "pointerType" in event ? event.pointerType : "";
    if (pointerType === "touch" && runtime.activations.has("touch")) setSourceActive("touch", true);
    if (pointerType !== "touch" && runtime.activations.has("click") && runtime.clickBehavior === "press") {
      setSourceActive("click-press", true);
    }
  };
  const onPointerUp: EventListener = (event) => {
    const pointerType = "pointerType" in event ? event.pointerType : "";
    if (pointerType === "touch") setSourceActive("touch", false);
    setSourceActive("click-press", false);
  };
  const onClick: EventListener = (event) => {
    if ("pointerType" in event && event.pointerType === "touch") return;
    if (runtime.activations.has("click") && runtime.clickBehavior === "toggle") {
      setSourceActive("click-toggle", !runtime.activeSources.has("click-toggle"));
    }
  };
  const onKeyDown: EventListener = (event) => {
    if (!("key" in event)) return;
    const repeated = "repeat" in event && event.repeat === true;
    if (runtime.activations.has("click") && runtime.clickBehavior === "press" &&
        (event.key === "Enter" || event.key === " ") && !repeated) {
      setSourceActive("click-press", true);
    }
  };
  const onKeyUp: EventListener = (event) => {
    if (!("key" in event)) return;
    if (event.key === "Enter" || event.key === " ") setSourceActive("click-press", false);
  };
  const onTouchStart = () => {
    if (runtime.activations.has("touch")) setSourceActive("touch", true);
  };
  const onTouchEnd = () => setSourceActive("touch", false);
  el.addEventListener("pointerenter", onPointerEnter);
  el.addEventListener("pointerleave", onPointerLeave);
  el.addEventListener("focus", onFocus, true);
  el.addEventListener("blur", onBlur, true);
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
  el.addEventListener("click", onClick);
  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("keyup", onKeyUp);
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchend", onTouchEnd);
  el.addEventListener("touchcancel", onTouchEnd);

  return () => {
    el.removeEventListener("pointerenter", onPointerEnter);
    el.removeEventListener("pointerleave", onPointerLeave);
    el.removeEventListener("focus", onFocus, true);
    el.removeEventListener("blur", onBlur, true);
    el.removeEventListener("pointerdown", onPointerDown);
    el.removeEventListener("pointerup", onPointerUp);
    el.removeEventListener("pointercancel", onPointerUp);
    el.removeEventListener("click", onClick);
    el.removeEventListener("keydown", onKeyDown);
    el.removeEventListener("keyup", onKeyUp);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchend", onTouchEnd);
    el.removeEventListener("touchcancel", onTouchEnd);
    runtime.resizeObserver?.disconnect();
    runtime.intersectionObserver?.disconnect();
    registry.delete(id);
  };
}

export function setTargetActive(id: string, active: boolean, source = "manual") {
  const t = registry.get(id);
  if (!t) return;
  if (active) t.activeSources.add(source);
  else t.activeSources.delete(source);
  t.active = t.activeSources.size > 0;
}

export function updateTargetOptions(id: string, opts: RegisterTargetOptions) {
  const t = registry.get(id);
  if (!t) return;
  if (opts.magnetic !== undefined) t.magnetic = opts.magnetic;
  if (opts.strength !== undefined) t.strength = opts.strength;
  if (opts.radius !== undefined) t.radius = opts.radius;
  if (opts.priority !== undefined) t.priority = opts.priority;
  if (opts.activations !== undefined) {
    t.activations = new Set(opts.activations);
    for (const source of t.activeSources) {
      if ((source === "hover" || source === "focus" || source === "touch") && !t.activations.has(source)) {
        t.activeSources.delete(source);
      }
      if ((source === "click-press" || source === "click-toggle") && !t.activations.has("click")) {
        t.activeSources.delete(source);
      }
    }
    t.active = t.activeSources.size > 0;
  }
  if (opts.clickBehavior !== undefined) t.clickBehavior = opts.clickBehavior;
}

export function getTargetActiveActivations(target: TargetRuntime): TargetActivation[] {
  const activations = new Set<TargetActivation>();
  target.activeSources.forEach((source) => {
    if (source === "hover" || source === "focus" || source === "touch") activations.add(source);
    else if (source === "click-press" || source === "click-toggle") activations.add("click");
    else if (source === "manual") target.activations.forEach((activation) => activations.add(activation));
  });
  return Array.from(activations);
}

export interface TargetFrameContextEntry {
  runtime: TargetRuntime;
  config: MagneticTargetConfig | undefined;
  activeActivations: TargetActivation[];
}

export type TargetFrameContext = TargetFrameContextEntry[];

export function createTargetFrameContext(targetConfigs: MagneticTargetConfig[]): TargetFrameContext {
  const configById = new Map(targetConfigs.map((target) => [target.id, target]));
  return getActiveTargets(targetConfigs).map((runtime) => ({
    runtime,
    config: configById.get(runtime.id),
    activeActivations: getTargetActiveActivations(runtime),
  }));
}

/** Active and visible targets, highest priority first. Effects are gated per line. */
export function getActiveTargets(sceneTargets: Array<{ id: string; priority: number }> = []): TargetRuntime[] {
  const active: TargetRuntime[] = [];
  const priorities = new Map(sceneTargets.map((target) => [target.id, target.priority]));
  registry.forEach((t) => {
    if (t.active && t.visible && t.rect) active.push(t);
  });
  return active.sort((left, right) => {
    const leftPriority = priorities.get(left.id) ?? left.priority;
    const rightPriority = priorities.get(right.id) ?? right.priority;
    return rightPriority - leftPriority;
  });
}

export interface TargetSnapshot {
  id: string;
  active: boolean;
  visible: boolean;
  magnetic: boolean;
  priority: number;
  rect: TargetRect | null;
}

/** Cheap read-only snapshot for debug overlays / the editor's target panel. */
export function getAllTargetSnapshots(): TargetSnapshot[] {
  return Array.from(registry.values()).map((t) => ({
    id: t.id,
    active: t.active,
    visible: t.visible,
    magnetic: t.magnetic,
    priority: t.priority,
    rect: t.rect,
  }));
}
