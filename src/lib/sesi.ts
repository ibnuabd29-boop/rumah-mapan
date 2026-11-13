import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";

export type Rumah = { id: string; nama: string; pemilik_id: string; peran: string };

/** Pengguna masuk + profil + rumah pertama. Dicek di server pada setiap halaman, bukan hanya di proxy. */
export const ambilSesi = cache(async (opsi: { perluSetuju?: boolean } = {}) => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/masuk");

  const { data: profil } = await supabase
    .from("profiles")
    .select("id, nama, privasi_disetujui_at")
    .eq("id", data.user.id)
    .single();
  if (!profil) redirect("/masuk?galat=tautan");
  if (opsi.perluSetuju !== false && !profil.privasi_disetujui_at) redirect("/setuju");

  const { data: baris } = await supabase
    .from("anggota")
    .select("peran, keluarga:keluarga_id (id, nama, pemilik_id)")
    .eq("user_id", data.user.id)
    .order("bergabung_at", { ascending: true })
    .limit(1);
  const k = baris?.[0]?.keluarga as unknown as { id: string; nama: string; pemilik_id: string } | undefined;
  const rumah: Rumah | null = k ? { ...k, peran: baris![0].peran } : null;
  return { supabase, user: data.user, profil, rumah };
});
