import type {
  Point,
  GeneratedShapePreset,
  AppearanceConfig,
  CursorGlowConfig,
  GlowConfig,
  MagneticLineConfig,
  MagneticLineGroup,
  MagneticLinesSceneConfig,
  MagneticTargetConfig,
  MagnetConfig,
  MotionConfig,
  MotionType,
  ShapeConfig,
  ShapeType,
  AnchorMotionConfig,
  AnchorMotionEndpointConfig,
  AnchorTrajectoryType,
  AnchorLoopMode,
  AnchorDirection,
  TextureConfig,
  TextureType,
  TextureFlowConfig,
  TextureFlowDirection,
  CursorInfluenceConfig,
  LineInteractionConfig,
  ConstraintConfig,
  OcclusionConfig,
  CustomPath,
  PathPoint,
} from "../types";
import { normalizeColorWeights } from "../colorWeights";
import { GENERATED_SHAPE_PRESETS } from "./shapePresets";
import { DEFAULT_GLOBAL, DEFAULT_ANIMATION, DEFAULT_CURSOR, DEFAULT_SHAPE, STARTER_LINES } from "../defaultScene";

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (v: unknown, fallback: number): number => {
  const n = num(v, fallback);
  return Math.min(1, Math.max(0, n));
};
const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const motionType = (v: unknown, fallback: MotionType): MotionType =>
  v === "tension" || v === "floating" || v === "vibration" ? v : fallback;
const shapeType = (v: unknown, fallback: ShapeType): ShapeType =>
  v === "straight" || v === "sharp" || v === "rounded" || v === "soft-wave" || v === "organic" || v === "liquid" || v === "floating" || v === "vibration" || v === "pixel" ? v : fallback;

let idCounter = 0;
function uniqueId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

function sanitizePoint(v: unknown): { x: number; y: number } {
  const o = (v ?? {}) as Record<string, unknown>;
  return { x: clamp01(o.x, 0.5), y: clamp01(o.y, 0.5) };
}

function sanitizeCustomPath(v: unknown, from: Point, to: Point): CustomPath {
  const o = (v ?? {}) as Record<string, unknown>;
  const rawPoints = Array.isArray(o.points) ? o.points : [];
  const points: PathPoint[] = rawPoints.map((value, index) => {
    const point = sanitizePoint(value);
    const record = (value ?? {}) as Record<string, unknown>;
    const fallbackId = index === 0 ? "path-start" : index === rawPoints.length - 1 ? "path-end" : uniqueId("path-point");
    return {
      id: str(record.id, fallbackId),
      x: point.x,
      y: point.y,
      ...(record.moveTo === true && index > 0 ? { moveTo: true } : {}),
    };
  });
  const aspectRatio = Number(o.aspectRatio);
  return {
    points: points.length >= 2 ? points : [{ id: "path-start", ...from }, { id: "path-end", ...to }],
    ...(Number.isFinite(aspectRatio) && aspectRatio > 0 ? { aspectRatio } : {}),
  };
}

