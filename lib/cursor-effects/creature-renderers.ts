import { CREATURE_CURSOR_IDS, type CreatureCursorId, type CreatureCursorSettings } from "./model";
import {
  registerCursorRenderer,
  type CursorRendererFrame,
} from "./registry";

const animalSettings: Record<CreatureCursorId, {
  colors: [string, string, string];
  motion: [string, string, string];
  count?: string;
}> = {
  "tiny-cat": { colors: ["Fur", "Eye", "Nose and paw"], motion: ["Tail sway", "Body bounce", "Ear twitch"] },
  bunny: { colors: ["Fur", "Inner ear and nose", "Eye and paw"], motion: ["Ear flop", "Hop intensity", "Ear articulation"] },
  duckling: { colors: ["Feather", "Beak and feet", "Eye"], motion: ["Waddle speed", "Body bob", "Wing flap"] },
  "panda-cub": { colors: ["Fur", "Patches", "Nose and paw"], motion: ["Sway speed", "Stretch intensity", "Paw movement"] },
  "baby-fox": { colors: ["Orange fur", "Chest and tail tip", "Eye and nose"], motion: ["Tail swish", "Jump intensity", "Ear articulation"] },
  penguin: { colors: ["Back and wings", "Belly", "Beak and feet"], motion: ["Waddle speed", "Body bob", "Flipper movement"] },
  hamster: { colors: ["Fur", "Cheeks and belly", "Nose and paw"], motion: ["Foot movement", "Cheek puff", "Whisker twitch"] },
  hedgehog: { colors: ["Face and body", "Spines", "Muzzle"], motion: ["Shuffle speed", "Sniffing", "Spine movement"] },
  "baby-frog": { colors: ["Skin", "Iris", "Belly and toes"], motion: ["Leg action", "Jump intensity", "Leg articulation"] },
  "little-turtle": { colors: ["Skin", "Shell", "Shell plates"], motion: ["Leg alternation", "Head bob", "Leg articulation"] },
  "monarch-butterfly": { colors: ["Upper wing", "Lower wing", "Wing border"], motion: ["Wing beat", "Flight drift", "Wing articulation"] },
  "pink-butterfly": { colors: ["Wing", "Wing pattern", "Wing spots"], motion: ["Wing beat", "Float intensity", "Wing articulation"] },
  ladybug: { colors: ["Shell", "Head and spots", "Body and eye"], motion: ["Leg pace", "Walking bounce", "Leg articulation"] },
  dragonfly: { colors: ["Body", "Wings", "Eyes and legs"], motion: ["Wing vibration", "Hover drift", "Wing articulation"] },
  honeybee: { colors: ["Abdomen", "Stripes and head", "Wings and eye"], motion: ["Wing buzz", "Hover bob", "Leg articulation"] },
  firefly: { colors: ["Body", "Glow", "Wing and eye"], motion: ["Pulse speed", "Glow intensity", "Wing flutter"] },
  moth: { colors: ["Wing", "Wing pattern", "Body and eye"], motion: ["Wing beat", "Flight drift", "Wing articulation"] },
  caterpillar: { colors: ["Segments", "Head and legs", "Face"], motion: ["Crawl speed", "Body contraction", "Segment articulation"] },
  snail: { colors: ["Body", "Shell", "Shell spiral and face"], motion: ["Glide speed", "Head movement", "Eye-stalk articulation"] },
  "praying-mantis": { colors: ["Body", "Wings", "Eyes and joints"], motion: ["Step speed", "Head tracking", "Raptorial arm motion"] },
  "autumn-leaves": { colors: ["Maple and oak leaves", "Autumn highlights", "Leaf veins"], motion: ["Fall speed", "Wind strength", "Tumble rotation"], count: "Leaf count" },
  "cherry-blossom": { colors: ["Petals", "Petal highlights", "Blossom centers"], motion: ["Fall speed", "Wind drift", "Petal rotation"], count: "Petal count" },
  dandelion: { colors: ["Seeds and filaments", "Seed head", "Stem and leaves"], motion: ["Dispersal speed", "Wind strength", "Seed tumble"], count: "Seed count" },
  "rose-petals": { colors: ["Petals", "Petal highlights", "Petal shadows"], motion: ["Fall speed", "Swirl intensity", "Petal rotation"], count: "Petal count" },
  sunflower: { colors: ["Petals", "Flower disk", "Stem and leaves"], motion: ["Sway speed", "Sway intensity", "Pointer tracking"], count: "Petal count" },
  daisy: { colors: ["Petals", "Flower center", "Stem and leaves"], motion: ["Sway speed", "Sway intensity", "Petal spread"], count: "Petal count" },
  lavender: { colors: ["Flower clusters", "Petal highlights", "Stems and leaves"], motion: ["Sway speed", "Wind strength", "Stem flexibility"], count: "Stem count" },
  "ivy-vine": { colors: ["Leaves", "Leaf highlights", "Veins and vine"], motion: ["Growth rate", "Curl intensity", "Sway amount"], count: "Leaf count" },
  fern: { colors: ["Frond", "Leaflet highlights", "Central stem"], motion: ["Sway speed", "Curl intensity", "Tip tracking"], count: "Leaflet pairs" },
  "maple-seeds": { colors: ["Samaras", "Seed wings", "Seed details"], motion: ["Spin speed", "Wind strength", "Fall speed"], count: "Seed pair count" },
  fairy: { colors: ["Dress and body", "Wings", "Hair and details"], motion: ["Wing speed", "Flight intensity", "Glow intensity"], count: "Sparkle count" },
  "magic-wand": { colors: ["Wand material", "Star tip", "Sparkles"], motion: ["Rotation speed", "Glow intensity", "Sparkle density"], count: "Sparkle count" },
  wizard: { colors: ["Hat and robe", "Beard and face", "Spell color"], motion: ["Float speed", "Casting intensity", "Hat and beard sway"], count: "Spell sparks" },
  "potion-bottle": { colors: ["Glass", "Potion liquid", "Liquid highlights"], motion: ["Bubble speed", "Slosh sensitivity", "Glow intensity"], count: "Bubble count" },
  crystal: { colors: ["Crystal body", "Facet reflections", "Inner light"], motion: ["Rotation speed", "Facet brightness", "Float intensity"], count: "Facet count" },
  "enchanted-mushroom": { colors: ["Cap and stem", "Cap spots", "Spore glow"], motion: ["Bounce speed", "Glow intensity", "Spore lift"], count: "Spore count" },
  spellbook: { colors: ["Book cover", "Pages", "Magic sigil"], motion: ["Page flutter", "Opening amount", "Glow intensity"], count: "Magic sparks" },
  unicorn: { colors: ["Body and mane", "Mane highlights", "Horn and sparkles"], motion: ["Hop speed", "Hair movement", "Sparkle intensity"], count: "Mane locks" },
  "baby-dragon": { colors: ["Scales", "Wings and horns", "Breath and belly"], motion: ["Wing beat", "Tail movement", "Flight intensity"], count: "Scale plates" },
  "tiny-ghost": { colors: ["Ghost body", "Eyes and mouth", "Body highlights"], motion: ["Float speed", "Fabric wave", "Trail intensity"], count: "Wave lobes" },
  "satin-bow": { colors: ["Ribbon color", "Ribbon shadow", "Satin shine"], motion: ["Flutter intensity", "Tail length", "Movement sensitivity"], count: "Ribbon folds" },
  "flowing-ribbon": { colors: ["Ribbon color", "Ribbon shadow", "Fabric highlights"], motion: ["Trailing speed", "Curl intensity", "Ribbon width"], count: "Ribbon folds" },
  "pearl-necklace": { colors: ["Pearl color", "Pearl highlights", "Chain color"], motion: ["Pearl size", "Shine", "Movement intensity"], count: "Pearl count" },
  "heart-locket": { colors: ["Metal finish", "Heart enamel", "Inner glow"], motion: ["Swing intensity", "Opening speed", "Heart size"], count: "Locket layers" },
  "pink-rose": { colors: ["Rose color", "Petal highlights", "Stem and leaves"], motion: ["Flower size", "Petal fall", "Rotation"], count: "Petal count" },
  "cherry-pair": { colors: ["Cherry color", "Cherry highlights", "Stems and leaf"], motion: ["Cherry size", "Bounce strength", "Cherry spacing"], count: "Stem details" },
  strawberry: { colors: ["Strawberry flesh", "Leaves", "Seed color"], motion: ["Seed density", "Tilt intensity", "Click particles"], count: "Seed count" },
  cupid: { colors: ["Skin and tunic", "Heart color", "Wing and arrow"], motion: ["Wing speed", "Hover intensity", "Animation speed"], count: "Wing feathers" },
  "angel-wings": { colors: ["Feather color", "Shadow feathers", "Wing highlights"], motion: ["Wing span", "Feather detail", "Flap speed"], count: "Feather layers" },
  "love-letter": { colors: ["Envelope color", "Wax seal", "Paper color"], motion: ["Paper texture", "Opening speed", "Tilt intensity"], count: "Paper folds" },
  donut: { colors: ["Baked dough", "Icing flavor", "Sprinkle colors"], motion: ["Sprinkle count", "Rotation speed", "Particle intensity"], count: "Sprinkle count" },
  cupcake: { colors: ["Cake and wrapper", "Frosting", "Topping"], motion: ["Bounce strength", "Frosting detail", "Wobble speed"], count: "Frosting layers" },
  macaron: { colors: ["Shell color", "Cream filling", "Baked details"], motion: ["Rotation", "Wobble intensity", "Shell texture"], count: "Shell details" },
  "ice-cream": { colors: ["Scoop and flavor", "Cone color", "Topping"], motion: ["Scoop size", "Wobble strength", "Melt and sprinkle"], count: "Waffle rows" },
  "bubble-tea": { colors: ["Tea flavor", "Straw color", "Cup reflections"], motion: ["Pearl count", "Liquid motion", "Transparency"], count: "Tapioca pearls" },
  "matcha-latte": { colors: ["Matcha green", "Milk", "Ceramic cup"], motion: ["Matcha intensity", "Milk ratio", "Ripple strength"], count: "Latte art petals" },
  "coffee-cup": { colors: ["Cup color", "Coffee color", "Steam highlights"], motion: ["Steam amount", "Steam speed", "Cup size"], count: "Steam strands" },
  croissant: { colors: ["Pastry color", "Baked highlights", "Flaky shadows"], motion: ["Pastry size", "Layer detail", "Crumb intensity"], count: "Pastry layers" },
  watermelon: { colors: ["Flesh color", "Rind color", "Seed color"], motion: ["Seed count", "Tilt strength", "Droplet particles"], count: "Watermelon seeds" },
  cookie: { colors: ["Cookie dough", "Chocolate chips", "Baked texture"], motion: ["Chocolate chip count", "Texture", "Bounce strength"], count: "Chocolate chips" },
  snowfall: { colors: ["Snowflake color", "Ice highlights", "Snowburst color"], motion: ["Size variation", "Fall speed", "Wind strength"], count: "Flake density" },
  rain: { colors: ["Rain color", "Splash color", "Ripple highlights"], motion: ["Drop length", "Fall speed", "Wind direction"], count: "Rain density" },
  "wind-gust": { colors: ["Wind strands", "Wind highlights", "Air particles"], motion: ["Wind strength", "Curl intensity", "Trail length"], count: "Strand and particle count" },
  "floating-clouds": { colors: ["Cloud color", "Cloud shadow", "Cloud highlights"], motion: ["Cloud size", "Drift speed", "Layer depth"], count: "Cloud count" },
  rainbow: { colors: ["Outer bands", "Inner bands", "End clouds"], motion: ["Band thickness", "Arc size", "Rotation"], count: "Sparkle density" },
  "northern-lights": { colors: ["Aurora green", "Aurora teal", "Violet and blue light"], motion: ["Light intensity", "Wave speed", "Curtain width"], count: "Aurora ribbons" },
  fog: { colors: ["Fog color", "Wisp highlights", "Dispersed fog"], motion: ["Fog density", "Opacity", "Drift speed"], count: "Fog wisps" },
  thunderstorm: { colors: ["Storm cloud", "Lightning", "Rain"], motion: ["Lightning frequency", "Rain density", "Flash intensity"], count: "Storm scale" },
  "dust-motes": { colors: ["Dust particles", "Sunlit highlights", "Warm light"], motion: ["Size range", "Opacity", "Drift speed"], count: "Mote count" },
  "frost-crystals": { colors: ["Ice crystal", "Blue facets", "Crystal highlights"], motion: ["Crystal complexity", "Transparency", "Rotation speed"], count: "Crystal branches" },
  saturn: { colors: ["Planet surface", "Planet bands", "Ring color"], motion: ["Planet size", "Ring width", "Rotation speed"], count: "Ring details" },
  "mini-earth": { colors: ["Ocean", "Continents", "Clouds and atmosphere"], motion: ["Continent detail", "Cloud visibility", "Rotation speed"], count: "Surface details" },
  "shooting-star": { colors: ["Star core", "Tail layers", "Fragments"], motion: ["Tail length", "Travel speed", "Trajectory curvature"], count: "Tail fragments" },
  galaxy: { colors: ["Spiral arms", "Dust clouds", "Star core"], motion: ["Arm count", "Star density", "Rotation speed"], count: "Galaxy stars" },
  "black-hole": { colors: ["Accretion disk", "Hot inner ring", "Particle light"], motion: ["Particle density", "Rotation speed", "Gravity strength"], count: "Orbiting particles" },
  comet: { colors: ["Icy nucleus", "Comet tail", "Ice particles"], motion: ["Tail length", "Particle density", "Movement delay"], count: "Comet particles" },
  astronaut: { colors: ["Suit color", "Reflective visor", "Suit details"], motion: ["Character size", "Float intensity", "Spin speed"], count: "Suit details" },
  ufo: { colors: ["Saucer metal", "Glass dome", "Flight lights"], motion: ["Beam intensity", "Hover strength", "Movement speed"], count: "Saucer lights" },
  rocket: { colors: ["Rocket body", "Fins", "Exhaust flame"], motion: ["Exhaust length", "Flame speed", "Launch intensity"], count: "Flame layers" },
  constellation: { colors: ["Stars", "Constellation lines", "Bright stars"], motion: ["Line visibility", "Twinkle speed", "Shape spread"], count: "Star count" },
};

