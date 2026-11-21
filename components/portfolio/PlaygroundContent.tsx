"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SectionLabel, SiteShell } from "./site";
import { PortfolioActionButton } from "./PortfolioActionButton";

const featuredSequences = [
  {
    title: "Red light, black dress",
    year: "2026",
    sequencePrefix: "/playground/Jweb/j1",
    count: 21,
    href: "/playground/red-light-black-dress",
  },
  {
    title: "By the window",
    year: "2026",
    sequencePrefix: "/playground/j2web/j2",
    count: 24,
  },
  {
    title: "Shinra Kasukabe",
    year: "2025",
    sequencePrefix: "/playground/p1web/WhatsApp Image 2026-11-20 at 11.46.",
    count: 6,
  },
] as Array<{ title: string; year: string; sequencePrefix: string; count: number; href?: string }>;

const p1Names = [
  "23 AM",
  "24 AM",
  "26 AM",
  "28 AM",
  "29 AM",
  "30 AM",
] as const;

function featuredImages(prefix: string, count: number) {
  if (prefix.includes("p1web")) {
    return [
      `${prefix}30 AM.webp`,
      ...p1Names
        .filter((name) => name !== "30 AM")
        .map((name) => `${prefix}${name}.webp`),
    ];
  }
  if (prefix.includes("Jweb")) {
    return [
      `${prefix} (21).webp`,
      ...Array.from({ length: count - 2 }, (_, index) => `${prefix} (${index + 2}).webp`),
    ];
  }
  return [
    `${prefix} (24).webp`,
    ...Array.from({ length: count - 2 }, (_, index) => `${prefix} (${index + 2}).webp`),
  ];
}

const sketchbook = [
  { title: "Moskov", src: "/playground/moskov.webp", aspect: "1536 / 1181", year: "2024" },
  { title: "Dyrroth", src: "/playground/dyroth.webp", aspect: "944 / 1419", year: "2023" },
  { title: "Gojo", src: "/playground/gojo.webp", aspect: "1600 / 1582", year: "2023" },
  { title: "Luffy — rough sketch", src: "/playground/luffy.webp", aspect: "1600 / 1309", year: "2022" },
  { title: "Melissa", src: "/playground/melissa.webp", aspect: "1000 / 1487", year: "2021" },
  { title: "Moonlit", src: "/playground/moon.webp", aspect: "720 / 887", year: "2021" },
  { title: "Colour-pencil box", src: "/playground/box.webp", aspect: "1215 / 1600", year: "2021" },
  { title: "Nothing", src: "/playground/nothing.webp", aspect: "1300 / 1600", year: "2021" },
] as const;

function FeaturedCard({
  piece,
  index,
  onOpen,
}: {
  piece: (typeof featuredSequences)[number];
  index: number;
  onOpen: (src: string, title: string) => void;
}) {
  const [current, setCurrent] = useState(0);
  const images = featuredImages(piece.sequencePrefix, piece.count);
  const src = images[current];
  const card = (
    <figure className="group">
      <button
        type="button"
        aria-label={`Open ${piece.title} image in full screen`}
        className={`relative block w-full cursor-zoom-in overflow-hidden bg-[#dfe2d8] ${index === 0 ? "aspect-3/4 md:-rotate-1" : index === 1 ? "aspect-4/5 md:mt-14" : "aspect-3/4 md:mt-7"}`}
        onClick={() => onOpen(src, piece.title)}
      >
        <Image
          src={src}
          alt={piece.title}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          loading={index === 0 ? "eager" : "lazy"}
          quality={90}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.025]"
        />
      </button>
      <figcaption className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-3">
        {piece.href ? (
          <Link href={piece.href} className="text-[16px] font-medium md:text-[18px]">{piece.title}</Link>
        ) : (
          <span className="text-[16px] font-medium md:text-[18px]">{piece.title}</span>
        )}
        <span className="text-right text-[9px] leading-normal tracking-[0.12em] text-muted md:text-[10px]">{piece.year}</span>
      </figcaption>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
        <button type="button" aria-label={`Previous ${piece.title} image`} className="grid size-11 place-items-center overflow-hidden rounded-full border border-line bg-paper transition-colors hover:bg-lime" onClick={() => setCurrent((value) => (value - 1 + images.length) % images.length)}>
          <Image src="/Process arrow.svg" alt="" width={44} height={44} className="rotate-180" />
        </button>
        <button type="button" aria-label={`Next ${piece.title} image`} className="grid size-11 place-items-center overflow-hidden rounded-full border border-line bg-paper transition-colors hover:bg-lime" onClick={() => setCurrent((value) => (value + 1) % images.length)}>
          <Image src="/Process arrow.svg" alt="" width={44} height={44} />
        </button>
        </div>
        {piece.href && (
          <PortfolioActionButton
            to={piece.href}
            label="View process"
            catAnimation
          />
        )}
      </div>
    </figure>
  );
  return card;
}

