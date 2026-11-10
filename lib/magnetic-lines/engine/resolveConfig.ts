import type {
  AppearanceConfig,
  GlobalSettings,
  GlowConfig,
  MagneticLineConfig,
  MagnetConfig,
  MotionConfig,
  ShapeConfig,
  AnchorMotionConfig,
  TextureConfig,
  FlowConfig,
  CursorInfluenceConfig,
  LineInteractionConfig,
  ConstraintConfig,
  OcclusionConfig,
} from "../types";
import { DEFAULT_LINE_ENVIRONMENT } from "../defaultScene";

export interface ResolvedLineConfig extends MagneticLineConfig {
  resolvedFrom: {
    appearance: "global" | "line";
    shape: "global" | "line";
    motion: "global" | "line";
    anchorMotion: "global" | "line";
    magnet: "global" | "line";
    glow: "global" | "line";
    outerGlow: "global" | "line";
    texture: "global" | "line";
    flow: "global" | "line";
    cursorInfluence: "global" | "line";
    lineInteraction: "global" | "line";
    constraint: "global" | "line";
    occlusion: "global" | "line";
  };
}

export function resolveLineConfig(line: MagneticLineConfig, global: GlobalSettings): ResolvedLineConfig {
  const appearance: AppearanceConfig = line.inherit.appearance
    ? { ...line.appearance, color: global.color, colorStyle: global.colorStyle, opacity: global.opacity, width: global.width }
    : { ...line.appearance };
  const shape: ShapeConfig = line.inherit.shape ? { ...global.shape } : { ...line.shape };
  const motion: MotionConfig = line.inherit.motion
    ? { ...line.motion, enabled: global.motionEnabled, type: global.motionType, speed: global.speed, amplitude: global.amplitude, frequency: global.frequency, phase: global.phase, deformability: global.deformability }
    : { ...line.motion };
  const anchorMotion: AnchorMotionConfig = line.inherit.anchorMotion ? { ...line.anchorMotion } : { ...line.anchorMotion };
  const outerGlow: GlowConfig = line.inherit.outerGlow
    ? { ...line.outerGlow, enabled: global.outerGlowEnabled, color: global.outerGlowColor, colorStyle: global.outerGlowColorStyle, intensity: global.outerGlowIntensity, opacity: global.outerGlowOpacity, radius: global.outerGlowRadius, length: global.outerGlowLength, falloff: global.outerGlowFalloff }
    : { ...line.outerGlow };
  const magnet: MagnetConfig = line.inherit.magnet
    ? { ...line.magnet, targetId: global.targetId, enabled: global.magnetismEnabled, strength: global.strength, radius: global.radius, falloff: global.falloff, maxDeformation: global.maxDeformation }
    : { ...line.magnet };
  const glow: GlowConfig = line.inherit.glow
    ? { ...line.glow, enabled: global.glowEnabled, color: global.glowColor, colorStyle: global.glowColorStyle, intensity: global.glowIntensity, opacity: global.glowOpacity, radius: global.glowRadius, length: global.glowLength, falloff: global.glowFalloff }
    : { ...line.glow };
  const texture: TextureConfig = line.inherit.texture
    ? { ...line.texture, enabled: global.textureEnabled, type: global.textureType, scale: global.textureScale, intensity: global.textureIntensity, showThread: global.textureShowThread, weight: global.textureWeight, silkStrands: global.textureSilkStrands }
    : { ...line.texture };
  const flow: FlowConfig = line.inherit.flow
    ? { ...global.flow, colors: [...global.flow.colors], layers: { ...global.flow.layers } }
    : { ...line.flow, colors: [...line.flow.colors], layers: { ...line.flow.layers } };
  const cursorInfluence: CursorInfluenceConfig = line.inherit.cursorInfluence ? { ...global.cursorInfluence } : { ...line.cursorInfluence };
  const lineInteraction: LineInteractionConfig = line.inherit.lineInteraction ? { ...global.lineInteraction } : { ...line.lineInteraction };
  const constraint: ConstraintConfig = line.inherit.constraint ? { ...global.constraint } : { ...line.constraint };
  const occlusion: OcclusionConfig = line.inherit.occlusion ? { ...global.occlusion } : { ...line.occlusion };
  const environment = line.environment ?? {
    ...DEFAULT_LINE_ENVIRONMENT,
    airflowPath: [],
    lightPosition: { ...DEFAULT_LINE_ENVIRONMENT.lightPosition },
  };
  return {
    ...line,
    appearance,
    shape,
    motion,
    anchorMotion,
    magnet,
    glow,
    outerGlow,
    texture,
    flow,
    environmentEnabled: line.environment ? line.environmentEnabled : false,
    environment,
    cursorInfluence,
    lineInteraction,
    constraint,
    occlusion,
    resolvedFrom: {
      appearance: line.inherit.appearance ? "global" : "line",
      shape: line.inherit.shape ? "global" : "line",
      motion: line.inherit.motion ? "global" : "line",
      anchorMotion: line.inherit.anchorMotion ? "global" : "line",
      magnet: line.inherit.magnet ? "global" : "line",
      glow: line.inherit.glow ? "global" : "line",
      outerGlow: line.inherit.outerGlow ? "global" : "line",
      texture: line.inherit.texture ? "global" : "line",
      flow: line.inherit.flow ? "global" : "line",
      cursorInfluence: line.inherit.cursorInfluence ? "global" : "line",
      lineInteraction: line.inherit.lineInteraction ? "global" : "line",
      constraint: line.inherit.constraint ? "global" : "line",
      occlusion: line.inherit.occlusion ? "global" : "line",
    },
  };
}