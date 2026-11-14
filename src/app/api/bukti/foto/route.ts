import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DriveTerputus, hapusBerkasDrive, unggahFotoAdmin } from "@/lib/drive";
import { galatTantangan } from "@/lib/galat";
import { supabaseServer } from "@/lib/supabase/server";

const MAKS = 2 * 1024 * 1024;

// `ulang` memberi tahu antrean klien apakah kiriman layak dicoba lagi (jaringan, Drive) atau tidak (ditolak aturan).
const galat = (pesan: string, status: number, ulang: boolean) =>
  NextResponse.json({ galat: pesan, ulang }, { status });

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return galat("Sesi berakhir. Masuk lagi.", 401, false);

  const form = await request.formData().catch(() => null);
  const v = z
    .object({
      keluarga_id: z.string().uuid(),
      anak_id: z.string().uuid().optional(),
      slug: z.string().min(1).max(80),
      teks: z.string().max(2000).optional(),
    })
    .safeParse(form ? Object.fromEntries(form) : {});
  const berkas = form?.get("berkas");
  if (!v.success || !(berkas instanceof File)) return galat("Permintaan tidak lengkap.", 400, false);
  if (berkas.type !== "image/jpeg") return galat("Foto harus berformat JPEG.", 415, false);
  if (berkas.size > MAKS) return galat("Foto terlalu besar. Maksimal 2 MB setelah dikompres.", 413, false);

  const { data: status, error: statusError } = await supabase.rpc("status_drive_pusat", {
    p_keluarga: v.data.keluarga_id,
  });
  if (statusError) return galat("Status Drive admin belum bisa diperiksa. Coba lagi nanti.", 503, true);
  if (status !== "tersambung") {
    return galat(
      status === "terputus"
        ? "Google Drive admin terputus. Minta admin platform menghubungkannya kembali."
        : "Admin platform belum menghubungkan folder Google Drive.",
      503,
      true,
    );
  }

  const isi = Buffer.from(await berkas.arrayBuffer());
  if (isi.length < 3 || isi[0] !== 0xff || isi[1] !== 0xd8 || isi[2] !== 0xff) {
    return galat("Berkas bukan foto JPEG yang valid.", 415, false);
  }
  const hash = createHash("sha256").update(isi).digest("hex");
  let fileId: string;
  try {
    fileId = await unggahFotoAdmin(`${v.data.slug}-${hash.slice(0, 10)}.jpg`, isi);
  } catch (e) {
    return galat(
      e instanceof DriveTerputus
        ? "Google Drive admin terputus. Foto akan dicoba lagi setelah admin menghubungkannya."
        : "Unggah ke folder Google Drive admin gagal. Akan dicoba lagi.",
      502,
      true,
    );
  }

  const { error } = await supabase.rpc("kirim_bukti", {
    p_keluarga: v.data.keluarga_id,
    p_tantangan: v.data.slug,
    p_jenis: "foto",
    p_teks: v.data.teks?.trim() || null,
    p_hash: hash,
    p_drive_file_id: fileId,
    p_drive_sumber: "admin",
    p_anak: v.data.anak_id ?? null,
  });
  if (error) {
    try {
      await hapusBerkasDrive(v.data.keluarga_id, fileId, "admin");
    } catch (cleanupError) {
      console.error("Foto gagal dibersihkan setelah bukti ditolak.", cleanupError);
    }
    return galat(galatTantangan(error.message), 422, false);
  }
  return NextResponse.json({ ok: true });
}
