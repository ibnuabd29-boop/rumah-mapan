import "server-only";
import { notFound } from "next/navigation";
import { ambilSesi } from "@/lib/sesi";

/** Dicek di server pada setiap permintaan halaman admin. Bukan admin: 404, bukan petunjuk bahwa halamannya ada. */
export async function perluAdmin() {
  const sesi = await ambilSesi();
  const { data } = await sesi.supabase.rpc("is_admin");
  if (data !== true) notFound();
  return sesi;
}

const waktu = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });
export const formatWaktu = (t: string | null) => (t ? waktu.format(new Date(t)) : "Belum pernah");

export function csvSel(nilai: unknown) {
  let s = nilai == null ? "" : String(nilai);
  // Sel yang diawali rumus tidak boleh dijalankan spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
