create type public.segmen_tantangan as enum ('berani', 'beraksi', 'berkolaborasi');

alter table public.tantangan
  add column segmen public.segmen_tantangan;

alter table public.tantangan_harian
  add column anak_id uuid references public.profiles (id) on delete cascade;
alter table public.tantangan_harian
  drop constraint tantangan_harian_pkey;
create unique index tantangan_harian_rumah_hari_unik
  on public.tantangan_harian (keluarga_id, tanggal)
  where anak_id is null;
create unique index tantangan_harian_anak_hari_unik
  on public.tantangan_harian (keluarga_id, tanggal, anak_id)
  where anak_id is not null;

alter table public.bukti
  add column anak_id uuid references public.profiles (id) on delete cascade;
drop index public.bukti_satu_aktif;
drop index public.bukti_hash_unik;
create unique index bukti_satu_aktif_umum
  on public.bukti (keluarga_id, tantangan_slug, tanggal)
  where anak_id is null and status in ('menunggu', 'disetujui', 'ditandai');
create unique index bukti_satu_aktif_anak
  on public.bukti (keluarga_id, tantangan_slug, tanggal, anak_id)
  where anak_id is not null and status in ('menunggu', 'disetujui', 'ditandai');
create unique index bukti_hash_unik
  on public.bukti (keluarga_id, hash)
  where status in ('menunggu', 'disetujui', 'ditandai');
create index bukti_anak_idx on public.bukti (keluarga_id, anak_id, tanggal desc);

create function public.segmen_usia_anak(p_tgl_lahir date, p_hari date default public.hari_ini())
returns public.segmen_tantangan
language plpgsql stable set search_path = public as $$
declare
  umur int;
begin
  if p_tgl_lahir is null or p_tgl_lahir > p_hari then return null; end if;
  umur := extract(year from age(p_hari, p_tgl_lahir))::int;
  return case
    when umur between 10 and 14 then 'berani'::public.segmen_tantangan
    when umur between 15 and 19 then 'beraksi'::public.segmen_tantangan
    when umur between 20 and 24 then 'berkolaborasi'::public.segmen_tantangan
    else null
  end;
end;
$$;

