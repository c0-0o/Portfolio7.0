import type { Metadata } from "next";
import AboutContent from "@/components/portfolio/AboutContent";

export const metadata: Metadata = {
  title: "About",
  description: "About Dipak Pahari, a UI/UX designer based in Kathmandu, Nepal.",
};

export default function AboutPage() {
  return <AboutContent />;
}