function sanitizeAppearance(v: unknown): AppearanceConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const color = str(o.color, DEFAULT_GLOBAL.color);
  const rawStyle = (o.colorStyle ?? {}) as Record<string, unknown>;
  const rawColors = Array.isArray(rawStyle.colors) ? rawStyle.colors : [color, "#5ee6ff"];
  const colors = rawColors.slice(0, 6).map((value) => str(value, color));
  while (colors.length < 2) colors.push(color);
  const rawWeights = Array.isArray(rawStyle.colorWeights) ? rawStyle.colorWeights : [];
  const rawPositions = Array.isArray(rawStyle.colorPositions) ? rawStyle.colorPositions : [];
  const legacyWeights = colors.map((_, index) => {
    const position = num(rawPositions[index], (index / Math.max(1, colors.length - 1)) * 100);
    const previousPosition = index === 0 ? 0 : num(rawPositions[index - 1], ((index - 1) / Math.max(1, colors.length - 1)) * 100);
    const nextPosition = index === colors.length - 1 ? 100 : num(rawPositions[index + 1], ((index + 1) / Math.max(1, colors.length - 1)) * 100);
    const leftBoundary = index === 0 ? 0 : (previousPosition + position) / 2;
    const rightBoundary = index === colors.length - 1 ? 100 : (position + nextPosition) / 2;
    return Math.max(0, rightBoundary - leftBoundary);
  });
  const colorWeights = normalizeColorWeights(
    colors.map((_, index) => num(rawWeights[index], legacyWeights[index] ?? 100 / colors.length)),
    colors.length,
  );
  const styleType = rawStyle.type;
  return {
    color,
    colorStyle: {
      type: styleType === "linear" || styleType === "radial" || styleType === "diamond" || styleType === "random" || styleType === "rainbow" ? styleType : "solid",
      colors,
      colorWeights,
      speed: Math.min(10, Math.max(0.1, num(rawStyle.speed, 2.5))),
    },
    opacity: clamp01(o.opacity, DEFAULT_GLOBAL.opacity),
    width: Math.max(0, num(o.width, DEFAULT_GLOBAL.width)),
    zIndex: Math.round(num(o.zIndex, 0)),
  };
}

function sanitizeShape(v: unknown): ShapeConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    type: shapeType(o.type, DEFAULT_SHAPE.type),
    amplitude: Math.max(0, num(o.amplitude, DEFAULT_SHAPE.amplitude)),
    frequency: Math.max(0, num(o.frequency, DEFAULT_SHAPE.frequency)),
    cycles: Math.max(0, num(o.cycles, DEFAULT_SHAPE.cycles)),
    phase: num(o.phase, DEFAULT_SHAPE.phase),
    smoothness: clamp01(o.smoothness, DEFAULT_SHAPE.smoothness),
    irregularity: clamp01(o.irregularity, DEFAULT_SHAPE.irregularity),
    distortion: clamp01(o.distortion, DEFAULT_SHAPE.distortion),
    pixelStep: Math.max(1, Math.min(64, num(o.pixelStep, DEFAULT_SHAPE.pixelStep))),
    roughness: clamp01(o.roughness, DEFAULT_SHAPE.roughness),
  };
}

function sanitizeMotion(v: unknown): MotionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    type: motionType(o.type, DEFAULT_GLOBAL.motionType),
    speed: Math.max(0, num(o.speed, DEFAULT_GLOBAL.speed)),
    amplitude: Math.max(0, num(o.amplitude, DEFAULT_GLOBAL.amplitude)),
    frequency: Math.max(0, num(o.frequency, DEFAULT_GLOBAL.frequency)),
    phase: num(o.phase, 0),
    deformability: clamp01(o.deformability, 0.5),
  };
}

function sanitizeAnchorDirection(v: unknown, fallback: AnchorDirection): AnchorDirection {
  return v === "forward" || v === "reverse" ? v : fallback;
}

function sanitizeAnchorLoopMode(v: unknown, fallback: AnchorLoopMode): AnchorLoopMode {
  return v === "loop" || v === "ping-pong" || v === "once" ? v : fallback;
}

function sanitizeAnchorTrajectory(v: unknown, fallback: AnchorTrajectoryType): AnchorTrajectoryType {
  return v === "static" || v === "circle" || v === "ellipse" || v === "triangle" || v === "rectangle" || v === "linear" ? v : fallback;
}

function sanitizeAnchorEndpoint(v: unknown): AnchorMotionEndpointConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, true),
    trajectory: sanitizeAnchorTrajectory(o.trajectory, "static"),
    speed: Math.max(0, num(o.speed, 0.18)),
    direction: sanitizeAnchorDirection(o.direction, "forward"),
    loopMode: sanitizeAnchorLoopMode(o.loopMode, "loop"),
    offset: clamp01(o.offset, 0),
    radius: Math.max(0, num(o.radius, 0.12)),
    radiusX: Math.max(0, num(o.radiusX, 0.16)),
    radiusY: Math.max(0, num(o.radiusY, 0.1)),
    width: Math.max(0, num(o.width, 0.2)),
    height: Math.max(0, num(o.height, 0.16)),
    rotation: num(o.rotation, 0),
    size: Math.max(0, num(o.size, 0.16)),
  };
}

