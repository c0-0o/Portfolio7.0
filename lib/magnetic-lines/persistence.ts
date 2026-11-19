import type { CustomPath, MagneticLinesSceneConfig, ShapeConfig } from "./types";
import { DEFAULT_SCENE } from "./defaultScene";
import { sanitizeLine, sanitizeSceneConfig } from "./sceneValidation";
import { replaceProjectPageScenes } from "./projectPageScenes";

export const SCENE_STORAGE_KEY = "magnetic-lines-scene:v1";
export const SCENE_CHANGE_EVENT = "magnetic-lines-scene-change";
export const PAGE_SCENES_STORAGE_KEY = "magnetic-lines-page-scenes:v1";
export const PAGE_REGISTRY_STORAGE_KEY = "magnetic-lines-pages:v1";
export const PAGE_PREVIEW_STORAGE_KEY = "magnetic-lines-page-preview:v1";

export const BUILT_IN_PAGE_PATHS = [
  "/",
  "/about",
  "/opening",
  "/playground",
  "/under-construction",
  "/not-found",
  "/work/em-collection",
];
const pageSceneMutationQueues = new Map<string, Promise<void>>();

function enqueuePageSceneMutation<T>(path: string, mutation: () => Promise<T>): Promise<T> {
  const previous = pageSceneMutationQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(mutation);
  const settled = current.then(() => undefined, () => undefined);
  pageSceneMutationQueues.set(path, settled);
  void settled.then(() => {
    if (pageSceneMutationQueues.get(path) === settled) pageSceneMutationQueues.delete(path);
  });
  return current;
}

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

export function normalizeMagneticPagePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("?") || trimmed.includes("#")) return null;
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  if (normalized.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return normalized;
}

function readPageScenes(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(PAGE_SCENES_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function listPersistedPageScenes(): string[] {
  if (typeof window === "undefined") return [];
  const scenes = readPageScenes();
  return scenes ? Object.keys(scenes).sort() : [];
}

export function listMagneticPagePaths(): string[] {
  if (typeof window === "undefined") return BUILT_IN_PAGE_PATHS;
  const registeredPaths = readPageRegistry();
  const savedScenes = readPageScenes();
  return Array.from(new Set([
    ...BUILT_IN_PAGE_PATHS,
    ...registeredPaths,
    ...(savedScenes ? Object.keys(savedScenes) : []),
  ])).sort((a, b) => a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b));
}

function readPageRegistry(): string[] {
  try {
    const raw = window.localStorage.getItem(PAGE_REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): string[] => {
      if (typeof value !== "string") return [];
      const path = normalizeMagneticPagePath(value);
      return path && path !== "/editor" ? [path] : [];
    });
  } catch {
    return [];
  }
}

export function registerMagneticPagePath(path: string): void {
  if (typeof window === "undefined") return;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || normalizedPath === "/editor") return;
  const paths = readPageRegistry();
  if (paths.includes(normalizedPath)) return;
  try {
    window.localStorage.setItem(PAGE_REGISTRY_STORAGE_KEY, JSON.stringify([...paths, normalizedPath]));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
  } catch {
    // The editor can still use the built-in routes when browser storage is unavailable.
  }
}

export async function removeMagneticPagePath(path: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || BUILT_IN_PAGE_PATHS.includes(normalizedPath)) return false;
  if (!await removePersistedPageScene(normalizedPath)) return false;
  try {
    window.localStorage.setItem(PAGE_REGISTRY_STORAGE_KEY, JSON.stringify(readPageRegistry().filter((item) => item !== normalizedPath)));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

async function requestProjectScenes(): Promise<{
  scenes: Record<string, unknown>;
  exists: boolean;
  needsLegacyImport: boolean;
}> {
  const response = await fetch("/api/magnetic-page-scenes", { cache: "no-store" });
  if (!response.ok) throw new Error(`Project scene loading returned ${response.status}.`);
  const value: unknown = await response.json();
  if (
    !value ||
    typeof value !== "object" ||
    !("scenes" in value) ||
    !value.scenes ||
    typeof value.scenes !== "object" ||
    Array.isArray(value.scenes) ||
    !("exists" in value) ||
    typeof value.exists !== "boolean" ||
    !("needsLegacyImport" in value) ||
    typeof value.needsLegacyImport !== "boolean"
  ) {
    throw new Error("Project scene loading returned invalid data.");
  }
  return {
    scenes: value.scenes as Record<string, unknown>,
    exists: value.exists,
    needsLegacyImport: value.needsLegacyImport,
  };
}

async function writeProjectPageScene(path: string, scene: MagneticLinesSceneConfig): Promise<boolean> {
  try {
    const response = await fetch("/api/magnetic-page-scenes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, scene: sanitizeSceneConfig(scene) }),
    });
    return response.ok;
  } catch (error) {
    console.error(`Could not write the ${path} background to project files.`, error);
    return false;
  }
}

