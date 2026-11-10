import { CURSOR_CONFIGURATION_VERSION } from "./model";
import type {
  ClickEffect,
  CreatureCursorId,
  CreatureCursorSettings,
  CursorClickAnimation,
  CursorAnimationEasing,
  CursorCategory,
  CursorEffectsConfig,
  CursorHoverAnimation,
  CursorPresetId,
  CursorStateConfig,
  CursorStateConfigs,
  CursorStateId,
  MovementEffect,
} from "./model";
import { CREATURE_CURSOR_IDS, POINTER_CURSOR_SHAPE_IDS } from "./model";
export type {
  ClickEffect,
  CreatureCursorId,
  CreatureCursorSettings,
  CursorClickAnimation,
  CursorAnimationEasing,
  CursorCategory,
  CursorEffectsConfig,
  CursorHoverAnimation,
  CursorPresetId,
  CursorStateConfig,
  CursorStateConfigs,
  CursorStateId,
  MovementEffect,
  SpiderCursorSettings,
} from "./model";

export interface CursorPreset {
  id: CursorPresetId;
  name: string;
  category: CursorCategory;
}

export const CREATURE_CURSOR_PRESETS: CursorPreset[] = [
  { id: "tiny-cat", name: "Tiny Cat", category: "Animals" },
  { id: "bunny", name: "Bunny", category: "Animals" },
  { id: "duckling", name: "Duckling", category: "Animals" },
  { id: "panda-cub", name: "Panda Cub", category: "Animals" },
  { id: "baby-fox", name: "Baby Fox", category: "Animals" },
  { id: "penguin", name: "Penguin", category: "Animals" },
  { id: "hamster", name: "Hamster", category: "Animals" },
  { id: "hedgehog", name: "Hedgehog", category: "Animals" },
  { id: "baby-frog", name: "Baby Frog", category: "Animals" },
  { id: "little-turtle", name: "Little Turtle", category: "Animals" },
  { id: "monarch-butterfly", name: "Monarch Butterfly", category: "Insects" },
  { id: "pink-butterfly", name: "Pink Butterfly", category: "Insects" },
  { id: "ladybug", name: "Ladybug", category: "Insects" },
  { id: "dragonfly", name: "Dragonfly", category: "Insects" },
  { id: "honeybee", name: "Honeybee", category: "Insects" },
  { id: "firefly", name: "Firefly", category: "Insects" },
  { id: "moth", name: "Moth", category: "Insects" },
  { id: "caterpillar", name: "Caterpillar", category: "Insects" },
  { id: "snail", name: "Snail", category: "Insects" },
  { id: "praying-mantis", name: "Praying Mantis", category: "Insects" },
  { id: "autumn-leaves", name: "Autumn Leaves", category: "Botanical" },
  { id: "cherry-blossom", name: "Cherry Blossom", category: "Botanical" },
  { id: "dandelion", name: "Dandelion", category: "Botanical" },
  { id: "rose-petals", name: "Rose Petals", category: "Botanical" },
  { id: "sunflower", name: "Sunflower", category: "Botanical" },
  { id: "daisy", name: "Daisy", category: "Botanical" },
  { id: "lavender", name: "Lavender", category: "Botanical" },
  { id: "ivy-vine", name: "Ivy Vine", category: "Botanical" },
  { id: "fern", name: "Fern", category: "Botanical" },
  { id: "maple-seeds", name: "Maple Seeds", category: "Botanical" },
  { id: "fairy", name: "Fairy", category: "Fantasy" },
  { id: "magic-wand", name: "Magic Wand", category: "Fantasy" },
  { id: "wizard", name: "Wizard", category: "Fantasy" },
  { id: "potion-bottle", name: "Potion Bottle", category: "Fantasy" },
  { id: "crystal", name: "Crystal", category: "Fantasy" },
  { id: "enchanted-mushroom", name: "Enchanted Mushroom", category: "Fantasy" },
  { id: "spellbook", name: "Spellbook", category: "Fantasy" },
  { id: "unicorn", name: "Unicorn", category: "Fantasy" },
  { id: "baby-dragon", name: "Baby Dragon", category: "Fantasy" },
  { id: "tiny-ghost", name: "Tiny Ghost", category: "Fantasy" },
  { id: "satin-bow", name: "Satin Bow", category: "Romantic" },
  { id: "flowing-ribbon", name: "Flowing Ribbon", category: "Romantic" },
  { id: "pearl-necklace", name: "Pearl Necklace", category: "Romantic" },
  { id: "heart-locket", name: "Heart Locket", category: "Romantic" },
  { id: "pink-rose", name: "Pink Rose", category: "Romantic" },
  { id: "cherry-pair", name: "Cherry Pair", category: "Romantic" },
  { id: "strawberry", name: "Strawberry", category: "Romantic" },
  { id: "cupid", name: "Cupid", category: "Romantic" },
  { id: "angel-wings", name: "Angel Wings", category: "Romantic" },
  { id: "love-letter", name: "Love Letter", category: "Romantic" },
  { id: "donut", name: "Donut", category: "Food" },
  { id: "cupcake", name: "Cupcake", category: "Food" },
  { id: "macaron", name: "Macaron", category: "Food" },
  { id: "ice-cream", name: "Ice Cream", category: "Food" },
  { id: "bubble-tea", name: "Bubble Tea", category: "Food" },
  { id: "matcha-latte", name: "Matcha Latte", category: "Food" },
  { id: "coffee-cup", name: "Coffee Cup", category: "Food" },
  { id: "croissant", name: "Croissant", category: "Food" },
  { id: "watermelon", name: "Watermelon", category: "Food" },
  { id: "cookie", name: "Cookie", category: "Food" },
  { id: "snowfall", name: "Snowfall", category: "Weather" },
  { id: "rain", name: "Rain", category: "Weather" },
  { id: "wind-gust", name: "Wind Gust", category: "Weather" },
  { id: "floating-clouds", name: "Floating Clouds", category: "Weather" },
  { id: "rainbow", name: "Rainbow", category: "Weather" },
  { id: "northern-lights", name: "Northern Lights", category: "Weather" },
  { id: "fog", name: "Fog", category: "Weather" },
  { id: "thunderstorm", name: "Thunderstorm", category: "Weather" },
  { id: "dust-motes", name: "Dust Motes", category: "Weather" },
  { id: "frost-crystals", name: "Frost Crystals", category: "Weather" },
  { id: "saturn", name: "Saturn", category: "Space" },
  { id: "mini-earth", name: "Mini Earth", category: "Space" },
  { id: "shooting-star", name: "Shooting Star", category: "Space" },
  { id: "galaxy", name: "Galaxy", category: "Space" },
  { id: "black-hole", name: "Black Hole", category: "Space" },
  { id: "comet", name: "Comet", category: "Space" },
  { id: "astronaut", name: "Astronaut", category: "Space" },
  { id: "ufo", name: "UFO", category: "Space" },
  { id: "rocket", name: "Rocket", category: "Space" },
  { id: "constellation", name: "Constellation", category: "Space" },
];

