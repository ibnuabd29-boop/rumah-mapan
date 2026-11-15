import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant usage on schema public to authenticated, anon;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`);

for (const migrasi of [
  "0001_akun_keluarga",
  "0002_tantangan_bukti",
  "0003_isi_tantangan",
  "0004_admin",
  "0005_perasaan_catatan_masa_depan",
  "0006_pwa_pengingat",
  "0007_konten_admin",
  "0008_drive_admin_pusat",
  "0009_tantangan_segmen_anak",
  "0010_fitur_tantangan_layanan",
  "0011_admin_fitur_pengguna",
  "0012_lencana_rentang_masa",
]) {
  await db.exec(readFileSync(`supabase/migrations/${migrasi}.sql`, "utf8"));
}

async function user(email, nama) {
  const result = await db.query(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ nama })],
  );
  return result.rows[0].id;
}

async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; set request.uid = '${uid}'`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role; reset request.uid");
  }
}

const admin = await user("admin@contoh.test", "Admin");
const keluargaSatu = await user("satu@contoh.test", "Keluarga Satu");
const keluargaDua = await user("dua@contoh.test", "Keluarga Dua");
const psikolog = await user("psikolog@contoh.test", "Psikolog");
await db.exec(`insert into platform_admins (user_id) values ('${admin}')`);
const rumahSatu = (await as(keluargaSatu, `select buat_keluarga('Rumah Satu', 'ayah') as id`)).rows[0].id;
const rumahDua = (await as(keluargaDua, `select buat_keluarga('Rumah Dua', 'ayah') as id`)).rows[0].id;
const cerita = "Kami bercerita tentang hari ini dan saling mendengarkan dengan tenang";

async function simpanTantangan(slug, judul, keluargaIds, dipin = false, tenggat = null) {
  return as(admin, `
    select admin_simpan_tantangan_lanjutan(
      $1, 'komunikasi', $2, 'Isi tantangan untuk keluarga bersama.', 10, 10, null,
      null, $3, $4, false, $5::uuid[]
    )
  `, [slug, judul, dipin, tenggat, keluargaIds]);
}

test("sasaran keluarga membatasi daftar dan pengiriman bukti", async () => {
  await simpanTantangan("khusus-satu", "Tantangan rumah satu", [rumahSatu], true, "2999-01-02");
  assert.equal((await as(keluargaSatu, `select slug from tantangan where slug='khusus-satu'`)).rows.length, 1);
  assert.equal((await as(keluargaDua, `select slug from tantangan where slug='khusus-satu'`)).rows.length, 0);
  await assert.rejects(
    as(keluargaDua, `select kirim_bukti($1,'khusus-satu','cerita',$2,$3,null)`, [
      rumahDua, cerita, "a".repeat(64),
    ]),
    /tantangan_bukan_sasaran/,
  );
  await assert.rejects(as(keluargaDua, `select * from tantangan_keluarga`));
});

test("tantangan untuk semua keluarga tetap tersedia tanpa relasi sasaran", async () => {
  await as(admin, `
    select admin_simpan_tantangan_lanjutan(
      'semua-rumah', 'komunikasi', 'Tantangan semua rumah',
      'Instruksi tantangan untuk semua keluarga.', 10, 10, null,
      null, false, null, true, '{}'::uuid[]
    )
  `);
  assert.equal((await as(keluargaSatu, `select slug from tantangan where slug='semua-rumah'`)).rows.length, 1);
  assert.equal((await as(keluargaDua, `select slug from tantangan where slug='semua-rumah'`)).rows.length, 1);
});

test("lencana poin dapat dikonfigurasi admin dan poin terus terakumulasi", async () => {
  const id = (await as(admin, `
    select admin_simpan_lencana(null, 'Lencana uji', 'keluarga', 5, true) as id
  `)).rows[0].id;
  assert.equal((await as(keluargaSatu, `select id from lencana_poin where id=$1`, [id])).rows.length, 1);
  await simpanTantangan("poin-satu", "Tantangan poin satu", [rumahSatu]);
  await simpanTantangan("poin-dua", "Tantangan poin dua", [rumahSatu]);
  const buktiSatu = (await as(keluargaSatu, `
    select kirim_bukti($1,'poin-satu','cerita',$2,$3,null) as id
  `, [rumahSatu, cerita, "b".repeat(64)])).rows[0].id;
  const buktiDua = (await as(keluargaSatu, `
    select kirim_bukti($1,'poin-dua','cerita',$2,$3,null) as id
  `, [rumahSatu, cerita + " lagi", "c".repeat(64)])).rows[0].id;
  await as(admin, `select admin_tinjau_bukti($1, 'disetujui', null)`, [buktiSatu]);
  await as(admin, `select admin_tinjau_bukti($1, 'disetujui', null)`, [buktiDua]);
  const ringkasan = (await as(keluargaSatu, `select ringkasan_keluarga($1) as data`, [rumahSatu])).rows[0].data;
  assert.equal(ringkasan.poin, 20);
  assert.ok(ringkasan.poin > 5);
});

