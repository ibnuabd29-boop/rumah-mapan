"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { asalSitus, jalurAman } from "@/lib/umum";

export type Hasil = { galat?: string; ok?: string; nilai?: Record<string, string> };

// Mengembalikan isian (bukan kata sandi) supaya formulir yang direset React tidak mengosongkan email.
function isian(data: FormData, ...kunci: string[]) {
  return Object.fromEntries(kunci.map((k) => [k, String(data.get(k) ?? '')]));
}

const surel = z.string().trim().toLowerCase().email("Alamat email belum benar.");
const sandi = z.string().min(8, "Kata sandi minimal 8 karakter.").max(72, "Kata sandi maksimal 72 karakter.");

function pesanGalat(e: unknown, cadangan: string) {
  if (e instanceof z.ZodError) return e.issues[0]?.message ?? cadangan;
  return cadangan;
}

function terjemah(pesan: string, status?: number) {
  const m = pesan.toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("too many"))
    return "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.";
  if (m.includes("email not confirmed"))
    return "Verifikasi email aktif di Supabase. Harap nonaktifkan 'Confirm email' di Authentication -> Providers -> Email di dashboard Supabase.";
  if (m.includes("invalid login")) return "Email atau kata sandi salah.";
  if (m.includes("already registered")) return "Email ini sudah terdaftar. Coba masuk.";
  if (m.includes("password should contain") || m.includes("weak"))
    return "Kata sandi kurang kuat. Pakai huruf besar, huruf kecil, angka, dan simbol, minimal 8 karakter.";
  if (m.includes("password")) return "Kata sandi belum memenuhi syarat. Pakai minimal 8 karakter.";
  return "Permintaan belum berhasil. Coba lagi sebentar lagi.";
}

export async function masuk(_: Hasil, data: FormData): Promise<Hasil> {
  let tujuan = "/beranda";
  try {
    const { email, password } = z
      .object({ email: surel, password: z.string().min(1, "Isi kata sandi.") })
      .parse(Object.fromEntries(data));
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Jika terhalang konfirmasi email dan service role tersedia, otomatis verifikasi lalu coba masuk kembali
      if (
        error.message.toLowerCase().includes("email not confirmed") &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
      ) {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { persistSession: false } }
          );
          const { data: usersData } = await admin.auth.admin.listUsers();
          const target = usersData?.users.find((u) => u.email?.toLowerCase() === email);
          if (target) {
            await admin.auth.admin.updateUserById(target.id, { email_confirm: true });
            const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
            if (retryError) {
              return { galat: terjemah(retryError.message, retryError.status), nilai: isian(data, "email") };
            }
          } else {
            return { galat: terjemah(error.message, error.status), nilai: isian(data, "email") };
          }
        } catch {
          return { galat: terjemah(error.message, error.status), nilai: isian(data, "email") };
        }
      } else {
        return { galat: terjemah(error.message, error.status), nilai: isian(data, "email") };
      }
    }
    tujuan = jalurAman(data.get("next"));
  } catch (e) {
    return { galat: pesanGalat(e, "Periksa isian Anda."), nilai: isian(data, "email") };
  }
  redirect(tujuan);
}

