import type { Metadata } from "next";
import PlaygroundContent from "@/components/portfolio/PlaygroundContent";

export const metadata: Metadata = {
  title: "Playground",
  description: "Drawing, pixel art, and motion experiments by UI/UX designer Dipak Pahari.",
};

export default function PlaygroundPage() {
  return <PlaygroundContent />;
}
