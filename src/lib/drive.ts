import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
export const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive.file";

export class DriveTerputus extends Error {}

export function driveSiap() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.DRIVE_ENC_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// Klien service role hanya dipakai di server untuk tabel drive_koneksi, yang tertutup bagi klien.
function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

function kunci() {
  const k = Buffer.from(process.env.DRIVE_ENC_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("DRIVE_ENC_KEY harus 32 byte dalam base64.");
  return k;
}

export function enkripsi(teks: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kunci(), iv);
  const isi = Buffer.concat([c.update(teks, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), isi].map((b) => b.toString("base64")).join(".");
}

export function dekripsi(nilai: string) {
  const [iv, tag, isi] = nilai.split(".").map((x) => Buffer.from(x, "base64"));
  const d = createDecipheriv("aes-256-gcm", kunci(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(isi), d.final()]).toString("utf8");
}

/** Tautan berkas bertanda tangan, berlaku 5 menit. Server tetap mengecek sesi dan keanggotaan. */
export function tautanBerkas(idBukti: string) {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const sig = tandatangani(`${idBukti}.${exp}`);
  return `/api/bukti/${idBukti}/berkas?exp=${exp}&sig=${sig}`;
}

function tandatangani(isi: string) {
  return createHmac("sha256", kunci()).update(isi).digest("hex");
}

export function tautanSah(idBukti: string, exp: string | null, sig: string | null) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const benar = Buffer.from(tandatangani(`${idBukti}.${exp}`));
  const uji = Buffer.from(sig);
  return benar.length === uji.length && timingSafeEqual(benar, uji);
}

export function tautanOtorisasi(keluargaId: string, nonce: string, asal: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${asal}/api/drive/callback`,
    response_type: "code",
    scope: SCOPE_DRIVE,
    access_type: "offline",
    prompt: "consent",
    state: `${keluargaId}.${nonce}`,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function simpanKoneksi(keluargaId: string, kode: string, asal: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: kode,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${asal}/api/drive/callback`,
      grant_type: "authorization_code",
    }),
  });
  const token = await res.json();
  if (!res.ok || !token.refresh_token) throw new Error("Google tidak mengembalikan refresh token.");

  // Aplikasi membuat foldernya sendiri: scope drive.file tidak bisa melihat folder lain di Drive pemilik.
  const folder = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Rumah Mapan", mimeType: "application/vnd.google-apps.folder" }),
  }).then((r) => r.json());
  if (!folder.id) throw new Error("Folder Drive gagal dibuat.");

  const { error } = await admin()
    .from("drive_koneksi")
    .upsert({
      keluarga_id: keluargaId,
      refresh_token_enc: enkripsi(token.refresh_token),
      folder_id: folder.id,
      status: "tersambung",
      diperbarui_at: new Date().toISOString(),
    });
  if (error) throw new Error("Koneksi Drive gagal disimpan.");
}

async function akses(keluargaId: string) {
  const db = admin();
  const { data } = await db.from("drive_koneksi").select("*").eq("keluarga_id", keluargaId).single();
  if (!data || data.status !== "tersambung") throw new DriveTerputus("Drive belum tersambung.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: dekripsi(data.refresh_token_enc),
      grant_type: "refresh_token",
    }),
  });
  const token = await res.json();
  if (!res.ok) {
    // Token dicabut pemilik: tandai terputus supaya dashboard memberi tahu, bukan gagal diam-diam.
    if (token.error === "invalid_grant") {
      await db.from("drive_koneksi").update({ status: "terputus" }).eq("keluarga_id", keluargaId);
      throw new DriveTerputus("Akses Drive dicabut.");
    }
    throw new Error("Gagal memperbarui akses Drive.");
  }
  return { token: token.access_token as string, folder: data.folder_id as string };
}

export async function unggahFoto(keluargaId: string, nama: string, isi: Buffer) {
  const { token, folder } = await akses(keluargaId);
  const batas = `mapan${randomBytes(8).toString("hex")}`;
  const meta = JSON.stringify({ name: nama, parents: [folder] });
  const body = Buffer.concat([
    Buffer.from(`--${batas}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${batas}\r\nContent-Type: image/jpeg\r\n\r\n`),
    isi,
    Buffer.from(`\r\n--${batas}--`),
  ]);
  const res = await fetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${batas}` },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.id) throw new Error("Unggah ke Drive gagal.");
  return json.id as string;
}

export async function ambilFoto(keluargaId: string, fileId: string) {
  const { token } = await akses(keluargaId);
  return fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function hapusBerkasDrive(keluargaId: string, fileId: string) {
  const { token } = await akses(keluargaId);
  await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
