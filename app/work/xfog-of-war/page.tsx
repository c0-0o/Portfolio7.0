import type { Metadata } from "next";
import XfogOfWarContent from "@/components/portfolio/XfogOfWarContent";

export const metadata: Metadata = {
  title: "XFog of War — Browser chess game",
  description:
    "A browser-based chess game with a designed game interface and a custom chess-piece icon set.",
};

export default function XfogOfWarPage() {
  return <XfogOfWarContent />;
}
