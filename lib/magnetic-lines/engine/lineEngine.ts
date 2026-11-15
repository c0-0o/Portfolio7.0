// ============================================================================
// The one physics/rendering engine. Both the production component and the
// editor's live preview call this â€” there is no separate "preview renderer".
// ============================================================================

import type { AnchorPointEndpoint, EnvironmentConfig, MagneticLineConfig, MagneticLinesSceneConfig, PathPoint, Point } from "../types";
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
import { createTargetFrameContext, type TargetFrameContext } from "./targetRegistry";
import { isTargetLineEffectActive } from "./targetLineTriggers";
import { createAirflowField, resolveLineEnvironment } from "../environment";
import { getTextureGravityResponse, getTextureMaterialResponse } from "../texture";

export const SAMPLES = 24;
type StaticCustomPathGeometry = {
  width: number;
  height: number;
  controls: PathPoint[];
  segments: Point[][];
};
const staticCustomPathGeometryCache = new WeakMap<MagneticLineConfig, StaticCustomPathGeometry>();

export interface LineRuntimeState {
  /** Current, eased (spring) magnetic offset per sample point, in px. */
  deformOffset: Point[];
  /** Current, eased airflow-driven offset per sample point, in px. */
  environmentOffset: Point[];
  /** Current, eased pointer-driven geometry offset per sample point, in px. */
  cursorOffset: Point[];
  /** Current, eased target and cursor glow intensity per sample point, 0..1. */
  glowIntensity: number[];
  outerGlowIntensity: number[];
}

export function createLineRuntimeState(): LineRuntimeState {
  return {
    deformOffset: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0 })),
    environmentOffset: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0 })),
    cursorOffset: Array.from({ length: SAMPLES }, () => ({ x: 0, y: 0 })),
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
  alwaysTimeByPathPointId?: ReadonlyMap<string, number>;
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
  segmentLengths: number[];
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

function getAnchorSegmentDuration(from: Point, to: Point, target: MagneticLineConfig["anchorPoints"][number], includeDelay = true): number {
  const delay = includeDelay ? Math.max(0, target.delay) : 0;
  if (Math.hypot(to.x - from.x, to.y - from.y) <= 0.001) return delay;
  const speed = Number.isFinite(target.speed) && target.speed > 0 ? target.speed : 1;
  return delay + 1 / Math.max(0.05, speed);
}

