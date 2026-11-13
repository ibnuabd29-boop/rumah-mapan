import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  // Semua halaman bergantung pada sesi pengguna, jadi tidak ada yang bisa di-prerender.
  // Turbopack hanya aktif di dev; production build memakai webpack standar.
  ...(dev
    ? {
        turbopack: {
          rules: {
            "*.css": {
              loaders: ["@tailwindcss/turbopack"],
              as: "*.css",
            },
          },
        },
      }
    : {}),
};

export default nextConfig;
