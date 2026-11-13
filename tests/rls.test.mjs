import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const db = new PGlite({ extensions: { pgcrypto } });

// Tiruan skema auth Supabase: auth.users dan auth.uid() dari setelan sesi.
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text,
    raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
`);
await db.exec(readFileSync("supabase/migrations/0001_akun_keluarga.sql", "utf8"));
await db.exec(`
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select on all tables in schema public to anon;
`);
// Setelah GRANT, ulangi pencabutan yang dilakukan migrasi (Supabase memberi hak lebih dulu).
await db.exec(`
  revoke insert, update, delete on public.profiles from authenticated;
  grant update (nama) on public.profiles to authenticated;
  revoke insert, update on public.keluarga, public.anggota, public.undangan from authenticated;
  grant update (nama) on public.keluarga to authenticated;
  revoke all on public.platform_admins from authenticated;
`);

async function user(email, nama) {
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ nama })],
  );
  return r.rows[0].id;
}

async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; set request.uid = '${uid}'`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; reset request.uid`);
  }
}

const ayah = await user("ayah@contoh.test", "Ayah Uji");
const anak = await user("anak@contoh.test", "Anak Uji");
const asing = await user("asing@contoh.test", "Orang Asing");
const hash = "a".repeat(64);
let kid;

test("profil dibuat otomatis dari metadata", async () => {
  const r = await as(ayah, `select nama from profiles where id = $1`, [ayah]);
  assert.equal(r.rows[0].nama, "Ayah Uji");
});

test("anak tidak bisa jadi pemilik keluarga", async () => {
  await assert.rejects(as(anak, `select buat_keluarga('Rumah', 'anak')`), /pemilik_harus_dewasa/);
});

test("pemilik membuat keluarga dan otomatis jadi anggota", async () => {
  const r = await as(ayah, `select buat_keluarga('Keluarga Uji', 'ayah') as id`);
  kid = r.rows[0].id;
  const m = await as(ayah, `select peran from anggota where keluarga_id = $1`, [kid]);
  assert.equal(m.rows[0].peran, "ayah");
});

test("insert langsung ke keluarga/anggota ditolak", async () => {
  await assert.rejects(
    as(ayah, `insert into keluarga (nama, pemilik_id) values ('Palsu', $1)`, [ayah]),
  );
  await assert.rejects(
    as(asing, `insert into anggota (keluarga_id, user_id, peran) values ($1, $2, 'ibu')`, [kid, asing]),
  );
});

test("orang luar tidak melihat keluarga, anggota, undangan", async () => {
  assert.equal((await as(asing, `select * from keluarga`)).rows.length, 0);
  assert.equal((await as(asing, `select * from anggota`)).rows.length, 0);
});

test("undangan anak butuh persetujuan orang tua", async () => {
  await assert.rejects(
    as(ayah, `select buat_undangan($1, 'anak', $2, false)`, [kid, hash]),
    /perlu_persetujuan_ortu/,
  );
});

test("hanya pemilik yang bisa membuat undangan", async () => {
  await assert.rejects(
    as(asing, `select buat_undangan($1, 'ibu', $2, false)`, [kid, "b".repeat(64)]),
    /bukan_pemilik/,
  );
});

test("anak menerima undangan sekali pakai dengan tanggal lahir", async () => {
  await as(ayah, `select buat_undangan($1, 'anak', $2, true)`, [kid, hash]);
  await assert.rejects(as(anak, `select terima_undangan($1, null)`, [hash]), /tgl_lahir_wajib/);
  await as(anak, `select terima_undangan($1, '2016-05-01')`, [hash]);
  const m = await as(ayah, `select peran, persetujuan_oleh from anggota where user_id = $1`, [anak]);
  assert.equal(m.rows[0].peran, "anak");
  assert.equal(m.rows[0].persetujuan_oleh, ayah);
  await assert.rejects(as(asing, `select terima_undangan($1, '2016-05-01')`, [hash]), /undangan_terpakai/);
});

test("undangan kedaluwarsa ditolak", async () => {
  const h = "c".repeat(64);
  await as(ayah, `select buat_undangan($1, 'ibu', $2, false)`, [kid, h]);
  await db.exec(`update undangan set kedaluwarsa_at = now() - interval '1 minute' where token_hash = '${h}'`);
  await assert.rejects(as(asing, `select terima_undangan($1, null)`, [h]), /undangan_kedaluwarsa/);
});

test("anak melihat teman serumah, bukan undangan", async () => {
  const p = await as(anak, `select id from profiles`);
  assert.equal(p.rows.length, 2);
  assert.equal((await as(anak, `select * from undangan`)).rows.length, 0);
});

test("anak tidak bisa mengeluarkan anggota lain, pemilik tidak bisa keluar sendiri", async () => {
  await as(anak, `delete from anggota where user_id = $1`, [ayah]);
  assert.equal((await as(ayah, `select * from anggota where keluarga_id = $1`, [kid])).rows.length, 2);
  await as(ayah, `delete from anggota where user_id = $1`, [ayah]);
  assert.equal((await as(ayah, `select * from anggota where user_id = $1`, [ayah])).rows.length, 1);
});

test("klien tidak bisa mengubah kolom selain nama, atau menjadi admin", async () => {
  await assert.rejects(as(ayah, `update profiles set privasi_disetujui_at = now() where id = $1`, [ayah]));
  await assert.rejects(as(ayah, `insert into platform_admins (user_id) values ($1)`, [ayah]));
  assert.equal((await as(ayah, `select is_admin() as a`)).rows[0].a, false);
  await db.exec(`insert into platform_admins (user_id) values ('${ayah}')`);
  assert.equal((await as(ayah, `select is_admin() as a`)).rows[0].a, true);
});

test("hapus akun ditolak untuk pemilik, jalan untuk anak", async () => {
  await assert.rejects(as(ayah, `select hapus_akun()`), /masih_pemilik/);
  await as(anak, `select hapus_akun()`);
  assert.equal((await db.query(`select * from auth.users where id = '${anak}'`)).rows.length, 0);
});

test("hapus keluarga hanya oleh pemilik", async () => {
  await assert.rejects(as(asing, `select hapus_keluarga($1)`, [kid]), /bukan_pemilik/);
  await as(ayah, `select hapus_keluarga($1)`, [kid]);
  assert.equal((await db.query(`select * from keluarga`)).rows.length, 0);
});
