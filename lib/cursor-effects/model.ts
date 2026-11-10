export const CURSOR_CONFIGURATION_VERSION = 2;
export const CURSOR_LIBRARY_VERSION = 1;

export const CREATURE_CURSOR_IDS = [
  "tiny-cat",
  "bunny",
  "duckling",
  "panda-cub",
  "baby-fox",
  "penguin",
  "hamster",
  "hedgehog",
  "baby-frog",
  "little-turtle",
  "monarch-butterfly",
  "pink-butterfly",
  "ladybug",
  "dragonfly",
  "honeybee",
  "firefly",
  "moth",
  "caterpillar",
  "snail",
  "praying-mantis",
  "autumn-leaves",
  "cherry-blossom",
  "dandelion",
  "rose-petals",
  "sunflower",
  "daisy",
  "lavender",
  "ivy-vine",
  "fern",
  "maple-seeds",
  "fairy",
  "magic-wand",
  "wizard",
  "potion-bottle",
  "crystal",
  "enchanted-mushroom",
  "spellbook",
  "unicorn",
  "baby-dragon",
  "tiny-ghost",
  "satin-bow",
  "flowing-ribbon",
  "pearl-necklace",
  "heart-locket",
  "pink-rose",
  "cherry-pair",
  "strawberry",
  "cupid",
  "angel-wings",
  "love-letter",
  "donut",
  "cupcake",
  "macaron",
  "ice-cream",
  "bubble-tea",
  "matcha-latte",
  "coffee-cup",
  "croissant",
  "watermelon",
  "cookie",
  "snowfall",
  "rain",
  "wind-gust",
  "floating-clouds",
  "rainbow",
  "northern-lights",
  "fog",
  "thunderstorm",
  "dust-motes",
  "frost-crystals",
  "saturn",
  "mini-earth",
  "shooting-star",
  "galaxy",
  "black-hole",
  "comet",
  "astronaut",
  "ufo",
  "rocket",
  "constellation",
] as const;
export type CreatureCursorId = (typeof CREATURE_CURSOR_IDS)[number];
export type CursorCategory = "Classic" | "Popular" | "Creative" | "Cute" | "Spooky" | "Retro" | "Futuristic" | "Nature" | "Animals" | "Insects" | "Botanical" | "Fantasy" | "Romantic" | "Food" | "Weather" | "Space";
export const POINTER_CURSOR_SHAPE_IDS = [
  "pointer-hand",
  "pointer-text",
  "pointer-move",
  "pointer-resize-ew",
  "pointer-resize-ns",
  "pointer-resize-nesw",
  "pointer-resize-nwse",
  "pointer-wait",
  "pointer-not-allowed",
] as const;
export type CursorPresetId =
  | "native" | "pointer" | "modern-arrow" | "white-circle" | "black-circle" | "outlined-circle" | "minimal-pointer"
  | "abstract" | "liquid" | "blob" | "artistic"
  | "cat" | "paw" | "heart" | "flower" | "smiley"
  | "spider" | "web" | "ghost" | "skull"
  | "pixel-arrow" | "eight-bit"
  | "neon" | "glow-circle"
  | "leaf" | "butterfly" | "water-drop" | "floral" | "custom-image"
  | (typeof POINTER_CURSOR_SHAPE_IDS)[number]
  | CreatureCursorId
  | (string & {});

export type CursorStateId =
  | "pointer" | "link" | "text" | "disabled" | "grab" | "grabbing" | "resize"
  | "resize-ew" | "resize-ns" | "resize-nesw" | "resize-nwse"
  | "crosshair" | "help" | "wait" | "progress" | "not-allowed" | "no-drop"
  | "zoom-in" | "zoom-out" | "move" | "context-menu" | "copy" | "alias";

export interface CursorStateConfig {
  enabled: boolean;
  cursor: CursorPresetId;
  size: number;
  color: string;
  accentColor: string;
  borderColor: string;
  borderWidth: number;
  image: string;
  hotspotX: number;
  hotspotY: number;
}

