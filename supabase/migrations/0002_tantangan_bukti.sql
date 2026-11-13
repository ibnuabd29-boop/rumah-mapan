-- Langkah 4: tantangan, bukti, persetujuan, poin, ringkasan.
-- Poin tidak disimpan: selalu dihitung dari bukti berstatus 'disetujui', jadi menghapus bukti menghapus poinnya.

create type public.kategori_tantangan as enum
  ('komunikasi', 'kebersamaan', 'empati', 'kemandirian', 'kreativitas', 'sepulang_kerja', 'ke_tempat_kerja');
create type public.mode_hari as enum ('biasa', 'pulang_kerja', 'hari_kunjungan');
create type public.jenis_bukti as enum ('foto', 'cerita');
create type public.status_bukti as enum ('menunggu', 'disetujui', 'ditolak', 'ditandai');

create function public.hari_ini() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

create table public.tantangan (
  slug text primary key,
  kategori public.kategori_tantangan not null,
  judul text not null,
  isi text not null,
  menit int not null check (menit between 3 and 120),
  poin int not null check (poin between 5 and 30),
  peringatan text
);

create table public.tantangan_harian (
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  tanggal date not null,
  tantangan_slug text not null references public.tantangan (slug),
  mode public.mode_hari not null default 'biasa',
  dilewati boolean not null default false,
  primary key (keluarga_id, tanggal)
);

create table public.bukti (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  tantangan_slug text not null references public.tantangan (slug),
  tanggal date not null default public.hari_ini(),
  pengirim_id uuid not null references public.profiles (id) on delete cascade,
  jenis public.jenis_bukti not null,
  teks text check (teks is null or char_length(teks) <= 2000),
  drive_file_id text,
  hash text not null,
  status public.status_bukti not null default 'menunggu',
  ditinjau_oleh uuid references public.profiles (id) on delete set null,
  ditinjau_at timestamptz,
  alasan text,
  dibuat_at timestamptz not null default now(),
  check (jenis <> 'foto' or drive_file_id is not null),
  check (jenis <> 'cerita' or teks is not null)
);
create index bukti_keluarga_idx on public.bukti (keluarga_id, tanggal desc);
-- Satu bukti aktif per tantangan per hari per rumah. Bukti ditolak boleh dikirim ulang.
create unique index bukti_satu_aktif on public.bukti (keluarga_id, tantangan_slug, tanggal)
  where status in ('menunggu', 'disetujui', 'ditandai');
-- Bukti yang sama persis tidak boleh dipakai dua kali di rumah yang sama.
create unique index bukti_hash_unik on public.bukti (keluarga_id, hash)
  where status in ('menunggu', 'disetujui', 'ditandai');

-- Token Drive hanya dibaca server (service role). Tidak ada policy untuk klien.
create table public.drive_koneksi (
  keluarga_id uuid primary key references public.keluarga (id) on delete cascade,
  refresh_token_enc text not null,
  folder_id text,
  status text not null default 'tersambung' check (status in ('tersambung', 'terputus')),
  diperbarui_at timestamptz not null default now()
);

alter table public.tantangan enable row level security;
alter table public.tantangan_harian enable row level security;
alter table public.bukti enable row level security;
alter table public.drive_koneksi enable row level security;

create policy tantangan_baca on public.tantangan for select to authenticated using (true);
create policy harian_baca on public.tantangan_harian for select to authenticated
  using (public.is_member(keluarga_id));
create policy bukti_baca on public.bukti for select to authenticated
  using (public.is_member(keluarga_id));

revoke all on public.tantangan, public.tantangan_harian, public.bukti, public.drive_koneksi from anon;
revoke insert, update, delete on public.tantangan, public.tantangan_harian, public.bukti from authenticated;
revoke all on public.drive_koneksi from authenticated;

-- Status Drive yang boleh dilihat anggota: tanpa token.
create function public.status_drive(p_keluarga uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status from public.drive_koneksi where keluarga_id = p_keluarga and public.is_member(p_keluarga)),
    'belum'
  );
$$;

