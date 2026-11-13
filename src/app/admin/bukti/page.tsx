import type { Metadata } from "next";
import { FormAdminTinjau } from "@/components/FormAdminTinjau";
import { driveSiap, tautanBerkas } from "@/lib/drive";
import { perluAdmin } from "@/lib/admin";
import { formatTanggal } from "@/lib/data";
import { KATEGORI, STATUS_BUKTI, labelKategori } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Bukti | Admin" };

type Baris = {
  id: string; tanggal: string; keluarga_id: string; keluarga: string; pengirim: string; judul: string;
  kategori: string; poin: number; jenis: "foto" | "cerita"; teks: string | null; status: string; alasan: string | null;
};

const satu = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const uuid = (s: string) => (/^[0-9a-f-]{36}$/.test(s) ? s : "");
const tgl = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "");

export default async function Halaman({ searchParams }: PageProps<"/admin/bukti">) {
  const sp = await searchParams;
  const f = {
    keluarga: uuid(satu(sp.keluarga)),
    user: uuid(satu(sp.user)),
    kategori: KATEGORI.some((k) => k.nilai === satu(sp.kategori)) ? satu(sp.kategori) : "",
    status: Object.keys(STATUS_BUKTI).includes(satu(sp.status)) ? satu(sp.status) : "",
    dari: tgl(satu(sp.dari)),
    sampai: tgl(satu(sp.sampai)),
  };
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_galeri_bukti", {
    p_keluarga: f.keluarga || null,
    p_user: f.user || null,
    p_kategori: f.kategori || null,
    p_dari: f.dari || null,
    p_sampai: f.sampai || null,
    p_status: f.status || null,
    p_batas: 50,
  });
  const baris = (data ?? []) as Baris[];
  const bisaFoto = driveSiap();
  const kolom = "min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink";

  return (
    <section aria-labelledby="judul" className="flex flex-col gap-4">
      <h1 id="judul" className="text-2xl font-semibold">Galeri bukti</h1>
      <form method="get" role="search" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
        {f.keluarga ? <input type="hidden" name="keluarga" value={f.keluarga} /> : null}
        {f.user ? <input type="hidden" name="user" value={f.user} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="font-semibold">Status</label>
          <select id="status" name="status" defaultValue={f.status} className={kolom}>
            <option value="">Semua</option>
            {Object.entries(STATUS_BUKTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="kategori" className="font-semibold">Kategori</label>
          <select id="kategori" name="kategori" defaultValue={f.kategori} className={kolom}>
            <option value="">Semua</option>
            {KATEGORI.map((k) => <option key={k.nilai} value={k.nilai}>{k.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="dari" className="font-semibold">Dari tanggal</label>
          <input id="dari" name="dari" type="date" defaultValue={f.dari} className={kolom} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sampai" className="font-semibold">Sampai tanggal</label>
          <input id="sampai" name="sampai" type="date" defaultValue={f.sampai} className={kolom} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-4">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary">
            Terapkan
          </button>
          {f.keluarga || f.user ? (
            <a href="/admin/bukti" className="inline-flex min-h-11 items-center px-3 font-semibold underline">
              Hapus filter keluarga dan pengguna
            </a>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya">
          <strong>Gagal: </strong>Bukti belum bisa dimuat. Muat ulang halaman.
        </p>
      ) : baris.length === 0 ? (
        <p className="text-muted">Tidak ada bukti yang cocok dengan filter ini.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {baris.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <p className="text-sm text-muted">
                {formatTanggal(b.tanggal)}, {b.keluarga}, oleh {b.pengirim}
              </p>
              <h2 className="text-base font-semibold">{b.judul}</h2>
              <p className="text-sm">
                {labelKategori(b.kategori)}, +{b.poin} poin bila disetujui. Status: <strong>{STATUS_BUKTI[b.status]}</strong>
              </p>
              {b.jenis === "foto" && bisaFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tautanBerkas(b.id)} alt={`Foto bukti: ${b.judul}`} width={480} height={360} loading="lazy"
                  className="h-auto max-h-72 w-full rounded-lg border border-line object-cover" />
              ) : null}
              {b.teks ? <p>{b.teks}</p> : null}
              {b.alasan ? <p className="text-sm">Alasan: {b.alasan}</p> : null}
              <FormAdminTinjau id={b.id} status={b.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
