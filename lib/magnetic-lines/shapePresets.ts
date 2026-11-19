import type { GeneratedShapePreset, MagneticLineConfig, PathPoint, Point } from "./types";

export const GENERATED_SHAPE_PRESETS = [
  "triangle",
  "rectangle",
  "rounded-rectangle",
  "circle",
  "diamond",
  "pentagon",
  "hexagon",
  "star",
  "smile",
  "cylinder",
  "cube",
] as const;

type PresetPoint = Point & { moveTo?: boolean };

let generatedPathId = 0;

function polygon(sides: number, rotation = -Math.PI / 2): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index / sides) * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
}

function sampleEllipseArc(
  center: Point,
  radiusX: number,
  radiusY: number,
  startAngle: number,
  endAngle: number,
  samples: number,
): Point[] {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const angle = startAngle + ((endAngle - startAngle) * index) / samples;
    return {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    };
  });
}

function close(points: Point[]): Point[] {
  return [...points, points[0]];
}

function getSmilePoints(): PresetPoint[] {
  const face = sampleEllipseArc({ x: 0, y: 0 }, 0.9, 0.9, 0, Math.PI * 2, 40);
  const leftEye = sampleEllipseArc({ x: -0.3, y: -0.24 }, 0.065, 0.085, 0, Math.PI * 2, 10);
  const rightEye = sampleEllipseArc({ x: 0.3, y: -0.24 }, 0.065, 0.085, 0, Math.PI * 2, 10);
  const mouth = Array.from({ length: 17 }, (_, index) => {
    const x = -0.48 + (index / 16) * 0.96;
    const normalizedX = x / 0.48;
    return { x, y: 0.14 + 0.38 * (1 - normalizedX * normalizedX) };
  });
  return [
    ...face,
    { ...leftEye[0], moveTo: true },
    ...leftEye.slice(1),
    { ...rightEye[0], moveTo: true },
    ...rightEye.slice(1),
    { ...mouth[0], moveTo: true },
    ...mouth.slice(1),
  ];
}

function getPresetPoints(preset: GeneratedShapePreset): PresetPoint[] {
  switch (preset) {
    case "triangle":
      return close([{ x: -0.9, y: 0.68 }, { x: 0, y: -0.88 }, { x: 0.9, y: 0.68 }]);
    case "rectangle":
      return close([{ x: -0.9, y: -0.62 }, { x: 0.9, y: -0.62 }, { x: 0.9, y: 0.62 }, { x: -0.9, y: 0.62 }]);
    case "rounded-rectangle": {
      const points: Point[] = [];
      const corners = [
        { center: { x: 0.65, y: -0.38 }, start: -Math.PI / 2 },
        { center: { x: 0.65, y: 0.38 }, start: 0 },
        { center: { x: -0.65, y: 0.38 }, start: Math.PI / 2 },
        { center: { x: -0.65, y: -0.38 }, start: Math.PI },
      ];
      for (const { center, start } of corners) {
        points.push(...sampleEllipseArc(center, 0.25, 0.24, start, start + Math.PI / 2, 5).slice(0, -1));
      }
      return close(points);
    }
    case "circle":
      return sampleEllipseArc({ x: 0, y: 0 }, 0.82, 0.82, 0, Math.PI * 2, 32);
    case "diamond":
      return close([{ x: 0, y: -0.9 }, { x: 0.82, y: 0 }, { x: 0, y: 0.9 }, { x: -0.82, y: 0 }]);
    case "pentagon":
      return close(polygon(5));
    case "hexagon":
      return close(polygon(6));
    case "star": {
      const points = Array.from({ length: 10 }, (_, index) => {
        const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
        const radius = index % 2 === 0 ? 0.92 : 0.42;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
      return close(points);
    }
    case "smile":
      return getSmilePoints();
    case "cylinder": {
      const top = sampleEllipseArc({ x: 0, y: -0.48 }, 0.9, 0.24, Math.PI, Math.PI * 2, 14);
      const bottom = sampleEllipseArc({ x: 0, y: 0.48 }, 0.9, 0.24, 0, Math.PI, 14);
      return [...top, { x: 0.9, y: 0.48 }, ...bottom.slice(1), { x: -0.9, y: -0.48 }];
    }
    case "cube":
      return [
        { x: -0.88, y: -0.42 }, { x: 0.32, y: -0.42 }, { x: 0.32, y: 0.78 },
        { x: -0.88, y: 0.78 }, { x: -0.88, y: -0.42 },
        { x: -0.38, y: -0.86, moveTo: true }, { x: 0.82, y: -0.86 },
        { x: 0.82, y: 0.34 }, { x: -0.38, y: 0.34 }, { x: -0.38, y: -0.86 },
        { x: -0.88, y: -0.42, moveTo: true }, { x: -0.38, y: -0.86 },
        { x: 0.32, y: -0.42, moveTo: true }, { x: 0.82, y: -0.86 },
        { x: 0.32, y: 0.78, moveTo: true }, { x: 0.82, y: 0.34 },
        { x: -0.88, y: 0.78, moveTo: true }, { x: -0.38, y: 0.34 },
      ];
  }
}

export function createGeneratedShapePath(
  preset: GeneratedShapePreset,
  line: Pick<MagneticLineConfig, "from" | "to">,
  viewport: { width: number; height: number } = { width: 1, height: 1 },
): PathPoint[] {
  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const center = {
    x: ((line.from.x + line.to.x) / 2) * width,
    y: ((line.from.y + line.to.y) / 2) * height,
  };
  const axis = {
    x: (line.to.x - line.from.x) * width,
    y: (line.to.y - line.from.y) * height,
  };
  const length = Math.hypot(axis.x, axis.y) || Math.min(width, height) * 0.3;
  const direction = { x: axis.x / (Math.hypot(axis.x, axis.y) || 1), y: axis.y / (Math.hypot(axis.x, axis.y) || 1) };
  const normal = { x: -direction.y, y: direction.x };
  const points = getPresetPoints(preset).map((point) => ({
    x: center.x + direction.x * point.x * length * 0.5 + normal.x * point.y * length * 0.5,
    y: center.y + direction.y * point.x * length * 0.5 + normal.y * point.y * length * 0.5,
    moveTo: point.moveTo,
  }));

  const padding = Math.min(24, Math.min(width, height) * 0.04);
  const bounds = points.reduce(
    (result, point) => ({
      left: Math.min(result.left, point.x),
      right: Math.max(result.right, point.x),
      top: Math.min(result.top, point.y),
      bottom: Math.max(result.bottom, point.y),
    }),
    { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity },
  );
  const fitScale = Math.min(
    1,
    (width - 2 * padding) / Math.max(1, bounds.right - bounds.left),
    (height - 2 * padding) / Math.max(1, bounds.bottom - bounds.top),
  );
  const scaledWidth = (bounds.right - bounds.left) * fitScale;
  const scaledHeight = (bounds.bottom - bounds.top) * fitScale;
  const offsetX = Math.min(
    Math.max(0, padding - bounds.left * fitScale),
    width - padding - scaledWidth - bounds.left * fitScale,
  );
  const offsetY = Math.min(
    Math.max(0, padding - bounds.top * fitScale),
    height - padding - scaledHeight - bounds.top * fitScale,
  );

  generatedPathId += 1;
  const idPrefix = `generated-${preset}-${Date.now().toString(36)}-${generatedPathId}`;
  return points.map((point, index) => ({
    id: `${idPrefix}-${index}`,
    x: (point.x * fitScale + offsetX) / width,
    y: (point.y * fitScale + offsetY) / height,
    ...(point.moveTo ? { moveTo: true } : {}),
  }));
}
