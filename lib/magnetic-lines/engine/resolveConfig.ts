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
  TextureFlowConfig,
  CursorInfluenceConfig,
  LineInteractionConfig,
  ConstraintConfig,
  OcclusionConfig,
} from "../types";

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
    textureFlow: "global" | "line";
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
    ? { ...line.motion, type: global.motionType, speed: global.speed, amplitude: global.amplitude, frequency: global.frequency, phase: global.phase, deformability: global.deformability }
    : { ...line.motion };
  const anchorMotion: AnchorMotionConfig = line.inherit.anchorMotion ? { ...line.anchorMotion } : { ...line.anchorMotion };
  const outerGlow: GlowConfig = line.inherit.outerGlow
    ? { ...line.outerGlow, enabled: global.outerGlowEnabled, color: global.outerGlowColor, intensity: global.outerGlowIntensity, radius: global.outerGlowRadius, length: global.outerGlowLength, falloff: global.outerGlowFalloff }
    : { ...line.outerGlow };
  const magnet: MagnetConfig = line.inherit.magnet
    ? { ...line.magnet, targetId: global.targetId, enabled: global.magnetismEnabled, strength: global.strength, radius: global.radius, falloff: global.falloff, maxDeformation: global.maxDeformation }
    : { ...line.magnet };
  const glow: GlowConfig = line.inherit.glow
    ? { ...line.glow, enabled: global.glowEnabled, color: global.glowColor, intensity: global.glowIntensity, radius: global.glowRadius, length: global.glowLength, falloff: global.glowFalloff }
    : { ...line.glow };
  const texture: TextureConfig = line.inherit.texture
    ? { ...line.texture, enabled: global.textureEnabled, type: global.textureType, scale: global.textureScale, intensity: global.textureIntensity }
    : { ...line.texture };
  const textureFlow: TextureFlowConfig = line.inherit.textureFlow ? { ...global.textureFlow } : { ...line.textureFlow };
  const cursorInfluence: CursorInfluenceConfig = line.inherit.cursorInfluence ? { ...global.cursorInfluence } : { ...line.cursorInfluence };
  const lineInteraction: LineInteractionConfig = line.inherit.lineInteraction ? { ...global.lineInteraction } : { ...line.lineInteraction };
  const constraint: ConstraintConfig = line.inherit.constraint ? { ...global.constraint } : { ...line.constraint };
  const occlusion: OcclusionConfig = line.inherit.occlusion ? { ...global.occlusion } : { ...line.occlusion };
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
    textureFlow,
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
      textureFlow: line.inherit.textureFlow ? "global" : "line",
      cursorInfluence: line.inherit.cursorInfluence ? "global" : "line",
      lineInteraction: line.inherit.lineInteraction ? "global" : "line",
      constraint: line.inherit.constraint ? "global" : "line",
      occlusion: line.inherit.occlusion ? "global" : "line",
    },
  };
}