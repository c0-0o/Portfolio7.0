import type { Point, TextureType } from "./types";
import { perpendicular, pointsToSmoothPath } from "./engine/math";

export interface TextureStrokeLayer {
  id: string;
  width: number;
  opacity: number;
  dashArray?: string;
  dashOffset: number;
  lineCap: "butt" | "round";
  filter?: "grain";
  offset?: number;
  offsetWave?: number;
  offsetWaveFrequency?: number;
  offsetWaveFollowsAirflow?: boolean;
  offsetPhase?: number;
  motionSpeed?: number;
  chainPart?: keyof MetalChainPaths;
  colorTone?: "shadow" | "glint";
}

export function getTextureLayerStrokeWidth(lineWidth: number, layer: Pick<TextureStrokeLayer, "id" | "width">): number {
  return Math.max(layer.id.startsWith("silk-") ? 0.45 : 0.5, lineWidth * layer.width);
}

export interface MetalChainPaths {
  outline: string;
  steel: string;
  glint: string;
}

export interface BeadFlowOverlay {
  centers: Array<{ point: Point; progress: number }>;
  radius: number;
}

export function getDefaultTextureWeight(type: TextureType): number {
  const weights: Record<TextureType, number> = {
    grain: 0.9,
    fiber: 0.85,
    silk: 0.55,
    rope: 1.25,
    beads: 1.75,
    metal: 2.2,
  };
  return weights[type];
}

function texturePeriod(scale: number): number {
  return Math.min(0.08, Math.max(0.008, scale * 1.25));
}

const textureLayerCache = new Map<string, TextureStrokeLayer[]>();

export function getTextureStrokeLayers(
  type: TextureType,
  scale: number,
  showThread: boolean,
  silkStrands = 8,
): TextureStrokeLayer[] {
  const count = Math.min(24, Math.max(1, Math.round(silkStrands)));
  const key = `${type}:${scale}:${showThread}:${count}`;
  const cached = textureLayerCache.get(key);
  if (cached) return cached;

  const layers = buildTextureStrokeLayers(type, scale, showThread, count);
  if (textureLayerCache.size >= 128) {
    const oldestKey = textureLayerCache.keys().next().value;
    if (oldestKey !== undefined) textureLayerCache.delete(oldestKey);
  }
  textureLayerCache.set(key, layers);
  return layers;
}

