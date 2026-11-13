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
