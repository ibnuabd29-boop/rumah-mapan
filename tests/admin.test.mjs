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
for (const f of [
  "0001_akun_keluarga", "0002_tantangan_bukti", "0003_isi_tantangan",
  "0004_admin", "0007_konten_admin", "0008_drive_admin_pusat", "0009_tantangan_segmen_anak",
]) {
  await db.exec(readFileSync(`supabase/migrations/${f}.sql`, "utf8"));
}

const user = async (email, nama) =>
  (await db.query(`insert into auth.users (email, raw_user_meta_data) values ($1,$2) returning id`,
    [email, JSON.stringify({ nama })])).rows[0].id;
async function as(uid, sql, params = []) {
  await db.exec(`set role authenticated; set request.uid = '${uid}'`);
  try { return await db.query(sql, params); } finally { await db.exec(`reset role; reset request.uid`); }
}

const admin = await user("admin@x.test", "Admin");
await db.exec(`insert into platform_admins (user_id) values ('${admin}')`);
const ayah = await user("ayah@x.test", "Ayah");
const anak = await user("anak@x.test", "Anak");
const ayah2 = await user("ayah2@x.test", "Ayah Lain");
const kid = (await as(ayah, `select buat_keluarga('Rumah Satu','ayah') as id`)).rows[0].id;
const kid2 = (await as(ayah2, `select buat_keluarga('Rumah Dua','ayah') as id`)).rows[0].id;
await as(ayah, `select buat_undangan($1,'anak',$2,true)`, [kid, "1".repeat(64)]);
await as(anak, `select terima_undangan($1,'2015-01-01')`, ["1".repeat(64)]);
await db.exec(`
  update profiles set tgl_lahir = (hari_ini() - interval '11 years')::date where id = '${anak}';
`);
const h = (c) => c.repeat(64);
const CERITA = "Kami bercerita tentang hari ini dan saling mendengarkan dengan tenang";
const b1 = (await as(anak, `select kirim_bukti($1,'tiga-pujian','cerita',$2,$3,null) as id`, [kid, CERITA, h("a")])).rows[0].id;
await as(ayah, `select tinjau_bukti($1,'disetujui',null)`, [b1]);
const b2 = (await as(anak, `select kirim_bukti($1,'masak-bersama','cerita',$2,$3,null) as id`, [kid, CERITA + " lagi", h("b")])).rows[0].id;
const b3 = (await as(ayah2, `select kirim_bukti($1,'piket-rumah','cerita',$2,$3,null) as id`, [kid2, CERITA + " rumah dua", h("c")])).rows[0].id;
const audit = async () => (await db.query(`select aksi, admin_id from audit_log order by id`)).rows;
const poin = async () => (await as(ayah, `select ringkasan_keluarga($1) as r`, [kid])).rows[0].r.poin;

const FUNGSI = [
  `admin_ringkasan()`,
  `admin_daftar_keluarga(null)`,
  `admin_daftar_user(null, null, null)`,
  `admin_detail_keluarga('${kid}')`,
  `admin_galeri_bukti()`,
  `admin_audit_log(10)`,
  `admin_catat_ekspor(1)`,
  `admin_berkas_bukti('${b1}')`,
  `admin_tinjau_bukti('${b2}', 'ditandai', 'tidak pantas')`,
];

test("pengguna biasa ditolak di semua fungsi admin, dan tidak meninggalkan jejak audit", async () => {
  for (const u of [ayah, anak]) {
    for (const f of FUNGSI) {
      await assert.rejects(as(u, `select * from ${f}`), /bukan_admin/, f);
    }
  }
  assert.equal((await audit()).length, 0);
});

test("fungsi internal tidak bisa dipanggil langsung oleh pengguna", async () => {
  await assert.rejects(as(admin, `select _catat('palsu', null, null)`));
  await assert.rejects(as(ayah, `select _ringkasan('${kid}')`));
  await assert.rejects(as(ayah, `select _perlu_admin()`));
});