export default function PlaygroundRoute() {
  const [lightbox, setLightbox] = useState<{ src: string; title: string } | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [lightbox]);

  return (
    <SiteShell activePage="playground">
      <section className="page-entry gutter flex flex-col gap-8 pt-8 pb-12 md:gap-12 md:pt-12 md:pb-16">
        <SectionLabel>PLAYGROUND / OFF THE CLOCK</SectionLabel>
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <MagneticTarget id="playground-title" priority={3}>
              <h1 className="text-[clamp(52px,9.2vw,132px)] leading-[0.82] tracking-[-0.035em]">
                PLAYGROUND
                <span className="text-lime">.</span>
              </h1>
            </MagneticTarget>
            <div className="-rotate-2 self-start rounded-sm bg-lime px-5 py-4 text-[20px] leading-[1.05] tracking-[-0.02em] md:px-7 md:text-[27px]">
              NO BRIEF.
              <br />
              JUST OBSESSIONS.
            </div>
          </div>
          <div className="flex flex-col justify-between gap-5 border-t border-line pt-5 md:flex-row md:items-end">
            <p className="max-w-172.5 text-lg leading-[1.55] text-muted md:text-[21px]">
              Art, doodles, and little design detours. Not perfect, not always finished. Just a
              place for things I enjoy making outside of work.
            </p>
            <span className="shrink-0 text-xs tracking-[0.08em] text-muted uppercase">11 artworks · 2021—26</span>
          </div>
        </div>
      </section>

      <section className="page-entry page-entry--1 gutter flex flex-col gap-10 pb-16 md:pb-24">
        <div className="grid gap-7 md:grid-cols-3 md:items-end md:gap-5">
          {featuredSequences.map((piece, index) => (
            <FeaturedCard key={piece.title} piece={piece} index={index} onOpen={(src, title) => setLightbox({ src, title })} />
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-5">
          <div className="mb-7 flex items-center justify-between">
            <h2 className="text-[27px] leading-none md:text-[38px]">From the sketchbook</h2>
            <span className="text-[10px] tracking-[0.12em] text-muted uppercase">8 pieces</span>
          </div>
          <div className="grid grid-cols-1 gap-y-8 md:hidden">
            {sketchbook.map((piece) => (
              <figure key={piece.title} className="group">
                <button
                  type="button"
                  aria-label={`Open ${piece.title} in full screen`}
                  className="relative block w-full cursor-zoom-in overflow-hidden bg-[#e8e8df]"
                  style={{ aspectRatio: piece.aspect }}
                  onClick={() => setLightbox({ src: piece.src, title: piece.title })}
                >
                  <Image
                    src={piece.src}
                    alt={piece.title}
                    fill
                    sizes="100vw"
                    quality={90}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                </button>
                <figcaption className="mt-3 flex items-center justify-between gap-3 text-[13px] font-medium">
                  <span>{piece.title}</span>
                  <span className="text-[9px] tracking-[0.12em] text-muted">{piece.year}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="hidden md:grid md:grid-cols-3 md:items-start md:gap-x-6">
            {[0, 1, 2].map((column) => (
              <div key={column} className="flex flex-col gap-x-0 gap-y-12">
                {sketchbook
                  .filter((_, index) => index % 3 === column)
                  .map((piece) => (
                    <figure key={piece.title} className={`group ${column === 1 ? "mt-10" : ""}`}>
                      <button
                        type="button"
                        aria-label={`Open ${piece.title} in full screen`}
                        className="relative block w-full cursor-zoom-in overflow-hidden bg-[#e8e8df]"
                        style={{ aspectRatio: piece.aspect }}
                        onClick={() => setLightbox({ src: piece.src, title: piece.title })}
                      >
                        <Image
                          src={piece.src}
                          alt={piece.title}
                          fill
                          sizes="33vw"
                          quality={90}
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      </button>
                      <figcaption className="mt-3 flex items-center justify-between gap-3 text-[15px] font-medium">
                        <span>{piece.title}</span>
                        <span className="text-[10px] tracking-[0.12em] text-muted">{piece.year}</span>
                      </figcaption>
                    </figure>
                  ))}
              </div>
            ))}
          </div>
        </div>
        <p className="flex items-center justify-center gap-3 pt-4 text-sm text-muted">
          <span className="text-lg" aria-hidden="true">✦</span>
          That’s the little pile for now. More whenever curiosity shows up.
        </p>
      </section>
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${lightbox.title} full screen image`}
          className="fixed inset-0 z-200 grid place-items-center bg-[#10120e]/95 p-4 md:p-8"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close full screen image"
            className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/30 bg-black/30 text-2xl text-white"
            onClick={() => setLightbox(null)}
          >
            ×
          </button>
          <div
            className="relative h-[calc(100dvh-32px)] w-[calc(100vw-32px)]"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={lightbox.src}
              alt={lightbox.title}
              fill
              sizes="100vw"
              quality={95}
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}
    </SiteShell>
  );
}
