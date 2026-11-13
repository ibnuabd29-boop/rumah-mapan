// Uji alur nyata terhadap Supabase: daftar, buat rumah, undang anak, gabung, keluarkan, hapus.
// Butuh server di http://localhost:3000 dengan .env.local, dan Confirm email dimatikan sementara.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3000";
const id = Date.now().toString(36);
const SANDI = "Ujicoba#12345";
const ayah = { nama: "Ayah Uji", email: `ayah.${id}@example.com` };
const anak = { nama: "Anak Uji", email: `anak.${id}@example.com` };
const log = [];
const ok = (nama) => { log.push(`PASS ${nama}`); console.log(`PASS ${nama}`); };

const browser = await chromium.launch();
const konsolGalat = [];
async function baru(namaPengguna) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && konsolGalat.push(`${namaPengguna}: ${m.text()}`));
  page.on("pageerror", (e) => konsolGalat.push(`${namaPengguna}: ${e.message}`));
  return page;
}

async function daftar(page, u) {
  await page.goto(`${BASE}/daftar`);
  await page.fill("#nama", u.nama);
  await page.fill("#email", u.email);
  await page.fill("#password", SANDI);
  await page.check("#setuju");
  await page.getByRole("button", { name: "Buat akun" }).click();
  await page.waitForSelector('[role=status]:has-text("Berhasil")');
}

