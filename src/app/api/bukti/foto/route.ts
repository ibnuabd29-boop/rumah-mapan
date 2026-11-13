import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DriveTerputus, hapusBerkasDrive, unggahFoto } from "@/lib/drive";
import { galatTantangan } from "@/lib/galat";
import { supabaseServer } from "@/lib/supabase/server";

const MAKS = 3 * 1024 * 1024;

// `ulang` memberi tahu antrean klien apakah kiriman layak dicoba lagi (jaringan, Drive) atau tidak (ditolak aturan).
const galat = (pesan: string, status: number, ulang: boolean) =>
  NextResponse.json({ galat: pesan, ulang }, { status });

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return galat("Sesi berakhir. Masuk lagi.", 401, false);

  const form = await request.formData().catch(() => null);
  const v = z
    .object({ keluarga_id: z.string().uuid(), slug: z.string().min(1).max(80), teks: z.string().max(2000).optional() })
    .safeParse(form ? Object.fromEntries(form) : {});
  const berkas = form?.get("berkas");
  if (!v.success || !(berkas instanceof File)) return galat("Permintaan tidak lengkap.", 400, false);
  if (berkas.type !== "image/jpeg") return galat("Foto harus berformat JPEG.", 415, false);
  if (berkas.size > MAKS) return galat("Foto terlalu besar. Maksimal 3 MB setelah dikompres.", 413, false);

  const { data: status } = await supabase.rpc("status_drive", { p_keluarga: v.data.keluarga_id });
  if (status !== "tersambung") {
    return galat(
      status === "terputus"
        ? "Google Drive terputus. Minta pemilik rumah menghubungkannya lagi."
        : "Pemilik rumah belum menghubungkan Google Drive.",
      409,
      status === "terputus",
    );
  }

  const isi = Buffer.from(await berkas.arrayBuffer());
  const hash = createHash("sha256").update(isi).digest("hex");
  let fileId: string;
  try {
    fileId = await unggahFoto(v.data.keluarga_id, `${v.data.slug}-${hash.slice(0, 10)}.jpg`, isi);
  } catch (e) {
    return galat(e instanceof DriveTerputus ? "Google Drive terputus." : "Unggah ke Drive gagal. Akan dicoba lagi.", 502, true);
  }

  const { error } = await supabase.rpc("kirim_bukti", {
    p_keluarga: v.data.keluarga_id,
    p_tantangan: v.data.slug,
    p_jenis: "foto",
    p_teks: v.data.teks?.trim() || null,
    p_hash: hash,
    p_drive_file_id: fileId,
  });
  if (error) {
    // Bukti ditolak aturan: jangan tinggalkan berkas yatim di Drive pemilik.
    await hapusBerkasDrive(v.data.keluarga_id, fileId).catch(() => {});
    return galat(galatTantangan(error.message), 422, false);
  }
  return NextResponse.json({ ok: true });
}
