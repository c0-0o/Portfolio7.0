import {
  CURSOR_EFFECTS_STORAGE_KEY,
  CURSOR_PRESETS,
  sanitizeCursorEffects,
  type CursorEffectsConfig,
  type CursorPresetId,
} from "./config";
import {
  CURSOR_CONFIGURATION_VERSION,
  CURSOR_LIBRARY_VERSION,
  type CursorCustomization,
  type CursorLibraryState,
  type SavedCursorTemplate,
} from "./model";
import { isRegisteredCursorId } from "./registry";

export const CURSOR_LIBRARY_STORAGE_KEY = `${CURSOR_EFFECTS_STORAGE_KEY}:library`;
export const LEGACY_CURSOR_TEMPLATES_KEY = `${CURSOR_EFFECTS_STORAGE_KEY}:presets`;
const MAX_TEMPLATES = 200;
const MAX_TEMPLATE_NAME_LENGTH = 80;
const MAX_TEMPLATE_DESCRIPTION_LENGTH = 500;

export interface CursorLibraryLoadResult {
  state: CursorLibraryState;
  migratedLegacy: boolean;
  warning?: string;
}

export function createEmptyCursorLibrary(): CursorLibraryState {
  return { version: CURSOR_LIBRARY_VERSION, customizations: {}, templates: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeTemplate(value: unknown): SavedCursorTemplate | null {
  if (!isRecord(value) || typeof value.name !== "string" ||
      typeof value.sourceCursorId !== "string" || !isRegisteredCursorId(value.sourceCursorId)) {
    return null;
  }
  const name = value.name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
  if (!name || !isRecord(value.configuration)) return null;
  const createdAt = typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
    ? value.createdAt
    : new Date(0).toISOString();
  const updatedAt = typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
    ? value.updatedAt
    : createdAt;
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id : createCursorRecordId(),
    name,
    description: typeof value.description === "string"
      ? value.description.slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH)
      : "",
    category: typeof value.category === "string" ? value.category.slice(0, 60) : "Custom",
    ...(typeof value.preview === "string" && value.preview.length <= 350_000 ? { preview: value.preview } : {}),
    sourceCursorId: value.sourceCursorId,
    configuration: sanitizeCursorEffects(value.configuration),
    createdAt,
    updatedAt,
    version: CURSOR_CONFIGURATION_VERSION,
  };
}

export function validateCursorLibrary(value: unknown): CursorLibraryState {
  if (!isRecord(value) || !isRecord(value.customizations) || !Array.isArray(value.templates)) {
    throw new Error("The saved cursor library has an invalid structure.");
  }
  if (value.version !== CURSOR_LIBRARY_VERSION) {
    throw new Error(`Cursor library version ${String(value.version)} is not supported by this version of the editor.`);
  }
  if (value.templates.length > MAX_TEMPLATES) {
    throw new Error(`The saved cursor library exceeds the ${MAX_TEMPLATES}-template limit.`);
  }

  const customizations: CursorLibraryState["customizations"] = {};
  for (const [id, raw] of Object.entries(value.customizations)) {
    if (!isRegisteredCursorId(id) || !isRecord(raw) || !isRecord(raw.configuration)) continue;
    const updatedAt = typeof raw.updatedAt === "string" && Number.isFinite(Date.parse(raw.updatedAt))
      ? raw.updatedAt
      : new Date(0).toISOString();
    const record: CursorCustomization = {
      version: CURSOR_CONFIGURATION_VERSION,
      cursorId: id,
      updatedAt,
      configuration: sanitizeCursorEffects(raw.configuration),
    };
    customizations[id] = record;
  }

  const templates = value.templates.map(normalizeTemplate);
  if (templates.some((template) => template === null)) {
    throw new Error("One or more saved cursor templates are invalid.");
  }
  const validTemplates = templates as SavedCursorTemplate[];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const template of validTemplates) {
    if (ids.has(template.id) || names.has(template.name.toLocaleLowerCase())) {
      throw new Error("Saved cursor templates must have unique IDs and names.");
    }
    ids.add(template.id);
    names.add(template.name.toLocaleLowerCase());
  }
  return {
    version: CURSOR_LIBRARY_VERSION,
    customizations,
    templates: validTemplates,
  };
}

export function migrateLegacyCursorTemplates(raw: string | null, now = new Date()): SavedCursorTemplate[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Legacy cursor templates are not a list.");
  const templates: SavedCursorTemplate[] = [];
  for (const [index, item] of parsed.entries()) {
    if (!isRecord(item) || typeof item.name !== "string" || !isRecord(item.config)) continue;
    const name = item.name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
    if (!name) continue;
    const existing = templates.some((template) => template.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) continue;
    const sourceCursorId: CursorPresetId = typeof item.config.cursor === "string" && isRegisteredCursorId(item.config.cursor)
      ? item.config.cursor
      : CURSOR_PRESETS[0].id;
    const createdAt = now.toISOString();
    templates.push({
      id: `legacy-${index}-${slug(name)}`,
      name,
      description: "",
      category: "Imported",
      sourceCursorId,
      configuration: sanitizeCursorEffects(item.config),
      createdAt,
      updatedAt: createdAt,
      version: CURSOR_CONFIGURATION_VERSION,
    });
  }
  return templates.slice(0, MAX_TEMPLATES);
}

