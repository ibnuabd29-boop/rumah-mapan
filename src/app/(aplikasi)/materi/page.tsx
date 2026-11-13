import type { Metadata } from "next";
import Link from "next/link";
import { FormTandaiMateri } from "@/components/FormLangkahEnam";
import { ambilSesi } from "@/lib/sesi";
import { MATERI_GENRE } from "@/lib/langkah-enam";

export const metadata: Metadata = { title: "Materi keluarga" };

export default async function Halaman() {
  const { supabase, rumah, user } = await ambilSesi();
  if (!rumah) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Materi keluarga</h1>
        <p className="text-muted">Buat atau gabung ke rumah di <Link href="/beranda" className="underline">Beranda</Link> untuk mencatat bacaan.</p>
      </section>
    );
  }
  const { data: admin, error: adminError } = await supabase.rpc("is_admin");
  if (adminError) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Status akun belum bisa diperiksa. Coba muat ulang halaman.</p>;
  }
  if (admin) {
    return <p className="text-muted">Akun admin platform tidak dapat melihat atau menyimpan progres materi keluarga.</p>;
  }
  const { data: selesai, error } = await supabase
    .from("materi_selesai")
    .select("materi_slug, dibaca_at")
    .eq("keluarga_id", rumah.id)
    .eq("user_id", user.id);
  if (error) {
    return <p role="alert" className="border border-bahaya p-3 text-bahaya">Progres bacaan belum bisa dimuat. Muat ulang halaman.</p>;
  }
  const dibaca = new Set((selesai ?? []).map((baris) => baris.materi_slug));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Materi keluarga</h1>
        <p className="text-muted">Bacaan singkat ini dibuat untuk dibaca anak dan orang tua bersama.</p>
        <p className="rounded-lg border border-kayu p-3 text-sm">
          Ini ringkasan belajar buatan Rumah Mapan, bukan pengganti konsultasi tenaga kesehatan atau pendidikan.
          Materi perlu ditinjau BKKBN setempat, PIK-R, atau psikolog sebelum digunakan luas.
        </p>
        <p className="text-sm text-muted">
          Daftar di bawah mengikuti delapan topik yang diminta. Sumber BKKBN juga mengelompokkan materi GenRe
          menjadi empat bidang: kependudukan dan pembangunan keluarga, kesehatan reproduksi remaja, keterampilan
          hidup, serta perencanaan kehidupan berkeluarga.{" "}
          <a
            href="https://kampungkb.bkkbn.go.id/kampung/11566/intervensi/1365548/sosialisasi-generasi-berencana-kesehatan-reproduksi-remaja"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            Baca sumber BKKBN
          </a>
          .
        </p>
      </header>

      {dibaca.size === MATERI_GENRE.length ? (
        <p role="status" className="rounded-lg border border-primary p-3 font-semibold">Lencana: Tamat 8 substansi.</p>
      ) : (
        <p className="text-sm text-muted">Sudah dibaca {dibaca.size} dari {MATERI_GENRE.length} materi pada akun ini.</p>
      )}

      <ol className="divide-y divide-line border-y border-line">
        {MATERI_GENRE.map((materi, index) => {
          const sudahDibaca = dibaca.has(materi.slug);
          return (
            <li key={materi.slug} className="py-2">
              <details className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold marker:hidden">
                  <span>{index + 1}. {materi.judul}</span>
                  <span className="shrink-0 text-sm text-muted">{sudahDibaca ? "Sudah dibaca" : "Buka bacaan"}</span>
                </summary>
                <div className="flex flex-col gap-4 pb-4 pt-2">
                  <section aria-labelledby={`anak-${materi.slug}`} className="flex flex-col gap-1">
                    <h2 id={`anak-${materi.slug}`} className="font-semibold">Bacaan anak</h2>
                    <p>{materi.anak}</p>
                  </section>
                  <section aria-labelledby={`ortu-${materi.slug}`} className="flex flex-col gap-1">
                    <h2 id={`ortu-${materi.slug}`} className="font-semibold">Bacaan orang tua</h2>
                    <p>{materi.orangTua}</p>
                  </section>
                  <p><strong>Pertanyaan diskusi:</strong> {materi.tanya}</p>
                  <FormTandaiMateri slug={materi.slug} sudahDibaca={sudahDibaca} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
