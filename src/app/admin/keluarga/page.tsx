import type { Metadata } from "next";
import Link from "next/link";
import { formatWaktu, perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Keluarga | Admin" };

type Baris = {
  id: string; nama: string; pemilik: string; anggota: number; poin: number;
  selesai: number; menunggu: number; aktif_terakhir: string | null;
};

export default async function Halaman({ searchParams }: PageProps<"/admin/keluarga">) {
  const sp = await searchParams;
  const cari = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_keluarga", { p_cari: cari || null });
  const baris = (data ?? []) as Baris[];

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">
        Keluarga
      </h1>
      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="font-semibold">
            Cari nama keluarga atau pemilik
          </label>
          <input id="q" name="q" defaultValue={cari} maxLength={60}
            className="min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink" />
        </div>
        <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary">
          Cari
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Daftar belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : baris.length === 0 ? (
        <p className="text-muted">{cari ? `Tidak ada keluarga yang cocok dengan "${cari}".` : "Belum ada keluarga terdaftar."}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Daftar keluarga</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="py-2 pr-2">Keluarga</th>
              <th scope="col" className="hidden py-2 pr-2 sm:table-cell">Anggota</th>
              <th scope="col" className="py-2 pr-2 text-right">Poin</th>
              <th scope="col" className="hidden py-2 pr-2 text-right sm:table-cell">Selesai</th>
              <th scope="col" className="py-2 pr-2 text-right">Menunggu</th>
              <th scope="col" className="hidden py-2 md:table-cell">Terakhir aktif</th>
              <th scope="col" className="py-2 pl-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {baris.map((k) => (
              <tr key={k.id}>
                <td className="py-2 pr-2">
                  <Link href={`/admin/keluarga/${k.id}`} className="inline-flex min-h-11 items-center font-semibold underline">
                    {k.nama}
                  </Link>
                  <span className="block text-muted">Pemilik: {k.pemilik}</span>
                  <span className="block text-muted sm:hidden">{k.anggota} anggota, {k.selesai} selesai</span>
                </td>
                <td className="hidden py-2 pr-2 sm:table-cell">{k.anggota}</td>
                <td className="py-2 pr-2 text-right">{k.poin}</td>
                <td className="hidden py-2 pr-2 text-right sm:table-cell">{k.selesai}</td>
                <td className="py-2 pr-2 text-right">{k.menunggu}</td>
                <td className="hidden py-2 md:table-cell">{formatWaktu(k.aktif_terakhir)}</td>
                <td className="py-2 pl-2 text-right">
                  <Link
                    href={`/admin/keluarga/${k.id}`}
                    className="inline-flex min-h-11 items-center font-semibold text-primary underline"
                  >
                    Detail & Kelola
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