drop function public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean);
create function public.atur_tantangan_hari_ini(
  p_keluarga uuid,
  p_mode public.mode_hari,
  p_ganti boolean default false,
  p_anak uuid default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  hari date := public.hari_ini();
  ada public.tantangan_harian;
  pilihan text;
  segmen_target public.segmen_tantangan;
  tgl_lahir date;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;

  if p_anak is not null then
    select p.tgl_lahir into tgl_lahir
    from public.anggota a
    join public.profiles p on p.id = a.user_id
    where a.keluarga_id = p_keluarga and a.user_id = p_anak and a.peran = 'anak';
    if not found then raise exception 'anak_tidak_ada'; end if;
    if auth.uid() <> p_anak and not public.is_parent_role(p_keluarga) then
      raise exception 'khusus_orang_tua';
    end if;
    segmen_target := public.segmen_usia_anak(tgl_lahir, hari);
  elsif not public.is_parent_role(p_keluarga) then
    raise exception 'khusus_orang_tua';
  end if;

  select * into ada from public.tantangan_harian
  where keluarga_id = p_keluarga and tanggal = hari
    and anak_id is not distinct from p_anak;

  if found and ada.mode = p_mode and not p_ganti and not ada.dilewati then
    return ada.tantangan_slug;
  end if;
  if found and not public.is_parent_role(p_keluarga) then raise exception 'khusus_orang_tua'; end if;
  if found and exists (
    select 1 from public.bukti b
    where b.keluarga_id = p_keluarga and b.tantangan_slug = ada.tantangan_slug
      and b.tanggal = hari and b.anak_id is not distinct from p_anak
      and b.status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'sudah_ada_bukti'; end if;

  select t.slug into pilihan
  from public.tantangan t
  where t.aktif
    and (t.segmen is null or t.segmen = segmen_target)
    and (
      (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
      or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
      or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
    )
    and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    and not exists (
      select 1 from public.bukti b
      where b.keluarga_id = p_keluarga and b.tantangan_slug = t.slug
        and b.anak_id is not distinct from p_anak
        and b.tanggal > hari - 14 and b.status in ('menunggu', 'disetujui')
    )
  order by random() limit 1;

  if pilihan is null then
    select t.slug into pilihan from public.tantangan t
    where t.aktif
      and (t.segmen is null or t.segmen = segmen_target)
      and (
        (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
        or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
        or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
      )
      and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    order by random() limit 1;
  end if;
  if pilihan is null and ada.tantangan_slug is not null then
    select t.slug into pilihan from public.tantangan t
    where t.slug = ada.tantangan_slug and t.aktif
      and (t.segmen is null or t.segmen = segmen_target);
  end if;
  if pilihan is null then raise exception 'tantangan_tidak_tersedia'; end if;

  if p_anak is null then
    insert into public.tantangan_harian (keluarga_id, tanggal, tantangan_slug, mode, dilewati)
    values (p_keluarga, hari, pilihan, p_mode, false)
    on conflict (keluarga_id, tanggal) where anak_id is null do update
      set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  else
    insert into public.tantangan_harian (keluarga_id, tanggal, anak_id, tantangan_slug, mode, dilewati)
    values (p_keluarga, hari, p_anak, pilihan, p_mode, false)
    on conflict (keluarga_id, tanggal, anak_id) where anak_id is not null do update
      set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  end if;
  return pilihan;
end;
$$;

drop function public.lewati_tantangan(uuid);
create function public.lewati_tantangan(p_keluarga uuid, p_anak uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  if p_anak is not null and not exists (
    select 1 from public.anggota where keluarga_id = p_keluarga and user_id = p_anak and peran = 'anak'
  ) then raise exception 'anak_tidak_ada'; end if;
  if p_anak is not null and auth.uid() <> p_anak and not public.is_parent_role(p_keluarga) then
    raise exception 'khusus_orang_tua';
  end if;
  if p_anak is null and not public.is_parent_role(p_keluarga) then
    raise exception 'khusus_orang_tua';
  end if;
  update public.tantangan_harian set dilewati = true
  where keluarga_id = p_keluarga and tanggal = public.hari_ini()
    and anak_id is not distinct from p_anak;
end;
$$;

create or replace function public._validasi_tantangan_aktif_bukti() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.tantangan t
    where t.slug = new.tantangan_slug and t.aktif
  ) and not exists (
    select 1 from public.tantangan_harian h
    where h.keluarga_id = new.keluarga_id
      and h.tanggal = new.tanggal
      and h.tantangan_slug = new.tantangan_slug
      and h.anak_id is not distinct from new.anak_id
  ) then
    raise exception 'tantangan_diarsipkan';
  end if;
  return new;
end;
$$;

drop function public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text);
create function public.kirim_bukti(
  p_keluarga uuid,
  p_tantangan text,
  p_jenis public.jenis_bukti,
  p_teks text,
  p_hash text,
  p_drive_file_id text,
  p_drive_sumber text default 'keluarga',
  p_anak uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
  huruf int;
  t public.tantangan;
  segmen_target public.segmen_tantangan;
  tgl_lahir date;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  select * into t from public.tantangan where slug = p_tantangan;
  if not found then raise exception 'tantangan_tidak_ada'; end if;

  if p_anak is null and t.segmen is not null then raise exception 'anak_wajib'; end if;
  if p_anak is not null then
    select p.tgl_lahir into tgl_lahir
    from public.anggota a
    join public.profiles p on p.id = a.user_id
    where a.keluarga_id = p_keluarga and a.user_id = p_anak and a.peran = 'anak';
    if not found then raise exception 'anak_tidak_ada'; end if;
    if auth.uid() <> p_anak and not public.is_parent_role(p_keluarga) then
      raise exception 'khusus_orang_tua';
    end if;
    segmen_target := public.segmen_usia_anak(tgl_lahir);
    if t.segmen is not null and t.segmen is distinct from segmen_target then
      raise exception 'segmen_tidak_sesuai';
    end if;
  end if;

  if p_jenis = 'cerita' then
    huruf := char_length(regexp_replace(coalesce(p_teks, ''), '[^[:alpha:]]', '', 'g'));
    if huruf < 20 then raise exception 'cerita_terlalu_pendek'; end if;
  end if;
  if p_jenis = 'foto' and p_drive_file_id is null then raise exception 'foto_tanpa_berkas'; end if;
  if p_drive_sumber is null or p_drive_sumber not in ('keluarga', 'admin') then
    raise exception 'drive_sumber_tidak_valid';
  end if;
  if p_jenis = 'foto' and p_drive_sumber = 'admin'
     and not exists (
       select 1 from public.drive_admin_koneksi
       where id = 'utama' and status = 'tersambung'
     ) then
    raise exception 'drive_admin_belum_terhubung';
  end if;
  if char_length(coalesce(p_hash, '')) <> 64 then raise exception 'hash_tidak_valid'; end if;

  if exists (
    select 1 from public.bukti
    where keluarga_id = p_keluarga and hash = p_hash
      and status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'bukti_kembar'; end if;
  if exists (
    select 1 from public.bukti
    where keluarga_id = p_keluarga and tantangan_slug = p_tantangan
      and tanggal = public.hari_ini() and anak_id is not distinct from p_anak
      and status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'sudah_dikirim_hari_ini'; end if;

  insert into public.bukti (
    keluarga_id, tantangan_slug, anak_id, pengirim_id, jenis, teks,
    drive_file_id, drive_sumber, hash
  )
  values (
    p_keluarga, p_tantangan, p_anak, auth.uid(), p_jenis, nullif(trim(p_teks), ''),
    p_drive_file_id, case when p_jenis = 'foto' then p_drive_sumber else 'keluarga' end, p_hash
  )
  returning id into bid;
  return bid;
end;
$$;

create or replace function public.admin_daftar_konten() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_konten', null, null);
  return jsonb_build_object(
    'tantangan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug, 'kategori', t.kategori, 'segmen', t.segmen,
        'judul', t.judul, 'isi', t.isi,
        'menit', t.menit, 'poin', t.poin, 'peringatan', t.peringatan,
        'aktif', t.aktif,
        'poin_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        ),
        'kategori_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        ),
        'segmen_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        )
      ) order by t.kategori, t.judul)
      from public.tantangan t
    ), '[]'::jsonb),
    'kelompok', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jenis', k.jenis, 'slug', k.slug, 'nama', k.nama
      ) order by k.jenis, k.nama)
      from public.kelompok_pertanyaan k
    ), '[]'::jsonb),
    'pertanyaan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'jenis', p.jenis, 'kelompok', p.kelompok, 'teks', p.teks,
        'aktif', p.aktif
      ) order by p.jenis, k.nama, p.dibuat_at, p.id)
      from public.pertanyaan_konten p
      join public.kelompok_pertanyaan k
        on k.jenis = p.jenis and k.slug = p.kelompok
    ), '[]'::jsonb)
  );
