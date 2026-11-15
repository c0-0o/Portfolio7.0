import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dipak Pahari | UX/UI Designer",
    short_name: "Dipak Pahari",
    description:
      "Portfolio of Dipak Pahari, a UX/UI designer in Nepal crafting thoughtful digital products and interfaces.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F5EF",
    theme_color: "#050505",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