test("lencana punya rentang poin dan masa berlaku, serta tetap dimiliki setelah didapat", async () => {
  const keluargaPoin = await user("rentang-lencana@contoh.test", "Rumah Rentang");
  const rumahPoin = (await as(keluargaPoin, `select buat_keluarga('Rumah Rentang', 'ayah') as id`)).rows[0].id;
  const berakhir = "2999-12-31T23:59:00+07:00";

  const lencanaRentang = (await as(admin, `
    select admin_simpan_lencana_rentang(
      null, 'Lencana rentang', 'keluarga', 10, 20, $1::timestamptz, true
    ) as id
  `, [berakhir])).rows[0].id;
  const lencanaKedua = (await as(admin, `
    select admin_simpan_lencana_rentang(
      null, 'Lencana kedua', 'tantangan', 20, 30, $1::timestamptz, true
    ) as id
  `, [berakhir])).rows[0].id;
  const lencanaKedaluwarsa = (await as(admin, `
    select admin_simpan_lencana_rentang(
      null, 'Lencana kedaluwarsa', 'syukur', 1, 100, now() - interval '1 minute', true
    ) as id
  `)).rows[0].id;

  await assert.rejects(as(keluargaPoin, `
    select * from daftar_lencana_keluarga($1)
  `, [rumahSatu]), /bukan_anggota/);
  await assert.rejects(as(keluargaPoin, `
    insert into lencana_poin_keluarga (keluarga_id, lencana_id, poin_dicapai)
    values ($1, $2, 10)
  `, [rumahPoin, lencanaRentang]), /permission denied/);
  await assert.rejects(as(admin, `
    select admin_simpan_lencana_rentang(null, 'Rentang salah', 'keluarga', 20, 10, null, true)
  `), /poin_maksimum_tidak_valid/);

  const daftarAwal = await as(keluargaPoin, `
    select id from daftar_lencana_keluarga($1)
  `, [rumahPoin]);
  assert.equal(daftarAwal.rows.some((row) => row.id === lencanaKedaluwarsa), false);

  for (let nomor = 1; nomor <= 4; nomor += 1) {
    const slug = `badge-rentang-${nomor}`;
    await simpanTantangan(slug, `Tantangan rentang ${nomor}`, [rumahPoin]);
    const bukti = (await as(keluargaPoin, `
      select kirim_bukti($1, $2, 'cerita', $3, $4, null) as id
    `, [rumahPoin, slug, cerita + ` ${nomor}`, String(nomor).padStart(64, "e")])).rows[0].id;
    await as(admin, `select admin_tinjau_bukti($1, 'disetujui', null)`, [bukti]);

    if (nomor === 1) {
      assert.equal((await as(keluargaPoin, `
        select terbuka from daftar_lencana_keluarga($1) where id=$2
      `, [rumahPoin, lencanaRentang])).rows[0].terbuka, true);
      await db.query(`
        update lencana_poin set berlaku_sampai = now() - interval '1 second' where id=$1
      `, [lencanaRentang]);
    }
    if (nomor === 2) {
      assert.equal((await as(keluargaPoin, `
        select terbuka from daftar_lencana_keluarga($1) where id=$2
      `, [rumahPoin, lencanaKedua])).rows[0].terbuka, true);
    }
  }

  const milik = await as(keluargaPoin, `
    select lencana_id, poin_dicapai from lencana_poin_keluarga
    where keluarga_id=$1 and lencana_id in ($2, $3, $4) order by lencana_id
  `, [rumahPoin, lencanaRentang, lencanaKedua, lencanaKedaluwarsa]);
  assert.deepEqual(
    milik.rows.map((row) => row.lencana_id).sort(),
    [lencanaRentang, lencanaKedua].sort(),
  );
  assert.equal(
    milik.rows.find((row) => row.lencana_id === lencanaRentang).poin_dicapai,
    10,
  );
  assert.equal((await as(keluargaPoin, `
    select terbuka from daftar_lencana_keluarga($1) where id=$2
  `, [rumahPoin, lencanaRentang])).rows[0].terbuka, true);
  assert.equal((await as(keluargaPoin, `
    select count(*)::int as jumlah from lencana_poin_keluarga
    where keluarga_id=$1 and lencana_id=$2
  `, [rumahPoin, lencanaKedaluwarsa])).rows[0].jumlah, 0);
});