end;
$$;

drop function public.admin_simpan_tantangan(
  text, public.kategori_tantangan, text, text, int, int, text
);
create function public.admin_simpan_tantangan(
  p_slug text,
  p_kategori public.kategori_tantangan,
  p_judul text,
  p_isi text,
  p_menit int,
  p_poin int,
  p_peringatan text,
  p_segmen public.segmen_tantangan default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  poin_lama int;
  kategori_lama public.kategori_tantangan;
  segmen_lama public.segmen_tantangan;
  aktif_lama boolean;
begin
  perform public._perlu_admin();
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_slug) > 80 then
    raise exception 'slug_tidak_valid';
  end if;
  if char_length(btrim(coalesce(p_judul, ''))) not between 3 and 100 then
    raise exception 'judul_tidak_valid';
  end if;
  if char_length(btrim(coalesce(p_isi, ''))) not between 5 and 2000 then
    raise exception 'isi_tidak_valid';
  end if;
  if p_kategori is null then raise exception 'kategori_tidak_valid'; end if;
  if p_menit is null or p_menit not between 3 and 120 then raise exception 'durasi_tidak_valid'; end if;
  if p_poin is null or p_poin not between 5 and 30 then raise exception 'poin_tidak_valid'; end if;
  if char_length(coalesce(p_peringatan, '')) > 500 then raise exception 'peringatan_tidak_valid'; end if;

  select t.poin, t.kategori, t.segmen, t.aktif
    into poin_lama, kategori_lama, segmen_lama, aktif_lama
    from public.tantangan t
    where t.slug = p_slug for update;
  if found then
    if exists (select 1 from public.bukti b where b.tantangan_slug = p_slug) then
      if poin_lama <> p_poin then raise exception 'poin_tidak_boleh_diubah'; end if;
      if kategori_lama <> p_kategori then raise exception 'kategori_tidak_boleh_diubah'; end if;
      if segmen_lama is distinct from p_segmen then raise exception 'segmen_tidak_boleh_diubah'; end if;
    end if;
    if aktif_lama and kategori_lama <> p_kategori and not exists (
      select 1 from public.tantangan lain
      where lain.kategori = kategori_lama and lain.aktif and lain.slug <> p_slug
    ) then
      raise exception 'tantangan_terakhir_kategori';
    end if;
    update public.tantangan
    set kategori = p_kategori, segmen = p_segmen, judul = btrim(p_judul), isi = btrim(p_isi),
        menit = p_menit, poin = p_poin, peringatan = nullif(btrim(coalesce(p_peringatan, '')), '')
    where slug = p_slug;
  else
    begin
      insert into public.tantangan (slug, kategori, segmen, judul, isi, menit, poin, peringatan)
      values (
        p_slug, p_kategori, p_segmen, btrim(p_judul), btrim(p_isi), p_menit, p_poin,
        nullif(btrim(coalesce(p_peringatan, '')), '')
      );
    exception when unique_violation then
      raise exception 'slug_sudah_dipakai';
    end;
  end if;
  perform public._catat('simpan_tantangan', p_slug, null,
    jsonb_build_object('judul', btrim(p_judul), 'kategori', p_kategori, 'segmen', p_segmen));
  return p_slug;
end;
$$;

