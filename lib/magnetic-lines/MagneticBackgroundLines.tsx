"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { RAINBOW_COLORS, type MagneticLineConfig, type MagneticLinesSceneConfig, type Point } from "./types";
import { normalizeColorWeights } from "./colorWeights";
import { computeLine, createLineRuntimeState, getCustomPathPointsInViewport, type AnchorPlaybackState, type LineRuntimeState } from "./engine/lineEngine";
import { getAllTargetSnapshots, updateTargetOptions } from "./engine/targetRegistry";
import { clamp01 } from "./engine/math";
import { resolveLineConfig } from "./engine/resolveConfig";
import { computeLineInteractionOffsets } from "./engine/lineInteraction";
import { createOcclusionMaskPlan } from "./engine/occlusion";

export interface DebugFlags {
  showIds?: boolean;
  showEndpoints?: boolean;
  showTargetBounds?: boolean;
}

export interface MagneticBackgroundLinesProps {
  config: MagneticLinesSceneConfig;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Enables editor-only interaction: click-to-select, draggable endpoint handles,
   * and debug overlays. Leave false/omitted in production â€” the background then
   * renders fixed, full-viewport, and pointer-events: none.
   */
  interactive?: boolean;
  selectedLineId?: string | null;
  selectedGroupLineIds?: string[];
  showTransformHandles?: boolean;
  pauseAnimation?: boolean;
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
  onDragAnchorStart?: (lineId: string, pointId: string) => void;
  onDragCommit?: () => void;
  selectedPathPointId?: string | null;
  selectedAnchorPointId?: string | null;
  showAnchorPointHandles?: boolean;
  showPathPointHandles?: boolean;
  onSelectPathPoint?: (lineId: string, pointId: string) => void;
  onSelectAnchorPoint?: (lineId: string, pointId: string) => void;
  onPathPointDragStart?: (lineId: string, pointId: string) => void;
  onDragPathPoint?: (lineId: string, pointId: string, point: Point) => void;
  onPathPointDragEnd?: (lineId: string, pointId: string, nearbyPointId: string) => void;
  debug?: DebugFlags;
}

