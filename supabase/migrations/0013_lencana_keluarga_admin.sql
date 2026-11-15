create table public.lencana_keluarga (
  slug text primary key check (slug in (
    'langkah-pertama', 'seminggu', 'tim-solid', 'pendengar', 'atap'
  )),
  nama text not null check (char_length(btrim(nama)) between 3 and 60),
  ikon text not null check (ikon in ('keluarga', 'tantangan', 'perasaan', 'syukur', 'materi')),
  syarat_jenis text not null check (syarat_jenis in (
    'tantangan_selesai', 'hari_beruntun', 'komunikasi', 'poin'
  )),
  target int,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  aktif boolean not null default true,
  diperbarui_at timestamptz not null default now(),
  check (
    (slug in ('langkah-pertama', 'tim-solid') and syarat_jenis = 'tantangan_selesai')
    or (slug = 'seminggu' and syarat_jenis = 'hari_beruntun')
    or (slug = 'pendengar' and syarat_jenis = 'komunikasi')
    or (slug = 'atap' and syarat_jenis = 'poin')
  ),
  check (
    (
      syarat_jenis = 'poin'
      and target is null
      and poin_minimum between 1 and 1000000
      and poin_maksimum between poin_minimum and 1000000
    )
    or (
      syarat_jenis <> 'poin'
      and target between 1 and 1000000
      and poin_minimum is null
      and poin_maksimum is null
      and berlaku_sampai is null
    )
  )
);

insert into public.lencana_keluarga (
  slug, nama, ikon, syarat_jenis, target, poin_minimum, poin_maksimum
) values
  ('langkah-pertama', 'Langkah pertama', 'tantangan', 'tantangan_selesai', 1, null, null),
  ('seminggu', 'Seminggu beruntun', 'keluarga', 'hari_beruntun', 7, null, null),
  ('tim-solid', 'Tim solid', 'keluarga', 'tantangan_selesai', 10, null, null),
  ('pendengar', 'Pendengar hebat', 'perasaan', 'komunikasi', 5, null, null),
  ('atap', 'Atap terpasang', 'keluarga', 'poin', null, 300, 1000000);

alter table public.lencana_keluarga enable row level security;
revoke all on public.lencana_keluarga from public, anon, authenticated;
grant select on public.lencana_keluarga to authenticated;
create policy lencana_keluarga_baca on public.lencana_keluarga for select to authenticated
  using (
    aktif
    and (syarat_jenis <> 'poin' or berlaku_sampai is null or now() <= berlaku_sampai)
  );

create table public.lencana_keluarga_perolehan (
  keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  lencana_slug text not null references public.lencana_keluarga(slug) on delete cascade,
  poin_dicapai bigint not null check (poin_dicapai >= 0),
  diperoleh_at timestamptz not null default now(),
  primary key (keluarga_id, lencana_slug)
);

alter table public.lencana_keluarga_perolehan enable row level security;
revoke all on public.lencana_keluarga_perolehan from public, anon, authenticated;
grant select on public.lencana_keluarga_perolehan to authenticated;
create policy lencana_keluarga_perolehan_baca on public.lencana_keluarga_perolehan
  for select to authenticated using (public.is_member(keluarga_id));

create function public._beri_lencana_keluarga_poin(
  p_keluarga uuid,
  p_poin_lama bigint,
  p_poin_baru bigint
) returns void
language sql security definer set search_path = public as $$
  insert into public.lencana_keluarga_perolehan (keluarga_id, lencana_slug, poin_dicapai)
  select p_keluarga, l.slug, p_poin_baru
  from public.lencana_keluarga l
  where l.syarat_jenis = 'poin'
    and l.aktif
    and (l.berlaku_sampai is null or now() <= l.berlaku_sampai)
    and p_poin_lama <= l.poin_maksimum
    and p_poin_baru >= l.poin_minimum
  on conflict (keluarga_id, lencana_slug) do nothing;
$$;

create or replace function public._catat_lencana_setelah_bukti()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total_poin bigint;
  poin_bukti int;
begin
  if new.status <> 'disetujui' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'disetujui' then return new; end if;

  select coalesce(sum(t.poin), 0)::bigint
  into total_poin
  from public.bukti b
  join public.tantangan t on t.slug = b.tantangan_slug
  where b.keluarga_id = new.keluarga_id and b.status = 'disetujui';

  select t.poin into poin_bukti
  from public.tantangan t
  where t.slug = new.tantangan_slug;

  perform public._beri_lencana_poin(
    new.keluarga_id,
    total_poin - coalesce(poin_bukti, 0),
    total_poin
  );
  perform public._beri_lencana_keluarga_poin(
    new.keluarga_id,
    total_poin - coalesce(poin_bukti, 0),
    total_poin
  );
  return new;
