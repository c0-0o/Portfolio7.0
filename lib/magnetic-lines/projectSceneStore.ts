import { randomUUID } from "node:crypto";
import { readFile, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { MagneticLinesSceneConfig } from "./types";
import { normalizeMagneticPagePath } from "./persistence";
import { sanitizeSceneConfig } from "./sceneValidation";

const PROJECT_SCENES_FILE = join(process.cwd(), "data", "magnetic-page-scenes.json");

type ProjectScenes = Record<string, MagneticLinesSceneConfig>;

let writeQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isReplaceConflictError(error: unknown): boolean {
  return isRecord(error) &&
    typeof error.code === "string" &&
    ["EPERM", "EACCES", "EBUSY"].includes(error.code);
}

async function removeTemporaryFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!isMissingFileError(error)) {
      console.error("Could not remove a temporary project-scene file.", error);
    }
  }
}

async function readStore(filePath: string): Promise<{
  scenes: ProjectScenes;
  exists: boolean;
  needsLegacyImport: boolean;
}> {
  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return { scenes: {}, exists: false, needsLegacyImport: true };
    throw error;
  }

  const parsed: unknown = JSON.parse(contents);
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.scenes)) {
    throw new Error("The project magnetic-scene file has an invalid format.");
  }

  const scenes: ProjectScenes = {};
  for (const [path, scene] of Object.entries(parsed.scenes)) {
    if (normalizeMagneticPagePath(path) !== path || path === "/editor") {
      throw new Error(`The project magnetic-scene file contains an invalid page path: ${path}`);
    }
    if (!isRecord(scene) || !Array.isArray(scene.lines)) {
      throw new Error(`The project magnetic-scene file contains an invalid scene for ${path}.`);
    }
    scenes[path] = sanitizeSceneConfig(scene);
  }
  const legacyBrowserCacheMigrated = parsed.legacyBrowserCacheMigrated === true ||
    (parsed.legacyBrowserCacheMigrated === undefined && Object.keys(scenes).length > 0);
  return { scenes, exists: true, needsLegacyImport: !legacyBrowserCacheMigrated };
}

async function writeStore(
  filePath: string,
  scenes: ProjectScenes,
  legacyBrowserCacheMigrated: boolean,
): Promise<void> {
  const directory = dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  const contents = JSON.stringify({ version: 1, legacyBrowserCacheMigrated, scenes }, null, 2) + "\n";
  await writeFile(temporaryPath, contents, "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch (error) {
    if (!isReplaceConflictError(error)) throw error;
    try {
      await writeFile(filePath, contents, "utf8");
    } catch (writeError) {
      await removeTemporaryFile(temporaryPath);
      throw writeError;
    }
    await removeTemporaryFile(temporaryPath);
  }
}

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function readProjectPageScenes(filePath = PROJECT_SCENES_FILE) {
  return readStore(filePath);
}

export function importLegacyProjectPageScenes(
  legacyScenes: Record<string, unknown>,
  filePath = PROJECT_SCENES_FILE,
): Promise<void> {
  return withWriteLock(async () => {
    const stored = await readStore(filePath);
    if (!stored.needsLegacyImport) return;
    for (const [path, scene] of Object.entries(legacyScenes)) {
      if (normalizeMagneticPagePath(path) !== path || path === "/editor") {
        throw new Error(`The legacy browser cache contains an invalid page path: ${path}`);
      }
      if (!isRecord(scene) || !Array.isArray(scene.lines)) {
        throw new Error(`The legacy browser cache contains an invalid scene for ${path}.`);
      }
      if (!(path in stored.scenes)) stored.scenes[path] = sanitizeSceneConfig(scene);
    }
    await writeStore(filePath, stored.scenes, true);
  });
}

export function saveProjectPageScene(
  path: string,
  scene: MagneticLinesSceneConfig,
  filePath = PROJECT_SCENES_FILE,
): Promise<MagneticLinesSceneConfig> {
  return withWriteLock(async () => {
    const stored = await readStore(filePath);
    const safeScene = sanitizeSceneConfig(scene);
    stored.scenes[path] = safeScene;
    await writeStore(filePath, stored.scenes, !stored.needsLegacyImport);
    return safeScene;
  });
}

export function removeProjectPageScene(path: string, filePath = PROJECT_SCENES_FILE): Promise<void> {
  return withWriteLock(async () => {
    const stored = await readStore(filePath);
    delete stored.scenes[path];
    if (stored.exists || Object.keys(stored.scenes).length > 0) {
      await writeStore(filePath, stored.scenes, !stored.needsLegacyImport);
    }
  });
}
