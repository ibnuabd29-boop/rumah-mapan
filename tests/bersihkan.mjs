// Membersihkan akun uji yang tertinggal bila e2e gagal di tengah jalan.
// Pakai: node tests/bersihkan.mjs email1@example.com email2@example.com
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SANDI = "Ujicoba#12345";
const browser = await chromium.launch();

for (const email of process.argv.slice(2)) {
  const p = await browser.newPage();
  await p.goto(`${BASE}/masuk`);
  await p.fill("#email", email);
  await p.fill("#password", SANDI);
  await p.getByRole("button", { name: "Masuk", exact: true }).click();
  await p.waitForURL("**/beranda", { timeout: 15000 }).catch(() => {});
  if (!p.url().includes("/beranda")) {
    console.log(`${email}: tidak bisa masuk (mungkin sudah dihapus)`);
    continue;
  }
  await p.goto(`${BASE}/keluarga`);
  const hapusRumah = p.getByRole("button", { name: "Hapus rumah dan seluruh datanya" });
  if (await hapusRumah.count()) {
    await p.fill("#konfirmasi-rumah", await p.locator("h1").first().innerText());
    await hapusRumah.click();
    await p.waitForURL("**/beranda");
  }
  await p.goto(`${BASE}/akun`);
  await p.fill("#konfirmasi-akun", "HAPUS");
  await p.getByRole("button", { name: "Hapus akun saya selamanya" }).click();
  await p.waitForURL("**/masuk");
  console.log(`${email}: dihapus`);
}
await browser.close();
