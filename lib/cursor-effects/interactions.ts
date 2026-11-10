export type CursorInteractionType =
  | "idle"
  | "movement"
  | "hover"
  | "click"
  | "double-click"
  | "drag-start"
  | "drag"
  | "drag-end"
  | "text-hover"
  | "text-selection"
  | "focus"
  | "exit";

export interface CursorInteractionState {
  current: CursorInteractionType;
  hovered: boolean;
  focused: boolean;
  dragging: boolean;
  selectedText: boolean;
  hoverStartedAt: number;
  lastClickAt: number;
}

export type CursorInteractionEvent =
  | { type: "move"; overText?: boolean }
  | { type: "hover"; active: boolean; time?: number }
  | { type: "click"; time: number; doubleClickWindow?: number }
  | { type: "drag"; active: boolean }
  | { type: "text-selection"; active: boolean }
  | { type: "focus"; active: boolean }
  | { type: "exit" }
  | { type: "idle" };

export function createCursorInteractionState(): CursorInteractionState {
  return {
    current: "idle",
    hovered: false,
    focused: false,
    dragging: false,
    selectedText: false,
    hoverStartedAt: Number.NEGATIVE_INFINITY,
    lastClickAt: Number.NEGATIVE_INFINITY,
  };
}

export function transitionCursorInteraction(
  state: CursorInteractionState,
  event: CursorInteractionEvent,
): CursorInteractionState {
  switch (event.type) {
    case "move":
      return { ...state, current: event.overText ? "text-hover" : "movement" };
    case "hover":
      return {
        ...state,
        current: event.active ? "hover" : state.current,
        hovered: event.active,
        hoverStartedAt: event.active
          ? state.hovered ? state.hoverStartedAt : event.time ?? 0
          : Number.NEGATIVE_INFINITY,
      };
    case "click": {
      const current = event.time - state.lastClickAt <= (event.doubleClickWindow ?? 300)
        ? "double-click"
        : "click";
      return { ...state, current, lastClickAt: event.time };
    }
    case "drag":
      return { ...state, current: event.active ? "drag-start" : "drag-end", dragging: event.active };
    case "text-selection":
      return { ...state, current: "text-selection", selectedText: event.active };
    case "focus":
      return { ...state, current: event.active ? "focus" : state.current, focused: event.active };
    case "exit":
      return { ...state, current: "exit", hovered: false, dragging: false, hoverStartedAt: Number.NEGATIVE_INFINITY };
    case "idle":
      return { ...state, current: "idle" };
  }
}

export function canHandleInteraction(
  supported: readonly string[],
  interaction: CursorInteractionType,
): boolean {
  if (supported.includes(interaction)) return true;
  if (interaction === "double-click") return supported.includes("click");
  if (interaction.startsWith("drag-")) return supported.includes("drag");
  return false;
}
