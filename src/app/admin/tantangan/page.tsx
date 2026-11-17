import type { Metadata } from "next";
import Link from "next/link";
import { FormAdminStatusKonten } from "@/components/FormAdminStatusKonten";
import { FormAdminTantangan } from "@/components/FormAdminTantangan";
import { perluAdmin } from "@/lib/admin";
import { KATEGORI, SEGMEN_TANTANGAN, labelKategori, labelSegmen } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Kelola tantangan | Admin" };

type Tantangan = {
  slug: string;
  kategori: string;
  segmen: string | null;
  peran_target?: string | null;
  judul: string;
  isi: string;
  menit: number;
  poin: number;
  peringatan: string | null;
  aktif: boolean;
  poin_terkunci: boolean;
  kategori_terkunci: boolean;
  segmen_terkunci: boolean;
  dipin: boolean;
  tenggat: string | null;
  untuk_semua: boolean;
  keluarga_ids: string[];
};

type Keluarga = { id: string; nama: string };
type SasaranTantangan = {
  slug: string;
  dipin: boolean;
  tenggat: string | null;
  untuk_semua: boolean;
  keluarga_ids: string[];
};
type OpsiKonten = {
  keluarga: Keluarga[];
  tantangan: SasaranTantangan[];
};

const PERAN_TARGET_OPSI = [
  { nilai: "ayah", label: "Ayah" },
  { nilai: "ibu", label: "Ibu" },
  { nilai: "anak", label: "Anak" },
  { nilai: "bebas", label: "Bersama / Semua peran" },
] as const;

function labelPeranTarget(peran?: string | null) {
  if (!peran) return "Bersama";
  if (peran === "ayah") return "Ayah";
  if (peran === "ibu") return "Ibu";
  if (peran === "anak") return "Anak";
  return peran;
}

