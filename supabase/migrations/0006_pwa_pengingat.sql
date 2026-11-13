-- Langkah 7: langganan notifikasi tantangan harian untuk perangkat anggota.

create table public.pengingat_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  keluarga_id uuid not null references public.keluarga (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) <= 2048),
  p256dh text not null check (char_length(p256dh) between 1 and 256),
  auth text not null check (char_length(auth) between 1 and 256),
  waktu_lokal time not null default time '19:00',
  zona_waktu text not null default 'Asia/Jakarta'
    check (char_length(zona_waktu) between 1 and 80),
  terakhir_kirim date,
  claim_sampai timestamptz,
  dibuat_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index pengingat_push_keluarga_idx
  on public.pengingat_push (keluarga_id, user_id);

alter table public.pengingat_push enable row level security;
revoke all on public.pengingat_push from public, anon, authenticated;
grant select, delete on public.pengingat_push to authenticated;
grant insert (user_id, keluarga_id, endpoint, p256dh, auth, waktu_lokal, zona_waktu)
  on public.pengingat_push to authenticated;
grant update (user_id, keluarga_id, endpoint, p256dh, auth, waktu_lokal, zona_waktu)
  on public.pengingat_push to authenticated;
grant all on public.pengingat_push to service_role;

create policy "pengingat dapat dibaca pemilik"
  on public.pengingat_push for select to authenticated
  using (user_id = auth.uid());

create policy "pengingat hanya dibuat anggota"
  on public.pengingat_push for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member(keluarga_id)
    and not public.is_admin()
  );

create policy "pengingat hanya diubah pemilik"
  on public.pengingat_push for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_member(keluarga_id)
    and not public.is_admin()
  );

create policy "pengingat hanya dihapus pemilik"
  on public.pengingat_push for delete to authenticated
  using (user_id = auth.uid());

create function public.klaim_pengingat_harian(p_sekarang timestamptz)
returns table (
  id uuid, user_id uuid, keluarga_id uuid, endpoint text,
  p256dh text, auth text, zona_waktu text, tanggal_lokal date
)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_sekarang < now() - interval '5 minutes'
    or p_sekarang > now() + interval '1 minute' then
    raise exception 'waktu_tidak_valid';
  end if;

  return query
    with calon as (
      select p.id
      from public.pengingat_push p
      where exists (
          select 1 from pg_timezone_names z where z.name = p.zona_waktu
        )
        and p.terakhir_kirim is distinct from
          (p_sekarang at time zone p.zona_waktu)::date
        and (p_sekarang at time zone p.zona_waktu) >=
          ((p_sekarang at time zone p.zona_waktu)::date + p.waktu_lokal)
        and (p_sekarang at time zone p.zona_waktu) <
          ((p_sekarang at time zone p.zona_waktu)::date + p.waktu_lokal + interval '5 minutes')
        and (p.claim_sampai is null or p.claim_sampai <= p_sekarang)
        and exists (
          select 1
          from public.anggota a
          where a.user_id = p.user_id and a.keluarga_id = p.keluarga_id
        )
        and not exists (
          select 1 from public.platform_admins pa where pa.user_id = p.user_id
        )
      order by p.dibuat_at
      limit 500
      for update skip locked
    ), diklaim as (
      update public.pengingat_push p
      set claim_sampai = p_sekarang + interval '15 minutes'
      from calon c
      where p.id = c.id
      returning p.id, p.user_id, p.keluarga_id, p.endpoint, p.p256dh, p.auth, p.zona_waktu
    )
    select d.id, d.user_id, d.keluarga_id, d.endpoint, d.p256dh, d.auth,
      d.zona_waktu, (p_sekarang at time zone d.zona_waktu)::date
    from diklaim d;
end;
$$;

create function public.selesaikan_pengingat_push(
  p_id uuid, p_tanggal date, p_terkirim boolean
)
returns boolean
language sql security definer set search_path = public as $$
  with selesai as (
    update public.pengingat_push
    set terakhir_kirim = case when p_terkirim then p_tanggal else terakhir_kirim end,
        claim_sampai = null
    where id = p_id and claim_sampai is not null
    returning 1
  )
  select exists (select 1 from selesai);
$$;

revoke all on function public.klaim_pengingat_harian(timestamptz) from public, anon, authenticated;
revoke all on function public.selesaikan_pengingat_push(uuid, date, boolean) from public, anon, authenticated;
grant execute on function public.klaim_pengingat_harian(timestamptz) to service_role;
grant execute on function public.selesaikan_pengingat_push(uuid, date, boolean) to service_role;
