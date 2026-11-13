"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hapusBerkasDrive } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { galatTantangan } from "@/lib/galat";
import { sha256Hex } from "@/lib/umum";

export type HasilT = { galat?: string; ok?: string };

const uuid = z.string().uuid();

export async function aturTantangan(data: FormData) {
  const v = z
    .object({ keluarga_id: uuid, mode: z.enum(["biasa", "pulang_kerja", "hari_kunjungan"]), ganti: z.string().optional() })
    .safeParse(Object.fromEntries(data));
  if (!v.success) return;
  const supabase = await supabaseServer();
  await supabase.rpc("atur_tantangan_hari_ini", {
    p_keluarga: v.data.keluarga_id,
    p_mode: v.data.mode,
    p_ganti: v.data.ganti === "1",
  });
  revalidatePath("/beranda");
}

export async function lewatiTantangan(data: FormData) {
  const id = uuid.safeParse(data.get("keluarga_id"));
  if (!id.success) return;
  const supabase = await supabaseServer();
  await supabase.rpc("lewati_tantangan", { p_keluarga: id.data });
  revalidatePath("/beranda");
}

// Cerita dinormalisasi sebelum di-hash supaya salinan yang hanya beda spasi atau huruf besar tetap terdeteksi.
const normalisasi = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

export async function kirimCerita(_: HasilT, data: FormData): Promise<HasilT> {
  const v = z
    .object({
      keluarga_id: uuid,
      slug: z.string().min(1).max(80),
      teks: z.string().max(2000, "Cerita maksimal 2000 karakter."),
    })
    .safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: v.error.issues[0]?.message ?? "Periksa isian Anda." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("kirim_bukti", {
    p_keluarga: v.data.keluarga_id,
    p_tantangan: v.data.slug,
    p_jenis: "cerita",
    p_teks: v.data.teks,
    p_hash: await sha256Hex(normalisasi(v.data.teks)),
    p_drive_file_id: null,
  });
  if (error) return { galat: galatTantangan(error.message) };
  revalidatePath("/", "layout");
  return { ok: "Bukti terkirim. Poin masuk setelah anggota keluarga lain menyetujuinya." };
}

export async function tinjauBukti(_: HasilT, data: FormData): Promise<HasilT> {
  const v = z
    .object({ id: uuid, status: z.enum(["disetujui", "ditolak"]), alasan: z.string().max(300).optional() })
    .safeParse(Object.fromEntries(data));
  if (!v.success) return { galat: "Periksa isian Anda." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("tinjau_bukti", {
    p_bukti: v.data.id,
    p_status: v.data.status,
    p_alasan: v.data.alasan ?? null,
  });
  if (error) return { galat: galatTantangan(error.message) };
  revalidatePath("/", "layout");
  return { ok: v.data.status === "disetujui" ? "Bukti disetujui. Poin masuk." : "Bukti ditolak." };
}

export async function hapusBukti(data: FormData) {
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const supabase = await supabaseServer();
  const { data: baris } = await supabase.from("bukti").select("keluarga_id").eq("id", id.data).single();
  const { data: berkas, error } = await supabase.rpc("hapus_bukti", { p_bukti: id.data });
  if (error) return;
  if (typeof berkas === "string" && baris) await hapusBerkasDrive(baris.keluarga_id, berkas).catch(() => {});
  revalidatePath("/", "layout");
}
