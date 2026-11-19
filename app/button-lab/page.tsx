"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Button from "@/components/Button";
import styles from "./page.module.css";

type VisualState = "default" | "hover" | "smashed";

type CatPreview = {
  slug: string;
  title: string;
  height: number;
  mockupHeight: number;
};

const visualStates: { value: VisualState; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "hover", label: "Hover" },
  { value: "smashed", label: "Smashed" },
];

const catPreviews: CatPreview[] = [
  { slug: "cat-eyes", title: "Cat Eyes", height: 200, mockupHeight: 296 },
  { slug: "cat-head-bounce", title: "Head Bounce", height: 200, mockupHeight: 296 },
  { slug: "cat-loading-cute", title: "Loading Cute", height: 200, mockupHeight: 296 },
  { slug: "cat-loading-tail", title: "Loading Tail", height: 200, mockupHeight: 296 },
  { slug: "cat-peek-and-hide", title: "Peek and Hide", height: 200, mockupHeight: 296 },
  { slug: "cat-playful-paw", title: "Playful Paw", height: 200, mockupHeight: 296 },
  { slug: "cat-pop-up", title: "Pop Up", height: 200, mockupHeight: 296 },
  { slug: "cat-reaction-angry-scratch", title: "Angry Scratch", height: 256, mockupHeight: 384 },
  { slug: "cat-reaction-surprised", title: "Surprised", height: 200, mockupHeight: 296 },
  { slug: "cat-side-peek", title: "Side Peek", height: 200, mockupHeight: 296 },
  { slug: "cat-sleep", title: "Sleep", height: 200, mockupHeight: 296 },
  { slug: "cat-smashed", title: "Smashed", height: 200, mockupHeight: 296 },
  { slug: "cat-tail-wag", title: "Tail Wag", height: 200, mockupHeight: 296 },
];

export default function ButtonLabPage() {
  const [visualState, setVisualState] = useState<VisualState>("default");
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [catAnimation, setCatAnimation] = useState(true);
  const [withButton, setWithButton] = useState(true);
  const [clickCount, setClickCount] = useState(0);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Component QA / Interactive</p>
            <h1>Button lab</h1>
          </div>
          <Link className={styles.labLink} href="/logo-lab">Logo lab</Link>
        </header>

        <section className={styles.workbench} aria-labelledby="interactive-title">
          <div className={styles.livePreview}>
            <p className={styles.kicker}>Live component</p>
            <h2 id="interactive-title">Interactive preview</h2>
            <div className={styles.previewStage}>
              <Button
                text="Primary Button"
                property1={visualState}
                loading={loading}
                disabled={disabled}
                catAnimation={catAnimation}
                onClick={() => setClickCount((count) => count + 1)}
              />
            </div>
            <output className={styles.clickCount} aria-live="polite">Clicks: {clickCount}</output>
          </div>

          <aside className={styles.controls} aria-label="Button preview controls">
            <fieldset>
              <legend>Visual state</legend>
              <div className={styles.segmented} role="group" aria-label="Visual state">
                {visualStates.map((state) => (
                  <button
                    key={state.value}
                    type="button"
                    aria-pressed={visualState === state.value}
                    onClick={() => setVisualState(state.value)}
                  >
                    {state.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className={styles.toggles}>
              <legend>Behavior</legend>
              <label><input type="checkbox" checked={loading} onChange={(event) => setLoading(event.target.checked)} /> Loading</label>
              <label><input type="checkbox" checked={disabled} onChange={(event) => setDisabled(event.target.checked)} /> Disabled</label>
              <label><input type="checkbox" checked={catAnimation} onChange={(event) => setCatAnimation(event.target.checked)} /> Cat animation</label>
            </fieldset>
          </aside>
        </section>

        <section className={styles.gallery} aria-labelledby="gallery-title">
          <header className={styles.galleryHeader}>
            <div>
              <p className={styles.kicker}>Artwork</p>
              <h2 id="gallery-title">Cat previews</h2>
            </div>
            <div className={styles.segmented} role="group" aria-label="Artwork composition">
              <button type="button" aria-pressed={!withButton} onClick={() => setWithButton(false)}>Cat only</button>
              <button type="button" aria-pressed={withButton} onClick={() => setWithButton(true)}>With button</button>
            </div>
          </header>

          <div className={styles.assetGrid}>
            {catPreviews.map((preview, index) => (
              <figure className={styles.asset} key={preview.slug}>
                <div className={styles.artwork}>
                  <Image
                    src={"/button-cats/" + (withButton ? "with-button/" : "") + preview.slug + ".svg"}
                    alt={preview.title}
                    width={420}
                    height={withButton ? preview.mockupHeight : preview.height}
                    className={styles.artImage}
                    unoptimized
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                </div>
                <figcaption>
                  <span>{preview.title}</span>
                  <code>{preview.slug}</code>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
