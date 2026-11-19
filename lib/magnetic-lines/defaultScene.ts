import type {
  AnchorMotionConfig,
  AnimationSettings,
  CursorInteractionSettings,
  GlobalSettings,
  MagneticLineConfig,
  MagneticLinesSceneConfig,
  MotionConfig,
  LineColorStyle,
  LineEnvironmentConfig,
  FlowConfig,
  ShapeConfig,
  GravityConfig,
} from "./types";

const DEFAULT_LINE_COLOR_STYLE: LineColorStyle = { type: "solid", colors: ["#8fa3b8", "#5ee6ff"] };

export const DEFAULT_FLOW: FlowConfig = {
  enabled: false,
  effectType: "electric-current",
  pulseRhythm: "continuous",
  preset: null,
  speed: 0.55,
  colorSpeed: 0.08,
  direction: "forward",
  intensity: 0.7,
  width: 2.2,
  coreWidth: 0.7,
  glowWidth: 6,
  opacity: 0.85,
  colors: ["#1d6dff", "#38dfff"],
  coreColor: "#f5feff",
  glowColor: "#168dff",
  streamCount: 1,
  phase: 0,
  placement: "along",
  layers: { current: true, core: true, secondary: true, glow: true, branches: true, sparks: true },
  branchFrequency: 0.65,
  branchLength: 0.08,
  sparkDensity: 0.6,
  flicker: 0.35,
  turbulence: 0.35,
  strandCount: 4,
  pulseWidth: 0.12,
  tailLength: 0.18,
};

export const DEFAULT_GLOBAL: GlobalSettings = {
  color: "#8fa3b8",
  colorStyle: DEFAULT_LINE_COLOR_STYLE,
  opacity: 0.35,
  width: 1.25,
  motionEnabled: true,
  motionType: "tension",
  speed: 0.18,
  amplitude: 0,
  frequency: 1,
  phase: 0,
  deformability: 0.5,
  shape: {
    type: "straight", amplitude: 0.012, frequency: 3, cycles: 1.3, phase: 0,
    smoothness: 0.8, irregularity: 0, distortion: 0, pixelStep: 8, roughness: 0,
  },

  magnetismEnabled: true,
  targetId: null,
  strength: 60,
  radius: 0.16,
  falloff: 50,
  maxDeformation: 0.09,

  glowEnabled: true,
  glowColor: "#7ad7ff",
  glowColorStyle: { type: "solid", colors: ["#7ad7ff", "#5ee6ff"] },
  glowIntensity: 55,
  glowOpacity: 100,
  glowRadius: 0.14,
  glowLength: 22,
  glowFalloff: 60,
  glowMaxCombinedIntensity: 85,

  outerGlowEnabled: true,
  outerGlowColor: "#8ec8ff",
  outerGlowColorStyle: { type: "solid", colors: ["#8ec8ff", "#5ee6ff"] },
  outerGlowIntensity: 38,
  outerGlowOpacity: 100,
  outerGlowRadius: 0.34,
  outerGlowLength: 34,
  outerGlowFalloff: 70,

  textureEnabled: false,
  textureType: "grain",
  textureScale: 0.02,
  textureIntensity: 0.15,
  textureShowThread: true,
  textureWeight: 1,
  textureSilkStrands: 8,
  flow: { ...DEFAULT_FLOW, colors: [...DEFAULT_FLOW.colors], layers: { ...DEFAULT_FLOW.layers } },
  environment: {
    enabled: false,
    airflowEnabled: false,
    airflowBehavior: "steady",
    airflowPath: [],
    airflowSpeed: 0.35,
    airflowStrength: 0.55,
    airflowRadius: 0.22,
    lightEnabled: false,
    lightColor: "#a6dcff",
    lightPosition: { x: 0.5, y: 0.3 },
    lightIntensity: 0.45,
    lightRadius: 0.34,
  },
  cursorInfluence: { enabled: false, strength: 0.35, radius: 0.14, falloff: 0.55, maxDeformation: 0.06, profile: "balanced", smoothing: 0.2, mode: "attract" },
  lineInteraction: { enabled: false, strength: 0.35, clearance: 0.01, radius: 0.12, falloff: 0.6, mode: "avoid" },
  constraint: { enabled: false, maxDeformation: 0.08, boundary: "none", padding: 0.02 },
  occlusion: { enabled: false, gapWidth: 2 },
};

