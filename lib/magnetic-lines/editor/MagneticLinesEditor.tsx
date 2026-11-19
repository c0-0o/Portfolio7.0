"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AirflowBehavior, AnchorPointEndpoint, EnvironmentLightConfig, FlowConfig, FlowEffectType, MagneticLineConfig, MagneticLineGroup, MagneticLinesSceneConfig, MagneticTargetConfig, MotionType, ShapeType, GeometrySource, GeneratedShapePreset, LineColorStyle, PathPoint, Point, TargetActivation, TargetClickBehavior, TextureType } from "../types";
import { RAINBOW_COLORS } from "../types";
import { normalizeColorWeights, setColorWeight } from "../colorWeights";
import { MagneticBackgroundLines, type DebugFlags } from "../MagneticBackgroundLines";
import { getPortfolioDefaultScene } from "../PersistentMagneticBackground";
import { normalizePortfolioPageScene } from "../portfolioScene";
import { DEFAULT_GLOBAL, DEFAULT_SCENE, MOTION_PRESETS, SCENE_PRESETS, applyScenePreset } from "../defaultScene";
import { sanitizeSceneConfig, makeBlankLine, duplicateLine } from "../sceneValidation";
import { createGeneratedShapePath, GENERATED_SHAPE_PRESETS } from "../shapePresets";
import { mergePathPointSequence } from "./pathEditing";
import { useHistory } from "./history";
import { getAllTargetSnapshots, type TargetSnapshot } from "../engine/targetRegistry";
import { getTargetLineActivations, type TargetLineEffect } from "../engine/targetLineTriggers";
import { BUILT_IN_PAGE_PATHS, deleteReusableLineShape, listMagneticPagePaths, listReusableLineShapes, loadPersistedPageScene, normalizeMagneticPagePath, registerMagneticPagePath, removeMagneticPagePath, removePageScenePreview, removePersistedPageScene, savePageScenePreview, savePersistedPageScene, saveReusableLineShape, SCENE_CHANGE_EVENT, syncPersistedPageScenesFromProject, type ReusableLineShape } from "../persistence";
import { resolveLineConfig } from "../engine/resolveConfig";
import { getTargetAssignedLineIds, updateTargetLineAssignments } from "./targetAssignments";
import { customPathPointFromViewport, getCustomPathPointsInViewport } from "../engine/lineEngine";
import { CursorEffectsSettings } from "../../cursor-effects/CursorEffects";
import { getDefaultTextureWeight } from "../texture";
import { getEnvironmentLights, resolveLineAirflowPaths, resolveLineAirflowRadii } from "../environment";
import { FLOW_PRESETS } from "../flowPresets";
import { SceneTemplateLibrary } from "./SceneTemplateLibrary";

const STORAGE_KEY = "magnetic-lines-editor:v1";
const EDITOR_PAGE_PATH_KEY = "magnetic-lines-editor-page:v1";

type TexturePreset = Pick<MagneticLineConfig["texture"], "type" | "scale" | "intensity" | "weight"> & {
  id: string;
  label: string;
};

const TEXTURE_PRESETS: TexturePreset[] = [
  { id: "paper", label: "Paper", type: "grain", scale: 0.035, intensity: 0.24, weight: 0.9 },
  { id: "silk", label: "Silk", type: "silk", scale: 0.018, intensity: 0.42, weight: 0.55 },
  { id: "rope", label: "Rope", type: "rope", scale: 0.025, intensity: 0.52, weight: 1.25 },
  { id: "beads", label: "Beads", type: "beads", scale: 0.032, intensity: 0.78, weight: 1.75 },
  { id: "brushed-metal", label: "Brushed metal", type: "metal", scale: 0.008, intensity: 0.24, weight: 2.2 },
];

export interface MagneticLinesEditorProps {
  initialConfig?: MagneticLinesSceneConfig;
  onChange?: (config: MagneticLinesSceneConfig) => void;
}

type ShapeControl = "amplitude" | "frequency" | "cycles" | "phase" | "smoothness" | "irregularity" | "distortion" | "roughness" | "pixelStep";
type AnchorTargetOption = { value: string; label: string; endpoint: AnchorPointEndpoint; pathPointId?: string; pathPointIds?: string[] };
type PickedTargetDraft = { id: string; name: string; selector: string; tagName: string; activations: TargetActivation[]; clickBehavior: TargetClickBehavior };
type TargetPickerMessage = { type: string; token?: string; previewToken?: string; targetId?: string; status?: "ready" | "missing" | "multiple" | "invalid" | "disabled"; selector?: string; name?: string; tagName?: string; previewSvg?: string; message?: string };

function targetPreviewDataUrl(markup: string | undefined): string | null {
  return markup ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}` : null;
}

function TargetThumbnail({
  name,
  tagName,
  previewSrc,
  selected = false,
}: {
  name: string;
  tagName: string;
  previewSrc?: string;
  selected?: boolean;
}) {
  const src = previewSrc ?? null;
  return (
    <span className={`ml-target-thumbnail ${selected ? "selected" : ""}`} aria-hidden="true">
      {src
        ? <span className="ml-target-thumbnail-image" style={{ backgroundImage: `url("${src}")` }} />
        : <span className="ml-target-thumbnail-fallback"><small>{tagName || "element"}</small><strong>{name.slice(0, 20)}</strong></span>}
      <span className="ml-target-thumbnail-zoom">
        {src
          ? <span className="ml-target-thumbnail-image" style={{ backgroundImage: `url("${src}")` }} />
          : <span className="ml-target-thumbnail-fallback"><small>{tagName || "element"}</small><strong>{name}</strong></span>}
      </span>
    </span>
  );
}

function pageRouteLabel(path: string): string {
  const names: Record<string, string> = {
    "/": "Home",
    "/about": "About",
    "/opening": "Opening",
    "/under-construction": "Under construction",
    "/not-found": "404 page",
  };
  if (names[path]) return `${names[path]} (${path})`;
  const lastSegment = path.split("/").filter(Boolean).at(-1) ?? path;
  let decodedSegment = lastSegment;
  try {
    decodedSegment = decodeURIComponent(lastSegment);
  } catch {
    // Keep malformed encoded paths readable without breaking the editor.
  }
  const readableName = decodedSegment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return `${readableName} (${path})`;
}

function getAnchorTargets(line: MagneticLineConfig): AnchorTargetOption[] {
  if (line.geometrySource === "path") {
    const targets: AnchorTargetOption[] = [];
    line.customPath.points.forEach((point, index) => {
      const overlappingTarget = targets.find((target) => {
        const targetPoint = line.customPath.points.find((item) => item.id === target.pathPointId);
        return targetPoint?.x === point.x && targetPoint.y === point.y;
      });
      if (overlappingTarget) {
        overlappingTarget.pathPointIds?.push(point.id);
      } else {
        targets.push({
          value: `path:${point.id}`,
          label: `S${index + 1}`,
          endpoint: "path",
          pathPointId: point.id,
          pathPointIds: [point.id],
        });
      }
    });
    return targets;
  }
  return [
    { value: "start", label: "Start endpoint", endpoint: "start" },
    { value: "end", label: "End endpoint", endpoint: "end" },
  ];
}

function supportsShapeControl(shapeType: ShapeType, control: ShapeControl): boolean {
  const controls: Record<ShapeType, ShapeControl[]> = {
    straight: [],
    sharp: [],
    rounded: [],
    "soft-wave": ["amplitude", "frequency", "cycles", "phase", "smoothness"],
    organic: ["amplitude", "frequency", "phase", "irregularity", "roughness"],
    liquid: ["amplitude", "frequency", "cycles", "phase", "smoothness", "distortion"],
    floating: ["amplitude", "frequency", "cycles", "phase", "smoothness"],
    vibration: ["amplitude", "frequency", "cycles", "phase"],
    pixel: ["amplitude", "cycles", "phase", "pixelStep"],
  };
  return controls[shapeType].includes(control);
}

function transformLineGeometry(line: MagneticLineConfig, center: Point, scaleX: number, scaleY: number, rotation: number, offset: Point): MagneticLineConfig {
  const rotationRadians = rotation * Math.PI / 180;
  const cos = Math.cos(rotationRadians);
  const sin = Math.sin(rotationRadians);
  const transformPoint = (point: Point): Point => {
    const x = (point.x - center.x) * scaleX;
    const y = (point.y - center.y) * scaleY;
    return {
      x: center.x + x * cos - y * sin + offset.x,
      y: center.y + x * sin + y * cos + offset.y,
    };
  };
  const scaleNonNegative = (value: number) => Math.max(0, value * Math.sqrt(Math.abs(scaleX * scaleY)));
  return {
    ...line,
    from: transformPoint(line.from),
    to: transformPoint(line.to),
    anchorPoints: line.anchorPoints.map((point) => ({
      ...point,
      ...transformPoint(point),
      radius: scaleNonNegative(point.radius),
      radiusX: scaleNonNegative(point.radiusX),
      radiusY: scaleNonNegative(point.radiusY),
      size: scaleNonNegative(point.size),
      rotation: point.rotation + rotationRadians,
    })),
    customPath: { ...line.customPath, points: line.customPath.points.map((point) => ({ ...point, ...transformPoint(point) })) },
    anchorMotion: {
      start: {
        ...line.anchorMotion.start,
        radius: scaleNonNegative(line.anchorMotion.start.radius),
        radiusX: scaleNonNegative(line.anchorMotion.start.radiusX),
        radiusY: scaleNonNegative(line.anchorMotion.start.radiusY),
        width: scaleNonNegative(line.anchorMotion.start.width),
        height: scaleNonNegative(line.anchorMotion.start.height),
        size: scaleNonNegative(line.anchorMotion.start.size),
        rotation: line.anchorMotion.start.rotation + rotationRadians,
      },
      end: {
        ...line.anchorMotion.end,
        radius: scaleNonNegative(line.anchorMotion.end.radius),
        radiusX: scaleNonNegative(line.anchorMotion.end.radiusX),
        radiusY: scaleNonNegative(line.anchorMotion.end.radiusY),
        width: scaleNonNegative(line.anchorMotion.end.width),
        height: scaleNonNegative(line.anchorMotion.end.height),
        size: scaleNonNegative(line.anchorMotion.end.size),
        rotation: line.anchorMotion.end.rotation + rotationRadians,
      },
    },
  };
}

function fitLineGeometriesToFrame(lines: MagneticLineConfig[]): { lines: MagneticLineConfig[]; scale: number } {
  const getPoints = (items: MagneticLineConfig[]) =>
    items.flatMap((line) => [line.from, line.to, ...line.anchorPoints, ...line.customPath.points]);
  const boundsFor = (points: Point[]) => points.reduce((bounds, point) => ({
    left: Math.min(bounds.left, point.x),
    top: Math.min(bounds.top, point.y),
    right: Math.max(bounds.right, point.x),
    bottom: Math.max(bounds.bottom, point.y),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

  const points = getPoints(lines);
  if (points.length === 0) return { lines, scale: 1 };
  const bounds = boundsFor(points);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  const scale = Math.min(1, width > 1 ? 1 / width : 1, height > 1 ? 1 / height : 1);
  const center = { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
  let fittedLines = scale < 1
    ? lines.map((line) => {
      const transformed = transformLineGeometry(line, center, scale, scale, 0, { x: 0, y: 0 });
      const lineTransform = line.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
      return {
        ...transformed,
        lineTransform: {
          ...lineTransform,
          scaleX: lineTransform.scaleX * scale,
          scaleY: lineTransform.scaleY * scale,
        },
      };
    })
    : lines;
  const fittedBounds = boundsFor(getPoints(fittedLines));
  const offset = {
    x: fittedBounds.left < 0 ? -fittedBounds.left : fittedBounds.right > 1 ? 1 - fittedBounds.right : 0,
    y: fittedBounds.top < 0 ? -fittedBounds.top : fittedBounds.bottom > 1 ? 1 - fittedBounds.bottom : 0,
  };
  if (offset.x !== 0 || offset.y !== 0) {
    fittedLines = fittedLines.map((line) => transformLineGeometry(line, { x: 0, y: 0 }, 1, 1, 0, offset));
  }
  return { lines: fittedLines, scale };
}

function ShapeSliderField({ shapeType, control, ...props }: SliderFieldProps & { shapeType: ShapeType; control: ShapeControl }) {
  if (!supportsShapeControl(shapeType, control)) return null;
  return <SliderField {...props} />;
}

function TexturePresetPreview({ type }: { type: MagneticLineConfig["texture"]["type"] }) {
  return (
    <svg className="ml-texture-preset-preview" viewBox="0 0 48 22" aria-hidden="true">
      <rect x="1" y="1" width="46" height="20" rx="4" fill="#121821" />
      {type === "grain" ? (
        <>
          <path d="M5 11h38" stroke="#9bd9e8" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
          {[[8, 8], [12, 14], [16, 9], [20, 13], [24, 7], [28, 14], [32, 9], [36, 13], [40, 8]].map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r={index % 3 === 0 ? 1 : 0.65} fill="#e0f8ff" opacity=".8" />
          ))}
        </>
      ) : type === "beads" ? (
        <>
          <path d="M5 11h38" stroke="#9bd9e8" strokeOpacity=".45" strokeWidth="1" />
          {Array.from({ length: 8 }, (_, index) => <circle key={index} cx={8 + index * 4.5} cy="11" r="2" fill="#8bd8ef" stroke="#e0f8ff" strokeOpacity=".85" strokeWidth=".7" />)}
        </>
      ) : type === "rope" ? (
        <>
          <path d="M5 11h38" stroke="#9bd9e8" strokeOpacity=".35" strokeWidth="4" strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, index) => <path key={index} d={`M${6 + index * 4.5} 8l2.5 6`} stroke="#d4f4ff" strokeOpacity=".85" strokeWidth="1.2" strokeLinecap="round" />)}
        </>
      ) : type === "silk" ? (
        <>
          <path d="M5 6.5h38M5 7.8h38M5 9.1h38M5 10.4h38M5 11.7h38M5 13h38M5 14.3h38M5 15.6h38" stroke="#d4f4ff" strokeOpacity=".66" strokeWidth=".45" strokeLinecap="round" />
          <path d="M5 11h38" stroke="#fff" strokeOpacity=".7" strokeWidth=".5" strokeLinecap="round" />
        </>
      ) : type === "metal" ? (
        <>
          <path d="M5 11h38" stroke="#9bd9e8" strokeOpacity=".35" strokeWidth="5" strokeLinecap="round" />
          <path d="M5 9.5h38M5 12.5h38" stroke="#fff" strokeOpacity=".58" strokeWidth=".65" />
          <path d="M5 10.5h38" stroke="#e9fbff" strokeOpacity=".88" strokeWidth=".45" />
        </>
      ) : (
        <>
          <path d="M5 11h38" stroke="#9bd9e8" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
          {Array.from({ length: 10 }, (_, index) => {
            const x = 6 + index * 4;
            return <path key={index} d={`M${x} 8l2 6`} stroke="#d4f4ff" strokeOpacity={index % 2 ? ".55" : ".85"} strokeWidth=".7" />;
          })}
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tiny presentational atoms (no external deps, dark/compact/dev-tool styling)
// ---------------------------------------------------------------------------

function Section({ title, children, defaultOpen = false, open: controlledOpen, onOpenChange, help }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  help?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  return (
    <div className="ml-section">
      <button type="button" className="ml-section-head" onClick={() => {
        const nextOpen = !open;
        if (controlledOpen === undefined) setInternalOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}>
        <svg className={`ml-section-chevron ${open ? "open" : ""}`} viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        <span className="ml-section-title-wrap">
          <span className="ml-section-title">{title}</span>
          {help && <Tooltip title={title} description={help} />}
        </span>
      </button>
      {open && <div className="ml-section-body">{children}</div>}
    </div>
  );
}

function Row({ label, children, className = "" }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`ml-row ${className}`}>
      <label className="ml-row-label">{label}</label>
      <div className="ml-row-control">{children}</div>
    </div>
  );
}

function SegmentedRadioField<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="ml-segmented-field">
      <legend>{label}</legend>
      <div className="ml-segmented-options" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <label className={`ml-segmented-option ${value === option.value ? "selected" : ""}`} key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function hexToHsv(color: string): { hue: number; saturation: number; value: number } {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join("") : hex;
  if (!/^[\da-f]{6}$/i.test(full)) return { hue: 0, saturation: 0, value: 0 };
  const red = parseInt(full.slice(0, 2), 16) / 255;
  const green = parseInt(full.slice(2, 4), 16) / 255;
  const blue = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }
  hue = (hue * 60 + 360) % 360;
  return { hue, saturation: max === 0 ? 0 : delta / max, value: max };
}

function hsvToHex(hue: number, saturation: number, value: number): string {
  const chroma = value * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = value - chroma;
  const hexChannel = (channel: number) => Math.round((channel + match) * 255).toString(16).padStart(2, "0");
  return `#${hexChannel(red)}${hexChannel(green)}${hexChannel(blue)}`;
}

function ColorPickerControl({
  label,
  color,
  onChange,
  onChangeStart,
  onChangeEnd,
}: {
  label: string;
  color: string;
  onChange: (color: string) => void;
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const changingRef = useRef(false);
  const [draft, setDraft] = useState(color);
  const { hue, saturation, value } = hexToHsv(color);

  function startChange() {
    if (changingRef.current) return;
    changingRef.current = true;
    onChangeStart?.();
  }

  function endChange() {
    if (!changingRef.current) return;
    changingRef.current = false;
    onChangeEnd?.();
  }

  function openPicker() {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    setDraft(color);
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    popover.style.left = `${left}px`;
    if (!popover.matches(":popover-open")) popover.showPopover();
    const height = popover.getBoundingClientRect().height;
    const top = rect.bottom + height + 8 <= window.innerHeight
      ? rect.bottom + 8
      : Math.max(12, rect.top - height - 8);
    popover.style.top = `${top}px`;
  }

  function setHsv(nextHue: number, nextSaturation: number, nextValue: number) {
    const nextColor = hsvToHex(nextHue, nextSaturation, nextValue);
    setDraft(nextColor);
    onChange(nextColor);
  }

  function updateBoard(event: React.PointerEvent<HTMLDivElement>) {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextSaturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextValue = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setHsv(hue, nextSaturation, nextValue);
  }

  function updateHue(event: React.PointerEvent<HTMLDivElement>) {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextHue = Math.max(0, Math.min(359.9, ((event.clientX - rect.left) / rect.width) * 360));
    setHsv(nextHue, saturation, value);
  }

  function commitHex() {
    if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(draft)) {
      const normalized = draft.length === 4 ? `#${[...draft.slice(1)].map((digit) => `${digit}${digit}`).join("")}` : draft;
      onChange(normalized);
      setDraft(normalized);
    } else {
      setDraft(color);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ml-color-trigger"
        aria-label={`${label}, current color ${color}`}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={openPicker}
      >
        <span className="ml-color-trigger-swatch" style={{ backgroundColor: color }} />
        <span className="ml-color-trigger-value">{color.toUpperCase()}</span>
      </button>
      <div ref={popoverRef} id={id} className="ml-color-popover" popover="auto" role="dialog" aria-label={`${label} color picker`}>
        <div className="ml-color-popover-head">
          <strong>{label}</strong>
          <button type="button" className="ml-icon-btn" aria-label="Close color picker" onClick={() => popoverRef.current?.hidePopover()}>×</button>
        </div>
        <div
          ref={boardRef}
          className="ml-color-saturation"
          role="slider"
          tabIndex={0}
          aria-label={`${label} saturation and brightness`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(saturation * 100)}
          aria-valuetext={color}
          style={{ backgroundColor: `hsl(${hue} 100% 50%)` }}
          onPointerDown={(event) => {
            startChange();
            event.currentTarget.setPointerCapture(event.pointerId);
            updateBoard(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateBoard(event);
          }}
          onPointerUp={endChange}
          onPointerCancel={endChange}
          onLostPointerCapture={endChange}
          onKeyDown={(event) => {
            const change = event.shiftKey ? 0.1 : 0.02;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              startChange();
              const nextSaturation = Math.max(0, Math.min(1, saturation + (event.key === "ArrowRight" ? change : event.key === "ArrowLeft" ? -change : 0)));
              const nextValue = Math.max(0, Math.min(1, value + (event.key === "ArrowUp" ? change : event.key === "ArrowDown" ? -change : 0)));
              setHsv(hue, nextSaturation, nextValue);
            }
          }}
          onKeyUp={endChange}
          onBlur={endChange}
        >
          <span className="ml-color-saturation-marker" style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }} />
        </div>
        <div
          ref={hueRef}
          className="ml-color-hue"
          role="slider"
          tabIndex={0}
          aria-label={`${label} hue`}
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hue)}
          onPointerDown={(event) => {
            startChange();
            event.currentTarget.setPointerCapture(event.pointerId);
            updateHue(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateHue(event);
          }}
          onPointerUp={endChange}
          onPointerCancel={endChange}
          onLostPointerCapture={endChange}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              startChange();
              setHsv((hue + (event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 359)) % 360, saturation, value);
            }
          }}
          onKeyUp={endChange}
          onBlur={endChange}
        >
          <span className="ml-color-hue-marker" style={{ left: `${(hue / 360) * 100}%` }} />
        </div>
        <label className="ml-color-hex">
          <span>HEX</span>
          <input
            type="text"
            inputMode="text"
            maxLength={7}
            spellCheck={false}
            value={draft}
            aria-label={`${label} hex color`}
            onFocus={(event) => {
              setDraft(color);
              event.currentTarget.select();
            }}
            onChange={(event) => {
              const next = event.target.value.startsWith("#") ? event.target.value : `#${event.target.value}`;
              setDraft(next);
              if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(next)) {
                const normalized = next.length === 4 ? `#${[...next.slice(1)].map((digit) => `${digit}${digit}`).join("")}` : next;
                startChange();
                onChange(normalized);
              }
            }}
            onBlur={() => {
              commitHex();
              endChange();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); commitHex(); event.currentTarget.blur(); }
              if (event.key === "Escape") { setDraft(color); endChange(); popoverRef.current?.hidePopover(); }
            }}
          />
        </label>
      </div>
    </>
  );
}

function ColorStyleEditor({ color, colorStyle, colorLabel = "Line", onColorChange, onColorStyleChange, onColorStyleLiveChange, onColorChangeStart, onColorChangeEnd, onSpeedChange, onSpeedCommitStart, onSpeedCommitEnd, onColorWeightsChange }: {
  color: string;
  colorStyle?: LineColorStyle;
  colorLabel?: string;
  onColorChange: (color: string) => void;
  onColorStyleChange: (style: LineColorStyle) => void;
  onColorStyleLiveChange?: (style: LineColorStyle) => void;
  onColorChangeStart?: () => void;
  onColorChangeEnd?: () => void;
  onSpeedChange: (speed: number) => void;
  onSpeedCommitStart: () => void;
  onSpeedCommitEnd: () => void;
  onColorWeightsChange: (weights: number[]) => void;
}) {
  const style = colorStyle ?? { type: "solid" as const, colors: [color, "#5ee6ff"] };
  const weights = normalizeColorWeights(style.colorWeights, style.colors.length);
  const [draggedColorIndex, setDraggedColorIndex] = useState<number | null>(null);
  const draggedColorIndexRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const setColor = (index: number, nextColor: string) => {
    const colors = [...style.colors];
    colors[index] = nextColor;
    (onColorStyleLiveChange ?? onColorStyleChange)({ ...style, colors });
  };
  const addColor = () => {
    const colors = [...style.colors, "#5ee6ff"];
    const colorWeights = setColorWeight([...weights, 0], colors.length - 1, Math.round(100 / colors.length));
    onColorStyleChange({
      ...style,
      colors,
      colorWeights,
    });
  };
  const removeColor = (index: number) => {
    const colors = style.colors.filter((_, colorIndex) => colorIndex !== index);
    const colorWeights = normalizeColorWeights(weights.filter((_, colorIndex) => colorIndex !== index), colors.length);
    onColorStyleChange({
      ...style,
      colors,
      colorWeights,
    });
  };
  const reorderColors = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const colors = [...style.colors];
    const colorWeights = [...weights];
    const [movedColor] = colors.splice(fromIndex, 1);
    const [movedWeight] = colorWeights.splice(fromIndex, 1);
    colors.splice(toIndex, 0, movedColor);
    colorWeights.splice(toIndex, 0, movedWeight);
    onColorStyleChange({ ...style, colors, colorWeights });
  };
  const moveDraggedColorTo = (toIndex: number) => {
    const fromIndex = draggedColorIndexRef.current;
    if (fromIndex === null || fromIndex === toIndex) return;
    reorderColors(fromIndex, toIndex);
    draggedColorIndexRef.current = toIndex;
    setDraggedColorIndex(toIndex);
  };
  const updateColorWeight = (index: number, requestedWeight: number) => {
    onColorWeightsChange(setColorWeight(weights, index, requestedWeight));
  };

  return (
    <>
      <Row label="Style">
        <select
          className="ml-select"
          value={style.type}
          aria-label={`${colorLabel} color style`}
          onChange={(event) => onColorStyleChange({ ...style, type: event.target.value as LineColorStyle["type"] })}
        >
          <option value="solid">Solid</option>
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
          <option value="diamond">Diamond</option>
          <option value="random">Random</option>
          <option value="rainbow">Rainbow</option>
        </select>
      </Row>
      {style.type === "solid" ? (
        <Row label="Color"><ColorPickerControl label={`${colorLabel} color`} color={color} onChange={onColorChange} onChangeStart={onColorChangeStart} onChangeEnd={onColorChangeEnd} /></Row>
      ) : style.type === "rainbow" ? (
        <div className="ml-rainbow-style">
          <div className="ml-rainbow-preview" style={{ background: `linear-gradient(90deg, ${RAINBOW_COLORS.join(", ")})` }} aria-label="Rainbow colors from red through violet" role="img" />
          <small className="ml-gradient-help">{colorLabel === "Line" ? "Rainbow spans a single stroke. Multi-stroke custom paths give each stroke one solid rainbow color." : "The full rainbow spectrum appears across the rendered path at once."}</small>
        </div>
      ) : (
        <div className="ml-gradient-stops">
          <div className="ml-gradient-stops-head">
            <span>Color stops <small>{style.colors.length}/6</small></span>
            <button type="button" className="ml-btn" disabled={style.colors.length >= 6} onClick={addColor}>+ Add color</button>
          </div>
          <div className="ml-gradient-stop-list">
            {style.colors.map((stopColor, index) => (
              <div
                className={`ml-gradient-stop ${draggedColorIndex === index ? "dragging" : ""}`}
                key={index}
                data-color-index={index}
              >
                <button
                  type="button"
                  className="ml-gradient-drag"
                  aria-label={`Drag to reorder color ${index + 1}`}
                  title="Drag to reorder. Use the arrow keys to move."
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    dragPointerIdRef.current = event.pointerId;
                    draggedColorIndexRef.current = index;
                    setDraggedColorIndex(index);
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (dragPointerIdRef.current !== event.pointerId) return;
                    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".ml-gradient-stop");
                    const targetIndex = Number(target?.dataset.colorIndex);
                    if (target && Number.isInteger(targetIndex)) moveDraggedColorTo(targetIndex);
                  }}
                  onPointerUp={(event) => {
                    if (dragPointerIdRef.current !== event.pointerId) return;
                    dragPointerIdRef.current = null;
                    draggedColorIndexRef.current = null;
                    setDraggedColorIndex(null);
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    dragPointerIdRef.current = null;
                    draggedColorIndexRef.current = null;
                    setDraggedColorIndex(null);
                  }}
                  onKeyDown={(event) => {
                    const nextIndex = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : index;
                    if (nextIndex < 0 || nextIndex >= style.colors.length || nextIndex === index) return;
                    event.preventDefault();
                    reorderColors(index, nextIndex);
                  }}
                >⋮⋮</button>
                <span className="ml-gradient-stop-name">{style.type === "diamond" ? index === 0 ? "Edge" : index === style.colors.length - 1 ? "Center" : `Color ${index + 1}` : `Color ${index + 1}`}</span>
                <ColorPickerControl label={`Color ${index + 1}`} color={stopColor} onChange={(nextColor) => setColor(index, nextColor)} onChangeStart={onColorChangeStart} onChangeEnd={onColorChangeEnd} />
                <button type="button" className="ml-icon-btn ml-gradient-remove" aria-label={`Remove gradient color ${index + 1}`} disabled={style.colors.length <= 2} onClick={() => removeColor(index)}>×</button>
                {style.type !== "random" && (
                  <div className="ml-gradient-stop-position">
                    <span>Coverage</span>
                    <div className="ml-gradient-stop-position-control">
                      <input
                        type="range"
                        min={0}
                      max={100}
                        step={1}
                        value={weights[index]}
                        aria-label={`Color ${index + 1} coverage`}
                        aria-valuetext={`${Math.round(weights[index])}% of the line`}
                        onFocus={onSpeedCommitStart}
                        onPointerDown={onSpeedCommitStart}
                        onChange={(event) => updateColorWeight(index, Number(event.target.value))}
                        onPointerUp={onSpeedCommitEnd}
                        onPointerCancel={onSpeedCommitEnd}
                        onKeyDown={(event) => { if (isRangeAdjustmentKey(event.key)) onSpeedCommitStart(); }}
                        onKeyUp={(event) => { if (isRangeAdjustmentKey(event.key)) onSpeedCommitEnd(); }}
                        onBlur={onSpeedCommitEnd}
                      />
                      <div className="ml-gradient-stop-position-value">
                        <ScrubNumberField
                          label={`Color ${index + 1} coverage`}
                          value={weights[index]}
                          min={0}
                          max={100}
                          step={1}
                          onCommitStart={onSpeedCommitStart}
                          onCommitEnd={onSpeedCommitEnd}
                          onChange={(weight) => updateColorWeight(index, weight)}
                        />
                        <small>%</small>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <small className="ml-gradient-help">{style.type === "random" ? "Smoothly cycles through these colors while animation is playing." : "Each percentage sets that color's coverage; 100% makes it fill the whole line. Adjusting one redistributes the remaining coverage proportionally across the other colors. Drag colors to reorder."}</small>
          {style.type === "random" && (
            <SliderField
              label="Seconds / color"
              description="Time spent blending between each palette color. Lower values change faster."
              value={style.speed ?? 2.5}
              min={0.1}
              max={10}
              step={0.1}
              unit="s"
              onCommitStart={onSpeedCommitStart}
              onCommitEnd={onSpeedCommitEnd}
              onLive={onSpeedChange}
            />
          )}
        </div>
      )}
    </>
  );
}

interface TooltipProps {
  title: string;
  description: string;
  example?: string;
}

function Tooltip({ title, description, example }: TooltipProps) {
  return (
    <span className="ml-help" tabIndex={0} aria-label={`Help: ${title}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 7.2v3.4M8 4.8h.01" /></svg>
      <span className="ml-tooltip" role="tooltip">
        <strong>{title}</strong>
        <span>{description}</span>
        {example && <em>Example: {example}</em>}
      </span>
    </span>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  sliderMax?: number;
  step?: number;
  unit?: string;
  description?: string;
  example?: string;
  disabled?: boolean;
  onLive: (v: number) => void;
  onCommitStart: () => void;
  onCommitEnd: () => void;
}

function FlowSettings({ flow, onLive, onDiscrete, onCommitStart, onCommitEnd }: {
  flow: FlowConfig;
  onLive: (flow: FlowConfig) => void;
  onDiscrete: (flow: FlowConfig) => void;
  onCommitStart: () => void;
  onCommitEnd: () => void;
}) {
  const changeLive = (patch: Partial<FlowConfig>, clearPreset = true) => onLive({
    ...flow,
    ...patch,
    preset: clearPreset ? null : flow.preset,
  });
  const effectNames: Record<FlowEffectType, string> = {
    "electric-current": "Electric current",
    "continuous-light": "Continuous light",
    plasma: "Plasma",
    "fiber-optic": "Fiber optic",
    "energy-pulse": "Energy pulse",
  };
  const preset = FLOW_PRESETS.find((item) => item.id === flow.preset);

  return (
    <>
      <Row label="Enabled"><input type="checkbox" checked={flow.enabled} onChange={() => onDiscrete({ ...flow, enabled: !flow.enabled })} /></Row>
      <Row label="Effect"><select className="ml-select" value={flow.effectType} onChange={(event) => onDiscrete({ ...flow, effectType: event.target.value as FlowEffectType, preset: null })}>
        {Object.entries(effectNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
      </select></Row>
      <Row label="Preset"><select className="ml-select" value={preset?.id ?? ""} onChange={(event) => {
        const selected = FLOW_PRESETS.find((item) => item.id === event.target.value);
        if (selected) onDiscrete({ ...selected.config, colors: [...selected.config.colors], layers: { ...selected.config.layers } });
        else onDiscrete({ ...flow, preset: null });
      }}>
        <option value="">Custom</option>
        {FLOW_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></Row>
      {preset && <small className="ml-texture-description">{preset.description}</small>}
      <Row label="Direction"><select className="ml-select" value={flow.direction} onChange={(event) => onDiscrete({ ...flow, direction: event.target.value as FlowConfig["direction"], preset: null })}>
        <option value="forward">Forward</option><option value="reverse">Reverse</option><option value="both">Both ways</option><option value="alternating">Alternating</option>
      </select></Row>
      <Row label={<>Placement <Tooltip title="Flow placement" description="Inside narrows the effect on the stroke; Along traces its centerline; Around and Outside add parallel traces at increasing distances; Mixed combines center and side traces." /></>}><select className="ml-select" value={flow.placement} onChange={(event) => onDiscrete({ ...flow, placement: event.target.value as FlowConfig["placement"], preset: null })}>
        <option value="inside">Inside</option><option value="along">Along</option><option value="around">Around</option><option value="outside">Outside</option><option value="mixed">Mixed</option>
      </select></Row>
      <SliderField label="Speed" value={flow.speed} min={0} max={3} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(speed) => changeLive({ speed })} />
      <SliderField label="Intensity" value={flow.intensity} min={0} max={2} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(intensity) => changeLive({ intensity })} />
      <SliderField label="Width" value={flow.width} min={0.25} max={8} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(width) => changeLive({ width })} />
      <SliderField label="Core width" value={flow.coreWidth} min={0.1} max={4} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(coreWidth) => changeLive({ coreWidth })} />
      <SliderField label="Glow width" value={flow.glowWidth} min={0} max={24} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(glowWidth) => changeLive({ glowWidth })} />
      <SliderField label="Opacity" value={flow.opacity} min={0} max={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(opacity) => changeLive({ opacity })} />
      <SliderField label="Color speed" value={flow.colorSpeed} min={0} max={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(colorSpeed) => changeLive({ colorSpeed })} />
      <SliderField label="Phase" value={flow.phase} min={0} max={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(phase) => changeLive({ phase })} />
      <div className="ml-flow-colors">
        <Row label="Energy colors"><div className="ml-flow-color-pair">
          {flow.colors.slice(0, 2).map((color, index) => (
            <label key={index} aria-label={`Energy color ${index + 1}`}>
              <span>{index === 0 ? "Start" : "End"}</span>
              <input type="color" value={color} onFocus={onCommitStart} onBlur={onCommitEnd} onChange={(event) => {
                const colors = [...flow.colors];
                colors[index] = event.target.value;
                changeLive({ colors });
              }} />
            </label>
          ))}
        </div></Row>
        <Row label="Core color"><input type="color" value={flow.coreColor} onFocus={onCommitStart} onBlur={onCommitEnd} onChange={(event) => changeLive({ coreColor: event.target.value })} /></Row>
        <Row label="Glow color"><input type="color" value={flow.glowColor} onFocus={onCommitStart} onBlur={onCommitEnd} onChange={(event) => changeLive({ glowColor: event.target.value })} /></Row>
      </div>
      <Row label="Streams"><input className="ml-num" type="number" min={1} max={3} step={1} value={flow.streamCount} onFocus={onCommitStart} onBlur={onCommitEnd} onChange={(event) => changeLive({ streamCount: Math.max(1, Math.min(3, Number(event.target.value) || 1)) })} /></Row>
      {flow.effectType === "electric-current" && <>
        <SliderField label="Branch frequency" value={flow.branchFrequency} min={0} max={2} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(branchFrequency) => changeLive({ branchFrequency })} />
        <SliderField label="Branch length" value={flow.branchLength} min={0} max={0.3} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(branchLength) => changeLive({ branchLength })} />
        <SliderField label="Spark density" value={flow.sparkDensity} min={0} max={2} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(sparkDensity) => changeLive({ sparkDensity })} />
        <SliderField label="Flicker" value={flow.flicker} min={0} max={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(flicker) => changeLive({ flicker })} />
      </>}
      {(flow.effectType === "plasma" || flow.effectType === "fiber-optic") && <>
        <SliderField label="Turbulence" value={flow.turbulence} min={0} max={1.5} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(turbulence) => changeLive({ turbulence })} />
        {flow.effectType === "plasma" && <SliderField label="Flicker" value={flow.flicker} min={0} max={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(flicker) => changeLive({ flicker })} />}
        {flow.effectType === "fiber-optic" && <SliderField label="Strand count" value={flow.strandCount} min={1} max={7} step={1} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(strandCount) => changeLive({ strandCount })} />}
      </>}
      {(flow.effectType === "continuous-light" || flow.effectType === "energy-pulse") && (
        <SliderField label={flow.effectType === "energy-pulse" ? "Pulse width" : "Tail length"} value={flow.effectType === "energy-pulse" ? flow.pulseWidth : flow.tailLength} min={0.02} max={0.75} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} onLive={(value) => changeLive(flow.effectType === "energy-pulse" ? { pulseWidth: value } : { tailLength: value })} />
      )}
      {flow.effectType === "energy-pulse" && (
        <Row label="Pulse rhythm"><select className="ml-select" value={flow.pulseRhythm} onChange={(event) => onDiscrete({ ...flow, pulseRhythm: event.target.value as FlowConfig["pulseRhythm"], preset: null })}>
          <option value="continuous">Continuous</option><option value="heartbeat">Heartbeat</option>
        </select></Row>
      )}
      <fieldset className="ml-flow-layers">
        <legend>Visible layers</legend>
        {(["current", "core", "secondary", "glow", "branches", "sparks"] as const).map((name) => (
          <label key={name}><input type="checkbox" checked={flow.layers[name]} onChange={() => onDiscrete({ ...flow, preset: null, layers: { ...flow.layers, [name]: !flow.layers[name] } })} />{name}</label>
        ))}
      </fieldset>
    </>
  );
}

function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(6).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function ScrubNumberField({ label, value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, step, className = "ml-num", disabled = false, onChange, onCommitStart, onCommitEnd }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
  className?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommitStart?: () => void;
  onCommitEnd?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => formatNumericValue(value));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrubRef = useRef<{ pointerId: number; startY: number; startValue: number; active: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const cancelEditRef = useRef(false);
  const editStartedRef = useRef(false);
  const safeStep = Math.abs(step) || 0.01;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function clamp(next: number) {
    return Math.min(max, Math.max(min, next));
  }

  function roundToStep(next: number) {
    const decimals = Math.max(0, Math.min(8, (String(safeStep).split(".")[1] || "").length));
    return Number(next.toFixed(decimals));
  }

  function finishEdit() {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      if (editStartedRef.current) onCommitEnd?.();
      editStartedRef.current = false;
      setEditing(false);
      return;
    }
    const parsed = Number(draft);
    if (draft.trim() !== "" && Number.isFinite(parsed)) onChange(Number(clamp(parsed).toFixed(6)));
    else setDraft(formatNumericValue(value));
    if (editStartedRef.current) onCommitEnd?.();
    editStartedRef.current = false;
    setEditing(false);
  }

  function adjustBy(amount: number) {
    onCommitStart?.();
    onChange(clamp(roundToStep(value + amount)));
    onCommitEnd?.();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        className={className}
        disabled={disabled}
        value={draft}
        aria-label={`${label} exact value`}
        onFocus={() => {
          if (!editStartedRef.current) {
            editStartedRef.current = true;
            onCommitStart?.();
          }
          setDraft(formatNumericValue(value));
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "Escape") {
            cancelEditRef.current = true;
            setDraft(formatNumericValue(value));
            event.currentTarget.blur();
          }
        }}
        onBlur={finishEdit}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${className} ml-scrub-number`}
      disabled={disabled}
      aria-label={`${label}: ${formatNumericValue(value)}. Drag up or down to adjust, or click to type.`}
      title="Drag up or down to adjust; click to type a value."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        scrubRef.current = { pointerId: event.pointerId, startY: event.clientY, startValue: value, active: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const scrub = scrubRef.current;
        if (!scrub || scrub.pointerId !== event.pointerId) return;
        const deltaY = scrub.startY - event.clientY;
        if (!scrub.active && Math.abs(deltaY) < 2) return;
        if (!scrub.active) {
          scrub.active = true;
          onCommitStart?.();
        }
        const increments = Math.round(deltaY / 2);
        onChange(clamp(roundToStep(scrub.startValue + increments * safeStep)));
      }}
      onPointerUp={(event) => {
        const scrub = scrubRef.current;
        if (!scrub || scrub.pointerId !== event.pointerId) return;
        suppressClickRef.current = scrub.active;
        if (scrub.active) onCommitEnd?.();
        scrubRef.current = null;
      }}
      onPointerCancel={() => {
        if (scrubRef.current?.active) onCommitEnd?.();
        scrubRef.current = null;
        suppressClickRef.current = false;
      }}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        setDraft(formatNumericValue(value));
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          adjustBy(event.key === "ArrowUp" ? safeStep : -safeStep);
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setDraft(formatNumericValue(value));
          setEditing(true);
        }
      }}
      onWheel={(event) => {
        event.preventDefault();
        adjustBy(event.deltaY < 0 ? safeStep : -safeStep);
      }}
    >
      {formatNumericValue(value)}
    </button>
  );
}

function isRangeAdjustmentKey(key: string) {
  return key.startsWith("Arrow") || key === "Home" || key === "End" || key === "PageUp" || key === "PageDown";
}

function SliderField({ label, value, min, max, sliderMax, step = 0.01, unit = "", description, example, disabled = false, onLive, onCommitStart, onCommitEnd }: SliderFieldProps) {
  const effectiveMax = Math.max(max, value, min + step);
  const effectiveSliderMax = Math.max(min + step, Math.min(effectiveMax, sliderMax ?? effectiveMax));
  const help = description || `${label} changes the resolved ${label.toLowerCase()} value used by the renderer.`;

  return (
    <Row className="ml-slider-row" label={<>{label} <Tooltip title={label} description={help} example={example} /></>}>
      <div className="ml-slider-wrap">
        <div className="ml-value-wrap">
          <ScrubNumberField label={label} value={value} min={min} max={effectiveMax} step={step} disabled={disabled} onChange={onLive} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} />
          {unit && <span className="ml-unit">{unit}</span>}
        </div>
        <input
          type="range"
          disabled={disabled}
          min={min}
          max={effectiveSliderMax}
          step={step}
          value={Math.min(effectiveSliderMax, Math.max(min, value))}
          aria-label={label}
          aria-valuetext={`${formatNumericValue(value)}${unit ? ` ${unit}` : ""}`}
          onFocus={onCommitStart}
          onPointerDown={onCommitStart}
          onChange={(e) => onLive(Number(e.target.value))}
          onPointerUp={onCommitEnd}
          onPointerCancel={onCommitEnd}
          onKeyDown={(e) => { if (isRangeAdjustmentKey(e.key)) onCommitStart(); }}
          onKeyUp={(e) => { if (isRangeAdjustmentKey(e.key)) onCommitEnd(); }}
          onBlur={onCommitEnd}
        />
      </div>
    </Row>
  );
}

function CompactValueField({ label, icon, value, min, max, step, onLive, onCommitStart, onCommitEnd }: {
  label: string;
  icon: "opacity" | "width";
  value: number;
  min: number;
  max: number;
  step: number;
  onLive: (value: number) => void;
  onCommitStart: () => void;
  onCommitEnd: () => void;
}) {
  return (
    <div className="ml-appearance-value">
      <span className="ml-appearance-value-label">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          {icon === "opacity" ? <><circle cx="8" cy="8" r="6" /><path d="M8 2a6 6 0 0 0 0 12Z" /></> : <><path d="M2 5h12M2 8h8M2 11h12" /><path d="M12 7v2" /></>}
        </svg>
        {label}
      </span>
      <ScrubNumberField
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        className="ml-appearance-number"
        onChange={onLive}
        onCommitStart={onCommitStart}
        onCommitEnd={onCommitEnd}
      />
    </div>
  );
}
// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export function MagneticLinesEditor({ initialConfig, onChange }: MagneticLinesEditorProps) {
  const router = useRouter();
  const [config, setConfig] = useState<MagneticLinesSceneConfig>(() => sanitizeSceneConfig(initialConfig || DEFAULT_SCENE));
  const configRef = useRef(config);
  configRef.current = config;

  const [selectedLineId, setSelectedLineId] = useState<string | null>(config.lines[0]?.id || null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [linesToGroup, setLinesToGroup] = useState<string[]>([]);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const [layerContextMenu, setLayerContextMenu] = useState<{ x: number; y: number; lineIds: string[]; groupId: string | null } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [groupRenameLocation, setGroupRenameLocation] = useState<"layer" | "inspector">("layer");
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupRenameError, setGroupRenameError] = useState<string | null>(null);
  const [isRenamingLine, setIsRenamingLine] = useState(false);
  const [lineRenameLocation, setLineRenameLocation] = useState<"layer" | "inspector">("layer");
  const [lineNameDraft, setLineNameDraft] = useState("");
  const [lineRenameError, setLineRenameError] = useState<string | null>(null);
  const [selectedAnchorPointId, setSelectedAnchorPointId] = useState<string | null>(null);
  const [selectedAnchorPointIds, setSelectedAnchorPointIds] = useState<string[]>([]);
  const [expandedAnchorPointIds, setExpandedAnchorPointIds] = useState<string[]>([]);
  const [anchorCanvasMode, setAnchorCanvasMode] = useState<"both" | "shape" | "animation">("both");
  const [anchorPointsExpanded, setAnchorPointsExpanded] = useState(false);
  const [anchorTargetToAdd, setAnchorTargetToAdd] = useState("start");
  const [showShapePointLabels, setShowShapePointLabels] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [timelinePreviewPlaying, setTimelinePreviewPlaying] = useState(true);
  const [anchorPlaybackSeek, setAnchorPlaybackSeek] = useState<{ lineId: string; stepIndex: number; requestId: number } | null>(null);
  const anchorPlaybackSeekRequestRef = useRef(0);
  const [showAllShapeTracks, setShowAllShapeTracks] = useState(false);
  const [selectedShapeTrackValues, setSelectedShapeTrackValues] = useState<string[]>([]);
  const [hiddenCanvasShapeTrackValues, setHiddenCanvasShapeTrackValues] = useState<string[]>([]);
  const [hiddenCanvasStepIndices, setHiddenCanvasStepIndices] = useState<number[]>([]);
  const [focusCanvasOnSelection, setFocusCanvasOnSelection] = useState(true);
  const [anchorTransformMode, setAnchorTransformMode] = useState<"preserve" | "same">("preserve");
  const [anchorTransform, setAnchorTransform] = useState({ x: 0, y: 0, scale: 1, rotation: 0, size: 0.16 });
  const [previewViewport, setPreviewViewport] = useState({ width: 1, height: 1 });
  const [environmentPathEditing, setEnvironmentPathEditing] = useState(false);
  const [environmentPathLineId, setEnvironmentPathLineId] = useState<string | null>(null);
  const [environmentPathIndex, setEnvironmentPathIndex] = useState(0);
  const [environmentSectionExpanded, setEnvironmentSectionExpanded] = useState(false);
  const [showGlowRadiusPreview, setShowGlowRadiusPreview] = useState({ inner: true, outer: true });
  const [glowSectionExpanded, setGlowSectionExpanded] = useState(false);
  const [magnetSectionExpanded, setMagnetSectionExpanded] = useState(false);
  const [selectedPathPointId, setSelectedPathPointId] = useState<string | null>(null);
  const [geometryExpanded, setGeometryExpanded] = useState(false);
  const [lineTransformExpanded, setLineTransformExpanded] = useState(false);
  const [groupTransformExpanded, setGroupTransformExpanded] = useState(false);
  const [soloLineId, setSoloLineId] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugFlags>({ showEndpoints: true, showIds: false, showTargetBounds: false });
  const [previewKey, setPreviewKey] = useState(0);
  const [showIO, setShowIO] = useState<null | "export" | "import">(null);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [importText, setImportText] = useState("");
  const [ioError, setIoError] = useState("");
  const [targetSnapshots, setTargetSnapshots] = useState<TargetSnapshot[]>([]);
  const [panel, setPanel] = useState<"editor" | "targets">("editor");
  const [editorMode, setEditorMode] = useState<"magnetic" | "cursor">("magnetic");
  const [globalTargetLineId, setGlobalTargetLineId] = useState<string | null>(config.lines[0]?.id || null);
  const [pagePaths, setPagePaths] = useState<string[]>(BUILT_IN_PAGE_PATHS);
  const discoveredPagePathsRef = useRef<string[]>([]);
  const [pagePath, setPagePath] = useState("/");
  const [pageSceneError, setPageSceneError] = useState("");
  const [pageActionLoading, setPageActionLoading] = useState<"save-test" | "clear-page" | "forget-page" | null>(null);
  const [pageSaveStatus, setPageSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pagePreviewToken, setPagePreviewToken] = useState<string | null>(null);
  const [targetPickToken, setTargetPickToken] = useState<string | null>(null);
  const [targetPickTargetId, setTargetPickTargetId] = useState<string | null>(null);
  const [pickedTargetDraft, setPickedTargetDraft] = useState<PickedTargetDraft | null>(null);
  const [selectedTargetIdState, setSelectedTargetIdState] = useState<string | null>(null);
  const [targetPreviewImages, setTargetPreviewImages] = useState<Record<string, string>>({});
  const [targetDraftError, setTargetDraftError] = useState("");
  const [targetStatuses, setTargetStatuses] = useState<Record<string, TargetPickerMessage["status"]>>({});
  const pagePreviewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [savedLineShapes, setSavedLineShapes] = useState<ReusableLineShape[]>([]);
  const [selectedSavedLineShapeName, setSelectedSavedLineShapeName] = useState("");
  const [lineShapeName, setLineShapeName] = useState("");
  const [lineShapeError, setLineShapeError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const cacheTargetPreviewImage = useCallback((targetId: string, previewSvg: string | undefined) => {
    const previewUrl = targetPreviewDataUrl(previewSvg);
    if (!previewUrl) return;
    setTargetPreviewImages((current) => {
      if (current[targetId] === previewUrl) return current;
      const next = { ...current, [targetId]: previewUrl };
      const targetIds = Object.keys(next);
      const staleIds = targetIds.slice(0, Math.max(0, targetIds.length - 32));
      for (const staleId of staleIds) {
        if (staleId !== targetId) delete next[staleId];
      }
      return next;
    });
  }, []);

  const history = useHistory<MagneticLinesSceneConfig>(150);
  const pendingBeforeRef = useRef<MagneticLinesSceneConfig | null>(null);
  const groupBeforeRef = useRef<MagneticLinesSceneConfig | null>(null);
  const groupCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedPagePathRef = useRef<string | null>(null);
  const sceneLoadedIntoEditorRef = useRef<MagneticLinesSceneConfig | null>(null);
  const pendingPageSaveRef = useRef<{ path: string; scene: MagneticLinesSceneConfig } | null>(null);
  const pageSaveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          await syncPersistedPageScenesFromProject();
        } catch (error) {
          console.error("Could not load magnetic-scene data from project files.", error);
          if (active) setPageSceneError("Could not load saved page backgrounds from project files. Changes cannot be saved until the project store is available.");
        }
        if (!active) return;
      let restoredPagePath: string | null = null;
      try {
        restoredPagePath = normalizeMagneticPagePath(
          window.sessionStorage.getItem(EDITOR_PAGE_PATH_KEY) ?? "",
        );
      } catch {
        // The editor can still load its default page when session storage is unavailable.
      }

      if (restoredPagePath) {
        const savedScene = loadPersistedPageScene(restoredPagePath);
        const defaultScene = getPortfolioDefaultScene(restoredPagePath);
        const restoredScene = normalizePortfolioPageScene(
          restoredPagePath,
          savedScene ?? defaultScene,
          defaultScene,
        );
        if (savedScene && restoredScene !== savedScene) {
          try {
            if (!await savePersistedPageScene(restoredPagePath, restoredScene)) {
              console.error("Could not save the updated page background scene.");
              setPageSceneError("Could not save the updated page background to project files.");
            }
          } catch (error) {
            console.error("Could not save the updated page background scene.", error);
            setPageSceneError("Could not save the updated page background to project files.");
          }
        }
        loadedPagePathRef.current = restoredPagePath;
        sceneLoadedIntoEditorRef.current = restoredScene;
        setPagePath(restoredPagePath);
        setConfig(restoredScene);
        setSelectedLineId(restoredScene.lines[0]?.id ?? null);
        setGlobalTargetLineId(restoredScene.lines[0]?.id ?? null);
      } else {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const restored = sanitizeSceneConfig(JSON.parse(raw));
            setConfig(restored);
            setSelectedLineId(restored.lines[0]?.id || null);
            setGlobalTargetLineId(restored.lines[0]?.id || null);
          }
        } catch {
          /* ignore corrupt localStorage */
        }
      }
      setPagePaths(BUILT_IN_PAGE_PATHS);
      setSavedLineShapes(listReusableLineShapes());
      setStorageLoaded(true);
      })();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!storageLoaded || loadedPagePathRef.current === pagePath) return;
    const savedScene = loadPersistedPageScene(pagePath);
    const defaultScene = getPortfolioDefaultScene(pagePath);
    const scene = normalizePortfolioPageScene(
      pagePath,
      savedScene ?? defaultScene,
      defaultScene,
    );
    if (savedScene && scene !== savedScene) {
      void savePersistedPageScene(pagePath, scene).then((saved) => {
        if (!saved) {
          console.error("Could not save the updated page background scene.");
          setPageSceneError("Could not save the updated page background to project files.");
        }
      }).catch((error: unknown) => {
        console.error("Could not save the updated page background scene.", error);
        setPageSceneError("Could not save the updated page background to project files.");
      });
    }
    loadedPagePathRef.current = pagePath;
    sceneLoadedIntoEditorRef.current = scene;
    setConfig(scene);
    setSelectedLineId(scene.lines[0]?.id ?? null);
    setGlobalTargetLineId(scene.lines[0]?.id ?? null);
  }, [pagePath, storageLoaded]);

  useEffect(() => {
    if (!storageLoaded) return;
    try {
      window.sessionStorage.setItem(EDITOR_PAGE_PATH_KEY, pagePath);
    } catch {
      // Route restoration is best-effort when session storage is unavailable.
    }
  }, [pagePath, storageLoaded]);

  // Persist to localStorage (debounced) and notify consumer.
  useEffect(() => {
    if (!storageLoaded) return;
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        /* storage full/unavailable — non-fatal; production never depends on this */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [config, storageLoaded]);
  useEffect(() => {
    if (!storageLoaded) return;
    onChange?.(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, storageLoaded]);
  useEffect(() => {
    if (!pagePreviewToken) return;
    const timeout = window.setTimeout(() => {
      if (!savePageScenePreview(pagePath, pagePreviewToken, config)) {
        setPageSceneError("The live preview could not update. Check browser storage and try again.");
      }
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [config, pagePath, pagePreviewToken]);
  useEffect(() => {
    if (!pagePreviewToken) return;
    const onTargetStatus = (event: MessageEvent<TargetPickerMessage>) => {
      if (event.origin !== window.location.origin || event.source !== pagePreviewFrameRef.current?.contentWindow) return;
      const message = event.data;
      const targetId = message?.targetId;
      const status = message?.status;
      if (message?.previewToken !== pagePreviewToken) return;
      if (message.type === "magnetic-target-inspection-ready") {
        if (panel !== "targets") {
          pagePreviewFrameRef.current?.contentWindow?.postMessage({
            type: "magnetic-target-inspect-clear",
            previewToken: pagePreviewToken,
          }, window.location.origin);
          return;
        }
        const targetForPreview = pickedTargetDraft?.id === selectedTargetIdState
          ? pickedTargetDraft
          : config.targets.find((target) => target.id === selectedTargetIdState) ?? config.targets[0];
        if (targetForPreview?.selector) {
          pagePreviewFrameRef.current?.contentWindow?.postMessage({
            type: "magnetic-target-inspect",
            previewToken: pagePreviewToken,
            targetId: targetForPreview.id,
            selector: targetForPreview.selector,
          }, window.location.origin);
        }
        return;
      }
      if (!targetId) return;
      if (message.type === "magnetic-target-preview" && message.previewSvg) {
        cacheTargetPreviewImage(targetId, message.previewSvg);
        return;
      }
      if (message.type !== "magnetic-target-status" || !status) return;
      setTargetStatuses((current) => current[targetId] === status
        ? current
        : { ...current, [targetId]: status });
    };
    window.addEventListener("message", onTargetStatus);
    return () => window.removeEventListener("message", onTargetStatus);
  }, [cacheTargetPreviewImage, config.targets, pagePreviewToken, panel, pickedTargetDraft, selectedTargetIdState]);
  useEffect(() => {
    if (!targetPickToken) return;
    const exitPickPreview = () => {
      if (pagePreviewToken) removePageScenePreview(pagePreviewToken);
      setPagePreviewToken(null);
      setTargetPickToken(null);
      setTargetPickTargetId(null);
      setPageSceneError("");
    };
    const onTargetPicked = (event: MessageEvent<TargetPickerMessage>) => {
      if (event.origin !== window.location.origin || event.source !== pagePreviewFrameRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.token !== targetPickToken) return;
      if (message.type === "magnetic-target-pick-error") {
        setTargetDraftError(message.message || "That element could not be selected. Try another element.");
        return;
      }
      if (message.type === "magnetic-target-pick-cancelled") {
        exitPickPreview();
        return;
      }
      if (message.type !== "magnetic-target-picked" || !message.selector) return;
      const name = message.name?.trim() || message.tagName || "Page element";
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "element";
      const selectedTarget = targetPickTargetId
        ? config.targets.find((target) => target.id === targetPickTargetId)
        : undefined;
      const existing = config.targets.find((target) => target.selector === message.selector);
      if (existing && existing.id !== selectedTarget?.id) {
        setTargetDraftError(`This element is already saved as "${existing.name ?? existing.id}". Re-pick a different element.`);
        setTargetPickToken(null);
        return;
      }
      const id = selectedTarget?.id ?? existing?.id ?? `picked-${slug}-${window.crypto.randomUUID().slice(0, 8)}`;
      setPickedTargetDraft({
        id,
        name: selectedTarget?.name ?? existing?.name ?? name,
        selector: message.selector,
        tagName: message.tagName || "element",
        activations: selectedTarget?.activations ?? existing?.activations ?? ["hover", "focus", "touch"],
        clickBehavior: selectedTarget?.clickBehavior ?? existing?.clickBehavior ?? "toggle",
      });
      setSelectedTargetIdState(id);
      cacheTargetPreviewImage(id, message.previewSvg);
      setTargetStatuses((current) => ({ ...current, [id]: "ready" }));
      setTargetDraftError("");
      setTargetPickToken(null);
      setTargetPickTargetId(null);
      setPanel("targets");
    };
    window.addEventListener("message", onTargetPicked);
    return () => window.removeEventListener("message", onTargetPicked);
  }, [cacheTargetPreviewImage, config.targets, pagePreviewToken, targetPickTargetId, targetPickToken]);
  useEffect(() => {
    if (!storageLoaded || loadedPagePathRef.current !== pagePath) return;
    if (sceneLoadedIntoEditorRef.current === config) {
      sceneLoadedIntoEditorRef.current = null;
      return;
    }
    const pending = { path: pagePath, scene: config };
    pendingPageSaveRef.current = pending;
    setPageSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      if (pendingPageSaveRef.current !== pending) return;
      pageSaveTimeoutRef.current = null;
      void savePersistedPageScene(pending.path, pending.scene).then((saved) => {
        if (pendingPageSaveRef.current !== pending) return;
        if (!saved) {
          setPageSaveStatus("error");
          setPageSceneError("Could not save this page background to project files. Check the development server and try again.");
          return;
        }
        pendingPageSaveRef.current = null;
        registerMagneticPagePath(pending.path);
        setPageSaveStatus("saved");
        setPageSceneError("");
      }).catch((error: unknown) => {
        if (pendingPageSaveRef.current !== pending) return;
        console.error(`Could not save the ${pending.path} background to project files.`, error);
        setPageSaveStatus("error");
        setPageSceneError("Could not save this page background to project files. Check the development server and try again.");
      });
    }, 400);
    pageSaveTimeoutRef.current = timeout;
    return () => {
      window.clearTimeout(timeout);
      if (pageSaveTimeoutRef.current === timeout) pageSaveTimeoutRef.current = null;
    };
  }, [config, pagePath, storageLoaded]);
  useEffect(() => {
    const refreshPagePaths = () => {
      const allPaths = Array.from(new Set([...BUILT_IN_PAGE_PATHS, ...discoveredPagePathsRef.current]));
      allPaths.sort((left, right) => left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right));
      setPagePaths(allPaths);
    };
    let active = true;
    void fetch("/api/magnetic-pages", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Page discovery returned ${response.status}.`);
        const result: unknown = await response.json();
        if (
          !result ||
          typeof result !== "object" ||
          !("paths" in result) ||
          !Array.isArray(result.paths) ||
          !result.paths.every((path): path is string => typeof path === "string")
        ) {
          throw new Error("Page discovery returned an invalid route list.");
        }
        return result.paths;
      })
      .then((paths) => {
        if (!active) return;
        discoveredPagePathsRef.current = paths;
        const allPaths = Array.from(new Set([...BUILT_IN_PAGE_PATHS, ...paths]));
        allPaths.sort((left, right) => left === "/" ? -1 : right === "/" ? 1 : left.localeCompare(right));
        setPagePaths(allPaths);
      })
      .catch((error: unknown) => {
        if (active) console.error("Could not discover app pages for the magnetic editor.", error);
      });
    window.addEventListener(SCENE_CHANGE_EVENT, refreshPagePaths);
    window.addEventListener("storage", refreshPagePaths);
    return () => {
      active = false;
      window.removeEventListener(SCENE_CHANGE_EVENT, refreshPagePaths);
      window.removeEventListener("storage", refreshPagePaths);
    };
  }, []);

  // Poll the live target registry for the Targets panel (cheap, dev-tool only).
  useEffect(() => {
    if (editorMode !== "magnetic") return;
    const id = setInterval(() => {
      const nextSnapshots = getAllTargetSnapshots();
      setTargetSnapshots((currentSnapshots) => {
        const unchanged = currentSnapshots.length === nextSnapshots.length &&
          currentSnapshots.every((current, index) => {
            const next = nextSnapshots[index];
            return current.id === next.id &&
              current.active === next.active &&
              current.visible === next.visible &&
              current.magnetic === next.magnetic &&
              current.priority === next.priority &&
              current.rect?.left === next.rect?.left &&
              current.rect?.top === next.rect?.top &&
              current.rect?.right === next.rect?.right &&
              current.rect?.bottom === next.rect?.bottom;
          });
        return unchanged ? currentSnapshots : nextSnapshots;
      });
    }, 300);
    return () => clearInterval(id);
  }, [editorMode]);

  // Keyboard undo/redo, skipped while typing in a text field so native text-undo still works.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextEditing = tag === "TEXTAREA" || (tag === "INPUT" && (e.target as HTMLInputElement).type === "text");
      if (isTextEditing) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) {
        redoHistory();
      } else {
        undoHistory();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- commit helpers -----------------------------------------------------

  function undoHistory() {
    const previous = history.undo(configRef.current);
    if (previous !== null) setConfig(previous);
  }
  function redoHistory() {
    const next = history.redo(configRef.current);
    if (next !== null) setConfig(next);
  }

  /** For discrete, single-shot changes (toggles, dropdowns, buttons): always exactly one undo step. */
  function commitDiscrete(updater: (c: MagneticLinesSceneConfig) => MagneticLinesSceneConfig) {
    const next = updater(config);
    if (next === config) return;
    history.commit(config);
    setConfig(next);
  }

  /** For continuous interactions (sliders, drags, text edits): call at interaction start... */
  function captureBeforeChange() {
    if (pendingBeforeRef.current === null) pendingBeforeRef.current = config;
  }
  /** ...live-apply values here (no history writes)... */
  function liveUpdate(updater: (c: MagneticLinesSceneConfig) => MagneticLinesSceneConfig) {
    setConfig(updater);
  }
  /** ...and push exactly one history entry when the interaction ends. */
  function commitPending() {
    if (groupCommitTimerRef.current !== null) {
      clearTimeout(groupCommitTimerRef.current);
      groupCommitTimerRef.current = null;
    }
    if (groupBeforeRef.current !== null) {
      history.commit(groupBeforeRef.current);
      groupBeforeRef.current = null;
      pendingBeforeRef.current = null;
    } else if (pendingBeforeRef.current !== null) {
      history.commit(pendingBeforeRef.current);
      pendingBeforeRef.current = null;
    }
  }
  function beginGroupChange() {
    if (groupBeforeRef.current === null) groupBeforeRef.current = config;
  }
  function scheduleGroupCommit() {
    if (groupCommitTimerRef.current !== null) clearTimeout(groupCommitTimerRef.current);
    groupCommitTimerRef.current = setTimeout(() => {
      groupCommitTimerRef.current = null;
      commitPending();
    }, 160);
  }

  function markLineOverrides(before: MagneticLineConfig, after: MagneticLineConfig): MagneticLineConfig {
    return {
      ...after,
      inherit: {
        appearance: before.appearance === after.appearance ? after.inherit.appearance : false,
        shape: before.shape === after.shape ? after.inherit.shape : false,
        motion: before.motion === after.motion ? after.inherit.motion : false,
        anchorMotion: before.anchorMotion === after.anchorMotion ? after.inherit.anchorMotion : false,
        magnet: before.magnet === after.magnet ? after.inherit.magnet : false,
        glow: before.glow === after.glow ? after.inherit.glow : false,
        outerGlow: before.outerGlow === after.outerGlow ? after.inherit.outerGlow : false,
        texture: before.texture === after.texture ? after.inherit.texture : false,
        flow: before.flow === after.flow ? after.inherit.flow : false,
        cursorInfluence: before.cursorInfluence === after.cursorInfluence ? after.inherit.cursorInfluence : false,
        lineInteraction: before.lineInteraction === after.lineInteraction ? after.inherit.lineInteraction : false,
        constraint: before.constraint === after.constraint ? after.inherit.constraint : false,
        occlusion: before.occlusion === after.occlusion ? after.inherit.occlusion : false,
      },
    };
  }

  function applyLineUpdate(line: MagneticLineConfig, global: MagneticLinesSceneConfig["global"], updater: (line: MagneticLineConfig) => MagneticLineConfig) {
    const resolved = resolveLineConfig(line, global);
    return markLineOverrides(resolved, updater(resolved));
  }
  function updateLineLive(id: string, updater: (l: MagneticLineConfig) => MagneticLineConfig) {
    liveUpdate((c) => ({ ...c, lines: c.lines.map((l) => (l.id === id ? applyLineUpdate(l, c.global, updater) : l)) }));
  }
  function updateLineDiscrete(id: string, updater: (l: MagneticLineConfig) => MagneticLineConfig) {
    commitDiscrete((c) => ({ ...c, lines: c.lines.map((l) => (l.id === id ? applyLineUpdate(l, c.global, updater) : l)) }));
  }
  function enableLineBending(id: string) {
    updateLineDiscrete(id, (line) => ({ ...line, shape: { ...line.shape, bendable: true } }));
    setTimelinePreviewPlaying(true);
  }

  const selectedLine = useMemo(() => { const line = config.lines.find((l) => l.id === selectedLineId); return line ? resolveLineConfig(line, config.global) : null; }, [config.lines, config.global, selectedLineId]);
  const layerStack = config.lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.appearance.zIndex - b.line.appearance.zIndex || a.index - b.index)
    .map(({ line }) => line);
  const selectedLayerIndex = layerStack.findIndex((line) => line.id === selectedLineId);
  const gravityPointOptions = selectedLine
    ? selectedLine.geometrySource === "path"
      ? selectedLine.customPath.points.map((point, index, points) => ({
        id: index === 0 ? "start" : index === points.length - 1 ? "end" : point.id,
        label: index === 0 ? "Start" : index === points.length - 1 ? "End" : `Point ${index + 1}`,
      }))
      : [{ id: "start", label: "Start" }, { id: "end", label: "End" }]
    : [];
  const selectedLineHasClosedPath = !!selectedLine &&
    selectedLine.geometrySource === "path" &&
    selectedLine.customPath.points.length > 2 &&
    !selectedLine.customPath.points.some((point) => point.moveTo) &&
    selectedLine.customPath.points[0].x === selectedLine.customPath.points[selectedLine.customPath.points.length - 1].x &&
    selectedLine.customPath.points[0].y === selectedLine.customPath.points[selectedLine.customPath.points.length - 1].y;
  const selectedPathPoint = selectedLine?.customPath.points.find((point) => point.id === selectedPathPointId);
  const selectedPathPointIndex = selectedPathPoint && selectedLine
    ? selectedLine.customPath.points.indexOf(selectedPathPoint)
    : -1;
  const selectedAnchorPointIdsForLine = selectedAnchorPointIds.filter((id) =>
    selectedLine?.anchorPoints.some((point) => point.id === id));
  const selectedAnchorPointIdForLine = selectedAnchorPointId &&
    selectedLine?.anchorPoints.some((point) => point.id === selectedAnchorPointId)
    ? selectedAnchorPointId
    : selectedAnchorPointIdsForLine[0] ?? null;
  const firstSelectedAnchorPoint = selectedLine?.anchorPoints.find((point) => selectedAnchorPointIdsForLine.includes(point.id));
  const allAnchorPointDetailsExpanded = !!selectedLine && selectedLine.anchorPoints.length > 0 &&
    selectedLine.anchorPoints.every((point) => expandedAnchorPointIds.includes(point.id));
  const anchorTargets = selectedLine ? getAnchorTargets(selectedLine) : [];
  const shapeAnchorTracks = selectedLine?.geometrySource === "path"
    ? anchorTargets.map((target) => ({
      ...target,
      points: selectedLine.anchorPoints
        .filter((point) => point.endpoint === "path" && target.pathPointIds?.includes(point.pathPointId ?? ""))
        .sort((left, right) => left.order - right.order),
    }))
    : [];
  const lineAnchorTracks = selectedLine?.geometrySource === "shape"
    ? anchorTargets.map((target) => ({
      ...target,
      points: selectedLine.anchorPoints
        .filter((point) => point.endpoint === target.endpoint)
        .sort((left, right) => left.order - right.order),
    }))
    : [];
  const timelineAnchorTracks = selectedLine?.geometrySource === "path" ? shapeAnchorTracks : lineAnchorTracks;
  const visibleShapeAnchorTracks = showAllShapeTracks
    ? shapeAnchorTracks
    : shapeAnchorTracks.filter((track) => track.points.length > 0);
  const visibleTimelineTracks = selectedLine?.geometrySource === "path" ? visibleShapeAnchorTracks : timelineAnchorTracks;
  const animatedTimelineTrackCount = timelineAnchorTracks.filter((track) => track.points.length > 0).length;
  const timelineStepCount = timelineAnchorTracks.reduce((count, track) => Math.max(count, track.points.length), 0);
  const selectedTimelineStepIndices = [...new Set(timelineAnchorTracks.flatMap((track) =>
    track.points
      .map((point, index) => selectedAnchorPointIdsForLine.includes(point.id) ? index : -1)
      .filter((index) => index >= 0)))];
  const canvasFocusedTracks = focusCanvasOnSelection
    ? selectedAnchorPointIdsForLine.length > 0
      ? shapeAnchorTracks.filter((track) => track.points.some((point) => selectedAnchorPointIdsForLine.includes(point.id)))
      : selectedShapeTrackValues.length > 0
        ? shapeAnchorTracks.filter((track) => selectedShapeTrackValues.includes(track.value))
        : null
    : null;
  const canvasFocusedPointIds = focusCanvasOnSelection && selectedAnchorPointIdsForLine.length > 0
    ? new Set(shapeAnchorTracks.flatMap((track) => {
      const selectedIndices = track.points
        .map((point, index) => selectedAnchorPointIdsForLine.includes(point.id) ? index : -1)
        .filter((index) => index >= 0);
      return selectedIndices.flatMap((index) => [track.points[index - 1]?.id, track.points[index]?.id, track.points[index + 1]?.id])
        .filter((id): id is string => !!id);
    }))
    : null;
  const focusedEditablePointIds = focusCanvasOnSelection && selectedAnchorPointIdsForLine.length > 0
    ? selectedAnchorPointIdsForLine
    : canvasFocusedTracks?.flatMap((track) => track.points.map((point) => point.id));
  const canvasVisibleTracks = shapeAnchorTracks.filter((track) => !hiddenCanvasShapeTrackValues.includes(track.value));
  const canvasPathPointIds = canvasVisibleTracks
    .filter((track) => !canvasFocusedTracks || canvasFocusedTracks.some((focused) => focused.value === track.value))
    .filter((track) => !canvasFocusedPointIds || track.points.some((point) => canvasFocusedPointIds.has(point.id)))
    .flatMap((track) => track.pathPointIds ?? (track.pathPointId ? [track.pathPointId] : []));
  const canvasVisibleAnchorPointIds = canvasVisibleTracks
    .filter((track) => !canvasFocusedTracks || canvasFocusedTracks.some((focused) => focused.value === track.value))
    .flatMap((track) => track.points
      .filter((_, index) => !hiddenCanvasStepIndices.includes(index))
      .filter((point) => !canvasFocusedPointIds || canvasFocusedPointIds.has(point.id))
      .map((point) => point.id));
  const effectiveAnchorTargetToAdd = anchorTargets.some((target) => target.value === anchorTargetToAdd)
    ? anchorTargetToAdd
    : anchorTargets[0]?.value ?? "";
  const selectedGroup = useMemo(() => config.groups.find((group) => group.id === selectedGroupId) ?? null, [config.groups, selectedGroupId]);
  const isLineEditing = panel === "editor" && !!selectedLine && (geometryExpanded || anchorPointsExpanded);
  const previewAspectRatio = previewViewport.width / Math.max(1, previewViewport.height);
  const animationPreviewWidth = Math.min(260, 132 * previewAspectRatio);
  const animationPreviewConfig = useMemo(() => selectedLine ? ({
    ...config,
    animation: { ...config.animation, playing: true },
    lines: config.lines.map((line) => line.id === selectedLine.id ? { ...line, enabled: true, visible: true } : line),
  }) : null, [config, selectedLine]);
  const timelinePreviewConfig = useMemo(() => selectedLine
    ? { ...config, animation: { ...config.animation, playing: timelinePreviewPlaying } }
    : config, [config, selectedLine, timelinePreviewPlaying]);

  function selectLineForEditing(id: string | null) {
    setSelectedGroupId(null);
    setLinesToGroup([]);
    setIsRenamingGroup(false);
    setIsRenamingLine(false);
    setLineRenameError(null);
    setSelectedLineId(id);
    setGlobalTargetLineId(id);
    setSelectedPathPointId(null);
    setSelectedAnchorPointId(null);
    setSelectedAnchorPointIds([]);
    setSelectedShapeTrackValues([]);
    setAnchorTargetToAdd("start");
  }

  function selectGroupForEditing(groupId: string) {
    setSelectedGroupId(groupId);
    setLinesToGroup([]);
    setIsRenamingGroup(false);
    setGroupRenameError(null);
    setSelectedLineId(null);
    setGlobalTargetLineId(`group:${groupId}`);
    setSelectedPathPointId(null);
    setSelectedAnchorPointId(null);
    setSelectedAnchorPointIds([]);
    setIsRenamingLine(false);
  }

  function startRenamingLine(lineId: string, location: "layer" | "inspector") {
    selectLineForEditing(lineId);
    setLineRenameLocation(location);
    setLineNameDraft(lineId);
    setLineRenameError(null);
    setIsRenamingLine(true);
  }

  function cancelRenamingSelectedLine() {
    setIsRenamingLine(false);
    setLineRenameError(null);
  }

  function renameSelectedLine() {
    if (!selectedLine) return;
    const nextId = lineNameDraft.trim();
    if (!nextId) {
      setLineRenameError("Line name cannot be empty.");
      return;
    }
    if (nextId === selectedLine.id) {
      cancelRenamingSelectedLine();
      return;
    }
    if (config.lines.some((line) => line.id === nextId)) {
      setLineRenameError("A line with that name already exists.");
      return;
    }
    const previousId = selectedLine.id;
    commitDiscrete((current) => ({
      ...current,
      lines: current.lines.map((line) => line.id === previousId ? { ...line, id: nextId } : line),
      groups: current.groups.map((group) => ({ ...group, lineIds: group.lineIds.map((id) => id === previousId ? nextId : id) })),
    }));
    setSelectedLineId(nextId);
    setGlobalTargetLineId(nextId);
    setSoloLineId((id) => id === previousId ? nextId : id);
    setLinesToGroup((ids) => ids.map((id) => id === previousId ? nextId : id));
    cancelRenamingSelectedLine();
  }

  function startRenamingGroup(group: MagneticLineGroup, location: "layer" | "inspector") {
    selectGroupForEditing(group.id);
    setGroupRenameLocation(location);
    setGroupNameDraft(group.name);
    setGroupRenameError(null);
    setIsRenamingGroup(true);
  }
  function cancelRenamingGroup() {
    setIsRenamingGroup(false);
    setGroupRenameError(null);
  }
  function renameSelectedGroup() {
    if (!selectedGroup) return;
    const name = groupNameDraft.trim();
    if (!name) {
      setGroupRenameError("Group name cannot be empty.");
      return;
    }
    if (config.groups.some((group) => group.id !== selectedGroup.id && group.name.toLowerCase() === name.toLowerCase())) {
      setGroupRenameError("A group with that name already exists.");
      return;
    }
    commitDiscrete((current) => ({
      ...current,
      groups: current.groups.map((group) => group.id === selectedGroup.id ? { ...group, name } : group),
    }));
    cancelRenamingGroup();
  }

  // ---- line list actions ----------------------------------------------------

  function addLine() {
    commitDiscrete((c) => {
      const l = makeBlankLine();
      selectLineForEditing(l.id);
      return { ...c, lines: [...c.lines, l] };
    });
  }
  function duplicateLines(lineIds: string[]) {
    const ids = new Set(lineIds);
    const sources = config.lines.filter((line) => ids.has(line.id));
    if (sources.length === 0) return;
    let copies: MagneticLineConfig[] = [];
    commitDiscrete((c) => {
      copies = sources.map((line) => duplicateLine(line));
      const lastSourceIndex = Math.max(...c.lines.map((line, index) => ids.has(line.id) ? index : -1));
      const lines = [...c.lines];
      lines.splice(lastSourceIndex + 1, 0, ...copies);
      return { ...c, lines };
    });
    const copyIds = copies.map((line) => line.id);
    selectLineForEditing(copyIds[copyIds.length - 1] ?? null);
    setLinesToGroup(copyIds);
  }
  function deleteLines(lineIds: string[]) {
    const ids = new Set(lineIds);
    if (ids.size === 0) return;
    let nextSelection: string | null = null;
    commitDiscrete((c) => {
      const remaining = c.lines.filter((line) => !ids.has(line.id));
      nextSelection = remaining[0]?.id ?? null;
      return {
        ...c,
        lines: remaining,
        groups: c.groups
          .map((group) => ({ ...group, lineIds: group.lineIds.filter((id) => !ids.has(id)) }))
          .filter((group) => group.lineIds.length >= 2),
      };
    });
    selectLineForEditing(nextSelection);
  }
  function duplicateGroup(groupId: string) {
    const sourceGroup = config.groups.find((group) => group.id === groupId);
    if (!sourceGroup) return;
    const sources = config.lines.filter((line) => sourceGroup.lineIds.includes(line.id));
    if (sources.length < 2) return;
    const copies = sources.map((line) => duplicateLine(line));
    const baseId = `${sourceGroup.id}-copy`;
    let copyGroupId = baseId;
    let suffix = 2;
    while (config.groups.some((group) => group.id === copyGroupId)) copyGroupId = `${baseId}-${suffix++}`;
    const copyGroup: MagneticLineGroup = {
      id: copyGroupId,
      name: `${sourceGroup.name} copy`,
      lineIds: copies.map((line) => line.id),
      scale: 1,
      rotation: 0,
    };
    commitDiscrete((current) => {
      const sourceIds = new Set(sourceGroup.lineIds);
      const lastSourceIndex = Math.max(...current.lines.map((line, index) => sourceIds.has(line.id) ? index : -1));
      const lines = [...current.lines];
      lines.splice(lastSourceIndex + 1, 0, ...copies);
      return { ...current, lines, groups: [...current.groups, copyGroup] };
    });
    selectGroupForEditing(copyGroup.id);
  }
  function deleteGroup(groupId: string) {
    const group = config.groups.find((item) => item.id === groupId);
    if (!group) return;
    const memberIds = new Set(group.lineIds);
    let nextSelection: string | null = null;
    commitDiscrete((current) => {
      const lines = current.lines.filter((line) => !memberIds.has(line.id));
      nextSelection = lines[0]?.id ?? null;
      return {
        ...current,
        lines,
        groups: current.groups.filter((item) => item.id !== groupId),
      };
    });
    selectLineForEditing(nextSelection);
  }
  function reorderLayerBlock(lineIds: string[], targetLineId: string, placement: "before" | "after" = "before") {
    const movedIds = new Set(lineIds);
    if (movedIds.has(targetLineId) || movedIds.size === 0) return;
    commitDiscrete((c) => {
      const ordered = c.lines
        .map((line, index) => ({ line, index }))
        .sort((a, b) => a.line.appearance.zIndex - b.line.appearance.zIndex || a.index - b.index)
        .map(({ line }) => line);
      const moving = ordered.filter((line) => movedIds.has(line.id));
      const remaining = ordered.filter((line) => !movedIds.has(line.id));
      const foundTargetIndex = remaining.findIndex((line) => line.id === targetLineId);
      if (foundTargetIndex < 0 || moving.length === 0) return c;
      const targetIndex = placement === "after" ? foundTargetIndex + 1 : foundTargetIndex;
      const reordered = [...remaining.slice(0, targetIndex), ...moving, ...remaining.slice(targetIndex)];
      if (reordered.every((line, index) => line.id === ordered[index].id)) return c;
      const zIndexById = new Map(reordered.map((line, index) => [line.id, index]));
      return {
        ...c,
        lines: c.lines.map((line) => {
          const zIndex = zIndexById.get(line.id);
          return zIndex === undefined || zIndex === line.appearance.zIndex
            ? line
            : { ...line, appearance: { ...line.appearance, zIndex } };
        }),
      };
    });
  }
  function moveSelectedLayer(direction: "back" | "forward" | "bottom" | "top") {
    if (!selectedLineId || selectedLayerIndex < 0) return;
    if (direction === "bottom") {
      if (selectedLayerIndex > 0) reorderLayerBlock([selectedLineId], layerStack[0].id);
      return;
    }
    if (direction === "top") {
      if (selectedLayerIndex < layerStack.length - 1) {
        reorderLayerBlock([selectedLineId], layerStack[layerStack.length - 1].id, "after");
      }
      return;
    }
    const targetIndex = selectedLayerIndex + (direction === "forward" ? 1 : -1);
    if (targetIndex >= 0 && targetIndex < layerStack.length) {
      reorderLayerBlock(
        [selectedLineId],
        layerStack[targetIndex].id,
        direction === "forward" ? "after" : "before",
      );
    }
  }
  function startLayerDrag(lineIds: string[], event: React.DragEvent<HTMLElement>) {
    const ids = lineIds.filter((id) => config.lines.some((line) => line.id === id));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", ids.join("\n"));
  }
  function handleLayerDrop(targetLineId: string, event: React.DragEvent<HTMLElement>) {
    event.preventDefault();
    const draggedIds = event.dataTransfer.getData("text/plain").split("\n").filter(Boolean);
    reorderLayerBlock(draggedIds, targetLineId);
    setDragOverLineId(null);
  }
  function toggleLineForGrouping(lineId: string) {
    setLinesToGroup((current) => current.includes(lineId) ? current.filter((id) => id !== lineId) : [...current, lineId]);
  }
  function groupSelectedLines() {
    const lineIds = linesToGroup.filter((id) => config.lines.some((line) => line.id === id && !config.groups.some((group) => group.lineIds.includes(id))));
    if (lineIds.length < 2) return;
    const group: MagneticLineGroup = {
      id: `group-${Date.now().toString(36)}`,
      name: `Group ${config.groups.length + 1}`,
      lineIds,
      scale: 1,
      rotation: 0,
    };
    commitDiscrete((current) => ({ ...current, groups: [...current.groups, group] }));
    setLinesToGroup([]);
    selectGroupForEditing(group.id);
  }
  function ungroupLines(groupId: string) {
    commitDiscrete((current) => ({ ...current, groups: current.groups.filter((group) => group.id !== groupId) }));
    setSelectedGroupId(null);
    setGlobalTargetLineId(null);
  }
  function transformGroup(groupId: string, scale: number, rotation: number, offset: Point = { x: 0, y: 0 }, centerOverride?: Point, scaleX?: number, scaleY?: number) {
    const group = config.groups.find((item) => item.id === groupId);
    if (!group) return;
    if (groupBeforeRef.current === null) groupBeforeRef.current = config;
    liveUpdate((current) => {
      const group = current.groups.find((item) => item.id === groupId);
      if (!group) return current;
      const members = current.lines.filter((line) => group.lineIds.includes(line.id));
      const points = members.flatMap((line) => [line.from, line.to, ...line.anchorPoints, ...line.customPath.points]);
      if (points.length === 0) return current;
      const center = centerOverride ?? points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
      const scaleFactor = scale / group.scale;
      const rotationDelta = rotation - group.rotation;
      const nextScaleX = scaleX ?? (group.scaleX ?? 1) * scaleFactor;
      const nextScaleY = scaleY ?? (group.scaleY ?? 1) * scaleFactor;
      const scaleXFactor = nextScaleX / (group.scaleX ?? 1);
      const scaleYFactor = nextScaleY / (group.scaleY ?? 1);
      const transformedMembers = members.map((line) => {
        const transformedLine = transformLineGeometry(line, center, scaleXFactor, scaleYFactor, rotationDelta, offset);
        const lineTransform = line.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
        return {
          ...transformedLine,
          lineTransform: {
            scaleX: lineTransform.scaleX * scaleXFactor,
            scaleY: lineTransform.scaleY * scaleYFactor,
            rotation: lineTransform.rotation + rotationDelta,
          },
        };
      });
      const fittedGroup = fitLineGeometriesToFrame(transformedMembers);
      const fittedById = new Map(fittedGroup.lines.map((line) => [line.id, line]));
      return {
        ...current,
        groups: current.groups.map((item) => item.id === groupId
          ? {
            ...item,
            scale: scale * fittedGroup.scale,
            rotation,
            scaleX: nextScaleX * fittedGroup.scale,
            scaleY: nextScaleY * fittedGroup.scale,
          }
          : item),
        lines: current.lines.map((line) => fittedById.get(line.id) ?? line),
      };
    });
    scheduleGroupCommit();
  }
  function transformSelectedLine(scaleX: number, scaleY: number, rotation: number, offset: Point = { x: 0, y: 0 }, centerOverride?: Point) {
    if (!selectedLine) return;
    const previous = selectedLine.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
    const points = [selectedLine.from, selectedLine.to, ...selectedLine.anchorPoints, ...selectedLine.customPath.points];
    if (points.length === 0) return;
    const center = centerOverride ?? points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    const scaleXFactor = Math.abs(previous.scaleX) > 0.0001 ? scaleX / previous.scaleX : 1;
    const scaleYFactor = Math.abs(previous.scaleY) > 0.0001 ? scaleY / previous.scaleY : 1;
    const rotationDelta = rotation - previous.rotation;
    const transformed = {
      ...transformLineGeometry(selectedLine, center, scaleXFactor, scaleYFactor, rotationDelta, offset),
      lineTransform: { scaleX, scaleY, rotation },
    };
    const fitted = fitLineGeometriesToFrame([transformed]).lines[0];
    if (!fitted) return;
    updateLineLive(selectedLine.id, (line) => ({
      ...line,
      ...fitted,
    }));
  }
  function dragSelectedLine(lineId: string, delta: Point) {
    updateLineLive(lineId, (line) =>
      fitLineGeometriesToFrame([transformLineGeometry(line, line.from, 1, 1, 0, delta)]).lines[0] ?? line,
    );
  }
  function flipSelectedLine(axis: "horizontal" | "vertical") {
    if (!selectedLine) return;
    const transform = selectedLine.lineTransform ?? { scaleX: 1, scaleY: 1, rotation: 0 };
    captureBeforeChange();
    transformSelectedLine(axis === "horizontal" ? -transform.scaleX : transform.scaleX, axis === "vertical" ? -transform.scaleY : transform.scaleY, transform.rotation);
    commitPending();
  }
  function flipSelectedGroup(axis: "horizontal" | "vertical") {
    if (!selectedGroup) return;
    const scaleX = selectedGroup.scaleX ?? 1;
    const scaleY = selectedGroup.scaleY ?? 1;
    beginGroupChange();
    transformGroup(selectedGroup.id, selectedGroup.scale, selectedGroup.rotation, { x: 0, y: 0 }, undefined, axis === "horizontal" ? -scaleX : scaleX, axis === "vertical" ? -scaleY : scaleY);
    commitPending();
  }
  function saveSelectedLineShape() {
    if (!selectedLine) return;
    const name = lineShapeName.trim();
    if (!name) {
      setLineShapeError("Enter a name for this saved shape.");
      return;
    }
    const sourcePath = selectedLine.geometrySource === "path" && selectedLine.customPath.points.length >= 2
      ? selectedLine.customPath
      : { points: [
          { id: "shape-start", ...selectedLine.from },
          { id: "shape-end", ...selectedLine.to },
        ] };
    const bounds = sourcePath.points.reduce((result, point) => ({
      left: Math.min(result.left, point.x),
      right: Math.max(result.right, point.x),
      top: Math.min(result.top, point.y),
      bottom: Math.max(result.bottom, point.y),
    }), { left: 1, right: 0, top: 1, bottom: 0 });
    const width = bounds.right - bounds.left;
    const height = bounds.bottom - bounds.top;
    const customPath = { points: sourcePath.points.map((point) => ({
      ...point,
      x: width > 0.0001 ? (point.x - bounds.left) / width : 0.5,
      y: height > 0.0001 ? (point.y - bounds.top) / height : 0.5,
    })) };
    if (!saveReusableLineShape(name, { customPath, shape: selectedLine.shape })) {
      setLineShapeError("Could not save this shape. Check browser storage availability.");
      return;
    }
    setSavedLineShapes(listReusableLineShapes());
    setSelectedSavedLineShapeName(name);
    setLineShapeError(null);
  }
  function applySavedLineShape(shape: ReusableLineShape) {
    if (!selectedLine) return;
    const idPrefix = `saved-${Date.now().toString(36)}`;
    const center = { x: (selectedLine.from.x + selectedLine.to.x) / 2, y: (selectedLine.from.y + selectedLine.to.y) / 2 };
    const axis = { x: selectedLine.to.x - selectedLine.from.x, y: selectedLine.to.y - selectedLine.from.y };
    const length = Math.hypot(axis.x, axis.y) || 0.2;
    const direction = { x: axis.x / (Math.hypot(axis.x, axis.y) || 1), y: axis.y / (Math.hypot(axis.x, axis.y) || 1) };
    const normal = { x: -direction.y, y: direction.x };
    updateLineDiscrete(selectedLine.id, (line) => ({
      ...line,
      geometrySource: "path",
      generatedShapePreset: undefined,
      lineTransform: { scaleX: 1, scaleY: 1, rotation: 0 },
      customPath: { ...shape.customPath, points: shape.customPath.points.map((point, index) => ({
        id: `${idPrefix}-${index}`,
        moveTo: point.moveTo,
        x: Math.max(0, Math.min(1, center.x + direction.x * (point.x - 0.5) * length + normal.x * (point.y - 0.5) * length * 0.64)),
        y: Math.max(0, Math.min(1, center.y + direction.y * (point.x - 0.5) * length + normal.y * (point.y - 0.5) * length * 0.64)),
      })) },
      gravity: { ...line.gravity, fixedPointIds: ["start", "end"] },
      shape: { ...shape.shape },
    }));
    setSelectedPathPointId(null);
  }
  function removeSavedLineShape(name: string) {
    if (!deleteReusableLineShape(name)) {
      setLineShapeError("Could not delete the saved shape. Check browser storage availability.");
      return;
    }
    setSavedLineShapes(listReusableLineShapes());
    setSelectedSavedLineShapeName("");
    setLineShapeError(null);
  }
  function resetLineScope(scope: "appearance" | "shape" | "motion" | "magnet" | "glow" | "outerGlow" | "texture" | "flow" | "cursorInfluence" | "lineInteraction" | "constraint" | "occlusion") {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => ({ ...line, inherit: { ...line.inherit, [scope]: true } }));
  }

  function updateLineEndpoint(id: string, which: "from" | "to", axis: "x" | "y", value: number) {
    updateLineLive(id, (line) => {
      const endpoint = which === "from" ? { ...line.from, [axis]: value } : { ...line.to, [axis]: value };
      const updatedLine = which === "from" ? { ...line, from: endpoint } : { ...line, to: endpoint };
      if (line.generatedShapePreset) {
        const points = createGeneratedShapePath(line.generatedShapePreset, updatedLine, previewViewport)
          .map((point, index) => ({ ...point, id: line.customPath.points[index]?.id ?? point.id }));
        return { ...updatedLine, lineTransform: { scaleX: 1, scaleY: 1, rotation: 0 }, customPath: { ...line.customPath, aspectRatio: previewViewport.width / Math.max(1, previewViewport.height), points } };
      }
      const customPath = line.geometrySource === "path" ? { points: line.customPath.points.map((point, index) => {
        const isAnchor = which === "from" ? index === 0 : index === line.customPath.points.length - 1;
        return isAnchor ? { ...point, [axis]: value } : point;
      }) } : line.customPath;
      return { ...updatedLine, customPath };
    });
  }
  function updateLineEndpointPoint(lineId: string, which: "from" | "to", point: { x: number; y: number }) {
    updateLineLive(lineId, (line) => {
      const updatedLine = which === "from" ? { ...line, from: point } : { ...line, to: point };
      if (line.generatedShapePreset) {
        const points = createGeneratedShapePath(line.generatedShapePreset, updatedLine, previewViewport)
          .map((pathPoint, index) => ({ ...pathPoint, id: line.customPath.points[index]?.id ?? pathPoint.id }));
        return { ...updatedLine, lineTransform: { scaleX: 1, scaleY: 1, rotation: 0 }, customPath: { ...line.customPath, aspectRatio: previewViewport.width / Math.max(1, previewViewport.height), points } };
      }
      const customPath = line.geometrySource === "path" ? { points: line.customPath.points.map((item, index) => {
        const isAnchor = which === "from" ? index === 0 : index === line.customPath.points.length - 1;
        return isAnchor ? { ...item, x: point.x, y: point.y } : item;
      }) } : line.customPath;
      return { ...updatedLine, customPath };
    });
  }
  function updatePathPoint(lineId: string, pointId: string, point: { x: number; y: number }) {
    updateLineLive(lineId, (line) => {
      const sourcePoint = customPathPointFromViewport(line, previewViewport, point);
      const currentPoints = line.customPath.points;
      const firstPoint = currentPoints[0];
      const lastPoint = currentPoints[currentPoints.length - 1];
      const isClosedEndpointPair = !!firstPoint && !!lastPoint &&
        firstPoint.id !== lastPoint.id &&
        firstPoint.x === lastPoint.x &&
        firstPoint.y === lastPoint.y &&
        (pointId === firstPoint.id || pointId === lastPoint.id);
      const points = currentPoints.map((item) =>
        item.id === pointId || isClosedEndpointPair && (item.id === firstPoint?.id || item.id === lastPoint?.id)
          ? { ...item, x: sourcePoint.x, y: sourcePoint.y }
          : item);
      const first = points[0];
      const last = points[points.length - 1];
      return {
        ...line,
        generatedShapePreset: undefined,
        from: first && (pointId === first.id || isClosedEndpointPair) ? { x: sourcePoint.x, y: sourcePoint.y } : line.from,
        to: last && (pointId === last.id || isClosedEndpointPair) ? { x: sourcePoint.x, y: sourcePoint.y } : line.to,
        customPath: { ...line.customPath, points },
      };
    });
  }
  function mergePathPoints(lineId: string, draggedPointId: string, nearbyPointId: string) {
    let mergedInto: string | null = null;
    updateLineLive(lineId, (line) => {
      const points = line.customPath.points;
      if (points.length <= 2) return line;
      const draggedIndex = points.findIndex((point) => point.id === draggedPointId);
      const nearbyIndex = points.findIndex((point) => point.id === nearbyPointId);
      if (draggedIndex < 0 || nearbyIndex < 0) return line;

      const firstIndex = Math.min(draggedIndex, nearbyIndex);
      const lastIndex = Math.max(draggedIndex, nearbyIndex);
      if (firstIndex === 0 && lastIndex === points.length - 1) {
        const joinPoint = points[nearbyIndex];
        if (!joinPoint) return line;
        const closedPoints = points.map((point, index) =>
          index === 0 || index === points.length - 1
            ? { ...point, x: joinPoint.x, y: joinPoint.y }
            : point,
        );
        const first = closedPoints[0];
        const last = closedPoints[closedPoints.length - 1];
        if (!first || !last) return line;
        mergedInto = nearbyPointId;
        return {
          ...line,
          generatedShapePreset: undefined,
          from: { x: first.x, y: first.y },
          to: { x: last.x, y: last.y },
          customPath: { ...line.customPath, points: closedPoints },
          anchorPoints: line.anchorPoints.map((point) =>
            point.pathPointId === draggedPointId ? { ...point, pathPointId: nearbyPointId } : point),
        };
      }

      const mergedPoints = mergePathPointSequence(points, draggedPointId, nearbyPointId);
      const first = mergedPoints[0];
      const last = mergedPoints[mergedPoints.length - 1];
      if (!first || !last) return line;
      mergedInto = nearbyPointId;
      const fixedPointIds = [...new Set(line.gravity.fixedPointIds.map((id) => id === draggedPointId ? nearbyPointId : id))];
      return {
        ...line,
        generatedShapePreset: undefined,
        from: { x: first.x, y: first.y },
        to: { x: last.x, y: last.y },
        customPath: { ...line.customPath, points: mergedPoints },
        gravity: {
          ...line.gravity,
          fixedPointIds: fixedPointIds.filter((id) => id === "start" || id === "end" || mergedPoints.some((point) => point.id === id)),
        },
        anchorPoints: line.anchorPoints.map((point) =>
          point.pathPointId === draggedPointId ? { ...point, pathPointId: nearbyPointId } : point),
      };
    });
    if (mergedInto) setSelectedPathPointId(mergedInto);
  }

  function addPathPoint() {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => {
      const points = line.customPath.points;
      let segmentIndex = 0;
      let longest = -1;
      for (let index = 0; index < points.length - 1; index++) {
        if (points[index + 1].moveTo) continue;
        const dx = points[index + 1].x - points[index].x;
        const dy = points[index + 1].y - points[index].y;
        const length = dx * dx + dy * dy;
        if (length > longest) { longest = length; segmentIndex = index; }
      }

      const start = points[segmentIndex];
      const end = points[segmentIndex + 1];
      if (!start || !end) return line;
      const id = `path-point-${Date.now()}-${points.length}`;
      const point: PathPoint = { id, x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      setSelectedPathPointId(id);
      return { ...line, geometrySource: "path", generatedShapePreset: undefined, customPath: { ...line.customPath, points: [...points.slice(0, segmentIndex + 1), point, ...points.slice(segmentIndex + 1)] } };
    });
  }

  function generateShapePreset(preset: GeneratedShapePreset) {
    if (!selectedLine) return;
    const customPath = {
      points: createGeneratedShapePath(preset, selectedLine, previewViewport),
      aspectRatio: previewViewport.width / Math.max(1, previewViewport.height),
    };
    updateLineDiscrete(selectedLine.id, (line) => ({
      ...line,
      geometrySource: "path",
      generatedShapePreset: preset,
      lineTransform: { scaleX: 1, scaleY: 1, rotation: 0 },
      customPath,
      gravity: { ...line.gravity, fixedPointIds: ["start", "end"] },
      anchorPoints: line.anchorPoints.filter((point) => point.endpoint !== "path"),
    }));
    setSelectedPathPointId(null);
    setSelectedAnchorPointId(null);
    setAnchorTargetToAdd("start");
  }

  function deletePathPoint() {
    if (!selectedLine || !selectedPathPointId || selectedLine.customPath.points.length <= 2) return;
    updateLineDiscrete(selectedLine.id, (line) => ({
      ...line,
      generatedShapePreset: undefined,
      customPath: { ...line.customPath, points: line.customPath.points.filter((point) => point.id !== selectedPathPointId) },
      gravity: { ...line.gravity, fixedPointIds: line.gravity.fixedPointIds.filter((id) => id !== selectedPathPointId) },
      anchorPoints: line.anchorPoints.filter((point) => point.pathPointId !== selectedPathPointId),
    }));
    setSelectedPathPointId(null);
    setSelectedAnchorPointId(null);
    setSelectedAnchorPointIds([]);
  }
  function addAnchorPoint(target: string) {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => {
      const pathPointId = target.startsWith("path:") ? target.slice("path:".length) : undefined;
      const endpoint: AnchorPointEndpoint = pathPointId ? "path" : target === "end" ? "end" : "start";
      const pathPoint = pathPointId
        ? getCustomPathPointsInViewport(line, previewViewport).find((point) => point.id === pathPointId)
        : undefined;
      if (endpoint === "path" && !pathPoint) return line;
      const pointId = `anchor-${endpoint}-${Date.now()}-${line.anchorPoints.length}`;
      const existing = line.anchorPoints.filter((point) =>
        point.endpoint === endpoint && (endpoint !== "path" || point.pathPointId === pathPointId));
      const seeded: MagneticLineConfig["anchorPoints"][number] = {
        id: pointId,
        endpoint,
        ...(pathPointId ? { pathPointId } : {}),
        type: "custom",
        enabled: true,
        speed: 1,
        delay: 0,
        order: existing.length,
        loop: true,
        behavior: "loop",
        activation: "always",
        hoverExitBehavior: "continue",
        finishBehavior: "stay",
        clickBehavior: "restart",
        easing: "ease-in-out",
        x: pathPoint
          ? Math.max(0, Math.min(1, pathPoint.x + 0.06))
          : endpoint === "end" ? line.to.x : line.from.x,
        y: pathPoint
          ? Math.max(0, Math.min(1, pathPoint.y - 0.06))
          : endpoint === "end" ? line.to.y : line.from.y,
        radius: 0.12,
        radiusX: 0.16,
        radiusY: 0.1,
        rotation: 0,
        size: 0.16,
      };
      setSelectedAnchorPointId(pointId);
      setSelectedAnchorPointIds([pointId]);
      return { ...line, anchorPoints: [...line.anchorPoints, seeded] };
    });
  }
  function addAnchorPointsToAllShapes() {
    if (!selectedLine || selectedLine.geometrySource !== "path") return;
    const newPointIds: string[] = [];
    updateLineDiscrete(selectedLine.id, (line) => {
      const targets = getAnchorTargets(line);
      const pathPoints = getCustomPathPointsInViewport(line, previewViewport);
      const additions = targets.flatMap((target, targetIndex) => {
        const pathPointId = target.pathPointId;
        if (!pathPointId || line.anchorPoints.some((point) =>
          point.endpoint === "path" && target.pathPointIds?.includes(point.pathPointId ?? ""))) return [];
        const pathPoint = pathPoints.find((point) => point.id === pathPointId);
        if (!pathPoint) return [];
        const pointId = `anchor-path-${Date.now()}-${targetIndex}`;
        newPointIds.push(pointId);
        return [{
          id: pointId,
          endpoint: "path" as const,
          pathPointId,
          type: "custom" as const,
          enabled: true,
          speed: 1,
          delay: 0,
          order: 0,
          loop: true,
          behavior: "loop" as const,
          activation: "always" as const,
          hoverExitBehavior: "continue" as const,
          finishBehavior: "stay" as const,
          clickBehavior: "restart" as const,
          easing: "ease-in-out" as const,
          x: Math.max(0, Math.min(1, pathPoint.x + 0.06)),
          y: Math.max(0, Math.min(1, pathPoint.y - 0.06)),
          radius: 0.12,
          radiusX: 0.16,
          radiusY: 0.1,
          rotation: 0,
          size: 0.16,
        }];
      });
      return additions.length > 0 ? { ...line, anchorPoints: [...line.anchorPoints, ...additions] } : line;
    });
    if (newPointIds.length > 0) {
      setSelectedAnchorPointIds(newPointIds);
      setSelectedAnchorPointId(newPointIds[0] ?? null);
    }
  }
  function addNextAnimationStep() {
    if (!selectedLine) return;
    const newPointIds: string[] = [];
    updateLineDiscrete(selectedLine.id, (line) => {
      const targets = getAnchorTargets(line);
      const pathPoints = getCustomPathPointsInViewport(line, previewViewport);
      const hasAnimatedRoute = line.anchorPoints.some((point) => point.enabled);
      const additions = targets.flatMap((target, targetIndex) => {
        const alreadyAnimated = line.anchorPoints.some((point) =>
          point.endpoint === target.endpoint &&
          (target.endpoint !== "path" || target.pathPointIds?.includes(point.pathPointId ?? "")));
        if (selectedShapeTrackValues.length > 0
          ? !selectedShapeTrackValues.includes(target.value)
          : line.geometrySource === "path"
            ? !alreadyAnimated
            : hasAnimatedRoute && !alreadyAnimated) return [];
        const pathPointId = target.pathPointId;
        const pathPoint = pathPointId
          ? pathPoints.find((point) => point.id === pathPointId)
          : target.endpoint === "start" ? line.from : line.to;
        if (!pathPoint || (target.endpoint === "path" && !pathPointId)) return [];
        const route = line.anchorPoints
          .filter((point) =>
            point.endpoint === target.endpoint &&
            (target.endpoint !== "path" || target.pathPointIds?.includes(point.pathPointId ?? "")))
          .sort((left, right) => left.order - right.order);
        const last = route[route.length - 1];
        const previous = route[route.length - 2];
        const delta = last
          ? {
            x: last.x - (previous?.x ?? pathPoint.x),
            y: last.y - (previous?.y ?? pathPoint.y),
          }
          : { x: 0.06, y: 0 };
        const pointId = `anchor-${target.endpoint}-${Date.now()}-${targetIndex}`;
        newPointIds.push(pointId);
        return [{
          id: pointId,
          endpoint: target.endpoint,
          ...(pathPointId ? { pathPointId } : {}),
          type: "custom" as const,
          enabled: true,
          speed: 1,
          delay: 0,
          order: route.length,
          loop: true,
          behavior: "loop" as const,
          activation: "always" as const,
          hoverExitBehavior: "continue" as const,
          finishBehavior: "stay" as const,
          clickBehavior: "restart" as const,
          easing: "ease-in-out" as const,
          x: Math.max(0, Math.min(1, (last?.x ?? pathPoint.x) + delta.x)),
          y: Math.max(0, Math.min(1, (last?.y ?? pathPoint.y) + delta.y)),
          radius: 0.12,
          radiusX: 0.16,
          radiusY: 0.1,
          rotation: 0,
          size: 0.16,
        }];
      });
      return additions.length > 0 ? { ...line, anchorPoints: [...line.anchorPoints, ...additions] } : line;
    });
    if (newPointIds.length > 0) {
      setSelectedAnchorPointIds(newPointIds);
      setSelectedAnchorPointId(newPointIds[0] ?? null);
      setSelectedShapeTrackValues([]);
    }
  }
  function toggleShapeTrack(targetValue: string) {
    setSelectedShapeTrackValues((values) => values.includes(targetValue)
      ? values.filter((value) => value !== targetValue)
      : [...values, targetValue]);
  }
  function selectTimelineStep(stepIndex: number) {
    const pointIds = timelineAnchorTracks
      .map((track) => track.points[stepIndex]?.id)
      .filter((id): id is string => !!id);
    if (pointIds.length === 0) return;
    const allSelected = pointIds.every((id) => selectedAnchorPointIdsForLine.includes(id));
    const next = allSelected
      ? selectedAnchorPointIdsForLine.filter((id) => !pointIds.includes(id))
      : [...new Set([...selectedAnchorPointIdsForLine, ...pointIds])];
    setSelectedAnchorPointIds(next);
    setSelectedAnchorPointId(next[0] ?? null);
  }
  function selectTimelinePoint(pointId: string) {
    setSelectedAnchorPointIds([pointId]);
    setSelectedAnchorPointId(pointId);
    setSelectedShapeTrackValues([]);
  }
  function seekPreviewToSelectedStepStart() {
    if (!selectedLine || selectedTimelineStepIndices.length !== 1) return;
    anchorPlaybackSeekRequestRef.current += 1;
    setAnchorPlaybackSeek({
      lineId: selectedLine.id,
      stepIndex: selectedTimelineStepIndices[0],
      requestId: anchorPlaybackSeekRequestRef.current,
    });
  }
  function resetSelectedAnchorPointsToPreviousStep() {
    if (!selectedLine || selectedTimelineStepIndices.length !== 1) return;
    const selectedIds = new Set(selectedAnchorPointIdsForLine);
    if (selectedIds.size === 0) return;
    const pathPoints = getCustomPathPointsInViewport(selectedLine, previewViewport);
    updateLineDiscrete(selectedLine.id, (line) => {
      let changed = false;
      const anchorPoints = line.anchorPoints.map((point) => {
        if (!selectedIds.has(point.id)) return point;
        const route = line.anchorPoints
          .filter((routePoint) => routePoint.endpoint === point.endpoint &&
            (point.endpoint !== "path" || routePoint.pathPointId === point.pathPointId))
          .sort((left, right) => left.order - right.order);
        const pointIndex = route.findIndex((routePoint) => routePoint.id === point.id);
        const previousPoint = pointIndex > 0 ? route[pointIndex - 1] : undefined;
        const source = point.endpoint === "path"
          ? pathPoints.find((pathPoint) => pathPoint.id === point.pathPointId)
          : point.endpoint === "start" ? line.from : line.to;
        const position = point.endpoint === "path" ? previousPoint ?? source : source;
        if (!position || (point.x === position.x && point.y === position.y)) return point;
        changed = true;
        return { ...point, x: position.x, y: position.y };
      });
      return changed ? { ...line, anchorPoints } : line;
    });
  }
  function applySelectedAnchorTransform() {
    if (!selectedLine || selectedAnchorPointIdsForLine.length === 0) return;
    const selectedIds = new Set(selectedAnchorPointIdsForLine);
    updateLineDiscrete(selectedLine.id, (line) => {
      const selectedPoints = line.anchorPoints.filter((point) => selectedIds.has(point.id));
      if (selectedPoints.length === 0) return line;
      const center = selectedPoints.reduce((sum, point) => ({ x: sum.x + point.x / selectedPoints.length, y: sum.y + point.y / selectedPoints.length }), { x: 0, y: 0 });
      const angle = anchorTransform.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        ...line,
        anchorPoints: line.anchorPoints.map((point) => {
          if (!selectedIds.has(point.id)) return point;
          if (anchorTransformMode === "same") {
            return {
              ...point,
              x: Math.max(0, Math.min(1, anchorTransform.x)),
              y: Math.max(0, Math.min(1, anchorTransform.y)),
              rotation: angle,
              size: anchorTransform.size,
              radius: anchorTransform.size,
              radiusX: anchorTransform.size,
              radiusY: anchorTransform.size,
            };
          }
          const x = (point.x - center.x) * anchorTransform.scale;
          const y = (point.y - center.y) * anchorTransform.scale;
          return {
            ...point,
            x: Math.max(0, Math.min(1, center.x + x * cos - y * sin + anchorTransform.x)),
            y: Math.max(0, Math.min(1, center.y + x * sin + y * cos + anchorTransform.y)),
            rotation: point.rotation + angle,
            size: Math.max(0, point.size * anchorTransform.scale),
            radius: Math.max(0, point.radius * anchorTransform.scale),
            radiusX: Math.max(0, point.radiusX * anchorTransform.scale),
            radiusY: Math.max(0, point.radiusY * anchorTransform.scale),
          };
        }),
      };
    });
  }
  function removeAnchorPoint(pointId: string) {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => ({ ...line, anchorPoints: line.anchorPoints.filter((point) => point.id !== pointId) }));
    setSelectedAnchorPointId((id) => id === pointId ? null : id);
    setSelectedAnchorPointIds((ids) => ids.filter((id) => id !== pointId));
    setExpandedAnchorPointIds((ids) => ids.filter((id) => id !== pointId));
  }
  function updateAnchorPoint(pointId: string, patch: Partial<MagneticLineConfig["anchorPoints"][number]>) {
    if (!selectedLine) return;
    updateLineLive(selectedLine.id, (line) => ({
      ...line,
      anchorPoints: line.anchorPoints.map((point) => point.id === pointId ? { ...point, ...patch } : point),
    }));
  }
  function updateAnchorPointDiscrete(pointId: string, patch: Partial<MagneticLineConfig["anchorPoints"][number]>) {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => ({
      ...line,
      anchorPoints: line.anchorPoints.map((point) => point.id === pointId ? { ...point, ...patch } : point),
    }));
  }
  function applySelectedAnchorSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLine || selectedAnchorPointIdsForLine.length < 2) return;
    const formData = new FormData(event.currentTarget);
    const readNumber = (name: string, fallback: number, min: number, max: number) => {
      const rawValue = formData.get(name);
      if (typeof rawValue !== "string" || rawValue.trim() === "") return fallback;
      const value = Number(rawValue);
      return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    };
    const settings = {
      speed: readNumber("speed", firstSelectedAnchorPoint?.speed ?? 1, 0.05, 9999999),
      delay: readNumber("delay", firstSelectedAnchorPoint?.delay ?? 0, 0, 9999999),
      order: Math.round(readNumber("order", firstSelectedAnchorPoint?.order ?? 0, 0, 9999999)),
      easing: formData.get("easing") as MagneticLineConfig["anchorPoints"][number]["easing"],
      enabled: formData.get("enabled") === "on",
      type: formData.get("type") as MagneticLineConfig["anchorPoints"][number]["type"],
      activation: formData.get("activation") as MagneticLineConfig["anchorPoints"][number]["activation"],
    };
    const selectedIds = new Set(selectedAnchorPointIdsForLine);
    updateLineDiscrete(selectedLine.id, (line) => {
      let anchorPoints = line.anchorPoints.map((point) => selectedIds.has(point.id)
        ? {
          ...point,
          speed: settings.speed,
          delay: settings.delay,
          easing: settings.easing,
          enabled: settings.enabled,
          type: settings.type,
          activation: settings.activation,
        }
        : point);
      const routes = [
        ...(["start", "end"] as const).map((endpoint) => ({
          endpoint,
          pointIds: anchorPoints.filter((point) => point.endpoint === endpoint).map((point) => point.id),
        })),
        ...getAnchorTargets(line)
          .filter((target) => target.endpoint === "path")
          .map((target) => ({
            endpoint: "path" as const,
            pointIds: anchorPoints
              .filter((point) => point.endpoint === "path" && target.pathPointIds?.includes(point.pathPointId ?? ""))
              .map((point) => point.id),
          })),
      ];
      const orderById = new Map<string, number>();
      for (const route of routes) {
        const routePoints = anchorPoints
          .filter((point) => route.pointIds.includes(point.id))
          .sort((left, right) => left.order - right.order);
        const selected = routePoints.filter((point) => selectedIds.has(point.id));
        if (selected.length === 0) continue;
        const unselected = routePoints.filter((point) => !selectedIds.has(point.id));
        const start = Math.min(unselected.length, settings.order);
        const reordered = [...unselected.slice(0, start), ...selected, ...unselected.slice(start)];
        reordered.forEach((point, index) => orderById.set(point.id, index));
      }
      if (orderById.size > 0) {
        anchorPoints = anchorPoints.map((point) => orderById.has(point.id)
          ? { ...point, order: orderById.get(point.id) ?? point.order }
          : point);
      }
      return { ...line, anchorPoints };
    });
  }
  function updateAnchorPointOrder(pointId: string, requestedOrder: number) {
    if (!selectedLine) return;
    updateLineLive(selectedLine.id, (line) => {
      const current = line.anchorPoints.find((point) => point.id === pointId);
      if (!current) return line;
      const endpointPoints = line.anchorPoints
        .filter((point) => point.endpoint === current.endpoint &&
          (current.endpoint !== "path" || point.pathPointId === current.pathPointId))
        .sort((left, right) => left.order - right.order);
      const nextOrder = Math.max(0, Math.min(endpointPoints.length - 1, Math.round(requestedOrder)));
      const occupyingPoint = endpointPoints.find((point) => point.id !== pointId && point.order === nextOrder);
      if (!occupyingPoint || nextOrder === current.order) return line;
      return {
        ...line,
        anchorPoints: line.anchorPoints.map((point) => {
          if (point.id === current.id) return { ...point, order: nextOrder };
          if (point.id === occupyingPoint.id) return { ...point, order: current.order };
          return point;
        }),
      };
    });
  }
  function updateAnchorPointPosition(lineId: string, pointId: string, point: { x: number; y: number }) {
    updateLineLive(lineId, (line) => ({
      ...line,
      anchorPoints: line.anchorPoints.map((item) => item.id === pointId ? { ...item, x: point.x, y: point.y } : item),
    }));
  }
  function updateSelectedAnchorPointPositions(lineId: string, pointIds: string[], delta: Point) {
    const selectedIds = new Set(pointIds);
    updateLineLive(lineId, (line) => ({
      ...line,
      anchorPoints: line.anchorPoints.map((item) => selectedIds.has(item.id)
        ? { ...item, x: Math.max(0, Math.min(1, item.x + delta.x)), y: Math.max(0, Math.min(1, item.y + delta.y)) }
        : item),
    }));
  }
  function resetSelectedLine() {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (l) => {
      const fresh = makeBlankLine();
      return { ...fresh, id: l.id, from: l.from, to: l.to };
    });
  }

  // ---- global settings actions -----------------------------------------------

  function resetGlobal() {
    commitDiscrete((c) => ({ ...c, global: DEFAULT_GLOBAL }));
  }
  function resetScene() {
    const defaultScene = sanitizeSceneConfig(DEFAULT_SCENE);
    commitDiscrete(() => defaultScene);
    selectLineForEditing(defaultScene.lines[0]?.id || null);
    setSelectedPathPointId(null);
    setSoloLineId(null);
    setPreviewKey((key) => key + 1);
  }

  // ---- targets -----------------------------------------------------------

  function targetConfigFor(id: string): MagneticTargetConfig {
    const snapshot = targetSnapshots.find((target) => target.id === id);
    return config.targets.find((t) => t.id === id) || {
      id,
      name: id,
      enabled: true,
      magnetic: true,
      strength: 1,
      radius: 0,
      priority: snapshot?.priority ?? 0,
      activations: ["hover", "focus", "touch"],
      clickBehavior: "press",
    };
  }
  function updateTarget(id: string, updater: (t: MagneticTargetConfig) => MagneticTargetConfig) {
    commitDiscrete((c) => {
      const exists = c.targets.some((t) => t.id === id);
      const targets = exists
        ? c.targets.map((t) => (t.id === id ? updater(t) : t))
        : [...c.targets, updater(targetConfigFor(id))];
      return { ...c, targets };
    });
  }
  function updateTargetLineTriggers(
    targetId: string,
    lineId: string,
    effect: TargetLineEffect,
    activations: TargetActivation[] | null,
  ) {
    updateTarget(targetId, (target) => {
      const lineTriggers = { ...target.lineTriggers };
      const effects = { ...lineTriggers[lineId] };
      if (activations === null) delete effects[effect];
      else effects[effect] = activations;
      if (Object.keys(effects).length > 0) lineTriggers[lineId] = effects;
      else delete lineTriggers[lineId];
      return {
        ...target,
        lineTriggers: Object.keys(lineTriggers).length > 0 ? lineTriggers : undefined,
      };
    });
  }
  function savePickedTarget() {
    if (!pickedTargetDraft) return;
    const existing = config.targets.find((target) => target.id === pickedTargetDraft.id);
    const target: MagneticTargetConfig = {
      ...(existing ?? {
        enabled: true,
        magnetic: true,
        strength: 1,
        radius: 0,
        priority: 0,
        lineIds: null,
      }),
      id: pickedTargetDraft.id,
      name: pickedTargetDraft.name.trim() || pickedTargetDraft.tagName,
      tagName: pickedTargetDraft.tagName,
      selector: pickedTargetDraft.selector,
      activations: pickedTargetDraft.activations,
      clickBehavior: pickedTargetDraft.clickBehavior,
    };
    commitDiscrete((current) => ({
      ...current,
      targets: existing
        ? current.targets.map((item) => item.id === target.id ? target : item)
        : [...current.targets, target],
    }));
    setSelectedTargetIdState(target.id);
    setPickedTargetDraft(null);
    setTargetDraftError("");
  }
  function startTargetPicking(targetId?: string) {
    setPanel("targets");
    setEnvironmentPathEditing(false);
    setTargetDraftError("");
    setTargetPickTargetId(targetId ?? null);
    if (pagePreviewToken) {
      setTargetPickToken(window.crypto.randomUUID());
      return;
    }
    openPagePreview(true);
  }
  function setTargetLineScope(id: string, lineIds: string[] | null) {
    commitDiscrete((current) => ({
      ...current,
      ...updateTargetLineAssignments(current.targets, current.lines, id, lineIds, current.global),
    }));
  }
  function removePickedTarget(id: string) {
    commitDiscrete((current) => ({
      ...current,
      targets: current.targets.filter((target) => target.id !== id),
      global: current.global.targetId === id ? { ...current.global, targetId: null } : current.global,
      lines: current.lines.map((line) => {
        const effectiveMagnet = resolveLineConfig(line, current.global).magnet;
        return effectiveMagnet.targetId === id
          ? { ...line, inherit: { ...line.inherit, magnet: false }, magnet: { ...effectiveMagnet, targetId: null } }
          : line;
      }),
    }));
  }

  // ---- import / export -----------------------------------------------------

  function applyPreset(name: string) {
    if (name === "About") {
      applyTemplateScene(getPortfolioDefaultScene("/about"));
      return;
    }
    commitDiscrete((scene) => sanitizeSceneConfig(applyScenePreset(scene, name)));
  }

  function applyTemplateScene(scene: MagneticLinesSceneConfig) {
    commitDiscrete(() => sanitizeSceneConfig(scene));
    selectLineForEditing(scene.lines[0]?.id ?? null);
    setSelectedPathPointId(null);
    setSoloLineId(null);
    setShowTemplateLibrary(false);
  }

  async function saveAndOpenTestPage() {
    if (pageActionLoading || !storageLoaded) return;
    setPageActionLoading("save-test");
    setPageSaveStatus("saving");
    try {
      if (!await savePendingPageScene(pagePath, config)) return;
      try {
        window.sessionStorage.setItem(EDITOR_PAGE_PATH_KEY, pagePath);
      } catch {
        // The saved page remains available even when route restoration cannot be persisted.
      }
      router.push(pagePath);
    } finally {
      setPageActionLoading(null);
    }
  }

  async function savePendingPageScene(path = pagePath, scene = config) {
    const pending = pendingPageSaveRef.current;
    setPageSaveStatus("saving");
    if (pending && pending.path !== path) {
      if (!await savePersistedPageScene(pending.path, pending.scene)) {
        setPageSaveStatus("error");
        setPageSceneError("Could not save this page background to project files. Check the development server and try again.");
        return false;
      }
      registerMagneticPagePath(pending.path);
      if (pendingPageSaveRef.current === pending) pendingPageSaveRef.current = null;
    }
    if (pageSaveTimeoutRef.current) window.clearTimeout(pageSaveTimeoutRef.current);
    pageSaveTimeoutRef.current = null;
    if (!await savePersistedPageScene(path, scene)) {
      pendingPageSaveRef.current = { path, scene };
      setPageSaveStatus("error");
      setPageSceneError("Could not save this page background to project files. Check the development server and try again.");
      return false;
    }
    if (pendingPageSaveRef.current?.path === path) pendingPageSaveRef.current = null;
    registerMagneticPagePath(path);
    setPageSaveStatus("saved");
    setPageSceneError("");
    return true;
  }

  function discardPendingPageSave() {
    if (pageSaveTimeoutRef.current) window.clearTimeout(pageSaveTimeoutRef.current);
    pageSaveTimeoutRef.current = null;
    pendingPageSaveRef.current = null;
  }

  async function flushPendingPageSave() {
    const pending = pendingPageSaveRef.current;
    if (pageSaveTimeoutRef.current) window.clearTimeout(pageSaveTimeoutRef.current);
    pageSaveTimeoutRef.current = null;
    if (!pending) return true;
    setPageSaveStatus("saving");
    if (!await savePersistedPageScene(pending.path, pending.scene)) {
      setPageSaveStatus("error");
      setPageSceneError("Could not save this page background to project files. Check the development server and try again.");
      return false;
    }
    if (pendingPageSaveRef.current === pending) pendingPageSaveRef.current = null;
    registerMagneticPagePath(pending.path);
    setPageSaveStatus("saved");
    setPageSceneError("");
    return true;
  }

  async function loadPageForEditing(path: string) {
    if (path !== pagePath && !await flushPendingPageSave()) return;
    const pageScene = loadPersistedPageScene(path);
    const defaultScene = getPortfolioDefaultScene(path);
    const scene = normalizePortfolioPageScene(path, pageScene ?? defaultScene, defaultScene);
    if (pageScene && scene !== pageScene) {
      try {
        if (!await savePersistedPageScene(path, scene)) {
          setPageSceneError("Could not save the updated page background to project files.");
          return;
        }
      } catch (error) {
        console.error("Could not save the updated page background scene.", error);
        setPageSceneError("Could not save the updated page background to project files.");
        return;
      }
    }
    loadedPagePathRef.current = path;
    sceneLoadedIntoEditorRef.current = scene;
    commitPending();
    history.clear();
    setConfig(scene);
    selectLineForEditing(scene.lines[0]?.id ?? null);
    setPagePath(path);
    setPageSaveStatus("idle");
    try {
      window.sessionStorage.setItem(EDITOR_PAGE_PATH_KEY, path);
    } catch {
      // Route restoration is best-effort when session storage is unavailable.
    }
  }

  function openPagePreview(pickTarget = false) {
    if (pagePreviewToken) {
      if (pickTarget) setTargetPickToken(window.crypto.randomUUID());
      return;
    }
    const path = normalizeMagneticPagePath(pagePath);
    if (!path) {
      setPageSceneError("Choose a valid page before opening its preview.");
      return;
    }
    const token = window.crypto.randomUUID();
    if (!savePageScenePreview(path, token, config)) {
      setPageSceneError("The page preview could not start. Check browser storage and try again.");
      return;
    }
    setPagePath(path);
    setPagePreviewToken(token);
    setTargetPickToken(pickTarget ? window.crypto.randomUUID() : null);
    setPageSceneError("");
  }

  function selectTargetForEditing(targetId: string) {
    setSelectedTargetIdState(targetId);
    const target = config.targets.find((item) => item.id === targetId);
    if (target?.selector && !pagePreviewToken) openPagePreview();
  }

  async function clearPageScene() {
    if (pageActionLoading) return;
    setPageActionLoading("clear-page");
    setPageSaveStatus("saving");
    try {
      const path = pagePath;
      if (!await flushPendingPageSave()) return;
      if (!await removePersistedPageScene(path)) {
        setPageSaveStatus("error");
        setPageSceneError("Could not remove this page background from project files. Check the development server and try again.");
        return;
      }
      discardPendingPageSave();
      const scene = getPortfolioDefaultScene(path);
      loadedPagePathRef.current = path;
      sceneLoadedIntoEditorRef.current = scene;
      commitDiscrete(() => scene);
      selectLineForEditing(scene.lines[0]?.id ?? null);
      setPageSaveStatus("saved");
      setPageSceneError("");
    } finally {
      setPageActionLoading(null);
    }
  }

  async function forgetPagePath() {
    if (pageActionLoading) return;
    setPageActionLoading("forget-page");
    setPageSaveStatus("saving");
    try {
      if (!await flushPendingPageSave()) return;
      if (!await removeMagneticPagePath(pagePath)) {
        setPageSaveStatus("error");
        setPageSceneError("Built-in pages cannot be removed from the page list.");
        return;
      }
      discardPendingPageSave();
      const nextPaths = listMagneticPagePaths();
      setPagePaths(nextPaths);
      await loadPageForEditing(nextPaths[0] ?? "/");
    } finally {
      setPageActionLoading(null);
    }
  }

  function closePagePreview() {
    if (pagePreviewToken) removePageScenePreview(pagePreviewToken);
    setPagePreviewToken(null);
    setTargetPickToken(null);
    setTargetPickTargetId(null);
    setPageSceneError("");
  }

  function toggleAllPanels() {
    const collapse = !leftPanelCollapsed || !rightPanelCollapsed;
    setLeftPanelCollapsed(collapse);
    setRightPanelCollapsed(collapse);
  }

  function doExport() {
    setIoError("");
    setImportText(JSON.stringify(config, null, 2));
    setShowIO("export");
  }
  async function copyExport() {
    if (!navigator.clipboard?.writeText) {
      setIoError("Clipboard access is unavailable. Select and copy the JSON below.");
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setIoError("");
    } catch (error) {
      console.error("Could not copy the magnetic-lines configuration.", error);
      setIoError("Could not copy to the clipboard. Select and copy the JSON below.");
    }
  }
  function downloadExport() {
    try {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "magnetic-lines-scene.json";
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIoError("");
    } catch (error) {
      console.error("Could not download the magnetic-lines configuration.", error);
      setIoError("Could not download the configuration. Try copying the JSON instead.");
    }
  }
  function doImport() {
    try {
      const parsed: unknown = JSON.parse(importText);
      const safe = sanitizeSceneConfig(parsed);
      commitDiscrete(() => safe);
      selectLineForEditing(safe.lines[0]?.id || null);
      setIoError("");
      setShowIO(null);
    } catch (error) {
      const details = error instanceof Error ? error.message : "The JSON could not be parsed.";
      setIoError(`Could not import configuration: ${details}`);
    }
  }
  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(typeof reader.result === "string" ? reader.result : "");
      setIoError("");
    };
    reader.onerror = () => {
      console.error("Could not read the magnetic-lines configuration file.", reader.error);
      setIoError("Could not read that file. Try another JSON file or paste its contents.");
    };
    try {
      reader.readAsText(file);
    } catch (error) {
      console.error("Could not read the magnetic-lines configuration file.", error);
      setIoError("Could not read that file. Try another JSON file or paste its contents.");
    }
  }

  const g = config.global;
  const globalAirflowPaths = g.environment.airflowPaths ?? (g.environment.airflowPath.length ? [g.environment.airflowPath] : []);
  const globalEnvironmentLights = getEnvironmentLights(g.environment);
  const updateGlobalLight = (lightId: string, update: Partial<EnvironmentLightConfig>, live = false) => {
    const apply = (current: MagneticLinesSceneConfig): MagneticLinesSceneConfig => {
      const environment = current.global.environment;
      const lights = (environment.lights ?? getEnvironmentLights(environment))
        .map((light) => light.id === lightId ? { ...light, ...update } : light);
      const firstLight = lights[0];
      return {
        ...current,
        global: {
          ...current.global,
          environment: {
            ...environment,
            lights,
            ...(firstLight ? {
              lightColor: firstLight.color,
              lightPosition: firstLight.position,
              lightIntensity: firstLight.intensity,
              lightRadius: firstLight.radius,
            } : {}),
          },
        },
      };
    };
    if (live) liveUpdate(apply);
    else commitDiscrete(apply);
  };
  const magnetTargetIds = Array.from(new Set([...config.targets.map((target) => target.id), ...targetSnapshots.map((target) => target.id)]));
  const targetPanelIds = Array.from(new Set([...config.targets.map((target) => target.id), ...targetSnapshots.map((target) => target.id)]));
  const selectedTargetId = pickedTargetDraft?.id === selectedTargetIdState
    ? pickedTargetDraft.id
    : targetPanelIds.includes(selectedTargetIdState ?? "")
      ? selectedTargetIdState
      : targetPanelIds[0] ?? null;
  const selectedTargetConfig = selectedTargetId && pickedTargetDraft?.id !== selectedTargetId
    ? targetConfigFor(selectedTargetId)
    : null;
  const selectedTargetSelector = pickedTargetDraft?.id === selectedTargetId
    ? pickedTargetDraft.selector
    : selectedTargetConfig?.selector ?? null;
  useEffect(() => {
    if (!pagePreviewToken) return;
    const frame = pagePreviewFrameRef.current;
    if (!frame) return;
    const inspect = () => {
      if (panel !== "targets" || !selectedTargetId || !selectedTargetSelector) {
        frame.contentWindow?.postMessage({
          type: "magnetic-target-inspect-clear",
          previewToken: pagePreviewToken,
        }, window.location.origin);
        return;
      }
      frame.contentWindow?.postMessage({
        type: "magnetic-target-inspect",
        previewToken: pagePreviewToken,
        targetId: selectedTargetId,
        selector: selectedTargetSelector,
      }, window.location.origin);
    };
    frame.addEventListener("load", inspect);
    inspect();
    return () => frame.removeEventListener("load", inspect);
  }, [pagePreviewToken, panel, selectedTargetId, selectedTargetSelector]);
  const selectedGroupLineIds = selectedGroup?.lineIds ?? [];
  const groupOfLine = new Map(config.groups.flatMap((group) => group.lineIds.map((lineId) => [lineId, group] as const)));
  const renderedGroupIds = new Set<string>();

  function renderLineLayer(line: MagneticLineConfig) {
    const group = groupOfLine.get(line.id);
    const isGrouped = !!group;
    const anchorPoints = [...line.anchorPoints].sort((a, b) => a.order - b.order);
    return (
      <div className="ml-layer-entry" key={line.id}>
        <div
          className={`ml-line-row ${globalTargetLineId === line.id ? "selected" : ""} ${selectedGroup?.lineIds.includes(line.id) ? "group-member" : ""} ${linesToGroup.includes(line.id) ? "grouping-selected" : ""} ${dragOverLineId === line.id ? "drop-target" : ""}`}
          draggable
          onDragStart={(event) => startLayerDrag(linesToGroup.includes(line.id) ? linesToGroup : [line.id], event)}
          onDragEnter={() => setDragOverLineId(line.id)}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
          onDragLeave={() => setDragOverLineId((current) => current === line.id ? null : current)}
          onDrop={(event) => handleLayerDrop(line.id, event)}
          onDragEnd={() => setDragOverLineId(null)}
          onContextMenu={(event) => {
            event.preventDefault();
            const lineIds = linesToGroup.includes(line.id) ? linesToGroup : [line.id];
            if (lineIds.length === 1 && !linesToGroup.includes(line.id)) {
              selectLineForEditing(line.id);
              setLinesToGroup(lineIds);
            }
            setLayerContextMenu({ x: event.clientX, y: event.clientY, lineIds, groupId: null });
          }}
          onClick={(e) => {
            if ((e.ctrlKey || e.metaKey || e.shiftKey) && !isGrouped) {
              e.preventDefault();
              toggleLineForGrouping(line.id);
              return;
            }
            selectLineForEditing(line.id);
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey || e.shiftKey) && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              if (!isGrouped) toggleLineForGrouping(line.id);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              selectLineForEditing(line.id);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="ml-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>
          <input
            type="checkbox"
            checked={line.enabled}
            onClick={(e) => e.stopPropagation()}
            onChange={() => updateLineDiscrete(line.id, (current) => ({ ...current, enabled: !current.enabled }))}
            title="Enabled"
          />
          <span className="ml-swatch" style={{ background: line.appearance.color }} />
          {isRenamingLine && lineRenameLocation === "layer" && selectedLineId === line.id ? (
            <form className="ml-layer-rename" onSubmit={(e) => { e.preventDefault(); renameSelectedLine(); }} onClick={(e) => e.stopPropagation()}>
              <input
                autoFocus
                type="text"
                aria-label="Rename line"
                value={lineNameDraft}
                onChange={(e) => { setLineNameDraft(e.target.value); setLineRenameError(null); }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") cancelRenamingSelectedLine(); }}
              />
              <button type="submit" className="ml-icon-btn" aria-label="Save line name">Enter</button>
              {lineRenameError && <small className="ml-error" role="alert">{lineRenameError}</small>}
            </form>
          ) : (
            <span className="ml-line-id" onDoubleClick={(e) => { e.stopPropagation(); startRenamingLine(line.id, "layer"); }}>{line.id}</span>
          )}
          <button
            type="button"
            className={`ml-icon-btn ml-solo-icon ${soloLineId === line.id ? "active" : ""}`}
            title={soloLineId === line.id ? "Exit solo mode" : "Solo this line"}
            aria-label={soloLineId === line.id ? "Exit solo mode" : "Solo this line"}
            aria-pressed={soloLineId === line.id}
            onClick={(e) => { e.stopPropagation(); setSoloLineId((cur) => (cur === line.id ? null : line.id)); }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 14.5 9.5 21.2 12l-6.7 2.5L12 21.2l-2.5-6.7L2.8 12l6.7-2.5L12 2.8Z" /></svg>
          </button>
          <button
            type="button"
            className={`ml-icon-btn ml-visible-icon ${line.visible ? "active" : ""}`}
            title={line.visible ? "Hide line" : "Show line"}
            aria-label={line.visible ? "Hide line" : "Show line"}
            aria-pressed={line.visible}
            onClick={(e) => { e.stopPropagation(); updateLineDiscrete(line.id, (current) => ({ ...current, visible: !current.visible })); }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />
              {line.visible ? <circle cx="12" cy="12" r="2.7" /> : <path d="m4 4 16 16" />}
            </svg>
          </button>
        </div>
        {anchorPoints.length > 0 && (
          <details className="ml-line-anchors">
            <summary onClick={(e) => e.stopPropagation()}>Anchors ({anchorPoints.length})</summary>
            {getAnchorTargets(line).map((target) => {
              const { endpoint } = target;
              const points = anchorPoints.filter((point) =>
                point.endpoint === endpoint &&
                (endpoint !== "path" || target.pathPointIds?.includes(point.pathPointId ?? "")));
              if (points.length === 0) return null;
              return (
                <details className={`ml-line-anchor-endpoint ${endpoint}`} key={target.value}>
                  <summary onClick={(e) => e.stopPropagation()}>{target.label} ({points.length})</summary>
                  {points.map((point) => (
                    <button
                      type="button"
                      key={point.id}
                      className={`ml-layer-anchor-point ${selectedAnchorPointIdsForLine.includes(point.id) ? "selected" : ""}`}
                      onClick={() => {
                        selectLineForEditing(line.id);
                        setSelectedAnchorPointId(point.id);
                        setSelectedAnchorPointIds([point.id]);
                      }}
                    >
                      <span className="ml-anchor-key" />
                      Anchor point {point.order + 1}{point.enabled ? "" : " (disabled)"}
                    </button>
                  ))}
                </details>
              );
            })}
          </details>
        )}
      </div>
    );
  }

  const layerEntries: Array<{ type: "line"; line: MagneticLineConfig } | { type: "group"; group: MagneticLineGroup }> = [];
  for (const line of layerStack) {
    const group = groupOfLine.get(line.id);
    if (!group) {
      layerEntries.push({ type: "line", line });
      continue;
    }
    if (renderedGroupIds.has(group.id)) continue;
    renderedGroupIds.add(group.id);
    layerEntries.push({ type: "group", group });
  }

  return (
    <div className="ml-editor">
      <style>{EDITOR_CSS}</style>

      <div className="ml-toolbar">
        <strong className="ml-title">{editorMode === "cursor" ? "Cursor Effects Editor" : "Magnetic Lines Editor"}</strong>
        <span className="ml-toolbar-spacer" />
        {editorMode === "magnetic" && (
          <button
            type="button"
            className="ml-btn ml-panel-toggle"
            onClick={toggleAllPanels}
            aria-label={leftPanelCollapsed && rightPanelCollapsed ? "Show panels" : "Collapse panels"}
            title={leftPanelCollapsed && rightPanelCollapsed ? "Show panels" : "Collapse panels"}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2" width="13" height="12" rx="1.5" /><path d="M5 2v12M11 2v12" /></svg>
            <span>{leftPanelCollapsed && rightPanelCollapsed ? "Show panels" : "Collapse panels"}</span>
          </button>
        )}
        <button
          type="button"
          className="ml-btn ml-mode-toggle"
          onClick={() => {
            setEnvironmentPathEditing(false);
            setEditorMode((mode) => mode === "magnetic" ? "cursor" : "magnetic");
          }}
          aria-label={editorMode === "magnetic" ? "Open cursor effects editor" : "Return to Magnetic Lines editor"}
          title={editorMode === "magnetic" ? "Open cursor effects editor" : "Return to Magnetic Lines editor"}
        >
          {editorMode === "magnetic" ? "✦ Cursor effects" : "Magnetic Lines"}
        </button>
        {editorMode === "cursor" && <div className="ml-cursor-toolbar-actions" />}
        {editorMode === "magnetic" && (
          <>
            {pagePreviewToken ? (
              <div className="ml-page-preview-toolbar" role="status">
                <span>{targetPickToken ? "Click an element in the preview to pick it" : `Previewing ${pageRouteLabel(pagePath)}`}</span>
                <button className="ml-btn" type="button" onClick={() => startTargetPicking()}>{targetPickToken ? "Picking…" : "Pick target"}</button>
                <button className="ml-btn ml-primary" type="button" onClick={closePagePreview}>Back to editor</button>
              </div>
            ) : (
              <div className="ml-page-controls" aria-label="Page background controls">
                <label className="ml-page-select-wrap">
                  <span className="ml-page-save-status" aria-live="polite">
                    {pageSaveStatus === "saving" ? "Saving…" : pageSaveStatus === "saved" ? "Saved · auto-saves" : pageSaveStatus === "error" ? "Save failed" : "Editing page · auto-saves"}
                  </span>
                  <select
                    className="ml-select ml-page-select"
                    aria-label="Editing page"
                    value={pagePath}
                    disabled={!storageLoaded || pageActionLoading !== null}
                    onChange={(event) => {
                      loadPageForEditing(event.target.value);
                    }}
                  >
                    {pagePaths.map((path) => <option key={path} value={path}>{pageRouteLabel(path)}</option>)}
                  </select>
                </label>
                <button className="ml-btn ml-page-preview-button" type="button" onClick={() => openPagePreview()}>Preview page</button>
              </div>
            )}
            <button
              className="ml-btn ml-primary"
              onClick={saveAndOpenTestPage}
              disabled={!storageLoaded || pageActionLoading !== null}
              aria-busy={pageActionLoading === "save-test" || undefined}
            >
              {pageActionLoading === "save-test" && <span className="ml-btn-spinner" aria-hidden="true" />}
              {pageActionLoading === "save-test" ? "Saving…" : "Save & Test"}
            </button>
            <details className="ml-overflow-menu">
              <summary aria-label="More editor actions" title="More editor actions">⋮</summary>
              <div className="ml-overflow-panel">
                <section className="ml-overflow-section">
                  <strong>Playback</strong>
                  <button className="ml-menu-action" onClick={() => commitDiscrete((c) => ({ ...c, animation: { ...c.animation, playing: !c.animation.playing } }))}>{config.animation.playing ? "Pause" : "Play"}</button>
                  <button className="ml-menu-action" onClick={() => setPreviewKey((key) => key + 1)}>Reset animation</button>
                  <label className="ml-menu-row">Speed
                    <select className="ml-select" value={config.animation.speedMultiplier} onChange={(e) => commitDiscrete((c) => ({ ...c, animation: { ...c.animation, speedMultiplier: parseFloat(e.target.value) } }))}>
                      {[0.25, 0.5, 1, 2].map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
                    </select>
                  </label>
                </section>
                <section className="ml-overflow-section">
                  <strong>View</strong>
                  <label className="ml-menu-row"><span>Handles</span><input type="checkbox" checked={!!debug.showEndpoints} onChange={(e) => setDebug((current) => ({ ...current, showEndpoints: e.target.checked }))} /></label>
                </section>
                <section className="ml-overflow-section">
                  <strong>History</strong>
                  <div className="ml-menu-pair">
                    <button className="ml-btn" disabled={!history.canUndo()} onClick={undoHistory}>Undo</button>
                    <button className="ml-btn" disabled={!history.canRedo()} onClick={redoHistory}>Redo</button>
                  </div>
                </section>
                <section className="ml-overflow-section">
                  <strong>Presets &amp; templates</strong>
                  <small className="ml-texture-description">Select a page first; applying a preset or template assigns it to that page and auto-saves it.</small>
                  <select className="ml-select ml-menu-select" defaultValue="" onChange={(e) => { if (e.target.value) applyPreset(e.target.value); e.currentTarget.value = ""; }}>
                    <option value="">Load preset</option>
                    <optgroup label="Full scene">
                      <option value="About">About — reference background</option>
                    </optgroup>
                    {Object.keys(SCENE_PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                  <button className="ml-menu-action" type="button" onClick={() => setShowTemplateLibrary(true)}>Open scene template library</button>
                </section>
                <section className="ml-overflow-section">
                  <strong>Page backgrounds</strong>
                  <p className="ml-page-scene-hint">Choose a page above to edit its background. Changes save automatically; use the page default to remove a page override.</p>
                  <button
                    className="ml-menu-action"
                    type="button"
                    onClick={clearPageScene}
                    disabled={pageActionLoading !== null}
                    aria-busy={pageActionLoading === "clear-page" || undefined}
                  >
                    {pageActionLoading === "clear-page" && <span className="ml-btn-spinner" aria-hidden="true" />}
                    {pageActionLoading === "clear-page" ? "Saving…" : "Use page default"}
                  </button>
                  <button
                    className="ml-menu-action ml-danger"
                    type="button"
                    onClick={forgetPagePath}
                    disabled={pageActionLoading !== null}
                    aria-busy={pageActionLoading === "forget-page" || undefined}
                  >
                    {pageActionLoading === "forget-page" && <span className="ml-btn-spinner" aria-hidden="true" />}
                    {pageActionLoading === "forget-page" ? "Removing…" : "Remove selected page from list"}
                  </button>
                </section>
                <section className="ml-overflow-section">
                  <strong>Scene</strong>
                  <button className="ml-menu-action" onClick={doExport}>Export</button>
                  <button className="ml-menu-action" onClick={() => { setImportText(""); setIoError(""); setShowIO("import"); }}>Import</button>
                  <button className="ml-menu-action ml-danger" onClick={resetScene}>Reset to defaults</button>
                </section>
              </div>
            </details>
          </>
        )}
      </div>

      {editorMode === "cursor" ? (
        <div className="ml-cursor-mode">
          <CursorEffectsSettings />
        </div>
      ) : (
        <>
      <div className={`ml-body ${panel === "editor" && globalTargetLineId === null ? "global-selected" : ""} ${leftPanelCollapsed ? "panel-left-collapsed" : ""} ${rightPanelCollapsed ? "panel-right-collapsed" : ""}`}>
        {leftPanelCollapsed && (
          <button type="button" className="ml-panel-reopen left" onClick={() => setLeftPanelCollapsed(false)} aria-label="Show layers panel">Layers</button>
        )}
        <div className={`ml-sidebar ${isLineEditing ? "editing-line" : ""}`}>
          <div className="ml-tabs">
            <button className={`ml-tab ${panel === "editor" ? "active" : ""}`} onClick={() => { setEnvironmentPathEditing(false); closePagePreview(); setPanel("editor"); }}>Lines + Global</button>
            <button className={`ml-tab ${panel === "targets" ? "active" : ""}`} onClick={() => { setEnvironmentPathEditing(false); setPanel("targets"); }}>Targets</button>
          </div>

          {panel === "editor" && (
            <div className="ml-global-scopes">
              <label className="ml-global-scope-row">
                <input type="radio" name="global-line-target" checked={!globalTargetLineId} onChange={() => selectLineForEditing(null)} />
                <span>All lines</span>
              </label>
            </div>
          )}
          {panel === "editor" && (
            <>
              {(selectedLine || selectedGroup) && (
                <div className="ml-selection-chip" aria-label="Current selection">
                  <span className="ml-swatch" style={{ background: selectedLine?.appearance.color ?? "#5ee6ff" }} />
                  <span>{selectedLine?.id ?? selectedGroup?.name}</span>
                </div>
              )}
              <div className="ml-layer-toolbar">
                <span>Layers</span>
                <button className="ml-btn" title="Select multiple layers with Ctrl/Cmd-click to group them" onClick={groupSelectedLines} disabled={linesToGroup.length < 2}>Group {linesToGroup.length || ""}</button>
              </div>
              <div className="ml-line-list">
                {layerEntries.map((entry) => entry.type === "line" ? renderLineLayer(entry.line) : (
                  <div className="ml-group-layer" key={entry.group.id}>
                    <div
                      className={`ml-group-row ${selectedGroupId === entry.group.id ? "selected" : ""} ${dragOverLineId === entry.group.lineIds[0] ? "drop-target" : ""}`}
                      draggable
                      onDragStart={(event) => startLayerDrag(entry.group.lineIds, event)}
                      onDragEnter={() => setDragOverLineId(entry.group.lineIds[0] ?? null)}
                      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                      onDragLeave={() => setDragOverLineId(null)}
                      onDrop={(event) => entry.group.lineIds[0] && handleLayerDrop(entry.group.lineIds[0], event)}
                      onDragEnd={() => setDragOverLineId(null)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        selectGroupForEditing(entry.group.id);
                        setLayerContextMenu({ x: event.clientX, y: event.clientY, lineIds: entry.group.lineIds, groupId: entry.group.id });
                      }}
                      onClick={() => selectGroupForEditing(entry.group.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectGroupForEditing(entry.group.id); } }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="ml-drag-handle" aria-hidden="true" title="Drag to reorder group">⠿</span>
                      <button
                        type="button"
                        className="ml-icon-btn ml-group-toggle"
                        aria-label={`${expandedGroups.includes(entry.group.id) ? "Collapse" : "Expand"} ${entry.group.name}`}
                        onClick={(e) => { e.stopPropagation(); setExpandedGroups((current) => current.includes(entry.group.id) ? current.filter((id) => id !== entry.group.id) : [...current, entry.group.id]); }}
                      >
                        {expandedGroups.includes(entry.group.id) ? "v" : ">"}
                      </button>
                      <span className="ml-group-icon" aria-hidden="true">G</span>
                      {isRenamingGroup && groupRenameLocation === "layer" && selectedGroupId === entry.group.id ? (
                        <form className="ml-layer-rename" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); renameSelectedGroup(); }} onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            type="text"
                            aria-label="Rename group"
                            value={groupNameDraft}
                            onChange={(e) => { setGroupNameDraft(e.target.value); setGroupRenameError(null); }}
                            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") cancelRenamingGroup(); }}
                          />
                          {groupRenameError && <small className="ml-error" role="alert">{groupRenameError}</small>}
                        </form>
                      ) : (
                        <span className="ml-line-id" onDoubleClick={(e) => { e.stopPropagation(); startRenamingGroup(entry.group, "layer"); }}>{entry.group.name}</span>
                      )}
                      <span className="ml-group-count">{entry.group.lineIds.length}</span>
                      <button
                        type="button"
                        className={`ml-icon-btn ml-visible-icon ${entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible) ? "active" : ""}`}
                        title={entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible) ? "Hide group" : "Show group"}
                        aria-label={entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible) ? "Hide group" : "Show group"}
                        aria-pressed={entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible)}
                        onClick={(event) => {
                          event.stopPropagation();
                          const groupVisible = entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible);
                          const lineIds = new Set(entry.group.lineIds);
                          commitDiscrete((current) => ({
                            ...current,
                            lines: current.lines.map((line) => lineIds.has(line.id) ? { ...line, visible: !groupVisible } : line),
                          }));
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z" />
                          {entry.group.lineIds.every((id) => config.lines.find((line) => line.id === id)?.visible)
                            ? <circle cx="12" cy="12" r="2.7" />
                            : <path d="m4 4 16 16" />}
                        </svg>
                      </button>
                      <button className="ml-icon-btn ml-ungroup-btn" title={`Ungroup ${entry.group.name}`} onClick={(e) => { e.stopPropagation(); ungroupLines(entry.group.id); }}>Ungroup</button>
                    </div>
                    {expandedGroups.includes(entry.group.id) && (
                      <div className="ml-group-children">{entry.group.lineIds.map((id) => config.lines.find((line) => line.id === id)).filter((line): line is MagneticLineConfig => !!line).map(renderLineLayer)}</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="ml-line-actions">
                <button className="ml-btn" onClick={addLine}>+ Add Line</button>
              </div>
              {soloLineId && <button className="ml-btn" style={{ margin: "6px 10px" }} onClick={() => setSoloLineId(null)}>Show All</button>}
              {isLineEditing && selectedLine && animationPreviewConfig && (
                <aside className="ml-animation-preview" aria-label="Selected line animation preview">
                  <strong>Animation preview</strong>
                  <div
                    className="ml-animation-preview-canvas"
                    style={{ width: `${animationPreviewWidth}px`, aspectRatio: `${previewViewport.width} / ${previewViewport.height}` }}
                  >
                    <MagneticBackgroundLines
                      config={animationPreviewConfig}
                      soloLineId={selectedLine.id}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
                    />
                  </div>
                  <small>The canvas is paused while you edit. This preview keeps animating.</small>
                </aside>
              )}
            </>
          )}

          {panel === "editor" && (
            <>
            <div className={`ml-global-editor ${globalTargetLineId === null ? "active" : ""}`}>
            <div className="ml-global-context">
              <div className="ml-context-title">Global defaults affect inherited sections</div>
              {config.lines.map((line) => {
                const resolved = resolveLineConfig(line, config.global);
                const custom = Object.entries(line.inherit).filter(([, inherited]) => !inherited).map(([scope]) => scope);
                return <div className="ml-context-line" key={line.id}><span>{line.id}</span><span className={custom.length ? "ml-context-custom" : "ml-context-inherited"}>{custom.length ? `Custom: ${custom.join(", ")}` : "Inherited"}</span><span className="ml-context-value">{resolved.appearance.width} px</span></div>;
              })}
            </div>

            <div className="ml-scroll">
              <Section title="APPEARANCE" help="Controls the line's base visual appearance and stroke weight.">
                <ColorStyleEditor
                  color={g.color}
                  colorStyle={g.colorStyle}
                  onColorChange={(color) => commitDiscrete((c) => {
                    const colors = c.global.colorStyle?.colors ?? [c.global.color, "#5ee6ff"];
                    return { ...c, global: { ...c.global, color, colorStyle: { ...c.global.colorStyle, type: c.global.colorStyle?.type ?? "solid", colors: [color, ...colors.slice(1)] } } };
                  })}
                  onColorStyleChange={(colorStyle) => commitDiscrete((c) => ({ ...c, global: { ...c.global, color: colorStyle.colors[0] ?? c.global.color, colorStyle } }))}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onSpeedChange={(speed) => liveUpdate((c) => {
                    const colorStyle = c.global.colorStyle ?? { type: "solid" as const, colors: [c.global.color, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, colorStyle: { ...colorStyle, speed } } };
                  })}
                  onColorWeightsChange={(colorWeights) => liveUpdate((c) => {
                    const colorStyle = c.global.colorStyle ?? { type: "solid" as const, colors: [c.global.color, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, colorStyle: { ...colorStyle, colorWeights } } };
                  })}
                />
                <div className="ml-appearance-controls">
                  <CompactValueField label="Opacity" icon="opacity" value={g.opacity} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, opacity: v } }))} />
                  <CompactValueField label="Width" icon="width" value={g.width} min={0} max={6} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, width: v } }))} />
                </div>
              </Section>



              <Section title="DEFAULT SHAPE" help="Sets the generated-shape defaults for lines using global shape settings.">
                <Row label="Type"><select className="ml-select" value={g.shape.type} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, type: e.target.value as ShapeType } } }))}><option value="straight">straight</option><option value="sharp">sharp corners</option><option value="rounded">rounded corners</option><option value="soft-wave">soft wave</option><option value="organic">organic</option><option value="liquid">liquid</option><option value="floating">floating</option><option value="vibration">vibration</option><option value="pixel">pixel</option></select></Row>
                <Row label="Bendable"><input type="checkbox" checked={g.shape.bendable !== false} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, bendable: c.global.shape.bendable === false } } }))} /></Row>
                {!g.shape.bendable && <small className="ml-texture-description">Keeps the shape fixed by disabling its motion, gravity, magnet, cursor, airflow, and line-interaction bending.</small>}
                <ShapeSliderField shapeType={g.shape.type} control="amplitude" label="Amplitude" value={g.shape.amplitude} min={0} max={0.12} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, amplitude: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="frequency" label="Frequency" value={g.shape.frequency} min={0} max={12} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, frequency: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="cycles" label="Cycles" value={g.shape.cycles} min={0} max={8} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, cycles: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="phase" label="Phase" value={g.shape.phase} min={0} max={6.28} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, phase: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="smoothness" label="Smoothness" value={g.shape.smoothness} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, smoothness: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="irregularity" label="Irregularity" value={g.shape.irregularity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, irregularity: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="distortion" label="Distortion" value={g.shape.distortion} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, distortion: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="roughness" label="Roughness" value={g.shape.roughness} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, roughness: v } } }))} />
                <ShapeSliderField shapeType={g.shape.type} control="pixelStep" label="Pixel step" value={g.shape.pixelStep} min={1} max={32} step={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, shape: { ...c.global.shape, pixelStep: v } } }))} />
              </Section>

              <Section title="MOTION" help="Animates the line geometry over time using the shared runtime clock.">
                <Row label="Enabled"><input type="checkbox" checked={g.motionEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, motionEnabled: !c.global.motionEnabled } }))} /></Row>
                <Row label="Type">
                  <select className="ml-select" value={g.motionType} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, motionType: e.target.value as MotionType } }))}>
                    <option value="tension">tension</option>
                    <option value="floating">floating</option>
                    <option value="vibration">vibration</option>
                  </select>
                </Row>
                <SliderField label="Speed" description="Motion cycles per second. The same value sets the base animation rate for every motion type." value={g.speed} min={0} max={9999999} sliderMax={100} step={0.001} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, speed: v } }))} />
                <SliderField label="Amplitude" value={g.amplitude} min={0} max={9999999} sliderMax={100} step={0.001} description="Peak motion displacement as a fraction of the viewport's shorter side." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, amplitude: v } }))} />
                <SliderField label="Frequency" value={g.frequency} min={0} max={9999999} sliderMax={100} step={0.001} disabled={g.motionType === "tension"} description={g.motionType === "tension" ? "Tension uses a single smooth bend and does not use spatial frequency." : "Spatial wave cycles along the line for Floating and Vibration."} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, frequency: v } }))} />
                <SliderField label="Phase" value={g.phase} min={0} max={9999999} sliderMax={100} step={0.001} unit="rad" description="Starting phase offset in radians." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, phase: v } }))} />
                <SliderField label="Magnet response" description="Scales deformation from magnetic targets only; it does not change ambient motion." value={g.deformability} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, deformability: v } }))} />
              </Section>
              <Section title="MAGNET" help="Pulls the line toward a registered target while that target is hovered, focused, or touched.">
                {targetSnapshots.length === 0 && (
                  <p className="ml-hint">No targets are registered on this editor page. Use Save &amp; Test to try the homepage targets, or register a MagneticTarget in your page.</p>
                )}
                                <Row label="Target"><select className="ml-select" value={g.targetId || ""} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, targetId: e.target.value || null } }))}><option value="">highest priority active</option>{magnetTargetIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></Row>
<Row label="Enabled"><input type="checkbox" checked={g.magnetismEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, magnetismEnabled: !c.global.magnetismEnabled } }))} /></Row>
                <SliderField label="Strength" description="Controls how strongly an affected line bends toward a target. 0 disables the pull; 100 applies the full configured deformation." example="50 is a moderate response; 100 is full strength." value={g.strength} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, strength: v } }))} />
                <SliderField label="Radius" unit="normalized" description="Influence distance as a fraction of the viewport's shorter dimension. 100 reaches up to 100 viewport dimensions from the target." value={g.radius} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, radius: v } }))} />
                <SliderField label="Falloff" description="Controls how sharply magnet influence fades near the radius edge. 0 is gentle; 100 is sharp." value={g.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, falloff: v } }))} />
                <SliderField label="Max Deform" description="Maximum displacement as a fraction of the viewport's shorter dimension, up to 100." value={g.maxDeformation} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, maxDeformation: v } }))} />
              </Section>
              <Section title="GLOW" open={glowSectionExpanded} onOpenChange={setGlowSectionExpanded} help="Inner glow follows the pointer or active target along a line. Outer glow adds a softer halo to nearby lines when a line is lit. Radius previews show the configured distance around the rendered path while this section is open.">
                <div className="ml-glow-subheading">INNER GLOW · TARGET ACTIVATED</div>
                <Row label="Enabled"><input type="checkbox" checked={g.glowEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, glowEnabled: !c.global.glowEnabled } }))} /></Row>
                <ColorStyleEditor
                  color={g.glowColor}
                  colorStyle={g.glowColorStyle}
                  colorLabel="Inner glow"
                  onColorChange={(color) => liveUpdate((c) => {
                    const style = c.global.glowColorStyle ?? { type: "solid" as const, colors: [c.global.glowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, glowColor: color, glowColorStyle: { ...style, colors: [color, ...style.colors.slice(1)] } } };
                  })}
                  onColorStyleChange={(glowColorStyle) => commitDiscrete((c) => ({ ...c, global: { ...c.global, glowColor: glowColorStyle.colors[0] ?? c.global.glowColor, glowColorStyle } }))}
                  onColorStyleLiveChange={(glowColorStyle) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowColor: glowColorStyle.colors[0] ?? c.global.glowColor, glowColorStyle } }))}
                  onColorChangeStart={captureBeforeChange}
                  onColorChangeEnd={commitPending}
                  onSpeedChange={(speed) => liveUpdate((c) => {
                    const style = c.global.glowColorStyle ?? { type: "random" as const, colors: [c.global.glowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, glowColorStyle: { ...style, speed } } };
                  })}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onColorWeightsChange={(colorWeights) => liveUpdate((c) => {
                    const style = c.global.glowColorStyle ?? { type: "linear" as const, colors: [c.global.glowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, glowColorStyle: { ...style, colorWeights } } };
                  })}
                />
                <SliderField label="Intensity" description="Glow strength/brightness. 0 turns the effect off; 100 is maximum strength before opacity and Max Combined are applied." value={g.glowIntensity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowIntensity: v } }))} />
                <SliderField label="Opacity" value={g.glowOpacity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowOpacity: v } }))} />
                <SliderField label="Radius" description="Maximum distance from the pointer or an active magnetic target to a rendered line for inner glow." value={g.glowRadius} min={0} max={100} step={0.01} unit="normalized" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowRadius: v } }))} />
                <SliderField label="Length" description="How much of the line lights around the closest point: 0 is a small local spot; 100 spreads glow along the whole line." value={g.glowLength} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowLength: v } }))} />
                <SliderField label="Falloff" description="How glow fades with distance: 0 is a linear fade; 100 uses a smoother S-curve toward the radius edge." value={g.glowFalloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowFalloff: v } }))} />
                <SliderField label="Max Combined" value={g.glowMaxCombinedIntensity} min={0} max={100} description="Caps the combined inner and outer glow brightness per sample." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowMaxCombinedIntensity: v } }))} />
                <fieldset className="ml-glow-preview-options">
                  <legend>Show radius on canvas</legend>
                  <label><input type="checkbox" checked={showGlowRadiusPreview.inner} onChange={() => setShowGlowRadiusPreview((current) => ({ ...current, inner: !current.inner }))} />Inner radius</label>
                  <label><input type="checkbox" checked={showGlowRadiusPreview.outer} onChange={() => setShowGlowRadiusPreview((current) => ({ ...current, outer: !current.outer }))} />Outer radius</label>
                </fieldset>
                {(showGlowRadiusPreview.inner || showGlowRadiusPreview.outer) && <small className="ml-gradient-help">Each preview shows the configured distance from the rendered line path. Inner and outer radii are independent.</small>}
                <SliderField label="Glow Smoothing" value={config.cursor.smoothing} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, smoothing: v } }))} />
                <SliderField label="Glow Release Speed" value={config.cursor.releaseSpeed} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, releaseSpeed: v } }))} />
                <div className="ml-glow-subheading">OUTER GLOW · SOFT HALO ON NEARBY LINES</div>
                <Row label="Enabled"><input type="checkbox" checked={g.outerGlowEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, outerGlowEnabled: !c.global.outerGlowEnabled } }))} /></Row>
                <ColorStyleEditor
                  color={g.outerGlowColor}
                  colorStyle={g.outerGlowColorStyle}
                  colorLabel="Outer glow"
                  onColorChange={(color) => liveUpdate((c) => {
                    const style = c.global.outerGlowColorStyle ?? { type: "solid" as const, colors: [c.global.outerGlowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, outerGlowColor: color, outerGlowColorStyle: { ...style, colors: [color, ...style.colors.slice(1)] } } };
                  })}
                  onColorStyleChange={(outerGlowColorStyle) => commitDiscrete((c) => ({ ...c, global: { ...c.global, outerGlowColor: outerGlowColorStyle.colors[0] ?? c.global.outerGlowColor, outerGlowColorStyle } }))}
                  onColorStyleLiveChange={(outerGlowColorStyle) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowColor: outerGlowColorStyle.colors[0] ?? c.global.outerGlowColor, outerGlowColorStyle } }))}
                  onColorChangeStart={captureBeforeChange}
                  onColorChangeEnd={commitPending}
                  onSpeedChange={(speed) => liveUpdate((c) => {
                    const style = c.global.outerGlowColorStyle ?? { type: "random" as const, colors: [c.global.outerGlowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, outerGlowColorStyle: { ...style, speed } } };
                  })}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onColorWeightsChange={(colorWeights) => liveUpdate((c) => {
                    const style = c.global.outerGlowColorStyle ?? { type: "linear" as const, colors: [c.global.outerGlowColor, "#5ee6ff"] };
                    return { ...c, global: { ...c.global, outerGlowColorStyle: { ...style, colorWeights } } };
                  })}
                />
                <SliderField label="Intensity" description="Glow strength/brightness. 0 turns the effect off; 100 is maximum strength before opacity and Max Combined are applied." value={g.outerGlowIntensity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowIntensity: v } }))} />
                <SliderField label="Opacity" value={g.outerGlowOpacity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowOpacity: v } }))} />
                <SliderField label="Radius" description="Maximum distance from a target-activated line for neighboring lines to receive outer glow." value={g.outerGlowRadius} min={0} max={100} step={0.01} unit="normalized" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowRadius: v } }))} />
                <SliderField label="Length" description="How much of this line lights around the closest point to the target-activated line: 0 is local; 100 spreads glow along the whole line." value={g.outerGlowLength} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowLength: v } }))} />
                <SliderField label="Falloff" description="How outer glow fades with distance: 0 is a linear fade; 100 uses a smoother S-curve toward the radius edge." value={g.outerGlowFalloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowFalloff: v } }))} />
              </Section>
              <Section title="CURSOR INFLUENCE" defaultOpen={false} help="Deforms the line around the cursor. Soft spreads influence more gently across the radius; focused concentrates it near the cursor; Follow controls how quickly the line catches up.">
                <Row label="Enabled"><input type="checkbox" checked={g.cursorInfluence.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, enabled: !c.global.cursorInfluence.enabled } } }))} /></Row>
                <Row label="Response"><select className="ml-select" value={g.cursorInfluence.profile} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, profile: e.target.value as "soft" | "balanced" | "focused" } } }))}><option value="soft">soft</option><option value="balanced">balanced</option><option value="focused">focused</option></select></Row>
                <SliderField label="Follow" description="How quickly the line catches up to the cursor. Lower values feel snappy; higher values feel smoother and more floaty." value={g.cursorInfluence.smoothing} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, smoothing: v } } }))} />
                <SliderField label="Strength" description="Multiplier for cursor movement. Values above 1 reach the deformation limit sooner; Max Deform still caps the offset." value={g.cursorInfluence.strength} min={0} max={2} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, strength: v } } }))} />
                <SliderField label="Radius" description="Influence distance as a fraction of the viewport's shorter dimension. The cursor only bends the line inside this range." value={g.cursorInfluence.radius} min={0} max={1} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, radius: v } } }))} />
                <SliderField label="Falloff" description="Shapes how influence fades across the radius: 0 is linear; 1 uses a smooth S-curve. This is a blend control, so values above 1 would not add a stronger effect." value={g.cursorInfluence.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, falloff: v } } }))} />
                <SliderField label="Max Deform" description="Hard limit for how far the line may move, as a fraction of the viewport's shorter dimension. Large values can create dramatic bends." value={g.cursorInfluence.maxDeformation} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, maxDeformation: v } } }))} />
                <Row label="Mode"><select className="ml-select" value={g.cursorInfluence.mode} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, mode: e.target.value as "attract" | "repel" } } }))}><option value="attract">attract</option><option value="repel">repel</option></select></Row>
              </Section>
              <Section title="TEXTURE DEFAULTS" defaultOpen={false} help="Material choice affects both the surface appearance and how that line responds to cursor and airflow forces.">
                <Row label="Enabled"><input type="checkbox" checked={g.textureEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, textureEnabled: !c.global.textureEnabled } }))} /></Row>
                <Row label="Material"><select className="ml-select" value={g.textureType} onChange={(e) => commitDiscrete((c) => {
                  const textureType = e.target.value as TextureType;
                  return { ...c, global: { ...c.global, textureType, textureWeight: getDefaultTextureWeight(textureType) } };
                })}><option value="grain">Paper grain</option><option value="fiber">Fibers</option><option value="silk">Silk</option><option value="rope">Rope</option><option value="beads">Beads</option><option value="metal">Brushed metal</option></select></Row>
                <SliderField label="Material weight" description="Higher values feel heavier and resist airflow and cursor movement; silk presets start light." value={g.textureWeight} min={0.1} max={4} step={0.05} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, textureWeight: v } }))} />
                <SliderField label="Scale" value={g.textureScale} min={0.005} max={0.1} step={0.001} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, textureScale: v } }))} />
                <SliderField label="Intensity" value={g.textureIntensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, textureIntensity: v } }))} />
                <SliderField label="Silk filaments" description="How many separate fine strands make up a silk line." value={g.textureSilkStrands} min={1} max={24} step={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, textureSilkStrands: v } }))} />
                <Row label="Show bead thread"><input type="checkbox" checked={g.textureShowThread} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, textureShowThread: !c.global.textureShowThread } }))} /></Row>
              </Section>
              <Section title="FLOW & ENERGY DEFAULTS" defaultOpen={false} help="Add animated energy that follows each line's live geometry. Individual lines can inherit these defaults or use their own settings.">
                <small className="ml-texture-description">Effects are rendered as a bounded SVG overlay in the shared preview and site animation loop.</small>
                <FlowSettings
                  flow={g.flow}
                  onLive={(flow) => liveUpdate((c) => ({ ...c, global: { ...c.global, flow } }))}
                  onDiscrete={(flow) => commitDiscrete((c) => ({ ...c, global: { ...c.global, flow } }))}
                  onCommitStart={captureBeforeChange}
                  onCommitEnd={commitPending}
                />
              </Section>
              <Section title="ENVIRONMENT" open={environmentSectionExpanded} onOpenChange={(open) => {
                setEnvironmentSectionExpanded(open);
                if (!open) setEnvironmentPathEditing(false);
              }} help="Set shared airflow and light. Individual lines can add several custom airflow paths and animated light sources.">
                <Row label="Enabled"><input type="checkbox" checked={g.environment.enabled} onChange={() => {
                  if (g.environment.enabled) {
                    setEnvironmentPathEditing(false);
                    setEnvironmentPathLineId(null);
                  }
                  commitDiscrete((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, enabled: !c.global.environment.enabled } } }));
                }} /></Row>
                <Row label="Airflow"><input type="checkbox" checked={g.environment.airflowEnabled} disabled={!g.environment.enabled} onChange={() => {
                  if (g.environment.airflowEnabled) {
                    setEnvironmentPathEditing(false);
                    setEnvironmentPathLineId(null);
                  }
                  commitDiscrete((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, airflowEnabled: !c.global.environment.airflowEnabled } } }));
                }} /></Row>
                {g.environment.airflowEnabled && (
                  <>
                    <button type="button" className="ml-btn" disabled={!g.environment.enabled || globalAirflowPaths.length >= 8} onClick={() => {
                      const pathIndex = globalAirflowPaths.length;
                      commitDiscrete((c) => ({
                        ...c,
                        global: {
                          ...c.global,
                          environment: {
                            ...c.global.environment,
                            airflowPaths: [...(c.global.environment.airflowPaths ?? (c.global.environment.airflowPath.length ? [c.global.environment.airflowPath] : [])), []],
                            airflowRadii: [
                              ...(c.global.environment.airflowPaths ?? (c.global.environment.airflowPath.length ? [c.global.environment.airflowPath] : []))
                                .map((_, index) => c.global.environment.airflowRadii?.[index] ?? c.global.environment.airflowRadius),
                              c.global.environment.airflowRadius,
                            ],
                          },
                        },
                      }));
                      setEnvironmentPathLineId(null);
                      setEnvironmentPathIndex(pathIndex);
                      setEnvironmentPathEditing(true);
                    }}>+ Add global airflow path</button>
                    {globalAirflowPaths.map((path, index) => {
                      const isDrawing = environmentPathEditing && environmentPathLineId === null && environmentPathIndex === index;
                      return (
                        <div className="ml-environment-source" key={`global-airflow-${index}`}>
                          <div className="ml-line-actions">
                            <strong className="ml-texture-description">Global flow {index + 1}</strong>
                            <span className="ml-texture-description">{path.length >= 2 ? "Ready" : "Needs drawing"}</span>
                            <button type="button" className={`ml-btn${isDrawing ? " ml-primary" : ""}`} disabled={!g.environment.enabled} onClick={() => {
                              if (isDrawing) {
                                setEnvironmentPathEditing(false);
                                return;
                              }
                              setEnvironmentPathLineId(null);
                              setEnvironmentPathIndex(index);
                              setEnvironmentPathEditing(true);
                            }}>{isDrawing ? "Cancel" : path.length >= 2 ? "Redraw" : "Draw on canvas"}</button>
                            <button type="button" className="ml-btn" onClick={() => {
                              const airflowPaths = globalAirflowPaths.filter((_, pathIndex) => pathIndex !== index);
                              const airflowRadii = globalAirflowPaths
                                .map((_, pathIndex) => g.environment.airflowRadii?.[pathIndex] ?? g.environment.airflowRadius)
                                .filter((_, pathIndex) => pathIndex !== index);
                              commitDiscrete((c) => ({
                                ...c,
                                global: {
                                  ...c.global,
                                  environment: { ...c.global.environment, airflowPaths, airflowRadii, airflowPath: airflowPaths[0] ?? [] },
                                },
                              }));
                              setEnvironmentPathEditing(false);
                              setEnvironmentPathIndex(0);
                            }}>Remove</button>
                          </div>
                          {isDrawing && <small className="ml-texture-description">Drag across the preview to sketch this flow, then release to save it.</small>}
                          <SliderField label="Influence radius" description="Each flow controls its own reach; the translucent corridor shows its size." value={g.environment.airflowRadii?.[index] ?? g.environment.airflowRadius} min={0.005} max={1} step={0.005} unit="norm" disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(airflowRadius) => liveUpdate((c) => ({
                            ...c,
                            global: {
                              ...c.global,
                              environment: {
                                ...c.global.environment,
                                airflowRadii: globalAirflowPaths.map((_, pathIndex) =>
                                  pathIndex === index
                                    ? airflowRadius
                                    : c.global.environment.airflowRadii?.[pathIndex] ?? c.global.environment.airflowRadius),
                              },
                            },
                          }))} />
                        </div>
                      );
                    })}
                    <Row label="Air behavior"><select className="ml-select" value={g.environment.airflowBehavior} disabled={!g.environment.enabled} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, airflowBehavior: e.target.value as AirflowBehavior } } }))}>
                      <option value="steady">Steady</option><option value="gentle">Gentle breeze</option><option value="gusty">Gusty wind</option><option value="storm">Storm / hurricane</option><option value="random">Random: calm, breeze, gusts</option>
                    </select></Row>
                    <SliderField label="Air strength" value={g.environment.airflowStrength} min={0} max={2} step={0.01} disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, airflowStrength: v } } }))} />
                    <SliderField label="Air speed" value={g.environment.airflowSpeed} min={0} max={4} step={0.01} disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, airflowSpeed: v } } }))} />
                  </>
                )}
                <Row label="Colored light"><input type="checkbox" checked={g.environment.lightEnabled} disabled={!g.environment.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, environment: { ...c.global.environment, lightEnabled: !c.global.environment.lightEnabled } } }))} /></Row>
                {g.environment.lightEnabled && (
                  <>
                    <button type="button" className="ml-btn" disabled={!g.environment.enabled || globalEnvironmentLights.length >= 8} onClick={() => {
                      const id = `global-light-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
                      const position = { x: 0.5, y: 0.3 };
                      const light: EnvironmentLightConfig = {
                        id,
                        color: g.environment.lightColor,
                        position,
                        endPosition: position,
                        intensity: g.environment.lightIntensity,
                        radius: g.environment.lightRadius,
                        speed: 0,
                        playback: "loop",
                      };
                      commitDiscrete((current) => {
                        const environment = current.global.environment;
                        const lights = environment.lights ?? getEnvironmentLights(environment);
                        return {
                          ...current,
                          global: {
                            ...current.global,
                            environment: {
                              ...environment,
                              lights: [...lights, light],
                            },
                          },
                        };
                      });
                    }}>+ Add global light</button>
                    {globalEnvironmentLights.map((light, index) => (
                      <div className="ml-environment-source" key={light.id}>
                        <div className="ml-line-actions">
                          <strong className="ml-texture-description">Global light {index + 1}</strong>
                          <span className="ml-texture-description">{light.speed > 0 ? light.playback === "loop" ? "Moving · loop" : "Moving · once" : "Static"}</span>
                          <button type="button" className="ml-btn" onClick={() => commitDiscrete((current) => {
                            const environment = current.global.environment;
                            const lights = (environment.lights ?? getEnvironmentLights(environment)).filter((item) => item.id !== light.id);
                            return { ...current, global: { ...current.global, environment: { ...environment, lights } } };
                          })}>Remove</button>
                        </div>
                        <ColorPickerControl label={`Global light ${index + 1} color`} color={light.color} onChange={(color) => updateGlobalLight(light.id, { color })} />
                        <SliderField label="Intensity" value={light.intensity} min={0} max={1} step={0.01} disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(intensity) => updateGlobalLight(light.id, { intensity }, true)} />
                        <SliderField label="Radius" value={light.radius} min={0.05} max={1} step={0.005} unit="norm" disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(radius) => updateGlobalLight(light.id, { radius }, true)} />
                        <SliderField label="Travel speed" value={light.speed} min={0} max={2} step={0.01} disabled={!g.environment.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(speed) => updateGlobalLight(light.id, { speed }, true)} />
                        <Row label="Travel mode"><select className="ml-select" value={light.playback} disabled={!g.environment.enabled} onChange={(event) => updateGlobalLight(light.id, { playback: event.target.value as "loop" | "once" })}>
                          <option value="loop">Loop</option><option value="once">Once, then stop</option>
                        </select></Row>
                        <small className="ml-texture-description">Drag the filled marker to place it; drag its outlined endpoint to define travel.</small>
                      </div>
                    ))}
                  </>
                )}
              </Section>
              <Section title="LINE INTERACTION" defaultOpen={false} help="Enabled lines softly bend away from nearby stroke segments. Disabled lines still act as obstacles, and separate shape strokes are checked independently.">
                <Row label="Enabled"><input type="checkbox" checked={g.lineInteraction.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, enabled: !c.global.lineInteraction.enabled } } }))} /></Row>
                <SliderField label="Strength" value={g.lineInteraction.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, strength: v } } }))} />
                <SliderField label="Clearance" description="Soft avoidance targets this much space between visible strokes. Radius controls how gradually lines begin bending." value={g.lineInteraction.clearance} min={0} max={0.1} step={0.001} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, clearance: v } } }))} />
                <SliderField label="Influence radius" value={g.lineInteraction.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, radius: v } } }))} />
                <SliderField label="Falloff" value={g.lineInteraction.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, falloff: v } } }))} />
                <Row label="Mode"><select className="ml-select" value={g.lineInteraction.mode} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, mode: "avoid" } } }))}><option value="avoid">avoid</option></select></Row>
              </Section>
              <Section title="CROSSING GAPS" defaultOpen={false} help="When this line is behind a higher layer, it can leave a clean gap around the crossing. Gap width is extra clearance beyond both stroke widths.">
                <Row label="Enabled"><input type="checkbox" checked={g.occlusion.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, occlusion: { ...c.global.occlusion, enabled: !c.global.occlusion.enabled } } }))} /></Row>
                <SliderField label="Gap width" description="Extra clearance at crossings, beyond the width of both strokes. Set to 0 for a tight cut." value={g.occlusion.gapWidth} min={0} max={24} step={0.5} unit="px" disabled={!g.occlusion.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(gapWidth) => liveUpdate((c) => ({ ...c, global: { ...c.global, occlusion: { ...c.global.occlusion, gapWidth } } }))} />
              </Section>              <Section title="ACCESSIBILITY" defaultOpen={false} help="Controls reduced-motion behavior and accessibility-friendly motion preferences.">
                <Row label="Reduced Motion">
                  <select className="ml-select" value={config.animation.reducedMotion} onChange={(e) => commitDiscrete((c) => ({ ...c, animation: { ...c.animation, reducedMotion: e.target.value as "auto" | "on" | "off" } }))}>
                    <option value="auto">Auto (respect OS)</option>
                    <option value="on">Force ON</option>
                    <option value="off">Force OFF</option>
                  </select>
                </Row>
              </Section>
              <div style={{ padding: 10, display: "flex", gap: 8 }}>
                <button className="ml-btn" onClick={resetGlobal}>Reset Global</button>
              </div>
            </div>
            </div>
            </>
          )}

          {panel === "targets" && (
            <div className="ml-scroll">
              <div className="ml-target-toolbar">
                <div>
                  <strong>Page targets</strong>
                  <span>Pick elements directly from the selected page preview.</span>
                </div>
                <button className="ml-btn ml-primary" type="button" onClick={() => startTargetPicking()}>Pick page element</button>
              </div>
              {targetDraftError && <p className="ml-target-error" role="alert">{targetDraftError}</p>}
              {pickedTargetDraft && (
                <section className="ml-target-card ml-target-draft">
                  <div className="ml-target-head"><strong>New page target</strong><span>{pickedTargetDraft.tagName}</span></div>
                  <div className="ml-target-detail-preview">
                    <TargetThumbnail
                      name={pickedTargetDraft.name}
                      tagName={pickedTargetDraft.tagName}
                      previewSrc={targetPreviewImages[pickedTargetDraft.id]}
                      selected
                    />
                    <span><strong>Picked element</strong><small>Save it to edit its response and line layers.</small></span>
                  </div>
                  <Row label="Name"><input className="ml-num ml-target-name" value={pickedTargetDraft.name} onChange={(event) => setPickedTargetDraft((draft) => draft ? { ...draft, name: event.target.value } : draft)} /></Row>
                  <div className="ml-target-selector" title={pickedTargetDraft.selector}>{pickedTargetDraft.selector}</div>
                  <fieldset className="ml-target-activations">
                    <legend>Default triggers · can be overridden per line</legend>
                    {([
                      ["hover", "Hover"],
                      ["focus", "Keyboard focus"],
                      ["click", "Click"],
                      ["touch", "Touch"],
                    ] as Array<[TargetActivation, string]>).map(([activation, label]) => (
                      <label key={activation}>
                        <input
                          type="checkbox"
                          checked={pickedTargetDraft.activations.includes(activation)}
                          onChange={(event) => setPickedTargetDraft((draft) => draft ? {
                            ...draft,
                            activations: event.target.checked
                              ? [...new Set([...draft.activations, activation])]
                              : draft.activations.filter((item) => item !== activation),
                          } : draft)}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {pickedTargetDraft.activations.includes("click") && (
                    <Row label="Click behavior">
                      <select className="ml-select" value={pickedTargetDraft.clickBehavior} onChange={(event) => setPickedTargetDraft((draft) => draft ? { ...draft, clickBehavior: event.target.value as TargetClickBehavior } : draft)}>
                        <option value="toggle">Toggle on/off</option>
                        <option value="press">Active while pressed</option>
                      </select>
                    </Row>
                  )}
                  <div className="ml-target-actions">
                    <button className="ml-btn" type="button" onClick={() => { setPickedTargetDraft(null); setTargetDraftError(""); }}>Cancel</button>
                    <button className="ml-btn ml-primary" type="button" onClick={savePickedTarget}>Save target</button>
                  </div>
                </section>
              )}
              {targetPanelIds.length === 0 && !pickedTargetDraft && <p className="ml-hint">No targets yet. Pick a page element to start; you can also keep using targets registered by existing components.</p>}
              {targetPanelIds.map((targetId) => {
                const cfg = targetConfigFor(targetId);
                const snapshot = targetSnapshots.find((item) => item.id === targetId);
                const bindingStatus = targetStatuses[targetId];
                const statusLabel = snapshot?.active
                  ? "ACTIVE"
                  : !cfg.selector
                    ? "CODE TARGET"
                    : bindingStatus === "ready"
                      ? "READY"
                      : bindingStatus === "multiple"
                        ? "MULTIPLE MATCHES"
                        : bindingStatus === "invalid"
                          ? "INVALID SELECTOR"
                          : bindingStatus === "disabled"
                            ? "DISABLED"
                            : bindingStatus === "missing"
                              ? "NOT FOUND"
                              : "CHECK PAGE";
                return (
                  <button
                    key={targetId}
                    type="button"
                    className={`ml-target-list-item ${selectedTargetId === targetId ? "selected" : ""}`}
                    aria-pressed={selectedTargetId === targetId}
                    onClick={() => selectTargetForEditing(targetId)}
                  >
                    <TargetThumbnail
                            name={cfg.name || targetId}
                            tagName={cfg.tagName || (cfg.selector ? "element" : "code target")}
                            previewSrc={targetPreviewImages[targetId]}
                            selected={selectedTargetId === targetId}
                    />
                    <span className="ml-target-list-copy">
                            <strong>{cfg.name || targetId}</strong>
                            <small>{cfg.tagName || (cfg.selector ? "Page element" : "Code target")}</small>
                            <span className={`ml-badge ${snapshot?.active || bindingStatus === "ready" ? "on" : ""}`}>{statusLabel}</span>
                    </span>
                    <span className="ml-target-list-arrow" aria-hidden="true">›</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {pagePreviewToken ? (
          <section className="ml-page-preview" aria-label={`Live page preview: ${pagePath}`}>
            <div className="ml-page-preview-heading">
              <div>
                <strong>{pageRouteLabel(pagePath)}</strong>
                <span>{targetDraftError || (targetPickToken ? "Click any page element to select it. Press Esc to cancel." : "Live page preview — select a target to highlight it.")}</span>
              </div>
            </div>
            <iframe
              key={pagePreviewToken}
              ref={pagePreviewFrameRef}
              className="ml-page-preview-frame"
              title={`Live preview of ${pagePath}`}
              src={`${pagePath}${pagePath.includes("?") ? "&" : "?"}magneticPreview=${encodeURIComponent(pagePreviewToken)}${targetPickToken ? `&magneticTargetPicker=${encodeURIComponent(targetPickToken)}` : ""}`}
            />
          </section>
        ) : <div className="ml-preview-wrap">
          <MagneticBackgroundLines
            key={previewKey}
            config={timelinePreviewConfig}
            interactive
            animateEffectsWhenPaused={!showTemplateLibrary && selectedLine !== null}
            pauseAnimation={showTemplateLibrary || (selectedLine
              ? !timelinePreviewPlaying
              : !config.animation.playing)}
            selectedLineId={panel === "editor" ? selectedLineId : null}
            showGlowRadiusPreview={panel === "editor" && !rightPanelCollapsed && glowSectionExpanded
              ? showGlowRadiusPreview
              : { inner: false, outer: false }}
            selectedGroupLineIds={panel === "editor" ? selectedGroupLineIds : []}
            showTransformHandles={panel === "editor" && (selectedGroup ? groupTransformExpanded : selectedLine ? lineTransformExpanded : false)}
            soloLineId={soloLineId}
            focusLineId={panel === "editor" ? selectedLineId ?? selectedGroup?.lineIds[0] ?? null : null}
            focusOpacity={0.2}
            onViewportChange={setPreviewViewport}
            debug={debug}
            onSelectLine={selectLineForEditing}
            onDragStart={captureBeforeChange}
            onLineDragStart={captureBeforeChange}
            onDragLine={dragSelectedLine}
            onGroupDragStart={beginGroupChange}
            onDragGroup={(delta) => {
              if (!selectedGroup) return;
              transformGroup(selectedGroup.id, selectedGroup.scale, selectedGroup.rotation, delta);
              scheduleGroupCommit();
            }}
            onGroupTransformStart={beginGroupChange}
            onGroupTransform={(scale, rotation, center) => {
              if (!selectedGroup) return;
              transformGroup(selectedGroup.id, scale, rotation, { x: 0, y: 0 }, center);
              scheduleGroupCommit();
            }}
            onLineTransformStart={captureBeforeChange}
            onLineTransform={(scaleX, scaleY, rotation, center) => {
             if (!selectedLine) return;
             transformSelectedLine(scaleX, scaleY, rotation, { x: 0, y: 0 }, center);
            }}
            onDragAnchorStart={() => captureBeforeChange()}
            onDragAnchorPoint={updateAnchorPointPosition}
            onDragSelectedAnchorPoints={updateSelectedAnchorPointPositions}
            selectedPathPointId={panel === "editor" ? selectedPathPointId : null}
            selectedAnchorPointId={panel === "editor" ? selectedAnchorPointIdForLine : null}
            selectedAnchorPointIds={panel === "editor" ? selectedAnchorPointIdsForLine : []}
            anchorPlaybackSeek={panel === "editor" ? anchorPlaybackSeek : null}
            visibleAnchorPointIds={panel === "editor" && selectedLine?.geometrySource === "path"
              ? canvasVisibleAnchorPointIds
              : undefined}
            editableAnchorPointIds={panel === "editor" && focusCanvasOnSelection && (selectedAnchorPointIdsForLine.length > 0 || canvasFocusedTracks)
              ? focusedEditablePointIds ?? []
              : undefined}
            visiblePathPointIds={panel === "editor" && selectedLine?.geometrySource === "path"
              ? canvasPathPointIds
              : undefined}
            showAnchorPointHandles={panel === "editor" && anchorPointsExpanded && anchorCanvasMode !== "shape"}
            showShapePointLabels={showShapePointLabels}
            showPathPointHandles={panel === "editor" && (
              geometryExpanded || (anchorPointsExpanded && anchorCanvasMode !== "animation")
            )}
            onSelectPathPoint={(_, pointId) => setSelectedPathPointId(pointId)}
            onSelectAnchorPoint={(_, pointId) => {
              setSelectedAnchorPointId(pointId);
              if (!selectedAnchorPointIdsForLine.includes(pointId)) setSelectedAnchorPointIds([pointId]);
            }}
            onPathPointDragStart={() => captureBeforeChange()}
            onDragPathPoint={updatePathPoint}
            onPathPointDragEnd={mergePathPoints}
            environmentPathEditing={panel === "editor" && environmentSectionExpanded && environmentPathEditing}
            showEnvironmentControls={panel === "editor" && environmentSectionExpanded}
            environmentPaths={globalTargetLineId === null
              ? config.global.environment.enabled && config.global.environment.airflowEnabled
                ? config.global.environment.airflowPaths ?? (config.global.environment.airflowPath.length ? [config.global.environment.airflowPath] : [])
                : []
              : selectedLine
                ? resolveLineAirflowPaths(config.global.environment, selectedLine.environment, selectedLine.environmentEnabled)
                : []}
            environmentPathRadii={globalTargetLineId === null
              ? globalAirflowPaths.map((_, index) => g.environment.airflowRadii?.[index] ?? g.environment.airflowRadius)
              : selectedLine
                ? resolveLineAirflowRadii(config.global.environment, selectedLine.environment, selectedLine.environmentEnabled)
                : []}
            environmentPath={environmentPathLineId
              ? config.lines.find((line) => line.id === environmentPathLineId)?.environment.airflowPaths[environmentPathIndex] ?? []
              : environmentPathEditing && globalTargetLineId === null
                ? (config.global.environment.airflowPaths ?? [config.global.environment.airflowPath])[environmentPathIndex] ?? []
                : selectedLine?.environment.airflowPaths[environmentPathIndex] ?? []}
            environmentPathIndex={environmentPathIndex}
            environmentPathLineId={environmentPathLineId}
            editableEnvironmentLights={globalTargetLineId !== null && selectedLine?.environment.lightMode === "individual" ? selectedLine.environment.lights : []}
            onEnvironmentPathCommit={(airflowPath, lineId, pathIndex) => {
              setEnvironmentPathEditing(false);
              setEnvironmentPathLineId(null);
              commitDiscrete((current) => lineId
                ? {
                    ...current,
                    lines: current.lines.map((line) => line.id === lineId
                      ? {
                          ...line,
                          environment: {
                            ...line.environment,
                                    airflowPath: pathIndex === 0 ? airflowPath : line.environment.airflowPath,
                            airflowPaths: line.environment.airflowPaths.map((path, index) => index === pathIndex ? airflowPath : path),
                          },
                        }
                      : line),
                  }
                : {
                    ...current,
                    global: {
                      ...current.global,
                      environment: {
                        ...current.global.environment,
                        airflowPath: pathIndex === 0 ? airflowPath : current.global.environment.airflowPath,
                        airflowPaths: (current.global.environment.airflowPaths ?? (current.global.environment.airflowPath.length ? [current.global.environment.airflowPath] : []))
                          .map((path, index) => index === pathIndex ? airflowPath : path),
                      },
                    },
                  });
            }}
            onEnvironmentLightDragStart={() => captureBeforeChange()}
            onEnvironmentLightPositionChange={(lightPosition, lineId, lightId, endpoint = "start") => {
              if (lineId) {
                updateLineLive(lineId, (line) => ({
                  ...line,
                  environment: {
                    ...line.environment,
                    lights: line.environment.lights.map((light) => light.id === lightId
                      ? { ...light, [endpoint === "start" ? "position" : "endPosition"]: lightPosition }
                      : light),
                  },
                }));
              } else if (lightId) {
                updateGlobalLight(lightId, {
                  [endpoint === "start" ? "position" : "endPosition"]: lightPosition,
                }, true);
              } else {
                liveUpdate((current) => ({
                  ...current,
                  global: {
                    ...current.global,
                    environment: { ...current.global.environment, lightPosition },
                  },
                }));
              }
            }}
            onEnvironmentLightDragEnd={commitPending}
            onDragEndpoint={updateLineEndpointPoint}
            onDragCommit={commitPending}
          />
        </div>}

        {rightPanelCollapsed && (
          <button type="button" className="ml-panel-reopen right" onClick={() => setRightPanelCollapsed(false)} aria-label="Show controls panel">Controls</button>
        )}
        <div className="ml-inspector">
          {panel === "targets" && selectedTargetId && selectedTargetConfig && (() => {
            const cfg = selectedTargetConfig;
            const snapshot = targetSnapshots.find((item) => item.id === selectedTargetId);
            const assignedLineIds = getTargetAssignedLineIds(cfg, config.lines, config.global);
            const orderedLines = config.lines
              .map((line, index) => ({ line, index }))
              .sort((left, right) => left.line.appearance.zIndex - right.line.appearance.zIndex || left.index - right.index)
              .map(({ line }) => line);
            const bindingStatus = targetStatuses[selectedTargetId];
            const activationOptions: Array<[TargetActivation, string]> = [
              ["hover", "Hover"],
              ["focus", "Keyboard focus"],
              ["click", "Click"],
              ["touch", "Touch"],
            ];
            return (
              <div className="ml-scroll ml-target-inspector">
                <div className="ml-inspector-head">
                  <div>
                    <strong>{cfg.name || selectedTargetId}</strong>
                    <small className="ml-context-mode">Target · {cfg.tagName || "element"}</small>
                  </div>
                  <span className={`ml-badge ${snapshot?.active || bindingStatus === "ready" ? "on" : ""}`}>
                    {snapshot?.active ? "ACTIVE" : bindingStatus === "ready" ? "READY" : bindingStatus === "missing" ? "NOT FOUND" : bindingStatus === "multiple" ? "MULTIPLE" : bindingStatus === "invalid" ? "INVALID" : bindingStatus === "disabled" ? "DISABLED" : cfg.selector ? "CHECK PAGE" : "CODE TARGET"}
                  </span>
                </div>
                <div className="ml-target-detail-preview">
                  <TargetThumbnail
                    name={cfg.name || selectedTargetId}
                    tagName={cfg.tagName || "element"}
                    previewSrc={targetPreviewImages[selectedTargetId]}
                    selected
                  />
                  <span>
                    <strong>Selected page element</strong>
                    <small>{cfg.selector ? "Highlighted in the page preview" : "This target is registered by code"}</small>
                  </span>
                </div>
                {cfg.selector && <div className="ml-target-selector" title={cfg.selector}>{cfg.selector}</div>}
                {cfg.selector && (bindingStatus === "missing" || bindingStatus === "multiple" || bindingStatus === "invalid") && (
                  <p className="ml-target-error">
                    {bindingStatus === "missing" ? "This element was not found on the page. Re-pick it." : bindingStatus === "multiple" ? "This selector matches more than one element. Re-pick it." : "This selector is invalid. Re-pick it."}
                  </p>
                )}
                <Section title="TARGET" defaultOpen>
                  <Row label="Name"><input className="ml-num ml-target-name" value={cfg.name || selectedTargetId} onChange={(event) => updateTarget(selectedTargetId, (current) => ({ ...current, name: event.target.value }))} /></Row>
                  <Row label="Enabled"><input type="checkbox" checked={cfg.enabled} onChange={() => updateTarget(selectedTargetId, (current) => ({ ...current, enabled: !current.enabled }))} /></Row>
                  <Row label="Magnetic"><input type="checkbox" checked={cfg.magnetic} onChange={() => updateTarget(selectedTargetId, (current) => ({ ...current, magnetic: !current.magnetic }))} /></Row>
                  <fieldset className="ml-target-activations">
                    <legend>Activate on</legend>
                    {activationOptions.map(([activation, label]) => (
                      <label key={activation}>
                        <input
                          type="checkbox"
                          checked={cfg.activations?.includes(activation) ?? false}
                          onChange={(event) => updateTarget(selectedTargetId, (current) => ({
                            ...current,
                            activations: event.target.checked
                              ? [...new Set([...(current.activations ?? []), activation])]
                              : (current.activations ?? []).filter((item) => item !== activation),
                          }))}
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  {cfg.activations?.includes("click") && (
                    <Row label="Click behavior">
                      <select className="ml-select" value={cfg.clickBehavior ?? "toggle"} onChange={(event) => updateTarget(selectedTargetId, (current) => ({ ...current, clickBehavior: event.target.value as TargetClickBehavior }))}>
                        <option value="toggle">Toggle on/off</option>
                        <option value="press">Active while pressed</option>
                      </select>
                    </Row>
                  )}
                  <Row label="Strength"><ScrubNumberField label={`${selectedTargetId} strength`} min={0} step={0.01} value={cfg.strength} onChange={(value) => updateTarget(selectedTargetId, (current) => ({ ...current, strength: value }))} /></Row>
                  <Row label="Extra radius"><ScrubNumberField label={`${selectedTargetId} radius`} min={0} step={0.01} value={cfg.radius} onChange={(value) => updateTarget(selectedTargetId, (current) => ({ ...current, radius: value }))} /></Row>
                  <Row label="Priority"><ScrubNumberField label={`${selectedTargetId} priority`} step={1} value={cfg.priority} onChange={(value) => updateTarget(selectedTargetId, (current) => ({ ...current, priority: Math.round(value) }))} /></Row>
                </Section>
                <Section title="RESPONDING LINES" defaultOpen>
                  <div className="ml-target-scope-actions">
                    <button className="ml-btn" type="button" onClick={() => setTargetLineScope(selectedTargetId, null)}>All lines</button>
                    <button className="ml-btn" type="button" onClick={() => setTargetLineScope(selectedTargetId, [])}>None</button>
                  </div>
                  <p className="ml-target-layer-note">Expand Magnet or Glow on a line to edit its existing effect settings and choose its active triggers. Until customized, each effect follows this target’s default triggers. Effects disabled on a line will not respond.</p>
                  <div className="ml-target-line-list">
                    {config.lines.map((line) => {
                      const orderIndex = orderedLines.findIndex((item) => item.id === line.id);
                      const lineConfig = resolveLineConfig(line, config.global);
                      const lineMagnet = lineConfig.magnet;
                      const lineGlow = lineConfig.glow;
                      const magnetTriggers = getTargetLineActivations(cfg, line.id, "magnet");
                      const glowTriggers = getTargetLineActivations(cfg, line.id, "glow");
                      const updateEffectTriggers = (effect: TargetLineEffect, current: TargetActivation[], activation: TargetActivation, checked: boolean) => {
                        const next = new Set(current);
                        if (checked) next.add(activation);
                        else next.delete(activation);
                        updateTargetLineTriggers(selectedTargetId, line.id, effect, Array.from(next));
                      };
                      return (
                        <div className="ml-target-line-item" key={line.id}>
                          <div className="ml-target-line-row">
                            <label>
                              <input
                                type="checkbox"
                                checked={assignedLineIds.includes(line.id)}
                                onChange={(event) => {
                                  const next = new Set(assignedLineIds);
                                  if (event.target.checked) next.add(line.id);
                                  else next.delete(line.id);
                                  setTargetLineScope(selectedTargetId, next.size === config.lines.length ? null : Array.from(next));
                                }}
                              />
                              <span>
                                <span>{line.id}</span>
                                <small className="ml-target-line-settings">
                                  {lineMagnet.enabled ? "Magnet enabled" : "Magnet not enabled on line"}
                                  {" · "}
                                  {lineGlow.enabled ? "Glow enabled" : "Glow not enabled on line"}
                                </small>
                              </span>
                            </label>
                            <span className="ml-target-layer-buttons">
                              <button
                                type="button"
                                className="ml-icon-btn"
                                aria-label={`Move ${line.id} behind`}
                                title="Move behind the previous line"
                                disabled={orderIndex <= 0}
                                onClick={() => reorderLayerBlock([line.id], orderedLines[orderIndex - 1].id)}
                              >↓</button>
                              <button
                                type="button"
                                className="ml-icon-btn"
                                aria-label={`Move ${line.id} in front`}
                                title="Move in front of the next line"
                                disabled={orderIndex >= orderedLines.length - 1}
                                onClick={() => reorderLayerBlock([line.id], orderedLines[orderIndex + 1].id, "after")}
                              >↑</button>
                            </span>
                          </div>
                          <details className="ml-target-effect-settings">
                            <summary>
                              <strong>Magnet</strong>
                              <span>{lineMagnet.enabled ? `On · ${magnetTriggers.join(", ") || "no triggers"}` : "Not enabled on line"}</span>
                            </summary>
                            {!lineMagnet.enabled && <p className="ml-target-effect-disabled">Magnet is not enabled on this line. Enable it below to use these triggers.</p>}
                            <Row label="Enabled"><input type="checkbox" checked={lineMagnet.enabled} onChange={() => updateLineDiscrete(line.id, (current) => ({ ...current, magnet: { ...current.magnet, enabled: !current.magnet.enabled } }))} /></Row>
                            <SliderField label="Strength" value={lineMagnet.strength} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, magnet: { ...current.magnet, strength: value } }))} />
                            <SliderField label="Radius" value={lineMagnet.radius} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, magnet: { ...current.magnet, radius: value } }))} />
                            <SliderField label="Falloff" value={lineMagnet.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, magnet: { ...current.magnet, falloff: value } }))} />
                            <SliderField label="Max Deform" value={lineMagnet.maxDeformation} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, magnet: { ...current.magnet, maxDeformation: value } }))} />
                            <fieldset className="ml-target-effect-triggers">
                              <legend>Activate Magnet on</legend>
                              {activationOptions.map(([activation, label]) => (
                                <label key={activation}>
                                  <input type="checkbox" checked={magnetTriggers.includes(activation)} onChange={(event) => updateEffectTriggers("magnet", magnetTriggers, activation, event.target.checked)} />
                                  {label}
                                </label>
                              ))}
                            </fieldset>
                            {cfg.lineTriggers?.[line.id]?.magnet && (
                              <button className="ml-btn" type="button" onClick={() => updateTargetLineTriggers(selectedTargetId, line.id, "magnet", null)}>Use target defaults</button>
                            )}
                          </details>
                          <details className="ml-target-effect-settings">
                            <summary>
                              <strong>Glow</strong>
                              <span>{lineGlow.enabled ? `On · ${glowTriggers.join(", ") || "no triggers"}` : "Not enabled on line"}</span>
                            </summary>
                            {!lineGlow.enabled && <p className="ml-target-effect-disabled">Glow is not enabled on this line. Enable it below to use these triggers.</p>}
                            <Row label="Enabled"><input type="checkbox" checked={lineGlow.enabled} onChange={() => updateLineDiscrete(line.id, (current) => ({ ...current, glow: { ...current.glow, enabled: !current.glow.enabled } }))} /></Row>
                            <ColorStyleEditor
                              color={lineGlow.color}
                              colorStyle={lineGlow.colorStyle}
                              colorLabel="Inner glow"
                              onColorChange={(color) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, color, colorStyle: { ...(current.glow.colorStyle ?? { type: "solid" as const, colors: [current.glow.color, "#5ee6ff"] }), colors: [color, ...(current.glow.colorStyle?.colors.slice(1) ?? ["#5ee6ff"])] } } }))}
                              onColorStyleChange={(colorStyle) => updateLineDiscrete(line.id, (current) => ({ ...current, glow: { ...current.glow, color: colorStyle.colors[0] ?? current.glow.color, colorStyle } }))}
                              onColorStyleLiveChange={(colorStyle) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, color: colorStyle.colors[0] ?? current.glow.color, colorStyle } }))}
                              onColorChangeStart={captureBeforeChange}
                              onColorChangeEnd={commitPending}
                              onSpeedChange={(speed) => updateLineLive(line.id, (current) => {
                                const colorStyle = current.glow.colorStyle ?? { type: "random" as const, colors: [current.glow.color, "#5ee6ff"] };
                                return { ...current, glow: { ...current.glow, colorStyle: { ...colorStyle, speed } } };
                              })}
                              onSpeedCommitStart={captureBeforeChange}
                              onSpeedCommitEnd={commitPending}
                              onColorWeightsChange={(colorWeights) => updateLineLive(line.id, (current) => {
                                const colorStyle = current.glow.colorStyle ?? { type: "linear" as const, colors: [current.glow.color, "#5ee6ff"] };
                                return { ...current, glow: { ...current.glow, colorStyle: { ...colorStyle, colorWeights } } };
                              })}
                            />
                            <SliderField label="Intensity" value={lineGlow.intensity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, intensity: value } }))} />
                            <SliderField label="Opacity" value={lineGlow.opacity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, opacity: value } }))} />
                            <SliderField label="Radius" value={lineGlow.radius} min={0} max={100} step={0.01} unit="normalized" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, radius: value } }))} />
                            <SliderField label="Length" value={lineGlow.length} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, length: value } }))} />
                            <SliderField label="Falloff" value={lineGlow.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateLineLive(line.id, (current) => ({ ...current, glow: { ...current.glow, falloff: value } }))} />
                            <fieldset className="ml-target-effect-triggers">
                              <legend>Activate Glow on</legend>
                              {activationOptions.map(([activation, label]) => (
                                <label key={activation}>
                                  <input type="checkbox" checked={glowTriggers.includes(activation)} onChange={(event) => updateEffectTriggers("glow", glowTriggers, activation, event.target.checked)} />
                                  {label}
                                </label>
                              ))}
                            </fieldset>
                            {cfg.lineTriggers?.[line.id]?.glow && (
                              <button className="ml-btn" type="button" onClick={() => updateTargetLineTriggers(selectedTargetId, line.id, "glow", null)}>Use target defaults</button>
                            )}
                          </details>
                          <button
                            type="button"
                            className="ml-btn ml-target-full-settings"
                            onClick={() => {
                              closePagePreview();
                              setPanel("editor");
                              selectLineForEditing(line.id);
                              setMagnetSectionExpanded(true);
                              setGlowSectionExpanded(true);
                            }}
                          >Open full line settings</button>
                        </div>
                      );
                    })}
                  </div>
                </Section>
                <div className="ml-target-actions">
                  {cfg.selector && <button className="ml-btn" type="button" onClick={() => startTargetPicking(selectedTargetId)}>Re-pick element</button>}
                  {cfg.selector && <button className="ml-btn ml-danger" type="button" onClick={() => removePickedTarget(selectedTargetId)}>Remove target</button>}
                </div>
              </div>
            );
          })()}
          {panel === "targets" && !selectedTargetConfig && (
            <p className="ml-hint">{pickedTargetDraft ? "Save this picked element to edit its behavior and line layers here." : "Pick a page element, then select it here to edit its behavior and line layers."}</p>
          )}
          {panel === "editor" && globalTargetLineId !== null && !selectedLine && !selectedGroup && <p className="ml-hint">Select a line to edit it.</p>}
          {panel === "editor" && selectedGroup && (
            <>
              <div className="ml-inspector-head">
                <div>
                  {isRenamingGroup && groupRenameLocation === "inspector" ? (
                    <form className="ml-line-rename" onSubmit={(e) => { e.preventDefault(); renameSelectedGroup(); }}>
                      <input
                        autoFocus
                        className="ml-num"
                        type="text"
                        aria-label="Rename group"
                        value={groupNameDraft}
                        onChange={(e) => { setGroupNameDraft(e.target.value); setGroupRenameError(null); }}
                        onKeyDown={(e) => { if (e.key === "Escape") cancelRenamingGroup(); }}
                      />
                      {groupRenameError && <small className="ml-error" role="alert">{groupRenameError}</small>}
                    </form>
                  ) : (
                    <strong onDoubleClick={() => startRenamingGroup(selectedGroup, "inspector")} title="Double-click to rename">{selectedGroup.name}</strong>
                  )}
                  <small className="ml-context-mode">Group · {selectedGroup.lineIds.length} lines</small>
                </div>
                <button className="ml-btn" onClick={() => ungroupLines(selectedGroup.id)}>Ungroup</button>
              </div>
              <p className="ml-hint">Open Group Transform to show the dotted guide. Drag a group line to move it, the corner handle to resize, or the top handle to rotate.</p>
              <Section title="GROUP TRANSFORM" open={groupTransformExpanded} onOpenChange={setGroupTransformExpanded}>
                <small className="ml-gradient-help">The dotted guide does not capture pointer input. Drag a group line to move it, the corner handle to resize, or the top handle to rotate.</small>
                <div className="ml-row">
                  <span className="ml-row-label">Flip</span>
                  <div className="ml-row-control">
                    <button className="ml-btn" type="button" onClick={() => flipSelectedGroup("horizontal")}>Horizontal</button>
                    <button className="ml-btn" type="button" onClick={() => flipSelectedGroup("vertical")}>Vertical</button>
                  </div>
                </div>
              </Section>
            </>
          )}
          {panel === "editor" && globalTargetLineId !== null && selectedLine && (
            <>
              <div className="ml-inspector-head">
                <div>
                  {isRenamingLine && lineRenameLocation === "inspector" ? (
                    <form className="ml-line-rename" onSubmit={(event) => { event.preventDefault(); renameSelectedLine(); }}>
                      <input
                        className="ml-num"
                        type="text"
                        aria-label="Rename line"
                        aria-describedby={lineRenameError ? "ml-line-rename-error" : undefined}
                        autoFocus
                        value={lineNameDraft}
                        onChange={(event) => { setLineNameDraft(event.target.value); setLineRenameError(null); }}
                        onKeyDown={(event) => { if (event.key === "Escape") cancelRenamingSelectedLine(); }}
                      />
                      {lineRenameError && <small id="ml-line-rename-error" className="ml-error" role="alert">{lineRenameError}</small>}
                    </form>
                  ) : (
                    <>
                      <strong onDoubleClick={() => startRenamingLine(selectedLine.id, "inspector")} title="Double-click to rename">{selectedLine.id}</strong>
                      <small className="ml-context-mode">
                        {Object.values(selectedLine.inherit).every(Boolean) ? "Using global defaults" : "Custom settings"}
                      </small>
                    </>
                  )}
                </div>
                <button className="ml-btn" onClick={resetSelectedLine}>Reset Line</button>
              </div>

              <Section title="POSITION" help="Controls the base start and end anchor positions.">
                <div className="ml-position-grid">
                  {([
                    { endpoint: "from", label: "Start", point: selectedLine.from },
                    { endpoint: "to", label: "End", point: selectedLine.to },
                  ] as const).map(({ endpoint, label, point }) => (
                    <fieldset className={`ml-position-card ${endpoint}`} key={endpoint}>
                      <legend>{label}</legend>
                      <div className="ml-coordinate-pair">
                        {(["x", "y"] as const).map((axis) => (
                          <label className="ml-coordinate-field" key={axis}>
                            <span>{axis.toUpperCase()}</span>
                            <ScrubNumberField
                              label={`${label} ${axis.toUpperCase()}`}
                              className="ml-num"
                              min={0}
                              max={1}
                              step={0.001}
                              value={point[axis]}
                              onCommitStart={captureBeforeChange}
                              onCommitEnd={commitPending}
                              onChange={(value) => updateLineEndpoint(selectedLine.id, endpoint, axis, value)}
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </Section>
              <Section title="LINE TRANSFORM" help="Use the canvas bounds to move, resize, and rotate the selected line." open={lineTransformExpanded} onOpenChange={setLineTransformExpanded}>
                <small className="ml-gradient-help">The dotted guide does not capture pointer input. Drag the selected line itself to move it, the corner handle to resize, or the top handle to rotate.</small>
                <div className="ml-row">
                  <span className="ml-row-label">Flip</span>
                  <div className="ml-row-control">
                    <button className="ml-btn" type="button" onClick={() => flipSelectedLine("horizontal")}>Horizontal</button>
                    <button className="ml-btn" type="button" onClick={() => flipSelectedLine("vertical")}>Vertical</button>
                  </div>
                </div>
              </Section>

              <Section title="APPEARANCE" help="Controls the line's base visual appearance and stroke weight.">
                <ColorStyleEditor
                  color={selectedLine.appearance.color}
                  colorStyle={selectedLine.appearance.colorStyle}
                  onColorChange={(color) => updateLineDiscrete(selectedLine.id, (line) => {
                    const colors = line.appearance.colorStyle?.colors ?? [line.appearance.color, "#5ee6ff"];
                    return { ...line, appearance: { ...line.appearance, color, colorStyle: { ...line.appearance.colorStyle, type: line.appearance.colorStyle?.type ?? "solid", colors: [color, ...colors.slice(1)] } } };
                  })}
                  onColorStyleChange={(colorStyle) => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, appearance: { ...line.appearance, color: colorStyle.colors[0] ?? line.appearance.color, colorStyle } }))}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onSpeedChange={(speed) => updateLineLive(selectedLine.id, (line) => {
                    const colorStyle = line.appearance.colorStyle ?? { type: "solid" as const, colors: [line.appearance.color, "#5ee6ff"] };
                    return { ...line, appearance: { ...line.appearance, colorStyle: { ...colorStyle, speed } } };
                  })}
                  onColorWeightsChange={(colorWeights) => updateLineLive(selectedLine.id, (line) => {
                    const colorStyle = line.appearance.colorStyle ?? { type: "solid" as const, colors: [line.appearance.color, "#5ee6ff"] };
                    return { ...line, appearance: { ...line.appearance, colorStyle: { ...colorStyle, colorWeights } } };
                  })}
                />
                <div className="ml-appearance-controls">
                  <CompactValueField label="Opacity" icon="opacity" value={selectedLine.appearance.opacity} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, appearance: { ...l.appearance, opacity: v } }))} />
                  <CompactValueField label="Width" icon="width" value={selectedLine.appearance.width} min={0} max={6} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, appearance: { ...l.appearance, width: v } }))} />
                </div>
                <button className="ml-btn" onClick={() => resetLineScope("appearance")}>Reset to Global</button>
              </Section>



                            <Section
                              title="ANCHOR POINTS"
                              open={anchorPointsExpanded}
                              onOpenChange={(open) => {
                                setAnchorPointsExpanded(open);
                                if (!open) {
                                  setSelectedAnchorPointId(null);
                                  setSelectedAnchorPointIds([]);
                                }
                              }}
                              help={selectedLine.geometrySource === "path"
                                ? "Attach animation points to shape vertices. Overlapping vertices combine into one target."
                                : "Choose a line endpoint as the anchor target. Each target has its own ordered animation route."}
                            >
                              {selectedLine.geometrySource === "path" && (
                                <>
                                  <Row label="Canvas handles">
                                    <div className="ml-anchor-view-toggle" role="group" aria-label="Canvas point display">
                                      {([
                                        ["animation", "Animation"],
                                        ["shape", "Shape"],
                                        ["both", "Both"],
                                      ] as const).map(([mode, label]) => (
                                        <button
                                          key={mode}
                                          type="button"
                                          className={anchorCanvasMode === mode ? "active" : ""}
                                          aria-pressed={anchorCanvasMode === mode}
                                          onClick={() => setAnchorCanvasMode(mode)}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                  </Row>
                                  <Row label="Show shape names">
                                    <input
                                      type="checkbox"
                                      checked={showShapePointLabels}
                                      onChange={(event) => setShowShapePointLabels(event.target.checked)}
                                    />
                                  </Row>
                                  <small className="ml-anchor-legend">
                                    <span><i className="shape" /> S1 = shape vertex</span>
                                    <span><i className="animation" /> S1.1 = animation position</span>
                                  </small>
                                </>
                              )}
                              <Row label="Attach to">
                                <select aria-label="Anchor attachment target" className="ml-select" value={effectiveAnchorTargetToAdd} onChange={(event) => setAnchorTargetToAdd(event.target.value)}>
                                  {anchorTargets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
                                </select>
                              </Row>
                              <button className="ml-btn" onClick={() => addAnchorPoint(effectiveAnchorTargetToAdd)}>+ Add animation point</button>
                              {selectedLine.geometrySource === "path" && (
                                <button
                                  type="button"
                                  className="ml-btn"
                                  disabled={!anchorTargets.some((target) => !selectedLine.anchorPoints.some((point) =>
                                    point.endpoint === "path" && target.pathPointIds?.includes(point.pathPointId ?? "")))}
                                  onClick={addAnchorPointsToAllShapes}
                                >
                                  + Add first point to all shapes
                                </button>
                              )}
                              {selectedLine.anchorPoints.length > 0 && (
                                <div className="ml-anchor-list-actions">
                                  <span>{selectedLine.anchorPoints.length} animation point{selectedLine.anchorPoints.length === 1 ? "" : "s"}</span>
                                  <button
                                    type="button"
                                    className="ml-btn"
                                    onClick={() => setExpandedAnchorPointIds(
                                      allAnchorPointDetailsExpanded
                                        ? []
                                        : [...new Set([...expandedAnchorPointIds, ...selectedLine.anchorPoints.map((point) => point.id)])],
                                    )}
                                  >
                                    {allAnchorPointDetailsExpanded ? "Collapse all" : "Expand all"}
                                  </button>
                                </div>
                              )}
                              {selectedAnchorPointIdsForLine.length > 1 && (
                                <details className="ml-anchor-bulk-edit">
                                  <summary>Edit {selectedAnchorPointIdsForLine.length} selected points</summary>
                                  <form
                                    key={`${selectedLine.id}:${[...selectedAnchorPointIdsForLine].sort().join(",")}`}
                                    onSubmit={applySelectedAnchorSettings}
                                  >
                                  <div className="ml-anchor-bulk-grid">
                                    <label>Order start
                                      <input className="ml-num" type="number" name="order" defaultValue={firstSelectedAnchorPoint?.order ?? 0} min={0} max={9999999} step={1} required />
                                    </label>
                                    <label>Speed
                                      <input className="ml-num" type="number" name="speed" defaultValue={firstSelectedAnchorPoint?.speed ?? 1} min={0.05} max={9999999} step={0.01} required />
                                    </label>
                                    <label>Delay (s)
                                      <input className="ml-num" type="number" name="delay" defaultValue={firstSelectedAnchorPoint?.delay ?? 0} min={0} max={9999999} step={0.01} required />
                                    </label>
                                    <label>Transition
                                      <select
                                        className="ml-select"
                                        name="easing"
                                        defaultValue={firstSelectedAnchorPoint?.easing ?? "ease-in-out"}
                                      >
                                        <option value="ease-in-out">Smooth</option>
                                        <option value="ease-in">Ease in</option>
                                        <option value="ease-out">Ease out</option>
                                        <option value="linear">Linear</option>
                                      </select>
                                    </label>
                                    <label>Type
                                      <select
                                        className="ml-select"
                                        name="type"
                                        defaultValue={firstSelectedAnchorPoint?.type ?? "custom"}
                                      >
                                        <option value="custom">Custom point</option>
                                        <option value="circle">Circle orbit</option>
                                        <option value="ellipse">Ellipse orbit</option>
                                        <option value="square">Square orbit</option>
                                      </select>
                                    </label>
                                    <label>Activate
                                      <select
                                        className="ml-select"
                                        name="activation"
                                        defaultValue={firstSelectedAnchorPoint?.activation ?? "always"}
                                      >
                                        <option value="always">Always</option>
                                        <option value="hover">Hover</option>
                                        <option value="click">Click</option>
                                      </select>
                                    </label>
                                    <label className="ml-anchor-bulk-enabled">
                                      <input
                                        type="checkbox"
                                        name="enabled"
                                        defaultChecked={firstSelectedAnchorPoint?.enabled ?? true}
                                      />
                                      Enabled
                                    </label>
                                  </div>
                                  <button type="submit" className="ml-btn ml-primary">
                                    Apply to {selectedAnchorPointIdsForLine.length} selected
                                  </button>
                                  </form>
                                </details>
                              )}
                              {anchorTargets.filter((target) =>
                                target.endpoint !== "path" || selectedLine.anchorPoints.some((point) =>
                                  point.endpoint === "path" && target.pathPointIds?.includes(point.pathPointId ?? ""))).map((target) => {
                                const { endpoint } = target;
                                const points = selectedLine.anchorPoints
                                  .filter((point) => point.endpoint === endpoint &&
                                    (endpoint !== "path" || target.pathPointIds?.includes(point.pathPointId ?? "")))
                                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                                const lastPoint = points[points.length - 1];
                                return (
                                  <details key={target.value} className={`ml-anchor-group ${endpoint}`}>
                                    <summary className="ml-anchor-group-summary">
                                      <strong><span className="ml-anchor-key" />{target.label} <span className="ml-anchor-count">{points.length}</span></strong>
                                    </summary>
                                    {points.length === 0 ? (
                                      <p className="ml-anchor-empty">No points yet</p>
                                    ) : (
                                      points.map((point, pointIndex) => (
                                        <div key={point.id} className={`ml-anchor-card ${endpoint} ${selectedAnchorPointIdsForLine.includes(point.id) ? "selected" : ""}`}>
                                          <div className="ml-anchor-card-head">
                                            <button
                                              type="button"
                                              className="ml-anchor-point-select"
                                              aria-pressed={selectedAnchorPointIdsForLine.includes(point.id)}
                                              onClick={() => {
                                                setSelectedAnchorPointId(point.id);
                                                setSelectedAnchorPointIds([point.id]);
                                              }}
                                            >
                                              <span className="ml-anchor-key" />
                                              {endpoint === "path" ? `${target.label}.${pointIndex + 1}` : `Point ${point.order + 1}`}
                                            </button>
                                            <button
                                              type="button"
                                              className="ml-btn"
                                              aria-expanded={expandedAnchorPointIds.includes(point.id)}
                                              onClick={() => setExpandedAnchorPointIds((ids) =>
                                                ids.includes(point.id) ? ids.filter((id) => id !== point.id) : [...ids, point.id])}
                                            >
                                              {expandedAnchorPointIds.includes(point.id) ? "Hide settings" : "Edit"}
                                            </button>
                                            <button type="button" className="ml-btn ml-danger" onClick={() => removeAnchorPoint(point.id)}>Remove</button>
                                          </div>
                                          {expandedAnchorPointIds.includes(point.id) && <div className="ml-anchor-card-settings">
                            <Row label="Enabled"><input type="checkbox" checked={point.enabled} onChange={() => updateAnchorPointDiscrete(point.id, { enabled: !point.enabled })} /></Row>
                            <Row label="Type"><select className="ml-select" value={point.type} onChange={(e) => updateAnchorPointDiscrete(point.id, { type: e.target.value as "custom" | "circle" | "ellipse" | "square" })}><option value="custom">custom point</option><option value="circle">circle orbit</option><option value="ellipse">ellipse orbit</option><option value="square">square orbit</option></select></Row>
                            <SegmentedRadioField
                              label="Activate"
                              value={point.activation}
                              options={[{ value: "always", label: "Always" }, { value: "hover", label: "Hover" }, { value: "click", label: "Click" }]}
                              onChange={(activation) => updateAnchorPointDiscrete(point.id, {
                                activation,
                                ...(activation === "hover" ? { hoverExitBehavior: "continue" as const } : {}),
                              })}
                            />
                            {point === lastPoint && (
                              <SegmentedRadioField
                                label="Sequence"
                                value={point.behavior}
                                options={[{ value: "loop", label: "Loop" }, { value: "one-time", label: "Once" }]}
                                onChange={(behavior) => updateAnchorPointDiscrete(point.id, { behavior, loop: behavior === "loop" })}
                              />
                            )}
                            {point.activation === "hover" && <Row label="After leaving"><select className="ml-select" value={point.hoverExitBehavior} onChange={(e) => updateAnchorPointDiscrete(point.id, { hoverExitBehavior: e.target.value as "stay" | "return" | "continue" })}><option value="continue">Continue sequence</option><option value="return">Return to start</option><option value="stay">Freeze in place</option></select></Row>}
                            {point.activation === "click" && (
                              <SegmentedRadioField
                                label="On click"
                                value={point.clickBehavior}
                                options={[{ value: "restart", label: "Restart" }, { value: "toggle", label: "Toggle" }]}
                                onChange={(clickBehavior) => updateAnchorPointDiscrete(point.id, { clickBehavior })}
                              />
                            )}
                            {point === lastPoint && point.behavior === "one-time" && <Row label="When finished"><select className="ml-select" value={point.finishBehavior} onChange={(e) => updateAnchorPointDiscrete(point.id, { finishBehavior: e.target.value as "stay" | "return" })}><option value="stay">Stay at last point</option><option value="return">Return to start</option></select></Row>}
                            {point === lastPoint && <Row label="Transition"><select className="ml-select" value={point.easing} onChange={(e) => updateAnchorPointDiscrete(point.id, { easing: e.target.value as "linear" | "ease-in" | "ease-out" | "ease-in-out" })}><option value="ease-in-out">Smooth</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="linear">Linear</option></select></Row>}
                            <div className="ml-anchor-position-grid">
                              {(["x", "y"] as const).map((axis) => (
                                <label className="ml-coordinate-field" key={axis}>
                                  <span>{axis.toUpperCase()}</span>
                                  <ScrubNumberField
                                    label={`Anchor point ${axis.toUpperCase()}`}
                                    className="ml-num"
                                    min={0}
                                    max={1}
                                    step={0.001}
                                    value={point[axis]}
                                    onCommitStart={captureBeforeChange}
                                    onCommitEnd={commitPending}
                                    onChange={(value) => updateAnchorPoint(point.id, { [axis]: value })}
                                  />
                                </label>
                              ))}
                            </div>
                            <div className="ml-anchor-order-speed">
                              <label className="ml-anchor-value-field">
                                <span>Order</span>
                                <ScrubNumberField
                                  label="Anchor point order"
                                  className="ml-num"
                                  min={0}
                                  max={Math.max(0, points.length - 1)}
                                  step={1}
                                  value={point.order}
                                  onCommitStart={captureBeforeChange}
                                  onCommitEnd={commitPending}
                                  onChange={(value) => updateAnchorPointOrder(point.id, value)}
                                />
                              </label>
                              <label className="ml-anchor-value-field">
                                <span>Speed</span>
                                <ScrubNumberField
                                  label="Anchor point speed"
                                  className="ml-num"
                                  min={0.1}
                                  max={9999999}
                                  step={0.01}
                                  value={point.speed}
                                  onCommitStart={captureBeforeChange}
                                  onCommitEnd={commitPending}
                                  onChange={(value) => updateAnchorPoint(point.id, { speed: value })}
                                />
                              </label>
                            </div>
                            <Row label="Transition delay">
                              <ScrubNumberField
                                label="Anchor transition delay"
                                className="ml-num"
                                min={0}
                                max={9999999}
                                step={0.01}
                                value={point.delay}
                                onCommitStart={captureBeforeChange}
                                onCommitEnd={commitPending}
                                onChange={(value) => updateAnchorPoint(point.id, { delay: value })}
                              />
                            </Row>
                            {point !== lastPoint && <Row label="Transition"><select className="ml-select" value={point.easing} onChange={(e) => updateAnchorPointDiscrete(point.id, { easing: e.target.value as "linear" | "ease-in" | "ease-out" | "ease-in-out" })}><option value="ease-in-out">Smooth</option><option value="ease-in">Ease in</option><option value="ease-out">Ease out</option><option value="linear">Linear</option></select></Row>}
                            {point.type === "circle" && <SliderField label="Radius" value={point.radius} min={0} max={0.5} step={0.005} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateAnchorPoint(point.id, { radius: value })} />}
                            {point.type === "ellipse" && <>
                              <SliderField label="Radius X" value={point.radiusX} min={0} max={0.5} step={0.005} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateAnchorPoint(point.id, { radiusX: value })} />
                              <SliderField label="Radius Y" value={point.radiusY} min={0} max={0.5} step={0.005} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateAnchorPoint(point.id, { radiusY: value })} />
                            </>}
                            {point.type !== "custom" && <>
                              <SliderField label="Rotation" value={point.rotation} min={0} max={6.28} step={0.01} unit="rad" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateAnchorPoint(point.id, { rotation: value })} />
                              {point.type === "square" && <SliderField label="Size" value={point.size} min={0} max={0.5} step={0.005} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(value) => updateAnchorPoint(point.id, { size: value })} />}
                            </>}
                            </div>}
                          </div>
                        ))
                      )}
                    </details>
                  );
                })}
              </Section>
              <Section
                title="GEOMETRY & SHAPE"
                help="Generate an outline, edit its points directly, and save reusable shapes."
                open={geometryExpanded}
                onOpenChange={(open) => {
                  setGeometryExpanded(open);
                  if (!open) setSelectedPathPointId(null);
                }}
              >
                <Row label="Geometry"><select className="ml-select" value={selectedLine.geometrySource} onChange={(e) => {
                  const source = e.target.value as GeometrySource;
                  updateLineDiscrete(selectedLine.id, (line) => ({ ...line, geometrySource: source, generatedShapePreset: undefined }));
                  setSelectedPathPointId(null);
                }}><option value="shape">Line between endpoints</option><option value="path">Editable outline</option></select></Row>
                <small className="ml-gradient-help">{selectedLine.generatedShapePreset
                  ? selectedLine.generatedShapePreset === "smile"
                    ? "Generated emoji-style smiley with editable face, eyes, and mouth paths."
                    : `Generated ${selectedLine.generatedShapePreset.replace("-", " ")} outline. Drag its points to edit it directly.`
                  : selectedLine.geometrySource === "shape"
                    ? "Draws a line between its endpoints. Choose a preset to create an editable outline."
                    : "Drag outline points to edit the shape; nearby points merge on release."}</small>
                <Row label="Generate preset">
                  <select className="ml-select" value="" aria-label="Generate editable shape preset" onChange={(event) => {
                    if (event.target.value) generateShapePreset(event.target.value as GeneratedShapePreset);
                  }}>
                    <option value="">Choose a shape...</option>
                    {GENERATED_SHAPE_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset.replace("-", " ")}</option>
                    ))}
                  </select>
                </Row>
                {selectedLineHasClosedPath && (
                  <>
                    <Row label="Airflow closure">
                      <select className="ml-select" aria-label="Airflow closure" value={selectedLine.customPath.closedJoint ?? "connected"} onChange={(event) => {
                        const closedJoint = event.target.value === "breakable" ? "breakable" : "connected";
                        updateLineDiscrete(selectedLine.id, (line) => ({
                          ...line,
                          customPath: { ...line.customPath, closedJoint },
                        }));
                      }}>
                        <option value="connected">Connected (unbreakable)</option>
                        <option value="breakable">Breakable</option>
                      </select>
                    </Row>
                    <small className="ml-gradient-help">Connected keeps the outline seam welded while it bends. Breakable lets airflow pull the first and last points apart.</small>
                  </>
                )}
                {selectedLine && selectedPathPoint && selectedPathPointIndex > 0 && (
                  <>
                    <Row label="Point join">
                      <select className="ml-select" aria-label="Point join" value={selectedPathPoint.moveTo ? "separate" : "connected"} onChange={(event) => {
                        const separate = event.target.value === "separate";
                        updateLineDiscrete(selectedLine.id, (line) => ({
                          ...line,
                          customPath: {
                            ...line.customPath,
                            points: line.customPath.points.map((point) => {
                              if (point.id !== selectedPathPoint.id) return point;
                              const updatedPoint = { ...point };
                              if (separate) updatedPoint.moveTo = true;
                              else delete updatedPoint.moveTo;
                              return updatedPoint;
                            }),
                          },
                        }));
                      }}>
                        <option value="connected">Connected</option>
                        <option value="separate">Separate stroke</option>
                      </select>
                    </Row>
                    <small className="ml-gradient-help">Connected joins this point to the previous stroke. Separate stroke keeps a deliberate break.</small>
                  </>
                )}
                {selectedLine.geometrySource === "path" && (
                  <>
                    <SliderField
                      label="Curve smoothing"
                      description="Rounds editable path corners with a smooth curve through their control points. Set to 0 to preserve sharp corners."
                      value={selectedLine.customPath.curveSmoothing ?? 0}
                      min={0}
                      max={1}
                      step={0.01}
                      onCommitStart={captureBeforeChange}
                      onCommitEnd={commitPending}
                      onLive={(curveSmoothing) => updateLineLive(selectedLine.id, (line) => ({
                        ...line,
                        customPath: { ...line.customPath, curveSmoothing },
                      }))}
                    />
                    <button className="ml-btn" onClick={addPathPoint}>Add point</button>
                    <button className="ml-btn ml-danger" disabled={!selectedPathPointId || selectedLine.customPath.points.length <= 2} onClick={deletePathPoint}>Delete selected point</button>
                    <small className="ml-gradient-help">Drag any two points within 12 px to merge them. Drag the first point onto the last to close the path.</small>
                  </>
                )}
                <div className="ml-row">
                  <input className="ml-num" aria-label="Saved shape name" placeholder="Shape name" value={lineShapeName} onChange={(event) => { setLineShapeName(event.target.value); setLineShapeError(null); }} />
                  <button type="button" className="ml-btn" onClick={saveSelectedLineShape}>Save shape</button>
                </div>
                {savedLineShapes.length > 0 && (
                  <div className="ml-row">
                    <select className="ml-select" aria-label="Saved shapes" value={selectedSavedLineShapeName} onChange={(event) => {
                      setSelectedSavedLineShapeName(event.target.value);
                      const shape = savedLineShapes.find((item) => item.name === event.target.value);
                      if (shape) applySavedLineShape(shape);
                    }}>
                      <option value="">Apply saved shape...</option>
                      {savedLineShapes.map((shape) => <option key={shape.name} value={shape.name}>{shape.name}</option>)}
                    </select>
                    <button type="button" className="ml-btn ml-danger" disabled={!selectedSavedLineShapeName} onClick={() => removeSavedLineShape(selectedSavedLineShapeName)}>Delete</button>
                  </div>
                )}
                {lineShapeError && <small className="ml-error" role="alert">{lineShapeError}</small>}
                <Row label="Line style"><select className="ml-select" value={selectedLine.shape.type} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, type: e.target.value as ShapeType } }))}><option value="straight">straight (legacy)</option><option value="sharp">sharp corners</option><option value="rounded">rounded corners</option><option value="soft-wave">soft wave</option><option value="organic">organic</option><option value="liquid">liquid</option><option value="floating">floating</option><option value="vibration">vibration</option><option value="pixel">pixel</option></select></Row>
                <Row label="Bendable"><input type="checkbox" checked={selectedLine.shape.bendable !== false} onChange={() => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, shape: { ...line.shape, bendable: line.shape.bendable === false } }))} /></Row>
                {selectedLine.shape.bendable === false && <small className="ml-texture-description">Keeps this shape fixed by disabling its motion, gravity, magnet, cursor, airflow, and line-interaction bending.</small>}
                <ShapeSliderField shapeType={selectedLine.shape.type} control="amplitude" label="Amplitude" value={selectedLine.shape.amplitude} min={0} max={0.12} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, amplitude: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="frequency" label="Frequency" value={selectedLine.shape.frequency} min={0} max={12} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, frequency: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="cycles" label="Cycles" value={selectedLine.shape.cycles} min={0} max={8} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, cycles: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="phase" label="Phase" value={selectedLine.shape.phase} min={0} max={6.28} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, phase: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="smoothness" label="Smoothness" value={selectedLine.shape.smoothness} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, smoothness: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="irregularity" label="Irregularity" value={selectedLine.shape.irregularity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, irregularity: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="distortion" label="Distortion" value={selectedLine.shape.distortion} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, distortion: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="roughness" label="Roughness" value={selectedLine.shape.roughness} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, roughness: v } }))} />
                <ShapeSliderField shapeType={selectedLine.shape.type} control="pixelStep" label="Pixel step" value={selectedLine.shape.pixelStep} min={1} max={32} step={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, shape: { ...l.shape, pixelStep: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("shape")}>Reset to Global</button>
              </Section>

              <Section title="MOTION" help="Animates the line geometry over time using the shared runtime clock.">
                {selectedLine.shape.bendable === false && selectedLine.motion.enabled !== false && (
                  <div className="ml-hint">
                    Motion is enabled, but this rigid line cannot deform.
                    <button type="button" className="ml-btn" onClick={() => enableLineBending(selectedLine.id)}>Enable bending</button>
                  </div>
                )}
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.motion.enabled !== false} onChange={() => {
                  const enabling = selectedLine.motion.enabled === false;
                  updateLineDiscrete(selectedLine.id, (line) => ({
                    ...line,
                    ...(enabling ? { shape: { ...line.shape, bendable: true } } : {}),
                    motion: { ...line.motion, enabled: enabling },
                  }));
                  if (enabling) setTimelinePreviewPlaying(true);
                }} /></Row>
                <SliderField
                  label="Start delay"
                  description="Wait this many seconds after the line is added or its delay is changed before its motion begins. Use different delays to stagger matching lines."
                  value={selectedLine.startDelay ?? 0}
                  min={0}
                  max={9999999}
                  sliderMax={60}
                  step={0.01}
                  unit="s"
                  onCommitStart={captureBeforeChange}
                  onCommitEnd={commitPending}
                  onLive={(startDelay) => updateLineLive(selectedLine.id, (line) => ({ ...line, startDelay }))}
                />
                <Row label="Preset">
                  <select className="ml-select" value="" onChange={(e) => {
                    const preset = MOTION_PRESETS[e.target.value];
                    if (preset) {
                      updateLineDiscrete(selectedLine.id, (line) => ({
                        ...line,
                        shape: { ...line.shape, bendable: true },
                        motion: { ...line.motion, ...preset, enabled: true },
                      }));
                      setTimelinePreviewPlaying(true);
                    }
                  }}>
                    <option value="">Apply preset</option>
                    {Object.keys(MOTION_PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </Row>
                <Row label="Type">
                  <select className="ml-select" value={selectedLine.motion.type} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, type: e.target.value as MotionType } }))}>
                    <option value="tension">tension</option>
                    <option value="floating">floating</option>
                    <option value="vibration">vibration</option>
                  </select>
                </Row>
                <SliderField label="Speed" description="Motion cycles per second. The same value sets the base animation rate for every motion type." value={selectedLine.motion.speed} min={0} max={9999999} sliderMax={100} step={0.001} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, speed: v } }))} />
                <SliderField label="Amplitude" value={selectedLine.motion.amplitude} min={0} max={9999999} sliderMax={100} step={0.001} description="Peak motion displacement as a fraction of the viewport's shorter side." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, amplitude: v } }))} />
                <SliderField label="Frequency" value={selectedLine.motion.frequency} min={0} max={9999999} sliderMax={100} step={0.001} disabled={selectedLine.motion.type === "tension"} description={selectedLine.motion.type === "tension" ? "Tension uses a single smooth bend and does not use spatial frequency." : "Spatial wave cycles along the line for Floating and Vibration."} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, frequency: v } }))} />
                <SliderField label="Phase" value={selectedLine.motion.phase} min={0} max={9999999} sliderMax={100} step={0.001} unit="rad" description="Starting phase offset in radians." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, phase: v } }))} />
                <SliderField label="Magnet response" description="Scales deformation from magnetic targets only; it does not change ambient motion." value={selectedLine.motion.deformability} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, deformability: v } }))} />
              </Section>

              <Section title="MAGNET" open={magnetSectionExpanded} onOpenChange={setMagnetSectionExpanded} help="Pulls the line toward a registered target while that target is hovered, focused, or touched.">
                {targetSnapshots.length === 0 && (
                  <p className="ml-hint">No targets are registered on this editor page. Use Save &amp; Test to try the homepage targets, or register a MagneticTarget in your page.</p>
                )}
                                <Row label="Target"><select className="ml-select" value={selectedLine.magnet.targetId || ""} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, targetId: e.target.value || null } }))}><option value="">global / highest priority</option>{magnetTargetIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></Row>
<Row label="Enabled"><input type="checkbox" checked={selectedLine.magnet.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, enabled: !l.magnet.enabled } }))} /></Row>
                <SliderField label="Strength" value={selectedLine.magnet.strength} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, strength: v } }))} />
                <SliderField label="Radius" value={selectedLine.magnet.radius} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, radius: v } }))} />
                <SliderField label="Falloff" value={selectedLine.magnet.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, falloff: v } }))} />
                <SliderField label="Max Deform" value={selectedLine.magnet.maxDeformation} min={0} max={100} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, maxDeformation: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("magnet")}>Reset to Global</button>
              </Section>

              <Section title="GLOW" open={glowSectionExpanded} onOpenChange={setGlowSectionExpanded} help="Inner glow follows the pointer or active target along a line. Outer glow adds a softer halo to nearby lines when a line is lit. Customize each glow separately. Radius previews show while this section is open.">
                <div className="ml-glow-subheading">INNER GLOW · TARGET ACTIVATED</div>
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.glow.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, enabled: !l.glow.enabled } }))} /></Row>
                <ColorStyleEditor
                  color={selectedLine.glow.color}
                  colorStyle={selectedLine.glow.colorStyle}
                  colorLabel="Inner glow"
                  onColorChange={(color) => updateLineLive(selectedLine.id, (line) => ({ ...line, glow: { ...line.glow, color, colorStyle: { ...(line.glow.colorStyle ?? { type: "solid" as const, colors: [line.glow.color, "#5ee6ff"] }), colors: [color, ...(line.glow.colorStyle?.colors.slice(1) ?? ["#5ee6ff"])] } } }))}
                  onColorStyleChange={(colorStyle) => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, glow: { ...line.glow, color: colorStyle.colors[0] ?? line.glow.color, colorStyle } }))}
                  onColorStyleLiveChange={(colorStyle) => updateLineLive(selectedLine.id, (line) => ({ ...line, glow: { ...line.glow, color: colorStyle.colors[0] ?? line.glow.color, colorStyle } }))}
                  onColorChangeStart={captureBeforeChange}
                  onColorChangeEnd={commitPending}
                  onSpeedChange={(speed) => updateLineLive(selectedLine.id, (line) => {
                    const style = line.glow.colorStyle ?? { type: "random" as const, colors: [line.glow.color, "#5ee6ff"] };
                    return { ...line, glow: { ...line.glow, colorStyle: { ...style, speed } } };
                  })}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onColorWeightsChange={(colorWeights) => updateLineLive(selectedLine.id, (line) => {
                    const style = line.glow.colorStyle ?? { type: "linear" as const, colors: [line.glow.color, "#5ee6ff"] };
                    return { ...line, glow: { ...line.glow, colorStyle: { ...style, colorWeights } } };
                  })}
                />
                <SliderField label="Intensity" description="Glow strength/brightness. 0 turns the effect off; 100 is maximum strength before opacity and Max Combined are applied." value={selectedLine.glow.intensity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, intensity: v } }))} />
                <SliderField label="Opacity" value={selectedLine.glow.opacity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, opacity: v } }))} />
                <SliderField label="Radius" description="Maximum distance from a rendered line for an active magnetic target to produce inner glow." value={selectedLine.glow.radius} min={0} max={100} step={0.01} unit="normalized" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, radius: v } }))} />
                <SliderField label="Length" description="How much of the line lights around the closest point: 0 is a small local spot; 100 spreads glow along the whole line." value={selectedLine.glow.length} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, length: v } }))} />
                <SliderField label="Falloff" description="How glow fades with distance: 0 is a linear fade; 100 uses a smoother S-curve toward the radius edge." value={selectedLine.glow.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, falloff: v } }))} />
                <fieldset className="ml-glow-preview-options">
                  <legend>Show radius on canvas</legend>
                  <label><input type="checkbox" checked={showGlowRadiusPreview.inner} onChange={() => setShowGlowRadiusPreview((current) => ({ ...current, inner: !current.inner }))} />Inner radius</label>
                  <label><input type="checkbox" checked={showGlowRadiusPreview.outer} onChange={() => setShowGlowRadiusPreview((current) => ({ ...current, outer: !current.outer }))} />Outer radius</label>
                </fieldset>
                {(showGlowRadiusPreview.inner || showGlowRadiusPreview.outer) && <small className="ml-gradient-help">Each preview shows the configured distance from the selected line&apos;s rendered path. Inner and outer radii are independent.</small>}
                <div className="ml-glow-subheading">OUTER GLOW · SOFT HALO ON NEARBY LINES</div>
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.outerGlow.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, enabled: !line.outerGlow.enabled } }))} /></Row>
                <ColorStyleEditor
                  color={selectedLine.outerGlow.color}
                  colorStyle={selectedLine.outerGlow.colorStyle}
                  colorLabel="Outer glow"
                  onColorChange={(color) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, color, colorStyle: { ...(line.outerGlow.colorStyle ?? { type: "solid" as const, colors: [line.outerGlow.color, "#5ee6ff"] }), colors: [color, ...(line.outerGlow.colorStyle?.colors.slice(1) ?? ["#5ee6ff"])] } } }))}
                  onColorStyleChange={(colorStyle) => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, color: colorStyle.colors[0] ?? line.outerGlow.color, colorStyle } }))}
                  onColorStyleLiveChange={(colorStyle) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, color: colorStyle.colors[0] ?? line.outerGlow.color, colorStyle } }))}
                  onColorChangeStart={captureBeforeChange}
                  onColorChangeEnd={commitPending}
                  onSpeedChange={(speed) => updateLineLive(selectedLine.id, (line) => {
                    const style = line.outerGlow.colorStyle ?? { type: "random" as const, colors: [line.outerGlow.color, "#5ee6ff"] };
                    return { ...line, outerGlow: { ...line.outerGlow, colorStyle: { ...style, speed } } };
                  })}
                  onSpeedCommitStart={captureBeforeChange}
                  onSpeedCommitEnd={commitPending}
                  onColorWeightsChange={(colorWeights) => updateLineLive(selectedLine.id, (line) => {
                    const style = line.outerGlow.colorStyle ?? { type: "linear" as const, colors: [line.outerGlow.color, "#5ee6ff"] };
                    return { ...line, outerGlow: { ...line.outerGlow, colorStyle: { ...style, colorWeights } } };
                  })}
                />
                <SliderField label="Intensity" description="Glow strength/brightness. 0 turns the effect off; 100 is maximum strength before opacity and Max Combined are applied." value={selectedLine.outerGlow.intensity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, intensity: v } }))} />
                <SliderField label="Opacity" value={selectedLine.outerGlow.opacity} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, opacity: v } }))} />
                <SliderField label="Radius" description="Maximum distance from a target-activated line for neighboring lines to receive outer glow." value={selectedLine.outerGlow.radius} min={0} max={100} step={0.01} unit="normalized" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, radius: v } }))} />
                <SliderField label="Length" description="How much of this line lights around the closest point to the target-activated line: 0 is local; 100 spreads glow along the whole line." value={selectedLine.outerGlow.length} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, length: v } }))} />
                <SliderField label="Falloff" description="How outer glow fades with distance: 0 is a linear fade; 100 uses a smoother S-curve toward the radius edge." value={selectedLine.outerGlow.falloff} min={0} max={100} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, falloff: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("outerGlow")}>Reset to Global</button>
              </Section>

              <Section title="CURSOR INFLUENCE" defaultOpen={false} help="Deforms the line around the cursor. Soft spreads influence more gently across the radius; focused concentrates it near the cursor; Follow controls how quickly the line catches up.">
                {selectedLine.shape.bendable === false && selectedLine.cursorInfluence.enabled && (
                  <div className="ml-hint">
                    Cursor influence is enabled, but this rigid line cannot deform.
                    <button type="button" className="ml-btn" onClick={() => enableLineBending(selectedLine.id)}>Enable bending</button>
                  </div>
                )}
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.cursorInfluence.enabled} onChange={() => {
                  const enabling = !selectedLine.cursorInfluence.enabled;
                  updateLineDiscrete(selectedLine.id, (line) => ({
                    ...line,
                    ...(enabling ? { shape: { ...line.shape, bendable: true } } : {}),
                    cursorInfluence: { ...line.cursorInfluence, enabled: !line.cursorInfluence.enabled },
                  }));
                  if (enabling) setTimelinePreviewPlaying(true);
                }} /></Row>
                <Row label="Response"><select className="ml-select" value={selectedLine.cursorInfluence.profile} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, profile: e.target.value as "soft" | "balanced" | "focused" } }))}><option value="soft">soft</option><option value="balanced">balanced</option><option value="focused">focused</option></select></Row>
                <SliderField label="Follow" description="How quickly the line catches up to the cursor. Lower values feel snappy; higher values feel smoother and more floaty." value={selectedLine.cursorInfluence.smoothing} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, smoothing: v } }))} />
                <SliderField label="Strength" description="Multiplier for cursor movement. Values above 1 reach the deformation limit sooner; Max Deform still caps the offset." value={selectedLine.cursorInfluence.strength} min={0} max={2} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, strength: v } }))} />
                <SliderField label="Radius" description="Influence distance as a fraction of the viewport's shorter dimension. The cursor only bends the line inside this range." value={selectedLine.cursorInfluence.radius} min={0} max={1} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, radius: v } }))} />
                <SliderField label="Falloff" description="Shapes how influence fades across the radius: 0 is linear; 1 uses a smooth S-curve. This is a blend control, so values above 1 would not add a stronger effect." value={selectedLine.cursorInfluence.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, falloff: v } }))} />
                <SliderField label="Max Deform" description="Hard limit for how far the line may move, as a fraction of the viewport's shorter dimension. Large values can create dramatic bends." value={selectedLine.cursorInfluence.maxDeformation} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, maxDeformation: v } }))} />
                <Row label="Mode"><select className="ml-select" value={selectedLine.cursorInfluence.mode} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, mode: e.target.value as "attract" | "repel" } }))}><option value="attract">attract</option><option value="repel">repel</option></select></Row>
                <button className="ml-btn" onClick={() => resetLineScope("cursorInfluence")}>Reset to Global</button>
              </Section>
              <Section title="TEXTURE" defaultOpen={false} help="Choose film grain, lustrous silk, twisted rope, or a string of round beads. Each texture follows the animated line; bead thread visibility is optional.">
                <small className="ml-texture-description ml-texture-performance-note">Per-line and opt-in. Enable it only on focal lines to keep rendering light.</small>
                <div className="ml-texture-presets" role="group" aria-label="Texture presets">
                  {TEXTURE_PRESETS.map((preset) => {
                    const active = selectedLine.texture.enabled
                      && selectedLine.texture.type === preset.type
                      && selectedLine.texture.scale === preset.scale
                      && selectedLine.texture.intensity === preset.intensity
                      && selectedLine.texture.weight === preset.weight;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={`ml-texture-preset${active ? " active" : ""}`}
                        aria-label={`Apply ${preset.label} texture preset`}
                        aria-pressed={active}
                        onClick={() => updateLineDiscrete(selectedLine.id, (line) => ({
                          ...line,
                          texture: { ...line.texture, enabled: true, type: preset.type, scale: preset.scale, intensity: preset.intensity, weight: preset.weight },
                        }))}
                      >
                        <TexturePresetPreview type={preset.type} />
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.texture.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, enabled: !l.texture.enabled } }))} /></Row>
                <Row label="Type"><select className="ml-select" aria-label="Texture type" value={selectedLine.texture.type} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => {
                  const type = e.target.value as TextureType;
                  return { ...l, texture: { ...l.texture, type, weight: getDefaultTextureWeight(type) } };
                })}><option value="grain">Film grain</option><option value="fiber">Directional fibers</option><option value="silk">Silk</option><option value="rope">Rope</option><option value="beads">Beads / necklace</option><option value="metal">Brushed metal</option></select></Row>
                <small className="ml-texture-description">{{
                  grain: "Fine irregular speckling for a soft, paper-like surface.",
                  fiber: "Short directional strands for brushed or fibrous surfaces.",
                  silk: `${selectedLine.texture.silkStrands} fine strands form an irregular, lightly overlapping bundle. Airflow is smoothed across the bundle so the threads bend together.`,
                  rope: "Alternating raised strands create a twisted, braided appearance.",
                  beads: "Rounded, separated beads; the fine supporting thread can be hidden.",
                  metal: "Layered brushed highlights with a heavier, more resistant response.",
                }[selectedLine.texture.type]}</small>
                {selectedLine.texture.type === "beads" && <Row label="Show thread"><input type="checkbox" checked={selectedLine.texture.showThread} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, showThread: !l.texture.showThread } }))} /></Row>}
                {selectedLine.texture.type === "silk" && <SliderField label="Silk filaments" description="Controls how many separate threads make up this line." value={selectedLine.texture.silkStrands} min={1} max={24} step={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(silkStrands) => updateLineLive(selectedLine.id, (line) => ({ ...line, texture: { ...line.texture, silkStrands } }))} />}
                <SliderField label="Scale" description={selectedLine.texture.type === "grain" ? "Controls grain size: lower values create finer detail." : selectedLine.texture.type === "beads" ? "Controls bead spacing and size." : "Controls material detail size and spacing."} value={selectedLine.texture.scale} min={0.005} max={0.1} step={0.001} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, scale: v } }))} />
                <SliderField label="Intensity" description="Controls how strongly the texture shows over the line." value={selectedLine.texture.intensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, intensity: v } }))} />
                <SliderField label="Material weight" description="Higher weight resists cursor and airflow motion. Silk presets are light; rope, beads, and metal are heavier." value={selectedLine.texture.weight} min={0.1} max={4} step={0.05} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, weight: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("texture")}>Reset to Global</button>
              </Section>
              <Section title="FLOW & ENERGY" defaultOpen={false} help="Energy effects follow the selected material's strands or supporting path and do not replace its texture.">
                <small className="ml-texture-description ml-texture-performance-note">Per-line and opt-in. Flow adapts to silk filaments, rope plies, and the supporting paths of paper, beads, and metal.</small>
                <FlowSettings
                  flow={selectedLine.flow}
                  onLive={(flow) => updateLineLive(selectedLine.id, (line) => ({ ...line, flow }))}
                  onDiscrete={(flow) => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, flow }))}
                  onCommitStart={captureBeforeChange}
                  onCommitEnd={commitPending}
                />
                <button className="ml-btn" onClick={() => resetLineScope("flow")}>Reset to Global</button>
              </Section>
              <Section title="ENVIRONMENT" open={environmentSectionExpanded} onOpenChange={(open) => {
                setEnvironmentSectionExpanded(open);
                if (!open) setEnvironmentPathEditing(false);
              }} help="Enable this line's environment, then choose global or individual airflow and light separately. Individual settings support multiple airflow paths and animated light sources.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.environmentEnabled} onChange={() => {
                  if (selectedLine.environmentEnabled) {
                    setEnvironmentPathEditing(false);
                    setEnvironmentPathLineId(null);
                  }
                  updateLineDiscrete(selectedLine.id, (line) => ({ ...line, environmentEnabled: !line.environmentEnabled }));
                }} /></Row>
                <Row label="Airflow source"><select className="ml-select" aria-label="Airflow source" value={selectedLine.environment.airflowMode} onChange={(e) => {
                  setEnvironmentPathEditing(false);
                  setEnvironmentPathLineId(null);
                  updateLineDiscrete(selectedLine.id, (line) => ({
                    ...line,
                    environment: { ...line.environment, airflowMode: e.target.value as "off" | "global" | "individual" },
                  }));
                }}><option value="off">Off</option><option value="global">Global settings</option><option value="individual">Individual settings</option></select></Row>
                {selectedLine.environment.airflowMode === "global" && (!g.environment.enabled || !g.environment.airflowEnabled) && (
                  <small className="ml-texture-description">This line is opted into global airflow, but the shared environment and airflow must both be enabled in Lines + Global.</small>
                )}
                {!selectedLine.environmentEnabled && (
                  <small className="ml-texture-description">This line&apos;s environment is disabled. Choose a source now, then enable the line to apply it.</small>
                )}
                {selectedLine.environment.airflowMode === "individual" && (
                  <>
                    <button type="button" className="ml-btn" disabled={!selectedLine.environmentEnabled || selectedLine.environment.airflowPaths.length >= 8} onClick={() => {
                      const pathIndex = selectedLine.environment.airflowPaths.length;
                      updateLineDiscrete(selectedLine.id, (line) => ({
                        ...line,
                        environment: {
                          ...line.environment,
                          airflowPaths: [...line.environment.airflowPaths, []],
                          airflowRadii: [
                            ...line.environment.airflowPaths.map((_, index) =>
                              line.environment.airflowRadii[index] ?? line.environment.airflowRadius),
                            line.environment.airflowRadius,
                          ],
                        },
                      }));
                      setEnvironmentPathLineId(selectedLine.id);
                      setEnvironmentPathIndex(pathIndex);
                      setEnvironmentPathEditing(true);
                    }}>+ Add airflow path</button>
                    {selectedLine.environment.airflowPaths.map((path, index) => {
                      const isDrawing = environmentPathEditing &&
                        environmentPathLineId === selectedLine.id &&
                        environmentPathIndex === index;
                      return (
                        <div className="ml-environment-source" key={`airflow-${index}`}>
                          <div className="ml-line-actions">
                            <span className="ml-texture-description">Flow {index + 1}{path.length >= 2 ? "" : " · not drawn"}</span>
                            <button type="button" className={`ml-btn${isDrawing ? " ml-primary" : ""}`} disabled={!selectedLine.environmentEnabled} onClick={() => {
                              if (isDrawing) {
                                setEnvironmentPathEditing(false);
                                setEnvironmentPathLineId(null);
                                return;
                              }
                              setEnvironmentPathLineId(selectedLine.id);
                              setEnvironmentPathIndex(index);
                              setEnvironmentPathEditing(true);
                            }}>{isDrawing ? "Cancel drawing" : path.length >= 2 ? "Redraw" : "Draw"}</button>
                            <button type="button" className="ml-btn" onClick={() => {
                              const airflowPaths = selectedLine.environment.airflowPaths.filter((_, pathIndex) => pathIndex !== index);
                              const airflowRadii = selectedLine.environment.airflowRadii.filter((_, pathIndex) => pathIndex !== index);
                              updateLineDiscrete(selectedLine.id, (line) => ({
                                ...line,
                                environment: { ...line.environment, airflowPaths, airflowRadii, airflowPath: airflowPaths[0] ?? [] },
                              }));
                              setEnvironmentPathEditing(false);
                              setEnvironmentPathLineId(null);
                              setEnvironmentPathIndex(0);
                            }}>Remove</button>
                          </div>
                          {isDrawing && <small className="ml-texture-description">Drag on the canvas to draw Flow {index + 1}.</small>}
                          <SliderField label="Influence radius" description="Each flow controls its own reach; the translucent corridor shows its size." value={selectedLine.environment.airflowRadii[index] ?? selectedLine.environment.airflowRadius} min={0.005} max={1} step={0.005} unit="norm" disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(airflowRadius) => updateLineLive(selectedLine.id, (line) => ({
                            ...line,
                            environment: {
                              ...line.environment,
                              airflowRadii: line.environment.airflowPaths.map((_, pathIndex) =>
                                pathIndex === index
                                  ? airflowRadius
                                  : line.environment.airflowRadii[pathIndex] ?? line.environment.airflowRadius),
                            },
                          }))} />
                        </div>
                      );
                    })}
                    <Row label="Air behavior"><select className="ml-select" value={selectedLine.environment.airflowBehavior} disabled={!selectedLine.environmentEnabled} onChange={(e) => updateLineDiscrete(selectedLine.id, (line) => ({
                      ...line,
                      environment: { ...line.environment, airflowBehavior: e.target.value as AirflowBehavior },
                    }))}>
                      <option value="steady">Steady</option><option value="gentle">Gentle breeze</option><option value="gusty">Gusty wind</option><option value="storm">Storm / hurricane</option><option value="random">Random: calm, breeze, gusts</option>
                    </select></Row>
                    <SliderField label="Air strength" value={selectedLine.environment.airflowStrength} min={0} max={2} step={0.01} disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(airflowStrength) => updateLineLive(selectedLine.id, (line) => ({ ...line, environment: { ...line.environment, airflowStrength } }))} />
                    <SliderField label="Air speed" value={selectedLine.environment.airflowSpeed} min={0} max={4} step={0.01} disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(airflowSpeed) => updateLineLive(selectedLine.id, (line) => ({ ...line, environment: { ...line.environment, airflowSpeed } }))} />
                  </>
                )}
                <Row label="Light source"><select className="ml-select" aria-label="Light source" value={selectedLine.environment.lightMode} onChange={(e) => updateLineDiscrete(selectedLine.id, (line) => ({
                  ...line,
                  environment: { ...line.environment, lightMode: e.target.value as "off" | "global" | "individual" },
                }))}><option value="off">Off</option><option value="global">Global settings</option><option value="individual">Individual settings</option></select></Row>
                {selectedLine.environment.lightMode === "global" && (!g.environment.enabled || !g.environment.lightEnabled) && (
                  <small className="ml-texture-description">This line is opted into the global light, but the shared environment and light must both be enabled in Lines + Global.</small>
                )}
                {selectedLine.environment.lightMode === "individual" && (
                  <>
                    <button type="button" className="ml-btn" disabled={!selectedLine.environmentEnabled || selectedLine.environment.lights.length >= 8} onClick={() => {
                      const id = `light-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
                      const position = { x: 0.5, y: 0.3 };
                      const light: EnvironmentLightConfig = {
                        id,
                        color: selectedLine.environment.lightColor,
                        position,
                        endPosition: position,
                        intensity: selectedLine.environment.lightIntensity,
                        radius: selectedLine.environment.lightRadius,
                        speed: 0,
                        playback: "loop",
                      };
                      updateLineDiscrete(selectedLine.id, (line) => ({
                        ...line,
                        environment: { ...line.environment, lights: [...line.environment.lights, light] },
                      }));
                    }}>+ Add light source</button>
                    {selectedLine.environment.lights.map((light, index) => (
                      <div className="ml-environment-source" key={light.id}>
                        <div className="ml-line-actions">
                          <strong className="ml-texture-description">Light {index + 1}</strong>
                          <button type="button" className="ml-btn" onClick={() => updateLineDiscrete(selectedLine.id, (line) => ({
                            ...line,
                            environment: { ...line.environment, lights: line.environment.lights.filter((item) => item.id !== light.id) },
                          }))}>Remove</button>
                        </div>
                        <ColorPickerControl label={`Light ${index + 1} color`} color={light.color} onChange={(color) => updateLineDiscrete(selectedLine.id, (line) => ({
                          ...line,
                          environment: { ...line.environment, lights: line.environment.lights.map((item) => item.id === light.id ? { ...item, color } : item) },
                        }))} />
                        <SliderField label="Intensity" value={light.intensity} min={0} max={1} step={0.01} disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(intensity) => updateLineLive(selectedLine.id, (line) => ({
                          ...line,
                          environment: { ...line.environment, lights: line.environment.lights.map((item) => item.id === light.id ? { ...item, intensity } : item) },
                        }))} />
                        <SliderField label="Radius" value={light.radius} min={0.05} max={1} step={0.005} unit="norm" disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(radius) => updateLineLive(selectedLine.id, (line) => ({
                          ...line,
                          environment: { ...line.environment, lights: line.environment.lights.map((item) => item.id === light.id ? { ...item, radius } : item) },
                        }))} />
                        <SliderField label="Travel speed" description="The light moves from its start marker to its end marker at this many trips per second." value={light.speed} min={0} max={2} step={0.01} disabled={!selectedLine.environmentEnabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(speed) => updateLineLive(selectedLine.id, (line) => ({
                          ...line,
                          environment: { ...line.environment, lights: line.environment.lights.map((item) => item.id === light.id ? { ...item, speed } : item) },
                        }))} />
                        <Row label="Travel mode"><select className="ml-select" value={light.playback} disabled={!selectedLine.environmentEnabled} onChange={(event) => updateLineDiscrete(selectedLine.id, (line) => ({
                          ...line,
                          environment: { ...line.environment, lights: line.environment.lights.map((item) => item.id === light.id ? { ...item, playback: event.target.value as "loop" | "once" } : item) },
                        }))}>
                          <option value="loop">Loop</option><option value="once">Once, then stop</option>
                        </select></Row>
                        <small className="ml-texture-description">Drag the filled start and outlined end markers on the canvas to set its travel path.</small>
                      </div>
                    ))}
                  </>
                )}
                <small className="ml-texture-description">Silk and other materials respond according to their weight and finish.</small>
              </Section>

              <Section title="GRAVITY" defaultOpen={false} help="Pulls every unpinned point downward. Leave all points free to let the whole line settle at the bottom, or pin selected endpoints and vertices to hold parts of a shape in place.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.gravity.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, gravity: { ...line.gravity, enabled: !line.gravity.enabled } }))} /></Row>
                <SliderField label="Strength" description="Controls how strongly unpinned parts sag between fixed points. With no pins, the whole line settles at the bottom edge." value={selectedLine.gravity.strength} min={0} max={1.5} step={0.01} unit="×" disabled={!selectedLine.gravity.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(strength) => updateLineLive(selectedLine.id, (line) => ({ ...line, gravity: { ...line.gravity, strength } }))} />
                <Row label="Anchoring">
                  <select className="ml-select" aria-label="Gravity anchoring" value={selectedLine.gravity.fixedPointIds.length ? "pinned" : "free"} disabled={!selectedLine.gravity.enabled} onChange={(event) => {
                    const fixedPointIds = event.target.value === "pinned"
                      ? selectedLine.gravity.fixedPointIds.length ? selectedLine.gravity.fixedPointIds : ["start", "end"]
                      : [];
                    updateLineDiscrete(selectedLine.id, (line) => ({ ...line, gravity: { ...line.gravity, fixedPointIds } }));
                  }}>
                    <option value="pinned">Pin selected points</option>
                    <option value="free">Free (no pinned points)</option>
                  </select>
                </Row>
                {selectedLine.gravity.fixedPointIds.length > 0 && gravityPointOptions.map((point) => (
                  <Row key={point.id} label={point.label}>
                    <input type="checkbox" aria-label={`Pin ${point.label} for gravity`} checked={selectedLine.gravity.fixedPointIds.includes(point.id)} disabled={!selectedLine.gravity.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (line) => {
                      const fixedPointIds = line.gravity.fixedPointIds.includes(point.id)
                        ? line.gravity.fixedPointIds.filter((id) => id !== point.id)
                        : [...line.gravity.fixedPointIds, point.id];
                      return { ...line, gravity: { ...line.gravity, fixedPointIds } };
                    })} />
                  </Row>
                ))}
                <small className="ml-texture-description">{selectedLine.geometrySource === "path"
                  ? "Editable shapes let you pin any vertex; add outline points in Geometry & Shape to create more anchor choices."
                  : "Pin either endpoint or both. With both pinned, gravity sags the line between them."}</small>
              </Section>

              <Section title="LINE INTERACTION" defaultOpen={false} help="This line softly bends away from nearby stroke segments. Other lines remain obstacles even when their own interaction is disabled; separate shape strokes are checked independently.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.lineInteraction.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, enabled: !l.lineInteraction.enabled } }))} /></Row>
                <SliderField label="Strength" value={selectedLine.lineInteraction.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, strength: v } }))} />
                <SliderField label="Clearance" description="Soft avoidance targets this much space between visible strokes. Radius controls how gradually lines begin bending." value={selectedLine.lineInteraction.clearance} min={0} max={0.1} step={0.001} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, clearance: v } }))} />
                <SliderField label="Influence radius" value={selectedLine.lineInteraction.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, radius: v } }))} />
                <SliderField label="Falloff" value={selectedLine.lineInteraction.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, falloff: v } }))} />
                <Row label="Mode"><select className="ml-select" value={selectedLine.lineInteraction.mode} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, mode: "avoid" } }))}><option value="avoid">avoid</option></select></Row>
                <button className="ml-btn" onClick={() => resetLineScope("lineInteraction")}>Reset to Global</button>
              </Section>
              <Section title="CROSSING GAPS" defaultOpen={false} help="When this line is behind a higher layer, it can leave a clean gap around the crossing. Gap width is extra clearance beyond both stroke widths.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.occlusion.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, occlusion: { ...l.occlusion, enabled: !l.occlusion.enabled } }))} /></Row>
                <SliderField label="Gap width" description="Extra clearance at crossings, beyond the width of both strokes. Set to 0 for a tight cut." value={selectedLine.occlusion.gapWidth} min={0} max={24} step={0.5} unit="px" disabled={!selectedLine.occlusion.enabled} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(gapWidth) => updateLineLive(selectedLine.id, (line) => ({ ...line, occlusion: { ...line.occlusion, gapWidth } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("occlusion")}>Reset to Global</button>
              </Section>              <Section title="LAYER" defaultOpen={false} help="Reorder this line in the visual stack. Higher layers draw over lower layers; drag items in the Layers list to reorder a block.">
                <small className="ml-texture-description">Layer {selectedLayerIndex + 1} of {layerStack.length} · higher layers draw in front</small>
                <div className="ml-layer-order-actions">
                  <button type="button" className="ml-btn" disabled={selectedLayerIndex <= 0} onClick={() => moveSelectedLayer("bottom")}>To back</button>
                  <button type="button" className="ml-btn" disabled={selectedLayerIndex <= 0} onClick={() => moveSelectedLayer("back")}>Back one</button>
                  <button type="button" className="ml-btn" disabled={selectedLayerIndex < 0 || selectedLayerIndex >= layerStack.length - 1} onClick={() => moveSelectedLayer("forward")}>Forward one</button>
                  <button type="button" className="ml-btn" disabled={selectedLayerIndex < 0 || selectedLayerIndex >= layerStack.length - 1} onClick={() => moveSelectedLayer("top")}>To front</button>
                </div>
                <details className="ml-layer-advanced">
                  <summary>Advanced: exact layer value</summary>
                  <Row label="Z-Index"><ScrubNumberField label="Z-Index" step={1} value={selectedLine.appearance.zIndex} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onChange={(value) => updateLineLive(selectedLine.id, (line) => ({ ...line, appearance: { ...line.appearance, zIndex: Math.round(value) } }))} /></Row>
                </details>
              </Section>
            </>
          )}
        </div>
      </div>

      {panel === "editor" && selectedLine && (
        <section className={`ml-animation-dock ${timelineExpanded ? "expanded" : "collapsed"}`} aria-label="Line animation timeline">
          <div className="ml-animation-dock-head">
            <div>
              <strong>Animation timeline</strong>
              <span>{animatedTimelineTrackCount} animated · {timelineAnchorTracks.length} {selectedLine.geometrySource === "path" ? "shape points" : "endpoints"} · {timelineStepCount} steps</span>
            </div>
            <div className="ml-animation-dock-actions">
              <button
                type="button"
                className="ml-btn"
                disabled={selectedLine.geometrySource === "path" && selectedShapeTrackValues.length === 0 && animatedTimelineTrackCount === 0}
                onClick={addNextAnimationStep}
              >
                + {selectedLine.geometrySource === "shape"
                  ? animatedTimelineTrackCount === 0
                    ? "Add endpoint animation"
                    : `Add next step to ${selectedShapeTrackValues.length > 0 ? selectedShapeTrackValues.length : animatedTimelineTrackCount} endpoint tracks`
                  : selectedShapeTrackValues.length > 0
                  ? `Add step to ${selectedShapeTrackValues.length} tracks`
                  : `Add next step to ${animatedTimelineTrackCount} tracks`}
              </button>
              <button
                type="button"
                className="ml-btn"
                disabled={selectedTimelineStepIndices.length !== 1 || !selectedAnchorPointIdsForLine.some((id) =>
                  selectedLine.anchorPoints.some((point) => point.id === id))}
                onClick={resetSelectedAnchorPointsToPreviousStep}
                title={selectedLine.geometrySource === "path"
                  ? "Move the selected step's points to their previous-step positions"
                  : "Move the selected endpoint steps back to the line's original endpoints"}
              >
                {selectedLine.geometrySource === "path" ? "Reset to previous step" : "Reset to initial step"}
              </button>
              <button
                type="button"
                className="ml-btn"
                disabled={selectedLine.geometrySource !== "path" || selectedTimelineStepIndices.length !== 1}
                onClick={seekPreviewToSelectedStepStart}
                title={selectedLine.geometrySource === "path"
                  ? `Seek the preview to the start of selected Step ${(selectedTimelineStepIndices[0] ?? 0) + 1} without changing anchor positions`
                  : "Step seeking is available for shape-point routes"}
              >
                Go to Step {(selectedTimelineStepIndices[0] ?? 0) + 1} start
              </button>
              <button
                type="button"
                className="ml-btn"
                aria-pressed={timelinePreviewPlaying}
                onClick={() => setTimelinePreviewPlaying((playing) => !playing)}
              >
                {timelinePreviewPlaying ? "Pause preview" : "Play preview"}
              </button>
              <button
                type="button"
                className="ml-btn"
                aria-expanded={timelineExpanded}
                onClick={() => setTimelineExpanded((expanded) => !expanded)}
              >
                {timelineExpanded ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>
          {timelineExpanded && (
            <>
              <div className="ml-animation-timeline-scroll">
                <div className="ml-animation-timeline">
                  <div className="ml-animation-timeline-row timeline-head" style={{ gridTemplateColumns: `100px repeat(${timelineStepCount}, minmax(70px, 1fr))` }}>
                    <span className="ml-animation-track-label">{selectedLine.geometrySource === "path" ? "Shape point" : "Endpoint"}</span>
                    {Array.from({ length: timelineStepCount }, (_, stepIndex) => {
                      const stepPoints = timelineAnchorTracks.map((track) => track.points[stepIndex]?.id).filter((id): id is string => !!id);
                      const selected = stepPoints.length > 0 && stepPoints.every((id) => selectedAnchorPointIdsForLine.includes(id));
                      const stepVisible = stepPoints.length > 0 && !hiddenCanvasStepIndices.includes(stepIndex);
                      return (
                        <div className="ml-animation-step-control" key={stepIndex}>
                          {selectedLine.geometrySource === "path" && (
                            <input
                              type="checkbox"
                              aria-label={`Show step ${stepIndex + 1} on canvas`}
                              title={`Show step ${stepIndex + 1} across shape points`}
                              checked={stepVisible}
                              onChange={() => setHiddenCanvasStepIndices((hidden) =>
                                stepVisible
                                  ? [...new Set([...hidden, stepIndex])]
                                  : hidden.filter((index) => index !== stepIndex))}
                            />
                          )}
                          <button
                            type="button"
                            className={`ml-animation-step-button ${selected ? "selected" : ""}`}
                            aria-pressed={selected}
                            onClick={() => selectTimelineStep(stepIndex)}
                            title={`Select step ${stepIndex + 1} across all ${selectedLine.geometrySource === "path" ? "shape points" : "endpoints"}`}
                          >
                            Step {stepIndex + 1}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {visibleTimelineTracks.map((track) => (
                    <div className="ml-animation-timeline-row" key={track.value} style={{ gridTemplateColumns: `100px repeat(${timelineStepCount}, minmax(70px, 1fr))` }}>
                      <div className="ml-animation-track-controls">
                        {selectedLine.geometrySource === "path" && (
                          <input
                            type="checkbox"
                            aria-label={`Show ${track.label} on canvas`}
                            title={`Show ${track.label} on canvas`}
                            checked={!hiddenCanvasShapeTrackValues.includes(track.value)}
                            onChange={() => setHiddenCanvasShapeTrackValues((hidden) =>
                              hidden.includes(track.value)
                                ? hidden.filter((value) => value !== track.value)
                                : [...hidden, track.value])}
                          />
                        )}
                        <button
                          type="button"
                          className={`ml-animation-track-label ${selectedShapeTrackValues.includes(track.value) ? "selected" : ""}`}
                          aria-pressed={selectedShapeTrackValues.includes(track.value)}
                          onClick={() => toggleShapeTrack(track.value)}
                          title={`Select ${track.label} track to focus and add animation steps`}
                        >
                          {track.label}
                        </button>
                      </div>
                      {Array.from({ length: timelineStepCount }, (_, stepIndex) => {
                        const point = track.points[stepIndex];
                        if (!point) return <span className="ml-animation-empty-cell" key={stepIndex}>—</span>;
                        const selected = selectedAnchorPointIdsForLine.includes(point.id);
                        return (
                          <button
                            key={point.id}
                            type="button"
                            className={`ml-animation-point ${selected ? "selected" : ""}`}
                            aria-pressed={selected}
                            onClick={() => selectTimelinePoint(point.id)}
                            title={`Select only ${track.label}.${stepIndex + 1}`}
                          >
                            {track.label}.{stepIndex + 1}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {(visibleTimelineTracks.length === 0 || timelineStepCount === 0) && (
                    <p className="ml-animation-empty">{selectedLine.geometrySource === "path"
                      ? "No animated shape points yet. Show all points and select tracks to create a first step."
                      : "No endpoint animation steps yet. Add a step to create the first endpoint routes."}</p>
                  )}
                </div>
              </div>
              <div className="ml-animation-edit-bar">
                <div className="ml-animation-edit-options">
                  {selectedLine.geometrySource === "path" && (
                    <label className="ml-animation-show-all">
                      <input type="checkbox" checked={showAllShapeTracks} onChange={(event) => setShowAllShapeTracks(event.target.checked)} />
                      Show all {shapeAnchorTracks.length} shape points
                    </label>
                  )}
                  <label>
                    <input type="checkbox" checked={focusCanvasOnSelection} onChange={(event) => setFocusCanvasOnSelection(event.target.checked)} />
                    Focus canvas on selection
                  </label>
                  <label>
                    Transform
                    <select className="ml-select" value={anchorTransformMode} onChange={(event) => setAnchorTransformMode(event.target.value as "preserve" | "same")}>
                      <option value="preserve">Preserve spacing</option>
                      <option value="same">Same values</option>
                    </select>
                  </label>
                  {anchorTransformMode === "preserve" ? (
                    <>
                      <label>X offset<input className="ml-num" type="number" step="0.01" value={anchorTransform.x} onChange={(event) => setAnchorTransform((value) => ({ ...value, x: Number(event.target.value) }))} /></label>
                      <label>Y offset<input className="ml-num" type="number" step="0.01" value={anchorTransform.y} onChange={(event) => setAnchorTransform((value) => ({ ...value, y: Number(event.target.value) }))} /></label>
                      <label>Scale<input className="ml-num" type="number" min="0.01" step="0.05" value={anchorTransform.scale} onChange={(event) => setAnchorTransform((value) => ({ ...value, scale: Math.max(0.01, Number(event.target.value)) }))} /></label>
                      <label>Rotate °<input className="ml-num" type="number" step="1" value={anchorTransform.rotation} onChange={(event) => setAnchorTransform((value) => ({ ...value, rotation: Number(event.target.value) }))} /></label>
                    </>
                  ) : (
                    <>
                      <label>X<input className="ml-num" type="number" min="0" max="1" step="0.01" value={anchorTransform.x} onChange={(event) => setAnchorTransform((value) => ({ ...value, x: Number(event.target.value) }))} /></label>
                      <label>Y<input className="ml-num" type="number" min="0" max="1" step="0.01" value={anchorTransform.y} onChange={(event) => setAnchorTransform((value) => ({ ...value, y: Number(event.target.value) }))} /></label>
                      <label title="Applies to orbit-sized anchor points; use Scale to resize the selected shape path.">Size<input className="ml-num" type="number" min="0" max="0.5" step="0.01" value={anchorTransform.size} onChange={(event) => setAnchorTransform((value) => ({ ...value, size: Number(event.target.value) }))} /></label>
                      <label>Rotate °<input className="ml-num" type="number" step="1" value={anchorTransform.rotation} onChange={(event) => setAnchorTransform((value) => ({ ...value, rotation: Number(event.target.value) }))} /></label>
                    </>
                  )}
                  <button type="button" className="ml-btn ml-primary" disabled={selectedAnchorPointIdsForLine.length === 0} onClick={applySelectedAnchorTransform}>
                    Apply to {selectedAnchorPointIdsForLine.length || "selected"}
                  </button>
                  {selectedAnchorPointIdsForLine.length > 0 && (
                    <button type="button" className="ml-btn" onClick={() => { setSelectedAnchorPointIds([]); setSelectedAnchorPointId(null); }}>Clear selection</button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {layerContextMenu && (
        <>
          <button className="ml-context-dismiss" aria-label="Close layer actions" onClick={() => setLayerContextMenu(null)} />
          <div
            className="ml-layer-context-menu"
            role="menu"
            aria-label="Layer actions"
            onKeyDown={(event) => { if (event.key === "Escape") setLayerContextMenu(null); }}
            style={{
              left: `min(${layerContextMenu.x}px, calc(100vw - 190px))`,
              top: `min(${layerContextMenu.y}px, calc(100dvh - 120px))`,
            }}
          >
            {layerContextMenu.groupId ? (
              <>
                <button role="menuitem" autoFocus onClick={() => { duplicateGroup(layerContextMenu.groupId!); setLayerContextMenu(null); }}>Duplicate group</button>
                <button role="menuitem" onClick={() => { ungroupLines(layerContextMenu.groupId!); setLayerContextMenu(null); }}>Ungroup</button>
                <button role="menuitem" className="ml-danger" onClick={() => { deleteGroup(layerContextMenu.groupId!); setLayerContextMenu(null); }}>Delete group</button>
              </>
            ) : (
              <>
                <button role="menuitem" autoFocus onClick={() => { duplicateLines(layerContextMenu.lineIds); setLayerContextMenu(null); }}>Duplicate {layerContextMenu.lineIds.length > 1 ? `${layerContextMenu.lineIds.length} layers` : "layer"}</button>
                <button role="menuitem" className="ml-danger" onClick={() => { deleteLines(layerContextMenu.lineIds); setLayerContextMenu(null); }}>Delete {layerContextMenu.lineIds.length > 1 ? `${layerContextMenu.lineIds.length} layers` : "layer"}</button>
              </>
            )}
          </div>
        </>
      )}

      {pageSceneError && (
        <div className="ml-modal-backdrop ml-page-error-backdrop" onClick={() => setPageSceneError("")}>
          <section
            className="ml-modal ml-page-error-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ml-page-error-title"
            aria-describedby="ml-page-error-message"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => { if (event.key === "Escape") setPageSceneError(""); }}
          >
            <div className="ml-modal-head">
              <strong id="ml-page-error-title">Background change couldn&apos;t be completed</strong>
            </div>
            <p id="ml-page-error-message">{pageSceneError}</p>
            <div className="ml-modal-actions">
              <button className="ml-btn ml-primary" autoFocus onClick={() => setPageSceneError("")}>Close</button>
            </div>
          </section>
        </div>
      )}

      {showTemplateLibrary && (
        <SceneTemplateLibrary
          currentScene={config}
          onApply={applyTemplateScene}
          onClose={() => setShowTemplateLibrary(false)}
        />
      )}

      {showIO && (
        <div className="ml-modal-backdrop" onClick={() => setShowIO(null)}>
          <div className="ml-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ml-modal-head">
              <strong>{showIO === "export" ? "Export Configuration" : "Import Configuration"}</strong>
              <button className="ml-btn" onClick={() => setShowIO(null)} aria-label="Close">×</button>
            </div>
            <textarea className="ml-textarea" value={importText} onChange={(e) => { setImportText(e.target.value); setIoError(""); }} spellCheck={false} />
            {ioError && <p className="ml-error" role="alert">{ioError}</p>}
            <div className="ml-modal-actions">
              {showIO === "export" ? (
                <>
                  <button className="ml-btn" onClick={copyExport}>Copy</button>
                  <button className="ml-btn" onClick={downloadExport}>Download .json</button>
                </>
              ) : (
                <>
                  <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && onImportFile(e.target.files[0])} />
                  <button className="ml-btn" onClick={doImport}>Load</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

const EDITOR_CSS = `
.ml-editor { position: relative; width: 100%; height: 100%; min-height: 0; max-height: 100%; background: #0b0c10; color: #d7dbe3; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; }
.ml-toolbar { position: relative; z-index: 20; display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: linear-gradient(180deg, rgba(20,23,31,.98), rgba(13,15,21,.98)); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.ml-toolbar-spacer { flex: 1 1 auto; }
.ml-page-controls, .ml-page-preview-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.ml-page-select-wrap { display: grid; gap: 2px; min-width: 150px; color: #8f99a9; font-size: 9px; }
.ml-page-select { min-width: 150px; max-width: 220px; }
.ml-page-preview-button { border-color: #57734f; color: #c1e6b3; }
.ml-page-preview { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; min-height: 0; background: #090b10; }
.ml-page-preview-heading { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 6px 12px; border-bottom: 1px solid #303541; color: #d7dbe3; }
.ml-page-preview-heading > div { display: flex; align-items: baseline; flex-wrap: wrap; gap: 10px; min-width: 0; }
.ml-page-preview-heading strong { color: #b7f4ff; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
.ml-page-preview-heading span { color: #9299a8; font-size: 10px; }
.ml-page-preview-frame { flex: 1 1 auto; width: 100%; min-height: 0; border: 0; background: #0a0a0a; }
.ml-title { margin-right: 8px; color: #eef1f6; font-size: 13px; }
.ml-sep { width: 1px; height: 18px; background: #2a2c36; margin: 0 4px; }.ml-view-tools { display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; border: 1px solid #2a2c36; border-radius: 999px; background: rgba(28, 30, 38, 0.8); }.ml-inline-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a8fa3; }
.ml-btn { background: #1c1e26; color: #d7dbe3; border: 1px solid #2a2c36; border-radius: 6px; padding: 5px 9px; font-size: 11px; cursor: pointer; }
.ml-btn:hover { background: #262933; }
.ml-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ml-btn[aria-busy="true"] { opacity: 0.9; cursor: progress; }
.ml-btn-spinner { display: inline-block; width: 10px; height: 10px; margin-right: 6px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; vertical-align: -1px; animation: ml-btn-spin .7s linear infinite; }
@keyframes ml-btn-spin { to { transform: rotate(360deg); } }
.ml-primary { background: #b7f4ff; border-color: #b7f4ff; color: #081015; font-weight: 650; }
.ml-primary:hover { background: #d4f9ff; }
.ml-overflow-menu { position: relative; z-index: 20; }
.ml-overflow-menu > summary { display: grid; width: 32px; height: 32px; place-items: center; border: 1px solid #2a2c36; border-radius: 6px; color: #d7dbe3; cursor: pointer; font-size: 21px; line-height: 1; list-style: none; }
.ml-overflow-menu > summary::-webkit-details-marker { display: none; }
.ml-overflow-menu[open] > summary, .ml-overflow-menu > summary:hover { background: #262933; }
.ml-overflow-panel { position: absolute; top: calc(100% + 6px); right: 0; width: 240px; max-height: min(78dvh, 620px); overflow-y: auto; padding: 5px; background: #15171e; border: 1px solid #343946; border-radius: 8px; box-shadow: 0 14px 36px #000a; }
.ml-overflow-section { display: flex; flex-direction: column; gap: 4px; padding: 7px; border-bottom: 1px solid #292c36; }
.ml-overflow-section:last-child { border-bottom: 0; }
.ml-overflow-section > strong { padding: 0 3px 3px; color: #8f99a9; font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; }
.ml-mode-toggle { white-space: nowrap; border-color: #3a6470; color: #a7eaf6; }
.ml-mode-toggle:hover { background: #12232a; border-color: #5ee6ff; }
.ml-cursor-mode { flex: 1 1 auto; min-height: 0; min-width: 0; overflow: hidden; padding: 0; background: #0b0c10; }
.ml-cursor-toolbar-actions { display: flex; align-items: center; gap: 6px; }
.ml-cursor-mode > .cursor-effects-settings { width: 100%; height: 100%; min-height: 0; margin: 0; gap: 0; }
@media (max-width: 900px) { .ml-cursor-mode { overflow-y: auto; overscroll-behavior-y: contain; scrollbar-width: thin; scrollbar-color: #687386 #171a22; touch-action: pan-y; } .ml-cursor-mode > .cursor-effects-settings { height: auto; min-height: 100%; } }
.ml-menu-action { width: 100%; padding: 6px; border: 0; border-radius: 4px; background: transparent; color: #d7dbe3; text-align: left; font-size: 11px; cursor: pointer; }
.ml-menu-action:hover { background: #252934; }
.ml-menu-action:disabled { opacity: 0.45; cursor: not-allowed; }
.ml-menu-action[aria-busy="true"] { opacity: 0.9; cursor: progress; }
.ml-menu-action .ml-btn-spinner { margin-right: 7px; }
.ml-page-save-status { min-height: 11px; }
.ml-menu-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #c7cbd6; font-size: 11px; }
.ml-menu-pair { display: flex; gap: 6px; }
.ml-menu-pair > .ml-btn { flex: 1; }
.ml-menu-select { width: 100%; }
.ml-page-scene-hint { margin: 0; color: #9299a8; font-size: 10px; line-height: 1.45; }
.ml-page-route-field { display: grid; gap: 4px; color: #aeb4c2; font-size: 10px; }
.ml-page-route-field .ml-select { width: 100%; }
.ml-modal-backdrop.ml-page-error-backdrop { position: fixed; z-index: 10000; }
.ml-page-error-dialog { width: min(420px, calc(100vw - 32px)); padding: 0 0 8px; }
.ml-page-error-dialog > p { margin: 14px 12px; color: #c6cad4; font-size: 12px; line-height: 1.5; }
.ml-danger { border-color: #5a2a2a; color: #ff9a9a; }
.ml-select { background: #1c1e26; color: #d7dbe3; border: 1px solid #2a2c36; border-radius: 6px; padding: 4px 6px; font-size: 11px; }
.ml-check { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #aeb4c2; }
.ml-body { display: flex; flex: 1 1 auto; min-height: 0; min-width: 0; width: 100%; overflow: hidden; }
.ml-sidebar { width: 240px; border-right: 1px solid #22242c; display: flex; flex-direction: column; background: #101116; }
.ml-tabs { display: flex; border-bottom: 1px solid #22242c; }
.ml-tab { flex: 1; padding: 8px; background: transparent; border: none; color: #8a8fa3; cursor: pointer; font-size: 11px; }
.ml-tab.active { color: #eef1f6; background: #181a21; box-shadow: inset 0 -2px 0 #5ee6ff; }
.ml-line-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; } .ml-global-context { flex: 0 0 auto; max-height: 120px; overflow-y: auto; padding: 9px 10px; border-bottom: 1px solid #22242c; background: #12141a; } .ml-context-title { margin-bottom: 7px; color: #aeb4c2; font-size: 10px; } .ml-context-line { display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 5px; align-items: center; padding: 3px 0; color: #d7dbe3; font: 10px monospace; } .ml-context-inherited { color: #9fd9a6; } .ml-context-custom { color: #f2c27b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .ml-context-value { color: #9aa6b5; } .ml-context-source { display: block; margin-top: 3px; color: #8a8fa3; font: 9px monospace; } .ml-context-mode { display: block; margin-top: 3px; color: #5ee6ff; font: 10px monospace; font-weight: normal; }
.ml-selection-chip { display: flex; align-items: center; gap: 8px; min-height: 31px; padding: 5px 9px; border-bottom: 1px solid #22242c; color: #e2e8f0; font: 11px monospace; }
.ml-selection-chip .ml-swatch { width: 8px; height: 8px; }
.ml-line-row { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid #191b22; cursor: grab; }
.ml-line-row:active, .ml-group-row:active { cursor: grabbing; }
.ml-line-row:hover { background: #161821; }
.ml-line-row.selected { background: #182233; }
.ml-line-row.grouping-selected { box-shadow: inset 2px 0 #5ee6ff; }
.ml-line-row.drop-target, .ml-group-row.drop-target { box-shadow: inset 0 2px #5ee6ff; }
.ml-drag-handle { flex: 0 0 auto; color: #737b89; cursor: grab; font-size: 12px; line-height: 1; }
.ml-line-row:hover .ml-drag-handle, .ml-group-row:hover .ml-drag-handle { color: #d7dbe3; }
.ml-line-id { flex: 1; font-family: monospace; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-swatch { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #333; flex-shrink: 0; }
.ml-icon-btn { background: transparent; border: none; color: #aeb4c2; cursor: pointer; font-size: 12px; padding: 2px; }
.ml-line-actions { display: flex; gap: 4px; padding: 8px; flex-wrap: wrap; border-top: 1px solid #22242c; margin-top: auto; }
.ml-sidebar.editing-line .ml-line-actions { margin-top: 0; }
.ml-environment-source { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #292d38; border-radius: 6px; background: #101218; }
.ml-environment-source .ml-line-actions { align-items: center; padding: 0 0 6px; border-top: 0; border-bottom: 1px solid #292d38; }
.ml-sidebar.editing-line .ml-environment-source .ml-line-actions { margin-top: 0; }
.ml-environment-source .ml-line-actions > .ml-texture-description { flex: 1 1 auto; }
.ml-environment-source .ml-texture-description { margin-left: 0; }
.ml-overflow-section > .ml-texture-description { margin-left: 0; }
.ml-animation-preview { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; padding: 8px; border-top: 1px solid #22242c; background: #0c0d12; }
.ml-animation-preview > strong { color: #aeb4c2; font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.ml-animation-preview-canvas { position: relative; width: min(100%, 260px); overflow: hidden; border: 1px solid #343946; border-radius: 6px; background: radial-gradient(ellipse at 50% 0%, #171a23 0%, #090a0d 80%); }
.ml-animation-preview > small { color: #7f8797; font-size: 9px; line-height: 1.35; }
.ml-layer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 7px 8px; border-bottom: 1px solid #22242c; color: #aeb4c2; font-size: 11px; }
.ml-layer-toolbar small { display: block; margin-top: 3px; color: #6b7080; font-size: 9px; }
.ml-layer-order-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; margin: 8px 0; }
.ml-layer-order-actions .ml-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ml-layer-advanced { margin-top: 8px; color: #8a8fa3; font-size: 10px; }
.ml-layer-advanced summary { cursor: pointer; }
.ml-layer-entry { border-bottom: 1px solid #191b22; }
.ml-line-row { border-bottom: 0; }
.ml-line-row.group-member { padding-left: 18px; }
.ml-group-layer { border-bottom: 1px solid #292c36; background: #12141a; }
.ml-group-row { display: flex; align-items: center; gap: 6px; min-height: 32px; padding: 5px 7px; color: #d7dbe3; cursor: grab; }
.ml-group-row:hover, .ml-group-row.selected { background: #182233; }
.ml-group-toggle { width: 14px; flex: 0 0 auto; }
.ml-group-icon { color: #5ee6ff; font-size: 11px; }
.ml-group-count { color: #8a8fa3; font-size: 10px; }
.ml-ungroup-btn { white-space: nowrap; font-size: 9px; }
.ml-context-dismiss { position: fixed; inset: 0; z-index: 50; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; }
.ml-layer-context-menu { position: fixed; z-index: 51; width: 180px; padding: 4px; background: #171a22; border: 1px solid #39404d; border-radius: 6px; box-shadow: 0 10px 28px #0009; }
.ml-layer-context-menu button { display: block; width: 100%; padding: 7px 8px; border: 0; border-radius: 4px; background: transparent; color: #d7dbe3; text-align: left; font-size: 11px; cursor: pointer; }
.ml-layer-context-menu button:hover { background: #252934; }
.ml-group-children { border-top: 1px solid #22242c; }
.ml-line-anchors { padding: 2px 8px 6px 26px; color: #9aa6b5; font-size: 10px; }
.ml-line-anchors summary, .ml-line-anchor-endpoint summary { padding: 3px 0; cursor: pointer; }
.ml-line-anchor-endpoint { padding-left: 8px; }
.ml-line-anchor-endpoint.start > summary { color: #f7d974; }
.ml-line-anchor-endpoint.end > summary { color: #78aaff; }
.ml-layer-anchor-point { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 5px 4px 10px; border: 0; border-radius: 3px; background: transparent; color: #c7cbd6; text-align: left; cursor: pointer; font-size: 10px; }
.ml-layer-anchor-point:hover, .ml-layer-anchor-point.selected { background: #20232d; color: #fff; }
.ml-layer-anchor-point .ml-anchor-key { width: 7px; height: 7px; }
.ml-layer-rename { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; gap: 4px; }
.ml-layer-rename input { width: 100%; min-width: 0; background: #1c1e26; color: #d7dbe3; border: 1px solid #5ee6ff; border-radius: 3px; padding: 3px 4px; font-size: 10px; }
.ml-layer-rename .ml-error { flex-basis: 100%; }
.ml-solo-icon svg, .ml-visible-icon svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; display: block; }
.ml-solo-icon.active { color: #f7d974; }
.ml-solo-icon.active svg { fill: #f7d97455; }
.ml-visible-icon.active { color: #9fd9a6; }
.ml-inspector-head strong[title="Double-click to rename"] { cursor: text; }
.ml-preview-wrap { flex: 1 1 auto; position: relative; min-width: 0; min-height: 0; background: radial-gradient(ellipse at 50% 0%, #12141c 0%, #0a0b0f 70%); overflow: hidden; border: 1px solid rgba(92, 104, 120, 0.45); border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02); }
.ml-inspector { width: 300px; overflow-y: auto; border-left: 1px solid #22242c; background: #101116; padding-bottom: 20px; }
.ml-animation-dock { flex: 0 0 auto; max-height: 36%; min-height: 42px; overflow: hidden; border-top: 1px solid #303541; background: #101218; }
.ml-animation-dock.collapsed { max-height: 42px; }
.ml-animation-dock-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 42px; padding: 5px 12px; }
.ml-animation-dock-head > div:first-child { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.ml-animation-dock-head strong { color: #eef1f6; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
.ml-animation-dock-head span { color: #8a8fa3; font-size: 10px; }
.ml-animation-dock-actions, .ml-animation-edit-options { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.ml-animation-timeline-scroll { max-height: 145px; overflow: auto; border-top: 1px solid #222630; }
.ml-animation-timeline { display: grid; min-width: max-content; }
.ml-animation-timeline-row { display: grid; grid-auto-columns: minmax(70px, 1fr); grid-auto-flow: column; align-items: center; min-height: 31px; border-bottom: 1px solid #1e222b; }
.ml-animation-timeline-row.timeline-head { position: sticky; top: 0; z-index: 1; background: #151820; }
.ml-animation-track-controls { position: sticky; left: 0; z-index: 2; display: flex; align-items: center; gap: 5px; width: 100px; height: 100%; padding: 0 6px; border-right: 1px solid #2a2e39; background: #12151c; }
.ml-animation-track-controls > input { flex: 0 0 auto; margin: 0; accent-color: #5ee6ff; }
.ml-animation-track-controls .ml-animation-track-label { min-width: 0; flex: 1; width: auto; height: 100%; padding: 4px 2px; border: 0; background: transparent; color: #a7dce5; font: 10px monospace; text-align: left; cursor: pointer; }
.ml-animation-track-controls .ml-animation-track-label.selected { background: #143039; color: #c9f8ff; }
.ml-animation-track-label { position: sticky; left: 0; z-index: 2; display: flex; align-items: center; width: 100px; height: 100%; padding: 4px 10px; border: 0; border-right: 1px solid #2a2e39; background: #12151c; color: #a7dce5; font: 10px monospace; text-align: left; cursor: pointer; }
.ml-animation-track-label.selected { background: #143039; color: #c9f8ff; }
.ml-animation-step-control { display: flex; align-items: center; justify-content: center; gap: 2px; min-width: 0; }
.ml-animation-step-control > input { flex: 0 0 auto; margin: 0; accent-color: #5ee6ff; }
.ml-animation-step-button, .ml-animation-point { min-height: 24px; margin: 3px 4px; padding: 3px 7px; border: 1px solid #303541; border-radius: 4px; background: #1a1e27; color: #b8bfce; font: 10px monospace; cursor: pointer; }
.ml-animation-step-button:hover, .ml-animation-point:hover { border-color: #5ee6ff; color: #e7fbff; }
.ml-animation-step-button.selected, .ml-animation-point.selected { border-color: #5ee6ff; background: #143039; color: #c9f8ff; box-shadow: inset 0 0 0 1px #5ee6ff33; }
.ml-animation-point-control { display: flex; align-items: center; justify-content: center; gap: 2px; min-width: 0; }
.ml-animation-point-control > input { flex: 0 0 auto; margin: 0; accent-color: #5ee6ff; }
.ml-animation-point-control > .ml-animation-point { min-width: 0; margin-inline: 1px; padding-inline: 4px; }
.ml-animation-empty-cell { display: block; padding: 4px; color: #454a57; text-align: center; }
.ml-animation-edit-bar { padding: 7px 10px; border-top: 1px solid #252a34; }
.ml-animation-edit-options > label { display: flex; align-items: center; gap: 5px; color: #8d94a4; font-size: 9px; white-space: nowrap; }
.ml-animation-edit-options .ml-select { min-width: 112px; max-width: 150px; }
.ml-animation-edit-options .ml-num { width: 64px; min-width: 64px; }
.ml-animation-edit-options .ml-animation-show-all { color: #bbc1cd; }
.ml-animation-show-all input { margin: 0; accent-color: #5ee6ff; }
.ml-animation-empty { grid-column: 1 / -1; margin: 12px; color: #8a8fa3; font-size: 11px; }
.ml-inspector-head { display: flex; align-items: center; justify-content: space-between; padding: 10px; border-bottom: 1px solid #22242c; font-family: monospace; }
.ml-scroll { overflow-y: auto; flex: 1; min-height: 0; }
.ml-section { border-bottom: 1px solid #191b22; }
.ml-section-head { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; background: #14151b; border: none; color: #c7cbd6; padding: 7px 10px; font-size: 11px; letter-spacing: 0.04em; cursor: pointer; }
.ml-section-toggle { display: inline-flex; align-items: center; justify-content: center; width: 12px; color: #9aa6b5; font-size: 12px; flex-shrink: 0; }
.ml-section-title-wrap { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.ml-section-title { display: inline-flex; align-items: center; }
.ml-section-body { padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.ml-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ml-row-label { color: #8a8fa3; font-size: 11px; flex-shrink: 0; width: 90px; }
.ml-texture-description { margin-left: 98px; color: #858b9a; font-size: 10px; line-height: 1.4; }
.ml-texture-performance-note { display: block; }
.ml-texture-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.ml-texture-preset { display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 5px 3px; border: 1px solid #303541; border-radius: 5px; background: #171a22; color: #aeb4c2; font-size: 9px; cursor: pointer; }
.ml-texture-preset:hover { border-color: #687986; color: #d7dbe3; }
.ml-texture-preset.active { border-color: #6eaebb; background: #18262b; color: #c9f4fb; box-shadow: inset 0 0 0 1px #6eaebb33; }
.ml-texture-preset:focus-visible { outline: 1px solid #8ad9e8; outline-offset: 1px; }
.ml-texture-preset-preview { display: block; width: 100%; max-width: 64px; height: 24px; }
.ml-flow-colors { display: flex; flex-direction: column; gap: 5px; }
.ml-flow-color-pair { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
.ml-flow-color-pair label { display: inline-flex; align-items: center; gap: 4px; color: #858b9a; font-size: 10px; }
.ml-flow-colors input[type=color] { width: 34px; height: 24px; padding: 2px; border: 1px solid #303541; border-radius: 4px; background: #171a22; }
.ml-flow-layers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px 8px; margin: 4px 0 0 98px; padding: 7px; border: 1px solid #292d38; border-radius: 4px; color: #aeb4c2; font-size: 10px; }
.ml-flow-layers legend { padding: 0 4px; color: #858b9a; }
.ml-flow-layers label { display: flex; align-items: center; gap: 5px; text-transform: capitalize; }
.ml-flow-layers input { accent-color: #5ee6ff; }
.ml-help { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1px solid #586171; border-radius: 50%; color: #aeb4c2; font-size: 9px; cursor: help; outline: none; }
.ml-tooltip { position: absolute; left: 18px; bottom: 0; z-index: 20; display: none; width: 240px; padding: 9px 10px; background: #171a22; color: #d7dbe3; border: 1px solid #39404d; border-radius: 6px; box-shadow: 0 8px 24px #0008; font-size: 11px; line-height: 1.45; pointer-events: none; }
.ml-tooltip strong, .ml-tooltip span, .ml-tooltip em { display: block; }
.ml-tooltip strong { color: #f1f4f7; margin-bottom: 4px; }
.ml-tooltip em { margin-top: 5px; color: #9fd9e8; font-style: normal; }
.ml-help:hover .ml-tooltip, .ml-help:focus .ml-tooltip { display: block; }
.ml-row-control { flex: 1; display: flex; justify-content: flex-end; }
.ml-slider-wrap { display: flex; align-items: center; gap: 6px; width: 100%; }
.ml-slider-wrap input[type=range] { flex: 1; }
.ml-value-wrap { display: inline-flex; align-items: center; gap: 3px; } .ml-unit { color: #8a8fa3; font-size: 10px; } .ml-num { width: 62px; background: #1c1e26; color: #d7dbe3; border: 1px solid #2a2c36; border-radius: 4px; padding: 2px 4px; font-size: 11px; }
.ml-hint { padding: 14px; color: #6b7080; font-size: 11px; }
.ml-target-card { border: 1px solid #22242c; border-radius: 6px; margin: 8px; padding: 8px; }
.ml-target-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-family: monospace; }
.ml-target-toolbar { display: flex; flex-direction: column; gap: 8px; margin: 8px; padding: 10px; border: 1px solid #29444b; border-radius: 6px; background: #10191d; }
.ml-target-toolbar > div { display: grid; gap: 3px; }
.ml-target-toolbar strong { color: #b7f4ff; font-size: 11px; }
.ml-target-toolbar span { color: #8f99a9; font-size: 10px; }
.ml-target-draft { border-color: #4b8290; background: #10181d; }
.ml-target-name { width: 100%; max-width: 180px; }
.ml-target-selector { overflow: hidden; margin: 6px 0; padding: 5px 7px; border-radius: 4px; background: #090b10; color: #83b9c3; font: 9px/1.5 monospace; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-activations { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 8px 0; padding: 8px; border: 1px solid #292c36; border-radius: 5px; }
.ml-target-activations legend { padding: 0 4px; color: #8f99a9; font-size: 9px; }
.ml-target-activations label, .ml-target-line-list label { display: flex; align-items: center; gap: 6px; min-width: 0; color: #c1c6d0; font-size: 10px; }
.ml-target-activations input, .ml-target-line-list input { margin: 0; accent-color: #5ee6ff; }
.ml-target-actions, .ml-target-scope-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ml-target-line-heading { margin-top: 9px; color: #aab1bf; font-size: 10px; font-weight: 600; }
.ml-target-line-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 7px; margin-top: 7px; padding: 8px; border: 1px solid #252833; border-radius: 5px; background: #0d0e12; }
.ml-target-line-item { display: grid; min-width: 0; gap: 6px; padding: 7px; border: 1px solid #252833; border-radius: 5px; background: #101218; }
.ml-target-effect-settings { min-width: 0; padding: 6px; border: 1px solid #292e39; border-radius: 5px; background: #0b0e13; }
.ml-target-effect-settings > summary { display: flex; align-items: center; gap: 8px; cursor: pointer; list-style-position: inside; }
.ml-target-effect-settings > summary strong { min-width: 44px; color: #dce5eb; font-size: 10px; }
.ml-target-effect-settings > summary span { overflow: hidden; color: #8593a1; font: 9px monospace; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-effect-disabled { margin: 6px 0; color: #ffca7a; font-size: 9px; }
.ml-target-effect-triggers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin: 7px 0; padding: 7px; border: 1px solid #292c36; border-radius: 5px; }
.ml-target-effect-triggers legend { padding: 0 4px; color: #8f99a9; font-size: 9px; }
.ml-target-effect-triggers label { display: flex; align-items: center; gap: 5px; min-width: 0; color: #c1c6d0; font-size: 9px; }
.ml-target-effect-triggers input { margin: 0; accent-color: #5ee6ff; }
.ml-target-full-settings { justify-self: start; font-size: 9px; }
.ml-target-error { margin: 8px; color: #ff9a9a; font-size: 10px; }
.ml-target-list-item { position: relative; display: flex; align-items: center; gap: 9px; width: calc(100% - 12px); min-height: 70px; margin: 6px; padding: 7px; border: 1px solid #252833; border-radius: 7px; background: #11141a; color: #d7dbe3; text-align: left; cursor: pointer; }
.ml-target-list-item:hover, .ml-target-list-item.selected { border-color: #527d88; background: #142027; }
.ml-target-list-item.selected { box-shadow: inset 2px 0 #5ee6ff; }
.ml-target-list-copy { display: grid; flex: 1; min-width: 0; gap: 3px; }
.ml-target-list-copy > strong { overflow: hidden; color: #e3eaf0; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-list-copy > small { overflow: hidden; color: #7f8c99; font: 9px monospace; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-list-arrow { color: #78838f; font-size: 18px; }
.ml-target-thumbnail { position: relative; display: grid; flex: 0 0 48px; width: 48px; height: 48px; place-items: center; border: 1px solid #374450; border-radius: 6px; background: #0c1116; transition: transform .16s ease, box-shadow .16s ease; }
.ml-target-thumbnail-image { display: block; width: 100%; height: 100%; background-position: center; background-repeat: no-repeat; background-size: contain; }
.ml-target-thumbnail-fallback { display: grid; width: 100%; height: 100%; align-content: center; justify-items: center; gap: 3px; overflow: hidden; padding: 4px; background: radial-gradient(ellipse at 50% 20%, #263b45, #111820); text-align: center; }
.ml-target-thumbnail-fallback small { max-width: 100%; overflow: hidden; color: #83b9c3; font: 7px monospace; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-thumbnail-fallback strong { display: -webkit-box; max-width: 100%; overflow: hidden; color: #e4f2f5; font: 9px/1.1 sans-serif; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.ml-target-thumbnail-zoom { position: absolute; z-index: 20; top: -8px; left: -3px; display: none; width: 132px; height: 132px; overflow: hidden; border: 1px solid #6ab8c7; border-radius: 8px; background: #0c1116; box-shadow: 0 12px 28px #000b; }
.ml-target-thumbnail-zoom .ml-target-thumbnail-fallback { gap: 6px; }
.ml-target-thumbnail-zoom .ml-target-thumbnail-fallback small { font-size: 10px; }
.ml-target-thumbnail-zoom .ml-target-thumbnail-fallback strong { font-size: 15px; }
.ml-target-thumbnail:hover .ml-target-thumbnail-zoom, .ml-target-list-item:focus-visible .ml-target-thumbnail-zoom { display: grid; }
.ml-target-detail-preview { display: flex; align-items: center; gap: 10px; margin: 8px; padding: 8px; border: 1px solid #293541; border-radius: 7px; background: #0c1116; }
.ml-target-detail-preview .ml-target-thumbnail { width: 64px; height: 64px; flex-basis: 64px; }
.ml-target-detail-preview > span:last-child { display: grid; gap: 4px; min-width: 0; }
.ml-target-detail-preview > span:last-child strong { color: #cfe7ed; font-size: 10px; }
.ml-target-detail-preview > span:last-child small { color: #818d9b; font-size: 9px; line-height: 1.4; }
.ml-target-layer-note { margin: 7px 0; color: #858f9e; font-size: 9px; line-height: 1.45; }
.ml-target-line-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.ml-target-line-row > label { flex: 1; min-width: 0; }
.ml-target-line-row > label > span { display: grid; min-width: 0; gap: 2px; }
.ml-target-line-row > label > span > span, .ml-target-line-settings { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-target-line-settings { color: #788493; font: 8px/1.2 monospace; }
.ml-target-layer-buttons { display: inline-flex; gap: 2px; }
.ml-target-layer-buttons .ml-icon-btn { width: 20px; height: 20px; border: 1px solid #303541; border-radius: 4px; font-size: 10px; }
.ml-target-layer-buttons .ml-icon-btn[aria-label^="Edit"] { width: 52px; }
.ml-target-layer-buttons .ml-icon-btn:disabled { opacity: .35; cursor: default; }
.ml-target-inspector { width: 100%; height: 100%; padding-bottom: 16px; }
.ml-badge { font-size: 9px; padding: 2px 6px; border-radius: 10px; background: #22242c; color: #8a8fa3; }
.ml-badge.on { background: #2a4a2a; color: #a6f0a6; }
.ml-modal-backdrop { position: absolute; inset: 0; background: #000a; display: flex; align-items: center; justify-content: center; z-index: 10; }
.ml-modal { width: min(640px, 90%); max-height: 80%; background: #14151b; border: 1px solid #2a2c36; border-radius: 8px; display: flex; flex-direction: column; }
.ml-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #22242c; }
.ml-textarea { flex: 1; min-height: 280px; background: #0d0e12; color: #cfe8ff; border: none; padding: 10px; font-family: monospace; font-size: 11px; resize: vertical; }
.ml-modal-actions { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #22242c; }
.ml-body { position: relative; }
.ml-global-editor { display: none; }
.ml-global-editor.active { position: absolute; z-index: 2; top: 0; right: 0; bottom: 0; width: 300px; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid #22242c; background: #101116; }
.ml-global-editor.active .ml-scroll { flex: 1 1 auto; }
.ml-body.global-selected .ml-preview-wrap { margin-right: 300px; }
.ml-body.global-selected .ml-inspector { display: none; }
.ml-global-scopes { flex: 0 0 auto; padding: 6px; background: #101116; }
.ml-global-scope-row { display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 6px 8px; border-bottom: 1px solid #191b22; color: #d7dbe3; cursor: pointer; }
.ml-global-scope-row input { margin: 0; accent-color: #5ee6ff; }
.ml-anchor-group { margin: 8px 0; padding: 8px; border: 1px solid #2a2c36; border-radius: 6px; }
.ml-anchor-group.start { border-left: 2px solid #f7d974; }
.ml-anchor-group.end { border-left: 2px solid #78aaff; }
.ml-anchor-group.path { border-left: 2px solid #5ee6ff; }
.ml-anchor-group > .ml-anchor-group-summary { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; cursor: pointer; list-style: none; }
.ml-anchor-group > .ml-anchor-group-summary::-webkit-details-marker { display: none; }
.ml-anchor-group > .ml-anchor-group-summary strong { display: inline-flex; align-items: center; gap: 7px; }
.ml-anchor-view-toggle { display: inline-flex; padding: 2px; gap: 2px; border: 1px solid #292c36; border-radius: 6px; background: #101116; }
.ml-anchor-view-toggle button { padding: 4px 6px; border: 0; border-radius: 4px; background: transparent; color: #858b9b; font-size: 9px; cursor: pointer; }
.ml-anchor-view-toggle button.active { background: #1b2b31; color: #c6f3fb; box-shadow: inset 0 0 0 1px #3a5660; }
.ml-anchor-legend { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 0 0 8px; color: #8a8fa3; font-size: 9px; }
.ml-anchor-legend span { display: inline-flex; align-items: center; gap: 5px; }
.ml-anchor-legend i { width: 7px; height: 7px; border-radius: 50%; }
.ml-anchor-legend i.shape { background: #f2c27b; }
.ml-anchor-legend i.animation { background: #5ee6ff; }
.ml-anchor-list-actions { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 8px; color: #8a8fa3; font-size: 10px; }
.ml-anchor-card { margin-top: 8px; padding: 8px; border: 1px solid #252833; border-radius: 5px; background: #0d0e12; }
.ml-anchor-card.selected { border-color: #eef1f6; box-shadow: 0 0 0 1px #eef1f633; }
.ml-anchor-card.start { border-left: 2px solid #f7d974; }
.ml-anchor-card.end { border-left: 2px solid #78aaff; }
.ml-anchor-card.path { border-left: 2px solid #5ee6ff; }
.ml-anchor-card-head { display: flex; justify-content: flex-start; align-items: center; gap: 5px; margin-bottom: 0; }
.ml-anchor-card-head .ml-anchor-point-select { flex: 1 1 auto; min-width: 0; }
.ml-anchor-card-head .ml-btn { flex: 0 0 auto; padding: 4px 6px; }
.ml-anchor-card { display: flex; flex-direction: column; gap: 9px; }
.ml-anchor-card-settings { display: flex; flex-direction: column; gap: 9px; padding-top: 7px; border-top: 1px solid #252833; }
.ml-anchor-bulk-edit { display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 1px solid #31434a; border-radius: 6px; background: #11181c; }
.ml-anchor-bulk-edit > summary { color: #b8eaf2; font-size: 10px; cursor: pointer; }
.ml-anchor-bulk-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.ml-anchor-bulk-grid > label { display: grid; min-width: 0; gap: 4px; color: #8a8fa3; font-size: 9px; }
.ml-anchor-bulk-grid .ml-num, .ml-anchor-bulk-grid .ml-select { width: 100%; min-width: 0; }
.ml-anchor-bulk-enabled { display: flex !important; align-items: center; }
.ml-anchor-bulk-enabled input { accent-color: #5ee6ff; }
.ml-anchor-position-grid, .ml-anchor-order-speed { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; width: 100%; }
.ml-anchor-position-grid { padding: 7px; border: 1px solid #252833; border-radius: 5px; background: #101116; }
.ml-anchor-value-field { display: grid; min-width: 0; gap: 4px; color: #8a8fa3; font-size: 9px; }
.ml-anchor-value-field .ml-num, .ml-anchor-position-grid .ml-num { width: 100%; min-width: 0; height: 28px; text-align: center; }
.ml-segmented-field { min-width: 0; margin: 0; padding: 0; border: 0; }
.ml-segmented-field legend { margin-bottom: 5px; color: #8a8fa3; font-size: 9px; }
.ml-segmented-options { display: grid; grid-auto-columns: minmax(0, 1fr); grid-auto-flow: column; width: 100%; padding: 2px; gap: 2px; border: 1px solid #292c36; border-radius: 6px; background: #101116; }
.ml-segmented-option { position: relative; display: flex; min-width: 0; cursor: pointer; }
.ml-segmented-option input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.ml-segmented-option span { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 27px; padding: 4px 5px; border: 1px solid transparent; border-radius: 4px; color: #8a8fa3; font-size: 9px; text-align: center; white-space: nowrap; }
.ml-segmented-option.selected span { border-color: #3a5660; background: #1b2b31; color: #c6f3fb; }
.ml-segmented-option input:focus-visible + span { outline: 1px solid #8ad9e8; }
.ml-anchor-point-select { display: inline-flex; align-items: center; gap: 7px; padding: 4px; background: transparent; color: #d7dbe3; border: 0; cursor: pointer; font-size: 11px; }
.ml-anchor-point-select[aria-pressed="true"] { color: #d8faff; }
.ml-line-rename { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ml-line-rename .ml-num { min-width: 100px; }
.ml-error { flex-basis: 100%; color: #ff8c8c; font-size: 11px; }
.ml-anchor-key { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #f7d974; flex: 0 0 auto; }
.ml-anchor-group.end .ml-anchor-key, .ml-anchor-card.end .ml-anchor-key { background: #78aaff; }
.ml-anchor-group.path .ml-anchor-key, .ml-anchor-card.path .ml-anchor-key { background: #5ee6ff; }
.ml-editor, .ml-editor * { box-sizing: border-box; }
.ml-body.panel-left-collapsed .ml-sidebar, .ml-body.panel-right-collapsed .ml-inspector { display: none; }
.ml-body.panel-right-collapsed .ml-global-editor.active { display: none; }
.ml-body.panel-right-collapsed.global-selected .ml-preview-wrap { margin-right: 0; }
.ml-sidebar { flex: 0 0 260px; min-width: 0; }
.ml-inspector { flex: 0 0 320px; min-width: 0; max-width: 34vw; overflow-x: hidden; overflow-wrap: anywhere; }
.ml-inspector-head, .ml-inspector-head > div { min-width: 0; max-width: 100%; }
.ml-inspector-head strong, .ml-context-source { overflow-wrap: anywhere; }
.ml-section, .ml-section-body, .ml-row, .ml-row-control { min-width: 0; max-width: 100%; }
.ml-row { align-items: flex-start; }
.ml-row-label { width: min(94px, 38%); min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.ml-row-control { flex: 1 1 0; }
.ml-row-control > * { min-width: 0; max-width: 100%; }
.ml-row-control .ml-select, .ml-row-control select { width: 100%; }
.ml-select { appearance: none; padding-right: 25px; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16'%3E%3Cpath d='m4 6 4 4 4-4' fill='none' stroke='%239aa6b5' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 7px center; }
.ml-num { width: 78px; min-width: 0; min-height: 27px; padding: 3px 6px; border-color: #343946; border-radius: 5px; text-align: right; font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.ml-slider-row { display: block; }
.ml-slider-row .ml-row-label { display: flex; align-items: center; gap: 5px; width: 100%; margin-bottom: 5px; }
.ml-slider-row .ml-row-control { display: block; width: 100%; }
.ml-slider-wrap { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "range value"; align-items: center; gap: 0 10px; width: 100%; }
.ml-slider-wrap input[type=range] { grid-area: range; width: 100%; min-width: 0; height: 18px; margin: 0; accent-color: #b6eaf4; cursor: pointer; }
.ml-slider-wrap .ml-value-wrap { grid-area: value; min-width: 86px; justify-content: flex-end; gap: 4px; }
.ml-slider-wrap .ml-num { width: 76px; min-width: 0; height: 27px; padding: 3px 6px; border-color: #343946; border-radius: 5px; text-align: right; font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.ml-position-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.ml-position-card { min-width: 0; margin: 0; padding: 4px 6px 6px; border: 1px solid #2a2c36; border-radius: 6px; }
.ml-position-card.from { border-top: 2px solid #f7d974; }
.ml-position-card.to { border-top: 2px solid #78aaff; }
.ml-position-card legend { padding: 0 4px; color: #d7dbe3; font-size: 10px; }
.ml-coordinate-pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.ml-coordinate-field { display: grid; min-width: 0; gap: 3px; color: #8a8fa3; font-size: 9px; }
.ml-position-card .ml-num { width: 100%; min-width: 0; height: 27px; padding: 3px 3px; text-align: center; font-size: 10px; }
.ml-appearance-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.ml-appearance-value { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-width: 0; padding: 5px 6px; border: 1px solid #343946; border-radius: 6px; background: #171a22; cursor: text; }
.ml-appearance-value:focus-within { outline: 1px solid #8ad9e8; border-color: #8ad9e8; }
.ml-appearance-value-label { display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: #aeb4c2; font-size: 10px; }
.ml-appearance-value-label svg { width: 13px; height: 13px; flex: 0 0 auto; fill: none; stroke: #9aa6b5; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.ml-gradient-stops { display: flex; flex-direction: column; gap: 8px; width: 100%; min-width: 0; padding: 9px; border: 1px solid #292c36; border-radius: 7px; background: #0d0e12; }
.ml-gradient-stops-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #d7dbe3; font-size: 10px; }
.ml-gradient-stops-head > span { display: inline-flex; align-items: baseline; gap: 6px; font-weight: 600; }
.ml-gradient-stops-head small { color: #717888; font-size: 9px; font-weight: 400; }
.ml-gradient-stops-head .ml-btn { width: auto; min-height: 27px; margin: 0; padding: 4px 8px; }
.ml-gradient-stop-list { display: flex; flex-direction: column; gap: 5px; width: 100%; min-width: 0; }
.ml-gradient-stop { display: grid; grid-template-columns: 20px minmax(48px, 62px) minmax(0, 1fr) 24px; align-items: center; gap: 5px; width: 100%; min-width: 0; padding: 5px; border: 1px solid #292c36; border-radius: 5px; color: #aeb4c2; font-size: 10px; }
.ml-gradient-stop.dragging { opacity: .5; border-color: #8ad9e8; }
.ml-gradient-stop-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ml-gradient-drag { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 28px; padding: 0; border: 0; background: transparent; color: #717888; font-size: 11px; letter-spacing: -2px; cursor: grab; }
.ml-gradient-drag:hover, .ml-gradient-drag:active { color: #c6f3fb; }
.ml-gradient-stop .ml-color-trigger { width: 100%; min-width: 0; min-height: 30px; justify-content: flex-start; gap: 8px; padding: 3px 6px; }
.ml-gradient-stop .ml-color-trigger-swatch { width: 25px; height: 20px; }
.ml-gradient-stop .ml-color-trigger-value { white-space: nowrap; }
.ml-gradient-stop-position { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(56px, 68px) minmax(0, 1fr); align-items: center; gap: 6px; padding-top: 3px; border-top: 1px solid #252833; color: #8a8fa3; font-size: 9px; }
.ml-gradient-stop-position-control { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; }
.ml-gradient-stop-position-control input[type=range] { width: 100%; min-width: 0; height: 18px; margin: 0; accent-color: #b6eaf4; cursor: pointer; }
.ml-gradient-stop-position-value { display: inline-flex; align-items: center; gap: 4px; }
.ml-gradient-stop-position-value .ml-num { width: 45px; min-height: 26px; padding: 3px 4px; font-size: 10px; }
.ml-gradient-stop-position-value small { color: #717888; font-size: 9px; }
.ml-gradient-stop .ml-gradient-remove { width: 24px; height: 24px; border-radius: 5px; color: #8a8fa3; }
.ml-gradient-stop .ml-gradient-remove:hover:not(:disabled) { border-color: #78454a; background: #331e22; color: #ff9a9a; }
.ml-color-trigger { display: inline-flex; align-items: center; justify-content: space-between; gap: 7px; width: 100%; min-width: 100px; min-height: 30px; padding: 4px 7px; border: 1px solid #343946; border-radius: 5px; background: #171a22; color: #d7dbe3; cursor: pointer; }
.ml-color-trigger:hover, .ml-color-trigger:focus-visible { border-color: #8ad9e8; outline: none; }
.ml-color-trigger-swatch { width: 32px; height: 20px; flex: 0 0 auto; border: 1px solid #ffffff55; border-radius: 3px; }
.ml-color-trigger-value { overflow: hidden; color: #aeb4c2; font: 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; }
.ml-color-popover { position: fixed; inset: auto; z-index: 9999; width: min(280px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow-y: auto; margin: 0; padding: 10px; border: 1px solid #434957; border-radius: 8px; background: #151820; color: #e6e9ef; box-shadow: 0 12px 36px #000b; }
.ml-color-popover::backdrop { background: transparent; }
.ml-color-popover-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 11px; }
.ml-color-saturation { position: relative; width: 100%; height: 170px; overflow: hidden; border: 1px solid #343946; border-radius: 5px; background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent); cursor: crosshair; touch-action: none; user-select: none; }
.ml-color-saturation-marker { position: absolute; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #000a; transform: translate(-50%, -50%); pointer-events: none; }
.ml-color-hue { position: relative; height: 16px; margin-top: 9px; border: 1px solid #343946; border-radius: 999px; background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); cursor: ew-resize; touch-action: none; user-select: none; }
.ml-color-hue-marker { position: absolute; top: -3px; width: 8px; height: 20px; border: 2px solid #fff; border-radius: 4px; box-shadow: 0 0 0 1px #000a; transform: translateX(-50%); pointer-events: none; }
.ml-color-hex { display: flex; align-items: center; gap: 8px; margin-top: 9px; color: #8a8fa3; font: 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ml-color-hex input { flex: 1; min-width: 0; height: 29px; padding: 4px 7px; border: 1px solid #343946; border-radius: 5px; background: #0d0e12; color: #e6e9ef; font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ml-color-hex input:focus { outline: 1px solid #8ad9e8; border-color: #8ad9e8; }
.ml-gradient-remove { width: 20px; height: 20px; flex: 0 0 auto; font-size: 13px; }
.ml-gradient-remove:disabled { opacity: .35; cursor: default; }
.ml-gradient-help { color: #717888; font-size: 9px; line-height: 1.4; }
.ml-glow-subheading { margin: 12px 0 6px; padding-top: 9px; border-top: 1px solid #292c36; color: #aab4c3; font-size: 9px; font-weight: 700; letter-spacing: .08em; }
.ml-glow-preview-options { display: flex; flex-wrap: wrap; gap: 12px; margin: 2px 0; padding: 8px 9px; border: 1px solid #292c36; border-radius: 6px; color: #aab4c3; font-size: 10px; }
.ml-glow-preview-options legend { padding: 0 4px; color: #d7dbe3; font-weight: 600; }
.ml-glow-preview-options label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; }
.ml-glow-preview-options input { accent-color: #8ad9e8; }
.ml-rainbow-style { display: flex; flex-direction: column; gap: 7px; width: 100%; padding: 9px; border: 1px solid #292c36; border-radius: 7px; background: #0d0e12; }
.ml-rainbow-preview { width: 100%; height: 24px; border: 1px solid #ffffff44; border-radius: 5px; box-shadow: inset 0 0 0 1px #0003; }
.ml-appearance-number { width: 58px; min-width: 0; height: 24px; padding: 2px 3px; border: 1px solid #343946; border-radius: 4px; background: #0d0e12; color: #e6e9ef; text-align: right; font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; font-variant-numeric: tabular-nums; }
.ml-scrub-number { display: inline-flex; align-items: center; justify-content: flex-end; color: #d7dbe3; cursor: ns-resize; user-select: none; touch-action: none; }
.ml-scrub-number:hover { border-color: #8ad9e8; background: #202630; }
.ml-scrub-number:focus-visible { outline: 1px solid #8ad9e8; border-color: #8ad9e8; }
.ml-appearance-number:focus { outline: 1px solid #8ad9e8; border-color: #8ad9e8; }
.ml-anchor-count { color: #8a8fa3; font-size: 10px; font-weight: 400; }
.ml-anchor-empty { margin: 0; color: #717888; font-size: 10px; }
.ml-num:focus, .ml-select:focus { outline: 1px solid #8ad9e8; border-color: #8ad9e8; }
.ml-value-wrap .ml-unit { flex: 0 0 auto; }
.ml-section-chevron { width: 13px; height: 13px; flex: 0 0 auto; fill: none; stroke: #9aa6b5; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; transform: rotate(-90deg); transition: transform 140ms ease; }
.ml-section-chevron.open { transform: rotate(0); }
.ml-section-head { gap: 7px; padding: 9px 11px; }
.ml-section-title { color: #d7dbe3; font-size: 10px; letter-spacing: .075em; }
.ml-section-body { gap: 10px; padding: 11px 12px 13px; }
.ml-help { width: 13px; height: 13px; border: 0; color: #7f8999; }
.ml-help svg { display: block; width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.ml-help:hover, .ml-help:focus { color: #b7eaf2; }
.ml-tooltip { left: 0; bottom: calc(100% + 6px); width: min(240px, calc(100vw - 32px)); }
.ml-panel-toggle { display: inline-flex; align-items: center; gap: 6px; }
.ml-panel-toggle svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
.ml-panel-reopen { position: absolute; z-index: 4; top: 10px; display: inline-flex; align-items: center; justify-content: center; min-height: 31px; padding: 0 9px; border: 1px solid #343946; border-radius: 6px; background: #171a22; color: #d7dbe3; box-shadow: 0 4px 16px #0005; font-size: 10px; cursor: pointer; }
.ml-panel-reopen:hover { border-color: #8ad9e8; background: #202630; }
.ml-panel-reopen.left { left: 10px; }
.ml-panel-reopen.right { right: 10px; }
.ml-sidebar, .ml-inspector { position: relative; z-index: 2; }
.ml-preview-wrap { z-index: 0; }
.ml-global-editor.active { z-index: 3; }
.ml-body.global-selected > .ml-sidebar { position: static; }
@media (max-width: 900px) { .ml-body { flex-direction: column; overflow: hidden; } .ml-sidebar, .ml-inspector { width: 100%; max-height: 24dvh; flex-shrink: 0; } .ml-sidebar { overflow-y: auto; } .ml-sidebar > .ml-scroll { flex: 0 0 auto; overflow: visible; } .ml-preview-wrap { height: 52dvh; min-height: 280px; flex: 0 0 auto; width: 100%; } }
@media (max-width: 900px) { .ml-body.global-selected .ml-preview-wrap { margin-right: 0; } .ml-global-editor.active { position: static; width: 100%; max-height: 24dvh; flex: 0 0 auto; border-left: 0; border-top: 1px solid #22242c; } }
@media (max-width: 900px) { .ml-sidebar, .ml-inspector { flex: 0 0 auto; max-width: 100%; } .ml-sidebar { max-height: 30dvh; } .ml-inspector { max-height: 40dvh; } }
@media (max-width: 900px) { .ml-animation-dock { max-height: 30dvh; } .ml-animation-timeline-scroll { max-height: 90px; } .ml-animation-edit-bar { overflow-x: auto; } .ml-animation-edit-options { flex-wrap: nowrap; width: max-content; } .ml-animation-dock-head { padding-inline: 8px; } }
@media (max-width: 900px) { .ml-global-editor.active { position: relative; z-index: 3; } }
@media (max-width: 900px) { .ml-global-context { max-height: 48px; } }
`;
