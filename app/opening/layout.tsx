import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opening Preview",
  robots: { index: false, follow: false },
};

export default function OpeningLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
