import type { Metadata } from "next";
import Link from "next/link";
import { perluAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin" };

export default async function Halaman() {
  const { supabase } = await perluAdmin();
  const [{ data, error }, { data: perhatian, error: perhatianError }] = await Promise.all([
    supabase.rpc("admin_ringkasan"),
    supabase.rpc("admin_perhatian_anak"),
  ]);
  if (error || !data) {
    return (
      <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
        <strong>Gagal: </strong>Ringkasan belum bisa dimuat. Muat ulang halaman.
      </p>
    );
  }
  const baris: [string, number, string?][] = [
    ["Keluarga", data.keluarga, "/admin/keluarga"],
    ["Pengguna aktif 7 hari", data.aktif_7hari, "/admin/pengguna?aktif=aktif"],
    ["Tantangan selesai (disetujui)", data.selesai],
    ["Bukti menunggu tinjauan", data.menunggu, "/admin/bukti?status=menunggu"],
    ["Bukti ditandai tidak pantas", data.ditandai, "/admin/bukti?status=ditandai"],
    ["Total pengguna", data.pengguna, "/admin/pengguna"],
  ];
  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">
        Ringkasan platform
      </h1>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {baris.map(([label, nilai, href]) => (
          <div key={label} className="flex flex-col-reverse rounded-lg border border-line p-3">
            <dt className="text-sm text-muted">
              {href ? (
                <Link href={href} className="inline-flex min-h-11 items-center underline">
                  {label}
                </Link>
              ) : (
                label
              )}
            </dt>
            <dd className="text-3xl font-semibold" style={{ fontFamily: "var(--font-judul-asli), Georgia, serif" }}>
              {nilai}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted">
        &quot;Aktif&quot; berarti membuka aplikasi dalam 7 hari terakhir. Pengguna yang belum pernah membuka aplikasi
        sejak fitur ini ada dihitung tidak aktif.
      </p>
      <section aria-labelledby="perlu-perhatian" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="perlu-perhatian" className="text-lg font-semibold">Perlu perhatian</h2>
        <p className="text-sm text-muted">
          Tanda ini muncul jika tiga check-in terakhir anak bernilai sedih atau cemas. Admin tidak melihat nilai suasana hati.
        </p>
        {perhatianError ? (
          <p role="alert" className="border border-bahaya p-3 text-bahaya">Tanda perhatian belum bisa dimuat. Muat ulang halaman.</p>
        ) : perhatian?.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {perhatian.map((anak: { keluarga_id: string; keluarga: string; nama_anak: string; perlu_perhatian: boolean }) => (
              <li key={`${anak.keluarga_id}-${anak.nama_anak}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <p><strong>{anak.nama_anak}</strong>, {anak.keluarga}</p>
                <span className="text-sm font-semibold">Perlu perhatian</span>
                <Link href={`/admin/keluarga/${anak.keluarga_id}`} className="inline-flex min-h-11 items-center font-semibold underline">
                  Buka ringkasan keluarga
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Belum ada tanda perhatian dari tiga check-in terakhir.</p>
        )}
      </section>
    </section>
  );
}