export default async function Halaman({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    kategori?: string;
    segmen?: string;
    peran?: string;
    status?: string;
    sorotan?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const kategoriDipilih = sp.kategori ?? "";
  const segmenDipilih = sp.segmen ?? "";
  const peranDipilih = sp.peran ?? "";
  const statusDipilih = sp.status ?? "";
  const sorotanDipilih = sp.sorotan ?? "";

  const { supabase } = await perluAdmin();
  const [{ data, error }, { data: opsiData, error: opsiError }] = await Promise.all([
    supabase.rpc("admin_daftar_konten"),
    supabase.rpc("admin_opsi_tantangan"),
  ]);

  const konten = (data ?? null) as { tantangan: Tantangan[] } | null;
  const opsi = (opsiData ?? null) as OpsiKonten | null;
  const sasaran = new Map((opsi?.tantangan ?? []).map((item) => [item.slug, item]));
  const semuaTantangan: Tantangan[] = (konten?.tantangan ?? []).map((item) => ({
    ...item,
    dipin: sasaran.get(item.slug)?.dipin ?? false,
    tenggat: sasaran.get(item.slug)?.tenggat ?? null,
    untuk_semua: sasaran.get(item.slug)?.untuk_semua ?? true,
    keluarga_ids: sasaran.get(item.slug)?.keluarga_ids ?? [],
  }));
  const keluarga = opsi?.keluarga ?? [];

  // Filter tantangan
  const tantanganHasil = semuaTantangan.filter((item) => {
    // 1. Pencarian teks
    if (q) {
      const matchJudul = item.judul.toLowerCase().includes(q);
      const matchIsi = item.isi.toLowerCase().includes(q);
      const matchSlug = item.slug.toLowerCase().includes(q);
      if (!matchJudul && !matchIsi && !matchSlug) return false;
    }

    // 2. Filter Kategori
    if (kategoriDipilih && item.kategori !== kategoriDipilih) {
      return false;
    }

    // 3. Filter Segmen Usia
    if (segmenDipilih) {
      if (segmenDipilih === "semua_usia" && item.segmen !== null) return false;
      if (segmenDipilih !== "semua_usia" && item.segmen !== segmenDipilih) return false;
    }

    // 4. Filter Peran Target
    if (peranDipilih) {
      if (peranDipilih === "bebas" && item.peran_target !== null && item.peran_target !== undefined) return false;
      if (peranDipilih !== "bebas" && item.peran_target !== peranDipilih) return false;
    }

    // 5. Filter Status
    if (statusDipilih) {
      if (statusDipilih === "aktif" && !item.aktif) return false;
      if (statusDipilih === "arsip" && item.aktif) return false;
    }

    // 6. Filter Sorotan
    if (sorotanDipilih) {
      if (sorotanDipilih === "dipin" && !item.dipin) return false;
      if (sorotanDipilih === "tenggat" && !item.tenggat) return false;
    }

    return true;
  });

  const adaFilterAktif = Boolean(
    q || kategoriDipilih || segmenDipilih || peranDipilih || statusDipilih || sorotanDipilih
  );

  const kolom = "min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Kelola tantangan</h1>
        <p className="text-muted">
          Cari, saring, tambah, ubah, atau arsipkan tantangan aktivitas harian keluarga.
        </p>
      </header>

      {error || opsiError ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-bahaya px-3 py-3 text-bahaya">
          <p>
            <strong>Gagal:</strong> Daftar tantangan belum bisa dimuat. Pastikan migrasi terbaru sudah dijalankan di Supabase.
          </p>
          <Link href="/admin/tantangan" className="inline-flex min-h-11 items-center font-semibold underline">
            Muat ulang
          </Link>
        </div>
      ) : (
        <>
          {/* Formulir Tambah Tantangan */}
          <details className="rounded-lg border border-line bg-surface p-3">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              + Tambah tantangan baru
            </summary>
            <div className="pt-3">
              <FormAdminTantangan keluarga={keluarga} />
            </div>
          </details>

          {/* Panel Penyaringan / Filter */}
          <section aria-labelledby="judul-filter" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
            <h2 id="judul-filter" className="font-semibold text-ink">
              Filter dan pencarian tantangan
            </h2>
            <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <label htmlFor="q" className="font-semibold text-sm">
                  Cari judul, isi, atau ID tantangan
                </label>
                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Contoh: mendengar cerita, asisten, sarapan..."
                  className={kolom}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="kategori" className="font-semibold text-sm">
                  Kategori
                </label>
                <select id="kategori" name="kategori" defaultValue={kategoriDipilih} className={kolom}>
                  <option value="">Semua kategori</option>
                  {KATEGORI.map((k) => (
                    <option key={k.nilai} value={k.nilai}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="segmen" className="font-semibold text-sm">
                  Segmen usia
                </label>
                <select id="segmen" name="segmen" defaultValue={segmenDipilih} className={kolom}>
                  <option value="">Semua segmen usia</option>
                  <option value="semua_usia">Bebas / Semua usia</option>
                  {SEGMEN_TANTANGAN.map((s) => (
                    <option key={s.nilai} value={s.nilai}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="peran" className="font-semibold text-sm">
                  Peran penugasan
                </label>
                <select id="peran" name="peran" defaultValue={peranDipilih} className={kolom}>
                  <option value="">Semua peran</option>
                  {PERAN_TARGET_OPSI.map((p) => (
                    <option key={p.nilai} value={p.nilai}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="status" className="font-semibold text-sm">
                  Status
                </label>
                <select id="status" name="status" defaultValue={statusDipilih} className={kolom}>
                  <option value="">Semua status</option>
                  <option value="aktif">Aktif saja</option>
                  <option value="arsip">Diarsipkan saja</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sorotan" className="font-semibold text-sm">
                  Sorotan
                </label>
                <select id="sorotan" name="sorotan" defaultValue={sorotanDipilih} className={kolom}>
                  <option value="">Semua tantangan</option>
                  <option value="dipin">Dipin di dashboard</option>
                  <option value="tenggat">Memiliki tenggat</option>
                </select>
              </div>

              <div className="flex flex-wrap items-end gap-2 pt-1 sm:col-span-2 lg:col-span-3">
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-2 font-semibold text-on-primary hover:opacity-90"
                >
                  Terapkan filter
                </button>
                {adaFilterAktif ? (
                  <Link
                    href="/admin/tantangan"
                    className="inline-flex min-h-11 items-center rounded-lg border border-field px-4 py-2 font-semibold hover:bg-line/50"
                  >
                    Reset semua filter
                  </Link>
                ) : null}
              </div>
            </form>
          </section>

          {/* Ringkasan Hasil Filter */}
          <div className="flex items-center justify-between gap-3 border-b border-line pb-2 text-sm text-muted">
            <p>
              Menampilkan <strong>{tantanganHasil.length}</strong> dari total <strong>{semuaTantangan.length}</strong> tantangan.
            </p>
            {adaFilterAktif ? (
              <Link href="/admin/tantangan" className="font-semibold text-primary underline">
                Hapus filter
              </Link>
            ) : null}
          </div>

          {/* Daftar Tantangan */}
          {tantanganHasil.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-field py-10 text-center">
              <p className="font-semibold text-ink">Tidak ada tantangan yang cocok dengan kriteria filter.</p>
              <p className="text-sm text-muted">Ubah kata kunci pencarian atau bersihkan filter untuk melihat semua tantangan.</p>
              <Link
                href="/admin/tantangan"
                className="mt-2 inline-flex min-h-11 items-center rounded-lg border border-primary px-4 py-2 font-semibold text-primary hover:bg-primary/10"
              >
                Reset filter
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {tantanganHasil.map((item) => (
                <li key={item.slug} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 pb-1">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold ${
                          item.aktif
                            ? "border border-primary bg-primary/10 text-primary"
                            : "border border-field bg-line/40 text-muted"
                        }`}
                      >
                        {item.aktif ? "Aktif" : "Diarsipkan"}
                      </span>
                      <span className="inline-flex items-center rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
                        {labelKategori(item.kategori)}
                      </span>
                      <span className="inline-flex items-center rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
                        {labelSegmen(item.segmen)}
                      </span>
                      <span className="inline-flex items-center rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
                        Target: {labelPeranTarget(item.peran_target)}
                      </span>
                      <span className="text-xs text-muted">
                        {item.menit} menit, {item.poin} poin
                      </span>
                      {item.dipin ? (
                        <span className="rounded bg-aksen/20 px-2 py-0.5 text-xs font-semibold text-on-surface">
                          Dipin
                        </span>
                      ) : null}
                      {item.tenggat ? (
                        <span className="rounded bg-line px-2 py-0.5 text-xs text-muted">
                          Tenggat: {item.tenggat}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-lg font-semibold text-ink">{item.judul}</h3>
                    <p className="mt-1 text-sm text-ink/90 leading-relaxed">{item.isi}</p>
                    {item.peringatan ? (
                      <p className="mt-1 text-xs font-medium text-bahaya">
                        Peringatan: {item.peringatan}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted">
                      ID: <code className="font-mono">{item.slug}</code> &bull;{" "}
                      {item.untuk_semua ? "Untuk semua keluarga" : `${item.keluarga_ids.length} keluarga sasaran`}
                    </p>

                    <details className="mt-3 rounded-lg border border-line p-3">
                      <summary className="min-h-11 cursor-pointer py-1 font-semibold text-sm">
                        Ubah data tantangan ini
                      </summary>
                      <div className="pt-3">
                        <FormAdminTantangan tantangan={item} keluarga={keluarga} />
                      </div>
                    </details>
                  </div>

                  <div className="shrink-0 pt-1">
                    <FormAdminStatusKonten jenis="tantangan" id={item.slug} aktif={item.aktif} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