const TAU = Math.PI * 2;
const TURTLE_LEGS = [
  [-0.5, -0.2, 0],
  [0.5, -0.2, 1],
  [-0.48, 0.55, 2],
  [0.48, 0.55, 3],
] as const;
const path = (context: CanvasRenderingContext2D, color: string, draw: () => void, stroke?: string, width = 0.8) => {
  context.beginPath();
  draw();
  context.fillStyle = color;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  }
};

const ellipse = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  stroke?: string,
  width = 0.8,
  rotation = 0,
) => {
  context.beginPath();
  context.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, 0, TAU);
  context.fillStyle = color;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = width;
    context.stroke();
  }
};

const stroke = (context: CanvasRenderingContext2D, color: string, width: number, draw: () => void) => {
  context.beginPath();
  draw();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
};

const dot = (context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) => {
  context.beginPath();
  context.arc(x, y, Math.max(0.25, radius), 0, TAU);
  context.fillStyle = color;
  context.fill();
};

const drawTinyCat = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const tail = Math.sin(t * 0.0032) * c.articulation * 0.38 + (click ? Math.sin(click * 18) * click * 0.55 : 0);
  const ear = hover ? -0.12 : Math.sin(t * 0.007) * c.articulation * 0.08;
  const blink = Math.sin(t * 0.0017) > 0.985 ? 0.12 : 1;
  const bounce = Math.abs(Math.sin(t * 0.012)) * moving * c.intensity * r * 0.06;
  stroke(ctx, c.bodyColor, r * 0.25, () => {
    ctx.moveTo(-r * 0.54, r * 0.25);
    ctx.quadraticCurveTo(-r * 1.12, -r * 0.26 + tail * r * 0.25, -r * 0.7 + tail * r * 0.22, -r * 0.58);
    ctx.quadraticCurveTo(-r * 0.1 + tail * r * 0.5, -r * 0.88 - tail * r * 0.1, r * 0.3, -r * 0.52);
  });
  ellipse(ctx, -r * 0.04, r * 0.44 - bounce, r * 0.54, r * 0.42, c.bodyColor);
  ellipse(ctx, r * 0.06, -r * 0.13 - bounce, r * 0.74, r * 0.66, c.bodyColor, c.detailColor, r * 0.045);
  ctx.save();
  ctx.translate(-r * 0.43, -r * 0.55 - bounce);
  ctx.rotate(ear);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.27, r * 0.1); ctx.lineTo(-r * 0.25, -r * 0.72); ctx.quadraticCurveTo(0, -r * 0.56, r * 0.13, -r * 0.05); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.16, -r * 0.05); ctx.lineTo(-r * 0.16, -r * 0.48); ctx.quadraticCurveTo(-r * 0.02, -r * 0.35, r * 0.04, -r * 0.04); ctx.closePath(); });
  ctx.restore();
  ctx.save();
  ctx.translate(r * 0.47, -r * 0.55 - bounce);
  ctx.rotate(-ear);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.1, -r * 0.04); ctx.lineTo(r * 0.1, -r * 0.72); ctx.quadraticCurveTo(r * 0.35, -r * 0.55, r * 0.34, r * 0.1); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(r * 0.02, -r * 0.04); ctx.lineTo(r * 0.13, -r * 0.47); ctx.quadraticCurveTo(r * 0.25, -r * 0.25, r * 0.22, r * 0.01); ctx.closePath(); });
  ctx.restore();
  for (const x of [-r * 0.22, r * 0.3]) ellipse(ctx, x, -r * 0.19 - bounce, r * 0.075, r * 0.09 * blink, c.accentColor);
  ellipse(ctx, r * 0.05, r * 0.07 - bounce, r * 0.11, r * 0.075, "#fff1df");
  path(ctx, c.detailColor, () => { ctx.moveTo(-r * 0.02, r * 0.02 - bounce); ctx.lineTo(r * 0.12, r * 0.02 - bounce); ctx.lineTo(r * 0.05, r * 0.11 - bounce); ctx.closePath(); });
  for (const side of [-1, 1]) {
    stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(r * 0.23 * side, r * 0.07 - bounce); ctx.lineTo(r * 0.75 * side, r * 0.02 - bounce); });
    stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(r * 0.22 * side, r * 0.14 - bounce); ctx.lineTo(r * 0.68 * side, r * 0.27 - bounce); });
    ellipse(ctx, r * 0.55 * side, r * 0.72 - bounce, r * 0.22, r * 0.12, c.accentColor, c.detailColor, r * 0.025);
  }
  for (let toe = -1; toe <= 1; toe++) stroke(ctx, c.detailColor, r * 0.022, () => {
    ctx.moveTo(r * 0.55 + toe * r * 0.1, r * 0.72 - bounce);
    ctx.lineTo(r * 0.55 + toe * r * 0.1, r * 0.8 - bounce);
  });
  if (click > 0) {
    ctx.save();
    ctx.rotate(Math.sin(click * 20) * 0.5 * click);
    stroke(ctx, c.accentColor, r * 0.08, () => { ctx.moveTo(r * 0.5, r * 0.28); ctx.quadraticCurveTo(r * 0.9, r * 0.1, r * 1.05, -r * 0.1); });
    ctx.restore();
  }
};

const drawBunny = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const hop = click ? Math.sin(Math.min(1, click) * Math.PI) * c.intensity : Math.abs(Math.sin(t * 0.007 * c.speed)) * moving * c.intensity * 0.4;
  const flop = hover ? 0.03 : Math.sin(t * 0.008 * c.speed) * (moving ? 0.5 : 0.12) * c.articulation;
  const nose = Math.sin(t * 0.025 * c.speed) * c.articulation * r * 0.025;
  ellipse(ctx, -r * 0.05, r * 0.52 - hop * r * 0.28, r * 0.62, r * 0.46, c.bodyColor, c.detailColor, r * 0.035);
  ellipse(ctx, r * 0.03, -r * 0.18 - hop * r * 0.35, r * 0.58, r * 0.57, c.bodyColor, c.detailColor, r * 0.035);
  ellipse(ctx, -r * 0.54, r * 0.65, r * 0.21, r * 0.19, "#fffaf5", c.detailColor, r * 0.025);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.25, -r * 0.55 - hop * r * 0.3);
    ctx.rotate(side * (0.13 + flop));
    ellipse(ctx, 0, -r * 0.48, r * 0.22, r * 0.69, c.bodyColor, c.detailColor, r * 0.035);
    ellipse(ctx, 0, -r * 0.48, r * 0.105, r * 0.49, c.accentColor);
    ctx.restore();
    ellipse(ctx, side * r * 0.25, -r * 0.19 - hop * r * 0.3, r * 0.07, r * 0.1, c.detailColor);
    ellipse(ctx, side * r * 0.54, r * 0.77, r * 0.27, r * 0.16, c.accentColor, c.detailColor, r * 0.025);
  }
  ellipse(ctx, r * 0.05, r * 0.08 - hop * r * 0.3 + nose, r * 0.17, r * 0.12, "#fff9f3");
  dot(ctx, r * 0.05, r * 0.06 - hop * r * 0.3 + nose, r * 0.06, c.accentColor);
  stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(r * 0.05, r * 0.18 + nose); ctx.lineTo(r * 0.05, r * 0.26 + nose); ctx.quadraticCurveTo(r * 0.23, r * 0.32 + nose, r * 0.3, r * 0.2 + nose); });
  for (const side of [-1, 1]) ellipse(ctx, side * r * 0.42, r * 0.49, r * 0.22, r * 0.16, c.bodyColor);
};

const drawDuckling = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const phase = t * 0.009 * c.speed;
  const bob = Math.sin(phase * 2) * moving * c.intensity * r * 0.12;
  const wing = (Math.sin(phase * 2) * 0.35 + (click ? Math.sin(click * 24) * click * 0.85 : 0)) * c.articulation;
  ctx.save();
  ctx.rotate(moving * Math.sin(phase) * 0.08 * c.intensity);
  ellipse(ctx, 0, r * 0.12 - bob, r * 0.74, r * 0.57, c.bodyColor, "#c18a32", r * 0.025);
  ellipse(ctx, r * 0.2, -r * 0.4 - bob, r * 0.51, r * 0.47, c.bodyColor, "#c18a32", r * 0.025);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-r * 0.23, r * 0.06 - bob);
    ctx.rotate(side * wing);
    ellipse(ctx, side * r * 0.51, 0, r * 0.38, r * 0.2, c.accentColor, "#c18a32", r * 0.025, side * 0.32);
    ctx.restore();
    const step = Math.sin(phase + side * Math.PI) * moving * c.articulation * r * 0.07;
    stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(side * r * 0.3, r * 0.56 - bob); ctx.lineTo(side * r * 0.3, r * 0.72 - bob + step); ctx.lineTo(side * r * 0.48, r * 0.76 - bob + step); });
    dot(ctx, r * 0.35, -r * 0.47 - bob, r * 0.07, c.detailColor);
  }
  path(ctx, c.accentColor, () => { ctx.moveTo(r * 0.56, -r * 0.35 - bob); ctx.lineTo(r * 1.05, -r * 0.22 - bob); ctx.lineTo(r * 0.57, -r * 0.05 - bob); ctx.closePath(); });
  ctx.restore();
};

const drawPanda = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const sway = Math.sin(t * 0.0025 * c.speed) * c.intensity * 0.08;
  const stretch = Math.max(0, Math.sin(t * 0.0007 * c.speed)) ** 16 * c.intensity * 0.42;
  const arms = click ? Math.sin(click * Math.PI) * c.articulation * 0.45 : hover * 0.12 + stretch;
  ctx.save();
  ctx.rotate(sway);
  ellipse(ctx, 0, r * 0.4, r * 0.62, r * 0.48, c.bodyColor, "#c5c2bb", r * 0.035);
  for (const side of [-1, 1]) {
    dot(ctx, side * r * 0.48, -r * 0.62, r * 0.25, c.accentColor);
    ctx.save();
    ctx.translate(side * r * 0.52, r * 0.34);
    ctx.rotate(side * (0.52 - arms));
    ellipse(ctx, 0, r * 0.15, r * 0.22, r * 0.36, c.accentColor);
    ellipse(ctx, 0, r * 0.39, r * 0.2, r * 0.14, c.accentColor);
    ctx.restore();
  }
  ellipse(ctx, 0, -r * 0.23, r * 0.68, r * 0.62, c.bodyColor, "#c5c2bb", r * 0.035);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.27, -r * 0.26);
    ctx.rotate(side * -0.28);
    ellipse(ctx, 0, 0, r * 0.2, r * 0.26, c.accentColor);
    ctx.restore();
    ellipse(ctx, side * r * 0.27, -r * 0.29, r * 0.105, r * 0.15, c.accentColor);
    dot(ctx, side * r * 0.27, -r * 0.29, r * 0.055, c.detailColor);
  }
  ellipse(ctx, 0, -r * 0.05, r * 0.21, r * 0.14, "#fffaf3");
  dot(ctx, 0, -r * 0.08, r * 0.055, c.detailColor);
  if (Math.sin(t * 0.0013) > 0.99) stroke(ctx, c.accentColor, r * 0.07, () => { ctx.moveTo(-r * 0.36, -r * 0.28); ctx.lineTo(-r * 0.16, -r * 0.27); });
  ctx.restore();
};

const drawFox = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const swish = Math.sin(t * 0.003 * c.speed) * c.articulation * 0.48;
  const leap = click ? Math.sin(click * Math.PI) * c.intensity * 0.45 : Math.abs(Math.sin(t * 0.01)) * moving * c.intensity * 0.12;
  ctx.save();
  ctx.translate(0, -leap * r);
  ctx.save();
  ctx.translate(-r * 0.55, r * 0.18);
  ctx.rotate(swish);
  path(ctx, c.bodyColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 0.9, -r * 0.88, -r * 1.23, -r * 0.28); ctx.quadraticCurveTo(-r * 1.17, r * 0.28, -r * 0.16, r * 0.37); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.98, -r * 0.42); ctx.quadraticCurveTo(-r * 0.72, -r * 0.36, -r * 0.4, r * 0.25); ctx.quadraticCurveTo(-r * 0.98, r * 0.14, -r * 0.98, -r * 0.42); });
  ctx.restore();
  ellipse(ctx, -r * 0.08, r * 0.38, r * 0.58, r * 0.38, c.bodyColor);
  ellipse(ctx, r * 0.04, r * 0.42, r * 0.25, r * 0.32, c.accentColor);
  ellipse(ctx, r * 0.3, -r * 0.16, r * 0.62, r * 0.54, c.bodyColor, c.detailColor, r * 0.035);
  for (const side of [-1, 1]) {
    const earAngle = hover ? side * 0.08 : side * Math.sin(t * 0.006) * 0.07 * c.articulation;
    ctx.save();
    ctx.translate(r * (0.3 + side * 0.37), -r * 0.54);
    ctx.rotate(earAngle);
    path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.19, r * 0.12); ctx.lineTo(-r * 0.05, -r * 0.7); ctx.lineTo(r * 0.2, r * 0.1); ctx.closePath(); }, c.detailColor, r * 0.035);
    path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.06, -r * 0.04); ctx.lineTo(-r * 0.03, -r * 0.45); ctx.lineTo(r * 0.09, r * 0.04); ctx.closePath(); });
    ctx.restore();
  }
  ellipse(ctx, r * 0.59, r * 0.03, r * 0.27, r * 0.18, c.accentColor);
  dot(ctx, r * 0.4, -r * 0.24, r * 0.065, c.detailColor);
  dot(ctx, r * 0.79, r * 0.05, r * 0.065, c.detailColor);
  ctx.restore();
};

