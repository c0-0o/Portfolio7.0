import type { GlowConfig, LineInteractionConfig, Point } from "../types";
import { clamp01, distance, falloff, perpendicular } from "./math";

export interface InteractionLineGeometry {
  id: string;
  points: Point[];
  config: LineInteractionConfig;
  width?: number;
  segmentLengths?: number[];
}

export interface NeighborGlowLineGeometry {
  id: string;
  points: Point[];
  config: GlowConfig;
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boundsFor(points: Point[]): Bounds | null {
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
  return { left, top, right, bottom };
}

function distanceToBounds(point: Point, bounds: Bounds): number {
  const dx = Math.max(bounds.left - point.x, 0, point.x - bounds.right);
  const dy = Math.max(bounds.top - point.y, 0, point.y - bounds.bottom);
  return Math.hypot(dx, dy);
}

function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.000001) return distance(point, from);
  const progress = clamp01(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared);
  return distance(point, { x: from.x + dx * progress, y: from.y + dy * progress });
}

function nearestOtherLineDistance(
  point: Point,
  sourceId: string,
  sources: NeighborGlowLineGeometry[],
  boundsByLine: Map<string, Bounds>,
  radiusPx: number,
): number {
  let nearestDistance = Infinity;
  for (const line of sources) {
    if (line.id === sourceId || line.points.length === 0) continue;
    const bounds = boundsByLine.get(line.id);
    if (bounds && distanceToBounds(point, bounds) >= radiusPx) continue;
    if (line.points.length === 1) {
      nearestDistance = Math.min(nearestDistance, distance(point, line.points[0]));
      continue;
    }
    for (let index = 1; index < line.points.length; index++) {
      nearestDistance = Math.min(nearestDistance, distanceToSegment(point, line.points[index - 1], line.points[index]));
    }
  }
  return nearestDistance;
}

export function computeNeighborGlowTargets(
  lines: NeighborGlowLineGeometry[],
  minDim: number,
  activeSourceIds: ReadonlySet<string>,
): Map<string, number[]> {
  const targets = new Map<string, number[]>();
  const activeSources = lines.filter((line) => activeSourceIds.has(line.id));
  const activeSourceBounds = new Map(activeSources.flatMap((line) => {
    const bounds = boundsFor(line.points);
    return bounds ? [[line.id, bounds] as const] : [];
  }));
  for (const line of lines) {
    const values = line.points.map(() => 0);
    const { config } = line;
    const radiusPx = config.radius * minDim;
    if (config.enabled && config.intensity > 0 && radiusPx > 0 && activeSources.length > 0) {
      for (let index = 0; index < line.points.length; index++) {
        const nearestDistance = nearestOtherLineDistance(line.points[index], line.id, activeSources, activeSourceBounds, radiusPx);
        values[index] =
          falloff(nearestDistance, radiusPx, config.falloff / 100) *
          clamp01(config.intensity / 100) *
          clamp01(config.opacity / 100);
      }

      let peakIndex = 0;
      for (let index = 1; index < values.length; index++) {
        if (values[index] > values[peakIndex]) peakIndex = index;
      }
      const peak = values[peakIndex] ?? 0;
      if (peak > 0 && values.length > 1) {
        const spread = Math.max(1, Math.round((config.length / 100) * values.length));
        for (let index = 0; index < values.length; index++) {
          const distanceFromPeak = Math.abs(index - peakIndex);
          if (distanceFromPeak <= spread) {
            values[index] = Math.max(values[index], peak * (1 - distanceFromPeak / (spread + 1)));
          }
        }
      }
    }
    targets.set(line.id, values);
  }
  return targets;
}

function getLineRanges(line: InteractionLineGeometry): Array<{ start: number; end: number }> {
  if (!line.segmentLengths?.length) {
    return line.points.length > 0 ? [{ start: 0, end: line.points.length }] : [];
  }
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const length of line.segmentLengths) {
    const end = Math.min(line.points.length, start + length);
    if (end > start) ranges.push({ start, end });
    start = end;
  }
  return ranges;
}

