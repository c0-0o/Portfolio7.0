import type { LineInteractionConfig, Point } from "../types";
import { clamp01, distance, falloff, perpendicular } from "./math";

export interface InteractionLineGeometry {
  id: string;
  points: Point[];
  config: LineInteractionConfig;
}

function nearestOtherPoint(point: Point, sourceId: string, lines: InteractionLineGeometry[]): { point: Point; distance: number } | null {
  let nearest: { point: Point; distance: number } | null = null;
  for (const line of lines) {
    if (line.id === sourceId) continue;
    for (const candidate of line.points) {
      const candidateDistance = distance(point, candidate);
      if (!nearest || candidateDistance < nearest.distance) nearest = { point: candidate, distance: candidateDistance };
    }
  }
  return nearest;
}

export function computeLineInteractionOffsets(lines: InteractionLineGeometry[], minDim: number): Map<string, Point[]> {
  const offsets = new Map<string, Point[]>();
  for (const line of lines) offsets.set(line.id, line.points.map(() => ({ x: 0, y: 0 })));

  for (const line of lines) {
    const config = line.config;
    if (!config.enabled || config.strength <= 0 || config.radius <= 0 || line.points.length === 0) continue;
    const radiusPx = config.radius * minDim;
    const maxDeformPx = Math.min(radiusPx * 0.25, minDim * 0.06);
    const lineOffsets = offsets.get(line.id)!;
    for (let index = 0; index < line.points.length; index++) {
      const point = line.points[index];
      const nearest = nearestOtherPoint(point, line.id, lines);
      if (!nearest || nearest.distance >= radiusPx) continue;
      let awayX = point.x - nearest.point.x;
      let awayY = point.y - nearest.point.y;
      const awayLength = Math.hypot(awayX, awayY);
      if (awayLength < 0.0001) {
        const previous = line.points[Math.max(0, index - 1)] ?? point;
        const next = line.points[Math.min(line.points.length - 1, index + 1)] ?? point;
        const localNormal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
        awayX = localNormal.x;
        awayY = localNormal.y;
      } else {
        awayX /= awayLength;
        awayY /= awayLength;
      }
      const progress = line.points.length <= 1 ? 0.5 : index / (line.points.length - 1);
      const endpointEnvelope = Math.sin(Math.PI * progress);
      const influence = falloff(nearest.distance, radiusPx, config.falloff) * clamp01(config.strength) * endpointEnvelope;
      lineOffsets[index] = { x: awayX * maxDeformPx * influence, y: awayY * maxDeformPx * influence };
    }
  }

  return offsets;
}
