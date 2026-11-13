// Uji dashboard admin terhadap Supabase asli. Butuh akun admin tetap: pengelola.uji@example.com
// (peran admin diberikan lewat SQL) dan Confirm email dimatikan sementara untuk akun uji baru.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://ileveqgfwponrencujul.supabase.co";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_VEq89aQbQHT5rL3sQ-icGg_6jTCtoJu";
const id = Date.now().toString(36);
const SANDI = "Ujicoba#12345";
const admin = { email: "pengelola.uji@example.com" };
const ayah = { nama: "Ayah Admin Uji", email: `ayah.${id}@example.com` };
const anak = { nama: "Anak Admin Uji", email: `anak.${id}@example.com` };
const RUMAH = `Rumah Uji ${id}`;
const ok = (n) => console.log(`PASS ${n}`);

const browser = await chromium.launch();
const konsol = [];
async function baru(nama) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
  page.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && konsol.push(`${nama}: ${m.text()}`));
  page.on("pageerror", (e) => konsol.push(`${nama}: ${e.message}`));
  return page;
}
const [pAdmin, pAyah, pAnak] = [await baru("admin"), await baru("ayah"), await baru("anak")];
const klik = (p, nama, exact = true) => p.getByRole("button", { name: nama, exact }).click();
const tidakAdaHalaman = async (p, url) => {
  const r = await p.goto(`${BASE}${url}`);
  assert.equal(r.status(), 404, `${url} harus 404`);
};
const tidakMeluap = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

async function daftar(p, u) {
  await p.goto(`${BASE}/daftar`);
  await p.fill("#nama", u.nama); await p.fill("#email", u.email); await p.fill("#password", SANDI);
  await p.check("#setuju");
  await klik(p, "Buat akun");
  await p.waitForSelector("p[role=status],p[role=alert]");
  const t = await p.locator("p[role=status],p[role=alert]").first().innerText();
  assert.match(t, /Berhasil/, t);
}