export const CURSOR_PRESETS: CursorPreset[] = [
  { id: "pointer", name: "Pointer", category: "Classic" },
  { id: "modern-arrow", name: "Modern arrow", category: "Popular" },
  { id: "white-circle", name: "White circle", category: "Popular" },
  { id: "black-circle", name: "Black circle", category: "Popular" },
  { id: "outlined-circle", name: "Outlined circle", category: "Popular" },
  { id: "minimal-pointer", name: "Minimal pointer", category: "Popular" },
  { id: "abstract", name: "Abstract", category: "Creative" },
  { id: "liquid", name: "Liquid", category: "Creative" },
  { id: "blob", name: "Blob", category: "Creative" },
  { id: "artistic", name: "Artistic", category: "Creative" },
  { id: "cat", name: "Cat", category: "Cute" },
  { id: "paw", name: "Cat paw", category: "Cute" },
  { id: "heart", name: "Heart", category: "Cute" },
  { id: "flower", name: "Flower", category: "Cute" },
  { id: "smiley", name: "Smiley", category: "Cute" },
  { id: "spider", name: "Spider", category: "Spooky" },
  { id: "web", name: "Web", category: "Spooky" },
  { id: "ghost", name: "Ghost", category: "Spooky" },
  { id: "skull", name: "Skull", category: "Spooky" },
  { id: "pixel-arrow", name: "Pixel arrow", category: "Retro" },
  { id: "eight-bit", name: "8-bit", category: "Retro" },
  { id: "neon", name: "Neon pointer", category: "Futuristic" },
  { id: "glow-circle", name: "Glow circle", category: "Futuristic" },
  { id: "leaf", name: "Leaf", category: "Nature" },
  { id: "butterfly", name: "Butterfly", category: "Nature" },
  { id: "water-drop", name: "Water drop", category: "Nature" },
  { id: "floral", name: "Floral", category: "Nature" },
  ...CREATURE_CURSOR_PRESETS,
];

export const CURSOR_CATEGORIES: CursorCategory[] = [
  "Classic", "Popular", "Creative", "Cute", "Spooky", "Retro", "Futuristic", "Nature", "Animals", "Insects", "Botanical", "Fantasy", "Romantic", "Food", "Weather", "Space",
];

type CreaturePresetDefaults = Omit<
  CreatureCursorSettings,
  "hoverDelayMs" | "clickDelayMs" | "clickDurationMs" | "rotationSensitivity" | "directionalFollow"
>;

