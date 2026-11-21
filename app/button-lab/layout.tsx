import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Button Lab",
  robots: { index: false, follow: false },
};

export default function ButtonLabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
