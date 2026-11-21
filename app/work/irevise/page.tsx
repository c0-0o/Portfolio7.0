import type { Metadata } from "next";
import IReviseContent from "@/components/portfolio/IReviseContent";

export const metadata: Metadata = {
  title: "iRevise — EdTech case study",
  description:
    "A teacher-led learning platform connecting exam creation, student practice and meaningful feedback across desktop and mobile.",
};

export default function IRevisePage() {
  return <IReviseContent />;
}
