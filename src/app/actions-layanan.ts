"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ambilSesi } from "@/lib/sesi";

export type HasilLayanan = { galat?: string; ok?: string };

export async function kirimLayanan(_: HasilLayanan, data: FormData): Promise<HasilLayanan> {
  const parsed = z.object({
    jenis: z.enum(["kritik_saran", "kesehatan_mental", "konselor_sebaya"]),
    isi: z.string().trim().min(10).max(5000),
  }).safeParse(Object.fromEntries(data));
  if (!parsed.success) return { galat: "Isi pesan dengan minimal 10 karakter." };

  const { supabase, user } = await ambilSesi();
  const { error } = await supabase.from("layanan_masuk").insert({
    pengguna_id: user.id,
    jenis: parsed.data.jenis,
    isi: parsed.data.isi,
  });
  if (error) return { galat: "Pesan belum tersimpan. Periksa koneksi lalu coba lagi." };
  return { ok: "Pesan tersimpan." };
}

export async function ubahStatusLayanan(data: FormData): Promise<void> {
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["ditinjau", "selesai"]),
  }).safeParse(Object.fromEntries(data));
  if (!parsed.success) throw new Error("Status layanan tidak valid.");

  const { supabase } = await ambilSesi();
  const { data: hasil, error } = await supabase
    .from("layanan_masuk")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id")
    .single();
  if (error || !hasil) throw new Error("Status layanan tidak dapat diperbarui.");
  revalidatePath("/layanan");
  revalidatePath("/admin/layanan");
}
