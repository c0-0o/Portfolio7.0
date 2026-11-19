import type {
  AnchorPoint,
  Point,
  GeneratedShapePreset,
  AppearanceConfig,
  CursorGlowConfig,
  GlobalSettings,
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
  FlowConfig,
  FlowDirection,
  FlowEffectType,
  FlowPlacement,
  AirflowBehavior,
  EnvironmentLightConfig,
  CursorInfluenceConfig,
  LineInteractionConfig,
  ConstraintConfig,
  GravityConfig,
  EnvironmentMode,
  OcclusionConfig,
  CustomPath,
  PathPoint,
} from "./types";
import { normalizeColorWeights } from "./colorWeights";
import { GENERATED_SHAPE_PRESETS } from "./shapePresets";
import { DEFAULT_GLOBAL, DEFAULT_FLOW, DEFAULT_LINE_ENVIRONMENT, DEFAULT_LINE_GRAVITY, DEFAULT_ANCHOR_MOTION, DEFAULT_ANIMATION, DEFAULT_CURSOR, DEFAULT_SHAPE, STARTER_LINES } from "./defaultScene";

const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const glowNumber = (v: unknown, fallback: number, isLegacy: boolean): number =>
  Math.min(100, Math.max(0, num(v, fallback) * (isLegacy && typeof v === "number" ? 100 : 1)));
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
  const curveSmoothing = clamp01(o.curveSmoothing, 0);
  const aspectRatioMode = o.aspectRatioMode === "artboard" ? "artboard" : undefined;
  const aspectRatioAlignY = o.aspectRatioAlignY === "bottom" ? "bottom" : o.aspectRatioAlignY === "top" ? "top" : undefined;
  return {
    points: points.length >= 2 ? points : [{ id: "path-start", ...from }, { id: "path-end", ...to }],
    curveSmoothing,
    closedJoint: o.closedJoint === "breakable" ? "breakable" : "connected",
    ...(Number.isFinite(aspectRatio) && aspectRatio > 0 ? { aspectRatio } : {}),
    ...(aspectRatioMode ? { aspectRatioMode } : {}),
    ...(aspectRatioAlignY ? { aspectRatioAlignY } : {}),
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
    bendable: bool(o.bendable, DEFAULT_SHAPE.bendable ?? true),
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
    enabled: bool(o.enabled, true),
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

function sanitizeAnchorPoint(v: unknown, index: number): AnchorPoint {
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
    delay: Math.min(9999999, Math.max(0, Number.isFinite(Number(o.delay)) ? Number(o.delay) : 0)),
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

function sanitizeAnchorPoints(v: unknown): AnchorPoint[] {
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
    strength: Math.min(100, Math.max(0, num(o.strength, DEFAULT_GLOBAL.strength))),
    radius: Math.min(100, Math.max(0, num(o.radius, DEFAULT_GLOBAL.radius))),
    falloff: Math.min(100, Math.max(0, num(o.falloff, DEFAULT_GLOBAL.falloff))),
    maxDeformation: Math.min(100, Math.max(0, num(o.maxDeformation, DEFAULT_GLOBAL.maxDeformation))),
  };
}

function sanitizeGlow(v: unknown): GlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const color = str(o.color, DEFAULT_GLOBAL.glowColor);
  return {
    enabled: bool(o.enabled, true),
    color,
    colorStyle: sanitizeAppearance({ color, colorStyle: o.colorStyle }).colorStyle,
    intensity: Math.min(100, Math.max(0, num(o.intensity, DEFAULT_GLOBAL.glowIntensity))),
    opacity: Math.min(100, Math.max(0, num(o.opacity, 100))),
    radius: Math.min(100, Math.max(0, num(o.radius, DEFAULT_GLOBAL.glowRadius))),
    length: Math.min(100, Math.max(0, num(o.length, DEFAULT_GLOBAL.glowLength))),
    falloff: Math.min(100, Math.max(0, num(o.falloff, DEFAULT_GLOBAL.glowFalloff))),
  };
}

function sanitizeOuterGlow(v: unknown): GlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const color = str(o.color, DEFAULT_GLOBAL.outerGlowColor);
  return {
    enabled: bool(o.enabled, DEFAULT_GLOBAL.outerGlowEnabled),
    color,
    colorStyle: sanitizeAppearance({ color, colorStyle: o.colorStyle }).colorStyle,
    intensity: Math.min(100, Math.max(0, num(o.intensity, DEFAULT_GLOBAL.outerGlowIntensity))),
    opacity: Math.min(100, Math.max(0, num(o.opacity, 100))),
    radius: Math.min(100, Math.max(0, num(o.radius, DEFAULT_GLOBAL.outerGlowRadius))),
    length: Math.min(100, Math.max(0, num(o.length, DEFAULT_GLOBAL.outerGlowLength))),
    falloff: Math.min(100, Math.max(0, num(o.falloff, DEFAULT_GLOBAL.outerGlowFalloff))),
  };
}