export const DEFAULT_LINE_ENVIRONMENT: LineEnvironmentConfig = {
  airflowMode: "global",
  airflowBehavior: DEFAULT_GLOBAL.environment.airflowBehavior,
  airflowPath: [],
  airflowPaths: [],
  airflowRadii: [],
  airflowSpeed: DEFAULT_GLOBAL.environment.airflowSpeed,
  airflowStrength: DEFAULT_GLOBAL.environment.airflowStrength,
  airflowRadius: DEFAULT_GLOBAL.environment.airflowRadius,
  lightMode: "global",
  lightColor: DEFAULT_GLOBAL.environment.lightColor,
  lightPosition: { ...DEFAULT_GLOBAL.environment.lightPosition },
  lightIntensity: DEFAULT_GLOBAL.environment.lightIntensity,
  lightRadius: DEFAULT_GLOBAL.environment.lightRadius,
  lights: [{
    id: "light-1",
    color: DEFAULT_GLOBAL.environment.lightColor,
    position: { ...DEFAULT_GLOBAL.environment.lightPosition },
    endPosition: { ...DEFAULT_GLOBAL.environment.lightPosition },
    intensity: DEFAULT_GLOBAL.environment.lightIntensity,
    radius: DEFAULT_GLOBAL.environment.lightRadius,
    speed: 0,
    playback: "loop",
  }],
};

export const DEFAULT_LINE_GRAVITY: GravityConfig = {
  enabled: false,
  strength: 0.35,
  fixedPointIds: ["start", "end"],
};

export const DEFAULT_ANIMATION: AnimationSettings = {
  playing: true,
  speedMultiplier: 1,
  reducedMotion: "auto",
};

export const DEFAULT_CURSOR: CursorInteractionSettings = {
  enabled: true,
  color: "#9fe8ff",
  intensity: 0.3,
  radius: 0.1,
  falloff: 0.5,
  smoothing: 0.5,
  releaseSpeed: 0.5,
  length: 0.25,
  opacity: 1,
  maxIntensity: 1,
};

export const DEFAULT_SHAPE: ShapeConfig = {
  type: "straight",
  bendable: true,
  amplitude: 0.012,
  frequency: 3,
  cycles: 1.3,
  phase: 0,
  smoothness: 0.8,
  irregularity: 0,
  distortion: 0,
  pixelStep: 8,
  roughness: 0,
};

export const DEFAULT_ANCHOR_MOTION: {
  start: AnchorMotionConfig["start"];
  end: AnchorMotionConfig["end"];
} = {
  start: { enabled: true, trajectory: "static", speed: 0.18, direction: "forward", loopMode: "loop", offset: 0, radius: 0.12, radiusX: 0.16, radiusY: 0.1, width: 0.2, height: 0.16, rotation: 0, size: 0.16 },
  end: { enabled: true, trajectory: "static", speed: 0.18, direction: "forward", loopMode: "loop", offset: 0.5, radius: 0.12, radiusX: 0.16, radiusY: 0.1, width: 0.2, height: 0.16, rotation: 0, size: 0.16 },
};

export const MOTION_PRESETS: Record<string, Partial<MotionConfig>> = {
  Taut: { type: "tension", speed: 0.12, amplitude: 0.012, frequency: 1 },
  "Soft Tension": { type: "tension", speed: 0.2, amplitude: 0.022, frequency: 1 },
  "Slow Floating": { type: "floating", speed: 0.15, amplitude: 0.03, frequency: 1.2 },
  "Deep Floating": { type: "floating", speed: 0.08, amplitude: 0.05, frequency: 0.8 },
  "Fine Vibration": { type: "vibration", speed: 0.6, amplitude: 0.01, frequency: 1.5 },
  "Soft Vibration": { type: "vibration", speed: 0.35, amplitude: 0.016, frequency: 1 },
};

