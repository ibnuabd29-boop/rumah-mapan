import type { Metadata } from "next";
import Link from "next/link";
import { formatWaktu, perluAdmin } from "@/lib/admin";
import { labelKategori } from "@/lib/tantangan";
import { PERAN, labelPeran } from "@/lib/umum";

export const metadata: Metadata = { title: "Pengguna | Admin" };

type Baris = {
  user_id: string; nama: string; email: string; keluarga_id: string; keluarga: string; peran: string;
  poin: number; selesai: number; hari_beruntun: number; kategori_terbanyak: string | null; aktif_terakhir: string | null;
  materi_selesai: number;
};

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Halaman({ searchParams }: PageProps<"/admin/pengguna">) {
  const sp = await searchParams;
  const q = satu(sp.q).slice(0, 60);
  const peran = PERAN.some((p) => p.nilai === satu(sp.peran)) ? satu(sp.peran) : "";
  const aktif = ["aktif", "tidak"].includes(satu(sp.aktif)) ? satu(sp.aktif) : "";
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_user", {
    p_cari: q || null,
    p_peran: peran || null,
    p_aktif: aktif || null,
  });
  const barisUser = (data ?? []) as Omit<Baris, "materi_selesai">[];
  const { data: progres, error: errorProgres } = error
    ? { data: null, error: null }
    : await supabase.rpc("admin_progres_materi", {
        p_user_ids: [...new Set(barisUser.map((u) => u.user_id))],
      });
  const hitungMateri = new Map(
    ((progres ?? []) as { keluarga_id: string; user_id: string; selesai: number }[])
      .map((x) => [`${x.keluarga_id}-${x.user_id}`, x.selesai]),
  );
  const baris = barisUser.map((u) => ({
    ...u,
    materi_selesai: hitungMateri.get(`${u.keluarga_id}-${u.user_id}`) ?? 0,
  }));
  const ekspor = `/admin/ekspor?${new URLSearchParams({ q, peran, aktif })}`;
  const kolom = "min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink";

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">Pengguna</h1>
      <form method="get" role="search" className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor="q" className="font-semibold">Cari nama atau email</label>
          <input id="q" name="q" defaultValue={q} maxLength={60} className={kolom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="peran" className="font-semibold">Peran</label>
          <select id="peran" name="peran" defaultValue={peran} className={kolom}>
            <option value="">Semua</option>
            {PERAN.map((p) => <option key={p.nilai} value={p.nilai}>{p.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="aktif" className="font-semibold">Aktivitas</label>
          <select id="aktif" name="aktif" defaultValue={aktif} className={kolom}>
            <option value="">Semua</option>
            <option value="aktif">Aktif 7 hari</option>
            <option value="tidak">Tidak aktif</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-4">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary">
            Terapkan
          </button>
          <a href={ekspor} download className="inline-flex min-h-11 items-center rounded-lg border border-field px-5 py-2.5 font-semibold hover:bg-line/50">
            Unduh CSV progres
          </a>
        </div>
      </form>
      <p className="text-sm text-muted">
        Berkas CSV hanya berisi angka progres, tanpa isi catatan. Unduhan tercatat di log audit.
      </p>

      {error || errorProgres ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Daftar belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : baris.length === 0 ? (
        <p className="text-muted">Tidak ada pengguna yang cocok dengan filter ini.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Daftar pengguna</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="py-2 pr-2">Pengguna</th>
              <th scope="col" className="py-2 pr-2 text-right">Poin</th>
              <th scope="col" className="py-2 pr-2 text-right">Selesai</th>
              <th scope="col" className="hidden py-2 pr-2 text-right sm:table-cell">Beruntun</th>
              <th scope="col" className="hidden py-2 pr-2 md:table-cell">Kategori terbanyak</th>
              <th scope="col" className="hidden py-2 pr-2 lg:table-cell">Materi GenRe</th>
              <th scope="col" className="hidden py-2 md:table-cell">Terakhir aktif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {baris.map((u) => (
              <tr key={u.user_id + u.keluarga_id}>
                <td className="py-2 pr-2">
                  <span className="font-semibold">{u.nama}</span>, {labelPeran(u.peran).toLowerCase()}
                  <span className="block break-all text-muted">{u.email}</span>
                  <span className="block text-muted md:hidden">Materi GenRe: {u.materi_selesai} dari 8</span>
                  <Link href={`/admin/keluarga/${u.keluarga_id}`} className="inline-flex min-h-11 items-center underline">
                    {u.keluarga}
                  </Link>
                </td>
                <td className="py-2 pr-2 text-right">{u.poin}</td>
                <td className="py-2 pr-2 text-right">{u.selesai}</td>
                <td className="hidden py-2 pr-2 text-right sm:table-cell">{u.hari_beruntun}</td>
                <td className="hidden py-2 pr-2 md:table-cell">{u.kategori_terbanyak ? labelKategori(u.kategori_terbanyak) : "Belum ada"}</td>
                <td className="hidden py-2 pr-2 lg:table-cell">{u.materi_selesai} dari 8</td>
                <td className="hidden py-2 md:table-cell">{formatWaktu(u.aktif_terakhir)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
