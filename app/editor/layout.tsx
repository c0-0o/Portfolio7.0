import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor",
  robots: { index: false, follow: false, noarchive: true },
};

export default function EditorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