const drawPenguin = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const phase = t * 0.006 * c.speed;
  const waddle = Math.sin(phase) * moving * c.intensity * 0.14;
  const flap = (Math.sin(phase * 2) * (moving ? 0.32 : 0.12) + (click ? Math.sin(click * TAU) * 0.62 : 0)) * c.articulation;
  ctx.save();
  ctx.rotate(waddle + (hover ? -0.07 : 0));
  ellipse(ctx, 0, r * 0.12, r * 0.65, r * 0.86, c.bodyColor, "#18232e", r * 0.04);
  ellipse(ctx, 0, r * 0.24, r * 0.43, r * 0.62, c.accentColor);
  ellipse(ctx, 0, -r * 0.42, r * 0.47, r * 0.43, c.bodyColor);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.5, -r * 0.02);
    ctx.rotate(side * flap);
    path(ctx, c.bodyColor, () => { ctx.moveTo(0, -r * 0.32); ctx.quadraticCurveTo(side * r * 0.46, r * 0.04, side * r * 0.22, r * 0.54); ctx.quadraticCurveTo(side * r * 0.02, r * 0.44, 0, -r * 0.32); }, "#18232e", r * 0.03);
    ctx.restore();
    const step = Math.sin(phase + side * Math.PI) * moving * c.articulation * r * 0.08;
    ellipse(ctx, side * r * 0.33, r * 0.79 + step, r * 0.31, r * 0.13, c.detailColor);
    dot(ctx, side * r * 0.18, -r * 0.46, r * 0.06, "#fff");
    dot(ctx, side * r * 0.19, -r * 0.45, r * 0.035, "#17202a");
  }
  path(ctx, c.detailColor, () => { ctx.moveTo(-r * 0.1, -r * 0.28); ctx.lineTo(r * 0.1, -r * 0.28); ctx.lineTo(0, -r * 0.12); ctx.closePath(); });
  ctx.restore();
};

const drawHamster = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const puff = 1 + (0.04 + Math.sin(t * 0.003 * c.speed) * 0.035) * c.intensity;
  const run = moving ? Math.sin(t * 0.016 * c.speed) * c.articulation : Math.sin(t * 0.004) * 0.18;
  ctx.save();
  if (click > 0) ctx.rotate(Math.sin(click * TAU) * Math.PI * 2 * click);
  ellipse(ctx, 0, r * 0.17, r * 0.82 * puff, r * 0.67, c.bodyColor, c.detailColor, r * 0.035);
  ellipse(ctx, 0, r * 0.4, r * 0.38, r * 0.38, c.accentColor);
  for (const side of [-1, 1]) {
    ellipse(ctx, side * r * 0.58, -r * 0.08, r * 0.28 * puff, r * 0.3, c.accentColor);
    ellipse(ctx, side * r * 0.42, r * 0.76 + run * r * 0.05, r * 0.23, r * 0.13, c.detailColor);
    ellipse(ctx, side * r * 0.32, -r * 0.58, r * 0.17, r * 0.2, c.bodyColor, c.detailColor, r * 0.025);
    dot(ctx, side * r * 0.32, -r * 0.15, r * 0.055, c.detailColor);
    const whisker = Math.sin(t * 0.019 * c.speed) * c.articulation * r * 0.035;
    stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(side * r * 0.69, r * 0.02); ctx.lineTo(side * r * 0.96, -r * 0.02 + whisker); });
    stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(side * r * 0.69, r * 0.1); ctx.lineTo(side * r * 0.93, r * 0.2 - whisker); });
  }
  const noseTwitch = Math.sin(t * 0.026 * c.speed) * c.articulation * r * 0.025;
  dot(ctx, r * 0.57 + noseTwitch, r * 0.13, r * 0.05, c.detailColor);
  stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(r * 0.57 + noseTwitch, r * 0.2); ctx.quadraticCurveTo(r * 0.55 + noseTwitch, r * 0.3, r * 0.68 + noseTwitch, r * 0.32); });
  ctx.restore();
};

const drawHedgehog = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const curl = click > 0 ? Math.sin(Math.min(1, click) * Math.PI) : 0;
  const sniff = Math.sin(t * 0.008 * c.speed) * c.intensity * r * 0.035;
  ellipse(ctx, 0, r * 0.24, r * 0.72, r * 0.58, c.bodyColor, c.detailColor, r * 0.035);
  for (let i = 0; i < 13; i++) {
    const angle = Math.PI * (1.12 + i / 12 * 1.75);
    const move = Math.sin(t * 0.004 + i * 0.7) * c.articulation * r * 0.025;
    const inner = r * (0.52 - curl * 0.12) + move;
    const outer = r * (0.9 - curl * 0.1);
    path(ctx, i % 2 ? c.accentColor : c.detailColor, () => {
      ctx.moveTo(Math.cos(angle - 0.09) * inner, r * 0.08 + Math.sin(angle - 0.09) * inner);
      ctx.lineTo(Math.cos(angle) * outer, r * 0.08 + Math.sin(angle) * outer);
      ctx.lineTo(Math.cos(angle + 0.09) * inner, r * 0.08 + Math.sin(angle + 0.09) * inner);
      ctx.closePath();
    });
  }
  ellipse(ctx, r * 0.3, r * 0.2, r * 0.51, r * 0.39, c.bodyColor);
  path(ctx, c.detailColor, () => { ctx.moveTo(r * 0.53, r * 0.13 + sniff); ctx.quadraticCurveTo(r * 0.94, r * 0.12 + sniff, r * 0.87, r * 0.34 + sniff); ctx.quadraticCurveTo(r * 0.65, r * 0.48, r * 0.45, r * 0.36 + sniff); ctx.closePath(); });
  dot(ctx, r * 0.77, r * 0.17 + sniff, r * 0.06, c.accentColor);
  dot(ctx, r * 0.5, r * 0.05, r * 0.055, "#201d21");
  for (const side of [-1, 1]) {
    const shuffle = Math.sin(t * 0.014 * c.speed + side * Math.PI) * moving * c.articulation * r * 0.07;
    ellipse(ctx, side * r * 0.42 + shuffle, r * 0.67, r * 0.17, r * 0.1, c.detailColor);
  }
};

const drawFrog = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const jump = click > 0 ? Math.sin(click * Math.PI) * c.intensity : 0;
  const squash = click > 0 && click < 0.2 ? 1 - click * 1.3 : click > 0.8 ? 0.86 + click * 0.14 : 1;
  const gaze = hover ? -0.18 : Math.sin(t * 0.0014) * 0.1;
  const blink = Math.sin(t * 0.0018) > 0.991 ? 0.15 : 1;
  ctx.save();
  ctx.translate(0, -jump * r * 0.9);
  ctx.scale(1 + (1 - squash) * 0.55, squash);
  ellipse(ctx, 0, r * 0.32, r * 0.72, r * 0.5, c.bodyColor, "#367a49", r * 0.04);
  ellipse(ctx, 0, r * 0.48, r * 0.44, r * 0.27, c.accentColor);
  for (const side of [-1, 1]) {
    ellipse(ctx, side * r * 0.48, r * 0.6, r * 0.35, r * 0.2, c.bodyColor);
    ellipse(ctx, side * r * 0.64, r * 0.72, r * 0.24, r * 0.11, c.bodyColor);
    for (let toe = -1; toe <= 1; toe++) dot(ctx, side * r * (0.58 + toe * 0.12), r * 0.77, r * 0.07, c.accentColor);
    ellipse(ctx, side * r * 0.4, -r * 0.2, r * 0.29, r * 0.33 * blink, c.bodyColor, "#367a49", r * 0.035);
    dot(ctx, side * r * 0.4 + gaze * r, -r * 0.23, r * 0.15, c.accentColor);
    ellipse(ctx, side * r * 0.4 + gaze * r, -r * 0.23, r * 0.08, r * 0.09 * blink, "#20232a");
    dot(ctx, side * r * 0.4 + gaze * r * 1.4, -r * 0.28, r * 0.03, "#fff");
  }
  stroke(ctx, "#276948", r * 0.045, () => { ctx.moveTo(-r * 0.3, r * 0.13); ctx.quadraticCurveTo(0, r * 0.3, r * 0.3, r * 0.13); });
  ctx.restore();
};

const drawTurtle = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const phase = t * 0.006 * c.speed;
  const tuck = click > 0 && click < 0.62 ? Math.sin((click / 0.62) * Math.PI) : 0;
  const bob = Math.sin(phase * 2) * moving * c.intensity * r * 0.04;
  for (const [x, y, n] of TURTLE_LEGS) {
    ctx.save();
    ctx.translate(r * x, r * y + bob);
    ctx.rotate(Math.sin(phase + n * Math.PI / 2) * moving * c.articulation * 0.55);
    ellipse(ctx, 0, 0, r * 0.25, r * 0.19, c.bodyColor, "#326849", r * 0.035);
    dot(ctx, 0, r * 0.12, r * 0.055, c.accentColor);
    ctx.restore();
  }
  ellipse(ctx, 0, r * 0.16 + bob, r * 0.7, r * 0.53, c.accentColor, "#553c30", r * 0.08);
  ellipse(ctx, 0, r * 0.15 + bob, r * 0.49, r * 0.36, c.accentColor, c.detailColor, r * 0.04);
  stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(0, -r * 0.19 + bob); ctx.lineTo(0, r * 0.48 + bob); ctx.moveTo(-r * 0.42, r * 0.15 + bob); ctx.lineTo(r * 0.42, r * 0.15 + bob); });
  for (const side of [-1, 1]) {
    const extension = tuck ? 1 - tuck : 1;
    ellipse(ctx, side * r * 0.67 * extension, -r * 0.13 + bob, r * 0.33, r * 0.28, c.bodyColor, "#326849", r * 0.035);
    dot(ctx, side * r * (0.73 * extension), -r * 0.18 + bob, r * 0.045, c.detailColor);
  }
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.72, r * 0.24); ctx.lineTo(-r * 1.03, r * 0.37); ctx.lineTo(-r * 0.73, r * 0.42); ctx.closePath(); });
};

const drawButterfly = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving = 0, hover = 0, click = 0, pink = false) => {
  const beat = t * 0.009 * c.speed;
  const fold = hover ? 0.02 : Math.sin(beat) * c.articulation * (0.22 + moving * 0.38);
  const burst = click > 0 ? Math.sin(click * 15) * 0.2 : 0;
  const wing = (side: number, upper: boolean) => {
    ctx.save();
    ctx.translate(side * r * 0.12, upper ? -r * 0.03 : r * 0.08);
    ctx.rotate(side * (fold + burst) * (upper ? 1 : -0.78));
    ctx.scale(1, Math.max(0.46, Math.cos(fold + burst)));
    if (pink) {
      path(ctx, c.bodyColor, () => {
        ctx.moveTo(0, 0);
        if (upper) {
          ctx.bezierCurveTo(side * r * 0.08, -r * 0.82, side * r * 1.1, -r * 0.95, side * r * 0.96, -r * 0.16);
          ctx.bezierCurveTo(side * r * 0.9, r * 0.08, side * r * 0.42, r * 0.08, 0, 0);
        } else {
          ctx.bezierCurveTo(side * r * 0.44, -r * 0.05, side * r * 0.98, r * 0.02, side * r * 0.73, r * 0.69);
          ctx.bezierCurveTo(side * r * 0.34, r * 0.66, side * r * 0.16, r * 0.36, 0, 0);
        }
        ctx.closePath();
      }, c.accentColor, r * 0.07);
      stroke(ctx, c.accentColor, r * 0.035, () => { ctx.moveTo(side * r * 0.08, r * 0.03); ctx.quadraticCurveTo(side * r * 0.52, upper ? -r * 0.16 : r * 0.27, side * r * 0.83, upper ? -r * 0.42 : r * 0.5); });
      dot(ctx, side * r * 0.65, upper ? -r * 0.26 : r * 0.36, r * 0.12, c.detailColor);
      dot(ctx, side * r * 0.8, upper ? -r * 0.12 : r * 0.54, r * 0.055, c.detailColor);
    } else {
      path(ctx, c.bodyColor, () => {
        ctx.moveTo(0, 0);
        if (upper) {
          ctx.bezierCurveTo(side * r * 0.04, -r * 0.8, side * r * 1.05, -r * 0.96, side * r * 0.94, -r * 0.2);
          ctx.bezierCurveTo(side * r * 0.82, r * 0.04, side * r * 0.42, r * 0.08, 0, 0);
        } else {
          ctx.bezierCurveTo(side * r * 0.42, -r * 0.02, side * r * 0.9, r * 0.02, side * r * 0.7, r * 0.68);
          ctx.bezierCurveTo(side * r * 0.34, r * 0.63, side * r * 0.15, r * 0.35, 0, 0);
        }
        ctx.closePath();
      }, c.detailColor, r * 0.09);
      stroke(ctx, c.accentColor, r * 0.04, () => { ctx.moveTo(side * r * 0.08, 0); ctx.lineTo(side * r * 0.7, upper ? -r * 0.46 : r * 0.41); });
      for (let spot = 0; spot < 3; spot++) dot(ctx, side * r * (0.52 + spot * 0.12), (upper ? -1 : 1) * r * (0.3 + (spot % 2) * 0.18), r * (spot === 0 ? 0.065 : 0.045), "#fff0cf");
    }
    ctx.restore();
  };
  wing(-1, true); wing(1, true); wing(-1, false); wing(1, false);
  ellipse(ctx, 0, r * 0.05, r * 0.12, r * 0.43, c.detailColor);
  dot(ctx, 0, -r * 0.35, r * 0.16, c.bodyColor);
  for (const side of [-1, 1]) {
    stroke(ctx, c.detailColor, r * 0.045, () => { ctx.moveTo(side * r * 0.06, -r * 0.36); ctx.quadraticCurveTo(side * r * 0.3, -r * 0.75, side * r * 0.27, -r * 0.88); });
    dot(ctx, side * r * 0.27, -r * 0.88, r * 0.045, c.detailColor);
  }
};

