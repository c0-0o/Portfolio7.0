import type { EnvironmentConfig, EnvironmentLightConfig, LineEnvironmentConfig, Point } from "./types";
import { falloff, perpendicular } from "./engine/math";

interface AirflowSegment {
  start: Point;
  dx: number;
  dy: number;
  length: number;
  lengthBefore: number;
  radius: number;
}

const airflowSegmentCache = new WeakMap<Point[] | Point[][], {
  viewportKey: string;
  radiiKey: string;
  segments: AirflowSegment[];
}>();

export function resolveLineEnvironment(
  global: EnvironmentConfig,
  line: LineEnvironmentConfig,
  lineEnabled: boolean,
): EnvironmentConfig {
  const globalAirflow = lineEnabled && line.airflowMode === "global" && global.enabled;
  const individualAirflow = lineEnabled && line.airflowMode === "individual";
  const globalLight = lineEnabled && line.lightMode === "global" && global.enabled;
  const individualLight = lineEnabled && line.lightMode === "individual";
  const airflowEnabled = (globalAirflow && global.airflowEnabled) || individualAirflow;
  const lightEnabled = (globalLight && global.lightEnabled) || individualLight;

  return {
    enabled: airflowEnabled || lightEnabled,
    airflowEnabled,
    airflowBehavior: individualAirflow ? line.airflowBehavior : global.airflowBehavior,
    airflowPath: resolveLineAirflowPath(global, line, lineEnabled),
    airflowPaths: resolveLineAirflowPaths(global, line, lineEnabled),
    airflowRadii: resolveLineAirflowRadii(global, line, lineEnabled),
    airflowSpeed: individualAirflow ? line.airflowSpeed : global.airflowSpeed,
    airflowStrength: individualAirflow ? line.airflowStrength : global.airflowStrength,
    airflowRadius: individualAirflow ? line.airflowRadius : global.airflowRadius,
    lightEnabled,
    lightColor: individualLight ? line.lightColor : global.lightColor,
    lightPosition: individualLight ? line.lightPosition : global.lightPosition,
    lightIntensity: individualLight ? line.lightIntensity : global.lightIntensity,
    lightRadius: individualLight ? line.lightRadius : global.lightRadius,
    lights: individualLight ? getLineEnvironmentLights(line) : getEnvironmentLights(global),
  };
}

function getLineEnvironmentLights(line: LineEnvironmentConfig): EnvironmentLightConfig[] {
  if (line.lights) return line.lights;
  return [{
    id: "line-light",
    color: line.lightColor,
    position: line.lightPosition,
    endPosition: line.lightPosition,
    intensity: line.lightIntensity,
    radius: line.lightRadius,
    speed: 0,
    playback: "loop",
  }];
}

export function getEnvironmentLights(environment: EnvironmentConfig): EnvironmentLightConfig[] {
  if (environment.lights) return environment.lights;
  return [{
    id: "global-light",
    color: environment.lightColor,
    position: environment.lightPosition,
    endPosition: environment.lightPosition,
    intensity: environment.lightIntensity,
    radius: environment.lightRadius,
    speed: 0,
    playback: "loop",
  }];
}

export function getEnvironmentLightPosition(light: EnvironmentLightConfig, time: number): Point {
  const progress = light.playback === "once"
    ? Math.min(1, Math.max(0, time * light.speed))
    : ((time * light.speed) % 1 + 1) % 1;
  return {
    x: light.position.x + (light.endPosition.x - light.position.x) * progress,
    y: light.position.y + (light.endPosition.y - light.position.y) * progress,
  };
}

export function resolveLineAirflowPath(
  global: EnvironmentConfig,
  line: LineEnvironmentConfig,
  lineEnabled: boolean,
): Point[] {
  return resolveLineAirflowPaths(global, line, lineEnabled)[0] ?? [];
}

export function resolveLineAirflowPaths(
  global: EnvironmentConfig,
  line: LineEnvironmentConfig,
  lineEnabled: boolean,
): Point[][] {
  if (!lineEnabled) return [];
  if (line.airflowMode === "individual") return line.airflowPaths ?? (line.airflowPath.length > 0 ? [line.airflowPath] : []);
  if (line.airflowMode === "global" && global.enabled && global.airflowEnabled) {
    return global.airflowPaths ?? [global.airflowPath];
  }
  return [];
}

