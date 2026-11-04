// ============================================================================
// The one physics/rendering engine. Both the production component and the
// editor's live preview call this â€” there is no separate "preview renderer".
// ============================================================================

import type { AnchorPointEndpoint, MagneticLineConfig, MagneticLinesSceneConfig, PathPoint, Point } from "../types";
import {
  clamp,
  clamp01,
  distance,
  falloff,
  lerp,
  lerpPoint,
  nearestPointOnRectPerimeter,
  perpendicular,
  pointsToSmoothPath,
  pointsToPixelPath,
  pointsToPolylinePath,
} from "./math";
import { getActiveTargets, type TargetRuntime } from "./targetRegistry";

export const SAMPLES = 24;

export interface LineRuntimeState {
  /** Current, eased (spring) magnetic offset per sample point, in px. */
  deformOffset: Point[];
  /** Current, eased pointer-driven geometry offset per sample point, in px. */
  cursorOffset: Point[];
  /** Current, eased ambient cursor glow intensity per sample point, 0..1. */
  ambientGlowIntensity: number[];
  /** Current, eased combined glow intensity per sample point, 0..1. */
  glowIntensity: number[];
  outerGlowIntensity: number[];
}

export function createLineRuntimeState(): LineRuntimeState {
  return {
    deformOffset: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0 })),
    cursorOffset: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0 })),
    ambientGlowIntensity: Array.from({ length: SAMPLES }, () => 0),
    glowIntensity: Array.from({ length: SAMPLES }, () => 0),
    outerGlowIntensity: Array.from({ length: SAMPLES }, () => 0),
  };
}

export interface PointerState {
  x: number;
  y: number;
  active: boolean;
}

export interface AnchorPlaybackState {
  alwaysTime: number;
  hovering: boolean;
  hasHovered: boolean;
  hoverTime: number;
  hoverFrozenTime: number;
  clicked: boolean;
  clickTime: number;
  activeClickPointIds: ReadonlySet<string>;
}

export interface ComputeResult {
  d: string;
  /** Max glow intensity anywhere along the line â€” drives the blurred glow-stroke opacity. */
  maxGlow: number;
  maxOuterGlow: number;
  /** Final sampled runtime geometry used by the renderer and line interaction. */
  points: Point[];
  /** Per-sample normal line-glow intensity (length SAMPLES). */
  glowStops: number[];
  outerGlowStops: number[];
  /** Maximum ambient cursor-glow intensity for the cursor-colored glow pass. */
  ambientGlow: number;
}

/**
 * Compute one line's animated + magnetically-deformed path for this frame.
 * Pure with respect to React: mutates only the passed-in `state` (spring memory).
 */
export function shapeOffset(shape: MagneticLineConfig["shape"], t: number, minDim: number): number {
  if (shape.type === "straight" || shape.type === "sharp" || shape.type === "rounded") return 0;

  const envelope = Math.sin(Math.PI * t);
  const amplitude = shape.amplitude * minDim * envelope;
  const frequency = Math.max(0, shape.frequency);
  const cycles = Math.max(0.25, shape.cycles);
  const phase = shape.phase;
  const primary = Math.sin(Math.PI * cycles * 2 * t + phase);
  const secondary = Math.sin(Math.PI * (cycles * 2 + frequency + 1) * t + phase * 1.7);
  const fine = Math.sin(Math.PI * (cycles * 4 + frequency * 2 + 2) * t + phase * 0.63);

  switch (shape.type) {
    case "soft-wave":
      return amplitude * primary * (0.65 + shape.smoothness * 0.35);
    case "organic":
      return amplitude * (primary * 0.56 + secondary * (0.2 + shape.irregularity * 0.24) + fine * shape.roughness * 0.2);
    case "liquid": {
      const broadFlow = Math.sin(Math.PI * (cycles + 0.75) * 2 * t + phase * 0.8);
      const surfaceRipple = Math.sin(Math.PI * (cycles * 3 + frequency + 1.5) * t + phase * 1.35);
      const fineRipple = Math.sin(Math.PI * (cycles * 6 + frequency * 2 + 3) * t + phase * 0.45);
      const fluidVariation = broadFlow * 0.34 + surfaceRipple * (0.16 + shape.distortion * 0.1) + fineRipple * shape.distortion * 0.08;
      return amplitude * 0.72 * fluidVariation * (0.7 + shape.smoothness * 0.3);
    }
    case "floating":
      return amplitude * (primary * 0.72 + secondary * 0.28) * (0.55 + shape.smoothness * 0.45);
    case "vibration":
      return amplitude * (fine * 0.7 + secondary * 0.3) * (0.5 + frequency * 0.08);
    case "pixel": {
      const steps = Math.max(1, Math.round(shape.pixelStep));
      const stepped = Math.round((primary * 0.5 + 0.5) * steps) / steps * 2 - 1;
      return amplitude * stepped;
    }
    default:
      return 0;
  }
}