function sanitizeAnchorMotion(v: unknown): AnchorMotionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    start: sanitizeAnchorEndpoint((o.start ?? {}) as Record<string, unknown>),
    end: sanitizeAnchorEndpoint((o.end ?? {}) as Record<string, unknown>),
  };
}

function sanitizeAnchorPoint(v: unknown, index: number): import("../types").AnchorPoint {
  const o = (v ?? {}) as Record<string, unknown>;
  const type = o.type === "custom" || o.type === "circle" || o.type === "ellipse" || o.type === "square" ? o.type : "custom";
  const pathPointId = typeof o.pathPointId === "string" && o.pathPointId.length > 0 ? o.pathPointId : undefined;
  const endpoint = o.endpoint === "path" && pathPointId
    ? "path"
    : o.endpoint === "end"
      ? "end"
      : "start";
  const behavior = o.behavior === "one-time" ? "one-time" : "loop";
  const activation = o.activation === "hover" || o.activation === "click" ? o.activation : "always";
  const hoverExitBehavior = o.hoverExitBehavior === "stay" || o.hoverExitBehavior === "return" ? o.hoverExitBehavior : "continue";
  const finishBehavior = o.finishBehavior === "return" ? "return" : "stay";
  const clickBehavior = o.clickBehavior === "toggle" ? "toggle" : "restart";
  const easing = o.easing === "linear" || o.easing === "ease-in" || o.easing === "ease-out" ? o.easing : "ease-in-out";
  return {
    id: typeof o.id === "string" && o.id.length > 0 ? o.id : `anchor-${endpoint}-${index}-${Date.now().toString(36)}`,
    endpoint,
    ...(endpoint === "path" && pathPointId ? { pathPointId } : {}),
    type,
    enabled: typeof o.enabled === "boolean" ? o.enabled : true,
    speed: Math.max(0.05, Number.isFinite(Number(o.speed)) ? Number(o.speed) : 1),
    order: Math.max(0, Math.round(Number.isFinite(Number(o.order)) ? Number(o.order) : index)),
    loop: typeof o.loop === "boolean" ? o.loop : behavior === "loop",
    behavior,
    activation,
    hoverExitBehavior,
    finishBehavior,
    clickBehavior,
    easing,
    x: clamp01(o.x, 0.5),
    y: clamp01(o.y, 0.5),
    radius: Math.max(0, Number.isFinite(Number(o.radius)) ? Number(o.radius) : 0.12),
    radiusX: Math.max(0, Number.isFinite(Number(o.radiusX)) ? Number(o.radiusX) : 0.16),
    radiusY: Math.max(0, Number.isFinite(Number(o.radiusY)) ? Number(o.radiusY) : 0.1),
    rotation: Number.isFinite(Number(o.rotation)) ? Number(o.rotation) : 0,
    size: Math.max(0, Number.isFinite(Number(o.size)) ? Number(o.size) : 0.16),
  };
}

