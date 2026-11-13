-- Langkah 6: perasaan, catatan, masa depan, materi, apresiasi, dan laporan.

create type public.suasana_hati as enum ('senang', 'tenang', 'biasa', 'sedih', 'cemas');

create function public.is_anak_di_rumah(p_keluarga uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or (
      not public.is_admin()
      and public.is_member(p_keluarga)
      and public.is_parent_role(p_keluarga)
    ))
    and exists (
    select 1 from public.anggota
    where keluarga_id = p_keluarga and user_id = p_user and peran = 'anak'
  );
$$;

create table public.checkin_perasaan (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tanggal date not null default public.hari_ini(),
  suasana public.suasana_hati not null,
  dibuat_at timestamptz not null default now(),
  unique (keluarga_id, user_id, tanggal)
);
create index checkin_perasaan_rumah_tanggal_idx
  on public.checkin_perasaan (keluarga_id, tanggal desc);

create table public.catatan_harian (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  penulis_id uuid not null references public.profiles (id) on delete cascade,
  suasana public.suasana_hati,
  isi text not null check (char_length(trim(isi)) between 1 and 3000),
  dibagikan boolean not null default true,
  dibuat_at timestamptz not null default now()
);
create index catatan_harian_penulis_idx on public.catatan_harian (penulis_id, dibuat_at desc);
create index catatan_harian_rumah_idx on public.catatan_harian (keluarga_id, dibuat_at desc);

create table public.balasan_catatan (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  catatan_id uuid not null references public.catatan_harian (id) on delete cascade,
  pengirim_id uuid not null references public.profiles (id) on delete cascade,
  isi text not null check (char_length(trim(isi)) between 1 and 1000),
  dibuat_at timestamptz not null default now()
);
create index balasan_catatan_catatan_idx on public.balasan_catatan (catatan_id, dibuat_at);

create table public.cita_cita (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  pembuat_id uuid not null references public.profiles (id) on delete cascade,
  judul text not null check (char_length(trim(judul)) between 2 and 100),
  alasan text not null check (char_length(trim(alasan)) between 1 and 500),
  dibuat_at timestamptz not null default now()
);
create index cita_cita_rumah_idx on public.cita_cita (keluarga_id, dibuat_at desc);

create table public.langkah_cita_cita (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  cita_cita_id uuid not null references public.cita_cita (id) on delete cascade,
  pembuat_id uuid not null references public.profiles (id) on delete cascade,
  isi text not null check (char_length(trim(isi)) between 2 and 240),
  selesai_at timestamptz,
  selesai_oleh uuid references public.profiles (id) on delete set null,
  dibuat_at timestamptz not null default now()
);
create index langkah_cita_cita_idx on public.langkah_cita_cita (cita_cita_id, dibuat_at);

create table public.materi_selesai (
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  materi_slug text not null check (materi_slug in (
    'pendewasaan-usia-perkawinan', 'fungsi-keluarga', 'seksualitas', 'hiv-aids',
    'napza', 'kecakapan-hidup', 'gender', 'advokasi-kie'
  )),
  dibaca_at timestamptz not null default now(),
  primary key (keluarga_id, user_id, materi_slug)
);

create table public.apresiasi (
  id uuid primary key default gen_random_uuid(),
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  pengirim_id uuid not null references public.profiles (id) on delete cascade,
  penerima_id uuid references public.profiles (id) on delete set null,
  isi text not null check (char_length(trim(isi)) between 2 and 300),
  dibuat_at timestamptz not null default now()
);
create index apresiasi_rumah_idx on public.apresiasi (keluarga_id, dibuat_at desc);

alter table public.checkin_perasaan enable row level security;
alter table public.catatan_harian enable row level security;
alter table public.balasan_catatan enable row level security;
alter table public.cita_cita enable row level security;
alter table public.langkah_cita_cita enable row level security;
alter table public.materi_selesai enable row level security;
alter table public.apresiasi enable row level security;

create policy checkin_perasaan_baca on public.checkin_perasaan for select to authenticated
  using (
    not public.is_admin()
    and (
      user_id = auth.uid()
      or (public.is_parent_role(keluarga_id) and public.is_anak_di_rumah(keluarga_id, user_id))
    )
  );
create policy catatan_harian_baca on public.catatan_harian for select to authenticated
  using (
    not public.is_admin()
    and (
      penulis_id = auth.uid()
      or (dibagikan and public.is_parent_role(keluarga_id)
          and public.is_anak_di_rumah(keluarga_id, penulis_id))
    )
  );
create policy catatan_harian_tulis on public.catatan_harian for insert to authenticated
  with check (
    not public.is_admin()
    and penulis_id = auth.uid()
    and public.is_member(keluarga_id)
    and public.is_anak_di_rumah(keluarga_id, auth.uid())
  );
create policy catatan_harian_hapus on public.catatan_harian for delete to authenticated
  using (
    not public.is_admin()
    and penulis_id = auth.uid()
    and public.is_anak_di_rumah(keluarga_id, auth.uid())
  );
