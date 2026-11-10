"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { loadPageScenePreview, loadPersistedPageScene, normalizeMagneticPagePath, registerMagneticPagePath, SCENE_CHANGE_EVENT } from "./persistence";
import { DEFAULT_SCENE } from "./defaultScene";
import { MagneticBackgroundLines } from "./MagneticBackgroundLines";
import { MagneticTargetPicker } from "./MagneticTargetPicker";
import { registerTarget, updateTargetOptions, type RegisterTargetOptions } from "./engine/targetRegistry";
import { getTargetRegisteredActivations } from "./engine/targetLineTriggers";
import type { MagneticLinesSceneConfig, TargetActivation } from "./types";

type TargetBindingStatus = "ready" | "missing" | "multiple" | "invalid" | "disabled";

const ROUTE_LINE_COLORS: Record<string, string> = {
  "/": "#839a68",
  "/about": "#8baa68",
  "/projects": "#9a9872",
  "/playground": "#73998b",
  "/opening": "#91bd61",
};

type PortfolioLineDesign = {
  points: { x: number; y: number }[];
  opacity?: number;
  width?: number;
  targetId?: string;
  targetSelector?: string;
  glow?: boolean;
  flow?: boolean;
};

const PORTFOLIO_LINE_DESIGNS: Record<string, PortfolioLineDesign[]> = {
  "/": [
    { points: [{ x: 0.65, y: 0.01 }, { x: 0.73, y: 0.17 }, { x: 0.89, y: 0.23 }, { x: 0.99, y: 0.42 }], opacity: 0.64, width: 1.2, targetId: "hero-title", glow: true },
    { points: [{ x: 0.79, y: 0.01 }, { x: 0.85, y: 0.12 }, { x: 0.96, y: 0.18 }, { x: 0.99, y: 0.29 }], opacity: 0.52, width: 0.95, targetId: "home-stamp", targetSelector: ".hero-stamp", glow: true },
    { points: [{ x: 0.54, y: 0.02 }, { x: 0.65, y: 0.2 }, { x: 0.82, y: 0.31 }, { x: 0.97, y: 0.5 }], opacity: 0.44, width: 0.9, targetId: "portfolio-work-cta", flow: true },
  ],
  "/projects": [
    { points: [{ x: 0.91, y: 0.08 }, { x: 0.91, y: 0.19 }, { x: 0.96, y: 0.23 }, { x: 0.99, y: 0.23 }], opacity: 0.58, width: 1.05, targetId: "projects-title", glow: true },
    { points: [{ x: 0.98, y: 0.08 }, { x: 0.98, y: 0.34 }, { x: 0.94, y: 0.38 }], opacity: 0.48, width: 0.95, targetId: "em-collection-title", glow: true },
    { points: [{ x: 0.72, y: 0.62 }, { x: 0.84, y: 0.62 }, { x: 0.99, y: 0.62 }], opacity: 0.36, width: 0.9, targetId: "codyyn-title", flow: true },
    { points: [{ x: 0.04, y: 0.2 }, { x: 0.04, y: 0.26 }, { x: 0.09, y: 0.29 }], opacity: 0.46, width: 0.95 },
  ],
  "/playground": [
    { points: [{ x: 0.76, y: 0.19 }, { x: 0.87, y: 0.2 }, { x: 0.93, y: 0.3 }, { x: 0.91, y: 0.44 }, { x: 0.8, y: 0.49 }, { x: 0.69, y: 0.42 }, { x: 0.68, y: 0.3 }, { x: 0.76, y: 0.19 }], opacity: 0.62, width: 1.2, targetId: "playground-title", glow: true },
    { points: [{ x: 0.76, y: 0.25 }, { x: 0.84, y: 0.26 }, { x: 0.88, y: 0.33 }, { x: 0.86, y: 0.41 }, { x: 0.79, y: 0.44 }, { x: 0.73, y: 0.4 }, { x: 0.72, y: 0.32 }, { x: 0.76, y: 0.25 }], opacity: 0.46, width: 0.95, targetId: "playground-pixel-art", targetSelector: ".creative-art-02", glow: true },
    { points: [{ x: 0.66, y: 0.54 }, { x: 0.75, y: 0.59 }, { x: 0.87, y: 0.58 }, { x: 0.96, y: 0.52 }], opacity: 0.4, width: 0.9, targetId: "playground-motion-art", targetSelector: ".creative-art-03", flow: true },
  ],
  "/about": [
    { points: [{ x: 0.68, y: 0.13 }, { x: 0.83, y: 0.09 }, { x: 0.96, y: 0.19 }, { x: 0.98, y: 0.36 }, { x: 0.9, y: 0.46 }], opacity: 0.58, width: 1.15, targetId: "about-title", glow: true },
    { points: [{ x: 0.73, y: 0.17 }, { x: 0.85, y: 0.15 }, { x: 0.93, y: 0.23 }, { x: 0.94, y: 0.34 }, { x: 0.89, y: 0.39 }], opacity: 0.46, width: 0.95, targetId: "about-portrait", targetSelector: ".about-portrait-art", glow: true },
    { points: [{ x: 0.72, y: 0.47 }, { x: 0.79, y: 0.4 }, { x: 0.89, y: 0.41 }, { x: 0.97, y: 0.5 }, { x: 0.98, y: 0.68 }], opacity: 0.5, width: 1.05, targetId: "about-portrait", targetSelector: ".about-portrait-art", flow: true },
    { points: [{ x: 0.67, y: 0.55 }, { x: 0.74, y: 0.5 }, { x: 0.84, y: 0.51 }, { x: 0.91, y: 0.59 }, { x: 0.92, y: 0.75 }], opacity: 0.4, width: 0.9, targetId: "about-portrait", targetSelector: ".about-portrait-art", glow: true },
  ],
  "/not-found": [
    { points: [{ x: 0.07, y: 0.28 }, { x: 0.2, y: 0.14 }, { x: 0.38, y: 0.2 }, { x: 0.43, y: 0.37 }, { x: 0.34, y: 0.52 }, { x: 0.16, y: 0.51 }, { x: 0.08, y: 0.38 }], opacity: 0.58, width: 1.15, targetId: "not-found-mark", glow: true },
    { points: [{ x: 0.13, y: 0.31 }, { x: 0.23, y: 0.22 }, { x: 0.35, y: 0.26 }, { x: 0.38, y: 0.37 }, { x: 0.31, y: 0.46 }, { x: 0.19, y: 0.45 }, { x: 0.13, y: 0.37 }], opacity: 0.44, width: 0.95, targetId: "not-found-mark", flow: true },
    { points: [{ x: 0.03, y: 0.64 }, { x: 0.13, y: 0.72 }, { x: 0.26, y: 0.73 }, { x: 0.35, y: 0.68 }], opacity: 0.4, width: 0.9 },
  ],
  "/opening": [],
};

