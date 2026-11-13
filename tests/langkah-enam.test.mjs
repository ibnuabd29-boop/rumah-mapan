import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const db = new PGlite({ extensions: { pgcrypto } });
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
for (const migration of [
  "0001_akun_keluarga", "0002_tantangan_bukti", "0003_isi_tantangan",
  "0004_admin", "0005_perasaan_catatan_masa_depan", "0007_konten_admin",
]) {
  await db.exec(readFileSync(`supabase/migrations/${migration}.sql`, "utf8"));
}

const user = async (email, nama) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`,
    [email, JSON.stringify({ nama })])).rows[0].id;

async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; set request.uid = '${uid}'`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; reset request.uid");
  }
}

const admin = await user("admin@x.test", "Admin");
await db.exec(`insert into platform_admins (user_id) values ('${admin}')`);
const ayah = await user("ayah@x.test", "Ayah");
const ibu = await user("ibu@x.test", "Ibu");
const anak = await user("anak@x.test", "Anak");
const anakLain = await user("anak-lain@x.test", "Anak Lain");
const asing = await user("asing@x.test", "Orang Luar");
const keluarga = (await as(ayah, `select buat_keluarga('Rumah Uji','ayah') as id`)).rows[0].id;
for (const [id, role, token] of [
  [ibu, "ibu", "1"], [anak, "anak", "2"], [anakLain, "anak", "3"],
]) {
  const hash = token.repeat(64);
  await as(ayah, `select buat_undangan($1,$2,$3,$4)`, [keluarga, role, hash, role === "anak"]);
  await as(id, `select terima_undangan($1,$2)`, [hash, role === "anak" ? "2015-01-01" : null]);
}
await db.exec(`insert into anggota (keluarga_id, user_id, peran) values ('${keluarga}', '${admin}', 'wali')`);

const idCatatan = async (uid, dibagikan, isi) =>
  (await as(uid, `insert into catatan_harian (keluarga_id, penulis_id, isi, dibagikan)
    values ($1,$2,$3,$4) returning id`, [keluarga, uid, isi, dibagikan])).rows[0].id;

test("check-in hanya dibaca pemilik dan wali dapat melihat anak, bukan pasangan", async () => {
  await as(anak, `select simpan_checkin($1,'sedih')`, [keluarga]);
  await as(ayah, `select simpan_checkin($1,'tenang')`, [keluarga]);
  await as(ibu, `select simpan_checkin($1,'senang')`, [keluarga]);
  await as(anak, `select simpan_checkin($1,'cemas')`, [keluarga]);

  const milikAnak = await as(anak, `select user_id, suasana from checkin_perasaan`);
  assert.deepEqual(milikAnak.rows, [{ user_id: anak, suasana: "cemas" }]);
  const milikAyah = await as(ayah, `select user_id, suasana from checkin_perasaan order by user_id`);
  assert.deepEqual(
    milikAyah.rows.map((row) => row.user_id).sort(),
    [ayah, anak].sort(),
  );
  assert.equal((await as(asing, `select * from checkin_perasaan`)).rows.length, 0);
  await assert.rejects(as(asing, `select simpan_checkin($1,'senang')`, [keluarga]), /bukan_anggota/);
  await assert.rejects(as(admin, `select simpan_checkin($1,'senang')`, [keluarga]), /admin_tidak_mengisi/);
});

