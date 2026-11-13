import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select current_setting('request.jwt.claim.role', true) $$;
  grant usage on schema auth to authenticated, anon, service_role;
  grant usage on schema public to authenticated, anon, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
`);

for (const migration of [
  "0001_akun_keluarga", "0002_tantangan_bukti", "0003_isi_tantangan",
  "0004_admin", "0005_perasaan_catatan_masa_depan", "0006_pwa_pengingat",
  "0007_konten_admin",
]) {
  await db.exec(readFileSync(`supabase/migrations/${migration}.sql`, "utf8"));
}

const buatUser = async (email, nama) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`,
    [email, JSON.stringify({ nama })])).rows[0].id;

async function as(uid, role, sql, params = []) {
  await db.exec(`set role ${role}; set request.uid = '${uid}'; set request.jwt.claim.role = '${role}'`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; reset request.uid; reset request.jwt.claim.role");
  }
}

const pemilik = await buatUser("pemilik@pwa.test", "Pemilik");
const orangLain = await buatUser("orang-lain@pwa.test", "Orang Lain");
const keluarga = (await as(pemilik, "authenticated",
  `select buat_keluarga('Rumah PWA','ayah') as id`)).rows[0].id;

test("langganan push hanya dikelola pengguna sendiri dan anggota rumah", async () => {
  const endpoint = "https://fcm.googleapis.com/push/send/perangkat-1";
  await as(pemilik, "authenticated", `
    insert into pengingat_push
      (user_id, keluarga_id, endpoint, p256dh, auth, waktu_lokal, zona_waktu)
    values ($1,$2,$3,'kunci-a','kunci-b','19:00','Asia/Jakarta')
  `, [pemilik, keluarga, endpoint]);

  assert.equal((await as(orangLain, "authenticated",
    `select * from pengingat_push`)).rows.length, 0);
  await assert.rejects(as(orangLain, "authenticated", `
    insert into pengingat_push
      (user_id, keluarga_id, endpoint, p256dh, auth)
    values ($1,$2,'https://fcm.googleapis.com/push/send/bukan-anggota','a','b')
  `, [orangLain, keluarga]));
  await assert.rejects(as(orangLain, "authenticated", `
    insert into pengingat_push
      (user_id, keluarga_id, endpoint, p256dh, auth)
    values ($1,$2,'https://fcm.googleapis.com/push/send/menyamar','a','b')
  `, [pemilik, keluarga]));
  await assert.rejects(as(pemilik, "authenticated",
    `update pengingat_push set claim_sampai = now()`));
});

test("pengiriman push hanya dapat diklaim server dan sekali per hari lokal", async () => {
  const endpoint = "https://fcm.googleapis.com/push/send/perangkat-2";
  await as(pemilik, "authenticated", `
    insert into pengingat_push
      (user_id, keluarga_id, endpoint, p256dh, auth, waktu_lokal, zona_waktu)
    values ($1,$2,$3,'kunci-a','kunci-b',
      (date_trunc('minute', now() at time zone 'Asia/Jakarta'))::time,
      'Asia/Jakarta')
  `, [pemilik, keluarga, endpoint]);

  await assert.rejects(as(pemilik, "authenticated",
    `select * from klaim_pengingat_harian(now())`));

  const sekarang = new Date().toISOString();
  const klaim = await as(pemilik, "service_role",
    `select * from klaim_pengingat_harian($1::timestamptz)`, [sekarang]);
  assert.equal(klaim.rows.length, 1);
  assert.equal(klaim.rows[0].endpoint, endpoint);
  assert.equal(klaim.rows[0].zona_waktu, "Asia/Jakarta");

  const selesai = await as(pemilik, "service_role",
    `select selesaikan_pengingat_push($1,$2,true) as ok`,
    [klaim.rows[0].id, klaim.rows[0].tanggal_lokal]);
  assert.equal(selesai.rows[0].ok, true);

  const ulang = await as(pemilik, "service_role",
    `select * from klaim_pengingat_harian($1::timestamptz)`, [sekarang]);
  assert.equal(ulang.rows.length, 0);
});