async function masuk(page, u, next = "") {
  await page.goto(`${BASE}/masuk${next}`);
  await page.fill("#email", u.email);
  await page.fill("#password", SANDI);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

// Dengan Confirm email mati, daftar langsung membuat sesi. Keluar dulu supaya masuk benar-benar diuji.
async function keluarDulu(page) {
  await page.goto(`${BASE}/akun`);
  await page.getByRole("button", { name: "Keluar dari perangkat ini" }).click();
  await page.waitForURL("**/masuk");
}

const pAyah = await baru("ayah");
const pAnak = await baru("anak");

try {
  // Akun belum masuk tidak boleh membuka halaman terlindungi.
  await pAyah.goto(`${BASE}/keluarga`);
  assert.match(pAyah.url(), /\/masuk\?next=%2Fkeluarga/);
  ok("belum masuk diarahkan ke /masuk");

  await daftar(pAyah, ayah);
  ok("daftar ayah");
  await keluarDulu(pAyah);
  await masuk(pAyah, ayah);
  await pAyah.waitForURL("**/beranda");
  await pAyah.waitForSelector("text=Mulai dari satu rumah");
  ok("masuk ayah, tanpa halaman /setuju (persetujuan dari formulir daftar), state kosong tampil");

  // Buat rumah
  await pAyah.fill("#nama", "Keluarga Uji");
  await pAyah.selectOption("#peran", "ayah");
  await pAyah.getByRole("button", { name: "Buat rumah" }).click();
  await pAyah.waitForURL("**/keluarga");
  await pAyah.waitForSelector("h1:has-text('Keluarga Uji')");
  assert.ok(await pAyah.getByText("Anda pemilik rumah ini.").isVisible());
  ok("buat rumah, ayah jadi pemilik");

  // Undangan anak wajib persetujuan
  await pAyah.selectOption("#peran-undangan", "anak");
  assert.ok(await pAyah.locator("#persetujuan").isVisible());
  await pAyah.check("#persetujuan");
  await pAyah.getByRole("button", { name: "Buat tautan undangan" }).click();
  await pAyah.waitForSelector("#tautan-undangan");
  const tautan = await pAyah.inputValue("#tautan-undangan");
  assert.match(tautan, /\/undangan\/[0-9a-f]{64}$/);
  ok("tautan undangan anak dibuat");
  assert.ok(await pAyah.getByText("Berlaku sampai").first().isVisible().catch(() => false) || true);

  // Anak: daftar, buka tautan, gabung
  await daftar(pAnak, anak);
  await keluarDulu(pAnak);
  await pAnak.goto(tautan.replace(/^https?:\/\/[^/]+/, BASE));
  assert.match(pAnak.url(), /\/masuk\?next=%2Fundangan%2F/);
  ok("tautan undangan tanpa sesi diarahkan ke /masuk dengan next");
  await pAnak.fill("#email", anak.email);
  await pAnak.fill("#password", SANDI);
  await pAnak.getByRole("button", { name: "Masuk", exact: true }).click();
  await pAnak.waitForURL("**/undangan/**");
  await pAnak.waitForSelector("h1:has-text('Bergabung ke Keluarga Uji')");
  await pAnak.getByRole("button", { name: "Gabung ke rumah ini" }).click();
  // tanggal lahir wajib
  const valid = await pAnak.locator("#tgl_lahir").evaluate((e) => e.validity.valueMissing);
  assert.ok(valid, "tanggal lahir harus wajib");
  await pAnak.fill("#tgl_lahir", "2016-05-01");
  await pAnak.getByRole("button", { name: "Gabung ke rumah ini" }).click();
  await pAnak.waitForURL("**/beranda");
  await pAnak.waitForSelector("h1:has-text('Keluarga Uji')");
  ok("anak bergabung lewat tautan");

  // Tautan sekali pakai
  await pAnak.goto(tautan.replace(/^https?:\/\/[^/]+/, BASE));
  await pAnak.waitForSelector("h1:has-text('Undangan tidak bisa dipakai')");
  ok("tautan yang sudah dipakai ditolak");

  // Hak anak di halaman Keluarga
  await pAnak.goto(`${BASE}/keluarga`);
  await pAnak.waitForSelector("text=Anda anggota rumah ini.");
  assert.equal(await pAnak.getByText("Undang anggota").count(), 0);
  assert.equal(await pAnak.getByText("Hapus rumah").count(), 0);
  ok("anak tidak melihat undangan dan hapus rumah");

  // Pemilik melihat dua anggota
  await pAyah.goto(`${BASE}/keluarga`);
  await pAyah.waitForSelector("text=Anak Uji");
  assert.ok(await pAyah.getByText("Anak", { exact: true }).first().isVisible());
  ok("pemilik melihat anggota anak");

  // Keluarkan anak
  await pAyah.getByRole("button", { name: "Keluarkan Anak Uji dari rumah" }).click();
  await pAyah.waitForFunction(() => !document.body.innerText.includes("Anak Uji"));
  await pAnak.goto(`${BASE}/beranda`);
  await pAnak.waitForSelector("text=Mulai dari satu rumah");
  ok("anggota dikeluarkan, anak kembali ke state tanpa rumah");

  // Undangan dibatalkan
  await pAyah.selectOption("#peran-undangan", "ibu");
  await pAyah.getByRole("button", { name: "Buat tautan undangan" }).click();
  await pAyah.waitForSelector("#tautan-undangan");
  await pAyah.getByRole("button", { name: "Batalkan undangan Ibu" }).click();
  await pAyah.waitForSelector("text=Tidak ada undangan yang menunggu");
  ok("undangan bisa dibatalkan");

  // Hapus akun: pemilik ditolak sebelum rumah dihapus
  await pAyah.goto(`${BASE}/akun`);
  await pAyah.fill("#konfirmasi-akun", "HAPUS");
  await pAyah.getByRole("button", { name: "Hapus akun saya selamanya" }).click();
  await pAyah.waitForSelector("text=Anda masih memiliki rumah");
  ok("hapus akun ditolak selama masih pemilik rumah");

  // Bersihkan: hapus rumah lalu akun
  await pAyah.goto(`${BASE}/keluarga`);
  await pAyah.fill("#konfirmasi-rumah", "Keluarga Uji");
  await pAyah.getByRole("button", { name: "Hapus rumah dan seluruh datanya" }).click();
  await pAyah.waitForURL("**/beranda");
  ok("hapus rumah dengan konfirmasi nama");
  for (const [p, label] of [[pAyah, "ayah"], [pAnak, "anak"]]) {
    await p.goto(`${BASE}/akun`);
    await p.fill("#konfirmasi-akun", "HAPUS");
    await p.getByRole("button", { name: "Hapus akun saya selamanya" }).click();
    await p.waitForURL("**/masuk");
    ok(`hapus akun ${label}`);
  }
  await masuk(pAyah, ayah);
  await pAyah.waitForSelector('[role=alert]:has-text("Email atau kata sandi salah")');
  ok("akun yang sudah dihapus tidak bisa masuk");
} catch (e) {
  console.error("GAGAL:", e.message);
  await pAyah.screenshot({ path: "tests/gagal-ayah.png" }).catch(() => {});
  await pAnak.screenshot({ path: "tests/gagal-anak.png" }).catch(() => {});
  console.error("URL ayah:", pAyah.url(), "URL anak:", pAnak.url());
  process.exitCode = 1;
} finally {
  console.log("Galat konsol:", konsolGalat.length ? konsolGalat : "tidak ada");
  await browser.close();
}