export async function daftar(_: Hasil, data: FormData): Promise<Hasil> {
  let tujuan = "/beranda";
  try {
    const v = z
      .object({
        nama: z.string().trim().min(1, "Isi nama panggilan.").max(60, "Nama terlalu panjang."),
        email: surel,
        password: sandi,
        setuju: z.literal("on", { error: "Centang persetujuan privasi untuk melanjutkan." }),
      })
      .parse(Object.fromEntries(data));
    const supabase = await supabaseServer();
    const { data: res, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { nama: v.nama, privasi_setuju: "true" },
        emailRedirectTo: `${await asalSitus()}/auth/callback?next=${encodeURIComponent(jalurAman(data.get("next")))}`,
      },
    });
    if (error) return { galat: terjemah(error.message, error.status), nilai: isian(data, "nama", "email") };

    tujuan = jalurAman(data.get("next"));

    // Jika Supabase langsung membuat sesi (email confirmation nonaktif):
    if (!res?.session) {
      // Coba masuk langsung dengan email & password
      const { data: masukData, error: masukError } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });

      if (masukError) {
        // Jika terhalang konfirmasi email dan service role tersedia, otomatis verifikasi
        if (
          masukError.message.toLowerCase().includes("email not confirmed") &&
          process.env.SUPABASE_SERVICE_ROLE_KEY &&
          res?.user?.id
        ) {
          try {
            const { createClient } = await import("@supabase/supabase-js");
            const admin = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY,
              { auth: { persistSession: false } }
            );
            await admin.auth.admin.updateUserById(res.user.id, { email_confirm: true });
            const { error: ulangError } = await supabase.auth.signInWithPassword({
              email: v.email,
              password: v.password,
            });
            if (ulangError) {
              return { galat: terjemah(ulangError.message, ulangError.status), nilai: isian(data, "nama", "email") };
            }
          } catch {
            return {
              galat: "Akun dibuat, namun verifikasi email masih aktif di Supabase. Harap nonaktifkan 'Confirm email' di Authentication -> Providers -> Email di dashboard Supabase.",
              nilai: isian(data, "nama", "email"),
            };
          }
        } else {
          return { galat: terjemah(masukError.message, masukError.status), nilai: isian(data, "nama", "email") };
        }
      }
    }
  } catch (e) {
    return { galat: pesanGalat(e, "Periksa isian Anda."), nilai: isian(data, "nama", "email") };
  }
  redirect(tujuan);
}

export async function tautanMasuk(_: Hasil, data: FormData): Promise<Hasil> {
  try {
    const email = surel.parse(data.get("email"));
    const supabase = await supabaseServer();
    // shouldCreateUser dimatikan: akun baru wajib lewat formulir daftar yang memuat persetujuan privasi.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${await asalSitus()}/auth/callback?next=${encodeURIComponent(jalurAman(data.get("next")))}`,
      },
    });
    if (error && error.status === 429) return { galat: terjemah(error.message, 429) };
    return { ok: "Jika email itu terdaftar, tautan masuk sudah kami kirim. Periksa kotak masuk Anda." };
  } catch (e) {
    return { galat: pesanGalat(e, "Periksa isian Anda.") };
  }
}

export async function masukGoogle(data: FormData) {
  const supabase = await supabaseServer();
  const { data: hasil, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await asalSitus()}/auth/callback?next=${encodeURIComponent(jalurAman(data.get("next")))}`,
    },
  });
  if (error || !hasil.url) redirect("/masuk?galat=google");
  redirect(hasil.url);
}

export async function lupaSandi(_: Hasil, data: FormData): Promise<Hasil> {
  try {
    const email = surel.parse(data.get("email"));
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await asalSitus()}/auth/callback?next=/atur-sandi`,
    });
    if (error && error.status === 429) return { galat: terjemah(error.message, 429) };
    return { ok: "Jika email itu terdaftar, tautan untuk membuat kata sandi baru sudah kami kirim." };
  } catch (e) {
    return { galat: pesanGalat(e, "Periksa isian Anda.") };
  }
}

export async function aturSandi(_: Hasil, data: FormData): Promise<Hasil> {
  try {
    const v = z
      .object({ password: sandi, ulang: z.string() })
      .refine((x) => x.password === x.ulang, { message: "Kedua kata sandi harus sama.", path: ["ulang"] })
      .parse(Object.fromEntries(data));
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({ password: v.password });
    if (error) return { galat: terjemah(error.message, error.status) };
  } catch (e) {
    return { galat: pesanGalat(e, "Periksa isian Anda.") };
  }
  redirect("/beranda");
}

export async function keluar() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/masuk");
}

export async function keluarDariPerangkatLain(): Promise<Hasil> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return { galat: "Belum bisa mengeluarkan perangkat lain. Coba lagi." };
  return { ok: "Semua perangkat lain sudah dikeluarkan. Perangkat ini tetap masuk." };
}