test("admin tidak membaca tabel secara langsung dan audit_log tertutup bagi semua klien", async () => {
  for (const t of ["bukti", "keluarga", "anggota", "undangan"]) {
    assert.equal((await as(admin, `select * from ${t}`)).rows.length, 0, t);
  }
  await assert.rejects(as(admin, `select * from audit_log`));
  await assert.rejects(as(admin, `insert into audit_log (admin_id, aksi) values ('${admin}', 'x')`));
  await assert.rejects(as(admin, `delete from audit_log`));
  await assert.rejects(as(ayah, `select * from audit_log`));
});

test("ringkasan admin menghitung dengan benar dan mencatat audit", async () => {
  const r = (await as(admin, `select admin_ringkasan() as r`)).rows[0].r;
  assert.equal(r.keluarga, 2);
  assert.equal(r.pengguna, 4);
  assert.equal(r.selesai, 1);
  assert.equal(r.menunggu, 2);
  const a = await audit();
  assert.equal(a.at(-1).aksi, "lihat_ringkasan");
  assert.equal(a.at(-1).admin_id, admin);
});

test("aktif 7 hari memakai catat_aktif dan dibatasi satu tulis per 15 menit", async () => {
  assert.equal((await as(admin, `select admin_ringkasan() as r`)).rows[0].r.aktif_7hari, 0);
  await as(ayah, `select catat_aktif()`);
  const t1 = (await db.query(`select aktif_terakhir from profiles where id='${ayah}'`)).rows[0].aktif_terakhir;
  await as(ayah, `select catat_aktif()`);
  const t2 = (await db.query(`select aktif_terakhir from profiles where id='${ayah}'`)).rows[0].aktif_terakhir;
  assert.equal(t1.getTime(), t2.getTime());
  assert.equal((await as(admin, `select admin_ringkasan() as r`)).rows[0].r.aktif_7hari, 1);
});

test("daftar keluarga: pencarian dan angka per keluarga", async () => {
  const r = await as(admin, `select * from admin_daftar_keluarga('satu')`);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].nama, "Rumah Satu");
  assert.equal(Number(r.rows[0].poin), 10);
  assert.equal(Number(r.rows[0].anggota), 2);
  assert.equal(Number(r.rows[0].menunggu), 1);
  assert.equal((await as(admin, `select * from admin_daftar_keluarga(null)`)).rows.length, 2);
});

test("daftar user: filter peran dan aktif, statistik per user, tanpa data catatan", async () => {
  const semua = await as(admin, `select * from admin_daftar_user(null, null, null)`);
  assert.equal(semua.rows.length, 3);
  const a = await as(admin, `select * from admin_daftar_user(null, 'anak', null)`);
  assert.equal(a.rows.length, 1);
  assert.equal(Number(a.rows[0].poin), 10);
  assert.equal(a.rows[0].kategori_terbanyak, "komunikasi");
  assert.equal(a.rows[0].email, "anak@x.test");
  assert.deepEqual(Object.keys(a.rows[0]).filter((k) => /catatan|isi|teks/.test(k)), []);
  const aktif = await as(admin, `select * from admin_daftar_user(null, null, 'aktif')`);
  assert.deepEqual(aktif.rows.map((x) => x.nama), ["Ayah"]);
  const tidak = await as(admin, `select * from admin_daftar_user(null, null, 'tidak')`);
  assert.equal(tidak.rows.length, 2);
  assert.equal((await as(admin, `select * from admin_daftar_user('ayah2', null, null)`)).rows.length, 1);
});

test("detail keluarga memuat anggota, ringkasan, dan riwayat", async () => {
  const d = (await as(admin, `select admin_detail_keluarga('${kid}') as d`)).rows[0].d;
  assert.equal(d.keluarga.nama, "Rumah Satu");
  assert.equal(d.anggota.length, 2);
  assert.equal(d.ringkasan.poin, 10);
  assert.equal(d.riwayat.length, 2);
  await assert.rejects(as(admin, `select admin_detail_keluarga('${admin}')`), /keluarga_tidak_ada/);
});

