"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AnchorPointEndpoint, MagneticLineConfig, MagneticLineGroup, MagneticLinesSceneConfig, MagneticTargetConfig, MotionType, ShapeType, GeometrySource, GeneratedShapePreset, LineColorStyle, PathPoint, Point } from "../types";
import { RAINBOW_COLORS } from "../types";
import { normalizeColorWeights, setColorWeight } from "../colorWeights";
import { MagneticBackgroundLines, type DebugFlags } from "../MagneticBackgroundLines";
import { DEFAULT_GLOBAL, DEFAULT_SCENE, MOTION_PRESETS, SCENE_PRESETS, applyScenePreset } from "../defaultScene";
import { sanitizeSceneConfig, makeBlankLine, duplicateLine } from "./validate";
import { createGeneratedShapePath, GENERATED_SHAPE_PRESETS } from "./shapePresets";
import { useHistory } from "./history";
import { getAllTargetSnapshots, type TargetSnapshot } from "../engine/targetRegistry";
import { deleteReusableLineShape, deleteSceneTemplate, listReusableLineShapes, listSceneTemplates, loadSceneTemplate, savePersistedScene, saveReusableLineShape, saveSceneTemplate, type ReusableLineShape } from "../persistence";
import { resolveLineConfig } from "../engine/resolveConfig";
import { customPathPointFromViewport, getCustomPathPointsInViewport } from "../engine/lineEngine";

const STORAGE_KEY = "magnetic-lines-editor:v1";

export interface MagneticLinesEditorProps {
  initialConfig?: MagneticLinesSceneConfig;
  onChange?: (config: MagneticLinesSceneConfig) => void;
}

type ShapeControl = "amplitude" | "frequency" | "cycles" | "phase" | "smoothness" | "irregularity" | "distortion" | "roughness" | "pixelStep";
type AnchorTargetOption = { value: string; label: string; endpoint: AnchorPointEndpoint; pathPointId?: string };

function getAnchorTargets(line: MagneticLineConfig): AnchorTargetOption[] {
  return [
    { value: "start", label: "Start endpoint", endpoint: "start" },
    { value: "end", label: "End endpoint", endpoint: "end" },
    ...(line.geometrySource === "path"
      ? line.customPath.points.map((point, index) => ({
        value: `path:${point.id}`,
        label: `Shape point ${index + 1}`,
        endpoint: "path" as const,
        pathPointId: point.id,
      }))
      : []),
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

function fitLineGeometryToCanvas(lines: MagneticLineConfig[], lineIds: Set<string>): MagneticLineConfig[] {
  const selected = lines.filter((line) => lineIds.has(line.id));
  const points = selected.flatMap((line) => [line.from, line.to, ...line.anchorPoints, ...line.customPath.points]);
  if (points.length === 0) return lines;
  const bounds = points.reduce((result, point) => ({
    left: Math.min(result.left, point.x),
    right: Math.max(result.right, point.x),
    top: Math.min(result.top, point.y),
    bottom: Math.max(result.bottom, point.y),
  }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
  let dx = 0;
  let dy = 0;
  if (bounds.right - bounds.left <= 1) dx = bounds.left < 0 ? -bounds.left : bounds.right > 1 ? 1 - bounds.right : 0;
  if (bounds.bottom - bounds.top <= 1) dy = bounds.top < 0 ? -bounds.top : bounds.bottom > 1 ? 1 - bounds.bottom : 0;
  if (dx === 0 && dy === 0) return lines;
  return lines.map((line) => lineIds.has(line.id) ? transformLineGeometry(line, line.from, 1, 1, 0, { x: dx, y: dy }) : line);
}

function ShapeSliderField({ shapeType, control, ...props }: SliderFieldProps & { shapeType: ShapeType; control: ShapeControl }) {
  if (!supportsShapeControl(shapeType, control)) return null;
  return <SliderField {...props} />;
}
// ---------------------------------------------------------------------------
// Tiny presentational atoms (no external deps, dark/compact/dev-tool styling)
// ---------------------------------------------------------------------------

function Section({ title, children, defaultOpen = true, open: controlledOpen, onOpenChange, help }: {
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

function ColorPickerControl({ label, color, onChange }: { label: string; color: string; onChange: (color: string) => void }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState(color);
  const { hue, saturation, value } = hexToHsv(color);

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
            event.currentTarget.setPointerCapture(event.pointerId);
            updateBoard(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateBoard(event);
          }}
          onKeyDown={(event) => {
            const change = event.shiftKey ? 0.1 : 0.02;
            if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              const nextSaturation = Math.max(0, Math.min(1, saturation + (event.key === "ArrowRight" ? change : event.key === "ArrowLeft" ? -change : 0)));
              const nextValue = Math.max(0, Math.min(1, value + (event.key === "ArrowUp" ? change : event.key === "ArrowDown" ? -change : 0)));
              setHsv(hue, nextSaturation, nextValue);
            }
          }}
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
            event.currentTarget.setPointerCapture(event.pointerId);
            updateHue(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updateHue(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowDown") {
              event.preventDefault();
              setHsv((hue + (event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : 359)) % 360, saturation, value);
            }
          }}
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
                onChange(normalized);
              }
            }}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === "Enter") { event.preventDefault(); commitHex(); event.currentTarget.blur(); }
              if (event.key === "Escape") { setDraft(color); popoverRef.current?.hidePopover(); }
            }}
          />
        </label>
      </div>
    </>
  );
}

