import {
  createCursorInteractionState,
  transitionCursorInteraction,
  type CursorInteractionEvent,
  type CursorInteractionState,
} from "./interactions";
import type { CursorEffectsConfig, CursorStateId } from "./model";
import type { PointerSample } from "./movement";

export interface CursorRuntimePointer {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  lastMove: number;
  active: boolean;
  directionX: number;
  directionY: number;
  speed: number;
  state: CursorStateId | null;
  spiderX: number;
  spiderY: number;
  spiderAngle: number;
  spiderReady: boolean;
  spiderPath: PointerSample[];
  pounce: { startedAt: number; fromX: number; fromY: number; toX: number; toY: number } | null;
}

export interface CursorRuntime {
  pointer: CursorRuntimePointer;
  interaction: CursorInteractionState;
  schedule(): void;
  stop(): void;
  listen(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): void;
  transition(event: CursorInteractionEvent): void;
  updatePointer(x: number, y: number, time: number, cursorState: CursorStateId | null, directionSmoothing?: number): number;
  leave(): void;
  dispose(): void;
}

export interface CursorRuntimeActivity {
  reducedMotion: boolean;
  movement: boolean;
  bursts: boolean;
  glitch: boolean;
  spider: boolean;
  follow: boolean;
  idle: boolean;
  interaction: boolean;
  loading: boolean;
  simulated: boolean;
}

export function hasCursorRuntimeFeatures(
  config: Pick<CursorEffectsConfig, "cursor" | "cursorStates" | "movement" | "click" | "gameEffect" | "soundHover" | "soundClick">,
): boolean {
  return config.cursor !== "native" ||
    Object.values(config.cursorStates).some((state) => state.enabled && state.cursor !== "native") ||
    config.movement !== "none" ||
    config.click !== "none" ||
    config.gameEffect ||
    config.soundHover ||
    config.soundClick;
}

export function shouldContinueCursorRuntime(activity: CursorRuntimeActivity): boolean {
  return !activity.reducedMotion && (
    activity.movement || activity.bursts || activity.glitch ||
    activity.spider || activity.follow || activity.idle || activity.interaction || activity.loading || activity.simulated
  );
}

export function updateCursorPointer(
  pointer: Pick<CursorRuntimePointer, "x" | "y" | "lastX" | "lastY" | "lastMove" | "active" | "directionX" | "directionY" | "speed">,
  x: number,
  y: number,
  time: number,
  directionSmoothing = 0.55,
): number {
  const distance = pointer.active ? Math.hypot(x - pointer.lastX, y - pointer.lastY) : 0;
  const movementX = pointer.active ? x - pointer.x : 0;
  const movementY = pointer.active ? y - pointer.y : 0;
  const movementDistance = Math.hypot(movementX, movementY);
  pointer.speed = movementDistance / Math.max(1, time - pointer.lastMove);
  if (movementDistance > 0.4) {
    const targetX = movementX / movementDistance;
    const targetY = movementY / movementDistance;
    if (Math.hypot(pointer.directionX, pointer.directionY) < 0.01) {
      pointer.directionX = targetX;
      pointer.directionY = targetY;
    } else {
      const dot = pointer.directionX * targetX + pointer.directionY * targetY;
      const baseBlend = Math.min(0.78, Math.max(0.04, directionSmoothing));
      const blend = dot < -0.5 ? Math.max(0.68, baseBlend) : baseBlend;
      const nextX = pointer.directionX * (1 - blend) + targetX * blend;
      const nextY = pointer.directionY * (1 - blend) + targetY * blend;
      const length = Math.hypot(nextX, nextY);
      if (length > 0.01) {
        pointer.directionX = nextX / length;
        pointer.directionY = nextY / length;
      } else {
        pointer.directionX = targetX;
        pointer.directionY = targetY;
      }
    }
  }
  pointer.x = x;
  pointer.y = y;
  pointer.lastX = x;
  pointer.lastY = y;
  pointer.lastMove = time;
  pointer.active = true;
  return distance;
}

export function createCursorRuntime(
  draw: (time: number) => boolean | void,
  pointerState?: CursorRuntimePointer,
): CursorRuntime {
  const pointer: CursorRuntimePointer = pointerState ?? {
    x: -100,
    y: -100,
    lastX: -100,
    lastY: -100,
    lastMove: 0,
    active: false,
    directionX: 0,
    directionY: 0,
    speed: 0,
    state: null,
    spiderX: -100,
    spiderY: -100,
    spiderAngle: 0,
    spiderReady: false,
    spiderPath: [],
    pounce: null,
  };
  let interaction = createCursorInteractionState();
  let frame = 0;
  let disposed = false;
  const subscriptions: Array<{
    target: EventTarget;
    type: string;
    listener: EventListener;
    options?: boolean | AddEventListenerOptions;
  }> = [];
  const runtime: CursorRuntime = {
    pointer,
    get interaction() {
      return interaction;
    },
    schedule() {
      if (disposed || frame) return;
      frame = requestAnimationFrame((time) => {
        frame = 0;
        if (!disposed && draw(time)) runtime.schedule();
      });
    },
    stop() {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    },
    listen(target, type, listener, options) {
      if (disposed) throw new Error("Cannot add an event listener to a disposed cursor runtime.");
      target.addEventListener(type, listener, options);
      subscriptions.push({ target, type, listener, options });
    },
    transition(event) {
      interaction = transitionCursorInteraction(interaction, event);
    },
    updatePointer(x, y, time, cursorState, directionSmoothing) {
      const distance = updateCursorPointer(pointer, x, y, time, directionSmoothing);
      pointer.state = cursorState;
      runtime.transition({ type: "move", overText: cursorState === "text" });
      return distance;
    },
    leave() {
      pointer.active = false;
      pointer.state = null;
      runtime.transition({ type: "exit" });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      runtime.stop();
      for (const subscription of subscriptions) {
        subscription.target.removeEventListener(subscription.type, subscription.listener, subscription.options);
      }
      subscriptions.length = 0;
    },
  };
  return runtime;
}
