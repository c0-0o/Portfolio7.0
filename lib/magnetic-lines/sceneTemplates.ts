import type {
  FlowConfig,
  GlobalSettings,
  MagneticLineConfig,
  MagneticLinesSceneConfig,
  Point,
  TextureType,
} from "./types";
import { DEFAULT_FLOW, DEFAULT_SCENE } from "./defaultScene";
import { makeBlankLine, sanitizeSceneConfig } from "./sceneValidation";
import { getHeartbeatCycles } from "./engine/flowEngine";

export const SCENE_TEMPLATE_CATEGORIES = [
  "Organic & Nature",
  "Atmospheric & Floating",
  "Electric & Energy",
  "Networks & Connections",
  "Liquid & Fluid",
  "Geometric & Structural",
  "Light & Optical",
  "Experimental & Abstract",
] as const;

export type SceneTemplateCategory = typeof SCENE_TEMPLATE_CATEGORIES[number];

export interface SceneTemplateDefinition {
  id: string;
  name: string;
  category: SceneTemplateCategory;
  summary: string;
  description: string;
  version: number;
  tags: string[];
  config: MagneticLinesSceneConfig;
}

interface TemplateLineSpec {
  paths: string;
  targetId?: string;
  color?: number;
  width?: number;
  opacity?: number;
  z?: number;
  motion?: "tension" | "floating" | "vibration";
  speed?: number;
  amplitude?: number;
  phase?: number;
  delay?: number;
  bendable?: boolean;
  texture?: TextureType;
  textureScale?: number;
  textureIntensity?: number;
  textureWeight?: number;
  silkStrands?: number;
  curveSmoothing?: number;
  node?: boolean;
  flow?: FlowConfig["effectType"];
  flowSpeed?: number;
  flowPhase?: number;
  flowStreamCount?: number;
  flowIntensity?: number;
  flowWidth?: number;
  flowCoreWidth?: number;
  flowGlowWidth?: number;
  flowOpacity?: number;
  flowPulseWidth?: number;
  flowTailLength?: number;
  flowGlow?: boolean;
  flowCoreColor?: string;
  flowGlowColor?: string;
  flowDirection?: FlowConfig["direction"];
  cursor?: "attract" | "repel";
  cursorRadius?: number;
  cursorStrength?: number;
  cursorMaxDeformation?: number;
  cursorSmoothing?: number;
  magnet?: boolean;
  gravity?: number;
  airflow?: boolean;
  glow?: number;
}

interface SceneTemplateSpec {
  id: string;
  name: string;
  category: SceneTemplateCategory;
  summary: string;
  description: string;
  palette: string[];
  lines: TemplateLineSpec[];
  wind?: string[];
  ambientAirflow?: boolean;
  windBehavior?: GlobalSettings["environment"]["airflowBehavior"];
  windSpeed?: number;
  windStrength?: number;
  windRadius?: number;
  windRadii?: number[];
  flowCurrentLayer?: boolean;
  flowPulseAllLines?: boolean;
  targets?: MagneticLinesSceneConfig["targets"];
  light?: { color: string; from: Point; to: Point; radius: number; intensity: number; speed: number };
}

function parsePath(value: string): Point[] {
  return value.split("|").flatMap((stroke) => stroke.trim().split(/\s+/).filter(Boolean).map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x: x / 100, y: y / 100 };
  }));
}

function makeLine(
  templateId: string,
  spec: TemplateLineSpec,
  index: number,
  palette: string[],
  hasWind: boolean,
  hasLight: boolean,
  flowCurrentLayer = true,
): MagneticLineConfig {
  const line = makeBlankLine();
  const id = spec.node
    ? `${templateId}-node-${String(index + 1).padStart(2, "0")}`
    : `${templateId}-line-${String(index + 1).padStart(2, "0")}`;
  const points = parsePath(spec.paths);
  const first = points[0] ?? { x: 0.1, y: 0.5 };
  const last = points[points.length - 1] ?? first;
  const color = palette[spec.color ?? index % palette.length];
  const flowing = !!spec.flow;
  const textured = !!spec.texture;
  const windEnabled = hasWind && spec.airflow !== false;
  const flow: FlowConfig = {
    ...DEFAULT_FLOW,
    enabled: flowing,
    effectType: spec.flow ?? DEFAULT_FLOW.effectType,
    preset: null,
    speed: spec.flowSpeed ?? 0.34,
    direction: spec.flowDirection ?? "forward",
    intensity: spec.flowIntensity ?? (spec.flow === "plasma" ? 0.5 : 0.72),
    width: spec.flowWidth ?? (spec.flow === "plasma" ? 1.6 : 1.4),
    coreWidth: spec.flowCoreWidth ?? 0.55,
    glowWidth: spec.flowGlowWidth ?? (spec.flow === "plasma" ? 4 : 3.5),
    opacity: spec.flowOpacity ?? 0.72,
    colors: [color, palette[(spec.color ?? index) + 1] ?? color],
    coreColor: spec.flowCoreColor ?? "#ffffff",
    glowColor: spec.flowGlowColor ?? palette[(spec.color ?? index) + 1] ?? color,
    streamCount: spec.flowStreamCount ?? 1,
    phase: spec.flowPhase ?? index * 0.61,
    layers: {
      current: flowCurrentLayer,
      core: true,
      secondary: false,
      glow: spec.flowGlow ?? true,
      branches: spec.flow === "electric-current",
      sparks: spec.flow === "electric-current",
    },
    branchFrequency: 0.28,
    branchLength: 0.06,
    sparkDensity: 0.24,
    flicker: spec.flow === "plasma" ? 0.24 : 0.12,
    turbulence: spec.flow === "plasma" ? 0.32 : 0.12,
    strandCount: 3,
    pulseWidth: spec.flowPulseWidth ?? 0.12,
    tailLength: spec.flowTailLength ?? 0.2,
  };

  return {
    ...line,
    id,
    enabled: true,
    visible: true,
    from: first,
    to: last,
    geometrySource: "path",
    customPath: {
      points: points.map((point, pointIndex) => ({
        id: `${id}-point-${pointIndex + 1}`,
        ...point,
        ...(pointIndex > 0 && spec.paths.split("|").length > 1 && isStrokeStart(spec.paths, pointIndex) ? { moveTo: true } : {}),
      })),
      curveSmoothing: spec.curveSmoothing ?? 0,
      closedJoint: "connected",
    },
    appearance: {
      ...line.appearance,
      color,
      colorStyle: { type: "solid", colors: [color, color] },
      opacity: spec.opacity ?? 0.52,
      width: spec.width ?? 1,
      zIndex: spec.z ?? index,
    },
    shape: {
      ...line.shape,
      type: spec.motion === "vibration" ? "vibration" : spec.motion === "floating" ? "floating" : "organic",
      bendable: spec.bendable !== false,
      amplitude: spec.amplitude ?? 0.008,
      frequency: 2.4,
      cycles: 1.1,
      smoothness: 0.92,
      irregularity: 0.24,
      distortion: 0.15,
      roughness: 0.12,
    },
    motion: {
      ...line.motion,
      enabled: spec.bendable !== false,
      type: spec.motion ?? "floating",
      speed: spec.speed ?? 0.12,
      amplitude: spec.amplitude ?? 0.008,
      frequency: 0.8 + (index % 4) * 0.16,
      phase: spec.phase ?? index * 1.37,
      deformability: spec.bendable === false ? 0 : 0.58,
    },
    startDelay: spec.delay ?? index * 0.37,
    magnet: { ...line.magnet, enabled: spec.magnet === true || !!spec.targetId, targetId: spec.targetId ?? null, strength: 34, radius: 0.12, maxDeformation: 0.035 },
    glow: {
      ...line.glow,
      enabled: (spec.glow ?? 0) > 0,
      color,
      intensity: (spec.glow ?? 0) * 100,
      opacity: 65,
      radius: 0.12,
      length: 18,
      falloff: 70,
    },
    outerGlow: { ...line.outerGlow, enabled: false, intensity: 0 },
    cursorGlow: { enabled: (spec.glow ?? 0) > 0 },
    texture: {
      ...line.texture,
      enabled: textured,
      type: spec.texture ?? "grain",
      scale: spec.textureScale ?? 0.018,
      intensity: textured ? spec.textureIntensity ?? (spec.texture === "silk" ? 0.72 : 0.28) : 0,
      weight: spec.textureWeight ?? (spec.texture === "silk" ? 0.55 : spec.texture === "rope" ? 1.2 : spec.texture === "metal" ? 2 : 1),
      silkStrands: spec.silkStrands ?? (spec.texture === "silk" ? 5 : 8),
      showThread: true,
    },
    flow,
    environmentEnabled: windEnabled,
    environment: {
      ...line.environment,
      airflowMode: windEnabled ? "global" : "off",
      lightMode: hasLight ? "global" : "off",
    },
    cursorInfluence: {
      ...line.cursorInfluence,
      enabled: !!spec.cursor && spec.bendable !== false,
      strength: spec.cursorStrength ?? 0.38,
      radius: spec.cursorRadius ?? 0.16,
      falloff: 0.65,
      maxDeformation: spec.cursorMaxDeformation ?? 0.045,
      profile: "soft",
      smoothing: spec.cursorSmoothing ?? 0.28,
      mode: spec.cursor ?? "attract",
    },
    gravity: {
      ...line.gravity,
      enabled: (spec.gravity ?? 0) > 0 && spec.bendable !== false,
      strength: spec.gravity ?? 0.3,
      fixedPointIds: ["start", "end"],
    },
    occlusion: { enabled: true, gapWidth: 1.5 },
    inherit: {
      ...line.inherit,
      appearance: false,
      shape: false,
      motion: false,
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
  };
}

function isStrokeStart(path: string, flattenedIndex: number): boolean {
  let count = 0;
  for (const stroke of path.split("|")) {
    const points = stroke.trim().split(/\s+/).filter(Boolean);
    if (count === flattenedIndex) return true;
    count += points.length;
  }
  return false;
}

function makeSpiderWebLines(): TemplateLineSpec[] {
  const center = { x: 54, y: 44 };
  const radiusX = 39;
  const radiusY = 37;
  const spokeCount = 18;
  const extendedSpokes = new Set([0, 2, 5, 7, 10, 12, 15, 17]);
  const lines: TemplateLineSpec[] = [];

  for (let spoke = 0; spoke < spokeCount; spoke += 1) {
    const angle = -Math.PI / 2 + (spoke / spokeCount) * Math.PI * 2 +
      Math.sin(spoke * 2.17) * 0.11;
    const reach = 0.84 + Math.sin(spoke * 1.83) * 0.13 + Math.cos(spoke * 2.61) * 0.075;
    const endReach = Math.min(1.16, reach + (extendedSpokes.has(spoke) ? 0.18 + (spoke % 3) * 0.025 : 0));
    const bend = 1.1 + (spoke % 4) * 0.3;
    const points = Array.from({ length: 6 }, (_, index) => {
      const progress = index / 5;
      const distance = 1.2 + (endReach * 37 - 1.2) * progress;
      const curve = Math.sin(progress * Math.PI * 1.35 + spoke * 0.71) * bend * progress;
      return {
        x: center.x + Math.cos(angle) * distance * radiusX / 37 - Math.sin(angle) * curve,
        y: center.y + Math.sin(angle) * distance * radiusY / 37 * 0.95 + Math.cos(angle) * curve,
      };
    });

    lines.push({
      paths: points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
      color: spoke % 5 === 0 ? 2 : spoke % 3 === 0 ? 4 : 0,
      width: spoke % 3 === 0 ? 0.95 : 0.82,
      opacity: spoke % 4 === 0 ? 0.78 : 0.7,
      motion: "tension",
      speed: 0.035 + (spoke % 4) * 0.004,
      amplitude: 0.0015,
      phase: spoke * 0.73,
      airflow: true,
      cursor: "attract",
      cursorRadius: 0.14,
      cursorStrength: 0.12,
      cursorMaxDeformation: 0.008,
      cursorSmoothing: 0.58,
      z: 3 + (spoke % 4),
    });
  }

  const spiralSamples = 252;
  const spiralTurns = 7.5;
  const spiralSamplesWithGaps = Array.from({ length: spiralSamples + 1 }, (_, index) => {
    const progress = index / spiralSamples;
    const turnPosition = progress * spiralTurns;
    const turnIndex = Math.floor(turnPosition);
    const positionInTurn = turnPosition - turnIndex;
    const gapStart = 0.18 + ((Math.sin(turnIndex * 1.83) + 1) / 2) * 0.25;
    const angle = -Math.PI / 2 + progress * Math.PI * 2 * spiralTurns +
      Math.sin(progress * Math.PI * 3.2) * 0.13 +
      Math.sin(progress * Math.PI * 7) * 0.055;
    const radius = 2.2 + Math.pow(progress, 1.13) * 31 +
      Math.sin(angle * 0.37 + 0.4) * 1.6 +
      Math.sin(angle * 0.91 + 1.2) * 0.65 +
      Math.sin(progress * Math.PI * 6 + 0.7) * progress * 0.9;
    return {
      x: center.x + Math.cos(angle) * radius * radiusX / 37,
      y: center.y + Math.sin(angle) * radius * radiusY / 37 * 0.95,
      skip: positionInTurn >= gapStart && positionInTurn < gapStart + 0.075,
    };
  });
  const spiralPoints = spiralSamplesWithGaps.flatMap((point, index) => {
    if (point.skip) return [];
    return [{
      x: point.x,
      y: point.y,
      moveTo: index === 0 || spiralSamplesWithGaps[index - 1].skip,
    }];
  });
  lines.push({
    paths: spiralPoints.map(({ x, y, moveTo }, index) =>
      `${moveTo && index > 0 ? "| " : ""}${x.toFixed(2)},${y.toFixed(2)}`).join(" "),
    color: 1,
    width: 0.72,
    opacity: 0.67,
    motion: "tension",
    speed: 0.03,
    amplitude: 0.001,
    phase: 1.6,
    airflow: true,
    cursor: "attract",
    cursorRadius: 0.14,
    cursorStrength: 0.1,
    cursorMaxDeformation: 0.007,
    cursorSmoothing: 0.6,
    z: 2,
  });

  lines.push({
    paths: "52.8,43.6 53.8,42.7 55.1,43.2 55.6,44.3|53.1,45.1 54.2,44.2 55.3,44.7",
    color: 4,
    width: 0.82,
    opacity: 0.72,
    bendable: false,
    z: 8,
  });

  return lines;
}

function buildTemplate(spec: SceneTemplateSpec): SceneTemplateDefinition {
  const base = structuredClone(DEFAULT_SCENE);
  const windPaths = (spec.wind ?? []).map(parsePath);
  const hasWind = windPaths.length > 0 || spec.ambientAirflow === true;
  const environment = {
    ...base.global.environment,
    enabled: hasWind || !!spec.light,
    airflowEnabled: hasWind,
    airflowBehavior: spec.windBehavior ?? "random",
    airflowPath: windPaths[0] ?? [],
    airflowPaths: windPaths,
    airflowRadii: windPaths.map((_, index) => Math.min(0.7, spec.windRadii?.[index] ?? (spec.windRadius ?? 0.22) + index * 0.04)),
    airflowSpeed: spec.windSpeed ?? 0.34,
    airflowStrength: spec.windStrength ?? 0.42,
    airflowRadius: spec.windRadius ?? 0.22,
    lightEnabled: !!spec.light,
    lightColor: spec.light?.color ?? "#a6dcff",
    lightPosition: spec.light?.from ?? { x: 0.5, y: 0.5 },
    lightIntensity: spec.light?.intensity ?? 0.4,
    lightRadius: spec.light?.radius ?? 0.3,
    lights: spec.light ? [{
      id: `${spec.id}-ambient`,
      color: spec.light.color,
      position: spec.light.from,
      endPosition: spec.light.to,
      intensity: spec.light.intensity,
      radius: spec.light.radius,
      speed: spec.light.speed,
      playback: "loop" as const,
    }] : [],
  };
  const global: GlobalSettings = {
    ...base.global,
    color: spec.palette[0],
    colorStyle: { type: "solid", colors: [spec.palette[0], spec.palette[0]] },
    opacity: 0.42,
    width: 1,
    motionEnabled: false,
    shape: { ...base.global.shape, type: "organic", amplitude: 0.006 },
    magnetismEnabled: false,
    glowEnabled: false,
    outerGlowEnabled: false,
    textureEnabled: false,
    flow: { ...DEFAULT_FLOW, colors: [spec.palette[0], spec.palette[1] ?? spec.palette[0]], layers: { ...DEFAULT_FLOW.layers } },
    environment,
    cursorInfluence: { ...base.global.cursorInfluence, enabled: false },
    lineInteraction: { ...base.global.lineInteraction, enabled: false },
    occlusion: { enabled: true, gapWidth: 1.5 },
  };
  const lines = spec.lines.map((line, index) => makeLine(spec.id, line, index, spec.palette, hasWind, !!spec.light, spec.flowCurrentLayer));
  if (spec.flowPulseAllLines) {
    const speed = 0.16;
    const pulseWidth = 0.06;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line.id.includes("-node-")) continue;
      const source = spec.lines[index];
      const firstPoint = line.customPath.points[0];
      const lastPoint = line.customPath.points[line.customPath.points.length - 1];
      const direction = firstPoint.x > 0.5 && lastPoint.x > firstPoint.x ? "reverse" : "forward";
      const delay = source.delay ?? 0;
      const directionSign = direction === "reverse" ? -1 : 1;
      const phase = -directionSign * getHeartbeatCycles(delay, speed);
      line.flow = {
        ...line.flow,
        enabled: true,
        effectType: "energy-pulse",
        pulseRhythm: "heartbeat",
        speed,
        direction,
        intensity: 0.88,
        width: 1.1,
        coreWidth: 1.5,
        glowWidth: 4.4,
        opacity: 0.97,
        coreColor: "#7AD321",
        glowColor: "#A6E96B",
        streamCount: 1,
        phase: ((phase % 1) + 1) % 1,
        layers: { ...line.flow.layers, current: false, core: true, glow: true },
        pulseWidth,
      };
    }
  }
  const config = sanitizeSceneConfig({
    ...base,
    global,
    lines,
    groups: [],
    targets: spec.targets ?? [],
    animation: { ...base.animation, playing: true, reducedMotion: "auto" },
  });

  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    summary: spec.summary,
    description: spec.description,
    version: 1,
    tags: [spec.category.toLowerCase(), ...spec.lines.flatMap((line) => [line.texture, line.flow]).filter((tag) => tag !== undefined)],
    config,
  };
}