test("catatan pribadi hanya terlihat anak, catatan berbagi dapat dibaca wali", async () => {
  const pribadi = await idCatatan(anak, false, "RAHASIA-PRIBADI-ANAK");
  const dibagikan = await idCatatan(anak, true, "CERITA-YANG-DIBAGIKAN");
  assert.deepEqual(
    (await as(anak, `select isi from catatan_harian order by isi`)).rows.map((row) => row.isi),
    ["CERITA-YANG-DIBAGIKAN", "RAHASIA-PRIBADI-ANAK"],
  );
  assert.deepEqual(
    (await as(ayah, `select isi from catatan_harian`)).rows.map((row) => row.isi),
    ["CERITA-YANG-DIBAGIKAN"],
  );
  assert.equal((await as(anakLain, `select * from catatan_harian`)).rows.length, 0);
  assert.equal((await as(asing, `select * from catatan_harian`)).rows.length, 0);
  assert.equal((await as(admin, `select * from catatan_harian`)).rows.length, 0);
  await assert.rejects(
    as(ayah, `insert into catatan_harian (keluarga_id, penulis_id, isi) values ($1,$2,'Palsu')`, [keluarga, ayah]),
  );

  await as(ayah, `insert into balasan_catatan (keluarga_id, catatan_id, pengirim_id, isi)
    values ($1,$2,$3,'Balasan orang tua')`, [keluarga, dibagikan, ayah]);
  await as(anak, `insert into balasan_catatan (keluarga_id, catatan_id, pengirim_id, isi)
    values ($1,$2,$3,'Balasan anak')`, [keluarga, pribadi, anak]);
  assert.equal((await as(ayah, `select * from balasan_catatan`)).rows.length, 1);
  assert.equal((await as(anak, `select * from balasan_catatan`)).rows.length, 2);
  assert.equal((await as(admin, `select * from balasan_catatan`)).rows.length, 0);
  await assert.rejects(
    as(ayah, `insert into balasan_catatan (keluarga_id, catatan_id, pengirim_id, isi)
      values ($1,$2,$3,'Balasan pribadi')`, [keluarga, pribadi, ayah]),
  );
});

test("admin hanya menerima tanggal dan jumlah catatan, tanpa isi maupun suasana pribadi", async () => {
  const r = await as(admin, `select admin_ringkasan_catatan($1) as ringkasan`, [keluarga]);
  const hasil = JSON.stringify(r.rows[0].ringkasan);
  assert.match(hasil, /"jumlah":2/);
  assert.doesNotMatch(hasil, /RAHASIA-PRIBADI-ANAK|CERITA-YANG-DIBAGIKAN/);
  assert.doesNotMatch(hasil, /dibagikan|suasana|isi/);
  await assert.rejects(as(ayah, `select admin_ringkasan_catatan($1)`, [keluarga]), /bukan_admin/);
  assert.equal((await as(asing, `select * from catatan_harian`)).rows.length, 0);
});

test("cita-cita dan langkah hanya muncul di rumahnya, progres langkah tercatat", async () => {
  const cita = (await as(anak, `insert into cita_cita (keluarga_id, pembuat_id, judul, alasan)
    values ($1,$2,'Belajar memasak','Ingin bisa menyiapkan makanan') returning id`, [keluarga, anak])).rows[0].id;
  const langkah = (await as(ayah, `insert into langkah_cita_cita (keluarga_id, cita_cita_id, pembuat_id, isi)
    values ($1,$2,$3,'Memilih satu resep sederhana') returning id`, [keluarga, cita, ayah])).rows[0].id;
  assert.equal((await as(ibu, `select * from cita_cita`)).rows.length, 1);
  await as(ibu, `select tandai_langkah($1,true)`, [langkah]);
  assert.ok((await db.query(`select selesai_at from langkah_cita_cita where id='${langkah}'`)).rows[0].selesai_at);
  await as(anak, `select tandai_langkah($1,false)`, [langkah]);
  assert.equal((await db.query(`select selesai_at from langkah_cita_cita where id='${langkah}'`)).rows[0].selesai_at, null);
  assert.equal((await as(asing, `select * from cita_cita`)).rows.length, 0);
  await assert.rejects(as(asing, `select tandai_langkah($1,true)`, [langkah]), /langkah_tidak_ditemukan/);
});