test("galeri bukti: filter keluarga, status, kategori, tanggal", async () => {
  const q = (args) => as(admin, `select * from admin_galeri_bukti(${args})`);
  assert.equal((await q("")).rows.length, 3);
  assert.equal((await q(`'${kid2}'`)).rows.length, 1);
  assert.equal((await q(`null, null, null, null, null, 'disetujui'`)).rows.length, 1);
  assert.equal((await q(`null, null, 'komunikasi'`)).rows.length, 1);
  assert.equal((await q(`null, '${anak}'`)).rows.length, 2);
  assert.equal((await q(`null, null, null, '2999-01-01'`)).rows.length, 0);
});

test("admin menyetujui, menolak, menandai: poin ikut berubah, alasan wajib untuk tolak dan tandai", async () => {
  assert.equal(await poin(), 10);
  await assert.rejects(as(admin, `select admin_tinjau_bukti('${b2}','ditolak',' ')`), /alasan_wajib/);
  await assert.rejects(as(admin, `select admin_tinjau_bukti('${b2}','menunggu',null)`), /status_tidak_valid/);
  await as(admin, `select admin_tinjau_bukti('${b2}','disetujui',null)`);
  assert.equal(await poin(), 10 + 20);
  await as(admin, `select admin_tinjau_bukti('${b2}','ditandai','Foto tidak pantas untuk anak')`);
  assert.equal(await poin(), 10);
  const st = (await db.query(`select status, alasan, ditinjau_oleh from bukti where id='${b2}'`)).rows[0];
  assert.equal(st.status, "ditandai");
  assert.equal(st.ditinjau_oleh, admin);
  await as(admin, `select admin_tinjau_bukti('${b1}','ditolak','Bukti tidak sesuai tantangan')`);
  assert.equal(await poin(), 0);
  await as(admin, `select admin_tinjau_bukti('${b1}','disetujui',null)`);
  assert.equal(await poin(), 10);
});

test("memulihkan bukti yang bentrok dengan bukti aktif lain gagal dengan pesan jelas", async () => {
  await as(admin, `select admin_tinjau_bukti('${b3}','ditolak','Tidak sesuai')`);
  await as(ayah2, `select kirim_bukti($1,'piket-rumah','cerita',$2,$3,null)`, [kid2, CERITA + " versi baru", h("d")]);
  await assert.rejects(as(admin, `select admin_tinjau_bukti('${b3}','disetujui',null)`), /bentrok_bukti_aktif/);
});

test("berkas dan ekspor tercatat; log hanya terbaca admin dan memuat siapa, kapan, apa", async () => {
  const fotoId = (await db.query(`insert into bukti (keluarga_id, tantangan_slug, tanggal, pengirim_id, jenis, drive_file_id, hash, status)
    values ('${kid}','jalan-sore-keluarga', hari_ini() - 3, '${anak}', 'foto', 'drv123', '${h("e")}', 'disetujui') returning id`)).rows[0].id;
  const r = await as(admin, `select * from admin_berkas_bukti('${fotoId}')`);
  assert.equal(r.rows[0].drive_file_id, "drv123");
  assert.equal(r.rows[0].drive_sumber, "keluarga");
  await as(admin, `select admin_catat_ekspor(3)`);
  const log = (await as(admin, `select * from admin_audit_log(500)`)).rows;
  const aksi = log.map((x) => x.aksi);
  for (const a of ["lihat_foto", "ekspor_csv", "tinjau_bukti", "galeri_bukti", "daftar_pengguna", "lihat_keluarga"]) {
    assert.ok(aksi.includes(a), `tidak ada ${a}`);
  }
  assert.ok(log.every((x) => x.admin === "Admin" && x.waktu));
});

