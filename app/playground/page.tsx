import type { Metadata } from "next";
import PlaygroundContent from "@/components/portfolio/PlaygroundContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Art & Pixel Playground",
  description:
    "Drawing, painting and pixel art experiments by Dipak Pahari, including Aseprite animations and finished artwork studies.",
  path: "/playground",
});

export default function PlaygroundPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Playground", path: "/playground" },
          ]),
          webPageSchema({
            name: "Dipak Pahari Art & Pixel Playground",
            description: "Drawing, painting and Aseprite pixel art by Dipak Pahari.",
            path: "/playground",
          }),
        ]}
      />
      <PlaygroundContent />
    </>
  );
}