const drawLadybug = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const walk = t * 0.013 * c.speed;
  const wingOpen = click > 0.08 && click < 0.78 ? Math.sin(((click - 0.08) / 0.7) * Math.PI) : 0;
  for (let leg = 0; leg < 3; leg++) for (const side of [-1, 1]) {
    const phase = Math.sin(walk + leg * Math.PI / 2 + (side < 0 ? Math.PI : 0)) * moving * c.articulation * r * 0.12;
    stroke(ctx, c.accentColor, r * 0.055, () => { ctx.moveTo(side * r * 0.3, r * (leg * 0.16)); ctx.lineTo(side * r * 0.62 + phase, r * (leg * 0.16 + 0.16)); });
  }
  ellipse(ctx, 0, r * 0.2, r * 0.72, r * 0.62, c.accentColor);
  ellipse(ctx, 0, -r * 0.13, r * 0.62, r * 0.58, c.bodyColor, c.accentColor, r * 0.07);
  for (let spot = 0; spot < 3; spot++) {
    dot(ctx, (spot - 1) * r * 0.31, -r * 0.36 + Math.abs(spot - 1) * r * 0.12, r * 0.095, c.accentColor);
    dot(ctx, (spot - 1) * r * 0.31, r * 0.03 + Math.abs(spot - 1) * r * 0.08, r * 0.08, c.accentColor);
  }
  stroke(ctx, c.accentColor, r * 0.035, () => { ctx.moveTo(0, -r * 0.62); ctx.lineTo(0, r * 0.38); });
  dot(ctx, 0, -r * 0.58, r * 0.28, c.accentColor);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.18, -r * 0.76);
    ctx.rotate(side * (Math.sin(t * 0.006) * 0.1 * c.articulation + (hover ? 0.15 : 0)));
    stroke(ctx, c.accentColor, r * 0.04, () => { ctx.moveTo(0, r * 0.2); ctx.quadraticCurveTo(side * r * 0.18, -r * 0.06, side * r * 0.16, -r * 0.24); });
    ctx.restore();
  }
  if (wingOpen > 0) {
    ctx.save();
    ctx.globalAlpha = wingOpen * 0.8;
    ellipse(ctx, -r * 0.28, r * 0.12, r * 0.3, r * 0.52, "#f5f0df", undefined, 0, -0.24);
    ellipse(ctx, r * 0.28, r * 0.12, r * 0.3, r * 0.52, "#f5f0df", undefined, 0, 0.24);
    ctx.restore();
  }
};

const drawDragonfly = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const beat = t * 0.025 * c.speed * (hover ? 1.7 : 1);
  const dart = click > 0 ? (1 - click) * c.intensity * r * 0.5 : 0;
  ctx.save();
  ctx.translate(dart, 0);
  ctx.rotate(Math.sin(t * 0.0015 * c.speed) * moving * 0.08);
  const wing = (side: number, fore: boolean) => {
    ctx.save();
    ctx.translate(side * r * 0.08, fore ? -r * 0.22 : r * 0.13);
    ctx.rotate(side * (Math.sin(beat + (fore ? 0 : 1.4)) * 0.56 * c.articulation));
    ctx.globalAlpha = 0.58;
    path(ctx, c.accentColor, () => {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * r * 0.1, -r * 0.72, side * r * (fore ? 1.15 : 0.92), -r * 0.74);
      ctx.quadraticCurveTo(side * r * (fore ? 0.83 : 0.72), -r * 0.16, 0, 0);
      ctx.closePath();
    }, "#f4ffff", r * 0.035);
    ctx.globalAlpha = 1;
    stroke(ctx, "#f4ffff", r * 0.02, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.5, -r * 0.45, side * r * 0.95, -r * 0.69); });
    ctx.restore();
  };
  wing(-1, true); wing(1, true); wing(-1, false); wing(1, false);
  ellipse(ctx, 0, -r * 0.48, r * 0.23, r * 0.2, c.detailColor);
  dot(ctx, -r * 0.13, -r * 0.5, r * 0.07, c.accentColor);
  dot(ctx, r * 0.13, -r * 0.5, r * 0.07, c.accentColor);
  ellipse(ctx, 0, r * 0.08, r * 0.12, r * 0.53, c.bodyColor, c.detailColor, r * 0.045);
  for (let segment = 0; segment < 4; segment++) stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(-r * 0.1, r * (segment * 0.19 - 0.1)); ctx.lineTo(r * 0.1, r * (segment * 0.19 - 0.1)); });
  for (const side of [-1, 1]) stroke(ctx, c.detailColor, r * 0.04, () => { ctx.moveTo(side * r * 0.08, r * 0.35); ctx.lineTo(side * r * 0.28, r * 0.6); });
  ctx.restore();
};

const drawBee = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const beat = t * 0.036 * c.speed * (hover ? 1.3 : 1);
  const buzz = Math.sin(beat) * c.articulation * 0.11;
  const dash = click > 0 ? (1 - click) * r * c.intensity * 0.8 : 0;
  ctx.save();
  ctx.translate(dash, Math.sin(t * 0.01 * c.speed) * r * c.intensity * 0.05);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.1, -r * 0.28);
    ctx.rotate(side * (0.72 + buzz));
    ellipse(ctx, side * r * 0.32, -r * 0.22, r * 0.34, r * 0.16, c.detailColor, "#f7ffff", r * 0.03);
    ctx.restore();
  }
  ellipse(ctx, -r * 0.38, r * 0.08, r * 0.49, r * 0.34, c.bodyColor, c.accentColor, r * 0.045);
  for (let stripe = 0; stripe < 3; stripe++) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-r * 0.38, r * 0.08, r * (0.18 + stripe * 0.07), r * 0.34, 0, -Math.PI / 2, Math.PI / 2);
    ctx.strokeStyle = c.accentColor;
    ctx.lineWidth = r * 0.11;
    ctx.stroke();
    ctx.restore();
  }
  ellipse(ctx, r * 0.28, -r * 0.07, r * 0.3, r * 0.29, c.bodyColor, c.accentColor, r * 0.035);
  dot(ctx, r * 0.37, -r * 0.12, r * 0.055, c.accentColor);
  for (const side of [-1, 1]) {
    stroke(ctx, c.accentColor, r * 0.035, () => { ctx.moveTo(r * 0.2, -r * 0.3); ctx.quadraticCurveTo(r * 0.14 + side * r * 0.2, -r * 0.65, r * 0.25 + side * r * 0.22, -r * 0.58); });
    stroke(ctx, c.accentColor, r * 0.045, () => { ctx.moveTo(-r * 0.55, r * 0.29); ctx.lineTo(-r * 0.66, r * (0.53 + side * buzz)); });
    stroke(ctx, c.accentColor, r * 0.045, () => { ctx.moveTo(-r * 0.25, r * 0.32); ctx.lineTo(-r * 0.25, r * (0.57 - side * buzz)); });
  }
  ctx.restore();
};

const drawFirefly = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, hover: number, click: number) => {
  const pulse = click > 0 ? 1 - click * 0.75 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.003 * c.speed));
  const glow = Math.min(1, c.intensity * pulse + hover * 0.25);
  const beat = Math.sin(t * 0.012 * c.speed) * c.articulation * 0.22;
  const gradient = ctx.createRadialGradient(r * 0.48, r * 0.28, r * 0.04, r * 0.48, r * 0.28, r * (0.95 + glow * 0.4));
  gradient.addColorStop(0, `rgba(235,255,119,${0.35 + glow * 0.45})`);
  gradient.addColorStop(0.25, `rgba(201,255,89,${0.2 + glow * 0.28})`);
  gradient.addColorStop(1, "rgba(201,255,89,0)");
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(r * 0.48, r * 0.28, r * (0.95 + glow * 0.4), 0, TAU);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * r * 0.14, -r * 0.15);
    ctx.rotate(side * beat);
    ctx.globalAlpha = 0.58;
    ellipse(ctx, side * r * 0.32, -r * 0.15, r * 0.34, r * 0.17, c.detailColor, c.accentColor, r * 0.025);
    ctx.restore();
  }
  ellipse(ctx, 0, r * 0.06, r * 0.21, r * 0.38, c.bodyColor, c.detailColor, r * 0.035);
  ellipse(ctx, r * 0.48, r * 0.28, r * 0.29, r * 0.28, c.accentColor);
  ellipse(ctx, r * 0.48, r * 0.28, r * 0.17, r * 0.16, "#fbffd0");
  dot(ctx, -r * 0.09, -r * 0.14, r * 0.045, c.detailColor);
  ctx.restore();
};

const drawMoth = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const flutter = (Math.sin(t * 0.0048 * c.speed + Math.sin(t * 0.0011) * 0.45) * (0.15 + moving * 0.27 + hover * 0.15) +
    Math.sin(click * 16) * click * 0.24) * c.articulation;
  const wing = (side: number) => {
    ctx.save();
    ctx.translate(side * r * 0.09, 0);
    ctx.rotate(side * flutter);
    path(ctx, c.bodyColor, () => {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(side * r * 0.56, -r * 0.85, side * r * 1.05, -r * 0.65);
      ctx.quadraticCurveTo(side * r * 1.24, -r * 0.38, side * r * 0.79, -r * 0.12);
      ctx.quadraticCurveTo(side * r * 1.05, r * 0.44, side * r * 0.54, r * 0.52);
      ctx.quadraticCurveTo(side * r * 0.25, r * 0.31, 0, 0);
      ctx.closePath();
    }, c.detailColor, r * 0.045);
    stroke(ctx, c.accentColor, r * 0.075, () => { ctx.moveTo(side * r * 0.14, -r * 0.03); ctx.quadraticCurveTo(side * r * 0.47, -r * 0.34, side * r * 0.92, -r * 0.5); });
    stroke(ctx, c.accentColor, r * 0.06, () => { ctx.moveTo(side * r * 0.16, r * 0.04); ctx.quadraticCurveTo(side * r * 0.53, r * 0.24, side * r * 0.75, r * 0.4); });
    ellipse(ctx, side * r * 0.57, -r * 0.18, r * 0.2, r * 0.12, c.accentColor, c.detailColor, r * 0.025, side * 0.4);
    dot(ctx, side * r * 0.57, -r * 0.18, r * 0.065, c.detailColor);
    ctx.restore();
  };
  wing(-1); wing(1);
  ellipse(ctx, 0, r * 0.02, r * 0.14, r * 0.43, c.detailColor);
  ellipse(ctx, 0, -r * 0.35, r * 0.18, r * 0.19, c.bodyColor);
  for (const side of [-1, 1]) stroke(ctx, c.detailColor, r * 0.05, () => { ctx.moveTo(side * r * 0.05, -r * 0.42); ctx.quadraticCurveTo(side * r * 0.3, -r * 0.85, side * r * 0.4, -r * 0.74); });
};

