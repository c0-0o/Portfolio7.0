// ============================================================================
// Target registry — the single runtime source of truth for registered
// magnetic targets. Deliberately NOT React state: reads/writes here never
// trigger a React render. The animation loop polls this registry directly.
// ============================================================================

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
          if (!entry.isIntersecting) runtime.active = false;
        }
      },
      { threshold: 0 }
    );
    runtime.intersectionObserver.observe(el);
  }

  registry.set(id, runtime);

  return () => {
    runtime.resizeObserver?.disconnect();
    runtime.intersectionObserver?.disconnect();
    registry.delete(id);
  };
}

export function setTargetActive(id: string, active: boolean) {
  const t = registry.get(id);
  if (t) t.active = active;
}

export function updateTargetOptions(id: string, opts: RegisterTargetOptions) {
  const t = registry.get(id);
  if (!t) return;
  if (opts.magnetic !== undefined) t.magnetic = opts.magnetic;
  if (opts.strength !== undefined) t.strength = opts.strength;
  if (opts.radius !== undefined) t.radius = opts.radius;
  if (opts.priority !== undefined) t.priority = opts.priority;
}

/** Active, visible, magnetic-enabled targets, highest priority first. */
export function getActiveTargets(sceneTargets: Array<{ id: string; priority: number }> = []): TargetRuntime[] {
  const active: TargetRuntime[] = [];
  registry.forEach((t) => {
    if (t.active && t.visible && t.magnetic && t.rect) active.push(t);
  });
  return active.sort((left, right) => {
    const leftPriority = sceneTargets.find((target) => target.id === left.id)?.priority ?? left.priority;
    const rightPriority = sceneTargets.find((target) => target.id === right.id)?.priority ?? right.priority;
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
