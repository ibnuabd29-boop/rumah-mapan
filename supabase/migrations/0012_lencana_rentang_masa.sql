alter table public.lencana_poin
  add column poin_minimum int not null default 1
    check (poin_minimum between 1 and 1000000),
  add column poin_maksimum int not null default 1000000
    check (poin_maksimum between 1 and 1000000),
  add column berlaku_sampai timestamptz;

update public.lencana_poin
set poin_minimum = target_poin
where poin_minimum <> target_poin;

alter table public.lencana_poin
  add constraint lencana_poin_rentang_valid
  check (poin_maksimum >= poin_minimum);

drop policy lencana_poin_baca on public.lencana_poin;
create policy lencana_poin_baca on public.lencana_poin for select to authenticated
  using (aktif and (berlaku_sampai is null or now() <= berlaku_sampai));

create table public.lencana_poin_keluarga (
  keluarga_id uuid not null references public.keluarga(id) on delete cascade,
  lencana_id uuid not null references public.lencana_poin(id) on delete cascade,
  poin_dicapai bigint not null check (poin_dicapai >= 0),
  diberikan_at timestamptz not null default now(),
  primary key (keluarga_id, lencana_id)
);

alter table public.lencana_poin_keluarga enable row level security;
revoke all on public.lencana_poin_keluarga from public, anon, authenticated;
grant select on public.lencana_poin_keluarga to authenticated;
create policy lencana_poin_keluarga_baca on public.lencana_poin_keluarga
  for select to authenticated using (public.is_member(keluarga_id));

create function public._beri_lencana_poin(
  p_keluarga uuid,
  p_poin_lama bigint,
  p_poin_baru bigint
) returns void
language sql security definer set search_path = public as $$
  insert into public.lencana_poin_keluarga (keluarga_id, lencana_id, poin_dicapai)
  select p_keluarga, l.id, p_poin_baru
  from public.lencana_poin l
  where l.aktif
    and (l.berlaku_sampai is null or now() <= l.berlaku_sampai)
    and p_poin_lama <= l.poin_maksimum
    and p_poin_baru >= l.poin_minimum
  on conflict (keluarga_id, lencana_id) do nothing;
$$;

create function public._catat_lencana_setelah_bukti()
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
  return new;
end;
$$;

create trigger bukti_lencana_poin
  after insert or update of status on public.bukti
  for each row execute function public._catat_lencana_setelah_bukti();

with total_poin as (
  select k.id as keluarga_id, coalesce(sum(t.poin), 0)::bigint as poin
  from public.keluarga k
  left join public.bukti b on b.keluarga_id = k.id and b.status = 'disetujui'
  left join public.tantangan t on t.slug = b.tantangan_slug
  group by k.id
)
insert into public.lencana_poin_keluarga (keluarga_id, lencana_id, poin_dicapai)
select tp.keluarga_id, l.id, tp.poin
from total_poin tp
join public.lencana_poin l
  on tp.poin between l.poin_minimum and l.poin_maksimum
where l.aktif and (l.berlaku_sampai is null or now() <= l.berlaku_sampai)
on conflict (keluarga_id, lencana_id) do nothing;

create function public.admin_daftar_lencana()
returns table (
  id uuid,
  nama text,
  ikon text,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  kedaluwarsa boolean,
  aktif boolean
)
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('daftar_lencana', null, null);
  return query
    select l.id, l.nama, l.ikon, l.poin_minimum, l.poin_maksimum, l.berlaku_sampai,
      l.berlaku_sampai is not null and now() > l.berlaku_sampai,
      l.aktif
    from public.lencana_poin l
    order by l.poin_minimum, l.poin_maksimum, l.nama;
end;
$$;

