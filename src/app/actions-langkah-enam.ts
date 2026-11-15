"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SUASANA } from "@/lib/langkah-enam";
import { ambilSesi } from "@/lib/sesi";

export type HasilLangkahEnam = { galat?: string; ok?: string };

const uuid = z.string().uuid();
const suasana = z.enum(SUASANA.map((s) => s.nilai) as [string, ...string[]]);
const materiSlug = z.enum([
  "pendewasaan-usia-perkawinan", "fungsi-keluarga", "seksualitas", "hiv-aids",
  "napza", "kecakapan-hidup", "gender", "advokasi-kie",
]);

function pesanGalat(message: string) {
  const pesan: Record<string, string> = {
    bukan_anggota: "Anda bukan anggota rumah ini.",
    langkah_tidak_ditemukan: "Langkah ini tidak ditemukan di rumah Anda.",
    materi_tidak_ditemukan: "Materi tidak ditemukan.",
    duplicate: "Data belum tersimpan. Periksa kembali lalu coba lagi.",
  };
  const kode = Object.keys(pesan).find((key) => message.includes(key));
  return kode ? pesan[kode] : "Permintaan belum berhasil. Coba lagi.";
}

function hasilValidasi(error: z.ZodError) {
  return error.issues[0]?.message ?? "Periksa isian Anda.";
}

async function konteksRumah() {
  const sesi = await ambilSesi();
  const rumah = sesi.rumah;
  if (!rumah) return { galat: "Buat atau gabung ke rumah sebelum memakai fitur ini." } as const;
  return { supabase: sesi.supabase, sesi, rumah } as const;
}

export async function simpanPerasaan(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({ suasana }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.rpc("simpan_checkin", {
    p_keluarga: konteks.rumah.id,
    p_suasana: parsed.data.suasana,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/perasaan");
  revalidatePath("/laporan");
  revalidatePath("/beranda");
  return { ok: "Suasana hari ini tersimpan." };
}

export async function buatCatatan(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({
    isi: z.string().trim().min(1, "Tulis catatan terlebih dahulu.").max(3000, "Catatan maksimal 3000 karakter."),
    suasana: z.union([suasana, z.literal("")]).optional(),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  if (konteks.rumah.peran !== "anak") return { galat: "Catatan harian hanya tersedia untuk akun anak." };
  const { error } = await konteks.supabase.from("catatan_harian").insert({
    keluarga_id: konteks.rumah.id,
    penulis_id: konteks.sesi.user.id,
    isi: parsed.data.isi,
    suasana: parsed.data.suasana || null,
    dibagikan: form.get("dibagikan") === "on",
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/catatan");
  return { ok: "Catatan tersimpan." };
}

export async function balasCatatan(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({
    catatan_id: uuid,
    isi: z.string().trim().min(1, "Tulis balasan terlebih dahulu.").max(1000, "Balasan maksimal 1000 karakter."),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.from("balasan_catatan").insert({
    keluarga_id: konteks.rumah.id,
    catatan_id: parsed.data.catatan_id,
    pengirim_id: konteks.sesi.user.id,
    isi: parsed.data.isi,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/catatan");
  return { ok: "Balasan tersimpan." };
}

export async function buatCitaCita(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({
    judul: z.string().trim().min(2, "Nama cita-cita minimal 2 huruf.").max(100, "Nama cita-cita terlalu panjang."),
    alasan: z.string().trim().min(1, "Ceritakan mengapa cita-cita ini penting.").max(500, "Keterangan maksimal 500 karakter."),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.from("cita_cita").insert({
    keluarga_id: konteks.rumah.id,
    pembuat_id: konteks.sesi.user.id,
    ...parsed.data,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/masa-depan");
  return { ok: "Cita-cita ditambahkan ke papan keluarga." };
}

export async function tambahLangkahCitaCita(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({
    cita_cita_id: uuid,
    isi: z.string().trim().min(2, "Langkah kecil minimal 2 huruf.").max(240, "Langkah maksimal 240 karakter."),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.from("langkah_cita_cita").insert({
    keluarga_id: konteks.rumah.id,
    pembuat_id: konteks.sesi.user.id,
    ...parsed.data,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/masa-depan");
  return { ok: "Langkah kecil ditambahkan." };
}

export async function tandaiLangkahCitaCita(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({ id: uuid, selesai: z.enum(["ya", "tidak"]) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.rpc("tandai_langkah", {
    p_id: parsed.data.id,
    p_selesai: parsed.data.selesai === "ya",
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/masa-depan");
  return { ok: parsed.data.selesai === "ya" ? "Langkah ditandai selesai." : "Tanda selesai dibatalkan." };
}

export async function tandaiMateriSelesai(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({ materi_slug: materiSlug }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.rpc("tandai_materi_selesai", {
    p_keluarga: konteks.rumah.id,
    p_slug: parsed.data.materi_slug,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/materi");
  return { ok: "Progres materi tersimpan." };
}

export async function kirimApresiasi(_: HasilLangkahEnam, form: FormData): Promise<HasilLangkahEnam> {
  const parsed = z.object({
    penerima_id: z.union([uuid, z.literal("")]).optional(),
    isi: z.string().trim().min(2, "Tulis apresiasi minimal 2 huruf.").max(300, "Apresiasi maksimal 300 karakter."),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { galat: hasilValidasi(parsed.error) };
  const konteks = await konteksRumah();
  if ("galat" in konteks) return { galat: konteks.galat };
  const { error } = await konteks.supabase.from("apresiasi").insert({
    keluarga_id: konteks.rumah.id,
    pengirim_id: konteks.sesi.user.id,
    penerima_id: parsed.data.penerima_id || null,
    isi: parsed.data.isi,
  });
  if (error) return { galat: pesanGalat(error.message) };
  revalidatePath("/syukur");
  return { ok: "Apresiasi terkirim ke keluarga." };
}
