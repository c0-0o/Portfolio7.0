import type { Metadata } from "next";
import RedLightProcessContent from "@/components/portfolio/RedLightProcessContent";

export const metadata: Metadata = {
  title: "Red light, black dress — Process",
  description: "The making-of process for Red light, black dress by Dipak Pahari.",
};

export default function RedLightBlackDressPage() {
  return <RedLightProcessContent />;
}