const TEMPLATES: SceneTemplateSpec[] = [
  {
    id: "editorial-magnetic-architecture",
    name: "EDITORIAL MAGNETIC ARCHITECTURE",
    category: "Geometric & Structural",
    summary: "A restrained editorial frame of architectural guides, organic contours, and cursor-responsive green connections.",
    description: "Ten intentionally placed paths use quiet olive and pale-green linework to frame the portfolio hero without crossing its headline or wordmark. Static construction guides balance two softly moving silk contours, while one fine traveling highlight and existing title and CTA targets add restrained interaction.",
    palette: ["#7AD321", "#B9C1B0", "#D8F0C2", "#599E23", "#A6E96B"],
    lines: [
      { paths: "0,10 12,10 19,12 24,18", color: 1, width: 0.7, opacity: 0.3, bendable: false, z: 0 },
      { paths: "0,18 5,22 8,29 8,37", color: 2, width: 0.55, opacity: 0.34, bendable: false, z: 0 },
      { paths: "38,4 48,7 58,7 67,4", color: 1, width: 0.55, opacity: 0.24, bendable: false, z: 0 },
      { paths: "100,13 94,17 92,24 95,29 100,31", color: 0, width: 0.75, opacity: 0.34, speed: 0.035, amplitude: 0.002, phase: 0.4, z: 1 },
      { paths: "100,37 94,41 92,48 95,55 100,59", texture: "silk", silkStrands: 3, curveSmoothing: 1, color: 2, width: 0.8, opacity: 0.42, speed: 0.045, amplitude: 0.003, phase: 1.2, cursor: "attract", cursorRadius: 0.13, cursorStrength: 0.14, cursorMaxDeformation: 0.009, cursorSmoothing: 0.5, glow: 0.05, z: 2 },
      { paths: "97,39 93,44 93,49 97,54", color: 1, width: 0.45, opacity: 0.28, speed: 0.03, amplitude: 0.0015, phase: 2.4, z: 1 },
      { paths: "0,64 6,61 11,62 16,67", color: 1, width: 0.55, opacity: 0.32, bendable: false, z: 0 },
      { paths: "0,83 7,79 14,79 20,83 25,88", color: 0, width: 0.82, opacity: 0.42, speed: 0.04, amplitude: 0.002, phase: 3.1, cursor: "attract", cursorRadius: 0.16, cursorStrength: 0.2, cursorMaxDeformation: 0.012, cursorSmoothing: 0.42, targetId: "portfolio-work-cta", flow: "continuous-light", flowSpeed: 0.12, flowIntensity: 0.2, flowWidth: 0.8, flowCoreWidth: 0.5, flowOpacity: 0.38, flowGlow: false, z: 3 },
      { paths: "100,76 94,79 90,84 91,91 97,96", color: 3, width: 0.7, opacity: 0.3, speed: 0.055, amplitude: 0.0025, phase: 4.3, cursor: "attract", cursorRadius: 0.15, cursorStrength: 0.12, cursorMaxDeformation: 0.008, cursorSmoothing: 0.5, z: 1 },
      { paths: "95,70 96,69 97,70 96,71 95,70", color: 4, width: 1.15, opacity: 0.6, bendable: false, glow: 0.08, z: 4 },
    ],
    targets: [{
      id: "portfolio-work-cta",
      lineIds: ["editorial-magnetic-architecture-line-08"],
      lineTriggers: { "editorial-magnetic-architecture-line-08": { magnet: ["hover", "focus", "touch"] } },
      activations: ["hover", "focus", "touch"],
      enabled: true,
      magnetic: true,
      strength: 0.72,
      radius: 0.12,
      priority: 2,
    }],
  },
  {
    id: "opening-organic-lime-filaments", name: "Organic Lime Filaments", category: "Organic & Nature",
    summary: "Six responsive lime filaments frame an opening title with a quiet safe zone.",
    description: "Two fine silk heroes, three restrained edge guides and one traveling light pulse form an editorial frame around the title and loader. Slow staggered motion, local cursor attraction and very soft airflow keep the lines alive without competing with the wordmark.",
    palette: ["#7AD321", "#A6E96B", "#599E23", "#B9C5AE", "#D8F0C2"],
    windBehavior: "gentle",
    wind: [
      "0,32 9,26 17,19 27,11 37,2",
      "0,66 9,66 17,71 25,79 32,89",
      "100,32 95,39 91,48 90,56 95,63 100,66",
    ],
    windSpeed: 0.13, windStrength: 0.14, windRadii: [0.2, 0.16, 0.16],
    light: { color: "#D8F0C2", from: { x: 0.14, y: 0.24 }, to: { x: 0.86, y: 0.72 }, radius: 0.2, intensity: 0.12, speed: 0.018 },
    lines: [
      { paths: "0,27 8,21 15,18 24,10 33,0", texture: "silk", silkStrands: 3, curveSmoothing: 0.92, color: 0, width: 1.1, opacity: 0.86, speed: 0.045, amplitude: 0.006, phase: 0.3, delay: 0.1, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.22, cursorMaxDeformation: 0.016, cursorSmoothing: 0.5, glow: 0.12, z: 4 },
      { paths: "0,42 9,32 17,25 28,15 39,0", curveSmoothing: 0.92, color: 3, width: 0.62, opacity: 0.36, motion: "tension", speed: 0.032, amplitude: 0.003, phase: 1.4, delay: 0.55, z: 1 },
      { paths: "0,66 8,66 16,70 23,77 30,87 34,100", curveSmoothing: 0.92, color: 0, width: 0.94, opacity: 0.73, speed: 0.055, amplitude: 0.007, phase: 2.1, delay: 0.9, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.2, cursorMaxDeformation: 0.015, cursorSmoothing: 0.52, z: 3 },
      { paths: "62,0 70,9 79,15 90,19 100,18", curveSmoothing: 0.92, color: 3, width: 0.58, opacity: 0.34, motion: "tension", speed: 0.028, amplitude: 0.002, phase: 3.4, delay: 0.4, z: 1 },
      { paths: "100,31 95,38 91,47 89,55 93,62 100,66", texture: "silk", silkStrands: 3, curveSmoothing: 0.92, color: 0, width: 1.1, opacity: 0.86, speed: 0.052, amplitude: 0.006, phase: 4.1, delay: 1.2, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.24, cursorMaxDeformation: 0.016, cursorSmoothing: 0.5, glow: 0.14, z: 4 },
      { paths: "55,100 61,89 70,82 81,77 92,68 100,59", curveSmoothing: 0.92, color: 0, width: 0.96, opacity: 0.7, speed: 0.05, amplitude: 0.005, phase: 2.8, delay: 1.65, airflow: true, cursor: "attract", cursorRadius: 0.16, cursorStrength: 0.2, cursorMaxDeformation: 0.014, cursorSmoothing: 0.54, flow: "energy-pulse", flowSpeed: 0.15, flowIntensity: 0.42, flowWidth: 1, flowOpacity: 0.52, flowPulseWidth: 0.04, flowTailLength: 0.08, flowGlow: true, flowCoreColor: "#A6E96B", flowGlowColor: "#7AD321", z: 3 },
    ],
  },
  {
    id: "opening-luminous-silk-filaments", name: "Organic Lime Filaments — Luminous", category: "Organic & Nature",
    summary: "Silk bundles, green double-beat pulses that build toward the end of the opening, a softly shifting random breeze and three breathing nodes frame the scene.",
    description: "Four intentional edge compositions layer fine parallel silk strands with slender green double-beat pulses that travel from the outer edges inward along every filament. Each quick pair is followed by a rest, and the beat grows faster and stronger as the opening approaches completion. Subtle dotted guides and three breathing nodes add texture while the center stays open for the wordmark and loader.",
    palette: ["#7AD321", "#A6E96B", "#599E23", "#B9C5AE", "#D8F0C2"],
    windBehavior: "random",
    ambientAirflow: true,
    windSpeed: 0.3, windStrength: 0.12,
    flowCurrentLayer: false,
    flowPulseAllLines: true,
    light: { color: "#D8F0C2", from: { x: 0.1, y: 0.18 }, to: { x: 0.9, y: 0.8 }, radius: 0.16, intensity: 0.08, speed: 0.012 },
    lines: [
      { paths: "0,31 7,28 13,23 18,17 25,8 30,0", texture: "silk", textureIntensity: 0.84, silkStrands: 5, curveSmoothing: 1, color: 0, width: 1.05, opacity: 0.84, speed: 0.035, amplitude: 0.0027, phase: 0.2, delay: 0, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.1, cursorMaxDeformation: 0.007, cursorSmoothing: 0.62, glow: 0.1, z: 4, flow: "energy-pulse", flowSpeed: 0.42, flowStreamCount: 3, flowIntensity: 0.78, flowWidth: 1.1, flowCoreWidth: 0.85, flowGlowWidth: 3, flowOpacity: 1, flowPulseWidth: 0.14, flowTailLength: 0.14, flowGlow: true, flowCoreColor: "#7AD321", flowGlowColor: "#A6E96B" },
      { paths: "0,36 7,32 13,27 18,21 24,12 29,3", curveSmoothing: 1, color: 4, width: 0.58, opacity: 0.46, motion: "tension", speed: 0.032, amplitude: 0.0027, phase: 1.5, delay: 0.28, airflow: true, z: 2 },
      { paths: "0,25 7,24 13,21 19,17 25,12 31,6 35,0", texture: "fiber", curveSmoothing: 1, color: 2, width: 0.48, opacity: 0.36, speed: 0.044, amplitude: 0.003, phase: 2.1, delay: 0.56, airflow: true, z: 1 },
      { paths: "0,13 8,15 14,18 18,21 25,25 33,27 40,25", texture: "silk", silkStrands: 4, curveSmoothing: 1, color: 1, width: 0.72, opacity: 0.55, speed: 0.034, amplitude: 0.0024, phase: 3.2, delay: 0.84, airflow: true, cursor: "attract", cursorRadius: 0.15, cursorStrength: 0.08, cursorMaxDeformation: 0.006, cursorSmoothing: 0.64, z: 3 },
      { paths: "0,63 9,64 17,69 24,77 29,86 33,95 35,100", texture: "silk", textureIntensity: 0.82, silkStrands: 5, curveSmoothing: 1, color: 0, width: 0.98, opacity: 0.8, speed: 0.048, flowStreamCount: 3, amplitude: 0.003, phase: 2.7, delay: 1.12, airflow: true, cursor: "attract", cursorRadius: 0.17, cursorStrength: 0.09, cursorMaxDeformation: 0.007, cursorSmoothing: 0.62, glow: 0.08, z: 4, flow: "energy-pulse", flowSpeed: 0.42, flowIntensity: 0.78, flowWidth: 1.1, flowCoreWidth: 0.85, flowGlowWidth: 3, flowOpacity: 1, flowPulseWidth: 0.14, flowTailLength: 0.13, flowGlow: true, flowCoreColor: "#7AD321", flowGlowColor: "#A6E96B" },
      { paths: "0,69 9,69 17,73 24,80 30,89 34,98", curveSmoothing: 1, color: 4, width: 0.55, opacity: 0.43, motion: "tension", speed: 0.035, amplitude: 0.0023, phase: 4.1, delay: 1.4, airflow: true, z: 2 },
      { paths: "0,75 8,74 16,77 23,83 29,91 33,100", texture: "fiber", curveSmoothing: 1, color: 2, width: 0.42, opacity: 0.32, speed: 0.041, amplitude: 0.0027, phase: 1.1, delay: 1.68, airflow: true, z: 1 },
      { paths: "64,0 70,7 77,13 85,17 93,19 100,18", texture: "silk", silkStrands: 4, curveSmoothing: 1, color: 3, width: 0.64, opacity: 0.53, speed: 0.032, amplitude: 0.0027, phase: 3.8, delay: 1.96, airflow: true, z: 3 },
      { paths: "100,24 91,25 84,30 78,37 75,45 77,52", texture: "silk", textureIntensity: 0.82, silkStrands: 5, curveSmoothing: 1, color: 0, width: 0.96, opacity: 0.78, speed: 0.046, flowStreamCount: 3, amplitude: 0.00285, phase: 1.4, delay: 2.24, airflow: true, cursor: "attract", cursorRadius: 0.17, cursorStrength: 0.09, cursorMaxDeformation: 0.007, cursorSmoothing: 0.62, glow: 0.09, z: 4, flow: "energy-pulse", flowSpeed: 0.42, flowIntensity: 0.78, flowWidth: 1.1, flowCoreWidth: 0.85, flowGlowWidth: 3, flowOpacity: 1, flowPulseWidth: 0.14, flowTailLength: 0.13, flowGlow: true, flowCoreColor: "#7AD321", flowGlowColor: "#A6E96B", flowDirection: "reverse" },
      { paths: "100,30 92,31 85,35 80,42 77,49", curveSmoothing: 1, color: 4, width: 0.52, opacity: 0.4, motion: "tension", speed: 0.035, amplitude: 0.0024, phase: 5.1, delay: 2.52, airflow: true, z: 2 },
      { paths: "100,37 93,37 87,40 82,45 80,51", texture: "fiber", curveSmoothing: 1, color: 2, width: 0.4, opacity: 0.28, speed: 0.038, amplitude: 0.0024, phase: 2.2, delay: 2.8, airflow: true, z: 1 },
      { paths: "100,67 91,69 84,75 78,83 73,92 69,100", texture: "silk", textureIntensity: 0.84, silkStrands: 5, curveSmoothing: 1, color: 0, width: 1.02, opacity: 0.82, speed: 0.048, flowStreamCount: 3, amplitude: 0.003, phase: 4.4, delay: 3.08, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.1, cursorMaxDeformation: 0.007, cursorSmoothing: 0.64, glow: 0.12, flow: "energy-pulse", flowSpeed: 0.42, flowIntensity: 0.78, flowWidth: 1.1, flowCoreWidth: 0.85, flowGlowWidth: 3, flowOpacity: 1, flowPulseWidth: 0.14, flowTailLength: 0.14, flowGlow: true, flowCoreColor: "#7AD321", flowGlowColor: "#A6E96B", z: 4 },
      { paths: "100,72 92,74 85,79 79,86 74,94 71,100", curveSmoothing: 1, color: 4, width: 0.56, opacity: 0.44, motion: "tension", speed: 0.036, amplitude: 0.0027, phase: 0.9, delay: 3.36, airflow: true, z: 2 },
      { paths: "100,78 93,79 87,83 81,89 77,96 75,100", texture: "fiber", curveSmoothing: 1, color: 2, width: 0.42, opacity: 0.31, speed: 0.04, amplitude: 0.0027, phase: 2.8, delay: 3.64, airflow: true, z: 1 },
      { paths: "16.7,16.95 16.95,17.05 17.05,17.3 16.95,17.55 16.7,17.65 16.45,17.55 16.35,17.3 16.45,17.05 16.7,16.95", node: true, curveSmoothing: 1, color: 1, width: 0.72, opacity: 0.9, bendable: false, airflow: false, z: 7 },
      { paths: "76.3,49.25 76.55,49.35 76.65,49.6 76.55,49.85 76.3,49.95 76.05,49.85 75.95,49.6 76.05,49.35 76.3,49.25", node: true, curveSmoothing: 1, color: 1, width: 0.68, opacity: 0.88, bendable: false, airflow: false, delay: 0.5, z: 7 },
      { paths: "84.8,73.25 85.05,73.35 85.15,73.6 85.05,73.85 84.8,73.95 84.55,73.85 84.45,73.6 84.55,73.35 84.8,73.25", node: true, curveSmoothing: 1, color: 1, width: 0.68, opacity: 0.88, bendable: false, airflow: false, delay: 1, z: 7 },
    ],
  },
  {
    id: "spider-web-suspended-silk", name: "Spider Web — Suspended Silk", category: "Organic & Nature",
    summary: "A broad, fine silver web with an off-center hub and irregular spiral.",
    description: "Eighteen individually curved supports reach an uneven perimeter, with eight loose anchor extensions. A clearly visible, broken spiral crosses the spokes and drifts gently in layered air; pointer movement bends only nearby silk.",
    palette: ["#E5F0F5", "#C6D8E2", "#F5FAFC", "#8FA6B4", "#B9E4F2"],
    windBehavior: "random",
    wind: [
      "0,17 19,14 37,18 56,13 79,16 100,11",
      "0,59 15,55 29,58 42,54",
      "61,78 73,73 84,77 100,71",
    ],
    windSpeed: 0.14, windStrength: 0.2, windRadii: [0.62, 0.22, 0.12],
    light: { color: "#B9E4F2", from: { x: 0.16, y: 0.22 }, to: { x: 0.84, y: 0.7 }, radius: 0.22, intensity: 0.1, speed: 0.012 },
    lines: makeSpiderWebLines(),
  },
  {
    id: "floating-silk-garden", name: "Floating Silk Garden", category: "Organic & Nature",
    summary: "An open field of fine, independent silk drifting through layered air.",
    description: "Twenty-six authored strands form long S-curves, small loops and fine drifting filaments instead of a fixed web or parallel curtain. Four differently scaled airflow paths and staggered motion keep the atmosphere alive while the pointer creates a local, fading disturbance.",
    palette: ["#E7E9E8", "#C5CCCD", "#A9B5B8", "#66747A", "#D7E7EB"],
    windBehavior: "random",
    wind: [
      "0,24 18,19 37,22 58,17 78,20 100,14",
      "8,0 25,21 43,40 60,54 77,72 97,92",
      "0,72 18,68 36,73 55,67 73,71 100,65",
      "62,92 73,84 82,86 89,94",
    ],
    windSpeed: 0.22, windStrength: 0.32, windRadii: [0.68, 0.38, 0.29, 0.13],
    light: { color: "#D7E7EB", from: { x: 0.12, y: 0.36 }, to: { x: 0.88, y: 0.58 }, radius: 0.3, intensity: 0.19, speed: 0.025 },
    lines: [
      { paths: "0,12 12,8 24,14 37,11 48,18 62,14 75,20 91,16 100,19", texture: "silk", silkStrands: 4, color: 0, width: 0.8, opacity: 0.42, speed: 0.075, amplitude: 0.014, phase: 0.2, delay: 0.6, airflow: true, cursor: "attract", cursorRadius: 0.23, cursorStrength: 0.22, cursorMaxDeformation: 0.024 },
      { paths: "0,39 13,34 25,38 37,31 51,35 64,29 77,34 90,28 100,31", texture: "silk", silkStrands: 4, color: 1, width: 0.72, opacity: 0.34, speed: 0.06, amplitude: 0.012, phase: 2.2, delay: 1.4, airflow: true, cursor: "repel", cursorRadius: 0.2, cursorStrength: 0.2, cursorMaxDeformation: 0.02 },
      { paths: "1,61 12,67 24,62 38,70 49,64 63,69 76,62 89,66 100,60", texture: "silk", silkStrands: 3, color: 4, width: 0.76, opacity: 0.38, speed: 0.09, amplitude: 0.016, phase: 4.4, delay: 0.1, airflow: true, cursor: "attract", cursorRadius: 0.22, cursorStrength: 0.25, cursorMaxDeformation: 0.026 },
      { paths: "6,91 17,84 29,89 41,82 53,88 66,80 78,85 91,78 99,81", texture: "silk", silkStrands: 4, color: 2, width: 0.7, opacity: 0.3, speed: 0.05, amplitude: 0.011, phase: 1.6, delay: 2.5, airflow: true },
      { paths: "15,0 18,12 15,25 21,37 18,49 24,61 21,74 25,87 23,100", texture: "silk", silkStrands: 3, color: 1, width: 0.56, opacity: 0.29, speed: 0.045, amplitude: 0.009, phase: 3.6, delay: 1.8, motion: "tension", airflow: true, cursor: "attract", cursorRadius: 0.17, cursorStrength: 0.17 },
      { paths: "69,0 63,14 69,27 65,40 72,52 68,65 76,77 72,89 77,100", texture: "silk", silkStrands: 3, color: 0, width: 0.62, opacity: 0.34, speed: 0.06, amplitude: 0.012, phase: 5.3, delay: 0.9, motion: "tension", airflow: true },
      { paths: "36,2 43,9 48,17 46,26 39,33 37,42 42,50 52,53 58,49", texture: "silk", silkStrands: 4, color: 4, width: 0.68, opacity: 0.4, speed: 0.08, amplitude: 0.013, phase: 0.9, delay: 2.1, airflow: true, cursor: "attract", cursorRadius: 0.2, cursorStrength: 0.23 },
      { paths: "92,23 82,29 78,38 81,47 90,52 92,61 86,70 76,73 70,80", texture: "silk", silkStrands: 3, color: 2, width: 0.6, opacity: 0.31, speed: 0.055, amplitude: 0.01, phase: 2.8, delay: 3.3, motion: "tension", airflow: true, cursor: "repel", cursorRadius: 0.18, cursorStrength: 0.16 },
      { paths: "2,25 9,30 15,29 20,24 26,23|53,17 58,21 58,27 54,30 49,28|93,43 88,47 87,53 92,57", texture: "silk", silkStrands: 3, color: 2, width: 0.48, opacity: 0.3, speed: 0.035, amplitude: 0.007, phase: 1.3, delay: 0.4, motion: "tension", airflow: true },
      { paths: "29,52 34,48 40,49 43,54 41,59 36,61 31,58 29,52|56,74 60,70 66,71 69,76 67,81 62,83 57,80 56,74", texture: "silk", silkStrands: 3, color: 0, width: 0.54, opacity: 0.38, speed: 0.048, amplitude: 0.008, phase: 4.8, delay: 2.7, airflow: true, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.18 },
      { paths: "8,49 14,45 22,46 29,50 36,52|72,39 78,42 83,46 88,47 94,45", texture: "silk", silkStrands: 4, color: 1, width: 0.6, opacity: 0.27, speed: 0.043, amplitude: 0.009, phase: 2.1, delay: 1.2, airflow: true },
      { paths: "40,91 46,86 51,87 54,92 52,97 47,99", texture: "silk", silkStrands: 3, color: 4, width: 0.46, opacity: 0.31, speed: 0.038, amplitude: 0.007, phase: 5.1, delay: 3.5, airflow: true },
      { paths: "1,5 10,10 20,8 27,3", color: 3, width: 0.7, opacity: 0.27, speed: 0.058, amplitude: 0.011, phase: 0.5, delay: 1.1, motion: "tension", airflow: true, cursor: "attract", cursorRadius: 0.16, cursorStrength: 0.2 },
      { paths: "3,18 8,22 13,20 18,14", texture: "fiber", color: 2, width: 0.42, opacity: 0.24, speed: 0.05, amplitude: 0.005, phase: 3.1, delay: 2.2, motion: "vibration", airflow: true, cursor: "attract", cursorRadius: 0.14, cursorStrength: 0.13, cursorMaxDeformation: 0.015 },
      { paths: "24,31 30,28 35,31 38,37 35,43", texture: "silk", silkStrands: 3, color: 4, width: 0.45, opacity: 0.26, speed: 0.044, amplitude: 0.006, phase: 1.8, delay: 0.7, motion: "vibration", airflow: true },
      { paths: "4,57 9,54 13,56 15,61", texture: "fiber", color: 3, width: 0.36, opacity: 0.2, speed: 0.035, amplitude: 0.004, phase: 4.5, delay: 2.9, motion: "vibration", airflow: true },
      { paths: "18,45 22,42 26,43 29,47", texture: "silk", silkStrands: 2, color: 2, width: 0.34, opacity: 0.18, speed: 0.03, amplitude: 0.003, phase: 5.5, delay: 1.5, motion: "vibration" },
      { paths: "56,39 61,36 66,37 70,42", texture: "fiber", color: 3, width: 0.38, opacity: 0.21, speed: 0.04, amplitude: 0.004, phase: 2.6, delay: 3.8, motion: "vibration", airflow: true },
      { paths: "0,85 7,82 13,84 18,89", texture: "silk", silkStrands: 2, color: 1, width: 0.4, opacity: 0.23, speed: 0.032, amplitude: 0.004, phase: 0.7, delay: 2.6, motion: "vibration", airflow: true },
      { paths: "5,36 11,39 16,37 19,32", texture: "fiber", color: 2, width: 0.35, opacity: 0.19, speed: 0.037, amplitude: 0.003, phase: 3.9, delay: 0.3, motion: "vibration" },
      { paths: "28,92 34,89 39,91 42,96", texture: "silk", silkStrands: 2, color: 3, width: 0.32, opacity: 0.16, speed: 0.029, amplitude: 0.003, phase: 1.2, delay: 3.1, motion: "vibration" },
      { paths: "15,12 25,19 33,26 40,35 49,42 58,47", color: 0, width: 0.45, opacity: 0.22, speed: 0.028, amplitude: 0.006, phase: 4.2, delay: 1.9, motion: "tension", airflow: true, cursor: "attract", cursorRadius: 0.2, cursorStrength: 0.18 },
    ],
  },
  {
    id: "organic-root-network", name: "Organic Root Network", category: "Organic & Nature",
    summary: "A branching root system grounded in earthy fibers.",
    description: "A strong central root forks into thinner uneven tendrils, with restrained rope detail and gravity concentrated at the tips.",
    palette: ["#89725f", "#594d45", "#b39a78", "#756e61"],
    wind: ["0,61 24,57 48,63 74,58 100,62"],
    windStrength: 0.32, windRadius: 0.17,
    lines: [
      { paths: "48,99 49,81 45,67 50,53 47,39 54,24 52,5", texture: "rope", width: 1.15, speed: 0.05, amplitude: 0.006, gravity: 0.24 },
      { paths: "47,69 34,62 24,50 11,45 2,35", texture: "fiber", width: 0.95, speed: 0.07, amplitude: 0.007, airflow: true },
      { paths: "35,63 33,49 25,39 23,26", texture: "fiber", width: 0.78, speed: 0.08, amplitude: 0.009 },
      { paths: "24,50 14,55 6,64", texture: "fiber", width: 0.7, speed: 0.1, amplitude: 0.012, cursor: "attract" },
      { paths: "49,54 64,48 74,36 89,31 99,20", texture: "rope", width: 1, speed: 0.06, amplitude: 0.006 },
      { paths: "73,37 72,22 81,13", texture: "fiber", width: 0.7, speed: 0.1, amplitude: 0.01 },
      { paths: "63,49 73,57 83,59 94,70", texture: "fiber", width: 0.75, speed: 0.09, amplitude: 0.01, cursor: "attract" },
      { paths: "46,81 35,87 29,97", texture: "fiber", width: 0.8, speed: 0.07, amplitude: 0.009 },
    ],
  },
  {
    id: "botanical-veins", name: "Botanical Veins", category: "Geometric & Structural",
    summary: "A set of asymmetric leaf skeletons in sage and olive.",
    description: "Three different leaf outlines carry a central vein and fine angled branches. The central ribs stay composed as smaller veins breathe softly.",
    palette: ["#839176", "#a3a47c", "#d4d0b4", "#596b56"],
    lines: [
      { paths: "8,26 19,18 31,16 43,19 54,26 63,36 68,46 66,56 58,64 46,68 34,66 23,59 14,49 8,38 8,26|8,26 18,43 34,66|18,43 34,37 49,37|24,53 39,48 57,51", color: 0, width: 0.9, bendable: false },
      { paths: "48,28 60,20 73,18 86,23 94,32 91,42 81,49 68,51 57,46 48,38 48,28|48,28 69,37 91,42|69,37 72,25 81,49|60,33 58,43", color: 3, width: 0.85, bendable: false },
      { paths: "20,75 30,66 43,64 56,68 66,77 72,88 68,96 56,97 42,92 29,85 20,75|20,75 43,82 68,96|43,82 43,65 56,97|30,80 34,91", color: 1, width: 0.8, bendable: false },
      { paths: "9,39 17,47 27,53", color: 2, width: 0.6, amplitude: 0.003, airflow: true },
    ],
  },
  {
    id: "autumn-leaf-wind", name: "Autumn Leaf Wind", category: "Organic & Nature",
    summary: "Coppery branches swept by a changeable breeze.",
    description: "Three branching silhouettes lean in different directions. Rust and ochre accents ride a slow random wind with restrained local cursor pull.",
    palette: ["#bd7045", "#d29a5b", "#765647", "#e0bd88"],
    wind: ["0,58 22,51 49,57 74,47 100,52", "8,81 35,75 69,83 96,72"],
    windStrength: 0.45, windRadius: 0.18,
    lines: [
      { paths: "18,98 22,79 19,62 27,46 25,31 33,14", texture: "fiber", width: 1.05, speed: 0.08, amplitude: 0.009, airflow: true },
      { paths: "22,67 10,59 4,48", width: 0.9, speed: 0.12, amplitude: 0.012, cursor: "repel", airflow: true },
      { paths: "25,47 40,42 49,32 57,22", width: 0.8, speed: 0.1, amplitude: 0.01, airflow: true },
      { paths: "31,18 27,8 29,3", width: 0.65, speed: 0.14, amplitude: 0.012 },
      { paths: "78,99 74,81 81,66 77,49 86,33 83,15", texture: "fiber", width: 1, speed: 0.07, phase: 2.4, amplitude: 0.008, airflow: true },
      { paths: "78,65 64,58 57,46", width: 0.85, speed: 0.11, amplitude: 0.011, cursor: "repel", airflow: true },
      { paths: "81,47 92,41 98,31", width: 0.7, speed: 0.14, phase: 4.2, amplitude: 0.012 },
    ],
  },
  {
    id: "invisible-wind", name: "Invisible Wind", category: "Atmospheric & Floating",
    summary: "A sparse field of nearly invisible moving air currents.",
    description: "Uneven interrupted streams cross and rise through a slate haze. Two broad, independently sampled random airflow corridors bend only selected paths.",
    palette: ["#d4d9dc", "#a9b2b8", "#75828a", "#edf0ed"],
    wind: ["0,31 22,28 47,34 72,29 100,32", "0,72 24,76 53,68 77,74 100,69"],
    windStrength: 0.5, windRadius: 0.2,
    lines: [
      { paths: "1,13 15,10 31,14 48,11 67,15 86,10 99,12", opacity: 0.3, width: 0.7, speed: 0.09, airflow: true },
      { paths: "0,26 18,23 39,28 58,24 78,28 100,23", opacity: 0.34, width: 0.8, speed: 0.12, phase: 1.4, airflow: true },
      { paths: "4,43 21,47 38,41 56,46 75,40 96,44", opacity: 0.27, width: 0.65, speed: 0.07, phase: 3.2 },
      { paths: "0,60 16,56 33,61 51,55 68,59 86,54 100,58", opacity: 0.31, width: 0.75, speed: 0.1, phase: 4.1, airflow: true },
      { paths: "5,83 22,87 41,81 61,86 80,80 98,84", opacity: 0.29, width: 0.68, speed: 0.08, phase: 2.3, airflow: true },
      { paths: "14,96 31,92 50,95 69,90 89,94", opacity: 0.24, width: 0.6, speed: 0.06, phase: 5.2 },
      { paths: "37,5 42,13 38,20", opacity: 0.22, width: 0.55, speed: 0.12, phase: 0.8 },
      { paths: "72,32 68,42 73,50", opacity: 0.25, width: 0.6, speed: 0.15, phase: 4.7 },
    ],
  },
  {
    id: "suspended-threads", name: "Suspended Threads", category: "Atmospheric & Floating",
    summary: "Different-weight silk strands hanging from invisible anchors.",
    description: "Long and short threads terminate at uneven heights. Gravity provides a subtle weighted fall while local drafts and pointer movement create small, independent swings.",
    palette: ["#e6e1d8", "#b9c3c4", "#8d999e", "#d5c9b5"],
    wind: ["0,54 32,50 67,56 100,51"], windStrength: 0.23, windRadius: 0.12,
    lines: [
      { paths: "9,4 10,27 8,49 11,70", texture: "silk", width: 0.7, gravity: 0.55, airflow: true, speed: 0.08 },
      { paths: "22,2 23,20 21,42", texture: "silk", width: 0.55, gravity: 0.34, speed: 0.12 },
      { paths: "37,5 36,31 39,58 36,87", texture: "silk", width: 0.75, gravity: 0.62, airflow: true, cursor: "attract" },
      { paths: "51,1 53,18 50,39 52,57", texture: "silk", width: 0.6, gravity: 0.35, speed: 0.1 },
      { paths: "66,6 65,34 68,63 66,78", texture: "silk", width: 0.7, gravity: 0.48, airflow: true },
      { paths: "81,0 80,22 83,42", texture: "silk", width: 0.52, gravity: 0.3, speed: 0.14 },
      { paths: "94,4 92,28 95,52 91,92", texture: "silk", width: 0.75, gravity: 0.58, airflow: true, cursor: "attract" },
    ],
  },
  {
    id: "atmospheric-drift", name: "Atmospheric Drift", category: "Atmospheric & Floating",
    summary: "Wide negative space with slow wandering curves.",
    description: "A sparse set of long, displaced arcs crosses at different heights. Slow timing and soft attraction make it suitable behind quiet editorial layouts.",
    palette: ["#d9dedf", "#a8b1b5", "#7e8a90", "#ecebe5"],
    wind: ["0,45 29,40 57,47 100,42"], windStrength: 0.26, windRadius: 0.28,
    lines: [
      { paths: "2,22 19,18 38,21 57,17 78,21 99,16", width: 0.65, opacity: 0.26, speed: 0.055, delay: 0.3, cursor: "attract", cursorRadius: 0.3, airflow: true },
      { paths: "0,38 17,42 36,36 55,41 76,35 100,39", width: 0.75, opacity: 0.3, speed: 0.065, delay: 1.6, airflow: true },
      { paths: "7,63 26,59 45,64 66,58 84,63 98,60", width: 0.62, opacity: 0.24, speed: 0.05, delay: 2.9, airflow: true },
      { paths: "1,82 20,86 40,80 60,85 81,79 99,82", width: 0.68, opacity: 0.28, speed: 0.06, delay: 4.4, cursor: "attract", cursorRadius: 0.27 },
      { paths: "32,5 38,12 35,20", width: 0.5, opacity: 0.2, speed: 0.08, delay: 5.8 },
      { paths: "70,74 76,82 72,92", width: 0.52, opacity: 0.22, speed: 0.07, delay: 7.1 },
    ],
  },
  {
    id: "smoke-trails", name: "Smoke Trails", category: "Experimental & Abstract",
    summary: "Translucent smoke ribbons curling upward in separate plumes.",
    description: "Narrow rising S-curves occupy three different columns, with broken wisps and offset motion phases. Soft random airflow keeps plumes from appearing mechanically synchronized.",
    palette: ["#d6dbdd", "#aab2b6", "#78838a", "#ebe8e2"],
    wind: ["6,64 29,58 52,63 77,56 99,60"], windStrength: 0.34, windRadius: 0.15,
    lines: [
      { paths: "19,98 17,82 24,68 19,54 27,41 24,27 33,12 30,3", width: 0.8, opacity: 0.28, speed: 0.075, airflow: true },
      { paths: "26,61 34,52 31,43 39,34", width: 0.55, opacity: 0.2, speed: 0.11, phase: 2.1 },
      { paths: "51,100 56,86 49,73 56,60 52,47 61,34 58,20 66,7", width: 0.9, opacity: 0.3, speed: 0.06, phase: 1.7, airflow: true, cursor: "repel" },
      { paths: "54,70 44,62 47,53 41,45", width: 0.58, opacity: 0.22, speed: 0.1, phase: 4.3 },
      { paths: "83,99 78,84 85,70 80,57 87,45 84,30 93,18", width: 0.75, opacity: 0.25, speed: 0.08, phase: 3.4, airflow: true },
      { paths: "83,60 74,52 77,43", width: 0.48, opacity: 0.18, speed: 0.12, phase: 5.5 },
    ],
  },
  {
    id: "deep-ocean-currents", name: "Deep Ocean Currents", category: "Atmospheric & Floating",
    summary: "Cool current layers with heavy rope accents below.",
    description: "Broad blue paths drift at different depths while a few rope-like currents trail more slowly. Subtle cyan pulses appear only on selected routes.",
    palette: ["#7298a8", "#b1c8cc", "#416b7a", "#8cb6b4"],
    wind: ["0,38 29,34 62,40 100,35", "0,74 35,79 67,72 100,77"],
    windStrength: 0.3, windRadius: 0.24,
    lines: [
      { paths: "0,20 18,15 37,19 54,13 77,18 100,12", texture: "silk", width: 0.75, opacity: 0.38, speed: 0.07, airflow: true },
      { paths: "0,31 20,36 43,30 66,35 86,29 100,32", texture: "rope", width: 1.1, opacity: 0.44, speed: 0.045, phase: 1.6, airflow: true },
      { paths: "0,53 17,48 35,54 54,49 74,55 100,48", texture: "silk", width: 0.68, opacity: 0.33, speed: 0.08, phase: 3.2 },
      { paths: "0,68 24,72 45,66 66,71 84,65 100,69", texture: "rope", width: 1, opacity: 0.4, speed: 0.05, phase: 4.5, airflow: true, cursor: "attract" },
      { paths: "5,88 25,83 45,88 68,82 91,87", texture: "silk", width: 0.64, opacity: 0.3, speed: 0.06, phase: 0.8 },
      { paths: "16,43 29,39 40,42", width: 0.65, opacity: 0.3, flow: "continuous-light", flowSpeed: 0.16 },
    ],
  },
  {
    id: "electric-neural-network", name: "Electric Neural Network", category: "Electric & Energy",
    summary: "Five organic neural clusters carry selective, staggered electric signals.",
    description: "Irregular branching structures and stable junctions form five distinct clusters, joined by a few long connections. Selected branches carry independent currents and energy pulses; localized pointer glow and gentle bending suggest an external stimulus without implying synchronized node-to-node propagation.",
    palette: ["#536477", "#74849A", "#4B9EFF", "#80D8FF", "#E6F7FF", "#9A7BFF"],
    light: { color: "#4B9EFF", from: { x: 0.18, y: 0.52 }, to: { x: 0.82, y: 0.46 }, radius: 0.2, intensity: 0.12, speed: 0.04 },
    lines: [
      { paths: "18,24 23,18 31,16 38,20 42,27|18,24 12,20 8,13 10,7|18,24 11,30 7,38|31,16 34,9 41,5|38,20 44,16 49,17|23,18 20,11", color: 0, width: 0.86, opacity: 0.55, bendable: false, z: 2 },
      { paths: "49,19 55,14 63,15 68,21 67,29 61,33 54,30 49,19|49,19 45,11 48,5|63,15 69,9 76,10|67,29 74,34 80,32|54,30 50,36 45,40", color: 1, width: 0.78, opacity: 0.49, bendable: false, z: 1 },
      { paths: "82,30 87,24 94,25 98,31 96,38 90,41 84,37 82,30|82,30 76,24 75,17|94,25 98,19|90,41 96,47 100,48|84,37 78,41 73,47", color: 0, width: 0.82, opacity: 0.53, bendable: false, z: 3 },
      { paths: "27,70 32,64 40,63 46,68 47,76 41,82 34,81 27,70|27,70 20,66 14,68 10,74|40,63 44,56 51,53|46,68 53,65 59,67|34,81 31,89 25,94", color: 1, width: 0.84, opacity: 0.53, bendable: false, z: 2 },
      { paths: "74,73 80,67 88,68 93,74 91,82 85,86 78,83 74,73|74,73 68,66 67,59 71,53|88,68 94,62 100,61|91,82 96,88 100,91|78,83 73,89 69,96", color: 0, width: 0.82, opacity: 0.52, bendable: false, z: 1 },
      { paths: "42,27 47,31 52,34 57,36 61,42 65,47 70,51 75,54|46,68 51,62 57,57 63,54 68,51|49,19 47,26 45,32 42,38|82,30 77,34 72,39 68,45", color: 1, width: 0.62, opacity: 0.3, bendable: false, z: 0 },
      { paths: "18,24 21,23 23,24 24,27 22,29 19,28 18,24", color: 4, width: 1, opacity: 0.72, bendable: false, glow: 0.12, z: 8 },
      { paths: "49,19 52,17 55,18 56,21 54,23 51,22 49,19", color: 3, width: 0.95, opacity: 0.68, bendable: false, glow: 0.1, z: 8 },
      { paths: "82,30 85,28 88,29 89,32 87,34 84,33 82,30", color: 4, width: 0.95, opacity: 0.7, bendable: false, glow: 0.12, z: 8 },
      { paths: "27,70 30,68 33,69 34,72 32,74 29,73 27,70", color: 3, width: 0.95, opacity: 0.68, bendable: false, glow: 0.1, z: 8 },
      { paths: "74,73 77,71 80,72 81,75 79,77 76,76 74,73", color: 4, width: 0.95, opacity: 0.7, bendable: false, glow: 0.12, z: 8 },
      { paths: "22,29 28,34 35,36 40,33 45,32|40,33 38,40 34,45|35,36 31,42 28,48|61,33 59,39 61,45 65,49|67,29 72,27 76,29 78,34", color: 1, width: 0.52, opacity: 0.36, motion: "floating", speed: 0.035, amplitude: 0.003, phase: 0.7, delay: 0.4, cursor: "attract", cursorRadius: 0.16, cursorStrength: 0.14, cursorMaxDeformation: 0.012, cursorSmoothing: 0.52, z: 4 },
      { paths: "24,72 19,77 16,83 18,89|34,81 39,87 44,90 49,88|43,68 49,72 55,75 60,74|80,83 75,80 70,80 65,83|87,38 84,44 85,50 89,54", color: 1, width: 0.49, opacity: 0.34, motion: "tension", speed: 0.028, amplitude: 0.004, phase: 2.8, delay: 1.7, airflow: true, cursor: "repel", cursorRadius: 0.17, cursorStrength: 0.16, cursorMaxDeformation: 0.014, cursorSmoothing: 0.58, z: 5 },
      { paths: "38,20 44,21 49,19|68,21 74,20 79,23|47,76 55,79 62,77|65,47 70,45 75,47", color: 1, width: 0.55, opacity: 0.34, bendable: false, z: 0 },
      { paths: "42,27 47,29 51,33 55,37 59,40 64,43 69,47 74,51", color: 2, width: 0.66, opacity: 0.42, flow: "electric-current", flowSpeed: 0.3, flowPhase: 0.2, flowIntensity: 0.44, flowWidth: 0.92, flowOpacity: 0.46, flowPulseWidth: 0.1, flowTailLength: 0.16, glow: 0.14, cursor: "attract", cursorRadius: 0.18, cursorStrength: 0.15, cursorMaxDeformation: 0.014, cursorSmoothing: 0.55, z: 6 },
      { paths: "46,68 51,63 56,58 61,55 66,52 70,51 74,54 78,58", color: 3, width: 0.58, opacity: 0.36, flow: "energy-pulse", flowSpeed: 0.17, flowPhase: 2.4, flowDirection: "both", flowIntensity: 0.54, flowWidth: 0.82, flowOpacity: 0.52, flowPulseWidth: 0.075, flowTailLength: 0.12, glow: 0.12, cursor: "attract", cursorRadius: 0.15, cursorStrength: 0.12, cursorMaxDeformation: 0.01, z: 7 },
      { paths: "19,27 24,32 29,35 34,36 39,34|31,70 36,66 41,64 46,66 51,69", color: 2, width: 0.55, opacity: 0.31, flow: "electric-current", flowSpeed: 0.23, flowPhase: 4.1, flowIntensity: 0.38, flowWidth: 0.78, flowOpacity: 0.4, flowPulseWidth: 0.09, flowTailLength: 0.15, glow: 0.11, z: 6 },
      { paths: "82,33 77,38 72,43 69,48 67,54 68,60|75,74 70,69 68,64 67,59", color: 3, width: 0.57, opacity: 0.35, flow: "energy-pulse", flowSpeed: 0.13, flowPhase: 5.7, flowDirection: "forward", flowIntensity: 0.49, flowWidth: 0.8, flowOpacity: 0.46, flowPulseWidth: 0.07, flowTailLength: 0.1, glow: 0.1, z: 7 },
      { paths: "55,30 60,34 64,39 67,45 70,51 75,54 80,57 85,57", color: 5, width: 0.55, opacity: 0.28, flow: "plasma", flowSpeed: 0.12, flowPhase: 1.8, flowIntensity: 0.24, flowWidth: 0.72, flowOpacity: 0.3, flowPulseWidth: 0.08, flowTailLength: 0.12, glow: 0.08, z: 5 },
    ],
  },
  {
    id: "electric-spider-web", name: "Electric Spider Web", category: "Networks & Connections",
    summary: "A graphite web with sparse blue-white discharge.",
    description: "A fractured radial web anchors a dense inner spiral. Electric current travels along just a few spokes, preserving quiet gaps and the delicate silhouette.",
    palette: ["#cfefff", "#52caff", "#758cff", "#d5d9ee"],
    wind: ["0,48 30,45 60,51 100,46"], windStrength: 0.24, windRadius: 0.14,
    lines: [
      { paths: "50,48 48,5", width: 0.6, opacity: 0.38, airflow: true },
      { paths: "50,48 89,19", width: 0.6, opacity: 0.42, airflow: true, flow: "electric-current", flowSpeed: 0.55 },
      { paths: "50,48 98,51", width: 0.6, opacity: 0.38, airflow: true },
      { paths: "50,48 78,88", width: 0.6, opacity: 0.42, airflow: true, flow: "energy-pulse", flowSpeed: 0.23 },
      { paths: "50,48 19,91", width: 0.58, opacity: 0.4, airflow: true, cursor: "attract" },
      { paths: "50,48 4,63", width: 0.56, opacity: 0.38, airflow: true },
      { paths: "17,36 29,29 43,30 58,36 71,45 79,56|10,53 24,47 40,46 55,50 68,58 75,67|24,70 36,63 50,61 62,66", width: 0.52, opacity: 0.3 },
    ],
  },
  {
    id: "fiber-optic-garden", name: "Fiber Optic Garden", category: "Electric & Energy",
    summary: "Branching glassy filaments with independent color pulses.",
    description: "Curved bundles weave around open centers and split into thin offshoots. Fiber-optic light alternates cyan, blue and violet on selected strands.",
    palette: ["#71e7ed", "#8b9bff", "#d39cff", "#e7ffff"],
    wind: ["0,40 31,36 66,43 100,37"], windStrength: 0.2, windRadius: 0.18,
    lines: [
      { paths: "4,28 18,22 30,28 42,20 55,25 70,16 91,21", texture: "silk", width: 0.8, flow: "fiber-optic", flowSpeed: 0.4, airflow: true },
      { paths: "9,72 24,64 39,71 52,62 69,68 86,58 98,63", texture: "silk", width: 0.75, flow: "fiber-optic", flowSpeed: 0.29, flowDirection: "reverse" },
      { paths: "24,64 26,49 36,39 42,20", texture: "silk", width: 0.68, flow: "continuous-light", flowSpeed: 0.22 },
      { paths: "52,62 56,47 68,37 70,16", texture: "silk", width: 0.72, flow: "fiber-optic", flowSpeed: 0.34 },
      { paths: "39,71 44,82 57,88", texture: "silk", width: 0.62, flow: "fiber-optic", flowSpeed: 0.25, cursor: "attract" },
      { paths: "69,68 74,80 90,84", texture: "silk", width: 0.68, flow: "continuous-light", flowSpeed: 0.19, cursor: "attract" },
    ],
  },
  {
    id: "plasma-streams", name: "Plasma Streams", category: "Electric & Energy",
    summary: "Violet plasma ribbons with bright moving cores.",
    description: "Irregular stream paths break into separate clusters and carry low-turbulence plasma. Motion is lively but the glow stays restrained enough for a background.",
    palette: ["#a78dff", "#62caff", "#e3d6ff", "#7259c4"],
    wind: ["0,58 28,52 58,59 100,51"], windStrength: 0.28, windRadius: 0.15,
    lines: [
      { paths: "4,18 18,12 35,19 49,14 66,20 83,14 98,18", motion: "vibration", speed: 0.18, amplitude: 0.012, flow: "plasma", flowSpeed: 0.34, glow: 0.18, airflow: true },
      { paths: "2,34 19,39 34,31 51,38 68,30 84,37 99,32", motion: "floating", speed: 0.1, amplitude: 0.014, flow: "energy-pulse", flowSpeed: 0.22 },
      { paths: "8,58 25,51 42,58 59,52 77,59 94,52", motion: "vibration", speed: 0.15, amplitude: 0.01, flow: "plasma", flowSpeed: 0.28, phase: 2.1, airflow: true },
      { paths: "0,77 17,82 35,75 52,81 70,74 89,80 100,76", motion: "floating", speed: 0.08, amplitude: 0.016, flow: "plasma", flowSpeed: 0.31 },
      { paths: "27,4 32,12 28,21", width: 0.65, opacity: 0.35, flow: "energy-pulse", flowSpeed: 0.18, cursor: "attract" },
      { paths: "70,83 75,91 72,98", width: 0.7, opacity: 0.3, flow: "plasma", flowSpeed: 0.21 },
    ],
  },
  {
    id: "electric-circuit-paths", name: "Electric Circuit Paths", category: "Electric & Energy",
    summary: "Angular circuit traces with selective live current.",
    description: "Right-angle traces and curved jumper paths form three asymmetrical circuit clusters. Only the flexible bridges animate; small routes carry discrete moving charge.",
    palette: ["#a9d8d1", "#59c8d8", "#83a8cf", "#e1ece1"],
    lines: [
      { paths: "8,18 8,8 25,8 25,23 42,23 42,13 55,13", bendable: false, width: 0.9 },
      { paths: "8,18 19,18 19,35 33,35 33,47", bendable: false, width: 0.85, flow: "electric-current", flowSpeed: 0.32 },
      { paths: "55,13 55,28 72,28 72,14 91,14 91,31", bendable: false, width: 0.9 },
      { paths: "61,53 61,39 78,39 78,54 94,54 94,68", bendable: false, width: 0.9, flow: "energy-pulse", flowSpeed: 0.2 },
      { paths: "12,70 12,55 29,55 29,70 45,70 45,87 62,87", bendable: false, width: 0.9 },
      { paths: "42,23 49,33 61,39", width: 0.8, flow: "continuous-light", flowSpeed: 0.24, cursor: "attract" },
      { paths: "33,47 42,52 54,53 61,53", width: 0.8, flow: "electric-current", flowSpeed: 0.27 },
    ],
  },
  {
    id: "constellation", name: "Constellation", category: "Networks & Connections",
    summary: "Quiet star clusters connected by fine silver paths.",
    description: "Three sparse constellations use different scales and line angles. A few connections carry slow, soft light while the points remain steady.",
    palette: ["#d9e3ed", "#9db4cd", "#e4d8b8", "#a4a9bd"],
    light: { color: "#b5d8ff", from: { x: 0.12, y: 0.22 }, to: { x: 0.86, y: 0.78 }, radius: 0.22, intensity: 0.28, speed: 0.08 },
    lines: [
      { paths: "12,25 23,12 38,19 44,34 31,43 12,25", width: 0.85, bendable: false },
      { paths: "23,12 29,29 44,34 51,21", width: 0.65, opacity: 0.4, bendable: false, flow: "continuous-light", flowSpeed: 0.12 },
      { paths: "65,18 78,10 91,23 84,39 69,35 65,18", width: 0.8, bendable: false },
      { paths: "78,10 79,25 91,23", width: 0.6, opacity: 0.4, bendable: false },
      { paths: "37,70 50,58 64,66 60,84 46,91 37,70", width: 0.82, bendable: false },
      { paths: "50,58 52,77 60,84", width: 0.62, opacity: 0.42, bendable: false, flow: "energy-pulse", flowSpeed: 0.14 },
      { paths: "44,34 55,46 64,66", width: 0.62, opacity: 0.34, bendable: false },
    ],
  },
  {
    id: "magnetic-ripples", name: "Magnetic Ripples", category: "Networks & Connections",
    summary: "Three off-center ripple fields with soft reactive edges.",
    description: "Partial rings overlap without sharing a center. Low-amplitude floating deformation and a wide cursor field create the suggestion of a disturbance passing through the surface.",
    palette: ["#c5ced1", "#9cb2bd", "#e4e6df", "#778991"],
    lines: [
      { paths: "17,20 25,12 37,10 47,16 51,27 47,38 36,44 24,41 17,32 17,20", width: 0.72, cursor: "repel", cursorRadius: 0.22 },
      { paths: "9,18 22,5 40,3 55,12 60,28 54,44 38,52 20,48 8,35 9,18", width: 0.6, opacity: 0.36, phase: 2.2 },
      { paths: "51,23 61,14 75,13 87,22 89,36 80,47 66,48 54,39 51,23", width: 0.75, cursor: "repel", cursorRadius: 0.22 },
      { paths: "46,20 59,7 78,6 94,17 98,34 90,50 74,57 57,50 46,36 46,20", width: 0.58, opacity: 0.34, phase: 4.1 },
      { paths: "29,64 39,57 52,59 59,69 57,81 47,88 35,84 29,75 29,64", width: 0.68, cursor: "repel", cursorRadius: 0.2 },
      { paths: "19,62 33,51 52,52 66,64 68,82 55,95 37,97 22,85 19,62", width: 0.56, opacity: 0.33, phase: 1.1 },
    ],
  },
  {
    id: "interconnected-geometry", name: "Interconnected Geometry", category: "Networks & Connections",
    summary: "An irregular polygon net with a few elastic links.",
    description: "Uneven triangle and polygon cells form a loose network. The closed structures remain rigid while bridging links flex subtly under pointer influence.",
    palette: ["#d5ddd6", "#9caaa4", "#b7c8bf", "#7f8e89"],
    lines: [
      { paths: "8,20 24,9 38,21 33,39 16,42 8,20", bendable: false, width: 0.9 },
      { paths: "24,9 45,8 54,23 38,21", bendable: false, width: 0.78 },
      { paths: "33,39 38,21 54,23 58,43 43,52 33,39", bendable: false, width: 0.9 },
      { paths: "54,23 71,10 88,17 92,36 75,43 58,43", bendable: false, width: 0.9 },
      { paths: "16,42 30,58 43,52 58,67 75,58 75,43", bendable: false, width: 0.82 },
      { paths: "8,20 4,43 16,62 30,58", bendable: false, width: 0.7 },
      { paths: "43,52 43,72 58,88 77,83 89,68 75,58", bendable: false, width: 0.9 },
      { paths: "30,58 20,78 30,92 48,96", width: 0.78, cursor: "attract", amplitude: 0.006 },
      { paths: "58,43 67,52 75,58", width: 0.72, cursor: "attract", amplitude: 0.005 },
    ],
  },
  {
    id: "connected-orbital-network", name: "Connected Orbital Network", category: "Experimental & Abstract",
    summary: "Crossing elliptical tracks tied together by fine chords.",
    description: "Off-center orbital loops have distinct sizes and orientations. A handful of chords connect their paths; subtle phase differences suggest slow orbital motion without moving the whole drawing.",
    palette: ["#d5dce1", "#9fb4c5", "#b9b4a2", "#778c9c"],
    lines: [
      { paths: "9,31 17,17 37,12 55,20 61,36 53,51 32,56 14,48 9,31", bendable: false, width: 0.75 },
      { paths: "45,15 62,8 81,15 91,30 87,47 68,56 51,49 45,32 45,15", bendable: false, width: 0.75 },
      { paths: "28,51 38,40 56,38 71,47 76,65 66,80 47,84 31,73 28,51", bendable: false, width: 0.8 },
      { paths: "17,17 68,56", width: 0.65, opacity: 0.36, bendable: false },
      { paths: "53,51 38,40", width: 0.65, opacity: 0.42, flow: "continuous-light", flowSpeed: 0.12 },
      { paths: "61,36 76,65", width: 0.6, opacity: 0.4, bendable: false },
      { paths: "32,56 47,84", width: 0.62, opacity: 0.35, bendable: false },
    ],
  },
  {
    id: "liquid-metal-mesh", name: "Liquid Metal Mesh", category: "Liquid & Fluid",
    summary: "A polished, irregular mesh with slow heavy flex.",
    description: "Uneven interlocking strands cross in broad cells. A few routes carry linked-metal detailing while the rest remain thin chrome strokes to keep the surface from becoming visually dense.",
    palette: ["#cbd2d5", "#818c92", "#f0f3f1", "#a9b5ba"],
    wind: ["0,53 31,48 66,56 100,50"], windStrength: 0.16, windRadius: 0.16,
    lines: [
      { paths: "2,19 18,14 35,19 50,12 68,18 84,13 98,19", texture: "metal", textureScale: 0.012, width: 1.1, speed: 0.04, airflow: true },
      { paths: "0,38 17,43 34,36 52,42 71,35 90,41 100,37", width: 1.05, speed: 0.05, amplitude: 0.006, airflow: true },
      { paths: "4,59 20,54 38,60 56,53 74,60 93,55", texture: "metal", textureScale: 0.016, width: 1.05, speed: 0.04, airflow: true },
      { paths: "1,80 19,85 36,78 55,84 73,77 91,82 99,78", width: 1, speed: 0.05, amplitude: 0.006 },
      { paths: "15,13 12,31 18,49 13,67 20,85", width: 0.75, opacity: 0.34, speed: 0.06 },
      { paths: "42,17 47,34 41,52 48,69 43,82", texture: "metal", textureScale: 0.012, width: 0.8, opacity: 0.38, speed: 0.045 },
      { paths: "76,16 71,34 78,52 72,70 79,85", width: 0.72, opacity: 0.34, speed: 0.06, cursor: "attract" },
    ],
  },
  {
    id: "liquid-ribbons", name: "Liquid Ribbons", category: "Liquid & Fluid",
    summary: "Wide, slow ribbons with isolated overlaps and soft color.",
    description: "Large flowing paths take different routes across open negative space. Their liquid shapes, staggered phases and broad pointer reach create a soft, elastic field.",
    palette: ["#e3e7e5", "#aab9c5", "#b4aecd", "#f0f0ea"],
    wind: ["0,42 25,37 52,45 77,39 100,44"], windStrength: 0.28, windRadius: 0.2,
    lines: [
      { paths: "0,18 16,11 31,17 48,9 66,16 83,9 100,14", motion: "floating", speed: 0.06, amplitude: 0.018, width: 1.5, cursor: "attract", cursorRadius: 0.22, airflow: true },
      { paths: "0,37 15,43 30,35 47,42 65,34 82,40 100,33", motion: "floating", speed: 0.08, amplitude: 0.02, width: 1.35, phase: 1.7 },
      { paths: "0,59 18,52 35,60 52,51 70,58 87,50 100,55", motion: "floating", speed: 0.055, amplitude: 0.017, width: 1.6, phase: 3.4, airflow: true },
      { paths: "0,79 14,85 31,76 49,83 67,75 85,82 100,75", motion: "floating", speed: 0.07, amplitude: 0.02, width: 1.4, phase: 4.8 },
      { paths: "24,4 31,12 27,22 35,30", motion: "tension", speed: 0.09, amplitude: 0.01, width: 0.85, opacity: 0.36 },
      { paths: "73,67 80,75 75,87 82,96", motion: "tension", speed: 0.08, amplitude: 0.012, width: 0.8, opacity: 0.34, cursor: "attract" },
    ],
  },
  {
    id: "fluid-contours", name: "Fluid Contours", category: "Liquid & Fluid",
    summary: "Nested contour loops drift around separate quiet centers.",
    description: "Irregular contour rings use three offset centers and imperfect spacing. Low-amplitude shape motion produces a slow breathing effect without synchronized expansion.",
    palette: ["#d9ddd5", "#aeb7aa", "#858f85", "#eeeae0"],
    wind: ["0,51 27,47 58,54 100,48"], windStrength: 0.2, windRadius: 0.14,
    lines: [
      { paths: "9,27 16,17 30,12 45,16 52,27 49,41 37,49 22,47 12,39 9,27", width: 0.78, speed: 0.06, amplitude: 0.006 },
      { paths: "3,26 12,10 31,4 49,10 59,26 56,45 40,56 20,54 5,42 3,26", width: 0.62, opacity: 0.36, phase: 2.4 },
      { paths: "46,61 54,51 69,49 82,56 86,68 80,81 66,87 52,81 46,71 46,61", width: 0.8, speed: 0.05, amplitude: 0.007, cursor: "repel" },
      { paths: "39,60 49,43 70,39 89,49 96,67 88,86 70,94 50,86 39,72 39,60", width: 0.58, opacity: 0.34, phase: 4.2 },
      { paths: "66,16 73,9 85,10 93,19 91,29 82,35 71,31 66,16", width: 0.66, speed: 0.07, amplitude: 0.005 },
      { paths: "62,15 72,4 89,3 99,15 97,31 84,40 68,34 62,15", width: 0.52, opacity: 0.3, phase: 1.4 },
    ],
  },
  {
    id: "water-tension", name: "Water Tension", category: "Liquid & Fluid",
    summary: "Soft loops and tension arcs responding like a water surface.",
    description: "Elongated rings and local arcs intersect at varied angles. A gentle cursor field suggests a ripple, with fine vibration limited to selected contours.",
    palette: ["#c4d7de", "#e5f1ee", "#87aebc", "#7d929d"],
    lines: [
      { paths: "8,29 18,16 37,13 53,23 57,40 47,54 28,57 12,46 8,29", motion: "floating", width: 0.8, cursor: "repel", cursorRadius: 0.22 },
      { paths: "3,28 15,8 39,4 61,17 66,40 52,59 29,64 8,49 3,28", width: 0.58, opacity: 0.36, phase: 2.8 },
      { paths: "47,62 58,50 74,51 87,63 88,79 75,90 58,87 48,76 47,62", motion: "vibration", width: 0.72, speed: 0.09, amplitude: 0.008 },
      { paths: "39,64 54,42 78,42 96,59 97,82 82,97 57,97 40,81 39,64", width: 0.54, opacity: 0.34, phase: 4.1 },
      { paths: "20,78 29,72 38,75 43,83", width: 0.62, opacity: 0.38, flow: "energy-pulse", flowSpeed: 0.14 },
      { paths: "72,18 78,12 86,14 90,22", width: 0.55, opacity: 0.32, flow: "continuous-light", flowSpeed: 0.11 },
    ],
  },
  {
    id: "crystal-structure", name: "Crystal Structure", category: "Geometric & Structural",
    summary: "Angular mineral forms with a few flexible bridges.",
    description: "Faceted clusters use distinct scale and orientation, connected by fine flexible spans. Rigid crystal edges stay crisp while the links answer the pointer.",
    palette: ["#dbe6ec", "#9bb8c9", "#c3b9df", "#f3f5ef"],
    lines: [
      { paths: "8,25 18,9 34,14 39,31 27,44 11,39 8,25|18,9 24,28 39,31|11,39 24,28 27,44", bendable: false, width: 0.9 },
      { paths: "57,17 74,7 90,17 94,36 80,48 61,41 57,17|74,7 76,27 94,36|61,41 76,27 80,48", bendable: false, width: 0.9 },
      { paths: "30,61 44,49 61,56 64,75 49,90 33,83 30,61|44,49 48,69 64,75|33,83 48,69 49,90", bendable: false, width: 0.9 },
      { paths: "27,44 36,54 30,61", width: 0.7, amplitude: 0.004, cursor: "attract" },
      { paths: "61,41 56,50 61,56", width: 0.72, amplitude: 0.004, flow: "continuous-light", flowSpeed: 0.12 },
      { paths: "49,90 61,96 73,89", width: 0.68, amplitude: 0.006, cursor: "attract" },
    ],
  },
  {
    id: "wireframe-cubes", name: "Wireframe Cubes", category: "Geometric & Structural",
    summary: "Three floating-scale cubes with carefully separated edges.",
    description: "Front and back faces are drawn as disconnected multistroke paths, preventing accidental diagonal joins. Quiet line weights and tiny offsets establish depth without filling the canvas.",
    palette: ["#d4ddd9", "#a3b3ae", "#e4e8e2", "#7c8e87"],
    lines: [
      { paths: "12,28 28,18 48,24 48,47 29,57 12,48 12,28|28,18 28,40 48,47|12,48 29,40 48,47|29,40 29,57", width: 0.85, bendable: false },
      { paths: "57,56 70,48 87,53 87,72 72,81 57,74 57,56|70,48 70,66 87,72|57,74 72,65 87,72|72,65 72,81", width: 0.75, bendable: false, color: 1 },
      { paths: "65,12 77,5 91,10 91,26 78,33 65,27 65,12|77,5 77,20 91,26|65,27 78,19 91,26|78,19 78,33", width: 0.72, bendable: false, color: 2 },
      { paths: "48,24 58,20 65,12", width: 0.6, opacity: 0.35, bendable: false },
      { paths: "29,57 42,66 57,56", width: 0.58, opacity: 0.34, bendable: false },
    ],
  },
  {
    id: "geometric-tension", name: "Geometric Tension", category: "Geometric & Structural",
    summary: "Hard-edged forms contrasted with taut moving diagonals.",
    description: "Partial polygons and clipped rectangles anchor a sparse structural composition. Only the diagonal tension lines deform, emphasizing the contrast between rigid and flexible geometry.",
    palette: ["#d7ddd7", "#a9b2ad", "#727d79", "#e8e8df"],
    lines: [
      { paths: "8,18 29,8 42,25 25,40 8,18", bendable: false, width: 0.95 },
      { paths: "58,13 89,13 89,38 70,43 58,30 58,13", bendable: false, width: 0.9 },
      { paths: "17,65 37,52 49,71 39,91 17,88 17,65", bendable: false, width: 0.88 },
      { paths: "66,63 91,57 96,83 76,92 66,63", bendable: false, width: 0.9 },
      { paths: "25,40 49,48 70,43", motion: "tension", speed: 0.14, amplitude: 0.009, width: 0.85, cursor: "attract" },
      { paths: "49,48 49,71", motion: "vibration", speed: 0.12, amplitude: 0.005, width: 0.76 },
      { paths: "39,91 57,80 76,92", motion: "tension", speed: 0.09, amplitude: 0.008, width: 0.82 },
    ],
  },
  {
    id: "orbital-rings", name: "Orbital Rings", category: "Light & Optical",
    summary: "Large quiet rings with asymmetric centers and clipped arcs.",
    description: "Four large orbital forms overlap lightly and leave generous open space. Their separate phases and small radii create slow orbit-like drift while preserving crisp contours.",
    palette: ["#d9e0e2", "#a8b8c2", "#c6cbd0", "#83929c"],
    lines: [
      { paths: "9,32 17,15 36,9 55,17 61,34 52,51 33,57 15,49 9,32", bendable: false, width: 0.75 },
      { paths: "43,24 54,10 73,7 89,17 94,34 86,48 68,53 51,44 43,24", bendable: false, width: 0.7 },
      { paths: "25,68 35,54 52,51 67,59 72,75 64,89 47,94 31,86 25,68", bendable: false, width: 0.75 },
      { paths: "62,69 71,58 86,58 97,68 98,83 88,94 74,91 64,81 62,69", bendable: false, width: 0.68 },
      { paths: "33,57 47,50 54,44", width: 0.58, opacity: 0.35, bendable: false },
      { paths: "52,51 64,59", width: 0.58, opacity: 0.34, flow: "continuous-light", flowSpeed: 0.1 },
    ],
  },
  {
    id: "light-trails", name: "Light Trails", category: "Light & Optical",
    summary: "Fine pale curves carrying individual traveling light bands.",
    description: "Asymmetric flowing trails sweep through three screen zones. Two lines carry slow continuous light and one carries a pulse; low-opacity bases keep the composition from blooming.",
    palette: ["#d8f2f0", "#80d9ee", "#9aabff", "#eeeaff"],
    wind: ["0,38 30,33 66,40 100,34"], windStrength: 0.2, windRadius: 0.17,
    lines: [
      { paths: "0,18 17,13 33,19 52,11 70,16 86,10 100,14", width: 0.82, opacity: 0.38, flow: "continuous-light", flowSpeed: 0.2, airflow: true, glow: 0.18 },
      { paths: "0,43 16,48 34,40 52,46 70,38 88,43 100,39", width: 0.75, opacity: 0.34, flow: "energy-pulse", flowSpeed: 0.16 },
      { paths: "2,69 20,63 38,70 55,62 73,68 91,61", width: 0.78, opacity: 0.36, flow: "continuous-light", flowSpeed: 0.14, phase: 2.3, airflow: true },
      { paths: "9,89 25,84 43,88 62,82 81,87 98,81", width: 0.68, opacity: 0.3, speed: 0.07, phase: 4.4 },
      { paths: "30,26 35,34 31,41", width: 0.52, opacity: 0.26, flow: "energy-pulse", flowSpeed: 0.12 },
    ],
  },
  {
    id: "aurora-threads", name: "Aurora Threads", category: "Light & Optical",
    summary: "Slow luminous curtains in green, cyan and blue.",
    description: "Vertical and leaning paths form separated light curtains with very gentle random airflow. Only selected threads have continuous color movement, leaving room for the darker sky.",
    palette: ["#a9ddc0", "#75d7d4", "#a0c9ed", "#c2b9e8"],
    wind: ["0,35 25,32 55,38 100,31", "0,65 31,69 66,62 100,67"], windStrength: 0.25, windRadius: 0.23,
    lines: [
      { paths: "12,4 16,21 11,38 18,55 13,74 20,96", width: 0.72, opacity: 0.36, flow: "continuous-light", flowSpeed: 0.12, airflow: true },
      { paths: "26,0 31,17 26,34 33,51 29,69 35,91", width: 0.62, opacity: 0.3, speed: 0.06, phase: 1.2, airflow: true },
      { paths: "45,6 41,22 48,38 44,56 51,74 47,98", width: 0.78, opacity: 0.38, flow: "fiber-optic", flowSpeed: 0.17, airflow: true },
      { paths: "61,1 66,19 60,37 68,55 63,73 70,94", width: 0.65, opacity: 0.32, phase: 3.1, airflow: true },
      { paths: "79,7 74,24 82,41 76,60 84,78 80,99", width: 0.74, opacity: 0.35, flow: "continuous-light", flowSpeed: 0.1, airflow: true },
      { paths: "92,0 88,16 94,30 89,45", width: 0.54, opacity: 0.25, phase: 4.8 },
    ],
  },
  {
    id: "optical-fiber-network", name: "Optical Fiber Network", category: "Light & Optical",
    summary: "Fine connected fibers with selected high-speed signals.",
    description: "Three branching clusters use thin structural links and a small set of fiber-optic channels. Color and speed vary by route; most lines remain unlit.",
    palette: ["#d6f5f0", "#6ed4df", "#86aee4", "#a9d2ac"],
    lines: [
      { paths: "10,18 23,12 34,21 46,16 52,29 39,37 25,31 23,12|34,21 36,7|52,29 64,22", width: 0.75, bendable: false },
      { paths: "8,72 20,63 33,70 45,61 54,72 42,83 28,81 20,63|33,70 35,55|54,72 67,66", width: 0.75, bendable: false },
      { paths: "70,40 80,31 92,36 94,50 83,58 71,53 70,40|80,31 81,18|94,50 99,62", width: 0.72, bendable: false },
      { paths: "46,16 58,24 70,40", width: 0.62, opacity: 0.4, flow: "fiber-optic", flowSpeed: 0.36 },
      { paths: "54,72 66,59 71,53", width: 0.62, opacity: 0.42, flow: "fiber-optic", flowSpeed: 0.24, flowDirection: "reverse" },
      { paths: "39,37 51,48 54,61", width: 0.58, opacity: 0.36, flow: "continuous-light", flowSpeed: 0.16 },
      { paths: "81,58 76,70 83,82", width: 0.6, opacity: 0.38, cursor: "attract", glow: 0.2 },
    ],
  },
  {
    id: "chaotic-harmony", name: "Chaotic Harmony", category: "Experimental & Abstract",
    summary: "A balanced collision of loops, diagonals and quiet breaks.",
    description: "Several independent shapes overlap with varied rhythms, widths and material weights. Attraction and repulsion are mixed across selected lines, while deliberate empty zones hold the composition together.",
    palette: ["#e2e4df", "#8c9995", "#b1a98f", "#c6d0d0"],
    wind: ["0,30 22,34 48,27 73,33 100,28", "0,76 28,71 60,79 100,73"], windStrength: 0.31, windRadius: 0.18,
    lines: [
      { paths: "3,16 17,8 31,16 28,31 13,36 3,16", motion: "floating", width: 0.9, speed: 0.1, cursor: "attract" },
      { paths: "44,8 57,14 65,27 58,39 43,36 37,21 44,8", motion: "vibration", width: 0.78, speed: 0.16, cursor: "repel" },
      { paths: "78,10 94,18 88,34 72,39 67,24 78,10", motion: "floating", width: 0.85, speed: 0.07, phase: 3.4 },
      { paths: "7,59 19,51 34,57 39,71 28,84 12,78 7,59", texture: "fiber", width: 0.95, speed: 0.08, cursor: "repel" },
      { paths: "48,55 62,47 76,54 79,70 66,81 51,74 48,55", texture: "silk", width: 0.84, speed: 0.06, cursor: "attract", airflow: true },
      { paths: "88,58 98,66 92,82 78,87 72,75", motion: "vibration", width: 0.72, speed: 0.13, phase: 2.1 },
      { paths: "28,31 41,42 48,55", width: 0.68, opacity: 0.35, flow: "energy-pulse", flowSpeed: 0.19 },
      { paths: "65,27 72,39 66,47", width: 0.62, opacity: 0.32, flow: "continuous-light", flowSpeed: 0.12 },
    ],
  },
  {
    id: "living-architecture", name: "Living Architecture", category: "Experimental & Abstract",
    summary: "Quiet facades and arches with a few living connections.",
    description: "Rigid architectural outlines and partial grids define the frame. A handful of softer links and one moving light add life without compromising the clean structure.",
    palette: ["#d7dedb", "#9aa6a1", "#b1b49c", "#edf0e9"],
    light: { color: "#d0e4c4", from: { x: 0.1, y: 0.7 }, to: { x: 0.9, y: 0.25 }, radius: 0.18, intensity: 0.26, speed: 0.06 },
    lines: [
      { paths: "8,19 8,7 31,7 31,19 8,19|8,19 8,48 31,48 31,19|31,7 48,7 48,25", bendable: false, width: 0.9 },
      { paths: "57,14 57,5 91,5 91,14 57,14|57,14 57,44 74,44 74,14|74,14 91,14 91,35 82,35", bendable: false, width: 0.85 },
      { paths: "12,61 12,52 36,52 36,61 12,61|12,61 12,91 36,91 36,61|36,52 51,52 51,72", bendable: false, width: 0.9 },
      { paths: "66,62 66,51 92,51 92,62 66,62|66,62 66,91 92,91 92,62|92,62 98,70 98,88", bendable: false, width: 0.85 },
      { paths: "48,25 53,38 49,52", width: 0.72, cursor: "attract", amplitude: 0.004 },
      { paths: "51,72 58,79 66,77", width: 0.68, flow: "continuous-light", flowSpeed: 0.1 },
      { paths: "74,44 73,53 66,62", width: 0.65, opacity: 0.4, cursor: "attract" },
    ],
  },
];

export const ORGANIC_ATMOSPHERIC_TEMPLATES: SceneTemplateDefinition[] = TEMPLATES.map(buildTemplate);

export function getSceneTemplateById(id: string): SceneTemplateDefinition | undefined {
  return ORGANIC_ATMOSPHERIC_TEMPLATES.find((template) => template.id === id);
}
