"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { waktuWibKeISO } from "@/lib/waktu-wib";

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
  segmen_tidak_valid: "Pilih segmen umur yang tersedia.",
  peringatan_tidak_valid: "Peringatan maksimal 500 karakter.",
  sasaran_tidak_valid: "Pilih semua keluarga atau satu keluarga atau lebih yang tersedia.",
  tenggat_tidak_valid: "Tenggat tidak boleh berada di masa lalu.",
  nama_lencana_tidak_valid: "Nama lencana harus berisi 3 sampai 60 karakter.",
  ikon_lencana_tidak_valid: "Pilih ikon lencana yang tersedia.",
  target_poin_tidak_valid: "Poin minimum harus antara 1 dan 1.000.000.",
  poin_minimum_tidak_valid: "Poin minimum harus antara 1 dan 1.000.000.",
  poin_maksimum_tidak_valid: "Poin maksimum harus sama atau lebih besar dari minimum, hingga 1.000.000.",
  status_lencana_tidak_valid: "Status lencana tidak valid.",
  lencana_tidak_ada: "Lencana tidak ditemukan.",
  target_tidak_valid: "Target syarat harus antara 1 dan 1.000.000.",
  syarat_lencana_tidak_valid: "Syarat lencana tidak valid.",
  slug_sudah_dipakai: "ID tantangan sudah digunakan. Ubah judul lalu coba lagi.",
  tantangan_tidak_ada: "Tantangan tidak ditemukan.",
  tantangan_terakhir_kategori: "Tantangan terakhir pada kategori ini tidak dapat diarsipkan.",
  tantangan_tidak_tersedia: "Belum ada tantangan aktif untuk situasi ini. Hubungi admin platform.",
  poin_tidak_boleh_diubah: "Poin tidak dapat diubah karena tantangan ini sudah memiliki bukti.",
  kategori_tidak_boleh_diubah: "Kategori tidak dapat diubah karena tantangan ini sudah memiliki bukti.",
  segmen_tidak_boleh_diubah: "Segmen umur tidak dapat diubah karena tantangan ini sudah memiliki bukti.",
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
  const raw = Object.fromEntries(data);
  const v = z.object({
    slug: z.string().max(80).optional(),
    kategori: kategoriTantangan,
    segmen: z.enum(["berani", "beraksi", "berkolaborasi"]).nullable().or(z.literal(""))
      .transform((segmen) => segmen || null),
    judul: z.string().trim().min(3).max(100),
    isi: z.string().trim().min(5).max(2000),
    menit: z.coerce.number().int().min(3).max(120),
    poin: z.coerce.number().int().min(5).max(30),
    peringatan: z.string().max(500).optional(),
    dipin: z.boolean(),
    tenggat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    untuk_semua: z.boolean(),
    keluarga_ids: z.array(z.string().uuid()),
  }).safeParse({
    ...raw,
    dipin: data.get("dipin") === "true",
    tenggat: typeof raw.tenggat === "string" && raw.tenggat ? raw.tenggat : null,
    untuk_semua: data.get("untuk_semua") === "true",
    keluarga_ids: data.getAll("keluarga_ids"),
  });
  if (!v.success) return { galat: "Periksa kembali isian tantangan." };

  const slug = v.data.slug?.trim() || buatSlug(v.data.judul);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_simpan_tantangan_lanjutan", {
    p_slug: slug,
    p_kategori: v.data.kategori,
    p_segmen: v.data.segmen,
    p_judul: v.data.judul,
    p_isi: v.data.isi,
    p_menit: v.data.menit,
    p_poin: v.data.poin,
    p_peringatan: v.data.peringatan?.trim() || null,
    p_dipin: v.data.dipin,
    p_tenggat: v.data.tenggat,
    p_untuk_semua: v.data.untuk_semua,
    p_keluarga_ids: v.data.keluarga_ids,
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
  const { error } = await supabase.rpc("admin_status_tantangan_lanjutan", {
    p_slug: v.data.slug,
    p_aktif: v.data.aktif,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/konten");
  revalidatePath("/tantangan");
  revalidatePath("/beranda");
  return { ok: v.data.aktif ? "Tantangan diaktifkan." : "Tantangan diarsipkan." };
}

export async function simpanLencanaAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    id: z.string().optional().transform((id) => id || null).pipe(z.string().uuid().nullable()),
    nama: z.string().trim().min(3).max(60),
    ikon: z.enum(["keluarga", "tantangan", "perasaan", "syukur", "materi"]),
    poin_minimum: z.coerce.number().int().min(1).max(1_000_000),
    poin_maksimum: z.coerce.number().int().min(1).max(1_000_000),
    berlaku_sampai: z.string().optional().transform((value) => value?.trim() || null),
    aktif: z.enum(["true", "false"]).transform((aktif) => aktif === "true"),
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa kembali isian lencana." };
  if (v.data.poin_maksimum < v.data.poin_minimum) {
    return { galat: "Poin maksimum harus sama atau lebih besar dari minimum." };
  }

  const berlakuSampai = v.data.berlaku_sampai
    ? waktuWibKeISO(v.data.berlaku_sampai)
    : null;
  if (v.data.berlaku_sampai && !berlakuSampai) {
    return { galat: "Masukkan tanggal dan waktu akhir yang valid." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_simpan_lencana_rentang", {
    p_id: v.data.id,
    p_nama: v.data.nama,
    p_ikon: v.data.ikon,
    p_poin_minimum: v.data.poin_minimum,
    p_poin_maksimum: v.data.poin_maksimum,
    p_berlaku_sampai: berlakuSampai,
    p_aktif: v.data.aktif,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/lencana");
  revalidatePath("/beranda");
  revalidatePath("/admin/keluarga");
  return { ok: "Lencana disimpan." };
}

const ikonLencana = z.enum(["keluarga", "tantangan", "perasaan", "syukur", "materi"]);

function nullableInteger(min: number, max: number) {
  return z.string().optional()
    .transform((value) => value?.trim() ? Number(value) : null)
    .pipe(z.number().int().min(min).max(max).nullable());
}

export async function simpanLencanaKeluargaAdmin(_: HasilA, data: FormData): Promise<HasilA> {
  const v = z.object({
    slug: z.enum(["langkah-pertama", "seminggu", "tim-solid", "pendengar", "atap"]),
    nama: z.string().trim().min(3).max(60),
    ikon: ikonLencana,
    target: nullableInteger(1, 1_000_000),
    poin_minimum: nullableInteger(1, 1_000_000),
    poin_maksimum: nullableInteger(1, 1_000_000),
    berlaku_sampai: z.string().optional().transform((value) => value?.trim() || null),
    aktif: z.enum(["true", "false"]).transform((aktif) => aktif === "true"),
  }).safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa kembali isian lencana." };

  const berbasisPoin = v.data.slug === "atap";
  if (berbasisPoin) {
    if (v.data.target !== null || v.data.poin_minimum === null || v.data.poin_maksimum === null) {
      return { galat: "Isi poin minimum dan maksimum lencana." };
    }
    if (v.data.poin_maksimum < v.data.poin_minimum) {
      return { galat: "Poin maksimum harus sama atau lebih besar dari minimum." };
    }
  } else if (
    v.data.target === null
    || v.data.poin_minimum !== null
    || v.data.poin_maksimum !== null
    || v.data.berlaku_sampai
  ) {
    return { galat: "Periksa kembali target syarat lencana." };
  }

  const berlakuSampai = v.data.berlaku_sampai
    ? waktuWibKeISO(v.data.berlaku_sampai)
    : null;
  if (v.data.berlaku_sampai && !berlakuSampai) {
    return { galat: "Masukkan tanggal dan waktu akhir yang valid." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("admin_simpan_lencana_bawaan", {
    p_slug: v.data.slug,
    p_nama: v.data.nama,
    p_ikon: v.data.ikon,
    p_target: v.data.target,
    p_poin_minimum: v.data.poin_minimum,
    p_poin_maksimum: v.data.poin_maksimum,
    p_berlaku_sampai: berlakuSampai,
    p_aktif: v.data.aktif,
  });
  if (error) return { galat: pesanGalat(error) };

  revalidatePath("/admin/lencana");
  revalidatePath("/beranda");
  revalidatePath("/admin/keluarga");
  return { ok: "Lencana keluarga disimpan." };
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
