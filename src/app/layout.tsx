import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { DaftarServiceWorker } from "@/components/DaftarServiceWorker";
import "./globals.css";

// Fraunces untuk judul: bentuknya seperti papan nama rumah, bukan UI "teknologi".
const judul = Fraunces({ variable: "--font-judul-asli", subsets: ["latin"], display: "swap" });
// Public Sans untuk isi: terbaca jelas di layar kecil dan mendukung teks Indonesia.
const isi = Public_Sans({ variable: "--font-isi", subsets: ["latin"], display: "swap" });

const tagline = "Rumah mempersiapkan masa yang akan datang";

export const metadata: Metadata = {
  title: { default: "Rumah Mapan", template: "%s | Rumah Mapan" },
  description: `${tagline}. Tantangan kecil sehari-hari untuk ayah, ibu, dan anak.`,
  openGraph: {
    title: "Rumah Mapan",
    description: tagline,
    locale: "id_ID",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Rumah Mapan",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#141b19" },
  ],
};

// Tema disimpan di cookie dan dipasang server pada <html>, jadi tidak perlu skrip untuk mencegah kedipan.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tema = (await cookies()).get("tema")?.value;
  return (
    <html
      lang="id"
      className={`${judul.variable} ${isi.variable}`}
      data-theme={tema === "terang" || tema === "gelap" ? tema : undefined}
    >
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <a
          href="#konten-utama"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
        >
          Lompat ke konten
        </a>
        <DaftarServiceWorker />
        {children}
      </body>
    </html>
  );
}