function isReducedMotion(setting: MagneticLinesSceneConfig["animation"]["reducedMotion"]): boolean {
  if (setting === "on") return true;
  if (setting === "off") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function getAppearanceStops(line: MagneticLineConfig) {
  const colors = line.appearance.colorStyle?.type === "rainbow"
    ? RAINBOW_COLORS
    : line.appearance.colorStyle?.colors?.length
    ? line.appearance.colorStyle.colors
    : [line.appearance.color, line.appearance.color];
  const weights = normalizeColorWeights(
    line.appearance.colorStyle?.type === "rainbow" ? undefined : line.appearance.colorStyle?.colorWeights,
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
  const expandedStops = line.appearance.colorStyle?.type === "diamond"
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

function getRandomLineColor(line: MagneticLineConfig, time: number): string {
  const colors = line.appearance.colorStyle?.colors?.length
    ? line.appearance.colorStyle.colors
    : [line.appearance.color, line.appearance.color];
  if (colors.length < 2) return colors[0] ?? line.appearance.color;
  const phase = [...line.id].reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7) / 0xffffffff;
  const secondsPerColor = Math.min(10, Math.max(0.1, line.appearance.colorStyle?.speed ?? 2.5));
  const position = (time / secondsPerColor + phase) % colors.length;
  const index = Math.floor(position);
  const progress = position - index;
  const eased = progress * progress * (3 - 2 * progress);
  return interpolateHexColor(colors[index], colors[(index + 1) % colors.length], eased);
}

export function MagneticBackgroundLines({
  config,
  className,
  style,
  interactive = false,
  selectedLineId = null,
  selectedGroupLineIds = [],
  showTransformHandles = false,
  pauseAnimation = false,
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
  onDragAnchorStart,
  onDragCommit,
  selectedPathPointId = null,
  selectedAnchorPointId = null,
  showAnchorPointHandles = true,
  showPathPointHandles = true,
  onSelectPathPoint,
  onSelectAnchorPoint,
  onPathPointDragStart,
  onDragPathPoint,
  onPathPointDragEnd,
  debug,
}: MagneticBackgroundLinesProps) {
  const instancePrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const glowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const outerGlowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const ambientGlowPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const texturePathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const gradientStopRefs = useRef<Map<string, SVGStopElement[]>>(new Map());
  const outerGradientStopRefs = useRef<Map<string, SVGStopElement[]>>(new Map());
  const colorGradientRefs = useRef<Map<string, SVGGradientElement>>(new Map());
  const occlusionMaskPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const runtimeStates = useRef<Map<string, LineRuntimeState>>(new Map());
  const lineMotionClocks = useRef<Map<string, { delay: number; startedAt: number }>>(new Map());
  const triggerPathRefs = useRef<Map<string, SVGPathElement>>(new Map());
  const anchorInteractionStates = useRef(new Map<string, { alwaysSignature: string; alwaysStartedAt: number; hovering: boolean; hasHovered: boolean; hoverStartedAt: number; hoverFrozenTime: number; activeClickPointIds: Set<string>; clickStartedAt: number }>());
  const runtimeTimeRef = useRef(0);
  const motionScaleRef = useRef(1);
  const pointerRef = useRef({ x: 0, y: 0, active: false, lastMove: 0 });
  const viewportRef = useRef({ width: 0, height: 0 });
  const surfaceRectRef = useRef<DOMRect | null>(null);
  const draggingRef = useRef<{ lineId: string; which: "from" | "to" } | null>(null);
  const lineDraggingRef = useRef<{ lineId: string; point: Point } | null>(null);
  const pathDraggingRef = useRef<{ lineId: string; pointId: string; offset: Point } | null>(null);
  const anchorDraggingRef = useRef<{ lineId: string; pointId: string; offset: Point } | null>(null);
  const groupDraggingRef = useRef<Point | null>(null);
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
  const hasTriggeredAnchors = resolvedLines.some((line) => line.anchorPoints.some((point) => point.enabled && point.activation !== "always"));
  function getAnchorPlayback(lineId: string, anchorPoints: MagneticLineConfig["anchorPoints"], motionStartedAt: number): AnchorPlaybackState {
    const time = runtimeTimeRef.current;
    const alwaysSignature = JSON.stringify(anchorPoints.map((point) => [point.id, point.enabled, point.activation, point.behavior, point.loop, point.speed]));
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
    return {
      alwaysTime: Math.max(0, time - Math.max(state.alwaysStartedAt, motionStartedAt)),
      hovering: state?.hovering ?? false,
      hasHovered: state?.hasHovered ?? false,
      hoverTime: state?.hasHovered ? Math.max(0, time - state.hoverStartedAt) : 0,
      hoverFrozenTime: state?.hoverFrozenTime ?? 0,
      clicked: (state?.activeClickPointIds.size ?? 0) > 0,
      clickTime: state?.activeClickPointIds.size ? Math.max(0, time - state.clickStartedAt) : 0,
      activeClickPointIds: state?.activeClickPointIds ?? new Set(),
    };
  }
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

  useEffect(() => {
    for (const target of config.targets) updateTargetOptions(target.id, { priority: target.priority });
  }, [config.targets]);

  useEffect(() => {
    function measure() {
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
    }
    function onLeave() {
      pointerRef.current.active = false;
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
    let last = performance.now();
    let runtimeTime = runtimeTimeRef.current;

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      const motionScale = motionScaleRef.current;
      last = now;
      const frameDt = config.animation.playing && !pauseAnimation ? dt : 0;

      if (config.animation.playing && !pauseAnimation) runtimeTime += dt * config.animation.speedMultiplier;


      const pointerLocal = surfaceRectRef.current
        ? { x: pointerRef.current.x, y: pointerRef.current.y, active: pointerRef.current.active }
        : null;

      const viewport = viewportRef.current;
      if (viewport.width === 0 || viewport.height === 0) return;

      const surfaceOffset = surfaceRectRef.current ? { x: surfaceRectRef.current.left, y: surfaceRectRef.current.top } : { x: 0, y: 0 };

      const time = runtimeTime;

      runtimeTimeRef.current = runtimeTime;
      const activeIds = new Set(config.lines.map((line) => line.id));
      runtimeStates.current.forEach((_, id) => { if (!activeIds.has(id)) runtimeStates.current.delete(id); });
      lineMotionClocks.current.forEach((_, id) => { if (!activeIds.has(id)) lineMotionClocks.current.delete(id); });
      anchorInteractionStates.current.forEach((_, id) => { if (!activeIds.has(id)) anchorInteractionStates.current.delete(id); });

      const frameEntries = [] as Array<{
        line: (typeof config.lines)[number];
        resolvedLine: ReturnType<typeof resolveLineConfig>;
        lineState: LineRuntimeState;
        anchorPlayback: AnchorPlaybackState;
        result: ReturnType<typeof computeLine>;
      }>;

      for (const line of config.lines) {
        if (!line.enabled || !line.visible) continue;
        if (soloLineId && line.id !== soloLineId) continue;

        let lineState = runtimeStates.current.get(line.id);
        if (!lineState) {
          lineState = createLineRuntimeState();
          runtimeStates.current.set(line.id, lineState);
        }

        const resolvedLine = resolveLineConfig(line, config.global);
        const delay = Math.max(0, resolvedLine.startDelay ?? 0);
        let motionClock = lineMotionClocks.current.get(line.id);
        if (!motionClock || motionClock.delay !== delay) {
          motionClock = { delay, startedAt: time };
          lineMotionClocks.current.set(line.id, motionClock);
        }
        const motionStartedAt = motionClock.startedAt + delay;
        const lineTime = Math.max(0, time - motionStartedAt);
        const anchorPlayback = getAnchorPlayback(line.id, line.anchorPoints, motionStartedAt);
        const result = computeLine(resolvedLine, config, lineState, lineTime, frameDt, viewport, pointerLocal, motionScale, undefined, surfaceOffset, anchorPlayback);
        frameEntries.push({ line, resolvedLine, lineState, anchorPlayback, result });
      }

      const interactionOffsets = computeLineInteractionOffsets(
        frameEntries.map(({ resolvedLine, result }) => ({ id: resolvedLine.id, points: result.points, config: resolvedLine.lineInteraction })),
        Math.min(viewport.width, viewport.height) || 1
      );

      const renderedResults = new Map<string, ReturnType<typeof computeLine>>();

      for (const entry of frameEntries) {
        const interactionOffset = interactionOffsets.get(entry.resolvedLine.id);
        const hasInteraction = interactionOffset?.some((point) => point.x !== 0 || point.y !== 0) ?? false;
        const result = hasInteraction
          ? computeLine(entry.resolvedLine, config, entry.lineState, time, 0, viewport, pointerLocal, motionScale, interactionOffset, surfaceOffset, entry.anchorPlayback)
          : entry.result;
        renderedResults.set(entry.resolvedLine.id, result);
        const presentation = presentationRef.current;
        const presentationOpacity = presentation.focusLineId && presentation.focusLineId !== entry.line.id ? Math.max(0, Math.min(1, presentation.focusOpacity)) : 1;

        pathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        triggerPathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        const colorStyle = entry.resolvedLine.appearance.colorStyle;
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
          pathRefs.current.get(entry.line.id)?.setAttribute("stroke", animatedColor);
          texturePathRefs.current.get(entry.line.id)?.setAttribute("stroke", animatedColor);
        }
        texturePathRefs.current.get(entry.line.id)?.setAttribute("d", result.d);
        const flow = entry.resolvedLine.textureFlow;
        const flowOffset = ((flow.offset + (flow.enabled && entry.resolvedLine.texture.enabled ? time * flow.speed * (flow.direction === "reverse" ? -1 : 1) : 0)) % 1 + 1) % 1;
        texturePathRefs.current.get(entry.line.id)?.setAttribute("stroke-dashoffset", String(-flowOffset));

        const ambientEl = ambientGlowPathRefs.current.get(entry.line.id);
        if (ambientEl) {
          ambientEl.setAttribute("d", result.d);
          ambientEl.setAttribute("opacity", String(clamp01(result.ambientGlow * presentationOpacity)));
        }

        const glowEl = glowPathRefs.current.get(entry.line.id);
        if (glowEl) {
          glowEl.setAttribute("d", result.d);
          glowEl.setAttribute("opacity", String(clamp01(result.maxGlow * presentationOpacity)));
        }

        const outerGlowEl = outerGlowPathRefs.current.get(entry.line.id);
        if (outerGlowEl) {
          outerGlowEl.setAttribute("d", result.d);
          outerGlowEl.setAttribute("opacity", String(clamp01(result.maxOuterGlow * presentationOpacity)));
        }
        const outerStops = outerGradientStopRefs.current.get(entry.line.id);
        if (outerStops) {
          for (let i = 0; i < outerStops.length; i++) {
            const sampleIdx = Math.round((i / (outerStops.length - 1)) * (result.outerGlowStops.length - 1));
            outerStops[i].setAttribute("stop-opacity", String(clamp01(result.outerGlowStops[sampleIdx] ?? 0)));
          }
        }
        const stops = gradientStopRefs.current.get(entry.line.id);
        if (stops) {
          const n = stops.length;
          for (let i = 0; i < n; i++) {
            const sampleIdx = Math.round((i / (n - 1)) * (result.glowStops.length - 1));
            stops[i].setAttribute("stop-opacity", String(clamp01(result.glowStops[sampleIdx] ?? 0)));
          }
        }
      }
      const occlusionLines = visibleLines.flatMap((line) => {
        const result = renderedResults.get(line.id);
        return result ? [{ id: line.id, width: line.appearance.width, occlusionEnabled: line.occlusion.enabled, points: result.points }] : [];
      });
      const occlusionPlan = new Map(createOcclusionMaskPlan(occlusionLines).map((item) => [item.lineId, item.occluderIds]));
      for (const line of visibleLines) {
        const occluders = occlusionPlan.get(line.id) ?? [];
        for (const higherLine of visibleLines) {
          if (higherLine.appearance.zIndex <= line.appearance.zIndex) continue;
          const maskPath = occlusionMaskPathRefs.current.get(`${line.id}:${higherLine.id}`);
          if (!maskPath) continue;
          const higherResult = renderedResults.get(higherLine.id);
          if (higherResult) maskPath.setAttribute("d", higherResult.d);
          maskPath.setAttribute("opacity", occluders.includes(higherLine.id) ? "1" : "0");
        }
      }    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [config, pauseAnimation, soloLineId, visibleLines]);



  function pointerToNorm(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - rect.left) / rect.width),
      y: clamp01((e.clientY - rect.top) / rect.height),
    };
  }

  const W = viewportSize.width || 1;
  const H = viewportSize.height || 1;
  const showEndpointHandles = debug?.showEndpoints ?? true;
  const selectedGroupPoints = resolvedLines
    .filter((line) => selectedGroupLineIds.includes(line.id))
    .flatMap((line) => [line.from, line.to, ...line.anchorPoints, ...getCustomPathPointsInViewport(line, { width: W, height: H })]);
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
  const selectedLinePoints = selectedLine
    ? [selectedLine.from, selectedLine.to, ...selectedLine.anchorPoints, ...getCustomPathPointsInViewport(selectedLine, { width: W, height: H })]
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

  return (
    <svg
      ref={svgRef}
      className={className}
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
        ...style,
      }}
      onPointerDownCapture={(e) => {
        if (interactive) e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!interactive) return;
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
          const delta = { x: pointer.x - groupDraggingRef.current.x, y: pointer.y - groupDraggingRef.current.y };
          groupDraggingRef.current = pointer;
          onDragGroup?.(delta);
          return;
        }
        if (lineDraggingRef.current) {
          const pointer = pointerToNorm(e);
          const delta = { x: pointer.x - lineDraggingRef.current.point.x, y: pointer.y - lineDraggingRef.current.point.y };
          lineDraggingRef.current.point = pointer;
          onDragLine?.(lineDraggingRef.current.lineId, delta);
          return;
        }
        const anchorDrag = anchorDraggingRef.current;
        if (anchorDrag) {
          if (!showAnchorPointHandles) {
            anchorDraggingRef.current = null;
            return;
          }
          const pointer = pointerToNorm(e);
          onDragAnchorPoint?.(anchorDrag.lineId, anchorDrag.pointId, { x: clamp01(pointer.x + anchorDrag.offset.x), y: clamp01(pointer.y + anchorDrag.offset.y) });
          return;
        }
        const pointDrag = pathDraggingRef.current;
        if (pointDrag) {
          if (!showPathPointHandles) {
            pathDraggingRef.current = null;
            return;
          }
          const pointer = pointerToNorm(e);
          onDragPathPoint?.(pointDrag.lineId, pointDrag.pointId, { x: clamp01(pointer.x + pointDrag.offset.x), y: clamp01(pointer.y + pointDrag.offset.y) });
          return;
        }
        if (!draggingRef.current) return;
        onDragEndpoint?.(draggingRef.current.lineId, draggingRef.current.which, pointerToNorm(e));
      }}
      onPointerUpCapture={() => {
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
          line.texture.enabled ? (
            <filter key={`tex-${line.id}`} id={`${instancePrefix}-magnetic-texture-${line.id}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency={Math.max(0.02, 0.9 * line.texture.scale)}
                numOctaves={2}
                seed={7}
                result="noise"
              />
            </filter>
          ) : null
        )}
        {resolvedLines.map((line) => (
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
                  if (!el) return;
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
        ))}
        {resolvedLines.map((line) => (
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
                  if (!el) return;
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
        ))}
      </defs>

        {visibleLines.map((line) => (
          <mask key={`occlusion-${line.id}`} id={`${instancePrefix}-magnetic-occlusion-${line.id}`} maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000">
            <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
            {visibleLines.filter((higherLine) => higherLine.appearance.zIndex > line.appearance.zIndex).map((higherLine) => (
              <path
                key={`${line.id}:${higherLine.id}`}
                ref={(el) => {
                  if (el) occlusionMaskPathRefs.current.set(`${line.id}:${higherLine.id}`, el);
                }}
                d={`M ${higherLine.from.x * W} ${higherLine.from.y * H} L ${higherLine.to.x * W} ${higherLine.to.y * H}`}
                fill="none"
                stroke="black"
                strokeWidth={higherLine.appearance.width + line.appearance.width + 2}
                strokeLinecap="round"
                opacity={0}
              />
            ))}
          </mask>
        ))}      {visibleLines.map((line) => (
        <g key={line.id} mask={line.occlusion.enabled && visibleLines.some((higherLine) => higherLine.appearance.zIndex > line.appearance.zIndex) ? `url(#${instancePrefix}-magnetic-occlusion-${line.id})` : undefined}>
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
                activateLineAnchors(line.id);
                return;
              }
              if (!line.anchorPoints.some((point) => point.enabled && point.activation === "click")) return;
              event.preventDefault();
              activateLineAnchors(line.id);
            }}
          />
          )}
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => { if (el) outerGlowPathRefs.current.set(line.id, el); }}
            fill="none"
            stroke={`url(#${instancePrefix}-magnetic-outer-glow-${line.id})`}
            strokeWidth={line.appearance.width * 7}
            strokeLinecap="round"
            opacity={0}
            pointerEvents="none"
            style={{ filter: `blur(${4 + line.outerGlow.intensity * 5}px)` }}
          />
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) glowPathRefs.current.set(line.id, el);
            }}
            fill="none"
            stroke={`url(#${instancePrefix}-magnetic-glow-${line.id})`}
            strokeWidth={line.appearance.width * 5}
            strokeLinecap="round"
            opacity={0}
            style={{ filter: `blur(${3 + line.glow.intensity * 4}px)` }}
          />
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) ambientGlowPathRefs.current.set(line.id, el);
            }}
            fill="none"
            stroke={config.cursor.color}
            strokeWidth={line.appearance.width * 5}
            strokeLinecap="round"
            opacity={0}
            pointerEvents="none"
            style={{ filter: `blur(${3 + config.cursor.intensity * 3}px)` }}
          />
          <path
            d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
            ref={(el) => {
              if (el) pathRefs.current.set(line.id, el);
            }}
            fill="none"
            stroke={line.appearance.colorStyle && line.appearance.colorStyle.type !== "solid" && line.appearance.colorStyle.type !== "random" ? `url(#${instancePrefix}-magnetic-line-color-${line.id})` : line.appearance.colorStyle?.type === "random" ? line.appearance.colorStyle.colors[0] ?? line.appearance.color : line.appearance.color || config.global.color}
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
                    groupDraggingRef.current = pointerToNorm(e);
                    onGroupDragStart?.();
                  }
                : interactive && selectedLineId === line.id || !interactive && line.anchorPoints.some((point) => point.enabled && point.activation === "click")
                  ? (e) => {
                      if (interactive) {
                        e.stopPropagation();
                        onSelectLine?.(line.id);
                        lineDraggingRef.current = { lineId: line.id, point: pointerToNorm(e) };
                        onLineDragStart?.(line.id);
                      }
                      activateLineAnchors(line.id);
                    }
                  : undefined
            }
          />
          {line.texture.enabled && (
            <path
              d={`M ${line.from.x * W} ${line.from.y * H} L ${line.to.x * W} ${line.to.y * H}`}
              ref={(el) => {
                if (el) texturePathRefs.current.set(line.id, el);
              }}
              fill="none"
              stroke={line.appearance.colorStyle && line.appearance.colorStyle.type !== "solid" && line.appearance.colorStyle.type !== "random" ? `url(#${instancePrefix}-magnetic-line-color-${line.id})` : line.appearance.colorStyle?.type === "random" ? line.appearance.colorStyle.colors[0] ?? line.appearance.color : line.appearance.color || config.global.color}
              strokeOpacity={line.texture.intensity * 0.45 * line.appearance.opacity}
              strokeWidth={Math.max(0.5, line.appearance.width * (line.texture.type === "fiber" ? 1.2 : 1.5))}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={line.texture.type === "fiber" ? `${Math.max(0.002, line.texture.scale * 0.5)} ${Math.max(0.004, line.texture.scale * 1.5)}` : `${Math.max(0.004, line.texture.scale)} ${Math.max(0.006, line.texture.scale * 0.7)}`}
              strokeDashoffset={-line.textureFlow.offset}
              pointerEvents="none"
            />
          )}

          {interactive && showAnchorPointHandles && selectedLineId === line.id && (() => {
            const activePoints = [...line.anchorPoints]
              .filter((point) => point.enabled)
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
                    const source = getCustomPathPointsInViewport(line, { width: W, height: H }).find((pathPoint) => pathPoint.id === point.pathPointId);
                    if (!source) return null;
                    const points = activePoints
                      .filter((item) => item.endpoint === "path" && item.pathPointId === point.pathPointId)
                      .sort((left, right) => left.order - right.order);
                    const d = [source, ...points]
                      .map((item, index) => `${index === 0 ? "M" : "L"} ${item.x * W} ${item.y * H}`)
                      .join(" ");
                    return <path key={`path-${point.pathPointId}`} d={d} fill="none" stroke="#5ee6ff" strokeOpacity={0.65} strokeDasharray="5 8" strokeWidth={Math.max(1.2, line.appearance.width * 0.7)} strokeLinecap="round" pointerEvents="none" />;
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
                  draggingRef.current = { lineId: line.id, which: "from" };
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
                  draggingRef.current = { lineId: line.id, which: "to" };
                  onDragStart?.(line.id, "to");
                }}
              />
              <text x={line.from.x * W + 9} y={line.from.y * H - 9} fill="#54d6a0" stroke="#0a0b0f" strokeWidth={3} paintOrder="stroke" fontSize={10} pointerEvents="none">Start</text>
              <text x={line.to.x * W + 9} y={line.to.y * H - 9} fill="#b28aff" stroke="#0a0b0f" strokeWidth={3} paintOrder="stroke" fontSize={10} pointerEvents="none">End</text>
            </>
          )}
          {interactive && showAnchorPointHandles && selectedLineId === line.id && line.anchorPoints.map((point) => (
            <g key={point.id}>
              <circle
                cx={point.x * W}
                cy={point.y * H}
                r={selectedAnchorPointId === point.id ? 8 : 6}
                fill={point.endpoint === "start" ? "#f7d974" : point.endpoint === "end" ? "#78aaff" : "#5ee6ff"}
                fillOpacity={point.enabled ? 1 : 0.35}
                stroke={selectedAnchorPointId === point.id ? "#ffffff" : "#0a0b0f"}
                strokeWidth={selectedAnchorPointId === point.id ? 2 : 1.5}
                style={{ pointerEvents: "all", cursor: point.enabled ? "grab" : "pointer" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectLine?.(line.id);
                  onSelectAnchorPoint?.(line.id, point.id);
                  if (point.enabled) {
                    const pointer = pointerToNorm(e);
                    anchorDraggingRef.current = { lineId: line.id, pointId: point.id, offset: { x: point.x - pointer.x, y: point.y - pointer.y } };
                    onDragAnchorStart?.(line.id, point.id);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectAnchorPoint?.(line.id, point.id);
                }}
              />
              <circle
                cx={point.x * W}
                cy={point.y * H}
                r={selectedAnchorPointId === point.id ? 12 : 10}
                fill="transparent"
                stroke={point.endpoint === "start" ? "rgba(247,217,116,0.4)" : point.endpoint === "end" ? "rgba(120,170,255,0.4)" : "rgba(94,230,255,0.4)"}
                strokeWidth={1}
                style={{ pointerEvents: "none" }}
              />
            </g>
          ))}
          {interactive && showPathPointHandles && line.geometrySource === "path" && selectedLineId === line.id && (
            <g>
              {getCustomPathPointsInViewport(line, { width: W, height: H }).map((point, index) => {
                const endpointLabel = index === 0 ? "Start" : index === line.customPath.points.length - 1 ? "End" : null;
                return (
                  <g key={point.id}>
                    <circle
                      cx={point.x * W}
                      cy={point.y * H}
                      r={selectedPathPointId === point.id ? 7 : 5}
                      fill={selectedPathPointId === point.id ? "#5ee6ff" : index === 0 ? "#54d6a0" : index === line.customPath.points.length - 1 ? "#b28aff" : "#f2c27b"}
                      stroke="#0a0b0f"
                      strokeWidth={1.5}
                      style={{ pointerEvents: "all", cursor: "grab" }}
                      onPointerMove={(e) => {
                        const drag = pathDraggingRef.current;
                        if (!drag || drag.pointId !== point.id) return;
                        const pointer = pointerToNorm(e);
                        onDragPathPoint?.(drag.lineId, drag.pointId, { x: clamp01(pointer.x + drag.offset.x), y: clamp01(pointer.y + drag.offset.y) });
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        const pointer = pointerToNorm(e);
                        pathDraggingRef.current = { lineId: line.id, pointId: point.id, offset: { x: point.x - pointer.x, y: point.y - pointer.y } };
                        onSelectLine?.(line.id);
                        onSelectPathPoint?.(line.id, point.id);
                        onPathPointDragStart?.(line.id, point.id);
                      }}
                    />
                    {endpointLabel && (
                      <text
                        x={point.x * W + 8}
                        y={point.y * H - 8}
                        fill={endpointLabel === "Start" ? "#54d6a0" : "#b28aff"}
                        stroke="#0a0b0f"
                        strokeWidth={3}
                        paintOrder="stroke"
                        fontSize={10}
                        pointerEvents="none"
                      >
                        {endpointLabel}
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
              x={selectedGroupBounds.left * W - 8}
              y={selectedGroupBounds.top * H - 8}
              width={Math.max(16, (selectedGroupBounds.right - selectedGroupBounds.left) * W + 16)}
              height={Math.max(16, (selectedGroupBounds.bottom - selectedGroupBounds.top) * H + 16)}
              fill="transparent"
              stroke="#5ee6ff"
              strokeDasharray="2 4"
              strokeWidth={1}
              aria-label="Move group"
              style={{ pointerEvents: "all", cursor: "move" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                groupDraggingRef.current = pointerToNorm(e);
                onGroupDragStart?.();
              }}
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
            x={selectedLineBounds.left * W - 8}
            y={selectedLineBounds.top * H - 8}
            width={Math.max(16, (selectedLineBounds.right - selectedLineBounds.left) * W + 16)}
            height={Math.max(16, (selectedLineBounds.bottom - selectedLineBounds.top) * H + 16)}
            fill="transparent"
            stroke="#5ee6ff"
            strokeDasharray="3 4"
            strokeWidth={1}
            aria-label="Move selected line"
            style={{ pointerEvents: "all", cursor: "move" }}
            onPointerDown={(event) => {
              event.stopPropagation();
              lineDraggingRef.current = { lineId: selectedLine.id, point: pointerToNorm(event) };
              onLineDragStart?.(selectedLine.id);
            }}
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
