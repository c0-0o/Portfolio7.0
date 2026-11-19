import {
  CURSOR_PRESETS,
  DEFAULT_CURSOR_EFFECTS,
  registerCursorId,
  sanitizeCursorEffects,
  type CursorEffectsConfig,
  type CursorPresetId,
} from "./config";
import { CREATURE_CURSOR_IDS } from "./model";
import type { CursorInteractionState } from "./interactions";

export type CursorEditorSection =
  | "appearance"
  | "animation"
  | "movement"
  | "idle"
  | "hover"
  | "text"
  | "click"
  | "particles"
  | "advanced";

export type CursorInteraction =
  | "idle"
  | "movement"
  | "hover"
  | "click"
  | "double-click"
  | "drag"
  | "text-hover"
  | "text-selection"
  | "focus"
  | "exit";

export interface CursorRendererFrame {
  context: CanvasRenderingContext2D;
  config: CursorEffectsConfig;
  fillStyle: string | CanvasGradient;
  x: number;
  y: number;
  hovered: boolean;
  time: number;
  interaction: Readonly<CursorInteractionState>;
  motion: Readonly<CursorRendererMotion>;
  reducedMotion?: boolean;
}

export interface CursorRendererMotion {
  directionX: number;
  directionY: number;
  speed: number;
  angle: number;
  walking: boolean;
  pounceProgress: number | null;
  gaitSpeed: number;
  walkingIntensity: number;
  legArticulation: number;
  bodyBounce: number;
}

export type CursorRenderer = (frame: CursorRendererFrame) => void;

export interface CursorDefinition {
  id: CursorPresetId;
  name: string;
  description: string;
  category: string;
  rendererKey: string;
  version: number;
  defaultConfig: () => CursorEffectsConfig;
  sections: readonly CursorEditorSection[];
  interactions: readonly CursorInteraction[];
  animation: {
    idle: boolean;
    movement: boolean;
    interaction: boolean;
  };
  specializedSettings: readonly string[];
}

const commonSections: readonly CursorEditorSection[] = [
  "appearance",
  "animation",
  "movement",
  "hover",
  "text",
  "click",
  "particles",
  "advanced",
];

