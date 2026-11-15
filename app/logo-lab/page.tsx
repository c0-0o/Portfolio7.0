"use client";

/**
 * QA page for <AnimatedLogo />. Visit /logo-lab, delete it when you're done.
 * Idle timing is shortened here so you can see it without waiting.
 */
import { useState } from "react";
import Link from "next/link";
import AnimatedLogo from "@/components/AnimatedLogo";

const SIZES = [16, 24, 32, 37, 38, 48, 64, 80, 120];

function Row({ bg, fg, label, pinned }: { bg: string; fg: string; label: string; pinned: boolean }) {
  return (
    <section style={{ background: bg, color: fg, padding: "24px 28px", borderRadius: 12 }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 36, flexWrap: "wrap" }}>
        {SIZES.map((s) => (
          <figure key={s} style={{ margin: 0, textAlign: "center" }}>
            <AnimatedLogo
              size={s}
              interactive
              idleAnimation
              idleMinDelay={3000}
              idleMaxDelay={7000}
              showCat={pinned ? true : undefined}
              color={bg === "#050505" ? "#fff" : undefined}
              eyeColor={bg === "#050505" ? "#050505" : undefined}
              ariaLabel={`Logo ${s}px`}
            />
            <figcaption style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
              {s}px {s < 38 ? "· compact" : "· animated"}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export default function LogoLab() {
  const [pinned, setPinned] = useState(false);
  return (
    <main style={{ display: "grid", gap: 20, minHeight: "100dvh", padding: 24, maxWidth: 1100, margin: "0 auto", background: "transparent", color: "#141712", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: 0 }}>AnimatedLogo lab</h1>
      <Link href="/button-lab">Button lab</Link>
      <label style={{ fontSize: 14 }}>
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> Pin cat (showCat)
      </label>
      <Row bg="#FCFDF8" fg="#050505" label="Light" pinned={pinned} />
      <Row bg="#050505" fg="#ffffff" label="Dark (white logo)" pinned={pinned} />
      <Row bg="#ADEB66" fg="#050505" label="Brand green" pinned={pinned} />
    </main>
  );
}
