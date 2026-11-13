import { NextResponse, type NextRequest } from "next/server";
import { driveSiap, simpanKoneksi, simpanKoneksiAdmin } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { asalSitus } from "@/lib/umum";

export async function GET(request: NextRequest) {
  const asal = await asalSitus();
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const nonceCookie = request.cookies.get("drive_state")?.value;
  const bersihkan = (path: string) => {
    const r = NextResponse.redirect(`${asal}${path}`);
    r.cookies.delete({ name: "drive_state", path: "/api/drive" });
    return r;
  };
  const balik = (hasil: string) => {
    return bersihkan(`/keluarga?drive=${hasil}`);
  };
  const kode = request.nextUrl.searchParams.get("code");
  if (state.startsWith("admin.")) {
    const nonce = state.slice("admin.".length);
    if (!driveSiap() || !kode || !nonce || nonceCookie !== nonce) {
      return bersihkan("/admin/drive?drive=gagal");
    }

    const supabase = await supabaseServer();
    const { data: sesi } = await supabase.auth.getUser();
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error || !sesi.user || isAdmin !== true) return bersihkan("/admin/drive?drive=gagal");

    try {
      await simpanKoneksiAdmin(kode, asal, sesi.user.id);
      const { error: auditError } = await supabase.rpc("admin_catat_drive_terhubung");
      if (auditError) console.error("Koneksi Drive admin berhasil, tetapi audit gagal dicatat.", auditError);
    } catch (error) {
      console.error("Koneksi Drive admin gagal disimpan.", error);
      return bersihkan("/admin/drive?drive=gagal");
    }
    return bersihkan("/admin/drive?drive=ok");
  }

  const [keluarga, nonce] = state.split(".");
  if (!driveSiap() || !kode || !keluarga || !nonce || nonceCookie !== nonce) {
    return balik("gagal");
  }

  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  const { data: k } = await supabase.from("keluarga").select("pemilik_id").eq("id", keluarga).single();
  if (!u.user || !k || k.pemilik_id !== u.user.id) return balik("gagal");

  try {
    await simpanKoneksi(keluarga, kode, asal);
  } catch {
    return balik("gagal");
  }
  return balik("ok");
}