function ColorStyleEditor({ color, colorStyle, onColorChange, onColorStyleChange, onSpeedChange, onSpeedCommitStart, onSpeedCommitEnd, onColorWeightsChange }: {
  color: string;
  colorStyle?: LineColorStyle;
  onColorChange: (color: string) => void;
  onColorStyleChange: (style: LineColorStyle) => void;
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
    onColorStyleChange({ ...style, colors });
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
          aria-label="Line color style"
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
        <Row label="Color"><ColorPickerControl label="Line color" color={color} onChange={onColorChange} /></Row>
      ) : style.type === "rainbow" ? (
        <div className="ml-rainbow-style">
          <div className="ml-rainbow-preview" style={{ background: `linear-gradient(90deg, ${RAINBOW_COLORS.join(", ")})` }} aria-label="Rainbow colors from red through violet" role="img" />
          <small className="ml-gradient-help">The full rainbow spectrum appears across the line at once.</small>
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
                <ColorPickerControl label={`Color ${index + 1}`} color={stopColor} onChange={(nextColor) => setColor(index, nextColor)} />
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
                        onKeyUp={(event) => { if (event.key.startsWith("Arrow")) onSpeedCommitEnd(); }}
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
  step?: number;
  unit?: string;
  description?: string;
  example?: string;
  onLive: (v: number) => void;
  onCommitStart: () => void;
  onCommitEnd: () => void;
}

function formatNumericValue(value: number, step: number): string {
  if (!Number.isFinite(value)) return "0";
  const decimals = Math.max(0, Math.min(6, (String(step).split(".")[1] || "").length));
  return value.toFixed(decimals).replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function ScrubNumberField({ label, value, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, step, className = "ml-num", onChange, onCommitStart, onCommitEnd }: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step: number;
  className?: string;
  onChange: (value: number) => void;
  onCommitStart?: () => void;
  onCommitEnd?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => formatNumericValue(value, step));
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
    if (draft.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
    else setDraft(formatNumericValue(value, safeStep));
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
        value={draft}
        aria-label={`${label} exact value`}
        onFocus={() => {
          if (!editStartedRef.current) {
            editStartedRef.current = true;
            onCommitStart?.();
          }
          setDraft(formatNumericValue(value, safeStep));
        }}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "Escape") {
            cancelEditRef.current = true;
            setDraft(formatNumericValue(value, safeStep));
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
      aria-label={`${label}: ${formatNumericValue(value, safeStep)}. Drag up or down to adjust, or click to type.`}
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
        setDraft(formatNumericValue(value, safeStep));
        setEditing(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          adjustBy(event.key === "ArrowUp" ? safeStep : -safeStep);
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setDraft(formatNumericValue(value, safeStep));
          setEditing(true);
        }
      }}
      onWheel={(event) => {
        event.preventDefault();
        adjustBy(event.deltaY < 0 ? safeStep : -safeStep);
      }}
    >
      {formatNumericValue(value, safeStep)}
    </button>
  );
}

