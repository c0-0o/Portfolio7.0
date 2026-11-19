"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadPageScenePreview, loadPersistedPageScene, normalizeMagneticPagePath, registerMagneticPagePath, savePersistedPageScene, SCENE_CHANGE_EVENT, syncPersistedPageScenesFromProject } from "./persistence";
import { DEFAULT_SCENE } from "./defaultScene";
import { getSceneTemplateById } from "./sceneTemplates";
import { getProjectPageScene } from "./projectPageScenes";
import { MagneticBackgroundLines } from "./MagneticBackgroundLines";
import { MagneticTargetPicker } from "./MagneticTargetPicker";
import { registerTarget, updateTargetOptions, type RegisterTargetOptions } from "./engine/targetRegistry";
import { getTargetRegisteredActivations } from "./engine/targetLineTriggers";
import type { MagneticLinesSceneConfig, TargetActivation } from "./types";
import { ABOUT_BOTTOM_ALIGNED_LINE_IDS, ABOUT_PATTERN_ASPECT_RATIO, ABOUT_REFERENCE_ARC_POINTS, ABOUT_REFERENCE_GRID_POINTS, normalizePortfolioPageScene } from "./portfolioScene";

type TargetBindingStatus = "ready" | "missing" | "multiple" | "invalid" | "disabled";
export const PORTFOLIO_OPENING_SCENE_EVENT = "portfolio-opening-scene-visibility";

const ROUTE_LINE_COLORS: Record<string, string> = {
  "/": "#839a68",
  "/about": "#A5B49B",
  "/projects": "#9a9872",
  "/playground": "#73998b",
  "/work/em-collection": "#8e9a6a",
  "/opening": "#7AD321",
};

type PortfolioLinePoint = { x: number; y: number; moveTo?: boolean };

type PortfolioLineDesign = {
  id?: string;
  points: PortfolioLinePoint[];
  opacity?: number;
  width?: number;
  color?: string;
  zIndex?: number;
  curveSmoothing?: number;
  aspectRatio?: number;
  targetId?: string;
  targetSelector?: string;
  glow?: boolean;
  outerGlow?: boolean;
  glowColor?: string;
  outerGlowColor?: string;
  flow?: boolean;
  flowPhase?: number;
  lightSource?: boolean;
};

function compoundStrokes(strokes: PortfolioLinePoint[][]): PortfolioLinePoint[] {
  return strokes.flatMap((stroke, strokeIndex) =>
    stroke.map((point, pointIndex) => ({
      ...point,
      ...(strokeIndex > 0 && pointIndex === 0 ? { moveTo: true } : {}),
    })),
  );
}

function circlePoints(cx: number, cy: number, rx: number, ry: number, segments = 32): PortfolioLinePoint[] {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

function sparklePoints(cx: number, cy: number, rx: number, ry: number): PortfolioLinePoint[] {
  const outline = [
    { x: cx, y: cy - ry },
    { x: cx + rx * 0.18, y: cy - ry * 0.18 },
    { x: cx + rx, y: cy },
    { x: cx + rx * 0.18, y: cy + ry * 0.18 },
    { x: cx, y: cy + ry },
    { x: cx - rx * 0.18, y: cy + ry * 0.18 },
    { x: cx - rx, y: cy },
    { x: cx - rx * 0.18, y: cy - ry * 0.18 },
    { x: cx, y: cy - ry },
  ];
  const top = cy * 768 - ry * 768;
  const bottom = cy * 768 + ry * 768;
  const strokes: PortfolioLinePoint[][] = [];

  for (let y = top + 0.7; y < bottom; y += 1.4) {
    const intersections: number[] = [];
    for (let index = 0; index < outline.length - 1; index++) {
      const start = outline[index];
      const end = outline[index + 1];
      const startY = start.y * 768;
      const endY = end.y * 768;
      if ((startY <= y && endY > y) || (endY <= y && startY > y)) {
        const progress = (y - startY) / (endY - startY);
        intersections.push((start.x + (end.x - start.x) * progress) * 1720);
      }
    }

    intersections.sort((left, right) => left - right);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      strokes.push([
        { x: intersections[index] / 1720, y: y / 768 },
        { x: intersections[index + 1] / 1720, y: y / 768 },
      ]);
    }
  }

  return compoundStrokes(strokes);
}

function filledRectangleStrokes(rectangles: { x: number; y: number; width: number; height: number }[]): PortfolioLinePoint[] {
  const strokes = rectangles.flatMap(({ x, y, width, height }) => {
    const pixelHeight = height * 768;
    const rowCount = Math.max(1, Math.ceil(pixelHeight / 1.8));
    return Array.from({ length: rowCount }, (_, index) => {
      const rowY = y + ((index + 0.5) / rowCount) * height;
      return [{ x, y: rowY }, { x: x + width, y: rowY }];
    });
  });
  return compoundStrokes(strokes);
}

function dotGridPoints(x: number, y: number): PortfolioLinePoint[] {
  return compoundStrokes(Array.from({ length: 28 }, (_, index) => {
    const cx = x + (index % 7) * (20 / 1720);
    const cy = y + Math.floor(index / 7) * (20 / 768);
    return [
      { x: cx - 1.7 / 1720, y: cy },
      { x: cx + 1.7 / 1720, y: cy },
    ];
  }));
}

