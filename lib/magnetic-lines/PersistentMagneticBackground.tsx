"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadPageScenePreview, loadPersistedPageScene, normalizeMagneticPagePath, registerMagneticPagePath, savePersistedPageScene, SCENE_CHANGE_EVENT } from "./persistence";
import { DEFAULT_SCENE } from "./defaultScene";
import { getSceneTemplateById } from "./sceneTemplates";
import { MagneticBackgroundLines } from "./MagneticBackgroundLines";
import { MagneticTargetPicker } from "./MagneticTargetPicker";
import { registerTarget, updateTargetOptions, type RegisterTargetOptions } from "./engine/targetRegistry";
import { getTargetRegisteredActivations } from "./engine/targetLineTriggers";
import type { MagneticLinesSceneConfig, TargetActivation } from "./types";

type TargetBindingStatus = "ready" | "missing" | "multiple" | "invalid" | "disabled";
export const PORTFOLIO_OPENING_SCENE_EVENT = "portfolio-opening-scene-visibility";

const ROUTE_LINE_COLORS: Record<string, string> = {
  "/": "#839a68",
  "/about": "#8baa68",
  "/projects": "#9a9872",
  "/playground": "#73998b",
  "/work/em-collection": "#8e9a6a",
  "/opening": "#7AD321",
};

type PortfolioLineDesign = {
  points: { x: number; y: number }[];
  opacity?: number;
  width?: number;
  color?: string;
  targetId?: string;
  targetSelector?: string;
  glow?: boolean;
  flow?: boolean;
};