try {
  // Persiapan data: rumah, anak bergabung, satu bukti disetujui, satu menunggu
  await daftar(pAyah, ayah);
  await pAyah.goto(`${BASE}/beranda`);
  await pAyah.fill("#nama", RUMAH); await pAyah.selectOption("#peran", "ayah");
  await klik(pAyah, "Buat rumah"); await pAyah.waitForURL("**/keluarga");
  await pAyah.selectOption("#peran-undangan", "anak"); await pAyah.check("#persetujuan");
  await klik(pAyah, "Buat tautan undangan"); await pAyah.waitForSelector("#tautan-undangan");
  const tautan = (await pAyah.inputValue("#tautan-undangan")).replace(/^https?:\/\/[^/]+/, BASE);
  await daftar(pAnak, anak);
  await pAnak.goto(tautan); await pAnak.fill("#tgl_lahir", "2016-05-01");
  await klik(pAnak, "Gabung ke rumah ini"); await pAnak.waitForURL("**/beranda");

  const kirim = async (slug, teks) => {
    await pAnak.goto(`${BASE}/tantangan/${slug}`);
    await pAnak.fill("#teks", teks);
    await klik(pAnak, "Kirim bukti");
    await pAnak.waitForSelector('[role=status]:has-text("Bukti terkirim")');
  };
  await kirim("tiga-pujian", "Kami saling memuji dua orang lain dengan hal yang mereka lakukan hari ini");
  await pAyah.goto(`${BASE}/bukti`);
  await pAyah.waitForSelector("text=Menunggu penilaian (1)");
  await klik(pAyah, "Setujui");
  await pAyah.waitForSelector("text=Disetujui, +10 poin");
  await kirim("masak-bersama", "Kami memasak nasi goreng bertiga dan anak mengiris sayurnya sendiri");
  ok("persiapan: rumah, anak, satu bukti disetujui dan satu menunggu");

  // Akses ditolak untuk yang bukan admin
  await tidakAdaHalaman(pAnak, "/admin");
  await tidakAdaHalaman(pAnak, "/admin/bukti");
  await tidakAdaHalaman(pAyah, "/admin/keluarga");
  await tidakAdaHalaman(pAyah, "/admin/audit");
  await tidakAdaHalaman(pAnak, "/admin/ekspor");
  const rAnon = await (await browser.newContext()).request.get(`${BASE}/admin`, { maxRedirects: 0 });
  assert.ok([307, 308].includes(rAnon.status()), `anon status ${rAnon.status()}`);
  assert.match(rAnon.headers().location, /\/masuk/);
  assert.equal(await pAyah.getByRole("link", { name: "Buka dashboard admin" }).count(), 0);
  await pAyah.goto(`${BASE}/akun`);
  assert.equal(await pAyah.getByText("Buka dashboard admin").count(), 0);
  ok("anak dan orang tua mendapat 404 di semua halaman /admin dan /admin/ekspor, tamu diarahkan masuk, tautan admin tidak tampil");

  // Admin
  await pAdmin.goto(`${BASE}/masuk`);
  await pAdmin.fill("#email", admin.email); await pAdmin.fill("#password", SANDI);
  await klik(pAdmin, "Masuk");
  await pAdmin.waitForURL("**/beranda");
  await pAdmin.goto(`${BASE}/akun`);
  await pAdmin.getByRole("link", { name: "Buka dashboard admin" }).click();
  await pAdmin.waitForURL("**/admin");
  await pAdmin.waitForSelector("text=Ringkasan platform");
  const ring = await pAdmin.locator("dl").innerText();
  assert.match(ring, /Keluarga/); assert.match(ring, /Bukti menunggu tinjauan/);
  ok("admin membuka dashboard dari menu Akun dan melihat ringkasan");

  await pAdmin.getByRole("link", { name: "Progres", exact: true }).click();
  await pAdmin.waitForURL("**/admin/progres");
  await pAdmin.getByRole("heading", { name: "Progres keluarga" }).waitFor();
  await pAdmin.getByText("Tantangan disetujui", { exact: true }).waitFor();
  await pAdmin.getByRole("link", { name: RUMAH }).click();
  await pAdmin.getByRole("heading", { name: RUMAH }).waitFor();
  ok("menu progres membuka progres keluarga dan tautan membuka rinciannya");

  // Keluarga
  await pAdmin.goto(`${BASE}/admin/keluarga?q=${encodeURIComponent(RUMAH)}`);
  await pAdmin.waitForSelector(`text=${RUMAH}`);
  assert.equal(await pAdmin.locator("tbody tr").count(), 1);
  await pAdmin.getByRole("link", { name: RUMAH }).click();
  await pAdmin.waitForSelector("text=Anggota");
  const detail = await pAdmin.locator("main").innerText();
  assert.match(detail, /Ayah Admin Uji/); assert.match(detail, /Anak Admin Uji/);
  assert.match(detail, /10\s*poin/);
  assert.match(detail, /Langkah pertama, terbuka/);
  assert.match(detail, /Seminggu beruntun, terkunci/);
  assert.match(detail, /Catatan harian anak tidak tersedia untuk admin/);
  ok("pencarian keluarga dan halaman detail (anggota, poin, lencana, riwayat) benar");
  const idKeluarga = pAdmin.url().split("/").pop();

  // Pengguna + CSV
  await pAdmin.goto(`${BASE}/admin/pengguna?peran=anak&q=${id}`);
  await pAdmin.waitForSelector(`text=${anak.email}`);
  assert.equal(await pAdmin.locator("tbody tr").count(), 1);
  const baris = await pAdmin.locator("tbody tr").innerText();
  assert.match(baris, /10/);
  await pAdmin.goto(`${BASE}/admin/pengguna?aktif=aktif&q=${id}`);
  await pAdmin.waitForSelector("tbody tr");
  assert.ok((await pAdmin.locator("tbody tr").count()) >= 1);
  const csv = await pAdmin.request.get(`${BASE}/admin/ekspor?q=${id}`);
  assert.equal(csv.status(), 200);
  assert.match(csv.headers()["content-type"], /text\/csv/);
  const isiCsv = await csv.text();
  assert.match(isiCsv, new RegExp(anak.email));
  assert.match(isiCsv.split("\r\n")[0], /nama,email,peran,keluarga,poin/);
  assert.doesNotMatch(isiCsv.split("\r\n")[0], /catatan/i);
  ok("filter pengguna (peran, aktif) benar dan CSV berisi progres tanpa kolom catatan");

  // Galeri bukti + tindakan
  await pAdmin.goto(`${BASE}/admin/bukti?keluarga=${idKeluarga}&status=menunggu`);
  await pAdmin.waitForSelector("text=Masak bersama");
  const kartu = pAdmin.locator("li", { hasText: "Masak bersama" });
  await kartu.getByRole("button", { name: "Tandai tidak pantas" }).click();
  await pAdmin.waitForSelector('[role=alert]:has-text("alasan")');
  ok("menandai tanpa alasan ditolak");
  await kartu.locator('input[name="alasan"]').fill("Cerita memuat nama lengkap dan alamat rumah");
  await kartu.getByRole("button", { name: "Tandai tidak pantas" }).click();
  // Setelah berhasil, kartu keluar dari daftar berfilter "menunggu".
  await kartu.waitFor({ state: "detached" });
  await pAdmin.goto(`${BASE}/admin/bukti?keluarga=${idKeluarga}&status=ditandai`);
  await pAdmin.waitForSelector("text=Masak bersama");
  ok("admin menandai bukti dengan alasan, bukti muncul di filter Ditandai admin");

  await pAnak.goto(`${BASE}/bukti`);
  await pAnak.waitForSelector("text=Ditandai admin");
  await pAnak.waitForSelector("text=Alasan: Cerita memuat nama lengkap");
  ok("pengirim melihat status ditandai dan alasannya");

  // Admin menyetujui bukti yang tadi ditandai: poin berubah
  await pAdmin.goto(`${BASE}/admin/bukti?keluarga=${idKeluarga}&status=ditandai`);
  const ditandai = pAdmin.locator("li", { hasText: "Masak bersama" });
  await ditandai.getByRole("button", { name: "Setujui" }).click();
  await ditandai.waitFor({ state: "detached" });
  await pAdmin.goto(`${BASE}/admin/keluarga/${idKeluarga}`);
  await pAdmin.waitForSelector("text=Anggota");
  assert.match(await pAdmin.locator("main").innerText(), /30\s*poin/);
  await pAdmin.goto(`${BASE}/admin/bukti?keluarga=${idKeluarga}&status=disetujui`);
  const disetujui = pAdmin.locator("li", { hasText: "Masak bersama" });
  await disetujui.locator('input[name="alasan"]').fill("Dibatalkan karena bukti dobel");
  await disetujui.getByRole("button", { name: "Tolak" }).click();
  await disetujui.waitFor({ state: "detached" });
  await pAdmin.goto(`${BASE}/admin/keluarga/${idKeluarga}`);
  await pAdmin.waitForSelector("text=Anggota");
  assert.match(await pAdmin.locator("main").innerText(), /10\s*poin/);
  ok("poin keluarga ikut berubah: setuju menambah 20, tolak mengurangi lagi");

  // Audit
  await pAdmin.goto(`${BASE}/admin/audit`);
  await pAdmin.waitForSelector("tbody tr");
  const audit = await pAdmin.locator("tbody").innerText();
  for (const a of ["Melihat ringkasan platform", "Membuka detail keluarga", "Mengubah status bukti", "Mengunduh CSV progres", "Melihat daftar pengguna"]) {
    assert.match(audit, new RegExp(a), a);
  }
  assert.match(audit, /Pengelola Uji/);
  ok("log audit memuat siapa, kapan, dan apa untuk semua aksi admin di atas");

  // RLS langsung dengan token admin: admin tidak membaca tabel secara langsung
  const tok = await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: admin.email, password: SANDI }),
  })).json();
  const rest = async (tabel) => {
    const r = await fetch(`${SUPA}/rest/v1/${tabel}?select=*`, { headers: { apikey: KEY, Authorization: `Bearer ${tok.access_token}` } });
    return { status: r.status, body: await r.json() };
  };
  for (const t of ["bukti", "keluarga", "anggota", "undangan"]) {
    const r = await rest(t);
    assert.equal(r.status, 200); assert.deepEqual(r.body, [], `admin membaca ${t} langsung`);
  }
  for (const t of ["audit_log", "platform_admins", "drive_koneksi"]) {
    const r = await rest(t);
    assert.ok(r.status === 401 || r.status === 403 || (Array.isArray(r.body) && r.body.length === 0), `${t}: ${r.status}`);
    assert.ok(!(Array.isArray(r.body) && r.body.length > 0), `${t} terbaca`);
  }
  ok("dengan token admin, REST langsung ke bukti/keluarga/anggota/undangan kosong dan audit_log, platform_admins, drive_koneksi tertutup");

  // Layar kecil: tidak ada overflow horizontal
  for (const url of ["/admin", "/admin/progres", "/admin/keluarga", `/admin/keluarga/${idKeluarga}`, "/admin/pengguna", "/admin/bukti", "/admin/audit"]) {
    await pAdmin.goto(`${BASE}${url}`);
    await pAdmin.waitForSelector("h1");
    assert.ok(await tidakMeluap(pAdmin), `overflow di ${url}`);
  }
  ok("semua halaman admin muat di layar 390px tanpa gulir samping");

  // Bersih-bersih akun uji
  await pAyah.goto(`${BASE}/keluarga`);
  await pAyah.fill("#konfirmasi-rumah", RUMAH);
  await klik(pAyah, "Hapus rumah dan seluruh datanya"); await pAyah.waitForURL("**/beranda");
  for (const p of [pAyah, pAnak]) {
    await p.goto(`${BASE}/akun`); await p.fill("#konfirmasi-akun", "HAPUS");
    await klik(p, "Hapus akun saya selamanya"); await p.waitForURL("**/masuk");
  }
  ok("pembersihan: rumah dan akun uji dihapus (akun admin tetap)");
} catch (e) {
  console.error("GAGAL:", e.message);
  for (const [n, p] of [["admin", pAdmin], ["ayah", pAyah], ["anak", pAnak]]) await p.screenshot({ path: `tests/gagal-${n}.png`, fullPage: true }).catch(() => {});
  console.error("URL:", pAdmin.url(), pAyah.url(), pAnak.url(), "akun:", ayah.email, anak.email);
  process.exitCode = 1;
} finally {
  console.log("Galat konsol:", konsol.length ? konsol : "tidak ada");
  await browser.close();
}
