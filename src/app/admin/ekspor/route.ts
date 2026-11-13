import { NextResponse, type NextRequest } from "next/server";
import { csvSel } from "@/lib/admin";
import { labelKategori } from "@/lib/tantangan";
import { PERAN, labelPeran } from "@/lib/umum";
import { supabaseServer } from "@/lib/supabase/server";

// Hanya angka progres. Isi catatan tidak pernah ada di data yang bisa diakses admin.
export async function GET(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  const { data: admin } = u.user ? await supabase.rpc("is_admin") : { data: false };
  if (admin !== true) return new NextResponse("Tidak ditemukan.", { status: 404 });

  const sp = request.nextUrl.searchParams;
  const peran = PERAN.some((p) => p.nilai === sp.get("peran")) ? sp.get("peran") : null;
  const aktif = ["aktif", "tidak"].includes(sp.get("aktif") ?? "") ? sp.get("aktif") : null;
  const { data, error } = await supabase.rpc("admin_daftar_user", {
    p_cari: (sp.get("q") ?? "").slice(0, 60) || null,
    p_peran: peran,
    p_aktif: aktif,
  });
  if (error) return new NextResponse("Ekspor gagal.", { status: 500 });

  const baris = (data ?? []) as Record<string, string | number | null>[];
  await supabase.rpc("admin_catat_ekspor", { p_baris: baris.length });
  const kepala = ["nama", "email", "peran", "keluarga", "poin", "tantangan_selesai", "hari_beruntun", "kategori_terbanyak", "terakhir_aktif"];
  const isi = baris.map((r) =>
    [r.nama, r.email, labelPeran(String(r.peran)), r.keluarga, r.poin, r.selesai, r.hari_beruntun,
      r.kategori_terbanyak ? labelKategori(String(r.kategori_terbanyak)) : "", r.aktif_terakhir ?? ""]
      .map(csvSel).join(","),
  );
  const tanggal = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  return new NextResponse("\uFEFF" + [kepala.join(","), ...isi].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="progres-rumah-mapan-${tanggal}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