const PORTFOLIO_LINE_DESIGNS: Record<string, PortfolioLineDesign[]> = {
  "/": [
    { points: [{ x: 0, y: 0.18 }, { x: 0.12, y: 0.17 }, { x: 0.2, y: 0.23 }, { x: 0.27, y: 0.34 }], opacity: 0.48, width: 1.05 },
    { points: [{ x: 0.98, y: 0.08 }, { x: 0.89, y: 0.15 }, { x: 0.87, y: 0.24 }, { x: 0.96, y: 0.32 }, { x: 1, y: 0.32 }], opacity: 0.46, width: 1 },
    { points: [{ x: 0, y: 0.72 }, { x: 0.12, y: 0.7 }, { x: 0.22, y: 0.76 }, { x: 0.3, y: 0.87 }], opacity: 0.42, width: 1 },
    { points: [{ x: 1, y: 0.62 }, { x: 0.91, y: 0.67 }, { x: 0.9, y: 0.78 }, { x: 0.98, y: 0.86 }], opacity: 0.38, width: 0.95 },
  ],
  "/projects": [
    { points: [{ x: 0.08, y: 0.14 }, { x: 0.24, y: 0.14 }, { x: 0.24, y: 0.35 }, { x: 0.08, y: 0.35 }, { x: 0.08, y: 0.14 }], opacity: 0.42, width: 1, targetId: "projects-title", glow: true },
    { points: [{ x: 0.68, y: 0.12 }, { x: 0.9, y: 0.12 }, { x: 0.9, y: 0.4 }, { x: 0.68, y: 0.4 }, { x: 0.68, y: 0.12 }], opacity: 0.44, width: 1.05, targetId: "em-collection-title", glow: true },
    { points: [{ x: 0.72, y: 0.2 }, { x: 0.84, y: 0.2 }, { x: 0.84, y: 0.31 }, { x: 0.72, y: 0.31 }, { x: 0.72, y: 0.2 }], opacity: 0.36, width: 0.9, targetId: "codyyn-title", flow: true },
    { points: [{ x: 0.05, y: 0.72 }, { x: 0.25, y: 0.72 }, { x: 0.25, y: 0.84 }, { x: 0.05, y: 0.84 }, { x: 0.05, y: 0.72 }], opacity: 0.34, width: 0.9 },
  ],
  "/playground": [
    { points: [{ x: 0.82, y: 0.09 }, { x: 0.91, y: 0.14 }, { x: 0.93, y: 0.25 }, { x: 0.86, y: 0.32 }, { x: 0.76, y: 0.28 }, { x: 0.74, y: 0.18 }, { x: 0.82, y: 0.09 }], opacity: 0.5, width: 1.1, targetId: "playground-title", glow: true },
    { points: [{ x: 0.1, y: 0.38 }, { x: 0.18, y: 0.33 }, { x: 0.27, y: 0.38 }, { x: 0.29, y: 0.49 }, { x: 0.22, y: 0.56 }, { x: 0.12, y: 0.53 }, { x: 0.1, y: 0.38 }], opacity: 0.42, width: 0.95 },
    { points: [{ x: 0.76, y: 0.62 }, { x: 0.84, y: 0.57 }, { x: 0.93, y: 0.62 }, { x: 0.95, y: 0.73 }, { x: 0.88, y: 0.8 }, { x: 0.78, y: 0.77 }, { x: 0.76, y: 0.62 }], opacity: 0.42, width: 1, flow: true },
    { points: [{ x: 0.02, y: 0.84 }, { x: 0.14, y: 0.8 }, { x: 0.24, y: 0.84 }, { x: 0.33, y: 0.94 }], opacity: 0.34, width: 0.9 },
  ],
  "/about": [
    { points: [{ x: 0.04, y: 0.18 }, { x: 0.15, y: 0.1 }, { x: 0.28, y: 0.13 }, { x: 0.36, y: 0.24 }, { x: 0.34, y: 0.37 }], opacity: 0.46, width: 1.05, targetId: "about-title", glow: true },
    { points: [{ x: 0.66, y: 0.1 }, { x: 0.8, y: 0.06 }, { x: 0.93, y: 0.14 }, { x: 0.96, y: 0.28 }, { x: 0.9, y: 0.37 }], opacity: 0.44, width: 1 },
    { points: [{ x: 0.64, y: 0.4 }, { x: 0.76, y: 0.34 }, { x: 0.9, y: 0.38 }, { x: 0.96, y: 0.5 }, { x: 0.94, y: 0.64 }], opacity: 0.42, width: 0.95, flow: true },
    { points: [{ x: 0.03, y: 0.77 }, { x: 0.16, y: 0.71 }, { x: 0.28, y: 0.75 }, { x: 0.35, y: 0.87 }], opacity: 0.36, width: 0.9 },
  ],
  "/work/em-collection": [
    { points: [{ x: 0.68, y: 0.32 }, { x: 0.88, y: 0.32 }, { x: 0.86, y: 0.65 }, { x: 0.7, y: 0.65 }, { x: 0.68, y: 0.32 }], opacity: 0.46, width: 1.05, targetId: "em-collection-title", glow: true },
    { points: [{ x: 0.72, y: 0.32 }, { x: 0.73, y: 0.22 }, { x: 0.76, y: 0.17 }, { x: 0.8, y: 0.17 }, { x: 0.84, y: 0.22 }, { x: 0.85, y: 0.32 }], opacity: 0.4, width: 0.95 },
    { points: [{ x: 0.73, y: 0.43 }, { x: 0.82, y: 0.43 }, { x: 0.82, y: 0.53 }, { x: 0.73, y: 0.53 }, { x: 0.73, y: 0.43 }], opacity: 0.34, width: 0.9, flow: true },
    { points: [{ x: 0.07, y: 0.72 }, { x: 0.2, y: 0.68 }, { x: 0.32, y: 0.72 }, { x: 0.39, y: 0.83 }], opacity: 0.36, width: 0.9 },
  ],
  "/not-found": [
    { points: [{ x: 0.07, y: 0.28 }, { x: 0.2, y: 0.14 }, { x: 0.38, y: 0.2 }, { x: 0.43, y: 0.37 }, { x: 0.34, y: 0.52 }, { x: 0.16, y: 0.51 }, { x: 0.08, y: 0.38 }], opacity: 0.58, width: 1.15, targetId: "not-found-mark", glow: true },
    { points: [{ x: 0.13, y: 0.31 }, { x: 0.23, y: 0.22 }, { x: 0.35, y: 0.26 }, { x: 0.38, y: 0.37 }, { x: 0.31, y: 0.46 }, { x: 0.19, y: 0.45 }, { x: 0.13, y: 0.37 }], opacity: 0.44, width: 0.95, targetId: "not-found-mark", flow: true },
    { points: [{ x: 0.03, y: 0.64 }, { x: 0.13, y: 0.72 }, { x: 0.26, y: 0.73 }, { x: 0.35, y: 0.68 }], opacity: 0.4, width: 0.9 },
  ],
};

const TARGET_ACTIVATIONS: TargetActivation[] = ["hover", "focus", "touch"];

