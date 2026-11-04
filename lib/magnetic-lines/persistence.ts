import type { CustomPath, MagneticLinesSceneConfig, ShapeConfig } from "./types";
import { DEFAULT_SCENE } from "./defaultScene";
import { sanitizeLine, sanitizeSceneConfig } from "./editor/validate";

export const SCENE_STORAGE_KEY = "magnetic-lines-scene:v1";
export const SCENE_CHANGE_EVENT = "magnetic-lines-scene-change";

export function loadPersistedScene(): MagneticLinesSceneConfig {
  if (typeof window === "undefined") return DEFAULT_SCENE;
  try {
    const raw = window.localStorage.getItem(SCENE_STORAGE_KEY);
    return raw ? sanitizeSceneConfig(JSON.parse(raw)) : sanitizeSceneConfig(DEFAULT_SCENE);
  } catch {
    return sanitizeSceneConfig(DEFAULT_SCENE);
  }
}

export function savePersistedScene(scene: MagneticLinesSceneConfig): void {
  try {
    const safeScene = sanitizeSceneConfig(scene);
    window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(safeScene));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
  } catch {
    // Rendering remains available when browser storage is unavailable.
  }
}
export const TEMPLATE_STORAGE_KEY = "magnetic-lines-templates:v1";

export function saveSceneTemplate(name: string, scene: MagneticLinesSceneConfig): void {
  const cleanName = name.trim();
  if (!cleanName || typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const templates = raw ? JSON.parse(raw) as Record<string, MagneticLinesSceneConfig> : {};
    templates[cleanName] = sanitizeSceneConfig(scene);
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Browser storage may be unavailable; keep the editor usable.
  }
}
export function listSceneTemplates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return raw ? Object.keys(JSON.parse(raw) as Record<string, MagneticLinesSceneConfig>) : [];
  } catch { return []; }
}

export function loadSceneTemplate(name: string): MagneticLinesSceneConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const value = raw ? (JSON.parse(raw) as Record<string, unknown>)[name] : null;
    return value ? sanitizeSceneConfig(value) : null;
  } catch { return null; }
}

export function deleteSceneTemplate(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    const templates = raw ? JSON.parse(raw) as Record<string, MagneticLinesSceneConfig> : {};
    delete templates[name];
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
  } catch { /* storage is optional */ }
}

export function renameSceneTemplate(oldName: string, newName: string): void {
  const template = loadSceneTemplate(oldName);
  if (!template || !newName.trim()) return;
  saveSceneTemplate(newName, template);
  deleteSceneTemplate(oldName);
}

export function duplicateSceneTemplate(sourceName: string, newName: string): void {
  const template = loadSceneTemplate(sourceName);
  if (template && newName.trim()) saveSceneTemplate(newName, template);
}

export interface ReusableLineShape {
  name: string;
  customPath: CustomPath;
  shape: ShapeConfig;
}

export const LINE_SHAPES_STORAGE_KEY = "magnetic-lines-shapes:v1";

export function listReusableLineShapes(): ReusableLineShape[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LINE_SHAPES_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    return Object.entries(entries).flatMap(([name, value]) => {
      if (!value || typeof value !== "object") return [];
      const line = sanitizeLine({
        ...(value as Record<string, unknown>),
        id: "saved-shape",
        from: { x: 0.25, y: 0.5 },
        to: { x: 0.75, y: 0.5 },
        geometrySource: "path",
      });
      return line.customPath.points.length >= 2 ? [{ name, customPath: line.customPath, shape: line.shape }] : [];
    });
  } catch {
    return [];
  }
}

export function saveReusableLineShape(name: string, shape: Omit<ReusableLineShape, "name">): boolean {
  const cleanName = name.trim();
  if (!cleanName || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LINE_SHAPES_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    entries[cleanName] = { customPath: shape.customPath, shape: shape.shape };
    window.localStorage.setItem(LINE_SHAPES_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function deleteReusableLineShape(name: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LINE_SHAPES_STORAGE_KEY);
    const entries = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    delete entries[name];
    window.localStorage.setItem(LINE_SHAPES_STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}