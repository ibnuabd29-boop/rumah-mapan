-- Langkah 5: dashboard admin dan audit_log.
-- Admin tidak punya policy baca di tabel mana pun. Semua akses lewat fungsi di bawah yang
-- (1) memeriksa platform_admins di dalam database dan (2) menulis audit_log sebelum mengembalikan data.
-- Tidak ada fungsi admin yang menyentuh isi catatan harian anak.

create table public.audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  waktu timestamptz not null default now(),
  aksi text not null,
  objek text,
  keluarga_id uuid references public.keluarga (id) on delete set null,
  detail jsonb not null default '{}'::jsonb
);
create index audit_log_waktu_idx on public.audit_log (waktu desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

-- Aktivitas terakhir pengguna. Dibatasi satu tulis per 15 menit supaya tidak membebani basis data.
create function public.catat_aktif() returns void
language sql security definer set search_path = public as $$
  update public.profiles set aktif_terakhir = now()
  where id = auth.uid() and (aktif_terakhir is null or aktif_terakhir < now() - interval '15 minutes');
$$;

create function public._perlu_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'bukan_admin'; end if;
end;
$$;

create function public._catat(p_aksi text, p_objek text, p_keluarga uuid, p_detail jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (admin_id, aksi, objek, keluarga_id, detail)
  values (auth.uid(), p_aksi, p_objek, p_keluarga, coalesce(p_detail, '{}'::jsonb));
$$;

-- Ringkasan keluarga tanpa cek keanggotaan, dipakai fungsi admin. ringkasan_keluarga tetap mengecek.
create function public._ringkasan(p_keluarga uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hasil jsonb;
  hari date := public.hari_ini();
  beruntun int := 0;
  cek date;
begin
  cek := hari;
  if not exists (select 1 from public.bukti where keluarga_id = p_keluarga and status = 'disetujui' and tanggal = cek) then
    cek := hari - 1;
  end if;
  while exists (select 1 from public.bukti where keluarga_id = p_keluarga and status = 'disetujui' and tanggal = cek) loop
    beruntun := beruntun + 1;
    cek := cek - 1;
  end loop;

  select jsonb_build_object(
    'poin', coalesce(sum(t.poin), 0),
    'selesai', count(*),
    'poin_7hari', coalesce(sum(t.poin) filter (where b.tanggal > hari - 7), 0),
    'selesai_7hari', count(*) filter (where b.tanggal > hari - 7),
    'hari_aktif_7hari', count(distinct b.tanggal) filter (where b.tanggal > hari - 7),
    'komunikasi', count(*) filter (where t.kategori = 'komunikasi'),
    'kategori_7hari', (
      select jsonb_object_agg(k, n) from (
        select t2.kategori::text k, count(*) n
        from public.bukti b2 join public.tantangan t2 on t2.slug = b2.tantangan_slug
        where b2.keluarga_id = p_keluarga and b2.status = 'disetujui' and b2.tanggal > hari - 7
        group by t2.kategori
      ) x
    ),
    'menunggu', (select count(*) from public.bukti where keluarga_id = p_keluarga and status = 'menunggu'),
    'hari_beruntun', beruntun,
    'beruntun_terbaik', coalesce((
      select max(c) from (
        select count(*) c from (
          select tanggal, tanggal - (row_number() over (order by tanggal))::int as g
          from (select distinct tanggal from public.bukti
                where keluarga_id = p_keluarga and status = 'disetujui') d
        ) q group by g
      ) z
    ), 0)
  ) into hasil
  from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
  where b.keluarga_id = p_keluarga and b.status = 'disetujui';
  return hasil;
end;
$$;

create or replace function public.ringkasan_keluarga(p_keluarga uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  return public._ringkasan(p_keluarga);
end;
$$;

create function public._beruntun_user(p_user uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare hari date := public.hari_ini(); n int := 0; cek date;
begin
  cek := hari;
  if not exists (select 1 from public.bukti where pengirim_id = p_user and status = 'disetujui' and tanggal = cek) then
    cek := hari - 1;
  end if;
  while exists (select 1 from public.bukti where pengirim_id = p_user and status = 'disetujui' and tanggal = cek) loop
    n := n + 1; cek := cek - 1;
  end loop;
  return n;
end;
$$;

create function public.admin_ringkasan() returns jsonb
language plpgsql security definer set search_path = public as $$
declare hasil jsonb;
begin
  perform public._perlu_admin();
  select jsonb_build_object(
    'keluarga', (select count(*) from public.keluarga),
    'pengguna', (select count(*) from public.profiles),
    'aktif_7hari', (select count(*) from public.profiles where aktif_terakhir > now() - interval '7 days'),
    'selesai', (select count(*) from public.bukti where status = 'disetujui'),
    'menunggu', (select count(*) from public.bukti where status = 'menunggu'),
    'ditandai', (select count(*) from public.bukti where status = 'ditandai')
  ) into hasil;
  perform public._catat('lihat_ringkasan', null, null);
  return hasil;
end;
$$;

create function public.admin_daftar_keluarga(p_cari text default null)
returns table (
  id uuid, nama text, pemilik text, anggota bigint, poin bigint, selesai bigint,
  menunggu bigint, aktif_terakhir timestamptz, dibuat_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('daftar_keluarga', null, null, jsonb_build_object('cari', p_cari));
  return query
    select k.id, k.nama, pm.nama,
      (select count(*) from public.anggota a where a.keluarga_id = k.id),
      coalesce((select sum(t.poin) from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
                where b.keluarga_id = k.id and b.status = 'disetujui'), 0)::bigint,
      (select count(*) from public.bukti b where b.keluarga_id = k.id and b.status = 'disetujui'),
      (select count(*) from public.bukti b where b.keluarga_id = k.id and b.status = 'menunggu'),
      (select max(p.aktif_terakhir) from public.anggota a join public.profiles p on p.id = a.user_id
       where a.keluarga_id = k.id),
      k.dibuat_at
    from public.keluarga k join public.profiles pm on pm.id = k.pemilik_id
    where p_cari is null or p_cari = '' or k.nama ilike '%' || p_cari || '%' or pm.nama ilike '%' || p_cari || '%'
    order by k.dibuat_at desc
    limit 200;
end;
$$;

create function public.admin_daftar_user(
  p_cari text default null, p_peran public.peran_keluarga default null, p_aktif text default null
)
returns table (
  user_id uuid, nama text, email text, keluarga_id uuid, keluarga text, peran public.peran_keluarga,
  poin bigint, selesai bigint, hari_beruntun int, kategori_terbanyak text, aktif_terakhir timestamptz
)
language plpgsql security definer set search_path = public, auth as $$
begin
  perform public._perlu_admin();
  perform public._catat('daftar_pengguna', null, null,
    jsonb_build_object('cari', p_cari, 'peran', p_peran, 'aktif', p_aktif));
  return query
    select p.id, p.nama, u.email::text, k.id, k.nama, a.peran,
      coalesce((select sum(t.poin) from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
                where b.pengirim_id = p.id and b.keluarga_id = k.id and b.status = 'disetujui'), 0)::bigint,
      (select count(*) from public.bukti b where b.pengirim_id = p.id and b.keluarga_id = k.id and b.status = 'disetujui'),
      public._beruntun_user(p.id),
      (select t.kategori::text from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
       where b.pengirim_id = p.id and b.keluarga_id = k.id and b.status = 'disetujui'
       group by t.kategori order by count(*) desc, t.kategori limit 1),
      p.aktif_terakhir
    from public.anggota a
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = p.id
    join public.keluarga k on k.id = a.keluarga_id
    where (p_cari is null or p_cari = '' or p.nama ilike '%' || p_cari || '%' or u.email ilike '%' || p_cari || '%')
      and (p_peran is null or a.peran = p_peran)
      and (p_aktif is null or p_aktif = ''
           or (p_aktif = 'aktif' and p.aktif_terakhir > now() - interval '7 days')
           or (p_aktif = 'tidak' and (p.aktif_terakhir is null or p.aktif_terakhir <= now() - interval '7 days')))
    order by p.nama
    limit 500;
end;
$$;

create function public.admin_detail_keluarga(p_keluarga uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare hasil jsonb;
begin
  perform public._perlu_admin();
  if not exists (select 1 from public.keluarga where id = p_keluarga) then raise exception 'keluarga_tidak_ada'; end if;
  perform public._catat('lihat_keluarga', p_keluarga::text, p_keluarga);
  select jsonb_build_object(
    'keluarga', (select jsonb_build_object('id', k.id, 'nama', k.nama, 'dibuat_at', k.dibuat_at, 'pemilik', pm.nama)
                 from public.keluarga k join public.profiles pm on pm.id = k.pemilik_id where k.id = p_keluarga),
    'anggota', coalesce((select jsonb_agg(jsonb_build_object(
        'nama', p.nama, 'peran', a.peran, 'bergabung_at', a.bergabung_at, 'aktif_terakhir', p.aktif_terakhir,
        'poin', coalesce((select sum(t.poin) from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
                          where b.pengirim_id = p.id and b.keluarga_id = p_keluarga and b.status = 'disetujui'), 0),
        'selesai', (select count(*) from public.bukti b where b.pengirim_id = p.id and b.keluarga_id = p_keluarga and b.status = 'disetujui')
      ) order by a.bergabung_at)
      from public.anggota a join public.profiles p on p.id = a.user_id where a.keluarga_id = p_keluarga), '[]'::jsonb),
    'ringkasan', public._ringkasan(p_keluarga),
    'drive', coalesce((select status from public.drive_koneksi where keluarga_id = p_keluarga), 'belum'),
    'riwayat', coalesce((select jsonb_agg(r) from (
        select b.id, b.tanggal, t.judul, t.kategori, pg.nama as pengirim, b.status, b.jenis
        from public.bukti b join public.tantangan t on t.slug = b.tantangan_slug
        join public.profiles pg on pg.id = b.pengirim_id
        where b.keluarga_id = p_keluarga order by b.dibuat_at desc limit 50) r), '[]'::jsonb)
  ) into hasil;
  return hasil;
end;
$$;

create function public.admin_galeri_bukti(
  p_keluarga uuid default null, p_user uuid default null,
  p_kategori public.kategori_tantangan default null,
  p_dari date default null, p_sampai date default null,
  p_status public.status_bukti default null, p_batas int default 50
)
returns table (
  id uuid, tanggal date, keluarga_id uuid, keluarga text, pengirim text, judul text,
  kategori public.kategori_tantangan, poin int, jenis public.jenis_bukti, teks text,
  status public.status_bukti, alasan text
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('galeri_bukti', null, p_keluarga, jsonb_build_object(
    'user', p_user, 'kategori', p_kategori, 'dari', p_dari, 'sampai', p_sampai, 'status', p_status));
  return query
    select b.id, b.tanggal, b.keluarga_id, k.nama, pg.nama, t.judul, t.kategori, t.poin,
           b.jenis, b.teks, b.status, b.alasan
    from public.bukti b
    join public.keluarga k on k.id = b.keluarga_id
    join public.profiles pg on pg.id = b.pengirim_id
    join public.tantangan t on t.slug = b.tantangan_slug
    where (p_keluarga is null or b.keluarga_id = p_keluarga)
      and (p_user is null or b.pengirim_id = p_user)
      and (p_kategori is null or t.kategori = p_kategori)
      and (p_dari is null or b.tanggal >= p_dari)
      and (p_sampai is null or b.tanggal <= p_sampai)
      and (p_status is null or b.status = p_status)
    order by b.dibuat_at desc
    limit least(coalesce(p_batas, 50), 200);
end;
$$;

-- Admin boleh menyetujui, menolak, atau menandai. Hanya 'disetujui' yang dihitung sebagai poin.
create function public.admin_tinjau_bukti(p_bukti uuid, p_status public.status_bukti, p_alasan text)
returns void
language plpgsql security definer set search_path = public as $$
declare b public.bukti;
begin
  perform public._perlu_admin();
  if p_status not in ('disetujui', 'ditolak', 'ditandai') then raise exception 'status_tidak_valid'; end if;
  if p_status in ('ditolak', 'ditandai') and char_length(trim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'alasan_wajib';
  end if;
  select * into b from public.bukti where id = p_bukti for update;
  if not found then raise exception 'bukti_tidak_ada'; end if;
  begin
    update public.bukti
      set status = p_status, ditinjau_oleh = auth.uid(), ditinjau_at = now(), alasan = nullif(trim(p_alasan), '')
    where id = p_bukti;
  exception when unique_violation then
    -- Memulihkan bukti ditolak bisa bentrok dengan bukti aktif lain untuk tantangan atau isi yang sama.
    raise exception 'bentrok_bukti_aktif';
  end;
  perform public._catat('tinjau_bukti', p_bukti::text, b.keluarga_id,
    jsonb_build_object('dari', b.status, 'menjadi', p_status));
end;
$$;

-- Dipakai rute foto: mengembalikan berkas Drive bukti dan mencatat siapa yang membukanya.
create function public.admin_berkas_bukti(p_bukti uuid)
returns table (keluarga_id uuid, drive_file_id text)
language plpgsql security definer set search_path = public as $$
declare b public.bukti;
begin
  perform public._perlu_admin();
  select * into b from public.bukti where id = p_bukti;
  if not found or b.drive_file_id is null then raise exception 'bukti_tidak_ada'; end if;
  perform public._catat('lihat_foto', p_bukti::text, b.keluarga_id);
  return query select b.keluarga_id, b.drive_file_id;
end;
$$;

create function public.admin_audit_log(p_batas int default 100)
returns table (waktu timestamptz, admin text, aksi text, objek text, keluarga text, detail jsonb)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_audit', null, null);
  return query
    select l.waktu, pa.nama, l.aksi, l.objek, k.nama, l.detail
    from public.audit_log l
    join public.profiles pa on pa.id = l.admin_id
    left join public.keluarga k on k.id = l.keluarga_id
    order by l.waktu desc, l.id desc
    limit least(coalesce(p_batas, 100), 500);
end;
$$;

create function public.admin_catat_ekspor(p_baris int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('ekspor_csv', null, null, jsonb_build_object('baris', p_baris));
end;
$$;

revoke all on function
  public.catat_aktif(), public._perlu_admin(), public._catat(text, text, uuid, jsonb),
  public._ringkasan(uuid), public._beruntun_user(uuid),
  public.admin_ringkasan(), public.admin_daftar_keluarga(text),
  public.admin_daftar_user(text, public.peran_keluarga, text),
  public.admin_detail_keluarga(uuid),
  public.admin_galeri_bukti(uuid, uuid, public.kategori_tantangan, date, date, public.status_bukti, int),
  public.admin_tinjau_bukti(uuid, public.status_bukti, text),
  public.admin_berkas_bukti(uuid), public.admin_audit_log(int), public.admin_catat_ekspor(int)
  from public, anon, authenticated;
grant execute on function
  public.catat_aktif(),
  public.admin_ringkasan(), public.admin_daftar_keluarga(text),
  public.admin_daftar_user(text, public.peran_keluarga, text),
  public.admin_detail_keluarga(uuid),
  public.admin_galeri_bukti(uuid, uuid, public.kategori_tantangan, date, date, public.status_bukti, int),
  public.admin_tinjau_bukti(uuid, public.status_bukti, text),
  public.admin_berkas_bukti(uuid), public.admin_audit_log(int), public.admin_catat_ekspor(int)
  to authenticated;
-- ringkasan_keluarga dibuat ulang di atas, hak eksekusinya dikembalikan.
grant execute on function public.ringkasan_keluarga(uuid) to authenticated;
revoke execute on function public.ringkasan_keluarga(uuid) from public, anon;