export function getPortfolioDefaultScene(path: string): MagneticLinesSceneConfig {
  if (path === "/opening") {
    const openingTemplate = getSceneTemplateById("opening-luminous-silk-filaments");
    if (!openingTemplate) throw new Error("Missing Opening scene template: opening-luminous-silk-filaments");
    return structuredClone(openingTemplate.config);
  }

  const designPath = PORTFOLIO_LINE_DESIGNS[path] ? path : "/not-found";
  const color = ROUTE_LINE_COLORS[path] ?? (designPath === "/not-found" ? "#b39464" : "#839a68");
  const colorStyle = { type: "solid" as const, colors: [color] };
  const portfolioLines = PORTFOLIO_LINE_DESIGNS[designPath];

  return {
    ...DEFAULT_SCENE,
    global: {
      ...DEFAULT_SCENE.global,
      color,
      colorStyle,
      opacity: 0.4,
      width: path === "/opening" ? 1.6 : DEFAULT_SCENE.global.width,
      glowEnabled: false,
      outerGlowEnabled: false,
      environment: path === "/opening" ? {
        ...DEFAULT_SCENE.global.environment,
        enabled: true,
        airflowEnabled: true,
        airflowBehavior: "gentle",
        airflowPaths: [
          [{ x: 0.06, y: 0.32 }, { x: 0.24, y: 0.35 }, { x: 0.43, y: 0.31 }, { x: 0.62, y: 0.34 }, { x: 0.94, y: 0.3 }],
          [{ x: 0.04, y: 0.66 }, { x: 0.25, y: 0.62 }, { x: 0.46, y: 0.67 }, { x: 0.68, y: 0.63 }, { x: 0.96, y: 0.68 }],
        ],
        airflowRadii: [0.12, 0.12],
        airflowSpeed: 0.24,
        airflowStrength: 0.16,
        airflowRadius: 0.12,
        lightEnabled: true,
        lightColor: "#B6A16E",
        lightPosition: { x: 0.35, y: 0.42 },
        lightIntensity: 0.2,
        lightRadius: 0.18,
        lights: [{
          id: "opening-warm-light",
          color: "#B6A16E",
          position: { x: 0.34, y: 0.43 },
          endPosition: { x: 0.66, y: 0.57 },
          intensity: 0.2,
          radius: 0.18,
          speed: 0.035,
          playback: "loop",
        }],
      } : DEFAULT_SCENE.global.environment,
      cursorInfluence: path === "/opening" ? {
        enabled: true,
        strength: 0.28,
        radius: 0.18,
        falloff: 0.62,
        maxDeformation: 0.032,
        profile: "soft",
        smoothing: 0.32,
        mode: "attract",
      } : DEFAULT_SCENE.global.cursorInfluence,
    },
    lines: DEFAULT_SCENE.lines.slice(0, portfolioLines.length).map((line, index) => {
      const design = portfolioLines[index];
      const points = design.points.map((point, pointIndex) => ({
        id: `${line.id}-point-${pointIndex + 1}`,
        ...point,
      }));
      const lineColor = design.color ?? color;
      const lineColorStyle = { type: "solid" as const, colors: [lineColor] };
      const from = points[0];
      const to = points[points.length - 1];

      return {
        ...line,
        enabled: true,
        visible: true,
        geometrySource: "path" as const,
        from,
        to,
        customPath: {
          ...line.customPath,
          points,
          closedJoint: "connected",
        },
        inherit: {
          ...line.inherit,
          appearance: false,
          shape: false,
          motion: false,
          glow: false,
          outerGlow: false,
          magnet: false,
          flow: false,
        },
        shape: {
          ...line.shape,
          type: "soft-wave" as const,
          amplitude: 0.002,
          frequency: 1,
          cycles: 1,
          phase: index * 0.7,
          smoothness: 0.95,
          irregularity: 0,
          distortion: 0,
          roughness: 0,
        },
        motion: {
          ...line.motion,
          type: "floating" as const,
          speed: 0.085 + (index % 3) * 0.018,
          amplitude: index < 6 ? 0.007 : 0.004,
          frequency: 1,
          deformability: 0.4,
        },
        magnet: {
          ...line.magnet,
          targetId: design.targetId ?? null,
          enabled: Boolean(design.targetId),
          strength: 72,
          radius: 0.2,
          falloff: 68,
          maxDeformation: 0.045,
        },
        glow: {
          ...line.glow,
          enabled: Boolean(design.glow),
          color: lineColor,
          colorStyle: lineColorStyle,
          intensity: 34,
          opacity: 54,
          radius: 0.1,
          length: 22,
          falloff: 72,
        },
        cursorGlow: { enabled: Boolean(design.glow), color: lineColor, intensity: 0.32, radius: 0.1, falloff: 0.65 },
        flow: {
          ...line.flow,
          enabled: Boolean(design.flow),
          speed: 0.22,
          intensity: 0.3,
          width: 1.3,
          coreWidth: 0.7,
          glowWidth: 0,
          opacity: 0.55,
          colors: [lineColor, "#B69A5C"],
          coreColor: "#fff8e9",
          glowColor: lineColor,
          streamCount: 1,
          strandCount: 1,
          layers: {
            current: true,
            core: true,
            secondary: false,
            glow: false,
            branches: false,
            sparks: false,
          },
        },
        environmentEnabled: path === "/opening",
        environment: {
          ...line.environment,
          airflowMode: path === "/opening" ? "global" as const : "off" as const,
          lightMode: path === "/opening" ? "global" as const : "off" as const,
        },
        cursorInfluence: {
          ...line.cursorInfluence,
          enabled: path === "/opening",
        },
        outerGlow: { ...line.outerGlow, enabled: false },
        appearance: {
          ...line.appearance,
          color: lineColor,
          colorStyle: lineColorStyle,
          opacity: design.opacity ?? 0.34,
          width: design.width ?? 1,
        },
      };
    }),
    targets: Array.from(
      portfolioLines.reduce((targets, design, index) => {
        if (!design.targetId) return targets;
        const target = targets.get(design.targetId) ?? {
          id: design.targetId,
          selector: design.targetSelector,
          lineIds: [] as string[],
          lineTriggers: {} as Record<string, { magnet?: TargetActivation[]; glow?: TargetActivation[] }>,
        };
        const lineId = DEFAULT_SCENE.lines[index].id;
        target.lineIds.push(lineId);
        target.lineTriggers[lineId] = {
          magnet: TARGET_ACTIVATIONS,
          ...(design.glow ? { glow: TARGET_ACTIVATIONS } : {}),
        };
        targets.set(design.targetId, target);
        return targets;
      }, new Map<string, {
        id: string;
        selector?: string;
        lineIds: string[];
        lineTriggers: Record<string, { magnet?: TargetActivation[]; glow?: TargetActivation[] }>;
      }>()),
    ).map(([, target]) => ({
      ...target,
      enabled: true,
      magnetic: true,
      strength: 0.78,
      radius: 0.12,
      priority: 3,
      activations: TARGET_ACTIVATIONS,
    })),
  };
}