const drawCaterpillar = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, click: number) => {
  const phase = t * 0.006 * c.speed;
  const count = Math.round(c.segments);
  const curl = click > 0 ? Math.sin(click * Math.PI) * c.intensity : 0;
  for (let segment = count - 1; segment >= 0; segment--) {
    const progress = segment / (count - 1);
    const wave = Math.sin(phase - segment * 0.72) * c.articulation * (0.05 + moving * 0.09 + c.intensity * 0.025);
    const x = (progress - 0.5) * r * 1.62;
    const y = r * 0.24 - Math.abs(Math.sin(phase - segment * 0.72)) * r * c.intensity * 0.09 + wave * r;
    const size = r * (0.24 + 0.04 * Math.sin(progress * Math.PI));
    ctx.save();
    ctx.translate(x * (1 - curl * 0.3), y - curl * r * Math.cos(progress * TAU) * 0.24);
    ctx.rotate(wave + curl * Math.sin(progress * TAU) * 1.2);
    ellipse(ctx, 0, 0, size, size * 0.94, segment === count - 1 ? c.accentColor : segment % 2 ? c.bodyColor : c.accentColor, "#456b3d", r * 0.025);
    stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(-size * 0.4, size * 0.1); ctx.quadraticCurveTo(0, size * 0.46, size * 0.42, size * 0.08); });
    if (segment < count - 1) for (const side of [-1, 1]) {
      const step = Math.sin(phase * 2 - segment * 1.1 + side * Math.PI) * moving * c.articulation;
      stroke(ctx, "#355b38", r * 0.035, () => { ctx.moveTo(0, size * 0.6); ctx.lineTo(side * size * 0.28, size * (0.86 + step * 0.12)); });
      dot(ctx, side * size * 0.28, size * (0.86 + step * 0.12), r * 0.025, c.detailColor);
    }
    if (segment === count - 1) {
      dot(ctx, -size * 0.3, -size * 0.1, size * 0.12, "#fff");
      dot(ctx, size * 0.3, -size * 0.1, size * 0.12, "#fff");
      dot(ctx, -size * 0.28, -size * 0.1, size * 0.055, c.detailColor);
      dot(ctx, size * 0.32, -size * 0.1, size * 0.055, c.detailColor);
      stroke(ctx, c.detailColor, r * 0.03, () => { ctx.moveTo(-size * 0.24, -size * 0.72); ctx.lineTo(-size * 0.33, -size * 1.02); ctx.moveTo(size * 0.24, -size * 0.72); ctx.lineTo(size * 0.35, -size * 1.02); });
    }
    ctx.restore();
  }
};

const drawSnail = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const glide = Math.sin(t * 0.0015 * c.speed) * moving * c.intensity * r * 0.08;
  const retract = click > 0 && click < 0.48 ? Math.sin((click / 0.48) * Math.PI) : 0;
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.88 + glide, r * 0.55); ctx.quadraticCurveTo(-r * 0.7, r * 0.08, -r * 0.23, r * 0.26); ctx.lineTo(r * 0.75, r * 0.32); ctx.quadraticCurveTo(r * 0.92, r * 0.36, r * 0.93, r * 0.57); ctx.closePath(); }, c.detailColor, r * 0.035);
  ellipse(ctx, -r * 0.04, -r * 0.19, r * 0.55, r * 0.6, c.accentColor, "#694d43", r * 0.06);
  for (let ring = 0; ring < 4; ring++) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.04, -r * 0.19, r * (0.43 - ring * 0.09), r * (0.48 - ring * 0.09), 0, 0, TAU * (0.9 - ring * 0.1));
    ctx.strokeStyle = ring % 2 ? "#e4c194" : c.detailColor;
    ctx.lineWidth = r * 0.045;
    ctx.stroke();
  }
  dot(ctx, -r * 0.04, -r * 0.19, r * 0.045, c.detailColor);
  for (const side of [-1, 1]) {
    const retractY = retract * r * 0.42;
    const look = hover ? side * r * 0.07 : Math.sin(t * 0.0017 + side) * r * 0.035 * c.articulation;
    stroke(ctx, c.bodyColor, r * 0.1, () => { ctx.moveTo(r * 0.48, r * 0.23); ctx.quadraticCurveTo(r * (0.62 + side * 0.12), -r * 0.15 + retractY, r * (0.68 + side * 0.15), -r * 0.53 + retractY); });
    ellipse(ctx, r * (0.68 + side * 0.15), -r * 0.55 + retractY, r * 0.15, r * 0.17, c.bodyColor, c.detailColor, r * 0.025);
    dot(ctx, r * (0.68 + side * 0.15) + look, -r * 0.56 + retractY, r * 0.055, c.detailColor);
    dot(ctx, r * (0.68 + side * 0.15) + look - r * 0.02, -r * 0.58 + retractY, r * 0.018, "#fff");
  }
  stroke(ctx, c.detailColor, r * 0.03, () => { ctx.moveTo(r * 0.7, r * 0.38); ctx.quadraticCurveTo(r * 0.82, r * 0.47, r * 0.91, r * 0.38); });
};

const drawMantis = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const tracking = Math.atan2(0, 1) + Math.sin(t * 0.0012 * c.speed) * c.articulation * 0.08;
  const strike = click > 0.12 && click < 0.58 ? Math.sin(((click - 0.12) / 0.46) * Math.PI) * c.intensity : 0;
  const step = Math.sin(t * 0.008 * c.speed) * moving * c.articulation;
  ellipse(ctx, 0, r * 0.14, r * 0.16, r * 0.61, c.bodyColor, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.11, -r * 0.28); ctx.lineTo(r * 0.11, -r * 0.28); ctx.lineTo(0, r * 0.63); ctx.closePath(); });
  ctx.save();
  ctx.translate(0, -r * 0.45);
  ctx.rotate(tracking + (hover ? -0.12 : 0));
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.28, 0); ctx.lineTo(-r * 0.13, -r * 0.39); ctx.lineTo(r * 0.17, -r * 0.37); ctx.lineTo(r * 0.31, -r * 0.05); ctx.lineTo(r * 0.1, r * 0.12); ctx.lineTo(-r * 0.23, r * 0.1); ctx.closePath(); }, c.detailColor, r * 0.035);
  for (const side of [-1, 1]) {
    dot(ctx, side * r * 0.17, -r * 0.2, r * 0.075, c.accentColor);
    stroke(ctx, c.detailColor, r * 0.035, () => { ctx.moveTo(side * r * 0.1, -r * 0.35); ctx.quadraticCurveTo(side * r * 0.25, -r * 0.67, side * r * 0.35, -r * 0.6); });
  }
  ctx.restore();
  for (const side of [-1, 1]) {
    const armAngle = side * (0.9 - strike * 1.3 + Math.sin(t * 0.002 + side) * 0.08 * c.articulation);
    ctx.save();
    ctx.translate(side * r * 0.12, -r * 0.2);
    ctx.rotate(armAngle);
    stroke(ctx, c.bodyColor, r * 0.105, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.22, -r * 0.39); ctx.lineTo(side * r * 0.06, -r * 0.66); });
    stroke(ctx, c.detailColor, r * 0.04, () => { ctx.moveTo(side * r * 0.22, -r * 0.39); ctx.lineTo(side * r * 0.06, -r * 0.66); });
    dot(ctx, side * r * 0.22, -r * 0.39, r * 0.08, c.accentColor);
    ctx.restore();
    stroke(ctx, c.bodyColor, r * 0.07, () => { ctx.moveTo(side * r * 0.08, r * 0.33); ctx.lineTo(side * r * (0.53 + step * 0.1), r * 0.65); ctx.lineTo(side * r * 0.24, r * 0.82); });
  }
  for (const side of [-1, 1]) stroke(ctx, "#d5ec9a", r * 0.045, () => { ctx.moveTo(side * r * 0.27, -r * 0.58); ctx.lineTo(side * r * 0.39, -r * 0.6); });
};

const drawLeaf = (ctx: CanvasRenderingContext2D, color: string, vein: string, size: number, oak: boolean) => {
  path(ctx, color, () => {
    ctx.moveTo(0, size);
    ctx.bezierCurveTo(-size * 0.7, size * 0.58, -size * 0.74, -size * 0.15, 0, -size);
    if (oak) {
      for (let i = 3; i >= -3; i--) {
        const y = -size * i * 0.22;
        const side = i % 2 ? 1 : -1;
        ctx.quadraticCurveTo(side * size * 0.93, y, side * size * 0.54, y - size * 0.08);
      }
    } else {
      ctx.lineTo(size * 0.14, -size * 0.65);
      ctx.lineTo(size * 0.57, -size * 0.72);
      ctx.lineTo(size * 0.37, -size * 0.31);
      ctx.lineTo(size * 0.82, -size * 0.26);
      ctx.lineTo(size * 0.46, 0);
      ctx.lineTo(size * 0.76, size * 0.24);
      ctx.lineTo(size * 0.33, size * 0.28);
      ctx.lineTo(size * 0.21, size * 0.69);
    }
    ctx.quadraticCurveTo(size * 0.66, size * 0.8, 0, size);
    ctx.closePath();
  }, "#713d29", size * 0.055);
  stroke(ctx, vein, size * 0.045, () => {
    ctx.moveTo(0, size * 0.86);
    ctx.lineTo(0, -size * 0.78);
    for (const side of [-1, 1]) for (let veinIndex = 0; veinIndex < 3; veinIndex++) {
      const y = size * (0.48 - veinIndex * 0.37);
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(side * size * 0.16, y - size * 0.2, side * size * (0.48 + veinIndex * 0.035), y - size * 0.3);
    }
  });
};

const drawPetal = (ctx: CanvasRenderingContext2D, color: string, highlight: string, size: number) => {
  const gradient = ctx.createLinearGradient(-size * 0.35, 0, size * 0.35, size);
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(1, color);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-size * 0.72, size * 0.22, -size * 0.44, size * 0.92, 0, size);
  ctx.bezierCurveTo(size * 0.48, size * 0.85, size * 0.72, size * 0.22, 0, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = highlight;
  ctx.lineWidth = size * 0.025;
  ctx.stroke();
};

const drawAutumnLeaves = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const gust = Math.sin(t * 0.0011) * c.intensity + moving * c.articulation;
  const burst = click ? Math.sin(click * Math.PI) : 0;
  const colors = [c.bodyColor, c.accentColor, "#c5442f", "#a94e2e", "#d98136"];
  for (let i = 0; i < Math.round(c.segments); i++) {
    const phase = i * 2.399;
    const fall = t * 0.00055 * c.speed + i * 1.7 + burst * 2.4;
    const x = Math.sin(phase + fall * 0.6) * r * (0.44 + (i % 3) * 0.18) + gust * r * 0.2;
    const y = Math.cos(phase * 0.7 + fall * 0.44) * r * 0.5 + Math.sin(fall) * r * 0.28;
    ctx.save();
    ctx.translate(x + (hover ? Math.sin(phase) * r * 0.12 : 0), y - burst * r * (0.5 + i % 2));
    ctx.rotate(Math.sin(fall * (0.7 + i % 3 * 0.2)) * (0.45 + c.articulation * 0.3));
    const size = r * (0.23 + (i % 3) * 0.025);
    drawLeaf(ctx, colors[i % colors.length], c.detailColor, size, i % 3 === 1);
    ctx.restore();
  }
};

const drawCherryBlossom = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const burst = click ? Math.sin(click * Math.PI) : 0;
  for (let i = 0; i < Math.round(c.segments); i++) {
    const phase = i * 2.4;
    const drift = t * 0.0006 * c.speed + phase;
    const x = Math.sin(drift * 0.7) * r * (0.38 + i % 3 * 0.12) + (hover ? Math.sin(drift * 2) * r * 0.1 : 0);
    const y = Math.cos(drift * 0.55) * r * 0.42 + Math.sin(drift) * r * c.intensity * 0.18 - burst * r * 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(drift * 1.4) * c.articulation * 0.9 + (moving ? Math.atan2(0.3, 1) : 0));
    drawPetal(ctx, i % 2 ? c.bodyColor : c.accentColor, "#fff8fb", r * 0.36);
    dot(ctx, 0, r * 0.08, r * 0.045, c.detailColor);
    ctx.restore();
  }
};

const drawDandelion = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const seedCount = Math.round(c.segments);
  const detachLevel = hover ? 0.68 : click ? 0.92 : Math.max(0.22, moving * 0.42);
  stroke(ctx, c.detailColor, r * 0.055, () => { ctx.moveTo(0, r * 0.8); ctx.quadraticCurveTo(-r * 0.12, r * 0.15, 0, -r * 0.48); });
  for (const side of [-1, 1]) {
    path(ctx, c.detailColor, () => { ctx.moveTo(0, r * 0.48); ctx.quadraticCurveTo(side * r * 0.38, r * 0.2, side * r * 0.62, r * 0.42); ctx.quadraticCurveTo(side * r * 0.32, r * 0.5, 0, r * 0.48); });
    stroke(ctx, "#d8ead0", r * 0.018, () => { ctx.moveTo(0, r * 0.48); ctx.lineTo(side * r * 0.52, r * 0.38); });
  }
  for (let i = 0; i < seedCount; i++) {
    const angle = i * 2.399;
    const detached = ((t * 0.00012 * c.speed + i * 0.19) % 1) < detachLevel;
    const drift = detached ? t * 0.00045 * c.speed + i * 1.4 + (click ? 3 : 0) : 0;
    const distance = r * (detached ? 0.52 + ((drift * 0.18) % 0.7) : 0.43 + (i % 3) * 0.025);
    const x = Math.cos(angle + drift * c.articulation) * distance + (detached ? Math.sin(drift) * r * c.intensity * 0.14 : 0);
    const y = -r * 0.48 + Math.sin(angle + drift * c.articulation) * distance + (detached ? -Math.abs(Math.sin(drift)) * r * 0.15 : 0);
    stroke(ctx, c.bodyColor, r * 0.014, () => { ctx.moveTo(x, y + r * 0.07); ctx.lineTo(x + Math.cos(angle) * r * 0.09, y - r * 0.04); });
    for (let ray = 0; ray < 5; ray++) {
      const a = ray * TAU / 5 + drift * 0.2;
      stroke(ctx, c.bodyColor, r * 0.009, () => { ctx.moveTo(x + Math.cos(angle) * r * 0.08, y - r * 0.04); ctx.lineTo(x + Math.cos(angle) * r * (0.08 + Math.cos(a) * 0.045), y - r * 0.04 + Math.sin(a) * r * 0.045); });
    }
    dot(ctx, x + Math.cos(angle) * r * 0.08, y - r * 0.04, r * 0.018, c.bodyColor);
  }
  dot(ctx, 0, -r * 0.48, r * 0.075, c.accentColor);
};