function scaleLegacyGlowValues(target: GlowConfig, source: Record<string, unknown>) {
  for (const key of ["intensity", "length", "falloff"] as const) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      target[key] = Math.min(100, Math.max(0, value * 100));
    }
  }
}

function sanitizeCursorGlow(v: unknown): CursorGlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return { enabled: bool(o.enabled, true) };
}

function textureType(v: unknown, fallback: TextureType): TextureType {
  return v === "grain" || v === "fiber" || v === "silk" || v === "rope" || v === "beads" || v === "metal" ? v : fallback;
}

function sanitizeFlow(v: unknown): FlowConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const colors = Array.isArray(o.colors)
    ? o.colors.filter((color): color is string => typeof color === "string" && color.length > 0).slice(0, 8)
    : [];
  const layers = (o.layers ?? {}) as Record<string, unknown>;
  const supportedEffects: FlowEffectType[] = ["electric-current", "continuous-light", "plasma", "fiber-optic", "energy-pulse"];
  const effectType = supportedEffects.includes(o.effectType as FlowEffectType)
    ? o.effectType as FlowEffectType
    : DEFAULT_FLOW.effectType;
  const directions: FlowDirection[] = ["forward", "reverse", "both", "alternating"];
  const placements: FlowPlacement[] = ["inside", "along", "around", "outside", "mixed"];
  return {
    enabled: bool(o.enabled, DEFAULT_FLOW.enabled),
    effectType,
    pulseRhythm: o.pulseRhythm === "heartbeat" ? "heartbeat" : "continuous",
    preset: typeof o.preset === "string" && o.preset.length <= 80 ? o.preset : null,
    speed: Math.min(8, Math.max(0, num(o.speed, DEFAULT_FLOW.speed))),
    colorSpeed: Math.min(4, Math.max(0, num(o.colorSpeed, DEFAULT_FLOW.colorSpeed))),
    direction: directions.includes(o.direction as FlowDirection) ? o.direction as FlowDirection : DEFAULT_FLOW.direction,
    intensity: Math.min(2, Math.max(0, num(o.intensity, DEFAULT_FLOW.intensity))),
    width: Math.min(16, Math.max(0.1, num(o.width, DEFAULT_FLOW.width))),
    coreWidth: Math.min(8, Math.max(0.1, num(o.coreWidth, DEFAULT_FLOW.coreWidth))),
    glowWidth: Math.min(32, Math.max(0, num(o.glowWidth, DEFAULT_FLOW.glowWidth))),
    opacity: clamp01(o.opacity, DEFAULT_FLOW.opacity),
    colors: colors.length ? colors : [...DEFAULT_FLOW.colors],
    coreColor: str(o.coreColor, DEFAULT_FLOW.coreColor),
    glowColor: str(o.glowColor, DEFAULT_FLOW.glowColor),
    streamCount: Math.min(3, Math.max(1, Math.round(num(o.streamCount, DEFAULT_FLOW.streamCount)))),
    phase: ((num(o.phase, DEFAULT_FLOW.phase) % 1) + 1) % 1,
    placement: placements.includes(o.placement as FlowPlacement) ? o.placement as FlowPlacement : DEFAULT_FLOW.placement,
    layers: {
      current: bool(layers.current, DEFAULT_FLOW.layers.current),
      core: bool(layers.core, DEFAULT_FLOW.layers.core),
      secondary: bool(layers.secondary, DEFAULT_FLOW.layers.secondary),
      glow: bool(layers.glow, DEFAULT_FLOW.layers.glow),
      branches: bool(layers.branches, DEFAULT_FLOW.layers.branches),
      sparks: bool(layers.sparks, DEFAULT_FLOW.layers.sparks),
    },
    branchFrequency: clamp01(o.branchFrequency, DEFAULT_FLOW.branchFrequency),
    branchLength: Math.min(0.5, Math.max(0, num(o.branchLength, DEFAULT_FLOW.branchLength))),
    sparkDensity: Math.min(4, Math.max(0, num(o.sparkDensity, DEFAULT_FLOW.sparkDensity))),
    flicker: clamp01(o.flicker, DEFAULT_FLOW.flicker),
    turbulence: clamp01(o.turbulence, DEFAULT_FLOW.turbulence),
    strandCount: Math.min(7, Math.max(1, Math.round(num(o.strandCount, DEFAULT_FLOW.strandCount)))),
    pulseWidth: Math.min(0.75, Math.max(0.02, num(o.pulseWidth, DEFAULT_FLOW.pulseWidth))),
    tailLength: Math.min(0.75, Math.max(0.02, num(o.tailLength, DEFAULT_FLOW.tailLength))),
  };
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

