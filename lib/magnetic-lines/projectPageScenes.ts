import type { MagneticLinesSceneConfig } from "./types";
import { sanitizeSceneConfig } from "./sceneValidation";

let scenes: Record<string, MagneticLinesSceneConfig> = {};

export function replaceProjectPageScenes(projectScenes: Record<string, unknown>): void {
  const nextScenes: Record<string, MagneticLinesSceneConfig> = {};
  for (const [path, scene] of Object.entries(projectScenes)) {
    nextScenes[path] = sanitizeSceneConfig(scene);
  }
  scenes = nextScenes;
}

export function getProjectPageScene(path: string): MagneticLinesSceneConfig | null {
  return scenes[path] ?? null;
}
