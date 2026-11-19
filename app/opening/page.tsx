import type { Metadata } from "next";
import { SiteShell } from "@/components/portfolio/site";

export const metadata: Metadata = {
  title: "Opening | Portfolio",
  description: "Live preview of the portfolio opening scene.",
};

export default function OpeningPage() {
  return (
    <SiteShell activePage="home" showContactSection={false}>
      <section className="min-h-screen" aria-label="Opening scene preview">
        <h1 className="sr-only">Opening scene preview</h1>
      </section>
    </SiteShell>
  );
}
