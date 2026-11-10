import type { Metadata } from "next";
import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SiteNav } from "../components/SiteNav";

export const metadata: Metadata = {
  title: "About | Dipak Pahari",
  description: "About Dipak Pahari, a UI/UX designer based in Kathmandu, Nepal.",
};

const skills = [
  "UI design & visual hierarchy",
  "UX research & user flows",
  "Competitor analysis",
  "Information architecture",
  "Wireframing & prototyping",
  "Design systems & components",
  "Responsive design",
  "Developer handoff & collaboration",
];

export default function AboutPage() {
  return (
    <main className="portfolio-shell portfolio-about-page">
      <SiteNav activePage="about" />
      <section className="about-intro">
        <div>
          <p className="portfolio-eyebrow"><span /> A little about me</p>
          <MagneticTarget id="about-title" priority={3}>
            <h1>Namaste!<br /><em>I’m Dipak.</em></h1>
          </MagneticTarget>
          <p className="about-lede">I’m a UI/UX designer in Kathmandu, Nepal, with three years of experience creating minimal, clear, and usable digital experiences.</p>
        </div>
        <div className="about-portrait-art" role="img" aria-label="Abstract portrait illustration">
          <span className="portrait-sun" />
          <span className="portrait-halo" />
          <span className="portrait-figure" />
          <span className="portrait-caption">DESIGN<br />WITH INTENTION</span>
          <span className="portrait-stamp">DP ✳</span>
        </div>
      </section>

      <section className="about-detail-grid">
        <div className="about-detail-label">
          <p className="portfolio-eyebrow">01 / How I work</p>
          <h2>Clarity in every<br />little detail.</h2>
        </div>
        <div className="about-detail-copy">
          <p>I enjoy bringing order to complex ideas—understanding what people need, shaping intuitive flows, and refining interfaces until they feel natural to use.</p>
          <p>I care about thoughtful details, useful interactions, and practical collaboration: work that feels polished to the people using it and clear to the people building it.</p>
        </div>
      </section>

      <section className="about-resume-section" aria-labelledby="experience-title">
        <div className="about-section-heading">
          <p className="portfolio-eyebrow">02 / Experience</p>
          <h2 id="experience-title">Learning by<br />making.</h2>
        </div>
        <div className="experience-list">
          <article className="experience-item">
            <span className="experience-date">Present</span>
            <div>
              <h3>Freelance UI/UX Designer</h3>
              <p>Designing e-commerce websites and user flows, focusing on clean interfaces and smooth user experiences. Creating responsive layouts and refining designs based on project requirements.</p>
            </div>
          </article>
          <article className="experience-item">
            <span className="experience-date">May – June 2025</span>
            <div>
              <h3>UI/UX Designer Intern · Sriyog</h3>
              <p>Designed an 18-screen internship management dashboard covering intern progress, projects, and work activities. Built reusable Figma components and collaborated with developers on handoff.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="about-skills-section" aria-labelledby="skills-title">
        <div className="about-section-heading">
          <p className="portfolio-eyebrow">03 / What I bring</p>
          <h2 id="skills-title">From first sketch<br />to final handoff.</h2>
        </div>
        <div className="skills-content">
          <ul className="skills-list">
            {skills.map((skill) => <li key={skill}>{skill}</li>)}
          </ul>
          <div className="tools-block">
            <p className="portfolio-eyebrow">Tools I use</p>
            <ul className="tool-list" aria-label="Design tools">
              <li>Figma</li>
              <li>Framer</li>
              <li>Aseprite</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-education">
        <div>
          <p className="portfolio-eyebrow">04 / Education</p>
          <h2>Building a foundation.</h2>
        </div>
        <div>
          <h3>Bachelor in Computer Application (BCA)</h3>
          <p>Kantipur Institute of Technology and Management (KITM)</p>
        </div>
      </section>

      <section className="about-contact" id="contact">
        <div>
          <p className="portfolio-eyebrow">Have a project in mind?</p>
          <h2>Let’s make it<br /><em>make sense.</em></h2>
        </div>
        <div className="contact-details">
          <a href="mailto:nexgen.d.pahari@gmail.com">nexgen.d.pahari@gmail.com <span aria-hidden="true">↗</span></a>
          <a href="tel:9708906594">970 890 6594 <span aria-hidden="true">↗</span></a>
          <span>Kathmandu, Nepal</span>
        </div>
      </section>

      <footer className="portfolio-footer">
        <span>Dipak Pahari <span aria-hidden="true">·</span> Kathmandu, Nepal</span>
        <Link href="/projects">Selected work <span aria-hidden="true">↗</span></Link>
        <Link href="/playground">Creative playground <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