export function getAnchorSequenceStepStartTime(
  base: Point,
  points: MagneticLineConfig["anchorPoints"],
  viewport: { width: number; height: number },
  stepIndex: number,
): number {
  const minDim = Math.min(viewport.width, viewport.height) || 1;
  let elapsed = 0;
  let previous = base;
  for (const point of points.slice(0, Math.max(0, stepIndex))) {
    const target = resolveAnchorPointTarget(point, base, viewport, minDim);
    elapsed += getAnchorSegmentDuration(previous, target, point);
    previous = target;
  }
  return elapsed;
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
    return getAnchorSegmentDuration(path[index], path[index + 1], target, index < points.length);
  });
  const cycleDuration = segmentDurations.reduce((total, duration) => total + duration, 0);
  const triggerTime = trigger === "hover"
    ? playback?.hovering || points.some((point) => point.hoverExitBehavior === "continue")
      ? playback?.hoverTime ?? 0
      : playback?.hoverFrozenTime ?? 0
    : trigger === "click"
      ? playback?.clickTime ?? 0
      : pathPointId && playback?.alwaysTimeByPathPointId?.has(pathPointId)
        ? playback.alwaysTimeByPathPointId.get(pathPointId) ?? playback.alwaysTime ?? time
        : playback?.alwaysTime ?? time;

  const elapsed = Math.max(0, Number.isFinite(triggerTime) ? triggerTime : 0);
  const progressTime = oneShot ? Math.min(elapsed, cycleDuration) : elapsed % Math.max(0.001, cycleDuration);
  let segmentIndex = 0;
  let segmentProgress = 0;
  let remaining = progressTime;
  for (; segmentIndex < segmentDurations.length; segmentIndex++) {
    const duration = segmentDurations[segmentIndex];
    if (remaining <= duration || segmentIndex === segmentDurations.length - 1) {
      const target = points[Math.min(segmentIndex, points.length - 1)];
      const delay = segmentIndex < points.length ? Math.max(0, target.delay) : 0;
      const movementDuration = Math.max(0, duration - delay);
      segmentProgress = remaining <= delay
        ? 0
        : movementDuration > 0
          ? Math.min(1, (remaining - delay) / movementDuration)
          : 1;
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

function sampleSmoothPath(
  source: PathPoint[],
  viewport: { width: number; height: number },
  smoothing: number,
  closed: boolean,
): Point[] {
  const points = source.map((point) => ({ x: point.x * viewport.width, y: point.y * viewport.height }));
  const controls = closed ? points.slice(0, -1) : points;
  const segmentCount = closed ? controls.length : controls.length - 1;
  if (smoothing <= 0 || segmentCount < 2) return samplePolyline(source, viewport);

  const segmentLengths = Array.from({ length: segmentCount }, (_, index) =>
    distance(controls[index], controls[(index + 1) % controls.length]));
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0);
  if (totalLength <= 0) return samplePolyline(source, viewport);

  const intervals = Math.max(segmentCount, Math.min(96, Math.max(32, segmentCount * 4, Math.ceil(totalLength / 10))));
  const minimumPerSegment = Math.min(4, Math.floor(intervals / segmentCount));
  const remainingIntervals = intervals - minimumPerSegment * segmentCount;
  const allocations = segmentLengths.map((length) => {
    const ideal = (length / totalLength) * remainingIntervals;
    return { intervals: minimumPerSegment + Math.floor(ideal), remainder: ideal - Math.floor(ideal) };
  });
  const unallocated = intervals - allocations.reduce((total, allocation) => total + allocation.intervals, 0);
  allocations
    .map((allocation, index) => ({ index, remainder: allocation.remainder }))
    .sort((left, right) => right.remainder - left.remainder)
    .slice(0, unallocated)
    .forEach(({ index }) => { allocations[index].intervals += 1; });

  const knotDistance = (left: Point, right: Point) => Math.max(0.0001, Math.sqrt(distance(left, right)));
  const curvePoint = (segmentIndex: number, t: number): Point => {
    const nextIndex = (segmentIndex + 1) % controls.length;
    const p0 = closed ? controls[(segmentIndex - 1 + controls.length) % controls.length] : controls[Math.max(0, segmentIndex - 1)];
    const p1 = controls[segmentIndex];
    const p2 = controls[nextIndex];
    const p3 = closed ? controls[(nextIndex + 1) % controls.length] : controls[Math.min(controls.length - 1, segmentIndex + 2)];
    const t0 = 0;
    const t1 = t0 + knotDistance(p0, p1);
    const t2 = t1 + knotDistance(p1, p2);
    const t3 = t2 + knotDistance(p2, p3);
    const tValue = t1 + (t2 - t1) * t;
    const interpolate = (left: Point, right: Point, leftTime: number, rightTime: number) => {
      const ratio = (tValue - leftTime) / Math.max(0.0001, rightTime - leftTime);
      return lerpPoint(left, right, ratio);
    };
    const a1 = interpolate(p0, p1, t0, t1);
    const a2 = interpolate(p1, p2, t1, t2);
    const a3 = interpolate(p2, p3, t2, t3);
    const b1 = interpolate(a1, a2, t0, t2);
    const b2 = interpolate(a2, a3, t1, t3);
    const curved = interpolate(b1, b2, t1, t2);
    const linear = lerpPoint(p1, p2, t);
    return lerpPoint(linear, curved, smoothing);
  };

  const sampled: Point[] = [points[0]];
  allocations.forEach((allocation, segmentIndex) => {
    for (let step = 1; step <= allocation.intervals; step++) {
      sampled.push(curvePoint(segmentIndex, step / allocation.intervals));
    }
  });
  if (closed) sampled[sampled.length - 1] = { ...sampled[0] };
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
  if (usableSegments.length > 0) return usableSegments.map((segment) => {
    const closed = config.customPath.curveSmoothing !== undefined &&
      config.customPath.closedJoint !== "breakable" &&
      !segment.some((point) => point.moveTo) &&
      segment.length > 2 &&
      segment[0].x === segment[segment.length - 1].x &&
      segment[0].y === segment[segment.length - 1].y;
    return sampleSmoothPath(segment, viewport, config.customPath.curveSmoothing ?? 0, closed);
  });
  const fallback = [{ id: "path-start", ...config.from }, { id: "path-end", ...config.to }];
  return [samplePolyline(fallback, viewport)];
}

function getStaticCustomPathGeometry(
  config: MagneticLineConfig,
  viewport: { width: number; height: number },
): StaticCustomPathGeometry {
  const cached = staticCustomPathGeometryCache.get(config);
  if (cached?.width === viewport.width && cached.height === viewport.height) return cached;

  const controls = getCustomPathPointsInViewport(config, viewport);
  const geometry = {
    width: viewport.width,
    height: viewport.height,
    controls,
    segments: sampleCustomPath(config, viewport, controls),
  };
  staticCustomPathGeometryCache.set(config, geometry);
  return geometry;
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
  const offsets = [state.deformOffset, state.environmentOffset, state.cursorOffset];
  for (const values of offsets) {
    if (values.length < sampleCount) {
      values.push(...Array.from({ length: sampleCount - values.length }, () => ({ x: 0, y: 0 })));
    } else if (values.length > sampleCount) {
      values.length = sampleCount;
    }
  }
  const intensities = [state.glowIntensity, state.outerGlowIntensity];
  for (const values of intensities) {
    if (values.length < sampleCount) values.push(...new Array(sampleCount - values.length).fill(0));
    else if (values.length > sampleCount) values.length = sampleCount;
  }
}

export function pathSegmentsFromResult(
  points: Point[],
  segmentLengths: number[],
  pathType: "smooth" | "polyline" | "pixel",
  pixelStep: number,
): string[] {
  let offset = 0;
  return segmentLengths.map((length) => {
    const segment = points.slice(offset, offset + length);
    offset += length;
    if (pathType === "pixel") return pointsToPixelPath(segment, pixelStep);
    if (pathType === "polyline") return pointsToPolylinePath(segment);
    const closed = segment.length > 2 &&
      segment[0].x === segment[segment.length - 1].x &&
      segment[0].y === segment[segment.length - 1].y;
    return pointsToSmoothPath(segment, closed);
  });
}

function pathFromSegments(
  points: Point[],
  segmentLengths: number[],
  pathType: "smooth" | "polyline" | "pixel",
  pixelStep: number,
): string {
  return pathSegmentsFromResult(points, segmentLengths, pathType, pixelStep).join(" ");
}

function smoothAirflowOffsets(offsets: Point[], ranges: Array<{ start: number; end: number }>): Point[] {
  const smoothed = offsets.map((point) => ({ ...point }));
  for (const range of ranges) {
    const length = range.end - range.start;
    const radius = Math.min(8, Math.max(2, Math.floor(length * 0.04)));
    for (let index = range.start; index < range.end; index++) {
      let totalWeight = 0;
      let x = 0;
      let y = 0;
      for (let neighbor = Math.max(range.start, index - radius); neighbor <= Math.min(range.end - 1, index + radius); neighbor++) {
        const weight = radius + 1 - Math.abs(index - neighbor);
        totalWeight += weight;
        x += offsets[neighbor].x * weight;
        y += offsets[neighbor].y * weight;
      }
      smoothed[index] = { x: x / totalWeight, y: y / totalWeight };
    }
  }
  return smoothed;
}

function getGravityOffsets(
  samples: Point[],
  fixedPointIds: string[],
  customPathControls: PathPoint[] | undefined,
  viewport: { width: number; height: number },
  strength: number,
  materialResponse: number,
): Point[] {
  const offsets = Array.from({ length: samples.length }, () => ({ x: 0, y: 0 }));
  if (strength <= 0 || offsets.length === 0) return offsets;
  const fixedPoints: Point[] = [];
  if (customPathControls) {
    for (const id of fixedPointIds) {
      const point = id === "start"
        ? customPathControls[0]
        : id === "end"
          ? customPathControls[customPathControls.length - 1]
          : customPathControls.find((item) => item.id === id);
      if (point) fixedPoints.push({ x: point.x * viewport.width, y: point.y * viewport.height });
    }
  } else {
    if (fixedPointIds.includes("start")) fixedPoints.push(samples[0]);
    if (fixedPointIds.includes("end")) fixedPoints.push(samples[samples.length - 1]);
  }

  const seenFixedPointKeys = new Set<string>();
  const uniqueFixedPoints = fixedPoints.filter((point) => {
    const key = `${Math.round(point.x * 4)}:${Math.round(point.y * 4)}`;
    if (seenFixedPointKeys.has(key)) return false;
    seenFixedPointKeys.add(key);
    return true;
  });
  if (uniqueFixedPoints.length === 0) {
    let lowestPoint = Number.NEGATIVE_INFINITY;
    for (const point of samples) lowestPoint = Math.max(lowestPoint, point.y);
    const drop = Math.max(0, viewport.height - lowestPoint);
    return offsets.map(() => ({ x: 0, y: drop * materialResponse }));
  }

  let maximumDistance = 0;
  const distances = samples.map((sample) => {
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const point of uniqueFixedPoints) {
      nearestDistance = Math.min(nearestDistance, distance(sample, point));
    }
    maximumDistance = Math.max(maximumDistance, nearestDistance);
    return nearestDistance;
  });
  if (maximumDistance <= 0) return offsets;

  const maximumSag = Math.min(viewport.width, viewport.height) * 0.2 * strength * materialResponse;
  for (let index = 0; index < samples.length; index++) {
    if (distances[index] < 0.25) continue;
    const progress = distances[index] / maximumDistance;
    const sagAmount = progress * progress * (3 - 2 * progress);
    const availableDrop = Math.max(0, viewport.height - samples[index].y);
    const drop = uniqueFixedPoints.length === 1
      ? availableDrop * sagAmount * materialResponse
      : Math.min(availableDrop, maximumSag * sagAmount);
    offsets[index] = { x: 0, y: drop };
  }
  return offsets;
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
  anchorPlayback?: AnchorPlaybackState,
  targetFrameContext?: TargetFrameContext,
  resolvedEnvironment?: EnvironmentConfig,
): ComputeResult {
  const minDim = Math.min(viewport.width, viewport.height) || 1;
  const bendable = config.shape.bendable !== false;
  const customPathActive = config.geometrySource === "path" && config.customPath.points.length >= 2;
  const hasPathAnchors = customPathActive && bendable && config.anchorPoints.some((anchor) =>
    anchor.enabled && anchor.endpoint === "path");
  const staticPathGeometry = customPathActive && !hasPathAnchors
    ? getStaticCustomPathGeometry(config, viewport)
    : undefined;
  const customPathControls = customPathActive
    ? staticPathGeometry?.controls ?? getCustomPathPointsInViewport(config, viewport)
    : undefined;
  const animatedPathControls = customPathActive
    ? hasPathAnchors
      ? (customPathControls ?? config.customPath.points).map((point) => {
      const base = { x: point.x * viewport.width, y: point.y * viewport.height };
      const hasPathAnchors = bendable && config.anchorPoints.some((anchor) =>
        anchor.enabled && anchor.endpoint === "path" && anchor.pathPointId === point.id);
      if (!hasPathAnchors) return point;
      const animated = resolveAnchorSequence(base, "path", config, viewport, time, minDim, anchorPlayback, point.id);
      return { ...point, x: animated.x / viewport.width, y: animated.y / viewport.height };
    })
      : customPathControls
    : undefined;
  const customPathSegments = customPathActive
    ? staticPathGeometry?.segments ?? sampleCustomPath(config, viewport, animatedPathControls)
    : [];
  const pathFrom: Point = customPathActive ? customPathSegments[0][0] : { x: config.from.x * viewport.width, y: config.from.y * viewport.height };
  const lastCustomSegment = customPathSegments[customPathSegments.length - 1];
  const pathTo: Point = customPathActive && lastCustomSegment
    ? lastCustomSegment[lastCustomSegment.length - 1]
    : { x: config.to.x * viewport.width, y: config.to.y * viewport.height };
  const hasStartAnchors = bendable && config.anchorPoints.some((point) => point.endpoint === "start" && point.enabled);
  const hasEndAnchors = bendable && config.anchorPoints.some((point) => point.endpoint === "end" && point.enabled);
  const from = !bendable
    ? pathFrom
    : hasStartAnchors
    ? resolveAnchorSequence(pathFrom, "start", config, viewport, time, minDim, anchorPlayback)
    : anchorMotionOffset(config.anchorMotion.start, pathFrom, time, minDim, true);
  const to = !bendable
    ? pathTo
    : hasEndAnchors
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
  const sampleEndpointEnvelopes = new Array<number>(sampleCount);
  for (const range of sampleSegmentRanges) {
    for (let index = range.start; index < range.end; index++) {
      previousSampleIndices[index] = Math.max(range.start, index - 1);
      nextSampleIndices[index] = Math.min(range.end - 1, index + 1);
      const progress = (index - range.start) / Math.max(1, range.end - range.start - 1);
      sampleEndpointEnvelopes[index] = Math.sin(Math.PI * progress);
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
      const shapeDeform = bendable ? shapeOffset(shape, s, minDim) : 0;

      let offset = 0;
      if (bendable && motion.enabled !== false && motion.type === "tension") {
        const envelope = Math.sin(Math.PI * s);
        offset = amplitudePx * envelope * Math.sin(motionTime * motion.speed * Math.PI * 2 + motion.phase);
      } else if (bendable && motion.enabled !== false && motion.type === "floating") {
        const envelope = 0.35 + 0.65 * Math.sin(Math.PI * s);
        offset =
          amplitudePx *
          envelope *
          (Math.sin(motionTime * motion.speed * Math.PI * 0.6 + motion.phase + s * motion.frequency * 2) * 0.7 +
            Math.sin(motionTime * motion.speed * Math.PI * 0.23 + motion.phase * 1.7) * 0.3);
      } else if (bendable && motion.enabled !== false) {
        const envelope = Math.sin(Math.PI * s);
        offset =
          amplitudePx *
          0.35 *
          envelope *
          Math.sin(motionTime * motion.speed * Math.PI * 2 * (3 + motion.frequency) + motion.phase + s * 14);
      }

      const totalOffset = (shape.type === "straight" && !customPathActive ? 0 : shapeDeform) + offset;
      basePoints[sampleIndex] = { x: base.x + localNormal.x * totalOffset, y: base.y + localNormal.y * totalOffset };
    }
  });
  if (bendable && config.gravity?.enabled) {
    const gravityOffsets = getGravityOffsets(
      basePoints,
      config.gravity.fixedPointIds ?? ["start", "end"],
      customPathActive ? animatedPathControls : undefined,
      viewport,
      config.gravity.strength ?? 0.35,
      getTextureGravityResponse(config.texture.type, config.texture.weight, config.texture.enabled),
    );
    for (let index = 0; index < basePoints.length; index++) {
      basePoints[index].y += gravityOffsets[index].y;
    }
  }
  // ---- 2. Magnetic deformation (desired offsets, before spring easing) ----
  const desired: Point[] = new Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) desired[i] = { x: 0, y: 0 };
  const targetGlow: number[] = new Array(sampleCount).fill(0);

  const magnetismOn = bendable && scene.global.magnetismEnabled && config.magnet.enabled;
  const targetEffectsOn = magnetismOn || config.glow.enabled;
  if (targetEffectsOn) {
    const targetContext = targetFrameContext ?? createTargetFrameContext(scene.targets);
    const isAssignedTarget = (targetConfig: TargetFrameContext[number]["config"]) =>
      targetConfig?.enabled !== false &&
      (targetConfig?.lineIds == null || targetConfig.lineIds.includes(config.id));
    const magnetTarget = magnetismOn
      ? targetContext.find(({ runtime, config: targetConfig, activeActivations }) =>
          isAssignedTarget(targetConfig) &&
          runtime.magnetic &&
          targetConfig?.magnetic !== false &&
          (!config.magnet.targetId || runtime.id === config.magnet.targetId) &&
          isTargetLineEffectActive(targetConfig, config.id, "magnet", activeActivations))
      : undefined;
    const glowTarget = config.glow.enabled
      ? targetContext.find(({ config: targetConfig, activeActivations }) =>
          isAssignedTarget(targetConfig) &&
          isTargetLineEffectActive(targetConfig, config.id, "glow", activeActivations))
      : undefined;
    const effectTargets = magnetTarget === glowTarget
      ? magnetTarget ? [magnetTarget] : []
      : [magnetTarget, glowTarget].filter((target) => target !== undefined);
    for (const effectTarget of effectTargets) {
      const { runtime: dominant, config: targetCfg } = effectTarget;
      const targetMagnetActive = effectTarget === magnetTarget;
      const targetGlowActive = effectTarget === glowTarget;
      const registeredRect = dominant.rect!;
      const rect = {
        left: registeredRect.left - surfaceOffset.x,
        top: registeredRect.top - surfaceOffset.y,
        right: registeredRect.right - surfaceOffset.x,
        bottom: registeredRect.bottom - surfaceOffset.y,
        width: registeredRect.width,
        height: registeredRect.height,
      };
      const radiusPx = (config.magnet.radius + (targetCfg?.radius ?? dominant.radius)) * minDim;
      const strength = clamp01((config.magnet.strength / 100) * (targetCfg?.strength ?? dominant.strength));
      const maxDeformPx = config.magnet.maxDeformation * minDim;
      const innerGlowRadiusPx = config.glow.enabled ? config.glow.radius * minDim : 0;
      const broadRadius = Math.max(
        targetMagnetActive ? radiusPx : 0,
        targetGlowActive ? innerGlowRadiusPx : 0,
      ) + Math.max(rect.width, rect.height);
      const cx = (rect.left + rect.right) / 2;
      const cy = (rect.top + rect.bottom) / 2;
      const pointerInsideTarget = pointer?.active && config.cursorGlow.enabled &&
        pointer.x >= rect.left && pointer.x <= rect.right &&
        pointer.y >= rect.top && pointer.y <= rect.bottom;

      for (let i = 0; i < sampleCount; i++) {
        const p = basePoints[i];
        if (distance(p, { x: cx, y: cy }) > broadRadius) continue; // cheap broad-phase reject
        const nearest = nearestPointOnRectPerimeter(rect, p);
        const distToPerimeter = distance(p, nearest);
        if (targetGlowActive && !pointerInsideTarget) {
          const innerGlowStrength = falloff(distToPerimeter, innerGlowRadiusPx, config.glow.falloff / 100);
          targetGlow[i] = Math.max(
            targetGlow[i],
            innerGlowStrength * clamp01(config.glow.intensity / 100) * clamp01(config.glow.opacity / 100),
          );
        }
        if (!targetMagnetActive || strength <= 0 || maxDeformPx <= 0) continue;
        const f = falloff(distToPerimeter, radiusPx, config.magnet.falloff / 100);
        if (f <= 0) continue;
        const pull = f * strength * config.motion.deformability * motionScale;
        const previous = basePoints[previousSampleIndices[i]];
        const next = basePoints[nextSampleIndices[i]];
        const localNormal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
        const signedDistance = (nearest.x - p.x) * localNormal.x + (nearest.y - p.y) * localNormal.y;
        if (Math.abs(signedDistance) <= 0.0001) continue;
        const displacement = maxDeformPx * pull;
        const direction = Math.sign(signedDistance);
        const dx = localNormal.x * displacement * direction;
        const dy = localNormal.y * displacement * direction;
        desired[i] = { x: dx, y: dy };
      }

      // Spread glow along a length window around the strongest sample, so the whole
      // background does not light up â€” only the relevant stretch of this one line.
      if (targetGlowActive) spreadGlowSamples(targetGlow, config.glow.length / 100);
  }
}

  // ---- 3. Spring easing toward the desired magnetic offset (frame-rate independent) ----
  const springTau = 0.18; // seconds â€” feel of settle-in / spring-back-on-release
  const springFactor = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) / springTau);
  for (let i = 0; i < sampleCount; i++) {
    state.deformOffset[i] = bendable
      ? {
        x: lerp(state.deformOffset[i].x, desired[i].x, springFactor),
        y: lerp(state.deformOffset[i].y, desired[i].y, springFactor),
      }
      : { x: 0, y: 0 };
  }

  // ---- 4. Local airflow response (after Magnet, before cursor influence) ----
  const environment = resolvedEnvironment ?? resolveLineEnvironment(scene.global.environment, config.environment, config.environmentEnabled);
  const isSilk = config.texture.enabled && config.texture.type === "silk";
  const materialResponse = getTextureMaterialResponse(config.texture.type, config.texture.weight, config.texture.enabled);
  const hasAirflowGuides = (environment.airflowPaths ?? [environment.airflowPath]).some((path) => path.length >= 2);
  const minimumAirflowRadius = environment.airflowBehavior === "random" && !hasAirflowGuides ? 0 : sampleSegmentRanges.reduce((minimum, range) => {
    if (range.end - range.start < 2) return minimum;
    let segmentLength = 0;
    for (let index = range.start + 1; index < range.end; index++) {
      segmentLength += distance(basePoints[index - 1], basePoints[index]);
    }
    return Math.max(minimum, (segmentLength / (range.end - range.start - 1)) * 0.6);
  }, 0);
  const airflowField = bendable ? createAirflowField(environment, viewport, isSilk, minimumAirflowRadius) : null;
  const airSpringTau = config.texture.enabled && config.texture.type === "silk" ? 0.3 : 0.19;
  const airSpringFactor = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) / airSpringTau);
  const desiredAirOffsets = new Array<Point>(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    let desiredAir = { x: 0, y: 0 };
    if (airflowField) {
      const previous = basePoints[previousSampleIndices[i]];
      const next = basePoints[nextSampleIndices[i]];
      desiredAir = airflowField(
        { x: basePoints[i].x + state.deformOffset[i].x, y: basePoints[i].y + state.deformOffset[i].y },
        { x: next.x - previous.x, y: next.y - previous.y },
        time,
        materialResponse,
      );
    }
    desiredAirOffsets[i] = desiredAir;
  }
  const resolvedAirOffsets = isSilk || environment.airflowBehavior === "random"
    ? smoothAirflowOffsets(desiredAirOffsets, sampleSegmentRanges)
    : desiredAirOffsets;
  for (let i = 0; i < sampleCount; i++) {
    state.environmentOffset[i] = bendable
      ? {
        x: lerp(state.environmentOffset[i].x, resolvedAirOffsets[i].x, airSpringFactor),
        y: lerp(state.environmentOffset[i].y, resolvedAirOffsets[i].y, airSpringFactor),
      }
      : { x: 0, y: 0 };
  }

  // ---- 5. Cursor Influence (geometry only, after Magnet and airflow) ----
  const cursorConfig = config.cursorInfluence;
  const cursorActive = bendable &&
    cursorConfig.enabled &&
    pointer?.active === true &&
    cursorConfig.radius > 0 &&
    cursorConfig.maxDeformation > 0;
  let cursorDesired: Point[] | null = null;
  if (cursorActive && pointer) {
    cursorDesired = Array.from({ length: sampleCount }, () => ({ x: 0, y: 0 }));
    const magnetizedPoints = basePoints.map((point, i) => ({
      x: point.x + state.deformOffset[i].x + state.environmentOffset[i].x,
      y: point.y + state.deformOffset[i].y + state.environmentOffset[i].y,
    }));
    const gravityPinnedSampleIndices = new Set<number>();
    if (config.gravity?.enabled) {
      const fixedPointIds = config.gravity.fixedPointIds ?? ["start", "end"];
      for (const id of fixedPointIds) {
        let fixedPoint: Point | undefined;
        if (customPathActive && animatedPathControls) {
          const pathPoint = id === "start"
            ? animatedPathControls[0]
            : id === "end"
              ? animatedPathControls[animatedPathControls.length - 1]
              : animatedPathControls.find((point) => point.id === id);
          if (pathPoint) fixedPoint = { x: pathPoint.x * viewport.width, y: pathPoint.y * viewport.height };
        } else if (id === "start") {
          fixedPoint = basePoints[0];
        } else if (id === "end") {
          fixedPoint = basePoints[basePoints.length - 1];
        }
        if (!fixedPoint) continue;

        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < basePoints.length; index++) {
          const candidateDistance = distance(basePoints[index], fixedPoint);
          if (candidateDistance < nearestDistance) {
            nearestDistance = candidateDistance;
            nearestIndex = index;
          }
        }
        gravityPinnedSampleIndices.add(nearestIndex);
      }
    }
    const radiusPx = cursorConfig.radius * minDim;
    const maxDeformPx = cursorConfig.maxDeformation * minDim;
    for (let i = 0; i < sampleCount; i++) {
      if (gravityPinnedSampleIndices.has(i)) continue;
      const point = magnetizedPoints[i];
      const previous = magnetizedPoints[previousSampleIndices[i]];
      const next = magnetizedPoints[nextSampleIndices[i]];
      const tangent = { x: next.x - previous.x, y: next.y - previous.y };
      const localNormal = perpendicular(tangent);
      const dx = pointer.x - point.x;
      const dy = pointer.y - point.y;
      const distanceToPointer = Math.hypot(dx, dy);
      const direction = cursorConfig.mode === "repel" ? -1 : 1;
      const distanceInfluence = falloff(distanceToPointer, radiusPx, cursorConfig.falloff);
      const profileExponent = cursorConfig.profile === "soft" ? 0.5 : cursorConfig.profile === "focused" ? 2 : 1;
      const normalPull = dx * localNormal.x + dy * localNormal.y;
      if (distanceInfluence <= 0 || Math.abs(normalPull) <= 0.0001) continue;
      const influence = Math.min(1, Math.pow(distanceInfluence, profileExponent) * Math.max(0, cursorConfig.strength) * materialResponse) *
        sampleEndpointEnvelopes[i];
      const displacement = maxDeformPx * influence * Math.sign(normalPull) * direction;
      const offsetX = localNormal.x * displacement;
      const offsetY = localNormal.y * displacement;
      cursorDesired[i] = { x: offsetX, y: offsetY };
    }
  }
  const cursorSmoothingTime = 0.02 + clamp01(cursorConfig.smoothing) * 0.5;
  const cursorSpringFactor = 1 - Math.exp(-Math.min(0.05, Math.max(0, dt)) / cursorSmoothingTime);
  for (let i = 0; i < sampleCount; i++) {
    state.cursorOffset[i] = bendable && cursorConfig.enabled
      ? {
        x: lerp(state.cursorOffset[i].x, cursorDesired?.[i]?.x ?? 0, cursorSpringFactor),
        y: lerp(state.cursorOffset[i].y, cursorDesired?.[i]?.y ?? 0, cursorSpringFactor),
      }
      : { x: 0, y: 0 };
  }

  // ---- 4. Ambient cursor glow (visual only â€” never bends the line) ----
  const preConstraintPoints = basePoints.map((point, i) => ({
    x: point.x + state.deformOffset[i].x + state.environmentOffset[i].x + (cursorConfig.enabled ? state.cursorOffset[i].x : 0),
    y: point.y + state.deformOffset[i].y + state.environmentOffset[i].y + (cursorConfig.enabled ? state.cursorOffset[i].y : 0),
  }));
  const finalGeometryPoints = preConstraintPoints.map((point, i) => ({
    x: point.x + (interactionOffset?.[i]?.x ?? 0),
    y: point.y + (interactionOffset?.[i]?.y ?? 0),
  }));
  if (pointer?.active && config.cursorGlow.enabled && config.glow.enabled) {
    const radiusPx = config.glow.radius * minDim;
    if (radiusPx > 0) {
      for (let i = 0; i < sampleCount; i++) {
        const distanceToPointer = distance(finalGeometryPoints[i], pointer);
        const cursorGlow = falloff(distanceToPointer, radiusPx, config.glow.falloff / 100) *
          clamp01(config.glow.intensity / 100) *
          clamp01(config.glow.opacity / 100);
        targetGlow[i] = Math.max(targetGlow[i], cursorGlow);
      }
      spreadGlowSamples(targetGlow, config.glow.length / 100);
    }
  }
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
  const customPathPoints = config.customPath.points;
  const isClosedConnectedPath = customPathActive &&
    config.customPath.closedJoint !== "breakable" &&
    !customPathPoints.some((point) => point.moveTo) &&
    customPathPoints.length > 2 &&
    customPathPoints[0].x === customPathPoints[customPathPoints.length - 1].x &&
    customPathPoints[0].y === customPathPoints[customPathPoints.length - 1].y &&
    finalGeometryPoints.length > 1;
  if (isClosedConnectedPath) {
    const first = finalGeometryPoints[0];
    const last = finalGeometryPoints[finalGeometryPoints.length - 1];
    const joined = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
    finalGeometryPoints[0] = joined;
    finalGeometryPoints[finalGeometryPoints.length - 1] = joined;
  }
  // ---- 5. Smooth target-activated inner glow ----
  const smoothing = clamp01(scene.cursor.smoothing);
  const attackFactor = 1 - Math.exp(-dt / lerp(0.05, 0.6, smoothing));
  const releaseFactor = 1 - Math.exp(-dt / lerp(0.8, 0.05, scene.cursor.releaseSpeed));
  const maxCombinedGlow = clamp01(scene.global.glowMaxCombinedIntensity / 100);
  for (let i = 0; i < sampleCount; i++) {
    const glowValue = Math.min(maxCombinedGlow, targetGlow[i]);
    state.glowIntensity[i] = lerp(state.glowIntensity[i], glowValue, glowValue < state.glowIntensity[i] ? releaseFactor : attackFactor);
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
        : (shape.type === "sharp" || shape.type === "straight") && customPathActive && (config.customPath.curveSmoothing ?? 0) <= 0
          ? "polyline"
          : "smooth",
      Math.max(1, shape.pixelStep),
    ),
    maxGlow,
    maxOuterGlow,
    points: finalPoints,
    glowStops: state.glowIntensity,
    outerGlowStops: state.outerGlowIntensity,
    segmentLengths,
  };
}
