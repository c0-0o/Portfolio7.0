import type { Metadata } from "next";
import EmCollectionContent from "@/components/portfolio/EmCollectionContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, creativeWorkSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "EM Collection Ecommerce UX Case Study",
  description:
    "Explore the ecommerce UX and interface design for EM Collection, including discovery, product, cart and checkout experiences.",
  path: "/work/em-collection",
});

export default function EmCollectionPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
            { name: "EM Collection", path: "/work/em-collection" },
          ]),
          creativeWorkSchema({
            name: "EM Collection",
            description: "Ecommerce UX/UI case study covering discovery, product, cart and checkout.",
            path: "/work/em-collection",
            image: "/thumbnails/emcollection-thumbnail.png",
          }),
        ]}
      />
      <EmCollectionContent />
    </>
  );
}