test("foto baru memakai Drive pusat admin; token tertutup dan status hanya terlihat anggota", async () => {
  assert.equal(
    (await as(ayah, `select status_drive_pusat($1) as status`, [kid])).rows[0].status,
    "belum",
  );
  await db.exec(`
    insert into drive_admin_koneksi (id, refresh_token_enc, folder_id, terhubung_oleh)
    values ('utama', 'token-terenkripsi', 'folder-admin', '${admin}');
  `);
  await assert.rejects(as(admin, `select * from drive_admin_koneksi`));
  assert.equal(
    (await as(ayah, `select status_drive_pusat($1) as status`, [kid])).rows[0].status,
    "tersambung",
  );
  assert.equal(
    (await as(ayah2, `select status_drive_pusat($1) as status`, [kid])).rows[0].status,
    "belum",
  );

  const fotoId = (await as(anak, `
    select kirim_bukti($1,'jalan-sore-keluarga','foto',null,$2,'foto-admin-1','admin') as id
  `, [kid, h("f")])).rows[0].id;
  assert.equal(
    (await db.query(`select drive_sumber from bukti where id = $1`, [fotoId])).rows[0].drive_sumber,
    "admin",
  );
  const berkas = await as(admin, `select * from admin_berkas_bukti($1)`, [fotoId]);
  assert.equal(berkas.rows[0].drive_sumber, "admin");
  assert.equal(berkas.rows[0].drive_file_id, "foto-admin-1");

  await assert.rejects(
    as(anak, `select kirim_bukti($1,'masak-bersama','foto',null,$2,'foto-2','lain')`, [kid, h("g")]),
    /drive_sumber_tidak_valid/,
  );
  await as(admin, `select admin_catat_drive_terhubung()`);
  const status = await as(admin, `select * from admin_status_drive()`);
  assert.equal(status.rows[0].status, "tersambung");
  assert.equal(status.rows[0].folder_id, "folder-admin");
  assert.ok((await audit()).some((x) => x.aksi === "hubungkan_drive_admin"));
});

test("ringkasan_keluarga untuk anggota tetap bekerja dan orang luar tetap ditolak", async () => {
  assert.equal((await as(ayah, `select ringkasan_keluarga('${kid}') as r`)).rows[0].r.selesai >= 1, true);
  await assert.rejects(as(ayah2, `select ringkasan_keluarga('${kid}')`), /bukan_anggota/);
  await assert.rejects(as(admin, `select ringkasan_keluarga('${kid}')`), /bukan_anggota/);
});

test("segmen usia memakai ulang tahun terakhir dan mencakup batas umur", async () => {
  const kasus = [
    ["2016-11-14", "berani"],
    ["2012-11-14", "berani"],
    ["2011-11-14", "beraksi"],
    ["2007-11-14", "beraksi"],
    ["2006-11-14", "berkolaborasi"],
    ["2002-11-14", "berkolaborasi"],
    ["2016-11-15", null],
    ["2001-11-14", null],
  ];
  for (const [lahir, segmen] of kasus) {
    const hasil = (await db.query(
      `select segmen_usia_anak($1::date, '2026-11-14'::date) as segmen`,
      [lahir],
    )).rows[0].segmen;
    assert.equal(hasil, segmen, `tanggal lahir ${lahir}`);
  }
  const konten = await db.query(`
    select segmen::text as segmen, count(*)::int as jumlah
    from tantangan where aktif group by segmen
  `);
  const jumlahPerSegmen = new Map(konten.rows.map((r) => [r.segmen, r.jumlah]));
  for (const segmen of ["berani", "beraksi", "berkolaborasi"]) {
    assert.ok((jumlahPerSegmen.get(segmen) ?? 0) >= 4, `konten aktif segmen ${segmen}`);
  }
});