const drawRosePetals = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const burst = click ? Math.sin(click * Math.PI) * c.intensity : 0;
  for (let i = 0; i < Math.round(c.segments); i++) {
    const phase = i * 2.399;
    const fall = t * 0.00045 * c.speed + phase;
    const depth = 0.3 + (i % 4) * 0.12;
    const x = Math.sin(fall * 0.65) * r * depth + Math.sin(phase) * burst * r * 0.52;
    const y = Math.cos(fall * 0.5) * r * 0.42 + Math.sin(fall * 1.5) * r * 0.13 - (hover ? c.intensity * r * 0.1 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(fall * c.articulation * (i % 2 ? 0.7 : -0.5) + burst);
    ctx.scale(0.75 + Math.abs(Math.sin(fall)) * 0.35, 0.7 + (i % 3) * 0.11);
    drawPetal(ctx, i % 3 === 0 ? c.accentColor : c.bodyColor, "#ffd3df", r * 0.4);
    stroke(ctx, c.detailColor, r * 0.014, () => { ctx.moveTo(0, r * 0.04); ctx.quadraticCurveTo(r * 0.03, r * 0.17, 0, r * 0.33); });
    ctx.restore();
  }
};

const drawSunflower = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const sway = Math.sin(t * 0.0014 * c.speed) * c.intensity * 0.18 + (hover ? c.articulation * 0.1 : 0) + (moving ? Math.atan2(0.25, 1) * c.articulation : 0);
  const bounce = click ? Math.sin(click * Math.PI) * c.intensity * 0.18 : 0;
  stroke(ctx, c.detailColor, r * 0.095, () => { ctx.moveTo(0, r * 0.8); ctx.quadraticCurveTo(-r * sway, r * 0.3, r * sway, -r * 0.42 + bounce * r); });
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.08, r * 0.34); ctx.rotate(side * (-0.55 + sway));
    path(ctx, c.detailColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.43, -r * 0.28, side * r * 0.62, 0); ctx.quadraticCurveTo(side * r * 0.3, r * 0.2, 0, 0); });
    stroke(ctx, "#b8dc8c", r * 0.025, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.3, -r * 0.07, side * r * 0.55, 0); }); ctx.restore();
  }
  ctx.save(); ctx.translate(r * sway, -r * 0.42 + bounce * r); ctx.rotate(sway * 0.5);
  const count = Math.round(c.segments);
  for (let i = 0; i < count; i++) {
    ctx.save(); ctx.rotate(i * TAU / count); ellipse(ctx, 0, -r * 0.38, r * 0.105, r * 0.27, c.bodyColor, "#c78021", r * 0.018); ctx.restore();
  }
  ellipse(ctx, 0, 0, r * 0.29, r * 0.29, c.accentColor, "#48331f", r * 0.04);
  for (let i = 0; i < 17; i++) {
    const a = i * 2.4; const d = r * (0.06 + (i % 4) * 0.045);
    dot(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.025, i % 2 ? "#9a6332" : "#3e2c1f");
  }
  ctx.restore();
};

const drawDaisy = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const sway = Math.sin(t * 0.0016 * c.speed) * c.intensity * 0.14;
  const spread = hover ? c.articulation * 0.11 : 0;
  stroke(ctx, c.detailColor, r * 0.08, () => { ctx.moveTo(0, r * 0.78); ctx.quadraticCurveTo(r * sway, 0, 0, -r * 0.24); });
  path(ctx, c.detailColor, () => { ctx.moveTo(0, r * 0.4); ctx.quadraticCurveTo(-r * 0.5, r * 0.15, -r * 0.58, r * 0.35); ctx.quadraticCurveTo(-r * 0.27, r * 0.48, 0, r * 0.4); });
  const count = Math.round(c.segments);
  ctx.save(); ctx.translate(r * sway, -r * 0.26); ctx.rotate(sway);
  for (let i = 0; i < count; i++) {
    ctx.save(); ctx.rotate(i * TAU / count);
    ctx.translate(0, -spread * r);
    ellipse(ctx, 0, -r * 0.27, r * 0.09, r * 0.25, c.bodyColor, "#d6cbbd", r * 0.018, spread);
    ctx.restore();
  }
  ellipse(ctx, 0, 0, r * 0.19, r * 0.19, c.accentColor, "#ba8728", r * 0.025);
  for (let i = 0; i < 9; i++) dot(ctx, Math.cos(i * TAU / 9) * r * 0.1, Math.sin(i * TAU / 9) * r * 0.1, r * 0.018, "#fff0a5");
  ctx.restore();
  if (click) { ctx.save(); ctx.translate(r * 0.65, -r * 0.3); ctx.scale(0.55, 0.55); ellipse(ctx, 0, 0, r * 0.17, r * 0.17, c.accentColor); for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*TAU/8);ellipse(ctx,0,-r*0.25,r*0.06,r*0.2,c.bodyColor);ctx.restore();}ctx.restore(); }
};

const drawLavender = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const count = Math.round(c.segments);
  for (let stem = 0; stem < count; stem++) {
    const x = (stem - (count - 1) / 2) * r * 0.18;
    const phase = stem * 1.7;
    const wind = Math.sin(t * 0.0011 * c.speed + phase) * c.intensity * 0.13 + (hover ? c.articulation * 0.08 : 0) + (moving ? 0.07 : 0);
    stroke(ctx, c.detailColor, r * 0.036, () => { ctx.moveTo(x, r * 0.75); ctx.quadraticCurveTo(x + wind * r, 0, x - wind * r, -r * 0.62); });
    for (let leaf = 0; leaf < 3; leaf++) {
      const yy = r * (0.38 - leaf * 0.24);
      for (const side of [-1, 1]) {
        stroke(ctx, c.detailColor, r * 0.025, () => { ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + side * r * 0.12, yy - r * 0.02, x + side * r * 0.22, yy - r * 0.14); });
      }
    }
    for (let bud = 0; bud < 5; bud++) {
      const yy = -r * (0.18 + bud * 0.105);
      ctx.save(); ctx.translate(x - wind * r * (0.4 + bud * 0.1), yy); ctx.rotate(wind * 0.6);
      ellipse(ctx, -r * 0.075, 0, r * 0.085, r * 0.105, bud % 2 ? c.accentColor : c.bodyColor, "#644886", r * 0.015, -0.45);
      ellipse(ctx, r * 0.075, 0, r * 0.085, r * 0.105, c.bodyColor, "#644886", r * 0.015, 0.45);
      ctx.restore();
    }
    if (click && stem % 2 === 0) { const burst = click * r * 0.55; dot(ctx, x + Math.sin(t * 0.01 + stem) * burst, -r * 0.55 - burst, r * 0.035, c.bodyColor); }
  }
};

const drawIvy = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const count = Math.round(c.segments);
  const curl = Math.sin(t * 0.001 * c.speed) * c.articulation * 0.12 + (click ? Math.sin(click * Math.PI) * c.intensity * 0.3 : 0);
  stroke(ctx, c.detailColor, r * 0.06, () => { ctx.moveTo(-r * 0.55, r * 0.68); ctx.bezierCurveTo(r * (0.45 + curl), r * 0.34, -r * (0.55 - curl), -r * 0.12, r * 0.42, -r * 0.72); });
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    const x = -r * 0.5 + u * r * 0.95 + Math.sin(u * Math.PI * 2) * r * 0.16;
    const y = r * 0.58 - u * r * 1.22;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(side * (0.45 + Math.sin(t * 0.0014 + i * 2) * c.intensity * 0.15 + (hover ? c.articulation * 0.12 : 0)));
      path(ctx, i % 2 ? c.bodyColor : c.accentColor, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(side * r * 0.08, -r * 0.26, side * r * 0.44, -r * 0.3, side * r * 0.4, -r * 0.04); ctx.quadraticCurveTo(side * r * 0.27, r * 0.1, 0, 0); }, "#28613f", r * 0.025);
      stroke(ctx, c.detailColor, r * 0.018, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.2, -r * 0.12, side * r * 0.37, -r * 0.07); });
      ctx.restore();
    }
  }
};

const drawFern = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const curl = Math.sin(t * 0.0013 * c.speed) * c.intensity * 0.12 + (click ? Math.sin(click * Math.PI) * c.articulation * 0.18 : 0);
  stroke(ctx, c.detailColor, r * 0.06, () => { ctx.moveTo(-r * curl, r * 0.72); ctx.quadraticCurveTo(r * (curl + (moving ? 0.15 : 0)), 0, r * (0.08 + curl), -r * 0.78); });
  const pairs = Math.round(c.segments);
  for (let i = 0; i < pairs; i++) {
    const u = (i + 1) / (pairs + 1);
    const y = r * 0.58 - u * r * 1.22;
    const stemX = r * curl * u;
    for (const side of [-1, 1]) {
      const angle = side * (0.4 + u * 0.35 + (hover ? c.articulation * 0.08 : 0) + Math.sin(t * 0.001 + i + side) * 0.04);
      ctx.save(); ctx.translate(stemX, y); ctx.rotate(angle);
      path(ctx, i % 2 ? c.bodyColor : c.accentColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.18, -r * 0.13, side * r * 0.34, -r * 0.06); ctx.quadraticCurveTo(side * r * 0.22, r * 0.03, 0, 0); }, c.detailColor, r * 0.018);
      stroke(ctx, "#b3d793", r * 0.012, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.28, -r * 0.06); });
      ctx.restore();
    }
  }
};

const drawMapleSeeds = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const count = Math.round(c.segments);
  for (let i = 0; i < count; i++) {
    const phase = i * 2.4 + t * 0.001 * c.speed * (0.5 + i % 3 * 0.25);
    const x = Math.cos(phase * 0.32 + i) * r * (0.3 + i % 3 * 0.13) + Math.sin(phase * 0.4) * r * c.intensity * 0.1;
    const y = Math.sin(phase * 0.25 + i * 2) * r * (0.4 + c.intensity * 0.05) + (moving ? -r * 0.08 : 0);
    ctx.save(); ctx.translate(x + (click ? Math.cos(i) * click * r * 0.45 : 0), y); ctx.rotate(phase * (0.35 + c.articulation * 0.4) + (hover ? phase * 0.2 : 0));
    for (const side of [-1, 1]) {
      ctx.save(); ctx.rotate(side * 0.18);
      path(ctx, side > 0 ? c.bodyColor : c.accentColor, () => { ctx.moveTo(0, 0); ctx.bezierCurveTo(side * r * 0.24, -r * 0.12, side * r * 0.43, -r * 0.5, side * r * 0.76, -r * 0.58); ctx.quadraticCurveTo(side * r * 0.48, -r * 0.08, 0, 0); }, c.detailColor, r * 0.025);
      stroke(ctx, "#f5d59a", r * 0.015, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(side * r * 0.38, -r * 0.2, side * r * 0.68, -r * 0.52); });
      ctx.restore();
    }
    ellipse(ctx, 0, 0, r * 0.11, r * 0.09, c.detailColor, "#634c32", r * 0.02);
    ctx.restore();
  }
};

const drawFairy = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const float = Math.sin(t * 0.0018 * c.speed) * c.intensity * r * 0.14;
  const flap = Math.sin(t * 0.012 * c.speed * (hover ? 1.8 : 1)) * c.articulation * 0.48;
  const spin = click ? Math.sin(click * Math.PI) * 0.6 : 0;
  ctx.save(); ctx.translate(Math.sin(t * 0.0008) * r * 0.1, float); ctx.rotate(spin);
  for (const side of [-1, 1]) for (let pair = 0; pair < 2; pair++) {
    ctx.save(); ctx.translate(side * r * 0.12, -r * 0.2 + pair * r * 0.25); ctx.rotate(side * (flap + (pair ? -0.4 : 0.35)));
    ellipse(ctx, side * r * (0.31 + pair * 0.06), -r * 0.06, r * 0.35, r * 0.16, c.accentColor, "#eaffff", r * 0.025, side * 0.25);
    stroke(ctx, "#ffffff", r * 0.012, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.55, -r * 0.08); });
    ctx.restore();
  }
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.17, r * 0.04); ctx.quadraticCurveTo(0, r * 0.18, r * 0.17, r * 0.04); ctx.lineTo(r * 0.13, r * 0.46); ctx.quadraticCurveTo(0, r * 0.58, -r * 0.13, r * 0.46); ctx.closePath(); }, c.detailColor, r * 0.025);
  ellipse(ctx, 0, -r * 0.16, r * 0.15, r * 0.16, "#f4d0ad");
  path(ctx, c.detailColor, () => { ctx.moveTo(-r * 0.2, -r * 0.19); ctx.lineTo(0, -r * 0.54); ctx.lineTo(r * 0.21, -r * 0.17); ctx.closePath(); });
  for (const side of [-1, 1]) dot(ctx, side * r * 0.055, -r * 0.17, r * 0.018, "#382b49");
  for (let i = 0; i < Math.round(c.segments); i++) {
    const a = t * 0.001 + i * 2.4;
    dot(ctx, Math.cos(a) * r * (0.57 + (i % 3) * 0.08), Math.sin(a * 1.3) * r * 0.53, r * 0.025 * (0.5 + Math.abs(Math.sin(a)) * c.intensity), c.detailColor);
  }
  ctx.restore();
};

