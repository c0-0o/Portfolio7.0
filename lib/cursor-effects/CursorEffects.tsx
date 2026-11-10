"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import { applyCursorInteractionPose, directionalRotation, easeProgress, sampleInteractionProgress } from "./animation";
import {
  CURSOR_CATEGORIES,
  CURSOR_EFFECTS_APPLIED_KEY,
  CURSOR_EFFECTS_CHANGE_EVENT,
  CURSOR_EFFECTS_STORAGE_KEY,
  CURSOR_STATE_OPTIONS,
  DEFAULT_CURSOR_EFFECTS,
  NATIVE_CURSOR_EFFECTS,
  SPIDER_FOLLOW_PRESET,
  loadCursorEffects,
  sanitizeCursorEffects,
  saveCursorEffects,
  type ClickEffect,
  type CursorClickAnimation,
  type CursorEffectsConfig,
  type CursorHoverAnimation,
  type CursorPresetId,
  type CursorStateConfig,
  type CursorStateId,
  type CreatureCursorId,
  type CreatureCursorSettings,
  type MovementEffect,
} from "./config";
import {
  createEmptyCursorLibrary,
  createSavedCursorTemplate,
  deleteCursorTemplate,
  duplicateCursorTemplate,
  exportCursorTemplate,
  importCursorTemplate,
  loadCursorLibrary,
  putCursorTemplate,
  removeCursorCustomization,
  renameCursorTemplate,
  saveCursorCustomization,
  saveCursorLibrary,
} from "./library";
import {
  CREATURE_CURSOR_IDS,
  POINTER_CURSOR_SHAPE_IDS,
  type CursorLibraryState,
} from "./model";
import type { CursorInteractionState } from "./interactions";
import {
  applyFollowSmoothing,
  applySpiderClick,
  recordPointerSample,
  sampleSpiderFrame,
  type PointerSample,
  type SpiderPounce,
} from "./movement";
import {
  getCursorDefinition,
  getCursorDefinitions,
  getCursorRenderer,
  type CursorRendererMotion,
} from "./registry";
import { getCreatureSettingsLabels, isCreatureCursor } from "./creature-renderers";
import "./romance-dessert-renderers";
import "./weather-space-renderers";
import {
  createCursorRuntime,
  shouldContinueCursorRuntime,
  updateCursorPointer,
} from "./runtime";

type Particle = { x: number; y: number; born: number; angle: number; seed: number };
type Burst = { x: number; y: number; born: number; effect: ClickEffect; seed: number; game: boolean };
type TrailPoint = { x: number; y: number; born: number };
const MAX_ACTIVE_CLICK_BURSTS = 8;

function addClickBurst(bursts: Burst[], burst: Burst) {
  bursts.push(burst);
  if (bursts.length > MAX_ACTIVE_CLICK_BURSTS) {
    bursts.splice(0, bursts.length - MAX_ACTIVE_CLICK_BURSTS);
  }
}

type SpiderMotion = {
  angle: number;
  walking: boolean;
  pounceProgress: number | null;
  gaitSpeed: number;
  walkingIntensity: number;
  legArticulation: number;
  bodyBounce: number;
};
type AudioRef = { current: AudioContext | null };
const WEBSITE_CURSOR_DISABLED_CONFIG = NATIVE_CURSOR_EFFECTS;
const EMPTY_CURSOR_INTERACTION_STATE = {
  current: "idle" as const,
  hovered: false,
  focused: false,
  dragging: false,
  selectedText: false,
  hoverStartedAt: Number.NEGATIVE_INFINITY,
  lastClickAt: Number.NEGATIVE_INFINITY,
};
const movementLifetime = (config: CursorEffectsConfig) =>
  (config.animationDurationMs * (0.65 + config.trailLength * 1.3)) / config.trailSpeed;
const clickLifetime = (config: CursorEffectsConfig) =>
  (config.animationDurationMs * 0.72) / config.trailSpeed;

const CSS_CURSOR_STATES: Partial<Record<string, CursorStateId>> = {
  text: "text",
  crosshair: "crosshair",
  help: "help",
  wait: "wait",
  progress: "progress",
  "not-allowed": "not-allowed",
  "no-drop": "no-drop",
  "zoom-in": "zoom-in",
  "zoom-out": "zoom-out",
  move: "move",
  "context-menu": "context-menu",
  copy: "copy",
  alias: "alias",
  grab: "grab",
  grabbing: "grabbing",
  "ew-resize": "resize-ew",
  "ns-resize": "resize-ns",
  "nesw-resize": "resize-nesw",
  "nwse-resize": "resize-nwse",
  "col-resize": "resize-ew",
  "row-resize": "resize-ns",
};

const TEXT_INPUT_TYPES = new Set([
  "text", "search", "email", "url", "tel", "password", "number",
  "date", "datetime-local", "month", "time", "week",
]);

const POINTER_CURSOR_OPTIONS: Array<[CursorPresetId, string]> = [
  ["pointer-hand", "Hand"],
  ["pointer-text", "Text I-beam"],
  ["pointer-move", "Move"],
  ["pointer-resize-ew", "Resize horizontally"],
  ["pointer-resize-ns", "Resize vertically"],
  ["pointer-resize-nesw", "Resize NE–SW"],
  ["pointer-resize-nwse", "Resize NW–SE"],
  ["pointer-wait", "Wait"],
  ["pointer-not-allowed", "Not allowed"],
];

const POINTER_CURSOR_ASSETS: Record<string, { src: string; width: number; height: number; hotspotX: number; hotspotY: number }> = {
  pointer: { src: "/cursorsvggs/pointer.svg", width: 48, height: 48, hotspotX: 6, hotspotY: 3 },
  "pointer-click": { src: "/cursorsvggs/pointer-click.svg", width: 48, height: 48, hotspotX: 6, hotspotY: 3 },
  "pointer-hand": { src: "/cursorsvggs/hand.svg", width: 48, height: 48, hotspotX: 18, hotspotY: 5 },
  "pointer-text": { src: "/cursorsvggs/text.svg", width: 32, height: 48, hotspotX: 16, hotspotY: 24 },
  "pointer-move": { src: "/cursorsvggs/move.svg", width: 48, height: 48, hotspotX: 24, hotspotY: 24 },
  "pointer-resize-ew": { src: "/cursorsvggs/resize-ew.svg", width: 48, height: 32, hotspotX: 24, hotspotY: 16 },
  "pointer-resize-ns": { src: "/cursorsvggs/resize-ns.svg", width: 32, height: 48, hotspotX: 16, hotspotY: 24 },
  "pointer-resize-nesw": { src: "/cursorsvggs/resize-nwse.svg", width: 48, height: 48, hotspotX: 24, hotspotY: 24 },
  "pointer-resize-nwse": { src: "/cursorsvggs/resize-nesw.svg", width: 48, height: 48, hotspotX: 24, hotspotY: 24 },
  "pointer-wait": { src: "/cursorsvggs/loading.svg", width: 48, height: 48, hotspotX: 24, hotspotY: 24 },
  "pointer-not-allowed": { src: "/cursorsvggs/not-allowed.svg", width: 48, height: 48, hotspotX: 24, hotspotY: 24 },
};

function isPointerCursor(cursor: CursorPresetId): boolean {
  return cursor === "pointer" || (POINTER_CURSOR_SHAPE_IDS as readonly string[]).includes(cursor);
}

function hasTextCursorAtPoint(target: Element, x: number, y: number): boolean {
  const position = document.caretPositionFromPoint?.(x, y);
  const caretRange = position ? null : document.caretRangeFromPoint?.(x, y);
  const node = position?.offsetNode ?? caretRange?.startContainer;
  const offset = position?.offset ?? caretRange?.startOffset ?? 0;
  if (!(node instanceof Text) || !node.textContent || !node.parentElement ||
      !target.contains(node.parentElement) || window.getComputedStyle(node.parentElement).userSelect === "none") {
    return false;
  }

  for (const index of [offset, offset - 1, offset + 1]) {
    if (index < 0 || index >= node.length || /\s/.test(node.data[index])) continue;
    const range = document.createRange();
    range.setStart(node, index);
    range.setEnd(node, index + 1);
    for (const rect of range.getClientRects()) {
      if (x >= rect.left - 1 && x <= rect.right + 1 && y >= rect.top - 2 && y <= rect.bottom + 2) return true;
    }
  }
  return false;
}

function isNativeCursorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(
    '[data-cursor-native], iframe, [data-preview-cursor="native"], .system-cursor-preset, dialog[open], [popover]:popover-open, select, input[type="color"], input[type="file"], input[type="date"], input[type="datetime-local"], input[type="month"], input[type="time"], input[type="week"]',
  ));
}

function getCursorState(target: EventTarget | null, clientX?: number, clientY?: number): CursorStateId | null {
  if (!(target instanceof Element)) return null;
  if (target.closest('button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"]')) return "disabled";
  if (target.closest('[aria-busy="true"], [data-loading="true"]')) return "wait";
  let cursor = window.getComputedStyle(target).cursor;
  if (cursor === "none" && document.body.dataset.nativeCursorActive !== "true") {
    const previousNativeState = document.body.dataset.nativeCursorActive;
    document.body.dataset.nativeCursorActive = "true";
    try {
      cursor = window.getComputedStyle(target).cursor;
    } finally {
      if (previousNativeState === undefined) delete document.body.dataset.nativeCursorActive;
      else document.body.dataset.nativeCursorActive = previousNativeState;
    }
  }
  const isLink = Boolean(target.closest('a[href], area[href], [role="link"]'));
  if (cursor === "pointer") return isLink ? "link" : "pointer";
  const input = target instanceof HTMLInputElement ? target : null;
  if (target instanceof HTMLElement && target.isContentEditable) return "text";
  if (target instanceof HTMLTextAreaElement || (input && TEXT_INPUT_TYPES.has(input.type))) return "text";
  if (isLink) return "link";
  if (target.closest('button, input[type="button"], input[type="submit"], input[type="reset"], [role="button"], summary')) return "pointer";
  if (cursor === "text") {
    return clientX !== undefined && clientY !== undefined && hasTextCursorAtPoint(target, clientX, clientY)
      ? "text"
      : null;
  }
  const mappedState = CSS_CURSOR_STATES[cursor];
  if (mappedState) return mappedState;
  if (clientX !== undefined && clientY !== undefined && hasTextCursorAtPoint(target, clientX, clientY)) return "text";
  return null;
}

function resolveCursorConfig(config: CursorEffectsConfig, state: CursorStateId | null): CursorEffectsConfig | null {
  if (!state) return config.cursor === "native" ? null : config;
  const override = config.cursorStates[state];
  if (!override?.enabled || override.cursor === "native") return null;
  return {
    ...config,
    cursor: override.cursor,
    size: override.size,
    color: override.color,
    pointerAccentColor: override.accentColor,
    borderColor: override.borderColor,
    borderWidth: override.borderWidth,
    cursorImage: override.image,
    hotspotX: override.hotspotX,
    hotspotY: override.hotspotY,
  };
}

function hasTextSelection(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    return active.selectionStart !== null && active.selectionEnd !== null &&
      active.selectionStart !== active.selectionEnd;
  }
  return Boolean(window.getSelection()?.toString());
}

const cursorImages = new Map<string, HTMLImageElement | null>();

function getCursorImage(source: string): HTMLImageElement | null {
  if (!source) return null;
  if (cursorImages.has(source)) return cursorImages.get(source) ?? null;
  const image = new Image();
  cursorImages.set(source, null);
  image.onload = () => {
    cursorImages.set(source, image);
    window.dispatchEvent(new Event(CURSOR_IMAGE_LOADED_EVENT));
  };
  image.onerror = () => {
    cursorImages.set(source, null);
    window.dispatchEvent(new Event(CURSOR_IMAGE_LOADED_EVENT));
  };
  image.src = source;
  return null;
}

const CURSOR_IMAGE_LOADED_EVENT = "magnetic-lines-cursor-image-loaded";

