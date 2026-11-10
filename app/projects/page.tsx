import type { Metadata } from "next";
import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SiteNav } from "../components/SiteNav";

export const metadata: Metadata = {
  title: "Work | Dipak Pahari",
  description: "Selected UI/UX design projects by Dipak Pahari, including EM Collection and Codyyn.",
};

const projects = [
  {
    id: "em-collection",
    number: "01",
    category: "E-COMMERCE / UI & UX",
    title: "EM Collection",
    summary: "E-commerce website design",
    description: "Designed more than 60 desktop and mobile screens across customer shopping experiences and store-management pages. Researched usability, refined shopping flows, and simplified cart and checkout interactions.",
    tags: ["E-commerce", "Responsive design", "Wireframing", "Prototyping"],
    artClass: "case-art-em",
    artLabel: "SHOP / DISCOVER / CHECK OUT",
  },
  {
    id: "codyyn",
    number: "02",
    category: "WEBSITE REDESIGN / UI & UX",
    title: "Codyyn",
    summary: "Website redesign",
    description: "Redesigned more than 62 desktop and mobile pages. The work focused on clearer messaging, stronger content hierarchy, easier discovery, and progressive disclosure to make information easier to navigate.",
    tags: ["Website redesign", "Information architecture", "Responsive design", "UI systems"],
    artClass: "case-art-codyyn",
    artLabel: "CLARITY / HIERARCHY / FLOW",
  },
];

export default function ProjectsPage() {
  return (
    <main className="portfolio-shell portfolio-work-page">
      <SiteNav activePage="projects" />
      <header className="work-heading">
        <p className="portfolio-eyebrow"><span /> 01 / Selected work</p>
        <div className="work-heading-row">
          <MagneticTarget id="projects-title" priority={3}>
            <h1>Useful by design.<br /><em>Clear by nature.</em></h1>
          </MagneticTarget>
          <p>Product and website experiences shaped around real people, clear structure, and details that make the next step easier.</p>
        </div>
      </header>

      <section className="case-list" aria-label="Selected design projects">
        {projects.map((project) => (
          <article className="case-study" id={project.id} key={project.id}>
            <div className={`case-art ${project.artClass}`} role="img" aria-label={`${project.title} project visual`}>
              <span className="case-art-index">{project.number} / 02</span>
              <div className="case-art-composition" aria-hidden="true">
                {project.id === "em-collection" ? (
                  <>
                    <span className="case-em-topbar" />
                    <span className="case-em-image" />
                    <span className="case-em-copy" />
                    <span className="case-em-product case-em-product-one" />
                    <span className="case-em-product case-em-product-two" />
                    <span className="case-em-product case-em-product-three" />
                  </>
                ) : (
                  <>
                    <span className="case-codyyn-orbit" />
                    <span className="case-codyyn-copy">Make room<br />for what’s next.</span>
                    <span className="case-codyyn-button" />
                    <span className="case-codyyn-lines" />
                  </>
                )}
              </div>
              <span className="case-art-label">{project.artLabel}</span>
            </div>
            <div className="case-study-copy">
              <p className="portfolio-eyebrow">{project.number} / {project.category}</p>
              <MagneticTarget id={`${project.id}-title`} priority={2}>
                <h2>{project.title}</h2>
              </MagneticTarget>
              <h3>{project.summary}</h3>
              <p className="case-description">{project.description}</p>
              <ul className="case-tags" aria-label={`${project.title} design skills`}>
                {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="work-next-step">
        <div>
          <p className="portfolio-eyebrow">Curiosity doesn’t stop at UI</p>
          <h2>There’s more<br />in the sketchbook.</h2>
        </div>
        <Link className="portfolio-button" href="/playground">Explore the playground <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="portfolio-footer">
        <span>Dipak Pahari <span aria-hidden="true">·</span> Selected UI/UX work</span>
        <a href="mailto:nexgen.d.pahari@gmail.com">nexgen.d.pahari@gmail.com <span aria-hidden="true">↗</span></a>
        <Link href="/about">About me <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