export function resolveLineAirflowRadii(
  global: EnvironmentConfig,
  line: LineEnvironmentConfig,
  lineEnabled: boolean,
): number[] {
  const paths = resolveLineAirflowPaths(global, line, lineEnabled);
  const individual = line.airflowMode === "individual";
  const radii = individual ? line.airflowRadii : global.airflowRadii;
  const fallbackRadius = individual ? line.airflowRadius : global.airflowRadius;
  return paths.map((_, index) => Math.max(0.005, radii?.[index] ?? fallbackRadius));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}

function randomUnit(index: number): number {
  let value = (index | 0) + 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function randomAirflowLevel(index: number): number {
  const selection = randomUnit(index + 0x2c9277b5);
  const intensity = randomUnit(index + 0x1f123bb5);
  if (selection < 0.36) return 0.06 + intensity * 0.16;
  if (selection < 0.82) return 0.28 + intensity * 0.38;
  return 0.78 + intensity * 0.82;
}

function randomAirflowKnotTime(index: number): number {
  const baseDuration = 5.2;
  const jitter = (randomUnit(index + 0x6a09e667) - 0.5) * 1.2;
  return index * baseDuration + jitter;
}

function monotoneAirflowSlope(before: number, after: number, beforeDuration: number, afterDuration: number): number {
  if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
  const firstWeight = 2 * afterDuration + beforeDuration;
  const secondWeight = afterDuration + 2 * beforeDuration;
  return (firstWeight + secondWeight) /
    (firstWeight / before + secondWeight / after);
}

export function getAirflowBehaviorEnvelope(
  behavior: EnvironmentConfig["airflowBehavior"],
  time: number,
  speed: number,
  pathPosition: number,
): number {
  const rate = Math.max(0, speed);
  if (behavior === "steady") return 1;
  if (behavior === "gentle") return 0.38 + 0.12 * Math.sin(time * rate * 0.8 - pathPosition * Math.PI * 2);
  if (behavior === "gusty") {
    const pulse = 0.5 + 0.5 * Math.sin(time * rate * Math.PI * 1.1 - pathPosition * Math.PI * 4);
    return 0.18 + 1.05 * smoothstep(0.15, 0.92, pulse);
  }
  if (behavior === "storm") {
    const pulse = 0.5 + 0.5 * Math.sin(time * rate * Math.PI * 2.4 - pathPosition * Math.PI * 5);
    return 0.6 + 1.4 * pulse;
  }

  const elapsed = Math.max(0, time * rate + pathPosition * 0.43);
  let step = Math.floor(elapsed / 5.2);
  while (elapsed < randomAirflowKnotTime(step)) step--;
  while (elapsed >= randomAirflowKnotTime(step + 1)) step++;

  const previousTime = randomAirflowKnotTime(step - 1);
  const startTime = randomAirflowKnotTime(step);
  const endTime = randomAirflowKnotTime(step + 1);
  const nextTime = randomAirflowKnotTime(step + 2);
  const previousLevel = randomAirflowLevel(step - 1);
  const startLevel = randomAirflowLevel(step);
  const endLevel = randomAirflowLevel(step + 1);
  const nextLevel = randomAirflowLevel(step + 2);
  const beforeDuration = startTime - previousTime;
  const intervalDuration = endTime - startTime;
  const afterDuration = nextTime - endTime;
  const beforeSlope = (startLevel - previousLevel) / beforeDuration;
  const currentSlope = (endLevel - startLevel) / intervalDuration;
  const afterSlope = (nextLevel - endLevel) / afterDuration;
  const startTangent = monotoneAirflowSlope(beforeSlope, currentSlope, beforeDuration, intervalDuration);
  const endTangent = monotoneAirflowSlope(currentSlope, afterSlope, intervalDuration, afterDuration);
  const progress = (elapsed - startTime) / intervalDuration;
  const squared = progress * progress;
  const cubed = squared * progress;

  return (2 * cubed - 3 * squared + 1) * startLevel +
    (cubed - 2 * squared + progress) * intervalDuration * startTangent +
    (-2 * cubed + 3 * squared) * endLevel +
    (cubed - squared) * intervalDuration * endTangent;
}

export function smoothAirflowPath(path: Point[]): Point[] {
  if (path.length < 3) return path;
  const smoothed = [path[0]];

  for (let index = 0; index < path.length - 1; index++) {
    const p0 = path[Math.max(0, index - 1)];
    const p1 = path[index];
    const p2 = path[index + 1];
    const p3 = path[Math.min(path.length - 1, index + 2)];
    for (const t of [0.5, 1]) {
      const t2 = t * t;
      const t3 = t2 * t;
      smoothed.push({
        x: Math.max(0, Math.min(1, 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3))),
        y: Math.max(0, Math.min(1, 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3))),
      });
    }
  }
  return smoothed;
}

