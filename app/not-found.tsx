import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";
import { SiteNav } from "@/components/Navigation/SiteNav";

export default function NotFound() {
  return (
    <main className="portfolio-shell portfolio-not-found">
      <SiteNav activePage="home" />
      <section className="not-found-content">
        <div className="not-found-art" aria-hidden="true">
          <span className="not-found-orbit not-found-orbit-one" />
          <span className="not-found-orbit not-found-orbit-two" />
          <span className="not-found-orbit-dot" />
          <MagneticTarget id="not-found-mark" priority={3}>
            <span className="not-found-number">404</span>
          </MagneticTarget>
          <span className="not-found-art-label">A SMALL DETOUR</span>
        </div>
        <div className="not-found-copy">
          <p className="portfolio-eyebrow"><span /> Route not found</p>
          <h1>This page<br /><em>lost its way.</em></h1>
          <p>The link might be old, or the page may have moved. Let’s get you back to something good.</p>
          <div className="not-found-actions">
            <Link className="portfolio-button" href="/">Back to home <span aria-hidden="true">↗</span></Link>
            <Link className="portfolio-text-link" href="/#work">Explore my work <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
