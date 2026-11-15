import { Navigation } from "./Navigation";

type SitePage = "home" | "about" | "projects" | "playground";

export function SiteNav({ activePage }: { activePage: SitePage }) {
  return <Navigation activePage={activePage} />;
}
