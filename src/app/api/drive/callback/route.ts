import { NextResponse, type NextRequest } from "next/server";
import { driveSiap, simpanKoneksi } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { asalSitus } from "@/lib/umum";

export async function GET(request: NextRequest) {
  const asal = await asalSitus();
  const balik = (hasil: string) => {
    const r = NextResponse.redirect(`${asal}/keluarga?drive=${hasil}`);
    r.cookies.delete({ name: "drive_state", path: "/api/drive" });
    return r;
  };
  const kode = request.nextUrl.searchParams.get("code");
  const [keluarga, nonce] = (request.nextUrl.searchParams.get("state") ?? "").split(".");
  if (!driveSiap() || !kode || !keluarga || !nonce || request.cookies.get("drive_state")?.value !== nonce) {
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
