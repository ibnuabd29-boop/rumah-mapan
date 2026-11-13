import type { Metadata } from "next";
import Link from "next/link";
import { formatWaktu, perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Progres keluarga | Admin" };

type Baris = {
  id: string;
  nama: string;
  pemilik: string;
  anggota: number;
  poin: number;
  selesai: number;
  menunggu: number;
  aktif_terakhir: string | null;
};

export default async function Halaman({ searchParams }: PageProps<"/admin/progres">) {
  const sp = await searchParams;
  const cari = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_keluarga", { p_cari: cari || null });
  const keluarga = (data ?? []) as Baris[];

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 id="judul" className="text-2xl font-semibold">Progres keluarga</h1>
        <p className="text-sm text-muted">
          Poin dan tantangan dihitung dari bukti yang disetujui. Pilih nama keluarga untuk melihat rincian anggotanya.
        </p>
        <p className="text-sm text-muted">
          Daftar memuat hingga 200 hasil terbaru. Gunakan pencarian nama keluarga atau pemilik untuk menemukan keluarga lain.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="font-semibold">Cari keluarga atau pemilik</label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={cari}
            maxLength={60}
            className="min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink transition-colors hover:border-primary active:border-primary"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary transition-opacity hover:opacity-90 active:opacity-80"
        >
          Cari
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Progres keluarga belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : keluarga.length === 0 ? (
        <div className="flex flex-col items-start gap-1">
          <p className="text-muted">
            {cari ? `Tidak ada keluarga atau pemilik yang cocok dengan "${cari}".` : "Belum ada keluarga terdaftar."}
          </p>
          {cari ? <Link href="/admin/progres" className="inline-flex min-h-11 items-center font-semibold underline hover:decoration-2 active:underline-offset-4">Lihat semua keluarga</Link> : null}
        </div>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {keluarga.map((k) => (
            <li key={k.id} className="py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div>
                  <Link
                    href={`/admin/keluarga/${k.id}`}
                    className="inline-flex min-h-11 items-center font-semibold underline hover:decoration-2 active:underline-offset-4"
                  >
                    {k.nama}
                  </Link>
                  <p className="text-sm text-muted">Pemilik: {k.pemilik}, {k.anggota} anggota</p>
                </div>
                <p className="py-2 text-sm text-muted">Aktif terakhir: {formatWaktu(k.aktif_terakhir)}</p>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted">Poin</dt>
                  <dd className="text-lg font-semibold">{k.poin}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Tantangan disetujui</dt>
                  <dd className="text-lg font-semibold">{k.selesai}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Bukti menunggu</dt>
                  <dd className="text-lg font-semibold">{k.menunggu}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted">Anggota</dt>
                  <dd className="text-lg font-semibold">{k.anggota}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
