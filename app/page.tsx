import type { Metadata } from "next";
import HomeContent from "@/components/portfolio/HomeContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, webPageSchema } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Dipak Pahari | UI/UX & Product Designer",
  description:
    "UI/UX and product designer in Nepal creating clear, thoughtful digital products, websites and mobile interfaces.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <JsonLd
        data={webPageSchema({
          name: "Dipak Pahari — UI/UX & Product Designer",
          description:
            "UI/UX and product design portfolio by Dipak Pahari.",
          path: "/",
        })}
      />
      <HomeContent />
    </>
  );
}
