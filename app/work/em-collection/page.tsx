import type { Metadata } from "next";
import EmCollectionContent from "@/components/portfolio/EmCollectionContent";

export const metadata: Metadata = {
  title: "EM Collection — Ecommerce case study",
  description:
    "An online shopping experience built around one idea: help people find, understand and buy with confidence.",
};

export default function EmCollectionPage() {
  return <EmCollectionContent />;
}
