import type { Metadata } from "next";
import { SiteShell } from "@/components/portfolio/site";
import { UnderConstructionExperience } from "@/components/portfolio/SpecialPages";

export const metadata: Metadata = {
  title: "Under construction",
  description: "This corner of Dipak Pahari’s portfolio is still taking shape.",
};

export default function UnderConstructionPage() {
  return (
    <SiteShell activePage="home">
      <UnderConstructionExperience />
    </SiteShell>
  );
}
