alter table public.tantangan
  add column dipin boolean not null default false,
  add column tenggat date,
  add column untuk_semua_keluarga boolean not null default true;

create table public.tantangan_keluarga (
  tantangan_slug text not null references public.tantangan (slug) on delete cascade,
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  primary key (tantangan_slug, keluarga_id)
);

alter table public.tantangan_keluarga enable row level security;
revoke all on public.tantangan_keluarga from public, anon, authenticated;

create or replace function public.tantangan_tersedia(p_keluarga uuid, p_slug text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tantangan t
    where t.slug = p_slug
      and (
        t.untuk_semua_keluarga
        or exists (
          select 1
          from public.tantangan_keluarga tk
          where tk.tantangan_slug = t.slug and tk.keluarga_id = p_keluarga
        )
      )
  );
$$;

create or replace function public.tantangan_tersedia_pengguna(p_slug text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.tantangan t
    where t.slug = p_slug and t.aktif
      and (
        t.untuk_semua_keluarga
        or exists (
          select 1
          from public.tantangan_keluarga tk
          join public.anggota a on a.keluarga_id = tk.keluarga_id
          where tk.tantangan_slug = t.slug and a.user_id = auth.uid()
        )
      )
  );
$$;

drop policy tantangan_baca on public.tantangan;
create policy tantangan_baca on public.tantangan for select to authenticated
  using (public.tantangan_tersedia_pengguna(slug));

revoke all on function
  public.tantangan_tersedia(uuid, text),
  public.tantangan_tersedia_pengguna(text)
  from public, anon;
grant execute on function
  public.tantangan_tersedia(uuid, text),
  public.tantangan_tersedia_pengguna(text)
  to authenticated;

create table public.lencana_poin (
  id uuid primary key default gen_random_uuid(),
  nama text not null check (char_length(btrim(nama)) between 3 and 60),
  ikon text not null check (ikon in ('keluarga', 'tantangan', 'perasaan', 'syukur', 'materi')),
  target_poin int not null check (target_poin between 1 and 1000000),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diperbarui_at timestamptz not null default now()
);

alter table public.lencana_poin enable row level security;
revoke all on public.lencana_poin from public, anon, authenticated;
grant select on public.lencana_poin to authenticated;
create policy lencana_poin_baca on public.lencana_poin for select to authenticated
  using (aktif);

create table public.layanan_masuk (
  id uuid primary key default gen_random_uuid(),
  pengguna_id uuid not null references public.profiles (id) on delete cascade,
  jenis text not null check (jenis in ('kritik_saran', 'kesehatan_mental', 'konselor_sebaya')),
  isi text not null check (char_length(btrim(isi)) between 10 and 5000),
  status text not null default 'baru' check (status in ('baru', 'ditinjau', 'selesai')),
  dibuat_at timestamptz not null default now()
);

create index layanan_masuk_pengguna_idx
  on public.layanan_masuk (pengguna_id, dibuat_at desc);
alter table public.layanan_masuk enable row level security;
revoke all on public.layanan_masuk from public, anon, authenticated;
grant select, insert on public.layanan_masuk to authenticated;
revoke insert on public.layanan_masuk from authenticated;
grant insert (pengguna_id, jenis, isi) on public.layanan_masuk to authenticated;
grant update (status) on public.layanan_masuk to authenticated;
grant all on public.layanan_masuk to service_role;

create table public.layanan_konselor (
  pengguna_id uuid not null references public.profiles (id) on delete cascade,
  jenis text not null check (jenis in ('kesehatan_mental', 'konselor_sebaya')),
  primary key (pengguna_id, jenis)
);

alter table public.layanan_konselor enable row level security;
revoke all on public.layanan_konselor from public, anon, authenticated;
grant all on public.layanan_konselor to service_role;

create function public.is_konselor_layanan(p_jenis text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.layanan_konselor
    where pengguna_id = auth.uid() and jenis = p_jenis
  );
$$;

create policy layanan_masuk_baca on public.layanan_masuk for select to authenticated
  using (
    pengguna_id = auth.uid()
    or (jenis = 'kritik_saran' and public.is_admin())
    or (jenis in ('kesehatan_mental', 'konselor_sebaya') and public.is_konselor_layanan(jenis))
  );
create policy layanan_masuk_kirim on public.layanan_masuk for insert to authenticated
  with check (pengguna_id = auth.uid() and not public.is_admin());
create policy layanan_masuk_status_konselor on public.layanan_masuk for update to authenticated
  using (public.is_konselor_layanan(jenis))
  with check (public.is_konselor_layanan(jenis));

