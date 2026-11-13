import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatWaktu, perluAdmin } from "@/lib/admin";
import { formatTanggal } from "@/lib/data";
import { daftarLencana, labelKategori, RINGKASAN_KOSONG, STATUS_BUKTI } from "@/lib/tantangan";
import { labelPeran } from "@/lib/umum";

export const metadata: Metadata = { title: "Detail keluarga | Admin" };

type Detail = {
  keluarga: { id: string; nama: string; dibuat_at: string; pemilik: string };
  anggota: { nama: string; peran: string; bergabung_at: string; aktif_terakhir: string | null; poin: number; selesai: number }[];
  ringkasan: Record<string, unknown> | null;
  riwayat: { id: string; tanggal: string; judul: string; kategori: string; pengirim: string; status: string; jenis: string }[];
};
type Tren = { tanggal: string; senang: number; tenang: number; biasa: number; sedih: number; cemas: number };
type RingkasanCatatan = { tanggal: string; jumlah: number };

export default async function Halaman({ params }: PageProps<"/admin/keluarga/[id]">) {
  const { id } = await params;
  const { supabase } = await perluAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [
    { data, error },
    { data: tren7, error: errorTren7 },
    { data: tren30, error: errorTren30 },
    { data: catatan, error: errorCatatan },
  ] = await Promise.all([
    supabase.rpc("admin_detail_keluarga", { p_keluarga: id }),
    supabase.rpc("admin_tren_perasaan", { p_keluarga: id, p_hari: 7 }),
    supabase.rpc("admin_tren_perasaan", { p_keluarga: id, p_hari: 30 }),
    supabase.rpc("admin_ringkasan_catatan", { p_keluarga: id }),
  ]);
  if (error?.message.includes("keluarga_tidak_ada")) notFound();
  if (error || !data) {
    return (
      <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
        <strong>Gagal: </strong>Detail belum bisa dimuat. Muat ulang halaman.
      </p>
    );
  }
  const d = data as Detail;
  const r = { ...RINGKASAN_KOSONG, ...(d.ringkasan ?? {}) };
  const lencana = daftarLencana(r);
  const tujuhHari = (tren7 ?? []) as Tren[];
  const tigaPuluhHari = (tren30 ?? []) as Tren[];
  const jumlahCatatan = (catatan ?? []) as RingkasanCatatan[];
  const gagalPrivasi = errorTren7 || errorTren30 || errorCatatan;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/keluarga" className="inline-flex min-h-11 items-center font-semibold underline">
        Kembali ke daftar keluarga
      </Link>
      <section aria-labelledby="judul" className="flex flex-col gap-1">
        <h1 id="judul" className="text-2xl font-semibold">{d.keluarga.nama}</h1>
        <p className="text-muted">Pemilik {d.keluarga.pemilik}. Dibuat {formatWaktu(d.keluarga.dibuat_at)}.</p>
        <p>
          <strong>{r.poin}</strong> poin, <strong>{r.selesai}</strong> tantangan selesai, hari beruntun{" "}
          <strong>{r.hari_beruntun}</strong> (terbaik {r.beruntun_terbaik}), {r.menunggu} bukti menunggu.
        </p>
      </section>

      <section aria-labelledby="anggota" className="flex flex-col gap-2">
        <h2 id="anggota" className="text-lg font-semibold">Anggota</h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Anggota keluarga</caption>
          <thead className="border-b border-line">
            <tr>
              <th scope="col" className="py-2 pr-2">Nama</th>
              <th scope="col" className="py-2 pr-2 text-right">Poin</th>
              <th scope="col" className="py-2 pr-2 text-right">Selesai</th>
              <th scope="col" className="hidden py-2 sm:table-cell">Terakhir aktif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {d.anggota.map((a) => (
              <tr key={a.nama + a.bergabung_at}>
                <td className="py-2 pr-2">
                  <span className="font-semibold">{a.nama}</span>
                  <span className="block text-muted">{labelPeran(a.peran)}</span>
                </td>
                <td className="py-2 pr-2 text-right">{a.poin}</td>
                <td className="py-2 pr-2 text-right">{a.selesai}</td>
                <td className="hidden py-2 sm:table-cell">{formatWaktu(a.aktif_terakhir)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="tren-perasaan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="tren-perasaan" className="text-lg font-semibold">Tren check-in perasaan</h2>
        <p className="text-sm text-muted">Jumlah check-in per suasana, tanpa nama atau rincian per anak.</p>
        {gagalPrivasi ? (
          <p role="alert" className="border border-bahaya p-3 text-bahaya">Tren atau ringkasan privasi belum bisa dimuat. Muat ulang halaman.</p>
        ) : (
          <>
            <TrenPerasaan judul="Tujuh hari" data={tujuhHari} />
            <details className="rounded-lg border border-line px-3">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Rincian 30 hari</summary>
              <div className="pb-3 pt-2">
                <TrenPerasaan judul="30 hari" data={tigaPuluhHari} />
              </div>
            </details>
          </>
        )}
      </section>

      <section aria-labelledby="jumlah-catatan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="jumlah-catatan" className="text-lg font-semibold">Catatan harian</h2>
        <p className="text-sm text-muted">Admin hanya melihat jumlah catatan per tanggal, bukan isi atau perasaan yang dipilih.</p>
        {errorCatatan ? (
          <p role="alert" className="border border-bahaya p-3 text-bahaya">Jumlah catatan belum bisa dimuat. Muat ulang halaman.</p>
        ) : jumlahCatatan.length === 0 ? (
          <p className="text-muted">Belum ada catatan harian.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {jumlahCatatan.map((baris) => (
              <li key={baris.tanggal} className="flex justify-between gap-3 py-2">
                <span>{formatTanggal(baris.tanggal)}</span>
                <span>{baris.jumlah} catatan</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="lencana" className="flex flex-col gap-2">
        <h2 id="lencana" className="text-lg font-semibold">Lencana</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {lencana.map((l) => (
            <li key={l.id} className={`rounded-lg p-2 text-sm ${l.terbuka ? "border border-primary" : "border border-dashed border-field text-muted"}`}>
              <strong>{l.nama}</strong>, {l.terbuka ? "terbuka" : "terkunci"}. {l.syarat}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="riwayat" className="flex flex-col gap-2">
        <h2 id="riwayat" className="text-lg font-semibold">Riwayat tantangan (50 terakhir)</h2>
        {d.riwayat.length === 0 ? (
          <p className="text-muted">Belum ada bukti dari keluarga ini.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Riwayat bukti tantangan</caption>
            <thead className="border-b border-line">
              <tr>
                <th scope="col" className="py-2 pr-2">Tantangan</th>
                <th scope="col" className="py-2 pr-2">Status</th>
                <th scope="col" className="hidden py-2 sm:table-cell">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d.riwayat.map((b) => (
                <tr key={b.id}>
                  <td className="py-2 pr-2">
                    <Link href={`/admin/bukti?keluarga=${id}`} className="font-semibold underline">{b.judul}</Link>
                    <span className="block text-muted">
                      {labelKategori(b.kategori)}, oleh {b.pengirim}, {b.jenis}
                    </span>
                    <span className="block text-muted sm:hidden">{formatTanggal(b.tanggal)}</span>
                  </td>
                  <td className="py-2 pr-2">{STATUS_BUKTI[b.status] ?? b.status}</td>
                  <td className="hidden py-2 sm:table-cell">{formatTanggal(b.tanggal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function TrenPerasaan({ judul, data }: { judul: string; data: Tren[] }) {
  const suasana: { kunci: keyof Omit<Tren, "tanggal">; label: string }[] = [
    { kunci: "senang", label: "Senang" },
    { kunci: "tenang", label: "Tenang" },
    { kunci: "biasa", label: "Biasa" },
    { kunci: "sedih", label: "Sedih" },
    { kunci: "cemas", label: "Cemas" },
  ];
  const tertinggi = Math.max(1, ...data.flatMap((hari) => suasana.map((s) => hari[s.kunci])));
  return (
    <section aria-label={`Grafik ${judul}`} className="flex flex-col gap-2">
      <h3 className="font-semibold">{judul}</h3>
      {data.length === 0 ? (
        <p className="text-muted">Belum ada data check-in pada periode ini.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {data.filter((hari) => suasana.some((s) => hari[s.kunci] > 0)).map((hari) => (
            <li key={hari.tanggal} className="flex flex-col gap-1 border-b border-line pb-2">
              <span className="text-sm font-semibold">{formatTanggal(hari.tanggal)}</span>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {suasana.map((s) => (
                  <li key={s.kunci} className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-sm">
                    <span>{s.label}</span>
                    <progress aria-label={`${s.label}, ${formatTanggal(hari.tanggal)}`} value={hari[s.kunci]} max={tertinggi} className="h-3 w-full accent-primary" />
                    <span className="text-right">{hari[s.kunci]}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