create function public.daftar_lencana_keluarga(p_keluarga uuid)
returns table (
  id uuid,
  nama text,
  ikon text,
  poin_minimum int,
  poin_maksimum int,
  berlaku_sampai timestamptz,
  terbuka boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  return query
    select l.id, l.nama, l.ikon, l.poin_minimum, l.poin_maksimum, l.berlaku_sampai,
      exists (
        select 1 from public.lencana_poin_keluarga lp
        where lp.keluarga_id = p_keluarga and lp.lencana_id = l.id
      )
    from public.lencana_poin l
    where (
      l.aktif and (l.berlaku_sampai is null or now() <= l.berlaku_sampai)
    ) or exists (
      select 1 from public.lencana_poin_keluarga lp
      where lp.keluarga_id = p_keluarga and lp.lencana_id = l.id
    )
    order by l.poin_minimum, l.poin_maksimum, l.nama;
end;
$$;

create function public.admin_simpan_lencana_rentang(
  p_id uuid,
  p_nama text,
  p_ikon text,
  p_poin_minimum int,
  p_poin_maksimum int,
  p_berlaku_sampai timestamptz,
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
  if p_poin_minimum is null or p_poin_minimum not between 1 and 1000000 then
    raise exception 'poin_minimum_tidak_valid';
  end if;
  if p_poin_maksimum is null or p_poin_maksimum not between p_poin_minimum and 1000000 then
    raise exception 'poin_maksimum_tidak_valid';
  end if;
  if p_aktif is null then raise exception 'status_lencana_tidak_valid'; end if;

  if p_id is null then
    insert into public.lencana_poin (
      nama, ikon, target_poin, poin_minimum, poin_maksimum, berlaku_sampai, aktif
    )
    values (
      btrim(p_nama), p_ikon, p_poin_minimum, p_poin_minimum, p_poin_maksimum, p_berlaku_sampai, p_aktif
    )
    returning id into hasil;
  else
    update public.lencana_poin
    set nama = btrim(p_nama),
        ikon = p_ikon,
        target_poin = p_poin_minimum,
        poin_minimum = p_poin_minimum,
        poin_maksimum = p_poin_maksimum,
        berlaku_sampai = p_berlaku_sampai,
        aktif = p_aktif,
        diperbarui_at = now()
    where id = p_id
    returning id into hasil;
    if hasil is null then raise exception 'lencana_tidak_ada'; end if;
  end if;

  if p_aktif and (p_berlaku_sampai is null or now() <= p_berlaku_sampai) then
    insert into public.lencana_poin_keluarga (keluarga_id, lencana_id, poin_dicapai)
    select k.id, hasil, tp.poin
    from public.keluarga k
    cross join lateral (
      select coalesce(sum(t.poin), 0)::bigint as poin
      from public.bukti b
      join public.tantangan t on t.slug = b.tantangan_slug
      where b.keluarga_id = k.id and b.status = 'disetujui'
    ) tp
    where tp.poin between p_poin_minimum and p_poin_maksimum
    on conflict (keluarga_id, lencana_id) do nothing;
  end if;

  perform public._catat('simpan_lencana', hasil::text, null,
    jsonb_build_object(
      'nama', btrim(p_nama),
      'poin_minimum', p_poin_minimum,
      'poin_maksimum', p_poin_maksimum,
      'berlaku_sampai', p_berlaku_sampai,
      'aktif', p_aktif
    ));
  return hasil;
end;
$$;

create or replace function public.admin_simpan_lencana(
  p_id uuid,
  p_nama text,
  p_ikon text,
  p_target_poin int,
  p_aktif boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  poin_maksimum int := 1000000;
  batas_berlaku timestamptz;
begin
  perform public._perlu_admin();
  if p_id is not null then
    select l.poin_maksimum, l.berlaku_sampai
    into poin_maksimum, batas_berlaku
    from public.lencana_poin l
    where l.id = p_id;
    poin_maksimum := greatest(coalesce(poin_maksimum, 1000000), coalesce(p_target_poin, 1));
  end if;
  return public.admin_simpan_lencana_rentang(
    p_id, p_nama, p_ikon, p_target_poin, poin_maksimum, batas_berlaku, p_aktif
  );
end;
$$;

revoke all on function public._beri_lencana_poin(uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public._catat_lencana_setelah_bukti() from public, anon, authenticated;
revoke all on function public.admin_daftar_lencana() from public, anon, authenticated;
revoke all on function public.daftar_lencana_keluarga(uuid) from public, anon, authenticated;
revoke all on function public.admin_simpan_lencana_rentang(uuid, text, text, int, int, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_daftar_lencana() to authenticated;
grant execute on function public.daftar_lencana_keluarga(uuid) to authenticated;
grant execute on function public.admin_simpan_lencana_rentang(uuid, text, text, int, int, timestamptz, boolean)
  to authenticated;
