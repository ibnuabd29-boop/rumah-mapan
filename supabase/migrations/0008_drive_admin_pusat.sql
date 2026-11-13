-- Foto baru masuk ke satu folder Drive milik admin platform.

create table public.drive_admin_koneksi (
  id text primary key check (id = 'utama'),
  refresh_token_enc text not null,
  folder_id text not null,
  status text not null default 'tersambung' check (status in ('tersambung', 'terputus')),
  terhubung_oleh uuid references public.profiles (id) on delete set null,
  diperbarui_at timestamptz not null default now()
);

alter table public.drive_admin_koneksi enable row level security;
revoke all on public.drive_admin_koneksi from anon, authenticated;

alter table public.bukti
  add column drive_sumber text not null default 'keluarga'
    check (drive_sumber in ('keluarga', 'admin'));

create function public.status_drive_pusat(p_keluarga uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when public.is_member(p_keluarga) then coalesce(
    (select status from public.drive_admin_koneksi where id = 'utama'),
    'belum'
  ) else 'belum' end;
$$;

create function public.admin_status_drive()
returns table (status text, folder_id text)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_drive_admin', null, null);
  return query
    select coalesce((select d.status from public.drive_admin_koneksi d where d.id = 'utama'), 'belum'),
           (select d.folder_id from public.drive_admin_koneksi d where d.id = 'utama');
end;
$$;

create function public.admin_catat_drive_terhubung() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('hubungkan_drive_admin', null, null);
end;
$$;

drop function public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text);

create function public.kirim_bukti(
  p_keluarga uuid, p_tantangan text, p_jenis public.jenis_bukti,
  p_teks text, p_hash text, p_drive_file_id text,
  p_drive_sumber text default 'keluarga'
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

  if exists (select 1 from public.bukti where keluarga_id = p_keluarga and hash = p_hash
             and status in ('menunggu', 'disetujui', 'ditandai')) then
    raise exception 'bukti_kembar';
  end if;
  if exists (select 1 from public.bukti where keluarga_id = p_keluarga and tantangan_slug = p_tantangan
             and tanggal = public.hari_ini() and status in ('menunggu', 'disetujui', 'ditandai')) then
    raise exception 'sudah_dikirim_hari_ini';
  end if;

  insert into public.bukti (
    keluarga_id, tantangan_slug, pengirim_id, jenis, teks, drive_file_id, drive_sumber, hash
  )
  values (
    p_keluarga, p_tantangan, auth.uid(), p_jenis, nullif(trim(p_teks), ''),
    p_drive_file_id, case when p_jenis = 'foto' then p_drive_sumber else 'keluarga' end, p_hash
  )
  returning id into bid;
  return bid;
end;
$$;

drop function public.admin_berkas_bukti(uuid);

create function public.admin_berkas_bukti(p_bukti uuid)
returns table (keluarga_id uuid, drive_file_id text, drive_sumber text)
language plpgsql security definer set search_path = public as $$
declare b public.bukti;
begin
  perform public._perlu_admin();
  select * into b from public.bukti where id = p_bukti;
  if not found or b.drive_file_id is null then raise exception 'bukti_tidak_ada'; end if;
  perform public._catat('lihat_foto', p_bukti::text, b.keluarga_id);
  return query select b.keluarga_id, b.drive_file_id, b.drive_sumber;
end;
$$;

revoke all on function
  public.status_drive_pusat(uuid), public.admin_status_drive(),
  public.admin_catat_drive_terhubung(),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text),
  public.admin_berkas_bukti(uuid)
  from public, anon, authenticated;

grant execute on function public.status_drive_pusat(uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text)
  to authenticated;

grant execute on function public.admin_status_drive(), public.admin_catat_drive_terhubung(),
  public.admin_berkas_bukti(uuid)
  to authenticated;