test("layanan kesehatan mental hanya terbaca pengirim dan psikolog yang ditunjuk", async () => {
  const laporan = (await as(keluargaSatu, `
    insert into layanan_masuk (pengguna_id, jenis, isi)
    values ($1, 'kesehatan_mental', 'Saya ingin bicara dengan tenaga profesional.')
    returning id
  `, [keluargaSatu])).rows[0].id;
  assert.equal((await as(keluargaDua, `select id from layanan_masuk where id=$1`, [laporan])).rows.length, 0);
  assert.equal((await as(admin, `select id from layanan_masuk where id=$1`, [laporan])).rows.length, 0);
  await db.exec(`insert into layanan_konselor (pengguna_id, jenis) values ('${psikolog}', 'kesehatan_mental')`);
  assert.equal((await as(psikolog, `select id from layanan_masuk where id=$1`, [laporan])).rows.length, 1);
  await as(psikolog, `update layanan_masuk set status='ditinjau' where id=$1`, [laporan]);
  const perubahanAdmin = await as(admin, `
    update layanan_masuk set status='selesai' where id=$1 returning id
  `, [laporan]);
  assert.equal(perubahanAdmin.rows.length, 0);
  assert.equal(
    (await db.query(`select status from layanan_masuk where id=$1`, [laporan])).rows[0].status,
    "ditinjau",
  );
});

test("tantangan baru, pin, dan tenggat masuk antrean perangkat yang sesuai", async () => {
  await as(keluargaSatu, `
    insert into pengingat_push (user_id, keluarga_id, endpoint, p256dh, auth)
    values ($1, $2, 'https://fcm.googleapis.com/uji', 'kunci', 'rahasia')
  `, [keluargaSatu, rumahSatu]);
  await as(keluargaDua, `
    insert into pengingat_push (user_id, keluarga_id, endpoint, p256dh, auth)
    values ($1, $2, 'https://fcm.googleapis.com/uji-dua', 'kunci', 'rahasia')
  `, [keluargaDua, rumahDua]);
  await simpanTantangan("notifikasi-uji", "Tantangan notifikasi", [rumahSatu], true, "2999-01-02");
  const antrean = await db.query(`
    select jenis, keluarga_id from pengingat_event_push
    where kunci like '%notifikasi-uji%' order by jenis
  `);
  assert.deepEqual(antrean.rows.map((row) => row.jenis), ["tantangan_dipin", "tantangan_baru", "tenggat"].sort());
  assert.ok(antrean.rows.every((row) => row.keluarga_id === rumahSatu));
});

test("admin hanya mendapat daftar kritik dan saran, bukan pengaduan rahasia", async () => {
  await as(keluargaSatu, `
    insert into layanan_masuk (pengguna_id, jenis, isi)
    values ($1, 'kritik_saran', 'Tampilan kalender lebih mudah dibaca.')
  `, [keluargaSatu]);
  assert.equal((await as(admin, `select * from admin_daftar_layanan_saran()`)).rows.length, 1);
  assert.equal((await as(admin, `select * from layanan_masuk where jenis='kesehatan_mental'`)).rows.length, 0);
});

