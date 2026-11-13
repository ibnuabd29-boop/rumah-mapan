// Script sekali pakai: konversi SVG ikon ke PNG 192 dan 512
// Jalankan: node scripts/buat-ikon.mjs (dari folder app/)
import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const require = createRequire(import.meta.url);
const sharp = require(path.join(root, "node_modules", "sharp"));

const svgBuf = readFileSync(path.join(root, "public", "ikon-rumah-mapan.svg"));

for (const size of [192, 512]) {
  const out = path.join(root, "public", `ikon-${size}.png`);
  await sharp(svgBuf).resize(size, size).png().toFile(out);
  console.log(`dibuat: ${out}`);
}
console.log("selesai.");