function dotMatrixPoints(
  x: number,
  y: number,
  columns: number,
  rows: number,
  stepX: number,
  stepY: number,
  radius: number,
): PortfolioLinePoint[] {
  return compoundStrokes(Array.from({ length: columns * rows }, (_, index) => {
    const cx = x + (index % columns) * stepX;
    const cy = y + Math.floor(index / columns) * stepY;
    return [
      { x: cx - radius, y: cy },
      { x: cx + radius, y: cy },
    ];
  }));
}

function bottomLeftRingPoints(): PortfolioLinePoint[] {
  const cx = 0.016;
  const cy = 0.81;
  const rx = 46 / 1720;
  const ry = 46 / 768;
  const start = -Math.acos(-cx / rx);
  const end = Math.acos(-cx / rx);
  return Array.from({ length: 25 }, (_, index) => {
    const angle = start + ((end - start) * index) / 24;
    return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
  });
}

const PORTFOLIO_LINE_DESIGNS: Record<string, PortfolioLineDesign[]> = {
  "/": [
    {
      id: "home-grid",
      points: compoundStrokes([
        ...[0.102, 0.202, 0.643, 0.86].map((x) => [{ x, y: 0 }, { x, y: 1 }]),
        ...[0.3, 0.535, 0.78].map((y) => [{ x: 0, y }, { x: 1, y }]),
      ]),
      color: "#cbd1c4",
      glow: false,
      outerGlow: false,
      glowColor: "#A6E96B",
      outerGlowColor: "#8EDB62",
      opacity: 0.32,
      width: 0.65,
      zIndex: -2,
    },
    {
      id: "home-arc-top-left-outer",
      points: [{ x: 0, y: 0.22 }, { x: 0.09, y: 0.22 }, { x: 0.17, y: 0.2 }, { x: 0.22, y: 0.15 }, { x: 0.25, y: 0.08 }, { x: 0.285, y: 0 }],
      color: "#a7b0a1",
      opacity: 0.52,
      width: 0.8,
      curveSmoothing: 1,
      lightSource: true,
      zIndex: -1,
    },
    {
      id: "home-arc-top-left-inner",
      points: [{ x: 0, y: 0.32 }, { x: 0.1, y: 0.29 }, { x: 0.2, y: 0.23 }, { x: 0.255, y: 0.14 }, { x: 0.31, y: 0 }],
      color: "#b9c1b2",
      opacity: 0.45,
      width: 0.72,
      curveSmoothing: 1,
      zIndex: -1,
    },
    {
      id: "home-arc-bottom-right-outer",
      points: [{ x: 0.63, y: 1 }, { x: 0.66, y: 0.84 }, { x: 0.73, y: 0.68 }, { x: 0.84, y: 0.54 }, { x: 0.94, y: 0.45 }, { x: 1, y: 0.41 }],
      color: "#a7b0a1",
      opacity: 0.56,
      width: 0.8,
      curveSmoothing: 1,
      lightSource: true,
      zIndex: -1,
    },
    {
      id: "home-arc-bottom-right-inner",
      points: [{ x: 0.76, y: 1 }, { x: 0.78, y: 0.85 }, { x: 0.83, y: 0.72 }, { x: 0.91, y: 0.6 }, { x: 1, y: 0.55 }],
      color: "#b9c1b2",
      opacity: 0.47,
      width: 0.72,
      curveSmoothing: 1,
      zIndex: -1,
    },
    {
      id: "home-ring-right",
      points: circlePoints(0.91, 0.7, 0.08, 0.04, 36),
      color: "#a7b0a1",
      opacity: 0.58,
      width: 0.7,
      zIndex: -1,
    },
    {
      id: "home-pixels-top-right",
      points: filledRectangleStrokes([
        { x: 0.702, y: 0, width: 0.052, height: 0.08 },
        { x: 0.755, y: 0.05, width: 0.052, height: 0.08 },
        { x: 0.808, y: 0.13, width: 0.052, height: 0.08 },
        { x: 0.861, y: 0.21, width: 0.052, height: 0.08 },
      ]),
      color: "#a6e96b",
      opacity: 0.24,
      width: 1.8,
      zIndex: -1,
    },
    {
      id: "home-pixels-left",
      points: filledRectangleStrokes([
        { x: 0, y: 0.535, width: 0.036, height: 0.07 },
        { x: 0.039, y: 0.48, width: 0.036, height: 0.07 },
        { x: 0.078, y: 0.535, width: 0.036, height: 0.07 },
        { x: 0.039, y: 0.59, width: 0.036, height: 0.07 },
        { x: 0.105, y: 0.66, width: 0.036, height: 0.07 },
        { x: 0.072, y: 0.72, width: 0.036, height: 0.07 },
        { x: 0.105, y: 0.79, width: 0.036, height: 0.07 },
      ]),
      color: "#a6e96b",
      opacity: 0.25,
      width: 1.8,
      zIndex: -1,
    },
    {
      id: "home-dots-top-right",
      points: dotMatrixPoints(0.92, 0.08, 7, 4, 20 / 1365, 18 / 768, 1.7 / 1365),
      color: "#181a16",
      opacity: 0.92,
      width: 3.2,
      zIndex: 1,
    },
    {
      id: "home-dots-left",
      points: dotMatrixPoints(0.102, 0.342, 1, 4, 0, 20 / 768, 1.7 / 1365),
      color: "#181a16",
      opacity: 0.92,
      width: 3.2,
      zIndex: 1,
    },
    {
      id: "home-dots-middle-right",
      points: dotMatrixPoints(0.702, 0.645, 5, 3, 18 / 1365, 18 / 768, 1.7 / 1365),
      color: "#181a16",
      opacity: 0.92,
      width: 3.2,
      zIndex: 1,
    },
    {
      id: "home-dots-bottom-left",
      points: dotMatrixPoints(0.026, 0.902, 4, 1, 16 / 1365, 0, 1.7 / 1365),
      color: "#181a16",
      opacity: 0.92,
      width: 3.2,
      zIndex: 1,
    },
    {
      id: "home-sparkle-top-left",
      points: sparklePoints(0.198, 0.17, 30 / 1720, 31 / 768),
      color: "#121410",
      opacity: 0.98,
      width: 1.4,
      zIndex: 2,
    },
    {
      id: "home-sparkle-middle-right",
      points: sparklePoints(0.856, 0.63, 31 / 1720, 34 / 768),
      color: "#7ad321",
      opacity: 0.96,
      width: 1.5,
      zIndex: 2,
    },
    {
      id: "home-sparkle-right",
      points: sparklePoints(0.952, 0.302, 10 / 1720, 12 / 768),
      color: "#181a16",
      opacity: 0.95,
      width: 1.1,
      zIndex: 2,
    },
    {
      id: "home-sparkle-bottom-left",
      points: sparklePoints(0.202, 0.902, 18 / 1720, 19 / 768),
      color: "#7ad321",
      opacity: 0.96,
      width: 1.25,
      zIndex: 2,
    },
    {
      id: "home-plus-top",
      points: compoundStrokes([
        [{ x: 0.33 - 10 / 1365, y: 0.255 }, { x: 0.33 + 10 / 1365, y: 0.255 }],
        [{ x: 0.33, y: 0.255 - 10 / 768 }, { x: 0.33, y: 0.255 + 10 / 768 }],
      ]),
      color: "#69b812",
      opacity: 0.95,
      width: 1.7,
      zIndex: 2,
    },
    {
      id: "home-hatch-bottom-right",
      points: compoundStrokes(Array.from({ length: 5 }, (_, index) => {
        const x = 0.91 + index * (18 / 1365);
        return [{ x, y: 0.9 }, { x: x + 12 / 1365, y: 0.87 }];
      })),
      color: "#181a16",
      opacity: 0.92,
      width: 1.8,
      zIndex: 1,
    },
  ],
  "/projects": [
    { points: [{ x: 0.08, y: 0.14 }, { x: 0.24, y: 0.14 }, { x: 0.24, y: 0.35 }, { x: 0.08, y: 0.35 }, { x: 0.08, y: 0.14 }], opacity: 0.42, width: 1, targetId: "projects-title", glow: true },
    { points: [{ x: 0.68, y: 0.12 }, { x: 0.9, y: 0.12 }, { x: 0.9, y: 0.4 }, { x: 0.68, y: 0.4 }, { x: 0.68, y: 0.12 }], opacity: 0.44, width: 1.05, targetId: "em-collection-title", glow: true },
    { points: [{ x: 0.72, y: 0.2 }, { x: 0.84, y: 0.2 }, { x: 0.84, y: 0.31 }, { x: 0.72, y: 0.31 }, { x: 0.72, y: 0.2 }], opacity: 0.36, width: 0.9, targetId: "codyyn-title", flow: true },
    { points: [{ x: 0.05, y: 0.72 }, { x: 0.25, y: 0.72 }, { x: 0.25, y: 0.84 }, { x: 0.05, y: 0.84 }, { x: 0.05, y: 0.72 }], opacity: 0.34, width: 0.9 },
  ],
  "/playground": [
    { points: [{ x: 0.82, y: 0.09 }, { x: 0.91, y: 0.14 }, { x: 0.93, y: 0.25 }, { x: 0.86, y: 0.32 }, { x: 0.76, y: 0.28 }, { x: 0.74, y: 0.18 }, { x: 0.82, y: 0.09 }], opacity: 0.5, width: 1.1, targetId: "playground-title", glow: true },
    { points: [{ x: 0.1, y: 0.38 }, { x: 0.18, y: 0.33 }, { x: 0.27, y: 0.38 }, { x: 0.29, y: 0.49 }, { x: 0.22, y: 0.56 }, { x: 0.12, y: 0.53 }, { x: 0.1, y: 0.38 }], opacity: 0.42, width: 0.95 },
    { points: [{ x: 0.76, y: 0.62 }, { x: 0.84, y: 0.57 }, { x: 0.93, y: 0.62 }, { x: 0.95, y: 0.73 }, { x: 0.88, y: 0.8 }, { x: 0.78, y: 0.77 }, { x: 0.76, y: 0.62 }], opacity: 0.42, width: 1, flow: true },
    { points: [{ x: 0.02, y: 0.84 }, { x: 0.14, y: 0.8 }, { x: 0.24, y: 0.84 }, { x: 0.33, y: 0.94 }], opacity: 0.34, width: 0.9 },
  ],
  "/about": [
    { id: "about-arc-top-outer", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-top-outer"], opacity: 0.6, width: 1, curveSmoothing: 1 },
    { id: "about-arc-top-inner", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-top-inner"], opacity: 0.68, width: 0.9, curveSmoothing: 1, flow: true, flowPhase: 0.18 },
    { id: "about-arc-bottom-outer", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-bottom-outer"], opacity: 0.32, width: 0.95, curveSmoothing: 1 },
    { id: "about-arc-bottom-inner", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-bottom-inner"], opacity: 0.65, width: 0.85, curveSmoothing: 1, flow: true, flowPhase: 0.68 },
    { id: "about-arc-top-dashes", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-top-dashes"], opacity: 0.3, width: 0.8 },
    { id: "about-arc-bottom-dashes", points: ABOUT_REFERENCE_ARC_POINTS["about-arc-bottom-dashes"], opacity: 0.28, width: 0.8 },
    {
      id: "about-grid",
      points: ABOUT_REFERENCE_GRID_POINTS,
      opacity: 0.15,
      width: 0.7,
    },
    { id: "about-ring-top-right", points: circlePoints(0.782, 0.1, 37 / 1720, 37 / 768), opacity: 0.32, width: 2, aspectRatio: ABOUT_PATTERN_ASPECT_RATIO },
    { id: "about-ring-bottom-left", points: bottomLeftRingPoints(), opacity: 0.3, width: 2 },
    {
      id: "about-plus-top",
      points: compoundStrokes([
        [{ x: 0.324 - 12 / 1720, y: 0.212 }, { x: 0.324 + 12 / 1720, y: 0.212 }],
        [{ x: 0.324, y: 0.212 - 12 / 768 }, { x: 0.324, y: 0.212 + 12 / 768 }],
      ]),
      color: "#A4D66A",
      opacity: 0.78,
      width: 1.6,
      aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
    },
    {
      id: "about-plus-bottom",
      points: compoundStrokes([
        [{ x: 0.657 - 12 / 1720, y: 0.766 }, { x: 0.657 + 12 / 1720, y: 0.766 }],
        [{ x: 0.657, y: 0.766 - 12 / 768 }, { x: 0.657, y: 0.766 + 12 / 768 }],
      ]),
      color: "#A4D66A",
      opacity: 0.78,
      width: 1.6,
      aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
    },
    { id: "about-sparkle-top-left", points: sparklePoints(0.143, 0.19, 18 / 1720, 18 / 768), color: "#7AD321", opacity: 0.95, width: 1.5, aspectRatio: ABOUT_PATTERN_ASPECT_RATIO },
    { id: "about-sparkle-bottom-right", points: sparklePoints(0.845, 0.688, 18 / 1720, 18 / 768), color: "#7AD321", opacity: 0.95, width: 1.5, aspectRatio: ABOUT_PATTERN_ASPECT_RATIO },
    {
      id: "about-pixels-top-right",
      points: filledRectangleStrokes([
        { x: 0.92, y: 0.127, width: 30 / 1720, height: 30 / 768 },
        { x: 0.938, y: 0.085, width: 30 / 1720, height: 30 / 768 },
        { x: 0.957, y: 0.145, width: 18 / 1720, height: 18 / 768 },
        { x: 0.968, y: 0.17, width: 18 / 1720, height: 18 / 768 },
      ]),
      color: "#7AD321",
      opacity: 0.3,
      width: 1.8,
      aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
    },
    {
      id: "about-pixels-bottom-left",
      points: filledRectangleStrokes([
        { x: 0.056, y: 0.875, width: 30 / 1720, height: 30 / 768 },
        { x: 0.079, y: 0.823, width: 18 / 1720, height: 18 / 768 },
        { x: 0.09, y: 0.849, width: 18 / 1720, height: 18 / 768 },
      ]),
      color: "#7AD321",
      opacity: 0.3,
      width: 1.8,
      aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
    },
    { id: "about-dots-left", points: dotGridPoints(0.016, 0.548), opacity: 0.38, width: 3.2, aspectRatio: ABOUT_PATTERN_ASPECT_RATIO },
    { id: "about-dots-right", points: dotGridPoints(0.894, 0.33), opacity: 0.38, width: 3.2, aspectRatio: ABOUT_PATTERN_ASPECT_RATIO },
    {
      id: "about-square-bottom-right",
      points: filledRectangleStrokes([{ x: 0.95, y: 0.85, width: 18 / 1720, height: 18 / 768 }]),
      opacity: 0.25,
      width: 1.8,
      aspectRatio: ABOUT_PATTERN_ASPECT_RATIO,
    },
  ],
  "/work/em-collection": [
    { points: [{ x: 0.68, y: 0.32 }, { x: 0.88, y: 0.32 }, { x: 0.86, y: 0.65 }, { x: 0.7, y: 0.65 }, { x: 0.68, y: 0.32 }], opacity: 0.46, width: 1.05, targetId: "em-collection-title", glow: true },
    { points: [{ x: 0.72, y: 0.32 }, { x: 0.73, y: 0.22 }, { x: 0.76, y: 0.17 }, { x: 0.8, y: 0.17 }, { x: 0.84, y: 0.22 }, { x: 0.85, y: 0.32 }], opacity: 0.4, width: 0.95 },
    { points: [{ x: 0.73, y: 0.43 }, { x: 0.82, y: 0.43 }, { x: 0.82, y: 0.53 }, { x: 0.73, y: 0.53 }, { x: 0.73, y: 0.43 }], opacity: 0.34, width: 0.9, flow: true },
    { points: [{ x: 0.07, y: 0.72 }, { x: 0.2, y: 0.68 }, { x: 0.32, y: 0.72 }, { x: 0.39, y: 0.83 }], opacity: 0.36, width: 0.9 },
  ],
  "/not-found": [
    { points: [{ x: 0.07, y: 0.28 }, { x: 0.2, y: 0.14 }, { x: 0.38, y: 0.2 }, { x: 0.43, y: 0.37 }, { x: 0.34, y: 0.52 }, { x: 0.16, y: 0.51 }, { x: 0.08, y: 0.38 }], opacity: 0.58, width: 1.15, targetId: "not-found-mark", glow: true },
    { points: [{ x: 0.13, y: 0.31 }, { x: 0.23, y: 0.22 }, { x: 0.35, y: 0.26 }, { x: 0.38, y: 0.37 }, { x: 0.31, y: 0.46 }, { x: 0.19, y: 0.45 }, { x: 0.13, y: 0.37 }], opacity: 0.44, width: 0.95, targetId: "not-found-mark", flow: true },
    { points: [{ x: 0.03, y: 0.64 }, { x: 0.13, y: 0.72 }, { x: 0.26, y: 0.73 }, { x: 0.35, y: 0.68 }], opacity: 0.4, width: 0.9 },
  ],
};

const TARGET_ACTIVATIONS: TargetActivation[] = ["hover", "focus", "touch"];
const HOME_BACKGROUND_LIGHTS = [
  {
    id: "home-top-left-glow",
    color: "#A6E96B",
    position: { x: 0.02, y: 0.02 },
    endPosition: { x: 0.02, y: 0.02 },
    intensity: 0.82,
    radius: 0.42,
    speed: 0,
    playback: "loop" as const,
  },
  {
    id: "home-bottom-right-glow",
    color: "#A6E96B",
    position: { x: 0.98, y: 0.98 },
    endPosition: { x: 0.98, y: 0.98 },
    intensity: 0.82,
    radius: 0.42,
    speed: 0,
    playback: "loop" as const,
  },
];

export function getPortfolioDefaultScene(path: string): MagneticLinesSceneConfig {
  if (path === "/opening") {
    const openingTemplate = getSceneTemplateById("opening-luminous-silk-filaments");
    if (!openingTemplate) throw new Error("Missing Opening scene template: opening-luminous-silk-filaments");
    return structuredClone(openingTemplate.config);
  }

  const designPath = path.startsWith("/work/") ? "/" : path;
  const portfolioLines = ["/", "/about", "/playground"].includes(designPath)
    ? designPath === "/"
      ? PORTFOLIO_LINE_DESIGNS[designPath].filter((design) => design.id === "home-grid")
      : PORTFOLIO_LINE_DESIGNS[designPath]
    : undefined;
  if (!portfolioLines) {
    return {
      ...structuredClone(DEFAULT_SCENE),
      lines: [],
      groups: [],
      targets: [],
    };
  }

  const color = ROUTE_LINE_COLORS[designPath] ?? "#839a68";
  const colorStyle = { type: "solid" as const, colors: [color] };

  return {
    ...DEFAULT_SCENE,
    global: {
      ...DEFAULT_SCENE.global,
      color,
      colorStyle,
      opacity: 0.4,
      width: DEFAULT_SCENE.global.width,
      glowEnabled: false,
      outerGlowEnabled: false,
      environment: designPath === "/" ? {
        ...DEFAULT_SCENE.global.environment,
        enabled: true,
        airflowEnabled: false,
        lightEnabled: true,
        lightColor: HOME_BACKGROUND_LIGHTS[0].color,
        lightPosition: { ...HOME_BACKGROUND_LIGHTS[0].position },
        lightIntensity: HOME_BACKGROUND_LIGHTS[0].intensity,
        lightRadius: HOME_BACKGROUND_LIGHTS[0].radius,
        lights: HOME_BACKGROUND_LIGHTS.map((light) => ({
          ...light,
          position: { ...light.position },
          endPosition: { ...light.endPosition },
        })),
      } : DEFAULT_SCENE.global.environment,
      cursorInfluence: DEFAULT_SCENE.global.cursorInfluence,
    },
    lines: portfolioLines.map((design, index) => {
      const line = DEFAULT_SCENE.lines[index % DEFAULT_SCENE.lines.length];
      const id = design.id ?? line.id;
      const points = design.points.map((point, pointIndex) => ({
        id: `${id}-point-${pointIndex + 1}`,
        ...point,
      }));
      const lineColor = design.color ?? color;
      const lineColorStyle = { type: "solid" as const, colors: [lineColor] };
      const glowColor = design.glowColor ?? lineColor;
      const glowColorStyle = { type: "solid" as const, colors: [glowColor] };
      const outerGlowColor = design.outerGlowColor ?? lineColor;
      const outerGlowColorStyle = { type: "solid" as const, colors: [outerGlowColor] };
      const from = points[0];
      const to = points[points.length - 1];
      const aboutFlowEnabled = designPath === "/about" && Boolean(design.flow);
      const isHomeGrid = designPath === "/" && id === "home-grid";

      return {
        ...line,
        id,
        enabled: true,
        visible: true,
        geometrySource: "path" as const,
        from,
        to,
        customPath: {
          ...line.customPath,
          points,
          curveSmoothing: design.curveSmoothing ?? line.customPath.curveSmoothing,
          aspectRatio: designPath === "/about"
            ? ABOUT_PATTERN_ASPECT_RATIO
            : design.aspectRatio ?? line.customPath.aspectRatio,
          aspectRatioMode: designPath === "/about" ? "artboard" : line.customPath.aspectRatioMode,
          aspectRatioAlignY: designPath === "/about"
            ? ABOUT_BOTTOM_ALIGNED_LINE_IDS.has(id) ? "bottom" : undefined
            : line.customPath.aspectRatioAlignY,
          closedJoint: "connected",
        },
        inherit: {
          ...line.inherit,
          appearance: false,
          shape: false,
          motion: false,
          glow: false,
          outerGlow: false,
          magnet: false,
          flow: false,
          ...(isHomeGrid ? { cursorInfluence: false, texture: false } : {}),
        },
        shape: {
          ...line.shape,
          type: "soft-wave" as const,
          bendable: isHomeGrid || (designPath !== "/" && line.shape.bendable),
          amplitude: designPath === "/about" || designPath === "/" ? 0 : 0.002,
          frequency: 1,
          cycles: 1,
          phase: index * 0.7,
          smoothness: 0.95,
          irregularity: 0,
          distortion: 0,
          roughness: 0,
        },
        motion: {
          ...line.motion,
          type: "floating" as const,
          speed: isHomeGrid ? 0.08 : 0.085 + (index % 3) * 0.018,
          amplitude: isHomeGrid ? 0.05 : designPath === "/about" || designPath === "/" ? 0 : index < 6 ? 0.007 : 0.004,
          frequency: isHomeGrid ? 0.8 : 1,
          deformability: 0.4,
        },
        magnet: {
          ...line.magnet,
          targetId: design.targetId ?? null,
          enabled: Boolean(design.targetId),
          strength: 72,
          radius: 0.2,
          falloff: 68,
          maxDeformation: 0.045,
        },
        glow: {
          ...line.glow,
          enabled: Boolean(design.glow),
          color: glowColor,
          colorStyle: glowColorStyle,
          intensity: design.glow ? 72 : 34,
          opacity: design.glow ? 88 : 54,
          radius: design.glow ? 0.14 : 0.1,
          length: 22,
          falloff: design.glow ? 65 : 72,
        },
        outerGlow: {
          ...line.outerGlow,
          enabled: Boolean(design.outerGlow),
          color: outerGlowColor,
          colorStyle: outerGlowColorStyle,
          intensity: design.outerGlow ? 58 : 38,
          opacity: design.outerGlow ? 88 : 100,
          radius: 0.34,
          length: 34,
          falloff: 70,
        },
        cursorGlow: { ...line.cursorGlow, enabled: !isHomeGrid, color: lineColor, intensity: 0.32, radius: 0.1, falloff: 0.65 },
        texture: isHomeGrid
          ? {
              ...line.texture,
              enabled: true,
              type: "silk" as const,
              scale: 0.02,
              intensity: 0.72,
              showThread: true,
              weight: 0.55,
              silkStrands: 3,
            }
          : line.texture,
        flow: {
          ...line.flow,
          enabled: isHomeGrid || Boolean(design.flow),
          effectType: isHomeGrid ? "energy-pulse" : aboutFlowEnabled ? "continuous-light" : line.flow.effectType,
          pulseRhythm: isHomeGrid ? "continuous" : line.flow.pulseRhythm,
          preset: isHomeGrid || aboutFlowEnabled ? null : line.flow.preset,
          speed: isHomeGrid || aboutFlowEnabled ? 0.12 : 0.22,
          colorSpeed: isHomeGrid || aboutFlowEnabled ? 0.025 : line.flow.colorSpeed,
          direction: isHomeGrid ? "forward" : line.flow.direction,
          intensity: isHomeGrid ? 0.65 : aboutFlowEnabled ? 0.4 : 0.3,
          width: isHomeGrid ? 1.2 : aboutFlowEnabled ? 1.1 : 1.3,
          coreWidth: isHomeGrid ? 0.8 : aboutFlowEnabled ? 0.6 : 0.7,
          glowWidth: isHomeGrid ? 2.5 : aboutFlowEnabled ? 2.5 : 0,
          opacity: isHomeGrid ? 0.8 : aboutFlowEnabled ? 0.52 : 0.55,
          colors: isHomeGrid ? ["#7AD321", "#A6E96B"] : aboutFlowEnabled ? [lineColor, "#A4D66A"] : [lineColor, "#B69A5C"],
          coreColor: isHomeGrid ? "#DFFFBD" : aboutFlowEnabled ? "#D6E6BC" : "#fff8e9",
          glowColor: isHomeGrid ? "#7AD321" : aboutFlowEnabled ? "#A4D66A" : lineColor,
          streamCount: 1,
          strandCount: 1,
          phase: isHomeGrid ? 0 : aboutFlowEnabled ? design.flowPhase ?? 0 : line.flow.phase,
          tailLength: isHomeGrid || aboutFlowEnabled ? 0.14 : line.flow.tailLength,
          layers: {
            current: true,
            core: true,
            secondary: false,
            glow: isHomeGrid || aboutFlowEnabled,
            branches: false,
            sparks: false,
          },
        },
        environmentEnabled: Boolean(design.lightSource),
        environment: {
          ...line.environment,
          airflowMode: "off" as const,
          lightMode: design.lightSource ? "global" as const : "off" as const,
        },
        cursorInfluence: {
          ...line.cursorInfluence,
          enabled: isHomeGrid,
          mode: isHomeGrid ? "attract" : line.cursorInfluence.mode,
        },
        appearance: {
          ...line.appearance,
          color: lineColor,
          colorStyle: lineColorStyle,
          opacity: design.opacity ?? 0.34,
          width: design.width ?? 1,
          zIndex: design.zIndex ?? line.appearance.zIndex,
        },
      };
    }),
    targets: Array.from(
      portfolioLines.reduce((targets, design, index) => {
        if (!design.targetId) return targets;
        const target = targets.get(design.targetId) ?? {
          id: design.targetId,
          selector: design.targetSelector,
          lineIds: [] as string[],
          lineTriggers: {} as Record<string, { magnet?: TargetActivation[]; glow?: TargetActivation[] }>,
        };
        const lineId = portfolioLines[index].id ?? DEFAULT_SCENE.lines[index].id;
        target.lineIds.push(lineId);
        target.lineTriggers[lineId] = {
          magnet: TARGET_ACTIVATIONS,
          ...(design.glow ? { glow: TARGET_ACTIVATIONS } : {}),
        };
        targets.set(design.targetId, target);
        return targets;
      }, new Map<string, {
        id: string;
        selector?: string;
        lineIds: string[];
        lineTriggers: Record<string, { magnet?: TargetActivation[]; glow?: TargetActivation[] }>;
      }>()),
    ).map(([, target]) => ({
      ...target,
      enabled: true,
      magnetic: true,
      strength: 0.78,
      radius: 0.12,
      priority: 3,
      activations: TARGET_ACTIVATIONS,
    })),
  };
}

export function getActivePortfolioBackgroundScene(
  pathname: string | null,
  openingSceneActive: boolean,
  pageScene: MagneticLinesSceneConfig,
  openingScene: MagneticLinesSceneConfig,
  sceneIsPreview = false,
): MagneticLinesSceneConfig {
  return pathname === "/" && openingSceneActive && !sceneIsPreview ? openingScene : pageScene;
}

export function PersistentMagneticBackground() {
  const pathname = usePathname();
  const [openingSceneStatus, setOpeningSceneStatus] = useState(() => ({
    pathname: pathname ?? "",
    active: pathname === "/opening",
  }));
  const currentPathname = pathname ?? "";
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setOpeningSceneStatus((current) => current.pathname === currentPathname
        ? current
        : {
            pathname: currentPathname,
            active: currentPathname === "/opening",
          });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [currentPathname]);
  const openingSceneActive =
    (pathname === "/" || pathname === "/opening") &&
    (openingSceneStatus.pathname === currentPathname
      ? openingSceneStatus.active
      : currentPathname === "/opening");
  const [scene, setScene] = useState(() => {
    const path = pathname ? normalizeMagneticPagePath(pathname) : null;
    return path && path !== "/editor"
      ? getProjectPageScene(path) ?? getPortfolioDefaultScene(path)
      : DEFAULT_SCENE;
  });
  const [sceneIsPreview, setSceneIsPreview] = useState(false);
  const [openingScene, setOpeningScene] = useState(() => {
    const defaultScene = getPortfolioDefaultScene("/opening");
    const cachedScene = process.env.NODE_ENV === "production" ? null : loadPersistedPageScene("/opening");
    const pageScene = cachedScene ?? getProjectPageScene("/opening") ?? defaultScene;
    return normalizePortfolioPageScene("/opening", pageScene, defaultScene);
  });
  const activeScene = getActivePortfolioBackgroundScene(
    pathname,
    openingSceneActive,
    scene,
    openingScene,
    sceneIsPreview,
  );
  const sceneTargets = activeScene.targets;
  useEffect(() => {
    const updateOpeningSceneVisibility = (event: Event) => {
      const eventPath = window.location.pathname;
      if (
        (eventPath !== "/" && eventPath !== "/opening") ||
        !(event instanceof CustomEvent) ||
        typeof event.detail !== "boolean"
      ) {
        return;
      }
      setOpeningSceneStatus({
        pathname: eventPath,
        active: event.detail,
      });
    };
    window.addEventListener(PORTFOLIO_OPENING_SCENE_EVENT, updateOpeningSceneVisibility);
    return () => window.removeEventListener(PORTFOLIO_OPENING_SCENE_EVENT, updateOpeningSceneVisibility);
  }, []);
  useEffect(() => {
    let disposed = false;
    const update = () => {
      if (disposed) return;
      const path = pathname ? normalizeMagneticPagePath(pathname) : null;
      if (!path || path === "/editor") return;
      registerMagneticPagePath(path);
      const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
      const previewScene = previewToken ? loadPageScenePreview(path, previewToken) : null;
      const cachedPageScene = process.env.NODE_ENV === "production" ? null : loadPersistedPageScene(path);
      const pageScene = cachedPageScene ?? getProjectPageScene(path);
      const defaultScene = getPortfolioDefaultScene(path);
      const activeScene = previewScene || pageScene || defaultScene;
      const normalizedScene = normalizePortfolioPageScene(path, activeScene, defaultScene);
      if (process.env.NODE_ENV !== "production" && !previewScene && pageScene && normalizedScene !== pageScene) {
        void savePersistedPageScene(path, normalizedScene).then((saved) => {
          if (!saved) console.error("Could not save the updated page background scene to project files.");
        }).catch((error: unknown) => {
          console.error("Could not save the updated page background scene to project files.", error);
        });
      }
      setScene(normalizedScene);
      setSceneIsPreview(Boolean(previewScene));
      const openingDefaultScene = getPortfolioDefaultScene("/opening");
      const cachedOpeningScene = process.env.NODE_ENV === "production"
        ? null
        : loadPersistedPageScene("/opening");
      const openingPageScene = cachedOpeningScene ?? getProjectPageScene("/opening") ?? openingDefaultScene;
      setOpeningScene(normalizePortfolioPageScene("/opening", openingPageScene, openingDefaultScene));
    };
    const loadProjectScenes = async () => {
      try {
        await syncPersistedPageScenesFromProject();
      } catch (error) {
        console.error("Could not load magnetic-scene data from project files.", error);
      }
      if (disposed) return;
      update();
    };
    update();
    void loadProjectScenes();
    window.addEventListener(SCENE_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      disposed = true;
      window.removeEventListener(SCENE_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [pathname]);
  useEffect(() => {
    if (pathname === "/editor") return;
    const registrations = new Map<string, { element: Element; signature: string; unregister: () => void }>();
    const reportedSelectors = new Set<string>();
    const lastStatuses = new Map<string, TargetBindingStatus>();
    const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
    let syncFrame = 0;
    const reportStatus = (targetId: string, status: TargetBindingStatus) => {
      if (lastStatuses.get(targetId) === status) return;
      lastStatuses.set(targetId, status);
      if (previewToken && window.parent !== window) {
        window.parent.postMessage({ type: "magnetic-target-status", previewToken, targetId, status }, window.location.origin);
      }
    };
    const syncTargets = () => {
      const getRegistrationOptions = (target: (typeof sceneTargets)[number]): RegisterTargetOptions => ({
        magnetic: target.magnetic,
        strength: target.strength,
        radius: target.radius,
        priority: target.priority,
        activations: getTargetRegisteredActivations(target),
        clickBehavior: target.clickBehavior,
      });
      for (const target of sceneTargets) {
        if (!target.selector) updateTargetOptions(target.id, getRegistrationOptions(target));
      }
      const desired = new Map(sceneTargets.filter((target) => target.selector).map((target) => [target.id, target]));
      const resolved = new Map<string, { target: (typeof sceneTargets)[number]; element: Element | null; signature: string; status: TargetBindingStatus }>();
      for (const target of desired.values()) {
        const signature = JSON.stringify([target.selector, target.enabled, target.magnetic, target.strength, target.radius, target.priority, target.activations, target.lineTriggers, target.clickBehavior]);
        if (!target.enabled) {
          resolved.set(target.id, { target, element: null, signature, status: "disabled" });
          reportStatus(target.id, "disabled");
          continue;
        }
        try {
          const matches = document.querySelectorAll(target.selector!);
          const status: TargetBindingStatus = matches.length === 1 ? "ready" : matches.length === 0 ? "missing" : "multiple";
          resolved.set(target.id, { target, element: matches.length === 1 ? matches[0] : null, signature, status });
          reportStatus(target.id, status);
          if (status === "multiple" && !reportedSelectors.has(target.selector!)) {
            reportedSelectors.add(target.selector!);
            console.warn(`Magnetic target "${target.name ?? target.id}" matches multiple elements. Re-pick it in the editor.`);
          }
        } catch (error) {
          resolved.set(target.id, { target, element: null, signature, status: "invalid" });
          reportStatus(target.id, "invalid");
          if (!reportedSelectors.has(target.selector!)) {
            reportedSelectors.add(target.selector!);
            console.error(`Magnetic target "${target.name ?? target.id}" has an invalid selector. Re-pick it in the editor.`, error);
          }
        }
      }
      for (const [id, registration] of registrations) {
        const next = resolved.get(id);
        if (next?.element === registration.element) {
          if (next.signature !== registration.signature) {
            updateTargetOptions(id, getRegistrationOptions(next.target));
            registration.signature = next.signature;
          }
          continue;
        }
        registration.unregister();
        registrations.delete(id);
      }

      for (const { target, element, signature } of resolved.values()) {
        if (registrations.has(target.id) || !element) continue;
        registrations.set(target.id, {
          element,
          signature,
          unregister: registerTarget(target.id, element, getRegistrationOptions(target)),
        });
      }
    };
    syncTargets();
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      syncTargets();
    });
    const observer = new MutationObserver(() => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(() => {
        syncFrame = 0;
        syncTargets();
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "data-testid", "aria-label", "name", "role", "title", "alt", "href"],
    });
    return () => {
      observer.disconnect();
      if (syncFrame) cancelAnimationFrame(syncFrame);
      registrations.forEach((registration) => registration.unregister());
      registrations.clear();
    };
  }, [pathname, sceneTargets]);
  if (pathname === "/editor") return null;
  return (
    <>
      <MagneticBackgroundLines
        config={activeScene}
        openingAnimation={openingSceneActive}
        style={{ zIndex: 0, ...(pathname === "/about" ? { maxWidth: "none" } : {}) }}
      />
      <MagneticTargetPicker />
    </>
  );
}