create function public.admin_daftar_layanan_saran()
returns table (id uuid, pengirim text, isi text, dibuat_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_layanan_saran', null, null);
  return query
    select l.id, p.nama, l.isi, l.dibuat_at
    from public.layanan_masuk l
    join public.profiles p on p.id = l.pengguna_id
    where l.jenis = 'kritik_saran'
    order by l.dibuat_at desc
    limit 500;
end;
$$;

revoke all on function public.is_konselor_layanan(text) from public, anon;
grant execute on function public.is_konselor_layanan(text) to authenticated;
revoke all on function public.admin_daftar_layanan_saran() from public, anon, authenticated;
grant execute on function public.admin_daftar_layanan_saran() to authenticated;

create table public.pengingat_event_push (
  id uuid primary key default gen_random_uuid(),
  pengingat_id uuid not null references public.pengingat_push (id) on delete cascade,
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  kunci text not null,
  jenis text not null check (jenis in ('tantangan_baru', 'tenggat', 'tantangan_dipin')),
  judul text not null,
  isi text not null,
  url text not null,
  jadwal_at timestamptz not null,
  claim_sampai timestamptz,
  percobaan int not null default 0,
  terkirim_at timestamptz,
  gagal_at timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (kunci, pengingat_id)
);

create index pengingat_event_push_jadwal_idx
  on public.pengingat_event_push (jadwal_at)
  where terkirim_at is null and gagal_at is null;
alter table public.pengingat_event_push enable row level security;
revoke all on public.pengingat_event_push from public, anon, authenticated;
grant all on public.pengingat_event_push to service_role;

create function public._antrikan_notifikasi_tantangan(
  p_slug text,
  p_kunci text,
  p_jenis text,
  p_judul text,
  p_isi text,
  p_jadwal timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pengingat_event_push (
    pengingat_id, keluarga_id, kunci, jenis, judul, isi, url, jadwal_at
  )
  select pp.id, pp.keluarga_id, p_kunci, p_jenis, p_judul, p_isi,
         '/tantangan/' || p_slug, p_jadwal
  from public.pengingat_push pp
  join public.anggota a
    on a.keluarga_id = pp.keluarga_id and a.user_id = pp.user_id
  where public.tantangan_tersedia(pp.keluarga_id, p_slug)
    and not exists (
      select 1 from public.platform_admins pa where pa.user_id = pp.user_id
    )
  on conflict (kunci, pengingat_id) do nothing;
end;
$$;

create function public.admin_simpan_tantangan_lanjutan(
  p_slug text,
  p_kategori public.kategori_tantangan,
  p_judul text,
  p_isi text,
  p_menit int,
  p_poin int,
  p_peringatan text,
  p_segmen public.segmen_tantangan,
  p_dipin boolean,
  p_tenggat date,
  p_untuk_semua boolean,
  p_keluarga_ids uuid[]
) returns text
language plpgsql security definer set search_path = public as $$
declare
  ada boolean;
  aktif_lama boolean;
  dipin_lama boolean;
  tenggat_lama date;
  jumlah_id int;
  jumlah_keluarga int;
begin
  perform public._perlu_admin();
  if p_untuk_semua is null or p_dipin is null then raise exception 'sasaran_tidak_valid'; end if;
  if p_tenggat < public.hari_ini() then raise exception 'tenggat_tidak_valid'; end if;

  if not p_untuk_semua then
    select count(distinct u.keluarga_id) into jumlah_id
    from unnest(coalesce(p_keluarga_ids, '{}'::uuid[])) as u(keluarga_id);
    select count(*) into jumlah_keluarga
    from public.keluarga where id = any(coalesce(p_keluarga_ids, '{}'::uuid[]));
    if jumlah_id = 0 or jumlah_id <> jumlah_keluarga then
      raise exception 'sasaran_tidak_valid';
    end if;
  end if;

  select true, aktif, dipin, tenggat
    into ada, aktif_lama, dipin_lama, tenggat_lama
  from public.tantangan where slug = p_slug for update;
  ada := coalesce(ada, false);

  perform public.admin_simpan_tantangan(
    p_slug, p_kategori, p_judul, p_isi, p_menit, p_poin, p_peringatan, p_segmen
  );

  update public.tantangan
  set dipin = p_dipin, tenggat = p_tenggat, untuk_semua_keluarga = p_untuk_semua
  where slug = p_slug;

  delete from public.tantangan_keluarga where tantangan_slug = p_slug;
  if not p_untuk_semua then
    insert into public.tantangan_keluarga (tantangan_slug, keluarga_id)
    select p_slug, u.keluarga_id
    from unnest(p_keluarga_ids) as u(keluarga_id)
    on conflict do nothing;
  end if;

  if not ada and (select aktif from public.tantangan where slug = p_slug) then
    perform public._antrikan_notifikasi_tantangan(
      p_slug, 'baru:' || p_slug, 'tantangan_baru', 'Tantangan baru',
      'Tantangan baru siap dikerjakan bersama keluarga.', now()
    );
  end if;
  if p_dipin and not coalesce(dipin_lama, false) then
    perform public._antrikan_notifikasi_tantangan(
      p_slug, 'pin:' || p_slug || ':' || now()::text, 'tantangan_dipin', 'Tantangan pilihan',
      'Tantangan ' || btrim(p_judul) || ' dipin untuk keluarga.', now()
    );
  end if;
  if p_tenggat is distinct from tenggat_lama then
    delete from public.pengingat_event_push
    where kunci like 'tenggat:' || p_slug || ':%' and terkirim_at is null;
    if p_tenggat is not null and (select aktif from public.tantangan where slug = p_slug) then
      perform public._antrikan_notifikasi_tantangan(
        p_slug,
        'tenggat:' || p_slug || ':' || p_tenggat::text,
        'tenggat',
        'Tenggat tantangan',
        btrim(p_judul) || ' memiliki tenggat besok.',
        greatest(
          now(),
          ((p_tenggat - 1)::timestamp + time '09:00') at time zone 'Asia/Jakarta'
        )
      );
    end if;
  end if;

  return p_slug;
end;
$$;

create function public.admin_status_tantangan_lanjutan(p_slug text, p_aktif boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  aktif_lama boolean;
  judul_tantangan text;
begin
  perform public._perlu_admin();
  select aktif, judul into aktif_lama, judul_tantangan
  from public.tantangan where slug = p_slug;
  perform public.admin_status_tantangan(p_slug, p_aktif);
  if not coalesce(aktif_lama, false) and p_aktif then
    perform public._antrikan_notifikasi_tantangan(
      p_slug, 'aktif:' || p_slug || ':' || now()::text,
      'tantangan_baru', 'Tantangan baru tersedia',
      'Tantangan ' || coalesce(judul_tantangan, '') || ' siap dikerjakan bersama keluarga.', now()
    );
  end if;
end;
$$;

create function public.admin_opsi_tantangan()
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_sasaran_tantangan', null, null);
  return jsonb_build_object(
    'keluarga', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'nama', k.nama) order by k.nama)
      from public.keluarga k
    ), '[]'::jsonb),
    'tantangan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug,
        'dipin', t.dipin,
        'tenggat', t.tenggat,
        'untuk_semua', t.untuk_semua_keluarga,
        'keluarga_ids', coalesce((
          select jsonb_agg(tk.keluarga_id order by tk.keluarga_id)
          from public.tantangan_keluarga tk where tk.tantangan_slug = t.slug
        ), '[]'::jsonb)
      ) order by t.slug)
      from public.tantangan t
    ), '[]'::jsonb),
    'lencana', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'nama', l.nama, 'ikon', l.ikon,
        'target_poin', l.target_poin, 'aktif', l.aktif
      ) order by l.target_poin, l.nama)
      from public.lencana_poin l
    ), '[]'::jsonb)
  );
