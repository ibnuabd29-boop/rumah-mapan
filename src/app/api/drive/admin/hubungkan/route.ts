import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { driveSiap, tautanOtorisasi } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";
import { asalSitus } from "@/lib/umum";

export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: sesi } = await supabase.auth.getUser();
  if (!sesi.user) {
    const masuk = new URL("/masuk", request.url);
    masuk.searchParams.set("next", "/admin/drive");
    return NextResponse.redirect(masuk);
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error) return new NextResponse("Hak admin belum bisa diperiksa.", { status: 500 });
  if (isAdmin !== true) return new NextResponse("Tidak ditemukan.", { status: 404 });
  if (!driveSiap()) return new NextResponse("Google Drive admin belum dikonfigurasi di server.", { status: 503 });

  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(tautanOtorisasi("admin", nonce, await asalSitus()));
  res.cookies.set("drive_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/drive",
  });
  return res;
}
