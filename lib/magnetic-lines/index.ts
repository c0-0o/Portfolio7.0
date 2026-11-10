export type {
  Point,
  MotionType,
  ShapeType,
  ShapeConfig,
  MotionConfig,
  AppearanceConfig,
  MagnetConfig,
  GlowConfig,
  CursorGlowConfig,
  TextureType,
  TextureConfig,
  FlowConfig,
  FlowEffectType,
  FlowDirection,
  FlowPlacement,
  FlowLayerConfig,
  AirflowBehavior,
  EnvironmentConfig,
  EnvironmentMode,
  LineEnvironmentConfig,
  GravityConfig,
  MagneticLineConfig,
  MagneticLineGroup,
  LineInheritance,
  GlobalSettings,
  AnimationSettings,
  CursorInteractionSettings,
  MagneticTargetConfig,
  TargetActivation,
  TargetLineTriggers,
  TargetClickBehavior,
  MagneticLinesSceneConfig,
} from "./types";

export { MagneticBackgroundLines, type MagneticBackgroundLinesProps, type DebugFlags } from "./MagneticBackgroundLines";
export { useMagneticTarget, MagneticTarget, type UseMagneticTargetOptions, type MagneticTargetProps } from "./useMagneticTarget";
export { DEFAULT_SCENE, DEFAULT_GLOBAL, DEFAULT_FLOW, DEFAULT_LINE_ENVIRONMENT, DEFAULT_LINE_GRAVITY, DEFAULT_ANIMATION, DEFAULT_CURSOR, DEFAULT_SHAPE, STARTER_LINES, MOTION_PRESETS, SCENE_PRESETS, applyScenePreset } from "./defaultScene";
export { FLOW_PRESETS, getFlowPreset, type FlowPresetDefinition } from "./flowPresets";
export { ORGANIC_ATMOSPHERIC_TEMPLATES, SCENE_TEMPLATE_CATEGORIES, getSceneTemplateById, type SceneTemplateCategory, type SceneTemplateDefinition } from "./sceneTemplates";

export { MagneticLinesEditor, type MagneticLinesEditorProps } from "./editor/MagneticLinesEditor";
export { sanitizeSceneConfig, makeBlankLine, duplicateLine } from "./editor/validate";

export { getActiveTargets, getAllTargetSnapshots, registerTarget, setTargetActive } from "./engine/targetRegistry";
export { computeLine, createLineRuntimeState, SAMPLES } from "./engine/lineEngine";
export { resolveLineConfig, type ResolvedLineConfig } from "./engine/resolveConfig";
export { createOcclusionMaskPlan, type OcclusionMaskPlan, type OcclusionRuntimeLine } from "./engine/occlusion";
export { loadPersistedScene, savePersistedScene, loadPersistedPageScene, savePersistedPageScene, removePersistedPageScene, listPersistedPageScenes, listMagneticPagePaths, registerMagneticPagePath, removeMagneticPagePath, savePageScenePreview, loadPageScenePreview, removePageScenePreview, normalizeMagneticPagePath, saveSceneTemplate, listSceneTemplates, loadSceneTemplate, deleteSceneTemplate, renameSceneTemplate, duplicateSceneTemplate, SCENE_STORAGE_KEY, PAGE_SCENES_STORAGE_KEY, PAGE_REGISTRY_STORAGE_KEY, PAGE_PREVIEW_STORAGE_KEY, SCENE_CHANGE_EVENT, TEMPLATE_STORAGE_KEY } from './persistence';
export { PersistentMagneticBackground } from './PersistentMagneticBackground';