function sanitizeGravity(v: unknown, customPath: CustomPath): GravityConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const rawIds = Array.isArray(o.fixedPointIds) ? o.fixedPointIds : DEFAULT_LINE_GRAVITY.fixedPointIds;
  const validIds = new Set(["start", "end", ...customPath.points.map((point) => point.id)]);
  return {
    enabled: bool(o.enabled, DEFAULT_LINE_GRAVITY.enabled),
    strength: Math.min(1.5, Math.max(0, num(o.strength, DEFAULT_LINE_GRAVITY.strength))),
    fixedPointIds: [...new Set(rawIds.filter((id): id is string => typeof id === "string" && validIds.has(id)))],
  };
}

function sanitizeOcclusion(v: unknown): OcclusionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, DEFAULT_GLOBAL.occlusion.enabled),
    gapWidth: Math.min(24, Math.max(0, num(o.gapWidth, DEFAULT_GLOBAL.occlusion.gapWidth))),
  };
}

function sanitizeLineInteraction(v: unknown): LineInteractionConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    strength: clamp01(o.strength, DEFAULT_GLOBAL.lineInteraction.strength),
    clearance: Math.min(0.1, Math.max(0, num(o.clearance, DEFAULT_GLOBAL.lineInteraction.clearance))),
    radius: Math.max(0, num(o.radius, DEFAULT_GLOBAL.lineInteraction.radius)),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.lineInteraction.falloff),
    mode: "avoid",
  };
}

function sanitizeCursorInfluence(v: unknown): CursorInfluenceConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    strength: Math.min(2, Math.max(0, num(o.strength, DEFAULT_GLOBAL.cursorInfluence.strength))),
    radius: Math.min(1, Math.max(0, num(o.radius, DEFAULT_GLOBAL.cursorInfluence.radius))),
    falloff: clamp01(o.falloff, DEFAULT_GLOBAL.cursorInfluence.falloff),
    maxDeformation: Math.min(0.5, Math.max(0, num(o.maxDeformation, DEFAULT_GLOBAL.cursorInfluence.maxDeformation))),
    profile: o.profile === "soft" || o.profile === "focused" ? o.profile : "balanced",
    smoothing: clamp01(o.smoothing, DEFAULT_GLOBAL.cursorInfluence.smoothing),
    mode: o.mode === "repel" ? "repel" : "attract",
  };
}

function sanitizeTexture(v: unknown): TextureConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: bool(o.enabled, false),
    type: textureType(o.type, DEFAULT_GLOBAL.textureType),
    scale: Math.max(0.001, num(o.scale, DEFAULT_GLOBAL.textureScale)),
    intensity: clamp01(o.intensity, DEFAULT_GLOBAL.textureIntensity),
    showThread: bool(o.showThread, DEFAULT_GLOBAL.textureShowThread),
    weight: Math.min(4, Math.max(0.1, num(o.weight, DEFAULT_GLOBAL.textureWeight))),
    silkStrands: Math.min(24, Math.max(1, Math.round(num(o.silkStrands, DEFAULT_GLOBAL.textureSilkStrands)))),
  };
}