function getAirflowSegments(
  environment: EnvironmentConfig,
  viewport: { width: number; height: number },
): AirflowSegment[] {
  const cacheOwner = environment.airflowPaths ?? environment.airflowPath;
  const cacheKey = `${viewport.width}:${viewport.height}`;
  const paths = environment.airflowPaths ?? [environment.airflowPath];
  const radiiKey = paths.map((_, index) =>
    environment.airflowRadii?.[index] ?? environment.airflowRadius).join(",");
  const cached = airflowSegmentCache.get(cacheOwner);
  if (cached?.viewportKey === cacheKey && cached.radiiKey === radiiKey) return cached.segments;

  const segments: AirflowSegment[] = [];
  let totalLength = 0;
  for (const [pathIndex, path] of paths.entries()) {
    if (path.length < 2) continue;
    const radius = Math.max(0.005, environment.airflowRadii?.[pathIndex] ?? environment.airflowRadius);
    const pixels = smoothAirflowPath(path).map((sample) => ({ x: sample.x * viewport.width, y: sample.y * viewport.height }));
    for (let index = 0; index < pixels.length - 1; index++) {
      const start = pixels[index];
      const end = pixels[index + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      if (length <= 0.0001) continue;
      segments.push({ start, dx, dy, length, lengthBefore: totalLength, radius });
      totalLength += length;
    }
  }

  airflowSegmentCache.set(cacheOwner, { viewportKey: cacheKey, radiiKey, segments });
  return segments;
}

export function createAirflowField(
  environment: EnvironmentConfig,
  viewport: { width: number; height: number },
  coherent = false,
  minimumRadiusPx = 0,
): ((point: Point, lineTangent: Point, time: number, materialResponse: number) => Point) | null {
  const paths = environment.airflowPaths ?? [environment.airflowPath];
  if (!environment.enabled || !environment.airflowEnabled || !paths.some((path) => path.length >= 2) || environment.airflowStrength <= 0) return null;

  const minDim = Math.min(viewport.width, viewport.height) || 1;
  const segments = getAirflowSegments(environment, viewport);
  if (segments.length === 0) return null;
  const totalLength = segments[segments.length - 1].lengthBefore + segments[segments.length - 1].length;

  return (point, lineTangent, time, materialResponse) => {
    let closestDistanceSquared = Number.POSITIVE_INFINITY;
    let flowDirection: Point | null = null;
    let pathPosition = 0;
    let radius = Math.max(Math.max(0.005, environment.airflowRadius) * minDim, minimumRadiusPx);

    for (const segment of segments) {
      const projection = Math.max(0, Math.min(1, (
        (point.x - segment.start.x) * segment.dx + (point.y - segment.start.y) * segment.dy
      ) / (segment.length * segment.length)));
      const distanceX = point.x - (segment.start.x + segment.dx * projection);
      const distanceY = point.y - (segment.start.y + segment.dy * projection);
      const distanceSquared = distanceX * distanceX + distanceY * distanceY;
      if (distanceSquared < closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        flowDirection = { x: segment.dx / segment.length, y: segment.dy / segment.length };
        pathPosition = (segment.lengthBefore + segment.length * projection) / totalLength;
        radius = Math.max(segment.radius * minDim, minimumRadiusPx);
      }
    }

    if (!flowDirection) return { x: 0, y: 0 };
    const influence = falloff(Math.sqrt(closestDistanceSquared), radius, 0.78);
    if (influence <= 0) return { x: 0, y: 0 };

    const normal = perpendicular(lineTangent);
    const crossFlow = flowDirection.x * normal.x + flowDirection.y * normal.y;
    const behaviorEnvelope = getAirflowBehaviorEnvelope(
      environment.airflowBehavior,
      time,
      environment.airflowSpeed,
      coherent ? 0.5 : pathPosition,
    );
    const displacement = minDim * 0.08 * environment.airflowStrength * materialResponse * influence * crossFlow * behaviorEnvelope;
    return { x: normal.x * displacement, y: normal.y * displacement };
  };
}
