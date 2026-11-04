"use client";

import { MagneticTarget } from "@/lib/magnetic-lines";
import { PersistentMagneticBackground } from "@/lib/magnetic-lines";

export default function Home() {
  return (
    <>
      <PersistentMagneticBackground />
      <main className="showcase">
      <nav className="showcase-nav" aria-label="Primary navigation">
        <MagneticTarget id="wordmark" as="span" priority={2}><strong>FIELD / 01</strong></MagneticTarget>
        <div className="nav-links"><a href="#about">About</a><a href="/editor">Editor</a></div>
      </nav>
      <section className="hero" id="about">
        <p className="eyebrow">Interactive systems / 2026</p>
        <MagneticTarget id="hero-title" priority={3}><h1>Quiet motion<br /><em>made visible.</em></h1></MagneticTarget>
        <p className="hero-copy">A working test surface for magnetic background lines. Move across the page, focus the title or action, and resize the viewport to inspect the shared production renderer.</p>
        <div className="hero-actions">
          <MagneticTarget id="primary-cta" priority={2}><a className="cta" href="/editor">Tune the scene <span aria-hidden="true">↗</span></a></MagneticTarget>
          <span className="secondary-note">Registered targets are intentional.<br />The paragraph and navigation are not.</span>
        </div>
      </section>
      <section className="showcase-grid" aria-label="Test cases">
        <div><span className="grid-label">01 / Geometry</span><h2>Anchored to the viewport.</h2></div>
        <div><span className="grid-label">02 / Interaction</span><h2>Responsive to focus and touch.</h2></div>
        <div><span className="grid-label">03 / Configuration</span><h2>One scene, three surfaces.</h2></div>
      </section>
      </main>
    </>
  );
}