function sanitizeEnvironment(v: unknown): GlobalSettings["environment"] {
  const o = (v ?? {}) as Record<string, unknown>;
  const position = (o.lightPosition ?? {}) as Record<string, unknown>;
  const path = Array.isArray(o.airflowPath) ? o.airflowPath.slice(0, 128) : [];
  const airflowPaths = Array.isArray(o.airflowPaths)
    ? o.airflowPaths.slice(0, 8).map((rawPath) => Array.isArray(rawPath)
      ? rawPath.slice(0, 128).map((point) => {
          const p = (point ?? {}) as Record<string, unknown>;
          return { x: clamp01(p.x, 0), y: clamp01(p.y, 0) };
        })
      : [])
    : undefined;
  const airflowRadius = Math.min(1, Math.max(0.005, num(o.airflowRadius, DEFAULT_GLOBAL.environment.airflowRadius)));
  const airflowPathCount = (airflowPaths ?? (path.length > 0 ? [path] : [])).length;
  const rawAirflowRadii = Array.isArray(o.airflowRadii) ? o.airflowRadii : undefined;
  const airflowRadii = rawAirflowRadii
    ? Array.from({ length: airflowPathCount }, (_, index) =>
        Math.min(1, Math.max(0.005, num(rawAirflowRadii[index], airflowRadius))))
    : Array.from({ length: airflowPathCount }, () => airflowRadius);
  const legacyLight: EnvironmentLightConfig = {
    id: "global-light",
    color: str(o.lightColor, DEFAULT_GLOBAL.environment.lightColor),
    position: {
      x: clamp01(position.x, DEFAULT_GLOBAL.environment.lightPosition.x),
      y: clamp01(position.y, DEFAULT_GLOBAL.environment.lightPosition.y),
    },
    endPosition: {
      x: clamp01(position.x, DEFAULT_GLOBAL.environment.lightPosition.x),
      y: clamp01(position.y, DEFAULT_GLOBAL.environment.lightPosition.y),
    },
    intensity: clamp01(o.lightIntensity, DEFAULT_GLOBAL.environment.lightIntensity),
    radius: Math.min(1, Math.max(0.05, num(o.lightRadius, DEFAULT_GLOBAL.environment.lightRadius))),
    speed: 0,
    playback: "loop",
  };
  const lights = sanitizeEnvironmentLights(o.lights, legacyLight);
  return {
    enabled: bool(o.enabled, DEFAULT_GLOBAL.environment.enabled),
    airflowEnabled: bool(o.airflowEnabled, DEFAULT_GLOBAL.environment.airflowEnabled),
    airflowBehavior: airflowBehavior(o.airflowBehavior, DEFAULT_GLOBAL.environment.airflowBehavior),
    airflowPath: path.map((point) => {
      const p = (point ?? {}) as Record<string, unknown>;
      return { x: clamp01(p.x, 0), y: clamp01(p.y, 0) };
    }),
    airflowPaths,
    airflowRadii,
    airflowSpeed: Math.min(4, Math.max(0, num(o.airflowSpeed, DEFAULT_GLOBAL.environment.airflowSpeed))),
    airflowStrength: Math.min(2, Math.max(0, num(o.airflowStrength, DEFAULT_GLOBAL.environment.airflowStrength))),
    airflowRadius,
    lightEnabled: bool(o.lightEnabled, DEFAULT_GLOBAL.environment.lightEnabled),
    lightColor: str(o.lightColor, DEFAULT_GLOBAL.environment.lightColor),
    lightPosition: {
      x: clamp01(position.x, DEFAULT_GLOBAL.environment.lightPosition.x),
      y: clamp01(position.y, DEFAULT_GLOBAL.environment.lightPosition.y),
    },
    lightIntensity: clamp01(o.lightIntensity, DEFAULT_GLOBAL.environment.lightIntensity),
    lightRadius: Math.min(1, Math.max(0.05, num(o.lightRadius, DEFAULT_GLOBAL.environment.lightRadius))),
    lights,
  };
}

function sanitizeEnvironmentLight(v: unknown, index: number, fallback: EnvironmentLightConfig): EnvironmentLightConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const position = (o.position ?? fallback.position) as Record<string, unknown>;
  const endPosition = (o.endPosition ?? position) as Record<string, unknown>;
  return {
    id: str(o.id, `light-${index + 1}`),
    color: str(o.color, fallback.color),
    position: { x: clamp01(position.x, fallback.position.x), y: clamp01(position.y, fallback.position.y) },
    endPosition: { x: clamp01(endPosition.x, fallback.position.x), y: clamp01(endPosition.y, fallback.position.y) },
    intensity: clamp01(o.intensity, fallback.intensity),
    radius: Math.min(1, Math.max(0.05, num(o.radius, fallback.radius))),
    speed: Math.min(4, Math.max(0, num(o.speed, 0.15))),
    playback: o.playback === "once" ? "once" : "loop",
  };
}

function sanitizeEnvironmentLights(value: unknown, fallback: EnvironmentLightConfig): EnvironmentLightConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = new Set<string>();
  return value.slice(0, 8).map((light, index) => {
    const sanitized = sanitizeEnvironmentLight(light, index, fallback);
    let id = sanitized.id;
    let suffix = 2;
    while (ids.has(id)) id = `${sanitized.id}-${suffix++}`;
    ids.add(id);
    return id === sanitized.id ? sanitized : { ...sanitized, id };
  });
}

function environmentMode(value: unknown, fallback: EnvironmentMode): EnvironmentMode {
  return value === "off" || value === "individual" || value === "global" ? value : fallback;
}

function airflowBehavior(value: unknown, fallback: AirflowBehavior): AirflowBehavior {
  return value === "steady" || value === "gentle" || value === "gusty" || value === "storm" || value === "random" ? value : fallback;
}