function nearestOtherLine(
  point: Point,
  sourceId: string,
  lines: InteractionLineGeometry[],
  rangesByLine: Map<string, Array<{ start: number; end: number }>>,
  boundsByLine: Map<string, Bounds>,
  sourceWidth: number,
  radiusPx: number,
  clearancePx: number,
): Array<{
  point: Point;
  distance: number;
  width: number;
  id: string;
}> {
  const nearestLines: Array<{ point: Point; distance: number; width: number; id: string }> = [];
  for (const line of lines) {
    if (line.id === sourceId) continue;
    const bounds = boundsByLine.get(line.id);
    const maxReach = radiusPx + clearancePx + (sourceWidth + (line.width ?? 0)) / 2;
    if (bounds && distanceToBounds(point, bounds) >= Math.max(0, maxReach)) continue;
    let nearest: { point: Point; distance: number; width: number; id: string } | null = null;
    for (const range of rangesByLine.get(line.id) ?? []) {
      if (range.end - range.start === 1) {
        const candidate = line.points[range.start];
        const candidateDistance = distance(point, candidate);
        if (!nearest || candidateDistance < nearest.distance) {
          nearest = { point: candidate, distance: candidateDistance, width: line.width ?? 0, id: line.id };
        }
        continue;
      }
      for (let index = range.start + 1; index < range.end; index++) {
        const from = line.points[index - 1];
        const to = line.points[index];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const lengthSquared = dx * dx + dy * dy;
        if (lengthSquared <= 0.000001) continue;
        const progress = clamp01(((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared);
        const candidate = { x: from.x + dx * progress, y: from.y + dy * progress };
        const candidateDistance = distance(point, candidate);
        if (!nearest || candidateDistance < nearest.distance) {
          nearest = { point: candidate, distance: candidateDistance, width: line.width ?? 0, id: line.id };
        }
      }
    }
    if (nearest) nearestLines.push(nearest);
  }
  return nearestLines;
}

function smoothOffsets(offsets: Point[], ranges: Array<{ start: number; end: number }>): Point[] {
  let current = offsets;
  for (let pass = 0; pass < 2; pass++) {
    const smoothed = current.map((offset) => ({ ...offset }));
    for (const range of ranges) {
      for (let index = range.start + 1; index < range.end - 1; index++) {
        const previous = current[index - 1];
        const value = current[index];
        const next = current[index + 1];
        smoothed[index] = {
          x: (previous.x + value.x * 2 + next.x) * 0.25,
          y: (previous.y + value.y * 2 + next.y) * 0.25,
        };
      }
    }
    current = smoothed;
  }
  return current;
}

export function computeLineInteractionOffsets(lines: InteractionLineGeometry[], minDim: number): Map<string, Point[]> {
  const offsets = new Map<string, Point[]>();
  const rangesByLine = new Map<string, Array<{ start: number; end: number }>>();
  const boundsByLine = new Map<string, Bounds>();
  for (const line of lines) rangesByLine.set(line.id, getLineRanges(line));
  for (const line of lines) {
    const bounds = boundsFor(line.points);
    if (bounds) boundsByLine.set(line.id, bounds);
  }
  for (const line of lines) offsets.set(line.id, line.points.map(() => ({ x: 0, y: 0 })));

  for (const line of lines) {
    const config = line.config;
    if (!config.enabled || config.strength <= 0 || line.points.length === 0) continue;
    const radiusPx = config.radius * minDim;
    const maxSoftDeformPx = Math.min(radiusPx * 0.25, minDim * 0.06);
    const clearancePx = Math.max(0, Number.isFinite(config.clearance) ? config.clearance : 0.01) * minDim;
    const lineRanges = rangesByLine.get(line.id) ?? [];
    const lineOffsets = offsets.get(line.id)!;
    for (let index = 0; index < line.points.length; index++) {
      const point = line.points[index];
      let forceX = 0;
      let forceY = 0;
      for (const nearest of nearestOtherLine(point, line.id, lines, rangesByLine, boundsByLine, line.width ?? 0, radiusPx, clearancePx)) {
        const surfaceGap = nearest.distance - ((line.width ?? 0) + nearest.width) / 2;
        const gapFromTarget = surfaceGap - clearancePx;
        if (gapFromTarget >= radiusPx && gapFromTarget >= 0) continue;
        let awayX = point.x - nearest.point.x;
        let awayY = point.y - nearest.point.y;
        const awayLength = Math.hypot(awayX, awayY);
        if (awayLength < 0.0001) {
          const range = lineRanges.find(({ start, end }) => index >= start && index < end);
          const previous = line.points[Math.max(range?.start ?? 0, index - 1)] ?? point;
          const next = line.points[Math.min((range?.end ?? line.points.length) - 1, index + 1)] ?? point;
          const localNormal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
          const sign = line.id.localeCompare(nearest.id) <= 0 ? 1 : -1;
          awayX = localNormal.x * sign;
          awayY = localNormal.y * sign;
        } else {
          awayX /= awayLength;
          awayY /= awayLength;
        }
        const influence = radiusPx > 0
          ? falloff(Math.max(0, gapFromTarget), radiusPx, config.falloff)
          : 0;
        const penetration = Math.max(0, -gapFromTarget);
        const displacement = (penetration + maxSoftDeformPx * influence) * clamp01(config.strength);
        forceX += awayX * displacement;
        forceY += awayY * displacement;
      }

      const range = lineRanges.find(({ start, end }) => index >= start && index < end);
      if (!range) continue;
      const progress = (index - range.start) / Math.max(1, range.end - range.start - 1);
      const endpointEnvelope = range.end - range.start <= 1 ? 1 : Math.sin(Math.PI * progress);
      const maxDeformPx = Math.min(minDim * 0.2, Math.max(minDim * 0.06, clearancePx * 1.5));
      const forceLength = Math.hypot(forceX, forceY);
      const scale = forceLength > maxDeformPx ? maxDeformPx / forceLength : 1;
      lineOffsets[index] = {
        x: forceX * scale * endpointEnvelope,
        y: forceY * scale * endpointEnvelope,
      };
    }
    offsets.set(line.id, smoothOffsets(lineOffsets, lineRanges));
  }

  return offsets;
}