test("admin anggota rumah dapat memakai fitur anggota tanpa akses lintas rumah", async () => {
  const rumahAdmin = (await as(admin, `select buat_keluarga('Rumah Admin', 'ayah') as id`)).rows[0].id;
  const adminAnak = await user("anak-admin@contoh.test", "Anak Admin");
  const token = "d".repeat(64);
  await as(admin, `select buat_undangan($1, 'anak', $2, true)`, [rumahAdmin, token]);
  await as(adminAnak, `select terima_undangan($1, '2015-01-01')`, [token]);

  await as(admin, `select simpan_checkin($1, 'tenang')`, [rumahAdmin]);
  assert.equal((await as(admin, `
    select user_id from checkin_perasaan where keluarga_id=$1
  `, [rumahAdmin])).rows[0].user_id, admin);

  const cita = (await as(admin, `
    insert into cita_cita (keluarga_id, pembuat_id, judul, alasan)
    values ($1, $2, 'Belajar bersama', 'Ingin membaca bersama keluarga.')
    returning id
  `, [rumahAdmin, admin])).rows[0].id;
  const langkah = (await as(admin, `
    insert into langkah_cita_cita (keluarga_id, cita_cita_id, pembuat_id, isi)
    values ($1, $2, $3, 'Pilih satu bacaan')
    returning id
  `, [rumahAdmin, cita, admin])).rows[0].id;
  await as(admin, `select tandai_langkah($1, true)`, [langkah]);
  await as(admin, `select tandai_materi_selesai($1, 'fungsi-keluarga')`, [rumahAdmin]);
  await as(admin, `
    insert into apresiasi (keluarga_id, pengirim_id, penerima_id, isi)
    values ($1, $2, $3, 'Terima kasih sudah menemani.')
  `, [rumahAdmin, admin, adminAnak]);

  const bacaan = await as(admin, `
    select materi_slug from materi_selesai where keluarga_id=$1 and user_id=$2
  `, [rumahAdmin, admin]);
  assert.deepEqual(bacaan.rows.map((row) => row.materi_slug), ["fungsi-keluarga"]);
  assert.equal((await as(admin, `select id from apresiasi where keluarga_id=$1`, [rumahAdmin])).rows.length, 1);

  await as(keluargaSatu, `select simpan_checkin($1, 'senang')`, [rumahSatu]);
  assert.equal((await as(admin, `
    select id from checkin_perasaan where keluarga_id=$1
  `, [rumahSatu])).rows.length, 0);

  await as(admin, `
    insert into pengingat_push (user_id, keluarga_id, endpoint, p256dh, auth)
    values ($1, $2, 'https://fcm.googleapis.com/admin-uji', 'kunci', 'rahasia')
  `, [admin, rumahAdmin]);
  assert.equal((await as(admin, `
    select id from pengingat_push where user_id=$1 and keluarga_id=$2
  `, [admin, rumahAdmin])).rows.length, 1);

  const pesan = (await as(admin, `
    insert into layanan_masuk (pengguna_id, jenis, isi)
    values ($1, 'kesehatan_mental', 'Saya ingin berbicara secara rahasia.')
    returning id
  `, [admin])).rows[0].id;
  assert.equal((await as(admin, `select id from layanan_masuk where id=$1`, [pesan])).rows.length, 1);
  assert.equal((await as(keluargaSatu, `select id from layanan_masuk where id=$1`, [pesan])).rows.length, 0);
});

test("admin orang tua hanya melihat catatan anak yang dibagikan di rumahnya", async () => {
  const rumahAdmin = (await as(admin, `select id from keluarga where pemilik_id=$1`, [admin])).rows[0].id;
  const adminAnak = (await db.query(`select id from auth.users where email='anak-admin@contoh.test'`)).rows[0].id;
  const shared = (await db.query(`
    insert into catatan_harian (keluarga_id, penulis_id, isi, dibagikan)
    values ($1, $2, 'Catatan yang dibagikan kepada keluarga.', true)
    returning id
  `, [rumahAdmin, adminAnak])).rows[0].id;
  const privateNote = (await db.query(`
    insert into catatan_harian (keluarga_id, penulis_id, isi, dibagikan)
    values ($1, $2, 'Catatan pribadi anak.', false)
    returning id
  `, [rumahAdmin, adminAnak])).rows[0].id;
  await db.query(`
    insert into catatan_harian (keluarga_id, penulis_id, isi, dibagikan)
    values ($1, $2, 'Catatan rumah lain.', true)
  `, [rumahSatu, keluargaSatu]);

  assert.equal((await as(admin, `select id from catatan_harian where id=$1`, [shared])).rows.length, 1);
  assert.equal((await as(admin, `select id from catatan_harian where id=$1`, [privateNote])).rows.length, 0);
  assert.equal((await as(admin, `
    select id from catatan_harian where isi='Catatan rumah lain.'
  `)).rows.length, 0);
});
