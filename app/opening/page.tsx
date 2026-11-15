import type { Metadata } from "next";
import PortfolioHeroExperience from "@/components/portfolio/PortfolioHeroExperience";
import { SiteShell } from "@/components/portfolio/site";

export const metadata: Metadata = {
  title: "Opening | Portfolio",
  description: "Live preview of the portfolio opening scene.",
};

export default function OpeningPage() {
  return (
    <SiteShell activePage="home">
      <PortfolioHeroExperience once={false} />
    </SiteShell>
  );
}