test("progres materi bersifat pribadi dan lencana selesai setelah delapan substansi", async () => {
  const slugs = [
    "pendewasaan-usia-perkawinan", "fungsi-keluarga", "seksualitas", "hiv-aids",
    "napza", "kecakapan-hidup", "gender", "advokasi-kie",
  ];
  for (const slug of slugs) {
    await as(anak, `select tandai_materi_selesai($1,$2)`, [keluarga, slug]);
  }
  assert.equal((await as(anak, `select * from materi_selesai`)).rows.length, 8);
  assert.equal((await as(ayah, `select * from materi_selesai`)).rows.length, 0);
  await assert.rejects(as(anak, `select tandai_materi_selesai($1,'palsu')`, [keluarga]), /materi_tidak_ditemukan/);
  await assert.rejects(as(admin, `select tandai_materi_selesai($1,$2)`, [keluarga, slugs[0]]), /admin_tidak_mengisi/);
  const progres = await as(admin, `select * from admin_progres_materi(array[$1]::uuid[])`, [anak]);
  assert.deepEqual(progres.rows, [{ keluarga_id: keluarga, user_id: anak, selesai: 8 }]);
  const audit = (await db.query(`select aksi, detail from audit_log where aksi='lihat_progres_materi'`)).rows;
  assert.deepEqual(audit, [{ aksi: "lihat_progres_materi", detail: { pengguna: 1 } }]);
  await assert.rejects(as(ayah, `select * from admin_progres_materi(array[$1]::uuid[])`, [anak]), /bukan_admin/);
  await assert.rejects(as(admin, `select * from admin_progres_materi(null::uuid[])`), /filter_pengguna_tidak_valid/);
});

test("apresiasi hanya terbaca anggota rumah dan penerima harus tinggal serumah", async () => {
  await as(anak, `insert into apresiasi (keluarga_id, pengirim_id, penerima_id, isi)
    values ($1,$2,$3,'Terima kasih sudah menemani saya')`, [keluarga, anak, ayah]);
  assert.equal((await as(ayah, `select * from apresiasi`)).rows.length, 1);
  assert.equal((await as(asing, `select * from apresiasi`)).rows.length, 0);
  await assert.rejects(
    as(anak, `insert into apresiasi (keluarga_id, pengirim_id, penerima_id, isi)
      values ($1,$2,$3,'Terima kasih')`, [keluarga, anak, asing]),
  );
});

test("tanda perhatian hanya mengembalikan identitas anak yang memenuhi ambang", async () => {
  await db.exec(`delete from checkin_perasaan where keluarga_id='${keluarga}' and user_id='${anak}'`);
  await db.exec(`
    insert into checkin_perasaan (keluarga_id, user_id, tanggal, suasana) values
      ('${keluarga}', '${anak}', hari_ini() - 2, 'sedih'),
      ('${keluarga}', '${anak}', hari_ini() - 1, 'cemas'),
      ('${keluarga}', '${anak}', hari_ini(), 'sedih');
  `);
  const r = await as(admin, `select * from admin_perhatian_anak()`);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(Object.keys(r.rows[0]).sort(), ["keluarga", "keluarga_id", "nama_anak", "perlu_perhatian"]);
  assert.equal(r.rows[0].nama_anak, "Anak");
  assert.equal(r.rows[0].perlu_perhatian, true);
  await assert.rejects(as(ayah, `select * from admin_perhatian_anak()`), /bukan_admin/);

  const trend = (await as(admin, `select admin_tren_perasaan($1,7) as t`, [keluarga])).rows[0].t;
  assert.equal(trend.length, 7);
  assert.equal(trend.at(-1).sedih, 1);
  assert.equal(trend.at(-2).cemas, 1);
  assert.equal(trend.at(-3).sedih, 1);
  assert.deepEqual(Object.keys(trend[0]).sort(), ["biasa", "cemas", "sedih", "senang", "tanggal", "tenang"]);
  await assert.rejects(as(admin, `select admin_tren_perasaan($1,14)`, [keluarga]), /rentang_tidak_valid/);
});
