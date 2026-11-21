"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SectionLabel, SiteShell } from "./site";

const processImages = [
  "/playground/Jweb/j1 (21).webp",
  "/playground/Jweb/j1 (2).webp",
  "/playground/Jweb/j1 (3).webp",
  "/playground/Jweb/j1 (4).webp",
  "/playground/Jweb/j1 (5).webp",
  "/playground/Jweb/j1 (6).webp",
  "/playground/Jweb/j1 (7).webp",
  "/playground/Jweb/j1 (8).webp",
  "/playground/Jweb/j1 (9).webp",
  "/playground/Jweb/j1 (10).webp",
  "/playground/Jweb/j1 (11).webp",
  "/playground/Jweb/j1 (12).webp",
  "/playground/Jweb/j1 (13).webp",
  "/playground/Jweb/j1 (14).webp",
  "/playground/Jweb/j1 (15).webp",
  "/playground/Jweb/j1 (16).webp",
  "/playground/Jweb/j1 (17).webp",
  "/playground/Jweb/j1 (18).webp",
  "/playground/Jweb/j1 (19).webp",
  "/playground/Jweb/j1 (20).webp",
] as const;

const steps = [
  ["01", "A rough idea on paper", "I began with a loose sketch of how I wanted the figure and dress to sit. At this point I was looking for the overall shape, not a perfect drawing.", "PENCIL · COMPOSITION FIRST"],
  ["02", "Refine, then refine again", "I kept adjusting the pose, silhouette and layers of the dress. Each pass made the drawing clearer before I moved into light and colour.", "PENCIL · SHAPE & PROPORTION"],
  ["03", "Map where the light lands", "By j1 (5), I highlighted the areas that would catch the light. This gave me a guide to protect as the darker layers went down.", "LIGHT MAP · J1 (5)"],
  ["04", "Give the shadows a cool base", "Next I shaded the darker areas with a cool colour. The point was to separate the light-facing shapes from the parts turning away.", "COOL COLOUR · SHADOW UNDERPAINTING"],
  ["05", "What if the light were red?", "I imagined a red light coming from the top right. I picked out those warm edges in red and coloured the flowers, so the lighting idea started to feel intentional.", "RED LIGHT ↙ · FLOWER ACCENTS"],
  ["06", "Commit to the outlines", "I used pens to bring out the outlines and give the important shapes a clearer edge. The linework helped the dress folds hold together as I added colour.", "PEN · EDGES & FOLDS"],
  ["07", "Three browns. Three blacks.", "For the skin, I used three shades of brown: light, medium and dark. For the hair, I worked with three values of black, keeping a lighter area instead of filling everything with one flat dark.", "SKIN + HAIR · LIGHT → MEDIUM → DARK"],
  ["08", "Let the cooler side show", "I brought more blue into the shadow side. That cool layer gives the warm red light something to push against and starts to describe the volume of the dress.", "BLUE · TEMPERATURE CONTRAST"],
  ["09", "Make the dress read as black", "I gradually darkened the blue until it became a black dress with red light touching it from the upper right. I wanted to keep the folds visible within the darks.", "DARK VALUES · KEEP THE FORM"],
  ["10", "Bring the background into the story", "I painted the background red with watercolour to connect it to the light on the figure. I also added the cat shadow as a small detail within the scene.", "RED WATERCOLOUR · CAT SHADOW"],
  ["11", "Finish with a touch of white", "At the end, I used a white pen for the brightest highlights. Those small final marks bring selected edges back out after all the darker layers.", "WHITE PEN · THE FINAL HIGHLIGHTS"],
] as const;

const stepImages = [
  "/playground/red-light-steps/stage-01.webp",
  "/playground/red-light-steps/stage-02.webp",
  "/playground/red-light-steps/stage-03.webp",
  "/playground/red-light-steps/stage-04.webp",
  "/playground/red-light-steps/stage-05.webp",
  "/playground/red-light-steps/stage-06.webp",
  "/playground/red-light-steps/stage-07.webp",
  "/playground/red-light-steps/stage-08.webp",
  "/playground/red-light-steps/stage-09.webp",
  "/playground/red-light-steps/stage-10.webp",
  "/playground/red-light-steps/stage-11.webp",
] as const;

