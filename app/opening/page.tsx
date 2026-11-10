import type { Metadata } from "next";
import { PortfolioOpening } from "../components/PortfolioOpening";

export const metadata: Metadata = {
  title: "Opening | Portfolio",
  description: "The animated portfolio opening scene.",
};

export default function OpeningPage() {
  return <PortfolioOpening autoDismiss={false} />;
}