-- Konten segmen ini adalah draf awal dan perlu ditinjau sebelum digunakan luas.
insert into public.tantangan (slug, kategori, segmen, judul, isi, menit, poin) values
  ('peta-kebiasaan-belajar-berani', 'kemandirian', 'berani', 'Peta kebiasaan belajar', 'Ceritakan satu hal yang sedang kamu pelajari. Bersama keluarga, pilih satu langkah kecil yang bisa kamu coba sendiri minggu ini.', 15, 10),
  ('cerita-dari-sudutmu-berani', 'komunikasi', 'berani', 'Cerita dari sudutmu', 'Pilih satu kejadian hari ini dan ceritakan apa yang kamu pikirkan. Minta satu anggota keluarga mengulang inti ceritamu, lalu luruskan jika ada yang terlewat.', 10, 10),
  ('ide-hemat-air-berani', 'kreativitas', 'berani', 'Satu ide hemat air', 'Amati kebiasaan di rumah yang memakai air. Usulkan satu perubahan sederhana yang aman dan mudah dicoba bersama keluarga.', 15, 10),
  ('bagi-tugas-berani', 'kebersamaan', 'berani', 'Bagi tugas bersama', 'Pilih satu pekerjaan ringan di rumah. Bagi langkahnya bersama keluarga, lalu kerjakan bagianmu tanpa mengambil alih tugas orang lain.', 15, 10),
  ('rencana-mingguan-beraksi', 'kemandirian', 'beraksi', 'Rencana satu minggu', 'Pilih satu tujuan kecil untuk minggu ini. Catat langkah, waktu yang dibutuhkan, dan dukungan keluarga yang kamu inginkan.', 20, 15),
  ('periksa-informasi-beraksi', 'kreativitas', 'beraksi', 'Periksa satu informasi', 'Pilih informasi umum yang kamu temui hari ini. Bersama keluarga, cek siapa sumbernya, kapan dibuat, dan apakah ada sumber tepercaya lain yang mendukungnya.', 20, 15),
  ('rencana-belanja-tujuan-beraksi', 'kemandirian', 'beraksi', 'Rencana untuk satu tujuan', 'Pilih tujuan yang ingin kamu capai. Buat perkiraan kebutuhan dan langkah menabung atau mengatur waktu, tanpa perlu membagikan nominal pribadi.', 20, 15),
  ('latihan-menyampaikan-pendapat-beraksi', 'komunikasi', 'beraksi', 'Sampaikan pendapat dengan jelas', 'Pilih topik ringan yang sedang dibicarakan keluarga. Sampaikan pendapatmu beserta alasannya, lalu dengarkan tanggapan tanpa harus langsung sepakat.', 15, 15),
  ('peta-peran-rumah-berkolaborasi', 'kebersamaan', 'berkolaborasi', 'Peta peran di rumah', 'Tuliskan pekerjaan rutin yang membuat rumah berjalan. Bahas siapa yang mengerjakannya dan sepakati satu pembagian tugas yang terasa lebih seimbang.', 20, 15),
  ('tujuan-bersama-berkolaborasi', 'komunikasi', 'berkolaborasi', 'Tujuan bersama keluarga', 'Pilih satu hal yang ingin diwujudkan keluarga dalam beberapa bulan ke depan. Tentukan langkah awal, siapa yang bersedia membantu, dan kapan mengeceknya lagi.', 20, 15),
  ('berbagi-keahlian-berkolaborasi', 'kreativitas', 'berkolaborasi', 'Berbagi satu keahlian', 'Ajarkan satu keterampilan yang kamu kuasai kepada anggota keluarga. Minta mereka mencoba, lalu tanyakan bagian mana yang perlu dijelaskan dengan cara lain.', 20, 15),
  ('rencana-kegiatan-lingkungan-berkolaborasi', 'empati', 'berkolaborasi', 'Rancang kegiatan kecil bersama', 'Pilih satu kebutuhan sederhana di lingkungan sekitar yang bisa dibantu bersama tanpa mengeluarkan biaya besar. Rencanakan langkah yang aman dan minta izin sebelum melakukannya.', 20, 15)
on conflict (slug) do nothing;

revoke all on function
  public.segmen_usia_anak(date, date),
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean, uuid),
  public.lewati_tantangan(uuid, uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text, uuid),
  public.admin_daftar_konten(),
  public.admin_simpan_tantangan(text, public.kategori_tantangan, text, text, int, int, text, public.segmen_tantangan)
  from public, anon, authenticated;
grant execute on function
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean, uuid),
  public.lewati_tantangan(uuid, uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text, uuid)
  to authenticated;
grant execute on function
  public.admin_daftar_konten(),
  public.admin_simpan_tantangan(text, public.kategori_tantangan, text, text, int, int, text, public.segmen_tantangan)
  to authenticated;
