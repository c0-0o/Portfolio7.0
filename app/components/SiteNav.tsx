"use client";

import Link from "next/link";
import { MagneticTarget } from "@/lib/magnetic-lines";

type SitePage = "home" | "about" | "projects" | "playground";

export function SiteNav({ activePage }: { activePage: SitePage }) {
  return (
    <nav className="showcase-nav" aria-label="Primary navigation">
      <MagneticTarget id="wordmark" as="span" priority={2}>
        <Link className="site-wordmark" href="/" aria-label="Dipak Pahari, home">DIPAK PAHARI<span aria-hidden="true">.</span></Link>
      </MagneticTarget>
      <div className="nav-links">
        <Link href="/projects" aria-current={activePage === "projects" ? "page" : undefined}>Work</Link>
        <Link href="/playground" aria-current={activePage === "playground" ? "page" : undefined}>Playground</Link>
        <Link href="/about" aria-current={activePage === "about" ? "page" : undefined}>About</Link>
        <a className="nav-contact" href="mailto:nexgen.d.pahari@gmail.com">Let’s talk <span aria-hidden="true">↗</span></a>
      </div>
    </nav>
  );
}
