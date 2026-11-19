"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  loadPageScenePreview,
  loadPersistedPageScene,
  MagneticBackgroundLines,
  MagneticTarget,
  savePersistedPageScene,
  SCENE_CHANGE_EVENT,
  type MagneticLinesSceneConfig,
} from "@/lib/magnetic-lines";
import { getHeartbeatCycles } from "@/lib/magnetic-lines/engine/flowEngine";
import { getPortfolioDefaultScene, PORTFOLIO_OPENING_SCENE_EVENT } from "@/lib/magnetic-lines/PersistentMagneticBackground";
import { getProjectPageScene } from "@/lib/magnetic-lines/projectPageScenes";
import { markPortfolioVisited, shouldShowPortfolioOpening } from "./openingState";

const openingLetters = [
  { src: "/opening/Vector-2.svg", width: 141, height: 204, className: "opening-letter opening-letter-p" },
  { src: "/opening/Vector-3.svg", width: 63, height: 71, className: "opening-letter opening-letter-top-o" },
  { src: "/opening/Vector-1.svg", width: 68, height: 91, className: "opening-letter opening-letter-r" },
  { src: "/opening/Vector.svg", width: 63, height: 91, className: "opening-letter opening-letter-t" },
  { src: "/opening/Vector-5.svg", width: 39, height: 70, className: "opening-letter opening-letter-f" },
  { src: "/opening/Subtract.svg", width: 82, height: 93, className: "opening-letter opening-letter-bottom-o" },
  { src: "/opening/Vector-7.svg", width: 38, height: 69, className: "opening-letter opening-letter-l" },
  { src: "/opening/Vector-6.svg", width: 39, height: 69, className: "opening-letter opening-letter-i" },
  { src: "/opening/Vector-4.svg", width: 63, height: 71, className: "opening-letter opening-letter-bottom-o" },
];

const openingScene = getPortfolioDefaultScene("/opening");
const OPENING_MOTION_MIGRATION_KEY = "portfolio-opening-motion-version";
const OPENING_MOTION_VERSION = "heartbeat-v2";

function updateOpeningMotion(scene: MagneticLinesSceneConfig): MagneticLinesSceneConfig {
  const defaultsById = new Map(openingScene.lines.map((line) => [line.id, line]));
  let changed = false;
  const lines = scene.lines.map((line) => {
    const defaults = defaultsById.get(line.id);
    if (!defaults || line.id.includes("-node-")) return line;

    const points = line.customPath.points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const direction: "forward" | "reverse" = firstPoint.x > 0.5 && lastPoint.x > firstPoint.x
      ? "reverse"
      : "forward";
    const directionSign = direction === "reverse" ? -1 : 1;
    const phase = ((-directionSign * getHeartbeatCycles(line.startDelay ?? 0, defaults.flow.speed)) % 1 + 1) % 1;
    const flow = { ...line.flow, ...defaults.flow, direction, phase };

    if (JSON.stringify(flow) === JSON.stringify(line.flow)) return line;
    changed = true;
    return { ...line, flow };
  });

  return changed ? { ...scene, lines } : scene;
}

function loadOpeningScene(): MagneticLinesSceneConfig {
  const savedScene = process.env.NODE_ENV === "production"
    ? getProjectPageScene("/opening")
    : loadPersistedPageScene("/opening");
  if (!savedScene) return openingScene;
  if (process.env.NODE_ENV === "production") return updateOpeningMotion(savedScene);
  try {
    if (localStorage.getItem(OPENING_MOTION_MIGRATION_KEY) === OPENING_MOTION_VERSION) return savedScene;
  } catch (error) {
    console.error("Could not check the saved opening animation version.", error);
    return updateOpeningMotion(savedScene);
  }

  const updatedScene = updateOpeningMotion(savedScene);
  try {
    localStorage.setItem(OPENING_MOTION_MIGRATION_KEY, OPENING_MOTION_VERSION);
    if (updatedScene !== savedScene) {
      void savePersistedPageScene("/opening", updatedScene).then((saved) => {
        if (saved) return;
        try {
          localStorage.removeItem(OPENING_MOTION_MIGRATION_KEY);
        } catch (error) {
          console.error("Could not reset the opening animation migration marker.", error);
        }
        console.error("Could not save the updated opening animation settings to project files.");
      }).catch((error: unknown) => {
        console.error("Could not save the updated opening animation settings to project files.", error);
      });
    }
  } catch (error) {
    console.error("Could not migrate the saved opening animation settings.", error);
  }

  return updatedScene;
}

