import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const db = new PGlite({ extensions: { pgcrypto } });

// Tiruan skema auth Supabase. Hak bawaan Supabase (semua tabel terbuka untuk anon/authenticated)
// ditiru sebelum migrasi supaya REVOKE di migrasi diuji seperti di produksi.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
    raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);
for (const f of ["0001_akun_keluarga", "0002_tantangan_bukti", "0003_isi_tantangan"]) {
  await db.exec(readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
}

const user = async (email, nama) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`,
    [email, JSON.stringify({ nama })])).rows[0].id;

async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; set request.uid = '${uid}'`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; reset request.uid`); }
}

const ayah = await user("ayah@x.test", "Ayah");
const ibu = await user("ibu@x.test", "Ibu");
const anak = await user("anak@x.test", "Anak");
const anak2 = await user("anak2@x.test", "Anak Dua");
const asing = await user("asing@x.test", "Asing");
const kid = (await as(ayah, `select buat_keluarga('Rumah Uji','ayah') as id`)).rows[0].id;
for (const [u, peran, h] of [[ibu, "ibu", "1"], [anak, "anak", "2"], [anak2, "anak", "3"]]) {
  const tok = h.repeat(64);
  await as(ayah, `select buat_undangan($1,$2,$3,$4)`, [kid, peran, tok, peran === "anak"]);
  await as(u, `select terima_undangan($1, $2)`, [tok, peran === "anak" ? "2015-01-01" : null]);
}
const h = (c) => c.repeat(64);
const CERITA = "Kami bercerita tentang hari ini dan saling mendengarkan dengan tenang";
const poinKeluarga = async () =>
  (await as(ayah, `select ringkasan_keluarga($1) as r`, [kid])).rows[0].r;

test("isi tantangan: lebih dari 30, semua kategori ada, tempat kerja membawa peringatan", async () => {
  const r = await as(ayah, `select kategori, count(*)::int n, count(peringatan)::int p from tantangan group by kategori`);
  const total = r.rows.reduce((a, x) => a + x.n, 0);
  assert.ok(total >= 30, `total ${total}`);
  assert.equal(r.rows.length, 7);
  const kerja = r.rows.find((x) => x.kategori === "ke_tempat_kerja");
  assert.equal(kerja.p, kerja.n);
});

test("tantangan harian mengikuti mode, tetap sama bila mode sama", async () => {
  const kat = async (slug) => (await db.query(`select kategori from tantangan where slug=$1`, [slug])).rows[0].kategori;
  const a = (await as(ayah, `select atur_tantangan_hari_ini($1,'biasa',false) as s`, [kid])).rows[0].s;
  assert.ok(!["sepulang_kerja", "ke_tempat_kerja"].includes(await kat(a)));
  const a2 = (await as(ibu, `select atur_tantangan_hari_ini($1,'biasa',false) as s`, [kid])).rows[0].s;
  assert.equal(a, a2);
  const p = (await as(ayah, `select atur_tantangan_hari_ini($1,'pulang_kerja',false) as s`, [kid])).rows[0].s;
  assert.equal(await kat(p), "sepulang_kerja");
  const k = (await as(ayah, `select atur_tantangan_hari_ini($1,'hari_kunjungan',false) as s`, [kid])).rows[0].s;
  assert.equal(await kat(k), "ke_tempat_kerja");
  const g = (await as(ayah, `select atur_tantangan_hari_ini($1,'hari_kunjungan',true) as s`, [kid])).rows[0].s;
  assert.notEqual(g, k);
});

test("anak tidak bisa mengganti atau melewati tantangan, orang luar tidak bisa apa pun", async () => {
  await assert.rejects(as(anak, `select atur_tantangan_hari_ini($1,'biasa',true)`, [kid]), /khusus_orang_tua/);
  await assert.rejects(as(anak, `select lewati_tantangan($1)`, [kid]), /khusus_orang_tua/);
  await assert.rejects(as(asing, `select atur_tantangan_hari_ini($1,'biasa',false)`, [kid]), /bukan_anggota/);
  await as(ayah, `select lewati_tantangan($1)`, [kid]);
});

test("cerita minimal 20 huruf, spasi dan angka tidak dihitung", async () => {
  await assert.rejects(as(anak, `select kirim_bukti($1,'tiga-pujian','cerita','sudah ya 12345 678 90',$2,null)`, [kid, h("a")]), /cerita_terlalu_pendek/);
  await assert.rejects(as(anak, `select kirim_bukti($1,'tiga-pujian','foto',null,$2,null)`, [kid, h("a")]), /foto_tanpa_berkas/);
});

test("kirim cerita: status menunggu, poin belum masuk", async () => {
  await as(anak, `select kirim_bukti($1,'tiga-pujian','cerita',$2,$3,null)`, [kid, CERITA, h("b")]);
  const r = await poinKeluarga();
  assert.equal(r.poin, 0);
  assert.equal(r.selesai, 0);
  assert.equal(r.menunggu, 1);
});

test("bukti kembar dan kiriman ganda di hari yang sama ditolak", async () => {
  await assert.rejects(as(ibu, `select kirim_bukti($1,'masak-bersama','cerita',$2,$3,null)`, [kid, CERITA, h("b")]), /bukti_kembar/);
  await assert.rejects(as(ibu, `select kirim_bukti($1,'tiga-pujian','cerita',$2,$3,null)`, [kid, CERITA, h("c")]), /sudah_dikirim_hari_ini/);
});

test("orang luar tidak bisa membaca atau mengirim bukti", async () => {
  assert.equal((await as(asing, `select * from bukti`)).rows.length, 0);
  await assert.rejects(as(asing, `select kirim_bukti($1,'masak-bersama','cerita',$2,$3,null)`, [kid, CERITA, h("d")]), /bukan_anggota/);
  await assert.rejects(as(asing, `select ringkasan_keluarga($1)`, [kid]), /bukan_anggota/);
});

test("penilaian: tidak boleh menilai sendiri, anak tidak menilai anak, tolak wajib alasan", async () => {
  const id = (await db.query(`select id from bukti where hash=$1`, [h("b")])).rows[0].id;
  await assert.rejects(as(anak, `select tinjau_bukti($1,'disetujui',null)`, [id]), /tidak_boleh_menilai_sendiri/);
  await assert.rejects(as(anak2, `select tinjau_bukti($1,'disetujui',null)`, [id]), /khusus_orang_tua/);
  await assert.rejects(as(ibu, `select tinjau_bukti($1,'ditolak',' ')`, [id]), /alasan_wajib/);
  await assert.rejects(as(asing, `select tinjau_bukti($1,'disetujui',null)`, [id]), /bukti_tidak_ada/);
});

test("tolak lalu kirim ulang dengan bukti baru; setelah disetujui poin masuk", async () => {
  const id = (await db.query(`select id from bukti where hash=$1`, [h("b")])).rows[0].id;
  await as(ibu, `select tinjau_bukti($1,'ditolak','Ceritanya belum menyebut apa yang dilakukan')`, [id]);
  await assert.rejects(as(ibu, `select tinjau_bukti($1,'disetujui',null)`, [id]), /sudah_dinilai/);
  const baru = (await as(anak, `select kirim_bukti($1,'tiga-pujian','cerita',$2,$3,null) as id`,
    [kid, CERITA + " dengan lebih rinci", h("e")])).rows[0].id;
  await as(ayah, `select tinjau_bukti($1,'disetujui',null)`, [baru]);
  const r = await poinKeluarga();
  assert.equal(r.poin, 10);
  assert.equal(r.selesai, 1);
  assert.equal(r.komunikasi, 1);
  assert.equal(r.hari_beruntun, 1);
});

test("hari beruntun menghitung hari berturut-turut yang punya bukti disetujui", async () => {
  await db.exec(`
    insert into bukti (keluarga_id, tantangan_slug, tanggal, pengirim_id, jenis, teks, hash, status)
    select '${kid}', 'masak-bersama', hari_ini() - n, '${anak}', 'cerita', 'x', repeat('${"f"}', 63) || n::text, 'disetujui'
    from generate_series(1, 2) n;
  `);
  assert.equal((await poinKeluarga()).hari_beruntun, 3);
  assert.equal((await poinKeluarga()).beruntun_terbaik, 3);
});

test("hapus bukti: hanya pengirim atau pemilik, poin ikut hilang", async () => {
  const id = (await db.query(`select id from bukti where hash=$1`, [h("e")])).rows[0].id;
  await assert.rejects(as(anak2, `select hapus_bukti($1)`, [id]), /tidak_berhak/);
  const before = (await poinKeluarga()).poin;
  await as(anak, `select hapus_bukti($1)`, [id]);
  assert.equal((await poinKeluarga()).poin, before - 10);
});

test("token Drive tidak terbaca klien, status Drive terlihat tanpa token", async () => {
  await db.exec(`insert into drive_koneksi (keluarga_id, refresh_token_enc) values ('${kid}', 'rahasia')`);
  await assert.rejects(as(ayah, `select * from drive_koneksi`));
  assert.equal((await as(anak, `select status_drive($1) as s`, [kid])).rows[0].s, "tersambung");
  assert.equal((await as(asing, `select status_drive($1) as s`, [kid])).rows[0].s, "belum");
});

test("klien tidak bisa menulis langsung ke bukti atau tantangan", async () => {
  await assert.rejects(as(ayah, `insert into bukti (keluarga_id, tantangan_slug, pengirim_id, jenis, teks, hash, status)
    values ($1,'masak-bersama',$2,'cerita','x',$3,'disetujui')`, [kid, ayah, h("9")]));
  await assert.rejects(as(ayah, `update bukti set status='disetujui'`));
  await assert.rejects(as(ayah, `update tantangan set poin=30`));
});