const STARTER_MOTION_INHERITANCE: MagneticLineConfig["inherit"] = {
  appearance: true,
  shape: true,
  motion: false,
  anchorMotion: true,
  magnet: true,
  glow: true,
  outerGlow: true,
  texture: true,
  flow: true,
  cursorInfluence: true,
  lineInteraction: true,
  constraint: true,
  occlusion: true,
};

function line(
  id: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  overrides: Partial<MagneticLineConfig> = {}
): MagneticLineConfig {
  return {
    id,
    enabled: true,
    visible: true,
    from,
    to,
    geometrySource: "shape",
    customPath: { points: [{ id: `${id}-start`, x: from.x, y: from.y }, { id: `${id}-end`, x: to.x, y: to.y }] },
    anchorPoints: [],
    appearance: {
      color: DEFAULT_GLOBAL.color,
      colorStyle: { ...DEFAULT_LINE_COLOR_STYLE, colors: [...DEFAULT_LINE_COLOR_STYLE.colors] },
      opacity: DEFAULT_GLOBAL.opacity,
      width: DEFAULT_GLOBAL.width,
      zIndex: 0,
    },
    shape: { ...DEFAULT_SHAPE },
    anchorMotion: {
      start: { ...DEFAULT_ANCHOR_MOTION.start },
      end: { ...DEFAULT_ANCHOR_MOTION.end },
    },
    inherit: {
      appearance: true,
      shape: true,
      motion: true,
      anchorMotion: true,
      magnet: true,
      glow: true,
      outerGlow: true,
      texture: true,
      flow: true,
      cursorInfluence: true,
      lineInteraction: true,
      constraint: true,
      occlusion: true,
    },
    motion: {      type: DEFAULT_GLOBAL.motionType,
      speed: DEFAULT_GLOBAL.speed,
      amplitude: DEFAULT_GLOBAL.amplitude,
      frequency: DEFAULT_GLOBAL.frequency,
      phase: 0,
      deformability: 0.5,
    },
    magnet: {
      targetId: null,
      enabled: true,
      strength: DEFAULT_GLOBAL.strength,
      radius: DEFAULT_GLOBAL.radius,
      falloff: DEFAULT_GLOBAL.falloff,
      maxDeformation: DEFAULT_GLOBAL.maxDeformation,
    },
    glow: {
      enabled: DEFAULT_GLOBAL.glowEnabled,
      color: DEFAULT_GLOBAL.glowColor,
      colorStyle: DEFAULT_GLOBAL.glowColorStyle,
      intensity: DEFAULT_GLOBAL.glowIntensity,
      opacity: DEFAULT_GLOBAL.glowOpacity,
      radius: DEFAULT_GLOBAL.glowRadius,
      length: DEFAULT_GLOBAL.glowLength,
      falloff: DEFAULT_GLOBAL.glowFalloff,
    },
    outerGlow: {
      enabled: DEFAULT_GLOBAL.outerGlowEnabled,
      color: DEFAULT_GLOBAL.outerGlowColor,
      colorStyle: DEFAULT_GLOBAL.outerGlowColorStyle,
      intensity: DEFAULT_GLOBAL.outerGlowIntensity,
      opacity: DEFAULT_GLOBAL.outerGlowOpacity,
      radius: DEFAULT_GLOBAL.outerGlowRadius,
      length: DEFAULT_GLOBAL.outerGlowLength,
      falloff: DEFAULT_GLOBAL.outerGlowFalloff,
    },
    cursorGlow: { enabled: true },
    texture: { enabled: false, type: DEFAULT_GLOBAL.textureType, scale: DEFAULT_GLOBAL.textureScale, intensity: DEFAULT_GLOBAL.textureIntensity, showThread: DEFAULT_GLOBAL.textureShowThread, weight: DEFAULT_GLOBAL.textureWeight, silkStrands: DEFAULT_GLOBAL.textureSilkStrands },
    flow: { ...DEFAULT_FLOW, colors: [...DEFAULT_FLOW.colors], layers: { ...DEFAULT_FLOW.layers } },
    environmentEnabled: false,
    environment: {
      ...DEFAULT_LINE_ENVIRONMENT,
      airflowPath: [],
      airflowPaths: [],
      lightPosition: { ...DEFAULT_LINE_ENVIRONMENT.lightPosition },
      lights: DEFAULT_LINE_ENVIRONMENT.lights.map((light) => ({
        ...light,
        position: { ...light.position },
        endPosition: { ...light.endPosition },
      })),
    },
    cursorInfluence: { ...DEFAULT_GLOBAL.cursorInfluence },
    lineInteraction: { ...DEFAULT_GLOBAL.lineInteraction },
    constraint: { ...DEFAULT_GLOBAL.constraint },
    gravity: { ...DEFAULT_LINE_GRAVITY, fixedPointIds: [...DEFAULT_LINE_GRAVITY.fixedPointIds] },
    occlusion: { ...DEFAULT_GLOBAL.occlusion },
    ...overrides,
  };
}