export function PortfolioOpening({ autoDismiss = true }: { autoDismiss?: boolean }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(shouldShowPortfolioOpening);
  const [scene, setScene] = useState<MagneticLinesSceneConfig>(openingScene);

  useEffect(() => {
    markPortfolioVisited();
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_OPENING_SCENE_EVENT, { detail: isVisible }));
  }, [isVisible]);

  useEffect(() => {
    const updateScene = () => {
      const previewToken = new URLSearchParams(window.location.search).get("magneticPreview");
      const previewScene = previewToken ? loadPageScenePreview("/opening", previewToken) : null;
      setScene(previewScene ?? loadOpeningScene());
    };

    updateScene();
    window.addEventListener(SCENE_CHANGE_EVENT, updateScene);
    window.addEventListener("storage", updateScene);
    return () => {
      window.removeEventListener(SCENE_CHANGE_EVENT, updateScene);
      window.removeEventListener("storage", updateScene);
    };
  }, []);

  useEffect(() => {
    if (!autoDismiss) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitTimer = window.setTimeout(() => setIsExiting(true), prefersReducedMotion ? 500 : 10_000);
    const hideTimer = window.setTimeout(() => setIsVisible(false), prefersReducedMotion ? 650 : 10_650);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(hideTimer);
    };
  }, [autoDismiss]);

  if (!isVisible) return null;

  const [p, topO, r, t, f, bottomO, l, i, finalO] = openingLetters;

  return (
    <section
      className={`portfolio-opening${isExiting ? " portfolio-opening-exiting" : ""}`}
      aria-label="Portfolio opening"
      aria-hidden={isExiting}
    >
      <div className="opening-backdrop" />
      <MagneticBackgroundLines
        config={scene}
        className="opening-lines"
        openingAnimation
        style={{ zIndex: 1, pointerEvents: "none" }}
      />
      <div className="opening-role">
        <span className="opening-role-dot" aria-hidden="true" />
        <span>UI/UX Designer</span>
      </div>

      <div className="opening-wordmark" role="img" aria-label="Portfolio">
        <MagneticTarget
          id="opening-p"
          priority={10}
          strength={0.9}
          radius={0.12}
          activations={["hover", "focus", "touch"]}
        >
          <span className="opening-p-fall">
            <Image {...p} alt="" priority />
          </span>
        </MagneticTarget>
        <div className="opening-wordmark-stack">
          <div className="opening-wordmark-row opening-wordmark-top">
            {[topO, r, t].map((letter, index) => (
              <Image key={letter.src} {...letter} alt="" priority style={{ animationDelay: `${180 + index * 90}ms` }} />
            ))}
          </div>
          <div className="opening-wordmark-row opening-wordmark-bottom">
            {[f, bottomO, l, i, finalO].map((letter, index) => (
              <Image key={`${letter.src}-${index}`} {...letter} alt="" priority style={{ animationDelay: `${420 + index * 65}ms` }} />
            ))}
          </div>
        </div>
        <Image
          className="opening-sparkle"
          src="/opening/star.svg"
          alt=""
          width={65}
          height={65}
          priority
        />
      </div>

      <div className="opening-loader" role="status" aria-live="polite">
        <Image src="/opening/loading.svg" alt="" width={48} height={48} priority />
        <span>Loading</span>
      </div>
    </section>
  );
}
