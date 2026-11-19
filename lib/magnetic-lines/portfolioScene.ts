import type { MagneticLinesSceneConfig } from "./types";
import { DEFAULT_SCENE } from "./defaultScene";
import { sanitizeSceneConfig } from "./sceneValidation";

export const ABOUT_PATTERN_ASPECT_RATIO = 1720 / 768;
export const ABOUT_BOTTOM_ALIGNED_LINE_IDS = new Set([
  "about-arc-bottom-outer",
  "about-arc-bottom-inner",
  "about-arc-bottom-dashes",
  "about-grid",
  "about-ring-bottom-left",
  "about-plus-bottom",
  "about-sparkle-bottom-right",
  "about-pixels-bottom-left",
  "about-dots-left",
  "about-square-bottom-right",
]);
export const ABOUT_FLOW_LINE_IDS = new Set([
  "about-arc-top-inner",
  "about-arc-bottom-inner",
]);

type AboutPatternPoint = { x: number; y: number; moveTo?: boolean };
type AboutArcId =
  | "about-arc-top-outer"
  | "about-arc-top-inner"
  | "about-arc-bottom-outer"
  | "about-arc-bottom-inner"
  | "about-arc-top-dashes"
  | "about-arc-bottom-dashes";

function normalizedPoint(x: number, y: number): AboutPatternPoint {
  return { x: x / 1720, y: y / 768 };
}

function circleArcPoints(
  cx: number,
  cy: number,
  radius: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  segments = 12,
  exactEndpoints = true,
): AboutPatternPoint[] {
  const startAngle = Math.atan2(start.y - cy, start.x - cx);
  const endAngle = Math.atan2(end.y - cy, end.x - cx);
  return Array.from({ length: segments + 1 }, (_, index) => {
    if (exactEndpoints && index === 0) return normalizedPoint(start.x, start.y);
    if (exactEndpoints && index === segments) return normalizedPoint(end.x, end.y);
    const angle = startAngle + ((endAngle - startAngle) * index) / segments;
    return normalizedPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  });
}

function compoundStrokes(strokes: AboutPatternPoint[][]): AboutPatternPoint[] {
  return strokes.flatMap((stroke, strokeIndex) =>
    stroke.map((point, pointIndex) => ({
      ...point,
      ...(strokeIndex > 0 && pointIndex === 0 ? { moveTo: true } : {}),
    })),
  );
}