create policy balasan_catatan_baca on public.balasan_catatan for select to authenticated
  using (
    not public.is_admin()
    and exists (
      select 1 from public.catatan_harian c
      where c.id = catatan_id and c.keluarga_id = balasan_catatan.keluarga_id
    )
  );
create policy balasan_catatan_tulis on public.balasan_catatan for insert to authenticated
  with check (
    not public.is_admin()
    and pengirim_id = auth.uid()
    and public.is_member(keluarga_id)
    and exists (
      select 1 from public.catatan_harian c
      where c.id = catatan_id and c.keluarga_id = balasan_catatan.keluarga_id
        and (c.penulis_id = auth.uid()
             or (c.dibagikan and public.is_parent_role(c.keluarga_id)
                 and public.is_anak_di_rumah(c.keluarga_id, c.penulis_id)))
    )
  );
create policy cita_cita_baca on public.cita_cita for select to authenticated
  using (not public.is_admin() and public.is_member(keluarga_id));
create policy cita_cita_tulis on public.cita_cita for insert to authenticated
  with check (
    not public.is_admin()
    and pembuat_id = auth.uid()
    and public.is_member(keluarga_id)
  );
create policy cita_cita_hapus on public.cita_cita for delete to authenticated
  using (not public.is_admin() and pembuat_id = auth.uid() and public.is_member(keluarga_id));
create policy langkah_cita_cita_baca on public.langkah_cita_cita for select to authenticated
  using (not public.is_admin() and public.is_member(keluarga_id));
create policy langkah_cita_cita_tulis on public.langkah_cita_cita for insert to authenticated
  with check (
    not public.is_admin()
    and pembuat_id = auth.uid()
    and public.is_member(keluarga_id)
    and exists (
      select 1 from public.cita_cita c
      where c.id = cita_cita_id and c.keluarga_id = langkah_cita_cita.keluarga_id
    )
  );
create policy materi_selesai_baca on public.materi_selesai for select to authenticated
  using (not public.is_admin() and user_id = auth.uid() and public.is_member(keluarga_id));
create policy apresiasi_baca on public.apresiasi for select to authenticated
  using (not public.is_admin() and public.is_member(keluarga_id));
create policy apresiasi_tulis on public.apresiasi for insert to authenticated
  with check (
    not public.is_admin()
    and pengirim_id = auth.uid()
    and public.is_member(keluarga_id)
    and (
      penerima_id is null
      or exists (
        select 1 from public.anggota a
        where a.keluarga_id = apresiasi.keluarga_id and a.user_id = apresiasi.penerima_id
      )
    )
  );
create policy apresiasi_hapus on public.apresiasi for delete to authenticated
  using (not public.is_admin() and pengirim_id = auth.uid() and public.is_member(keluarga_id));

revoke all on public.checkin_perasaan, public.catatan_harian, public.balasan_catatan,
  public.cita_cita, public.langkah_cita_cita, public.materi_selesai, public.apresiasi
  from public, anon, authenticated;
grant select on public.checkin_perasaan, public.catatan_harian, public.balasan_catatan,
  public.cita_cita, public.langkah_cita_cita, public.materi_selesai, public.apresiasi
  to authenticated;
grant insert on public.catatan_harian, public.balasan_catatan, public.cita_cita,
  public.langkah_cita_cita, public.apresiasi to authenticated;
grant delete on public.catatan_harian, public.cita_cita, public.apresiasi to authenticated;

create function public.simpan_checkin(p_keluarga uuid, p_suasana public.suasana_hati)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if public.is_admin() then raise exception 'admin_tidak_mengisi'; end if;
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  insert into public.checkin_perasaan (keluarga_id, user_id, tanggal, suasana)
  values (p_keluarga, auth.uid(), public.hari_ini(), p_suasana)
  on conflict (keluarga_id, user_id, tanggal)
  do update set suasana = excluded.suasana, dibuat_at = now();
end;
$$;

