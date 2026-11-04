// ============================================================================
// Magnetic Background Lines ? core data model
// Single source of truth used by both the production component and the editor.
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export type MotionType = "tension" | "floating" | "vibration";

export type ShapeType = "straight" | "sharp" | "rounded" | "soft-wave" | "organic" | "liquid" | "floating" | "vibration" | "pixel";
export type GeneratedShapePreset = "triangle" | "rectangle" | "rounded-rectangle" | "circle" | "diamond" | "pentagon" | "hexagon" | "star" | "smile" | "cylinder" | "cube";

export type AnchorTrajectoryType = "static" | "circle" | "ellipse" | "triangle" | "rectangle" | "linear";
export type AnchorLoopMode = "loop" | "ping-pong" | "once";
export type AnchorDirection = "forward" | "reverse";
export type AnchorPointEndpoint = "start" | "end" | "path";
export type AnchorPointType = "custom" | "circle" | "ellipse" | "square";
export type AnchorActivation = "always" | "hover" | "click";
export type AnchorFinishBehavior = "stay" | "return";
export type AnchorHoverExitBehavior = AnchorFinishBehavior | "continue";
export type AnchorClickBehavior = "restart" | "toggle";
export type AnchorEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type GeometrySource = "shape" | "path";

export interface PathPoint extends Point {
  id: string;
  moveTo?: boolean;
}

export interface CustomPath {
  points: PathPoint[];
  /** Source viewport ratio for generated shapes that must retain their proportions. */
  aspectRatio?: number;
}

export interface ShapeConfig {
  type: ShapeType;
  amplitude: number;
  frequency: number;
  cycles: number;
  phase: number;
  smoothness: number;
  irregularity: number;
  distortion: number;
  pixelStep: number;
  roughness: number;
}

export interface MotionConfig {
  type: MotionType;
  /** Cycles-per-second style multiplier. */
  speed: number;
  /** Normalized amplitude ? fraction of min(viewport.width, viewport.height). */
  amplitude: number;
  /** Spatial-frequency multiplier used by floating/vibration to vary phase along the line. */
  frequency: number;
  /** Deterministic per-line phase offset, in radians. */
  phase: number;
  /** 0 = rigid (barely bends for magnets), 1 = highly flexible. */
  deformability: number;
}

export interface AnchorMotionEndpointConfig {
  enabled: boolean;
  trajectory: AnchorTrajectoryType;
  speed: number;
  direction: AnchorDirection;
  loopMode: AnchorLoopMode;
  offset: number;
  radius: number;
  radiusX: number;
  radiusY: number;
  width: number;
  height: number;
  rotation: number;
  size: number;
}

export interface AnchorMotionConfig {
  start: AnchorMotionEndpointConfig;
  end: AnchorMotionEndpointConfig;
}

export interface AnchorPoint {
  id: string;
  endpoint: AnchorPointEndpoint;
  pathPointId?: string;
  type: AnchorPointType;
  enabled: boolean;
  speed: number;
  order: number;
  loop: boolean;
  behavior: "loop" | "one-time";
  activation: AnchorActivation;
  hoverExitBehavior: AnchorHoverExitBehavior;
  finishBehavior: AnchorFinishBehavior;
  clickBehavior: AnchorClickBehavior;
  easing: AnchorEasing;
  x: number;
  y: number;
  radius: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  size: number;
}

export interface AppearanceConfig {
  color: string;
  colorStyle?: LineColorStyle;
  opacity: number; // 0..1
  width: number; // px
  zIndex: number;
}

export const RAINBOW_COLORS = ["#ff0000", "#ff8c00", "#ffff00", "#00c853", "#00b0ff", "#304ffe", "#d500f9"];

export interface LineColorStyle {
  type: "solid" | "linear" | "radial" | "diamond" | "random" | "rainbow";
  colors: string[];
  /** Percentage coverage for each color; values are normalized to fill the line. */
  colorWeights?: number[];
  /** Seconds per color transition while random mode is playing. */
  speed?: number;
}

export interface OcclusionConfig {
  enabled: boolean;
}

export interface MagnetConfig {
  targetId: string | null;
  enabled: boolean;
  /** 0..1 ? how strongly this line responds to an active target. */
  strength: number;
  /** Normalized influence distance (fraction of min viewport dimension). */
  radius: number;
  /** 0..1 ? falloff sharpness (0 = gentle/linear-ish, 1 = sharp near the edge). */
  falloff: number;
  /** Normalized maximum displacement allowed (fraction of min viewport dimension). */
  maxDeformation: number;
}

export interface GlowConfig {
  enabled: boolean;
  color: string;
  intensity: number; // 0..1
  /** Normalized distance from the target perimeter at which glow begins. */
  radius: number;
  /** 0..1 ? fraction of the line's length affected around the closest point. */
  length: number;
  falloff: number; // 0..1
}

export type CursorInfluenceMode = "attract";
export type LineInteractionMode = "avoid";
export type ConstraintBoundary = "none" | "viewport";

export interface ConstraintConfig {
  enabled: boolean;
  maxDeformation: number;
  boundary: ConstraintBoundary;
  padding: number;
}

