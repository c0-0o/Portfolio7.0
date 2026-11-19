"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { RAINBOW_COLORS, type EnvironmentLightConfig, type GlowConfig, type LineColorStyle, type MagneticLineConfig, type MagneticLinesSceneConfig, type Point } from "./types";
import { getEvenlySpacedColors, normalizeColorWeights } from "./colorWeights";
import { computeLine, createLineRuntimeState, getAnchorSequenceStepStartTime, getCustomPathPointsInViewport, shouldScheduleAnimationFrame, pathSegmentsFromResult, type AnchorPlaybackState, type LineRuntimeState } from "./engine/lineEngine";
import { createTargetFrameContext, getAllTargetSnapshots, updateTargetOptions } from "./engine/targetRegistry";
import { getTargetRegisteredActivations } from "./engine/targetLineTriggers";
import { clamp01, pointsToSmoothPath } from "./engine/math";
import { resolveLineConfig } from "./engine/resolveConfig";
import { getEnvironmentLightPosition, getEnvironmentLights, resolveLineAirflowPaths, resolveLineEnvironment } from "./environment";
import { getMaterialFlowPaths, getMaterialFlowWidthScale, getMetalChainPaths, getTextureLayerStrokeWidth, getTextureLightResponse, getTextureStrokeLayers, offsetTexturePath } from "./texture";
import { computeLineInteractionOffsets, computeNeighborGlowTargets } from "./engine/lineInteraction";
import { createOcclusionMaskPlan } from "./engine/occlusion";
import {
  createFlowGeometry,
  FLOW_LAYER_COUNT,
  renderFlowEffect,
  renderHeartbeatPulsePathEffect,
} from "./engine/flowEngine";

function environmentLightSvgId(instancePrefix: string, type: "light" | "spill", key: string): string {
  const encodedKey = Array.from(key, (character) => character.codePointAt(0)?.toString(16) ?? "0").join("-");
  return `${instancePrefix}-environment-${type}-${encodedKey}`;
}

export interface DebugFlags {
  showIds?: boolean;
  showEndpoints?: boolean;
  showTargetBounds?: boolean;
}

export interface MagneticBackgroundLinesProps {
  config: MagneticLinesSceneConfig;
  className?: string;
  style?: React.CSSProperties;
  openingAnimation?: boolean;
  /**
   * Enables editor-only interaction: click-to-select, draggable endpoint handles,
   * and debug overlays. Leave false/omitted in production â€” the background then
   * renders fixed, full-viewport, and pointer-events: none.
   */
  interactive?: boolean;
  selectedLineId?: string | null;
  showGlowRadiusPreview?: { inner: boolean; outer: boolean };
  selectedGroupLineIds?: string[];
  showTransformHandles?: boolean;
  pauseAnimation?: boolean;
  animateEffectsWhenPaused?: boolean;
  /** When set, only this line is rendered (Solo mode). */
  soloLineId?: string | null;
  /** Editor-only presentation state; never changes scene configuration. */
  focusLineId?: string | null;
  focusOpacity?: number;
  onViewportChange?: (viewport: { width: number; height: number }) => void;
  onSelectLine?: (id: string) => void;
  onLineDragStart?: (lineId: string) => void;
  onDragLine?: (lineId: string, delta: Point) => void;
  onDragStart?: (lineId: string, which: "from" | "to") => void;
  onGroupDragStart?: () => void;
  onDragGroup?: (delta: Point) => void;
  onGroupTransformStart?: () => void;
  onGroupTransform?: (scale: number, rotation: number, center: Point) => void;
  onLineTransformStart?: () => void;
  onLineTransform?: (scaleX: number, scaleY: number, rotation: number, center: Point) => void;
  onDragEndpoint?: (lineId: string, which: "from" | "to", point: Point) => void;
  onDragAnchorPoint?: (lineId: string, pointId: string, point: Point) => void;
  onDragSelectedAnchorPoints?: (lineId: string, pointIds: string[], delta: Point) => void;
  onDragAnchorStart?: (lineId: string, pointId: string) => void;
  onDragCommit?: () => void;
  selectedPathPointId?: string | null;
  selectedAnchorPointId?: string | null;
  selectedAnchorPointIds?: string[];
  anchorPlaybackSeek?: { lineId: string; stepIndex: number; requestId: number } | null;
  visibleAnchorPointIds?: string[];
  editableAnchorPointIds?: string[];
  visiblePathPointIds?: string[];
  showAnchorPointHandles?: boolean;
  showPathPointHandles?: boolean;
  showShapePointLabels?: boolean;
  onSelectPathPoint?: (lineId: string, pointId: string) => void;
  onSelectAnchorPoint?: (lineId: string, pointId: string) => void;
  onPathPointDragStart?: (lineId: string, pointId: string) => void;
  onDragPathPoint?: (lineId: string, pointId: string, point: Point) => void;
  onPathPointDragEnd?: (lineId: string, pointId: string, nearbyPointId: string) => void;
  environmentPathEditing?: boolean;
  environmentPath?: Point[];
  environmentPaths?: Point[][];
  environmentPathRadii?: number[];
  environmentPathIndex?: number;
  environmentPathLineId?: string | null;
  showEnvironmentControls?: boolean;
  editableEnvironmentLights?: EnvironmentLightConfig[];
  onEnvironmentPathCommit?: (path: Point[], lineId?: string, pathIndex?: number) => void;
  onEnvironmentLightPositionChange?: (position: Point, lineId?: string, lightId?: string, endpoint?: "start" | "end") => void;
  onEnvironmentLightDragStart?: (lineId?: string) => void;
  onEnvironmentLightDragEnd?: () => void;
  debug?: DebugFlags;
}

function isReducedMotion(setting: MagneticLinesSceneConfig["animation"]["reducedMotion"]): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const DEFAULT_GLOW_RADIUS_PREVIEW = { inner: false, outer: false };

type DragAxis = "x" | "y" | null;

function getDragAxis(pointer: Point, startPointer: Point, width: number, height: number): Exclude<DragAxis, null> {
  return Math.abs(pointer.x - startPointer.x) * width >= Math.abs(pointer.y - startPointer.y) * height ? "x" : "y";
}

function getAxisLockedDelta(
  pointer: Point,
  lastPointer: Point,
  startPointer: Point,
  shiftKey: boolean,
  shiftAxis: DragAxis,
  width: number,
  height: number,
) {
  const delta = { x: pointer.x - lastPointer.x, y: pointer.y - lastPointer.y };
  if (!shiftKey) return { delta, shiftAxis: null as DragAxis };
  const axis = shiftAxis ?? getDragAxis(pointer, startPointer, width, height);
  return {
    delta: axis === "x" ? { x: delta.x, y: 0 } : { x: 0, y: delta.y },
    shiftAxis: axis,
  };
}

function getDraggedPoint(
  pointer: Point,
  startPointer: Point,
  startPoint: Point,
  offset: Point,
  shiftKey: boolean,
  shiftAxis: DragAxis,
  width: number,
  height: number,
) {
  if (!shiftKey) return { point: { x: pointer.x + offset.x, y: pointer.y + offset.y }, shiftAxis: null as DragAxis };
  const axis = shiftAxis ?? getDragAxis(pointer, startPointer, width, height);
  const delta = { x: pointer.x - startPointer.x, y: pointer.y - startPointer.y };
  return {
    point: axis === "x"
      ? { x: startPoint.x + delta.x, y: startPoint.y }
      : { x: startPoint.x, y: startPoint.y + delta.y },
    shiftAxis: axis,
  };
}

function getColorStops(colorStyle: LineColorStyle | undefined, color: string) {
  const colors = colorStyle?.type === "rainbow"
    ? RAINBOW_COLORS
    : colorStyle?.colors?.length
    ? colorStyle.colors
    : [color, color];
  const weights = normalizeColorWeights(
    colorStyle?.type === "rainbow" ? undefined : colorStyle?.colorWeights,
    colors.length,
  );
  const stops: { color: string; position: number }[] = [];
  let position = 0;
  colors.forEach((color, index) => {
    const weight = Math.min(100, Math.max(0, weights[index] ?? 0));
    if (weight <= 0) return;
    const start = Math.min(100, position);
    stops.push({ color, position: start });
    position += weight;
    stops.push({ color, position: Math.min(100, position) });
  });
  const expandedStops = colorStyle?.type === "diamond"
    ? [
        ...stops.map((stop) => ({ ...stop, position: stop.position * 0.5 })),
        ...stops.slice(0, -1).reverse().map((stop) => ({ ...stop, position: 100 - stop.position * 0.5 })),
      ]
    : stops;
  return expandedStops
    .map((stop, index) => ({ ...stop, index }))
    .sort((left, right) => left.position - right.position || left.index - right.index)
    .map(({ color, position }) => ({ color, offset: `${position}%` }));
}

function getAppearanceStops(line: MagneticLineConfig) {
  return getColorStops(line.appearance.colorStyle, line.appearance.color);
}

