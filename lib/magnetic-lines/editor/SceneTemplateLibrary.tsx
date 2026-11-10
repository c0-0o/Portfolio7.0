"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { ORGANIC_ATMOSPHERIC_TEMPLATES, SCENE_TEMPLATE_CATEGORIES } from "../sceneTemplates";
import {
  deleteSceneTemplate,
  duplicateSceneTemplate,
  listSceneTemplates,
  loadSceneTemplate,
  renameSceneTemplate,
  saveSceneTemplate,
  SCENE_CHANGE_EVENT,
} from "../persistence";
import type { MagneticLineConfig, MagneticLinesSceneConfig } from "../types";

interface SceneTemplateLibraryProps {
  currentScene: MagneticLinesSceneConfig;
  onApply: (scene: MagneticLinesSceneConfig) => void;
  onClose: () => void;
}

const TEMPLATE_CSS = `
.ml-template-backdrop { position: fixed; z-index: 9998; inset: 0; display: grid; place-items: center; padding: 18px; background: #05070bd9; }
.ml-template-dialog { display: flex; flex-direction: column; width: min(1120px, 100%); max-height: min(900px, 94dvh); overflow: hidden; border: 1px solid #343946; border-radius: 12px; background: #11141b; color: #d7dbe3; box-shadow: 0 24px 80px #000b; }
.ml-template-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 17px 20px; border-bottom: 1px solid #292d38; }
.ml-template-head h2 { margin: 0; color: #f0f3f8; font-size: 17px; }
.ml-template-head p { margin: 5px 0 0; color: #9299a8; font-size: 11px; }
.ml-template-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(330px, .82fr); min-height: 0; flex: 1; }
.ml-template-browser { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid #292d38; }
.ml-template-filters { display: grid; grid-template-columns: 1fr minmax(150px, .7fr); gap: 8px; padding: 12px; }
.ml-template-input, .ml-template-category { min-width: 0; padding: 8px 9px; border: 1px solid #343946; border-radius: 6px; outline: none; background: #191c24; color: #e0e4eb; font: inherit; font-size: 11px; }
.ml-template-input:focus, .ml-template-category:focus { border-color: #80cbd8; }
.ml-template-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; min-height: 0; overflow: auto; padding: 0 12px 12px; }
.ml-template-card { display: flex; min-width: 0; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid #2c303b; border-radius: 8px; background: #171a22; color: inherit; text-align: left; cursor: pointer; }
.ml-template-card:hover { border-color: #647988; background: #1c2029; }
.ml-template-card[aria-pressed="true"] { border-color: #80cbd8; box-shadow: inset 0 0 0 1px #80cbd855; }
.ml-template-card strong { overflow: hidden; color: #e5e9f0; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.ml-template-card span { color: #9299a8; font-size: 9px; line-height: 1.4; }
.ml-template-card small { color: #75b8c5; font: 9px ui-monospace, SFMono-Regular, Menlo, monospace; }
.ml-template-detail { display: flex; min-width: 0; min-height: 0; flex-direction: column; gap: 12px; overflow: auto; padding: 14px; }
.ml-template-preview { position: relative; flex: 0 0 auto; height: clamp(180px, 30vh, 300px); overflow: hidden; border: 1px solid #343946; border-radius: 8px; background: #090b10; }
.ml-template-preview svg { position: absolute !important; width: 100% !important; height: 100% !important; }
.ml-template-description { margin: 0; color: #b7bfcc; font-size: 11px; line-height: 1.6; }
.ml-template-summary { margin: 0; color: #9099a8; font-size: 10px; line-height: 1.5; }
.ml-template-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.ml-template-tags span { padding: 4px 7px; border: 1px solid #343946; border-radius: 99px; color: #aab4c3; font-size: 9px; }
.ml-template-actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: auto; padding-top: 8px; border-top: 1px solid #292d38; }
.ml-template-actions button { padding: 7px 9px; border: 1px solid #343946; border-radius: 6px; background: #1b1f28; color: #d7dbe3; font: inherit; font-size: 10px; cursor: pointer; }
.ml-template-actions button:hover:not(:disabled) { background: #252a35; }
.ml-template-actions button:disabled { opacity: .4; cursor: not-allowed; }
.ml-template-actions .ml-template-apply { border-color: #b7f4ff; background: #b7f4ff; color: #081015; font-weight: 650; }
.ml-template-actions .ml-template-danger { color: #f0a5a5; }
.ml-template-error { margin: 0; color: #ff9a9a; font-size: 10px; }
.ml-template-empty { grid-column: 1 / -1; margin: 12px; color: #9299a8; font-size: 11px; }
@media (max-width: 760px) {
  .ml-template-backdrop { padding: 8px; }
  .ml-template-dialog { max-height: 96dvh; }
  .ml-template-layout { grid-template-columns: 1fr; overflow: auto; }
  .ml-template-browser { border-right: 0; border-bottom: 1px solid #292d38; }
  .ml-template-list { max-height: 32dvh; }
  .ml-template-detail { overflow: visible; }
  .ml-template-preview { height: 190px; }
}
@media (max-width: 440px) {
  .ml-template-filters, .ml-template-list { grid-template-columns: 1fr; }
}
`;
const EMPTY_SAVED_NAMES: string[] = [];