function cacheProjectScenes(scenes: Record<string, unknown>): void {
  replaceProjectPageScenes(scenes);
  try {
    window.localStorage.setItem(PAGE_SCENES_STORAGE_KEY, JSON.stringify(scenes));
  } catch (error) {
    console.error("Could not cache the project magnetic-scene data in this browser.", error);
  }
  window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
}

export async function syncPersistedPageScenesFromProject(): Promise<void> {
  let project = await requestProjectScenes();
  if (project.needsLegacyImport && process.env.NODE_ENV !== "production") {
    const cachedScenes = readPageScenes() ?? {};
    const response = await fetch("/api/magnetic-page-scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenes: cachedScenes }),
    });
    if (!response.ok) throw new Error(`Legacy project scene migration returned ${response.status}.`);
    project = await requestProjectScenes();
    if (project.needsLegacyImport) {
      throw new Error("Project scene migration did not complete.");
    }
  }
  cacheProjectScenes(project.scenes);
}

export function loadPersistedPageScene(path: string): MagneticLinesSceneConfig | null {
  if (typeof window === "undefined") return null;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath) return null;
  const scenes = readPageScenes();
  const scene = scenes?.[normalizedPath];
  return scene ? sanitizeSceneConfig(scene) : null;
}

interface PageScenePreview {
  path: string;
  token: string;
  scene: MagneticLinesSceneConfig;
}

export function savePageScenePreview(path: string, token: string, scene: MagneticLinesSceneConfig): boolean {
  if (typeof window === "undefined") return false;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || !token) return false;
  try {
    const preview: PageScenePreview = { path: normalizedPath, token, scene: sanitizeSceneConfig(scene) };
    window.localStorage.setItem(PAGE_PREVIEW_STORAGE_KEY, JSON.stringify(preview));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function loadPageScenePreview(path: string, token: string): MagneticLinesSceneConfig | null {
  if (typeof window === "undefined") return null;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || !token) return null;
  try {
    const raw = window.localStorage.getItem(PAGE_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    const preview: unknown = JSON.parse(raw);
    if (!preview || typeof preview !== "object") return null;
    const candidate = preview as Partial<PageScenePreview>;
    if (candidate.path !== normalizedPath || candidate.token !== token || !candidate.scene) return null;
    return sanitizeSceneConfig(candidate.scene);
  } catch {
    return null;
  }
}

export function removePageScenePreview(token: string): void {
  if (typeof window === "undefined" || !token) return;
  try {
    const raw = window.localStorage.getItem(PAGE_PREVIEW_STORAGE_KEY);
    if (!raw) return;
    const preview: unknown = JSON.parse(raw);
    if (!preview || typeof preview !== "object" || (preview as Partial<PageScenePreview>).token !== token) return;
    window.localStorage.removeItem(PAGE_PREVIEW_STORAGE_KEY);
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
  } catch {
    // A preview is temporary; the saved scene remains unaffected.
  }
}

export async function savePersistedPageScene(path: string, scene: MagneticLinesSceneConfig): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || normalizedPath === "/editor") return false;
  const safeScene = sanitizeSceneConfig(scene);
  return enqueuePageSceneMutation(normalizedPath, async () => {
    if (!await writeProjectPageScene(normalizedPath, safeScene)) return false;
    const scenes = readPageScenes() ?? {};
    scenes[normalizedPath] = safeScene;
    cacheProjectScenes(scenes);
    return true;
  });
}

