import type { Metadata } from "next";
import AboutContent from "@/components/portfolio/AboutContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Learn about Dipak Pahari, a UI/UX and product designer in Nepal focused on clear, human-centered digital experiences.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          webPageSchema({
            name: "About Dipak Pahari",
            description:
              "UI/UX and product designer based in Nepal.",
            path: "/about",
          }),
        ]}
      />
      <AboutContent />
    </>
  );
}
