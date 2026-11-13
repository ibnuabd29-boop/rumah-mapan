import type { Metadata } from "next";
import { formatWaktu, perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Audit | Admin" };

type Baris = { waktu: string; admin: string; aksi: string; objek: string | null; keluarga: string | null; detail: Record<string, unknown> };

const LABEL: Record<string, string> = {
  lihat_ringkasan: "Melihat ringkasan platform",
  daftar_keluarga: "Melihat daftar keluarga",
  daftar_pengguna: "Melihat daftar pengguna",
  lihat_keluarga: "Membuka detail keluarga",
  galeri_bukti: "Membuka galeri bukti",
  lihat_foto: "Membuka foto bukti",
  tinjau_bukti: "Mengubah status bukti",
  ekspor_csv: "Mengunduh CSV progres",
  lihat_audit: "Membuka log audit",
  lihat_konten: "Melihat daftar konten",
  simpan_tantangan: "Menyimpan tantangan",
  arsipkan_tantangan: "Mengarsipkan tantangan",
  aktifkan_tantangan: "Mengaktifkan tantangan",
  simpan_pertanyaan: "Menyimpan pertanyaan",
  arsipkan_pertanyaan: "Mengarsipkan pertanyaan",
  aktifkan_pertanyaan: "Mengaktifkan pertanyaan",
};

export default async function Halaman() {
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_audit_log", { p_batas: 100 });
  const baris = (data ?? []) as Baris[];
  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">Log audit</h1>
      <p className="text-muted">100 aksi admin terakhir: siapa, kapan, dan apa yang dilihat.</p>
      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Log belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : baris.length === 0 ? (
        <p className="text-muted">Belum ada aksi admin tercatat.</p>
      ) : (
        <table className="w-full text-left text-sm [overflow-wrap:anywhere]">
          <caption className="sr-only">Log audit admin</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="py-2 pr-2">Aksi</th>
              <th scope="col" className="hidden py-2 pr-2 sm:table-cell">Admin</th>
              <th scope="col" className="py-2">Waktu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {baris.map((l, i) => (
              <tr key={i}>
                <td className="py-2 pr-2">
                  {LABEL[l.aksi] ?? l.aksi}
                  {l.keluarga ? <span className="block text-muted">Keluarga: {l.keluarga}</span> : null}
                  {Object.keys(l.detail).length > 0 ? (
                    <span className="block text-muted">{JSON.stringify(l.detail)}</span>
                  ) : null}
                  <span className="block text-muted sm:hidden">{l.admin}</span>
                </td>
                <td className="hidden py-2 pr-2 sm:table-cell">{l.admin}</td>
                <td className="py-2">{formatWaktu(l.waktu)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
