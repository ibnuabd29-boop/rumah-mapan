import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { driveSiap, tautanOtorisasi } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { asalSitus } from "@/lib/umum";

export async function GET(request: NextRequest) {
  const keluarga = request.nextUrl.searchParams.get("keluarga") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(keluarga)) return new NextResponse("Permintaan tidak valid.", { status: 400 });
  if (!driveSiap()) return new NextResponse("Penghubung Google Drive belum dikonfigurasi di server.", { status: 503 });

  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.redirect(new URL("/masuk", request.url));
  const { data: k } = await supabase.from("keluarga").select("pemilik_id").eq("id", keluarga).single();
  if (!k || k.pemilik_id !== u.user.id) return new NextResponse("Hanya pemilik rumah yang bisa menghubungkan Drive.", { status: 403 });

  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(tautanOtorisasi(keluarga, nonce, await asalSitus()));
  res.cookies.set("drive_state", nonce, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/drive" });
  return res;
}
