import { NextResponse, type NextRequest } from "next/server";
import { ambilFoto, tautanSah } from "@/lib/drive";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/bukti/[id]/berkas">) {
  const { id } = await ctx.params;
  const sp = request.nextUrl.searchParams;
  if (!tautanSah(id, sp.get("exp"), sp.get("sig"))) {
    return new NextResponse("Tautan kedaluwarsa. Muat ulang halaman.", { status: 403 });
  }

  // RLS: baris hanya terbaca bila pengguna anggota rumah pemilik bukti. Admin lewat fungsi yang mencatat audit.
  const supabase = await supabaseServer();
  const { data: baris } = await supabase
    .from("bukti")
    .select("keluarga_id, drive_file_id, status")
    .eq("id", id)
    .maybeSingle();
  let data = baris;
  if (!data) {
    const { data: a } = await supabase.rpc("admin_berkas_bukti", { p_bukti: id });
    data = a?.[0] ?? null;
  }
  if (!data?.drive_file_id) return new NextResponse("Tidak ditemukan.", { status: 404 });

  const res = await ambilFoto(data.keluarga_id, data.drive_file_id).catch(() => null);
  if (!res || !res.ok || !res.body) return new NextResponse("Foto belum bisa dimuat.", { status: 502 });
  return new NextResponse(res.body, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
