import type { Point } from "../types";

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Smoothstep-based falloff: 1 at distance 0, 0 at distance >= radius.
 * `sharpness` (0..1) blends between a gentle linear falloff and a sharp smoothstep curve.
 */
export function falloff(dist: number, radius: number, sharpness = 0.5): number {
  if (radius <= 0) return 0;
  const t = clamp01(1 - dist / radius);
  const smooth = t * t * (3 - 2 * t);
  return lerp(t, smooth, clamp01(sharpness));
}

export interface AxisRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Nearest point on the perimeter (boundary) of an axis-aligned rectangle to point p. */
export function nearestPointOnRectPerimeter(rect: AxisRect, p: Point): Point {
  const { left, top, right, bottom } = rect;
  const cx = clamp(p.x, left, right);
  const cy = clamp(p.y, top, bottom);
  const outside = p.x < left || p.x > right || p.y < top || p.y > bottom;
  if (outside) {
    // Clamping already lands exactly on the boundary when the point is outside.
    return { x: cx, y: cy };
  }
  // Point is inside the rect — snap to whichever edge is nearest.
  const dLeft = p.x - left;
  const dRight = right - p.x;
  const dTop = p.y - top;
  const dBottom = bottom - p.y;
  const m = Math.min(dLeft, dRight, dTop, dBottom);
  if (m === dLeft) return { x: left, y: p.y };
  if (m === dRight) return { x: right, y: p.y };
  if (m === dTop) return { x: p.x, y: top };
  return { x: p.x, y: bottom };
}

/** Catmull-Rom -> cubic Bezier conversion for a smooth SVG path through an ordered point list. */
export function pointsToSmoothPath(points: Point[], closed = false): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const isClosed = closed && points.length > 3 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y;
  const controlPoints = isClosed ? points.slice(0, -1) : points;
  if (controlPoints.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const p = controlPoints;
  const count = p.length;
  let d = `M ${p[0].x} ${p[0].y} `;
  for (let i = 0; i < count - (isClosed ? 0 : 1); i++) {
    const p0 = isClosed ? p[(i - 1 + count) % count] : p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = isClosed ? p[(i + 1) % count] : p[i + 1];
    const p3 = isClosed ? p[(i + 2) % count] : p[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y} `;
  }
  return `${d.trim()}${isClosed ? " Z" : ""}`;
}

export function pointsToPixelPath(points: Point[], step: number): string {
  if (points.length === 0) return "";
  const snapped = points.map((point) => ({ x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step }));
  return `M ${snapped[0].x} ${snapped[0].y} ` + snapped.slice(1).map((point) => `L ${point.x} ${point.y}`).join(" ");
}

export function pointsToPolylinePath(points: Point[]): string {
  if (points.length === 0) return "";
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(" ");
}

export function perpendicular(dir: Point): Point {
  const len = Math.hypot(dir.x, dir.y) || 1;
  return { x: -dir.y / len, y: dir.x / len };
}