-- Memilih tantangan untuk hari ini sesuai situasi ayah. p_ganti = ambil yang lain dari yang sekarang.
create function public.atur_tantangan_hari_ini(
  p_keluarga uuid, p_mode public.mode_hari, p_ganti boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  hari date := public.hari_ini();
  ada public.tantangan_harian;
  pilihan text;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  select * into ada from public.tantangan_harian where keluarga_id = p_keluarga and tanggal = hari;

  if found and ada.mode = p_mode and not p_ganti and not ada.dilewati then
    return ada.tantangan_slug;
  end if;
  if found and not public.is_parent_role(p_keluarga) then raise exception 'khusus_orang_tua'; end if;
  if found and exists (
    select 1 from public.bukti b
    where b.keluarga_id = p_keluarga and b.tantangan_slug = ada.tantangan_slug
      and b.tanggal = hari and b.status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'sudah_ada_bukti'; end if;

  select t.slug into pilihan
  from public.tantangan t
  where (
      (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
      or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
      or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
    )
    and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    and not exists (
      select 1 from public.bukti b
      where b.keluarga_id = p_keluarga and b.tantangan_slug = t.slug
        and b.tanggal > hari - 14 and b.status in ('menunggu', 'disetujui')
    )
  order by random() limit 1;

  if pilihan is null then
    select t.slug into pilihan from public.tantangan t
    where (
        (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
        or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
        or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
      ) and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    order by random() limit 1;
  end if;
  if pilihan is null then pilihan := ada.tantangan_slug; end if;

  insert into public.tantangan_harian (keluarga_id, tanggal, tantangan_slug, mode, dilewati)
  values (p_keluarga, hari, pilihan, p_mode, false)
  on conflict (keluarga_id, tanggal) do update
    set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  return pilihan;
end;
$$;

create function public.lewati_tantangan(p_keluarga uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_parent_role(p_keluarga) then raise exception 'khusus_orang_tua'; end if;
  update public.tantangan_harian set dilewati = true
  where keluarga_id = p_keluarga and tanggal = public.hari_ini();
end;
$$;

create function public.kirim_bukti(
  p_keluarga uuid, p_tantangan text, p_jenis public.jenis_bukti,
  p_teks text, p_hash text, p_drive_file_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
  huruf int;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  if not exists (select 1 from public.tantangan where slug = p_tantangan) then
    raise exception 'tantangan_tidak_ada';
  end if;
  if p_jenis = 'cerita' then
    huruf := char_length(regexp_replace(coalesce(p_teks, ''), '[^[:alpha:]]', '', 'g'));
    if huruf < 20 then raise exception 'cerita_terlalu_pendek'; end if;
  end if;
  if p_jenis = 'foto' and p_drive_file_id is null then raise exception 'foto_tanpa_berkas'; end if;
  if char_length(coalesce(p_hash, '')) <> 64 then raise exception 'hash_tidak_valid'; end if;

  if exists (select 1 from public.bukti where keluarga_id = p_keluarga and hash = p_hash
             and status in ('menunggu', 'disetujui', 'ditandai')) then
    raise exception 'bukti_kembar';
  end if;
  if exists (select 1 from public.bukti where keluarga_id = p_keluarga and tantangan_slug = p_tantangan
             and tanggal = public.hari_ini() and status in ('menunggu', 'disetujui', 'ditandai')) then
    raise exception 'sudah_dikirim_hari_ini';
  end if;

  insert into public.bukti (keluarga_id, tantangan_slug, pengirim_id, jenis, teks, drive_file_id, hash)
  values (p_keluarga, p_tantangan, auth.uid(), p_jenis, nullif(trim(p_teks), ''), p_drive_file_id, p_hash)
  returning id into bid;
  return bid;
end;
$$;

-- Penilai harus anggota lain. Bukti anak hanya bisa dinilai orang tua atau wali.
create function public.tinjau_bukti(p_bukti uuid, p_status public.status_bukti, p_alasan text)
returns void
language plpgsql security definer set search_path = public as $$
declare b public.bukti; peran_pengirim public.peran_keluarga;
begin
  select * into b from public.bukti where id = p_bukti for update;
  if not found or not public.is_member(b.keluarga_id) then raise exception 'bukti_tidak_ada'; end if;
  if b.pengirim_id = auth.uid() then raise exception 'tidak_boleh_menilai_sendiri'; end if;
  if b.status <> 'menunggu' then raise exception 'sudah_dinilai'; end if;
  if p_status not in ('disetujui', 'ditolak') then raise exception 'status_tidak_valid'; end if;
  if p_status = 'ditolak' and char_length(trim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'alasan_wajib';
  end if;
  select peran into peran_pengirim from public.anggota
    where keluarga_id = b.keluarga_id and user_id = b.pengirim_id;
  if peran_pengirim = 'anak' and not public.is_parent_role(b.keluarga_id) then
    raise exception 'khusus_orang_tua';
  end if;
  update public.bukti
    set status = p_status, ditinjau_oleh = auth.uid(), ditinjau_at = now(),
        alasan = nullif(trim(p_alasan), '')
  where id = p_bukti;
end;
$$;

-- Mengembalikan id berkas Drive agar server bisa menghapus berkasnya. Poin ikut hilang karena dihitung dari baris ini.
create function public.hapus_bukti(p_bukti uuid) returns text
language plpgsql security definer set search_path = public as $$
declare b public.bukti;
begin
  select * into b from public.bukti where id = p_bukti for update;
  if not found then raise exception 'bukti_tidak_ada'; end if;
  if b.pengirim_id <> auth.uid() and not public.is_owner(b.keluarga_id) then
    raise exception 'tidak_berhak';
  end if;
  delete from public.bukti where id = p_bukti;
  return b.drive_file_id;
end;
$$;

-- Angka beranda. Semua dihitung dari bukti yang disetujui, tanpa data contoh.
create function public.ringkasan_keluarga(p_keluarga uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hasil jsonb;
  hari date := public.hari_ini();
  beruntun int := 0;
  cek date;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;

  -- Hari beruntun: mundur dari hari ini (atau kemarin bila hari ini belum ada) selama tiap hari ada bukti disetujui.
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

revoke all on function
  public.hari_ini(), public.status_drive(uuid),
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean),
  public.lewati_tantangan(uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text),
  public.tinjau_bukti(uuid, public.status_bukti, text),
  public.hapus_bukti(uuid), public.ringkasan_keluarga(uuid)
  from public, anon;
grant execute on function
  public.hari_ini(), public.status_drive(uuid),
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean),
  public.lewati_tantangan(uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text),
  public.tinjau_bukti(uuid, public.status_bukti, text),
  public.hapus_bukti(uuid), public.ringkasan_keluarga(uuid)
  to authenticated;
