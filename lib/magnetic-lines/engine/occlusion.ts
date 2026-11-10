import type { Point } from "../types";

export interface OcclusionRuntimeLine {
  id: string;
  width: number;
  occlusionEnabled: boolean;
  points: Point[];
}

export interface OcclusionMaskPlan {
  lineId: string;
  occluderIds: string[];
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boundsFor(points: Point[], padding: number): Bounds | null {
  if (points.length === 0) return null;
  let left = points[0].x;
  let right = points[0].x;
  let top = points[0].y;
  let bottom = points[0].y;
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  return { left: left - padding, top: top - padding, right: right + padding, bottom: bottom + padding };
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/** Builds a deterministic SVG compositing plan without changing geometry. */
export function createOcclusionMaskPlan(lines: OcclusionRuntimeLine[]): OcclusionMaskPlan[] {
  if (!lines.some((line) => line.occlusionEnabled)) return [];
  const bounds = lines.map((line) => boundsFor(line.points, Math.max(1, line.width * 2)));
  const plan: OcclusionMaskPlan[] = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line.occlusionEnabled || !bounds[lineIndex]) continue;
    const occluderIds: string[] = [];
    for (let higherIndex = lineIndex + 1; higherIndex < lines.length; higherIndex++) {
      const higherBounds = bounds[higherIndex];
      if (higherBounds && overlaps(bounds[lineIndex]!, higherBounds)) occluderIds.push(lines[higherIndex].id);
    }
    if (occluderIds.length > 0) plan.push({ lineId: line.id, occluderIds });
  }
  return plan;
}