export async function removePersistedPageScene(path: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const normalizedPath = normalizeMagneticPagePath(path);
  if (!normalizedPath || normalizedPath === "/editor") return false;
  return enqueuePageSceneMutation(normalizedPath, async () => {
    let response: Response;
    try {
      response = await fetch("/api/magnetic-page-scenes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: normalizedPath }),
      });
    } catch (error) {
      console.error(`Could not remove the ${normalizedPath} background from project files.`, error);
      return false;
    }
    if (!response.ok) return false;
    const scenes = readPageScenes() ?? {};
    delete scenes[normalizedPath];
    cacheProjectScenes(scenes);
    return true;
  });
}

export const TEMPLATE_STORAGE_KEY = "magnetic-lines-templates:v1";
const EMPTY_TEMPLATE_NAMES: string[] = [];
let cachedTemplateStorage: Storage | null = null;
let cachedTemplateStorageRaw: string | null | undefined;
let cachedTemplateNames = EMPTY_TEMPLATE_NAMES;

function readSceneTemplates(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return Object.create(null) as Record<string, unknown>;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return Object.assign(Object.create(null) as Record<string, unknown>, parsed);
  } catch {
    return null;
  }
}

function isValidTemplateScene(value: unknown): value is MagneticLinesSceneConfig {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (!Array.isArray((value as { lines?: unknown }).lines)) return false;
    sanitizeSceneConfig(value);
    return true;
  } catch {
    return false;
  }
}

export function saveSceneTemplate(name: string, scene: MagneticLinesSceneConfig): boolean {
  const cleanName = name.trim();
  if (!cleanName || typeof window === "undefined") return false;
  try {
    const templates = readSceneTemplates();
    if (!templates) return false;
    templates[cleanName] = sanitizeSceneConfig(scene);
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function listSceneTemplates(): string[] {
  if (typeof window === "undefined") return EMPTY_TEMPLATE_NAMES;
  try {
    const storage = window.localStorage;
    const raw = storage.getItem(TEMPLATE_STORAGE_KEY);
    if (storage === cachedTemplateStorage && raw === cachedTemplateStorageRaw) return cachedTemplateNames;
    cachedTemplateStorage = storage;
    cachedTemplateStorageRaw = raw;
    const templates = readSceneTemplates();
    cachedTemplateNames = templates
      ? Object.entries(templates).filter(([, value]) => isValidTemplateScene(value)).map(([name]) => name).sort((a, b) => a.localeCompare(b))
      : EMPTY_TEMPLATE_NAMES;
    return cachedTemplateNames;
  } catch {
    return EMPTY_TEMPLATE_NAMES;
  }
}

export function loadSceneTemplate(name: string): MagneticLinesSceneConfig | null {
  if (typeof window === "undefined" || !name.trim()) return null;
  const value = readSceneTemplates()?.[name.trim()];
  if (!isValidTemplateScene(value)) return null;
  try {
    return sanitizeSceneConfig(value);
  } catch {
    return null;
  }
}

export function deleteSceneTemplate(name: string): boolean {
  const cleanName = name.trim();
  if (!cleanName || typeof window === "undefined") return false;
  const templates = readSceneTemplates();
  if (!templates || !(cleanName in templates)) return false;
  try {
    delete templates[cleanName];
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function renameSceneTemplate(oldName: string, newName: string): boolean {
  const cleanOldName = oldName.trim();
  const cleanNewName = newName.trim();
  if (!cleanOldName || !cleanNewName || typeof window === "undefined") return false;
  const templates = readSceneTemplates();
  if (!templates || !isValidTemplateScene(templates[cleanOldName])) return false;
  if (cleanOldName === cleanNewName) return true;
  if (cleanNewName in templates) return false;
  try {
    templates[cleanNewName] = sanitizeSceneConfig(templates[cleanOldName]);
    delete templates[cleanOldName];
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function duplicateSceneTemplate(sourceName: string, newName: string): boolean {
  const cleanSourceName = sourceName.trim();
  const cleanNewName = newName.trim();
  if (!cleanSourceName || !cleanNewName || typeof window === "undefined") return false;
  const templates = readSceneTemplates();
  if (!templates || !isValidTemplateScene(templates[cleanSourceName]) || cleanNewName in templates) return false;
  try {
    templates[cleanNewName] = sanitizeSceneConfig(templates[cleanSourceName]);
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(SCENE_CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
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