const TARGET_ACTIVATIONS: TargetActivation[] = ["hover", "focus", "touch"];

export function getPortfolioDefaultScene(path: string): MagneticLinesSceneConfig {
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
      glowEnabled: false,
      outerGlowEnabled: false,
    },
    lines: DEFAULT_SCENE.lines.slice(0, portfolioLines.length).map((line, index) => {
      const design = portfolioLines[index];
      const points = design.points.map((point, pointIndex) => ({
        id: `${line.id}-point-${pointIndex + 1}`,
        ...point,
      }));
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
          type: "tension" as const,
          speed: 0.06,
          amplitude: 0.003,
          frequency: 1,
          deformability: 0.25,
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
          color,
          colorStyle,
          intensity: 68,
          opacity: 72,
          radius: 0.16,
          length: 28,
          falloff: 68,
        },
        cursorGlow: { enabled: false },
        flow: {
          ...line.flow,
          enabled: Boolean(design.flow),
          speed: 0.22,
          intensity: 0.3,
          width: 1.3,
          coreWidth: 0.7,
          glowWidth: 0,
          opacity: 0.55,
          colors: [color, "#d2ae6c"],
          coreColor: "#fff8e9",
          glowColor: color,
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
        outerGlow: { ...line.outerGlow, enabled: false },
        appearance: {
          ...line.appearance,
          color,
          colorStyle,
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
  const [scene, setScene] = useState(() => {
    const path = pathname ? normalizeMagneticPagePath(pathname) : null;
    return path && path !== "/editor" ? getPortfolioDefaultScene(path) : DEFAULT_SCENE;
  });
  const sceneTargets = scene.targets;
  useEffect(() => {
    const update = () => {
      const path = pathname ? normalizeMagneticPagePath(pathname) : null;
      if (!path || path === "/editor") return;
      registerMagneticPagePath(path);
      const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
      const previewScene = previewToken ? loadPageScenePreview(path, previewToken) : null;
      const pageScene = loadPersistedPageScene(path);
      setScene(previewScene || pageScene || getPortfolioDefaultScene(path));
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
      <MagneticBackgroundLines config={scene} />
      <MagneticTargetPicker />
    </>
  );
}