export interface LineInteractionConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  falloff: number;
  mode: LineInteractionMode;
}

export interface CursorInfluenceConfig {
  enabled: boolean;
  strength: number;
  radius: number;
  falloff: number;
  maxDeformation: number;
  mode: CursorInfluenceMode;
}

export interface CursorGlowConfig {
  /** Whether THIS line participates in the ambient cursor glow at all. Defaults OFF at the
   * per-line "cursor deformation" level ? this only ever produces glow, never bending. */
  enabled: boolean;
  color?: string;
  intensity?: number;
  radius?: number;
  falloff?: number;
}

export type TextureType = "grain" | "fiber";
export type TextureFlowDirection = "forward" | "reverse";

export interface TextureFlowConfig {
  enabled: boolean;
  speed: number;
  direction: TextureFlowDirection;
  offset: number;
}

export interface TextureConfig {
  enabled: boolean;
  type: TextureType;
  scale: number;
  intensity: number;
}

export interface LineInheritance {
  appearance: boolean;
  shape: boolean;
  motion: boolean;
  anchorMotion: boolean;
  magnet: boolean;
  glow: boolean;
  outerGlow: boolean;
  texture: boolean;
  textureFlow: boolean;
  cursorInfluence: boolean;
  lineInteraction: boolean;
  constraint: boolean;
  occlusion: boolean;
}

export interface MagneticLineConfig {
  id: string;
  enabled: boolean;
  visible: boolean;
  from: Point; // normalized 0..1, permanent/base
  to: Point; // normalized 0..1, permanent/base
  geometrySource: GeometrySource;
  generatedShapePreset?: GeneratedShapePreset;
  lineTransform?: { scaleX: number; scaleY: number; rotation: number };
  customPath: CustomPath;
  anchorPoints: AnchorPoint[];
  appearance: AppearanceConfig;
  shape: ShapeConfig;
  anchorMotion: AnchorMotionConfig;
  inherit: LineInheritance;
  motion: MotionConfig;
  startDelay?: number;
  magnet: MagnetConfig;
  glow: GlowConfig;
  outerGlow: GlowConfig;
  cursorGlow: CursorGlowConfig;
  texture: TextureConfig;
  textureFlow: TextureFlowConfig;
  cursorInfluence: CursorInfluenceConfig;
  lineInteraction: LineInteractionConfig;
  constraint: ConstraintConfig;
  occlusion: OcclusionConfig;
}

export interface MagneticLineGroup {
  id: string;
  name: string;
  lineIds: string[];
  scale: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
}

export interface GlobalSettings {
  color: string;
  colorStyle?: LineColorStyle;
  opacity: number;
  width: number;
  motionType: MotionType;
  speed: number;
  amplitude: number;
  frequency: number;
  phase: number;
  deformability: number;
  shape: ShapeConfig;

  magnetismEnabled: boolean;
  targetId: string | null;
  strength: number;
  radius: number;
  falloff: number;
  maxDeformation: number;

  glowEnabled: boolean;
  glowColor: string;
  glowIntensity: number;
  glowRadius: number;
  glowLength: number;
  glowFalloff: number;
  /** Hard clamp applied to (target glow + ambient glow) combined, per sample point. */
  glowMaxCombinedIntensity: number;

  outerGlowEnabled: boolean;
  outerGlowColor: string;
  outerGlowIntensity: number;
  outerGlowRadius: number;
  outerGlowLength: number;
  outerGlowFalloff: number;

  textureEnabled: boolean;
  textureType: TextureType;
  textureScale: number;
  textureIntensity: number;
  textureFlow: TextureFlowConfig;
  cursorInfluence: CursorInfluenceConfig;
  lineInteraction: LineInteractionConfig;
  constraint: ConstraintConfig;
  occlusion: OcclusionConfig;
}

export interface AnimationSettings {
  playing: boolean;
  /** Editor scrub speed: 0.25x .. 2x. Always 1 in production. */
  speedMultiplier: number;
  reducedMotion: "auto" | "on" | "off";
}

export interface CursorInteractionSettings {
  enabled: boolean;
  color: string;
  intensity: number;
  radius: number; // normalized
  falloff: number;
  /** 0..1 ? higher = smoother/slower to catch up to the pointer. */
  smoothing: number;
  /** 0..1 ? higher = glow fades out faster once the pointer moves away. */
  releaseSpeed: number;
  length: number;
  opacity: number;
  maxIntensity: number;
}

export interface MagneticTargetConfig {
  id: string;
  enabled: boolean;
  magnetic: boolean;
  /** Multiplier applied on top of each line's own magnet.strength. */
  strength: number;
  /** Normalized, added to each line's own magnet.radius. */
  radius: number;
  /** Higher wins when multiple targets are simultaneously active. */
  priority: number;
  glow?: Partial<GlowConfig>;
}

export interface MagneticLinesSceneConfig {
  version: number;
  global: GlobalSettings;
  animation: AnimationSettings;
  cursor: CursorInteractionSettings;
  lines: MagneticLineConfig[];
  groups: MagneticLineGroup[];
  targets: MagneticTargetConfig[];
}
