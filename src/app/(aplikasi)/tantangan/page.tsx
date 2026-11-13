import type { Metadata } from "next";
import Link from "next/link";
import { hariIniWib } from "@/lib/data";
import { ambilSesi } from "@/lib/sesi";
import { KATEGORI, labelKategori } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Tantangan" };

export default async function Halaman({ searchParams }: PageProps<"/tantangan">) {
  const sp = await searchParams;
  const kategori = typeof sp.k === "string" && KATEGORI.some((x) => x.nilai === sp.k) ? sp.k : null;
  const { supabase, rumah } = await ambilSesi();

  let q = supabase.from("tantangan").select("slug, kategori, judul, isi, menit, poin")
    .eq("aktif", true).order("kategori").order("judul");
  if (kategori) q = q.eq("kategori", kategori);
  const [{ data: daftar, error }, { data: hariIni }] = await Promise.all([
    q,
    rumah
      ? supabase
          .from("bukti")
          .select("tantangan_slug, status")
          .eq("keluarga_id", rumah.id)
          .eq("tanggal", hariIniWib())
          .in("status", ["menunggu", "disetujui", "ditandai"])
      : Promise.resolve({ data: [] }),
  ]);
  const status = new Map((hariIni ?? []).map((b) => [b.tantangan_slug, b.status]));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Tantangan</h1>
        <p className="text-muted">
          Tantangan selesai setelah ada bukti foto atau cerita dan anggota keluarga lain menyetujuinya.
        </p>
        <Link href="/bukti" className="inline-flex min-h-11 items-center font-semibold underline">
          Lihat galeri bukti
        </Link>
      </section>

      <nav aria-label="Filter kategori">
        <ul className="flex flex-wrap gap-2">
          {[{ nilai: null, label: "Semua" }, ...KATEGORI].map((k) => {
            const aktif = (k.nilai ?? null) === kategori;
            return (
              <li key={k.label}>
                <Link
                  href={k.nilai ? `/tantangan?k=${k.nilai}` : "/tantangan"}
                  aria-current={aktif ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold ${
                    aktif ? "border-primary bg-primary text-on-primary" : "border-field hover:bg-line/50"
                  }`}
                >
                  {k.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Daftar tantangan belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : daftar && daftar.length === 0 ? (
        <p className="text-muted">Tidak ada tantangan di kategori ini.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {daftar?.map((t) => {
            const s = status.get(t.slug);
            return (
              <li key={t.slug} className="flex items-start justify-between gap-3 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{t.judul}</h2>
                  <p className="text-muted">{t.isi}</p>
                  <p className="text-sm text-muted">
                    {labelKategori(t.kategori)}, {t.menit} menit, +{t.poin} poin
                  </p>
                </div>
                {rumah ? (
                  s ? (
                    <span className="shrink-0 py-2 text-sm font-semibold">
                      {s === "disetujui" ? "Selesai hari ini" : "Menunggu"}
                    </span>
                  ) : (
                    <Link
                      href={`/tantangan/${t.slug}`}
                      aria-label={`Kirim bukti untuk ${t.judul}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-primary px-4 py-2 font-semibold text-primary hover:bg-primary/10"
                    >
                      Kirim bukti
                    </Link>
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {!rumah ? (
        <p className="text-muted">
          Buat atau gabung ke rumah di{" "}
          <Link href="/beranda" className="font-semibold underline">
            Beranda
          </Link>{" "}
          untuk mengirim bukti.
        </p>
      ) : null}
    </div>
  );
}
