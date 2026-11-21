import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor Login",
  robots: { index: false, follow: false, noarchive: true },
};

export default function EditorLoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
