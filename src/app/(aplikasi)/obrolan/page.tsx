import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kartu obrolan" };

type Kelompok = { slug: string; nama: string };
type Pertanyaan = { id: string; kelompok: string; teks: string };

export default async function Halaman({ searchParams }: PageProps<"/obrolan">) {
  const params = await searchParams;
  const supabase = await supabaseServer();
  const [kelompokQuery, pertanyaanQuery] = await Promise.all([
    supabase.from("kelompok_pertanyaan").select("slug, nama").eq("jenis", "obrolan").order("nama"),
    supabase
      .from("pertanyaan_konten")
      .select("id, kelompok, teks")
      .eq("jenis", "obrolan")
      .eq("aktif", true)
      .order("dibuat_at"),
  ]);
  if (kelompokQuery.error || pertanyaanQuery.error) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Kartu obrolan</h1>
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal:</strong> Pertanyaan obrolan belum bisa dimuat. Muat ulang halaman.
        </p>
        <Link href="/obrolan" className="inline-flex min-h-11 items-center font-semibold underline">Muat ulang</Link>
      </section>
    );
  }

  const kelompok = (kelompokQuery.data ?? []) as Kelompok[];
  const pertanyaan = (pertanyaanQuery.data ?? []) as Pertanyaan[];
  const kelompokAktif = kelompok.filter((item) => pertanyaan.some((q) => q.kelompok === item.slug));
  const tema = typeof params.tema === "string" && kelompokAktif.some((item) => item.slug === params.tema)
    ? params.tema
    : null;
  const daftarKelompok = tema ? kelompokAktif.filter((item) => item.slug === tema) : kelompokAktif;

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
          {kelompokAktif.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/obrolan?tema=${encodeURIComponent(item.slug)}`}
                aria-current={tema === item.slug ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border px-3 py-2 ${tema === item.slug ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"}`}
              >
                {item.nama}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {daftarKelompok.length === 0 ? (
        <p className="text-muted">Belum ada pertanyaan obrolan aktif.</p>
      ) : (
        daftarKelompok.map((item) => {
          const daftar = pertanyaan.filter((q) => q.kelompok === item.slug);
          return (
            <section key={item.slug} aria-labelledby={`tema-${item.slug}`} className="flex flex-col gap-3">
              <h2 id={`tema-${item.slug}`} className="text-lg font-semibold">{item.nama}</h2>
              <ol className="divide-y divide-line border-y border-line">
                {daftar.map((q, index) => (
                  <li key={q.id} className="py-4">
                    <p className="text-sm text-muted">Kartu {index + 1}</p>
                    <p className="font-semibold">{q.teks}</p>
                  </li>
                ))}
              </ol>
            </section>
          );
        })
      )}
    </div>
  );
}