/** Deterministic starter composition — 12 lines, varied length/angle/motion/phase/layer. */
export const STARTER_LINES: MagneticLineConfig[] = [
  line("line-01", { x: 0.03, y: 0.19 }, { x: 0.45, y: 0.19 }, {
    inherit: STARTER_MOTION_INHERITANCE,
    motion: { type: "tension", speed: 0.11, amplitude: 0.007, frequency: 1, phase: 0.2, deformability: 0.35 },
    appearance: { color: DEFAULT_GLOBAL.color, colorStyle: { ...DEFAULT_LINE_COLOR_STYLE, colors: [...DEFAULT_LINE_COLOR_STYLE.colors] }, opacity: 0.32, width: 1, zIndex: -1 },
  }),
  line("line-02", { x: 0.55, y: 0.19 }, { x: 0.97, y: 0.19 }, {
    motion: { type: "floating", speed: 0.1, amplitude: 0.03, frequency: 1.1, phase: 1.4, deformability: 0.7 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.28, width: 1.4, zIndex: 0 },
  }),
  line("line-03", { x: 0.03, y: 0.5 }, { x: 0.45, y: 0.5 }, {
    motion: { type: "tension", speed: 0.2, amplitude: 0.02, frequency: 1, phase: 2.6, deformability: 0.45 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.4, width: 1, zIndex: 1 },
  }),
  line("line-04", { x: 0.55, y: 0.5 }, { x: 0.97, y: 0.5 }, {
    inherit: STARTER_MOTION_INHERITANCE,
    motion: { type: "tension", speed: 0.1, amplitude: 0.007, frequency: 1, phase: 1.7, deformability: 0.35 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.3, width: 0.9, zIndex: 0 },
  }),
  line("line-05", { x: 0.03, y: 0.81 }, { x: 0.45, y: 0.81 }, {
    motion: { type: "floating", speed: 0.09, amplitude: 0.035, frequency: 0.9, phase: 3.1, deformability: 0.75 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.26, width: 1.2, zIndex: -1 },
  }),
  line("line-06", { x: 0.55, y: 0.81 }, { x: 0.97, y: 0.81 }, {
    motion: { type: "tension", speed: 0.17, amplitude: 0.016, frequency: 1, phase: 4.2, deformability: 0.5 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.3, width: 1, zIndex: 0 },
  }),
  line("line-07", { x: 0.02, y: 0.55 }, { x: 0.2, y: 0.3 }, {
    enabled: false,
    motion: { type: "vibration", speed: 0.42, amplitude: 0.014, frequency: 1.6, phase: 5.0, deformability: 0.4 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.34, width: 1.1, zIndex: 1 },
  }),
  line("line-08", { x: 0.5, y: 0.9 }, { x: 0.78, y: 0.68 }, {
    enabled: false,
    motion: { type: "floating", speed: 0.12, amplitude: 0.026, frequency: 1.2, phase: 1.9, deformability: 0.65 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.28, width: 1, zIndex: 0 },
  }),
  line("line-09", { x: 0.38, y: 0.2 }, { x: 0.6, y: 0.02 }, {
    enabled: false,
    motion: { type: "tension", speed: 0.22, amplitude: 0.014, frequency: 1, phase: 3.7, deformability: 0.4 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.36, width: 0.9, zIndex: 2 },
  }),
  line("line-10", { x: 0.72, y: 0.85 }, { x: 0.97, y: 0.95 }, {
    enabled: false,
    motion: { type: "floating", speed: 0.07, amplitude: 0.04, frequency: 0.8, phase: 0.4, deformability: 0.8 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.24, width: 1.3, zIndex: -2 },
  }),
  line("line-11", { x: 0.02, y: 0.02 }, { x: 0.3, y: 0.22 }, {
    enabled: false,
    motion: { type: "vibration", speed: 0.55, amplitude: 0.01, frequency: 1.4, phase: 2.2, deformability: 0.3 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.32, width: 0.9, zIndex: 1 },
  }),
  line("line-12", { x: 0.55, y: 0.48 }, { x: 0.4, y: 0.78 }, {
    enabled: false,
    motion: { type: "tension", speed: 0.16, amplitude: 0.02, frequency: 1, phase: 5.6, deformability: 0.55 },
    appearance: { color: DEFAULT_GLOBAL.color, opacity: 0.3, width: 1, zIndex: 0 },
  }),
];

