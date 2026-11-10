import type { FlowConfig, Point } from "../types";
import { clamp01, distance, perpendicular } from "./math";

export const FLOW_LAYER_COUNT = 8;

export interface FlowPathSample {
  point: Point;
  tangent: Point;
  normal: Point;
  curvature: number;
  distance: number;
  progress: number;
  closed: boolean;
}

export interface FlowGeometry {
  paths: FlowPathSample[][];
  pathData: string;
  totalLength: number;
}

export interface FlowLayerFrame {
  pathData: string;
  color: string;
  width: number;
  opacity: number;
  fill?: boolean;
  dashArray?: string;
  dashOffset?: number;
  lineCap?: "butt" | "round" | "square";
  blur?: number;
}

export type FlowEffectRenderer = (
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
) => Array<FlowLayerFrame | null>;

function normalize(vector: Point): Point {
  const magnitude = Math.hypot(vector.x, vector.y);
  return magnitude > 0.00001 ? { x: vector.x / magnitude, y: vector.y / magnitude } : { x: 1, y: 0 };
}

function pathString(paths: Point[][], closedPaths: boolean[] = []): string {
  return paths
    .filter((points) => points.length > 0)
    .map((points, index) => `M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}${closedPaths[index] ? " Z" : ""}`)
    .join(" ");
}

function rangeIndices(lengths: number[], pointCount: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (const length of lengths) {
    const end = Math.min(pointCount, start + Math.max(0, Math.floor(length)));
    if (end > start) ranges.push({ start, end });
    start = end;
  }
  if (start < pointCount) ranges.push({ start, end: pointCount });
  return ranges;
}

export function createFlowGeometry(points: Point[], segmentLengths: number[]): FlowGeometry {
  const paths: FlowPathSample[][] = [];
  const ranges = rangeIndices(segmentLengths, points.length);
  let totalLength = 0;

  for (const range of ranges) {
    const source = points.slice(range.start, range.end);
    if (source.length === 0) continue;
    const closed = source.length > 3 &&
      source[0].x === source[source.length - 1].x &&
      source[0].y === source[source.length - 1].y;
    const uniquePointCount = closed ? source.length - 1 : source.length;
    const distances = [0];
    for (let index = 1; index < source.length; index++) {
      distances.push(distances[index - 1] + distance(source[index - 1], source[index]));
    }
    const pathLength = distances[distances.length - 1] ?? 0;
    const path = source.map((point, index) => {
      const previousIndex = closed ? (index - 1 + uniquePointCount) % uniquePointCount : Math.max(0, index - 1);
      const nextIndex = closed ? (index + 1) % uniquePointCount : Math.min(source.length - 1, index + 1);
      const previous = source[previousIndex];
      const next = source[nextIndex];
      const tangent = normalize({ x: next.x - previous.x, y: next.y - previous.y });
      const before = closed || index > 0 ? normalize({ x: point.x - previous.x, y: point.y - previous.y }) : tangent;
      const after = closed || index + 1 < source.length ? normalize({ x: next.x - point.x, y: next.y - point.y }) : tangent;
      const span = index > 0 && index + 1 < source.length
        ? Math.max(0.0001, distances[index + 1] - distances[index - 1])
        : 1;
      const curvature = Math.atan2(before.x * after.y - before.y * after.x, before.x * after.x + before.y * after.y) / span;
      return {
        point,
        tangent,
        normal: perpendicular(tangent),
        curvature,
        distance: distances[index],
        progress: pathLength > 0 ? distances[index] / pathLength : 0,
        closed,
      };
    });
    paths.push(path);
    totalLength += pathLength;
  }

  return {
    paths,
    pathData: pathString(
      paths.map((path) => path.map((sample) => sample.point)),
      paths.map((path) => path[0]?.closed ?? false),
    ),
    totalLength,
  };
}

export function sampleFlowPath(path: FlowPathSample[], progress: number): FlowPathSample | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const target = clamp01(progress) * (path[path.length - 1].distance ?? 0);
  let low = 1;
  let high = path.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (path[middle].distance < target) low = middle + 1;
    else high = middle;
  }
  const after = path[low];
  const before = path[low - 1];
  const interval = after.distance - before.distance;
  const amount = interval > 0 ? clamp01((target - before.distance) / interval) : 0;
  const tangent = normalize({
    x: before.tangent.x + (after.tangent.x - before.tangent.x) * amount,
    y: before.tangent.y + (after.tangent.y - before.tangent.y) * amount,
  });
  return {
    point: {
      x: before.point.x + (after.point.x - before.point.x) * amount,
      y: before.point.y + (after.point.y - before.point.y) * amount,
    },
    tangent,
    normal: perpendicular(tangent),
    curvature: before.curvature + (after.curvature - before.curvature) * amount,
    distance: target,
    progress: clamp01(progress),
    closed: before.closed,
  };
}

