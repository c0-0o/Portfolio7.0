import { sampleTimeline } from "./animation";
import type { CursorAnimationEasing, SpiderCursorSettings } from "./model";

export interface PointerSample {
  x: number;
  y: number;
  time: number;
}

export interface SpiderPounce {
  startedAt: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface SpiderClickState {
  x: number;
  y: number;
  spiderX: number;
  spiderY: number;
  spiderReady: boolean;
  spiderPath: PointerSample[];
  pounce: SpiderPounce | null;
}

export interface SpiderFrameState extends SpiderClickState {
  spiderAngle: number;
}

export interface SpiderFrame {
  x: number;
  y: number;
  walking: boolean;
  pounceAge: number;
}

export function recordPointerSample(path: PointerSample[], sample: PointerSample): void {
  path.push(sample);
  if (path.length > 256) path.splice(0, path.length - 256);
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector {
  x: number;
  y: number;
}

export function applySpiderClick(
  state: SpiderClickState,
  target: Point,
  time: number,
  followDelayMs: number,
  reducedMotion: boolean,
): void {
  if (!state.spiderReady) {
    state.spiderX = state.x;
    state.spiderY = state.y;
    state.spiderReady = true;
  }
  if (reducedMotion) {
    state.spiderX = target.x;
    state.spiderY = target.y;
    state.spiderPath = [{ ...target, time }];
    state.pounce = null;
    return;
  }
  state.pounce = {
    startedAt: time,
    fromX: state.spiderX,
    fromY: state.spiderY,
    toX: target.x,
    toY: target.y,
  };
  state.spiderPath = [
    { ...target, time: time - followDelayMs },
    { ...target, time },
  ];
}

export function sampleSpiderFrame(
  state: SpiderFrameState,
  time: number,
  settings: SpiderCursorSettings,
  easing: CursorAnimationEasing,
  reducedMotion: boolean,
): SpiderFrame {
  if (!state.spiderReady) {
    state.spiderX = state.x;
    state.spiderY = state.y;
    state.spiderPath = [
      { x: state.x, y: state.y, time: time - settings.followDelayMs },
      { x: state.x, y: state.y, time },
    ];
    state.spiderReady = true;
  }
  const previousX = state.spiderX;
  const previousY = state.spiderY;
  if (reducedMotion) {
    state.spiderX = state.x;
    state.spiderY = state.y;
  } else if (state.spiderPath.length > 0) {
    const delayed = sampleDelayedPointer(state.spiderPath, time, settings.followDelayMs);
    state.spiderX = delayed.x;
    state.spiderY = delayed.y;
  }
  let x = state.spiderX;
  let y = state.spiderY;
  let walking = Math.hypot(x - previousX, y - previousY) >
    0.15 / settings.movementSensitivity && !reducedMotion;
  if (walking) state.spiderAngle = Math.atan2(y - previousY, x - previousX);

  if (reducedMotion && state.pounce) {
    state.spiderX = state.pounce.toX;
    state.spiderY = state.pounce.toY;
    x = state.pounce.toX;
    y = state.pounce.toY;
    state.pounce = null;
  }
  const pounce = state.pounce;
  const pounceAge = pounce ? time - pounce.startedAt : -1;
  if (pounce && pounceAge >= settings.pounceDurationMs) {
    state.spiderX = pounce.toX;
    state.spiderY = pounce.toY;
    x = pounce.toX;
    y = pounce.toY;
    state.pounce = null;
  } else if (pounce && pounceAge >= settings.pounceDurationMs * 0.18) {
    const progress = sampleTimeline({
      time: pounceAge,
      delay: settings.pounceDurationMs * 0.18,
      duration: settings.pounceDurationMs * 0.42,
      easing,
    });
    const position = interpolatePoint({ x: pounce.fromX, y: pounce.fromY }, { x: pounce.toX, y: pounce.toY }, progress);
    x = position.x;
    y = position.y;
    state.spiderAngle = Math.atan2(pounce.toY - pounce.fromY, pounce.toX - pounce.fromX);
    walking = false;
  }
  return { x, y, walking, pounceAge };
}

export interface PointSpringState {
  position: Point;
  velocity: Vector;
}

export function sampleDelayedPointer(
  path: PointerSample[],
  time: number,
  delay: number,
): PointerSample {
  const targetTime = time - Math.max(0, delay);
  while (path.length > 2 && path[1].time <= targetTime) path.shift();
  const first = path[0];
  const next = path[1];
  if (!first || !next || targetTime <= first.time) return first ?? { x: 0, y: 0, time };
  const progress = Math.min(1, (targetTime - first.time) / Math.max(1, next.time - first.time));
  return {
    x: first.x + (next.x - first.x) * progress,
    y: first.y + (next.y - first.y) * progress,
    time: targetTime,
  };
}

export function interpolatePoint(from: Point, to: Point, progress: number): Point {
  const amount = Math.min(1, Math.max(0, progress));
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

export function calculatePointerSpeed(previous: PointerSample, current: PointerSample): number {
  const elapsed = Math.max(1, current.time - previous.time);
  return Math.hypot(current.x - previous.x, current.y - previous.y) / elapsed;
}

export function applyFollowSmoothing(current: Point, target: Point, smoothing: number): Point {
  const amount = Math.min(1, Math.max(0, smoothing));
  return interpolatePoint(current, target, amount);
}

export function stepSpring(
  state: PointSpringState,
  target: Point,
  stiffness: number,
  damping: number,
  deltaSeconds: number,
): PointSpringState {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  const strength = Math.max(0, stiffness);
  const resistance = Math.max(0, damping);
  const accelerationX = (target.x - state.position.x) * strength - state.velocity.x * resistance;
  const accelerationY = (target.y - state.position.y) * strength - state.velocity.y * resistance;
  return {
    position: {
      x: state.position.x + (state.velocity.x + accelerationX * dt) * dt,
      y: state.position.y + (state.velocity.y + accelerationY * dt) * dt,
    },
    velocity: {
      x: state.velocity.x + accelerationX * dt,
      y: state.velocity.y + accelerationY * dt,
    },
  };
}

export function calculateFloatingOffset(time: number, amplitude: number, speed: number, phase = 0): Point {
  const angle = time * speed + phase;
  return { x: Math.cos(angle) * amplitude, y: Math.sin(angle) * amplitude };
}

export function calculateWindOffset(
  time: number,
  direction: Vector,
  intensity: number,
  turbulence = 0,
): Point {
  const gust = Math.sin(time) * Math.max(0, intensity);
  const variation = Math.sin(time * 2.37 + 1.4) * Math.max(0, turbulence);
  return {
    x: direction.x * (gust + variation),
    y: direction.y * (gust + variation),
  };
}

export function stepGravity(
  position: Point,
  velocity: Vector,
  gravity: Vector,
  deltaSeconds: number,
): { position: Point; velocity: Vector } {
  const dt = Math.min(0.05, Math.max(0, deltaSeconds));
  const nextVelocity = {
    x: velocity.x + gravity.x * dt,
    y: velocity.y + gravity.y * dt,
  };
  return {
    position: {
      x: position.x + nextVelocity.x * dt,
      y: position.y + nextVelocity.y * dt,
    },
    velocity: nextVelocity,
  };
}
