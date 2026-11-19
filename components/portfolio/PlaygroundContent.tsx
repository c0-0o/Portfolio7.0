import Image from "next/image";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SectionLabel, SiteShell } from "./site";

const PLAYGROUND_IMAGES = {
  "05e674653a96367bc9ae3f99c38e7ae14ecbb4af": "/portfolio/playground-face.png",
  "8b5e1e82391fd4e55f767195a6c29456c9852159": "/portfolio/playground-color.png",
  "d597537c25dcd6e771fa42298d086a65a28227c8": "/portfolio/playground-quiet.png",
} as const;
const img = (id: keyof typeof PLAYGROUND_IMAGES) => PLAYGROUND_IMAGES[id];

type Piece = { title: string; medium: string; h: number; src?: string; bg: string };

const columns: Piece[][] = [
  [
    { title: "A face, a few tries", medium: "Graphite", h: 500, src: img("05e674653a96367bc9ae3f99c38e7ae14ecbb4af"), bg: "bg-[#f3ecd8]" },
    { title: "Seeing what sticks", medium: "Colour study", h: 330, src: img("8b5e1e82391fd4e55f767195a6c29456c9852159"), bg: "bg-[#d9c7a8]" },
  ],
  [
    { title: "Somewhere quiet", medium: "Gouache", h: 330, src: img("d597537c25dcd6e771fa42298d086a65a28227c8"), bg: "bg-[#c9d8cf]" },
    { title: "Leaves from memory", medium: "Ink on paper", h: 500, bg: "bg-[#efe9d8]" },
  ],
  [
    { title: "Letters getting loose", medium: "Type play", h: 460, bg: "bg-[#d9c8ea]" },
    { title: "Absolutely no thoughts", medium: "Digital doodle", h: 330, bg: "bg-[#f4dc8f]" },
  ],
];

export default function PlaygroundRoute() {
  return (
    <SiteShell activePage="playground">
      <section className="page-entry gutter flex flex-col gap-8 pt-8 pb-12 md:gap-11 md:pt-16">
        <SectionLabel>PLAYGROUND / OFF THE CLOCK</SectionLabel>
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <MagneticTarget id="playground-title" priority={3}>
              <h1 className="text-[clamp(52px,10.1vw,146px)] leading-none tracking-[-0.02em]">
                PLAYGROUND.
              </h1>
            </MagneticTarget>
            <div className="font-display rotate-[7deg] rounded bg-lime px-6 py-3.75 text-[clamp(18px,1.9vw,27px)] leading-[1.05]">
              NO BRIEF.
              <br />
              JUST OBSESSIONS.
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <p className="max-w-172.5 text-lg leading-[1.55] text-muted md:text-[21px]">
              Art, doodles, and little design detours. Not perfect, not always finished. Just a
              place for things I enjoy making outside of work.
            </p>
            <span className="text-xs text-muted">Have a wander ↓</span>
          </div>
        </div>
      </section>

      <section className="page-entry page-entry--1 gutter flex flex-col gap-8 pb-18">
        <div className="border-t border-line pt-5 text-xs font-bold tracking-[1px] text-muted">
          A LITTLE BIT OF EVERYTHING
        </div>
        <div className="grid gap-11 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {columns.map((col, i) => (
            <div key={i} className="flex flex-col gap-11">
              {col.map((p) => (
                <figure key={p.title} className="group flex flex-col gap-3.5">
                  {p.src ? (
                    <div className="relative w-full" style={{ height: p.h }}>
                      <Image
                        src={p.src}
                        alt={p.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        loading="eager"
                        className="rounded-[10px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                      />
                    </div>
                  ) : (
                    <div
                      role="img"
                      aria-label={`${p.title} placeholder`}
                      style={{ height: p.h }}
                      className={`w-full rounded-[10px] ${p.bg}`}
                    />
                  )}
                  <figcaption className="flex items-baseline justify-between">
                    <span className="text-[15px] font-medium">{p.title}</span>
                    <span className="text-xs text-muted">{p.medium}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>
        <p className="flex items-center justify-center gap-3 pt-6 text-sm text-muted">
          <span className="text-lg" aria-hidden="true">✦</span>
          That’s the little pile for now. More whenever curiosity shows up.
        </p>
      </section>
    </SiteShell>
  );
}
