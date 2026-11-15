import { SiteShell } from "./site";
import PortfolioHeroExperience from "./PortfolioHeroExperience";
import HomeAnimatedSections from "./HomeAnimatedSections";
import HomeWorkSection from "./HomeWorkSection";

export default function HomeRoute() {
  return (
    <SiteShell activePage="home">
      <PortfolioHeroExperience once={false} />

      <HomeWorkSection />

      <HomeAnimatedSections />
    </SiteShell>
  );
}
