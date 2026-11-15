import type { Metadata } from "next";
import CodynnContent from "@/components/portfolio/CodynnContent";

export const metadata: Metadata = {
  title: "Codynn — Homepage redesign",
  description:
    "A Codynn homepage redesign informed by competitor research, user personas, and user journey mapping.",
};

export default function CodynnPage() {
  return <CodynnContent />;
}