function anchorMotionOffset(anchor: MagneticLineConfig["anchorMotion"]["start"], base: Point, time: number, minDim: number, isStart: boolean): Point {
  if (!anchor.enabled) return base;

  const cycle = time * anchor.speed * Math.PI * 2 + anchor.offset * Math.PI * 2 + anchor.rotation;
  const phaseBias = isStart ? 0 : Math.PI;

  switch (anchor.trajectory) {
    case "circle":
      return {
        x: base.x + Math.cos(cycle + phaseBias) * anchor.radius * minDim,
        y: base.y + Math.sin(cycle + phaseBias) * anchor.radius * minDim,
      };
    case "ellipse":
      return {
        x: base.x + Math.cos(cycle + phaseBias) * anchor.radiusX * minDim,
        y: base.y + Math.sin(cycle + phaseBias) * anchor.radiusY * minDim,
      };
    case "triangle": {
      const tri = 1 - 2 * Math.abs(((cycle / (Math.PI * 2)) % 1) - 0.5);
      return {
        x: base.x + Math.cos(cycle + phaseBias) * tri * anchor.size * minDim * 0.75,
        y: base.y + Math.sin(cycle + phaseBias) * tri * anchor.size * minDim * 0.75,
      };
    }
    case "rectangle": {
      const rectX = Math.sign(Math.cos(cycle + phaseBias)) * anchor.width * minDim * 0.5;
      const rectY = Math.sign(Math.sin(cycle + phaseBias)) * anchor.height * minDim * 0.5;
      return { x: base.x + rectX, y: base.y + rectY };
    }
    case "linear": {
      const directionScale = anchor.direction === "reverse" ? -1 : 1;
      return {
        x: base.x + Math.cos(cycle + phaseBias) * anchor.size * minDim * directionScale,
        y: base.y + Math.sin(cycle + phaseBias) * anchor.size * minDim * directionScale,
      };
    }
    default:
      return base;
  }
}

function resolveAnchorPointTarget(point: MagneticLineConfig["anchorPoints"][number], base: Point, viewport: { width: number; height: number }, minDim: number): Point {
  const normalized = {
    x: clamp01(point.x),
    y: clamp01(point.y),
  };

  const center = {
    x: normalized.x * viewport.width,
    y: normalized.y * viewport.height,
  };

  switch (point.type) {
    case "circle": {
      const radius = Math.max(0, point.radius * minDim);
      return {
        x: center.x + Math.cos(point.rotation) * radius,
        y: center.y + Math.sin(point.rotation) * radius,
      };
    }
    case "ellipse": {
      const radiusX = Math.max(0, point.radiusX * minDim);
      const radiusY = Math.max(0, point.radiusY * minDim);
      return {
        x: center.x + Math.cos(point.rotation) * radiusX,
        y: center.y + Math.sin(point.rotation) * radiusY,
      };
    }
    case "square": {
      const radius = Math.max(0, point.size * minDim * 0.5);
      const x = Math.cos(point.rotation) * radius;
      const y = Math.sin(point.rotation) * radius;
      return { x: center.x + x, y: center.y + y };
    }
    default:
      return center;
  }
}

