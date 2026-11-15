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
  /** 0 keeps authored corners; 1 samples a smooth Catmull-Rom curve through them. */
  curveSmoothing?: number;
  /** Source viewport ratio for generated shapes that must retain their proportions. */
  aspectRatio?: number;
  closedJoint?: "connected" | "breakable";
}

export interface ShapeConfig {
  type: ShapeType;
  /** Whether runtime motion and interaction may bend this shape's contour. */
  bendable?: boolean;
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
  enabled?: boolean;
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
  delay: number;
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
  /** Extra pixel clearance around higher layers, beyond both stroke widths. */
  gapWidth: number;
}

export interface MagnetConfig {
  targetId: string | null;
  enabled: boolean;
  /** 0..100 ? how strongly this line responds to an active target. */
  strength: number;
  /** Normalized influence distance (fraction of min viewport dimension), up to 100. */
  radius: number;
  /** 0..100 ? falloff sharpness (0 = gentle/linear-ish, 100 = sharp near the edge). */
  falloff: number;
  /** Normalized maximum displacement allowed (fraction of min viewport dimension), up to 100. */
  maxDeformation: number;
}

export interface GlowConfig {
  enabled: boolean;
  color: string;
  colorStyle?: LineColorStyle;
  intensity: number; // 0..100
  opacity: number; // 0..100
  /** Normalized proximity radius for this glow source. */
  radius: number;
  /** 0..100 fraction of the line's length affected around the strongest sample. */
  length: number;
  falloff: number; // 0..100
}

export type CursorInfluenceMode = "attract" | "repel";
export type CursorInfluenceProfile = "soft" | "balanced" | "focused";
export type LineInteractionMode = "avoid";
export type ConstraintBoundary = "none" | "viewport";

export interface ConstraintConfig {
  enabled: boolean;
  maxDeformation: number;
  boundary: ConstraintBoundary;
  padding: number;
}

export interface GravityConfig {
  enabled: boolean;
  strength: number;
  fixedPointIds: string[];
}

export interface LineInteractionConfig {
  enabled: boolean;
  strength: number;
  /** Distance before the visible strokes should touch, as a fraction of viewport min dimension. */
  clearance: number;
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
  profile: CursorInfluenceProfile;
  smoothing: number;
  mode: CursorInfluenceMode;
}

export interface CursorGlowConfig {
  /** Whether this line participates in the pointer portion of the shared inner glow. */
  enabled: boolean;
  color?: string;
  intensity?: number;
  radius?: number;
  falloff?: number;
}

export type TextureType = "grain" | "fiber" | "silk" | "rope" | "beads" | "metal";

export interface TextureConfig {
  enabled: boolean;
  type: TextureType;
  scale: number;
  intensity: number;
  showThread: boolean;
  weight: number;
  silkStrands: number;
}

export type FlowEffectType = "electric-current" | "continuous-light" | "plasma" | "fiber-optic" | "energy-pulse";
export type FlowDirection = "forward" | "reverse" | "both" | "alternating";
export type FlowPlacement = "inside" | "along" | "around" | "outside" | "mixed";

export interface FlowLayerConfig {
  current: boolean;
  core: boolean;
  secondary: boolean;
  glow: boolean;
  branches: boolean;
  sparks: boolean;
}

export interface FlowConfig {
  enabled: boolean;
  effectType: FlowEffectType;
  pulseRhythm: "continuous" | "heartbeat";
  preset: string | null;
  speed: number;
  colorSpeed: number;
  direction: FlowDirection;
  intensity: number;
  width: number;
  coreWidth: number;
  glowWidth: number;
  opacity: number;
  colors: string[];
  coreColor: string;
  glowColor: string;
  streamCount: number;
  phase: number;
  placement: FlowPlacement;
  layers: FlowLayerConfig;
  branchFrequency: number;
  branchLength: number;
  sparkDensity: number;
  flicker: number;
  turbulence: number;
  strandCount: number;
  pulseWidth: number;
  tailLength: number;
}

export type AirflowBehavior = "steady" | "gentle" | "gusty" | "storm" | "random";

export interface EnvironmentLightConfig {
  id: string;
  color: string;
  position: Point;
  endPosition: Point;
  intensity: number;
  radius: number;
  speed: number;
  playback: "loop" | "once";
}

export interface EnvironmentConfig {
  enabled: boolean;
  airflowEnabled: boolean;
  airflowBehavior: AirflowBehavior;
  airflowPath: Point[];
  airflowPaths?: Point[][];
  airflowRadii?: number[];
  airflowSpeed: number;
  airflowStrength: number;
  airflowRadius: number;
  lightEnabled: boolean;
  lightColor: string;
  lightPosition: Point;
  lightIntensity: number;
  lightRadius: number;
  lights?: EnvironmentLightConfig[];
}

export type EnvironmentMode = "off" | "global" | "individual";

export interface LineEnvironmentConfig {
  airflowMode: EnvironmentMode;
  airflowBehavior: AirflowBehavior;
  airflowPath: Point[];
  airflowPaths: Point[][];
  airflowRadii: number[];
  airflowSpeed: number;
  airflowStrength: number;
  airflowRadius: number;
  lightMode: EnvironmentMode;
  lightColor: string;
  lightPosition: Point;
  lightIntensity: number;
  lightRadius: number;
  lights: EnvironmentLightConfig[];
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
  flow: boolean;
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
  flow: FlowConfig;
  environmentEnabled: boolean;
  environment: LineEnvironmentConfig;
  cursorInfluence: CursorInfluenceConfig;
  lineInteraction: LineInteractionConfig;
  constraint: ConstraintConfig;
  gravity: GravityConfig;
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
  motionEnabled: boolean;
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
  glowColorStyle?: LineColorStyle;
  glowIntensity: number;
  glowOpacity: number;
  glowRadius: number;
  glowLength: number;
  glowFalloff: number;
  /** 0..100 hard clamp applied to the combined inner and outer glow per sample. */
  glowMaxCombinedIntensity: number;

  outerGlowEnabled: boolean;
  outerGlowColor: string;
  outerGlowColorStyle?: LineColorStyle;
  outerGlowIntensity: number;
  outerGlowOpacity: number;
  outerGlowRadius: number;
  outerGlowLength: number;
  outerGlowFalloff: number;

  textureEnabled: boolean;
  textureType: TextureType;
  textureScale: number;
  textureIntensity: number;
  textureShowThread: boolean;
  textureWeight: number;
  textureSilkStrands: number;
  flow: FlowConfig;
  environment: EnvironmentConfig;
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
  name?: string;
  tagName?: string;
  /** Unique CSS selector for targets picked from a page preview. */
  selector?: string;
  /** Missing means the target applies to all lines for backward compatibility. */
  lineIds?: string[] | null;
  /** Per-line effect triggers; omitted effects inherit the target's activations. */
  lineTriggers?: Record<string, TargetLineTriggers>;
  activations?: TargetActivation[];
  clickBehavior?: TargetClickBehavior;
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

export type TargetActivation = "hover" | "focus" | "click" | "touch";
export type TargetClickBehavior = "press" | "toggle";

export interface TargetLineTriggers {
  magnet?: TargetActivation[];
  glow?: TargetActivation[];
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