function SliderField({ label, value, min, max, step = 0.01, unit = "", description, example, onLive, onCommitStart, onCommitEnd }: SliderFieldProps) {
  const effectiveMax = Math.max(max, value, min + step);
  const help = description || `${label} changes the resolved ${label.toLowerCase()} value used by the renderer.`;

  return (
    <Row className="ml-slider-row" label={<>{label} <Tooltip title={label} description={help} example={example} /></>}>
      <div className="ml-slider-wrap">
        <div className="ml-value-wrap">
          <ScrubNumberField label={label} value={value} min={min} max={effectiveMax} step={step} onChange={onLive} onCommitStart={onCommitStart} onCommitEnd={onCommitEnd} />
          {unit && <span className="ml-unit">{unit}</span>}
        </div>
        <input
          type="range"
          min={min}
          max={effectiveMax}
          step={step}
          value={Math.min(effectiveMax, Math.max(min, value))}
          aria-label={label}
          aria-valuetext={`${formatNumericValue(value, step)}${unit ? ` ${unit}` : ""}`}
          onFocus={onCommitStart}
          onPointerDown={onCommitStart}
          onChange={(e) => onLive(Number(e.target.value))}
          onPointerUp={onCommitEnd}
          onKeyUp={(e) => { if (e.key === "Enter") onCommitEnd(); }}
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
  const [anchorPointsExpanded, setAnchorPointsExpanded] = useState(true);
  const [anchorTargetToAdd, setAnchorTargetToAdd] = useState("start");
  const [previewViewport, setPreviewViewport] = useState({ width: 1, height: 1 });
  const [selectedPathPointId, setSelectedPathPointId] = useState<string | null>(null);
  const [geometryExpanded, setGeometryExpanded] = useState(true);
  const [lineTransformExpanded, setLineTransformExpanded] = useState(false);
  const [groupTransformExpanded, setGroupTransformExpanded] = useState(false);
  const [soloLineId, setSoloLineId] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugFlags>({ showEndpoints: true, showIds: false, showTargetBounds: false });
  const [previewKey, setPreviewKey] = useState(0);
  const [showIO, setShowIO] = useState<null | "export" | "import">(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [importText, setImportText] = useState("");
  const [targetSnapshots, setTargetSnapshots] = useState<TargetSnapshot[]>([]);
  const [panel, setPanel] = useState<"editor" | "targets">("editor");
  const [globalTargetLineId, setGlobalTargetLineId] = useState<string | null>(config.lines[0]?.id || null);
  const [templates, setTemplates] = useState<string[]>([]);
  const [savedLineShapes, setSavedLineShapes] = useState<ReusableLineShape[]>([]);
  const [selectedSavedLineShapeName, setSelectedSavedLineShapeName] = useState("");
  const [lineShapeName, setLineShapeName] = useState("");
  const [lineShapeError, setLineShapeError] = useState<string | null>(null);
  const [storageLoaded, setStorageLoaded] = useState(false);

  const history = useHistory<MagneticLinesSceneConfig>(150);
  const pendingBeforeRef = useRef<MagneticLinesSceneConfig | null>(null);
  const groupBeforeRef = useRef<MagneticLinesSceneConfig | null>(null);
  const groupCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
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
      setTemplates(listSceneTemplates());
      setSavedLineShapes(listReusableLineShapes());
      setStorageLoaded(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

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

  // Poll the live target registry for the Targets panel (cheap, dev-tool only).
  useEffect(() => {
    const id = setInterval(() => setTargetSnapshots(getAllTargetSnapshots()), 300);
    return () => clearInterval(id);
  }, []);

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
        textureFlow: before.textureFlow === after.textureFlow ? after.inherit.textureFlow : false,
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

  const selectedLine = useMemo(() => { const line = config.lines.find((l) => l.id === selectedLineId); return line ? resolveLineConfig(line, config.global) : null; }, [config.lines, config.global, selectedLineId]);
  const selectedGroup = useMemo(() => config.groups.find((group) => group.id === selectedGroupId) ?? null, [config.groups, selectedGroupId]);
  const isLineEditing = panel === "editor" && !!selectedLine && (geometryExpanded || anchorPointsExpanded);
  const previewAspectRatio = previewViewport.width / Math.max(1, previewViewport.height);
  const animationPreviewWidth = Math.min(260, 132 * previewAspectRatio);
  const animationPreviewConfig = useMemo(() => selectedLine ? ({
    ...config,
    animation: { ...config.animation, playing: true },
    lines: config.lines.map((line) => line.id === selectedLine.id ? { ...line, enabled: true, visible: true } : line),
  }) : null, [config, selectedLine]);

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
  function reorderLayerBlock(lineIds: string[], targetLineId: string) {
    const movedIds = new Set(lineIds);
    if (movedIds.has(targetLineId) || movedIds.size === 0) return;
    commitDiscrete((c) => {
      const moving = c.lines.filter((line) => movedIds.has(line.id));
      const remaining = c.lines.filter((line) => !movedIds.has(line.id));
      const targetIndex = remaining.findIndex((line) => line.id === targetLineId);
      if (targetIndex < 0 || moving.length === 0) return c;
      return { ...c, lines: [...remaining.slice(0, targetIndex), ...moving, ...remaining.slice(targetIndex)] };
    });
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
      const transformedLines = current.lines.map((line) => {
        if (!group.lineIds.includes(line.id)) return line;
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
      return {
        ...current,
        groups: current.groups.map((item) => item.id === groupId ? { ...item, scale, rotation, scaleX: nextScaleX, scaleY: nextScaleY } : item),
        lines: fitLineGeometryToCanvas(transformedLines, new Set(group.lineIds)),
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
    const transformed = fitLineGeometryToCanvas(
      [transformLineGeometry(selectedLine, center, scaleXFactor, scaleYFactor, rotationDelta, offset)],
      new Set([selectedLine.id]),
    )[0];
    if (!transformed) return;
    updateLineLive(selectedLine.id, (line) => ({
      ...transformed,
      ...line,
      from: transformed.from,
      to: transformed.to,
      anchorPoints: transformed.anchorPoints,
      customPath: transformed.customPath,
      anchorMotion: transformed.anchorMotion,
      lineTransform: { scaleX, scaleY, rotation },
    }));
  }
  function dragSelectedLine(lineId: string, delta: Point) {
    updateLineLive(lineId, (line) => fitLineGeometryToCanvas(
      [transformLineGeometry(line, line.from, 1, 1, 0, delta)],
      new Set([lineId]),
    )[0] ?? line);
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
  function resetLineScope(scope: "appearance" | "shape" | "motion" | "magnet" | "glow" | "outerGlow" | "texture" | "textureFlow" | "cursorInfluence" | "lineInteraction" | "constraint" | "occlusion") {
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
      const points = line.customPath.points.map((item) => item.id === pointId ? { ...item, x: sourcePoint.x, y: sourcePoint.y } : item);
      const first = points[0];
      const last = points[points.length - 1];
      return { ...line, generatedShapePreset: undefined, from: first && pointId === first.id ? { x: sourcePoint.x, y: sourcePoint.y } : line.from, to: last && pointId === last.id ? { x: sourcePoint.x, y: sourcePoint.y } : line.to, customPath: { ...line.customPath, points } };
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
        };
      }

      const mergedPoints = points.filter((point) => point.id !== draggedPointId);
      const first = mergedPoints[0];
      const last = mergedPoints[mergedPoints.length - 1];
      if (!first || !last) return line;
      mergedInto = nearbyPointId;
      return {
        ...line,
        generatedShapePreset: undefined,
        from: { x: first.x, y: first.y },
        to: { x: last.x, y: last.y },
        customPath: { ...line.customPath, points: mergedPoints },
        anchorPoints: line.anchorPoints.filter((point) => point.pathPointId !== draggedPointId),
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
      anchorPoints: line.anchorPoints.filter((point) => point.pathPointId !== selectedPathPointId),
    }));
    setSelectedPathPointId(null);
    setSelectedAnchorPointId(null);
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
      return { ...line, anchorPoints: [...line.anchorPoints, seeded] };
    });
  }
  function removeAnchorPoint(pointId: string) {
    if (!selectedLine) return;
    updateLineDiscrete(selectedLine.id, (line) => ({ ...line, anchorPoints: line.anchorPoints.filter((point) => point.id !== pointId) }));
    setSelectedAnchorPointId((id) => id === pointId ? null : id);
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
    return config.targets.find((t) => t.id === id) || { id, enabled: true, magnetic: true, strength: 1, radius: 0, priority: snapshot?.priority ?? 0 };
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

  // ---- import / export -----------------------------------------------------

  function applyPreset(name: string) {
    commitDiscrete((scene) => sanitizeSceneConfig(applyScenePreset(scene, name)));
  }

  function loadTemplateByName(name: string) {
    const template = loadSceneTemplate(name);
    if (!template) return;
    commitDiscrete(() => template);
    selectLineForEditing(template.lines[0]?.id || null);
  }

  function removeTemplate(name: string) {
    deleteSceneTemplate(name);
    setTemplates(listSceneTemplates());
  }

  function saveTemplate() {
    const name = window.prompt("Template name");
    if (name?.trim()) { saveSceneTemplate(name, config); setTemplates(listSceneTemplates()); }
  }

  function saveAndOpenTestPage() {
    savePersistedScene(config);
    router.push("/");
  }
  function toggleAllPanels() {
    const collapse = !leftPanelCollapsed || !rightPanelCollapsed;
    setLeftPanelCollapsed(collapse);
    setRightPanelCollapsed(collapse);
  }

  function doExport() {
    setImportText(JSON.stringify(config, null, 2));
    setShowIO("export");
  }
  function copyExport() {
    navigator.clipboard?.writeText(JSON.stringify(config, null, 2)).catch(() => {});
  }
  function downloadExport() {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magnetic-lines-scene.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function doImport() {
    try {
      const parsed = JSON.parse(importText);
      const safe = sanitizeSceneConfig(parsed);
      commitDiscrete(() => safe);
      selectLineForEditing(safe.lines[0]?.id || null);
      setShowIO(null);
    } catch {
      // Malformed JSON ? keep the dialog open with what the user typed, don't crash.
    }
  }
  function onImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
  }

  const g = config.global;
  const magnetTargetIds = Array.from(new Set([...config.targets.map((target) => target.id), ...targetSnapshots.map((target) => target.id)]));
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
              const { endpoint, pathPointId } = target;
              const points = anchorPoints.filter((point) =>
                point.endpoint === endpoint && (endpoint !== "path" || point.pathPointId === pathPointId));
              if (points.length === 0) return null;
              return (
                <details className={`ml-line-anchor-endpoint ${endpoint}`} key={target.value}>
                  <summary onClick={(e) => e.stopPropagation()}>{target.label} ({points.length})</summary>
                  {points.map((point) => (
                    <button
                      type="button"
                      key={point.id}
                      className={`ml-layer-anchor-point ${selectedAnchorPointId === point.id ? "selected" : ""}`}
                      onClick={() => { selectLineForEditing(line.id); setSelectedAnchorPointId(point.id); }}
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
  for (const line of config.lines) {
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
        <strong className="ml-title">Magnetic Lines Editor</strong>
        <span className="ml-toolbar-spacer" />
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
        <button className="ml-btn ml-primary" onClick={saveAndOpenTestPage}>Save &amp; Test</button>
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
              <select className="ml-select ml-menu-select" defaultValue="" onChange={(e) => { if (e.target.value) applyPreset(e.target.value); e.currentTarget.value = ""; }}>
                <option value="">Load preset</option>{Object.keys(SCENE_PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <select className="ml-select ml-menu-select" defaultValue="" onChange={(e) => { if (e.target.value) loadTemplateByName(e.target.value); e.currentTarget.value = ""; }}>
                <option value="">Load template</option>{templates.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button className="ml-menu-action" onClick={saveTemplate}>Save template</button>
              <button className="ml-menu-action" onClick={() => { const name = window.prompt("Template to delete"); if (name) removeTemplate(name); }}>Delete template</button>
            </section>
            <section className="ml-overflow-section">
              <strong>Scene</strong>
              <button className="ml-menu-action" onClick={doExport}>Export</button>
              <button className="ml-menu-action" onClick={() => { setImportText(""); setShowIO("import"); }}>Import</button>
              <button className="ml-menu-action ml-danger" onClick={resetScene}>Reset to defaults</button>
            </section>
          </div>
        </details>
      </div>

      <div className={`ml-body ${panel === "editor" && globalTargetLineId === null ? "global-selected" : ""} ${leftPanelCollapsed ? "panel-left-collapsed" : ""} ${rightPanelCollapsed ? "panel-right-collapsed" : ""}`}>
        {leftPanelCollapsed && (
          <button type="button" className="ml-panel-reopen left" onClick={() => setLeftPanelCollapsed(false)} aria-label="Show layers panel">Layers</button>
        )}
        <div className={`ml-sidebar ${isLineEditing ? "editing-line" : ""}`}>
          <div className="ml-tabs">
            <button className={`ml-tab ${panel === "editor" ? "active" : ""}`} onClick={() => setPanel("editor")}>Lines + Global</button>
            <button className={`ml-tab ${panel === "targets" ? "active" : ""}`} onClick={() => setPanel("targets")}>Targets</button>
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
                <Row label="Type">
                  <select className="ml-select" value={g.motionType} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, motionType: e.target.value as MotionType } }))}>
                    <option value="tension">tension</option>
                    <option value="floating">floating</option>
                    <option value="vibration">vibration</option>
                  </select>
                </Row>
                <SliderField label="Speed" value={g.speed} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, speed: v } }))} />
                <SliderField label="Amplitude" value={g.amplitude} min={0} max={10} step={0.01} description="Motion amplitude as a fraction of the viewport's shorter side. High values create very large movement." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, amplitude: v } }))} />
                <SliderField label="Frequency" value={g.frequency} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, frequency: v } }))} />
                <SliderField label="Phase" value={g.phase} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, phase: v } }))} />
                <SliderField label="Deformability" value={g.deformability} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, deformability: v } }))} />
              </Section>
              <Section title="MAGNET" help="Pulls the line toward configured magnetic targets.">
                                <Row label="Target"><select className="ml-select" value={g.targetId || ""} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, targetId: e.target.value || null } }))}><option value="">highest priority active</option>{magnetTargetIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></Row>
<Row label="Enabled"><input type="checkbox" checked={g.magnetismEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, magnetismEnabled: !c.global.magnetismEnabled } }))} /></Row>
                <SliderField label="Strength" description="Controls how strongly an affected line bends toward a target. 0 means no deformation." example="0.5 is subtle; 1 is a normal response." value={g.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, strength: v } }))} />
                <SliderField label="Radius" unit="normalized" description="Controls the target influence distance as a fraction of the viewport minimum dimension." example="0.2 reaches roughly 20% of the shorter viewport side." value={g.radius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, radius: v } }))} />
                <SliderField label="Falloff" value={g.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, falloff: v } }))} />
                <SliderField label="Max Deform" value={g.maxDeformation} min={0} max={0.3} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, maxDeformation: v } }))} />
              </Section>
              <Section title="GLOW" help="Adds persistent inner and outer illumination to the line.">
                <Row label="Enabled"><input type="checkbox" checked={g.glowEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, glowEnabled: !c.global.glowEnabled } }))} /></Row>
                <Row label="Color"><input type="color" value={g.glowColor} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, glowColor: e.target.value } }))} /></Row>
                <SliderField label="Intensity" description="Controls magnetic glow brightness. 0 removes the glow contribution." example="0.3 gives a restrained highlight." value={g.glowIntensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowIntensity: v } }))} />
                <SliderField label="Radius" value={g.glowRadius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowRadius: v } }))} />
                <SliderField label="Length" value={g.glowLength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowLength: v } }))} />
                <SliderField label="Falloff" value={g.glowFalloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowFalloff: v } }))} />
                <SliderField label="Max Combined" value={g.glowMaxCombinedIntensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, glowMaxCombinedIntensity: v } }))} />
              </Section>
              <Section title="OUTER GLOW">
                <Row label="Enabled"><input type="checkbox" checked={g.outerGlowEnabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, outerGlowEnabled: !c.global.outerGlowEnabled } }))} /></Row>
                <Row label="Color"><input type="color" value={g.outerGlowColor} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, outerGlowColor: e.target.value } }))} /></Row>
                <SliderField label="Intensity" value={g.outerGlowIntensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowIntensity: v } }))} />
                <SliderField label="Radius" value={g.outerGlowRadius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowRadius: v } }))} />
                <SliderField label="Length" value={g.outerGlowLength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowLength: v } }))} />
                <SliderField label="Falloff" value={g.outerGlowFalloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, outerGlowFalloff: v } }))} />
              </Section>
              <Section title="CURSOR GLOW" defaultOpen={false} help="Illuminates only the portion of the line near the pointer.">
                <Row label="Enabled"><input type="checkbox" checked={config.cursor.enabled} onChange={() => commitDiscrete((c) => ({ ...c, cursor: { ...c.cursor, enabled: !c.cursor.enabled } }))} /></Row>
                <Row label="Color"><input type="color" value={config.cursor.color} onChange={(e) => commitDiscrete((c) => ({ ...c, cursor: { ...c.cursor, color: e.target.value } }))} /></Row>
                <SliderField label="Intensity" value={config.cursor.intensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, intensity: v } }))} />
                <SliderField label="Radius" value={config.cursor.radius} min={0} max={0.4} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, radius: v } }))} />
                <SliderField label="Falloff" value={config.cursor.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, falloff: v } }))} />
                <SliderField label="Smoothing" value={config.cursor.smoothing} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, smoothing: v } }))} />
                <SliderField label="Release Speed" value={config.cursor.releaseSpeed} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, releaseSpeed: v } }))} />
                <SliderField label="Length" value={config.cursor.length} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, length: v } }))} />
                <SliderField label="Opacity" value={config.cursor.opacity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, opacity: v } }))} />
                <SliderField label="Max Intensity" value={config.cursor.maxIntensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, cursor: { ...c.cursor, maxIntensity: v } }))} />
              </Section>
              <Section title="CURSOR INFLUENCE" defaultOpen={false} help="Deforms the line locally around the cursor without altering the underlying base stroke.">
                <Row label="Enabled"><input type="checkbox" checked={g.cursorInfluence.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, enabled: !c.global.cursorInfluence.enabled } } }))} /></Row>
                <SliderField label="Strength" value={g.cursorInfluence.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, strength: v } } }))} />
                <SliderField label="Radius" value={g.cursorInfluence.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, radius: v } } }))} />
                <SliderField label="Falloff" value={g.cursorInfluence.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, falloff: v } } }))} />
                <SliderField label="Max Deform" value={g.cursorInfluence.maxDeformation} min={0} max={0.2} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, maxDeformation: v } } }))} />
                <Row label="Mode"><select className="ml-select" value={g.cursorInfluence.mode} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, cursorInfluence: { ...c.global.cursorInfluence, mode: "attract" } } }))}><option value="attract">attract</option></select></Row>
              </Section>
              <Section title="LINE INTERACTION" defaultOpen={false} help="Controls how nearby lines respond to each other.">
                <Row label="Enabled"><input type="checkbox" checked={g.lineInteraction.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, enabled: !c.global.lineInteraction.enabled } } }))} /></Row>
                <SliderField label="Strength" value={g.lineInteraction.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, strength: v } } }))} />
                <SliderField label="Radius" value={g.lineInteraction.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, radius: v } } }))} />
                <SliderField label="Falloff" value={g.lineInteraction.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, falloff: v } } }))} />
                <Row label="Mode"><select className="ml-select" value={g.lineInteraction.mode} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, lineInteraction: { ...c.global.lineInteraction, mode: "avoid" } } }))}><option value="avoid">avoid</option></select></Row>
              </Section>
              <Section title="CONSTRAINT" defaultOpen={false} help="Limits how far interactive systems can deform the line.">
                <Row label="Enabled"><input type="checkbox" checked={g.constraint.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, constraint: { ...c.global.constraint, enabled: !c.global.constraint.enabled } } }))} /></Row>
                <SliderField label="Max Deform" value={g.constraint.maxDeformation} min={0} max={0.3} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, constraint: { ...c.global.constraint, maxDeformation: v } } }))} />
                <Row label="Boundary"><select className="ml-select" value={g.constraint.boundary} onChange={(e) => commitDiscrete((c) => ({ ...c, global: { ...c.global, constraint: { ...c.global.constraint, boundary: e.target.value as "none" | "viewport" } } }))}><option value="none">none</option><option value="viewport">viewport</option></select></Row>
                <SliderField label="Padding" value={g.constraint.padding} min={0} max={0.2} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => liveUpdate((c) => ({ ...c, global: { ...c.global, constraint: { ...c.global.constraint, padding: v } } }))} />
              </Section>
              <Section title="OCCLUSION" defaultOpen={false} help="Controls how overlapping lines visually appear in front of or behind one another.">
                <Row label="Enabled"><input type="checkbox" checked={g.occlusion.enabled} onChange={() => commitDiscrete((c) => ({ ...c, global: { ...c.global, occlusion: { ...c.global.occlusion, enabled: !c.global.occlusion.enabled } } }))} /></Row>
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
              {targetSnapshots.length === 0 && <p className="ml-hint">No registered targets yet. Wrap elements with &lt;MagneticTarget id=&quot;...&quot;&gt; or useMagneticTarget().</p>}
              {targetSnapshots.map((t) => {
                const cfg = targetConfigFor(t.id);
                return (
                  <div key={t.id} className="ml-target-card">
                    <div className="ml-target-head">
                      <strong>{t.id}</strong>
                      <span className={`ml-badge ${t.active ? "on" : ""}`}>{t.active ? "ACTIVE" : "idle"}</span>
                    </div>
                    <Row label="Enabled"><input type="checkbox" checked={cfg.enabled} onChange={() => updateTarget(t.id, (c) => ({ ...c, enabled: !c.enabled }))} /></Row>
                    <Row label="Magnetic"><input type="checkbox" checked={cfg.magnetic} onChange={() => updateTarget(t.id, (c) => ({ ...c, magnetic: !c.magnetic }))} /></Row>
                    <Row label="Strength"><ScrubNumberField label={`${t.id} strength`} min={0} step={0.01} value={cfg.strength} onChange={(value) => updateTarget(t.id, (c) => ({ ...c, strength: value }))} /></Row>
                    <Row label="Radius +"><ScrubNumberField label={`${t.id} radius`} min={0} step={0.01} value={cfg.radius} onChange={(value) => updateTarget(t.id, (c) => ({ ...c, radius: value }))} /></Row>
                    <Row label="Priority"><ScrubNumberField label={`${t.id} priority`} step={1} value={cfg.priority} onChange={(value) => updateTarget(t.id, (c) => ({ ...c, priority: Math.round(value) }))} /></Row>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="ml-preview-wrap">
          <MagneticBackgroundLines
            key={previewKey}
            config={config}
            interactive
            pauseAnimation={isLineEditing}
            selectedLineId={panel === "editor" ? selectedLineId : null}
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
            selectedPathPointId={panel === "editor" ? selectedPathPointId : null}
            selectedAnchorPointId={panel === "editor" ? selectedAnchorPointId : null}
            showAnchorPointHandles={panel === "editor" && anchorPointsExpanded}
            showPathPointHandles={panel === "editor" && geometryExpanded}
            onSelectPathPoint={(_, pointId) => setSelectedPathPointId(pointId)}
            onSelectAnchorPoint={(_, pointId) => setSelectedAnchorPointId(pointId)}
            onPathPointDragStart={() => captureBeforeChange()}
            onDragPathPoint={updatePathPoint}
            onPathPointDragEnd={mergePathPoints}
            onDragEndpoint={updateLineEndpointPoint}
            onDragCommit={commitPending}
          />
        </div>

        {rightPanelCollapsed && (
          <button type="button" className="ml-panel-reopen right" onClick={() => setRightPanelCollapsed(false)} aria-label="Show controls panel">Controls</button>
        )}
        <div className="ml-inspector">
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
              <p className="ml-hint">Open Group Transform to show the dotted selection box. Drag inside it to move, its corner to resize, or the top handle to rotate.</p>
              <Section title="GROUP TRANSFORM" open={groupTransformExpanded} onOpenChange={setGroupTransformExpanded}>
                <small className="ml-gradient-help">Open the dotted box on the canvas. Drag inside it to move, its corner to resize, or the top handle to rotate.</small>
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
                <small className="ml-gradient-help">Open the dotted box on the canvas. Drag inside it to move, its corner to resize, or the top handle to rotate.</small>
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
                                if (!open) setSelectedAnchorPointId(null);
                              }}
                              help="Choose a line endpoint or any editable shape vertex as the anchor target. Each target has its own ordered animation route."
                            >
                              <Row label="Attach to">
                                <select aria-label="Anchor attachment target" className="ml-select" value={anchorTargetToAdd} onChange={(event) => setAnchorTargetToAdd(event.target.value)}>
                                  {getAnchorTargets(selectedLine).map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
                                </select>
                              </Row>
                              <button className="ml-btn" onClick={() => addAnchorPoint(anchorTargetToAdd)}>+ Add animation point</button>
                              {getAnchorTargets(selectedLine).filter((target) =>
                                target.endpoint !== "path" || selectedLine.anchorPoints.some((point) =>
                                  point.endpoint === "path" && point.pathPointId === target.pathPointId)).map((target) => {
                                const { endpoint, pathPointId } = target;
                                const points = selectedLine.anchorPoints
                                  .filter((point) => point.endpoint === endpoint &&
                                    (endpoint !== "path" || point.pathPointId === pathPointId))
                                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                                const lastPoint = points[points.length - 1];
                                return (
                                  <div key={target.value} className={`ml-anchor-group ${endpoint}`}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                      <strong><span className="ml-anchor-key" />{target.label} <span className="ml-anchor-count">{points.length}</span></strong>
                                    </div>
                                    {points.length === 0 ? (
                                      <p className="ml-anchor-empty">No points yet</p>
                                    ) : (
                                      points.map((point) => (
                                        <div key={point.id} className={`ml-anchor-card ${endpoint} ${selectedAnchorPointId === point.id ? "selected" : ""}`}>
                                              <div className="ml-anchor-card-head">
                                            <button type="button" className="ml-anchor-point-select" aria-pressed={selectedAnchorPointId === point.id} onClick={() => setSelectedAnchorPointId(point.id)}><span className="ml-anchor-key" />Point {point.order + 1}</button>
                                            <button className="ml-btn ml-danger" onClick={() => removeAnchorPoint(point.id)}>Remove</button>
                                          </div>
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
                                  max={4}
                                  step={0.01}
                                  value={point.speed}
                                  onCommitStart={captureBeforeChange}
                                  onCommitEnd={commitPending}
                                  onChange={(value) => updateAnchorPoint(point.id, { speed: value })}
                                />
                              </label>
                            </div>
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
                          </div>
                        ))
                      )}
                    </div>
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
                {selectedLine.geometrySource === "path" && (
                  <>
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
                <SliderField
                  label="Start delay"
                  description="Wait this many seconds after the line is added or its delay is changed before its motion begins. Use different delays to stagger matching lines."
                  value={selectedLine.startDelay ?? 0}
                  min={0}
                  max={10}
                  step={0.01}
                  unit="s"
                  onCommitStart={captureBeforeChange}
                  onCommitEnd={commitPending}
                  onLive={(startDelay) => updateLineLive(selectedLine.id, (line) => ({ ...line, startDelay }))}
                />
                <Row label="Preset">
                  <select className="ml-select" defaultValue="" onChange={(e) => {
                    const preset = MOTION_PRESETS[e.target.value];
                    if (preset) updateLineDiscrete(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, ...preset } }));
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
                <SliderField label="Speed" value={selectedLine.motion.speed} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, speed: v } }))} />
                <SliderField label="Amplitude" value={selectedLine.motion.amplitude} min={0} max={10} step={0.01} description="Motion amplitude as a fraction of the viewport's shorter side. High values create very large movement." onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, amplitude: v } }))} />
                <SliderField label="Frequency" value={selectedLine.motion.frequency} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, frequency: v } }))} />
                <SliderField label="Phase" value={selectedLine.motion.phase} min={0} max={10} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, phase: v } }))} />
                <SliderField label="Flexibility" value={selectedLine.motion.deformability} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, motion: { ...l.motion, deformability: v } }))} />
              </Section>

              <Section title="MAGNET" defaultOpen={false}>
                                <Row label="Target"><select className="ml-select" value={selectedLine.magnet.targetId || ""} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, targetId: e.target.value || null } }))}><option value="">global / highest priority</option>{magnetTargetIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></Row>
<Row label="Enabled"><input type="checkbox" checked={selectedLine.magnet.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, enabled: !l.magnet.enabled } }))} /></Row>
                <SliderField label="Strength" value={selectedLine.magnet.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, strength: v } }))} />
                <SliderField label="Radius" value={selectedLine.magnet.radius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, radius: v } }))} />
                <SliderField label="Falloff" value={selectedLine.magnet.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, falloff: v } }))} />
                <SliderField label="Max Deform" value={selectedLine.magnet.maxDeformation} min={0} max={0.3} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, magnet: { ...l.magnet, maxDeformation: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("magnet")}>Reset to Global</button>
              </Section>

              <Section title="GLOW" defaultOpen={false}>
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.glow.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, enabled: !l.glow.enabled } }))} /></Row>
                <Row label="Color"><input type="color" value={selectedLine.glow.color} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, color: e.target.value } }))} /></Row>
                <SliderField label="Intensity" value={selectedLine.glow.intensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, intensity: v } }))} />
                <SliderField label="Radius" value={selectedLine.glow.radius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, radius: v } }))} />
                <SliderField label="Length" value={selectedLine.glow.length} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, length: v } }))} />
                <SliderField label="Falloff" value={selectedLine.glow.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, glow: { ...l.glow, falloff: v } }))} />
              </Section>
              <Section title="OUTER GLOW" defaultOpen={false}>
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.outerGlow.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, enabled: !line.outerGlow.enabled } }))} /></Row>
                <Row label="Color"><input type="color" value={selectedLine.outerGlow.color} onChange={(e) => updateLineDiscrete(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, color: e.target.value } }))} /></Row>
                <SliderField label="Intensity" value={selectedLine.outerGlow.intensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, intensity: v } }))} />
                <SliderField label="Radius" value={selectedLine.outerGlow.radius} min={0} max={0.5} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, radius: v } }))} />
                <SliderField label="Length" value={selectedLine.outerGlow.length} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, length: v } }))} />
                <SliderField label="Falloff" value={selectedLine.outerGlow.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (line) => ({ ...line, outerGlow: { ...line.outerGlow, falloff: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("outerGlow")}>Reset to Global</button>
              </Section>

              <Section title="CURSOR GLOW" defaultOpen={false} help="Illuminates only the portion of the line near the pointer.">
                <Row label="Participates"><input type="checkbox" checked={selectedLine.cursorGlow.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, cursorGlow: { enabled: !l.cursorGlow.enabled } }))} /></Row>
              </Section>

              <Section title="CURSOR INFLUENCE" defaultOpen={false} help="Deforms the line locally around the cursor without altering the underlying base stroke.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.cursorInfluence.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, enabled: !l.cursorInfluence.enabled } }))} /></Row>
                <SliderField label="Strength" value={selectedLine.cursorInfluence.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, strength: v } }))} />
                <SliderField label="Radius" value={selectedLine.cursorInfluence.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, radius: v } }))} />
                <SliderField label="Falloff" value={selectedLine.cursorInfluence.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, falloff: v } }))} />
                <SliderField label="Max Deform" value={selectedLine.cursorInfluence.maxDeformation} min={0} max={0.2} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, maxDeformation: v } }))} />
                <Row label="Mode"><select className="ml-select" value={selectedLine.cursorInfluence.mode} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, cursorInfluence: { ...l.cursorInfluence, mode: "attract" } }))}><option value="attract">attract</option></select></Row>
                <button className="ml-btn" onClick={() => resetLineScope("cursorInfluence")}>Reset to Global</button>
              </Section>
              <Section title="TEXTURE" defaultOpen={false} help="Adds stable surface detail to the final stroke without changing its geometry.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.texture.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, enabled: !l.texture.enabled } }))} /></Row>
                <Row label="Type"><select className="ml-select" value={selectedLine.texture.type} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, type: e.target.value as "grain" | "fiber" } }))}><option value="grain">grain</option><option value="fiber">fiber</option></select></Row>
                <SliderField label="Scale" value={selectedLine.texture.scale} min={0.005} max={0.1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, scale: v } }))} />
                <SliderField label="Intensity" value={selectedLine.texture.intensity} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, texture: { ...l.texture, intensity: v } }))} />
              </Section>

              <Section title="LINE INTERACTION" defaultOpen={false} help="Controls how nearby lines respond to each other.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.lineInteraction.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, enabled: !l.lineInteraction.enabled } }))} /></Row>
                <SliderField label="Strength" value={selectedLine.lineInteraction.strength} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, strength: v } }))} />
                <SliderField label="Radius" value={selectedLine.lineInteraction.radius} min={0} max={0.5} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, radius: v } }))} />
                <SliderField label="Falloff" value={selectedLine.lineInteraction.falloff} min={0} max={1} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, falloff: v } }))} />
                <Row label="Mode"><select className="ml-select" value={selectedLine.lineInteraction.mode} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, lineInteraction: { ...l.lineInteraction, mode: "avoid" } }))}><option value="avoid">avoid</option></select></Row>
                <button className="ml-btn" onClick={() => resetLineScope("lineInteraction")}>Reset to Global</button>
              </Section>
              <Section title="CONSTRAINT" defaultOpen={false} help="Limits how far interactive systems can deform the line.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.constraint.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, constraint: { ...l.constraint, enabled: !l.constraint.enabled } }))} /></Row>
                <SliderField label="Max Deform" value={selectedLine.constraint.maxDeformation} min={0} max={0.3} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, constraint: { ...l.constraint, maxDeformation: v } }))} />
                <Row label="Boundary"><select className="ml-select" value={selectedLine.constraint.boundary} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, constraint: { ...l.constraint, boundary: e.target.value as "none" | "viewport" } }))}><option value="none">none</option><option value="viewport">viewport</option></select></Row>
                <SliderField label="Padding" value={selectedLine.constraint.padding} min={0} max={0.2} step={0.005} unit="norm" onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, constraint: { ...l.constraint, padding: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("constraint")}>Reset to Global</button>
              </Section>
              <Section title="TEXTURE FLOW" defaultOpen={false} help="Moves the surface pattern along the line without moving the line itself.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.textureFlow.enabled} disabled={!selectedLine.texture.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, textureFlow: { ...l.textureFlow, enabled: !l.textureFlow.enabled } }))} /></Row>
                <SliderField label="Speed" value={selectedLine.textureFlow.speed} min={0} max={4} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, textureFlow: { ...l.textureFlow, speed: v } }))} />
                <Row label="Direction"><select className="ml-select" value={selectedLine.textureFlow.direction} disabled={!selectedLine.texture.enabled} onChange={(e) => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, textureFlow: { ...l.textureFlow, direction: e.target.value as "forward" | "reverse" } }))}><option value="forward">forward</option><option value="reverse">reverse</option></select></Row>
                <SliderField label="Offset" value={selectedLine.textureFlow.offset} min={0} max={1} step={0.01} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onLive={(v) => updateLineLive(selectedLine.id, (l) => ({ ...l, textureFlow: { ...l.textureFlow, offset: v } }))} />
                <button className="ml-btn" onClick={() => resetLineScope("textureFlow")}>Reset to Global</button>
              </Section>
              <Section title="OCCLUSION" defaultOpen={false} help="Controls how overlapping lines visually appear in front of or behind one another.">
                <Row label="Enabled"><input type="checkbox" checked={selectedLine.occlusion.enabled} onChange={() => updateLineDiscrete(selectedLine.id, (l) => ({ ...l, occlusion: { ...l.occlusion, enabled: !l.occlusion.enabled } }))} /></Row>
                <button className="ml-btn" onClick={() => resetLineScope("occlusion")}>Reset to Global</button>
              </Section>              <Section title="LAYER" defaultOpen={false} help="Controls the rendering order of the line.">
                <Row label="Z-Index"><ScrubNumberField label="Z-Index" step={1} value={selectedLine.appearance.zIndex} onCommitStart={captureBeforeChange} onCommitEnd={commitPending} onChange={(value) => updateLineLive(selectedLine.id, (line) => ({ ...line, appearance: { ...line.appearance, zIndex: Math.round(value) } }))} /></Row>
              </Section>
            </>
          )}
        </div>
      </div>

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

      {showIO && (
        <div className="ml-modal-backdrop" onClick={() => setShowIO(null)}>
          <div className="ml-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ml-modal-head">
              <strong>{showIO === "export" ? "Export Configuration" : "Import Configuration"}</strong>
              <button className="ml-btn" onClick={() => setShowIO(null)} aria-label="Close">×</button>
            </div>
            <textarea className="ml-textarea" value={importText} onChange={(e) => setImportText(e.target.value)} spellCheck={false} />
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
    </div>
  );
}

