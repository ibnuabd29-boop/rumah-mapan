-- Langkah 3: profil, keluarga, anggota, undangan, admin platform.
-- Semua tulis ke keluarga/anggota/undangan lewat fungsi security definer di bawah.

create extension if not exists pgcrypto;

create type public.peran_keluarga as enum
  ('ayah', 'ibu', 'anak', 'wali', 'kakek_nenek', 'ortu_tunggal');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 60),
  tgl_lahir date,
  privasi_disetujui_at timestamptz,
  aktif_terakhir timestamptz,
  dibuat_at timestamptz not null default now()
);

-- Diisi hanya lewat SQL oleh pengembang. Tanpa policy, klien tidak bisa membaca atau menulis.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  dibuat_at timestamptz not null default now()
);

create table public.keluarga (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(nama) between 2 and 60),
  pemilik_id uuid not null references public.profiles (id) on delete restrict,
  dibuat_at timestamptz not null default now()
);

create table public.anggota (
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  peran public.peran_keluarga not null,
  persetujuan_oleh uuid references public.profiles (id) on delete set null,
  persetujuan_at timestamptz,
  bergabung_at timestamptz not null default now(),
  primary key (keluarga_id, user_id)
);
create index anggota_user_idx on public.anggota (user_id);

create table public.undangan (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  peran public.peran_keluarga not null,
  token_hash text not null unique,
  dibuat_oleh uuid not null references public.profiles (id) on delete cascade,
  persetujuan_ortu boolean not null default false,
  kedaluwarsa_at timestamptz not null,
  dipakai_at timestamptz,
  dipakai_oleh uuid references public.profiles (id) on delete set null,
  check (peran <> 'anak' or persetujuan_ortu)
);
create index undangan_keluarga_idx on public.undangan (keluarga_id);

-- Pembantu RLS. security definer supaya tidak rekursif lewat policy tabel anggota.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create function public.is_member(kid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anggota where keluarga_id = kid and user_id = auth.uid()
  );
$$;

create function public.is_owner(kid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.keluarga where id = kid and pemilik_id = auth.uid()
  );
$$;

create function public.is_parent_role(kid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anggota
    where keluarga_id = kid and user_id = auth.uid()
      and peran in ('ayah', 'ibu', 'wali', 'kakek_nenek', 'ortu_tunggal')
  );
$$;

