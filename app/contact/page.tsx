import type { Metadata } from "next";
import { SectionLabel, SiteShell } from "@/components/portfolio/site";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description:
    "Contact Dipak Pahari for UI/UX design, product design and web interface projects.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <SiteShell activePage="home">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <section id="contact" className="page-entry gutter flex min-h-[68vh] flex-col justify-center py-16">
        <SectionLabel>CONTACT / START A CONVERSATION</SectionLabel>
        <h1 className="mt-6 max-w-4xl text-[clamp(48px,8vw,112px)] leading-[0.92] tracking-[-0.04em]">
          HAVE A GOOD IDEA?
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-[1.7] text-muted">
          I’m available to discuss UI/UX design, product design and website or mobile app projects.
        </p>
        <a
          href="mailto:nexgen.d.pahari@gmail.com"
          className="mt-8 w-fit border-b border-ink pb-1 text-xl transition-colors hover:text-moss"
        >
          nexgen.d.pahari@gmail.com
        </a>
      </section>
    </SiteShell>
  );
}