function sanitizeLineEnvironment(v: unknown): MagneticLineConfig["environment"] {
  const o = (v ?? {}) as Record<string, unknown>;
  const position = (o.lightPosition ?? {}) as Record<string, unknown>;
  const path = Array.isArray(o.airflowPath) ? o.airflowPath.slice(0, 128) : [];
  const airflowPaths = Array.isArray(o.airflowPaths)
    ? o.airflowPaths.slice(0, 8).map((rawPath) => Array.isArray(rawPath)
      ? rawPath.slice(0, 128).map((point) => {
          const p = (point ?? {}) as Record<string, unknown>;
          return { x: clamp01(p.x, 0), y: clamp01(p.y, 0) };
        })
      : [])
    : path.length > 0
      ? [path.map((point) => {
          const p = (point ?? {}) as Record<string, unknown>;
          return { x: clamp01(p.x, 0), y: clamp01(p.y, 0) };
        })]
      : [];
  const airflowRadius = Math.min(1, Math.max(0.005, num(o.airflowRadius, DEFAULT_LINE_ENVIRONMENT.airflowRadius)));
  const rawAirflowRadii = Array.isArray(o.airflowRadii) ? o.airflowRadii : undefined;
  const airflowRadii = rawAirflowRadii
    ? Array.from({ length: airflowPaths.length }, (_, index) =>
          Math.min(1, Math.max(0.005, num(rawAirflowRadii[index], airflowRadius))))
    : Array.from({ length: airflowPaths.length }, () => airflowRadius);
  const legacyLight: EnvironmentLightConfig = {
    id: "light-1",
    color: str(o.lightColor, DEFAULT_LINE_ENVIRONMENT.lightColor),
    position: {
      x: clamp01(position.x, DEFAULT_LINE_ENVIRONMENT.lightPosition.x),
      y: clamp01(position.y, DEFAULT_LINE_ENVIRONMENT.lightPosition.y),
    },
    endPosition: {
      x: clamp01(position.x, DEFAULT_LINE_ENVIRONMENT.lightPosition.x),
      y: clamp01(position.y, DEFAULT_LINE_ENVIRONMENT.lightPosition.y),
    },
    intensity: clamp01(o.lightIntensity, DEFAULT_LINE_ENVIRONMENT.lightIntensity),
    radius: Math.min(1, Math.max(0.05, num(o.lightRadius, DEFAULT_LINE_ENVIRONMENT.lightRadius))),
    speed: 0,
    playback: "loop",
  };
  const lights = sanitizeEnvironmentLights(o.lights, legacyLight) ??
    [sanitizeEnvironmentLight({ ...legacyLight, position, endPosition: position }, 0, legacyLight)];
  return {
    airflowMode: environmentMode(o.airflowMode, DEFAULT_LINE_ENVIRONMENT.airflowMode),
    airflowBehavior: airflowBehavior(o.airflowBehavior, DEFAULT_LINE_ENVIRONMENT.airflowBehavior),
    airflowPath: path.map((point) => {
      const p = (point ?? {}) as Record<string, unknown>;
      return { x: clamp01(p.x, 0), y: clamp01(p.y, 0) };
    }),
    airflowPaths,
    airflowRadii,
    airflowSpeed: Math.min(4, Math.max(0, num(o.airflowSpeed, DEFAULT_LINE_ENVIRONMENT.airflowSpeed))),
    airflowStrength: Math.min(2, Math.max(0, num(o.airflowStrength, DEFAULT_LINE_ENVIRONMENT.airflowStrength))),
    airflowRadius,
    lightMode: environmentMode(o.lightMode, DEFAULT_LINE_ENVIRONMENT.lightMode),
    lightColor: str(o.lightColor, DEFAULT_LINE_ENVIRONMENT.lightColor),
    lightPosition: {
      x: clamp01(position.x, DEFAULT_LINE_ENVIRONMENT.lightPosition.x),
      y: clamp01(position.y, DEFAULT_LINE_ENVIRONMENT.lightPosition.y),
    },
    lightIntensity: clamp01(o.lightIntensity, DEFAULT_LINE_ENVIRONMENT.lightIntensity),
    lightRadius: Math.min(1, Math.max(0.05, num(o.lightRadius, DEFAULT_LINE_ENVIRONMENT.lightRadius))),
    lights,
  };
}

