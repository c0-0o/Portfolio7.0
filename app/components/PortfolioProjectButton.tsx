"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/Button";

export function PortfolioProjectButton() {
  const router = useRouter();
  return <Button text="Explore my work" onClick={() => router.push("/#work")} />;
}