const drawMagicWand = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const angle = Math.sin(t * 0.001 * c.speed) * c.articulation * 0.18 + (moving ? -Math.atan2(0.65, 1) * c.intensity : 0) + (click ? Math.sin(click * Math.PI) * 0.38 : 0);
  ctx.save(); ctx.rotate(angle);
  stroke(ctx, c.bodyColor, r * 0.13, () => { ctx.moveTo(-r * 0.5, r * 0.54); ctx.lineTo(r * 0.4, -r * 0.48); });
  stroke(ctx, "#f6dfb4", r * 0.035, () => { ctx.moveTo(-r * 0.39, r * 0.43); ctx.lineTo(r * 0.31, -r * 0.37); });
  const glow = (hover ? 0.55 : 0.13) + (click ? click * 0.5 : 0) + Math.abs(Math.sin(t * 0.002)) * c.intensity * 0.12;
  ctx.shadowColor = c.accentColor; ctx.shadowBlur = r * glow;
  dot(ctx, r * 0.42, -r * 0.5, r * (hover ? 0.075 : 0.035), "#fff5b0");
  for (let point = 0; point < 5; point++) {
    const a = -Math.PI / 2 + point * TAU / 5;
    const a2 = a + Math.PI / 5;
    const rad = point % 2 ? r * 0.18 : r * 0.34;
    if (point === 0) { path(ctx, c.accentColor, () => { for(let p=0;p<10;p++){const theta=-Math.PI/2+p*Math.PI/5;const rr=p%2?r*0.16:r*0.31;const x=r*0.42+Math.cos(theta)*rr;const y=-r*0.5+Math.sin(theta)*rr;if(p===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}, "#fff5b0", r*0.025); }
    else dot(ctx, r * 0.42 + Math.cos(a) * rad * 0.15, -r * 0.5 + Math.sin(a2) * rad * 0.15, r * 0.018, c.detailColor);
  }
  ctx.shadowBlur = 0;
  for (let i = 0; i < Math.round(c.segments); i++) {
    const phase = t * 0.0014 + i * 2.4;
    if (click || Math.sin(phase) > 0.72) dot(ctx, r * 0.42 + Math.cos(phase) * r * (0.42 + c.intensity * 0.1), -r * 0.5 + Math.sin(phase) * r * 0.4, r * 0.022, c.detailColor);
  }
  ctx.restore();
};

const drawWizard = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const bob = Math.sin(t * 0.0015 * c.speed) * c.intensity * r * 0.08;
  const hatTilt = Math.sin(t * 0.0012) * c.articulation * 0.12 + (hover ? -0.17 : 0);
  ctx.save(); ctx.translate(0, bob);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.39, r * 0.48); ctx.lineTo(-r * 0.28, -r * 0.04); ctx.lineTo(r * 0.3, -r * 0.04); ctx.lineTo(r * 0.42, r * 0.48); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.36, r * 0.16); ctx.lineTo(r * 0.36, r * 0.16); ctx.lineTo(r * 0.4, r * 0.49); ctx.lineTo(-r * 0.4, r * 0.49); ctx.closePath(); });
  ellipse(ctx, 0, -r * 0.2, r * 0.25, r * 0.28, "#f2c9a7", c.detailColor, r * 0.03);
  for(const side of [-1,1]) dot(ctx,side*r*0.09,-r*0.22,r*0.025,"#332943");
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.42, -r * 0.34); ctx.lineTo(-r * 0.08, -r * 0.96 + hatTilt * r); ctx.lineTo(r * 0.07, -r * 0.96 + hatTilt * r); ctx.lineTo(r * 0.42, -r * 0.34); ctx.closePath(); }, c.detailColor, r * 0.035);
  ellipse(ctx, 0, -r * 0.33, r * 0.45, r * 0.1, c.bodyColor, c.detailColor, r * 0.025);
  stroke(ctx, c.accentColor, r * 0.05, () => { ctx.moveTo(r * 0.27, r * 0.08); ctx.lineTo(r * 0.74, -r * 0.36); });
  dot(ctx, r * 0.74, -r * 0.36, r * 0.075, c.detailColor);
  if (click || hover) for (let i = 0; i < Math.round(c.segments); i++) {
    const a = t * 0.002 + i * TAU / c.segments;
    dot(ctx, r * 0.74 + Math.cos(a) * r * (0.16 + click * 0.24), -r * 0.36 + Math.sin(a) * r * 0.15, r * 0.025, c.detailColor);
  }
  ctx.restore();
};

const drawPotionBottle = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const slosh = Math.sin(t * 0.0014 * c.speed) * c.articulation * 0.15 + moving * c.intensity * 0.2 + (click ? Math.sin(click * 12) * 0.14 : 0);
  const angle = Math.sin(t * 0.001 * c.speed) * 0.06 + moving * 0.12 - hover * c.articulation * 0.06 + (click ? Math.sin(click * Math.PI) * 0.18 : 0);
  ctx.save(); ctx.rotate(angle);
  ctx.shadowColor = c.accentColor; ctx.shadowBlur = hover ? r * c.intensity * 0.35 : 0;
  path(ctx, "rgba(224,248,255,0.65)", () => { ctx.moveTo(-r * 0.18, -r * 0.72); ctx.lineTo(r * 0.18, -r * 0.72); ctx.lineTo(r * 0.18, -r * 0.42); ctx.quadraticCurveTo(r * 0.49, -r * 0.27, r * 0.5, r * 0.26); ctx.quadraticCurveTo(r * 0.48, r * 0.69, 0, r * 0.72); ctx.quadraticCurveTo(-r * 0.48, r * 0.69, -r * 0.5, r * 0.26); ctx.quadraticCurveTo(-r * 0.49, -r * 0.27, -r * 0.18, -r * 0.42); ctx.closePath(); }, "#c9f3f5", r * 0.05);
  ctx.shadowBlur = 0;
  ctx.save(); ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.13); ctx.lineTo(r * 0.42, r * 0.13); ctx.lineTo(r * 0.42, r * 0.53); ctx.quadraticCurveTo(0, r * 0.75, -r * 0.42, r * 0.53); ctx.closePath(); ctx.clip();
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.45, r * (0.29 + slosh)); ctx.quadraticCurveTo(0, r * (0.18 - slosh), r * 0.45, r * (0.29 + slosh)); ctx.lineTo(r * 0.45, r); ctx.lineTo(-r * 0.45, r); ctx.closePath(); });
  for (let i = 0; i < Math.round(c.segments); i++) {
    const phase = t * 0.001 * c.speed + i * 2.4;
    const x = Math.sin(phase * 1.3) * r * 0.24; const y = r * (0.5 - ((phase * 0.11 + i * 0.13) % 0.42));
    dot(ctx, x, y, r * (0.025 + c.intensity * 0.012), c.detailColor);
  }
  ctx.restore();
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.22, -r * 0.78); ctx.lineTo(r * 0.22, -r * 0.78); ctx.lineTo(r * 0.2, -r * 0.62); ctx.lineTo(-r * 0.2, -r * 0.62); ctx.closePath(); }, c.detailColor, r * 0.025);
  stroke(ctx, "#ffffff", r * 0.025, () => { ctx.moveTo(-r * 0.31, -r * 0.27); ctx.quadraticCurveTo(-r * 0.43, r * 0.04, -r * 0.33, r * 0.27); });
  ctx.restore();
};

const drawCrystal = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const angle = Math.sin(t * 0.0008 * c.speed) * c.articulation * 0.14 + (click ? Math.sin(click * Math.PI) * 0.12 : 0);
  const glow = c.intensity * (hover ? 0.45 : 0.18) + (click ? click * 0.4 : 0);
  ctx.save(); ctx.translate(0, Math.sin(t * 0.0015) * c.intensity * r * 0.08); ctx.rotate(angle);
  ctx.shadowColor = c.accentColor; ctx.shadowBlur = glow * r * 0.65;
  path(ctx, c.bodyColor, () => { ctx.moveTo(0, -r * 0.82); ctx.lineTo(r * 0.55, -r * 0.2); ctx.lineTo(r * 0.42, r * 0.54); ctx.lineTo(0, r * 0.78); ctx.lineTo(-r * 0.42, r * 0.54); ctx.lineTo(-r * 0.55, -r * 0.2); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.accentColor, () => { ctx.moveTo(0, -r * 0.82); ctx.lineTo(0, r * 0.78); ctx.lineTo(-r * 0.42, r * 0.54); ctx.lineTo(-r * 0.55, -r * 0.2); ctx.closePath(); });
  path(ctx, c.detailColor, () => { ctx.moveTo(0, -r * 0.82); ctx.lineTo(r * 0.55, -r * 0.2); ctx.lineTo(0, r * 0.78); ctx.closePath(); });
  stroke(ctx, "#ffffff", r * 0.025, () => { ctx.moveTo(-r * 0.34, -r * 0.19); ctx.lineTo(0, -r * 0.63); ctx.lineTo(r * 0.32, -r * 0.2); });
  ctx.shadowBlur = 0;
  for (let i = 0; i < Math.round(c.segments); i++) {
    const a = i * TAU / c.segments + t * 0.00035;
    dot(ctx, Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.38, r * 0.018, c.detailColor);
  }
  ctx.restore();
};

const drawEnchantedMushroom = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const bounce = Math.abs(Math.sin(t * 0.002 * c.speed)) * c.intensity * r * 0.08 + (click ? Math.sin(click * Math.PI) * r * 0.2 : 0);
  const glow = (hover ? 0.5 : 0.18) + c.intensity * Math.abs(Math.sin(t * 0.0015));
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.25, r * 0.55 - bounce); ctx.lineTo(-r * 0.18, -r * 0.08 - bounce); ctx.quadraticCurveTo(0, -r * 0.22 - bounce, r * 0.18, -r * 0.08 - bounce); ctx.lineTo(r * 0.27, r * 0.55 - bounce); ctx.closePath(); }, c.detailColor, r * 0.035);
  ctx.shadowColor = c.detailColor; ctx.shadowBlur = glow * r * 0.6;
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.72, -r * 0.08 - bounce); ctx.quadraticCurveTo(-r * 0.53, -r * 0.72 - bounce, 0, -r * 0.64 - bounce); ctx.quadraticCurveTo(r * 0.61, -r * 0.72 - bounce, r * 0.72, -r * 0.08 - bounce); ctx.quadraticCurveTo(0, r * 0.2 - bounce, -r * 0.72, -r * 0.08 - bounce); ctx.closePath(); }, "#713d56", r * 0.045);
  ctx.shadowBlur = 0;
  for (let i = 0; i < Math.round(c.segments); i++) {
    const x = ((i * 0.37) % 1 - 0.5) * r * 1.05;
    const y = -r * (0.24 + (i % 3) * 0.1) - bounce;
    dot(ctx, x, y, r * (0.035 + (hover ? 0.012 : 0)), c.accentColor);
    if (t > i * 700 || click || hover) {
      const a = t * 0.001 + i * 2.4;
      dot(ctx, Math.sin(a) * r * 0.36, -r * 0.72 - ((t * 0.00022 + i * 0.17) % 0.42) * r * c.articulation, r * 0.02, c.detailColor);
    }
  }
  stroke(ctx, "#f0d7d0", r * 0.018, () => { ctx.moveTo(-r * 0.56, r * 0.01); ctx.quadraticCurveTo(0, r * 0.3, r * 0.56, r * 0.01); });
};

const drawSpellbook = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const open = 0.12 + Math.max(hover * 0.24, click ? Math.sin(click * Math.PI) * 0.5 : 0) + Math.abs(Math.sin(t * 0.001 * c.speed)) * c.articulation * 0.08;
  ctx.save(); ctx.translate(0, Math.sin(t * 0.0013) * c.intensity * r * 0.06);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.66, -r * 0.45); ctx.quadraticCurveTo(-r * 0.35, -r * 0.55, 0, -r * 0.31); ctx.quadraticCurveTo(r * 0.34, -r * 0.54, r * 0.66, -r * 0.43); ctx.lineTo(r * 0.62, r * 0.53); ctx.quadraticCurveTo(r * 0.3, r * 0.44, 0, r * 0.63); ctx.quadraticCurveTo(-r * 0.32, r * 0.43, -r * 0.62, r * 0.56); ctx.closePath(); }, c.detailColor, r * 0.04);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.56, -r * 0.35); ctx.quadraticCurveTo(-r * 0.27, -r * 0.42, -r * 0.05, -r * 0.27); ctx.lineTo(-r * 0.05, r * 0.48); ctx.quadraticCurveTo(-r * 0.31, r * 0.34, -r * 0.55, r * 0.43); ctx.closePath(); }, "#fff1d2", r * 0.018);
  path(ctx, c.accentColor, () => { ctx.moveTo(r * 0.56, -r * 0.35); ctx.quadraticCurveTo(r * 0.27, -r * 0.42, r * 0.05, -r * 0.27); ctx.lineTo(r * 0.05, r * 0.48); ctx.quadraticCurveTo(r * 0.31, r * 0.34, r * 0.55, r * 0.43); ctx.closePath(); }, "#fff1d2", r * 0.018);
  stroke(ctx, c.detailColor, r * 0.03, () => { ctx.moveTo(0, -r * 0.28); ctx.lineTo(0, r * 0.55); });
  ctx.save(); ctx.translate(0, -r * 0.02); ctx.rotate(Math.sin(t * 0.002) * open);
  path(ctx, c.bodyColor, () => { ctx.moveTo(0, -r * 0.31); ctx.lineTo(r * 0.09, -r * 0.08); ctx.lineTo(r * 0.32, -r * 0.05); ctx.lineTo(r * 0.14, r * 0.1); ctx.lineTo(r * 0.2, r * 0.31); ctx.lineTo(0, r * 0.18); ctx.lineTo(-r * 0.2, r * 0.31); ctx.lineTo(-r * 0.14, r * 0.1); ctx.lineTo(-r * 0.32, -r * 0.05); ctx.lineTo(-r * 0.09, -r * 0.08); ctx.closePath(); }, c.detailColor, r * 0.025);
  ctx.restore();
  if (hover || click) for(let i=0;i<Math.round(c.segments);i++){const a=t*0.001+i*2.4;dot(ctx,Math.cos(a)*r*(0.62+i%2*.1),Math.sin(a)*r*.58,r*.02,c.detailColor);}
  ctx.restore();
};

