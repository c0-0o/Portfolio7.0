import type { PathPoint } from "../types";

export function mergePathPointSequence(points: PathPoint[], draggedPointId: string, nearbyPointId: string): PathPoint[] {
  const draggedPoint = points.find((point) => point.id === draggedPointId);
  const nearbyPoint = points.find((point) => point.id === nearbyPointId);
  if (!draggedPoint || !nearbyPoint || draggedPointId === nearbyPointId) return points;

  const joinsSeparateStrokes = !!draggedPoint.moveTo || !!nearbyPoint.moveTo;
  return points
    .filter((point) => point.id !== draggedPointId)
    .map((point) => {
      if (point.id !== nearbyPointId || !joinsSeparateStrokes) return point;
      const mergedPoint = { ...point };
      delete mergedPoint.moveTo;
      return mergedPoint;
    });
}
