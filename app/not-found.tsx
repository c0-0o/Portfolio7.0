import { SiteShell } from "@/components/portfolio/site";
import { NotFoundExperience } from "@/components/portfolio/SpecialPages";

export default function NotFound() {
  return (
    <SiteShell activePage="home" showContactSection={false}>
      <NotFoundExperience />
    </SiteShell>
  );
}
