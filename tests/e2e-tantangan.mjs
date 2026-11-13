// Uji alur tantangan, bukti cerita, penilaian, poin, dan lencana terhadap Supabase asli.
// Butuh server di http://localhost:3000 dengan .env.local dan Confirm email dimatikan sementara.
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE ?? "http://localhost:3000";
const id = Date.now().toString(36);
const SANDI = "Ujicoba#12345";
const ayah = { nama: "Ayah Uji", email: `ayah.${id}@example.com` };
const anak = { nama: "Anak Uji", email: `anak.${id}@example.com` };
const ok = (n) => console.log(`PASS ${n}`);

const browser = await chromium.launch();
const konsol = [];
async function baru(nama) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && konsol.push(`${nama}: ${m.text()}`));
  page.on("pageerror", (e) => konsol.push(`${nama}: ${e.message}`));
  return page;
}
const pAyah = await baru("ayah");
const pAnak = await baru("anak");

async function daftar(p, u) {
  await p.goto(`${BASE}/daftar`);
  await p.fill("#nama", u.nama);
  await p.fill("#email", u.email);
  await p.fill("#password", SANDI);
  await p.check("#setuju");
  await p.getByRole("button", { name: "Buat akun" }).click();
  await p.waitForSelector('[role=status]:has-text("Berhasil")');
}
const teksMain = (p) => p.locator("main").innerText();
// Panel tetap terbuka setelah render ulang, jadi buka hanya bila masih tertutup.
const bukaSituasi = async (p) => { const d = p.locator("details", { hasText: "Ubah situasi hari ini" }); if (!(await d.evaluate((e) => e.open))) await d.locator("summary").click(); };
const klik = (p, nama, exact = true) => p.getByRole("button", { name: nama, exact }).click();

