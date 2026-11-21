import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { BackToWorkLink, SectionLabel, SiteShell, Tag } from "./site";

const tags = ["Browser chess game", "Game UI", "Chess-piece icons", "Icon design"];

const contributions = [
  {
    number: "01",
    title: "Chess interface",
    text: "Designed the visual interface for playing chess in a browser, with the board and game pieces at the center of the experience.",
  },
  {
    number: "02",
    title: "Piece icon set",
    text: "Created some chess-piece icons from scratch and modified others to bring them into a consistent visual style.",
  },
];

export default function XfogOfWarContent() {
  return (
    <SiteShell activePage="projects">
      <section className="gutter flex flex-col gap-8 pt-6 pb-14 md:gap-12 md:pt-14 md:pb-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <BackToWorkLink label="Back to selected work" />
          <SectionLabel>BROWSER GAME / UI & ICON DESIGN</SectionLabel>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <MagneticTarget id="xfog-case-study-title" priority={3}>
              <h1 className="text-[clamp(48px,8.5vw,112px)] leading-[0.96]">XFOG OF WAR.</h1>
            </MagneticTarget>
            <p className="mt-5 font-display text-[clamp(24px,3vw,40px)] text-moss">
              CHESS, DESIGNED FOR THE BROWSER.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <p className="text-lg leading-[1.7] text-muted">
              XFog of War is a browser-based chess game. I designed its interface and the chess
              pieces and icons used throughout the experience.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="XFog of War project skills">
              {tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-ink py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-4 md:max-w-3xl">
          <SectionLabel tone="lime">01 / DESIGN CONTRIBUTION</SectionLabel>
          <h2 className="text-[clamp(34px,5vw,62px)] leading-[1.02] text-paper">
            MAKE THE BOARD THE FOCUS.
          </h2>
          <p className="text-base leading-[1.7] text-soft">
            The interface and piece artwork were designed together so the game feels cohesive,
            readable, and centered on the chess match.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {contributions.map((contribution) => (
            <article key={contribution.number} className="flex flex-col gap-4 rounded-2xl border border-ink-line p-6 md:p-7">
              <span className="font-display text-4xl text-lime">{contribution.number}</span>
              <h3 className="text-[26px] leading-tight text-paper">{contribution.title}</h3>
              <p className="leading-[1.65] text-soft">{contribution.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-7 py-14 md:gap-10 md:py-20">
        <SectionLabel>02 / ICON CRAFT</SectionLabel>
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="text-[clamp(32px,4.5vw,56px)] leading-[1.03]">
            A DISTINCT SET OF CHESS PIECES.
          </h2>
          <p className="text-base leading-[1.7] text-muted">
            Some icons were created from scratch; others were adapted and modified. Together,
            they form a piece set tailored to the game&apos;s visual direction.
          </p>
        </div>
        <Link className="portfolio-text-link" href="/#work">
          Back to all projects <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </SiteShell>
  );
}