const creatureDefaults: Record<CreatureCursorId, CreaturePresetDefaults> = {
  "tiny-cat": { bodyColor: "#e9a978", accentColor: "#63d9ef", detailColor: "#75422f", speed: 1.1, intensity: 0.8, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  bunny: { bodyColor: "#f2e8de", accentColor: "#ed91a7", detailColor: "#705b53", speed: 1.15, intensity: 0.9, articulation: 1.2, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  duckling: { bodyColor: "#ffd84d", accentColor: "#ed813d", detailColor: "#7a4b2d", speed: 1.35, intensity: 1, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "panda-cub": { bodyColor: "#f8f6f0", accentColor: "#20242b", detailColor: "#c77583", speed: 0.75, intensity: 0.55, articulation: 0.8, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "baby-fox": { bodyColor: "#e77b39", accentColor: "#fff1d9", detailColor: "#56352d", speed: 1.1, intensity: 0.9, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  penguin: { bodyColor: "#273544", accentColor: "#f5f2e8", detailColor: "#f39b45", speed: 0.85, intensity: 0.75, articulation: 1.1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  hamster: { bodyColor: "#d99b69", accentColor: "#f5dfc2", detailColor: "#76503d", speed: 1.25, intensity: 0.7, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  hedgehog: { bodyColor: "#c58c5e", accentColor: "#574238", detailColor: "#f2c09a", speed: 0.8, intensity: 0.55, articulation: 0.8, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "baby-frog": { bodyColor: "#65c66b", accentColor: "#f5e85d", detailColor: "#28694a", speed: 1.15, intensity: 1.1, articulation: 1.2, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "little-turtle": { bodyColor: "#65b985", accentColor: "#89603f", detailColor: "#d3b86e", speed: 0.65, intensity: 0.45, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "monarch-butterfly": { bodyColor: "#ed7628", accentColor: "#f4b044", detailColor: "#24242a", speed: 1.4, intensity: 0.8, articulation: 1.15, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "pink-butterfly": { bodyColor: "#ee91c6", accentColor: "#a84d96", detailColor: "#fff0f8", speed: 1.55, intensity: 0.75, articulation: 1.25, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  ladybug: { bodyColor: "#e84642", accentColor: "#20232a", detailColor: "#f7e9d8", speed: 1.2, intensity: 0.65, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  dragonfly: { bodyColor: "#47bfae", accentColor: "#c8f6ed", detailColor: "#344d77", speed: 1.7, intensity: 0.8, articulation: 1.35, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  honeybee: { bodyColor: "#f4c83d", accentColor: "#292a2e", detailColor: "#fff6cb", speed: 2, intensity: 0.9, articulation: 1.5, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  firefly: { bodyColor: "#566d42", accentColor: "#eaff74", detailColor: "#31413a", speed: 0.75, intensity: 0.85, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  moth: { bodyColor: "#b69b76", accentColor: "#e8d8ae", detailColor: "#665443", speed: 0.65, intensity: 0.6, articulation: 0.65, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  caterpillar: { bodyColor: "#69b85c", accentColor: "#a1d86d", detailColor: "#354b35", speed: 1.05, intensity: 0.9, articulation: 1.2, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  snail: { bodyColor: "#d8aa73", accentColor: "#9661a8", detailColor: "#553d5d", speed: 0.45, intensity: 0.45, articulation: 0.85, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "praying-mantis": { bodyColor: "#8bc85d", accentColor: "#b7df71", detailColor: "#3d673d", speed: 1, intensity: 0.7, articulation: 1.1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "autumn-leaves": { bodyColor: "#d96a32", accentColor: "#efad3d", detailColor: "#8b3b29", speed: 0.8, intensity: 0.75, articulation: 1.2, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "cherry-blossom": { bodyColor: "#f4aac7", accentColor: "#fff0f4", detailColor: "#ce6d98", speed: 0.65, intensity: 0.45, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  dandelion: { bodyColor: "#f8f2d8", accentColor: "#e6ce63", detailColor: "#8da95b", speed: 0.55, intensity: 0.65, articulation: 1.1, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "rose-petals": { bodyColor: "#c5264f", accentColor: "#f48aa5", detailColor: "#7a1838", speed: 0.55, intensity: 0.65, articulation: 1.05, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  sunflower: { bodyColor: "#f7bd28", accentColor: "#634021", detailColor: "#43834a", speed: 0.7, intensity: 0.7, articulation: 0.8, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  daisy: { bodyColor: "#fffaf0", accentColor: "#e7bb3b", detailColor: "#66a35c", speed: 0.65, intensity: 0.55, articulation: 0.8, segments: 10, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  lavender: { bodyColor: "#9063c4", accentColor: "#b794dd", detailColor: "#4b8a52", speed: 0.6, intensity: 0.65, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "ivy-vine": { bodyColor: "#3b8855", accentColor: "#71b867", detailColor: "#d2e7a5", speed: 0.45, intensity: 0.65, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  fern: { bodyColor: "#3e945d", accentColor: "#83c66f", detailColor: "#285d43", speed: 0.55, intensity: 0.7, articulation: 1, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "maple-seeds": { bodyColor: "#b27a3c", accentColor: "#e0b56d", detailColor: "#6d4c32", speed: 0.8, intensity: 0.7, articulation: 1.15, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  fairy: { bodyColor: "#f3a5cc", accentColor: "#9ce8e1", detailColor: "#72508d", speed: 1.1, intensity: 0.75, articulation: 1.1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "magic-wand": { bodyColor: "#8058a8", accentColor: "#ffe27a", detailColor: "#d8c3f1", speed: 0.85, intensity: 0.8, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  wizard: { bodyColor: "#51437f", accentColor: "#d8c5a5", detailColor: "#f3ce68", speed: 0.7, intensity: 0.75, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "potion-bottle": { bodyColor: "#a9e4ed", accentColor: "#9c56d5", detailColor: "#e7d5ff", speed: 0.7, intensity: 0.8, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  crystal: { bodyColor: "#8ce1e8", accentColor: "#e6c6ff", detailColor: "#f6ffff", speed: 0.45, intensity: 0.7, articulation: 0.85, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "enchanted-mushroom": { bodyColor: "#c45b75", accentColor: "#fff2cf", detailColor: "#d7a4ec", speed: 0.65, intensity: 0.75, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  spellbook: { bodyColor: "#5c3c78", accentColor: "#e9dcbf", detailColor: "#f3cf68", speed: 0.7, intensity: 0.7, articulation: 0.8, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  unicorn: { bodyColor: "#fff4ed", accentColor: "#e28bc4", detailColor: "#8c68c2", speed: 0.85, intensity: 0.7, articulation: 1, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "baby-dragon": { bodyColor: "#59a981", accentColor: "#ed8d65", detailColor: "#f4d37c", speed: 0.9, intensity: 0.8, articulation: 1.1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "tiny-ghost": { bodyColor: "#eef8ff", accentColor: "#33435c", detailColor: "#a8d7f0", speed: 0.55, intensity: 0.55, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "satin-bow": { bodyColor: "#d94f83", accentColor: "#f7aec9", detailColor: "#fff1f6", speed: 0.8, intensity: 0.75, articulation: 1.15, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "flowing-ribbon": { bodyColor: "#b23b70", accentColor: "#f5a6c4", detailColor: "#ffe8f0", speed: 1.05, intensity: 0.9, articulation: 1.3, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "pearl-necklace": { bodyColor: "#f7f0e2", accentColor: "#fffdf7", detailColor: "#bba98b", speed: 0.7, intensity: 0.7, articulation: 1.1, segments: 11, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "heart-locket": { bodyColor: "#d7ad5d", accentColor: "#bd4261", detailColor: "#fff0bd", speed: 0.75, intensity: 0.7, articulation: 1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "pink-rose": { bodyColor: "#c82e50", accentColor: "#f47f9c", detailColor: "#4b8a52", speed: 0.65, intensity: 0.65, articulation: 0.9, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "cherry-pair": { bodyColor: "#b91f3d", accentColor: "#e65b6c", detailColor: "#36814b", speed: 0.8, intensity: 0.75, articulation: 1.1, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  strawberry: { bodyColor: "#e43d50", accentColor: "#5da64a", detailColor: "#ffd780", speed: 0.75, intensity: 0.7, articulation: 0.9, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  cupid: { bodyColor: "#f2c7a9", accentColor: "#f39ab3", detailColor: "#fff0dc", speed: 0.9, intensity: 0.65, articulation: 1.1, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "angel-wings": { bodyColor: "#fffaf0", accentColor: "#e5d7bd", detailColor: "#b9d8e8", speed: 0.8, intensity: 0.7, articulation: 1.05, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "love-letter": { bodyColor: "#e8d1b3", accentColor: "#c94e68", detailColor: "#fff8ea", speed: 0.65, intensity: 0.7, articulation: 0.9, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  donut: { bodyColor: "#c88951", accentColor: "#ed8db1", detailColor: "#f7dfb4", speed: 0.8, intensity: 0.75, articulation: 0.8, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  cupcake: { bodyColor: "#e8a36f", accentColor: "#f3b4d2", detailColor: "#fff0c8", speed: 0.75, intensity: 0.75, articulation: 0.9, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  macaron: { bodyColor: "#a8c987", accentColor: "#f5ead8", detailColor: "#65894f", speed: 0.65, intensity: 0.6, articulation: 0.8, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "ice-cream": { bodyColor: "#f2c27e", accentColor: "#d58fa6", detailColor: "#9b6b46", speed: 0.7, intensity: 0.7, articulation: 0.9, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "bubble-tea": { bodyColor: "#e9cbb0", accentColor: "#8e5cb2", detailColor: "#f8e9da", speed: 0.7, intensity: 0.75, articulation: 0.95, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "matcha-latte": { bodyColor: "#8daa69", accentColor: "#f2eadc", detailColor: "#d6c5a5", speed: 0.6, intensity: 0.6, articulation: 0.8, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "coffee-cup": { bodyColor: "#f4ede0", accentColor: "#684b39", detailColor: "#d8d0c4", speed: 0.65, intensity: 0.55, articulation: 0.75, segments: 5, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  croissant: { bodyColor: "#d99545", accentColor: "#f2c879", detailColor: "#9c5e2a", speed: 0.6, intensity: 0.65, articulation: 0.8, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  watermelon: { bodyColor: "#e85362", accentColor: "#4b9b58", detailColor: "#f8e8bd", speed: 0.7, intensity: 0.7, articulation: 0.8, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  cookie: { bodyColor: "#c98a4f", accentColor: "#603c2b", detailColor: "#e5b878", speed: 0.75, intensity: 0.7, articulation: 0.85, segments: 10, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  snowfall: { bodyColor: "#e9f7ff", accentColor: "#a9dcf5", detailColor: "#ffffff", speed: 0.75, intensity: 0.7, articulation: 0.8, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  rain: { bodyColor: "#6dbae8", accentColor: "#b9e8ff", detailColor: "#eefaff", speed: 1.4, intensity: 0.8, articulation: 1, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "wind-gust": { bodyColor: "#b5e7ee", accentColor: "#70c5d5", detailColor: "#eafcff", speed: 0.9, intensity: 0.8, articulation: 1.1, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "floating-clouds": { bodyColor: "#f5fbff", accentColor: "#c6dced", detailColor: "#ffffff", speed: 0.45, intensity: 0.65, articulation: 0.75, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  rainbow: { bodyColor: "#ff5e65", accentColor: "#63b9ef", detailColor: "#fff1bd", speed: 0.6, intensity: 0.55, articulation: 0.7, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "northern-lights": { bodyColor: "#57e7a5", accentColor: "#7d7bed", detailColor: "#60d8ec", speed: 0.55, intensity: 0.8, articulation: 1.1, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  fog: { bodyColor: "#d8e1e8", accentColor: "#b6c8d3", detailColor: "#f6fbff", speed: 0.4, intensity: 0.6, articulation: 0.75, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  thunderstorm: { bodyColor: "#34384c", accentColor: "#f4e985", detailColor: "#7d94b7", speed: 0.7, intensity: 0.7, articulation: 0.8, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "dust-motes": { bodyColor: "#e9bb70", accentColor: "#fff0b5", detailColor: "#f8f2d9", speed: 0.35, intensity: 0.55, articulation: 0.65, segments: 12, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "frost-crystals": { bodyColor: "#b7e9ff", accentColor: "#72b7e8", detailColor: "#f4fdff", speed: 0.4, intensity: 0.6, articulation: 0.8, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  saturn: { bodyColor: "#dfa968", accentColor: "#b58b63", detailColor: "#f4d8a5", speed: 0.35, intensity: 0.55, articulation: 0.65, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "mini-earth": { bodyColor: "#2886c4", accentColor: "#53b86c", detailColor: "#e4f6ff", speed: 0.35, intensity: 0.5, articulation: 0.7, segments: 9, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "shooting-star": { bodyColor: "#fff4b0", accentColor: "#ffbd72", detailColor: "#c8edff", speed: 0.85, intensity: 0.75, articulation: 1, segments: 10, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  galaxy: { bodyColor: "#9b79e8", accentColor: "#f2c5ff", detailColor: "#8edcf4", speed: 0.4, intensity: 0.7, articulation: 0.8, segments: 10, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  "black-hole": { bodyColor: "#553b9c", accentColor: "#ee8d51", detailColor: "#fff2bc", speed: 0.55, intensity: 0.75, articulation: 0.9, segments: 10, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  comet: { bodyColor: "#a9eaff", accentColor: "#75c9ed", detailColor: "#fff4ce", speed: 0.55, intensity: 0.7, articulation: 0.9, segments: 11, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  astronaut: { bodyColor: "#e8edf2", accentColor: "#597a9d", detailColor: "#99e4f4", speed: 0.45, intensity: 0.55, articulation: 0.7, segments: 7, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  ufo: { bodyColor: "#aab7c6", accentColor: "#5bd7df", detailColor: "#f5db72", speed: 0.6, intensity: 0.65, articulation: 0.85, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  rocket: { bodyColor: "#e8eaf0", accentColor: "#e85e65", detailColor: "#ffc56d", speed: 0.65, intensity: 0.7, articulation: 0.85, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
  constellation: { bodyColor: "#e4edff", accentColor: "#91baff", detailColor: "#f7e7a2", speed: 0.4, intensity: 0.6, articulation: 0.7, segments: 8, idleEnabled: true, hoverEnabled: true, clickEnabled: true },
};

const slowHoverCreatures = new Set<CreatureCursorId>([
  "little-turtle", "snail", "ivy-vine", "fern", "lavender", "crystal", "floating-clouds", "fog", "saturn", "black-hole",
]);
const quickResponseCreatures = new Set<CreatureCursorId>([
  "duckling", "baby-frog", "dragonfly", "honeybee", "magic-wand", "fairy", "cupid", "shooting-star", "rocket",
]);

export const DEFAULT_CREATURE_SETTINGS: Record<CreatureCursorId, CreatureCursorSettings> = Object.fromEntries(
  CREATURE_CURSOR_IDS.map((id) => [id, {
    ...creatureDefaults[id],
    hoverDelayMs: slowHoverCreatures.has(id) ? 70 : quickResponseCreatures.has(id) ? 0 : 25,
    clickDelayMs: id === "heart-locket" || id === "spellbook" ? 35 : 0,
    clickDurationMs: quickResponseCreatures.has(id) ? 380 : slowHoverCreatures.has(id) ? 680 : 520,
    rotationSensitivity: id === "little-turtle" || id === "snail" ? 0.62 : quickResponseCreatures.has(id) ? 1.25 : 0.9,
    directionalFollow: true,
  }]),
) as Record<CreatureCursorId, CreatureCursorSettings>;

export const CURSOR_STATE_OPTIONS: Array<[CursorStateId, string]> = [
  ["pointer", "Buttons and interactive controls"],
  ["link", "Links"],
  ["text", "Text selection and editing"],
  ["disabled", "Disabled controls"],
  ["grab", "Grab"],
  ["grabbing", "Grabbing"],
  ["resize", "Resize handles (unspecified)"],
  ["resize-ew", "Resize horizontally"],
  ["resize-ns", "Resize vertically"],
  ["resize-nesw", "Resize diagonally (NE–SW)"],
  ["resize-nwse", "Resize diagonally (NW–SE)"],
  ["crosshair", "Crosshair"],
  ["help", "Help"],
  ["wait", "Wait"],
  ["progress", "Progress"],
  ["not-allowed", "Not allowed"],
  ["no-drop", "No drop"],
  ["zoom-in", "Zoom in"],
  ["zoom-out", "Zoom out"],
  ["move", "Move"],
  ["context-menu", "Context menu"],
  ["copy", "Copy"],
  ["alias", "Alias"],
];

const EMPTY_CURSOR_STATE: CursorStateConfig = {
  enabled: false,
  cursor: "modern-arrow",
  size: 28,
  color: "#ffffff",
  accentColor: "#ADEB66",
  borderColor: "#7ad7ff",
  borderWidth: 2,
  image: "",
  hotspotX: 0,
  hotspotY: 0,
};

function createDefaultCursorStates(): CursorStateConfigs {
  return Object.fromEntries(
    CURSOR_STATE_OPTIONS.map(([state]) => [state, { ...EMPTY_CURSOR_STATE }]),
  ) as CursorStateConfigs;
}

export const DEFAULT_CURSOR_EFFECTS: CursorEffectsConfig = {
  schemaVersion: CURSOR_CONFIGURATION_VERSION,
  cursor: "modern-arrow",
  size: 28,
  widthScale: 1,
  heightScale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  gradientEnabled: false,
  gradientEndColor: "#72d8ff",
  gradientAngle: 45,
  animationDurationMs: 1000,
  animationEasing: "linear",
  followSmoothing: 1,
  cursorAnimationSpeed: 1,
  cursorAnimationIntensity: 0.8,
  movementSensitivity: 1,
  rotationSensitivity: 1,
  directionalFollow: true,
  idleAnimationEnabled: true,
  hoverAnimation: "pulse",
  hoverDelayMs: 20,
  hoverTransitionMs: 180,
  hoverIntensity: 0.8,
  clickAnimation: "bounce",
  clickDelayMs: 0,
  clickDurationMs: 520,
  clickIntensity: 0.85,
  cursorImage: "",
  hotspotX: 0,
  hotspotY: 0,
  cursorStates: createDefaultCursorStates(),
  color: "#ffffff",
  pointerAccentColor: "#ADEB66",
  backgroundColor: "#111827",
  borderColor: "#7ad7ff",
  borderWidth: 2,
  opacity: 1,
  shadow: 0.25,
  glow: 0.25,
  movement: "none",
  click: "none",
  trailLength: 0.55,
  trailSpeed: 1,
  particleSize: 5,
  particleDensity: 0.55,
  effectColor: "#72d8ff",
  clickEffectColor: "#72d8ff",
  clickSize: 1,
  spiderWeb: false,
  hoverGrow: true,
  hoverShape: false,
  hoverColor: false,
  hoverOutline: false,
  magneticHover: false,
  hoverColorValue: "#7ad7ff",
  magneticStrength: 0.35,
  glassEffect: false,
  glassBlur: 8,
  glassOpacity: 0.2,
  glitchEffect: false,
  glitchIntensity: 0.5,
  gameEffect: false,
  soundHover: false,
  soundClick: false,
  soundVolume: 0.35,
  spider: {
    followDelayMs: 120,
    gaitSpeed: 1,
    walkingIntensity: 1,
    legArticulation: 1,
    movementSensitivity: 1,
    bodyBounce: 0,
    pounceDurationMs: 560,
  },
  creatures: Object.fromEntries(
    CREATURE_CURSOR_IDS.map((id) => [id, { ...DEFAULT_CREATURE_SETTINGS[id] }]),
  ) as Record<CreatureCursorId, CreatureCursorSettings>,
};

export const SPIDER_FOLLOW_PRESET: CursorEffectsConfig = {
  ...DEFAULT_CURSOR_EFFECTS,
  cursor: "spider",
  size: 42,
  color: "#24172f",
  backgroundColor: "#100d16",
  borderColor: "#c084fc",
  borderWidth: 1.5,
  shadow: 0.45,
  glow: 0.4,
  movement: "none",
  click: "shockwave",
  trailLength: 0.72,
  trailSpeed: 1.15,
  particleSize: 4,
  particleDensity: 0.5,
  effectColor: "#b76cff",
  clickEffectColor: "#d8a4ff",
  clickSize: 0.8,
  spiderWeb: false,
  hoverGrow: false,
};

export const NATIVE_CURSOR_EFFECTS: CursorEffectsConfig = {
  ...DEFAULT_CURSOR_EFFECTS,
  cursor: "native",
  cursorStates: createDefaultCursorStates(),
  movement: "none",
  click: "none",
  spiderWeb: false,
  hoverGrow: false,
  hoverShape: false,
  hoverColor: false,
  hoverOutline: false,
  magneticHover: false,
  glassEffect: false,
  glitchEffect: false,
  gameEffect: false,
  soundHover: false,
  soundClick: false,
};

export const CURSOR_EFFECTS_STORAGE_KEY = "magnetic-lines-cursor-effects:v1";
export const CURSOR_EFFECTS_APPLIED_KEY = `${CURSOR_EFFECTS_STORAGE_KEY}:applied`;
export const CURSOR_EFFECTS_CHANGE_EVENT = "magnetic-lines-cursor-effects-change";

const cursorIds = new Set<CursorPresetId>([
  "native",
  "custom-image",
  ...CURSOR_PRESETS.map((preset) => preset.id),
  ...POINTER_CURSOR_SHAPE_IDS,
]);
const movementEffects = new Set<MovementEffect>(["none", "ripple", "particles", "comet", "magic", "paws", "spider", "liquid", "fireflies", "pixel"]);
const clickEffects = new Set<ClickEffect>(["none", "ripple", "particles", "stars", "hearts", "sparkles", "pixels", "shockwave"]);
const hoverAnimations = new Set<CursorHoverAnimation>(["pulse", "tilt", "squash", "glow"]);
const clickAnimations = new Set<CursorClickAnimation>(["bounce", "spin", "squash", "pulse", "wobble"]);
const clamp = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const color = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[\da-f]{3,8}$/i.test(value) ? value : fallback;
const cursorImage = (value: unknown) =>
  typeof value === "string" &&
  value.length <= 350_000 &&
  /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[\da-z+/]+=*$/i.test(value)
    ? value
    : "";

export function registerCursorId(id: CursorPresetId): () => void {
  if (!id.trim() || cursorIds.has(id)) throw new Error(`Cursor ID "${id}" is already registered or invalid.`);
  cursorIds.add(id);
  return () => cursorIds.delete(id);
}

export function sanitizeCursorEffects(value: unknown): CursorEffectsConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  if (typeof source.schemaVersion === "number" && source.schemaVersion > CURSOR_CONFIGURATION_VERSION) {
    throw new Error(`Cursor configuration version ${source.schemaVersion} is not supported by this editor.`);
  }
  const rawSpider = source.spider && typeof source.spider === "object"
    ? source.spider as Record<string, unknown>
    : {};
  const rawCreatures = source.creatures && typeof source.creatures === "object"
    ? source.creatures as Record<string, unknown>
    : {};
  const rawCursorStates = source.cursorStates && typeof source.cursorStates === "object"
    ? source.cursorStates as Record<string, unknown>
    : {};
  const animationEasing: CursorAnimationEasing = ["linear", "ease-in", "ease-out", "ease-in-out", "smoothstep"]
    .includes(source.animationEasing as string)
    ? source.animationEasing as CursorAnimationEasing
    : DEFAULT_CURSOR_EFFECTS.animationEasing;
  const cursorStates = Object.fromEntries(CURSOR_STATE_OPTIONS.map(([state]) => {
    const raw = rawCursorStates[state] && typeof rawCursorStates[state] === "object"
      ? rawCursorStates[state] as Record<string, unknown>
      : {};
    return [state, {
      enabled: raw.enabled === true,
      cursor: cursorIds.has(raw.cursor as CursorPresetId)
        ? raw.cursor as CursorPresetId
        : EMPTY_CURSOR_STATE.cursor,
      size: clamp(raw.size, EMPTY_CURSOR_STATE.size, 12, 72),
      color: color(raw.color, EMPTY_CURSOR_STATE.color),
      accentColor: color(raw.accentColor, EMPTY_CURSOR_STATE.accentColor),
      borderColor: color(raw.borderColor, EMPTY_CURSOR_STATE.borderColor),
      borderWidth: clamp(raw.borderWidth, EMPTY_CURSOR_STATE.borderWidth, 0, 12),
      image: cursorImage(raw.image),
      hotspotX: clamp(raw.hotspotX, 0, 0, 1),
      hotspotY: clamp(raw.hotspotY, 0, 0, 1),
    }];
  })) as CursorStateConfigs;
  return {
    ...DEFAULT_CURSOR_EFFECTS,
    schemaVersion: CURSOR_CONFIGURATION_VERSION,
    cursor: cursorIds.has(source.cursor as CursorPresetId) ? source.cursor as CursorPresetId : DEFAULT_CURSOR_EFFECTS.cursor,
    size: clamp(source.size, DEFAULT_CURSOR_EFFECTS.size, 12, 72),
    widthScale: clamp(source.widthScale, DEFAULT_CURSOR_EFFECTS.widthScale, 0.4, 2.5),
    heightScale: clamp(source.heightScale, DEFAULT_CURSOR_EFFECTS.heightScale, 0.4, 2.5),
    rotation: clamp(source.rotation, DEFAULT_CURSOR_EFFECTS.rotation, -180, 180),
    offsetX: clamp(source.offsetX, DEFAULT_CURSOR_EFFECTS.offsetX, -100, 100),
    offsetY: clamp(source.offsetY, DEFAULT_CURSOR_EFFECTS.offsetY, -100, 100),
    gradientEnabled: source.gradientEnabled === true,
    gradientEndColor: color(source.gradientEndColor, DEFAULT_CURSOR_EFFECTS.gradientEndColor),
    gradientAngle: clamp(source.gradientAngle, DEFAULT_CURSOR_EFFECTS.gradientAngle, 0, 360),
    animationDurationMs: clamp(source.animationDurationMs, DEFAULT_CURSOR_EFFECTS.animationDurationMs, 100, 3000),
    animationEasing,
    followSmoothing: clamp(source.followSmoothing, DEFAULT_CURSOR_EFFECTS.followSmoothing, 0.05, 1),
    cursorAnimationSpeed: clamp(source.cursorAnimationSpeed, DEFAULT_CURSOR_EFFECTS.cursorAnimationSpeed, 0.25, 3),
    cursorAnimationIntensity: clamp(source.cursorAnimationIntensity, DEFAULT_CURSOR_EFFECTS.cursorAnimationIntensity, 0, 2),
    movementSensitivity: clamp(source.movementSensitivity, DEFAULT_CURSOR_EFFECTS.movementSensitivity, 0.1, 3),
    rotationSensitivity: clamp(source.rotationSensitivity, DEFAULT_CURSOR_EFFECTS.rotationSensitivity, 0, 2),
    directionalFollow: source.directionalFollow !== false,
    idleAnimationEnabled: source.idleAnimationEnabled !== false,
    hoverAnimation: hoverAnimations.has(source.hoverAnimation as CursorHoverAnimation)
      ? source.hoverAnimation as CursorHoverAnimation
      : DEFAULT_CURSOR_EFFECTS.hoverAnimation,
    hoverDelayMs: clamp(source.hoverDelayMs, DEFAULT_CURSOR_EFFECTS.hoverDelayMs, 0, 500),
    hoverTransitionMs: clamp(source.hoverTransitionMs, DEFAULT_CURSOR_EFFECTS.hoverTransitionMs, 50, 1000),
    hoverIntensity: clamp(source.hoverIntensity, DEFAULT_CURSOR_EFFECTS.hoverIntensity, 0, 2),
    clickAnimation: clickAnimations.has(source.clickAnimation as CursorClickAnimation)
      ? source.clickAnimation as CursorClickAnimation
      : DEFAULT_CURSOR_EFFECTS.clickAnimation,
    clickDelayMs: clamp(source.clickDelayMs, DEFAULT_CURSOR_EFFECTS.clickDelayMs, 0, 500),
    clickDurationMs: clamp(source.clickDurationMs, DEFAULT_CURSOR_EFFECTS.clickDurationMs, 100, 1800),
    clickIntensity: clamp(source.clickIntensity, DEFAULT_CURSOR_EFFECTS.clickIntensity, 0, 2),
    cursorImage: cursorImage(source.cursorImage),
    hotspotX: clamp(source.hotspotX, 0, 0, 1),
    hotspotY: clamp(source.hotspotY, 0, 0, 1),
    cursorStates,
    color: color(source.color, DEFAULT_CURSOR_EFFECTS.color),
    pointerAccentColor: color(source.pointerAccentColor, DEFAULT_CURSOR_EFFECTS.pointerAccentColor),
    backgroundColor: color(source.backgroundColor, DEFAULT_CURSOR_EFFECTS.backgroundColor),
    borderColor: color(source.borderColor, DEFAULT_CURSOR_EFFECTS.borderColor),
    borderWidth: clamp(source.borderWidth, DEFAULT_CURSOR_EFFECTS.borderWidth, 0, 12),
    opacity: clamp(source.opacity, DEFAULT_CURSOR_EFFECTS.opacity, 0.1, 1),
    shadow: clamp(source.shadow, DEFAULT_CURSOR_EFFECTS.shadow, 0, 1),
    glow: clamp(source.glow, DEFAULT_CURSOR_EFFECTS.glow, 0, 1),
    movement: movementEffects.has(source.movement as MovementEffect) ? source.movement as MovementEffect : "none",
    click: clickEffects.has(source.click as ClickEffect) ? source.click as ClickEffect : "none",
    trailLength: clamp(source.trailLength, DEFAULT_CURSOR_EFFECTS.trailLength, 0.1, 1),
    trailSpeed: clamp(source.trailSpeed, DEFAULT_CURSOR_EFFECTS.trailSpeed, 0.25, 2),
    particleSize: clamp(source.particleSize, DEFAULT_CURSOR_EFFECTS.particleSize, 1, 18),
    particleDensity: clamp(source.particleDensity, DEFAULT_CURSOR_EFFECTS.particleDensity, 0.1, 1),
    effectColor: color(source.effectColor, DEFAULT_CURSOR_EFFECTS.effectColor),
    clickEffectColor: color(source.clickEffectColor, DEFAULT_CURSOR_EFFECTS.clickEffectColor),
    clickSize: clamp(source.clickSize, DEFAULT_CURSOR_EFFECTS.clickSize, 0.5, 2),
    spiderWeb: source.spiderWeb === true,
    hoverGrow: source.hoverGrow !== false,
    hoverShape: source.hoverShape === true,
    hoverColor: source.hoverColor === true,
    hoverOutline: source.hoverOutline === true,
    magneticHover: source.magneticHover === true,
    hoverColorValue: color(source.hoverColorValue, DEFAULT_CURSOR_EFFECTS.hoverColorValue),
    magneticStrength: clamp(source.magneticStrength, DEFAULT_CURSOR_EFFECTS.magneticStrength, 0, 1),
    glassEffect: source.glassEffect === true,
    glassBlur: clamp(source.glassBlur, DEFAULT_CURSOR_EFFECTS.glassBlur, 0, 24),
    glassOpacity: clamp(source.glassOpacity, DEFAULT_CURSOR_EFFECTS.glassOpacity, 0, 0.8),
    glitchEffect: source.glitchEffect === true,
    glitchIntensity: clamp(source.glitchIntensity, DEFAULT_CURSOR_EFFECTS.glitchIntensity, 0, 1),
    gameEffect: source.gameEffect === true,
    soundHover: source.soundHover === true,
    soundClick: source.soundClick === true,
    soundVolume: clamp(source.soundVolume, DEFAULT_CURSOR_EFFECTS.soundVolume, 0, 1),
    spider: {
      followDelayMs: clamp(rawSpider.followDelayMs, DEFAULT_CURSOR_EFFECTS.spider.followDelayMs, 0, 500),
      gaitSpeed: clamp(rawSpider.gaitSpeed, DEFAULT_CURSOR_EFFECTS.spider.gaitSpeed, 0.25, 3),
      walkingIntensity: clamp(rawSpider.walkingIntensity, DEFAULT_CURSOR_EFFECTS.spider.walkingIntensity, 0, 2),
      legArticulation: clamp(rawSpider.legArticulation, DEFAULT_CURSOR_EFFECTS.spider.legArticulation, 0, 2),
      movementSensitivity: clamp(rawSpider.movementSensitivity, DEFAULT_CURSOR_EFFECTS.spider.movementSensitivity, 0.25, 3),
      bodyBounce: clamp(rawSpider.bodyBounce, DEFAULT_CURSOR_EFFECTS.spider.bodyBounce, 0, 1),
      pounceDurationMs: clamp(rawSpider.pounceDurationMs, DEFAULT_CURSOR_EFFECTS.spider.pounceDurationMs, 200, 1200),
    },
    creatures: Object.fromEntries(CREATURE_CURSOR_IDS.map((id) => {
      const raw = rawCreatures[id] && typeof rawCreatures[id] === "object"
        ? rawCreatures[id] as Record<string, unknown>
        : {};
      const fallback = DEFAULT_CREATURE_SETTINGS[id];
      return [id, {
        bodyColor: color(raw.bodyColor, fallback.bodyColor),
        accentColor: color(raw.accentColor, fallback.accentColor),
        detailColor: color(raw.detailColor, fallback.detailColor),
        speed: clamp(raw.speed, fallback.speed, 0.25, 3),
        intensity: clamp(raw.intensity, fallback.intensity, 0, 2),
        articulation: clamp(raw.articulation, fallback.articulation, 0, 2),
        segments: clamp(raw.segments, fallback.segments, 5, id === "caterpillar" ? 9 : 16),
        hoverDelayMs: clamp(raw.hoverDelayMs, fallback.hoverDelayMs, 0, 500),
        clickDelayMs: clamp(raw.clickDelayMs, fallback.clickDelayMs, 0, 500),
        clickDurationMs: clamp(raw.clickDurationMs, fallback.clickDurationMs, 100, 1800),
        rotationSensitivity: clamp(raw.rotationSensitivity, fallback.rotationSensitivity, 0, 2),
        directionalFollow: raw.directionalFollow !== false,
        idleEnabled: raw.idleEnabled !== false,
        hoverEnabled: raw.hoverEnabled !== false,
        clickEnabled: raw.clickEnabled !== false,
      }];
    })) as Record<CreatureCursorId, CreatureCursorSettings>,
  };
}

export function loadCursorEffects(): CursorEffectsConfig {
  const stored = window.localStorage.getItem(CURSOR_EFFECTS_STORAGE_KEY);
  if (!stored) return DEFAULT_CURSOR_EFFECTS;
  try {
    return sanitizeCursorEffects(JSON.parse(stored));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown configuration error";
    throw new Error(`Saved cursor settings could not be loaded: ${detail}`);
  }
}

export function saveCursorEffects(config: CursorEffectsConfig): void {
  window.localStorage.setItem(CURSOR_EFFECTS_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(CURSOR_EFFECTS_CHANGE_EVENT));
}