export function loadCursorLibrary(
  storage: Pick<Storage, "getItem">,
  now = new Date(),
): CursorLibraryLoadResult {
  const raw = storage.getItem(CURSOR_LIBRARY_STORAGE_KEY);
  if (raw !== null) {
    try {
      return { state: validateCursorLibrary(JSON.parse(raw)), migratedLegacy: false };
    } catch (error) {
      return {
        state: createEmptyCursorLibrary(),
        migratedLegacy: false,
        warning: error instanceof Error ? error.message : "The saved cursor library could not be read.",
      };
    }
  }

  try {
    const templates = migrateLegacyCursorTemplates(storage.getItem(LEGACY_CURSOR_TEMPLATES_KEY), now);
    return {
      state: { ...createEmptyCursorLibrary(), templates },
      migratedLegacy: templates.length > 0,
    };
  } catch {
    return {
      state: createEmptyCursorLibrary(),
      migratedLegacy: false,
      warning: "Legacy cursor templates could not be imported; the original saved data was left unchanged.",
    };
  }
}

export function saveCursorLibrary(
  storage: Pick<Storage, "setItem">,
  state: CursorLibraryState,
): CursorLibraryState {
  const validated = validateCursorLibrary(state);
  storage.setItem(CURSOR_LIBRARY_STORAGE_KEY, JSON.stringify(validated));
  return validated;
}

export function saveCursorCustomization(
  state: CursorLibraryState,
  cursorId: CursorPresetId,
  configuration: CursorEffectsConfig,
  now = new Date(),
): CursorLibraryState {
  const customizations = { ...state.customizations };
  customizations[cursorId] = {
    version: CURSOR_CONFIGURATION_VERSION,
    cursorId,
    updatedAt: now.toISOString(),
    configuration: sanitizeCursorEffects(configuration),
  };
  return { ...state, customizations };
}

export function removeCursorCustomization(
  state: CursorLibraryState,
  cursorId: CursorPresetId,
): CursorLibraryState {
  const customizations = { ...state.customizations };
  delete customizations[cursorId];
  return { ...state, customizations };
}

export function createSavedCursorTemplate(
  name: string,
  configuration: CursorEffectsConfig,
  options: { id?: string; description?: string; category?: string; now?: Date } = {},
): SavedCursorTemplate {
  const cleanName = name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
  if (!cleanName) throw new Error("Enter a name for the cursor template.");
  const now = options.now ?? new Date();
  return {
    id: options.id ?? createCursorRecordId(),
    name: cleanName,
    description: (options.description ?? "").slice(0, MAX_TEMPLATE_DESCRIPTION_LENGTH),
    category: (options.category ?? "Custom").slice(0, 60),
    sourceCursorId: configuration.cursor,
    configuration: sanitizeCursorEffects(configuration),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    version: CURSOR_CONFIGURATION_VERSION,
  };
}

export function putCursorTemplate(
  state: CursorLibraryState,
  template: SavedCursorTemplate,
): CursorLibraryState {
  const index = state.templates.findIndex((item) => item.id === template.id);
  const templates = [...state.templates];
  if (index >= 0) templates[index] = { ...template, configuration: sanitizeCursorEffects(template.configuration) };
  else templates.push({ ...template, configuration: sanitizeCursorEffects(template.configuration) });
  return validateCursorLibrary({ ...state, templates });
}

export function deleteCursorTemplate(state: CursorLibraryState, id: string): CursorLibraryState {
  return { ...state, templates: state.templates.filter((template) => template.id !== id) };
}

export function duplicateCursorTemplate(
  state: CursorLibraryState,
  id: string,
  name: string,
  now = new Date(),
): CursorLibraryState {
  const source = state.templates.find((template) => template.id === id);
  if (!source) throw new Error("The selected cursor template no longer exists.");
  const duplicate = createSavedCursorTemplate(name, source.configuration, {
    description: source.description,
    category: source.category,
    now,
  });
  return putCursorTemplate(state, duplicate);
}

export function renameCursorTemplate(
  state: CursorLibraryState,
  id: string,
  name: string,
  now = new Date(),
): CursorLibraryState {
  const source = state.templates.find((template) => template.id === id);
  if (!source) throw new Error("The selected cursor template no longer exists.");
  const cleanName = name.trim().slice(0, MAX_TEMPLATE_NAME_LENGTH);
  if (!cleanName) throw new Error("Enter a name for the cursor template.");
  return putCursorTemplate(state, { ...source, name: cleanName, updatedAt: now.toISOString() });
}

export function exportCursorTemplate(template: SavedCursorTemplate): string {
  return JSON.stringify({ format: "cursor-template", version: CURSOR_CONFIGURATION_VERSION, template }, null, 2);
}

export function importCursorTemplate(raw: string, now = new Date()): SavedCursorTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (!isRecord(parsed) || parsed.format !== "cursor-template" ||
      parsed.version !== CURSOR_CONFIGURATION_VERSION) {
    throw new Error("This file is not a supported cursor template.");
  }
  const template = normalizeTemplate(parsed.template);
  if (!template) throw new Error("The cursor template data is invalid.");
  return { ...template, id: createCursorRecordId(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

function createCursorRecordId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cursor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function slug(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "template";
}
