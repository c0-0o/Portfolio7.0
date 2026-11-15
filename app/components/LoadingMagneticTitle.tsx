"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MagneticTarget } from "@/lib/magnetic-lines";

const TARGET_BY_PATH: Record<string, string> = {
  "/": "hero-title",
  "/about": "about-title",
  "/playground": "playground-title",
};

export function LoadingMagneticTitle({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <MagneticTarget id={TARGET_BY_PATH[pathname] ?? "loading-title"} priority={3}>
      {children}
    </MagneticTarget>
  );
}
