"use client";

import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { PortfolioOpening } from "./components/PortfolioOpening";
import { SiteNav } from "./components/SiteNav";

const featuredProjects = [
  {
    number: "01",
    category: "E-COMMERCE / UI & UX",
    title: "EM Collection",
    description: "A considered shopping experience across customer-facing and store-management screens.",
    className: "home-project-art home-project-em",
    href: "/projects#em-collection",
  },
  {
    number: "02",
    category: "WEBSITE REDESIGN / UI & UX",
    title: "Codyyn",
    description: "A clearer, more discoverable website experience for desktop and mobile.",
    className: "home-project-art home-project-codyyn",
    href: "/projects#codyyn",
  },
];

export default function Home() {
  return (
    <>
      <PortfolioOpening />
      <main className="portfolio-shell portfolio-home">
        <SiteNav activePage="home" />

        <section className="portfolio-hero" id="home">
          <div className="hero-copy-block">
            <p className="portfolio-eyebrow"><span /> UI/UX Designer · Kathmandu, Nepal</p>
            <MagneticTarget id="hero-title" priority={3}>
              <h1>Thoughtful design.<br /><em>Made to feel clear.</em></h1>
            </MagneticTarget>
            <p className="portfolio-intro">
              I’m Dipak Pahari, a UI/UX designer who turns complex ideas into clean, useful digital experiences—from the first wireframe to developer handoff.
            </p>
            <div className="portfolio-hero-actions">
              <MagneticTarget id="portfolio-work-cta" priority={2}>
                <Link className="portfolio-button" href="/projects">Explore my work <span aria-hidden="true">↗</span></Link>
              </MagneticTarget>
              <Link className="portfolio-text-link" href="/playground">See the creative side <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <div className="hero-stamp" aria-label="Dipak Pahari, UI/UX Designer">
            <span className="hero-stamp-orbit" />
            <span className="hero-stamp-star" aria-hidden="true">✳</span>
            <span className="hero-stamp-name">DIPAK<br />PAHARI</span>
            <span className="hero-stamp-caption">UI / UX / VISUALS</span>
          </div>
        </section>

        <section className="home-work-section" aria-labelledby="home-work-title">
          <div className="section-heading">
            <div>
              <p className="portfolio-eyebrow">01 / Selected work</p>
              <h2 id="home-work-title">Design that gets<br />to the point.</h2>
            </div>
            <Link className="portfolio-text-link" href="/projects">All projects <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="home-project-grid">
            {featuredProjects.map((project) => (
              <Link className="home-project-card" href={project.href} key={project.number}>
                <div className={project.className} aria-hidden="true">
                  <span className="home-art-number">{project.number} / 02</span>
                  {project.number === "01" ? (
                    <div className="em-art-window">
                      <span className="em-art-nav" />
                      <span className="em-art-photo" />
                      <span className="em-art-copy" />
                      <span className="em-art-cta" />
                    </div>
                  ) : (
                    <div className="codyyn-art-window">
                      <span className="codyyn-art-sun" />
                      <span className="codyyn-art-title">A clearer<br />way forward.</span>
                      <span className="codyyn-art-lines" />
                    </div>
                  )}
                  <span className="home-art-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="home-project-info">
                  <div>
                    <p className="portfolio-eyebrow">{project.category}</p>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                  </div>
                  <span className="home-project-link" aria-hidden="true">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-play-section" aria-labelledby="home-play-title">
          <div className="play-section-copy">
            <p className="portfolio-eyebrow">02 / Outside the interface</p>
            <h2 id="home-play-title">Room for a little<br /><em>play.</em></h2>
            <p>Drawing, pixel art, and motion experiments live alongside my product work. A home for visual ideas that don’t fit inside a case study.</p>
            <Link className="portfolio-text-link" href="/playground">Visit the playground <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="play-preview" aria-hidden="true">
            <span className="play-preview-label">DRAW / PIXEL / MOTION</span>
            <span className="play-preview-sun" />
            <span className="play-preview-hill play-preview-hill-back" />
            <span className="play-preview-hill play-preview-hill-front" />
            <span className="play-preview-spark">✳</span>
            <span className="play-preview-index">01—03</span>
          </div>
        </section>

        <footer className="portfolio-footer">
          <span>Dipak Pahari <span aria-hidden="true">·</span> UI/UX Designer</span>
          <a href="mailto:nexgen.d.pahari@gmail.com">nexgen.d.pahari@gmail.com <span aria-hidden="true">↗</span></a>
          <Link href="/about">More about me <span aria-hidden="true">↗</span></Link>
        </footer>
      </main>
    </>
  );
}