test("penugasan harian dan bukti terpisah per anak serta menolak segmen yang salah", async () => {
  const anak2 = await user("anak2@x.test", "Anak Dua");
  await as(ayah, `select buat_undangan($1,'anak',$2,true)`, [kid, "2".repeat(64)]);
  await as(anak2, `select terima_undangan($1,'2010-01-01')`, ["2".repeat(64)]);
  await db.query(`update profiles set tgl_lahir = (hari_ini() - interval '17 years')::date where id = $1`, [anak2]);

  await as(admin, `
    select admin_simpan_tantangan(
      'uji-segmen-berani', 'komunikasi', 'Tugas BERANI', 'Bicarakan satu hal bersama keluarga.', 10, 10, null, 'berani'
    )
  `);
  await as(admin, `
    select admin_simpan_tantangan(
      'uji-segmen-beraksi', 'komunikasi', 'Tugas BERAKSI', 'Rencanakan satu langkah bersama keluarga.', 10, 10, null, 'beraksi'
    )
  `);
  await as(admin, `
    select admin_simpan_tantangan(
      'uji-segmen-berkolaborasi', 'komunikasi', 'Tugas BERKOLABORASI', 'Susun rencana bersama keluarga.', 10, 10, null, 'berkolaborasi'
    )
  `);

  await db.exec(`
    update tantangan set aktif = false
    where segmen is null and kategori not in ('sepulang_kerja', 'ke_tempat_kerja');
  `);
  let tugasBerani;
  let tugasBeraksi;
  try {
    tugasBerani = (await as(ayah, `
      select atur_tantangan_hari_ini($1, 'biasa', false, $2) as slug
    `, [kid, anak])).rows[0].slug;
    tugasBeraksi = (await as(ayah, `
      select atur_tantangan_hari_ini($1, 'biasa', false, $2) as slug
    `, [kid, anak2])).rows[0].slug;
  } finally {
    await db.exec(`update tantangan set aktif = true where segmen is null`);
  }
  const segmenBerani = (await db.query(`select segmen from tantangan where slug = $1`, [tugasBerani])).rows[0].segmen;
  const segmenBeraksi = (await db.query(`select segmen from tantangan where slug = $1`, [tugasBeraksi])).rows[0].segmen;
  assert.equal(segmenBerani, "berani");
  assert.equal(segmenBeraksi, "beraksi");

  await assert.rejects(as(anak, `
    select kirim_bukti($1, 'uji-segmen-beraksi', 'cerita', $2, $3, null, 'keluarga', $4)
  `, [kid, CERITA, h("j"), anak]), /segmen_tidak_sesuai/);

  const buktiAnak = (await as(ayah, `
    select kirim_bukti($1, 'tiga-pujian', 'cerita', $2, $3, null, 'keluarga', $4) as id
  `, [kid, CERITA, h("k"), anak])).rows[0].id;
  const buktiAnakDua = (await as(ayah, `
    select kirim_bukti($1, 'tiga-pujian', 'cerita', $2, $3, null, 'keluarga', $4) as id
  `, [kid, CERITA + " bersama keluarga", h("l"), anak2])).rows[0].id;
  assert.notEqual(buktiAnak, buktiAnakDua);
  assert.equal((await db.query(`
    select count(*)::int as jumlah from bukti
    where id in ($1, $2) and anak_id is not null
  `, [buktiAnak, buktiAnakDua])).rows[0].jumlah, 2);
});