const presetPersonalities: Partial<Record<CursorPresetId, Partial<CursorEffectsConfig>>> = {
  pointer: {
    size: 28,
    color: "#ffffff",
    backgroundColor: "#ffffff",
    borderColor: "#080808",
    borderWidth: 2.2,
    pointerAccentColor: "#ADEB66",
    glow: 0,
    shadow: 0,
    movement: "none",
    click: "none",
    clickDurationMs: 260,
    hoverGrow: false,
    hoverColor: false,
    hoverOutline: false,
    idleAnimationEnabled: false,
    directionalFollow: false,
    cursorAnimationIntensity: 0,
    cursorStates: {
      ...DEFAULT_CURSOR_EFFECTS.cursorStates,
      pointer: { enabled: true, cursor: "pointer", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      link: { enabled: true, cursor: "pointer-hand", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      text: { enabled: true, cursor: "pointer-text", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      grab: { enabled: true, cursor: "pointer-hand", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      grabbing: { enabled: true, cursor: "pointer-hand", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      resize: { enabled: true, cursor: "pointer-resize-ew", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "resize-ew": { enabled: true, cursor: "pointer-resize-ew", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "resize-ns": { enabled: true, cursor: "pointer-resize-ns", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "resize-nesw": { enabled: true, cursor: "pointer-resize-nesw", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "resize-nwse": { enabled: true, cursor: "pointer-resize-nwse", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      move: { enabled: true, cursor: "pointer-move", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      wait: { enabled: true, cursor: "pointer-wait", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      progress: { enabled: true, cursor: "pointer-wait", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      disabled: { enabled: true, cursor: "pointer-not-allowed", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "not-allowed": { enabled: true, cursor: "pointer-not-allowed", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
      "no-drop": { enabled: true, cursor: "pointer-not-allowed", size: 28, color: "#ffffff", accentColor: "#ADEB66", borderColor: "#080808", borderWidth: 2.2, image: "", hotspotX: 0, hotspotY: 0 },
    },
  },
  "modern-arrow": { color: "#e8f4ff", borderColor: "#2a5673", effectColor: "#82dfff", clickEffectColor: "#b8ecff", movement: "comet", click: "ripple", hoverAnimation: "tilt", clickAnimation: "bounce", cursorAnimationSpeed: 1.15, directionalFollow: true },
  "white-circle": { color: "#f6fbff", borderColor: "#a7dfff", effectColor: "#c5eaff", clickEffectColor: "#e3f6ff", glow: 0.18, movement: "ripple", click: "ripple", hoverAnimation: "pulse", clickAnimation: "pulse", cursorAnimationSpeed: 0.82, directionalFollow: false },
  "black-circle": { color: "#101216", backgroundColor: "#101216", borderColor: "#9aadc1", effectColor: "#bacbe0", clickEffectColor: "#d5e0ed", movement: "particles", click: "shockwave", hoverAnimation: "glow", clickAnimation: "pulse", cursorAnimationSpeed: 0.72, directionalFollow: false },
  "outlined-circle": { color: "#b5e9f4", borderColor: "#77d9ef", effectColor: "#5fd1ed", clickEffectColor: "#a8efff", movement: "liquid", click: "ripple", hoverAnimation: "pulse", clickAnimation: "wobble", directionalFollow: false },
  "minimal-pointer": { color: "#fff1d6", borderColor: "#c7864b", effectColor: "#ffd397", clickEffectColor: "#ffe7b5", movement: "comet", click: "sparkles", hoverAnimation: "tilt", clickAnimation: "bounce", cursorAnimationSpeed: 1.1, directionalFollow: true },
  abstract: { color: "#bec7ff", borderColor: "#7c83db", effectColor: "#b6a8ff", clickEffectColor: "#d6c6ff", movement: "magic", click: "stars", hoverAnimation: "glow", clickAnimation: "spin", cursorAnimationSpeed: 0.85, directionalFollow: false },
  liquid: { color: "#60d6c8", borderColor: "#a5fff0", effectColor: "#74eedc", clickEffectColor: "#c2fff5", movement: "liquid", click: "ripple", hoverAnimation: "squash", clickAnimation: "wobble", cursorAnimationSpeed: 0.95, directionalFollow: false },
  blob: { color: "#ff9f87", borderColor: "#ffd0b5", effectColor: "#ffb08e", clickEffectColor: "#ffd0a5", movement: "particles", click: "shockwave", hoverAnimation: "squash", clickAnimation: "squash", cursorAnimationSpeed: 0.72, directionalFollow: false },
  artistic: { color: "#c59bff", borderColor: "#f2cdff", effectColor: "#df9fff", clickEffectColor: "#ffc4ec", movement: "magic", click: "sparkles", hoverAnimation: "glow", clickAnimation: "spin", cursorAnimationSpeed: 1.08, directionalFollow: false },
  cat: { color: "#e9ad78", borderColor: "#75422f", effectColor: "#ffc16e", clickEffectColor: "#ffdd87", movement: "paws", click: "hearts", hoverAnimation: "tilt", clickAnimation: "bounce", cursorAnimationSpeed: 1.05, directionalFollow: true },
  paw: { color: "#d89d77", borderColor: "#764d41", effectColor: "#f2bc8e", clickEffectColor: "#ffd9ad", movement: "paws", click: "particles", hoverAnimation: "pulse", clickAnimation: "bounce", cursorAnimationSpeed: 0.8, directionalFollow: true },
  heart: { color: "#ed6d92", borderColor: "#8f3158", effectColor: "#fa87aa", clickEffectColor: "#ffc1ce", movement: "magic", click: "hearts", hoverAnimation: "pulse", clickAnimation: "pulse", cursorAnimationSpeed: 0.9, directionalFollow: false },
  flower: { color: "#ef9bb7", borderColor: "#a64f7d", effectColor: "#ffc0d4", clickEffectColor: "#ffd9e7", movement: "fireflies", click: "sparkles", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 0.66, directionalFollow: false },
  smiley: { color: "#f5cf54", borderColor: "#946b26", effectColor: "#ffe37a", clickEffectColor: "#fff0a5", movement: "particles", click: "stars", hoverAnimation: "pulse", clickAnimation: "bounce", cursorAnimationSpeed: 0.85, directionalFollow: false },
  spider: { color: "#342044", backgroundColor: "#100d16", borderColor: "#c084fc", effectColor: "#b76cff", clickEffectColor: "#d8a4ff", movement: "none", click: "shockwave", hoverAnimation: "tilt", clickAnimation: "squash", cursorAnimationSpeed: 0.8, directionalFollow: false },
  web: { color: "#b7d6ef", borderColor: "#6485a6", effectColor: "#9dcced", clickEffectColor: "#d0edff", movement: "comet", click: "ripple", hoverAnimation: "glow", clickAnimation: "pulse", cursorAnimationSpeed: 0.62, directionalFollow: false },
  ghost: { color: "#d4e4ff", borderColor: "#8292bd", effectColor: "#b8d5ff", clickEffectColor: "#d8c6ff", movement: "liquid", click: "sparkles", hoverAnimation: "squash", clickAnimation: "wobble", cursorAnimationSpeed: 0.72, directionalFollow: true },
  skull: { color: "#e6dfce", borderColor: "#7d776e", effectColor: "#c8bfaa", clickEffectColor: "#ede0c6", movement: "particles", click: "shockwave", hoverAnimation: "tilt", clickAnimation: "squash", cursorAnimationSpeed: 0.6, directionalFollow: false },
  "pixel-arrow": { color: "#a5ef76", borderColor: "#315e42", effectColor: "#b8ff88", clickEffectColor: "#e0ff9c", movement: "pixel", click: "pixels", hoverAnimation: "tilt", clickAnimation: "bounce", cursorAnimationSpeed: 1.3, directionalFollow: true },
  "eight-bit": { color: "#65e4ff", borderColor: "#315a8c", effectColor: "#71ebff", clickEffectColor: "#c1f7ff", movement: "pixel", click: "pixels", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 1.05, directionalFollow: true },
  neon: { color: "#75f2ff", borderColor: "#3186a2", effectColor: "#64dfff", clickEffectColor: "#b8f7ff", movement: "comet", click: "shockwave", hoverAnimation: "glow", clickAnimation: "pulse", cursorAnimationSpeed: 1.1, directionalFollow: true },
  "glow-circle": { color: "#ce9bff", borderColor: "#865fc2", effectColor: "#d2a3ff", clickEffectColor: "#f0d2ff", movement: "fireflies", click: "sparkles", hoverAnimation: "glow", clickAnimation: "pulse", cursorAnimationSpeed: 0.9, directionalFollow: false },
  leaf: { color: "#7dbc6b", borderColor: "#315b3c", effectColor: "#a5d777", clickEffectColor: "#d8f09e", movement: "fireflies", click: "particles", hoverAnimation: "tilt", clickAnimation: "spin", cursorAnimationSpeed: 0.6, directionalFollow: true },
  butterfly: { color: "#efa4d2", borderColor: "#834d9b", effectColor: "#f2b9ee", clickEffectColor: "#ffe1ff", movement: "fireflies", click: "sparkles", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 1.25, directionalFollow: true },
  "water-drop": { color: "#63bde5", borderColor: "#2c6e98", effectColor: "#8de1ff", clickEffectColor: "#c1f2ff", movement: "liquid", click: "ripple", hoverAnimation: "squash", clickAnimation: "pulse", cursorAnimationSpeed: 0.72, directionalFollow: true },
  floral: { color: "#f2b0d1", borderColor: "#8f628b", effectColor: "#dba7f0", clickEffectColor: "#f6d5ff", movement: "fireflies", click: "hearts", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 0.7, directionalFollow: false },
};

const categoryPersonalities: Record<string, Partial<CursorEffectsConfig>> = {
  Classic: { movement: "none", click: "ripple", hoverAnimation: "squash", clickAnimation: "squash", hoverDelayMs: 0, clickDurationMs: 260 },
  Animals: { movement: "paws", click: "hearts", hoverAnimation: "tilt", clickAnimation: "bounce", cursorAnimationSpeed: 0.9, hoverDelayMs: 25, clickDurationMs: 560 },
  Insects: { movement: "fireflies", click: "sparkles", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 1.15, hoverDelayMs: 10, clickDurationMs: 430 },
  Botanical: { movement: "fireflies", click: "particles", hoverAnimation: "tilt", clickAnimation: "spin", cursorAnimationSpeed: 0.68, hoverDelayMs: 65, clickDurationMs: 620 },
  Fantasy: { movement: "magic", click: "stars", hoverAnimation: "glow", clickAnimation: "spin", cursorAnimationSpeed: 0.88, hoverDelayMs: 15, clickDurationMs: 520 },
  Romantic: { movement: "magic", click: "hearts", hoverAnimation: "pulse", clickAnimation: "wobble", cursorAnimationSpeed: 0.82, hoverDelayMs: 20, clickDurationMs: 540 },
  Food: { movement: "particles", click: "particles", hoverAnimation: "squash", clickAnimation: "bounce", cursorAnimationSpeed: 0.78, hoverDelayMs: 30, clickDurationMs: 470 },
  Weather: { movement: "liquid", click: "ripple", hoverAnimation: "tilt", clickAnimation: "pulse", cursorAnimationSpeed: 0.7, hoverDelayMs: 55, clickDurationMs: 680 },
  Space: { movement: "comet", click: "stars", hoverAnimation: "glow", clickAnimation: "spin", cursorAnimationSpeed: 0.76, hoverDelayMs: 40, clickDurationMs: 720 },
  Nature: { movement: "fireflies", click: "sparkles", hoverAnimation: "tilt", clickAnimation: "spin", cursorAnimationSpeed: 0.72, hoverDelayMs: 55, clickDurationMs: 620 },
  Cute: { movement: "magic", click: "hearts", hoverAnimation: "pulse", clickAnimation: "bounce", cursorAnimationSpeed: 0.92, hoverDelayMs: 15, clickDurationMs: 500 },
  Spooky: { movement: "liquid", click: "shockwave", hoverAnimation: "squash", clickAnimation: "wobble", cursorAnimationSpeed: 0.7, hoverDelayMs: 45, clickDurationMs: 620 },
  Retro: { movement: "pixel", click: "pixels", hoverAnimation: "pulse", clickAnimation: "spin", cursorAnimationSpeed: 1.12, hoverDelayMs: 0, clickDurationMs: 380 },
  Futuristic: { movement: "comet", click: "shockwave", hoverAnimation: "glow", clickAnimation: "pulse", cursorAnimationSpeed: 1.05, hoverDelayMs: 10, clickDurationMs: 440 },
  Creative: { movement: "magic", click: "sparkles", hoverAnimation: "glow", clickAnimation: "spin", cursorAnimationSpeed: 0.94, hoverDelayMs: 25, clickDurationMs: 520 },
  Popular: { movement: "comet", click: "ripple", hoverAnimation: "pulse", clickAnimation: "bounce", cursorAnimationSpeed: 1, hoverDelayMs: 15, clickDurationMs: 480 },
};

const descriptions: Partial<Record<CursorPresetId, string>> = {
  native: "Use the operating system cursor.",
  "custom-image": "Use an uploaded image with an adjustable hotspot.",
  pointer: "A crisp white pointer with a black outline and a lime offset accent.",
  "modern-arrow": "A filled pointer with an outlined edge.",
  "white-circle": "A solid white circular cursor.",
  "black-circle": "A solid dark circular cursor.",
  "outlined-circle": "A circular cursor filled with the selected background color.",
  "minimal-pointer": "A compact pointer silhouette.",
  abstract: "An outlined geometric loop.",
  liquid: "A fluid ellipse with a subtle animated contour.",
  blob: "A soft, organic ellipse.",
  artistic: "A translucent geometric loop.",
  cat: "A cat-head silhouette.",
  paw: "A paw-print cursor.",
  heart: "A heart-shaped cursor.",
  flower: "A six-petal flower.",
  smiley: "A smiling face.",
  spider: "An articulated spider that follows, crouches, and pounces.",
  web: "A radial spider-web outline.",
  ghost: "A ghost silhouette.",
  skull: "A skull silhouette.",
  "pixel-arrow": "An angular pixel-inspired pointer.",
  "eight-bit": "A block-built retro cursor.",
  neon: "A ring-and-crosshair cursor.",
  "glow-circle": "A circular cursor with adjustable glow.",
  leaf: "A leaf outline with a central vein.",
  butterfly: "A butterfly silhouette.",
  "water-drop": "A teardrop-shaped cursor.",
  floral: "A six-petal floral cursor.",
  "tiny-cat": "A whiskered kitten with independently swaying tail and twitching ears.",
  bunny: "A long-eared rabbit with flopping ears and springy hops.",
  duckling: "A yellow duckling that waddles and flaps its wings.",
  "panda-cub": "A black-and-white cub with articulated paws and a gentle sway.",
  "baby-fox": "A red fox kit with a swishing bushy tail and bright chest.",
  penguin: "A tuxedoed penguin that waddles and beats its flippers.",
  hamster: "A cheeky hamster with twitching whiskers and busy feet.",
  hedgehog: "A sniffing hedgehog with a crown of individually moving spines.",
  "baby-frog": "A big-eyed froglet with compressing legs and springing jumps.",
  "little-turtle": "A plated little turtle with alternating legs and a retracting head.",
  "monarch-butterfly": "A black-veined monarch with four articulated orange wings.",
  "pink-butterfly": "A rose-patterned butterfly with independently fluttering wings.",
  ladybug: "A spotted beetle with walking legs and opening wing cases.",
  dragonfly: "A hovering dragonfly with four separately beating translucent wings.",
  honeybee: "A striped bee with vibrating wings and dangling legs.",
  firefly: "A winged firefly with a pulsing, softly radiating abdomen.",
  moth: "A broad-winged moth with patterned, slow irregular flight.",
  caterpillar: "A segmented caterpillar with sequential crawling waves and tiny legs.",
  snail: "A spiral-shelled snail with independently moving eye stalks.",
  "praying-mantis": "An alert mantis with folded, independently striking forearms.",
  "autumn-leaves": "Maple and oak leaves tumble and drift on individual wind-blown paths.",
  "cherry-blossom": "Curved blossom petals flutter, turn, and float at different heights.",
  dandelion: "A detailed seed head gradually releases filaments into the breeze.",
  "rose-petals": "Layered rose petals spiral and flip as they fall.",
  sunflower: "A detailed sunflower bends its leafy stem and turns toward movement.",
  daisy: "Individual white petals open and sway around a golden flower disk.",
  lavender: "Purple flower spikes sway independently on flexible green stems.",
  "ivy-vine": "A curling ivy tendril carries veined, individually swaying leaves.",
  fern: "A feathered fern frond bends along its stem with articulated leaflets.",
  "maple-seeds": "Paired maple samaras spin around their seed bodies as they drift.",
  fairy: "A tiny fairy floats in a curved path with four independently beating wings.",
  "magic-wand": "A jeweled wand tilts toward motion and releases small sparks from its star tip.",
  wizard: "A pointed-hat wizard floats, lifts a wand, and casts a small spell.",
  "potion-bottle": "A glass vial tilts as its liquid sloshes and bubbles rise.",
  crystal: "A faceted gemstone floats while its internal light shifts across planes.",
  "enchanted-mushroom": "A spotted mushroom bounces gently as glowing spores rise from its gills.",
  spellbook: "A bound spellbook opens and flutters its pages around a glowing sigil.",
  unicorn: "A horned unicorn with flowing mane bobs while its hair and tail trail.",
  "baby-dragon": "A horned hatchling beats its wings, curls its tail, and puffs harmless magic.",
  "tiny-ghost": "A soft scalloped ghost floats, blinks, and compresses on a click.",
  "satin-bow": "A shaded satin bow flutters its loops and trails its folded ribbon tails.",
  "flowing-ribbon": "A continuous folded ribbon bends into an animated curl behind the pointer.",
  "pearl-necklace": "Individually highlighted pearls swing along a curved strand and settle after motion.",
  "heart-locket": "A layered metallic heart locket swings open briefly to reveal its enamel heart.",
  "pink-rose": "A layered rose with curled veined petals sways and sheds petals when clicked.",
  "cherry-pair": "Two glossy cherries swing on curved stems beneath a small leaf.",
  strawberry: "A shaded strawberry with leaf crown, visible seeds, and click-scattered flecks.",
  cupid: "A winged Cupid hovers with a bow and sends a small heart arrow on click.",
  "angel-wings": "Layered feathered wings flap on separate arcs and spread on click.",
  "love-letter": "A folded envelope with a wax-heart seal opens to lift out its lined letter.",
  donut: "A baked ring donut with icing, a real center hole, and individually scattered sprinkles.",
  cupcake: "A pleated wrapper supports stacked curved frosting swirls and a bouncing cake.",
  macaron: "Two textured rounded macaron shells sandwich visible cream and split on click.",
  "ice-cream": "A textured irregular scoop sits over a crosshatched waffle cone.",
  "bubble-tea": "A transparent cup shows colored tea, straw, reflections, and bouncing tapioca pearls.",
  "matcha-latte": "A layered matcha latte with a small petal latte-art pattern and click ripples.",
  "coffee-cup": "A handled ceramic cup shows moving coffee and several individually curling steam strands.",
  croissant: "A curved laminated croissant has distinct baked layers and scatters crumbs on click.",
  watermelon: "A triangular juicy watermelon slice shows pale rind, green skin, and shaped seeds.",
  cookie: "A rough-edged baked cookie shows chocolate chips and a brief click crack before reforming.",
  snowfall: "Individually branched flakes drift and rotate in a small breeze before bursting into snow on click.",
  rain: "Slanted drops and fine streaks fall at varied speeds, with rippling splash rings on click.",
  "wind-gust": "Curved, twisting air-streams and drifting motes gather into a concentrated outward gust.",
  "floating-clouds": "Shaded cloud puffs drift independently at layered depths and briefly separate on click.",
  rainbow: "Distinct, softly banded arcs rest over tiny clouds and release a ring of sparkles on click.",
  "northern-lights": "Translucent green, teal, and violet curtains wave and brighten in a soft aurora pulse.",
  fog: "Overlapping translucent wisps drift at different speeds and disperse outward on click.",
  thunderstorm: "Dark layered storm clouds carry branching, brief lightning and a short rain burst.",
  "dust-motes": "Warm sunlit motes float and rotate slowly, scattering gently before returning to their drift.",
  "frost-crystals": "Branching geometric ice crystals rotate slowly and shed restrained fragments on click.",
  saturn: "A softly banded planet turns inside distinct layered rings and emits orbiting sparkles on click.",
  "mini-earth": "A blue planet with shaped continents and independently drifting cloud patterns rotates in space.",
  "shooting-star": "A luminous star arcs around the pointer with tapered layers and fading fragments.",
  galaxy: "Curved spiral arms turn at separate rates around a bright core and release stars on click.",
  "black-hole": "A dark gravitational core bends orbiting particles through a layered accretion disk.",
  comet: "An icy nucleus follows in delayed motion with layered flowing tail ribbons and orbiting ice.",
  astronaut: "A suited astronaut floats weightlessly with a reflective helmet, backpack, and articulated limbs.",
  ufo: "A metallic saucer hovers under a glass dome with moving lights and an activating beam.",
  rocket: "A detailed rocket tilts toward movement with layered exhaust and a short launch on click.",
  constellation: "Connected stars follow together while twinkling independently and illuminate in sequence on click.",
};

const presetIds = new Set<string>(CURSOR_PRESETS.map(({ id }) => id));
const creatureIds = new Set<string>(CREATURE_CURSOR_IDS);
const definitions = new Map<string, CursorDefinition>();
const renderers = new Map<string, CursorRenderer>();

function makeDefinition(
  id: CursorPresetId,
  name: string,
  category: string,
  rendererKey: string,
  overrides: Partial<Pick<CursorDefinition, "sections" | "interactions" | "animation" | "specializedSettings">> = {},
): CursorDefinition {
  return {
    id,
    name,
    description: descriptions[id] ?? `${name} cursor.`,
    category,
    rendererKey,
    version: 1,
    defaultConfig: () => sanitizeCursorEffects({
      ...DEFAULT_CURSOR_EFFECTS,
      cursor: id,
      ...categoryPersonalities[category],
      ...presetPersonalities[id],
      directionalFollow: id !== "spider" && id !== "pointer",
    }),
    sections: overrides.sections ?? commonSections,
    interactions: overrides.interactions ?? ["idle", "movement", "hover", "click", "focus", "exit"],
    animation: overrides.animation ?? { idle: true, movement: true, interaction: true },
    specializedSettings: overrides.specializedSettings ?? [],
  };
}

definitions.set("native", makeDefinition("native", "System cursor", "System", "native", {
  sections: ["appearance"],
  interactions: [],
  animation: { idle: false, movement: false, interaction: false },
}));
definitions.set("custom-image", makeDefinition("custom-image", "Custom image", "Custom", "custom-image", {
  animation: { idle: false, movement: true, interaction: true },
}));

for (const preset of CURSOR_PRESETS) {
  const isSpider = preset.id === "spider";
  definitions.set(preset.id, makeDefinition(preset.id, preset.name, preset.category, preset.id, isSpider
    ? {
      sections: [...commonSections, "idle"],
      interactions: ["idle", "movement", "hover", "click", "focus", "exit"],
      animation: { idle: false, movement: true, interaction: true },
      specializedSettings: ["spider"],
    }
    : creatureIds.has(preset.id)
    ? {
      sections: [...commonSections, "idle"],
      interactions: ["idle", "movement", "hover", "click", "drag", "focus", "exit"],
      animation: { idle: true, movement: true, interaction: true },
      specializedSettings: ["creature"],
    }
    : undefined));
}

export function getCursorDefinition(id: string): CursorDefinition | undefined {
  return definitions.get(id);
}

export function getDefaultWebsiteCursorConfig(): CursorEffectsConfig {
  const definition = getCursorDefinition("pointer");
  if (!definition) throw new Error("The Classic Pointer cursor is not registered.");
  return definition.defaultConfig();
}

export function getCursorDefinitions(): CursorDefinition[] {
  return Array.from(definitions.values());
}

export function isRegisteredCursorId(id: string): id is CursorPresetId {
  return definitions.has(id);
}

export function registerCursorDefinition(definition: CursorDefinition): () => void {
  if (definitions.has(definition.id)) {
    throw new Error(`Cursor "${definition.id}" is already registered.`);
  }
  if (!definition.id.trim() || !definition.rendererKey.trim()) {
    throw new Error("A cursor definition requires an ID and renderer key.");
  }
  const unregisterCursorId = registerCursorId(definition.id);
  definitions.set(definition.id, definition);
  return () => {
    if (definitions.get(definition.id) === definition) {
      definitions.delete(definition.id);
      unregisterCursorId();
    }
  };
}

export function registerCursorRenderer(rendererKey: string, renderer: CursorRenderer, replaceExisting = false): () => void {
  if (renderers.has(rendererKey) && !replaceExisting) {
    throw new Error(`Cursor renderer "${rendererKey}" is already registered.`);
  }
  renderers.set(rendererKey, renderer);
  return () => {
    if (renderers.get(rendererKey) === renderer) renderers.delete(rendererKey);
  };
}

export function getCursorRenderer(rendererKey: string): CursorRenderer | undefined {
  return renderers.get(rendererKey);
}

export function isBuiltInCursor(id: string): id is CursorPresetId {
  return presetIds.has(id);
}