export function sanitizeLine(v: unknown): MagneticLineConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const from = sanitizePoint(o.from);
  const to = sanitizePoint(o.to);
  const customPath = sanitizeCustomPath(o.customPath, from, to);
  const hasLineEnvironment = typeof o.environment === "object" && o.environment !== null;
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
      flow: (o.inherit as Record<string, unknown> | undefined)?.flow !== false,
      cursorInfluence: (o.inherit as Record<string, unknown> | undefined)?.cursorInfluence !== false,
      lineInteraction: (o.inherit as Record<string, unknown> | undefined)?.lineInteraction !== false,
      constraint: (o.inherit as Record<string, unknown> | undefined)?.constraint !== false,
      occlusion: (o.inherit as Record<string, unknown> | undefined)?.occlusion !== false,
    },
    motion: sanitizeMotion(o.motion),
    startDelay: Math.min(9999999, Math.max(0, num(o.startDelay, 0))),
    magnet: sanitizeMagnet(o.magnet),
    glow: sanitizeGlow(o.glow),
    outerGlow: sanitizeOuterGlow((o.outerGlow ?? o.glow) as Record<string, unknown>),
    cursorGlow: sanitizeCursorGlow(o.cursorGlow),
    texture: sanitizeTexture(o.texture),
    flow: sanitizeFlow(o.flow),
    environmentEnabled: bool(o.environmentEnabled, false) && hasLineEnvironment,
    environment: sanitizeLineEnvironment(o.environment),
    cursorInfluence: sanitizeCursorInfluence(o.cursorInfluence),
    lineInteraction: sanitizeLineInteraction(o.lineInteraction),
    constraint: sanitizeConstraint(o.constraint),
    gravity: sanitizeGravity(o.gravity, customPath),
    occlusion: sanitizeOcclusion(o.occlusion),
  };
}

