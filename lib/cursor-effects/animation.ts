import type { CursorEffectsConfig } from "./model";

export type AnimationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "smoothstep";

export type AnimationDirection = "forward" | "reverse" | "alternate";

export interface AnimationTimeline {
  time: number;
  delay: number;
  duration: number;
  easing?: AnimationEasing;
  direction?: AnimationDirection;
  loop?: boolean;
}

export interface AnimationTrack {
  id?: string;
  from: number;
  to: number;
  timeline: AnimationTimeline;
  intensity?: number;
}

export interface SpringState {
  position: number;
  velocity: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function easeProgress(progress: number, easing: AnimationEasing = "linear"): number {
  const t = clamp01(progress);
  switch (easing) {
    case "ease-in":
      return t * t;
    case "ease-out":
      return 1 - (1 - t) * (1 - t);
    case "ease-in-out":
    case "smoothstep":
      return t * t * (3 - 2 * t);
    default:
      return t;
  }
}

export function sampleTimeline({
  time,
  delay,
  duration,
  easing = "linear",
  direction = "forward",
  loop = false,
}: AnimationTimeline): number {
  if (!Number.isFinite(time) || time < delay) return 0;
  if (!Number.isFinite(duration) || duration <= 0) return 1;

  const elapsed = time - delay;
  const cycle = Math.floor(elapsed / duration);
  let progress = loop ? (elapsed % duration) / duration : clamp01(elapsed / duration);
  const reverse = direction === "reverse" || (direction === "alternate" && cycle % 2 === 1);
  if (reverse) progress = 1 - progress;
  return easeProgress(progress, easing);
}

export function sampleAnimationTrack(track: AnimationTrack): number {
  const progress = sampleTimeline(track.timeline);
  const intensity = Number.isFinite(track.intensity) ? track.intensity! : 1;
  return track.from + (track.to - track.from) * progress * intensity;
}

export function smoothStep(progress: number): number {
  return easeProgress(progress, "smoothstep");
}

export function sampleInteractionProgress(
  time: number,
  startedAt: number,
  delay: number,
  duration: number,
  easing: AnimationEasing = "ease-out",
): number | null {
  const elapsed = time - startedAt - Math.max(0, delay);
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  return easeProgress(elapsed / Math.max(1, duration), easing);
}

export function directionalRotation(
  directionX: number,
  directionY: number,
  speed: number,
  sensitivity: number,
  baseFacing: number,
): number {
  if (speed < 0.015 || Math.hypot(directionX, directionY) < 0.1) return 0;
  const target = Math.atan2(directionY, directionX);
  let delta = target - baseFacing;
  delta = ((delta + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return delta * Math.min(2, Math.max(0, sensitivity));
}

export function applyCursorInteractionPose(
  context: CanvasRenderingContext2D,
  radius: number,
  config: Pick<
    CursorEffectsConfig,
    "hoverAnimation" | "clickAnimation" | "cursorAnimationIntensity" | "hoverIntensity" | "clickIntensity"
  >,
  hover: number,
  click: number,
  time: number,
  reducedMotion: boolean,
): void {
  const hoverAmount = reducedMotion ? hover * 0.2 : hover;
  const clickPulse = reducedMotion ? click * 0.16 : Math.sin(Math.PI * click);
  const hoverStrength = hoverAmount * config.hoverIntensity;
  const clickStrength = clickPulse * config.clickIntensity;

  if (!reducedMotion && config.hoverAnimation === "tilt") context.rotate(hoverStrength * 0.12);
  if (!reducedMotion && config.clickAnimation === "spin") context.rotate(click * Math.PI * 2 * config.clickIntensity);
  if (!reducedMotion && config.clickAnimation === "wobble") {
    context.rotate(Math.sin((1 - click) * Math.PI * 4) * clickStrength * 0.12);
  }
  if (!reducedMotion && config.clickAnimation === "bounce") {
    context.translate(0, -clickStrength * radius * 0.22);
  }
  if (config.hoverAnimation === "pulse") {
    const scale = 1 + hoverStrength * (reducedMotion ? 0.035 : 0.09);
    context.scale(scale, scale);
  } else if (config.hoverAnimation === "squash") {
    context.scale(1 + hoverStrength * 0.08, 1 - hoverStrength * 0.08);
  }
  if (config.clickAnimation === "pulse") {
    const scale = 1 + clickStrength * (reducedMotion ? 0.04 : 0.17);
    context.scale(scale, scale);
  } else if (config.clickAnimation === "squash") {
    context.scale(1 + clickStrength * 0.14, 1 - clickStrength * 0.16);
  } else if (config.clickAnimation === "bounce") {
    context.scale(1 + clickStrength * 0.07, 1 - clickStrength * 0.1);
  }
  if (!reducedMotion && config.hoverAnimation === "glow" && hoverAmount > 0) {
    context.shadowColor = config.hoverIntensity > 0 ? "#ffffff" : "transparent";
    context.shadowBlur = radius * hoverStrength * 0.4;
  }
  if (!reducedMotion && time > 0) {
    context.translate(0, Math.sin(time * 0.003) * radius * config.cursorAnimationIntensity * 0.025);
  }
}

export class AnimationTimelineController {
  private readonly tracks = new Map<string, AnimationTrack>();
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private pausedDuration = 0;

  addTrack(id: string, track: AnimationTrack): void {
    if (!id.trim()) throw new Error("Animation tracks require a non-empty ID.");
    this.tracks.set(id, { ...track, timeline: { ...track.timeline } });
  }

  removeTrack(id: string): void {
    this.tracks.delete(id);
  }

  play(now: number): void {
    if (!Number.isFinite(now)) throw new Error("Animation time must be finite.");
    if (this.startedAt === null) this.startedAt = now;
    if (this.pausedAt !== null) {
      this.pausedDuration += Math.max(0, now - this.pausedAt);
      this.pausedAt = null;
    }
  }

  pause(now: number): void {
    if (this.startedAt !== null && this.pausedAt === null) this.pausedAt = now;
  }

  resume(now: number): void {
    this.play(now);
  }

  stop(): void {
    this.startedAt = null;
    this.pausedAt = null;
    this.pausedDuration = 0;
  }

  sample(now: number): Record<string, number> {
    const clock = this.pausedAt ?? now;
    const time = this.startedAt === null ? 0 : Math.max(0, clock - this.startedAt - this.pausedDuration);
    return Object.fromEntries(Array.from(this.tracks, ([id, track]) => [
      id,
      sampleAnimationTrack({
        ...track,
        timeline: { ...track.timeline, time },
      }),
    ]));
  }
}