function buildTextureStrokeLayers(
  type: TextureType,
  scale: number,
  showThread: boolean,
  silkStrands: number,
): TextureStrokeLayer[] {
  const period = texturePeriod(scale);
  if (type === "grain") {
    return [{ id: "grain", width: 1.2, opacity: 0.45, dashOffset: 0, lineCap: "round", filter: "grain" }];
  }
  if (type === "fiber") {
    return [{
      id: "fiber",
      width: 0.7,
      opacity: 0.45,
      dashArray: `${Math.max(0.001, scale * 0.18)} ${Math.max(0.006, scale * 0.9)}`,
      dashOffset: 0,
      lineCap: "round",
    }];
  }
  if (type === "silk") {
    const count = Math.min(24, Math.max(1, Math.round(silkStrands)));
    const gaps = Array.from({ length: Math.max(0, count - 1) }, (_, index) => {
      const sample = Math.sin((index + 1) * 127.1 + count * 78.233) * 43758.5453;
      return 0.3 + (sample - Math.floor(sample)) * 1.7;
    });
    const totalGap = gaps.reduce((total, gap) => total + gap, 0);
    let positionAlongBundle = 0;
    return Array.from({ length: count }, (_, index) => {
      const position = count === 1 ? 0 : (positionAlongBundle / totalGap) * 2 - 1;
      if (index < gaps.length) positionAlongBundle += gaps[index];
      const edgeFade = 1 - Math.abs(position) * 0.1;
      const phaseSample = Math.sin((index + 1) * 93.17 + count * 41.73) * 15731.743;
      const phaseNoise = phaseSample - Math.floor(phaseSample);
      const waveSample = Math.sin((index + 1) * 61.91 + count * 27.37) * 29317.117;
      const waveNoise = waveSample - Math.floor(waveSample);
      return {
        id: `silk-filament-${index + 1}`,
        width: (0.22 + (index % 3) * 0.035) * edgeFade,
        opacity: (0.72 + ((index * 7) % 4) * 0.07) * edgeFade,
        dashOffset: 0,
        lineCap: "butt" as const,
        offset: position * 1.55,
        offsetWave: 0.45 + waveNoise * 0.45,
        offsetWaveFollowsAirflow: true,
        offsetPhase: phaseNoise * Math.PI * 2,
        motionSpeed: 0.55 + phaseNoise * 0.65,
      };
    });
  }
  if (type === "rope") {
    const plies = Array.from({ length: 3 }, (_, index) => {
      const phase = (index * Math.PI * 2) / 3;
      const offset = index - 1;
      return [
        {
          id: `rope-ply-${index + 1}`,
          width: 1.2,
          opacity: 0.86,
          dashOffset: 0,
          lineCap: "round" as const,
          offset: offset * 0.45,
          offsetWave: 0.62,
          offsetWaveFrequency: 6,
          offsetPhase: phase,
        },
        {
          id: `rope-fiber-${index + 1}`,
          width: 0.26,
          opacity: 0.72,
          dashOffset: 0,
          lineCap: "round" as const,
          offset: offset * 0.45 + 0.18,
          offsetWave: 0.62,
          offsetWaveFrequency: 6,
          offsetPhase: phase,
          colorTone: "glint" as const,
        },
      ];
    }).flat();
    return [
      { id: "rope-core", width: 2.8, opacity: 0.4, dashOffset: 0, lineCap: "round", colorTone: "shadow" },
      ...plies,
    ];
  }
  if (type === "metal") {
    return [
      { id: "metal-core", width: 1.35, opacity: 0.42, dashOffset: 0, lineCap: "round", colorTone: "shadow" },
      { id: "metal-chain-outline", width: 1.55, opacity: 0.78, dashOffset: 0, lineCap: "round", chainPart: "outline", colorTone: "shadow" },
      { id: "metal-chain-steel", width: 0.9, opacity: 0.96, dashOffset: 0, lineCap: "round", chainPart: "steel" },
      { id: "metal-chain-glint", width: 0.32, opacity: 0.82, dashOffset: 0, lineCap: "round", chainPart: "glint", colorTone: "glint" },
    ];
  }
  return [
    ...(showThread ? [{ id: "bead-thread", width: 0.42, opacity: 0.7, dashOffset: 0, lineCap: "round" as const }] : []),
    { id: "bead-rim", width: 3.1, opacity: 0.68, dashArray: `0 ${period}`, dashOffset: 0, lineCap: "round", colorTone: "shadow" },
    { id: "bead-face", width: 2.35, opacity: 0.96, dashArray: `0 ${period}`, dashOffset: 0, lineCap: "round" },
    { id: "bead-highlight", width: 0.78, opacity: 0.72, dashArray: `0 ${period}`, dashOffset: period * 0.24, lineCap: "round", colorTone: "glint" },
  ];
}

