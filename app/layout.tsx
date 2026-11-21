import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist, Geist_Mono, Lilita_One } from "next/font/google";
import { CursorEffectsOverlay } from "@/lib/cursor-effects/CursorEffects";
import { PersistentMagneticBackground } from "@/lib/magnetic-lines";
import { SoundToggle } from "@/components/portfolio/SoundToggle";
import { ScrollReveal } from "@/components/portfolio/ScrollReveal";
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

export const viewport: Viewport = {
  themeColor: "#050505",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://dipakpahari.com.np"),
  title: {
    default: "Dipak Pahari | UX/UI Designer",
    template: "%s | Dipak Pahari",
  },
  applicationName: "Dipak Pahari Portfolio",
  description:
    "Dipak Pahari is a UX/UI designer in Nepal crafting intuitive, human-centered digital products and polished portfolio experiences.",
  authors: [{ name: "Dipak Pahari", url: "https://dipakpahari.com.np" }],
  creator: "Dipak Pahari",
  publisher: "Dipak Pahari",
  keywords: [
    "Dipak Pahari",
    "UX/UI Designer",
    "UI/UX Designer in Nepal",
    "Product Design",
    "UI/UX Design Portfolio",
  ],
  alternates: {
    canonical: "https://dipakpahari.com.np",
  },
  icons: [
    {
      url: "/favicon-16x16.png",
      sizes: "16x16",
      type: "image/png",
    },
    {
      url: "/favicon-32x32.png",
      sizes: "32x32",
      type: "image/png",
    },
    {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
    {
      url: "/android-chrome-192x192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      url: "/android-chrome-512x512.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://dipakpahari.com.np",
    siteName: "Dipak Pahari",
    title: "Dipak Pahari | UX/UI Designer",
    description:
      "Product design portfolio and UX/UI work by Dipak Pahari, a designer based in Nepal creating thoughtful digital experiences.",
    locale: "en_US",
    images: [
      {
        url: "https://dipakpahari.com.np/1200%20%C3%97%20630.webp",
        width: 1200,
        height: 630,
        type: "image/webp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dipak Pahari | UX/UI Designer",
    description:
      "Product design portfolio and UX/UI work by Dipak Pahari, a designer based in Nepal creating thoughtful digital experiences.",
    images: ["https://dipakpahari.com.np/1200%20%C3%97%20630.webp"],
  },
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
          <ScrollReveal />
          {children}
          <CursorEffectsOverlay />
          <SoundToggle />
        </body>
      </html>
    </>
  );
}
