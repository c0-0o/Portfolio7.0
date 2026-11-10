import type { Metadata } from "next";
import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { CreativeGallery } from "../components/CreativeGallery";
import { SiteNav } from "../components/SiteNav";

export const metadata: Metadata = {
  title: "Playground | Dipak Pahari",
  description: "Drawing, pixel art, and motion experiments by UI/UX designer Dipak Pahari.",
};

export default function PlaygroundPage() {
  return (
    <main className="portfolio-shell portfolio-playground">
      <SiteNav activePage="playground" />
      <header className="playground-heading">
        <p className="portfolio-eyebrow"><span /> 02 / Just for the joy of it</p>
        <div className="playground-heading-row">
          <MagneticTarget id="playground-title" priority={3}>
            <h1>Not everything<br />needs a <em>wireframe.</em></h1>
          </MagneticTarget>
          <p>Drawing, pixel art, and motion experiments—little ideas and visual detours that sit outside the usual product-design process.</p>
        </div>
      </header>

      <section className="creative-gallery-section" aria-label="Creative work gallery">
        <CreativeGallery />
      </section>

      <section className="playground-note">
        <span className="playground-note-mark" aria-hidden="true">✳</span>
        <p>Different tools, different ways to think. The same curiosity about how a small detail can change the whole feeling.</p>
        <Link className="portfolio-text-link" href="/about">A little more about me <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="portfolio-footer">
        <span>Dipak Pahari <span aria-hidden="true">·</span> Experiments & explorations</span>
        <a href="mailto:nexgen.d.pahari@gmail.com">nexgen.d.pahari@gmail.com <span aria-hidden="true">↗</span></a>
        <Link href="/projects">Selected work <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
