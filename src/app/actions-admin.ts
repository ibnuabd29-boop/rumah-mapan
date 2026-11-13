"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export type HasilA = { galat?: string; ok?: string };

const GALAT: Record<string, string> = {
  bukan_admin: "Akses ditolak.",
  alasan_wajib: "Tulis alasan, minimal 3 huruf. Alasan terlihat oleh pengirim.",
  bukti_tidak_ada: "Bukti tidak ditemukan.",
  bentrok_bukti_aktif: "Tidak bisa dipulihkan: sudah ada bukti aktif lain untuk tantangan atau isi yang sama.",
  slug_tidak_valid: "ID tantangan tidak valid.",
  judul_tidak_valid: "Judul harus berisi 3 sampai 100 karakter.",
  isi_tidak_valid: "Isi tantangan harus berisi 5 sampai 2.000 karakter.",
  durasi_tidak_valid: "Durasi harus antara 3 dan 120 menit.",
  poin_tidak_valid: "Poin harus antara 5 dan 30.",
  kategori_tidak_valid: "Pilih kategori tantangan yang tersedia.",
  peringatan_tidak_valid: "Peringatan maksimal 500 karakter.",
  slug_sudah_dipakai: "ID tantangan sudah digunakan. Ubah judul lalu coba lagi.",
  tantangan_tidak_ada: "Tantangan tidak ditemukan.",
  tantangan_terakhir_kategori: "Tantangan terakhir pada kategori ini tidak dapat diarsipkan.",
  tantangan_tidak_tersedia: "Belum ada tantangan aktif untuk situasi ini. Hubungi admin platform.",
  poin_tidak_boleh_diubah: "Poin tidak dapat diubah karena tantangan ini sudah memiliki bukti.",
  kategori_tidak_boleh_diubah: "Kategori tidak dapat diubah karena tantangan ini sudah memiliki bukti.",
  tantangan_diarsipkan: "Tantangan ini sudah diarsipkan dan tidak menerima bukti baru.",
  status_tidak_valid: "Status konten tidak valid.",
  jenis_tidak_valid: "Jenis pertanyaan tidak valid.",
  kelompok_tidak_valid: "Pilih kelompok pertanyaan yang tersedia.",
  pertanyaan_tidak_valid: "Pertanyaan harus berisi 5 sampai 500 karakter.",
  pertanyaan_tidak_ada: "Pertanyaan tidak ditemukan.",
};

export async function tinjauAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["disetujui", "ditolak", "ditandai"]),
      alasan: z.string().max(300).optional(),
    })
    .safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa isian Anda." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_tinjau_bukti", {
    p_bukti: v.data.id,
    p_status: v.data.status,
    p_alasan: v.data.alasan ?? null,
  });
  if (error) {
    const k = Object.keys(GALAT).find((x) => error.message.includes(x));
    return { galat: k ? GALAT[k] : "Permintaan belum berhasil. Coba lagi." };
  }
  revalidatePath("/admin", "layout");
  return { ok: "Status bukti diperbarui. Poin keluarga ikut menyesuaikan." };
}

const kategoriTantangan = z.enum([
  "komunikasi",
  "kebersamaan",
  "empati",
  "kemandirian",
  "kreativitas",
  "sepulang_kerja",
  "ke_tempat_kerja",
]);

function pesanGalat(error: { message: string }) {
  const k = Object.keys(GALAT).find((key) => error.message.includes(key));
  return k ? GALAT[k] : "Permintaan belum berhasil. Coba lagi.";
}

function buatSlug(judul: string) {
  const slug = judul
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
  return slug || "tantangan";
}

export async function simpanTantanganAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    slug: z.string().max(80).optional(),
    kategori: kategoriTantangan,
    judul: z.string().trim().min(3).max(100),
    isi: z.string().trim().min(5).max(2000),
    menit: z.coerce.number().int().min(3).max(120),
    poin: z.coerce.number().int().min(5).max(30),
    peringatan: z.string().max(500).optional(),
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa kembali isian tantangan." };

  const slug = v.data.slug?.trim() || buatSlug(v.data.judul);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_simpan_tantangan", {
    p_slug: slug,
    p_kategori: v.data.kategori,
    p_judul: v.data.judul,
    p_isi: v.data.isi,
    p_menit: v.data.menit,
    p_poin: v.data.poin,
    p_peringatan: v.data.peringatan?.trim() || null,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/konten");
  revalidatePath("/tantangan");
  revalidatePath("/beranda");
  return { ok: "Tantangan disimpan." };
}

const jenisPertanyaan = z.enum(["obrolan", "materi_genre"]);

export async function simpanPertanyaanAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    id: z.string().optional().transform((id) => id || null).pipe(z.string().uuid().nullable()),
    jenis: jenisPertanyaan,
    kelompok: z.string().min(1).max(80),
    teks: z.string().trim().min(5).max(500),
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa kembali isian pertanyaan." };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_simpan_pertanyaan", {
    p_id: v.data.id || null,
    p_jenis: v.data.jenis,
    p_kelompok: v.data.kelompok,
    p_teks: v.data.teks,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/konten");
  revalidatePath("/obrolan");
  revalidatePath("/materi");
  revalidatePath("/offline-content");
  return { ok: "Pertanyaan disimpan." };
}

const statusKonten = z.enum(["true", "false"]).transform((nilai) => nilai === "true");

export async function statusTantanganAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    slug: z.string().min(1).max(80),
    aktif: statusKonten,
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Status tantangan tidak valid." };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_status_tantangan", {
    p_slug: v.data.slug,
    p_aktif: v.data.aktif,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/konten");
  revalidatePath("/tantangan");
  revalidatePath("/beranda");
  return { ok: v.data.aktif ? "Tantangan diaktifkan." : "Tantangan diarsipkan." };
}

export async function statusPertanyaanAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    id: z.string().uuid(),
    aktif: statusKonten,
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Status pertanyaan tidak valid." };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_status_pertanyaan", {
    p_id: v.data.id,
    p_aktif: v.data.aktif,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/konten");
  revalidatePath("/obrolan");
  revalidatePath("/materi");
  revalidatePath("/offline-content");
  return { ok: v.data.aktif ? "Pertanyaan diaktifkan." : "Pertanyaan diarsipkan." };
}
