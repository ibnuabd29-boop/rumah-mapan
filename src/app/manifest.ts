import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rumah Mapan",
    short_name: "Mapan",
    description: "Rumah mempersiapkan masa yang akan datang",
    start_url: "/beranda",
    scope: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#1f4d45",
    icons: [
      {
        src: "/ikon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/ikon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/ikon-rumah-mapan.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
