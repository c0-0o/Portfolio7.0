import type { Metadata } from "next";
import RedLightProcessContent from "@/components/portfolio/RedLightProcessContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, creativeWorkSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Red Light, Black Dress — Art Process",
  description:
    "Explore the 21-photo process behind Red Light, Black Dress, a pencil, pen and watercolour artwork by Dipak Pahari.",
  path: "/playground/red-light-black-dress",
});

export default function RedLightBlackDressPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Playground", path: "/playground" },
            { name: "Red Light, Black Dress", path: "/playground/red-light-black-dress" },
          ]),
          creativeWorkSchema({
            name: "Red Light, Black Dress",
            description: "Art process documenting a pencil, pen and watercolour artwork.",
            path: "/playground/red-light-black-dress",
            image: "/playground/Jweb/j1 (21).webp",
          }),
        ]}
      />
      <RedLightProcessContent />
    </>
  );
}
