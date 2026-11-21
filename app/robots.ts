import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/editor",
        "/editor-login",
        "/button-lab",
        "/logo-lab",
        "/opening",
        "/under-construction",
      ],
    },
    sitemap: "https://dipakpahari.com.np/sitemap.xml",
  };
}