export function getMetalChainPaths(
  points: Point[],
  lineWidth: number,
  segmentLengths: number[],
  scale: number,
): MetalChainPaths {
  const paths: MetalChainPaths = { outline: "", steel: "", glint: "" };
  let segmentStart = 0;
  let remainingLinks = 256;
  const width = Math.max(0.5, lineWidth);

  for (const segmentLength of segmentLengths) {
    if (remainingLinks === 0) break;
    const segment = points.slice(segmentStart, segmentStart + segmentLength);
    segmentStart += segmentLength;
    if (segment.length < 2) continue;

    const distances = [0];
    for (let index = 1; index < segment.length; index++) {
      const previous = segment[index - 1];
      const current = segment[index];
      distances.push(distances[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
    }
    const length = distances[distances.length - 1];
    if (length <= 0.0001) continue;

    const spacing = Math.max(width * 2.8, length * Math.max(0.006, scale * 1.25));
    const linkCount = Math.min(remainingLinks, Math.max(1, Math.floor(length / spacing)));
    const actualSpacing = length / linkCount;
    const radiusX = actualSpacing * 0.64;
    const radiusY = Math.max(width * 0.9, actualSpacing * 0.16);

    for (let linkIndex = 0; linkIndex < linkCount; linkIndex++) {
      const centerDistance = (linkIndex + 0.5) * actualSpacing;
      let segmentIndex = 1;
      while (segmentIndex < distances.length - 1 && distances[segmentIndex] < centerDistance) segmentIndex++;
      const start = segment[segmentIndex - 1];
      const end = segment[segmentIndex];
      const edgeLength = Math.max(0.0001, distances[segmentIndex] - distances[segmentIndex - 1]);
      const progress = (centerDistance - distances[segmentIndex - 1]) / edgeLength;
      const center = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
      };
      const previous = segment[Math.max(0, segmentIndex - 2)];
      const next = segment[Math.min(segment.length - 1, segmentIndex + 1)];
      const tangentAngle = Math.atan2(next.y - previous.y, next.x - previous.x);
      const side = linkIndex % 2 === 0 ? -1 : 1;
      const normalAngle = tangentAngle + Math.PI / 2;
      center.x += Math.cos(normalAngle) * width * 0.12 * side;
      center.y += Math.sin(normalAngle) * width * 0.12 * side;
      const twist = side * 0.38;
      const rotation = tangentAngle + twist;
      const angleDegrees = rotation * 180 / Math.PI;
      const ellipsePoint = (angle: number) => ({
        x: center.x + Math.cos(rotation) * radiusX * Math.cos(angle) - Math.sin(rotation) * radiusY * Math.sin(angle),
        y: center.y + Math.sin(rotation) * radiusX * Math.cos(angle) + Math.cos(rotation) * radiusY * Math.sin(angle),
      });
      const right = ellipsePoint(0);
      const left = ellipsePoint(Math.PI);
      const rightText = `${right.x.toFixed(2)} ${right.y.toFixed(2)}`;
      const leftText = `${left.x.toFixed(2)} ${left.y.toFixed(2)}`;
      const ellipse = `M ${rightText} A ${radiusX.toFixed(2)} ${radiusY.toFixed(2)} ${angleDegrees.toFixed(2)} 0 1 ${leftText} A ${radiusX.toFixed(2)} ${radiusY.toFixed(2)} ${angleDegrees.toFixed(2)} 0 1 ${rightText}`;
      paths.outline += `${ellipse} `;
      paths.steel += `${ellipse} `;

      const glintPoints = Array.from({ length: 9 }, (_, index) => {
        const point = ellipsePoint(3.45 + index * 0.11);
        return `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
      });
      paths.glint += `M ${glintPoints.join(" L ")} `;
      remainingLinks--;
    }
  }

  return paths;
}

export function getTextureMaterialResponse(type: TextureType, weight: number, enabled: boolean): number {
  if (!enabled) return 1;
  const flexibility: Record<TextureType, number> = {
    grain: 0.9,
    fiber: 0.85,
    silk: 1.75,
    rope: 0.72,
    beads: 0.52,
    metal: 0.6,
  };
  return Math.min(2.2, Math.max(0.25, flexibility[type] / Math.max(0.1, weight)));
}

export function getTextureLightResponse(type: TextureType, enabled: boolean): number {
  if (!enabled) return 1;
  const reflectance: Record<TextureType, number> = {
    grain: 0.8,
    fiber: 0.78,
    silk: 1.45,
    rope: 0.72,
    beads: 1.22,
    metal: 1.3,
  };
  return reflectance[type];
}

export function getTextureGravityResponse(type: TextureType, weight: number, enabled: boolean): number {
  if (!enabled) return 1;
  const density: Record<TextureType, number> = {
    grain: 0.9,
    fiber: 0.82,
    silk: 0.3,
    rope: 1,
    beads: 1.15,
    metal: 1.2,
  };
  const relativeWeight = Math.sqrt(Math.max(0.1, weight) / getDefaultTextureWeight(type));
  return Math.min(1.6, Math.max(0.12, density[type] * relativeWeight));
}

export function offsetTexturePoints(
  points: Point[],
  width: number,
  offset = 0,
  segmentLengths: number[] = [points.length],
  wave = 0,
  phase = 0,
  waveFrequency = 1,
): Point[][] {
  let start = 0;
  return segmentLengths.map((length) => {
    const segment = points.slice(start, start + length);
    start += length;
    const closed = segment.length > 2 &&
      segment[0].x === segment[segment.length - 1].x &&
      segment[0].y === segment[segment.length - 1].y;
    if ((offset === 0 && wave === 0) || segment.length < 2) return segment;
    const shifted = segment.map((point, index) => {
      const previous = closed && index === 0 ? segment[segment.length - 2] : segment[Math.max(0, index - 1)];
      const next = closed && index === segment.length - 1 ? segment[1] : segment[Math.min(segment.length - 1, index + 1)];
      const normal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
      const progress = index / Math.max(1, segment.length - 1);
      const distance = width * (offset + Math.sin(progress * Math.PI * 2 * waveFrequency + phase) * wave);
      return { x: point.x + normal.x * distance, y: point.y + normal.y * distance };
    });
    if (closed) shifted[shifted.length - 1] = shifted[0];
    return shifted;
  });
}

export function offsetTexturePath(
  points: Point[],
  width: number,
  offset = 0,
  segmentLengths: number[] = [points.length],
  wave = 0,
  phase = 0,
  waveFrequency = 1,
): string {
  return offsetTexturePoints(points, width, offset, segmentLengths, wave, phase, waveFrequency)
    .map((segment) => {
      const closed = segment.length > 2 &&
        segment[0].x === segment[segment.length - 1].x &&
        segment[0].y === segment[segment.length - 1].y;
      return pointsToSmoothPath(segment, closed);
    })
    .join(" ");
}

export function getMaterialFlowPaths(
  type: TextureType,
  points: Point[],
  lineWidth: number,
  segmentLengths: number[],
  layers: TextureStrokeLayer[],
  airflow = 0,
  time = 0,
  scale = 0.02,
): Point[][] {
  if (type === "metal") return getMetalChainFlowPaths(points, lineWidth, segmentLengths, scale);
  if (type !== "silk" && type !== "rope") {
    let start = 0;
    const segments = segmentLengths.map((length) => {
      const segment = points.slice(start, start + length);
      start += length;
      return segment;
    }).filter((segment) => segment.length > 1);
    if (type !== "grain") return segments;
    return segments.map((segment, segmentIndex) => {
      const amplitude = Math.max(0.12, Math.min(lineWidth * 0.14, scale * lineWidth * 6));
      const phase = segmentIndex * 1.91 + segment.length * 0.37;
      return segment.map((point, index) => {
        const previous = segment[Math.max(0, index - 1)];
        const next = segment[Math.min(segment.length - 1, index + 1)];
        const normal = perpendicular({ x: next.x - previous.x, y: next.y - previous.y });
        const roughness = Math.sin(index * 1.73 + phase) * 0.58 + Math.sin(index * 0.67 - phase * 1.4) * 0.42;
        const displacement = roughness * amplitude;
        return { x: point.x + normal.x * displacement, y: point.y + normal.y * displacement };
      });
    });
  }

  const paths = type === "silk"
    ? layers
    : layers.filter((layer) => layer.id.startsWith("rope-ply-"));
  return paths.flatMap((layer) => offsetTexturePoints(
    points,
    lineWidth,
    layer.offset,
    segmentLengths,
    (layer.offsetWave ?? 0) * (layer.offsetWaveFollowsAirflow ? airflow : 1),
    (layer.offsetPhase ?? 0) + time * (layer.motionSpeed ?? 0),
    layer.offsetWaveFrequency ?? 1,
  ));
}

export function getBeadFlowOverlay(
  points: Point[],
  lineWidth: number,
  segmentLengths: number[],
  scale: number,
): BeadFlowOverlay {
  const centers: BeadFlowOverlay["centers"] = [];
  let start = 0;
  for (const segmentLength of segmentLengths) {
    const segment = points.slice(start, start + segmentLength);
    start += segmentLength;
    if (segment.length < 2) continue;

    const distances = [0];
    for (let index = 1; index < segment.length; index++) {
      distances.push(distances[index - 1] + Math.hypot(
        segment[index].x - segment[index - 1].x,
        segment[index].y - segment[index - 1].y,
      ));
    }
    const length = distances[distances.length - 1];
    if (length <= 0.0001) continue;
    const spacing = Math.max(lineWidth * 2, length * texturePeriod(scale));
    const beadCount = Math.max(1, Math.floor(length / spacing));
    const actualSpacing = length / beadCount;

    for (let index = 0; index < beadCount; index++) {
      const target = (index + 0.5) * actualSpacing;
      let edge = 1;
      while (edge < distances.length - 1 && distances[edge] < target) edge++;
      const edgeLength = Math.max(0.0001, distances[edge] - distances[edge - 1]);
      const amount = (target - distances[edge - 1]) / edgeLength;
      centers.push({
        point: {
          x: segment[edge - 1].x + (segment[edge].x - segment[edge - 1].x) * amount,
          y: segment[edge - 1].y + (segment[edge].y - segment[edge - 1].y) * amount,
        },
        progress: (index + 0.5) / beadCount,
      });
    }
  }
  return { centers, radius: Math.max(1, Math.min(lineWidth * 1.05, scale * lineWidth * 24)) };
}

export function getMaterialFlowWidthScale(type: TextureType): number {
  const scales: Record<TextureType, number> = {
    grain: 0.72,
    fiber: 0.62,
    silk: 0.2,
    rope: 0.3,
    beads: 0.42,
    metal: 0.36,
  };
  return scales[type];
}

export function getMetalChainFlowPaths(
  points: Point[],
  lineWidth: number,
  segmentLengths: number[],
  scale: number,
): Point[][] {
  const paths: Point[][] = [];
  let segmentStart = 0;
  let remainingLinks = 256;
  const width = Math.max(0.5, lineWidth);

  for (const segmentLength of segmentLengths) {
    const segment = points.slice(segmentStart, segmentStart + segmentLength);
    segmentStart += segmentLength;
    if (segment.length < 2 || remainingLinks === 0) continue;

    const distances = [0];
    for (let index = 1; index < segment.length; index++) {
      distances.push(distances[index - 1] + Math.hypot(
        segment[index].x - segment[index - 1].x,
        segment[index].y - segment[index - 1].y,
      ));
    }
    const length = distances[distances.length - 1];
    if (length <= 0.0001) continue;
    const spacing = Math.max(width * 2.8, length * Math.max(0.006, scale * 1.25));
    const linkCount = Math.min(remainingLinks, Math.max(1, Math.floor(length / spacing)));
    const actualSpacing = length / linkCount;
    const radiusX = actualSpacing * 0.64;
    const radiusY = Math.max(width * 0.9, actualSpacing * 0.16);

    for (let linkIndex = 0; linkIndex < linkCount; linkIndex++) {
      const centerDistance = (linkIndex + 0.5) * actualSpacing;
      let edge = 1;
      while (edge < distances.length - 1 && distances[edge] < centerDistance) edge++;
      const edgeLength = Math.max(0.0001, distances[edge] - distances[edge - 1]);
      const amount = (centerDistance - distances[edge - 1]) / edgeLength;
      const center = {
        x: segment[edge - 1].x + (segment[edge].x - segment[edge - 1].x) * amount,
        y: segment[edge - 1].y + (segment[edge].y - segment[edge - 1].y) * amount,
      };
      const previous = segment[Math.max(0, edge - 2)];
      const next = segment[Math.min(segment.length - 1, edge + 1)];
      const tangentAngle = Math.atan2(next.y - previous.y, next.x - previous.x);
      const side = linkIndex % 2 === 0 ? -1 : 1;
      const normalAngle = tangentAngle + Math.PI / 2;
      center.x += Math.cos(normalAngle) * width * 0.12 * side;
      center.y += Math.sin(normalAngle) * width * 0.12 * side;
      const rotation = tangentAngle + side * 0.38;
      const ring = Array.from({ length: 17 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        return {
          x: center.x + Math.cos(rotation) * radiusX * Math.cos(angle) - Math.sin(rotation) * radiusY * Math.sin(angle),
          y: center.y + Math.sin(rotation) * radiusX * Math.cos(angle) + Math.cos(rotation) * radiusY * Math.sin(angle),
        };
      });
      paths.push(ring);
      remainingLinks--;
      if (remainingLinks === 0) break;
    }
  }
  return paths;
}
