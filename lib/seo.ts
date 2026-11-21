import type { Metadata } from "next";

export const SITE_URL = "https://dipakpahari.com.np";
export const OG_IMAGE = `${SITE_URL}/thumbnails/portfolio-og-1200x630.webp`;

export function pageMetadata({
  title,
  description,
  path,
  image = OG_IMAGE,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title: path === "/" ? { absolute: title } : title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: "Dipak Pahari",
      title,
      description,
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, type: "image/webp" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: "Dipak Pahari",
    url: SITE_URL,
    image: `${SITE_URL}/portfolio/portrait-annotation.webp`,
    jobTitle: ["UI/UX Designer", "Product Designer"],
    description:
      "UI/UX and product designer in Nepal creating clear, useful digital products and interface systems.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "NP",
    },
    sameAs: [
      "https://www.behance.net/paharidipak",
      "https://www.linkedin.com/in/iamu/",
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "Dipak Pahari — UI/UX Designer",
    description:
      "UI/UX and product design portfolio by Dipak Pahari.",
    publisher: { "@id": `${SITE_URL}/#person` },
    inLanguage: "en",
  };
}

export function webPageSchema({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}${path}#webpage`,
    url: `${SITE_URL}${path}`,
    name,
    description,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": `${SITE_URL}/#person` },
    inLanguage: "en",
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function creativeWorkSchema({
  name,
  description,
  path,
  image,
}: {
  name: string;
  description: string;
  path: string;
  image?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name,
    description,
    url: `${SITE_URL}${path}`,
    image: image ? `${SITE_URL}${image}` : OG_IMAGE,
    author: { "@id": `${SITE_URL}/#person` },
    creator: { "@id": `${SITE_URL}/#person` },
    inLanguage: "en",
  };
}