try {
  // Persiapan: rumah dengan ayah dan anak
  await daftar(pAyah, ayah);
  await pAyah.goto(`${BASE}/beranda`);
  await pAyah.fill("#nama", "Keluarga Uji");
  await pAyah.selectOption("#peran", "ayah");
  await klik(pAyah, "Buat rumah");
  await pAyah.waitForURL("**/keluarga");
  await pAyah.selectOption("#peran-undangan", "anak");
  await pAyah.check("#persetujuan");
  await klik(pAyah, "Buat tautan undangan");
  await pAyah.waitForSelector("#tautan-undangan");
  const tautan = (await pAyah.inputValue("#tautan-undangan")).replace(/^https?:\/\/[^/]+/, BASE);
  await daftar(pAnak, anak);
  await pAnak.goto(tautan);
  await pAnak.fill("#tgl_lahir", "2016-05-01");
  await klik(pAnak, "Gabung ke rumah ini");
  await pAnak.waitForURL("**/beranda");
  ok("persiapan: rumah dengan ayah dan anak");

  // Pilih situasi hari ini
  await pAyah.goto(`${BASE}/beranda`);
  await pAyah.waitForSelector("text=Situasi hari ini");
  await klik(pAyah, /Ayah pulang kerja/, false);
  await pAyah.waitForSelector("text=Tantangan hari ini, Sepulang kerja");
  ok("mode pulang kerja memilih tantangan Sepulang kerja");

  await bukaSituasi(pAyah);
  await klik(pAyah, /Anak ke tempat kerja/, false);
  await pAyah.waitForSelector("text=Tantangan hari ini, Ke tempat kerja");
  assert.match(await teksMain(pAyah), /Pastikan tempat kerja mengizinkan anak berkunjung/);
  ok("mode kunjungan memilih tantangan Ke tempat kerja dan menampilkan peringatan izin");

  await bukaSituasi(pAyah);
  await klik(pAyah, /Hari biasa/, false);
  await pAyah.waitForFunction(() => /Tantangan hari ini, (Komunikasi|Kebersamaan|Empati|Kemandirian|Kreativitas)/.test(document.body.innerText));
  const judul1 = await pAyah.locator("article h2").innerText();
  await klik(pAyah, "Ganti tantangan");
  await pAyah.waitForFunction((j) => document.querySelector("article h2")?.textContent !== j, judul1);
  const judul = await pAyah.locator("article h2").innerText();
  assert.notEqual(judul, judul1);
  ok(`hari biasa memilih kategori umum, ganti tantangan: "${judul1}" menjadi "${judul}"`);

  // Anak melihat tantangan yang sama tanpa tombol ganti
  await pAnak.goto(`${BASE}/beranda`);
  await pAnak.waitForSelector("article h2");
  assert.equal(await pAnak.locator("article h2").innerText(), judul);
  assert.equal(await pAnak.getByRole("button", { name: "Ganti tantangan" }).count(), 0);
  assert.equal(await pAnak.getByRole("button", { name: "Lewati hari ini" }).count(), 0);
  ok("anak melihat tantangan yang sama tanpa tombol ganti atau lewati");

  // Daftar tantangan
  await pAnak.goto(`${BASE}/tantangan`);
  await pAnak.waitForSelector("main li h2");
  const semua = await pAnak.locator("main li h2").count();
  assert.ok(semua >= 30, `jumlah ${semua}`);
  await pAnak.goto(`${BASE}/tantangan?k=ke_tempat_kerja`);
  await pAnak.waitForSelector("main li h2");
  assert.equal(await pAnak.locator("main li h2").count(), 7);
  ok(`daftar ${semua} tantangan, filter Ke tempat kerja menampilkan 7`);

  // Kirim bukti oleh anak
  await pAnak.goto(`${BASE}/beranda`);
  await pAnak.getByRole("link", { name: "Kirim bukti untuk selesai" }).click();
  await pAnak.waitForURL("**/tantangan/**");
  const slugUrl = pAnak.url();
  await pAnak.fill("#teks", "sudah ya 1 2 3 4 5");
  assert.match(await pAnak.locator("#hitung").innerText(), /dari minimal 20 huruf/);
  await klik(pAnak, "Kirim bukti");
  await pAnak.waitForSelector('[role=alert]:has-text("minimal 20 huruf")');
  ok("cerita kurang dari 20 huruf ditolak dengan pesan jelas");

  await pAnak.locator("label", { hasText: "Foto" }).click();
  await pAnak.waitForSelector("text=Foto belum bisa dikirim");
  assert.match(await teksMain(pAnak), /Admin platform belum menghubungkan folder Google Drive/);
  assert.doesNotMatch(await teksMain(pAnak), /pemilik rumah.*menghubungkan/i);
  ok("foto menunggu koneksi Drive admin, anggota rumah tidak diminta menghubungkan akun Google pribadi");
  await pAnak.locator("label", { hasText: "Cerita tertulis" }).click();

  const CERITA = "Kami duduk bersama sehabis maghrib dan bergantian bercerita tentang hari ini tanpa ponsel";
  await pAnak.fill("#teks", CERITA);
  await klik(pAnak, "Kirim bukti");
  await pAnak.waitForSelector('[role=status]:has-text("Bukti terkirim")');
  ok("cerita 20 huruf atau lebih terkirim");

  await pAnak.goto(`${BASE}/beranda`);
  await pAnak.waitForSelector("text=menunggu penilaian anggota lain");
  assert.match(await pAnak.locator("dl").innerText(), /0\s+Poin keluarga|Poin keluarga\s+0|0\s*\n\s*Poin/i);
  ok("poin belum masuk saat status menunggu");

  // Anak tidak bisa menilai buktinya sendiri
  await pAnak.goto(`${BASE}/bukti`);
  await pAnak.waitForSelector("text=Menunggu anggota lain menilai");
  assert.equal(await pAnak.getByRole("button", { name: "Setujui" }).count(), 0);
  ok("pengirim tidak punya tombol Setujui untuk buktinya sendiri");

  // Ayah menolak tanpa alasan, lalu dengan alasan
  await pAyah.goto(`${BASE}/bukti`);
  await pAyah.waitForSelector("text=Menunggu penilaian (1)");
  await klik(pAyah, "Tolak");
  await pAyah.waitForSelector('[role=alert]:has-text("alasan")');
  ok("menolak tanpa alasan ditolak");
  await pAyah.fill('input[name="alasan"]', "Ceritanya belum menyebut siapa yang bercerita");
  await klik(pAyah, "Tolak");
  await pAyah.waitForSelector("text=Alasan: Ceritanya belum menyebut");
  ok("penolakan dengan alasan tercatat dan alasan tampil");

  // Anak kirim ulang dan ayah setujui
  await pAnak.goto(slugUrl);
  await pAnak.waitForSelector("text=Bukti sebelumnya ditolak");
  await pAnak.fill("#teks", CERITA + " dan ayah menyebut tiga hal yang ia banggakan dari kakak");
  await klik(pAnak, "Kirim bukti");
  await pAnak.waitForSelector('[role=status]:has-text("Bukti terkirim")');
  await pAyah.goto(`${BASE}/bukti`);
  await pAyah.waitForSelector("text=Menunggu penilaian (1)");
  await klik(pAyah, "Setujui");
  await pAyah.waitForSelector("text=Disetujui, +");
  ok("kirim ulang setelah ditolak, lalu disetujui");

  await pAyah.goto(`${BASE}/beranda`);
  await pAyah.waitForSelector("text=Langkah pertama");
  const beranda = await pAyah.locator("main").innerText();
  const m = beranda.match(/(\d+)\s*\n?\s*Poin keluarga|Poin keluarga\s*\n?\s*(\d+)/);
  const poin = Number(m?.[1] ?? m?.[2]);
  assert.ok(poin >= 10, `poin ${poin}`);
  assert.match(beranda, /Langkah pertama\s*Terbuka/);
  assert.match(beranda, /Seminggu beruntun\s*Terkunci/);
  assert.match(beranda, /Aktif 1 dari 7 hari, 1 tantangan/);
  ok(`poin ${poin}, lencana Langkah pertama terbuka, Seminggu beruntun terkunci, ringkasan 7 hari benar`);

  // Bukti yang sama persis tidak boleh dipakai untuk tantangan lain
  await pAyah.goto(`${BASE}/tantangan?k=kebersamaan`);
  await pAyah.locator("main li a", { hasText: "Kirim bukti" }).first().click();
  await pAyah.waitForURL("**/tantangan/**");
  await pAyah.fill("#teks", "  " + CERITA.toUpperCase() + " dan ayah menyebut tiga hal yang ia banggakan dari kakak ");
  await klik(pAyah, "Kirim bukti");
  await pAyah.waitForSelector('[role=alert]:has-text("sama persis")');
  ok("bukti yang sama persis (beda huruf besar dan spasi) ditolak untuk tantangan lain");

  // Hapus bukti: poin ikut hilang
  await pAnak.goto(`${BASE}/bukti`);
  await pAnak.getByRole("button", { name: /^Hapus bukti/ }).first().click();
  await pAnak.waitForFunction(() => !document.body.innerText.includes("Disetujui, +"));
  await pAyah.goto(`${BASE}/beranda`);
  await pAyah.waitForSelector("text=Tahap rumah");
  assert.match(await pAyah.locator("dl").innerText(), /0\s*\n?\s*Poin keluarga|Poin keluarga\s*\n?\s*0/);
  ok("hapus bukti menghapus poinnya");

  // Bersih-bersih
  await pAyah.goto(`${BASE}/keluarga`);
  await pAyah.fill("#konfirmasi-rumah", "Keluarga Uji");
  await klik(pAyah, "Hapus rumah dan seluruh datanya");
  await pAyah.waitForURL("**/beranda");
  for (const p of [pAyah, pAnak]) {
    await p.goto(`${BASE}/akun`);
    await p.fill("#konfirmasi-akun", "HAPUS");
    await klik(p, "Hapus akun saya selamanya");
    await p.waitForURL("**/masuk");
  }
  ok("pembersihan: rumah dan kedua akun uji dihapus");
} catch (e) {
  console.error("GAGAL:", e.message);
  await pAyah.screenshot({ path: "tests/gagal-ayah.png", fullPage: true }).catch(() => {});
  await pAnak.screenshot({ path: "tests/gagal-anak.png", fullPage: true }).catch(() => {});
  console.error("URL ayah:", pAyah.url(), "URL anak:", pAnak.url(), "akun:", ayah.email, anak.email);
  process.exitCode = 1;
} finally {
  console.log("Galat konsol:", konsol.length ? konsol : "tidak ada");
  await browser.close();
}
