import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RINGKASAN_KOSONG, type Ringkasan } from "@/lib/tantangan";

export const hariIniWib = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

export async function ambilRingkasan(supabase: SupabaseClient, keluargaId: string): Promise<Ringkasan> {
  const { data } = await supabase.rpc("ringkasan_keluarga", { p_keluarga: keluargaId });
  return { ...RINGKASAN_KOSONG, ...(data ?? {}) };
}

const tgl = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "UTC" });
/** Kolom date dari Postgres (YYYY-MM-DD) diformat tanpa pergeseran zona waktu. */
export const formatTanggal = (d: string) => tgl.format(new Date(`${d}T00:00:00Z`));
