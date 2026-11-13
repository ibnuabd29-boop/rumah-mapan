import type { Metadata } from "next";
import Link from "next/link";
import { FormAdminPertanyaan } from "@/components/FormAdminPertanyaan";
import { FormAdminStatusKonten } from "@/components/FormAdminStatusKonten";
import { FormAdminTantangan } from "@/components/FormAdminTantangan";
import { perluAdmin } from "@/lib/admin";
import { labelKategori } from "@/lib/tantangan";

export const metadata: Metadata = { title: "Kelola konten | Admin" };

type Tantangan = {
  slug: string;
  kategori: string;
  judul: string;
  isi: string;
  menit: number;
  poin: number;
  peringatan: string | null;
  aktif: boolean;
  poin_terkunci: boolean;
  kategori_terkunci: boolean;
};

type JenisPertanyaan = "obrolan" | "materi_genre";
type Kelompok = { jenis: JenisPertanyaan; slug: string; nama: string };
type Pertanyaan = { id: string; jenis: JenisPertanyaan; kelompok: string; teks: string; aktif: boolean };
type Konten = { tantangan: Tantangan[]; kelompok: Kelompok[]; pertanyaan: Pertanyaan[] };

function DaftarPertanyaan({
  kelompok,
  pertanyaan,
  kelompokList,
}: {
  kelompok: Kelompok;
  pertanyaan: Pertanyaan[];
  kelompokList: Kelompok[];
}) {
  if (pertanyaan.length === 0) {
    return <p className="py-3 text-sm text-muted">Belum ada pertanyaan pada {kelompok.nama}.</p>;
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {pertanyaan.map((item) => (
        <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
          <details className="min-w-0 flex-1">
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              <span className="break-words">{item.teks}</span>
              <span className="ml-2 text-sm font-normal text-muted">{item.aktif ? "Aktif" : "Diarsipkan"}</span>
            </summary>
            <div className="pb-3 pt-2">
              <FormAdminPertanyaan
                jenis={item.jenis}
                kelompok={kelompokList.filter((g) => g.jenis === item.jenis)}
                pertanyaan={item}
              />
            </div>
          </details>
          <FormAdminStatusKonten jenis="pertanyaan" id={item.id} aktif={item.aktif} />
        </li>
      ))}
    </ul>
  );
}

export default async function Halaman() {
  const { supabase } = await perluAdmin();
  const { data, error } = await supabase.rpc("admin_daftar_konten");
  const konten = (data ?? null) as Konten | null;
  const tantangan = konten?.tantangan ?? [];
  const kelompok = konten?.kelompok ?? [];
  const pertanyaan = konten?.pertanyaan ?? [];
  const kelompokObrolan = kelompok.filter((item) => item.jenis === "obrolan");
  const kelompokMateri = kelompok.filter((item) => item.jenis === "materi_genre");

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Kelola konten</h1>
        <p className="text-muted">
          Ubah tantangan dan pertanyaan yang tampil di aplikasi. Arsipkan konten untuk menghentikan pemakaian baru tanpa menghapus riwayat.
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-bahaya px-3 py-3 text-bahaya">
          <p><strong>Gagal:</strong> Daftar konten belum bisa dimuat. Pastikan migrasi konten sudah dijalankan di Supabase, lalu muat ulang.</p>
          <Link href="/admin/konten" className="inline-flex min-h-11 items-center font-semibold underline">
            Muat ulang daftar
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="tantangan" className="flex flex-col gap-3">
            <div>
              <h2 id="tantangan" className="text-xl font-semibold">Tantangan</h2>
              <p className="text-sm text-muted">
                Isi tantangan menjadi instruksi atau pertanyaan yang dibaca keluarga. Kategori dan poin terkunci setelah bukti tercatat.
              </p>
            </div>
            <details className="rounded-lg border border-line p-3">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Tambah tantangan</summary>
              <div className="pt-3"><FormAdminTantangan /></div>
            </details>
            {tantangan.length === 0 ? (
              <p className="text-muted">Belum ada tantangan. Gunakan formulir di atas untuk menambahkan tantangan.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {tantangan.map((item) => (
                  <li key={item.slug} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <details className="min-w-0 flex-1">
                      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
                        <span className="break-words">{item.judul}</span>
                        <span className="ml-2 text-sm font-normal text-muted">{item.aktif ? "Aktif" : "Diarsipkan"}</span>
                      </summary>
                      <div className="flex flex-col gap-2 pb-3 pt-2">
                        <p className="text-sm text-muted">
                          {labelKategori(item.kategori)}, {item.menit} menit, {item.poin} poin. ID: {item.slug}
                        </p>
                        <FormAdminTantangan tantangan={item} />
                      </div>
                    </details>
                    <FormAdminStatusKonten jenis="tantangan" id={item.slug} aktif={item.aktif} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="obrolan" className="flex flex-col gap-3 border-t border-line pt-5">
            <div>
              <h2 id="obrolan" className="text-xl font-semibold">Kartu obrolan</h2>
              <p className="text-sm text-muted">Tambah pertanyaan pada tema yang sudah tersedia, atau arsipkan pertanyaan yang tidak dipakai.</p>
            </div>
            <details className="rounded-lg border border-line p-3">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Tambah pertanyaan obrolan</summary>
              <div className="pt-3">
                <FormAdminPertanyaan jenis="obrolan" kelompok={kelompokObrolan} />
              </div>
            </details>
            {kelompokObrolan.map((item) => (
              <section key={item.slug} aria-labelledby={`obrolan-${item.slug}`}>
                <h3 id={`obrolan-${item.slug}`} className="mb-2 font-semibold">{item.nama}</h3>
                <DaftarPertanyaan
                  kelompok={item}
                  pertanyaan={pertanyaan.filter((q) => q.jenis === "obrolan" && q.kelompok === item.slug)}
                  kelompokList={kelompok}
                />
              </section>
            ))}
          </section>

          <section aria-labelledby="materi" className="flex flex-col gap-3 border-t border-line pt-5">
            <div>
              <h2 id="materi" className="text-xl font-semibold">Pertanyaan Materi GenRe</h2>
              <p className="text-sm text-muted">Pertanyaan diskusi yang tampil bersama bacaan. Isi materi tetap dikelola di aplikasi.</p>
            </div>
            <details className="rounded-lg border border-line p-3">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold">Tambah pertanyaan Materi GenRe</summary>
              <div className="pt-3">
                <FormAdminPertanyaan jenis="materi_genre" kelompok={kelompokMateri} />
              </div>
            </details>
            {kelompokMateri.map((item) => (
              <section key={item.slug} aria-labelledby={`materi-${item.slug}`}>
                <h3 id={`materi-${item.slug}`} className="mb-2 font-semibold">{item.nama}</h3>
                <DaftarPertanyaan
                  kelompok={item}
                  pertanyaan={pertanyaan.filter((q) => q.jenis === "materi_genre" && q.kelompok === item.slug)}
                  kelompokList={kelompok}
                />
              </section>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