end;
$$;

create function public.admin_simpan_lencana(
  p_id uuid,
  p_nama text,
  p_ikon text,
  p_target_poin int,
  p_aktif boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  hasil uuid;
begin
  perform public._perlu_admin();
  if char_length(btrim(coalesce(p_nama, ''))) not between 3 and 60 then
    raise exception 'nama_lencana_tidak_valid';
  end if;
  if p_ikon is null or p_ikon not in ('keluarga', 'tantangan', 'perasaan', 'syukur', 'materi') then
    raise exception 'ikon_lencana_tidak_valid';
  end if;
  if p_target_poin is null or p_target_poin not between 1 and 1000000 then
    raise exception 'target_poin_tidak_valid';
  end if;
  if p_aktif is null then raise exception 'status_lencana_tidak_valid'; end if;

  if p_id is null then
    insert into public.lencana_poin (nama, ikon, target_poin, aktif)
    values (btrim(p_nama), p_ikon, p_target_poin, p_aktif)
    returning id into hasil;
  else
    update public.lencana_poin
    set nama = btrim(p_nama), ikon = p_ikon, target_poin = p_target_poin,
        aktif = p_aktif, diperbarui_at = now()
    where id = p_id
    returning id into hasil;
    if hasil is null then raise exception 'lencana_tidak_ada'; end if;
  end if;
  perform public._catat('simpan_lencana', hasil::text, null,
    jsonb_build_object('nama', btrim(p_nama), 'target_poin', p_target_poin, 'aktif', p_aktif));
  return hasil;
end;
$$;

create function public.klaim_pengingat_event_push(p_sekarang timestamptz)
returns table (
  id uuid, pengingat_id uuid, keluarga_id uuid, endpoint text,
  p256dh text, auth text, jenis text, judul text, isi text, url text
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_sekarang < now() - interval '5 minutes'
    or p_sekarang > now() + interval '1 minute' then
    raise exception 'waktu_tidak_valid';
  end if;

  return query
    with calon as (
      select e.id
      from public.pengingat_event_push e
      join public.pengingat_push pp on pp.id = e.pengingat_id
      where e.jadwal_at <= p_sekarang and e.terkirim_at is null and e.gagal_at is null
        and e.percobaan < 5
        and (e.claim_sampai is null or e.claim_sampai <= p_sekarang)
        and exists (
          select 1 from public.anggota a
          where a.user_id = pp.user_id and a.keluarga_id = pp.keluarga_id
        )
        and not exists (
          select 1 from public.platform_admins pa where pa.user_id = pp.user_id
        )
      order by e.jadwal_at, e.dibuat_at
      limit 500
      for update of e skip locked
    ), diklaim as (
      update public.pengingat_event_push e
      set claim_sampai = p_sekarang + interval '15 minutes',
          percobaan = e.percobaan + 1
      from calon c
      where e.id = c.id
      returning e.id, e.pengingat_id, e.keluarga_id, e.jenis, e.judul, e.isi, e.url
    )
    select d.id, d.pengingat_id, d.keluarga_id, pp.endpoint, pp.p256dh, pp.auth,
      d.jenis, d.judul, d.isi, d.url
    from diklaim d
    join public.pengingat_push pp on pp.id = d.pengingat_id;
end;
$$;

create function public.selesaikan_pengingat_event_push(p_id uuid, p_terkirim boolean)
returns boolean
language sql security definer set search_path = public as $$
  with selesai as (
    update public.pengingat_event_push
    set terkirim_at = case when p_terkirim then now() else terkirim_at end,
        gagal_at = case when not p_terkirim and percobaan >= 5 then now() else gagal_at end,
        claim_sampai = null
    where id = p_id and claim_sampai is not null
    returning 1
  )
  select exists (select 1 from selesai);
$$;

create or replace function public.atur_tantangan_hari_ini(
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

  if found and ada.mode = p_mode and not p_ganti and not ada.dilewati
     and public.tantangan_tersedia(p_keluarga, ada.tantangan_slug) then
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
    and public.tantangan_tersedia(p_keluarga, t.slug)
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
      and public.tantangan_tersedia(p_keluarga, t.slug)
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
      and public.tantangan_tersedia(p_keluarga, t.slug)
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

create or replace function public._validasi_tantangan_aktif_bukti() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.tantangan_tersedia(new.keluarga_id, new.tantangan_slug) then
    raise exception 'tantangan_bukan_sasaran';
  end if;
  if not exists (
    select 1 from public.tantangan t
    where t.slug = new.tantangan_slug and t.aktif
  ) and not exists (
    select 1 from public.tantangan_harian h
    where h.keluarga_id = new.keluarga_id and h.tanggal = new.tanggal
      and h.tantangan_slug = new.tantangan_slug
      and h.anak_id is not distinct from new.anak_id
  ) then
    raise exception 'tantangan_diarsipkan';
  end if;
  return new;
end;
$$;

revoke all on function
  public._antrikan_notifikasi_tantangan(text, text, text, text, text, timestamptz),
  public.admin_simpan_tantangan_lanjutan(
    text, public.kategori_tantangan, text, text, int, int, text,
    public.segmen_tantangan, boolean, date, boolean, uuid[]
  ),
  public.admin_status_tantangan_lanjutan(text, boolean),
  public.admin_opsi_tantangan(),
  public.admin_simpan_lencana(uuid, text, text, int, boolean),
  public.klaim_pengingat_event_push(timestamptz),
  public.selesaikan_pengingat_event_push(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.admin_simpan_tantangan_lanjutan(
    text, public.kategori_tantangan, text, text, int, int, text,
    public.segmen_tantangan, boolean, date, boolean, uuid[]
  ),
  public.admin_status_tantangan_lanjutan(text, boolean),
  public.admin_opsi_tantangan(),
  public.admin_simpan_lencana(uuid, text, text, int, boolean)
  to authenticated;
grant execute on function
  public.klaim_pengingat_event_push(timestamptz),
  public.selesaikan_pengingat_event_push(uuid, boolean)
  to service_role;

grant execute on function
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean, uuid)
  to authenticated;
