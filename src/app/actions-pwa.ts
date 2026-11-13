"use server";

import { z } from "zod";
import { endpointPushDiizinkan } from "@/lib/push";
import { ambilSesi } from "@/lib/sesi";

export type HasilPWA = { galat?: string; ok?: string };

const langgananPush = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
  waktuLokal: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  zonaWaktu: z.string().min(1).max(80),
});

function zonaWaktuValid(zona: string) {
  try {
    new Intl.DateTimeFormat("id-ID", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

export async function periksaLanggananPush(
  endpoint: string,
): Promise<{ aktif: boolean; waktuLokal?: string; zonaWaktu?: string; galat?: string }> {
  if (!endpointPushDiizinkan(endpoint)) return { aktif: false, galat: "Alamat notifikasi perangkat tidak valid." };
  const { supabase, user, rumah } = await ambilSesi();
  if (!rumah) return { aktif: false };
  const { data, error } = await supabase
    .from("pengingat_push")
    .select("id, waktu_lokal, zona_waktu")
    .eq("user_id", user.id)
    .eq("keluarga_id", rumah.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) return { aktif: false, galat: "Status pengingat belum bisa diperiksa. Coba muat ulang." };
  return {
    aktif: Boolean(data),
    waktuLokal: data?.waktu_lokal?.slice(0, 5),
    zonaWaktu: data?.zona_waktu,
  };
}

export async function simpanLanggananPush(input: unknown): Promise<HasilPWA> {
  const parsed = langgananPush.safeParse(input);
  if (!parsed.success) return { galat: "Data notifikasi perangkat tidak valid." };
  if (!endpointPushDiizinkan(parsed.data.endpoint)) {
    return { galat: "Penyedia notifikasi perangkat tidak didukung." };
  }
  if (!zonaWaktuValid(parsed.data.zonaWaktu)) {
    return { galat: "Zona waktu perangkat tidak valid." };
  }
  const { supabase, user, rumah } = await ambilSesi();
  if (!rumah) return { galat: "Gabung ke rumah terlebih dahulu untuk mengaktifkan pengingat." };
  const { data: admin, error: errorAdmin } = await supabase.rpc("is_admin");
  if (errorAdmin) return { galat: "Status akun belum bisa diperiksa. Coba lagi." };
  if (admin) return { galat: "Akun admin platform tidak dapat berlangganan pengingat keluarga." };

  const { error } = await supabase.from("pengingat_push").upsert(
    {
      user_id: user.id,
      keluarga_id: rumah.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      waktu_lokal: `${parsed.data.waktuLokal}:00`,
      zona_waktu: parsed.data.zonaWaktu,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { galat: "Pengingat belum tersimpan. Periksa koneksi lalu coba lagi." };
  return { ok: "Pengingat tantangan harian aktif di perangkat ini." };
}

export async function hapusLanggananPush(endpoint: string): Promise<HasilPWA> {
  if (!endpointPushDiizinkan(endpoint)) return { galat: "Alamat notifikasi perangkat tidak valid." };
  const { supabase, user } = await ambilSesi();
  const { error } = await supabase
    .from("pengingat_push")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) return { galat: "Pengingat belum berhasil dinonaktifkan. Coba lagi." };
  return { ok: "Pengingat tantangan harian dinonaktifkan." };
}