function sanitizeTarget(v: unknown): MagneticTargetConfig {
  const o = (v ?? {}) as Record<string, unknown>;
  const id = str(o.id, uniqueId("target"));
  const activationValues = Array.isArray(o.activations) ? o.activations : ["hover", "focus", "touch"];
  const validActivations = (values: unknown): NonNullable<MagneticTargetConfig["activations"]> =>
    Array.isArray(values)
      ? Array.from(new Set(values.filter((activation): activation is NonNullable<MagneticTargetConfig["activations"]>[number] =>
          activation === "hover" || activation === "focus" || activation === "click" || activation === "touch")))
      : [];
  const lineTriggers = o.lineTriggers && typeof o.lineTriggers === "object"
    ? Object.fromEntries(Object.entries(o.lineTriggers as Record<string, unknown>).flatMap(([lineId, rawEffects]) => {
        if (!lineId || !rawEffects || typeof rawEffects !== "object") return [];
        const effects = rawEffects as Record<string, unknown>;
        const triggers = {
          ...(Array.isArray(effects.magnet) ? { magnet: validActivations(effects.magnet) } : {}),
          ...(Array.isArray(effects.glow) ? { glow: validActivations(effects.glow) } : {}),
        };
        return Object.keys(triggers).length > 0 ? [[lineId, triggers]] : [];
      }))
    : undefined;
  return {
    id,
    name: str(o.name, id),
    ...(typeof o.tagName === "string" && o.tagName.trim()
      ? { tagName: o.tagName.trim().toLowerCase().slice(0, 32) }
      : {}),
    ...(typeof o.selector === "string" && o.selector.trim() ? { selector: o.selector.trim() } : {}),
    ...(o.lineIds === null
      ? { lineIds: null }
      : Array.isArray(o.lineIds)
        ? { lineIds: o.lineIds.filter((lineId): lineId is string => typeof lineId === "string") }
        : {}),
    activations: validActivations(activationValues),
    clickBehavior: o.clickBehavior === "press" ? "press" : "toggle",
    enabled: bool(o.enabled, true),
    magnetic: bool(o.magnetic, true),
    strength: Math.max(0, num(o.strength, 1)),
    radius: Math.max(0, num(o.radius, 0)),
    priority: num(o.priority, 0),
    ...(lineTriggers ? { lineTriggers } : {}),
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
    const lines = Array.isArray(o.lines) ? o.lines.map(sanitizeLine) : STARTER_LINES;
    if (sourceVersion < 4) {
      const sourceLines = Array.isArray(o.lines) ? o.lines : [];
      lines.forEach((line, index) => {
        const sourceMagnet = ((sourceLines[index] ?? {}) as Record<string, unknown>).magnet as Record<string, unknown> | undefined;
        if (typeof sourceMagnet?.strength === "number" && Number.isFinite(sourceMagnet.strength)) {
          line.magnet.strength = Math.min(100, Math.max(0, sourceMagnet.strength * 100));
        }
        if (typeof sourceMagnet?.falloff === "number" && Number.isFinite(sourceMagnet.falloff)) {
          line.magnet.falloff = Math.min(100, Math.max(0, sourceMagnet.falloff * 100));
        }
      });
    }
    if (sourceVersion < 5) {
      const sourceLines = Array.isArray(o.lines) ? o.lines : [];
      lines.forEach((line, index) => {
        const source = (sourceLines[index] ?? {}) as Record<string, unknown>;
        const sourceGlow = (source.glow ?? {}) as Record<string, unknown>;
        const sourceOuterGlow = (source.outerGlow ?? source.glow ?? {}) as Record<string, unknown>;
        scaleLegacyGlowValues(line.glow, sourceGlow);
        scaleLegacyGlowValues(line.outerGlow, sourceOuterGlow);
      });
    }
    if (sourceVersion < 2) {
      for (const line of lines) line.inherit = { appearance: true, shape: true, motion: true, anchorMotion: true, magnet: true, glow: true, outerGlow: true, texture: true, flow: true, cursorInfluence: true, lineInteraction: true, constraint: true, occlusion: true };
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
    for (const target of targets) {
      if (!target.lineTriggers) continue;
      target.lineTriggers = Object.fromEntries(
        Object.entries(target.lineTriggers).filter(([lineId]) => seen.has(lineId)),
      );
      if (Object.keys(target.lineTriggers).length === 0) delete target.lineTriggers;
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
      version: Math.max(8, sourceVersion),
      global: {
        color: str(g.color, DEFAULT_GLOBAL.color),
        colorStyle: sanitizeAppearance({ color: str(g.color, DEFAULT_GLOBAL.color), colorStyle: g.colorStyle }).colorStyle,
        opacity: clamp01(g.opacity, DEFAULT_GLOBAL.opacity),
        width: Math.max(0, num(g.width, DEFAULT_GLOBAL.width)),
        motionEnabled: bool(g.motionEnabled, DEFAULT_GLOBAL.motionEnabled),
        motionType: motionType(g.motionType, DEFAULT_GLOBAL.motionType),
        speed: Math.max(0, num(g.speed, DEFAULT_GLOBAL.speed)),
        amplitude: Math.max(0, num(g.amplitude, DEFAULT_GLOBAL.amplitude)),
        frequency: Math.max(0, num(g.frequency, DEFAULT_GLOBAL.frequency)),
        phase: num(g.phase, DEFAULT_GLOBAL.phase),
        deformability: clamp01(g.deformability, DEFAULT_GLOBAL.deformability),
        shape: sanitizeShape(g.shape),
        magnetismEnabled: bool(g.magnetismEnabled, DEFAULT_GLOBAL.magnetismEnabled),
        targetId: typeof g.targetId === "string" && g.targetId.length > 0 ? g.targetId : null,
        strength: Math.min(100, Math.max(0, num(sourceVersion < 4 && typeof g.strength === "number" ? g.strength * 100 : g.strength, DEFAULT_GLOBAL.strength))),
        radius: Math.min(100, Math.max(0, num(g.radius, DEFAULT_GLOBAL.radius))),
        falloff: Math.min(100, Math.max(0, num(sourceVersion < 4 && typeof g.falloff === "number" ? g.falloff * 100 : g.falloff, DEFAULT_GLOBAL.falloff))),
        maxDeformation: Math.min(100, Math.max(0, num(g.maxDeformation, DEFAULT_GLOBAL.maxDeformation))),
        glowEnabled: bool(g.glowEnabled, DEFAULT_GLOBAL.glowEnabled),
        glowColor: str(g.glowColor, DEFAULT_GLOBAL.glowColor),
        glowColorStyle: sanitizeAppearance({ color: str(g.glowColor, DEFAULT_GLOBAL.glowColor), colorStyle: g.glowColorStyle }).colorStyle,
        glowIntensity: glowNumber(g.glowIntensity, DEFAULT_GLOBAL.glowIntensity, sourceVersion < 5),
        glowOpacity: Math.min(100, Math.max(0, num(g.glowOpacity, DEFAULT_GLOBAL.glowOpacity))),
        glowRadius: Math.min(100, Math.max(0, num(g.glowRadius, DEFAULT_GLOBAL.glowRadius))),
        glowLength: glowNumber(g.glowLength, DEFAULT_GLOBAL.glowLength, sourceVersion < 5),
        glowFalloff: glowNumber(g.glowFalloff, DEFAULT_GLOBAL.glowFalloff, sourceVersion < 5),
        glowMaxCombinedIntensity: glowNumber(
          g.glowMaxCombinedIntensity,
          DEFAULT_GLOBAL.glowMaxCombinedIntensity,
          sourceVersion < 5 ||
            (sourceVersion < 6 && typeof g.glowMaxCombinedIntensity === "number" && g.glowMaxCombinedIntensity <= 1),
        ),
        outerGlowEnabled: bool(g.outerGlowEnabled, DEFAULT_GLOBAL.outerGlowEnabled),
        outerGlowColor: str(g.outerGlowColor, DEFAULT_GLOBAL.outerGlowColor),
        outerGlowColorStyle: sanitizeAppearance({ color: str(g.outerGlowColor, DEFAULT_GLOBAL.outerGlowColor), colorStyle: g.outerGlowColorStyle }).colorStyle,
        outerGlowIntensity: glowNumber(g.outerGlowIntensity, DEFAULT_GLOBAL.outerGlowIntensity, sourceVersion < 5),
        outerGlowOpacity: Math.min(100, Math.max(0, num(g.outerGlowOpacity, DEFAULT_GLOBAL.outerGlowOpacity))),
        outerGlowRadius: Math.min(100, Math.max(0, num(g.outerGlowRadius, DEFAULT_GLOBAL.outerGlowRadius))),
        outerGlowLength: glowNumber(g.outerGlowLength, DEFAULT_GLOBAL.outerGlowLength, sourceVersion < 5),
        outerGlowFalloff: glowNumber(g.outerGlowFalloff, DEFAULT_GLOBAL.outerGlowFalloff, sourceVersion < 5),
        textureEnabled: bool(g.textureEnabled, DEFAULT_GLOBAL.textureEnabled),
        textureType: textureType(g.textureType, DEFAULT_GLOBAL.textureType),
        textureScale: Math.max(0.001, num(g.textureScale, DEFAULT_GLOBAL.textureScale)),
        textureIntensity: clamp01(g.textureIntensity, DEFAULT_GLOBAL.textureIntensity),
        textureShowThread: bool(g.textureShowThread, DEFAULT_GLOBAL.textureShowThread),
        textureWeight: Math.min(4, Math.max(0.1, num(g.textureWeight, DEFAULT_GLOBAL.textureWeight))),
        textureSilkStrands: Math.min(24, Math.max(1, Math.round(num(g.textureSilkStrands, DEFAULT_GLOBAL.textureSilkStrands)))),
        flow: sanitizeFlow(g.flow),
        environment: sanitizeEnvironment(g.environment),
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
  const from = { x: 0.3, y: 0.3 };
  const to = { x: 0.7, y: 0.5 };
  return sanitizeLine({
    id: uniqueId("line"),
    from,
    to,
    geometrySource: "shape",
    customPath: {
      points: [
        { id: "new-line-start", ...from },
        { id: "new-line-end", ...to },
      ],
    },
    anchorPoints: [],
    appearance: {
      color: DEFAULT_GLOBAL.color,
      colorStyle: DEFAULT_GLOBAL.colorStyle,
      opacity: DEFAULT_GLOBAL.opacity,
      width: DEFAULT_GLOBAL.width,
      zIndex: 0,
    },
    shape: { ...DEFAULT_SHAPE, type: "straight", amplitude: 0 },
    motion: { enabled: false, type: "tension", speed: 0, amplitude: 0, frequency: 1, phase: 0, deformability: 0 },
    anchorMotion: {
      start: { ...DEFAULT_ANCHOR_MOTION.start, enabled: false },
      end: { ...DEFAULT_ANCHOR_MOTION.end, enabled: false },
    },
    magnet: { targetId: null, enabled: false, strength: 0, radius: 0, falloff: 0, maxDeformation: 0 },
    glow: { enabled: false },
    outerGlow: { enabled: false },
    cursorGlow: { enabled: false },
    texture: { enabled: false, type: "grain", scale: 0.02, intensity: 0, showThread: false, weight: 1, silkStrands: 8 },
    flow: { ...DEFAULT_FLOW, enabled: false, colors: [...DEFAULT_FLOW.colors], layers: { ...DEFAULT_FLOW.layers } },
    environmentEnabled: false,
    environment: { ...DEFAULT_LINE_ENVIRONMENT, airflowMode: "off", lightMode: "off", airflowPath: [] },
    cursorInfluence: { ...DEFAULT_GLOBAL.cursorInfluence, enabled: false },
    lineInteraction: { ...DEFAULT_GLOBAL.lineInteraction, enabled: false },
    constraint: { ...DEFAULT_GLOBAL.constraint, enabled: false },
    gravity: { ...DEFAULT_LINE_GRAVITY, enabled: false, fixedPointIds: ["start", "end"] },
    occlusion: { enabled: false, gapWidth: DEFAULT_GLOBAL.occlusion.gapWidth },
    inherit: {
      appearance: false,
      shape: false,
      motion: false,
      anchorMotion: false,
      magnet: false,
      glow: false,
      outerGlow: false,
      texture: false,
      flow: false,
      cursorInfluence: false,
      lineInteraction: false,
      constraint: false,
      occlusion: false,
    },
  });
}

export function duplicateLine(l: MagneticLineConfig): MagneticLineConfig {
  return { ...sanitizeLine(l), id: uniqueId("line") };
}
