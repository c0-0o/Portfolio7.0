import type { Metadata } from "next";
import XfogOfWarContent from "@/components/portfolio/XfogOfWarContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, creativeWorkSchema, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "XFog of War UI/UX Case Study",
  description:
    "Explore the UX/UI design and custom chess-piece icon system for XFog of War, a fog-of-war browser chess experience.",
  path: "/work/xfog-of-war",
});

export default function XfogOfWarPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Work", path: "/work" },
            { name: "XFog of War", path: "/work/xfog-of-war" },
          ]),
          creativeWorkSchema({
            name: "XFog of War",
            description: "UI/UX design and custom icon system for a fog-of-war browser chess game.",
            path: "/work/xfog-of-war",
            image: "/case-studies/xfog-of-war/desktop-match.webp",
          }),
        ]}
      />
      <XfogOfWarContent />
    </>
  );
}