function resolveAnchorSequence(
  base: Point,
  endpoint: AnchorPointEndpoint,
  config: MagneticLineConfig,
  viewport: { width: number; height: number },
  time: number,
  minDim: number,
  playback?: AnchorPlaybackState,
  pathPointId?: string,
): Point {
  const endpointPoints = config.anchorPoints
    .filter((point) => point && point.endpoint === endpoint && point.enabled &&
      (endpoint !== "path" || point.pathPointId === pathPointId))
    .sort((left, right) => (Number.isFinite(left.order) ? left.order : 0) - (Number.isFinite(right.order) ? right.order : 0));

  if (endpointPoints.length === 0 || !base) return base;

  const hoverPoints = endpointPoints.filter((point) => point.activation === "hover");
  const useHover = !!playback && hoverPoints.length > 0 && playback.hovering;
  const keepHover = !!playback && !playback.hovering && playback.hasHovered &&
    hoverPoints.some((point) => point.hoverExitBehavior === "continue" || point.hoverExitBehavior === "return" || point.hoverExitBehavior === "stay" && playback.hoverFrozenTime > 0);
  const clickPoints = endpointPoints.filter((point) => point.activation === "click" && playback?.activeClickPointIds.has(point.id));
  const useClick = !useHover && !keepHover && !!playback?.clicked && clickPoints.length > 0;
  const trigger = useHover || keepHover ? "hover" : useClick ? "click" : "always";
  const points = endpointPoints.filter((point) =>
    point.activation === "always" || point.activation === trigger &&
      (trigger === "hover"
        ? playback?.hovering || point.hoverExitBehavior === "stay" || point.hoverExitBehavior === "continue"
        : trigger !== "click" || playback?.activeClickPointIds.has(point.id))
  );
  if (points.length === 0) return base;

  const sequence = [base, ...points.map((point) => resolveAnchorPointTarget(point, base, viewport, minDim))];
  if (sequence.length < 2) return base;

  const lastPoint = points[points.length - 1];
  const hoverReturning = trigger === "hover" && !!playback && !playback.hovering && points.some((point) => point.hoverExitBehavior === "return");
  const oneShot = lastPoint.behavior === "one-time" || lastPoint.loop === false || hoverReturning;
  const finishBehavior = lastPoint.finishBehavior;
  const returnToBase = oneShot && (finishBehavior === "return" || hoverReturning);
  const path = oneShot && !returnToBase ? sequence : [...sequence, base];
  const segmentDurations = path.slice(1).map((_, index) => {
    const target = index < points.length ? points[index] : lastPoint;
    const speed = Number.isFinite(target.speed) && target.speed > 0 ? target.speed : 1;
    return 1 / Math.max(0.05, speed);
  });
  const cycleDuration = segmentDurations.reduce((total, duration) => total + duration, 0);
  const triggerTime = trigger === "hover"
    ? playback?.hovering || points.some((point) => point.hoverExitBehavior === "continue")
      ? playback?.hoverTime ?? 0
      : playback?.hoverFrozenTime ?? 0
    : trigger === "click"
      ? playback?.clickTime ?? 0
      : playback?.alwaysTime ?? time;

  const elapsed = Math.max(0, Number.isFinite(triggerTime) ? triggerTime : 0);
  const progressTime = oneShot ? Math.min(elapsed, cycleDuration) : elapsed % Math.max(0.001, cycleDuration);
  let segmentIndex = 0;
  let segmentProgress = 0;
  let remaining = progressTime;
  for (; segmentIndex < segmentDurations.length; segmentIndex++) {
    const duration = segmentDurations[segmentIndex];
    if (remaining <= duration || segmentIndex === segmentDurations.length - 1) {
      segmentProgress = duration > 0 ? Math.min(1, remaining / duration) : 1;
      break;
    }
    remaining -= duration;
  }

  const from = path[segmentIndex];
  const to = path[segmentIndex + 1];

  if (!from || !to) return base;

  const easing = points[Math.min(segmentIndex, points.length - 1)].easing;
  const easedProgress = easing === "linear"
    ? segmentProgress
    : easing === "ease-in"
      ? segmentProgress * segmentProgress
      : easing === "ease-out"
        ? 1 - (1 - segmentProgress) * (1 - segmentProgress)
        : segmentProgress * segmentProgress * (3 - 2 * segmentProgress);
  return {
    x: lerp(from.x, to.x, easedProgress),
    y: lerp(from.y, to.y, easedProgress),
  };
}
function spreadGlowSamples(values: number[], length: number): void {
  let peakIndex = 0;
  for (let index = 1; index < values.length; index++) {
    if (values[index] > values[peakIndex]) peakIndex = index;
  }
  const peak = values[peakIndex];
  if (peak <= 0) return;
  const spread = Math.max(1, Math.round(length * values.length));
  for (let index = 0; index < values.length; index++) {
    const distanceFromPeak = Math.abs(index - peakIndex);
    if (distanceFromPeak <= spread) values[index] = Math.max(values[index], peak * (1 - distanceFromPeak / (spread + 1)));
  }
}
function samplePolyline(source: PathPoint[], viewport: { width: number; height: number }): Point[] {
  const points = source.map((point) => ({ x: point.x * viewport.width, y: point.y * viewport.height }));
  const segmentLengths = points.slice(1).map((point, index) => distance(point, points[index]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength <= 0) return Array.from({ length: SAMPLES }, () => ({ ...points[0] }));
  const intervals = SAMPLES - 1;
  if (segmentLengths.length > intervals) {
    return Array.from({ length: SAMPLES }, (_, sampleIndex) => {
      const target = (sampleIndex / intervals) * totalLength;
      let travelled = 0;
      for (let segmentIndex = 0; segmentIndex < segmentLengths.length; segmentIndex++) {
        const length = segmentLengths[segmentIndex];
        if (target <= travelled + length || segmentIndex === segmentLengths.length - 1) {
          const ratio = length > 0 ? (target - travelled) / length : 0;
          return lerpPoint(points[segmentIndex], points[segmentIndex + 1], clamp01(ratio));
        }
        travelled += length;
      }
      return points[points.length - 1];
    });
  }
  const extraIntervals = intervals - segmentLengths.length;
  const allocations = segmentLengths.map((length) => {
    const ideal = (length / totalLength) * extraIntervals;
    return { intervals: 1 + Math.floor(ideal), remainder: ideal - Math.floor(ideal) };
  });
  const unallocated = intervals - allocations.reduce((sum, allocation) => sum + allocation.intervals, 0);
  allocations
    .map((allocation, index) => ({ index, remainder: allocation.remainder }))
    .sort((left, right) => right.remainder - left.remainder)
    .slice(0, unallocated)
    .forEach(({ index }) => { allocations[index].intervals += 1; });
  const sampled: Point[] = [points[0]];
  allocations.forEach((allocation, segmentIndex) => {
    for (let step = 1; step <= allocation.intervals; step++) {
      sampled.push(lerpPoint(points[segmentIndex], points[segmentIndex + 1], step / allocation.intervals));
    }
  });
  return sampled;
}

function sampleCustomPath(config: MagneticLineConfig, viewport: { width: number; height: number }, source?: PathPoint[]): Point[][] {
  const points = source ?? config.customPath.points;
  const segments: PathPoint[][] = [];
  for (const point of points) {
    if (point.moveTo && segments[segments.length - 1]?.length) segments.push([]);
    if (!segments.length) segments.push([]);
    segments[segments.length - 1].push(point);
  }
  const usableSegments = segments.filter((segment) => segment.length >= 2);
  if (usableSegments.length > 0) return usableSegments.map((segment) => samplePolyline(segment, viewport));
  const fallback = [{ id: "path-start", ...config.from }, { id: "path-end", ...config.to }];
  return [samplePolyline(fallback, viewport)];
}

interface CustomPathViewportTransform {
  center: Point;
  scaleX: number;
  scaleY: number;
  fitScale: number;
  offsetX: number;
  offsetY: number;
}

function getCustomPathViewportTransform(
  config: MagneticLineConfig,
  viewport: { width: number; height: number },
): CustomPathViewportTransform | null {
  const sourceAspect = config.customPath.aspectRatio;
  const viewportAspect = viewport.width / Math.max(1, viewport.height);
  if (!sourceAspect || !Number.isFinite(sourceAspect) || sourceAspect <= 0 || !Number.isFinite(viewportAspect)) {
    return null;
  }

  const scaleX = Math.sqrt(sourceAspect / viewportAspect);
  const scaleY = 1 / scaleX;
  const pixels = config.customPath.points.map((point) => ({
    ...point,
    x: point.x * viewport.width,
    y: point.y * viewport.height,
  }));
  const sourceBounds = pixels.reduce(
    (result, point) => ({
      left: Math.min(result.left, point.x),
      right: Math.max(result.right, point.x),
      top: Math.min(result.top, point.y),
      bottom: Math.max(result.bottom, point.y),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
  const center = { x: (sourceBounds.left + sourceBounds.right) / 2, y: (sourceBounds.top + sourceBounds.bottom) / 2 };
  const adjusted = pixels.map((point) => ({
    ...point,
    x: center.x + (point.x - center.x) * scaleX,
    y: center.y + (point.y - center.y) * scaleY,
  }));
  const bounds = adjusted.reduce(
    (result, point) => ({
      left: Math.min(result.left, point.x),
      right: Math.max(result.right, point.x),
      top: Math.min(result.top, point.y),
      bottom: Math.max(result.bottom, point.y),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
  const padding = Math.min(24, Math.min(viewport.width, viewport.height) * 0.04);
  const fitScale = Math.min(
    1,
    (viewport.width - 2 * padding) / Math.max(1, bounds.right - bounds.left),
    (viewport.height - 2 * padding) / Math.max(1, bounds.bottom - bounds.top),
  );
  const width = (bounds.right - bounds.left) * fitScale;
  const height = (bounds.bottom - bounds.top) * fitScale;
  const offsetX = Math.min(
    Math.max(0, padding - bounds.left * fitScale),
    viewport.width - padding - width - bounds.left * fitScale,
  );
  const offsetY = Math.min(
    Math.max(0, padding - bounds.top * fitScale),
    viewport.height - padding - height - bounds.top * fitScale,
  );

  return { center, scaleX, scaleY, fitScale, offsetX, offsetY };
}

export function getCustomPathPointsInViewport(
  config: MagneticLineConfig,
  viewport: { width: number; height: number },
): PathPoint[] {
  const transform = getCustomPathViewportTransform(config, viewport);
  if (!transform) return config.customPath.points;
  return config.customPath.points.map((point) => ({
    ...point,
    x: (transform.center.x + (point.x * viewport.width - transform.center.x) * transform.scaleX) * transform.fitScale / viewport.width + transform.offsetX / viewport.width,
    y: (transform.center.y + (point.y * viewport.height - transform.center.y) * transform.scaleY) * transform.fitScale / viewport.height + transform.offsetY / viewport.height,
  }));
}

export function customPathPointFromViewport(
  config: MagneticLineConfig,
  viewport: { width: number; height: number },
  point: Point,
): Point {
  const transform = getCustomPathViewportTransform(config, viewport);
  if (!transform || transform.fitScale <= 0) return point;
  const pixelX = (point.x * viewport.width - transform.offsetX) / transform.fitScale;
  const pixelY = (point.y * viewport.height - transform.offsetY) / transform.fitScale;
  return {
    x: (transform.center.x + (pixelX - transform.center.x) / transform.scaleX) / viewport.width,
    y: (transform.center.y + (pixelY - transform.center.y) / transform.scaleY) / viewport.height,
  };
}

function resizeRuntimeState(state: LineRuntimeState, sampleCount: number): void {
  const offsets = [state.deformOffset, state.cursorOffset];
  for (const values of offsets) {
    if (values.length < sampleCount) {
      values.push(...Array.from({ length: sampleCount - values.length }, () => ({ x: 0, y: 0 })));
    } else if (values.length > sampleCount) {
      values.length = sampleCount;
    }
  }
  const intensities = [state.ambientGlowIntensity, state.glowIntensity, state.outerGlowIntensity];
  for (const values of intensities) {
    if (values.length < sampleCount) values.push(...new Array(sampleCount - values.length).fill(0));
    else if (values.length > sampleCount) values.length = sampleCount;
  }
}

function pathFromSegments(
  points: Point[],
  segmentLengths: number[],
  pathType: "smooth" | "polyline" | "pixel",
  pixelStep: number,
): string {
  let offset = 0;
  return segmentLengths.map((length) => {
    const segment = points.slice(offset, offset + length);
    offset += length;
    if (pathType === "pixel") return pointsToPixelPath(segment, pixelStep);
    if (pathType === "polyline") return pointsToPolylinePath(segment);
    return pointsToSmoothPath(segment);
  }).join(" ");
}

export function computeLine(
  config: MagneticLineConfig,
  scene: MagneticLinesSceneConfig,
  state: LineRuntimeState,
  time: number,
  dt: number,
  viewport: { width: number; height: number },
  pointer: PointerState | null,
  motionScale = 1,
  interactionOffset?: Point[],
  surfaceOffset: Point = { x: 0, y: 0 },
  anchorPlayback?: AnchorPlaybackState
): ComputeResult {
  const minDim = Math.min(viewport.width, viewport.height) || 1;
  const customPathActive = config.geometrySource === "path" && config.customPath.points.length >= 2;
  const customPathControls = customPathActive ? getCustomPathPointsInViewport(config, viewport) : undefined;
  const animatedPathControls = customPathActive
    ? (customPathControls ?? config.customPath.points).map((point) => {
      const base = { x: point.x * viewport.width, y: point.y * viewport.height };
      const hasPathAnchors = config.anchorPoints.some((anchor) =>
        anchor.enabled && anchor.endpoint === "path" && anchor.pathPointId === point.id);
      if (!hasPathAnchors) return point;
      const animated = resolveAnchorSequence(base, "path", config, viewport, time, minDim, anchorPlayback, point.id);
      return { ...point, x: animated.x / viewport.width, y: animated.y / viewport.height };
    })
    : undefined;
  const customPathSegments = customPathActive ? sampleCustomPath(config, viewport, animatedPathControls) : [];
  const pathFrom: Point = customPathActive ? customPathSegments[0][0] : { x: config.from.x * viewport.width, y: config.from.y * viewport.height };
  const lastCustomSegment = customPathSegments[customPathSegments.length - 1];
  const pathTo: Point = customPathActive && lastCustomSegment
    ? lastCustomSegment[lastCustomSegment.length - 1]
    : { x: config.to.x * viewport.width, y: config.to.y * viewport.height };
  const hasStartAnchors = config.anchorPoints.some((point) => point.endpoint === "start" && point.enabled);
  const hasEndAnchors = config.anchorPoints.some((point) => point.endpoint === "end" && point.enabled);
  const from = hasStartAnchors
    ? resolveAnchorSequence(pathFrom, "start", config, viewport, time, minDim, anchorPlayback)
    : anchorMotionOffset(config.anchorMotion.start, pathFrom, time, minDim, true);
  const to = hasEndAnchors
    ? resolveAnchorSequence(pathTo, "end", config, viewport, time, minDim, anchorPlayback)
    : anchorMotionOffset(config.anchorMotion.end, pathTo, time, minDim, false);
  const dir = { x: to.x - from.x, y: to.y - from.y };

  const geometrySegments = customPathActive
    ? customPathSegments
    : [Array.from({ length: SAMPLES }, (_, index) => lerpPoint(from, to, index / (SAMPLES - 1)))];
  const segmentLengths = geometrySegments.map((segment) => segment.length);
  const sampleCount = segmentLengths.reduce((total, length) => total + length, 0);
  resizeRuntimeState(state, sampleCount);
  const sampleSegmentRanges: Array<{ start: number; end: number }> = [];
  let segmentOffset = 0;
  for (const length of segmentLengths) {
    sampleSegmentRanges.push({ start: segmentOffset, end: segmentOffset + length });
    segmentOffset += length;
  }
  const previousSampleIndices = new Array<number>(sampleCount);
  const nextSampleIndices = new Array<number>(sampleCount);
  for (const range of sampleSegmentRanges) {
    for (let index = range.start; index < range.end; index++) {
      previousSampleIndices[index] = Math.max(range.start, index - 1);
      nextSampleIndices[index] = Math.min(range.end - 1, index + 1);
    }
  }
  const motion = config.motion;
  const shape = config.shape;
  const motionTime = time;
  const amplitudePx = motion.amplitude * minDim * motionScale;

  // ---- 1. Base motion (ambient, always-on) ----
  const basePoints: Point[] = new Array(sampleCount);
  let sampleIndex = 0;
  geometrySegments.forEach((segment, segmentIndex) => {
    for (let localIndex = 0; localIndex < segment.length; localIndex++, sampleIndex++) {
      const s = localIndex / Math.max(1, segment.length - 1);
      const pathCurrent = customPathActive ? segment[localIndex] : undefined;
      const pathPrevious = customPathActive ? segment[Math.max(0, localIndex - 1)] : undefined;
      const pathNext = customPathActive ? segment[Math.min(segment.length - 1, localIndex + 1)] : undefined;
      const startDelta = { x: from.x - pathFrom.x, y: from.y - pathFrom.y };
      const endDelta = { x: to.x - pathTo.x, y: to.y - pathTo.y };
      const base = pathCurrent
        ? {
          x: pathCurrent.x +
            (segmentIndex === 0 ? startDelta.x * (1 - s) : 0) +
            (segmentIndex === geometrySegments.length - 1 ? endDelta.x * s : 0),
          y: pathCurrent.y +
            (segmentIndex === 0 ? startDelta.y * (1 - s) : 0) +
            (segmentIndex === geometrySegments.length - 1 ? endDelta.y * s : 0),
        }
        : lerpPoint(from, to, s);
      const localNormal = perpendicular(pathCurrent && pathPrevious && pathNext
        ? { x: pathNext.x - pathPrevious.x, y: pathNext.y - pathPrevious.y }
        : dir);
      const shapeDeform = shapeOffset(shape, s, minDim);

      let offset = 0;
      if (motion.type === "tension") {
        const envelope = Math.sin(Math.PI * s);
        offset = amplitudePx * envelope * Math.sin(motionTime * motion.speed * Math.PI * 2 + motion.phase);
      } else if (motion.type === "floating") {
        const envelope = 0.35 + 0.65 * Math.sin(Math.PI * s);
        offset =
          amplitudePx *
          envelope *
          (Math.sin(motionTime * motion.speed * Math.PI * 0.6 + motion.phase + s * motion.frequency * 2) * 0.7 +
            Math.sin(motionTime * motion.speed * Math.PI * 0.23 + motion.phase * 1.7) * 0.3);
      } else {
        const envelope = Math.sin(Math.PI * s);
        offset =
          amplitudePx *
          0.35 *
          envelope *
          Math.sin(motionTime * motion.speed * Math.PI * 2 * (3 + motion.frequency) + motion.phase + s * 14);
      }

      const totalOffset = shape.type === "straight" ? 0 : shapeDeform + offset;
      basePoints[sampleIndex] = { x: base.x + localNormal.x * totalOffset, y: base.y + localNormal.y * totalOffset };
    }
  });
  // ---- 2. Magnetic deformation (desired offsets, before spring easing) ----
  const desired: Point[] = new Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) desired[i] = { x: 0, y: 0 };
  const targetGlow: number[] = new Array(sampleCount).fill(0);
  const targetOuterGlow: number[] = new Array(sampleCount).fill(0);

  const magnetismOn = scene.global.magnetismEnabled && config.magnet.enabled;
  if (magnetismOn) {
    const active = getActiveTargets(scene.targets).filter((target) => { const targetConfig = scene.targets.find((item) => item.id === target.id); return targetConfig?.enabled !== false && targetConfig?.magnetic !== false && (!config.magnet.targetId || target.id === config.magnet.targetId); });
    if (active.length > 0) {
      const dominant: TargetRuntime = active[0];
      const targetCfg = scene.targets.find((t) => t.id === dominant.id);
      if (targetCfg?.enabled !== false && targetCfg?.magnetic !== false) {
      const registeredRect = dominant.rect!;
      const rect = { left: registeredRect.left - surfaceOffset.x, top: registeredRect.top - surfaceOffset.y, right: registeredRect.right - surfaceOffset.x, bottom: registeredRect.bottom - surfaceOffset.y, width: registeredRect.width, height: registeredRect.height };
      const radiusPx = (config.magnet.radius + (targetCfg?.radius ?? 0) + dominant.radius) * minDim;
      const strength = clamp01(config.magnet.strength * dominant.strength * (targetCfg?.strength ?? 1));
      const maxDeformPx = config.magnet.maxDeformation * minDim;
      const broadRadius = radiusPx + Math.max(rect.width, rect.height);
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;

      for (let i = 0; i < sampleCount; i++) {
        const p = basePoints[i];
        if (distance(p, { x: cx, y: cy }) > broadRadius) continue; // cheap broad-phase reject
        const nearest = nearestPointOnRectPerimeter(rect, p);
        const distToPerimeter = distance(p, nearest);
        const f = falloff(distToPerimeter, radiusPx, config.magnet.falloff);
        if (f <= 0 || strength <= 0 || maxDeformPx <= 0) continue;
        const pull = f * strength * config.motion.deformability * motionScale;
        const previous = basePoints[previousSampleIndices[i]];
        const next = basePoints[nextSampleIndices[i]];
        const localNormal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
        const signedDistance = (nearest.x - p.x) * localNormal.x + (nearest.y - p.y) * localNormal.y;
        if (Math.abs(signedDistance) <= 0.0001) continue;
        const displacement = Math.min(maxDeformPx, Math.abs(signedDistance) * pull);
        const direction = Math.sign(signedDistance);
        const dx = localNormal.x * displacement * direction;
        const dy = localNormal.y * displacement * direction;
        desired[i] = { x: dx, y: dy };

        const innerGlowRadiusPx = config.glow.radius * minDim;
        const innerGlowStrength = falloff(distToPerimeter, innerGlowRadiusPx, config.glow.falloff);
        if (config.glow.enabled) {
          targetGlow[i] = Math.max(targetGlow[i], innerGlowStrength * config.glow.intensity);
        }
        if (config.outerGlow.enabled) {
          const outerGlowRadiusPx = config.outerGlow.radius * minDim;
          const outerGlowStrength = falloff(distToPerimeter, outerGlowRadiusPx, config.outerGlow.falloff);
          targetOuterGlow[i] = Math.max(targetOuterGlow[i], outerGlowStrength * config.outerGlow.intensity);
        }
      }

      // Spread glow along a length window around the strongest sample, so the whole
      // background does not light up â€” only the relevant stretch of this one line.
      if (config.glow.enabled) spreadGlowSamples(targetGlow, config.glow.length);
      if (config.outerGlow.enabled) spreadGlowSamples(targetOuterGlow, config.outerGlow.length);
    }
  }
}

  // ---- 3. Spring easing toward the desired magnetic offset (frame-rate independent) ----
  const springTau = 0.18; // seconds â€” feel of settle-in / spring-back-on-release
  const springFactor = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) / springTau);
  for (let i = 0; i < sampleCount; i++) {
    state.deformOffset[i] = {
      x: lerp(state.deformOffset[i].x, desired[i].x, springFactor),
      y: lerp(state.deformOffset[i].y, desired[i].y, springFactor),
    };
  }

  // ---- 4. Cursor Influence (geometry only, after Magnet) ----
  const cursorDesired: Point[] = Array.from({ length: sampleCount }, () => ({ x: 0, y: 0 }));
  const magnetizedPoints = basePoints.map((point, i) => ({
    x: point.x + state.deformOffset[i].x,
    y: point.y + state.deformOffset[i].y,
  }));
  const cursorConfig = config.cursorInfluence;
  if (cursorConfig.enabled && pointer?.active && cursorConfig.radius > 0 && cursorConfig.maxDeformation > 0) {
    const radiusPx = cursorConfig.radius * minDim;
    const maxDeformPx = cursorConfig.maxDeformation * minDim;
    for (let i = 0; i < sampleCount; i++) {
      const s = i / Math.max(1, sampleCount - 1);
      const point = magnetizedPoints[i];
      const previous = magnetizedPoints[previousSampleIndices[i]];
      const next = magnetizedPoints[nextSampleIndices[i]];
      const tangent = { x: next.x - previous.x, y: next.y - previous.y };
      const localNormal = perpendicular(tangent);
      const dx = pointer.x - point.x;
      const dy = pointer.y - point.y;
      const distanceToPointer = Math.hypot(dx, dy);
      const influence = falloff(distanceToPointer, radiusPx, cursorConfig.falloff) * clamp01(cursorConfig.strength) * Math.sin(Math.PI * s);
      if (influence <= 0) continue;
      const normalPull = dx * localNormal.x + dy * localNormal.y;
      let offsetX = localNormal.x * normalPull * influence;
      let offsetY = localNormal.y * normalPull * influence;
      const magnitude = Math.hypot(offsetX, offsetY);
      if (magnitude > maxDeformPx && magnitude > 0) {
        offsetX = (offsetX / magnitude) * maxDeformPx;
        offsetY = (offsetY / magnitude) * maxDeformPx;
      }
      cursorDesired[i] = { x: offsetX, y: offsetY };
    }
  }
  const cursorSpringFactor = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) / 0.12);
  for (let i = 0; i < sampleCount; i++) {
    state.cursorOffset[i] = {
      x: lerp(state.cursorOffset[i].x, cursorDesired[i].x, cursorSpringFactor),
      y: lerp(state.cursorOffset[i].y, cursorDesired[i].y, cursorSpringFactor),
    };
  }

  // ---- 4. Ambient cursor glow (visual only â€” never bends the line) ----
  const ambientTarget: number[] = new Array(sampleCount).fill(0);
  const preConstraintPoints = basePoints.map((point, i) => ({
    x: point.x + state.deformOffset[i].x + state.cursorOffset[i].x,
    y: point.y + state.deformOffset[i].y + state.cursorOffset[i].y,
  }));
  const finalGeometryPoints = preConstraintPoints.map((point, i) => ({
    x: point.x + (interactionOffset?.[i]?.x ?? 0),
    y: point.y + (interactionOffset?.[i]?.y ?? 0),
  }));
  const constraint = config.constraint;
  if (constraint.enabled) {
    const maxDeformPx = constraint.maxDeformation * minDim;
    const paddingPx = constraint.padding * minDim;
    for (let i = 0; i < finalGeometryPoints.length; i++) {
      const reference = basePoints[i];
      const point = finalGeometryPoints[i];
      const dx = point.x - reference.x;
      const dy = point.y - reference.y;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude > maxDeformPx && magnitude > 0) {
        point.x = reference.x + (dx / magnitude) * maxDeformPx;
        point.y = reference.y + (dy / magnitude) * maxDeformPx;
      }
      if (constraint.boundary === "viewport") {
        point.x = clamp(point.x, paddingPx, Math.max(paddingPx, viewport.width - paddingPx));
        point.y = clamp(point.y, paddingPx, Math.max(paddingPx, viewport.height - paddingPx));
      }
    }
  }
  const ambientOn = scene.cursor.enabled && config.cursorGlow.enabled && pointer?.active;
  if (ambientOn && pointer) {
    const radiusPx = scene.cursor.radius * minDim;
    const intensity = scene.cursor.intensity * scene.cursor.opacity;
    if (radiusPx > 0 && intensity > 0) {
      for (let i = 0; i < sampleCount; i++) {
        const d = distance(finalGeometryPoints[i], { x: pointer.x, y: pointer.y });
        ambientTarget[i] = falloff(d, radiusPx, scene.cursor.falloff) * intensity;
      }
      let strongest = 0;
      for (let i = 1; i < sampleCount; i++) if (ambientTarget[i] > ambientTarget[strongest]) strongest = i;
      const spread = Math.max(1, Math.round(scene.cursor.length * sampleCount));
      for (let i = 0; i < sampleCount; i++) {
        const distanceFromStrongest = Math.abs(i - strongest);
        if (distanceFromStrongest > spread) ambientTarget[i] = 0;
        else ambientTarget[i] *= 1 - distanceFromStrongest / (spread + 1);
      }
    }
  }

  // ---- 5. Combine + ease glow, keeping ambient color separate ----
  const smoothing = clamp01(scene.cursor.smoothing);
  const attackFactor = 1 - Math.exp(-dt / lerp(0.05, 0.6, smoothing));
  const releaseFactor = 1 - Math.exp(-dt / lerp(0.8, 0.05, scene.cursor.releaseSpeed));
  let ambientMaxGlow = 0;
  for (let i = 0; i < sampleCount; i++) {
    const ambientValue = Math.min(scene.cursor.maxIntensity, scene.global.glowMaxCombinedIntensity, ambientTarget[i]);
    state.ambientGlowIntensity[i] = lerp(state.ambientGlowIntensity[i], ambientValue, ambientValue < state.ambientGlowIntensity[i] ? releaseFactor : attackFactor);
    const glowValue = Math.min(scene.global.glowMaxCombinedIntensity, targetGlow[i]);
    state.glowIntensity[i] = lerp(state.glowIntensity[i], glowValue, glowValue < state.glowIntensity[i] ? releaseFactor : attackFactor);
    const outerGlowValue = Math.min(scene.global.glowMaxCombinedIntensity, targetOuterGlow[i]);
    state.outerGlowIntensity[i] = lerp(state.outerGlowIntensity[i], outerGlowValue, outerGlowValue < state.outerGlowIntensity[i] ? releaseFactor : attackFactor);
    const combinedIntensity = state.ambientGlowIntensity[i] + state.glowIntensity[i] + state.outerGlowIntensity[i];
    if (combinedIntensity > scene.global.glowMaxCombinedIntensity) {
      const scale = scene.global.glowMaxCombinedIntensity / combinedIntensity;
      state.ambientGlowIntensity[i] *= scale;
      state.glowIntensity[i] *= scale;
      state.outerGlowIntensity[i] *= scale;
    }
    if (state.ambientGlowIntensity[i] > ambientMaxGlow) ambientMaxGlow = state.ambientGlowIntensity[i];
  }

  // ---- 6. Final geometry ----
  const finalPoints = finalGeometryPoints;
  let maxGlow = 0;
  let maxOuterGlow = 0;
  for (let i = 0; i < sampleCount; i++) {
    if (state.glowIntensity[i] > maxGlow) maxGlow = state.glowIntensity[i];
    if (state.outerGlowIntensity[i] > maxOuterGlow) maxOuterGlow = state.outerGlowIntensity[i];
  }

  return {
    d: pathFromSegments(
      finalPoints,
      segmentLengths,
      shape.type === "pixel"
        ? "pixel"
        : (shape.type === "sharp" || shape.type === "straight") && customPathActive
          ? "polyline"
          : "smooth",
      Math.max(1, shape.pixelStep),
    ),
    maxGlow,
    maxOuterGlow,
    points: finalPoints,
    glowStops: state.glowIntensity,
    outerGlowStops: state.outerGlowIntensity,
    ambientGlow: ambientMaxGlow,
  };
}
