import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logo Lab",
  robots: { index: false, follow: false },
};

export default function LogoLabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
