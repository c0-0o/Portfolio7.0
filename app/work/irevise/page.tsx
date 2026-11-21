import type { Metadata } from "next";
import IReviseContent from "@/components/portfolio/IReviseContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, creativeWorkSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "iRevise EdTech Product Design Case Study",
  description:
    "Explore iRevise UX and product design across teacher exam creation, student practice and parent progress experiences.",
  path: "/work/irevise",
});

export default function IRevisePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
            { name: "iRevise", path: "/work/irevise" },
          ]),
          creativeWorkSchema({
            name: "iRevise",
            description: "EdTech product design for assessment, learning and progress workflows.",
            path: "/work/irevise",
            image: "/thumbnails/irevise-behance.webp",
          }),
        ]}
      />
      <IReviseContent />
    </>
  );
}