function sanitizeAnchorPoints(v: unknown): import("../types").AnchorPoint[] {
  const arr = Array.isArray(v) ? v : [];
  const points = arr.map((item, index) => sanitizeAnchorPoint(item, index));
  const normalizedOrder = new Map<number, number>();
  const groups = new Map<string, number[]>();
  points.forEach((point, index) => {
    const key = `${point.endpoint}:${point.endpoint === "path" ? point.pathPointId : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  for (const indices of groups.values()) {
    points
      .map((point, index) => ({ point, index }))
      .filter(({ index }) => indices.includes(index))
      .sort((left, right) => left.point.order - right.point.order || left.index - right.index)
      .forEach(({ index }, order) => normalizedOrder.set(index, order));
  }
  return points.map((point, index) => ({ ...point, order: normalizedOrder.get(index) ?? point.order }));
}
function sanitizeMagnet(v: unknown): MagnetConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    targetId: typeof o.targetId === "string" && o.targetId.length > 0 ? o.targetId : null,
    enabled: bool(o.enabled, true),
    strength: clamp01(o.strength, DEFAULT_GLOBAL.strength),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.radius)),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.falloff),
    maxDeformation: Math.max(0, num(o.maxDeformation, DEFAULT_GLOBAL.maxDeformation)),
  };
}

function sanitizeGlow(v: unknown): GlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, true),
    color: str(o.color, DEFAULT_GLOBAL.glowColor),
    intensity: clamp01(o.intensity, DEFAULT_GLOBAL.glowIntensity),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.glowRadius)),
    length: clamp01(o.length, DEFAULT_GLOBAL.glowLength),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.glowFalloff),
  };
}

function sanitizeOuterGlow(v: unknown): GlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, DEFAULT_GLOBAL.outerGlowEnabled),
    color: str(o.color, DEFAULT_GLOBAL.outerGlowColor),
    intensity: clamp01(o.intensity, DEFAULT_GLOBAL.outerGlowIntensity),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.outerGlowRadius)),
    length: clamp01(o.length, DEFAULT_GLOBAL.glowLength),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.outerGlowFalloff),
  };
}

function sanitizeCursorGlow(v: unknown): CursorGlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return { enabled: bool(o.enabled, true) };
}

function textureType(v: unknown, fallback: TextureType): TextureType {
  return v === "grain" || v === "fiber" ? v : fallback;
}

function textureFlowDirection(v: unknown, fallback: TextureFlowDirection): TextureFlowDirection {
  return v === "forward" || v === "reverse" ? v : fallback;
}

function sanitizeConstraint(v: unknown): ConstraintConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    maxDeformation: Math.max(0, num(o.maxDeformation, DEFAULT_GLOBAL.constraint.maxDeformation)),
    boundary: o.boundary === "viewport" ? "viewport" : "none",
    padding: Math.max(0, num(o.padding, DEFAULT_GLOBAL.constraint.padding)),
  };
}

function sanitizeOcclusion(v: unknown): OcclusionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return { enabled: bool(o.enabled, DEFAULT_GLOBAL.occlusion.enabled) };
}

function sanitizeLineInteraction(v: unknown): LineInteractionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    strength: clamp01(o.strength, DEFAULT_GLOBAL.lineInteraction.strength),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.lineInteraction.radius)),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.lineInteraction.falloff),
    mode: "avoid",
  };
}

function sanitizeCursorInfluence(v: unknown): CursorInfluenceConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    strength: clamp01(o.strength, DEFAULT_GLOBAL.cursorInfluence.strength),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.cursorInfluence.radius)),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.cursorInfluence.falloff),
    maxDeformation: Math.max(0, num(o.maxDeformation, DEFAULT_GLOBAL.cursorInfluence.maxDeformation)),
    mode: "attract",
  };
}

function sanitizeTextureFlow(v: unknown): TextureFlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    speed: Math.min(4, Math.max(0, num(o.speed, DEFAULT_GLOBAL.textureFlow.speed))),
    direction: textureFlowDirection(o.direction, DEFAULT_GLOBAL.textureFlow.direction),
    offset: ((num(o.offset, DEFAULT_GLOBAL.textureFlow.offset) % 1) + 1) % 1,
  };
}

function sanitizeTexture(v: unknown): TextureConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    type: textureType(o.type, DEFAULT_GLOBAL.textureType),
    scale: Math.max(0.001, num(o.scale, DEFAULT_GLOBAL.textureScale)),
    intensity: clamp01(o.intensity, DEFAULT_GLOBAL.textureIntensity),
  };
}

export function sanitizeLine(v: unknown): MagneticLineConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const from = sanitizePoint(o.from);
  const to = sanitizePoint(o.to);
  const customPath = sanitizeCustomPath(o.customPath, from, to);
  const anchorPoints = sanitizeAnchorPoints(o.anchorPoints)
    .filter((point) => point.endpoint !== "path" || customPath.points.some((pathPoint) => pathPoint.id === point.pathPointId));
  return {
    id: str(o.id, uniqueId("line")),
    enabled: bool(o.enabled, true),
    visible: bool(o.visible, true),
    from,
    geometrySource: o.geometrySource === "path" ? "path" : "shape",
    generatedShapePreset: GENERATED_SHAPE_PRESETS.includes(o.generatedShapePreset as GeneratedShapePreset) ? o.generatedShapePreset as GeneratedShapePreset : undefined,
    lineTransform: (() => {
      const transform = (o.lineTransform ?? {}) as Record<string, unknown>;
      return {
        scaleX: Math.max(-5, Math.min(5, num(transform.scaleX, 1))),
        scaleY: Math.max(-5, Math.min(5, num(transform.scaleY, 1))),
        rotation: num(transform.rotation, 0),
      };
    })(),
    to,
    customPath,
    anchorPoints,
    appearance: sanitizeAppearance(o.appearance),
    shape: sanitizeShape(o.shape),
    anchorMotion: sanitizeAnchorMotion(o.anchorMotion),
    inherit: {
      appearance: (o.inherit as Record<string, unknown> | undefined)?.appearance !== false,
      shape: (o.inherit as Record<string, unknown> | undefined)?.shape !== false,
      motion: (o.inherit as Record<string, unknown> | undefined)?.motion !== false,
      anchorMotion: (o.inherit as Record<string, unknown> | undefined)?.anchorMotion !== false,
      magnet: (o.inherit as Record<string, unknown> | undefined)?.magnet !== false,
      glow: (o.inherit as Record<string, unknown> | undefined)?.glow !== false,
      outerGlow: (o.inherit as Record<string, unknown> | undefined)?.outerGlow !== false,
      texture: (o.inherit as Record<string, unknown> | undefined)?.texture !== false,
      textureFlow: (o.inherit as Record<string, unknown> | undefined)?.textureFlow !== false,
      cursorInfluence: (o.inherit as Record<string, unknown> | undefined)?.cursorInfluence !== false,
      lineInteraction: (o.inherit as Record<string, unknown> | undefined)?.lineInteraction !== false,
      constraint: (o.inherit as Record<string, unknown> | undefined)?.constraint !== false,
      occlusion: (o.inherit as Record<string, unknown> | undefined)?.occlusion !== false,
    },
    motion: sanitizeMotion(o.motion),
    startDelay: Math.min(60, Math.max(0, num(o.startDelay, 0))),
    magnet: sanitizeMagnet(o.magnet),
    glow: sanitizeGlow(o.glow),
    outerGlow: sanitizeOuterGlow((o.outerGlow ?? o.glow) as Record<string, unknown>),
    cursorGlow: sanitizeCursorGlow(o.cursorGlow),
    texture: sanitizeTexture(o.texture),
    textureFlow: sanitizeTextureFlow(o.textureFlow),
    cursorInfluence: sanitizeCursorInfluence(o.cursorInfluence),
    lineInteraction: sanitizeLineInteraction(o.lineInteraction),
    constraint: sanitizeConstraint(o.constraint),
    occlusion: sanitizeOcclusion(o.occlusion),
  };
}

function sanitizeTarget(v: unknown): MagneticTargetConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: str(o.id, uniqueId("target")),
    enabled: bool(o.enabled, true),
    magnetic: bool(o.magnetic, true),
    strength: Math.max(0, num(o.strength, 1)),
    radius: Math.max(0, num(o.radius, 0)),
    priority: num(o.priority, 0),
  };
}

/** Validates and clamps an arbitrary (e.g. imported) value into a safe scene config. Never throws. */
export function sanitizeSceneConfig(v: unknown): MagneticLinesSceneConfig {
  try {
    const o = (v ?? {}) as Record<string, unknown>;
    const g = (o.global ?? {}) as Record<string, unknown>;
    const a = (o.animation ?? {}) as Record<string, unknown>;
    const c = (o.cursor ?? {}) as Record<string, unknown>;

    const sourceVersion = Math.round(num(o.version, 1));
    const lines = Array.isArray(o.lines) && o.lines.length > 0 ? o.lines.map(sanitizeLine) : STARTER_LINES;
    if (sourceVersion < 2) {
      for (const line of lines) line.inherit = { appearance: true, shape: true, motion: true, anchorMotion: true, magnet: true, glow: true, outerGlow: true, texture: true, textureFlow: true, cursorInfluence: true, lineInteraction: true, constraint: true, occlusion: true };
    }
    const targets = Array.isArray(o.targets) ? o.targets.map(sanitizeTarget) : [];

    // Ensure unique IDs.
    const seen = new Set<string>();
    const targetIds = new Set<string>();
    for (const target of targets) {
      while (targetIds.has(target.id)) target.id = uniqueId("target");
      targetIds.add(target.id);
    }
    for (const line of lines) {
      while (seen.has(line.id)) line.id = uniqueId("line");
      seen.add(line.id);
      const pointIds = new Set<string>();
      for (const point of line.customPath.points) {
        while (pointIds.has(point.id)) point.id = uniqueId("path-point");
        pointIds.add(point.id);
      }
    }
    const groupedLineIds = new Set<string>();
    const seenGroupIds = new Set<string>();
    const groups: MagneticLineGroup[] = [];
    for (const value of Array.isArray(o.groups) ? o.groups : []) {
        const source = (value ?? {}) as Record<string, unknown>;
        const lineIds = Array.isArray(source.lineIds)
          ? Array.from(new Set(source.lineIds.filter((id): id is string => typeof id === "string" && seen.has(id) && !groupedLineIds.has(id))))
          : [];
        if (lineIds.length < 2) continue;
        let id = str(source.id, uniqueId("group"));
        while (seenGroupIds.has(id)) id = uniqueId("group");
        seenGroupIds.add(id);
        lineIds.forEach((lineId) => groupedLineIds.add(lineId));
        groups.push({
          id,
          name: str(source.name, "Group"),
          lineIds,
          scale: Math.min(5, Math.max(0.1, num(source.scale, 1))),
          rotation: num(source.rotation, 0),
          scaleX: Math.max(-5, Math.min(5, num(source.scaleX, 1))),
          scaleY: Math.max(-5, Math.min(5, num(source.scaleY, 1))),
        });
    }

    return {
      version: Math.max(3, sourceVersion),
      global: {
        color: str(g.color, DEFAULT_GLOBAL.color),
        colorStyle: sanitizeAppearance({ color: str(g.color, DEFAULT_GLOBAL.color), colorStyle: g.colorStyle }).colorStyle,
        opacity: clamp01(g.opacity, DEFAULT_GLOBAL.opacity),
        width: Math.max(0, num(g.width, DEFAULT_GLOBAL.width)),
        motionType: motionType(g.motionType, DEFAULT_GLOBAL.motionType),
        speed: Math.max(0, num(g.speed, DEFAULT_GLOBAL.speed)),
        amplitude: Math.max(0, num(g.amplitude, DEFAULT_GLOBAL.amplitude)),
        frequency: Math.max(0, num(g.frequency, DEFAULT_GLOBAL.frequency)),
        phase: num(g.phase, DEFAULT_GLOBAL.phase),
        deformability: clamp01(g.deformability, DEFAULT_GLOBAL.deformability),
        shape: sanitizeShape(g.shape),
        magnetismEnabled: bool(g.magnetismEnabled, DEFAULT_GLOBAL.magnetismEnabled),
        targetId: typeof g.targetId === "string" && g.targetId.length > 0 ? g.targetId : null,
        strength: clamp01(g.strength, DEFAULT_GLOBAL.strength),
        radius: Math.max(0, num(g.radius, DEFAULT_GLOBAL.radius)),
        falloff: clamp01(g.falloff, DEFAULT_GLOBAL.falloff),
        maxDeformation: Math.max(0, num(g.maxDeformation, DEFAULT_GLOBAL.maxDeformation)),
        glowEnabled: bool(g.glowEnabled, DEFAULT_GLOBAL.glowEnabled),
        glowColor: str(g.glowColor, DEFAULT_GLOBAL.glowColor),
        glowIntensity: clamp01(g.glowIntensity, DEFAULT_GLOBAL.glowIntensity),
        glowRadius: Math.max(0, num(g.glowRadius, DEFAULT_GLOBAL.glowRadius)),
        glowLength: clamp01(g.glowLength, DEFAULT_GLOBAL.glowLength),
        glowFalloff: clamp01(g.glowFalloff, DEFAULT_GLOBAL.glowFalloff),
        glowMaxCombinedIntensity: clamp01(g.glowMaxCombinedIntensity, DEFAULT_GLOBAL.glowMaxCombinedIntensity),
        outerGlowEnabled: bool(g.outerGlowEnabled, DEFAULT_GLOBAL.outerGlowEnabled),
        outerGlowColor: str(g.outerGlowColor, DEFAULT_GLOBAL.outerGlowColor),
        outerGlowIntensity: clamp01(g.outerGlowIntensity, DEFAULT_GLOBAL.outerGlowIntensity),
        outerGlowRadius: Math.max(0, num(g.outerGlowRadius, DEFAULT_GLOBAL.outerGlowRadius)),
        outerGlowLength: clamp01(g.outerGlowLength, DEFAULT_GLOBAL.outerGlowLength),
        outerGlowFalloff: clamp01(g.outerGlowFalloff, DEFAULT_GLOBAL.outerGlowFalloff),
        textureEnabled: bool(g.textureEnabled, DEFAULT_GLOBAL.textureEnabled),
        textureType: textureType(g.textureType, DEFAULT_GLOBAL.textureType),
        textureScale: Math.max(0.001, num(g.textureScale, DEFAULT_GLOBAL.textureScale)),
        textureIntensity: clamp01(g.textureIntensity, DEFAULT_GLOBAL.textureIntensity),
        textureFlow: sanitizeTextureFlow(g.textureFlow),
        cursorInfluence: sanitizeCursorInfluence(g.cursorInfluence),
        lineInteraction: sanitizeLineInteraction(g.lineInteraction),
        constraint: sanitizeConstraint(g.constraint),
        occlusion: sanitizeOcclusion(g.occlusion),
      },
      animation: {
        playing: bool(a.playing, DEFAULT_ANIMATION.playing),
        speedMultiplier: Math.min(4, Math.max(0.1, num(a.speedMultiplier, 1))),
        reducedMotion:
          a.reducedMotion === "on" || a.reducedMotion === "off" ? a.reducedMotion : DEFAULT_ANIMATION.reducedMotion,
      },
      cursor: {
        enabled: bool(c.enabled, DEFAULT_CURSOR.enabled),
        color: str(c.color, DEFAULT_CURSOR.color),
        intensity: clamp01(c.intensity, DEFAULT_CURSOR.intensity),
        radius: Math.max(0, num(c.radius, DEFAULT_CURSOR.radius)),
        falloff: clamp01(c.falloff, DEFAULT_CURSOR.falloff),
        smoothing: clamp01(c.smoothing, DEFAULT_CURSOR.smoothing),
        releaseSpeed: clamp01(c.releaseSpeed, DEFAULT_CURSOR.releaseSpeed),
        length: clamp01(c.length, DEFAULT_CURSOR.length),
        opacity: clamp01(c.opacity, DEFAULT_CURSOR.opacity),
        maxIntensity: clamp01(c.maxIntensity, DEFAULT_CURSOR.maxIntensity),
      },
      lines,
      groups,
      targets,
    };
  } catch {
    return {
      version: 3,
      global: DEFAULT_GLOBAL,
      animation: DEFAULT_ANIMATION,
      cursor: DEFAULT_CURSOR,
      lines: STARTER_LINES,
      groups: [],
      targets: [],
    };
  }
}

export function makeBlankLine(): MagneticLineConfig {
  return sanitizeLine({
    id: uniqueId("line"),
    from: { x: 0.3, y: 0.3 },
    to: { x: 0.7, y: 0.5 },
  });
}

export function duplicateLine(l: MagneticLineConfig): MagneticLineConfig {
  return { ...sanitizeLine(l), id: uniqueId("line") };
}