export type CursorStateConfigs = Record<CursorStateId, CursorStateConfig>;

export interface SpiderCursorSettings {
  followDelayMs: number;
  gaitSpeed: number;
  walkingIntensity: number;
  legArticulation: number;
  movementSensitivity: number;
  bodyBounce: number;
  pounceDurationMs: number;
}

export interface CreatureCursorSettings {
  bodyColor: string;
  accentColor: string;
  detailColor: string;
  speed: number;
  intensity: number;
  articulation: number;
  segments: number;
  hoverDelayMs: number;
  clickDelayMs: number;
  clickDurationMs: number;
  rotationSensitivity: number;
  directionalFollow: boolean;
  idleEnabled: boolean;
  hoverEnabled: boolean;
  clickEnabled: boolean;
}

export type MovementEffect =
  | "none" | "ripple" | "particles" | "comet" | "magic" | "paws"
  | "spider" | "liquid" | "fireflies" | "pixel";
export type ClickEffect = "none" | "ripple" | "particles" | "stars" | "hearts" | "sparkles" | "pixels" | "shockwave";
export type CursorAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "smoothstep";
export type CursorHoverAnimation = "pulse" | "tilt" | "squash" | "glow";
export type CursorClickAnimation = "bounce" | "spin" | "squash" | "pulse" | "wobble";

export interface CursorEffectsConfig {
  schemaVersion: typeof CURSOR_CONFIGURATION_VERSION;
  cursor: CursorPresetId;
  size: number;
  widthScale: number;
  heightScale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  gradientEnabled: boolean;
  gradientEndColor: string;
  gradientAngle: number;
  animationDurationMs: number;
  animationEasing: CursorAnimationEasing;
  followSmoothing: number;
  cursorAnimationSpeed: number;
  cursorAnimationIntensity: number;
  movementSensitivity: number;
  rotationSensitivity: number;
  directionalFollow: boolean;
  idleAnimationEnabled: boolean;
  hoverAnimation: CursorHoverAnimation;
  hoverDelayMs: number;
  hoverTransitionMs: number;
  hoverIntensity: number;
  clickAnimation: CursorClickAnimation;
  clickDelayMs: number;
  clickDurationMs: number;
  clickIntensity: number;
  cursorImage: string;
  hotspotX: number;
  hotspotY: number;
  cursorStates: CursorStateConfigs;
  color: string;
  pointerAccentColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  shadow: number;
  glow: number;
  movement: MovementEffect;
  click: ClickEffect;
  trailLength: number;
  trailSpeed: number;
  particleSize: number;
  particleDensity: number;
  effectColor: string;
  clickEffectColor: string;
  clickSize: number;
  spiderWeb: boolean;
  hoverGrow: boolean;
  hoverShape: boolean;
  hoverColor: boolean;
  hoverOutline: boolean;
  magneticHover: boolean;
  hoverColorValue: string;
  magneticStrength: number;
  glassEffect: boolean;
  glassBlur: number;
  glassOpacity: number;
  glitchEffect: boolean;
  glitchIntensity: number;
  gameEffect: boolean;
  soundHover: boolean;
  soundClick: boolean;
  soundVolume: number;
  spider: SpiderCursorSettings;
  creatures: Record<CreatureCursorId, CreatureCursorSettings>;
}

export type CursorUniversalConfiguration = CursorEffectsConfig;

export interface CursorCustomization {
  version: typeof CURSOR_CONFIGURATION_VERSION;
  cursorId: CursorPresetId;
  updatedAt: string;
  configuration: CursorUniversalConfiguration;
}

export interface SavedCursorTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  preview?: string;
  sourceCursorId: CursorPresetId;
  configuration: CursorUniversalConfiguration;
  createdAt: string;
  updatedAt: string;
  version: typeof CURSOR_CONFIGURATION_VERSION;
}

export interface CursorLibraryState {
  version: typeof CURSOR_LIBRARY_VERSION;
  customizations: Partial<Record<CursorPresetId, CursorCustomization>>;
  templates: SavedCursorTemplate[];
}
