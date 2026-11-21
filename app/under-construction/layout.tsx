import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Under Construction",
  robots: { index: false, follow: false },
};

export default function UnderConstructionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
