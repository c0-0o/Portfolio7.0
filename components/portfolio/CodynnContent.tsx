import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SectionLabel, SiteShell, Tag } from "./site";

const researchAreas = [
  {
    number: "01",
    title: "Competitor research",
    text: "Review comparable experiences to understand how they explain their offer, organize information, and guide visitors toward a next step.",
  },
  {
    number: "02",
    title: "User personas",
    text: "Represent the different goals and needs the homepage should support, and use them to evaluate content priorities.",
  },
  {
    number: "03",
    title: "User journeys",
    text: "Map how visitors move from discovering Codynn to understanding its offer and choosing where to go next.",
  },
];

const tags = [
  "Homepage redesign",
  "UI design",
  "UX research",
  "Competitor research",
  "User personas",
  "User journey mapping",
];

export default function CodynnContent() {
  return (
    <SiteShell activePage="projects">
      <section className="gutter flex flex-col gap-8 pt-6 pb-14 md:gap-12 md:pt-14 md:pb-20">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <Link href="/#work" className="text-sm text-muted hover:text-ink">
            ← Back to selected work
          </Link>
          <SectionLabel>HOMEPAGE REDESIGN / UX RESEARCH</SectionLabel>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <div>
            <MagneticTarget id="codynn-case-study-title" priority={3}>
              <h1 className="text-[clamp(56px,10vw,128px)] leading-[0.94]">CODINN.</h1>
            </MagneticTarget>
            <p className="mt-5 font-display text-[clamp(24px,3vw,40px)] text-moss">
              A HOMEPAGE BUILT AROUND PEOPLE.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <p className="text-lg leading-[1.7] text-muted">
              I redesigned Codynn&apos;s homepage and used competitor research, user personas, and
              journey mapping to guide its structure and content priorities.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Codynn project skills">
              {tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
            </div>
          </div>
        </div>
      </section>

      <section className="gutter flex flex-col gap-8 bg-mist py-14 md:gap-11 md:py-22">
        <div className="flex flex-col gap-4 md:max-w-3xl">
          <SectionLabel>01 / RESEARCH</SectionLabel>
          <h2 className="text-[clamp(34px,5vw,62px)] leading-[1.02]">
            START WITH THE QUESTIONS VISITORS NEED ANSWERED.
          </h2>
          <p className="text-base leading-[1.7] text-muted">
            The research work focused on understanding the competitive landscape, the different
            people the homepage needs to serve, and the steps visitors take before deciding what
            to do next.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {researchAreas.map((area) => (
            <article key={area.number} className="flex flex-col gap-4 rounded-2xl bg-paper p-6 md:p-7">
              <span className="font-display text-4xl text-moss">{area.number}</span>
              <h3 className="text-[26px] leading-tight">{area.title}</h3>
              <p className="leading-[1.65] text-muted">{area.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="gutter flex flex-col gap-7 py-14 md:gap-10 md:py-20">
        <SectionLabel>02 / HOMEPAGE REDESIGN</SectionLabel>
        <div className="grid gap-6 md:grid-cols-2 md:gap-12">
          <h2 className="text-[clamp(32px,4.5vw,56px)] leading-[1.03]">
            TURN THE RESEARCH INTO A CLEARER FIRST VISIT.
          </h2>
          <div className="flex flex-col gap-4 text-base leading-[1.7] text-muted">
            <p>
              The redesigned homepage brings the core message, supporting information, and
              next-step choices into a more intentional order.
            </p>
            <p>
              Competitor patterns, persona needs, and journey stages informed the content
              hierarchy, helping visitors understand the offer and find a relevant path forward.
            </p>
          </div>
        </div>
        <Link className="portfolio-text-link" href="/#work">
          Back to all projects <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </SiteShell>
  );
}
