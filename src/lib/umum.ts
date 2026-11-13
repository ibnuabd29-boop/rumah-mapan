/** Hanya menerima jalur relatif di situs ini, menolak "//host" dan "https://...". */
export function jalurAman(next: unknown, cadangan = "/beranda") {
  if (typeof next !== "string") return cadangan;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return cadangan;
  return next;
}

export const PERAN = [
  { nilai: "ayah", label: "Ayah" },
  { nilai: "ibu", label: "Ibu" },
  { nilai: "anak", label: "Anak" },
  { nilai: "wali", label: "Wali" },
  { nilai: "kakek_nenek", label: "Kakek atau nenek" },
  { nilai: "ortu_tunggal", label: "Orang tua tunggal" },
] as const;

export type Peran = (typeof PERAN)[number]["nilai"];

export function labelPeran(p: string) {
  return PERAN.find((x) => x.nilai === p)?.label ?? p;
}

export async function sha256Hex(teks: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenAcak() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function asalSitus() {
  const { headers } = await import("next/headers");
  const h = await headers();
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
