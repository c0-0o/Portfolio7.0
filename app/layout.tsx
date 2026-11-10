import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono, Lilita_One } from "next/font/google";
import { CursorEffectsOverlay } from "@/lib/cursor-effects/CursorEffects";
import { PersistentMagneticBackground } from "@/lib/magnetic-lines";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const lilitaOne = Lilita_One({
  variable: "--font-lilita-one",
  weight: "400",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dipak Pahari | UI/UX Designer",
  description: "UI/UX designer in Kathmandu, Nepal. Selected product design work, creative experiments, and more.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <html
        lang="en"
        className={`${dmSans.variable} ${geistSans.variable} ${lilitaOne.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <PersistentMagneticBackground />
          {children}
          <CursorEffectsOverlay />
        </body>
      </html>
    </>
  );
}