create function public.serumah(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.anggota a
    join public.anggota b on a.keluarga_id = b.keluarga_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- Profil otomatis saat akun dibuat.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, privasi_disetujui_at)
  values (
    new.id,
    left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nama'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ), 60),
    -- Daftar lewat formulir mencentang persetujuan. Lewat Google, halaman /setuju yang meminta.
    case when new.raw_user_meta_data ->> 'privasi_setuju' = 'true' then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.keluarga enable row level security;
alter table public.anggota enable row level security;
alter table public.undangan enable row level security;

create policy profiles_baca on public.profiles for select to authenticated
  using (id = auth.uid() or public.serumah(id));
create policy profiles_ubah on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy keluarga_baca on public.keluarga for select to authenticated
  using (public.is_member(id));
create policy keluarga_ubah on public.keluarga for update to authenticated
  using (pemilik_id = auth.uid()) with check (pemilik_id = auth.uid());

create policy anggota_baca on public.anggota for select to authenticated
  using (public.is_member(keluarga_id));
-- Pemilik mengeluarkan anggota lain. Anggota biasa boleh keluar sendiri. Pemilik tidak bisa keluar.
create policy anggota_hapus on public.anggota for delete to authenticated
  using (
    (public.is_owner(keluarga_id) and user_id <> auth.uid())
    or (user_id = auth.uid() and not public.is_owner(keluarga_id))
  );

create policy undangan_baca on public.undangan for select to authenticated
  using (public.is_owner(keluarga_id));
create policy undangan_hapus on public.undangan for delete to authenticated
  using (public.is_owner(keluarga_id));

-- Klien hanya boleh mengubah kolom nama pada profil.
revoke insert, update, delete on public.profiles from authenticated, anon;
grant update (nama) on public.profiles to authenticated;
revoke insert, update on public.keluarga from authenticated, anon;
grant update (nama) on public.keluarga to authenticated;
revoke insert, update on public.anggota from authenticated, anon;
revoke insert, update on public.undangan from authenticated, anon;
revoke all on public.platform_admins from authenticated, anon;
revoke all on all tables in schema public from anon;

create function public.setuju_privasi() returns void
language sql security definer set search_path = public as $$
  update public.profiles set privasi_disetujui_at = now()
  where id = auth.uid() and privasi_disetujui_at is null;
$$;

create function public.buat_keluarga(p_nama text, p_peran public.peran_keluarga)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  kid uuid;
  jumlah int;
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if p_peran = 'anak' then raise exception 'pemilik_harus_dewasa'; end if;
  if char_length(trim(p_nama)) < 2 then raise exception 'nama_terlalu_pendek'; end if;
  select count(*) into jumlah from public.keluarga where pemilik_id = auth.uid();
  if jumlah >= 3 then raise exception 'batas_keluarga'; end if;

  insert into public.keluarga (nama, pemilik_id)
  values (left(trim(p_nama), 60), auth.uid())
  returning id into kid;
  insert into public.anggota (keluarga_id, user_id, peran)
  values (kid, auth.uid(), p_peran);
  return kid;
end;
$$;

create function public.buat_undangan(
  p_keluarga uuid, p_peran public.peran_keluarga, p_token_hash text, p_persetujuan boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_owner(p_keluarga) then raise exception 'bukan_pemilik'; end if;
  if p_peran = 'anak' and not coalesce(p_persetujuan, false) then
    raise exception 'perlu_persetujuan_ortu';
  end if;
  insert into public.undangan
    (keluarga_id, peran, token_hash, dibuat_oleh, persetujuan_ortu, kedaluwarsa_at)
  values
    (p_keluarga, p_peran, p_token_hash, auth.uid(), coalesce(p_persetujuan, false),
     now() + interval '7 days')
  returning id into uid;
  return uid;
end;
$$;

-- Dipakai halaman undangan untuk menampilkan isi undangan sebelum diterima.
create function public.lihat_undangan(p_token_hash text)
returns table (nama_keluarga text, peran public.peran_keluarga, berlaku boolean)
language sql stable security definer set search_path = public as $$
  select k.nama, u.peran, (u.dipakai_at is null and u.kedaluwarsa_at > now())
  from public.undangan u join public.keluarga k on k.id = u.keluarga_id
  where u.token_hash = p_token_hash and auth.uid() is not null;
$$;

create function public.terima_undangan(p_token_hash text, p_tgl_lahir date)
returns uuid
language plpgsql security definer set search_path = public as $$
declare u public.undangan;
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  select * into u from public.undangan where token_hash = p_token_hash for update;
  if not found then raise exception 'undangan_tidak_ada'; end if;
  if u.dipakai_at is not null then raise exception 'undangan_terpakai'; end if;
  if u.kedaluwarsa_at <= now() then raise exception 'undangan_kedaluwarsa'; end if;
  if exists (select 1 from public.anggota
             where keluarga_id = u.keluarga_id and user_id = auth.uid()) then
    raise exception 'sudah_anggota';
  end if;
  if u.peran = 'anak' then
    if p_tgl_lahir is null or p_tgl_lahir > current_date then
      raise exception 'tgl_lahir_wajib';
    end if;
    update public.profiles set tgl_lahir = p_tgl_lahir where id = auth.uid();
  end if;

  insert into public.anggota (keluarga_id, user_id, peran, persetujuan_oleh, persetujuan_at)
  values (
    u.keluarga_id, auth.uid(), u.peran,
    case when u.peran = 'anak' then u.dibuat_oleh end,
    case when u.peran = 'anak' then now() end
  );
  update public.undangan set dipakai_at = now(), dipakai_oleh = auth.uid() where id = u.id;
  return u.keluarga_id;
end;
$$;

create function public.hapus_keluarga(p_keluarga uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner(p_keluarga) then raise exception 'bukan_pemilik'; end if;
  delete from public.keluarga where id = p_keluarga;
end;
$$;

-- Hapus akun. Pemilik yang masih punya keluarga harus menghapus keluarganya dulu.
create function public.hapus_akun() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if exists (select 1 from public.keluarga where pemilik_id = auth.uid()) then
    raise exception 'masih_pemilik';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function
  public.setuju_privasi(), public.buat_keluarga(text, public.peran_keluarga),
  public.buat_undangan(uuid, public.peran_keluarga, text, boolean),
  public.lihat_undangan(text), public.terima_undangan(text, date),
  public.hapus_keluarga(uuid), public.hapus_akun(),
  public.is_admin(), public.is_member(uuid), public.is_owner(uuid),
  public.is_parent_role(uuid), public.serumah(uuid)
  from public, anon;
grant execute on function
  public.setuju_privasi(), public.buat_keluarga(text, public.peran_keluarga),
  public.buat_undangan(uuid, public.peran_keluarga, text, boolean),
  public.lihat_undangan(text), public.terima_undangan(text, date),
  public.hapus_keluarga(uuid), public.hapus_akun(),
  public.is_admin(), public.is_member(uuid), public.is_owner(uuid),
  public.is_parent_role(uuid), public.serumah(uuid)
  to authenticated;