end;
$$;

with total_poin as (
  select k.id as keluarga_id, coalesce(sum(t.poin), 0)::bigint as poin
  from public.keluarga k
  left join public.bukti b on b.keluarga_id = k.id and b.status = 'disetujui'
  left join public.tantangan t on t.slug = b.tantangan_slug
  group by k.id
)
insert into public.lencana_keluarga_perolehan (keluarga_id, lencana_slug, poin_dicapai)
select tp.keluarga_id, l.slug, tp.poin
from total_poin tp
join public.lencana_keluarga l
  on l.syarat_jenis = 'poin'
  and tp.poin between l.poin_minimum and l.poin_maksimum
where l.aktif and (l.berlaku_sampai is null or now() <= l.berlaku_sampai)
on conflict (keluarga_id, lencana_slug) do nothing;

create function public._daftar_lencana_keluarga(uuid)
returns table (
  slug text,
  nama text,
  ikon text,
  syarat text,
  syarat_jenis text,
  target int,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  terbuka boolean
)
language plpgsql stable security definer set search_path = public as $$
declare ringkasan jsonb;
begin
  ringkasan := public._ringkasan($1);
  return query
    select l.slug, l.nama, l.ikon,
      case l.syarat_jenis
        when 'tantangan_selesai' then l.target::text || ' tantangan disetujui'
        when 'hari_beruntun' then l.target::text || ' hari berturut-turut ada tantangan disetujui'
        when 'komunikasi' then l.target::text || ' tantangan komunikasi disetujui'
        else l.poin_minimum::text || ' hingga ' || l.poin_maksimum::text || ' poin keluarga'
      end,
      l.syarat_jenis, l.target, l.poin_minimum, l.poin_maksimum, l.berlaku_sampai,
      case l.syarat_jenis
        when 'tantangan_selesai' then coalesce((ringkasan ->> 'selesai')::bigint, 0) >= l.target
        when 'hari_beruntun' then coalesce((ringkasan ->> 'beruntun_terbaik')::bigint, 0) >= l.target
        when 'komunikasi' then coalesce((ringkasan ->> 'komunikasi')::bigint, 0) >= l.target
        else exists (
          select 1 from public.lencana_keluarga_perolehan p
          where p.keluarga_id = $1 and p.lencana_slug = l.slug
        )
      end
    from public.lencana_keluarga l
    where (
      l.aktif
      and (l.syarat_jenis <> 'poin' or l.berlaku_sampai is null or now() <= l.berlaku_sampai)
    ) or exists (
      select 1 from public.lencana_keluarga_perolehan p
      where p.keluarga_id = $1 and p.lencana_slug = l.slug
    )
    order by case l.slug
      when 'langkah-pertama' then 1
      when 'seminggu' then 2
      when 'tim-solid' then 3
      when 'pendengar' then 4
      else 5
    end;
end;
$$;