function ProcessCarousel() {
  const [current, setCurrent] = useState(0);
  const startX = useRef<number | null>(null);
  const move = (direction: number) => {
    setCurrent((value) => (value + direction + processImages.length) % processImages.length);
  };

  return (
    <div
      className="relative"
      onPointerDown={(event) => { startX.current = event.clientX; }}
      onPointerUp={(event) => {
        if (startX.current === null) return;
        const distance = event.clientX - startX.current;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
        startX.current = null;
      }}
    >
      <div
        className="relative mx-auto aspect-3/4 w-full overflow-hidden bg-[#e4e4dc]"
        style={{ maxWidth: 520 }}
      >
        <Image
          src={processImages[current]}
          alt={`Red light, black dress process photo ${current + 1}`}
          fill
          sizes="(min-width: 768px) 520px, 100vw"
          className="object-contain select-none"
          draggable={false}
          priority={current === 0}
        />
      </div>
      <div className="mt-5 flex items-center justify-between">
        <span className="text-[10px] tracking-[0.12em] text-muted uppercase">
          {String(current + 1).padStart(2, "0")} / {processImages.length} · {current === 0 ? "FINISHED PIECE" : "PROCESS"}
        </span>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous process photograph" onClick={() => move(-1)} className="grid size-11 place-items-center overflow-hidden rounded-full border border-line bg-paper transition-colors hover:bg-lime">
            <Image src="/Process arrow.svg" alt="" width={44} height={44} className="rotate-180" />
          </button>
          <button type="button" aria-label="Next process photograph" onClick={() => move(1)} className="grid size-11 place-items-center overflow-hidden rounded-full border border-line bg-paper transition-colors hover:bg-lime">
            <Image src="/Process arrow.svg" alt="" width={44} height={44} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RedLightProcessContent() {
  return (
    <SiteShell activePage="playground" showContactSection={false}>
      <article className="page-entry gutter pb-16 pt-8 md:pt-12 md:pb-24">
        <Link
          href="/playground"
          className="mb-10 inline-flex items-center gap-3 text-[11px] tracking-[0.12em] text-muted uppercase transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span> Back to playground
        </Link>

        <header className="grid gap-8 border-t border-line pt-6 md:grid-cols-[1.25fr_.75fr] md:items-end">
          <div>
            <SectionLabel>PROCESS / FINISHED PIECE</SectionLabel>
            <h1 className="mt-7 text-[clamp(48px,8vw,116px)] leading-[0.88] tracking-[-0.035em]">
              RED LIGHT.
              <br />
              BLACK DRESS.
            </h1>
          </div>
          <p className="max-w-md text-[16px] leading-[1.7] text-muted md:pb-2 md:text-[18px]">
            One sketch. Many small decisions.
          </p>
        </header>

        <section className="mt-12 grid gap-5 md:grid-cols-[1.35fr_.65fr]">
          <div
            className="relative overflow-hidden bg-[#d9d5c9] md:min-h-190"
            style={{ minHeight: 540 }}
          >
            <Image
              src="/playground/Jweb/j1 (21).webp"
              alt="Finished red light, black dress artwork"
              fill
              priority
              loading="eager"
              sizes="(min-width: 768px) 68vw, 100vw"
              className="object-cover"
            />
          </div>
          <div
            className="flex flex-col justify-between border-y border-line py-6 md:min-h-190 md:border-y-0 md:border-l md:pl-7"
          >
            <div>
              <p className="text-[10px] tracking-[0.14em] text-muted uppercase">01 / FOLLOW THE LIGHT</p>
              <p className="mt-5 max-w-sm text-[36px] leading-[0.95] md:text-[54px]">
                Warm light.
                <br />
                Cool shadows.
              </p>
              <p className="mt-6 max-w-sm text-[14px] leading-[1.7] text-muted">
                The light comes from the top right. A second light source comes from the front and is softer and lighter.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-2 gap-5 border-t border-line pt-5 text-[12px] text-muted">
              <div><span className="block text-ink">Medium</span>Pencil / Pen / Watercolour</div>
              <div><span className="block text-ink">Process</span>21 photographs</div>
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-6 md:mt-24">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <SectionLabel>02 / THE COLOURS BEHIND IT</SectionLabel>
              <h2 className="mt-5 text-[36px] leading-none md:text-[54px]">A small palette.<br />A lot of atmosphere.</h2>
            </div>
            <p className="max-w-sm text-sm leading-[1.7] text-muted">
              Digital swatches are approximations of the colours in the artwork, not exact pencil or paint references.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[
              ["#161718", "Dress shadow"],
              ["#4B4A67", "Cool black"],
              ["#9B8DA8", "Reflected lilac"],
              ["#C47A72", "Rose light"],
              ["#E94B31", "Red source"],
            ].map(([hex, name]) => (
              <div key={hex} className="border border-line p-2">
                <div className="aspect-4/3" style={{ backgroundColor: hex }} />
                <div className="mt-3 flex items-center justify-between text-[9px] tracking-[0.08em] text-muted uppercase">
                  <span>{name}</span><span>{hex}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-6 md:mt-24">
          <SectionLabel>03 / FROM THE FIRST LINE TO THE LAST HIGHLIGHT</SectionLabel>
          <h2 className="mt-5 text-[36px] leading-none md:text-[54px]">The making of it.</h2>
          <p className="mt-3 text-sm text-muted">The decisions behind the layers, in the order I made them.</p>
          <div className="mt-9 flex flex-col">
            {steps.map(([number, title, copy, mark], index) => (
              <article key={number} className={`grid gap-5 border-t border-line py-8 md:grid-cols-[1fr_.8fr] md:items-center ${index % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""}`}>
                <div
                  className="relative mx-auto aspect-4/5 w-full overflow-hidden bg-[#e4e4dc]"
                  style={{ maxWidth: 390 }}
                >
                  <Image
                    src={stepImages[index]}
                    alt={`Process step ${number}: ${title}`}
                    fill
                    sizes="(min-width: 768px) 390px, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="max-w-md">
                  <span className="text-[12px] font-medium tracking-[0.12em] text-[#a23b32]">{number}</span>
                  <h3 className="mt-4 text-[24px] leading-[1.05] md:text-[32px]">{title}</h3>
                  <p className="mt-4 text-[14px] leading-[1.7] text-muted">{copy}</p>
                  <span className="mt-5 block text-[9px] tracking-[0.12em] text-muted uppercase">{mark}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-line pt-6 md:mt-24">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <SectionLabel>04 / EVERY STEP, IN ORDER</SectionLabel>
              <h2 className="mt-5 text-[36px] leading-none md:text-[54px]">All 21 photographs.</h2>
            </div>
            <p className="max-w-sm text-sm leading-[1.7] text-muted">
              Start with the first sketch and move forward to the finished piece. Use the arrows or swipe through the full sequence.
            </p>
          </div>
          <ProcessCarousel />
        </section>

        <Link
          href="/playground"
          className="mt-16 flex items-center justify-between border-t border-b border-line py-5 text-[18px] transition-colors hover:text-[#a23b32] md:mt-24 md:text-[24px]"
        >
          <span>Back to playground</span>
          <span aria-hidden="true">→</span>
        </Link>
      </article>
    </SiteShell>
  );
}