function modulo(value: number, divisor = 1): number {
  return ((value % divisor) + divisor) % divisor;
}

function hash(index: number): number {
  let value = (index | 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function parseHex(color: string): [number, number, number] {
  const value = color.replace("#", "").trim();
  if (/^[\da-f]{3}$/i.test(value)) {
    return value.split("").map((character) => parseInt(character + character, 16)) as [number, number, number];
  }
  if (/^[\da-f]{6}$/i.test(value)) {
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }
  return [94, 230, 255];
}

function colorAt(config: FlowConfig, time: number, position = 0): string {
  const colors = config.colors.length ? config.colors : ["#5ee6ff"];
  if (colors.length === 1) return colors[0];
  const phase = modulo(time * config.colorSpeed + position * (colors.length - 1), colors.length);
  const index = Math.floor(phase);
  const amount = phase - index;
  const first = parseHex(colors[index % colors.length]);
  const second = parseHex(colors[(index + 1) % colors.length]);
  return `#${first.map((channel, component) =>
    Math.round(channel + (second[component] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function streamProgress(config: FlowConfig, time: number, index: number, count: number): { progress: number; direction: 1 | -1 } {
  let direction: 1 | -1 = config.direction === "reverse" ? -1 : 1;
  if (config.direction === "both") direction = index % 2 === 0 ? 1 : -1;
  if (config.direction === "alternating" && Math.floor(time * Math.max(0.05, config.speed)) % 2 === 1) direction = -1;
  const progress = modulo(time * config.speed * direction + config.phase + index / Math.max(1, count));
  return { progress, direction };
}

function layer(
  pathData: string,
  color: string,
  width: number,
  opacity: number,
  options: Partial<Pick<FlowLayerFrame, "fill" | "dashArray" | "dashOffset" | "lineCap" | "blur">> = {},
): FlowLayerFrame | null {
  if (!pathData || opacity <= 0 || width <= 0) return null;
  return { pathData, color, width, opacity: clamp01(opacity), lineCap: "round", ...options };
}

function fullPath(config: FlowConfig, name: keyof FlowConfig["layers"], data: string, color: string, width: number, opacity: number) {
  return config.layers[name] ? layer(data, color, width, opacity) : null;
}

function shiftedPath(geometry: FlowGeometry, amount: (progress: number, strand: number) => number, strand = 0): string {
  return pathString(
    geometry.paths.map((path) => path.map((sample) => {
      const offset = amount(sample.progress, strand);
      return {
        x: sample.point.x + sample.normal.x * offset,
        y: sample.point.y + sample.normal.y * offset,
      };
    })),
    geometry.paths.map((path) => path[0]?.closed ?? false),
  );
}

function circlePath(point: Point, radius: number): string {
  return `M ${point.x - radius} ${point.y} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
}

function electricCurrent(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  const frame: Array<FlowLayerFrame | null> = Array(FLOW_LAYER_COUNT).fill(null);
  const motionTime = reducedMotion ? time * 0.04 : time;
  const flicker = 1 - config.flicker * 0.22 * (0.5 + 0.5 * Math.sin(motionTime * 20));
  const intensity = config.intensity * config.opacity * flicker;
  const { progress } = streamProgress(config, motionTime, 0, 1);
  frame[0] = config.layers.glow
    ? layer(pathData, config.glowColor, lineWidth * config.glowWidth, intensity * 0.16, { blur: Math.max(0.75, lineWidth * config.glowWidth * 0.6) })
    : null;
  frame[1] = fullPath(
    config,
    "current",
    pathData,
    colorAt(config, motionTime),
    lineWidth * config.width,
    intensity * 0.74,
  );
  if (frame[1]) {
    frame[1]!.dashArray = "0.34 0.18";
    frame[1]!.dashOffset = -progress;
  }
  frame[2] = fullPath(config, "core", pathData, config.coreColor, lineWidth * config.coreWidth, intensity * 0.95);
  if (frame[2]) {
    frame[2]!.dashArray = "0.18 0.24";
    frame[2]!.dashOffset = -progress;
  }

  if (config.layers.branches && !reducedMotion) {
    const branches: string[] = [];
    const count = Math.round(config.branchFrequency * 12);
    for (let index = 0; index < count; index++) {
      const seed = hash(index * 17 + 3);
      const at = (seed * 0.88 + 0.06);
      const path = geometry.paths[Math.floor(seed * geometry.paths.length)];
      const anchor = path && sampleFlowPath(path, at);
      if (!anchor) continue;
      const side = index % 2 === 0 ? 1 : -1;
      const length = config.branchLength * lineWidth * 12 * (0.45 + seed);
      const branchPoints: Point[] = [anchor.point];
      let x = anchor.point.x;
      let y = anchor.point.y;
      for (let step = 1; step <= 3; step++) {
        const bend = (hash(index * 71 + step) - 0.5) * length * 0.52;
        const progress = step / 3;
        x += anchor.normal.x * side * length / 3 + anchor.tangent.x * bend;
        y += anchor.normal.y * side * length / 3 + anchor.tangent.y * bend;
        branchPoints.push({ x: anchor.point.x + (x - anchor.point.x) * progress, y: anchor.point.y + (y - anchor.point.y) * progress });
      }
      branches.push(pathString([branchPoints]));
    }
    frame[3] = layer(branches.join(" "), colorAt(config, motionTime, 0.45), Math.max(0.6, lineWidth * 0.75), intensity * 0.82);
  }

  if (config.layers.sparks && !reducedMotion) {
    const sparks: string[] = [];
    const count = Math.round(config.sparkDensity * 18);
    for (let index = 0; index < count; index++) {
      const path = geometry.paths[index % Math.max(1, geometry.paths.length)];
      if (!path) continue;
      const seed = hash(index * 29 + 7);
      const sample = sampleFlowPath(path, modulo(motionTime * config.speed * (0.25 + seed) + seed));
      if (sample) sparks.push(circlePath(sample.point, Math.max(0.35, lineWidth * (0.25 + seed * 0.45))));
    }
    frame[4] = layer(sparks.join(" "), config.coreColor, lineWidth, intensity * 0.88, { fill: true });
  }
  return frame;
}

function extractWindow(geometry: FlowGeometry, head: number, length: number, direction: 1 | -1): string {
  const paths: Point[][] = [];
  for (const path of geometry.paths) {
    if (path.length < 2) continue;
    const pieces: Array<[number, number]> = [];
    if (direction > 0) {
      const start = head - length;
      if (start < 0) pieces.push([0, head], [1 + start, 1]);
      else pieces.push([start, head]);
    } else {
      const end = head + length;
      if (end > 1) pieces.push([head, 1], [0, end - 1]);
      else pieces.push([head, end]);
    }
    for (const [from, to] of pieces) {
      if (to <= from) continue;
      const samples = Math.max(2, Math.ceil((path.length - 1) * (to - from)));
      const points = Array.from({ length: samples + 1 }, (_, index) =>
        sampleFlowPath(path, from + (to - from) * index / samples)?.point).filter((point): point is Point => !!point);
      if (direction < 0) points.reverse();
      if (points.length > 1) paths.push(points);
    }
  }
  return pathString(paths);
}

function continuousLight(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  const frame: Array<FlowLayerFrame | null> = Array(FLOW_LAYER_COUNT).fill(null);
  const motionTime = reducedMotion ? time * 0.04 : time;
  frame[0] = fullPath(config, "current", pathData, colorAt(config, motionTime, 0.25), lineWidth * config.width * 0.55, config.opacity * config.intensity * 0.18);
  const count = Math.min(3, config.streamCount);
  for (let index = 0; index < count; index++) {
    const { progress, direction } = streamProgress(config, motionTime, index, count);
    const window = extractWindow(geometry, progress, config.tailLength, direction);
    frame[1 + index * 2] = config.layers[index === 0 ? "glow" : "secondary"]
      ? layer(window, config.glowColor, lineWidth * config.glowWidth, config.opacity * config.intensity * 0.2, { blur: Math.max(0.75, lineWidth * config.glowWidth * 0.65) })
      : null;
    frame[2 + index * 2] = fullPath(config, "core", window, index === 0 ? config.coreColor : colorAt(config, motionTime, index / count), lineWidth * config.coreWidth, config.opacity * config.intensity);
  }
  return frame;
}

function plasmaFlow(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  const frame: Array<FlowLayerFrame | null> = Array(FLOW_LAYER_COUNT).fill(null);
  const motionTime = reducedMotion ? time * 0.04 : time;
  const intensity = config.intensity * config.opacity;
  const displacement = lineWidth * config.turbulence * 2.8;
  const turbulent = shiftedPath(geometry, (progress) =>
    Math.sin(progress * Math.PI * 12 + motionTime * 4) * displacement +
    Math.sin(progress * Math.PI * 27 - motionTime * 2.3) * displacement * 0.25);
  frame[0] = config.layers.glow
    ? layer(pathData, config.glowColor, lineWidth * config.glowWidth, intensity * 0.18, { blur: Math.max(0.75, lineWidth * config.glowWidth * 0.7) })
    : null;
  frame[1] = fullPath(config, "current", turbulent, colorAt(config, motionTime), lineWidth * config.width, intensity * 0.76);
  frame[2] = fullPath(config, "core", pathData, config.coreColor, lineWidth * config.coreWidth, intensity * (reducedMotion ? 0.68 : 0.9));
  if (frame[2] && !reducedMotion) {
    frame[2]!.dashArray = "0.1 0.12";
    frame[2]!.dashOffset = -modulo(motionTime * config.speed);
  }
  return frame;
}

function fiberOptic(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  const frame: Array<FlowLayerFrame | null> = Array(FLOW_LAYER_COUNT).fill(null);
  frame[0] = fullPath(config, "current", pathData, config.glowColor, lineWidth * config.width * 0.65, config.opacity * config.intensity * 0.12);
  const count = Math.min(config.strandCount, FLOW_LAYER_COUNT - 1);
  const motionTime = reducedMotion ? time * 0.04 : time;
  for (let index = 0; index < count; index++) {
    const seed = hash(index * 23 + 5);
    const side = index % 2 === 0 ? -1 : 1;
    const offset = (index - (count - 1) / 2) * lineWidth * 0.42;
    const strandPath = shiftedPath(geometry, (progress) =>
      offset + Math.sin(progress * Math.PI * 8 + index * 1.7 + motionTime * (0.8 + seed)) * lineWidth * 0.12 * side,
    );
    const { progress } = streamProgress({ ...config, phase: config.phase + seed }, motionTime, index, count);
    const strandLayer = index === 0 ? "core" : "secondary";
    frame[index + 1] = config.layers[strandLayer] ? layer(
      strandPath,
      colorAt(config, motionTime, seed),
      Math.max(0.35, lineWidth * config.coreWidth * 0.44),
      config.opacity * config.intensity * (0.45 + seed * 0.35),
      { dashArray: "0.26 0.74", dashOffset: -progress },
    ) : null;
  }
  return frame;
}

function energyPulse(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  const frame: Array<FlowLayerFrame | null> = Array(FLOW_LAYER_COUNT).fill(null);
  const motionTime = reducedMotion ? time * 0.04 : time;
  frame[0] = fullPath(config, "current", pathData, colorAt(config, motionTime, 0.2), lineWidth * config.width * 0.5, config.opacity * config.intensity * 0.14);
  const count = Math.min(3, config.streamCount);
  for (let index = 0; index < count; index++) {
    const { progress, direction } = streamProgress(config, motionTime, index, count);
    const window = extractWindow(geometry, progress, config.pulseWidth, direction);
    frame[1 + index * 2] = config.layers.glow
      ? layer(window, config.glowColor, lineWidth * config.glowWidth, config.opacity * config.intensity * 0.2, { blur: Math.max(0.75, lineWidth * config.glowWidth * 0.65) })
      : null;
    frame[2 + index * 2] = fullPath(config, "core", window, config.coreColor, lineWidth * config.coreWidth, config.opacity * config.intensity);
  }
  return frame;
}

export const FLOW_EFFECT_RENDERERS: Record<FlowConfig["effectType"], FlowEffectRenderer> = {
  "electric-current": electricCurrent,
  "continuous-light": continuousLight,
  plasma: plasmaFlow,
  "fiber-optic": fiberOptic,
  "energy-pulse": energyPulse,
};

export function renderFlowEffect(
  geometry: FlowGeometry,
  pathData: string,
  config: FlowConfig,
  time: number,
  lineWidth: number,
  reducedMotion: boolean,
): Array<FlowLayerFrame | null> {
  return FLOW_EFFECT_RENDERERS[config.effectType](
    geometry,
    pathData,
    config,
    Math.max(0, time),
    Math.max(0.25, lineWidth),
    reducedMotion,
  );
}