function dashedCircleArcPoints(
  cx: number,
  cy: number,
  radius: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  dashCount: number,
  exactEndpoints = true,
): AboutPatternPoint[] {
  const startAngle = Math.atan2(start.y - cy, start.x - cx);
  const endAngle = Math.atan2(end.y - cy, end.x - cx);
  const pointAt = (progress: number): AboutPatternPoint => {
    if (exactEndpoints && progress === 0) return normalizedPoint(start.x, start.y);
    if (exactEndpoints && progress === 1) return normalizedPoint(end.x, end.y);
    const angle = startAngle + (endAngle - startAngle) * progress;
    return normalizedPoint(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  };
  return compoundStrokes(Array.from({ length: dashCount }, (_, index) => [
    pointAt(index / dashCount),
    pointAt(exactEndpoints && index === dashCount - 1 ? 1 : (index + 0.48) / dashCount),
  ]));
}

function legacyDashedCurve(
  start: AboutPatternPoint,
  control1: AboutPatternPoint,
  control2: AboutPatternPoint,
  end: AboutPatternPoint,
  dashCount: number,
): AboutPatternPoint[] {
  const pointAt = (t: number): AboutPatternPoint => {
    const inverse = 1 - t;
    return {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
    };
  };
  return compoundStrokes(Array.from({ length: dashCount }, (_, index) => [
    pointAt(index / dashCount),
    pointAt((index + 0.48) / dashCount),
  ]));
}

const LEGACY_ABOUT_POINTS: Record<AboutArcId, AboutPatternPoint[]> = {
  "about-arc-top-outer": [
    { x: 0, y: 0.32 }, { x: 0.045, y: 0.313 }, { x: 0.09, y: 0.297 },
    { x: 0.135, y: 0.27 }, { x: 0.17, y: 0.23 }, { x: 0.195, y: 0.18 },
    { x: 0.21, y: 0.12 }, { x: 0.218, y: 0.055 }, { x: 0.218, y: 0 },
  ],
  "about-arc-top-inner": [
    { x: 0, y: 0.365 }, { x: 0.065, y: 0.353 }, { x: 0.13, y: 0.328 },
    { x: 0.19, y: 0.29 }, { x: 0.235, y: 0.245 }, { x: 0.265, y: 0.19 },
    { x: 0.285, y: 0.125 }, { x: 0.29, y: 0.06 }, { x: 0.29, y: 0 },
  ],
  "about-arc-bottom-outer": [
    { x: 0.66, y: 1 }, { x: 0.68, y: 0.86 }, { x: 0.71, y: 0.76 },
    { x: 0.76, y: 0.66 }, { x: 0.82, y: 0.57 }, { x: 0.89, y: 0.5 },
    { x: 0.96, y: 0.46 }, { x: 1, y: 0.44 },
  ],
  "about-arc-bottom-inner": [
    { x: 0.71, y: 1 }, { x: 0.74, y: 0.89 }, { x: 0.78, y: 0.79 },
    { x: 0.83, y: 0.7 }, { x: 0.89, y: 0.63 }, { x: 0.95, y: 0.58 },
    { x: 1, y: 0.55 },
  ],
  "about-arc-top-dashes": legacyDashedCurve(
    { x: 0, y: 0.44 }, { x: 0.15, y: 0.42 }, { x: 0.275, y: 0.18 }, { x: 0.32, y: 0 }, 24,
  ),
  "about-arc-bottom-dashes": legacyDashedCurve(
    { x: 0.79, y: 1 }, { x: 0.82, y: 0.84 }, { x: 0.94, y: 0.65 }, { x: 1, y: 0.6 }, 24,
  ),
};

const LEGACY_ABOUT_DEFAULT_LINES: Array<{
  id: string;
  points: AboutPatternPoint[];
  opacity: number;
  width: number;
}> = [
  {
    id: "line-01",
    points: [
      { x: 0.04, y: 0.18 }, { x: 0.15, y: 0.1 }, { x: 0.28, y: 0.13 },
      { x: 0.36, y: 0.24 }, { x: 0.34, y: 0.37 },
    ],
    opacity: 0.46,
    width: 1.05,
  },
  {
    id: "line-02",
    points: [
      { x: 0.66, y: 0.1 }, { x: 0.8, y: 0.06 }, { x: 0.93, y: 0.14 },
      { x: 0.96, y: 0.28 }, { x: 0.9, y: 0.37 },
    ],
    opacity: 0.44,
    width: 1,
  },
  {
    id: "line-03",
    points: [
      { x: 0.64, y: 0.4 }, { x: 0.76, y: 0.34 }, { x: 0.9, y: 0.38 },
      { x: 0.96, y: 0.5 }, { x: 0.94, y: 0.64 },
    ],
    opacity: 0.42,
    width: 0.95,
  },
  {
    id: "line-04",
    points: [
      { x: 0.03, y: 0.77 }, { x: 0.16, y: 0.71 },
      { x: 0.28, y: 0.75 }, { x: 0.35, y: 0.87 },
    ],
    opacity: 0.36,
    width: 0.9,
  },
];

export const ABOUT_REFERENCE_ARC_POINTS: Record<AboutArcId, AboutPatternPoint[]> = {
  "about-arc-top-outer": circleArcPoints(-43, -221, 466, { x: 0, y: 244 }, { x: 368, y: 0 }),
  "about-arc-top-inner": circleArcPoints(-47, -346, 627, { x: 0, y: 279 }, { x: 476, y: 0 }),
  "about-arc-bottom-outer": circleArcPoints(1690, 870, 548, { x: 1154, y: 768 }, { x: 1719, y: 323 }),
  "about-arc-bottom-inner": circleArcPoints(1764, 947, 527, { x: 1272, y: 768 }, { x: 1719, y: 421 }),
  "about-arc-top-dashes": dashedCircleArcPoints(3, -280, 615, { x: 0, y: 335 }, { x: 551, y: 0 }, 24),
  "about-arc-bottom-dashes": dashedCircleArcPoints(1786, 961, 501, { x: 1325, y: 768 }, { x: 1719, y: 464 }, 24),
};

function gridPoints(
  columns: number[],
  rows: number[],
  top: number,
  bottom: number,
): AboutPatternPoint[] {
  const strokes = [
    ...columns.map((x) => [{ x, y: top }, { x, y: bottom }]),
    ...rows.map((y) => [{ x: 0, y }, { x: 1, y }]),
  ];
  return strokes.flatMap((stroke, strokeIndex) =>
    stroke.map((point, pointIndex) => ({
      ...point,
      ...(strokeIndex > 0 && pointIndex === 0 ? { moveTo: true } : {}),
    })),
  );
}

const ABOUT_GRID_COLUMNS = [0.073, 0.151, 0.323, 0.643, 0.848];

const LEGACY_ABOUT_GRID_POINTS = gridPoints(ABOUT_GRID_COLUMNS, [0.214, 0.725], 0, 1);

export const ABOUT_REFERENCE_GRID_POINTS = gridPoints(
  ABOUT_GRID_COLUMNS,
  [0.725, 0.9],
  0.5,
  1,
);

const INTERMEDIATE_ABOUT_ARC_POINTS: Record<AboutArcId, AboutPatternPoint[]> = {
  "about-arc-top-outer": circleArcPoints(-43, -221, 466, { x: 0, y: 244 }, { x: 368, y: 0 }, 12, false),
  "about-arc-top-inner": circleArcPoints(-47, -346, 627, { x: 0, y: 279 }, { x: 476, y: 0 }, 12, false),
  "about-arc-bottom-outer": circleArcPoints(1690, 870, 548, { x: 1154, y: 768 }, { x: 1719, y: 323 }, 12, false),
  "about-arc-bottom-inner": circleArcPoints(1764, 947, 527, { x: 1272, y: 768 }, { x: 1719, y: 421 }, 12, false),
  "about-arc-top-dashes": dashedCircleArcPoints(3, -280, 615, { x: 0, y: 335 }, { x: 551, y: 0 }, 24, false),
  "about-arc-bottom-dashes": dashedCircleArcPoints(1786, 961, 501, { x: 1325, y: 768 }, { x: 1719, y: 464 }, 24, false),
};

const LEGACY_ABOUT_APPEARANCES: Record<string, {
  color: string;
  opacity: number;
  width: number;
  intermediate?: { color: string; opacity: number; width: number };
  nextColor: string;
  nextOpacity: number;
  nextWidth: number;
}> = {
  "about-arc-top-outer": { color: "#8baa68", opacity: 0.3, width: 1, intermediate: { color: "#A5B49B", opacity: 0.6, width: 1 }, nextColor: "#A5B49B", nextOpacity: 0.6, nextWidth: 1 },
  "about-arc-top-inner": { color: "#8baa68", opacity: 0.25, width: 0.9, intermediate: { color: "#A5B49B", opacity: 0.54, width: 0.9 }, nextColor: "#A5B49B", nextOpacity: 0.68, nextWidth: 0.9 },
  "about-arc-bottom-outer": { color: "#8baa68", opacity: 0.27, width: 0.95, intermediate: { color: "#A5B49B", opacity: 0.56, width: 0.95 }, nextColor: "#A5B49B", nextOpacity: 0.32, nextWidth: 0.95 },
  "about-arc-bottom-inner": { color: "#8baa68", opacity: 0.23, width: 0.85, intermediate: { color: "#A5B49B", opacity: 0.5, width: 0.85 }, nextColor: "#A5B49B", nextOpacity: 0.65, nextWidth: 0.85 },
  "about-arc-top-dashes": { color: "#8baa68", opacity: 0.2, width: 0.8, intermediate: { color: "#A5B49B", opacity: 0.3, width: 0.8 }, nextColor: "#A5B49B", nextOpacity: 0.3, nextWidth: 0.8 },
  "about-arc-bottom-dashes": { color: "#8baa68", opacity: 0.18, width: 0.8, intermediate: { color: "#A5B49B", opacity: 0.28, width: 0.8 }, nextColor: "#A5B49B", nextOpacity: 0.28, nextWidth: 0.8 },
  "about-grid": { color: "#8baa68", opacity: 0.11, width: 0.7, intermediate: { color: "#A5B49B", opacity: 0.15, width: 0.7 }, nextColor: "#A5B49B", nextOpacity: 0.15, nextWidth: 0.7 },
  "about-ring-top-right": { color: "#8baa68", opacity: 0.26, width: 2, intermediate: { color: "#A5B49B", opacity: 0.32, width: 2 }, nextColor: "#A5B49B", nextOpacity: 0.32, nextWidth: 2 },
  "about-ring-bottom-left": { color: "#8baa68", opacity: 0.24, width: 2, intermediate: { color: "#A5B49B", opacity: 0.3, width: 2 }, nextColor: "#A5B49B", nextOpacity: 0.3, nextWidth: 2 },
  "about-plus-top": { color: "#8baa68", opacity: 0.58, width: 1.4, intermediate: { color: "#A4D66A", opacity: 0.78, width: 1.6 }, nextColor: "#A4D66A", nextOpacity: 0.78, nextWidth: 1.6 },
  "about-plus-bottom": { color: "#8baa68", opacity: 0.58, width: 1.4, intermediate: { color: "#A4D66A", opacity: 0.78, width: 1.6 }, nextColor: "#A4D66A", nextOpacity: 0.78, nextWidth: 1.6 },
  "about-sparkle-top-left": { color: "#7AD321", opacity: 0.85, width: 1.5, intermediate: { color: "#7AD321", opacity: 0.95, width: 1.5 }, nextColor: "#7AD321", nextOpacity: 0.95, nextWidth: 1.5 },
  "about-sparkle-bottom-right": { color: "#7AD321", opacity: 0.85, width: 1.5, intermediate: { color: "#7AD321", opacity: 0.95, width: 1.5 }, nextColor: "#7AD321", nextOpacity: 0.95, nextWidth: 1.5 },
  "about-dots-left": { color: "#8baa68", opacity: 0.3, width: 3.2, intermediate: { color: "#A5B49B", opacity: 0.38, width: 3.2 }, nextColor: "#A5B49B", nextOpacity: 0.38, nextWidth: 3.2 },
  "about-dots-right": { color: "#8baa68", opacity: 0.3, width: 3.2, intermediate: { color: "#A5B49B", opacity: 0.38, width: 3.2 }, nextColor: "#A5B49B", nextOpacity: 0.38, nextWidth: 3.2 },
  "about-square-bottom-right": { color: "#8baa68", opacity: 0.18, width: 1.8, intermediate: { color: "#A5B49B", opacity: 0.25, width: 1.8 }, nextColor: "#A5B49B", nextOpacity: 0.25, nextWidth: 1.8 },
};

function samePoints(
  points: MagneticLinesSceneConfig["lines"][number]["customPath"]["points"],
  expected: AboutPatternPoint[],
): boolean {
  return points.length === expected.length && points.every((point, index) =>
    point.x === expected[index].x &&
    point.y === expected[index].y &&
    Boolean(point.moveTo) === Boolean(expected[index].moveTo),
  );
}

function isLegacyAboutDefaultScene(scene: MagneticLinesSceneConfig): boolean {
  return scene.lines.length === LEGACY_ABOUT_DEFAULT_LINES.length &&
    LEGACY_ABOUT_DEFAULT_LINES.every((legacyLine) => {
      const line = scene.lines.find((candidate) => candidate.id === legacyLine.id);
      return line !== undefined &&
        samePoints(line.customPath.points, legacyLine.points) &&
        line.appearance.color === "#8baa68" &&
        line.appearance.opacity === legacyLine.opacity &&
        line.appearance.width === legacyLine.width;
    });
}

function isNonHomeSceneCopiedToHome(scene: MagneticLinesSceneConfig): boolean {
  const isAboutScene = scene.lines.length > 0 &&
    scene.lines.every((line) => line.id.startsWith("about-"));
  const isOpeningScene = scene.lines.length === 6 &&
    scene.lines.every((line) => line.id.startsWith("opening-organic-lime-filaments-"));
  return isAboutScene || isOpeningScene;
}

const DEFAULT_STARTER_LINES = JSON.stringify(sanitizeSceneConfig(DEFAULT_SCENE).lines);

function hasDefaultStarterLines(scene: MagneticLinesSceneConfig): boolean {
  return JSON.stringify(sanitizeSceneConfig(scene).lines) === DEFAULT_STARTER_LINES;
}

function isLegacyDefaultAboutFlow(line: MagneticLinesSceneConfig["lines"][number]): boolean {
  const { flow } = line;
  const knownLegacyColor = flow.colors[0] === line.appearance.color ||
    (flow.colors[0] === "#8baa68" && line.appearance.color === "#A5B49B");
  return line.inherit.flow === false &&
    flow.enabled === false &&
    flow.effectType === "electric-current" &&
    flow.pulseRhythm === "continuous" &&
    flow.preset === null &&
    flow.speed === 0.22 &&
    flow.colorSpeed === 0.08 &&
    flow.direction === "forward" &&
    flow.intensity === 0.3 &&
    flow.width === 1.3 &&
    flow.coreWidth === 0.7 &&
    flow.glowWidth === 0 &&
    flow.opacity === 0.55 &&
    flow.colors.length === 2 &&
    knownLegacyColor &&
    flow.colors[1] === "#B69A5C" &&
    flow.coreColor === "#fff8e9" &&
    flow.glowColor === flow.colors[0] &&
    flow.streamCount === 1 &&
    flow.phase === 0 &&
    flow.placement === "along" &&
    flow.layers.current &&
    flow.layers.core &&
    !flow.layers.secondary &&
    !flow.layers.glow &&
    !flow.layers.branches &&
    !flow.layers.sparks &&
    flow.branchFrequency === 0.65 &&
    flow.branchLength === 0.08 &&
    flow.sparkDensity === 0.6 &&
    flow.flicker === 0.35 &&
    flow.turbulence === 0.35 &&
    flow.strandCount === 1 &&
    flow.pulseWidth === 0.12 &&
    flow.tailLength === 0.18;
}

function isPreviousDefaultAboutFlow(line: MagneticLinesSceneConfig["lines"][number]): boolean {
  const { flow } = line;
  const expectedPhase = line.id === "about-arc-top-inner" ? 0.18 : 0.68;
  return line.inherit.flow === false &&
    flow.enabled &&
    flow.effectType === "continuous-light" &&
    flow.pulseRhythm === "continuous" &&
    flow.preset === null &&
    flow.speed === 0.12 &&
    flow.colorSpeed === 0.025 &&
    flow.direction === "forward" &&
    flow.intensity === 0.34 &&
    flow.width === 1.1 &&
    flow.coreWidth === 0.6 &&
    flow.glowWidth === 0 &&
    flow.opacity === 0.48 &&
    flow.colors.length === 2 &&
    flow.colors[0] === line.appearance.color &&
    flow.colors[1] === "#A4D66A" &&
    flow.coreColor === "#D6E6BC" &&
    flow.glowColor === line.appearance.color &&
    flow.streamCount === 1 &&
    Math.abs(flow.phase - expectedPhase) < 1e-6 &&
    flow.placement === "along" &&
    flow.layers.current &&
    flow.layers.core &&
    !flow.layers.secondary &&
    !flow.layers.glow &&
    !flow.layers.branches &&
    !flow.layers.sparks &&
    flow.branchFrequency === 0.65 &&
    flow.branchLength === 0.08 &&
    flow.sparkDensity === 0.6 &&
    flow.flicker === 0.35 &&
    flow.turbulence === 0.35 &&
    flow.strandCount === 1 &&
    flow.pulseWidth === 0.12 &&
    flow.tailLength === 0.14;
}

export function normalizePortfolioPageScene(
  path: string,
  scene: MagneticLinesSceneConfig,
  currentDefault?: MagneticLinesSceneConfig,
): MagneticLinesSceneConfig {
  if (currentDefault && hasDefaultStarterLines(scene)) return currentDefault;
  if (path === "/" && currentDefault && isNonHomeSceneCopiedToHome(scene)) return currentDefault;
  if (path !== "/about") return scene;
  if (currentDefault && isLegacyAboutDefaultScene(scene)) {
    return {
      ...currentDefault,
      global: scene.global,
      animation: scene.animation,
      cursor: scene.cursor,
    };
  }

  let changed = false;
  const lines = scene.lines.map((line) => {
    let normalizedLine = line;
    const currentDefaultLine = currentDefault?.lines.find((candidate) => candidate.id === line.id);
    if (
      ABOUT_FLOW_LINE_IDS.has(line.id) &&
      currentDefaultLine?.flow.enabled &&
      (isLegacyDefaultAboutFlow(line) || isPreviousDefaultAboutFlow(line))
    ) {
      normalizedLine = {
        ...normalizedLine,
        flow: {
          ...currentDefaultLine.flow,
          colors: [...currentDefaultLine.flow.colors],
          layers: { ...currentDefaultLine.flow.layers },
        },
      };
      changed = true;
    }

    const aspectRatioAlignY = ABOUT_BOTTOM_ALIGNED_LINE_IDS.has(line.id) ? "bottom" : undefined;
    if (
      line.customPath.aspectRatio !== ABOUT_PATTERN_ASPECT_RATIO ||
      line.customPath.aspectRatioMode !== "artboard" ||
      line.customPath.aspectRatioAlignY !== aspectRatioAlignY
    ) {
      normalizedLine = {
        ...normalizedLine,
        customPath: {
          ...normalizedLine.customPath,
          aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
          aspectRatioMode: "artboard",
          aspectRatioAlignY,
        },
      };
      changed = true;
    }

    const legacyAppearance = LEGACY_ABOUT_APPEARANCES[line.id];
    if (
      legacyAppearance &&
      (
        line.appearance.color !== legacyAppearance.nextColor ||
        line.appearance.opacity !== legacyAppearance.nextOpacity ||
        line.appearance.width !== legacyAppearance.nextWidth
      ) &&
      (
        (
          line.appearance.color === legacyAppearance.color &&
          line.appearance.opacity === legacyAppearance.opacity &&
          line.appearance.width === legacyAppearance.width
        ) ||
        (
          line.appearance.color === legacyAppearance.intermediate?.color &&
          line.appearance.opacity === legacyAppearance.intermediate?.opacity &&
          line.appearance.width === legacyAppearance.intermediate?.width
        )
      )
    ) {
      normalizedLine = {
        ...normalizedLine,
        appearance: {
          ...normalizedLine.appearance,
          color: legacyAppearance.nextColor,
          opacity: legacyAppearance.nextOpacity,
          width: legacyAppearance.nextWidth,
        },
      };
      changed = true;
    }

    const arcId = line.id as AboutArcId;
    if (
      Object.prototype.hasOwnProperty.call(ABOUT_REFERENCE_ARC_POINTS, line.id) &&
      (
        samePoints(line.customPath.points, LEGACY_ABOUT_POINTS[arcId]) ||
        samePoints(line.customPath.points, INTERMEDIATE_ABOUT_ARC_POINTS[arcId])
      )
    ) {
      const points = ABOUT_REFERENCE_ARC_POINTS[line.id as AboutArcId];
      normalizedLine = {
        ...normalizedLine,
        customPath: {
          ...normalizedLine.customPath,
          points: points.map((point, index) => ({
            ...point,
            id: `${line.id}-point-${index + 1}`,
          })),
        },
      };
      changed = true;
    }

    if (line.id === "about-grid" && samePoints(line.customPath.points, LEGACY_ABOUT_GRID_POINTS)) {
      normalizedLine = {
        ...normalizedLine,
        customPath: {
          ...normalizedLine.customPath,
          points: ABOUT_REFERENCE_GRID_POINTS.map((point, index) => ({
            ...point,
            id: `about-grid-point-${index + 1}`,
          })),
        },
      };
      changed = true;
    }

    return normalizedLine;
  });

  return changed ? { ...scene, lines } : scene;
}