create function public.tandai_materi_selesai(p_keluarga uuid, p_slug text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if public.is_admin() then raise exception 'admin_tidak_mengisi'; end if;
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  if p_slug not in (
    'pendewasaan-usia-perkawinan', 'fungsi-keluarga', 'seksualitas', 'hiv-aids',
    'napza', 'kecakapan-hidup', 'gender', 'advokasi-kie'
  ) then raise exception 'materi_tidak_ditemukan'; end if;
  insert into public.materi_selesai (keluarga_id, user_id, materi_slug)
  values (p_keluarga, auth.uid(), p_slug)
  on conflict (keluarga_id, user_id, materi_slug)
  do update set dibaca_at = excluded.dibaca_at;
end;
$$;

create function public.tandai_langkah(p_id uuid, p_selesai boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare kid uuid;
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if public.is_admin() then raise exception 'admin_tidak_mengisi'; end if;
  select keluarga_id into kid from public.langkah_cita_cita where id = p_id;
  if kid is null or not public.is_member(kid) then raise exception 'langkah_tidak_ditemukan'; end if;
  update public.langkah_cita_cita
  set selesai_at = case when p_selesai then now() else null end,
      selesai_oleh = case when p_selesai then auth.uid() else null end
  where id = p_id;
end;
$$;

-- Admin hanya mendapat agregat tanggal/jumlah catatan dan tren suasana hati tanpa identitas anak.
create function public.admin_ringkasan_catatan(p_keluarga uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare hasil jsonb;
begin
  perform public._perlu_admin();
  if not exists (select 1 from public.keluarga where id = p_keluarga) then
    raise exception 'keluarga_tidak_ada';
  end if;
  perform public._catat('lihat_ringkasan_catatan', null, p_keluarga);
  select coalesce(jsonb_agg(jsonb_build_object(
    'tanggal', x.tanggal, 'jumlah', x.jumlah
  ) order by x.tanggal desc), '[]'::jsonb)
  into hasil
  from (
    select (c.dibuat_at at time zone 'Asia/Jakarta')::date as tanggal, count(*) as jumlah
    from public.catatan_harian c
    where c.keluarga_id = p_keluarga
    group by (c.dibuat_at at time zone 'Asia/Jakarta')::date
  ) x;
  return hasil;
end;
$$;

create function public.admin_progres_materi(p_user_ids uuid[])
returns table (keluarga_id uuid, user_id uuid, selesai int)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  if p_user_ids is null or cardinality(p_user_ids) > 500 then
    raise exception 'filter_pengguna_tidak_valid';
  end if;
  perform public._catat(
    'lihat_progres_materi', null, null, jsonb_build_object('pengguna', cardinality(p_user_ids))
  );
  return query
    select a.keluarga_id, a.user_id, count(m.materi_slug)::int
    from public.anggota a
    left join public.materi_selesai m
      on m.keluarga_id = a.keluarga_id and m.user_id = a.user_id
    where a.user_id = any(p_user_ids)
    group by a.keluarga_id, a.user_id
    order by a.keluarga_id, a.user_id;
end;
$$;

create function public.admin_tren_perasaan(p_keluarga uuid, p_hari int default 7)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare hasil jsonb; hari date := public.hari_ini();
begin
  perform public._perlu_admin();
  if not exists (select 1 from public.keluarga where id = p_keluarga) then
    raise exception 'keluarga_tidak_ada';
  end if;
  if p_hari not in (7, 30) then raise exception 'rentang_tidak_valid'; end if;
  perform public._catat('lihat_tren_perasaan', null, p_keluarga, jsonb_build_object('hari', p_hari));
  with rentang as (
    select (hari - n)::date as tanggal
    from generate_series(p_hari - 1, 0, -1) as n
  ), rekap as (
    select tanggal,
      count(*) filter (where suasana = 'senang') as senang,
      count(*) filter (where suasana = 'tenang') as tenang,
      count(*) filter (where suasana = 'biasa') as biasa,
      count(*) filter (where suasana = 'sedih') as sedih,
      count(*) filter (where suasana = 'cemas') as cemas
    from public.checkin_perasaan
    where keluarga_id = p_keluarga and tanggal > hari - p_hari
    group by tanggal
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tanggal', r.tanggal, 'senang', coalesce(x.senang, 0),
    'tenang', coalesce(x.tenang, 0), 'biasa', coalesce(x.biasa, 0),
    'sedih', coalesce(x.sedih, 0), 'cemas', coalesce(x.cemas, 0)
  ) order by r.tanggal), '[]'::jsonb)
  into hasil
  from rentang r left join rekap x using (tanggal);
  return hasil;
end;
$$;

create function public.admin_perhatian_anak()
returns table (keluarga_id uuid, keluarga text, nama_anak text, perlu_perhatian boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_tanda_perhatian', null, null);
  return query
    select a.keluarga_id, k.nama, p.nama, terbaru.perlu_perhatian
    from public.anggota a
    join public.keluarga k on k.id = a.keluarga_id
    join public.profiles p on p.id = a.user_id
    cross join lateral (
      select count(*) = 3 and bool_and(recent.suasana in ('sedih', 'cemas')) as perlu_perhatian
      from (
        select c.suasana
        from public.checkin_perasaan c
        where c.keluarga_id = a.keluarga_id and c.user_id = a.user_id
        order by c.tanggal desc, c.dibuat_at desc
        limit 3
      ) recent
    ) terbaru
    where a.peran = 'anak' and terbaru.perlu_perhatian;
end;
$$;

revoke all on function
  public.is_anak_di_rumah(uuid, uuid),
  public.simpan_checkin(uuid, public.suasana_hati),
  public.tandai_materi_selesai(uuid, text),
  public.tandai_langkah(uuid, boolean),
  public.admin_ringkasan_catatan(uuid),
  public.admin_progres_materi(uuid[]),
  public.admin_tren_perasaan(uuid, int),
  public.admin_perhatian_anak()
  from public, anon, authenticated;
grant execute on function
  public.is_anak_di_rumah(uuid, uuid),
  public.simpan_checkin(uuid, public.suasana_hati),
  public.tandai_materi_selesai(uuid, text),
  public.tandai_langkah(uuid, boolean)
  to authenticated;
grant execute on function
  public.admin_ringkasan_catatan(uuid),
  public.admin_progres_materi(uuid[]),
  public.admin_tren_perasaan(uuid, int),
  public.admin_perhatian_anak()
  to authenticated;
