import type { Metadata } from "next";
import Link from "next/link";
import { KARTU_OBROLAN } from "@/lib/langkah-enam";

export const metadata: Metadata = { title: "Kartu obrolan" };

export default async function Halaman({ searchParams }: PageProps<"/obrolan">) {
  const params = await searchParams;
  const tema = typeof params.tema === "string" && KARTU_OBROLAN.some((x) => x.tema === params.tema)
    ? params.tema
    : null;
  const temaTerpilih = KARTU_OBROLAN.find((x) => x.tema === tema);
  const daftar = temaTerpilih ? [temaTerpilih] : KARTU_OBROLAN;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Kartu obrolan</h1>
        <p className="text-muted">Pilih satu pertanyaan. Siapa pun boleh melewati atau mengganti kartu.</p>
      </section>
      <nav aria-label="Tema kartu">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/obrolan"
              aria-current={!tema ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 ${!tema ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"}`}
            >
              Semua tema
            </Link>
          </li>
          {KARTU_OBROLAN.map((bagian) => (
            <li key={bagian.tema}>
              <Link
                href={`/obrolan?tema=${encodeURIComponent(bagian.tema)}`}
                aria-current={tema === bagian.tema ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 ${tema === bagian.tema ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"}`}
              >
                {bagian.tema}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {daftar.map((bagian) => (
        <section key={bagian.tema} aria-labelledby={`tema-${bagian.tema}`} className="flex flex-col gap-3">
          <h2 id={`tema-${bagian.tema}`} className="text-lg font-semibold">{bagian.tema}</h2>
          <ol className="divide-y divide-line border-y border-line">
            {bagian.kartu.map((pertanyaan, index) => (
              <li key={pertanyaan} className="py-4">
                <p className="text-sm text-muted">Kartu {index + 1}</p>
                <p className="font-semibold">{pertanyaan}</p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
