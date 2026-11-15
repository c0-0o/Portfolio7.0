"use client";

import { useRouter } from "next/navigation";
import Button from "@/components/Button";

export function PortfolioActionButton({ to, label }: { to: string; label: string }) {
  const router = useRouter();

  return <Button text={label} onClick={() => router.push(to)} />;
}
