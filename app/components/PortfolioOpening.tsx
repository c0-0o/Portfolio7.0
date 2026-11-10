"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { DEFAULT_SCENE, MagneticBackgroundLines, MagneticTarget } from "@/lib/magnetic-lines";

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

const tetherPoints = [
  { from: { x: 0.23, y: 0.18 }, to: { x: 0.38, y: 0.4 } },
  { from: { x: 0.58, y: 0.18 }, to: { x: 0.45, y: 0.4 } },
  { from: { x: 0.24, y: 0.75 }, to: { x: 0.38, y: 0.55 } },
];

const openingScene = {
  ...DEFAULT_SCENE,
  global: {
    ...DEFAULT_SCENE.global,
    color: "#91d63d",
    colorStyle: { type: "solid" as const, colors: ["#91d63d"] },
    opacity: 0.64,
    width: 1.25,
    magnetismEnabled: true,
    glowEnabled: false,
    outerGlowEnabled: false,
  },
  lines: DEFAULT_SCENE.lines.slice(0, tetherPoints.length).map((line, index) => {
    const { from, to } = tetherPoints[index];
    return {
      ...line,
      id: `opening-tether-${index + 1}`,
      enabled: true,
      visible: true,
      from,
      to,
      customPath: {
        ...line.customPath,
        points: [
          { id: `opening-tether-${index + 1}-start`, ...from },
          { id: `opening-tether-${index + 1}-end`, ...to },
        ],
      },
      inherit: {
        ...line.inherit,
        appearance: true,
        shape: false,
        motion: false,
        magnet: false,
        glow: false,
        outerGlow: false,
      },
      shape: { ...line.shape, type: "soft-wave" as const, amplitude: 0.008, frequency: 1.2, cycles: 1, smoothness: 0.95 },
      motion: { ...line.motion, type: "tension" as const, speed: 0.12, amplitude: 0.006, frequency: 1, deformability: 0.75 },
      magnet: {
        ...line.magnet,
        targetId: "opening-p",
        enabled: true,
        strength: 90,
        radius: 0.12,
        falloff: 70,
        maxDeformation: 0.09,
      },
      glow: { ...line.glow, enabled: false },
      outerGlow: { ...line.outerGlow, enabled: false },
      cursorGlow: { enabled: false },
      appearance: { ...line.appearance, color: "#91d63d", opacity: 0.64, width: 1.25, zIndex: 2 },
    };
  }),
  targets: [],
};

export function PortfolioOpening({ autoDismiss = true }: { autoDismiss?: boolean }) {
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoDismiss) return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const exitTimer = window.setTimeout(() => setIsExiting(true), prefersReducedMotion ? 500 : 2400);
    const hideTimer = window.setTimeout(() => setIsVisible(false), prefersReducedMotion ? 650 : 3050);

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
      <MagneticBackgroundLines config={openingScene} style={{ zIndex: 1, pointerEvents: "none" }} />
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