function getPreviewPath(line: MagneticLineConfig): string {
  return line.customPath.points.map((point, index) =>
    `${index === 0 || point.moveTo ? "M" : "L"} ${(point.x * 100).toFixed(2)} ${(point.y * 100).toFixed(2)}`,
  ).join(" ");
}

function StaticTemplatePreview({ config }: { config: MagneticLinesSceneConfig }) {
  const paths = useMemo(
    () => config.lines
      .filter((line) => line.enabled && line.visible)
      .map((line) => ({ id: line.id, d: getPreviewPath(line), line })),
    [config],
  );

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" }}
    >
      {paths.map(({ id, d, line }) => (
        <path
          key={id}
          d={d}
          fill="none"
          stroke={line.appearance.color || config.global.color}
          strokeOpacity={line.appearance.opacity}
          strokeWidth={Math.max(0.35, line.appearance.width / 2)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function subscribeToTemplateChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SCENE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SCENE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function SceneTemplateLibrary({ currentScene, onApply, onClose }: SceneTemplateLibraryProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All categories");
  const savedNames = useSyncExternalStore(subscribeToTemplateChanges, listSceneTemplates, () => EMPTY_SAVED_NAMES);
  const [selectedId, setSelectedId] = useState(ORGANIC_ATMOSPHERIC_TEMPLATES[0]?.id ?? "");
  const [error, setError] = useState("");

  const builtInTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ORGANIC_ATMOSPHERIC_TEMPLATES.filter((template) => {
      const inCategory = category === "All categories" || template.category === category;
      const matchesQuery = !needle || [template.name, template.summary, template.description, template.category, ...template.tags]
        .some((value) => value.toLowerCase().includes(needle));
      return inCategory && matchesQuery;
    });
  }, [category, query]);

  const savedMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return savedNames.filter((name) => category === "All categories" && (!needle || name.toLowerCase().includes(needle)));
  }, [category, query, savedNames]);

  const selectedBuiltIn = ORGANIC_ATMOSPHERIC_TEMPLATES.find((template) => template.id === selectedId);
  const selectedCustomName = selectedId.startsWith("custom:") ? selectedId.slice("custom:".length) : null;
  const selectedCustomConfig = selectedCustomName ? loadSceneTemplate(selectedCustomName) : null;
  const selectedConfig = selectedBuiltIn?.config ?? selectedCustomConfig;

  function askTemplateName(title: string, initialValue = ""): string | null {
    const value = window.prompt(title, initialValue);
    if (value === null) return null;
    const name = value.trim();
    if (!name) {
      setError("Enter a template name before saving.");
      return null;
    }
    return name;
  }

  function saveCurrentScene() {
    const name = askTemplateName("Save current scene as a template");
    if (!name) return;
    if (savedNames.includes(name) && !window.confirm(`Replace the saved template “${name}”?`)) return;
    if (!saveSceneTemplate(name, currentScene)) {
      setError("Could not save this template. Check browser storage and try again.");
      return;
    }
    setSelectedId(`custom:${name}`);
    setError("");
  }

  function saveSelectedCopy() {
    if (!selectedConfig) return;
    const name = askTemplateName("Save a copy as");
    if (!name) return;
    if (savedNames.includes(name)) {
      setError(`A saved template named “${name}” already exists.`);
      return;
    }
    if (!saveSceneTemplate(name, selectedConfig)) {
      setError("Could not save this template. Check browser storage and try again.");
      return;
    }
    setSelectedId(`custom:${name}`);
    setError("");
  }

  function duplicateSelected() {
    if (!selectedCustomName) return;
    const name = askTemplateName("Duplicate saved template as");
    if (!name) return;
    if (!duplicateSceneTemplate(selectedCustomName, name)) {
      setError("Could not duplicate the template. The name may already be in use or browser storage may be unavailable.");
      return;
    }
    setSelectedId(`custom:${name}`);
    setError("");
  }

  function renameSelected() {
    if (!selectedCustomName) return;
    const name = askTemplateName("Rename saved template", selectedCustomName);
    if (!name || name === selectedCustomName) return;
    if (!renameSceneTemplate(selectedCustomName, name)) {
      setError("Could not rename the template. The new name may already be in use or browser storage may be unavailable.");
      return;
    }
    setSelectedId(`custom:${name}`);
    setError("");
  }

  function deleteSelected() {
    if (!selectedCustomName || !window.confirm(`Delete “${selectedCustomName}”?`)) return;
    if (!deleteSceneTemplate(selectedCustomName)) {
      setError("Could not delete the template. Check browser storage and try again.");
      return;
    }
    setSelectedId(ORGANIC_ATMOSPHERIC_TEMPLATES[0]?.id ?? "");
    setError("");
  }

  return (
    <div className="ml-template-backdrop" onClick={onClose}>
      <style>{TEMPLATE_CSS}</style>
      <section
        className="ml-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ml-template-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}
      >
        <header className="ml-template-head">
          <div>
            <h2 id="ml-template-title">Scene template library</h2>
            <p>Browse 32 art-directed scenes, preview them, and apply or save your own.</p>
          </div>
          <button className="ml-btn" type="button" onClick={onClose} aria-label="Close template library">×</button>
        </header>
        <div className="ml-template-layout">
          <section className="ml-template-browser" aria-label="Browse templates">
            <div className="ml-template-filters">
              <input
                className="ml-template-input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates"
                aria-label="Search templates"
              />
              <select className="ml-template-category" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
                <option>All categories</option>
                {SCENE_TEMPLATE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="ml-template-list">
              {builtInTemplates.map((template) => (
                <button
                  className="ml-template-card"
                  key={template.id}
                  type="button"
                  aria-pressed={selectedId === template.id}
                  onClick={() => { setSelectedId(template.id); setError(""); }}
                >
                  <strong>{template.name}</strong>
                  <span>{template.summary}</span>
                  <small>{template.category} · {template.config.lines.length} lines</small>
                </button>
              ))}
              {savedMatches.map((name) => (
                <button
                  className="ml-template-card"
                  key={`custom:${name}`}
                  type="button"
                  aria-pressed={selectedId === `custom:${name}`}
                  onClick={() => { setSelectedId(`custom:${name}`); setError(""); }}
                >
                  <strong>{name}</strong>
                  <span>Your saved scene</span>
                  <small>Saved template</small>
                </button>
              ))}
              {builtInTemplates.length === 0 && savedMatches.length === 0 && <p className="ml-template-empty">No templates match this search.</p>}
            </div>
          </section>
          <section className="ml-template-detail" aria-label="Selected template details">
            {selectedConfig ? (
              <>
                <div className="ml-template-preview" role="img" aria-label={`Preview: ${selectedBuiltIn?.name ?? selectedCustomName}`}>
                  <StaticTemplatePreview config={selectedConfig} />
                </div>
                <h3>{selectedBuiltIn?.name ?? selectedCustomName}</h3>
                <p className="ml-template-summary">
                  {selectedBuiltIn?.summary ?? `${selectedConfig.lines.length} editable lines · ${selectedConfig.groups.length} groups`}
                </p>
                {selectedBuiltIn && <p className="ml-template-description">{selectedBuiltIn.description}</p>}
                <div className="ml-template-tags">
                  {(selectedBuiltIn?.tags ?? ["Saved by you", `${selectedConfig.lines.length} lines`]).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}
                </div>
              </>
            ) : (
              <p className="ml-template-empty">This saved template is unavailable or invalid. It has not changed your current scene.</p>
            )}
            {error && <p className="ml-template-error" role="alert">{error}</p>}
            <div className="ml-template-actions">
              <button className="ml-template-apply" type="button" disabled={!selectedConfig} onClick={() => selectedConfig && onApply(selectedConfig)}>Apply to page</button>
              <button type="button" onClick={saveCurrentScene}>Save current scene</button>
              <button type="button" disabled={!selectedConfig} onClick={saveSelectedCopy}>Save a copy</button>
              <button type="button" disabled={!selectedCustomName} onClick={duplicateSelected}>Duplicate</button>
              <button type="button" disabled={!selectedCustomName} onClick={renameSelected}>Rename</button>
              <button className="ml-template-danger" type="button" disabled={!selectedCustomName} onClick={deleteSelected}>Delete</button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
