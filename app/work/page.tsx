import type { Metadata } from "next";
import HomeWorkSection from "@/components/portfolio/HomeWorkSection";
import { SectionLabel, SiteShell } from "@/components/portfolio/site";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "UX/UI Design Projects",
  description:
    "Explore UI/UX design, product design and web design case studies by Dipak Pahari.",
  path: "/work",
});

export default function WorkPage() {
  return (
    <SiteShell activePage="projects">
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Work", path: "/work" },
        ])}
      />
      <section className="page-entry gutter pt-10 pb-4 md:pt-16">
        <SectionLabel>SELECTED WORK / UI/UX & PRODUCT DESIGN</SectionLabel>
        <h1 className="mt-6 max-w-5xl text-[clamp(48px,8vw,112px)] leading-[0.92] tracking-[-0.04em]">
          UX/UI DESIGN PROJECTS.
        </h1>
      </section>
      <HomeWorkSection />
    </SiteShell>
  );
}
