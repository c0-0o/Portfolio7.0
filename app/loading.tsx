import { SiteNav } from "./components/SiteNav";
import { LoadingMagneticTitle } from "./components/LoadingMagneticTitle";

export default function Loading() {
  return (
    <main className="portfolio-shell portfolio-loading-page" aria-busy="true">
      <SiteNav activePage="home" />
      <section className="loading-content" role="status" aria-live="polite">
        <p className="portfolio-eyebrow"><span /> A little in progress</p>
        <LoadingMagneticTitle>
          <h1>Gathering<br /><em>the lines.</em></h1>
        </LoadingMagneticTitle>
        <p className="loading-message">Just a moment while this page finds its shape.</p>
        <div className="loading-track" aria-hidden="true">
          <span />
        </div>
        <span className="loading-index">DIPAK PAHARI <span>·</span> DESIGN PORTFOLIO</span>
      </section>
    </main>
  );
}