test("admin mengelola tantangan sambil menjaga tugas dan poin historis", async () => {
  await db.exec(`update tantangan set aktif = false where kategori = 'ke_tempat_kerja'`);
  const buatTantangan = async (slug, judul) => as(admin, `
    select admin_simpan_tantangan($1, 'ke_tempat_kerja', $2, 'Ajak anak mengamati kegiatan bersama.', 10, 10, null) as slug
  `, [slug, judul]);
  await buatTantangan("uji-tantangan-satu", "Tantangan uji satu");
  await buatTantangan("uji-tantangan-dua", "Tantangan uji dua");

  const pilihan = (await as(ayah2, `select atur_tantangan_hari_ini($1,'hari_kunjungan',false) as slug`, [kid2])).rows[0].slug;
  const berikut = pilihan === "uji-tantangan-satu" ? "uji-tantangan-dua" : "uji-tantangan-satu";
  await as(admin, `select admin_status_tantangan($1,false)`, [pilihan]);
  assert.equal(
    (await as(ayah2, `select atur_tantangan_hari_ini($1,'hari_kunjungan',false) as slug`, [kid2])).rows[0].slug,
    pilihan,
    "tantangan yang sudah dipilih hari ini tetap berlaku setelah diarsipkan",
  );

  const buktiArsip = (await as(ayah2, `
    select kirim_bukti($1,$2,'cerita',$3,$4,null) as id
  `, [kid2, pilihan, CERITA, h("f")])).rows[0].id;
  await as(ayah2, `select hapus_bukti($1)`, [buktiArsip]);
  assert.equal(
    (await as(ayah2, `select atur_tantangan_hari_ini($1,'hari_kunjungan',true) as slug`, [kid2])).rows[0].slug,
    berikut,
    "tantangan arsip tidak dipilih ulang",
  );
  await assert.rejects(
    as(admin, `select admin_status_tantangan($1,false)`, [berikut]),
    /tantangan_terakhir_kategori/,
  );

  const buktiAktif = (await as(ayah2, `
    select kirim_bukti($1,$2,'cerita',$3,$4,null) as id
  `, [kid2, berikut, CERITA + " versi aktif", h("g")])).rows[0].id;
  await as(admin, `select admin_tinjau_bukti($1,'disetujui',null)`, [buktiAktif]);
  await assert.rejects(
    as(admin, `
      select admin_simpan_tantangan($1,'ke_tempat_kerja','Judul berubah','Ajak anak mengamati kegiatan bersama.',10,15,null)
    `, [berikut]),
    /poin_tidak_boleh_diubah/,
  );
  await assert.rejects(
    as(admin, `
      select admin_simpan_tantangan($1,'komunikasi','Judul berubah','Ajak anak mengamati kegiatan bersama.',10,10,null)
    `, [berikut]),
    /kategori_tidak_boleh_diubah/,
  );
  await assert.rejects(
    as(ayah, `select admin_daftar_konten()`),
    /bukan_admin/,
  );

  const konten = (await as(admin, `select admin_daftar_konten() as k`)).rows[0].k;
  const itemArsip = konten.tantangan.find((item) => item.slug === pilihan);
  const itemBerpoin = konten.tantangan.find((item) => item.slug === berikut);
  assert.equal(itemArsip.aktif, false);
  assert.equal(itemBerpoin.poin_terkunci, true);
});

test("admin mengelola pertanyaan; arsip tetap tersimpan dan tidak tampak bagi pengguna", async () => {
  const id = (await as(admin, `
    select admin_simpan_pertanyaan(null,'obrolan','hati','Pertanyaan tambahan untuk keluarga') as id
  `)).rows[0].id;
  assert.equal(
    (await as(ayah, `select teks from pertanyaan_konten where id = $1`, [id])).rows[0].teks,
    "Pertanyaan tambahan untuk keluarga",
  );
  await assert.rejects(
    as(ayah, `select admin_simpan_pertanyaan(null,'obrolan','hati','Pertanyaan tidak sah')`),
    /bukan_admin/,
  );
  await assert.rejects(
    as(ayah, `insert into pertanyaan_konten (jenis, kelompok, teks) values ('obrolan','hati','Tidak boleh langsung')`),
  );

  await as(admin, `select admin_status_pertanyaan($1,false)`, [id]);
  assert.equal((await as(ayah, `select * from pertanyaan_konten where id = $1`, [id])).rows.length, 0);
  const archived = (await db.query(`select aktif, teks from pertanyaan_konten where id = '${id}'`)).rows[0];
  assert.equal(archived.aktif, false);
  assert.equal(archived.teks, "Pertanyaan tambahan untuk keluarga");
  await as(admin, `select admin_status_pertanyaan($1,true)`, [id]);
  assert.equal((await as(ayah, `select * from pertanyaan_konten where id = $1`, [id])).rows.length, 1);
  await db.exec(`set role anon`);
  try {
    assert.equal((await db.query(`select * from kelompok_pertanyaan`)).rows.length, 12);
    assert.ok((await db.query(`select * from pertanyaan_konten where aktif`)).rows.length >= 29);
  } finally {
    await db.exec(`reset role`);
  }
});