function interpolateHexColor(from: string, to: string, progress: number): string {
  const normalize = (color: string) => {
    const hex = color.replace("#", "");
    const full = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
    return /^[\da-f]{6}$/i.test(full) ? full : "8fa3b8";
  };
  const a = normalize(from);
  const b = normalize(to);
  const amount = Math.max(0, Math.min(1, progress));
  const channel = (offset: number) => {
    const start = parseInt(a.slice(offset, offset + 2), 16);
    const end = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function getRandomColor(colorStyle: LineColorStyle | undefined, color: string, seed: string, time: number): string {
  const colors = colorStyle?.colors?.length ? colorStyle.colors : [color, color];
  if (colors.length < 2) return colors[0] ?? color;
  const phase = [...seed].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7) / 0xffffffff;
  const secondsPerColor = Math.min(10, Math.max(0.1, colorStyle?.speed ?? 2.5));
  const position = (time / secondsPerColor + phase) % colors.length;
  const index = Math.floor(position);
  const progress = position - index;
  const eased = progress * progress * (3 - 2 * progress);
  return interpolateHexColor(colors[index], colors[(index + 1) % colors.length], eased);
}

function getRandomLineColor(line: MagneticLineConfig, time: number): string {
  return getRandomColor(line.appearance.colorStyle, line.appearance.color, line.id, time);
}

function getCustomPathSegmentCount(points: MagneticLineConfig["customPath"]["points"]): number {
  const segments: number[] = [];
  for (const point of points) {
    if (point.moveTo && segments[segments.length - 1] > 0) segments.push(0);
    if (segments.length === 0) segments.push(0);
    segments[segments.length - 1] += 1;
  }
  return segments.filter((length) => length >= 2).length;
}

function getGlowColorAtPosition(glow: GlowConfig, lineId: string, time: number, position: number): string {
  const style = glow.colorStyle;
  if (!style || style.type === "solid") return glow.color;
  if (style.type === "random") return getRandomColor(style, glow.color, `${lineId}-glow`, time);
  const stops = getColorStops(style, glow.color);
  const samplePosition = style.type === "radial" ? 1 - Math.abs(position * 2 - 1) : position;
  const target = Math.max(0, Math.min(100, samplePosition * 100));
  const rightIndex = stops.findIndex((stop) => Number.parseFloat(stop.offset) >= target);
  if (rightIndex < 0) return stops[stops.length - 1]?.color ?? glow.color;
  if (rightIndex === 0) return stops[0].color;
  const left = stops[rightIndex - 1];
  const right = stops[rightIndex];
  const leftPosition = Number.parseFloat(left.offset);
  const rightPosition = Number.parseFloat(right.offset);
  if (rightPosition <= leftPosition) return right.color;
  const amount = (target - leftPosition) / (rightPosition - leftPosition);
  return interpolateHexColor(left.color, right.color, amount);
}

export function MagneticBackgroundLines({
  config,
  className,
  style,
  openingAnimation = false,
  interactive = false,
  selectedLineId = null,
  showGlowRadiusPreview = DEFAULT_GLOW_RADIUS_PREVIEW,
  selectedGroupLineIds = [],
  showTransformHandles = false,
  pauseAnimation = false,
  animateEffectsWhenPaused = false,
  soloLineId = null,
  focusLineId = null,
  focusOpacity = 0.2,
  onViewportChange,
  onSelectLine,
  onLineDragStart,
  onDragLine,
  onDragStart,
  onGroupDragStart,
  onDragGroup,
  onGroupTransformStart,
  onGroupTransform,
  onLineTransformStart,
  onLineTransform,
  onDragEndpoint,
  onDragAnchorPoint,
  onDragSelectedAnchorPoints,
  onDragAnchorStart,
  onDragCommit,
  selectedPathPointId = null,
  selectedAnchorPointId = null,
  selectedAnchorPointIds = [],
  anchorPlaybackSeek = null,
  visibleAnchorPointIds,
  editableAnchorPointIds,
  visiblePathPointIds,
  showAnchorPointHandles = true,
  showPathPointHandles = true,
  showShapePointLabels = false,
  onSelectPathPoint,
  onSelectAnchorPoint,
  onPathPointDragStart,
  onDragPathPoint,
  onPathPointDragEnd,
  environmentPathEditing = false,
  environmentPath,
  environmentPaths,
  environmentPathRadii,
  environmentPathIndex = 0,
  environmentPathLineId = null,
  showEnvironmentControls = true,
  editableEnvironmentLights = [],
  onEnvironmentPathCommit,
  onEnvironmentLightPositionChange,
  onEnvironmentLightDragStart,
  onEnvironmentLightDragEnd,
  debug,
}: MagneticBackgroundLinesProps) {
  const instancePrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const openingElectricPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const glowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const outerGlowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const innerGlowRadiusRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const outerGlowRadiusRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const innerGlowRadiusInsetRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const outerGlowRadiusInsetRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const texturePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const environmentLightPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const environmentSilkLightPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const flowLayerRefs = useRef<Map<string, Array<SVGPathElement | null>>>(new Map());
  const airflowGuidePathRefs = useRef<Map<number, SVGPathElement>>(new Map());
  const airflowDraftPathRef = useRef<SVGPathElement | null>(null);
  const airflowDrawingRef = useRef<{ pointerId: number; lineId?: string; pathIndex: number; points: Point[]; lastPoint: Point } | null>(null);
  const environmentLightDraggingRef = useRef<{ pointerId: number; lineId?: string; lightId: string; endpoint: "start" | "end" } | null>(null);
  const environmentLightGradientRefs = useRef<Map<string, { element: SVGGradientElement; light: EnvironmentLightConfig }>>(new Map());
  const environmentLightCurrentRefs = useRef<Map<string, SVGCircleElement>>(new Map());
  const environmentLightAnimationClocksRef = useRef<Map<string, { signature: string; startedAt: number }>>(new Map());
  const gradientStopRefs = useRef<Map<string, SVGStopElement[]>>(new Map());
  const outerGradientStopRefs = useRef<Map<string, SVGStopElement[]>>(new Map());
  const colorGradientRefs = useRef<Map<string, SVGGradientElement>>(new Map());
  const occlusionMaskRefs = useRef<Map<string, SVGMaskElement>>(new Map());
  const occlusionMaskPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const lineGroupRefs = useRef<Map<string, SVGGElement>>(new Map());
  const movePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const runtimeStates = useRef<Map<string, LineRuntimeState>>(new Map());
  const lineMotionClocks = useRef<Map<string, { delay: number; startedAt: number }>>(new Map());
  const triggerPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const anchorInteractionStates = useRef(new Map<string, { alwaysSignature: string; alwaysStartedAt: number; hovering: boolean; hasHovered: boolean; hoverStartedAt: number; hoverFrozenTime: number; activeClickPointIds: Set<string>; clickStartedAt: number }>());
  const anchorPlaybackSeekRef = useRef<Map<string, { startedAt: number; pointStartTimes: Map<string, number> }>>(new Map());
  const runtimeTimeRef = useRef(0);
  const overlayTimeRef = useRef(0);
  const motionScaleRef = useRef(1);
  const pointerRef = useRef({ x: 0, y: 0, active: false, lastMove: 0 });
  const scheduleFrameRef = useRef<(() => void) | null>(null);
  const viewportRef = useRef({ width: 0, height: 0 });
  const surfaceRectRef = useRef<DOMRect | null>(null);
  const draggingRef = useRef<{
    lineId: string;
    which: "from" | "to";
    startPointer: Point;
    startPoint: Point;
    offset: Point;
    shiftAxis: DragAxis;
  } | null>(null);
  const lineDraggingRef = useRef<{ lineId: string; startPointer: Point; lastPointer: Point; shiftAxis: DragAxis } | null>(null);
  const pathDraggingRef = useRef<{
    lineId: string;
    pointId: string;
    offset: Point;
    startPointer: Point;
    startPoint: Point;
    shiftAxis: DragAxis;
  } | null>(null);
  const anchorDraggingRef = useRef<{
    lineId: string;
    pointId: string;
    offset: Point;
    selectedPointIds: string[];
    startPointer: Point;
    startPoint: Point;
    lastPointer: Point;
    shiftAxis: DragAxis;
  } | null>(null);
  const groupDraggingRef = useRef<{ startPointer: Point; lastPointer: Point; shiftAxis: DragAxis } | null>(null);
  const groupTransformDraggingRef = useRef<{
    target: "group" | "line";
    mode: "scale" | "rotate";
    center: Point;
    startDistance: number;
    startAngle: number;
    startScale: number;
    startScaleX: number;
    startScaleY: number;
    startRotation: number;
  } | null>(null);
  const presentationRef = useRef({ focusLineId, focusOpacity });
  useEffect(() => { presentationRef.current = { focusLineId, focusOpacity }; }, [focusLineId, focusOpacity]);
  useEffect(() => {
    if (!showAnchorPointHandles) anchorDraggingRef.current = null;
    if (!showPathPointHandles) pathDraggingRef.current = null;
  }, [showAnchorPointHandles, showPathPointHandles]);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => { motionScaleRef.current = isReducedMotion(config.animation.reducedMotion) ? 0.15 : 1; };
    update();
    media?.addEventListener("change", update);
    return () => media?.removeEventListener("change", update);
  }, [config.animation.reducedMotion]);

  // Only used for things rendered in JSX (gradient axes, handle positions) â€” resize is rare,
  // so re-rendering here is fine. The hot per-frame loop below reads viewportRef instead.
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  const resolvedLines = useMemo(() => config.lines.map((line) => resolveLineConfig(line, config.global)), [config.lines, config.global]);
  const configuredLineIds = useMemo(() => new Set(config.lines.map((line) => line.id)), [config.lines]);
  const [openingLineOrderState, setOpeningLineOrderState] = useState<{
    signature: string;
    order: Map<string, number>;
  } | null>(null);
  const [completedOpeningRun, setCompletedOpeningRun] = useState<{
    openingAnimation: boolean;
    openingLineSignature: string;
  } | null>(null);
  const anchorSignatures = useMemo(
    () => new Map(resolvedLines.map((line) => [
      line.id,
      JSON.stringify(line.anchorPoints.map((point) => [
        point.id,
        point.enabled,
        point.activation,
        point.behavior,
        point.loop,
        point.speed,
      ])),
    ])),
    [resolvedLines],
  );
  const hasTriggeredAnchors = resolvedLines.some((line) => line.anchorPoints.some((point) => point.enabled && point.activation !== "always"));
  useEffect(() => {
    if (!anchorPlaybackSeek) return;
    const line = resolvedLines.find((item) => item.id === anchorPlaybackSeek.lineId);
    if (!line || line.geometrySource !== "path") return;
    const viewport = viewportRef.current;
    if (viewport.width <= 0 || viewport.height <= 0) return;
    const sourcePoints = getCustomPathPointsInViewport(line, viewport);
    const pointStartTimes = new Map<string, number>();
    for (const sourcePoint of sourcePoints) {
      const sourcePathPoint = line.customPath.points.find((point) => point.id === sourcePoint.id);
      if (!sourcePathPoint) continue;
      const overlappedIds = line.customPath.points
        .filter((point) => point.x === sourcePathPoint.x && point.y === sourcePathPoint.y)
        .map((point) => point.id);
      const route = line.anchorPoints
        .filter((point) => point.enabled && point.endpoint === "path" && overlappedIds.includes(point.pathPointId ?? ""))
        .sort((left, right) => left.order - right.order);
      const elapsed = getAnchorSequenceStepStartTime(
        { x: sourcePoint.x * viewport.width, y: sourcePoint.y * viewport.height },
        route,
        viewport,
        Math.min(anchorPlaybackSeek.stepIndex + 1, route.length),
      );
      route.forEach((point) => pointStartTimes.set(point.pathPointId ?? "", elapsed));
    }
    anchorPlaybackSeekRef.current.set(line.id, {
      startedAt: runtimeTimeRef.current,
      pointStartTimes,
    });
  }, [anchorPlaybackSeek, resolvedLines]);
  const getAnchorPlayback = useCallback((lineId: string, motionStartedAt: number): AnchorPlaybackState => {
    const time = runtimeTimeRef.current;
    const alwaysSignature = anchorSignatures.get(lineId) ?? "";
    let state = anchorInteractionStates.current.get(lineId);
    if (!state) {
      state = {
        alwaysSignature,
        alwaysStartedAt: time,
        hovering: false,
        hasHovered: false,
        hoverStartedAt: time,
        hoverFrozenTime: 0,
        activeClickPointIds: new Set(),
        clickStartedAt: time,
      };
      anchorInteractionStates.current.set(lineId, state);
    } else if (state.alwaysSignature !== alwaysSignature) {
      state.alwaysSignature = alwaysSignature;
      state.alwaysStartedAt = time;
    }
    const alwaysTime = Math.max(0, time - Math.max(state.alwaysStartedAt, motionStartedAt));
    const seek = anchorPlaybackSeekRef.current.get(lineId);
    const alwaysTimeByPathPointId = seek
      ? new Map([...seek.pointStartTimes].map(([pathPointId, startTime]) => [
        pathPointId,
        Math.max(0, startTime + time - seek.startedAt),
      ]))
      : undefined;
    return {
      alwaysTime,
      ...(alwaysTimeByPathPointId ? { alwaysTimeByPathPointId } : {}),
      hovering: state?.hovering ?? false,
      hasHovered: state?.hasHovered ?? false,
      hoverTime: state?.hasHovered ? Math.max(0, time - state.hoverStartedAt) : 0,
      hoverFrozenTime: state?.hoverFrozenTime ?? 0,
      clicked: (state?.activeClickPointIds.size ?? 0) > 0,
      clickTime: state?.activeClickPointIds.size ? Math.max(0, time - state.clickStartedAt) : 0,
      activeClickPointIds: state?.activeClickPointIds ?? new Set(),
    };
  }, [anchorSignatures]);
  function updateLineHover(lineId: string, hovering: boolean) {
    const time = runtimeTimeRef.current;
    const state = anchorInteractionStates.current.get(lineId) ?? {
      alwaysSignature: "",
      alwaysStartedAt: time,
      hovering: false,
      hasHovered: false,
      hoverStartedAt: time,
      hoverFrozenTime: 0,
      activeClickPointIds: new Set(),
      clickStartedAt: time,
    };
    if (hovering && !state.hovering) {
      state.hovering = true;
      state.hasHovered = true;
      state.hoverStartedAt = time;
      state.hoverFrozenTime = 0;
    } else if (!hovering && state.hovering) {
      state.hovering = false;
      state.hoverFrozenTime = Math.max(0, time - state.hoverStartedAt);
    }
    anchorInteractionStates.current.set(lineId, state);
  }
  function activateLineAnchors(lineId: string) {
    const line = config.lines.find((item) => item.id === lineId);
    if (!line) return;
    const clickPoints = line.anchorPoints.filter((point) => point.enabled && point.activation === "click");
    if (clickPoints.length === 0) return;
    const state = anchorInteractionStates.current.get(lineId) ?? {
      alwaysSignature: "",
      alwaysStartedAt: runtimeTimeRef.current,
      hovering: false,
      hasHovered: false,
      hoverStartedAt: runtimeTimeRef.current,
      hoverFrozenTime: 0,
      activeClickPointIds: new Set(),
      clickStartedAt: runtimeTimeRef.current,
    };
    for (const point of clickPoints) {
      if (point.clickBehavior === "toggle" && state.activeClickPointIds.has(point.id)) {
        state.activeClickPointIds.delete(point.id);
      } else {
        state.activeClickPointIds.add(point.id);
        state.clickStartedAt = runtimeTimeRef.current;
      }
    }
    anchorInteractionStates.current.set(lineId, state);
  }
  const visibleLines = useMemo(
    () => resolvedLines.filter((l) => l.visible && l.enabled && (!soloLineId || l.id === soloLineId)).sort((a, b) => a.appearance.zIndex - b.appearance.zIndex),
    [resolvedLines, soloLineId]
  );
  const lineEnvironmentById = useMemo(
    () => new Map(visibleLines.map((line) => [
      line.id,
      resolveLineEnvironment(config.global.environment, line.environment, line.environmentEnabled),
    ])),
    [config.global.environment, visibleLines],
  );
  const textureLayersByLineId = useMemo(
    () => new Map(visibleLines.map((line) => [
      line.id,
      getTextureStrokeLayers(
        line.texture.type,
        line.texture.scale,
        line.texture.showThread,
        line.texture.silkStrands,
      ),
    ])),
    [visibleLines],
  );
  const environmentLightsByLineId = useMemo(
    () => new Map(visibleLines.flatMap((line) => {
      const environment = lineEnvironmentById.get(line.id);
      return environment ? [[line.id, getEnvironmentLights(environment)] as const] : [];
    })),
    [lineEnvironmentById, visibleLines],
  );
  const openingLineSignature = visibleLines.map((line) => line.id).join("\0");
  const openingLineOrder = openingLineOrderState?.signature === openingLineSignature
    ? openingLineOrderState.order
    : null;
  const openingRun = useMemo(
    () => ({ openingAnimation, openingLineSignature }),
    [openingAnimation, openingLineSignature],
  );
  const openingAnimationComplete = openingAnimation && completedOpeningRun === openingRun;
  useEffect(() => {
    if (!openingAnimation) return;
    const revealDuration = Math.max(0, (Math.ceil(visibleLines.length / 3) - 1) * 1_000 + 2_000);
    const timeout = window.setTimeout(() => setCompletedOpeningRun(openingRun), revealDuration);
    return () => window.clearTimeout(timeout);
  }, [openingAnimation, openingLineSignature, openingRun, visibleLines.length]);
  const shouldPauseAnimation = pauseAnimation;
  const hasAnimatedOverlays = visibleLines.some((line) =>
    line.flow.enabled && line.flow.intensity > 0 && line.flow.opacity > 0 ||
    line.texture.enabled && line.texture.type === "silk" && line.texture.intensity > 0,
  );
  useEffect(() => {
    if (!openingAnimation) return;
    const frame = window.requestAnimationFrame(() => {
      const lineIds = openingLineSignature ? openingLineSignature.split("\0") : [];
      for (let index = lineIds.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [lineIds[index], lineIds[swapIndex]] = [lineIds[swapIndex], lineIds[index]];
      }
      setOpeningLineOrderState({
        signature: openingLineSignature,
        order: new Map(lineIds.map((lineId, index) => [lineId, index])),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openingAnimation, openingLineSignature]);
  const visibleLineById = useMemo(() => new Map(visibleLines.map((line) => [line.id, line])), [visibleLines]);
  const hasTargetEffects = useMemo(
    () => visibleLines.some((line) => (config.global.magnetismEnabled && line.magnet.enabled) || line.glow.enabled),
    [config.global.magnetismEnabled, visibleLines],
  );
  const hasLineInteraction = useMemo(
    () => visibleLines.some((line) =>
      line.shape.bendable !== false &&
      line.lineInteraction.enabled &&
      line.lineInteraction.strength > 0),
    [visibleLines],
  );
  const linesWithHigherZ = useMemo(() => {
    const ids = new Set<string>();
    let highestZ = -Infinity;
    for (let index = visibleLines.length - 1; index >= 0; index--) {
      const line = visibleLines[index];
      if (highestZ > line.appearance.zIndex) ids.add(line.id);
      highestZ = Math.max(highestZ, line.appearance.zIndex);
    }
    return ids;
  }, [visibleLines]);

  useEffect(() => {
    if (environmentPathEditing) return;
    airflowDrawingRef.current = null;
    airflowDraftPathRef.current?.setAttribute("d", "");
  }, [environmentPathEditing]);

  useEffect(() => {
    for (const target of config.targets) {
      updateTargetOptions(target.id, {
        priority: target.priority,
        activations: getTargetRegisteredActivations(target),
      });
    }
  }, [config.targets]);

  useEffect(() => {
    let active = true;
    function measure() {
      if (!active) return;
      const el = svgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      surfaceRectRef.current = r;
      viewportRef.current = { width: r.width, height: r.height };
      setViewportSize({ width: r.width, height: r.height });
      onViewportChange?.({ width: r.width, height: r.height });
    }
    measure();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    if (svgRef.current) resizeObserver?.observe(svgRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      active = false;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [onViewportChange]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const rect = surfaceRectRef.current;
      if (!rect) return;
      pointerRef.current.x = e.clientX - rect.left;
      pointerRef.current.y = e.clientY - rect.top;
      pointerRef.current.active = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      pointerRef.current.lastMove = performance.now();
      scheduleFrameRef.current?.();
    }
    function onLeave() {
      pointerRef.current.active = false;
      scheduleFrameRef.current?.();
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // ---- The single animation loop. Never touches React state. ----
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let runtimeTime = runtimeTimeRef.current;
    let overlayTime = overlayTimeRef.current;

    function scheduleFrame(force = false) {
      if (
        !raf &&
        !document.hidden &&
        (force || shouldScheduleAnimationFrame(
          shouldPauseAnimation,
          animateEffectsWhenPaused,
          hasAnimatedOverlays,
          pointerRef.current.active,
          runtimeStates.current.values(),
        ))
      ) {
        raf = requestAnimationFrame(frame);
      }
    }

    function frame(now: number) {
      raf = 0;
      if (document.hidden) {
        last = 0;
        return;
      }
      scheduleFrame();
      const dt = last === 0 ? 0 : Math.min(0.05, (now - last) / 1000);
      const motionScale = motionScaleRef.current;
      last = now;
      const frameDt = dt;

      if (!shouldPauseAnimation && config.animation.playing) runtimeTime += dt * config.animation.speedMultiplier;
      if (animateEffectsWhenPaused && hasAnimatedOverlays) {
        overlayTime += dt * config.animation.speedMultiplier;
        overlayTimeRef.current = overlayTime;
      }


      const pointerLocal = surfaceRectRef.current
        ? { x: pointerRef.current.x, y: pointerRef.current.y, active: pointerRef.current.active }
        : null;

      const viewport = viewportRef.current;
      if (viewport.width === 0 || viewport.height === 0) return;

      const surfaceOffset = surfaceRectRef.current ? { x: surfaceRectRef.current.left, y: surfaceRectRef.current.top } : { x: 0, y: 0 };
      const time = runtimeTime;
      const effectTime = animateEffectsWhenPaused && hasAnimatedOverlays ? overlayTime : time;
      const targetFrameContext = hasTargetEffects ? createTargetFrameContext(config.targets) : [];

      runtimeTimeRef.current = runtimeTime;
      const activeEnvironmentLightKeys = new Set<string>();
      for (const [key, { element, light }] of environmentLightGradientRefs.current) {
        const signature = [
          light.position.x,
          light.position.y,
          light.endPosition.x,
          light.endPosition.y,
          light.speed,
          light.playback,
        ].join(",");
        let clock = environmentLightAnimationClocksRef.current.get(key);
        if (!clock || clock.signature !== signature) {
          clock = { signature, startedAt: runtimeTime };
          environmentLightAnimationClocksRef.current.set(key, clock);
        }
        activeEnvironmentLightKeys.add(key);
        const position = getEnvironmentLightPosition(light, runtimeTime - clock.startedAt);
        element.setAttribute("cx", String(position.x * viewport.width));
        element.setAttribute("cy", String(position.y * viewport.height));
        const marker = environmentLightCurrentRefs.current.get(key);
        marker?.setAttribute("cx", String(position.x * viewport.width));
        marker?.setAttribute("cy", String(position.y * viewport.height));
      }
      for (const key of environmentLightAnimationClocksRef.current.keys()) {
        if (!activeEnvironmentLightKeys.has(key)) environmentLightAnimationClocksRef.current.delete(key);
      }
      const airflowSpeed = config.global.environment.airflowSpeed;
      const dashPeriod = 0.031;
      for (const guide of airflowGuidePathRefs.current.values()) {
        guide.setAttribute("stroke-dashoffset", String(-((time * airflowSpeed * 0.08) % dashPeriod)));
      }
      runtimeStates.current.forEach((_, id) => { if (!configuredLineIds.has(id)) runtimeStates.current.delete(id); });
      lineMotionClocks.current.forEach((_, id) => { if (!configuredLineIds.has(id)) lineMotionClocks.current.delete(id); });
      anchorInteractionStates.current.forEach((_, id) => { if (!configuredLineIds.has(id)) anchorInteractionStates.current.delete(id); });

      const frameEntries = [] as Array<{
        line: (typeof config.lines)[number];
        resolvedLine: ReturnType<typeof resolveLineConfig>;
        lineEnvironment: ReturnType<typeof resolveLineEnvironment>;
        lineState: LineRuntimeState;
        anchorPlayback: AnchorPlaybackState;
        lineTime: number;
        result: ReturnType<typeof computeLine>;
      }>;

      for (const line of visibleLines) {
        let lineState = runtimeStates.current.get(line.id);
        if (!lineState) {
          lineState = createLineRuntimeState();
          runtimeStates.current.set(line.id, lineState);
        }

        const resolvedLine = line;
        const lineEnvironment = lineEnvironmentById.get(line.id);
        if (!lineEnvironment) continue;
        const delay = Math.max(0, resolvedLine.startDelay ?? 0);
        let motionClock = lineMotionClocks.current.get(line.id);
        if (!motionClock || motionClock.delay !== delay) {
          motionClock = { delay, startedAt: time };
          lineMotionClocks.current.set(line.id, motionClock);
        }
        const motionStartedAt = motionClock.startedAt + delay;
        const lineTime = Math.max(0, time - motionStartedAt);
        const anchorPlayback = getAnchorPlayback(line.id, motionStartedAt);
        const result = computeLine(resolvedLine, config, lineState, lineTime, frameDt, viewport, pointerLocal, motionScale, undefined, surfaceOffset, anchorPlayback, targetFrameContext, lineEnvironment);
        frameEntries.push({ line, resolvedLine, lineEnvironment, lineState, anchorPlayback, lineTime, result });
      }

      const interactionOffsets = hasLineInteraction
        ? computeLineInteractionOffsets(
            frameEntries.map(({ resolvedLine, result }) => ({
              id: resolvedLine.id,
              points: result.points,
              width: resolvedLine.appearance.width,
              segmentLengths: result.segmentLengths,
              config: resolvedLine.shape.bendable === false
                ? { ...resolvedLine.lineInteraction, enabled: false }
                : resolvedLine.lineInteraction,
            })),
            Math.min(viewport.width, viewport.height) || 1
          )
        : new Map<string, Point[]>();

      const renderedResults = new Map<string, ReturnType<typeof computeLine>>();

      for (const entry of frameEntries) {
        const interactionOffset = interactionOffsets.get(entry.resolvedLine.id);
        const hasInteraction = interactionOffset?.some((point) => point.x !== 0 || point.y !== 0) ?? false;
        const result = hasInteraction
          ? computeLine(entry.resolvedLine, config, entry.lineState, entry.lineTime, 0, viewport, pointerLocal, motionScale, interactionOffset, surfaceOffset, entry.anchorPlayback, targetFrameContext, entry.lineEnvironment)
          : entry.result;
        renderedResults.set(entry.resolvedLine.id, result);
      }

      const activeGlowSources = new Map(frameEntries.flatMap((entry) => {
        const result = renderedResults.get(entry.resolvedLine.id);
        return result?.glowStops.some((intensity) => intensity > 0)
          ? [[entry.line.id, result.glowStops] as const]
          : [];
      }));
      const neighborGlowTargets = activeGlowSources.size > 0
        ? computeNeighborGlowTargets(
            frameEntries.flatMap((entry) => {
              const result = renderedResults.get(entry.resolvedLine.id);
              return result
                ? [{
                  id: entry.line.id,
                  points: result.points,
                  segmentLengths: result.segmentLengths,
                  config: entry.resolvedLine.outerGlow,
                }]
                : [];
            }),
            Math.min(viewport.width, viewport.height) || 1,
            activeGlowSources,
          )
        : new Map<string, number[]>();
      const glowSmoothing = clamp01(config.cursor.smoothing);
      const glowAttack = 1 - Math.exp(-frameDt / (0.05 + (0.6 - 0.05) * glowSmoothing));
      const glowRelease = 1 - Math.exp(-frameDt / 0.18);
      const maxCombinedGlow = clamp01(config.global.glowMaxCombinedIntensity / 100);
      for (const entry of frameEntries) {
        const result = renderedResults.get(entry.resolvedLine.id);
        if (!result) continue;
        if (!entry.resolvedLine.outerGlow.enabled) {
          entry.lineState.outerGlowIntensity.fill(0);
          result.outerGlowStops.fill(0);
          result.maxOuterGlow = 0;
          continue;
        }
        const target = neighborGlowTargets.get(entry.line.id) ?? [];
        let maxOuterGlow = 0;
        for (let i = 0; i < entry.lineState.outerGlowIntensity.length; i++) {
          const current = entry.lineState.outerGlowIntensity[i] ?? 0;
          const remainingCapacity = Math.max(0, maxCombinedGlow - (result.glowStops[i] ?? 0));
          const desired = Math.min(maxCombinedGlow, target[i] ?? 0, remainingCapacity);
          const factor = desired < current ? glowRelease : glowAttack;
          const intensity = Math.min(remainingCapacity, current + (desired - current) * factor);
          entry.lineState.outerGlowIntensity[i] = intensity;
          result.outerGlowStops[i] = intensity;
          if (intensity > maxOuterGlow) maxOuterGlow = intensity;
        }
        result.maxOuterGlow = maxOuterGlow;
      }

      for (const entry of frameEntries) {
        const result = renderedResults.get(entry.resolvedLine.id);
        if (!result) continue;
        const presentation = presentationRef.current;
        const presentationOpacity = presentation.focusLineId && presentation.focusLineId !== entry.line.id ? Math.max(0, Math.min(1, presentation.focusOpacity)) : 1;
        const minDim = Math.min(viewport.width, viewport.height) || 1;
        const innerRadiusPath = innerGlowRadiusRefs.current.get(entry.line.id);
        if (innerRadiusPath) {
          const radius = entry.resolvedLine.glow.radius * minDim;
          const diameter = radius * 2;
          innerRadiusPath.setAttribute("d", result.d);
          innerRadiusPath.setAttribute("stroke-width", String(diameter));
          const insetPath = innerGlowRadiusInsetRefs.current.get(entry.line.id);
          if (insetPath) {
            insetPath.setAttribute("d", result.d);
            insetPath.setAttribute("stroke-width", String(Math.max(0, diameter - 2)));
          }
        }

        const outerRadiusPath = outerGlowRadiusRefs.current.get(entry.line.id);
        if (outerRadiusPath) {
          const radius = entry.resolvedLine.outerGlow.radius * minDim;
          const diameter = radius * 2;
          outerRadiusPath.setAttribute("d", result.d);
          outerRadiusPath.setAttribute("stroke-width", String(diameter));
          const insetPath = outerGlowRadiusInsetRefs.current.get(entry.line.id);
          if (insetPath) {
            insetPath.setAttribute("d", result.d);
            insetPath.setAttribute("stroke-width", String(Math.max(0, diameter - 2)));
          }
        }

        pathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        openingElectricPathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        const colorStyle = entry.resolvedLine.appearance.colorStyle;
        if (colorStyle?.type === "rainbow" && entry.resolvedLine.geometrySource === "path" && result.segmentLengths.length > 1) {
          const pathType = entry.resolvedLine.shape.type === "pixel"
            ? "pixel"
            : entry.resolvedLine.shape.type === "sharp" || entry.resolvedLine.shape.type === "straight"
              ? "polyline"
              : "smooth";
          const segmentPaths = pathSegmentsFromResult(result.points, result.segmentLengths, pathType, Math.max(1, entry.resolvedLine.shape.pixelStep));
          segmentPaths.forEach((segmentPath, index) => {
            document.getElementById(`${instancePrefix}-rainbow-segment-${index}-${entry.line.id}`)
              ?.setAttribute("d", segmentPath);
          });
        }
        movePathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        triggerPathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        const lineEnvironment = entry.lineEnvironment;
        for (const light of environmentLightsByLineId.get(entry.line.id) ?? []) {
          environmentLightPathRefs.current.get(`${entry.line.id}:${light.id}`)?.setAttribute("d", result.d);
        }
        const colorGradient = colorGradientRefs.current.get(entry.line.id);
        const firstPoint = result.points[0];
        const lastPoint = result.points[result.points.length - 1];
        if (colorGradient && firstPoint && lastPoint) {
          if (colorStyle?.type === "radial") {
            colorGradient.setAttribute("cx", String((firstPoint.x + lastPoint.x) / 2));
            colorGradient.setAttribute("cy", String((firstPoint.y + lastPoint.y) / 2));
            colorGradient.setAttribute("r", String(Math.max(1, Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y) / 2)));
          } else {
            colorGradient.setAttribute("x1", String(firstPoint.x));
            colorGradient.setAttribute("y1", String(firstPoint.y));
            colorGradient.setAttribute("x2", String(lastPoint.x));
            colorGradient.setAttribute("y2", String(lastPoint.y));
          }
        }
        if (colorStyle?.type === "random") {
          const animatedColor = getRandomLineColor(entry.resolvedLine, time);
          const hidesBaseStroke = entry.resolvedLine.texture.enabled &&
            (entry.resolvedLine.texture.type === "silk" || entry.resolvedLine.texture.type === "metal");
          pathRefs.current.get(entry.line.id)?.setAttribute("stroke", hidesBaseStroke ? "transparent" : animatedColor);
          for (const layer of textureLayersByLineId.get(entry.line.id) ?? []) {
            if (layer.colorTone) continue;
            texturePathRefs.current.get(`${entry.line.id}:${layer.id}`)?.setAttribute("stroke", animatedColor);
          }
        }
        const silkAirflow = entry.resolvedLine.texture.enabled &&
          entry.resolvedLine.texture.type === "silk" &&
          lineEnvironment.enabled &&
          lineEnvironment.airflowEnabled &&
          (lineEnvironment.airflowPaths ?? [lineEnvironment.airflowPath]).some((path) => path.length >= 2)
          ? Math.min(1.5, Math.max(0, lineEnvironment.airflowStrength))
          : 0;
        const textureLayers = textureLayersByLineId.get(entry.line.id) ?? [];
        const metalChainPaths = entry.resolvedLine.texture.enabled && entry.resolvedLine.texture.type === "metal"
          ? getMetalChainPaths(
              result.points,
              entry.resolvedLine.appearance.width,
              result.segmentLengths,
              entry.resolvedLine.texture.scale,
            )
          : null;
        for (const layer of textureLayers) {
          const texturePath = texturePathRefs.current.get(`${entry.line.id}:${layer.id}`);
          const textureD = layer.chainPart && metalChainPaths
            ? metalChainPaths[layer.chainPart]
            : layer.offset === undefined && layer.offsetWave === undefined
            ? result.d
            : offsetTexturePath(
                result.points,
                entry.resolvedLine.appearance.width,
                layer.offset,
                result.segmentLengths,
                (layer.offsetWave ?? 0) * (layer.offsetWaveFollowsAirflow ? silkAirflow : 1),
                (layer.offsetPhase ?? 0) + effectTime * (layer.motionSpeed ?? 0),
                layer.offsetWaveFrequency ?? 1,
              );
          texturePath?.setAttribute("d", textureD);
          if (entry.resolvedLine.texture.type === "silk" && lineEnvironment.lightEnabled) {
            for (const light of environmentLightsByLineId.get(entry.line.id) ?? []) {
              environmentSilkLightPathRefs.current.get(`${entry.line.id}:${light.id}:${layer.id}`)?.setAttribute("d", textureD);
            }
          }
          texturePath?.setAttribute("stroke-dashoffset", String(-layer.dashOffset));
        }

        const flowLayers = flowLayerRefs.current.get(entry.line.id);
        if (entry.resolvedLine.flow.enabled && flowLayers) {
          const textureEnabled = entry.resolvedLine.texture.enabled;
          const textureType = entry.resolvedLine.texture.type;
          const centerlinePulse = openingAnimation && entry.resolvedLine.flow.effectType === "energy-pulse";
          const heartbeatSinglePath = centerlinePulse &&
            entry.resolvedLine.flow.pulseRhythm === "heartbeat" &&
            entry.resolvedLine.flow.placement === "along" &&
            result.segmentLengths.length === 1;
          const flowPaths = textureEnabled && !centerlinePulse
            ? getMaterialFlowPaths(
                textureType,
                result.points,
                entry.resolvedLine.appearance.width,
                result.segmentLengths,
                textureLayers,
                silkAirflow,
                time,
                entry.resolvedLine.texture.scale,
              )
            : [];
          const flowPoints = flowPaths.flat();
          const geometry = heartbeatSinglePath
              ? null
              : textureEnabled && !centerlinePulse
                ? createFlowGeometry(flowPoints, flowPaths.map((path) => path.length))
                : createFlowGeometry(result.points, result.segmentLengths);
          const flowConfig = textureEnabled &&
            (textureType === "silk" || textureType === "rope") &&
            entry.resolvedLine.flow.effectType === "fiber-optic"
            ? { ...entry.resolvedLine.flow, strandCount: 1 }
            : entry.resolvedLine.flow;
          const flowTime = openingAnimation
            ? time
            : animateEffectsWhenPaused && hasAnimatedOverlays
              ? effectTime
              : entry.lineTime;
          const flowWidth = entry.resolvedLine.appearance.width * (
              textureEnabled ? getMaterialFlowWidthScale(textureType) : 1
          );
          const flowFrames = geometry
              ? renderFlowEffect(
                  geometry,
                  geometry.pathData,
                  flowConfig,
                  flowTime,
                  flowWidth,
                  motionScale < 0.2,
                  entry.resolvedLine.appearance.width,
                )
              : renderHeartbeatPulsePathEffect(
                  result.d,
                  flowConfig,
                  flowTime,
                  flowWidth,
                  motionScale < 0.2,
                );
          for (let index = 0; index < FLOW_LAYER_COUNT; index++) {
            const element = flowLayers[index];
            const flowFrame = flowFrames[index];
            if (!element) continue;
            if (!flowFrame) {
              if (element.getAttribute("d") !== "") element.setAttribute("d", "");
              if (element.getAttribute("opacity") !== "0") element.setAttribute("opacity", "0");
              continue;
            }
            element.setAttribute("d", flowFrame.pathData);
            element.setAttribute("stroke", flowFrame.color);
            element.setAttribute("stroke-width", String(flowFrame.width));
            element.setAttribute("stroke-opacity", String(flowFrame.opacity * clamp01(presentationOpacity)));
            element.setAttribute("fill", flowFrame.fill ? flowFrame.color : "none");
            element.setAttribute("fill-opacity", String(flowFrame.opacity * clamp01(presentationOpacity)));
            element.setAttribute("stroke-linecap", flowFrame.lineCap ?? "round");
            element.setAttribute("stroke-dasharray", flowFrame.dashArray ?? "none");
            element.setAttribute("stroke-dashoffset", String(flowFrame.dashOffset ?? 0));
            if (flowFrame.blur) element.setAttribute("filter", `blur(${flowFrame.blur}px)`);
            else element.removeAttribute("filter");
            element.setAttribute("opacity", "1");
          }
        }

        const glowEl = glowPathRefs.current.get(entry.line.id);
        if (glowEl) {
          glowEl.setAttribute("d", result.d);
          glowEl.setAttribute("opacity", String(clamp01(presentationOpacity)));
        }

        const outerGlowEl = outerGlowPathRefs.current.get(entry.line.id);
        if (outerGlowEl) {
          outerGlowEl.setAttribute("d", result.d);
          outerGlowEl.setAttribute("opacity", String(clamp01(presentationOpacity)));
        }
        const outerStops = outerGradientStopRefs.current.get(entry.line.id);
        if (outerStops) {
          for (let i = 0; i < outerStops.length; i++) {
            const sampleIdx = Math.round((i / (outerStops.length - 1)) * (result.outerGlowStops.length - 1));
            outerStops[i].setAttribute("stop-color", getGlowColorAtPosition(entry.resolvedLine.outerGlow, entry.line.id, time, i / (outerStops.length - 1)));
            outerStops[i].setAttribute("stop-opacity", String(clamp01(result.outerGlowStops[sampleIdx] ?? 0)));
          }
        }
        const stops = gradientStopRefs.current.get(entry.line.id);
        if (stops) {
          const n = stops.length;
          for (let i = 0; i < n; i++) {
            const sampleIdx = Math.round((i / (n - 1)) * (result.glowStops.length - 1));
            stops[i].setAttribute("stop-color", getGlowColorAtPosition(entry.resolvedLine.glow, entry.line.id, time, i / (n - 1)));
            stops[i].setAttribute("stop-opacity", String(clamp01(result.glowStops[sampleIdx] ?? 0)));
          }
        }
      }
      const occlusionLines = visibleLines.flatMap((line) => {
        const result = renderedResults.get(line.id);
        return result ? [{ id: line.id, width: line.appearance.width, occlusionEnabled: line.occlusion.enabled, points: result.points }] : [];
      });
      const occlusionPlan = new Map(createOcclusionMaskPlan(occlusionLines).map((item) => [item.lineId, item.occluderIds]));
      const activeOcclusionPairs = new Set<string>();
      const activeOcclusionLines = new Set<string>();
      for (const [lineId, occluderIds] of occlusionPlan) {
        const line = visibleLineById.get(lineId);
        const mask = occlusionMaskRefs.current.get(lineId);
        const lowerResult = renderedResults.get(lineId);
        if (!line || !mask || !lowerResult) continue;
        if (!interactive) {
          let left = Infinity;
          let top = Infinity;
          let right = -Infinity;
          let bottom = -Infinity;
          for (const point of lowerResult.points) {
            left = Math.min(left, point.x);
            top = Math.min(top, point.y);
            right = Math.max(right, point.x);
            bottom = Math.max(bottom, point.y);
          }
          const padding = 64 +
            (line.outerGlow.enabled ? line.appearance.width * 6 : line.glow.enabled ? line.appearance.width * 3 : 0) +
            (line.flow.enabled ? line.appearance.width * line.flow.width * 2 : 0);
          const leftEdge = Math.max(0, Math.floor((left - padding) / 32) * 32);
          const topEdge = Math.max(0, Math.floor((top - padding) / 32) * 32);
          const rightEdge = Math.min(viewport.width, Math.ceil((right + padding) / 32) * 32);
          const bottomEdge = Math.min(viewport.height, Math.ceil((bottom + padding) / 32) * 32);
          const bounds = {
            x: String(leftEdge),
            y: String(topEdge),
            width: String(Math.max(1, rightEdge - leftEdge)),
            height: String(Math.max(1, bottomEdge - topEdge)),
          };
          for (const [attribute, value] of Object.entries(bounds)) {
            if (mask.getAttribute(attribute) !== value) mask.setAttribute(attribute, value);
          }
        }
        for (const higherLineId of occluderIds) {
          const higherLine = visibleLineById.get(higherLineId);
          const higherResult = renderedResults.get(higherLineId);
          if (!higherLine || !higherResult) continue;
          const pairId = `${lineId}:${higherLineId}`;
          activeOcclusionPairs.add(pairId);
          let maskPath = occlusionMaskPathRefs.current.get(pairId);
          if (!maskPath) {
            maskPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            maskPath.setAttribute("fill", "none");
            maskPath.setAttribute("stroke", "black");
            maskPath.setAttribute("stroke-linecap", "round");
            mask.appendChild(maskPath);
            occlusionMaskPathRefs.current.set(pairId, maskPath);
          } else if (maskPath.parentNode !== mask) {
            mask.appendChild(maskPath);
          }
          maskPath.setAttribute("d", higherResult.d);
          maskPath.setAttribute("stroke-width", String(higherLine.appearance.width + line.appearance.width + line.occlusion.gapWidth));
          activeOcclusionLines.add(lineId);
        }
      }
      for (const line of visibleLines) {
        const group = lineGroupRefs.current.get(line.id);
        if (!group || !line.occlusion.enabled || !linesWithHigherZ.has(line.id)) continue;
        const maskId = `url(#${instancePrefix}-magnetic-occlusion-${line.id})`;
        if (activeOcclusionLines.has(line.id)) {
          if (group.getAttribute("mask") !== maskId) group.setAttribute("mask", maskId);
        } else if (group.hasAttribute("mask")) {
          group.removeAttribute("mask");
        }
      }
      for (const [pairId, maskPath] of occlusionMaskPathRefs.current) {
        if (activeOcclusionPairs.has(pairId)) continue;
        maskPath.remove();
        occlusionMaskPathRefs.current.delete(pairId);
      }
    }

    scheduleFrameRef.current = () => scheduleFrame();

    function onVisibilityChange() {
      last = 0;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else {
        scheduleFrame(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    scheduleFrame(true);
    return () => {
      scheduleFrameRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      cancelAnimationFrame(raf);
    };
  }, [animateEffectsWhenPaused, config, configuredLineIds, environmentLightsByLineId, getAnchorPlayback, hasAnimatedOverlays, hasLineInteraction, hasTargetEffects, instancePrefix, interactive, lineEnvironmentById, linesWithHigherZ, openingAnimation, selectedLineId, shouldPauseAnimation, showGlowRadiusPreview, soloLineId, textureLayersByLineId, viewportSize.height, viewportSize.width, visibleLineById, visibleLines]);



  function pointerToNorm(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }

  const W = viewportSize.width || 1;
  const H = viewportSize.height || 1;
  const showEndpointHandles = debug?.showEndpoints ?? true;
  const selectedGroupPoints = resolvedLines
    .filter((line) => selectedGroupLineIds.includes(line.id) && line.visible && line.enabled)
    .flatMap((line) => line.geometrySource === "path"
      ? getCustomPathPointsInViewport(line, { width: W, height: H })
      : [line.from, line.to]);
  const selectedGroupBounds = selectedGroupPoints.length > 0
    ? selectedGroupPoints.reduce((bounds, point) => ({
        left: Math.min(bounds.left, point.x),
        top: Math.min(bounds.top, point.y),
        right: Math.max(bounds.right, point.x),
        bottom: Math.max(bounds.bottom, point.y),
      }), { left: 1, top: 1, right: 0, bottom: 0 })
    : null;
  const selectedGroupConfig = config.groups.find((group) => group.lineIds.some((id) => selectedGroupLineIds.includes(id)));
  const selectedGroupCenter = selectedGroupBounds
    ? { x: (selectedGroupBounds.left + selectedGroupBounds.right) / 2, y: (selectedGroupBounds.top + selectedGroupBounds.bottom) / 2 }
    : null;
  const rotationHandleY = selectedGroupBounds ? Math.max(8, selectedGroupBounds.top * H - 25) : 0;
  const resizeHandleX = selectedGroupBounds ? Math.min(W - 8, selectedGroupBounds.right * W + 8) : 0;
  const resizeHandleY = selectedGroupBounds ? Math.min(H - 8, selectedGroupBounds.bottom * H + 8) : 0;
  const selectedLine = !selectedGroupLineIds.length ? resolvedLines.find((line) => line.id === selectedLineId) : undefined;
  const environmentLights = visibleLines.flatMap((line) => {
    const environment = lineEnvironmentById.get(line.id);
    if (!environment?.enabled || !environment.lightEnabled) return [];
    return getEnvironmentLights(environment).map((light) => ({
      lineId: line.id,
      key: `${line.id}:${light.id}`,
      light,
    }));
  });
  const uniqueEnvironmentLights = Array.from(new Map(environmentLights.map(({ key, light }) => [
    JSON.stringify([light.id, light.color, light.position, light.endPosition, light.intensity, light.radius, light.speed, light.playback]),
    { key, light },
  ])).values());
  const selectedLineEnvironment = selectedLine ? lineEnvironmentById.get(selectedLine.id) : undefined;
  const editableLightLineId = selectedLine?.environmentEnabled && selectedLine.environment.lightMode === "individual"
    ? selectedLine.id
    : undefined;
  const editableLightEnvironment = editableLightLineId
    ? selectedLineEnvironment
    : config.global.environment;
  const selectedLineUsesGlobalLight = selectedLine?.environmentEnabled && selectedLine.environment.lightMode === "global";
  const showEditableLight = interactive && showEnvironmentControls && (selectedLine
    ? editableLightLineId
      ? selectedLineEnvironment?.lightEnabled
      : selectedLineUsesGlobalLight && config.global.environment.enabled && config.global.environment.lightEnabled
    : config.global.environment.enabled && config.global.environment.lightEnabled);
  const airflowGuides = environmentPaths ?? (environmentPath ? [environmentPath] : selectedLine
    ? resolveLineAirflowPaths(config.global.environment, selectedLine.environment, selectedLine.environmentEnabled)
    : config.global.environment.enabled && config.global.environment.airflowEnabled
      ? config.global.environment.airflowPaths ?? [config.global.environment.airflowPath]
      : []);
  const airflowGuideRadii = environmentPathRadii ?? airflowGuides.map((_, index) =>
    selectedLineEnvironment?.airflowRadii?.[index] ?? selectedLineEnvironment?.airflowRadius ??
    config.global.environment.airflowRadii?.[index] ?? config.global.environment.airflowRadius);
  const showAirflowGuide = showEnvironmentControls && (environmentPathEditing || (selectedLine
    ? selectedLineEnvironment?.airflowEnabled
    : config.global.environment.enabled && config.global.environment.airflowEnabled));
  const editableLights = editableEnvironmentLights.length
    ? editableEnvironmentLights
    : showEditableLight && editableLightEnvironment
      ? getEnvironmentLights(editableLightEnvironment)
      : [];
  const editableLightMarkerKeys = showEditableLight
    ? editableLights.map((light) => `light:${editableLightLineId ?? "global"}:${light.id}`).join("\0")
    : "";
  const selectedLinePoints = selectedLine
    ? selectedLine.geometrySource === "path"
      ? getCustomPathPointsInViewport(selectedLine, { width: W, height: H })
      : [selectedLine.from, selectedLine.to]
    : [];
  const selectedLineBounds = selectedLinePoints.length > 0
    ? selectedLinePoints.reduce((bounds, point) => ({
        left: Math.min(bounds.left, point.x),
        top: Math.min(bounds.top, point.y),
        right: Math.max(bounds.right, point.x),
        bottom: Math.max(bounds.bottom, point.y),
      }), { left: 1, top: 1, right: 0, bottom: 0 })
    : null;
  const selectedLineCenter = selectedLineBounds
    ? { x: (selectedLineBounds.left + selectedLineBounds.right) / 2, y: (selectedLineBounds.top + selectedLineBounds.bottom) / 2 }
    : null;
  const lineRotationHandleY = selectedLineBounds ? Math.max(8, selectedLineBounds.top * H - 25) : 0;
  const lineResizeHandleX = selectedLineBounds ? Math.min(W - 8, selectedLineBounds.right * W + 8) : 0;
  const lineResizeHandleY = selectedLineBounds ? Math.min(H - 8, selectedLineBounds.bottom * H + 8) : 0;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const lightsByKey = new Map<string, EnvironmentLightConfig>();
    for (const { key, light } of environmentLights) lightsByKey.set(`light:${key}`, light);
    for (const { key, light } of uniqueEnvironmentLights) lightsByKey.set(`spill:${key}`, light);

    environmentLightGradientRefs.current.clear();
    svg.querySelectorAll<SVGGradientElement>("[data-environment-light-gradient]").forEach((element) => {
      const key = element.dataset.environmentLightGradient;
      const light = key ? lightsByKey.get(key) : undefined;
      if (key && light) environmentLightGradientRefs.current.set(key, { element, light });
    });

    environmentLightCurrentRefs.current.clear();
    svg.querySelectorAll<SVGCircleElement>("[data-environment-light-marker]").forEach((element) => {
      const key = element.dataset.environmentLightMarker;
      if (key) environmentLightCurrentRefs.current.set(key, element);
    });
  }, [environmentLights, uniqueEnvironmentLights, showEditableLight, editableLightMarkerKeys]);

  return (
    <svg
      ref={svgRef}
      className={className}
      data-opening-ready={openingAnimation ? (openingLineOrder ? "true" : "false") : undefined}
      data-opening-complete={openingAnimation && openingAnimationComplete ? "true" : undefined}
      role="presentation"
      aria-hidden="true"
      focusable="false"
      style={{
        position: interactive ? "absolute" : "fixed",
        inset: 0,
        display: "block",
        width: interactive ? "100%" : "100vw",
        height: interactive ? "100%" : "100dvh",
        minWidth: 0,
        minHeight: 0,
        maxWidth: "100%",
        maxHeight: "100%",
        pointerEvents: interactive || hasTriggeredAnchors ? "auto" : "none",
        touchAction: interactive ? "none" : "auto",
        cursor: environmentPathEditing ? "crosshair" : undefined,
        transform: !interactive && style?.position !== "absolute" ? "translateZ(0)" : undefined,
        ...style,
      }}
      onPointerDownCapture={(e) => {
        if (interactive && environmentPathEditing) {
          e.preventDefault();
          e.stopPropagation();
          const rawPoint = pointerToNorm(e);
          const point = { x: clamp01(rawPoint.x), y: clamp01(rawPoint.y) };
          airflowDrawingRef.current = { pointerId: e.pointerId, lineId: environmentPathLineId ?? undefined, pathIndex: environmentPathIndex, points: [point], lastPoint: point };
          e.currentTarget.setPointerCapture(e.pointerId);
          airflowDraftPathRef.current?.setAttribute("d", `M ${point.x * W} ${point.y * H}`);
          return;
        }
        if (interactive) e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!interactive) return;
        const lightDrag = environmentLightDraggingRef.current;
        if (lightDrag && lightDrag.pointerId === e.pointerId) {
          const point = pointerToNorm(e);
          onEnvironmentLightPositionChange?.(
            { x: clamp01(point.x), y: clamp01(point.y) },
            lightDrag.lineId,
            lightDrag.lightId,
            lightDrag.endpoint,
          );
          return;
        }
        const airflowDrawing = airflowDrawingRef.current;
        if (airflowDrawing && airflowDrawing.pointerId === e.pointerId) {
          const rawPoint = pointerToNorm(e);
          const point = { x: clamp01(rawPoint.x), y: clamp01(rawPoint.y) };
          const moved = Math.hypot((point.x - airflowDrawing.lastPoint.x) * W, (point.y - airflowDrawing.lastPoint.y) * H);
          if (moved >= 2) {
            const steps = Math.max(1, Math.ceil(moved / 4));
            for (let step = 1; step <= steps; step++) {
              const t = step / steps;
              const sample = {
                x: airflowDrawing.lastPoint.x + (point.x - airflowDrawing.lastPoint.x) * t,
                y: airflowDrawing.lastPoint.y + (point.y - airflowDrawing.lastPoint.y) * t,
              };
              if (airflowDrawing.points.length < 96) airflowDrawing.points.push(sample);
              else airflowDrawing.points[airflowDrawing.points.length - 1] = sample;
            }
            airflowDrawing.lastPoint = point;
            airflowDraftPathRef.current?.setAttribute("d", pointsToSmoothPath(airflowDrawing.points.map((sample) => ({ x: sample.x * W, y: sample.y * H }))));
          }
          return;
        }
        if (groupTransformDraggingRef.current) {
          const drag = groupTransformDraggingRef.current;
          const pointer = pointerToNorm(e);
          if (drag.mode === "scale") {
            const distance = Math.hypot(pointer.x - drag.center.x, pointer.y - drag.center.y);
            const scale = Math.min(5, Math.max(0.1, drag.startScale * distance / Math.max(0.001, drag.startDistance)));
            if (drag.target === "group") onGroupTransform?.(scale, drag.startRotation, drag.center);
            else {
              const scaleFactor = Math.max(0.1, Math.min(5, distance / Math.max(0.001, drag.startDistance)));
              onLineTransform?.(drag.startScaleX * scaleFactor, drag.startScaleY * scaleFactor, drag.startRotation, drag.center);
            }
          } else {
            const angle = Math.atan2(pointer.y - drag.center.y, pointer.x - drag.center.x) * 180 / Math.PI;
            if (drag.target === "group") onGroupTransform?.(drag.startScale, drag.startRotation + angle - drag.startAngle, drag.center);
            else onLineTransform?.(drag.startScaleX, drag.startScaleY, drag.startRotation + angle - drag.startAngle, drag.center);
          }
          return;
        }
        if (groupDraggingRef.current) {
          const pointer = pointerToNorm(e);
          const drag = groupDraggingRef.current;
          const result = getAxisLockedDelta(pointer, drag.lastPointer, drag.startPointer, e.shiftKey, drag.shiftAxis, W, H);
          drag.lastPointer = pointer;
          drag.shiftAxis = result.shiftAxis;
          onDragGroup?.(result.delta);
          return;
        }
        if (lineDraggingRef.current) {
          const pointer = pointerToNorm(e);
          const drag = lineDraggingRef.current;
          const result = getAxisLockedDelta(pointer, drag.lastPointer, drag.startPointer, e.shiftKey, drag.shiftAxis, W, H);
          drag.lastPointer = pointer;
          drag.shiftAxis = result.shiftAxis;
          onDragLine?.(drag.lineId, result.delta);
          return;
        }
        const anchorDrag = anchorDraggingRef.current;
        if (anchorDrag) {
          if (!showAnchorPointHandles) {
            anchorDraggingRef.current = null;
            return;
          }
          const pointer = pointerToNorm(e);
          const result = getAxisLockedDelta(pointer, anchorDrag.lastPointer, anchorDrag.startPointer, e.shiftKey, anchorDrag.shiftAxis, W, H);
          anchorDrag.lastPointer = pointer;
          anchorDrag.shiftAxis = result.shiftAxis;
          if (anchorDrag.selectedPointIds.length > 1) {
            onDragSelectedAnchorPoints?.(anchorDrag.lineId, anchorDrag.selectedPointIds, result.delta);
          } else {
            const dragged = getDraggedPoint(
              pointer,
              anchorDrag.startPointer,
              anchorDrag.startPoint,
              anchorDrag.offset,
              e.shiftKey,
              anchorDrag.shiftAxis,
              W,
              H,
            );
            anchorDrag.shiftAxis = dragged.shiftAxis;
            onDragAnchorPoint?.(anchorDrag.lineId, anchorDrag.pointId, { x: clamp01(dragged.point.x), y: clamp01(dragged.point.y) });
          }
          return;
        }
        const pointDrag = pathDraggingRef.current;
        if (pointDrag) {
          if (!showPathPointHandles) {
            pathDraggingRef.current = null;
            return;
          }
          const pointer = pointerToNorm(e);
          const dragged = getDraggedPoint(
            pointer,
            pointDrag.startPointer,
            pointDrag.startPoint,
            pointDrag.offset,
            e.shiftKey,
            pointDrag.shiftAxis,
            W,
            H,
          );
          pointDrag.shiftAxis = dragged.shiftAxis;
          onDragPathPoint?.(pointDrag.lineId, pointDrag.pointId, { x: clamp01(dragged.point.x), y: clamp01(dragged.point.y) });
          return;
        }
        if (!draggingRef.current) return;
        const drag = draggingRef.current;
        const pointer = pointerToNorm(e);
        const dragged = getDraggedPoint(pointer, drag.startPointer, drag.startPoint, drag.offset, e.shiftKey, drag.shiftAxis, W, H);
        drag.shiftAxis = dragged.shiftAxis;
        onDragEndpoint?.(drag.lineId, drag.which, { x: clamp01(dragged.point.x), y: clamp01(dragged.point.y) });
      }}
      onPointerUpCapture={() => {
        if (environmentLightDraggingRef.current) {
          environmentLightDraggingRef.current = null;
          onEnvironmentLightDragEnd?.();
          return;
        }
        const airflowDrawing = airflowDrawingRef.current;
        if (airflowDrawing) {
          airflowDrawingRef.current = null;
          airflowDraftPathRef.current?.setAttribute("d", "");
          if (airflowDrawing.points.length >= 2) onEnvironmentPathCommit?.(airflowDrawing.points, airflowDrawing.lineId, airflowDrawing.pathIndex);
          return;
        }
        const pathDrag = pathDraggingRef.current;
        if (pathDrag && showPathPointHandles) {
          const line = resolvedLines.find((item) => item.id === pathDrag.lineId);
          const draggedPoint = line && getCustomPathPointsInViewport(line, { width: W, height: H }).find((point) => point.id === pathDrag.pointId);
          if (line && draggedPoint) {
            const nearbyPoint = getCustomPathPointsInViewport(line, { width: W, height: H })
              .filter((point) => point.id !== pathDrag.pointId)
              .map((point) => ({
                point,
                distance: Math.hypot((point.x - draggedPoint.x) * W, (point.y - draggedPoint.y) * H),
              }))
              .filter(({ distance }) => distance <= 12)
              .sort((left, right) => left.distance - right.distance)[0]?.point;
            if (nearbyPoint) onPathPointDragEnd?.(pathDrag.lineId, pathDrag.pointId, nearbyPoint.id);
          }
        }
        if (draggingRef.current || lineDraggingRef.current || pathDraggingRef.current || anchorDraggingRef.current || groupDraggingRef.current || groupTransformDraggingRef.current) {
          draggingRef.current = null;
          lineDraggingRef.current = null;
          pathDraggingRef.current = null;
          anchorDraggingRef.current = null;
          groupDraggingRef.current = null;
          groupTransformDraggingRef.current = null;
          onDragCommit?.();
        }
      }}
      onPointerCancelCapture={() => {
        if (environmentLightDraggingRef.current) {
          environmentLightDraggingRef.current = null;
          onEnvironmentLightDragEnd?.();
          return;
        }
        if (airflowDrawingRef.current) {
          airflowDrawingRef.current = null;
          airflowDraftPathRef.current?.setAttribute("d", "");
          return;
        }
        if (draggingRef.current || lineDraggingRef.current || pathDraggingRef.current || anchorDraggingRef.current || groupDraggingRef.current || groupTransformDraggingRef.current) {
          draggingRef.current = null;
          lineDraggingRef.current = null;
          pathDraggingRef.current = null;
          anchorDraggingRef.current = null;
          groupDraggingRef.current = null;
          groupTransformDraggingRef.current = null;
          onDragCommit?.();
        }
      }}
    >
      <defs>
        {environmentLights.map(({ key, light }) => (
          <radialGradient
            key={`environment-light-${key}`}
            data-environment-light-gradient={`light:${key}`}
            id={environmentLightSvgId(instancePrefix, "light", key)}
            gradientUnits="userSpaceOnUse"
            cx={light.position.x * W}
            cy={light.position.y * H}
            r={Math.max(1, light.radius * Math.min(W, H))}
          >
            <stop offset="0%" stopColor={light.color} stopOpacity="0.95" />
            <stop offset="38%" stopColor={light.color} stopOpacity="0.58" />
            <stop offset="100%" stopColor={light.color} stopOpacity="0" />
          </radialGradient>
        ))}
        {uniqueEnvironmentLights.map(({ key, light }) => (
          <radialGradient
            key={`environment-spill-${key}`}
            data-environment-light-gradient={`spill:${key}`}
            id={environmentLightSvgId(instancePrefix, "spill", key)}
            gradientUnits="userSpaceOnUse"
            cx={light.position.x * W}
            cy={light.position.y * H}
            r={Math.max(1, light.radius * Math.min(W, H) * 1.5)}
          >
            <stop offset="0%" stopColor={light.color} stopOpacity={Math.min(0.42, light.intensity * 0.48)} />
            <stop offset="34%" stopColor={light.color} stopOpacity={Math.min(0.2, light.intensity * 0.22)} />
            <stop offset="100%" stopColor={light.color} stopOpacity="0" />
          </radialGradient>
        ))}
        <marker
          id={`${instancePrefix}-airflow-arrow`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#b8e4ff" />
        </marker>
        {(showGlowRadiusPreview.inner || showGlowRadiusPreview.outer) && interactive && visibleLines.map((line) => (
          <React.Fragment key={`radius-mask-${line.id}`}>
            <mask
              id={`${instancePrefix}-inner-radius-${line.id}`}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={W}
              height={H}
            >
              <path
                ref={(el) => {
                  if (el) innerGlowRadiusRefs.current.set(line.id, el);
                  else innerGlowRadiusRefs.current.delete(line.id);
                }}
                fill="none"
                stroke="white"
                strokeWidth={0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                ref={(el) => {
                  if (el) innerGlowRadiusInsetRefs.current.set(line.id, el);
                  else innerGlowRadiusInsetRefs.current.delete(line.id);
                }}
                fill="none"
                stroke="black"
                strokeWidth={0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
            <mask
              id={`${instancePrefix}-outer-radius-${line.id}`}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={W}
              height={H}
            >
              <path
                ref={(el) => {
                  if (el) outerGlowRadiusRefs.current.set(line.id, el);
                  else outerGlowRadiusRefs.current.delete(line.id);
                }}
                fill="none"
                stroke="white"
                strokeWidth={0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                ref={(el) => {
                  if (el) outerGlowRadiusInsetRefs.current.set(line.id, el);
                  else outerGlowRadiusInsetRefs.current.delete(line.id);
                }}
                fill="none"
                stroke="black"
                strokeWidth={0}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </mask>
          </React.Fragment>
        ))}
        {resolvedLines.map((line) => {
          const colorStyle = line.appearance.colorStyle;
          if (!colorStyle || colorStyle.type === "solid" || colorStyle.type === "random") return null;
          const stops = getAppearanceStops(line);
          const x1 = line.from.x * W;
          const y1 = line.from.y * H;
          const x2 = line.to.x * W;
          const y2 = line.to.y * H;
          const id = `${instancePrefix}-magnetic-line-color-${line.id}`;
          if (colorStyle.type === "radial") {
            return (
              <radialGradient ref={(el) => { if (el) colorGradientRefs.current.set(line.id, el); }} key={id} id={id} gradientUnits="userSpaceOnUse" cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={Math.max(1, Math.hypot(x2 - x1, y2 - y1) / 2)}>
                {stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color} />)}
              </radialGradient>
            );
          }
          return (
            <linearGradient ref={(el) => { if (el) colorGradientRefs.current.set(line.id, el); }} key={id} id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
              {stops.map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color} />)}
            </linearGradient>
          );
        })}
        {resolvedLines.map((line) =>
          line.texture.enabled && line.texture.type === "grain" ? (
            <filter
              key={`tex-${line.id}`}
              id={`${instancePrefix}-magnetic-texture-${line.id}`}
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={Math.min(1.2, Math.max(0.08, 0.32 / line.texture.scale))}
                numOctaves={3}
                stitchTiles="stitch"
                seed={7}
                result="grainNoise"
              />
              <feColorMatrix
                in="grainNoise"
                type="matrix"
                values="0 0 0 0 0
                  0 0 0 0 0
                  0 0 0 0 0
                  1 0 0 0 0"
                result="grain"
              />
              <feComposite in="grain" in2="SourceAlpha" operator="in" result="maskedGrain" />
              <feBlend in="SourceGraphic" in2="maskedGrain" mode="multiply" />
            </filter>
          ) : null
        )}
        {resolvedLines.map((line) => line.glow.enabled && line.glow.intensity > 0 ? (
          <linearGradient
            key={`grad-${line.id}`}
            id={`${instancePrefix}-magnetic-glow-${line.id}`}
            gradientUnits="userSpaceOnUse"
            x1={line.from.x * W}
            y1={line.from.y * H}
            x2={line.to.x * W}
            y2={line.to.y * H}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <stop
                key={i}
                ref={(el) => {
                  if (!el) {
                    gradientStopRefs.current.delete(line.id);
                    return;
                  }
                  const arr = gradientStopRefs.current.get(line.id) ?? [];
                  arr[i] = el;
                  gradientStopRefs.current.set(line.id, arr);
                }}
                offset={`${(i / 8) * 100}%`}
                stopColor={line.glow.color || config.global.glowColor}
                stopOpacity={0}
              />
            ))}
          </linearGradient>
        ) : null)}
        {resolvedLines.map((line) => line.outerGlow.enabled && line.outerGlow.intensity > 0 ? (
          <filter
            key={`outer-filter-${line.id}`}
            id={`${instancePrefix}-magnetic-outer-filter-${line.id}`}
            x="-100%"
            y="-100%"
            width="300%"
            height="300%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="broad-halo" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="soft-core" />
            <feMerge>
              <feMergeNode in="broad-halo" />
              <feMergeNode in="soft-core" />
            </feMerge>
          </filter>
        ) : null)}
        {resolvedLines.map((line) => line.outerGlow.enabled && line.outerGlow.intensity > 0 ? (
          <linearGradient
            key={`outer-grad-${line.id}`}
            id={`${instancePrefix}-magnetic-outer-glow-${line.id}`}
            gradientUnits="userSpaceOnUse"
            x1={line.from.x * W}
            y1={line.from.y * H}
            x2={line.to.x * W}
            y2={line.to.y * H}
          >
            {Array.from({ length: 9 }).map((_, i) => (
              <stop
                key={i}
                ref={(el) => {
                  if (!el) {
                    outerGradientStopRefs.current.delete(line.id);
                    return;
                  }
                  const stops = outerGradientStopRefs.current.get(line.id) ?? [];
                  stops[i] = el;
                  outerGradientStopRefs.current.set(line.id, stops);
                }}
                offset={`${(i / 8) * 100}%`}
                stopColor={line.outerGlow.color}
                stopOpacity={0}
              />
            ))}
          </linearGradient>
        ) : null)}
      </defs>

        {visibleLines.filter((line) => line.occlusion.enabled && linesWithHigherZ.has(line.id)).map((line) => (
          <mask
            key={`occlusion-${line.id}`}
            id={`${instancePrefix}-magnetic-occlusion-${line.id}`}
            maskUnits="userSpaceOnUse"
            x={0}
            y={0}
            width={W}
            height={H}
            ref={(el) => {
              if (el) occlusionMaskRefs.current.set(line.id, el);
              else occlusionMaskRefs.current.delete(line.id);
            }}
          >
            <rect x={0} y={0} width={W} height={H} fill="white" />
          </mask>
        ))}
        {visibleLines.map((line) => (
        <g
          key={line.id}
          ref={(element) => {
            if (element) lineGroupRefs.current.set(line.id, element);
            else lineGroupRefs.current.delete(line.id);
          }}
          data-opening-line={openingAnimation ? line.id : undefined}
          style={openingAnimation ? {
            "--opening-order": Math.floor((openingLineOrder?.get(line.id) ?? 0) / 3),
            "--opening-pass-delay": `${Math.ceil(visibleLines.length / 3)}s`,
          } as React.CSSProperties : undefined}
          mask={line.occlusion.enabled && linesWithHigherZ.has(line.id) ? `url(#${instancePrefix}-magnetic-occlusion-${line.id})` : undefined}
        >
            <path
              ref={(el) => {
                if (el) movePathRefs.current.set(line.id, el);
                else movePathRefs.current.delete(line.id);
              }}
              d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(14, line.appearance.width + 10)}
              strokeLinecap="round"
              pointerEvents={interactive && (selectedGroupLineIds.includes(line.id) || selectedLineId === line.id) ? "stroke" : "none"}
              style={{ cursor: "move" }}
              onPointerDown={(event) => {
                event.stopPropagation();
                const pointer = pointerToNorm(event);
                if (selectedGroupLineIds.includes(line.id)) {
                  groupDraggingRef.current = { startPointer: pointer, lastPointer: pointer, shiftAxis: null };
                  onGroupDragStart?.();
                  return;
                }
                onSelectLine?.(line.id);
                lineDraggingRef.current = { lineId: line.id, startPointer: pointer, lastPointer: pointer, shiftAxis: null };
                onLineDragStart?.(line.id);
                activateLineAnchors(line.id);
              }}
            />
            {line.anchorPoints.some((point) => point.enabled && point.activation !== "always") && (
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) triggerPathRefs.current.set(line.id, el);
              else triggerPathRefs.current.delete(line.id);
            }}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(28, line.appearance.width + 20)}
            strokeLinecap="round"
            pointerEvents={line.anchorPoints.some((point) => point.enabled && point.activation !== "always") &&
              (!interactive || selectedLineId === line.id && !selectedGroupLineIds.includes(line.id)) ? "stroke" : "none"}
            style={{ cursor: line.anchorPoints.some((point) => point.enabled && point.activation === "click") ? "pointer" : undefined }}
            onPointerEnter={() => updateLineHover(line.id, true)}
            onPointerLeave={() => updateLineHover(line.id, false)}
            onPointerDown={(event) => {
              if (interactive && selectedLineId === line.id && !selectedGroupLineIds.includes(line.id)) {
                event.stopPropagation();
                onSelectLine?.(line.id);
                const pointer = pointerToNorm(event);
                lineDraggingRef.current = { lineId: line.id, startPointer: pointer, lastPointer: pointer, shiftAxis: null };
                onLineDragStart?.(line.id);
                activateLineAnchors(line.id);
                return;
              }
              if (!line.anchorPoints.some((point) => point.enabled && point.activation === "click")) return;
              event.preventDefault();
              activateLineAnchors(line.id);
            }}
          />
          )}
          {(showGlowRadiusPreview.inner || showGlowRadiusPreview.outer) && interactive && (!selectedLineId || line.id === selectedLineId) && (
            <>
              {showGlowRadiusPreview.outer && line.outerGlow.radius > 0 && (
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fill={line.outerGlow.color}
                  opacity={0.9}
                  mask={`url(#${instancePrefix}-outer-radius-${line.id})`}
                  pointerEvents="none"
                />
              )}
              {showGlowRadiusPreview.inner && line.glow.radius > 0 && (
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fill={line.glow.color}
                  opacity={0.9}
                  mask={`url(#${instancePrefix}-inner-radius-${line.id})`}
                  pointerEvents="none"
                />
              )}
            </>
          )}
          {line.outerGlow.enabled && line.outerGlow.intensity > 0 && (
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) outerGlowPathRefs.current.set(line.id, el);
              else outerGlowPathRefs.current.delete(line.id);
            }}
            fill="none"
            stroke={`url(#${instancePrefix}-magnetic-outer-glow-${line.id})`}
            strokeWidth={line.appearance.width * 9}
            strokeLinecap="round"
            opacity={0}
            pointerEvents="none"
            style={{ filter: `url(#${instancePrefix}-magnetic-outer-filter-${line.id})` }}
          />
          )}
          {line.glow.enabled && line.glow.intensity > 0 && (
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) glowPathRefs.current.set(line.id, el);
              else glowPathRefs.current.delete(line.id);
            }}
            fill="none"
            stroke={`url(#${instancePrefix}-magnetic-glow-${line.id})`}
            strokeWidth={line.appearance.width * 5}
            strokeLinecap="round"
            opacity={0}
            style={{ filter: `blur(${3 + clamp01(line.glow.intensity / 100) * 4}px)` }}
          />
          )}
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) pathRefs.current.set(line.id, el);
              else pathRefs.current.delete(line.id);
            }}
            fill="none"
            stroke={line.texture.enabled && (line.texture.type === "silk" || line.texture.type === "metal")
              ? "transparent"
              : line.geometrySource === "path" && line.appearance.colorStyle?.type === "rainbow" && getCustomPathSegmentCount(line.customPath.points) > 1
              ? "transparent"
              : line.appearance.colorStyle && line.appearance.colorStyle.type !== "solid" && line.appearance.colorStyle.type !== "random" ? `url(#${instancePrefix}-magnetic-line-color-${line.id})` : line.appearance.colorStyle?.type === "random" ? line.appearance.colorStyle.colors[0] ?? line.appearance.color : line.appearance.color || config.global.color}
            strokeOpacity={line.appearance.opacity * (focusLineId && focusLineId !== line.id && !selectedGroupLineIds.includes(line.id) ? Math.max(0, Math.min(1, focusOpacity)) : 1)}
            strokeWidth={line.appearance.width}
            strokeLinecap="round"
            style={{
              pointerEvents: interactive
                ? selectedGroupLineIds.includes(line.id)
                  ? "stroke"
                  : selectedLineId === line.id && !line.anchorPoints.some((point) => point.enabled && point.activation !== "always")
                    ? "stroke"
                    : "none"
                : "none",
              cursor: interactive
                ? selectedGroupLineIds.includes(line.id) || selectedLineId === line.id ? "move" : undefined
                : line.anchorPoints.some((point) => point.enabled && point.activation !== "always") ? "pointer" : undefined,
            }}
            onPointerEnter={() => { if (interactive && selectedLineId === line.id) updateLineHover(line.id, true); }}
            onPointerLeave={() => { if (interactive && selectedLineId === line.id) updateLineHover(line.id, false); }}
            onPointerDown={
              interactive && selectedGroupLineIds.includes(line.id)
                ? (e) => {
                    e.stopPropagation();
                    const pointer = pointerToNorm(e);
                    groupDraggingRef.current = { startPointer: pointer, lastPointer: pointer, shiftAxis: null };
                    onGroupDragStart?.();
                  }
                : interactive && selectedLineId === line.id || !interactive && line.anchorPoints.some((point) => point.enabled && point.activation === "click")
                  ? (e) => {
                      if (interactive) {
                        e.stopPropagation();
                        onSelectLine?.(line.id);
                        const pointer = pointerToNorm(e);
                        lineDraggingRef.current = { lineId: line.id, startPointer: pointer, lastPointer: pointer, shiftAxis: null };
                        onLineDragStart?.(line.id);
                      }
                      activateLineAnchors(line.id);
                    }
                  : undefined
            }
            data-opening-base={openingAnimation ? "" : undefined}
            pathLength={openingAnimation ? 1 : undefined}
          />
          {openingAnimation && (
            <path
              ref={(element) => {
                if (element) openingElectricPathRefs.current.set(line.id, element);
                else openingElectricPathRefs.current.delete(line.id);
              }}
              d=""
              data-opening-electric=""
              fill="none"
              stroke={line.appearance.color || config.global.color}
              strokeOpacity={Math.min(1, line.appearance.opacity * 1.45)}
              strokeWidth={Math.max(1.2, line.appearance.width * 2.4)}
              strokeLinecap="round"
              pathLength={1}
              pointerEvents="none"
            />
          )}
          {line.geometrySource === "path" && line.appearance.colorStyle?.type === "rainbow" && (() => {
            const segmentCount = getCustomPathSegmentCount(line.customPath.points);
            if (segmentCount <= 1) return null;
            return getEvenlySpacedColors(RAINBOW_COLORS, segmentCount).map((color, index) => (
                  <path
                    key={`rainbow-segment-${line.id}-${index}`}
                    id={`${instancePrefix}-rainbow-segment-${index}-${line.id}`}
                    d=""
                    fill="none"
                    stroke={color}
                    strokeOpacity={line.appearance.opacity * (focusLineId && focusLineId !== line.id && !selectedGroupLineIds.includes(line.id) ? Math.max(0, Math.min(1, focusOpacity)) : 1)}
                    strokeWidth={line.appearance.width}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
            ));
          })()}
          {lineEnvironmentById.get(line.id)?.enabled && lineEnvironmentById.get(line.id)?.lightEnabled && !(line.texture.enabled && line.texture.type === "silk") && getEnvironmentLights(lineEnvironmentById.get(line.id)!).map((light) => (
            <path
              key={`environment-light-path-${line.id}-${light.id}`}
              d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
              ref={(el) => {
                const key = `${line.id}:${light.id}`;
                if (el) environmentLightPathRefs.current.set(key, el);
                else environmentLightPathRefs.current.delete(key);
              }}
              fill="none"
              stroke={`url(#${environmentLightSvgId(instancePrefix, "light", `${line.id}:${light.id}`)})`}
              strokeOpacity={Math.min(1, light.intensity * 1.25 * getTextureLightResponse(line.texture.type, line.texture.enabled) * line.appearance.opacity)}
              strokeWidth={Math.max(2, line.appearance.width * 3)}
              strokeLinecap="round"
              pointerEvents="none"
            />
          ))}
          {line.texture.enabled && getTextureStrokeLayers(line.texture.type, line.texture.scale, line.texture.showThread, line.texture.silkStrands).map((layer) => {
            const refKey = `${line.id}:${layer.id}`;
            const lineEnvironment = lineEnvironmentById.get(line.id);
            const silkLightEnabled = line.texture.type === "silk" && lineEnvironment?.enabled && lineEnvironment.lightEnabled;
            const initialMetalChainPaths = line.texture.type === "metal"
              ? getMetalChainPaths(
                  [
                    { x: line.from.x * W, y: line.from.y * H },
                    { x: line.to.x * W, y: line.to.y * H },
                  ],
                  line.appearance.width,
                  [2],
                  line.texture.scale,
                )
              : null;
            const textureStroke = layer.colorTone === "shadow"
              ? "#18212a"
              : layer.colorTone === "glint"
                ? "#f8fbff"
                : line.appearance.colorStyle && line.appearance.colorStyle.type !== "solid" && line.appearance.colorStyle.type !== "random"
                  ? `url(#${instancePrefix}-magnetic-line-color-${line.id})`
                  : line.appearance.colorStyle?.type === "random"
                    ? line.appearance.colorStyle.colors[0] ?? line.appearance.color
                    : line.appearance.color || config.global.color;
            return (
              <React.Fragment key={`texture-${refKey}`}>
                <path
                  d={layer.chainPart && initialMetalChainPaths
                    ? initialMetalChainPaths[layer.chainPart]
                    : `M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
                  ref={(el) => {
                    if (el) texturePathRefs.current.set(refKey, el);
                    else texturePathRefs.current.delete(refKey);
                  }}
                  fill="none"
                  filter={layer.filter === "grain" ? `url(#${instancePrefix}-magnetic-texture-${line.id})` : undefined}
                  stroke={textureStroke}
                  strokeOpacity={line.texture.intensity * layer.opacity * line.appearance.opacity}
                  strokeWidth={getTextureLayerStrokeWidth(line.appearance.width, layer)}
                  strokeLinecap={layer.lineCap}
                  pathLength={1}
                  strokeDasharray={layer.dashArray}
                  strokeDashoffset={-layer.dashOffset}
                  pointerEvents="none"
                />
                {silkLightEnabled && getEnvironmentLights(lineEnvironment).map((light) => {
                  const key = `${line.id}:${light.id}:${layer.id}`;
                  return (
                    <path
                      key={`silk-light-${key}`}
                      d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
                      ref={(el) => {
                        if (el) environmentSilkLightPathRefs.current.set(key, el);
                        else environmentSilkLightPathRefs.current.delete(key);
                      }}
                      fill="none"
                      stroke={`url(#${environmentLightSvgId(instancePrefix, "light", `${line.id}:${light.id}`)})`}
                      strokeOpacity={Math.min(1, light.intensity * 1.25 * getTextureLightResponse(line.texture.type, line.texture.enabled) * line.appearance.opacity)}
                      strokeWidth={getTextureLayerStrokeWidth(line.appearance.width, layer)}
                      strokeLinecap="butt"
                      pointerEvents="none"
                    />
                  );
                })}
              </React.Fragment>
            );
          })}

          {line.flow.enabled && (
            <g data-flow-effect={line.flow.effectType} pointerEvents="none" style={{ mixBlendMode: "screen" }}>
              {Array.from({ length: FLOW_LAYER_COUNT }, (_, index) => (
                <path
                  key={`flow-layer-${line.id}-${index}`}
                  ref={(element) => {
                    const layers = flowLayerRefs.current.get(line.id) ?? Array(FLOW_LAYER_COUNT).fill(null);
                    layers[index] = element;
                    if (layers.some(Boolean)) flowLayerRefs.current.set(line.id, layers);
                    else flowLayerRefs.current.delete(line.id);
                  }}
                  d=""
                  fill="none"
                  stroke={line.flow.colors[0] ?? line.flow.coreColor}
                  strokeWidth={Math.max(0.35, line.appearance.width * line.flow.width)}
                  strokeLinecap="round"
                  opacity={0}
                  pathLength={1}
                  pointerEvents="none"
                />
              ))}
            </g>
          )}

          {interactive && showAnchorPointHandles && selectedLineId === line.id && (() => {
            const activePoints = [...line.anchorPoints]
              .filter((point) => point.enabled &&
                (!visibleAnchorPointIds || visibleAnchorPointIds.includes(point.id)))
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            if (activePoints.length === 0) return null;

            return (
              <>
                {(["start", "end"] as const).map((endpoint) => {
                  const points = activePoints.filter((point) => point.endpoint === endpoint);
                  if (points.length === 0) return null;
                  const pathPoints = [
                    endpoint === "start" ? line.from : line.to,
                    ...points.map((point) => ({ x: point.x, y: point.y })),
                  ];
                  const d = pathPoints
                    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x * W} ${point.y * H}`)
                    .join(" ");
                  return <path key={endpoint} d={d} fill="none" stroke={endpoint === "start" ? "#f7d974" : "#78aaff"} strokeOpacity={0.65} strokeDasharray="5 8" strokeWidth={Math.max(1.2, line.appearance.width * 0.7)} strokeLinecap="round" pointerEvents="none" />;
                })}
                {activePoints
                  .filter((point) => point.endpoint === "path")
                  .filter((point, index, points) =>
                    points.findIndex((other) => other.pathPointId === point.pathPointId) === index)
                  .map((point) => {
                    const sourcePathPoint = line.customPath.points.find((pathPoint) => pathPoint.id === point.pathPointId);
                    const source = getCustomPathPointsInViewport(line, { width: W, height: H }).find((pathPoint) => pathPoint.id === point.pathPointId);
                    if (!source) return null;
                    const sourceIndex = sourcePathPoint
                      ? line.customPath.points.findIndex((pathPoint) =>
                        pathPoint.x === sourcePathPoint.x && pathPoint.y === sourcePathPoint.y)
                      : 0;
                    const routeColors = ["#5ee6ff", "#f2c27b", "#c99cff", "#75e0a1", "#ff8c9c"];
                    const points = activePoints
                      .filter((item) => item.endpoint === "path" && item.pathPointId === point.pathPointId)
                      .sort((left, right) => left.order - right.order);
                    const d = [source, ...points]
                      .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x * W} ${item.y * H}`)
                      .join(" ");
                    return <path key={`path-${point.pathPointId}`} d={d} fill="none" stroke={routeColors[Math.max(0, sourceIndex) % routeColors.length]} strokeOpacity={0.75} strokeDasharray="5 8" strokeWidth={Math.max(1.2, line.appearance.width * 0.7)} strokeLinecap="round" pointerEvents="none" />;
                  })}
              </>
            );
          })()}
          {interactive && showAnchorPointHandles && showEndpointHandles && line.geometrySource !== "path" && selectedLineId === line.id && (
            <>
              <circle
                cx={line.from.x * W}
                cy={line.from.y * H}
                r={6}
                fill="#54d6a0"
                stroke="#0a0b0f"
                strokeWidth={1.5}
                style={{ pointerEvents: "all", cursor: "grab" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectLine?.(line.id);
                  const startPointer = pointerToNorm(e);
                  draggingRef.current = {
                    lineId: line.id,
                    which: "from",
                    startPointer,
                    startPoint: line.from,
                    offset: { x: line.from.x - startPointer.x, y: line.from.y - startPointer.y },
                    shiftAxis: null,
                  };
                  onDragStart?.(line.id, "from");
                }}
              />
              <circle
                cx={line.to.x * W}
                cy={line.to.y * H}
                r={6}
                fill="#b28aff"
                stroke="#0a0b0f"
                strokeWidth={1.5}
                style={{ pointerEvents: "all", cursor: "grab" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectLine?.(line.id);
                  const startPointer = pointerToNorm(e);
                  draggingRef.current = {
                    lineId: line.id,
                    which: "to",
                    startPointer,
                    startPoint: line.to,
                    offset: { x: line.to.x - startPointer.x, y: line.to.y - startPointer.y },
                    shiftAxis: null,
                  };
                  onDragStart?.(line.id, "to");
                }}
              />
              <text x={line.from.x * W + 9} y={line.from.y * H - 9} fill="#54d6a0" stroke="#0a0b0f" strokeWidth={3} paintOrder="stroke" fontSize={10} pointerEvents="none">Start</text>
              <text x={line.to.x * W + 9} y={line.to.y * H - 9} fill="#b28aff" stroke="#0a0b0f" strokeWidth={3} paintOrder="stroke" fontSize={10} pointerEvents="none">End</text>
            </>
          )}
          {interactive && showAnchorPointHandles && selectedLineId === line.id && line.anchorPoints
            .filter((point) => !visibleAnchorPointIds || visibleAnchorPointIds.includes(point.id))
            .map((point) => {
            const editable = !editableAnchorPointIds || editableAnchorPointIds.includes(point.id);
            const pathPointIndex = point.endpoint === "path"
              ? line.customPath.points.findIndex((pathPoint) => pathPoint.id === point.pathPointId)
              : -1;
            const sourcePathPoint = line.customPath.points[pathPointIndex];
            const canonicalPathPointIndex = sourcePathPoint
              ? line.customPath.points.findIndex((pathPoint) =>
                pathPoint.x === sourcePathPoint.x && pathPoint.y === sourcePathPoint.y)
              : -1;
            const pathPointIds = sourcePathPoint
              ? line.customPath.points
                .filter((pathPoint) => pathPoint.x === sourcePathPoint.x && pathPoint.y === sourcePathPoint.y)
                .map((pathPoint) => pathPoint.id)
              : [];
            const pointsForPathTarget = pathPointIndex >= 0
              ? line.anchorPoints
                .filter((item) => item.endpoint === "path" && pathPointIds.includes(item.pathPointId ?? ""))
                .sort((left, right) => left.order - right.order)
              : [];
            const pathTargetIndex = pointsForPathTarget.findIndex((item) => item.id === point.id);
            const label = canonicalPathPointIndex >= 0 && pathTargetIndex >= 0
              ? `S${canonicalPathPointIndex + 1}.${pathTargetIndex + 1}`
              : null;
            return (
            <g key={point.id}>
              <circle
                cx={point.x * W}
                cy={point.y * H}
                r={selectedAnchorPointIds.includes(point.id) || selectedAnchorPointId === point.id ? 8 : 6}
                fill={point.endpoint === "start" ? "#f7d974" : point.endpoint === "end" ? "#78aaff" : "#5ee6ff"}
                fillOpacity={point.enabled ? (editable ? 1 : 0.35) : 0.2}
                stroke={selectedAnchorPointIds.includes(point.id) || selectedAnchorPointId === point.id ? "#ffffff" : "#0a0b0f"}
                strokeWidth={selectedAnchorPointIds.includes(point.id) || selectedAnchorPointId === point.id ? 2 : 1.5}
                style={{ pointerEvents: editable ? "all" : "none", cursor: point.enabled && editable ? "grab" : "default" }}
                onPointerDown={(e) => {
                  if (!editable) return;
                  e.stopPropagation();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  onSelectLine?.(line.id);
                  onSelectAnchorPoint?.(line.id, point.id);
                  if (point.enabled) {
                    const pointer = pointerToNorm(e);
                    const selectedPointIds = selectedAnchorPointIds.includes(point.id)
                      ? selectedAnchorPointIds
                      : [point.id];
                    anchorDraggingRef.current = {
                      lineId: line.id,
                      pointId: point.id,
                      offset: { x: point.x - pointer.x, y: point.y - pointer.y },
                      selectedPointIds,
                      startPointer: pointer,
                      startPoint: { x: point.x, y: point.y },
                      lastPointer: pointer,
                      shiftAxis: null,
                    };
                    onDragAnchorStart?.(line.id, point.id);
                  }
                }}
                onPointerMove={(e) => {
                  if (!editable) return;
                  const drag = anchorDraggingRef.current;
                  if (!drag || drag.pointId !== point.id) return;
                  e.stopPropagation();
                  if (!showAnchorPointHandles) {
                    anchorDraggingRef.current = null;
                    return;
                  }
                  const pointer = pointerToNorm(e);
                  const deltaResult = getAxisLockedDelta(
                    pointer,
                    drag.lastPointer,
                    drag.startPointer,
                    e.shiftKey,
                    drag.shiftAxis,
                    W,
                    H,
                  );
                  drag.lastPointer = pointer;
                  drag.shiftAxis = deltaResult.shiftAxis;
                  if (drag.selectedPointIds.length > 1) {
                    onDragSelectedAnchorPoints?.(drag.lineId, drag.selectedPointIds, deltaResult.delta);
                  } else {
                    const dragged = getDraggedPoint(
                      pointer,
                      drag.startPointer,
                      drag.startPoint,
                      drag.offset,
                      e.shiftKey,
                      drag.shiftAxis,
                      W,
                      H,
                    );
                    drag.shiftAxis = dragged.shiftAxis;
                    onDragAnchorPoint?.(drag.lineId, drag.pointId, { x: clamp01(dragged.point.x), y: clamp01(dragged.point.y) });
                  }
                }}
                onClick={(e) => {
                  if (!editable) return;
                  e.stopPropagation();
                  onSelectAnchorPoint?.(line.id, point.id);
                }}
              />
              <circle
                cx={point.x * W}
                cy={point.y * H}
                r={selectedAnchorPointIds.includes(point.id) || selectedAnchorPointId === point.id ? 12 : 10}
                fill="none"
                stroke={point.endpoint === "start" ? "rgba(247,217,116,0.4)" : point.endpoint === "end" ? "rgba(120,170,255,0.4)" : "rgba(94,230,255,0.4)"}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
              {showAnchorPointHandles && label && (
                <text
                  x={point.x * W + 9}
                  y={point.y * H - 9}
                  fill="#5ee6ff"
                  stroke="#0a0b0f"
                  strokeWidth={3}
                  paintOrder="stroke"
                  fontSize={10}
                  pointerEvents="none"
                >
                  {label}
                </text>
              )}
            </g>
            );
          })}
          {interactive && showPathPointHandles && line.geometrySource === "path" && selectedLineId === line.id && (
            <g>
              {getCustomPathPointsInViewport(line, { width: W, height: H })
                .filter((point) => !visiblePathPointIds || visiblePathPointIds.includes(point.id))
                .map((point) => {
                const index = line.customPath.points.findIndex((pathPoint) => pathPoint.id === point.id);
                const hasEarlierOverlap = line.customPath.points
                  .slice(0, index)
                  .some((previous) => previous.x === line.customPath.points[index]?.x && previous.y === line.customPath.points[index]?.y);
                const coveredByAnchor = showAnchorPointHandles && line.anchorPoints.some((anchor) =>
                  Math.hypot((anchor.x - point.x) * W, (anchor.y - point.y) * H) <= 13);
                return (
                  <g key={point.id}>
                    <circle
                      cx={point.x * W}
                      cy={point.y * H}
                      r={selectedPathPointId === point.id ? 7 : 5}
                      fill={selectedPathPointId === point.id ? "#5ee6ff" : index === 0 ? "#54d6a0" : index === line.customPath.points.length - 1 ? "#b28aff" : "#f2c27b"}
                      stroke="#0a0b0f"
                      strokeWidth={1.5}
                      style={{ pointerEvents: coveredByAnchor ? "none" : "all", cursor: "grab" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const pointer = pointerToNorm(e);
                        pathDraggingRef.current = {
                          lineId: line.id,
                          pointId: point.id,
                          offset: { x: point.x - pointer.x, y: point.y - pointer.y },
                          startPointer: pointer,
                          startPoint: { x: point.x, y: point.y },
                          shiftAxis: null,
                        };
                        onSelectLine?.(line.id);
                        onSelectPathPoint?.(line.id, point.id);
                        onPathPointDragStart?.(line.id, point.id);
                      }}
                      onPointerMove={(e) => {
                        const drag = pathDraggingRef.current;
                        if (!drag || drag.pointId !== point.id) return;
                        e.stopPropagation();
                        const pointer = pointerToNorm(e);
                        const dragged = getDraggedPoint(
                          pointer,
                          drag.startPointer,
                          drag.startPoint,
                          drag.offset,
                          e.shiftKey,
                          drag.shiftAxis,
                          W,
                          H,
                        );
                        drag.shiftAxis = dragged.shiftAxis;
                        onDragPathPoint?.(drag.lineId, drag.pointId, { x: clamp01(dragged.point.x), y: clamp01(dragged.point.y) });
                      }}
                    />
                    {showShapePointLabels && !hasEarlierOverlap && (
                      <text
                        x={point.x * W + 8}
                        y={point.y * H - 8}
                        fill="#f2c27b"
                        stroke="#0a0b0f"
                        strokeWidth={3}
                        paintOrder="stroke"
                        fontSize={10}
                        pointerEvents="none"
                      >
                        {`S${index + 1}`}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}          {interactive && debug?.showIds && (
            <text x={line.from.x * W + 8} y={line.from.y * H - 8} fill="#5ee6ff" fontSize={10} fontFamily="monospace">
              {line.id}
            </text>
          )}
        </g>
      ))}

      {interactive &&
        showTransformHandles &&
        selectedGroupBounds &&
        selectedGroupCenter &&
        selectedGroupLineIds.length > 0 && (
          <g>
            <rect
              x={Math.max(0, selectedGroupBounds.left * W - 8)}
              y={Math.max(0, selectedGroupBounds.top * H - 8)}
              width={Math.max(1, Math.min(W, selectedGroupBounds.right * W + 8) - Math.max(0, selectedGroupBounds.left * W - 8))}
              height={Math.max(1, Math.min(H, selectedGroupBounds.bottom * H + 8) - Math.max(0, selectedGroupBounds.top * H - 8))}
              fill="none"
              stroke="#5ee6ff"
              strokeDasharray="2 4"
              strokeWidth={1}
              pointerEvents="none"
            />
            <line x1={selectedGroupCenter.x * W} y1={selectedGroupBounds.top * H - 8} x2={selectedGroupCenter.x * W} y2={rotationHandleY + 5} stroke="#5ee6ff" strokeWidth={1} pointerEvents="none" />
            <circle
              cx={selectedGroupCenter.x * W}
              cy={rotationHandleY}
              r={5}
              fill="#5ee6ff"
              stroke="#0a0b0f"
              strokeWidth={1.5}
              aria-label="Rotate group"
              style={{ pointerEvents: "all", cursor: "grab" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pointer = pointerToNorm(e);
                groupTransformDraggingRef.current = {
                  target: "group",
                  mode: "rotate",
                  center: selectedGroupCenter,
                  startDistance: Math.hypot(pointer.x - selectedGroupCenter.x, pointer.y - selectedGroupCenter.y),
                  startAngle: Math.atan2(pointer.y - selectedGroupCenter.y, pointer.x - selectedGroupCenter.x) * 180 / Math.PI,
                  startScale: selectedGroupConfig?.scale ?? 1,
                  startScaleX: selectedGroupConfig?.scaleX ?? 1,
                  startScaleY: selectedGroupConfig?.scaleY ?? 1,
                  startRotation: selectedGroupConfig?.rotation ?? 0,
                };
                onGroupTransformStart?.();
              }}
            />
            <circle
              cx={resizeHandleX}
              cy={resizeHandleY}
              r={6}
              fill="#5ee6ff"
              stroke="#0a0b0f"
              strokeWidth={1.5}
              aria-label="Resize group"
              style={{ pointerEvents: "all", cursor: "nwse-resize" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pointer = pointerToNorm(e);
                groupTransformDraggingRef.current = {
                  target: "group",
                  mode: "scale",
                  center: selectedGroupCenter,
                  startDistance: Math.hypot(pointer.x - selectedGroupCenter.x, pointer.y - selectedGroupCenter.y),
                  startAngle: Math.atan2(pointer.y - selectedGroupCenter.y, pointer.x - selectedGroupCenter.x) * 180 / Math.PI,
                  startScale: selectedGroupConfig?.scale ?? 1,
                  startScaleX: selectedGroupConfig?.scaleX ?? 1,
                  startScaleY: selectedGroupConfig?.scaleY ?? 1,
                  startRotation: selectedGroupConfig?.rotation ?? 0,
                };
                onGroupTransformStart?.();
              }}
            />
          </g>
        )}
      {interactive && showTransformHandles && selectedLine && selectedLineBounds && selectedLineCenter && (
        <g>
          <rect
            x={Math.max(0, selectedLineBounds.left * W - 8)}
            y={Math.max(0, selectedLineBounds.top * H - 8)}
            width={Math.max(1, Math.min(W, selectedLineBounds.right * W + 8) - Math.max(0, selectedLineBounds.left * W - 8))}
            height={Math.max(1, Math.min(H, selectedLineBounds.bottom * H + 8) - Math.max(0, selectedLineBounds.top * H - 8))}
            fill="transparent"
            stroke="#5ee6ff"
            strokeDasharray="3 4"
            strokeWidth={1}
            pointerEvents="none"
          />
          <line
            x1={selectedLineCenter.x * W}
            y1={selectedLineBounds.top * H - 8}
            x2={selectedLineCenter.x * W}
            y2={lineRotationHandleY + 5}
            stroke="#5ee6ff"
            strokeWidth={1}
            pointerEvents="none"
          />
          <circle
            cx={selectedLineCenter.x * W}
            cy={lineRotationHandleY}
            r={5}
            fill="#5ee6ff"
            stroke="#0a0b0f"
            strokeWidth={1.5}
            aria-label="Rotate selected line"
            style={{ pointerEvents: "all", cursor: "grab" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const pointer = pointerToNorm(event);
              const transform = selectedLine.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
              groupTransformDraggingRef.current = {
                target: "line",
                mode: "rotate",
                center: selectedLineCenter,
                startDistance: Math.hypot(pointer.x - selectedLineCenter.x, pointer.y - selectedLineCenter.y),
                startAngle: Math.atan2(pointer.y - selectedLineCenter.y, pointer.x - selectedLineCenter.x) * 180 / Math.PI,
                startScale: Math.sqrt(Math.abs(transform.scaleX * transform.scaleY)),
                startScaleX: transform.scaleX,
                startScaleY: transform.scaleY,
                startRotation: transform.rotation,
              };
              onLineTransformStart?.();
            }}
          />
          <rect
            x={lineResizeHandleX - 5}
            y={lineResizeHandleY - 5}
            width={10}
            height={10}
            rx={1}
            fill="#5ee6ff"
            stroke="#0a0b0f"
            strokeWidth={1.5}
            aria-label="Resize selected line"
            style={{ pointerEvents: "all", cursor: "nwse-resize" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const pointer = pointerToNorm(event);
              const transform = selectedLine.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
              groupTransformDraggingRef.current = {
                target: "line",
                mode: "scale",
                center: selectedLineCenter,
                startDistance: Math.hypot(pointer.x - selectedLineCenter.x, pointer.y - selectedLineCenter.y),
                startAngle: Math.atan2(pointer.y - selectedLineCenter.y, pointer.x - selectedLineCenter.x) * 180 / Math.PI,
                startScale: Math.sqrt(Math.abs(transform.scaleX * transform.scaleY)),
                startScaleX: transform.scaleX,
                startScaleY: transform.scaleY,
                startRotation: transform.rotation,
              };
              onLineTransformStart?.();
            }}
          />
        </g>
      )}
      {uniqueEnvironmentLights.map(({ key, light }) => (
        <circle
          key={`environment-light-spill-${key}`}
          data-environment-light-marker={`spill:${key}`}
          cx={light.position.x * W}
          cy={light.position.y * H}
          r={Math.max(1, light.radius * Math.min(W, H) * 1.5)}
          fill={`url(#${environmentLightSvgId(instancePrefix, "spill", key)})`}
          style={{ mixBlendMode: "screen" }}
          pointerEvents="none"
        />
      ))}
      {interactive &&
        showAirflowGuide &&
        airflowGuides.map((guide, index) => guide.length >= 2 && (
          <g key={`airflow-guide-${index}`} pointerEvents="none">
            <path
              d={pointsToSmoothPath(guide.map((point) => ({ x: point.x * W, y: point.y * H })))}
              fill="none"
              stroke="#83cfff"
              strokeWidth={Math.max(1, (airflowGuideRadii[index] ?? 0) * 2 * Math.min(W, H))}
              strokeOpacity={0.075}
              strokeLinecap="round"
            />
            <path
              ref={(element) => {
                if (element) airflowGuidePathRefs.current.set(index, element);
                else airflowGuidePathRefs.current.delete(index);
              }}
              d={pointsToSmoothPath(guide.map((point) => ({ x: point.x * W, y: point.y * H })))}
              fill="none"
              stroke="#b8e4ff"
              strokeWidth={1.8}
              strokeOpacity={environmentPathEditing && index === environmentPathIndex ? 0.9 : 0.45}
              strokeDasharray="0.01 0.016"
              pathLength={1}
              markerEnd={`url(#${instancePrefix}-airflow-arrow)`}
            />
          </g>
        ))}
      {interactive && environmentPathEditing && (
        <path
          ref={airflowDraftPathRef}
          fill="none"
          stroke="#d7f0ff"
          strokeWidth={2}
          strokeOpacity={0.9}
          strokeDasharray="5 4"
          strokeLinecap="round"
          pointerEvents="none"
        />
      )}
      {showEditableLight && editableLights.map((light) => {
        const key = `light:${editableLightLineId ?? "global"}:${light.id}`;
        const start = light.position;
        const end = light.endPosition;
        const supportsTravel = editableLightLineId !== undefined ||
          light.id !== "global-light" ||
          light.speed > 0 ||
          start.x !== end.x ||
          start.y !== end.y;
        const dragLight = (event: React.PointerEvent<SVGCircleElement>, endpoint: "start" | "end") => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          environmentLightDraggingRef.current = {
            pointerId: event.pointerId,
            lineId: editableLightLineId,
            lightId: light.id,
            endpoint,
          };
          onEnvironmentLightDragStart?.(editableLightLineId);
        };
        return (
          <g key={`editable-environment-light-${key}`}>
            {supportsTravel && (start.x !== end.x || start.y !== end.y) && (
              <line
                x1={start.x * W}
                y1={start.y * H}
                x2={end.x * W}
                y2={end.y * H}
                stroke={light.color}
                strokeOpacity={0.55}
                strokeDasharray="4 4"
                pointerEvents="none"
              />
            )}
            <circle
              cx={start.x * W}
              cy={start.y * H}
              r={8}
              fill={light.color}
              fillOpacity={0.15}
              stroke={light.color}
              strokeOpacity={0.9}
              strokeWidth={1.5}
              aria-label={`Move light ${light.id} start`}
              style={{ pointerEvents: "all", cursor: "grab" }}
              onPointerDown={(event) => dragLight(event, "start")}
            />
            {supportsTravel && (
              <circle
                cx={end.x * W}
                cy={end.y * H}
                r={7}
                fill="#10131b"
                fillOpacity={0.9}
                stroke={light.color}
                strokeOpacity={0.9}
                strokeWidth={1.5}
                aria-label={`Move light ${light.id} end`}
                style={{ pointerEvents: "all", cursor: "grab" }}
                onPointerDown={(event) => dragLight(event, "end")}
              />
            )}
            <circle
              data-environment-light-marker={key}
              cx={start.x * W}
              cy={start.y * H}
              r={3}
              fill={light.color}
              pointerEvents="none"
            />
          </g>
        );
      })}
      {interactive &&
        debug?.showTargetBounds &&
        getAllTargetSnapshots().map((t) =>
          t.rect ? (
            <rect
              key={t.id}
              x={t.rect.left}
              y={t.rect.top}
              width={t.rect.width}
              height={t.rect.height}
              fill="none"
              stroke={t.active ? "#ffbb55" : "#5ee6ff66"}
              strokeDasharray="4 3"
            />
          ) : null
        )}
    </svg>
  );
}
