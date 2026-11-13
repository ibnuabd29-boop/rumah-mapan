"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { PERAN, asalSitus, sha256Hex, tokenAcak } from "@/lib/umum";

export type HasilK = { galat?: string; ok?: string; tautan?: string };

const peranEnum = z.enum(PERAN.map((p) => p.nilai) as [string, ...string[]], { error: "Pilih peran." });

const GALAT_RPC: Record<string, string> = {
  perlu_masuk: "Sesi Anda berakhir. Masuk lagi.",
  pemilik_harus_dewasa: "Pemilik rumah harus orang dewasa. Pilih peran selain anak.",
  nama_terlalu_pendek: "Nama rumah minimal 2 huruf.",
  batas_keluarga: "Satu akun bisa memiliki paling banyak 3 rumah.",
  bukan_pemilik: "Hanya pemilik rumah yang bisa melakukan ini.",
  perlu_persetujuan_ortu: "Undangan untuk anak perlu persetujuan orang tua. Centang kotak persetujuan.",
  undangan_tidak_ada: "Undangan tidak ditemukan. Minta tautan baru ke pemilik rumah.",
  undangan_terpakai: "Undangan ini sudah dipakai. Minta tautan baru ke pemilik rumah.",
  undangan_kedaluwarsa: "Undangan ini sudah kedaluwarsa. Minta tautan baru ke pemilik rumah.",
  sudah_anggota: "Anda sudah menjadi anggota rumah ini.",
  tgl_lahir_wajib: "Isi tanggal lahir yang benar.",
  masih_pemilik: "Anda masih memiliki rumah. Hapus rumah itu dulu, lalu hapus akun.",
};

function galatRpc(message: string) {
  const kode = Object.keys(GALAT_RPC).find((k) => message.includes(k));
  return kode ? GALAT_RPC[kode] : "Permintaan belum berhasil. Coba lagi sebentar lagi.";
}

function galatZod(e: unknown) {
  return e instanceof z.ZodError ? (e.issues[0]?.message ?? "Periksa isian Anda.") : "Periksa isian Anda.";
}

export async function setujuPrivasi() {
  const supabase = await supabaseServer();
  await supabase.rpc("setuju_privasi");
  redirect("/beranda");
}

export async function buatKeluarga(_: HasilK, data: FormData): Promise<HasilK> {
  try {
    const v = z
      .object({
        nama: z.string().trim().min(2, "Nama rumah minimal 2 huruf.").max(60, "Nama rumah terlalu panjang."),
        peran: peranEnum,
      })
      .parse(Object.fromEntries(data));
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc("buat_keluarga", { p_nama: v.nama, p_peran: v.peran });
    if (error) return { galat: galatRpc(error.message) };
  } catch (e) {
    return { galat: galatZod(e) };
  }
  revalidatePath("/", "layout");
  redirect("/keluarga");
}

export async function buatUndangan(_: HasilK, data: FormData): Promise<HasilK> {
  try {
    const v = z
      .object({ keluarga_id: z.string().uuid(), peran: peranEnum })
      .parse(Object.fromEntries(data));
    const persetujuan = data.get("persetujuan") === "on";
    const token = tokenAcak();
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc("buat_undangan", {
      p_keluarga: v.keluarga_id,
      p_peran: v.peran,
      p_token_hash: await sha256Hex(token),
      p_persetujuan: persetujuan,
    });
    if (error) return { galat: galatRpc(error.message) };
    revalidatePath("/keluarga");
    return {
      ok: "Tautan dibuat. Salin dan kirim sekarang: tautan ini hanya tampil sekali, berlaku 7 hari, dan hanya bisa dipakai satu orang.",
      tautan: `${await asalSitus()}/undangan/${token}`,
    };
  } catch (e) {
    return { galat: galatZod(e) };
  }
}

export async function batalkanUndangan(data: FormData) {
  const id = z.string().uuid().safeParse(data.get("id"));
  if (!id.success) return;
  const supabase = await supabaseServer();
  await supabase.from("undangan").delete().eq("id", id.data);
  revalidatePath("/keluarga");
}

export async function keluarkanAnggota(data: FormData) {
  const v = z
    .object({ keluarga_id: z.string().uuid(), user_id: z.string().uuid() })
    .safeParse(Object.fromEntries(data));
  if (!v.success) return;
  const supabase = await supabaseServer();
  await supabase.from("anggota").delete().eq("keluarga_id", v.data.keluarga_id).eq("user_id", v.data.user_id);
  revalidatePath("/", "layout");
}

export async function hapusKeluarga(_: HasilK, data: FormData): Promise<HasilK> {
  try {
    const v = z
      .object({ keluarga_id: z.string().uuid(), nama: z.string(), konfirmasi: z.string() })
      .parse(Object.fromEntries(data));
    if (v.konfirmasi.trim() !== v.nama) return { galat: "Nama rumah yang Anda ketik tidak sama." };
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc("hapus_keluarga", { p_keluarga: v.keluarga_id });
    if (error) return { galat: galatRpc(error.message) };
  } catch (e) {
    return { galat: galatZod(e) };
  }
  revalidatePath("/", "layout");
  redirect("/beranda");
}

export async function terimaUndangan(_: HasilK, data: FormData): Promise<HasilK> {
  try {
    const v = z
      .object({ token: z.string().regex(/^[0-9a-f]{64}$/, "Tautan undangan tidak valid."), tgl_lahir: z.string() })
      .parse(Object.fromEntries(data));
    const supabase = await supabaseServer();
    const { error } = await supabase.rpc("terima_undangan", {
      p_token_hash: await sha256Hex(v.token),
      p_tgl_lahir: v.tgl_lahir || null,
    });
    if (error) return { galat: galatRpc(error.message) };
  } catch (e) {
    return { galat: galatZod(e) };
  }
  revalidatePath("/", "layout");
  redirect("/beranda");
}

export async function ubahNama(_: HasilK, data: FormData): Promise<HasilK> {
  try {
    const nama = z.string().trim().min(1, "Isi nama panggilan.").max(60, "Nama terlalu panjang.").parse(data.get("nama"));
    const supabase = await supabaseServer();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { galat: GALAT_RPC.perlu_masuk };
    const { error } = await supabase.from("profiles").update({ nama }).eq("id", u.user.id);
    if (error) return { galat: "Nama belum tersimpan. Coba lagi." };
    revalidatePath("/", "layout");
    return { ok: "Nama sudah diubah." };
  } catch (e) {
    return { galat: galatZod(e) };
  }
}

export async function hapusAkun(_: HasilK, data: FormData): Promise<HasilK> {
  if (data.get("konfirmasi") !== "HAPUS") return { galat: "Ketik HAPUS dengan huruf besar untuk melanjutkan." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("hapus_akun");
  if (error) return { galat: galatRpc(error.message) };
  await supabase.auth.signOut();
  redirect("/masuk");
}