function revealExpandedSettings(event: SyntheticEvent<HTMLDetailsElement>) {
  const group = event.currentTarget;
  if (!group.open) return;
  requestAnimationFrame(() => {
    if (group.isConnected && group.open) group.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}

const MAX_CURSOR_IMAGE_BYTES = 120 * 1024;
const SAFE_SVG_ELEMENTS = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon"]);
const SAFE_SVG_ATTRIBUTES = new Set([
  "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy",
  "r", "rx", "ry", "d", "points", "fill", "fill-rule", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "opacity", "transform",
]);

async function encodeCursorImage(file: File): Promise<string> {
  if (file.size === 0 || file.size > MAX_CURSOR_IMAGE_BYTES) {
    throw new Error("Choose a cursor image smaller than 120 KB.");
  }
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    const document = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = document.documentElement;
    if (root.localName !== "svg" || document.querySelector("parsererror")) {
      throw new Error("This SVG file is not valid.");
    }
    const clean = (element: Element) => {
      for (const attribute of Array.from(element.attributes)) {
        const value = attribute.value;
        if (!SAFE_SVG_ATTRIBUTES.has(attribute.name) ||
            /url\s*\(|javascript:|https?:|data:/i.test(value)) {
          element.removeAttribute(attribute.name);
        }
      }
      for (const child of Array.from(element.children)) {
        if (!SAFE_SVG_ELEMENTS.has(child.localName)) child.remove();
        else clean(child);
      }
    };
    clean(root);
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const bytes = new TextEncoder().encode(new XMLSerializer().serializeToString(root));
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return `data:image/svg+xml;base64,${window.btoa(binary)}`;
  }
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Use a PNG, JPEG, WebP, or safe SVG cursor image.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${file.type};base64,${window.btoa(binary)}`;
}

function playInteractionSound(audio: AudioContext, kind: "hover" | "click", volume: number) {
  if (audio.state !== "running" || volume <= 0) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  oscillator.type = kind === "hover" ? "sine" : "triangle";
  oscillator.frequency.setValueAtTime(kind === "hover" ? 740 : 260, now);
  oscillator.frequency.exponentialRampToValueAtTime(kind === "hover" ? 520 : 130, now + 0.075);
  gain.gain.setValueAtTime(Math.max(0.0001, volume * (kind === "hover" ? 0.06 : 0.12)), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "hover" ? 0.07 : 0.12));
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}

function unlockInteractionAudio(audioRef: AudioRef, playClick: boolean, volume: number) {
  if (typeof window.AudioContext === "undefined") return;
  audioRef.current ??= new window.AudioContext();
  const audio = audioRef.current;
  if (audio.state === "running") {
    if (playClick) playInteractionSound(audio, "click", volume);
    return;
  }
  void audio.resume().then(() => {
    if (playClick) playInteractionSound(audio, "click", volume);
  }).catch(() => {});
}

function updateGlassLens(element: HTMLElement | null, config: CursorEffectsConfig, x: number, y: number, active: boolean) {
  if (!element) return;
  const diameter = Math.max(28, config.size * Math.max(config.widthScale, config.heightScale) * 1.65);
  element.style.width = `${diameter}px`;
  element.style.height = `${diameter}px`;
  element.style.transform = `translate3d(${x + config.offsetX - diameter / 2}px, ${y + config.offsetY - diameter / 2}px, 0)`;
  element.style.opacity = active && config.glassEffect ? String(config.opacity) : "0";
  element.style.setProperty("--cursor-glass-blur", `${config.glassBlur}px`);
  element.style.setProperty("--cursor-glass-opacity", String(config.glassOpacity));
  element.style.setProperty("--cursor-glass-border", config.borderColor);
}

function star(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const distance = point % 2 === 0 ? radius : radius * 0.42;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fill();
}

function drawHeart(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.beginPath();
  context.moveTo(x, y + size * 0.35);
  context.bezierCurveTo(x - size * 1.15, y - size * 0.35, x - size * 0.55, y - size * 1.1, x, y - size * 0.52);
  context.bezierCurveTo(x + size * 0.55, y - size * 1.1, x + size * 1.15, y - size * 0.35, x, y + size * 0.35);
  context.fill();
}

function drawPaw(context: CanvasRenderingContext2D, x: number, y: number, size: number, borderColor?: string, borderWidth = 0) {
  context.beginPath();
  context.ellipse(x, y + size * 0.25, size * 0.72, size * 0.52, 0, 0, Math.PI * 2);
  context.fill();
  if (borderColor && borderWidth > 0) {
    context.strokeStyle = borderColor;
    context.lineWidth = borderWidth;
    context.stroke();
  }
  for (const [offsetX, offsetY, radius] of [
    [-0.62, -0.55, 0.29], [-0.2, -0.82, 0.3], [0.26, -0.78, 0.3], [0.66, -0.48, 0.28],
  ]) {
    context.beginPath();
    context.arc(x + offsetX * size, y + offsetY * size, radius * size, 0, Math.PI * 2);
    context.fill();
    if (borderColor && borderWidth > 0) context.stroke();
  }
}

function drawCursorShape(context: CanvasRenderingContext2D, id: CursorPresetId, radius: number, color: string, borderColor: string, borderWidth: number, backgroundColor: string, time: number, spiderMotion?: SpiderMotion, fillStyle: string | CanvasGradient = color, accentColor = backgroundColor, pointerClicked = false) {
  if (isPointerCursor(id)) {
    const asset = POINTER_CURSOR_ASSETS[id === "pointer" && pointerClicked ? "pointer-click" : id];
    const image = getCursorImage(asset.src);
    if (image) {
      const sizeScale = id === "pointer-wait" ? 0.9 : 1;
      const scale = ((radius / 0.52) / 48) * sizeScale;
      const imageX = -asset.hotspotX * scale;
      const imageY = -asset.hotspotY * scale;
      const imageWidth = asset.width * scale;
      const imageHeight = asset.height * scale;
      context.drawImage(
        image,
        imageX,
        imageY,
        imageWidth,
        imageHeight,
      );
      if (id === "pointer-wait") {
        const squares = [
          [5, 5, 17, 17],
          [24.6, 2.85, 17, 17],
          [6.5, 25, 17, 17],
          [26.75, 22.45, 17, 17],
        ] as const;
        const sequencePositionBySquare = [0, 1, 3, 2] as const;
        const colors = ["#75866A", "#91A186", "#ADB6A5", "#C7CDC1"] as const;
        const phase = (time / 360) % squares.length;
        context.save();
        context.globalCompositeOperation = "source-atop";
        squares.forEach(([squareX, squareY, squareWidth, squareHeight], index) => {
          const sequencePosition = sequencePositionBySquare[index];
          const distance = (phase - sequencePosition + squares.length) % squares.length;
          const colorIndex = Math.min(colors.length - 1, Math.floor(distance));
          const opacity = 1 - Math.min(distance, 3) * 0.3;
          const sizeScale = 1 + Math.max(0, 1 - distance) * 0.08;
          const drawWidth = squareWidth * sizeScale;
          const drawHeight = squareHeight * sizeScale;
          context.fillStyle = colors[colorIndex];
          context.globalAlpha = opacity;
          context.fillRect(
            imageX + (squareX + (squareWidth - drawWidth) / 2) * scale,
            imageY + (squareY + (squareHeight - drawHeight) / 2) * scale,
            drawWidth * scale,
            drawHeight * scale,
          );
        });
        context.restore();
      }
    }
    return;
  }
  const strokeLine = () => {
    if (borderWidth > 0) {
      const foreground = context.strokeStyle;
      const foregroundWidth = context.lineWidth;
      context.strokeStyle = borderColor;
      context.lineWidth = foregroundWidth + borderWidth * 2;
      context.stroke();
      context.strokeStyle = foreground;
      context.lineWidth = foregroundWidth;
    }
    context.stroke();
  };
  const fillAndStroke = () => {
    context.fillStyle = fillStyle;
    context.fill();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.stroke();
    }
  };
  const drawPointerStroke = (path: () => void) => {
    const lineWidth = Math.max(borderWidth, radius * 0.12);
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.translate(2.5, 2.5);
    path();
    context.strokeStyle = accentColor;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
    path();
    context.strokeStyle = borderColor;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };
  const drawPointerFilled = (path: () => void) => {
    context.save();
    context.translate(2.5, 2.5);
    path();
    context.fillStyle = accentColor;
    context.fill();
    context.restore();
    path();
    context.fillStyle = fillStyle;
    context.fill();
    context.strokeStyle = borderColor;
    context.lineWidth = Math.max(borderWidth, radius * 0.12);
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  };
  if (id === "pointer") {
    const drawPointerPath = () => {
      context.beginPath();
      context.moveTo(-radius * 0.62, -radius);
      context.lineTo(radius * 0.79, -radius * 0.2);
      context.quadraticCurveTo(radius * 0.98, -radius * 0.1, radius * 0.78, radius * 0.02);
      context.lineTo(radius * 0.42, radius * 0.2);
      context.lineTo(radius * 0.67, radius * 0.72);
      context.quadraticCurveTo(radius * 0.78, radius * 0.94, radius * 0.55, radius);
      context.quadraticCurveTo(radius * 0.37, radius * 1.02, radius * 0.27, radius * 0.82);
      context.lineTo(radius * 0.02, radius * 0.34);
      context.lineTo(-radius * 0.34, radius * 0.72);
      context.quadraticCurveTo(-radius * 0.6, radius * 0.88, -radius * 0.6, radius * 0.56);
      context.closePath();
    };
    context.save();
    context.translate(2.5, 2.5);
    drawPointerPath();
    context.fillStyle = accentColor;
    context.fill();
    context.restore();
    drawPointerPath();
    context.fillStyle = borderColor;
    context.fill();
    drawPointerPath();
    context.fillStyle = fillStyle;
    context.fill();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.lineJoin = "round";
      context.stroke();
    }
  } else if (id === "pointer-hand") {
    const handPath = () => {
      context.beginPath();
      context.moveTo(-radius * 0.72, radius * 0.1);
      context.quadraticCurveTo(-radius * 0.94, -radius * 0.02, -radius * 0.76, -radius * 0.22);
      context.lineTo(-radius * 0.51, -radius * 0.02);
      context.lineTo(-radius * 0.67, -radius * 0.76);
      context.quadraticCurveTo(-radius * 0.72, -radius * 0.99, -radius * 0.51, -radius);
      context.quadraticCurveTo(-radius * 0.32, -radius, -radius * 0.27, -radius * 0.81);
      context.lineTo(-radius * 0.12, -radius * 0.39);
      context.quadraticCurveTo(-radius * 0.1, -radius * 0.57, radius * 0.1, -radius * 0.57);
      context.quadraticCurveTo(radius * 0.29, -radius * 0.57, radius * 0.32, -radius * 0.36);
      context.quadraticCurveTo(radius * 0.37, -radius * 0.52, radius * 0.55, -radius * 0.48);
      context.quadraticCurveTo(radius * 0.74, -radius * 0.44, radius * 0.73, -radius * 0.22);
      context.quadraticCurveTo(radius * 0.91, -radius * 0.37, radius * 0.99, -radius * 0.14);
      context.lineTo(radius * 0.96, radius * 0.36);
      context.quadraticCurveTo(radius * 0.92, radius * 0.76, radius * 0.52, radius * 0.9);
      context.quadraticCurveTo(radius * 0.27, radius, radius * 0.06, radius * 0.82);
      context.lineTo(-radius * 0.68, radius * 0.31);
      context.quadraticCurveTo(-radius * 0.86, radius * 0.22, -radius * 0.72, radius * 0.1);
      context.closePath();
    };
    drawPointerFilled(handPath);
    context.save();
    context.lineCap = "round";
    context.lineWidth = Math.max(1.5, borderWidth * 0.72);
    context.strokeStyle = borderColor;
    for (const [x1, y1, x2, y2] of [
      [-0.12, -0.39, -0.05, 0.04],
      [0.32, -0.36, 0.35, 0.06],
      [0.73, -0.22, 0.72, 0.09],
    ]) {
      context.beginPath();
      context.moveTo(radius * x1, radius * y1);
      context.lineTo(radius * x2, radius * y2);
      context.stroke();
    }
    context.restore();
  } else if (id === "pointer-text") {
    drawPointerStroke(() => {
      context.beginPath();
      context.moveTo(-radius * 0.6, -radius * 0.72);
      context.lineTo(radius * 0.6, -radius * 0.72);
      context.moveTo(0, -radius * 0.72);
      context.lineTo(0, radius * 0.72);
      context.moveTo(-radius * 0.6, radius * 0.72);
      context.lineTo(radius * 0.6, radius * 0.72);
    });
  } else if (id === "pointer-move") {
    drawPointerStroke(() => {
      context.beginPath();
      context.moveTo(-radius * 0.84, 0);
      context.lineTo(radius * 0.84, 0);
      context.moveTo(0, -radius * 0.84);
      context.lineTo(0, radius * 0.84);
      for (const direction of [-1, 1]) {
        context.moveTo(direction * radius * 0.84, 0);
        context.lineTo(direction * radius * 0.47, -radius * 0.31);
        context.moveTo(direction * radius * 0.84, 0);
        context.lineTo(direction * radius * 0.47, radius * 0.31);
        context.moveTo(0, direction * radius * 0.84);
        context.lineTo(-radius * 0.31, direction * radius * 0.47);
        context.moveTo(0, direction * radius * 0.84);
        context.lineTo(radius * 0.31, direction * radius * 0.47);
      }
    });
  } else if (id === "pointer-resize-ew" || id === "pointer-resize-ns" ||
             id === "pointer-resize-nesw" || id === "pointer-resize-nwse") {
    const [startX, startY, endX, endY] = id === "pointer-resize-ew"
      ? [-radius * 0.72, 0, radius * 0.72, 0]
      : id === "pointer-resize-ns"
      ? [0, -radius * 0.72, 0, radius * 0.72]
      : id === "pointer-resize-nesw"
      ? [-radius * 0.72, radius * 0.72, radius * 0.72, -radius * 0.72]
      : [-radius * 0.72, -radius * 0.72, radius * 0.72, radius * 0.72];
    drawPointerStroke(() => {
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      const direction = Math.atan2(endY - startY, endX - startX);
      for (const [x, y, angle] of [[startX, startY, direction], [endX, endY, direction + Math.PI]] as const) {
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle - 0.72) * radius * 0.48, y + Math.sin(angle - 0.72) * radius * 0.48);
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle + 0.72) * radius * 0.48, y + Math.sin(angle + 0.72) * radius * 0.48);
      }
    });
  } else if (id === "pointer-wait") {
    const square = radius * 0.42;
    context.save();
    context.translate(2.5, 2.5);
    for (const [x, y] of [[-0.65, -0.65], [0.65, -0.28], [-0.65, 0.35], [0.65, 0.88]]) {
      context.globalAlpha = x < 0 ? 0.42 : 0.92;
      context.fillStyle = accentColor;
      context.fillRect(radius * x, radius * y, square, square);
    }
    context.restore();
    context.save();
    for (const [x, y, opacity, fill] of [
      [-0.65, -0.65, 0.42, "#a9e67c"],
      [0.65, -0.28, 1, accentColor],
      [-0.65, 0.35, 0.42, "#dce9d2"],
      [0.65, 0.88, 0.72, "#c8c8c8"],
    ] as const) {
      context.globalAlpha = opacity;
      context.fillStyle = fill;
      context.fillRect(radius * x, radius * y, square, square);
    }
    context.restore();
  } else if (id === "pointer-not-allowed") {
    const circle = () => {
      context.beginPath();
      context.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
    };
    context.save();
    context.translate(2.5, 2.5);
    circle();
    context.strokeStyle = accentColor;
    context.lineWidth = Math.max(borderWidth, radius * 0.12);
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 0.55, radius * 0.55);
    context.lineTo(radius * 0.55, -radius * 0.55);
    context.stroke();
    context.restore();
    circle();
    context.fillStyle = fillStyle;
    context.fill();
    context.strokeStyle = borderColor;
    context.lineWidth = Math.max(borderWidth, radius * 0.12);
    context.stroke();
    context.beginPath();
    context.moveTo(-radius * 0.55, radius * 0.55);
    context.lineTo(radius * 0.55, -radius * 0.55);
    context.stroke();
  } else if (id === "modern-arrow" || id === "minimal-pointer" || id === "pixel-arrow") {
    context.beginPath();
    if (id === "pixel-arrow") {
      context.moveTo(-radius * 0.6, -radius);
      context.lineTo(radius * 0.05, -radius * 0.65);
      context.lineTo(radius * 0.55, -radius * 0.24);
      context.lineTo(radius * 0.1, -radius * 0.03);
      context.lineTo(radius * 0.52, radius * 0.73);
      context.lineTo(radius * 0.18, radius * 0.9);
      context.lineTo(-radius * 0.18, radius * 0.16);
      context.lineTo(-radius * 0.6, radius * 0.63);
    } else {
      context.moveTo(-radius * 0.6, -radius);
      context.lineTo(-radius * 0.6, radius * 0.92);
      context.lineTo(-radius * 0.05, radius * 0.35);
      context.lineTo(radius * 0.32, radius);
      context.lineTo(radius * 0.64, radius * 0.82);
      context.lineTo(radius * 0.27, radius * 0.17);
      context.lineTo(radius, radius * 0.06);
    }
    context.closePath();
    fillAndStroke();
  } else if (id === "white-circle" || id === "black-circle" || id === "outlined-circle" || id === "glow-circle") {
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fillStyle = typeof fillStyle !== "string"
      ? fillStyle
      : id === "outlined-circle" ? backgroundColor : color;
    context.fill();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.stroke();
    }
  } else if (id === "blob" || id === "liquid" || id === "water-drop") {
    const wave = id === "liquid" ? Math.sin(time / 160) * 2 : 0;
    context.beginPath();
    if (id === "water-drop") {
      context.moveTo(0, -radius * 1.2);
      context.bezierCurveTo(radius * 0.2, -radius * 0.65, radius, radius * 0.2, radius * 0.68, radius * 0.68);
      context.bezierCurveTo(radius * 0.25, radius * 1.15, -radius * 0.45, radius, -radius * 0.7, radius * 0.5);
      context.bezierCurveTo(-radius, radius * 0.05, -radius * 0.25, -radius * 0.75, 0, -radius * 1.2);
    } else {
      context.ellipse(0, 0, radius + wave, radius * 0.84 - wave * 0.3, Math.sin(time / 300) * 0.2, 0, Math.PI * 2);
    }
    fillAndStroke();
  } else if (id === "cat") {
    context.beginPath();
    context.moveTo(-radius * 0.82, -radius * 0.18);
    context.lineTo(-radius * 0.74, -radius);
    context.lineTo(-radius * 0.18, -radius * 0.68);
    context.quadraticCurveTo(0, -radius * 0.78, radius * 0.18, -radius * 0.68);
    context.lineTo(radius * 0.74, -radius);
    context.lineTo(radius * 0.82, -radius * 0.18);
    context.quadraticCurveTo(radius * 0.78, radius * 0.8, 0, radius * 0.88);
    context.quadraticCurveTo(-radius * 0.78, radius * 0.8, -radius * 0.82, -radius * 0.18);
    fillAndStroke();
    context.fillStyle = borderColor;
    for (const eyeX of [-0.32, 0.32]) {
      context.beginPath();
      context.arc(eyeX * radius, -radius * 0.12, radius * 0.07, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === "paw") {
    context.fillStyle = fillStyle;
    drawPaw(context, 0, 0, radius * 0.72, borderColor, borderWidth);
  } else if (id === "heart") {
    context.fillStyle = fillStyle;
    drawHeart(context, 0, 0, radius);
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.stroke();
    }
  } else if (id === "flower" || id === "floral") {
    context.fillStyle = fillStyle;
    for (let petal = 0; petal < 6; petal++) {
      context.save();
      context.rotate((petal / 6) * Math.PI * 2);
      context.beginPath();
      context.ellipse(0, -radius * 0.52, radius * 0.25, radius * 0.48, 0, 0, Math.PI * 2);
      context.fill();
      if (borderWidth > 0) {
        context.strokeStyle = borderColor;
        context.lineWidth = borderWidth;
        context.stroke();
      }
      context.restore();
    }
    context.beginPath();
    context.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
    context.fillStyle = borderColor;
    context.fill();
  } else if (id === "smiley") {
    context.beginPath();
    context.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    fillAndStroke();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.beginPath();
      context.arc(0, radius * 0.02, radius * 0.42, 0.2, Math.PI - 0.2);
      context.stroke();
    }
    for (const eyeX of [-0.3, 0.3]) {
      context.beginPath();
      context.arc(eyeX * radius, -radius * 0.25, radius * 0.07, 0, Math.PI * 2);
      context.fillStyle = borderColor;
      context.fill();
    }
  } else if (id === "spider") {
    const motion = spiderMotion ?? {
      angle: 0,
      walking: false,
      pounceProgress: null,
      gaitSpeed: 1,
      walkingIntensity: 1,
      legArticulation: 1,
      bodyBounce: 0,
    };
    const phase = motion.walking ? (time / 75) * motion.gaitSpeed : 0;
    const pounce = motion.pounceProgress;
    const charge = pounce !== null && pounce < 0.16 ? Math.sin((pounce / 0.16) * Math.PI / 2) : 0;
    const leap = pounce !== null && pounce >= 0.16 && pounce < 0.58
      ? Math.sin(((pounce - 0.16) / 0.42) * Math.PI)
      : 0;
    const landing = pounce !== null && pounce >= 0.58 && pounce < 0.76
      ? 1 - (pounce - 0.58) / 0.18
      : 0;
    const crouch = pounce !== null
      ? charge > 0 || landing > 0 ? 1 : leap > 0 ? 0.12 : 1
      : motion.walking ? 0 : 1;
    context.save();
    context.rotate(motion.angle);
    context.translate(radius * leap * 0.9, -radius * leap * 0.52);
    context.scale(1 + leap * 0.22, 1 - leap * 0.16);
    const bounce = motion.walking ? Math.abs(Math.sin(phase * 2)) * motion.bodyBounce * radius * 0.08 : 0;
    context.translate(0, radius * (crouch * 0.12 + landing * 0.1) - bounce);

    const legStroke = (width: number, stroke: string | CanvasGradient) => {
      context.strokeStyle = stroke;
      context.lineWidth = width;
      context.beginPath();
      for (const side of [-1, 1]) {
        for (let leg = 0; leg < 4; leg++) {
          const pairPhase = phase + leg * Math.PI * 0.78 + (side < 0 ? Math.PI : 0);
          const stride = motion.walkingIntensity * motion.legArticulation;
          const step = motion.walking ? Math.sin(pairPhase) * radius * 0.22 * stride : 0;
          const lift = motion.walking ? Math.max(0, Math.cos(pairPhase)) * radius * 0.15 * stride : 0;
          const rootX = radius * (-0.22 + leg * 0.16);
          const rootY = side * radius * 0.13;
          const kneeX = rootX + radius * (0.32 + (leg < 2 ? -0.05 : 0.1)) + step * 0.45;
          const footX = rootX + radius * (leg < 2 ? -0.12 : 0.55) + step;
          const kneeY = side * radius * (0.38 + crouch * 0.08) - lift * 0.55;
          const footY = side * radius * (0.72 - crouch * 0.2) - lift;
          context.moveTo(rootX, rootY);
          context.lineTo(kneeX, kneeY);
          context.lineTo(footX, footY);
        }
      }
      context.stroke();
    };
    legStroke(Math.max(2.4, radius * 0.14), borderColor);
    legStroke(Math.max(1.1, radius * 0.065), fillStyle);

    context.lineJoin = "round";
    context.beginPath();
    context.ellipse(-radius * 0.23, 0, radius * 0.36, radius * (0.29 - crouch * 0.025), 0, 0, Math.PI * 2);
    context.fillStyle = fillStyle;
    context.fill();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.stroke();
    }
    context.beginPath();
    context.ellipse(radius * 0.26, 0, radius * 0.27, radius * (0.23 - crouch * 0.025), 0, 0, Math.PI * 2);
    context.fillStyle = fillStyle;
    context.fill();
    if (borderWidth > 0) {
      context.strokeStyle = borderColor;
      context.lineWidth = borderWidth;
      context.stroke();
    }
    context.fillStyle = borderColor;
    for (const eyeY of [-0.105, 0.105]) {
      context.beginPath();
      context.arc(radius * 0.43, radius * eyeY, Math.max(0.9, radius * 0.065), 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = borderColor;
    context.lineWidth = Math.max(1, radius * 0.08);
    context.beginPath();
    context.moveTo(radius * 0.45, -radius * 0.11);
    context.quadraticCurveTo(radius * 0.65, -radius * 0.22, radius * 0.57, -radius * 0.34);
    context.moveTo(radius * 0.45, radius * 0.11);
    context.quadraticCurveTo(radius * 0.65, radius * 0.22, radius * 0.57, radius * 0.34);
    context.stroke();
    context.restore();
  } else if (id === "web") {
    context.strokeStyle = fillStyle;
    context.lineWidth = 1.5;
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray / 8) * Math.PI * 2;
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      strokeLine();
    }
    for (const ring of [0.35, 0.65, 0.95]) {
      context.beginPath();
      for (let ray = 0; ray <= 8; ray++) {
        const angle = (ray / 8) * Math.PI * 2;
        const px = Math.cos(angle) * radius * ring;
        const py = Math.sin(angle) * radius * ring;
        if (ray === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      strokeLine();
    }
  } else if (id === "ghost") {
    context.beginPath();
    context.moveTo(-radius * 0.65, radius * 0.72);
    context.lineTo(-radius * 0.58, -radius * 0.22);
    context.quadraticCurveTo(-radius * 0.5, -radius * 0.92, 0, -radius * 0.9);
    context.quadraticCurveTo(radius * 0.62, -radius * 0.88, radius * 0.62, -radius * 0.15);
    context.lineTo(radius * 0.62, radius * 0.72);
    context.lineTo(radius * 0.3, radius * 0.48);
    context.lineTo(0, radius * 0.74);
    context.lineTo(-radius * 0.32, radius * 0.48);
    context.closePath();
    fillAndStroke();
    context.fillStyle = borderColor;
    for (const eyeX of [-0.24, 0.24]) {
      context.beginPath();
      context.arc(eyeX * radius, -radius * 0.15, radius * 0.09, 0, Math.PI * 2);
      context.fill();
    }
  } else if (id === "skull") {
    context.beginPath();
    context.ellipse(0, -radius * 0.12, radius * 0.72, radius * 0.74, 0, 0, Math.PI * 2);
    fillAndStroke();
    context.fillStyle = borderColor;
    for (const eyeX of [-0.28, 0.28]) {
      context.beginPath();
      context.arc(eyeX * radius, -radius * 0.12, radius * 0.18, 0, Math.PI * 2);
      context.fill();
    }
    context.fillRect(-radius * 0.36, radius * 0.47, radius * 0.72, radius * 0.28);
  } else if (id === "eight-bit") {
    context.fillStyle = fillStyle;
    const pixel = radius * 0.34;
    for (const [column, row] of [[1, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [1, 3], [2, 3]]) {
      context.fillRect((column - 1.5) * pixel, (row - 1.5) * pixel, pixel * 0.86, pixel * 0.86);
      if (borderWidth > 0) {
        context.strokeStyle = borderColor;
        context.lineWidth = borderWidth;
        context.strokeRect((column - 1.5) * pixel, (row - 1.5) * pixel, pixel * 0.86, pixel * 0.86);
      }
    }
  } else if (id === "neon") {
    context.strokeStyle = fillStyle;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    strokeLine();
    context.beginPath();
    context.moveTo(0, -radius);
    context.lineTo(0, radius);
    context.moveTo(-radius, 0);
    context.lineTo(radius, 0);
    strokeLine();
  } else if (id === "butterfly") {
    context.fillStyle = fillStyle;
    for (const side of [-1, 1]) {
      context.beginPath();
      context.ellipse(side * radius * 0.4, -radius * 0.3, radius * 0.42, radius * 0.55, side * 0.45, 0, Math.PI * 2);
      context.ellipse(side * radius * 0.4, radius * 0.37, radius * 0.3, radius * 0.4, -side * 0.45, 0, Math.PI * 2);
      context.fill();
      if (borderWidth > 0) {
        context.strokeStyle = borderColor;
        context.lineWidth = borderWidth;
        context.stroke();
      }
    }
    context.strokeStyle = fillStyle;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -radius * 0.55);
    context.lineTo(0, radius * 0.65);
    strokeLine();
  } else if (id === "leaf") {
    context.beginPath();
    context.moveTo(-radius * 0.75, radius * 0.65);
    context.quadraticCurveTo(-radius * 0.9, -radius * 0.9, radius * 0.78, -radius * 0.78);
    context.quadraticCurveTo(radius * 0.9, radius * 0.9, -radius * 0.75, radius * 0.65);
    fillAndStroke();
    context.strokeStyle = fillStyle;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-radius * 0.65, radius * 0.55);
    context.lineTo(radius * 0.62, -radius * 0.6);
    strokeLine();
  } else if (id === "abstract" || id === "artistic") {
    context.strokeStyle = fillStyle;
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(0, -radius);
    context.lineTo(radius * 0.22, -radius * 0.22);
    context.lineTo(radius, 0);
    context.lineTo(radius * 0.22, radius * 0.22);
    context.lineTo(0, radius);
    context.lineTo(-radius * 0.22, radius * 0.22);
    context.lineTo(-radius, 0);
    context.lineTo(-radius * 0.22, -radius * 0.22);
    context.closePath();
    if (id === "artistic") {
      context.fillStyle = fillStyle;
      context.globalAlpha *= 0.45;
      context.fill();
      context.globalAlpha /= 0.45;
    }
    strokeLine();
  }
}

function drawCursor(
  context: CanvasRenderingContext2D,
  config: CursorEffectsConfig,
  x: number,
  y: number,
  hovered: boolean,
  time: number,
  spiderMotion?: SpiderMotion,
  interaction: CursorInteractionState = EMPTY_CURSOR_INTERACTION_STATE,
  movement: Pick<CursorRendererMotion, "directionX" | "directionY" | "speed"> = { directionX: 0, directionY: 0, speed: 0 },
  reducedMotion = false,
) {
  if (config.cursor === "native") return;
  const pointerCursor = isPointerCursor(config.cursor);
  const shapeRadius = pointerCursor ? config.size * 0.52 : 8 * (config.size / 28);
  const hoverStart = Number.isFinite(interaction.hoverStartedAt)
    ? interaction.hoverStartedAt
    : hovered ? time : Number.NEGATIVE_INFINITY;
  const hoverProgress = hovered
    ? reducedMotion ? 1 : sampleInteractionProgress(time, hoverStart, config.hoverDelayMs, config.hoverTransitionMs, config.animationEasing) ?? 0
    : 0;
  const clickProgress = Number.isFinite(interaction.lastClickAt)
    ? sampleInteractionProgress(
      time,
      interaction.lastClickAt,
      reducedMotion ? 0 : config.clickDelayMs,
      reducedMotion ? Math.min(220, config.clickDurationMs) : config.clickDurationMs,
      config.animationEasing,
    )
    : null;
  const clickRemaining = clickProgress !== null && clickProgress < 1 ? 1 - clickProgress : 0;
  const animatedHover = hoverProgress > 0;
  const animatedClick = clickRemaining > 0;
  const loadingCursor = config.cursor === "pointer-wait";
  const scale = (config.size / 28) * (animatedHover && config.hoverGrow ? 1 + 0.28 * hoverProgress : 1);
  const radius = pointerCursor ? shapeRadius * (animatedHover && config.hoverGrow ? 1 + 0.28 * hoverProgress : 1) : 8 * scale;
  const primaryColor = animatedHover && config.hoverColor ? config.hoverColorValue : config.color;
  const animationTime = reducedMotion || (!loadingCursor && !config.idleAnimationEnabled && !animatedHover && !animatedClick && movement.speed < 0.015)
    ? 0
    : time * config.cursorAnimationSpeed;
  context.save();
  context.globalAlpha = config.opacity;
  context.translate(x + config.offsetX, y + config.offsetY);
  context.rotate((config.rotation * Math.PI) / 180);
  context.scale(config.widthScale, config.heightScale);
  if (!reducedMotion && config.directionalFollow && config.cursor !== "spider" && !pointerCursor) {
    const baseFacing = config.cursor === "modern-arrow" || config.cursor === "minimal-pointer" || config.cursor === "pointer"
      ? 0
      : config.cursor === "pixel-arrow" ? -2.11 : -Math.PI / 2;
    context.rotate(directionalRotation(
      movement.directionX,
      movement.directionY,
      movement.speed,
      config.rotationSensitivity,
      baseFacing,
    ));
  }
  let cursorColor: string | CanvasGradient = primaryColor;
  if (config.gradientEnabled && config.cursor !== "custom-image") {
    const angle = (config.gradientAngle * Math.PI) / 180;
    const extent = radius;
    const gradient = context.createLinearGradient(
      -Math.cos(angle) * extent,
      -Math.sin(angle) * extent,
      Math.cos(angle) * extent,
      Math.sin(angle) * extent,
    );
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, config.gradientEndColor);
    cursorColor = gradient;
  }
  const definition = getCursorDefinition(config.cursor);
  const registeredRenderer = definition && getCursorRenderer(definition.rendererKey);
  if (registeredRenderer) {
    registeredRenderer({
      context,
      config,
      fillStyle: cursorColor,
      x: 0,
      y: 0,
      hovered,
      time,
      interaction,
      motion: {
        ...movement,
        angle: spiderMotion?.angle ?? Math.atan2(movement.directionY, movement.directionX),
        walking: spiderMotion?.walking ?? movement.speed > 0,
        gaitSpeed: spiderMotion?.gaitSpeed ?? 1,
        walkingIntensity: spiderMotion?.walkingIntensity ?? 1,
        legArticulation: spiderMotion?.legArticulation ?? 1,
        bodyBounce: spiderMotion?.bodyBounce ?? 0,
        pounceProgress: spiderMotion?.pounceProgress ?? null,
      },
      reducedMotion,
    });
    context.restore();
    return;
  }
  const color = primaryColor;
  const fillStyle = cursorColor;
  if (config.shadow > 0 || config.glow > 0) {
    context.shadowOffsetX = 1;
    context.shadowOffsetY = 2;
    context.shadowBlur = config.shadow * 14 + config.glow * 18;
    context.shadowColor = config.glow > 0 ? color : "rgba(0,0,0,0.65)";
  }
  if (!pointerCursor) {
    applyCursorInteractionPose(context, radius, config, hoverProgress, clickRemaining, animationTime, reducedMotion);
  }
  if (config.hoverShape && animatedHover) {
    context.beginPath();
    const inset = 5 + hoverProgress * 2;
    context.roundRect(-radius - inset, -radius - inset, (radius + inset) * 2, (radius + inset) * 2, 7);
    context.strokeStyle = config.borderColor;
    if (config.borderWidth > 0) {
      context.globalAlpha *= hoverProgress;
      context.lineWidth = config.borderWidth * config.hoverIntensity;
      context.stroke();
    }
  }
  if (!reducedMotion && config.glitchEffect && config.glitchIntensity > 0 && Math.floor(animationTime / 55) % 5 === 0) {
    context.save();
    context.globalAlpha *= config.glitchIntensity * 0.65;
    context.translate(-2 - config.glitchIntensity * 3, 0);
    drawCursorShape(context, config.cursor, radius, config.pointerAccentColor, config.pointerAccentColor, config.borderWidth, config.backgroundColor, animationTime, spiderMotion, config.pointerAccentColor, config.pointerAccentColor);
    context.translate(4 + config.glitchIntensity * 6, 1);
    drawCursorShape(context, config.cursor, radius, config.hoverColorValue, config.hoverColorValue, config.borderWidth, config.backgroundColor, animationTime, spiderMotion, config.hoverColorValue, config.pointerAccentColor);
    context.restore();
  }
  context.save();
  if (config.cursor === "custom-image") {
    const image = getCursorImage(config.cursorImage);
    if (image) {
      const imageSize = config.size;
      context.drawImage(
        image,
        -imageSize * config.hotspotX,
        -imageSize * config.hotspotY,
        imageSize,
        imageSize,
      );
    } else {
      drawCursorShape(context, "modern-arrow", radius, color, config.borderColor, config.borderWidth, config.backgroundColor, animationTime, undefined, fillStyle);
    }
  } else if (config.cursor === "spider") {
    drawCursorShape(context, config.cursor, radius, color, config.borderColor, config.borderWidth, config.backgroundColor, animationTime, spiderMotion, fillStyle, config.pointerAccentColor);
  } else {
    if (!pointerCursor && !reducedMotion && config.idleAnimationEnabled) {
      context.rotate(Math.sin(animationTime / 900) * 0.04 * config.cursorAnimationIntensity);
    }
    drawCursorShape(context, config.cursor, radius, color, config.borderColor, config.borderWidth, config.backgroundColor, animationTime, spiderMotion, fillStyle, config.pointerAccentColor, config.cursor === "pointer" && clickRemaining > 0);
  }
  context.restore();
  if (config.hoverOutline && animatedHover) {
    context.beginPath();
    context.arc(0, 0, radius + 4, 0, Math.PI * 2);
    context.strokeStyle = config.borderColor;
    if (config.borderWidth > 0) {
      context.globalAlpha *= hoverProgress;
      context.lineWidth = config.borderWidth * config.hoverIntensity;
      context.stroke();
    }
  }
  if (config.gameEffect && animatedHover) {
    context.save();
    context.strokeStyle = config.borderColor;
    context.globalAlpha *= 0.8;
    context.lineWidth = Math.max(1, config.borderWidth);
    const gap = radius + 5;
    const length = Math.max(3, radius * 0.3);
    for (const direction of [-1, 1]) {
      for (const axis of [-1, 1]) {
        context.beginPath();
        context.moveTo(direction * gap, axis * gap);
        context.lineTo(direction * (gap + length), axis * gap);
        context.moveTo(direction * gap, axis * gap);
        context.lineTo(direction * gap, axis * (gap + length));
        context.stroke();
      }
    }
    context.restore();
  }
  context.restore();
}

function drawEffect(context: CanvasRenderingContext2D, effect: MovementEffect, config: CursorEffectsConfig, particles: Particle[], trail: TrailPoint[], x: number, y: number, time: number) {
  const lifetime = movementLifetime(config);
  const color = config.effectColor;
  context.save();
  context.fillStyle = color;
  context.strokeStyle = color;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = color;
  context.shadowBlur = config.glow * 16;
  if (effect === "comet" && trail.length > 1) {
    context.lineWidth = Math.max(2, config.particleSize * 1.2);
    for (let index = 1; index < trail.length; index++) {
      const start = trail[index - 1];
      const end = trail[index];
      const age = easeProgress((time - (start.born + end.born) / 2) / lifetime, config.animationEasing);
      context.globalAlpha = Math.max(0, 1 - age);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }
  for (let index = particles.length - 1; index >= 0; index--) {
    const particle = particles[index];
    const age = easeProgress((time - particle.born) / lifetime, config.animationEasing);
    if (age >= 1) {
      particles.splice(index, 1);
      continue;
    }
    const size = config.particleSize * (0.45 + config.particleDensity * 0.55) * (1 - age * 0.7);
    const drift = age * (18 + particle.seed % 28);
    const px = particle.x + Math.cos(particle.angle) * drift;
    const py = particle.y + Math.sin(particle.angle) * drift - age * 12;
    context.globalAlpha = (1 - age) * config.opacity;
    if (effect === "ripple") {
      context.beginPath();
      context.arc(particle.x, particle.y, 3 + age * 23 * config.trailSpeed, 0, Math.PI * 2);
      context.globalAlpha = (1 - age) * 0.7;
      context.lineWidth = 2 * (1 - age) + 0.5;
      context.stroke();
    } else if (effect === "paws") {
      drawPaw(context, px, py, size * 1.4);
    } else if (effect === "spider") {
      context.beginPath();
      context.moveTo(particle.x, particle.y);
      context.lineTo(x, y);
      context.lineWidth = 1;
      context.stroke();
    } else if (effect === "liquid") {
      context.beginPath();
      context.arc(px, py, size * (1.3 + Math.sin(time / 120 + particle.seed) * 0.25), 0, Math.PI * 2);
      context.globalAlpha = (1 - age) * 0.34;
      context.fill();
    } else if (effect === "pixel") {
      context.fillRect(Math.round(px / 4) * 4, Math.round(py / 4) * 4, size * 1.2, size * 1.2);
    } else if (effect === "magic") {
      star(context, px, py, size * (1 + Math.sin(time / 90 + particle.seed) * 0.25));
    } else if (effect === "fireflies") {
      context.globalAlpha = (0.35 + (Math.sin(time / 130 + particle.seed) + 1) * 0.3) * (1 - age);
      context.beginPath();
      context.arc(px, py, size, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.arc(px, py, size * (effect === "comet" ? 0.65 : 1), 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawBursts(context: CanvasRenderingContext2D, config: CursorEffectsConfig, bursts: Burst[], time: number) {
  const lifetime = clickLifetime(config);
  context.save();
  context.strokeStyle = config.clickEffectColor;
  context.fillStyle = config.clickEffectColor;
  context.shadowColor = config.clickEffectColor;
  context.shadowBlur = 12 * config.glow;
  for (let index = bursts.length - 1; index >= 0; index--) {
    const burst = bursts[index];
    const progress = easeProgress((time - burst.born) / lifetime, config.animationEasing);
    if (progress >= 1) {
      bursts.splice(index, 1);
      continue;
    }
    const radius = (8 + 34 * progress) * config.clickSize;
    context.globalAlpha = 1 - progress;
    if (burst.game) {
      context.save();
      context.globalAlpha = 1 - progress;
      context.font = "600 12px ui-monospace, monospace";
      context.textAlign = "center";
      context.shadowBlur = 6;
      context.fillText("+10", burst.x, burst.y - radius * 0.7);
      context.restore();
    }
    if (burst.effect === "none") continue;
    if (burst.effect === "ripple" || burst.effect === "shockwave") {
      context.beginPath();
      context.arc(burst.x, burst.y, radius * (burst.effect === "shockwave" ? 1.45 : 1), 0, Math.PI * 2);
      context.lineWidth = (burst.effect === "shockwave" ? 4 : 2) * (1 - progress) + 0.5;
      context.stroke();
    } else {
      for (let item = 0; item < 12; item++) {
        const angle = (item / 12) * Math.PI * 2 + burst.seed;
        const distance = radius * progress;
        const px = burst.x + Math.cos(angle) * distance;
        const py = burst.y + Math.sin(angle) * distance;
        if (burst.effect === "hearts") {
          drawHeart(context, px, py, config.particleSize * 0.8);
        } else if (burst.effect === "stars" || burst.effect === "sparkles") {
          star(context, px, py, config.particleSize * (burst.effect === "stars" ? 1.25 : 0.8));
        } else if (burst.effect === "pixels") {
          context.fillRect(px, py, config.particleSize * 0.9, config.particleSize * 0.9);
        } else {
          context.beginPath();
          context.arc(px, py, config.particleSize * (1 - progress * 0.5), 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }
  context.restore();
}

export function CursorEffectsOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const hoveredTarget = useRef<Element | null>(null);
  const configRef = useRef<CursorEffectsConfig>(DEFAULT_CURSOR_EFFECTS);
  const pointer = useRef({
    x: -100, y: -100, active: false, lastMove: 0, lastX: -100, lastY: -100,
    renderX: -100, renderY: -100,
    spiderX: -100, spiderY: -100, spiderAngle: 0, spiderReady: false,
    spiderPath: [] as PointerSample[], pounce: null as SpiderPounce | null,
    native: false, state: null as CursorStateId | null,
    directionX: 0, directionY: 0, speed: 0,
  });
  const particles = useRef<Particle[]>([]);
  const bursts = useRef<Burst[]>([]);
  const trail = useRef<TrailPoint[]>([]);
  const mediaQuery = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const audioRef: AudioRef = { current: null };
    let drawFrame: ((time: number) => void) | null = null;
    const runtime = createCursorRuntime((time) => drawFrame?.(time), pointer.current);
    let canvasAvailable = false;
    let pointerDown = false;
    let dragged = false;
    let pointerDownX = 0;
    let pointerDownY = 0;
    const applyMode = () => {
      const config = configRef.current;
      const desktop = mediaQuery.current?.matches ?? false;
      const activeCursor = resolveCursorConfig(config, pointer.current.state);
      root.dataset.customCursor = String(canvasAvailable && desktop && pointer.current.active &&
        activeCursor !== null && activeCursor.cursor !== "spider" && !pointer.current.native);
      body.dataset.nativeCursorActive = String(pointer.current.native || activeCursor === null || activeCursor.cursor === "spider");
    };
    const load = () => {
      try {
        configRef.current = window.localStorage.getItem(CURSOR_EFFECTS_APPLIED_KEY) === "true"
          ? loadCursorEffects()
          : WEBSITE_CURSOR_DISABLED_CONFIG;
      } catch {
        configRef.current = WEBSITE_CURSOR_DISABLED_CONFIG;
      }
      if (configRef.current.cursor === "native") {
        particles.current.length = 0;
        bursts.current.length = 0;
        trail.current.length = 0;
        pointer.current.pounce = null;
      }
      applyMode();
      if (drawFrame) runtime.schedule();
    };
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.current = query;
    load();
    runtime.listen(window, CURSOR_EFFECTS_CHANGE_EVENT, load);
    runtime.listen(window, "storage", load);
    runtime.listen(window, CURSOR_IMAGE_LOADED_EVENT, load);
    const onMediaChange = () => {
      if (!query.matches) pointer.current.active = false;
      applyMode();
      runtime.schedule();
    };
    runtime.listen(query, "change", onMediaChange);

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      runtime.dispose();
      return () => {};
    }
    const drawingContext = context;
    canvasAvailable = true;
    applyMode();
    const resize = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    runtime.listen(window, "resize", resize);

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !query.matches) {
        runtime.leave();
        pointer.current.native = false;
        hoveredTarget.current = null;
        applyMode();
        runtime.schedule();
        return;
      }
      const now = performance.now();
      const current = pointer.current;
      const target = event.target instanceof Element ? event.target.closest("a, button, [role=button]") : null;
      const inDraftPreview = event.target instanceof Element && Boolean(event.target.closest(".cursor-effects-demo"));
      if (target !== hoveredTarget.current) {
        hoveredTarget.current = target;
        runtime.transition({ type: "hover", active: Boolean(target), time: now });
        if (!inDraftPreview && target && configRef.current.soundHover && audioRef.current?.state === "running") {
          playInteractionSound(audioRef.current, "hover", configRef.current.soundVolume);
        }
      }
      const wasActive = current.active;
      const distance = runtime.updatePointer(event.clientX, event.clientY, now, getCursorState(event.target, event.clientX, event.clientY), configRef.current.followSmoothing);
      if (!wasActive) {
        current.renderX = event.clientX;
        current.renderY = event.clientY;
      }
      if (pointerDown && Math.hypot(current.x - pointerDownX, current.y - pointerDownY) > 4) {
        dragged = true;
        runtime.transition({ type: "drag", active: true });
      }
      const activeCursor = resolveCursorConfig(configRef.current, current.state);
      current.native = activeCursor === null || activeCursor.cursor === "spider" || isNativeCursorTarget(event.target);
      if (activeCursor?.cursor === "spider") {
        if (!current.spiderReady) {
          current.spiderX = current.x;
          current.spiderY = current.y;
          current.spiderPath = [
            { x: current.x, y: current.y, time: now - configRef.current.spider.followDelayMs },
            { x: current.x, y: current.y, time: now },
          ];
          current.spiderReady = true;
        } else {
          recordPointerSample(current.spiderPath, { x: current.x, y: current.y, time: now });
        }
      }
      if (!inDraftPreview && distance > 4 + (1 - configRef.current.particleDensity) * 12) {
        const config = configRef.current;
        const count = Math.max(1, Math.round(config.particleDensity * 5));
        if (!reducedMotion.matches && Math.random() < config.particleDensity &&
            config.movement !== "none" && config.movement !== "comet" && config.movement !== "spider") {
          for (let index = 0; index < count; index++) {
            particles.current.push({
              x: current.x,
              y: current.y,
              born: current.lastMove,
              angle: Math.random() * Math.PI * 2,
              seed: Math.random() * 100,
            });
          }
          if (particles.current.length > 700) particles.current.splice(0, particles.current.length - 700);
        }
        if (!reducedMotion.matches && config.movement === "comet") trail.current.push({ x: current.x, y: current.y, born: current.lastMove });
        if (!reducedMotion.matches && config.movement === "spider") {
          particles.current.push({ x: current.x, y: current.y, born: current.lastMove, angle: 0, seed: 0 });
          if (config.spiderWeb) trail.current.push({ x: current.x, y: current.y, born: current.lastMove });
        }
        if (particles.current.length > 700) particles.current.splice(0, particles.current.length - 700);
        if (trail.current.length > 240) trail.current.splice(0, trail.current.length - 240);
      }
      current.lastX = current.x;
      current.lastY = current.y;
      applyMode();
      runtime.schedule();
    };
    const onLeave = () => {
      pointer.current.active = false;
      pointer.current.native = false;
      pointer.current.state = null;
      hoveredTarget.current = null;
      pointerDown = false;
      if (dragged) runtime.transition({ type: "drag", active: false });
      dragged = false;
      runtime.leave();
      applyMode();
      runtime.schedule();
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest("iframe")) onLeave();
    };
    const onClick = (event: MouseEvent) => {
      if (!query.matches || (event as PointerEvent).pointerType === "touch") return;
      if (event.target instanceof Element && event.target.closest(".cursor-effects-demo")) return;
      const current = configRef.current;
      runtime.transition({ type: "click", time: performance.now() });
      if (current.soundClick || current.soundHover) unlockInteractionAudio(audioRef, current.soundClick, current.soundVolume);
      const now = performance.now();
      const activeCursor = resolveCursorConfig(current, pointer.current.state);
      const spiderPounce = activeCursor?.cursor === "spider" && pointer.current.active;
      if (spiderPounce) {
        applySpiderClick(
          pointer.current,
          { x: event.clientX, y: event.clientY },
          now,
          current.spider.followDelayMs,
          reducedMotion.matches,
        );
      }
      if (current.click !== "none" || current.gameEffect) {
        addClickBurst(bursts.current, {
          x: event.clientX,
          y: event.clientY,
          born: now,
          effect: current.click,
          seed: Math.random() * Math.PI * 2,
          game: current.gameEffect,
        });
      }
      const pointerClick = Boolean(activeCursor && isPointerCursor(activeCursor.cursor));
      if (!spiderPounce && !pointerClick && current.click === "none" && !current.gameEffect) return;
      runtime.schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !query.matches) return;
      pointerDown = true;
      dragged = false;
      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerDown = false;
      if (dragged) runtime.transition({ type: "drag", active: false });
      dragged = false;
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerDown = false;
      if (dragged) runtime.transition({ type: "drag", active: false });
      dragged = false;
    };
    const onSelectionChange = () => {
      runtime.transition({ type: "text-selection", active: hasTextSelection() });
      if (pointer.current.active) {
        const hovered = document.elementFromPoint(pointer.current.x, pointer.current.y);
        pointer.current.state = getCursorState(hovered, pointer.current.x, pointer.current.y);
        const activeCursor = resolveCursorConfig(configRef.current, pointer.current.state);
        pointer.current.native = activeCursor === null || activeCursor.cursor === "spider" || isNativeCursorTarget(hovered);
        applyMode();
      }
    };
    const onFocusIn = () => {
      runtime.transition({ type: "focus", active: true });
    };
    const onFocusOut = () => {
      runtime.transition({ type: "focus", active: false });
    };
    function draw(now: number): boolean {
      const config = configRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;
      drawingContext.clearRect(0, 0, width, height);
      if (pointer.current.active) {
        const hovered = document.elementFromPoint(pointer.current.x, pointer.current.y);
        pointer.current.state = getCursorState(hovered, pointer.current.x, pointer.current.y);
        const activeCursor = resolveCursorConfig(config, pointer.current.state);
        pointer.current.native = activeCursor === null || activeCursor.cursor === "spider" || isNativeCursorTarget(hovered);
        applyMode();
      }
      const effectsEnabled = query.matches && !reducedMotion.matches;
      if (reducedMotion.matches) {
        particles.current.length = 0;
        bursts.current.length = 0;
        trail.current.length = 0;
      }
      if (!effectsEnabled || config.movement === "none") {
        particles.current.length = 0;
        trail.current.length = 0;
      }
      if (!effectsEnabled) bursts.current.length = 0;
      const hoveredElement = document.elementFromPoint(pointer.current.x, pointer.current.y);
      const nativePreview = isNativeCursorTarget(hoveredElement);
      const draftPreview = Boolean(hoveredElement?.closest('.cursor-effects-demo[data-preview-cursor="true"]'));
      if (nativePreview) {
        pointer.current.native = true;
        body.dataset.nativeCursorActive = "true";
      }
      const activeCursor = resolveCursorConfig(config, pointer.current.state);
      const isCustomCursor = query.matches && activeCursor !== null && pointer.current.active &&
        !pointer.current.native && !nativePreview && !draftPreview;
      if (draftPreview) {
        particles.current.length = 0;
        bursts.current.length = 0;
        trail.current.length = 0;
      }
      updateGlassLens(glassRef.current, config, pointer.current.x, pointer.current.y, isCustomCursor);
      let cursorX = pointer.current.x;
      let cursorY = pointer.current.y;
      let spiderWalking = false;
      const pounce = pointer.current.pounce;
      const pounceAge = pounce ? now - pounce.startedAt : -1;
      if (activeCursor?.cursor === "spider" && pointer.current.active && isCustomCursor) {
        const frame = sampleSpiderFrame(pointer.current, now, config.spider, config.animationEasing, reducedMotion.matches);
        cursorX = frame.x;
        cursorY = frame.y;
        spiderWalking = frame.walking;
      }
      if (isCustomCursor && activeCursor?.cursor !== "spider") {
        const smoothing = isPointerCursor(activeCursor.cursor) || reducedMotion.matches
          ? 1
          : config.followSmoothing;
        const position = applyFollowSmoothing(
          { x: pointer.current.renderX, y: pointer.current.renderY },
          { x: cursorX, y: cursorY },
          smoothing,
        );
        pointer.current.renderX = position.x;
        pointer.current.renderY = position.y;
        if (Math.hypot(cursorX - position.x, cursorY - position.y) < 0.35) {
          pointer.current.renderX = cursorX;
          pointer.current.renderY = cursorY;
        }
        cursorX = pointer.current.renderX;
        cursorY = pointer.current.renderY;
      }
      const hovered = Boolean(pointer.current.active && pointer.current.native === false &&
        pointer.current.lastMove > 0 &&
        hoveredElement?.closest("a, button, [role=button]"));
      if (config.magneticHover && hovered && activeCursor?.cursor !== "spider") {
        const target = document.elementFromPoint(cursorX, cursorY)?.closest<HTMLElement>("a, button, [role=button]");
        if (target) {
          const rect = target.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const amount = config.magneticStrength * 0.22;
          cursorX += (centerX - cursorX) * amount;
          cursorY += (centerY - cursorY) * amount;
        }
      }
      if (effectsEnabled && !draftPreview) {
        const lifetime = movementLifetime(config);
        trail.current = trail.current.filter((point) => now - point.born < lifetime);
        if (config.movement === "spider" && config.spiderWeb && trail.current.length > 1) {
          drawingContext.save();
          drawingContext.strokeStyle = config.effectColor;
          drawingContext.globalAlpha = 0.18;
          drawingContext.beginPath();
          trail.current.forEach((point, index) => index === 0 ? drawingContext.moveTo(point.x, point.y) : drawingContext.lineTo(point.x, point.y));
          drawingContext.stroke();
          drawingContext.restore();
        }
        drawEffect(drawingContext, config.movement, config, particles.current, trail.current, pointer.current.x, pointer.current.y, now);
      }
      if (effectsEnabled && !draftPreview) drawBursts(drawingContext, config, bursts.current, now);
      const spiderMotion: SpiderMotion = {
        angle: pointer.current.spiderAngle,
        walking: spiderWalking,
        pounceProgress: !reducedMotion.matches && pounce && pounceAge >= 0 && pounceAge < config.spider.pounceDurationMs
          ? pounceAge / config.spider.pounceDurationMs
          : null,
        gaitSpeed: config.spider.gaitSpeed,
        walkingIntensity: config.spider.walkingIntensity,
        legArticulation: config.spider.legArticulation,
        bodyBounce: config.spider.bodyBounce,
      };
      if (isCustomCursor && activeCursor) {
        drawCursor(drawingContext, activeCursor, cursorX, cursorY, hovered, now, spiderMotion, runtime.interaction, {
          directionX: pointer.current.directionX,
          directionY: pointer.current.directionY,
          speed: pointer.current.speed,
        }, reducedMotion.matches);
      }
      const spiderFollowing = activeCursor?.cursor === "spider" && isCustomCursor && !reducedMotion.matches &&
        pointer.current.spiderPath.length > 0 &&
        now - config.spider.followDelayMs < pointer.current.spiderPath[pointer.current.spiderPath.length - 1].time;
      const spiderAnimating = isCustomCursor && activeCursor?.cursor === "spider" && !reducedMotion.matches &&
        (spiderFollowing || spiderWalking || Boolean(pounce && pounceAge < config.spider.pounceDurationMs));
      const creature = activeCursor && isCreatureCursor(activeCursor.cursor)
        ? config.creatures[activeCursor.cursor]
        : null;
      const hoverAge = now - runtime.interaction.hoverStartedAt;
      const clickAge = now - runtime.interaction.lastClickAt;
      const hoverAnimationActive = runtime.interaction.hovered &&
        hoverAge >= 0 && hoverAge < config.hoverDelayMs + config.hoverTransitionMs;
      const clickAnimationActive = Number.isFinite(runtime.interaction.lastClickAt) &&
        clickAge >= 0 && clickAge < config.clickDelayMs + config.clickDurationMs;
      const creatureInteractionActive = creature && (
        (creature.hoverEnabled && hoverAge >= 0 && hoverAge < creature.hoverDelayMs + config.hoverDelayMs + config.hoverTransitionMs) ||
        (creature.clickEnabled && clickAge >= 0 && clickAge < creature.clickDelayMs + config.clickDelayMs +
          creature.clickDurationMs * config.clickDurationMs / 520)
      );
      return shouldContinueCursorRuntime({
        reducedMotion: reducedMotion.matches,
        movement: effectsEnabled && config.movement !== "none" &&
          (now - pointer.current.lastMove < 80 || particles.current.length > 0 || trail.current.length > 0),
        bursts: effectsEnabled && bursts.current.length > 0,
        glitch: config.glitchEffect && isCustomCursor && now - pointer.current.lastMove < 180,
        spider: spiderAnimating,
        follow: isCustomCursor && activeCursor?.cursor !== "spider" &&
          Math.hypot(pointer.current.x - pointer.current.renderX, pointer.current.y - pointer.current.renderY) >= 0.35,
        idle: Boolean(isCustomCursor && config.idleAnimationEnabled &&
          getCursorDefinition(activeCursor?.cursor ?? "")?.animation.idle &&
          (!creature || creature.idleEnabled)),
        interaction: Boolean(isCustomCursor && !reducedMotion.matches && activeCursor?.cursor !== "spider" &&
          (creature ? creatureInteractionActive : hoverAnimationActive || clickAnimationActive)),
        loading: Boolean(isCustomCursor && activeCursor?.cursor === "pointer-wait"),
        simulated: false,
      });
    }
    drawFrame = draw;
    const onReducedMotionChange = () => {
      runtime.schedule();
    };
    runtime.listen(reducedMotion, "change", onReducedMotionChange);
    runtime.listen(window, "pointermove", onMove as EventListener, { passive: true });
    runtime.listen(window, "pointerleave", onLeave);
    runtime.listen(document, "pointerover", onPointerOver as EventListener);
    runtime.listen(window, "pointerdown", onPointerDown as EventListener, { passive: true });
    runtime.listen(window, "pointerup", onPointerUp as EventListener, { passive: true });
    runtime.listen(window, "pointercancel", onPointerCancel as EventListener, { passive: true });
    runtime.listen(window, "click", onClick as EventListener, { passive: true });
    runtime.listen(document, "selectionchange", onSelectionChange);
    runtime.listen(window, "focusin", onFocusIn);
    runtime.listen(window, "focusout", onFocusOut);

    return () => {
      runtime.dispose();
      const audio = audioRef.current;
      if (audio) void audio.close();
      canvasAvailable = false;
      delete root.dataset.customCursor;
      delete body.dataset.nativeCursorActive;
    };
  }, []);

  return (
    <>
      <div ref={glassRef} className="cursor-effects-glass" aria-hidden="true" />
      <canvas ref={canvasRef} className="cursor-effects-canvas" aria-hidden="true" />
    </>
  );
}

const MOVEMENT_OPTIONS: Array<[MovementEffect, string]> = [
  ["none", "Off"], ["ripple", "Ripple"], ["particles", "Particle trail"], ["comet", "Comet"],
  ["magic", "Magic"], ["paws", "Paw prints"], ["spider", "Spider"], ["liquid", "Liquid"],
  ["fireflies", "Fireflies"], ["pixel", "Pixel trail"],
];
const CLICK_OPTIONS: Array<[ClickEffect, string]> = [
  ["none", "Off"], ["ripple", "Ripple burst"], ["particles", "Particle explosion"], ["stars", "Star explosion"],
  ["hearts", "Heart burst"], ["sparkles", "Sparkle burst"], ["pixels", "Pixel explosion"], ["shockwave", "Shockwave"],
];

function CursorEffectsPreview({ config }: { config: CursorEffectsConfig }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
    scheduleRef.current();
  }, [config]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!host || !canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const audioRef: AudioRef = { current: null };
    let hoveredTarget: Element | null = null;
    const pointer = {
      x: -100, y: -100, lastX: -100, lastY: -100, renderX: -100, renderY: -100, active: false, lastMove: 0,
      spiderX: -100, spiderY: -100, spiderAngle: 0, spiderReady: false,
      spiderPath: [] as PointerSample[], pounce: null as SpiderPounce | null,
      state: null as CursorStateId | null,
      directionX: 0, directionY: 0, speed: 0,
    };
    const particles: Particle[] = [];
    const bursts: Burst[] = [];
    const trail: TrailPoint[] = [];
    let drawFrame: ((time: number) => void) | null = null;
    const runtime = createCursorRuntime((time) => drawFrame?.(time), pointer);
    let pointerDown = false;
    let dragging = false;
    let downX = 0;
    let downY = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      schedule();
    };
    const schedule = () => {
      runtime.schedule();
    };
    scheduleRef.current = schedule;
    const draw = (now: number): boolean => {
      const current = configRef.current;
      context.clearRect(0, 0, width, height);
      const effectsEnabled = !reducedMotion.matches;
      if (!effectsEnabled || current.movement === "none") {
        particles.length = 0;
        trail.length = 0;
      }
      if (!effectsEnabled) bursts.length = 0;
      const rect = host.getBoundingClientRect();
      const hoverTarget = document.elementFromPoint(rect.left + pointer.x, rect.top + pointer.y)
        ?.closest("a, button, [role=button]") ?? null;
      const hovered = Boolean(pointer.active && host.matches(":hover") && host.contains(hoverTarget));
      const activeCursor = resolveCursorConfig(current, pointer.state);
      updateGlassLens(glassRef.current, activeCursor ?? current, pointer.x, pointer.y, pointer.active && activeCursor !== null);
      if (effectsEnabled) {
        const lifetime = movementLifetime(current);
        while (trail.length && now - trail[0].born >= lifetime) trail.shift();
        drawEffect(context, current.movement, current, particles, trail, pointer.x, pointer.y, now);
        drawBursts(context, current, bursts, now);
      }
      let cursorX = pointer.x;
      let cursorY = pointer.y;
      let spiderWalking = false;
      const pounce = pointer.pounce;
      const pounceAge = pounce ? now - pounce.startedAt : -1;
      if (pointer.active && activeCursor?.cursor === "spider") {
        const frame = sampleSpiderFrame(pointer, now, current.spider, current.animationEasing, reducedMotion.matches);
        cursorX = frame.x;
        cursorY = frame.y;
        spiderWalking = frame.walking;
      }
      if (pointer.active && activeCursor && activeCursor.cursor !== "spider") {
        const smoothing = isPointerCursor(activeCursor.cursor) || reducedMotion.matches
          ? 1
          : current.followSmoothing;
        const position = applyFollowSmoothing(
          { x: pointer.renderX, y: pointer.renderY },
          { x: cursorX, y: cursorY },
          smoothing,
        );
        pointer.renderX = position.x;
        pointer.renderY = position.y;
        if (Math.hypot(cursorX - position.x, cursorY - position.y) < 0.35) {
          pointer.renderX = cursorX;
          pointer.renderY = cursorY;
        }
        cursorX = pointer.renderX;
        cursorY = pointer.renderY;
      }
      if (pointer.active && activeCursor) {
        drawCursor(context, activeCursor, cursorX, cursorY, hovered, now, {
          angle: pointer.spiderAngle,
          walking: spiderWalking,
          pounceProgress: !reducedMotion.matches && pounce && pounceAge >= 0 && pounceAge < current.spider.pounceDurationMs
            ? pounceAge / current.spider.pounceDurationMs
            : null,
          gaitSpeed: current.spider.gaitSpeed,
          walkingIntensity: current.spider.walkingIntensity,
          legArticulation: current.spider.legArticulation,
          bodyBounce: current.spider.bodyBounce,
        }, runtime.interaction, {
          directionX: pointer.directionX,
          directionY: pointer.directionY,
          speed: pointer.speed,
        }, reducedMotion.matches);
        host.dataset.previewCursor = activeCursor.cursor === "spider" ? "native" : "true";
      } else if (pointer.active) {
        host.dataset.previewCursor = "native";
      } else {
        delete host.dataset.previewCursor;
      }
      const spiderFollowing = activeCursor?.cursor === "spider" && pointer.active && !reducedMotion.matches &&
        pointer.spiderPath.length > 0 &&
        now - current.spider.followDelayMs < pointer.spiderPath[pointer.spiderPath.length - 1].time;
      const spiderAnimating = activeCursor?.cursor === "spider" && pointer.active && !reducedMotion.matches &&
        (spiderFollowing || spiderWalking || Boolean(pounce && pounceAge < current.spider.pounceDurationMs));
      const cursorFollowing = activeCursor?.cursor !== "spider" &&
        Math.hypot(pointer.x - pointer.renderX, pointer.y - pointer.renderY) >= 0.35;
      const creature = activeCursor && isCreatureCursor(activeCursor.cursor)
        ? current.creatures[activeCursor.cursor]
        : null;
      const hoverAge = now - runtime.interaction.hoverStartedAt;
      const clickAge = now - runtime.interaction.lastClickAt;
      const hoverAnimationActive = runtime.interaction.hovered &&
        hoverAge >= 0 && hoverAge < current.hoverDelayMs + current.hoverTransitionMs;
      const clickAnimationActive = Number.isFinite(runtime.interaction.lastClickAt) &&
        clickAge >= 0 && clickAge < current.clickDelayMs + current.clickDurationMs;
      const creatureInteractionActive = creature && (
        (creature.hoverEnabled && hoverAge >= 0 && hoverAge < creature.hoverDelayMs + current.hoverDelayMs + current.hoverTransitionMs) ||
        (creature.clickEnabled && clickAge >= 0 && clickAge < creature.clickDelayMs + current.clickDelayMs +
          creature.clickDurationMs * current.clickDurationMs / 520)
      );
      return shouldContinueCursorRuntime({
        reducedMotion: reducedMotion.matches,
        movement: effectsEnabled && current.movement !== "none" &&
          (now - pointer.lastMove < 80 || particles.length > 0 || trail.length > 1),
        bursts: effectsEnabled && bursts.length > 0,
        glitch: current.glitchEffect && pointer.active && now - pointer.lastMove < 180,
        spider: spiderAnimating,
        follow: cursorFollowing,
        idle: Boolean(pointer.active && current.idleAnimationEnabled &&
          getCursorDefinition(activeCursor?.cursor ?? "")?.animation.idle &&
          (!creature || creature.idleEnabled)),
        interaction: Boolean(pointer.active && !reducedMotion.matches && activeCursor?.cursor !== "spider" &&
          (creature ? creatureInteractionActive : hoverAnimationActive || clickAnimationActive)),
        loading: Boolean(pointer.active && activeCursor?.cursor === "pointer-wait"),
        simulated: false,
      });
    };
    drawFrame = draw;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        pointer.active = false;
        runtime.leave();
        delete host.dataset.previewCursor;
        schedule();
        return;
      }
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const now = performance.now();
      const wasActive = pointer.active;
      const distance = runtime.updatePointer(x, y, now, getCursorState(event.target, event.clientX, event.clientY), configRef.current.followSmoothing);
      if (!wasActive) {
        pointer.renderX = x;
        pointer.renderY = y;
      }
      const current = configRef.current;
      if (pointerDown && Math.hypot(x - downX, y - downY) > 4) {
        dragging = true;
        runtime.transition({ type: "drag", active: true });
      }
      const activeCursor = resolveCursorConfig(current, pointer.state);
      if (activeCursor?.cursor === "spider") {
        if (!pointer.spiderReady) {
          pointer.spiderX = x;
          pointer.spiderY = y;
          pointer.spiderPath = [
            { x, y, time: now - configRef.current.spider.followDelayMs },
            { x, y, time: now },
          ];
          pointer.spiderReady = true;
        } else {
          recordPointerSample(pointer.spiderPath, { x, y, time: now });
        }
      }
      host.dataset.previewCursor = activeCursor === null || activeCursor.cursor === "spider" || isNativeCursorTarget(event.target)
        ? "native"
        : "true";
      const hoverTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest("a, button, [role=button]") ?? null;
      if (hoverTarget !== hoveredTarget) {
        hoveredTarget = hoverTarget;
        runtime.transition({ type: "hover", active: Boolean(hoverTarget), time: now });
        if (hoverTarget && current.soundHover && audioRef.current?.state === "running") {
          playInteractionSound(audioRef.current, "hover", current.soundVolume);
        }
      }
      if (distance > 4 + (1 - current.particleDensity) * 12) {
        const count = Math.max(1, Math.round(current.particleDensity * 5));
        if (!reducedMotion.matches && Math.random() < current.particleDensity &&
            current.movement !== "none" && current.movement !== "comet" && current.movement !== "spider") {
          for (let index = 0; index < count; index++) {
            particles.push({ x, y, born: pointer.lastMove, angle: Math.random() * Math.PI * 2, seed: Math.random() * 100 });
          }
        }
        if (!reducedMotion.matches && current.movement === "comet") trail.push({ x, y, born: pointer.lastMove });
        if (!reducedMotion.matches && current.movement === "spider") {
          particles.push({ x, y, born: pointer.lastMove, angle: 0, seed: 0 });
          if (current.spiderWeb) trail.push({ x, y, born: pointer.lastMove });
        }
        if (particles.length > 700) particles.splice(0, particles.length - 700);
        if (trail.length > 240) trail.splice(0, trail.length - 240);
      }
      schedule();
    };
    const onLeave = () => {
      pointer.active = false;
      hoveredTarget = null;
      pointerDown = false;
      if (dragging) runtime.transition({ type: "drag", active: false });
      dragging = false;
      runtime.leave();
      delete host.dataset.previewCursor;
      schedule();
    };
    const onClick = (event: MouseEvent) => {
      const current = configRef.current;
      runtime.transition({ type: "click", time: performance.now() });
      if (current.soundClick || current.soundHover) unlockInteractionAudio(audioRef, current.soundClick, current.soundVolume);
      const now = performance.now();
      const activeCursor = resolveCursorConfig(current, pointer.state);
      const spiderPounce = activeCursor?.cursor === "spider" && pointer.active;
      const pointerClick = Boolean(activeCursor && isPointerCursor(activeCursor.cursor));
      if (spiderPounce) {
        const rect = host.getBoundingClientRect();
        applySpiderClick(
          pointer,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          now,
          current.spider.followDelayMs,
          reducedMotion.matches,
        );
      }
      if (reducedMotion.matches) {
        if (spiderPounce || pointerClick) schedule();
        return;
      }
      if (!spiderPounce && !pointerClick && current.click === "none" && !current.gameEffect) return;
      const rect = host.getBoundingClientRect();
      if (current.click !== "none" || current.gameEffect) {
        addClickBurst(bursts, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          born: now,
          effect: current.click,
          seed: Math.random() * Math.PI * 2,
          game: current.gameEffect,
        });
      }
      schedule();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      pointerDown = true;
      dragging = false;
      downX = event.clientX - rect.left;
      downY = event.clientY - rect.top;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerDown = false;
      if (dragging) runtime.transition({ type: "drag", active: false });
      dragging = false;
    };
    const onPointerCancel = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerDown = false;
      if (dragging) runtime.transition({ type: "drag", active: false });
      dragging = false;
    };
    const onSelectionChange = () => {
      runtime.transition({ type: "text-selection", active: hasTextSelection() });
      if (pointer.active) {
        const rect = host.getBoundingClientRect();
        const hovered = document.elementFromPoint(rect.left + pointer.x, rect.top + pointer.y);
        pointer.state = getCursorState(hovered, rect.left + pointer.x, rect.top + pointer.y);
        const activeCursor = resolveCursorConfig(configRef.current, pointer.state);
        host.dataset.previewCursor = activeCursor === null || activeCursor.cursor === "spider" || isNativeCursorTarget(hovered)
          ? "native"
          : "true";
      }
      schedule();
    };
    const onFocusIn = () => {
      runtime.transition({ type: "focus", active: true });
      schedule();
    };
    const onFocusOut = () => {
      runtime.transition({ type: "focus", active: false });
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    runtime.listen(host, "pointermove", onMove as EventListener);
    runtime.listen(host, "pointerleave", onLeave);
    runtime.listen(host, "pointerdown", onPointerDown as EventListener, { passive: true });
    runtime.listen(host, "pointerup", onPointerUp as EventListener, { passive: true });
    runtime.listen(host, "pointercancel", onPointerCancel as EventListener, { passive: true });
    runtime.listen(host, "focusin", onFocusIn);
    runtime.listen(host, "focusout", onFocusOut);
    runtime.listen(host, "click", onClick as EventListener);
    runtime.listen(document, "selectionchange", onSelectionChange);
    runtime.listen(window, "resize", resize);
    runtime.listen(reducedMotion, "change", schedule);
    const onCursorImageLoaded = () => schedule();
    runtime.listen(window, CURSOR_IMAGE_LOADED_EVENT, onCursorImageLoaded);
    resize();

    return () => {
      observer.disconnect();
      runtime.dispose();
      scheduleRef.current = () => {};
      if (audioRef.current) void audioRef.current.close();
      delete host.dataset.previewCursor;
    };
  }, []);

  return (
    <div className="cursor-effects-demo" aria-label="Live cursor preview" ref={hostRef}>
      <canvas ref={canvasRef} className="cursor-effects-preview-canvas" aria-hidden="true" />
      <div ref={glassRef} className="cursor-effects-glass cursor-effects-preview-glass" aria-hidden="true" />
      <header className="cursor-effects-preview-heading">
        <strong>Live preview</strong>
        <small>Try movement, hover, click, drag, text selection, and focus.</small>
      </header>
      <div className="cursor-effects-preview-examples">
        <h3>Small moments, made tangible.</h3>
        <p>Select this paragraph to test native text selection and cursor-state behavior.</p>
        <a href="#cursor-preview-link" onClick={(event) => event.preventDefault()}>Preview link</a>
        <button type="button">Try hover and click</button>
        <input aria-label="Preview text input" type="text" placeholder="Focus or select text" />
        <textarea aria-label="Preview text area" rows={1} defaultValue="Text area preview" />
        <div className="cursor-effects-preview-card" draggable="true">
          <span role="img" aria-label="Abstract preview tile">IMAGE / CARD</span>
        </div>
      </div>
    </div>
  );
}

type CursorShowcaseMode = "hover" | "click" | "move" | "still";

const SHOWCASE_CARDS: Array<{ mode: CursorShowcaseMode; title: string; caption: string }> = [
  { mode: "hover", title: "Hover a button", caption: "See your hover size, shape, and color." },
  { mode: "click", title: "Click effect", caption: "Your selected click effect, replayed." },
  { mode: "move", title: "Movement trail", caption: "Your selected trail follows the cursor." },
  { mode: "still", title: "Cursor preview", caption: "Your cursor, held in one position." },
];

function CursorShowcaseCard({ config, mode, title, caption }: {
  config: CursorEffectsConfig;
  mode: CursorShowcaseMode;
  title: string;
  caption: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const configRef = useRef(config);
  const scheduleRef = useRef<() => void>(() => {});
  useEffect(() => {
    configRef.current = config;
    scheduleRef.current();
  }, [config]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!stage || !canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const createSpiderState = () => ({
      x: 0,
      y: 0,
      lastX: 0,
      lastY: 0,
      lastMove: 0,
      active: false,
      directionX: 0,
      directionY: 0,
      speed: 0,
      state: null as CursorStateId | null,
      spiderX: 0,
      spiderY: 0,
      spiderReady: false,
      spiderPath: [] as PointerSample[],
      pounce: null as SpiderPounce | null,
      spiderAngle: 0,
    });
    const scenes = [
      { particles: [] as Particle[], bursts: [] as Burst[], trail: [] as TrailPoint[], lastTrail: 0, lastBurst: 0, lastSpiderSample: 0, spider: createSpiderState() },
      { particles: [] as Particle[], bursts: [] as Burst[], trail: [] as TrailPoint[], lastTrail: 0, lastBurst: 0, lastSpiderSample: 0, spider: createSpiderState() },
    ];
    let drawFrame: ((time: number) => void) | null = null;
    const runtime = createCursorRuntime((time) => drawFrame?.(time));
    let burstTimer = 0;
    let width = 0;
    let height = 0;
    let lastFrame = 0;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      schedule();
    };
    const schedule = () => {
      runtime.schedule();
    };
    scheduleRef.current = schedule;
    const draw = (now: number): boolean => {
      if (now - lastFrame < 1000 / 30) {
        return true;
      }
      lastFrame = now;
      const current = configRef.current;
      const moving = mode === "move" && !reducedMotion.matches;
      context.clearRect(0, 0, width, height);
      const panelWidth = width / 2;
      scenes.forEach((scene, index) => {
        const x = index * panelWidth + (mode === "move" && moving
          ? panelWidth * (0.18 + (0.64 * (0.5 + 0.5 * Math.sin(now / 1100))))
          : panelWidth * (mode === "hover" ? 0.5 : mode === "click" ? 0.72 : 0.5));
        const y = mode === "move" && moving
          ? height * (0.5 + Math.sin(now / 580) * 0.19)
          : height * (mode === "hover" ? 0.67 : mode === "click" ? 0.68 : 0.5);
        if (index === 0) {
          runtime.updatePointer(x, y, now, mode === "hover" ? "pointer" : null, current.followSmoothing);
          runtime.transition({ type: "hover", active: mode === "hover", time: now });
        }
        if (moving) updateCursorPointer(scene.spider, x, y, now);
        else {
          scene.spider.x = x;
          scene.spider.y = y;
        }
        if (moving && now - scene.lastSpiderSample > 33) {
          scene.lastSpiderSample = now;
          recordPointerSample(scene.spider.spiderPath, { x, y, time: now });
        }
        if (moving && current.movement !== "none" && now - scene.lastTrail > 55) {
          scene.lastTrail = now;
          if (current.movement === "comet" || current.movement === "spider") {
            scene.trail.push({ x, y, born: now });
            if (current.movement === "spider") {
              scene.particles.push({ x, y, born: now, angle: 0, seed: 0 });
            }
          } else if (Math.random() < current.particleDensity) {
            const count = Math.max(1, Math.round(current.particleDensity * 4));
            for (let particleIndex = 0; particleIndex < count; particleIndex++) {
              scene.particles.push({ x, y, born: now, angle: Math.random() * Math.PI * 2, seed: Math.random() * 100 });
            }
          }
          if (scene.particles.length > 700) scene.particles.splice(0, scene.particles.length - 700);
          if (scene.trail.length > 240) scene.trail.splice(0, scene.trail.length - 240);
        }
        if (mode === "click" && now - scene.lastBurst > 1450) {
          scene.lastBurst = now;
          if (index === 0) runtime.transition({ type: "click", time: now });
          if (current.cursor === "spider") {
            applySpiderClick(scene.spider, { x, y }, now, current.spider.followDelayMs, reducedMotion.matches);
          }
          if (current.click !== "none" || current.gameEffect) {
            scene.bursts.push({ x, y, born: now, effect: current.click, seed: Math.random() * Math.PI * 2, game: current.gameEffect });
          }
        }
        const lifetime = movementLifetime(current);
        while (scene.trail.length && now - scene.trail[0].born >= lifetime) scene.trail.shift();
        context.save();
        context.beginPath();
        context.rect(index * panelWidth, 0, panelWidth, height);
        context.clip();
        if (!reducedMotion.matches) {
          drawEffect(context, current.movement, current, scene.particles, scene.trail, x, y, now);
          drawBursts(context, current, scene.bursts, now);
        } else {
          scene.particles.length = 0;
          scene.bursts.length = 0;
          scene.trail.length = 0;
        }
        const pounce = scene.spider.pounce;
        const pounceAge = pounce ? now - pounce.startedAt : -1;
        const spiderFrame = current.cursor === "spider"
          ? sampleSpiderFrame(scene.spider, now, current.spider, current.animationEasing, reducedMotion.matches)
          : null;
        const spiderMotion: SpiderMotion = {
          angle: scene.spider.spiderAngle,
          walking: spiderFrame?.walking ?? false,
          pounceProgress: !reducedMotion.matches && mode === "click" && current.cursor === "spider" &&
            pounce && pounceAge >= 0 && pounceAge < current.spider.pounceDurationMs
            ? pounceAge / current.spider.pounceDurationMs
            : null,
          gaitSpeed: current.spider.gaitSpeed,
          walkingIntensity: current.spider.walkingIntensity,
          legArticulation: current.spider.legArticulation,
          bodyBounce: current.spider.bodyBounce,
        };
        if (current.cursor !== "native") drawCursor(context, current, spiderFrame?.x ?? x, spiderFrame?.y ?? y, mode === "hover", now, spiderMotion, runtime.interaction, {
          directionX: Math.cos(spiderMotion.angle),
          directionY: Math.sin(spiderMotion.angle),
          speed: moving ? 1 : 0,
        }, reducedMotion.matches);
        context.restore();
      });
      const activeClickAnimation = scenes.some((scene) =>
        scene.bursts.length > 0 ||
        (current.cursor === "spider" && scene.spider.pounce !== null));
      const creature = isCreatureCursor(current.cursor) ? current.creatures[current.cursor] : null;
      const clickAge = now - runtime.interaction.lastClickAt;
      const hoverAge = now - runtime.interaction.hoverStartedAt;
      const clickAnimationActive = Number.isFinite(runtime.interaction.lastClickAt) &&
        clickAge >= 0 && clickAge < current.clickDelayMs + current.clickDurationMs;
      const hoverAnimationActive = runtime.interaction.hovered &&
        hoverAge >= 0 && hoverAge < current.hoverDelayMs + current.hoverTransitionMs;
      const creatureInteractionActive = creature && (
        (creature.clickEnabled && clickAge >= 0 && clickAge < creature.clickDelayMs + current.clickDelayMs +
          creature.clickDurationMs * current.clickDurationMs / 520) ||
        (creature.hoverEnabled && hoverAge >= 0 && hoverAge < creature.hoverDelayMs + current.hoverDelayMs + current.hoverTransitionMs)
      );
      const keepAnimating = shouldContinueCursorRuntime({
        reducedMotion: reducedMotion.matches,
        movement: moving && current.movement !== "none" &&
          scenes.some((scene) => scene.particles.length > 0 || scene.trail.length > 0),
        bursts: activeClickAnimation,
        glitch: false,
        spider: current.cursor === "spider" && scenes.some((scene) => scene.spider.pounce !== null),
        follow: false,
        idle: Boolean(current.idleAnimationEnabled && !reducedMotion.matches &&
          getCursorDefinition(current.cursor)?.animation.idle && (!creature || creature.idleEnabled)),
        interaction: Boolean(!reducedMotion.matches && current.cursor !== "spider" &&
          (creature ? creatureInteractionActive : clickAnimationActive || hoverAnimationActive)),
        loading: false,
        simulated: moving,
      });
      if (!keepAnimating && mode === "click" && !reducedMotion.matches && !burstTimer) {
        const nextBurstDelay = Math.max(50, 1450 - (now - scenes[0].lastBurst));
        burstTimer = window.setTimeout(() => {
          burstTimer = 0;
          schedule();
        }, nextBurstDelay);
      }
      return keepAnimating;
    };
    drawFrame = draw;

    runtime.listen(reducedMotion, "change", schedule);
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) schedule();
      else {
        runtime.stop();
        window.clearTimeout(burstTimer);
        burstTimer = 0;
      }
    });
    visibilityObserver.observe(stage);
    resize();
    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      runtime.dispose();
      window.clearTimeout(burstTimer);
      scheduleRef.current = () => {};
    };
  }, [mode]);

  return (
    <article className="cursor-effects-showcase-card">
      <header><strong>{title}</strong><span>{caption}</span></header>
      <div className={`cursor-effects-showcase-stage ${mode}`} data-preview-cursor={config.cursor === "native" || config.cursor === "spider" ? "native" : undefined} ref={stageRef}>
        <div className="cursor-effects-showcase-surface light">
          <strong>LIGHT · STUDIO</strong>
          <span>Thoughtful design, made for people.</span>
          <button type="button" tabIndex={-1}>Explore work</button>
        </div>
        <div className="cursor-effects-showcase-surface dark">
          <strong>DARK · STUDIO</strong>
          <span>Thoughtful design, made for people.</span>
          <button type="button" tabIndex={-1}>Explore work</button>
        </div>
        <canvas ref={canvasRef} aria-hidden="true" />
      </div>
    </article>
  );
}

function CursorEffectsCatalog({
  previewCursor,
  onSelect,
}: {
  previewCursor: CursorPresetId;
  onSelect: (id: CursorPresetId) => void;
}) {
  return (
    <section className="cursor-effects-catalog" aria-label="Cursor design previews">
      <header>
        <strong>Romantic, dessert, weather &amp; space demos</strong>
        <span>Select a design, then try hover, click, and movement below.</span>
      </header>
      <div className="cursor-effects-catalog-grid">
        {CREATURE_CURSOR_IDS.slice(40).map((id) => {
          const definition = getCursorDefinition(id);
          return (
            <button
              type="button"
              key={id}
              className={`cursor-effects-catalog-entry ${previewCursor === id ? "selected" : ""}`}
              aria-pressed={previewCursor === id}
              onClick={() => onSelect(id)}
            >
              <CursorPresetSwatch id={id} />
              <span>
                <strong>{definition?.name ?? id}</strong>
                <small>{definition?.description}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CursorEffectsShowcase({
  config,
  previewCursor,
}: {
  config: CursorEffectsConfig;
  previewCursor: CursorPresetId;
}) {
  const previewConfig = previewCursor === config.cursor
    ? config
    : { ...config, cursor: previewCursor };

  return (
    <section className="cursor-effects-showcase" aria-label="Selected cursor behavior examples">
      {SHOWCASE_CARDS.map((card) => {
        const caption = previewConfig.cursor === "native"
          ? card.mode === "still"
            ? "The OS cursor stays native; move over the live preview to see it."
            : `The OS cursor stays native. ${card.caption}`
          : card.mode === "click"
          ? previewConfig.click === "none"
            ? previewConfig.cursor === "spider" ? "The spider crouches, then pounces when clicked." : "Choose a click effect below to preview it."
            : `${CLICK_OPTIONS.find(([value]) => value === previewConfig.click)?.[1]} replays here.${previewConfig.cursor === "spider" ? " The spider pounces too." : ""}`
          : card.mode === "move"
            ? previewConfig.movement === "none"
              ? previewConfig.cursor === "spider" ? "The spider walks as it follows the cursor." : "Choose a movement effect below to add a trail."
              : `${MOVEMENT_OPTIONS.find(([value]) => value === previewConfig.movement)?.[1]} follows the cursor.${previewConfig.cursor === "spider" ? " Its legs walk in motion." : ""}`
            : card.caption;
        return <CursorShowcaseCard key={card.mode} {...card} caption={caption} config={previewConfig} />;
      })}
    </section>
  );
}

function CursorPresetSwatch({ id }: { id: CursorPresetId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (time = performance.now()) => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = 36 * ratio;
      canvas.height = 36 * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const presetConfig = getCursorDefinition(id)?.defaultConfig() ?? { ...DEFAULT_CURSOR_EFFECTS, cursor: id };
      drawCursor(context, { ...presetConfig, size: 23, glow: 0.1 }, 18, 18, false, time);
    };
    const animate = (time: number) => {
      draw(time);
      frame = window.requestAnimationFrame(animate);
    };
    const startAnimation = () => {
      if (id === "pointer-wait" && !reducedMotion.matches && frame === 0) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    const onCursorImageLoaded = () => draw();
    const onReducedMotionChange = () => {
      if (reducedMotion.matches) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        draw();
      } else {
        startAnimation();
      }
    };
    window.addEventListener(CURSOR_IMAGE_LOADED_EVENT, onCursorImageLoaded);
    reducedMotion.addEventListener("change", onReducedMotionChange);
    draw();
    startAnimation();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(CURSOR_IMAGE_LOADED_EVENT, onCursorImageLoaded);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
    };
  }, [id]);

  return id === "native"
    ? <span className="cursor-effects-native-swatch" title="Hover to see your operating-system cursor" />
    : <canvas className="cursor-effects-preview" ref={canvasRef} aria-hidden="true" />;
}

const POINTER_PREVIEW_ITEMS: Array<[CursorPresetId, string, boolean?]> = [
  ["pointer", "Arrow"],
  ["pointer", "Click", true],
  ["pointer-hand", "Link"],
  ["pointer-text", "Text / I-beam"],
  ["pointer-move", "Move"],
  ["pointer-resize-nesw", "Resize NE–SW"],
  ["pointer-resize-nwse", "Resize NW–SE"],
  ["pointer-resize-ew", "Resize left–right"],
  ["pointer-resize-ns", "Resize up–down"],
  ["pointer-wait", "Wait / loading"],
  ["pointer-not-allowed", "Blocked"],
];

function CursorPointerSetPreview() {
  return (
    <section className="cursor-effects-pointer-family" aria-label="Pointer preset cursor states">
      <header>
        <strong>Pointer cursor previews</strong>
        <span>All supplied cursor states, including loading and blocked. Loading colors cycle in place, with the darkest square fully opaque and the others fading to suggest motion without rotating.</span>
      </header>
      <div className="cursor-effects-pointer-family-grid">
        {POINTER_PREVIEW_ITEMS.map(([cursor, label, clicked]) => (
          <div className="cursor-effects-pointer-family-item" key={`${cursor}-${label}`}>
            <CursorPointerFamilySwatch cursor={cursor} clicked={clicked === true} label={label} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CursorPointerFamilySwatch({ cursor, clicked, label }: { cursor: CursorPresetId; clicked: boolean; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (time = performance.now()) => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = 64 * ratio;
      canvas.height = 64 * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, 64, 64);
      context.save();
      context.translate(32, 32);
      const previewConfig = {
        ...DEFAULT_CURSOR_EFFECTS,
        cursor,
        size: 38,
        color: "#ffffff",
        borderColor: "#080808",
        borderWidth: 2.2,
        pointerAccentColor: "#ADEB66",
        shadow: 0,
        glow: 0,
        hoverGrow: false,
        idleAnimationEnabled: false,
        cursorAnimationIntensity: 0,
      };
      const interaction = {
        ...EMPTY_CURSOR_INTERACTION_STATE,
        current: clicked ? "click" as const : "idle" as const,
        lastClickAt: clicked ? time - 40 : Number.NEGATIVE_INFINITY,
      };
      const pointerArrow = cursor === "pointer";
      drawCursor(context, previewConfig, pointerArrow ? 18 : 0, pointerArrow ? 15 : 0, false, time, undefined, interaction);
      context.restore();
    };
    const animate = (time: number) => {
      draw(time);
      frame = window.requestAnimationFrame(animate);
    };
    const startAnimation = () => {
      if (cursor === "pointer-wait" && !reducedMotion.matches && frame === 0) {
        frame = window.requestAnimationFrame(animate);
      }
    };
    const onCursorImageLoaded = () => draw();
    const onReducedMotionChange = () => {
      if (reducedMotion.matches) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        draw();
      } else {
        startAnimation();
      }
    };
    window.addEventListener(CURSOR_IMAGE_LOADED_EVENT, onCursorImageLoaded);
    reducedMotion.addEventListener("change", onReducedMotionChange);
    draw();
    startAnimation();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(CURSOR_IMAGE_LOADED_EVENT, onCursorImageLoaded);
      reducedMotion.removeEventListener("change", onReducedMotionChange);
    };
  }, [clicked, cursor]);

  return <canvas
    className={cursor === "pointer-wait" ? "cursor-effects-pointer-family-swatch--loading" : undefined}
    ref={canvasRef}
    role="img"
    aria-label={label}
  />;
}

function RangeControl({ label, value, min, max, step = 0.01, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void;
}) {
  return <label className="cursor-effect-control"><span>{label}<output>{value.toFixed(step < 1 ? 2 : 0)}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CursorImagePicker({ image, onChange }: { image: string; onChange: (image: string) => void }) {
  const [error, setError] = useState("");
  return (
    <div className="cursor-effects-image-picker">
      <label className="cursor-effect-control">
        <span>Custom cursor image</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={async (event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            try {
              const encoded = await encodeCursorImage(file);
              onChange(encoded);
              setError("");
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Could not read this image.");
            } finally {
              input.value = "";
            }
          }}
        />
      </label>
      {image && <>
        <NextImage src={image} alt="Uploaded cursor preview" width={48} height={48} unoptimized />
        <button type="button" className="ml-btn" onClick={() => { onChange(""); setError(""); }}>Remove image</button>
      </>}
      {error && <span className="cursor-effects-error" role="alert">{error}</span>}
      <small>PNG, JPEG, WebP, or sanitized SVG · up to 120 KB</small>
    </div>
  );
}

export function CursorEffectsSettings() {
  const [config, setConfig] = useState(DEFAULT_CURSOR_EFFECTS);
  const [previewSelection, setPreviewSelection] = useState({
    baseCursor: DEFAULT_CURSOR_EFFECTS.cursor,
    selectedCursor: DEFAULT_CURSOR_EFFECTS.cursor,
  });
  const [category, setCategory] = useState<(typeof CURSOR_CATEGORIES)[number]>("Classic");
  const [selectedState, setSelectedState] = useState<CursorStateId>("pointer");
  const [library, setLibrary] = useState<CursorLibraryState>(createEmptyCursorLibrary);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [libraryWritable, setLibraryWritable] = useState(true);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [templateNameAction, setTemplateNameAction] = useState<"save" | "rename" | "duplicate" | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setToolbarHost(document.querySelector<HTMLElement>(".ml-cursor-toolbar-actions"));
      try {
        setConfig(window.localStorage.getItem(CURSOR_EFFECTS_STORAGE_KEY) ? loadCursorEffects() : DEFAULT_CURSOR_EFFECTS);
        setApplied(window.localStorage.getItem(CURSOR_EFFECTS_APPLIED_KEY) === "true");
        const result = loadCursorLibrary(window.localStorage);
        setLibrary(result.state);
        if (result.migratedLegacy) saveCursorLibrary(window.localStorage, result.state);
        if (result.warning) {
          setLibraryWritable(false);
          setError(result.warning);
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not load cursor settings from this browser.");
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const persistLibrary = useCallback((next: CursorLibraryState) => {
    if (!libraryWritable) {
      throw new Error("The saved cursor library is read-only because its data could not be safely loaded.");
    }
    const savedLibrary = saveCursorLibrary(window.localStorage, next);
    setLibrary(savedLibrary);
    return savedLibrary;
  }, [libraryWritable]);
  useEffect(() => {
    if (!configDirty || config.cursor === "native") return;
    const timeout = window.setTimeout(() => {
      try {
        persistLibrary(saveCursorCustomization(library, config.cursor, config));
        setConfigDirty(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save this cursor customization.");
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [config, configDirty, library, persistLibrary]);

  const update = (patch: Partial<CursorEffectsConfig>) => {
    const next = sanitizeCursorEffects({ ...config, ...patch });
    setConfig(next);
    setConfigDirty(true);
    setError("");
  };
  const previewCursor = previewSelection.baseCursor === config.cursor
    ? previewSelection.selectedCursor
    : config.cursor;
  const updateCreature = (patch: Partial<CreatureCursorSettings>) => {
    if (!isCreatureCursor(config.cursor)) return;
    update({
      creatures: {
        ...config.creatures,
        [config.cursor]: { ...config.creatures[config.cursor], ...patch },
      },
    });
  };
  const flushCurrentCustomization = () => {
    if (!configDirty || config.cursor === "native") return library;
    try {
      const saved = persistLibrary(saveCursorCustomization(library, config.cursor, config));
      setConfigDirty(false);
      return saved;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this cursor customization.");
      return null;
    }
  };
  const selectCursor = (cursor: CursorPresetId) => {
    const currentLibrary = flushCurrentCustomization();
    if (!currentLibrary) return;
    const savedCustomization = currentLibrary.customizations[cursor];
    const definition = getCursorDefinition(cursor);
    const defaultConfig = definition?.defaultConfig() ?? DEFAULT_CURSOR_EFFECTS;
    let next = savedCustomization
      ? sanitizeCursorEffects(savedCustomization.configuration)
      : sanitizeCursorEffects({
        ...defaultConfig,
        cursorStates: cursor === "pointer" ? defaultConfig.cursorStates : config.cursorStates,
      });
    if (cursor === "pointer" && savedCustomization) {
      const savedStates = savedCustomization.configuration.cursorStates as
        Partial<CursorEffectsConfig["cursorStates"]>;
      if (!Object.prototype.hasOwnProperty.call(savedStates, "resize-ew")) {
        const cursorStates = { ...next.cursorStates };
        for (const [state] of CURSOR_STATE_OPTIONS) {
          const previous = savedStates[state];
          if (!previous?.enabled || previous.cursor === "pointer") {
            cursorStates[state] = defaultConfig.cursorStates[state];
          }
        }
        next = sanitizeCursorEffects({ ...next, cursorStates });
      }
      let pointerSizeUpdated = false;
      const cursorStates = { ...next.cursorStates };
      for (const [state] of CURSOR_STATE_OPTIONS) {
        const stateConfig = cursorStates[state];
        if (stateConfig.size === 36 || (state === "text" && stateConfig.size === 34)) {
          cursorStates[state] = { ...stateConfig, size: 28 };
          pointerSizeUpdated = true;
        }
      }
      if (next.size === 36) {
        next = { ...next, size: 28 };
        pointerSizeUpdated = true;
      }
      if (pointerSizeUpdated) {
        next = sanitizeCursorEffects({ ...next, cursorStates });
        try {
          persistLibrary(saveCursorCustomization(currentLibrary, cursor, next));
        } catch (reason) {
          setConfig(next);
          setConfigDirty(false);
          setError(reason instanceof Error ? reason.message : "The updated Pointer preset could not be saved.");
          return;
        }
      }
    }
    setConfig(next);
    setConfigDirty(false);
    setError("");
  };
  const updateCursorState = (patch: Partial<CursorStateConfig>) => {
    const cursorStates = {
      ...config.cursorStates,
      [selectedState]: { ...config.cursorStates[selectedState], ...patch },
    };
    update({ cursorStates });
  };
  const applyToWebsite = () => {
    try {
      saveCursorEffects(config);
      if (config.cursor !== "native") {
        persistLibrary(saveCursorCustomization(library, config.cursor, config));
      }
      window.localStorage.setItem(CURSOR_EFFECTS_APPLIED_KEY, "true");
      window.dispatchEvent(new Event(CURSOR_EFFECTS_CHANGE_EVENT));
      setConfigDirty(false);
      setApplied(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not apply cursor settings in this browser.");
    }
  };
  const removeFromWebsite = () => {
    try {
      window.localStorage.removeItem(CURSOR_EFFECTS_APPLIED_KEY);
      setApplied(false);
      window.dispatchEvent(new Event(CURSOR_EFFECTS_CHANGE_EVENT));
      setError("");
    } catch {
      setError("Could not remove the cursor from the website.");
    }
  };
  const resetToDefaults = () => {
    try {
      window.localStorage.setItem(CURSOR_EFFECTS_STORAGE_KEY, JSON.stringify(NATIVE_CURSOR_EFFECTS));
      window.localStorage.removeItem(CURSOR_EFFECTS_APPLIED_KEY);
      setConfig(NATIVE_CURSOR_EFFECTS);
      setConfigDirty(false);
      setApplied(false);
      window.dispatchEvent(new Event(CURSOR_EFFECTS_CHANGE_EVENT));
      setError("");
    } catch {
      setError("Could not restore the system cursor in this browser.");
    }
  };
  const selectedTemplate = library.templates.find((template) => template.id === selectedTemplateId);
  const beginTemplateNameAction = (action: "save" | "rename" | "duplicate") => {
    const defaultName = action === "rename"
      ? selectedTemplate?.name ?? ""
      : action === "duplicate" && selectedTemplate
        ? `${selectedTemplate.name} copy`
        : config.cursor === "pointer"
          ? "My Pointer"
          : `${getCursorDefinition(config.cursor)?.name ?? "My cursor"} copy`;
    setTemplateName(defaultName);
    setTemplateNameAction(action);
    setDeleteConfirmationOpen(false);
    setError("");
  };
  const submitTemplateName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = templateName.trim();
    if (!name || !templateNameAction) {
      setError("Enter a name for this cursor template.");
      return;
    }
    try {
      if (templateNameAction === "save") {
        const template = createSavedCursorTemplate(name, config);
        persistLibrary(putCursorTemplate(library, template));
        setSelectedTemplateId(template.id);
      } else if (templateNameAction === "rename") {
        if (!selectedTemplate) throw new Error("Select a saved template before renaming it.");
        persistLibrary(renameCursorTemplate(library, selectedTemplate.id, name));
      } else {
        if (!selectedTemplate) throw new Error("Select a saved template before duplicating it.");
        const next = duplicateCursorTemplate(library, selectedTemplate.id, name);
        const duplicate = next.templates.find((template) => !library.templates.some((old) => old.id === template.id));
        persistLibrary(next);
        if (duplicate) setSelectedTemplateId(duplicate.id);
      }
      setTemplateNameAction(null);
      setTemplateName("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this cursor template.");
    }
  };
  const restoreSelectedCursorDefaults = () => {
    const definition = getCursorDefinition(config.cursor);
    if (!definition || config.cursor === "native") return;
    try {
      persistLibrary(removeCursorCustomization(library, config.cursor));
      setConfig(sanitizeCursorEffects({
        ...definition.defaultConfig(),
        cursorStates: config.cursor === "pointer" ? definition.defaultConfig().cursorStates : config.cursorStates,
      }));
      setConfigDirty(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not restore cursor defaults.");
    }
  };
  const updateSelectedTemplate = () => {
    if (!selectedTemplate) return;
    try {
      persistLibrary(putCursorTemplate(library, {
        ...selectedTemplate,
        sourceCursorId: config.cursor,
        configuration: sanitizeCursorEffects(config),
        updatedAt: new Date().toISOString(),
      }));
      setConfigDirty(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update this cursor template.");
    }
  };
  const confirmDeleteSelectedTemplate = () => {
    if (!selectedTemplate) return;
    try {
      persistLibrary(deleteCursorTemplate(library, selectedTemplate.id));
      setSelectedTemplateId("");
      setDeleteConfirmationOpen(false);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this cursor template.");
    }
  };
  const removeSelectedTemplate = () => {
    if (!selectedTemplate) return;
    setDeleteConfirmationOpen(true);
    setTemplateNameAction(null);
  };
  const downloadSelectedTemplate = () => {
    if (!selectedTemplate) return;
    const url = URL.createObjectURL(new Blob([exportCursorTemplate(selectedTemplate)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedTemplate.name.replace(/[^a-z0-9-_]+/gi, "-")}.cursor.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importTemplateInput = useRef<HTMLInputElement>(null);
  const handleTemplateImport = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((raw) => {
      const template = importCursorTemplate(raw);
      const next = putCursorTemplate(library, template);
      persistLibrary(next);
      setSelectedTemplateId(template.id);
      setError("");
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Could not import this cursor template.");
    }).finally(() => {
      input.value = "";
    });
  };
  const selectedCursorState = config.cursorStates[selectedState];

  return (
    <>
      {toolbarHost && createPortal(
        <div className="cursor-effects-actions">
          <button type="button" className="ml-btn" aria-label="Restore system cursor" title="Restore system cursor and disable cursor effects" onClick={resetToDefaults}>Reset</button>
          <button type="button" className="ml-btn ml-primary" aria-label="Apply to website" title="Apply to website" onClick={applyToWebsite}>Apply</button>
          {applied && <button type="button" className="ml-btn" aria-label="Remove from website" title="Remove from website" onClick={removeFromWebsite}>Remove</button>}
          <button type="button" className="ml-btn" aria-label="Save as template" title="Save as a local template" onClick={() => beginTemplateNameAction("save")}>Save template</button>
        </div>,
        toolbarHost,
      )}
      <section className="cursor-effects-settings">
        <div className="cursor-effects-preview-column">
          <CursorEffectsPreview config={config} />
          {config.cursor === "pointer" && <CursorPointerSetPreview />}
          <CursorEffectsShowcase config={config} previewCursor={previewCursor} />
        </div>
        <aside className="cursor-effects-sidebar" aria-label="Cursor settings">
          <div className="cursor-effects-saved">
            <small className="cursor-effects-note">Templates are saved only in this browser.</small>
            <select className="ml-select" aria-label="Saved cursor templates" value={selectedTemplateId} onChange={(event) => {
              const selected = library.templates.find((template) => template.id === event.target.value);
              const currentLibrary = flushCurrentCustomization();
              if (!currentLibrary) return;
              setSelectedTemplateId(event.target.value);
              setTemplateNameAction(null);
              setDeleteConfirmationOpen(false);
              if (selected) {
                setConfig(sanitizeCursorEffects(selected.configuration));
                setConfigDirty(false);
              }
            }}>
              <option value="">Load template…</option>
              {library.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <button type="button" className="ml-btn" onClick={() => importTemplateInput.current?.click()}>Import</button>
            {selectedTemplate && <>
              <button type="button" className="ml-btn" onClick={updateSelectedTemplate}>Update</button>
              <button type="button" className="ml-btn" onClick={() => beginTemplateNameAction("rename")}>Rename</button>
              <button type="button" className="ml-btn" onClick={() => beginTemplateNameAction("duplicate")}>Duplicate</button>
              <button type="button" className="ml-btn" onClick={downloadSelectedTemplate}>Export</button>
              <button type="button" className="ml-btn" onClick={removeSelectedTemplate}>Delete</button>
            </>}
            <input ref={importTemplateInput} type="file" accept=".json,application/json" hidden onChange={handleTemplateImport} />
            {templateNameAction && <form className="cursor-effects-template-form" onSubmit={submitTemplateName}>
              <label className="cursor-effect-control">
                <span>{templateNameAction === "save" ? "New local template name" : templateNameAction === "rename" ? "Rename local template" : "Duplicate local template"}</span>
                <input className="ml-select" autoFocus maxLength={80} value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              </label>
              <div className="cursor-effects-template-actions">
                <button type="submit" className="ml-btn ml-primary">Save locally</button>
                <button type="button" className="ml-btn" onClick={() => { setTemplateNameAction(null); setTemplateName(""); setError(""); }}>Cancel</button>
              </div>
            </form>}
            {deleteConfirmationOpen && selectedTemplate && <div className="cursor-effects-template-form" role="group" aria-label="Confirm template deletion">
              <span>Delete “{selectedTemplate.name}” from this browser?</span>
              <div className="cursor-effects-template-actions">
                <button type="button" className="ml-btn" onClick={confirmDeleteSelectedTemplate}>Delete template</button>
                <button type="button" className="ml-btn" onClick={() => setDeleteConfirmationOpen(false)}>Cancel</button>
              </div>
            </div>}
          </div>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Cursor presets <span>{getCursorDefinition(config.cursor)?.name ?? "System cursor"}</span></summary>
        <div className="cursor-effects-group-content">
          <div className="cursor-effects-spider-preset">
            <button type="button" className="ml-btn" onClick={() => {
              setCategory("Spooky");
              update(SPIDER_FOLLOW_PRESET);
            }}>Use Spider Pounce preset</button>
            <span>Walks while following, crouches when still, and pounces on click. Preview-only until applied.</span>
          </div>
          <div className="cursor-effects-categories">
            {CURSOR_CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}
          </div>
          <div className="cursor-effects-presets">
            <button type="button" className={`cursor-effects-preset system-cursor-preset ${config.cursor === "native" ? "selected" : ""}`} title="Use the actual operating-system cursor" onClick={() => selectCursor("native")}>
              <CursorPresetSwatch id="native" /><span>System cursor</span>
            </button>
            {getCursorDefinitions().filter((preset) => preset.category === category && preset.id !== "native" && preset.id !== "custom-image").map((preset) => (
              <button type="button" key={preset.id} className={`cursor-effects-preset ${config.cursor === preset.id ? "selected" : ""}`} title={getCursorDefinition(preset.id)?.description} onClick={() => selectCursor(preset.id)}>
                <CursorPresetSwatch id={preset.id} /><span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>
      </details>
      <details className="cursor-effects-group cursor-effects-catalog-group">
        <summary>Cursor design previews <span>40 designs</span></summary>
        <div className="cursor-effects-group-content">
          <CursorEffectsCatalog
            previewCursor={previewCursor}
            onSelect={(id) => setPreviewSelection({ baseCursor: config.cursor, selectedCursor: id })}
          />
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Cursor appearance <span>{config.cursor === "native" ? "System cursor" : `${config.size}px`}</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-control"><span>Default cursor style</span><select className="ml-select" value={config.cursor} onChange={(event) => selectCursor(event.target.value as CursorPresetId)}>
            <option value="native">System cursor</option>
            <option value="custom-image">Custom image</option>
            {getCursorDefinitions().filter((preset) => preset.id !== "native" && preset.id !== "custom-image").map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select></label>
          {config.cursor !== "native" ? <>
          <RangeControl label="Cursor size" value={config.size} min={12} max={72} step={1} onChange={(value) => update({ size: value })} />
          <RangeControl label="Width scale" value={config.widthScale} min={0.4} max={2.5} onChange={(widthScale) => update({ widthScale })} />
          <RangeControl label="Height scale" value={config.heightScale} min={0.4} max={2.5} onChange={(heightScale) => update({ heightScale })} />
          <RangeControl label="Rotation" value={config.rotation} min={-180} max={180} step={1} onChange={(rotation) => update({ rotation })} />
          <RangeControl label="Horizontal offset" value={config.offsetX} min={-100} max={100} step={1} onChange={(offsetX) => update({ offsetX })} />
          <RangeControl label="Vertical offset" value={config.offsetY} min={-100} max={100} step={1} onChange={(offsetY) => update({ offsetY })} />
          {config.cursor !== "custom-image" ? <>
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.gradientEnabled} onChange={(event) => update({ gradientEnabled: event.target.checked })} />Use a linear cursor gradient</label>
          {config.gradientEnabled && <>
            <label className="cursor-effect-control"><span>Gradient end color</span><input type="color" value={config.gradientEndColor} onChange={(event) => update({ gradientEndColor: event.target.value })} /></label>
            <RangeControl label="Gradient angle" value={config.gradientAngle} min={0} max={360} step={1} onChange={(gradientAngle) => update({ gradientAngle })} />
          </>}
          </> : <p className="cursor-effects-note">Uploaded images retain their source colors; gradients are available for vector cursors.</p>}
          {config.cursor === "custom-image" && <>
            <CursorImagePicker image={config.cursorImage} onChange={(cursorImage) => update({ cursorImage })} />
            <RangeControl label="Image hotspot X" value={config.hotspotX} min={0} max={1} onChange={(hotspotX) => update({ hotspotX })} />
            <RangeControl label="Image hotspot Y" value={config.hotspotY} min={0} max={1} onChange={(hotspotY) => update({ hotspotY })} />
          </>}
          <RangeControl label="Opacity" value={config.opacity} min={0.1} max={1} onChange={(opacity) => update({ opacity })} />
          <RangeControl label="Shadow" value={config.shadow} min={0} max={1} onChange={(shadow) => update({ shadow })} />
          <RangeControl label="Glow" value={config.glow} min={0} max={1} onChange={(glow) => update({ glow })} />
          <button type="button" className="ml-btn" onClick={restoreSelectedCursorDefaults}>Restore this cursor&apos;s defaults</button>
          </> : <p className="cursor-effects-note">System cursor appearance is controlled by the operating system. Choose a visual preset to edit its appearance.</p>}
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Cursor states <span>{selectedCursorState.enabled ? "Custom state" : "Native by default"}</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-control"><span>Edit state</span><select className="ml-select" value={selectedState} onChange={(event) => setSelectedState(event.target.value as CursorStateId)}>
            {CURSOR_STATE_OPTIONS.map(([state, label]) => <option key={state} value={state}>{label}</option>)}
          </select></label>
          <label className="cursor-effect-toggle"><input type="checkbox" checked={selectedCursorState.enabled} onChange={(event) => updateCursorState({ enabled: event.target.checked })} />Use a custom cursor for this state</label>
          {selectedCursorState.enabled && <>
            <label className="cursor-effect-control"><span>Cursor appearance</span><select className="ml-select" value={selectedCursorState.cursor} onChange={(event) => updateCursorState({ cursor: event.target.value as CursorPresetId })}>
              <option value="native">Use native cursor</option>
              <option value="custom-image">Custom image</option>
              {getCursorDefinitions().filter((preset) => preset.id !== "native" && preset.id !== "custom-image").map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              {POINTER_CURSOR_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select></label>
            <RangeControl label="State cursor size" value={selectedCursorState.size} min={12} max={72} step={1} onChange={(size) => updateCursorState({ size })} />
            {isPointerCursor(selectedCursorState.cursor)
              ? <p className="cursor-effects-note">This Pointer state uses your supplied SVG artwork and its exact white, black, and lime colors.</p>
              : <>
                <label className="cursor-effect-control"><span>State cursor color</span><input type="color" value={selectedCursorState.color} onChange={(event) => updateCursorState({ color: event.target.value })} /></label>
                <label className="cursor-effect-control"><span>State border color</span><input type="color" value={selectedCursorState.borderColor} onChange={(event) => updateCursorState({ borderColor: event.target.value })} /></label>
                <RangeControl label="State border width" value={selectedCursorState.borderWidth} min={0} max={12} step={0.5} onChange={(borderWidth) => updateCursorState({ borderWidth })} />
              </>}
            {selectedCursorState.cursor === "custom-image" && <>
              <CursorImagePicker image={selectedCursorState.image} onChange={(image) => updateCursorState({ image })} />
              <RangeControl label="Image hotspot X" value={selectedCursorState.hotspotX} min={0} max={1} onChange={(hotspotX) => updateCursorState({ hotspotX })} />
              <RangeControl label="Image hotspot Y" value={selectedCursorState.hotspotY} min={0} max={1} onChange={(hotspotY) => updateCursorState({ hotspotY })} />
            </>}
          </>}
          <p className="cursor-effects-note">Uncustomized states keep their native browser cursors. Buttons, links, text fields, grab states, and resize handles can be configured independently.</p>
        </div>
      </details>
      {getCursorDefinition(config.cursor)?.specializedSettings.includes("spider") && <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Spider movement <span>Spider-specific controls</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <RangeControl label="Follow delay" value={config.spider.followDelayMs} min={0} max={350} step={5} onChange={(followDelayMs) => update({ spider: { ...config.spider, followDelayMs } })} />
          <RangeControl label="Leg movement speed" value={config.spider.gaitSpeed} min={0.25} max={3} onChange={(gaitSpeed) => update({ spider: { ...config.spider, gaitSpeed } })} />
          <RangeControl label="Walking intensity" value={config.spider.walkingIntensity} min={0} max={2} onChange={(walkingIntensity) => update({ spider: { ...config.spider, walkingIntensity } })} />
          <RangeControl label="Leg articulation" value={config.spider.legArticulation} min={0} max={2} onChange={(legArticulation) => update({ spider: { ...config.spider, legArticulation } })} />
          <RangeControl label="Movement sensitivity" value={config.spider.movementSensitivity} min={0.25} max={3} onChange={(movementSensitivity) => update({ spider: { ...config.spider, movementSensitivity } })} />
          <RangeControl label="Body bounce" value={config.spider.bodyBounce} min={0} max={1} onChange={(bodyBounce) => update({ spider: { ...config.spider, bodyBounce } })} />
          <RangeControl label="Pounce duration" value={config.spider.pounceDurationMs} min={200} max={1200} step={10} onChange={(pounceDurationMs) => update({ spider: { ...config.spider, pounceDurationMs } })} />
          <button type="button" className="ml-btn" onClick={() => update({ spider: { ...DEFAULT_CURSOR_EFFECTS.spider } })}>Reset Spider settings</button>
        </div>
      </details>}
      {isCreatureCursor(config.cursor) && <details className="cursor-effects-group" open onToggle={revealExpandedSettings}>
        <summary>{getCursorDefinition(config.cursor)?.name} details <span>Creature-specific controls</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          {(() => {
            const creatureId = config.cursor as CreatureCursorId;
            const settings = config.creatures[creatureId];
            const labels = getCreatureSettingsLabels(creatureId);
            return <>
              {labels.colors.map((label, index) => {
                const key = (["bodyColor", "accentColor", "detailColor"] as const)[index];
                return <label className="cursor-effect-control" key={key}><span>{label}</span>
                  <input type="color" value={settings[key]} onChange={(event) => updateCreature({ [key]: event.target.value })} />
                </label>;
              })}
              {labels.motion.map((label, index) => {
                const key = (["speed", "intensity", "articulation"] as const)[index];
                return <RangeControl key={key} label={label} value={settings[key]} min={key === "speed" ? 0.25 : 0} max={key === "speed" ? 3 : 2}
                  step={0.05} onChange={(value) => updateCreature({ [key]: value })} />;
              })}
              {labels.count && <RangeControl label={labels.count} value={settings.segments} min={5} max={config.cursor === "caterpillar" ? 9 : 16} step={1} onChange={(segments) => updateCreature({ segments })} />}
              <RangeControl label="Natural hover delay" value={settings.hoverDelayMs} min={0} max={500} step={10} onChange={(hoverDelayMs) => updateCreature({ hoverDelayMs })} />
              <RangeControl label="Natural click delay" value={settings.clickDelayMs} min={0} max={500} step={10} onChange={(clickDelayMs) => updateCreature({ clickDelayMs })} />
              <RangeControl label="Natural click duration" value={settings.clickDurationMs} min={100} max={1800} step={10} onChange={(clickDurationMs) => updateCreature({ clickDurationMs })} />
              <RangeControl label="Directional turn sensitivity" value={settings.rotationSensitivity} min={0} max={2} step={0.05} onChange={(rotationSensitivity) => updateCreature({ rotationSensitivity })} />
              <label className="cursor-effect-toggle"><input type="checkbox" checked={settings.directionalFollow} onChange={(event) => updateCreature({ directionalFollow: event.target.checked })} />Face pointer movement direction</label>
              <label className="cursor-effect-toggle"><input type="checkbox" checked={settings.idleEnabled} onChange={(event) => updateCreature({ idleEnabled: event.target.checked })} />Idle animation</label>
              <label className="cursor-effect-toggle"><input type="checkbox" checked={settings.hoverEnabled} onChange={(event) => updateCreature({ hoverEnabled: event.target.checked })} />Hover response</label>
              <label className="cursor-effect-toggle"><input type="checkbox" checked={settings.clickEnabled} onChange={(event) => updateCreature({ clickEnabled: event.target.checked })} />Click animation</label>
              <button type="button" className="ml-btn" onClick={() => updateCreature({ ...DEFAULT_CURSOR_EFFECTS.creatures[creatureId] })}>Reset {getCursorDefinition(creatureId)?.name} settings</button>
            </>;
          })()}
        </div>
      </details>}
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Motion and timing <span>{config.animationEasing}</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <RangeControl label="Cursor animation speed" value={config.cursorAnimationSpeed} min={0.25} max={3} step={0.05} onChange={(cursorAnimationSpeed) => update({ cursorAnimationSpeed })} />
          <RangeControl label="Animation intensity" value={config.cursorAnimationIntensity} min={0} max={2} step={0.05} onChange={(cursorAnimationIntensity) => update({ cursorAnimationIntensity })} />
          <RangeControl label="Movement sensitivity" value={config.movementSensitivity} min={0.1} max={3} step={0.05} onChange={(movementSensitivity) => update({ movementSensitivity })} />
          <RangeControl label="Direction rotation sensitivity" value={config.rotationSensitivity} min={0} max={2} step={0.05} onChange={(rotationSensitivity) => update({ rotationSensitivity })} />
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.directionalFollow} onChange={(event) => update({ directionalFollow: event.target.checked })} />Face pointer movement direction</label>
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.idleAnimationEnabled} onChange={(event) => update({ idleAnimationEnabled: event.target.checked })} />Animate while pointer is idle</label>
          <RangeControl label="Effect duration" value={config.animationDurationMs} min={100} max={3000} step={25} onChange={(animationDurationMs) => update({ animationDurationMs })} />
          <label className="cursor-effect-control"><span>Animation easing</span><select className="ml-select" value={config.animationEasing} onChange={(event) => update({ animationEasing: event.target.value as CursorEffectsConfig["animationEasing"] })}>
            <option value="linear">Linear</option>
            <option value="ease-in">Ease in</option>
            <option value="ease-out">Ease out</option>
            <option value="ease-in-out">Ease in and out</option>
            <option value="smoothstep">Smooth step</option>
          </select></label>
          <RangeControl label="Follow smoothing" value={config.followSmoothing} min={0.05} max={1} onChange={(followSmoothing) => update({ followSmoothing })} />
          <p className="cursor-effects-note">Smoothing affects non-Spider cursors. Reduced-motion mode uses direct pointer following.</p>
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Movement trail <span>{MOVEMENT_OPTIONS.find(([value]) => value === config.movement)?.[1]}</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-control"><span>Trail effect</span><select className="ml-select" value={config.movement} onChange={(event) => update({ movement: event.target.value as MovementEffect })}>{MOVEMENT_OPTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
          <RangeControl label="Trail length" value={config.trailLength} min={0.1} max={1} onChange={(value) => update({ trailLength: value })} />
          <RangeControl label="Animation speed" value={config.trailSpeed} min={0.25} max={2} onChange={(value) => update({ trailSpeed: value })} />
          <RangeControl label="Particle size" value={config.particleSize} min={1} max={18} step={1} onChange={(value) => update({ particleSize: value })} />
          <RangeControl label="Particle density" value={config.particleDensity} min={0.1} max={1} onChange={(value) => update({ particleDensity: value })} />
          {config.movement === "spider" && <label className="cursor-effect-toggle"><input type="checkbox" checked={config.spiderWeb} onChange={(event) => update({ spiderWeb: event.target.checked })} />Connect spider trail</label>}
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Click effect <span>{CLICK_OPTIONS.find(([value]) => value === config.click)?.[1]}</span></summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-control"><span>Effect</span><select className="ml-select" value={config.click} onChange={(event) => update({ click: event.target.value as ClickEffect })}>{CLICK_OPTIONS.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
          <label className="cursor-effect-control"><span>Cursor reaction</span><select className="ml-select" value={config.clickAnimation} onChange={(event) => update({ clickAnimation: event.target.value as CursorClickAnimation })}>
            <option value="bounce">Bounce</option><option value="spin">Spin</option><option value="squash">Squash and rebound</option><option value="pulse">Pulse</option><option value="wobble">Wobble</option>
          </select></label>
          <RangeControl label="Click delay" value={config.clickDelayMs} min={0} max={500} step={10} onChange={(clickDelayMs) => update({ clickDelayMs })} />
          <RangeControl label="Click reaction duration" value={config.clickDurationMs} min={100} max={1800} step={10} onChange={(clickDurationMs) => update({ clickDurationMs })} />
          <RangeControl label="Click intensity" value={config.clickIntensity} min={0} max={2} step={0.05} onChange={(clickIntensity) => update({ clickIntensity })} />
          <RangeControl label="Click size" value={config.clickSize} min={0.5} max={2} onChange={(value) => update({ clickSize: value })} />
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Hover behavior</summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-control"><span>Cursor reaction</span><select className="ml-select" value={config.hoverAnimation} onChange={(event) => update({ hoverAnimation: event.target.value as CursorHoverAnimation })}>
            <option value="pulse">Pulse</option><option value="tilt">Tilt</option><option value="squash">Squash</option><option value="glow">Glow</option>
          </select></label>
          <RangeControl label="Hover delay" value={config.hoverDelayMs} min={0} max={500} step={10} onChange={(hoverDelayMs) => update({ hoverDelayMs })} />
          <RangeControl label="Hover transition" value={config.hoverTransitionMs} min={50} max={1000} step={10} onChange={(hoverTransitionMs) => update({ hoverTransitionMs })} />
          <RangeControl label="Hover intensity" value={config.hoverIntensity} min={0} max={2} step={0.05} onChange={(hoverIntensity) => update({ hoverIntensity })} />
          {([
            ["hoverGrow", "Grow over links and buttons"],
            ["hoverShape", "Outline on hover"],
            ["hoverColor", "Change color on hover"],
            ["hoverOutline", "Show hover outline"],
            ["magneticHover", "Visual magnetic attraction"],
          ] as const).map(([key, label]) => <label className="cursor-effect-toggle" key={key}><input type="checkbox" checked={config[key]} onChange={(event) => update({ [key]: event.target.checked })} />{label}</label>)}
          {config.magneticHover && <RangeControl label="Magnetic hover strength" value={config.magneticStrength} min={0} max={1} onChange={(value) => update({ magneticStrength: value })} />}
        </div>
      </details>
      <details className="cursor-effects-group" onToggle={revealExpandedSettings}>
        <summary>Interaction effects</summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.glassEffect} onChange={(event) => update({ glassEffect: event.target.checked })} />Glass cursor with background blur</label>
          {config.glassEffect && <>
            <RangeControl label="Glass blur" value={config.glassBlur} min={0} max={24} step={1} onChange={(value) => update({ glassBlur: value })} />
            <RangeControl label="Glass transparency" value={config.glassOpacity} min={0} max={0.8} onChange={(value) => update({ glassOpacity: value })} />
          </>}
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.glitchEffect} onChange={(event) => update({ glitchEffect: event.target.checked })} />Glitch on cursor movement</label>
          {config.glitchEffect && <RangeControl label="Glitch intensity" value={config.glitchIntensity} min={0} max={1} onChange={(value) => update({ glitchIntensity: value })} />}
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.gameEffect} onChange={(event) => update({ gameEffect: event.target.checked })} />Arcade reticle and +10 click feedback</label>
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.soundHover} onChange={(event) => update({ soundHover: event.target.checked })} />Play a sound when hovering controls</label>
          <label className="cursor-effect-toggle"><input type="checkbox" checked={config.soundClick} onChange={(event) => update({ soundClick: event.target.checked })} />Play a sound when clicking</label>
          {(config.soundHover || config.soundClick) && <RangeControl label="Sound volume" value={config.soundVolume} min={0} max={1} onChange={(value) => update({ soundVolume: value })} />}
          {(config.soundHover || config.soundClick) && <p className="cursor-effects-note">Sounds are synthesized and unlock after your first click.</p>}
        </div>
      </details>
      <details className="cursor-effects-group" open onToggle={revealExpandedSettings}>
        <summary>Colors</summary>
        <div className="cursor-effects-group-content cursor-effects-controls">
          {config.cursor === "pointer"
            ? <p className="cursor-effects-note">Pointer uses the supplied SVGs exactly as designed, including their white fill, black outlines, and #ADEB66 offset.</p>
            : <>
              <label className="cursor-effect-control"><span>Cursor fill / line</span><input type="color" value={config.color} onChange={(event) => update({ color: event.target.value })} /></label>
              <label className="cursor-effect-control"><span>Cursor border / outline</span><input type="color" value={config.borderColor} onChange={(event) => update({ borderColor: event.target.value })} /></label>
              <RangeControl label="Cursor border width" value={config.borderWidth} min={0} max={12} step={0.5} onChange={(value) => update({ borderWidth: value })} />
              <label className="cursor-effect-control"><span>Cursor background</span><input type="color" value={config.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /></label>
            </>}
          <label className="cursor-effect-control"><span>Hover color</span><input type="color" value={config.hoverColorValue} onChange={(event) => update({ hoverColorValue: event.target.value })} /></label>
          <label className="cursor-effect-control"><span>Movement effect color</span><input type="color" value={config.effectColor} onChange={(event) => update({ effectColor: event.target.value })} /></label>
          <label className="cursor-effect-control"><span>Click effect color</span><input type="color" value={config.clickEffectColor} onChange={(event) => update({ clickEffectColor: event.target.value })} /></label>
        </div>
      </details>
      <p className="cursor-effects-note">Movement and click effects work independently of the selected cursor. Effects pause on touch-only devices and respect reduced-motion preferences.</p>
      {error && <p className="cursor-effects-error" role="alert">{error}</p>}
        </aside>
      </section>
    </>
  );
}
