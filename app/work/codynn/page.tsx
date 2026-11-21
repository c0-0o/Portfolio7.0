import type { Metadata } from "next";
import CodynnContent from "@/components/portfolio/CodynnContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, creativeWorkSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Codynn Homepage UX/UI Case Study",
  description:
    "Explore a UX/UI homepage redesign for Codynn with clearer messaging, user journey mapping and responsive interface design.",
  path: "/work/codynn",
});

export default function CodynnPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
            { name: "Codynn", path: "/work/codynn" },
          ]),
          creativeWorkSchema({
            name: "Codynn Homepage Redesign",
            description: "Homepage UX/UI redesign with persona and journey-led structure.",
            path: "/work/codynn",
          }),
        ]}
      />
      <CodynnContent />
    </>
  );
}