export const DEFAULT_SCENE: MagneticLinesSceneConfig = {
  version: 7,
  global: DEFAULT_GLOBAL,
  animation: DEFAULT_ANIMATION,
  cursor: DEFAULT_CURSOR,
  lines: STARTER_LINES,
  groups: [],
  targets: [],
};

export interface ScenePresetDefinition {
  name: string;
  description: string;
  shape: ShapeConfig;
  motion: MotionConfig;
  appearance: { opacity: number; width: number; color: string };
  glow: { enabled: boolean; intensity: number };
  texture: { enabled: boolean; intensity: number };
}

export const SCENE_PRESETS: Record<string, ScenePresetDefinition> = {
  "Minimal Straight": { name: "Minimal Straight", description: "Quiet architectural lines", shape: { ...DEFAULT_SHAPE, type: "straight", amplitude: 0 }, motion: { ...STARTER_LINES[0].motion, type: "tension", amplitude: 0, speed: 0 }, appearance: { color: "#53616c", opacity: 0.28, width: 1 }, glow: { enabled: false, intensity: 0 }, texture: { enabled: false, intensity: 0 } },
  "Soft Tension": { name: "Soft Tension", description: "Restrained elastic wires", shape: { ...DEFAULT_SHAPE, type: "soft-wave", amplitude: 0.012 }, motion: { ...STARTER_LINES[0].motion, type: "tension", amplitude: 0.018, speed: 0.2 }, appearance: { color: "#718898", opacity: 0.35, width: 1.25 }, glow: { enabled: true, intensity: 0.32 }, texture: { enabled: false, intensity: 0 } },
  "Organic Wire": { name: "Organic Wire", description: "Deterministic imperfect curves", shape: { ...DEFAULT_SHAPE, type: "organic", amplitude: 0.025, irregularity: 0.35, distortion: 0.2, roughness: 0.18 }, motion: { ...STARTER_LINES[0].motion, type: "tension", amplitude: 0.012, speed: 0.14 }, appearance: { color: "#7d907f", opacity: 0.34, width: 1.1 }, glow: { enabled: true, intensity: 0.3 }, texture: { enabled: false, intensity: 0 } },
  "Liquid Flow": { name: "Liquid Flow", description: "Soft flowing wire", shape: { ...DEFAULT_SHAPE, type: "liquid", amplitude: 0.035, frequency: 2.5, cycles: 1.5, smoothness: 0.95, distortion: 0.3 }, motion: { ...STARTER_LINES[0].motion, type: "floating", amplitude: 0.018, speed: 0.12, frequency: 1.1 }, appearance: { color: "#668b91", opacity: 0.32, width: 1.35 }, glow: { enabled: true, intensity: 0.4 }, texture: { enabled: false, intensity: 0 } },
  "Deep Liquid": { name: "Deep Liquid", description: "Broad slow elastic flow", shape: { ...DEFAULT_SHAPE, type: "liquid", amplitude: 0.06, frequency: 2, cycles: 1.2, smoothness: 1, distortion: 0.4 }, motion: { ...STARTER_LINES[0].motion, type: "floating", amplitude: 0.035, speed: 0.07, frequency: 0.8 }, appearance: { color: "#52747b", opacity: 0.36, width: 1.5 }, glow: { enabled: true, intensity: 0.48 }, texture: { enabled: false, intensity: 0 } },
  "Fine Vibration": { name: "Fine Vibration", description: "Small physical tremor", shape: { ...DEFAULT_SHAPE, type: "vibration", amplitude: 0.008, frequency: 5 }, motion: { ...STARTER_LINES[0].motion, type: "vibration", amplitude: 0.01, speed: 0.6, frequency: 1.5 }, appearance: { color: "#7f8993", opacity: 0.3, width: 0.9 }, glow: { enabled: true, intensity: 0.24 }, texture: { enabled: false, intensity: 0 } },
  "Pixel Wire": { name: "Pixel Wire", description: "Stepped angular geometry", shape: { ...DEFAULT_SHAPE, type: "pixel", amplitude: 0.025, frequency: 3, pixelStep: 10, roughness: 0.15 }, motion: { ...STARTER_LINES[0].motion, type: "tension", amplitude: 0.01, speed: 0.16 }, appearance: { color: "#667c8c", opacity: 0.32, width: 1.2 }, glow: { enabled: false, intensity: 0 }, texture: { enabled: false, intensity: 0 } },
  "Soft Pixel": { name: "Soft Pixel", description: "Subtle stepped movement", shape: { ...DEFAULT_SHAPE, type: "pixel", amplitude: 0.014, frequency: 2, pixelStep: 6, roughness: 0.08 }, motion: { ...STARTER_LINES[0].motion, type: "floating", amplitude: 0.012, speed: 0.1 }, appearance: { color: "#788b91", opacity: 0.3, width: 1 }, glow: { enabled: true, intensity: 0.2 }, texture: { enabled: false, intensity: 0 } },
  "Editorial Wave": { name: "Editorial Wave", description: "Clean controlled wave", shape: { ...DEFAULT_SHAPE, type: "soft-wave", amplitude: 0.02, frequency: 2, cycles: 1.1, smoothness: 0.95 }, motion: { ...STARTER_LINES[0].motion, type: "tension", amplitude: 0.014, speed: 0.18 }, appearance: { color: "#758b80", opacity: 0.3, width: 1.1 }, glow: { enabled: false, intensity: 0 }, texture: { enabled: false, intensity: 0 } },
};

export function applyScenePreset(scene: MagneticLinesSceneConfig, name: string): MagneticLinesSceneConfig {
  const preset = SCENE_PRESETS[name];
  if (!preset) return scene;
  return {
    ...scene,
    version: scene.version,
    lines: scene.lines.map((line) => ({
      ...line,
      appearance: {
        ...line.appearance,
        ...preset.appearance,
        colorStyle: { type: "solid", colors: [preset.appearance.color, preset.appearance.color] },
      },
      shape: { ...preset.shape }, motion: { ...preset.motion },
      glow: { ...line.glow, ...preset.glow }, texture: { ...line.texture, ...preset.texture },
      cursorInfluence: { ...line.cursorInfluence, enabled: false },
      lineInteraction: { ...line.lineInteraction, enabled: false },
      constraint: { ...line.constraint, enabled: false },
      outerGlow: { ...line.outerGlow, enabled: false },
      inherit: { ...line.inherit, appearance: false, shape: false, motion: false, glow: false, outerGlow: false, texture: false, cursorInfluence: false, lineInteraction: false, constraint: false },
    })),
  };
}