const drawUnicorn = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const bob = Math.sin(t * 0.0016 * c.speed) * c.intensity * r * 0.09 + (click ? Math.sin(click * Math.PI) * r * 0.17 : 0);
  const mane = Math.sin(t * 0.002 * c.speed) * c.articulation * r * 0.08;
  ctx.save(); ctx.translate(0, bob);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.55, r * 0.38); ctx.quadraticCurveTo(-r * 0.63, -r * 0.48, -r * 0.07, -r * 0.57); ctx.quadraticCurveTo(r * 0.5, -r * 0.5, r * 0.52, r * 0.12); ctx.quadraticCurveTo(r * 0.3, r * 0.57, -r * 0.55, r * 0.38); ctx.closePath(); }, c.detailColor, r * 0.035);
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.31, -r * 0.48); ctx.lineTo(-r * 0.42, -r * 0.86); ctx.lineTo(-r * 0.12, -r * 0.58); ctx.closePath(); }, c.detailColor, r * 0.025);
  path(ctx, c.bodyColor, () => { ctx.moveTo(r * 0.1, -r * 0.53); ctx.lineTo(r * 0.2, -r * 0.87); ctx.lineTo(r * 0.39, -r * 0.45); ctx.closePath(); }, c.detailColor, r * 0.025);
  path(ctx, c.accentColor, () => { ctx.moveTo(-r * 0.02, -r * 0.55); ctx.lineTo(r * 0.1, -r * 1.02); ctx.lineTo(r * 0.3, -r * 0.52); ctx.closePath(); }, c.detailColor, r * 0.025);
  stroke(ctx, "#fff3c7", r * 0.018, () => { ctx.moveTo(r * 0.03, -r * 0.62); ctx.lineTo(r * 0.23, -r * 0.62); ctx.moveTo(r * 0.07, -r * 0.76); ctx.lineTo(r * 0.2, -r * 0.76); });
  const lockCount = Math.round(c.segments);
  for (let i = 0; i < lockCount; i++) {
    const u = i / Math.max(1, lockCount - 1);
    const y = -r * 0.43 + u * r * 0.77;
    const lockWobble = mane * (0.5 + u) + Math.sin(t * 0.002 + i * 0.9) * c.articulation * r * 0.035;
    path(ctx, hover ? c.accentColor : i % 2 ? c.detailColor : c.accentColor, () => {
      ctx.moveTo(-r * 0.38, y);
      ctx.quadraticCurveTo(-r * 0.65 + lockWobble, y + r * 0.12, -r * (0.74 + u * 0.08) + lockWobble, y + r * 0.2);
      ctx.quadraticCurveTo(-r * 0.54, y + r * 0.27, -r * 0.3, y + r * 0.14);
      ctx.closePath();
    });
  }
  dot(ctx, r * 0.29, -r * 0.19, r * 0.04, "#332a46");
  path(ctx, "#edb6c3", () => { ctx.moveTo(r * 0.36, r * 0.1); ctx.quadraticCurveTo(r * 0.73, r * 0.12, r * 0.56, r * 0.34); ctx.quadraticCurveTo(r * 0.41, r * 0.31, r * 0.36, r * 0.1); });
  for (let i = 0; i < 3; i++) { const a = t * 0.001 + i * 2.4; if (hover || click) dot(ctx, r * 0.1 + Math.cos(a) * r * 0.55, -r * 0.75 + Math.sin(a) * r * 0.2, r * 0.022, c.bodyColor); }
  ctx.restore();
};

const drawBabyDragon = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const flap = Math.sin(t * 0.01 * c.speed * (hover ? 1.5 : 1)) * c.articulation * 0.55;
  const wag = Math.sin(t * 0.002 * c.speed) * c.intensity * 0.22 + (click ? Math.sin(click * Math.PI) * 0.3 : 0);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(side * r * 0.16, -r * 0.16); ctx.rotate(side * (flap + 0.12));
    path(ctx, c.accentColor, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.38, -r * 0.48); ctx.lineTo(side * r * 0.35, -r * 0.12); ctx.lineTo(side * r * 0.56, -r * 0.25); ctx.lineTo(side * r * 0.43, r * 0.14); ctx.closePath(); }, c.detailColor, r * 0.035);
    stroke(ctx, c.detailColor, r * 0.02, () => { ctx.moveTo(0, 0); ctx.lineTo(side * r * 0.37, -r * 0.12); ctx.lineTo(side * r * 0.38, -r * 0.43); });
    ctx.restore();
  }
  path(ctx, c.bodyColor, () => { ctx.moveTo(-r * 0.42, r * 0.34); ctx.quadraticCurveTo(-r * 0.56, -r * 0.26, -r * 0.15, -r * 0.48); ctx.quadraticCurveTo(r * 0.4, -r * 0.5, r * 0.47, 0); ctx.quadraticCurveTo(r * 0.4, r * 0.46, -r * 0.42, r * 0.34); ctx.closePath(); }, c.detailColor, r * 0.035);
  for (let horn = 0; horn < 2; horn++) path(ctx, c.detailColor, () => { const x = r * (-0.24 + horn * 0.38); ctx.moveTo(x - r * 0.08, -r * 0.38); ctx.lineTo(x, -r * 0.68); ctx.lineTo(x + r * 0.1, -r * 0.36); ctx.closePath(); });
  ellipse(ctx, r * 0.23, -r * 0.13, r * 0.055, r * 0.07, "#fff");
  dot(ctx, r * 0.25, -r * 0.13, r * 0.03, "#26333c");
  ellipse(ctx, r * 0.42, r * 0.08, r * 0.1, r * 0.055, c.accentColor);
  ctx.save(); ctx.translate(-r * 0.37, r * 0.12); ctx.rotate(wag);
  path(ctx, c.bodyColor, () => { ctx.moveTo(0, 0); ctx.quadraticCurveTo(-r * 0.38, r * 0.13, -r * 0.74, -r * 0.06); ctx.quadraticCurveTo(-r * 0.46, r * 0.37, 0, r * 0.1); ctx.closePath(); }, c.detailColor, r * 0.025); ctx.restore();
  for (const side of [-1, 1]) stroke(ctx, c.detailColor, r * 0.055, () => { ctx.moveTo(side * r * 0.22, r * 0.28); ctx.lineTo(side * r * 0.3, r * 0.52); });
  for (let i = 0; i < Math.round(c.segments); i++) {
    const u = i / Math.max(1, c.segments - 1);
    const x = -r * 0.2 + u * r * 0.52;
    const y = -r * 0.32 + (i % 2) * r * 0.13;
    dot(ctx, x, y, r * 0.035, c.accentColor);
  }
  if (click) for (let i = 0; i < 4; i++) dot(ctx, r * 0.55 + i * r * 0.045, -r * 0.04 - Math.sin(t * 0.01 + i) * r * 0.06, r * 0.035, c.accentColor);
};

const drawTinyGhost = (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, t: number, moving: number, hover: number, click: number) => {
  const float = Math.sin(t * 0.0015 * c.speed) * c.intensity * r * 0.12;
  const compress = click ? Math.sin(click * Math.PI) * 0.25 : 0;
  const wave = Math.sin(t * 0.0025 * c.speed) * c.articulation;
  ctx.save(); ctx.translate(0, float); ctx.rotate(moving ? Math.atan2(0.35, 1) * 0.16 : 0);
  ctx.scale(1 + compress * 0.12, 1 - compress * 0.14);
  path(ctx, c.bodyColor, () => {
    ctx.moveTo(-r * 0.48, r * 0.54);
    ctx.bezierCurveTo(-r * 0.68, r * 0.08, -r * 0.53, -r * 0.7, 0, -r * 0.72);
    ctx.bezierCurveTo(r * 0.55, -r * 0.7, r * 0.68, r * 0.08, r * 0.48, r * 0.54);
    for (let i = 0; i < Math.round(c.segments); i++) {
      const x = r * (0.48 - i * 0.96 / Math.max(1, c.segments - 1));
      const y = r * (0.54 + Math.sin(t * 0.002 + i * 1.6) * 0.06 * wave);
      ctx.quadraticCurveTo(x - r * 0.05, y + r * (0.06 + Math.abs(wave) * 0.08), x - r * 0.1, r * 0.54);
    }
    ctx.closePath();
  }, c.detailColor, r * 0.035);
  const eyeY = -r * 0.12;
  for (const side of [-1, 1]) {
    ellipse(ctx, side * r * 0.18, eyeY, r * 0.075, r * (hover ? 0.105 : 0.085), c.accentColor);
    dot(ctx, side * r * 0.19, eyeY, r * 0.035, "#ffffff");
  }
  stroke(ctx, c.accentColor, r * 0.025, () => { ctx.moveTo(-r * 0.08, r * 0.14); ctx.quadraticCurveTo(0, r * (0.22 + compress * 0.2), r * 0.09, r * 0.14); });
  if (c.intensity > 0) for(let i=0;i<3;i++){const a=t*.001+i*2.1;dot(ctx,-r*.58+Math.sin(a)*r*.1,r*.14+Math.cos(a)*r*.28,r*.018*c.intensity,c.detailColor);}
  ctx.restore();
};

const drawCreature: Partial<Record<CreatureCursorId, (ctx: CanvasRenderingContext2D, r: number, c: CreatureCursorSettings, time: number, moving: number, hover: number, click: number) => void>> = {
  "tiny-cat": drawTinyCat,
  bunny: drawBunny,
  duckling: drawDuckling,
  "panda-cub": drawPanda,
  "baby-fox": drawFox,
  penguin: drawPenguin,
  hamster: drawHamster,
  hedgehog: drawHedgehog,
  "baby-frog": drawFrog,
  "little-turtle": drawTurtle,
  "monarch-butterfly": drawButterfly,
  "pink-butterfly": (ctx, r, c, t, moving, hover, click) => drawButterfly(ctx, r, c, t, moving, hover, click, true),
  ladybug: drawLadybug,
  dragonfly: drawDragonfly,
  honeybee: drawBee,
  firefly: drawFirefly,
  moth: drawMoth,
  caterpillar: drawCaterpillar,
  snail: drawSnail,
  "praying-mantis": drawMantis,
  "autumn-leaves": drawAutumnLeaves,
  "cherry-blossom": drawCherryBlossom,
  dandelion: drawDandelion,
  "rose-petals": drawRosePetals,
  sunflower: drawSunflower,
  daisy: drawDaisy,
  lavender: drawLavender,
  "ivy-vine": drawIvy,
  fern: drawFern,
  "maple-seeds": drawMapleSeeds,
  fairy: drawFairy,
  "magic-wand": drawMagicWand,
  wizard: drawWizard,
  "potion-bottle": drawPotionBottle,
  crystal: drawCrystal,
  "enchanted-mushroom": drawEnchantedMushroom,
  spellbook: drawSpellbook,
  unicorn: drawUnicorn,
  "baby-dragon": drawBabyDragon,
  "tiny-ghost": drawTinyGhost,
};

export function isCreatureCursor(id: string): id is CreatureCursorId {
  return (CREATURE_CURSOR_IDS as readonly string[]).includes(id);
}

export function getCreatureSettingsLabels(id: CreatureCursorId) {
  return animalSettings[id];
}

function renderCreature(frame: CursorRendererFrame, settings: CreatureCursorSettings): void {
  const { context: ctx, config, time, hovered, interaction, motion } = frame;
  const reducedMotion = frame.reducedMotion === true;
  const t = reducedMotion ? 0 : time * settings.speed;
  const moving = reducedMotion ? 0 : Math.min(1, motion.speed * 90);
  const hover = hovered && settings.hoverEnabled && !reducedMotion ? 1 : 0;
  const age = time - interaction.lastClickAt;
  const click = !reducedMotion && settings.clickEnabled && age >= 0 && age < 720 ? 1 - age / 720 : 0;
  const r = config.size * 0.43;

  ctx.save();
  ctx.translate(frame.x, frame.y);
  if (!reducedMotion && moving > 0.02) {
    ctx.rotate(Math.atan2(motion.directionY, motion.directionX) * Math.min(0.24, moving * 0.12) * settings.intensity);
  }
  if (config.cursor === "firefly") {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
  if (config.cursor === "monarch-butterfly" || config.cursor === "pink-butterfly" || config.cursor === "moth" || config.cursor === "dragonfly" || config.cursor === "honeybee" || config.cursor === "firefly") {
    const drifting = Math.sin(t * 0.0015) * settings.intensity * r * 0.09;
    ctx.translate(Math.cos(t * 0.0011) * drifting, Math.sin(t * 0.0022) * drifting);
  }
  drawCreature[config.cursor as CreatureCursorId]?.(ctx, r, settings, t, moving, hover, click);
  ctx.restore();
}

for (const id of CREATURE_CURSOR_IDS) {
  registerCursorRenderer(id, (frame) => renderCreature(frame, frame.config.creatures[id]), true);
}