create function public.daftar_lencana_keluarga_bawaan(p_keluarga uuid)
returns table (
  slug text,
  nama text,
  ikon text,
  syarat text,
  syarat_jenis text,
  target int,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  terbuka boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  return query select * from public._daftar_lencana_keluarga(p_keluarga);
end;
$$;

create function public.admin_lencana_keluarga(p_keluarga uuid)
returns table (
  slug text,
  nama text,
  ikon text,
  syarat text,
  syarat_jenis text,
  target int,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  terbuka boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_lencana_keluarga', p_keluarga::text, null);
  return query select * from public._daftar_lencana_keluarga(p_keluarga);
end;
$$;

create function public.admin_daftar_lencana_bawaan()
returns table (
  slug text,
  nama text,
  ikon text,
  syarat_jenis text,
  target int,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  kedaluwarsa boolean,
  aktif boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('daftar_lencana_keluarga', null, null);
  return query
    select l.slug, l.nama, l.ikon, l.syarat_jenis, l.target, l.poin_minimum, l.poin_maksimum,
      l.berlaku_sampai, l.berlaku_sampai is not null and now() > l.berlaku_sampai, l.aktif
    from public.lencana_keluarga l
    order by case l.slug
      when 'langkah-pertama' then 1
      when 'seminggu' then 2
      when 'tim-solid' then 3
      when 'pendengar' then 4
      else 5
    end;
end;
$$;

create function public.admin_simpan_lencana_bawaan(
  p_slug text,
  p_nama text,
  p_ikon text,
  p_target int,
  p_poin_minimum int,
  p_poin_maksimum int,
  p_berlaku_sampai timestamptz,
  p_aktif boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  jenis text;
begin
  perform public._perlu_admin();
  select l.syarat_jenis into jenis
  from public.lencana_keluarga l
  where l.slug = p_slug;
  if jenis is null then raise exception 'lencana_tidak_ada'; end if;
  if char_length(btrim(coalesce(p_nama, ''))) not between 3 and 60 then
    raise exception 'nama_lencana_tidak_valid';
  end if;
  if p_ikon is null or p_ikon not in ('keluarga', 'tantangan', 'perasaan', 'syukur', 'materi') then
    raise exception 'ikon_lencana_tidak_valid';
  end if;
  if p_aktif is null then raise exception 'status_lencana_tidak_valid'; end if;

  if jenis = 'poin' then
    if p_target is not null then raise exception 'syarat_lencana_tidak_valid'; end if;
    if p_poin_minimum is null or p_poin_minimum not between 1 and 1000000 then
      raise exception 'poin_minimum_tidak_valid';
    end if;
    if p_poin_maksimum is null or p_poin_maksimum not between p_poin_minimum and 1000000 then
      raise exception 'poin_maksimum_tidak_valid';
    end if;
  else
    if p_target is null or p_target not between 1 and 1000000
      or p_poin_minimum is not null or p_poin_maksimum is not null
      or p_berlaku_sampai is not null then
      raise exception 'syarat_lencana_tidak_valid';
    end if;
  end if;

  update public.lencana_keluarga
  set nama = btrim(p_nama),
      ikon = p_ikon,
      target = p_target,
      poin_minimum = p_poin_minimum,
      poin_maksimum = p_poin_maksimum,
      berlaku_sampai = p_berlaku_sampai,
      aktif = p_aktif,
      diperbarui_at = now()
  where slug = p_slug;

  if jenis = 'poin' and p_aktif
    and (p_berlaku_sampai is null or now() <= p_berlaku_sampai) then
    insert into public.lencana_keluarga_perolehan (keluarga_id, lencana_slug, poin_dicapai)
    select k.id, p_slug, tp.poin
    from public.keluarga k
    cross join lateral (
      select coalesce(sum(t.poin), 0)::bigint as poin
      from public.bukti b
      join public.tantangan t on t.slug = b.tantangan_slug
      where b.keluarga_id = k.id and b.status = 'disetujui'
    ) tp
    where tp.poin between p_poin_minimum and p_poin_maksimum
    on conflict (keluarga_id, lencana_slug) do nothing;
  end if;

  perform public._catat('simpan_lencana_keluarga', p_slug, null,
    jsonb_build_object(
      'nama', btrim(p_nama),
      'target', p_target,
      'poin_minimum', p_poin_minimum,
      'poin_maksimum', p_poin_maksimum,
      'berlaku_sampai', p_berlaku_sampai,
      'aktif', p_aktif
    ));
end;
$$;

revoke all on public.lencana_keluarga, public.lencana_keluarga_perolehan
  from public, anon, authenticated;
grant select on public.lencana_keluarga, public.lencana_keluarga_perolehan to authenticated;

revoke all on function public._beri_lencana_keluarga_poin(uuid, bigint, bigint)
  from public, anon, authenticated;
revoke all on function public._daftar_lencana_keluarga(uuid)
  from public, anon, authenticated;
revoke all on function public.daftar_lencana_keluarga_bawaan(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_lencana_keluarga(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_daftar_lencana_bawaan()
  from public, anon, authenticated;
revoke all on function public.admin_simpan_lencana_bawaan(text, text, text, int, int, int, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.daftar_lencana_keluarga_bawaan(uuid) to authenticated;
grant execute on function public.admin_lencana_keluarga(uuid) to authenticated;
grant execute on function public.admin_daftar_lencana_bawaan() to authenticated;
grant execute on function public.admin_simpan_lencana_bawaan(text, text, text, int, int, int, timestamptz, boolean)
  to authenticated;