const EDITOR_CSS = `
.ml-editor { position: relative; width: 100%; height: 100%; min-height: 0; max-height: 100%; background: #0b0c10; color: #d7dbe3; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; }
.ml-toolbar { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: linear-gradient(180deg, rgba(20,23,31,.98), rgba(13,15,21,.98)); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.ml-toolbar-spacer { flex: 1 1 auto; }
.ml-title { margin-right: 8px; color: #eef1f6; font-size: 13px; }
.ml-sep { width: 1px; height: 18px; background: #2a2c36; margin: 0 4px; }.ml-view-tools { display: inline-flex; align-items: center; gap: 6px; padding: 2px 6px; border: 1px solid #2a2c36; border-radius: 999px; background: rgba(28, 30, 38, 0.8); }.ml-inline-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a8fa3; }
.ml-btn { background: #1c1e26; color: #d7dbe3; border: 1px solid #2a2c36; border-radius: 6px; padding: 5px 9px; font-size: 11px; cursor: pointer; }
.ml-btn:hover { background: #262933; }
.ml-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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
.ml-menu-action { width: 100%; padding: 6px; border: 0; border-radius: 4px; background: transparent; color: #d7dbe3; text-align: left; font-size: 11px; cursor: pointer; }
.ml-menu-action:hover { background: #252934; }
.ml-menu-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #c7cbd6; font-size: 11px; }
.ml-menu-pair { display: flex; gap: 6px; }
.ml-menu-pair > .ml-btn { flex: 1; }
.ml-menu-select { width: 100%; }
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
.ml-animation-preview { flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px; padding: 8px; border-top: 1px solid #22242c; background: #0c0d12; }
.ml-animation-preview > strong { color: #aeb4c2; font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
.ml-animation-preview-canvas { position: relative; width: min(100%, 260px); overflow: hidden; border: 1px solid #343946; border-radius: 6px; background: radial-gradient(ellipse at 50% 0%, #171a23 0%, #090a0d 80%); }
.ml-animation-preview > small { color: #7f8797; font-size: 9px; line-height: 1.35; }
.ml-layer-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 7px 8px; border-bottom: 1px solid #22242c; color: #aeb4c2; font-size: 11px; }
.ml-layer-toolbar small { display: block; margin-top: 3px; color: #6b7080; font-size: 9px; }
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
.ml-anchor-group > div > strong { display: inline-flex; align-items: center; gap: 7px; }
.ml-anchor-card { margin-top: 8px; padding: 8px; border: 1px solid #252833; border-radius: 5px; background: #0d0e12; }
.ml-anchor-card.selected { border-color: #eef1f6; box-shadow: 0 0 0 1px #eef1f633; }
.ml-anchor-card.start { border-left: 2px solid #f7d974; }
.ml-anchor-card.end { border-left: 2px solid #78aaff; }
.ml-anchor-card.path { border-left: 2px solid #5ee6ff; }
.ml-anchor-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.ml-anchor-card { display: flex; flex-direction: column; gap: 9px; }
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
@media (max-width: 900px) { .ml-body { flex-direction: column; overflow: hidden; } .ml-sidebar, .ml-inspector { width: 100%; max-height: 24dvh; flex-shrink: 0; } .ml-sidebar { overflow-y: auto; } .ml-sidebar > .ml-scroll { flex: 0 0 auto; overflow: visible; } .ml-preview-wrap { height: 52dvh; min-height: 280px; flex: 0 0 auto; width: 100%; } }
@media (max-width: 900px) { .ml-body.global-selected .ml-preview-wrap { margin-right: 0; } .ml-global-editor.active { position: static; width: 100%; max-height: 24dvh; flex: 0 0 auto; border-left: 0; border-top: 1px solid #22242c; } }
@media (max-width: 900px) { .ml-sidebar, .ml-inspector { flex: 0 0 auto; max-width: 100%; } .ml-sidebar { max-height: 30dvh; } .ml-inspector { max-height: 40dvh; } }
`;