export function PersistentMagneticBackground() {
  const pathname = usePathname();
  const [openingSceneStatus, setOpeningSceneStatus] = useState(() => ({
    pathname: pathname ?? "",
    active: pathname === "/" || pathname === "/opening",
  }));
  const [openingScene, setOpeningScene] = useState(() => getPortfolioDefaultScene("/opening"));
  const currentPathname = pathname ?? "";
  if (openingSceneStatus.pathname !== currentPathname) {
    setOpeningSceneStatus({
      pathname: currentPathname,
      active: currentPathname === "/" || currentPathname === "/opening",
    });
  }
  const openingSceneActive =
    (pathname === "/" || pathname === "/opening") &&
    openingSceneStatus.pathname === currentPathname &&
    openingSceneStatus.active;
  const [scene, setScene] = useState(() => {
    const path = pathname ? normalizeMagneticPagePath(pathname) : null;
    return path && path !== "/editor" ? getPortfolioDefaultScene(path) : DEFAULT_SCENE;
  });
  const [sceneIsPreview, setSceneIsPreview] = useState(false);
  const sceneForRender =
    openingSceneActive && currentPathname === "/" && !sceneIsPreview ? openingScene : scene;
  const sceneTargets = sceneForRender.targets;
  useEffect(() => {
    const updateOpeningSceneVisibility = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "boolean") {
        setOpeningSceneStatus({
          pathname: normalizeMagneticPagePath(window.location.pathname) ?? "/",
          active: event.detail,
        });
      }
    };
    window.addEventListener(PORTFOLIO_OPENING_SCENE_EVENT, updateOpeningSceneVisibility);
    return () => window.removeEventListener(PORTFOLIO_OPENING_SCENE_EVENT, updateOpeningSceneVisibility);
  }, []);
  useEffect(() => {
    const update = () => {
      const path = pathname ? normalizeMagneticPagePath(pathname) : null;
      if (!path || path === "/editor") return;
      registerMagneticPagePath(path);
      const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
      const previewScene = previewToken ? loadPageScenePreview(path, previewToken) : null;
      const pageScene = loadPersistedPageScene(path);
      const defaultScene = getPortfolioDefaultScene(path);
      if (path === "/" || path === "/opening") {
        setOpeningScene(loadPersistedPageScene("/opening") ?? getPortfolioDefaultScene("/opening"));
      }
      const isOpeningSceneCopiedToHome = path === "/" &&
        pageScene?.lines.length === 6 &&
        pageScene.lines.every((line) => line.id.startsWith("opening-organic-lime-filaments-"));
      if (isOpeningSceneCopiedToHome && !savePersistedPageScene(path, defaultScene)) {
        console.error("Could not save the new homepage background scene.");
      }
      setSceneIsPreview(Boolean(previewScene));
      setScene(previewScene || (isOpeningSceneCopiedToHome ? defaultScene : pageScene) || defaultScene);
    };
    update();
    window.addEventListener(SCENE_CHANGE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(SCENE_CHANGE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [pathname]);
  useEffect(() => {
    if (pathname === "/editor") return;
    const registrations = new Map<string, { element: Element; signature: string; unregister: () => void }>();
    const reportedSelectors = new Set<string>();
    const lastStatuses = new Map<string, TargetBindingStatus>();
    const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
    let syncFrame = 0;
    const reportStatus = (targetId: string, status: TargetBindingStatus) => {
      if (lastStatuses.get(targetId) === status) return;
      lastStatuses.set(targetId, status);
      if (previewToken && window.parent !== window) {
        window.parent.postMessage({ type: "magnetic-target-status", previewToken, targetId, status }, window.location.origin);
      }
    };
    const syncTargets = () => {
      const getRegistrationOptions = (target: (typeof sceneTargets)[number]): RegisterTargetOptions => ({
        magnetic: target.magnetic,
        strength: target.strength,
        radius: target.radius,
        priority: target.priority,
        activations: getTargetRegisteredActivations(target),
        clickBehavior: target.clickBehavior,
      });
      const desired = new Map(sceneTargets.filter((target) => target.selector).map((target) => [target.id, target]));
      const resolved = new Map<string, { target: (typeof sceneTargets)[number]; element: Element | null; signature: string; status: TargetBindingStatus }>();
      for (const target of desired.values()) {
        const signature = JSON.stringify([target.selector, target.enabled, target.magnetic, target.strength, target.radius, target.priority, target.activations, target.lineTriggers, target.clickBehavior]);
        if (!target.enabled) {
          resolved.set(target.id, { target, element: null, signature, status: "disabled" });
          reportStatus(target.id, "disabled");
          continue;
        }
        try {
          const matches = document.querySelectorAll(target.selector!);
          const status: TargetBindingStatus = matches.length === 1 ? "ready" : matches.length === 0 ? "missing" : "multiple";
          resolved.set(target.id, { target, element: matches.length === 1 ? matches[0] : null, signature, status });
          reportStatus(target.id, status);
          if (status === "multiple" && !reportedSelectors.has(target.selector!)) {
            reportedSelectors.add(target.selector!);
            console.warn(`Magnetic target "${target.name ?? target.id}" matches multiple elements. Re-pick it in the editor.`);
          }
        } catch (error) {
          resolved.set(target.id, { target, element: null, signature, status: "invalid" });
          reportStatus(target.id, "invalid");
          if (!reportedSelectors.has(target.selector!)) {
            reportedSelectors.add(target.selector!);
            console.error(`Magnetic target "${target.name ?? target.id}" has an invalid selector. Re-pick it in the editor.`, error);
          }
        }
      }
      for (const [id, registration] of registrations) {
        const next = resolved.get(id);
        if (next?.element === registration.element) {
          if (next.signature !== registration.signature) {
            updateTargetOptions(id, getRegistrationOptions(next.target));
            registration.signature = next.signature;
          }
          continue;
        }
        registration.unregister();
        registrations.delete(id);
      }

      for (const { target, element, signature } of resolved.values()) {
        if (registrations.has(target.id) || !element) continue;
        registrations.set(target.id, {
          element,
          signature,
          unregister: registerTarget(target.id, element, getRegistrationOptions(target)),
        });
      }
    };
    syncTargets();
    const observer = new MutationObserver(() => {
      if (syncFrame) return;
      syncFrame = requestAnimationFrame(() => {
        syncFrame = 0;
        syncTargets();
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "data-testid", "aria-label", "name", "role", "title", "alt", "href"],
    });
    return () => {
      observer.disconnect();
      if (syncFrame) cancelAnimationFrame(syncFrame);
      registrations.forEach((registration) => registration.unregister());
      registrations.clear();
    };
  }, [pathname, sceneTargets]);
  if (pathname === "/editor") return null;
  return (
    <>
      <MagneticBackgroundLines
        config={sceneForRender}
        openingAnimation={openingSceneActive}
        style={{ zIndex: 0 }}
      />
      <MagneticTargetPicker />
    </>
  );
}