create or replace function public.is_anak_di_rumah(p_keluarga uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (p_user = auth.uid() or (
      public.is_member(p_keluarga)
      and public.is_parent_role(p_keluarga)
    ))
    and exists (
      select 1 from public.anggota
      where keluarga_id = p_keluarga and user_id = p_user and peran = 'anak'
    );
$$;

drop policy checkin_perasaan_baca on public.checkin_perasaan;
create policy checkin_perasaan_baca on public.checkin_perasaan for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.is_member(keluarga_id)
      and public.is_parent_role(keluarga_id)
      and public.is_anak_di_rumah(keluarga_id, user_id)
    )
  );

drop policy catatan_harian_baca on public.catatan_harian;
create policy catatan_harian_baca on public.catatan_harian for select to authenticated
  using (
    penulis_id = auth.uid()
    or (
      dibagikan
      and public.is_member(keluarga_id)
      and public.is_parent_role(keluarga_id)
      and public.is_anak_di_rumah(keluarga_id, penulis_id)
    )
  );

drop policy catatan_harian_tulis on public.catatan_harian;
create policy catatan_harian_tulis on public.catatan_harian for insert to authenticated
  with check (
    penulis_id = auth.uid()
    and public.is_member(keluarga_id)
    and public.is_anak_di_rumah(keluarga_id, auth.uid())
  );

drop policy catatan_harian_hapus on public.catatan_harian;
create policy catatan_harian_hapus on public.catatan_harian for delete to authenticated
  using (
    penulis_id = auth.uid()
    and public.is_anak_di_rumah(keluarga_id, auth.uid())
  );

drop policy balasan_catatan_baca on public.balasan_catatan;
create policy balasan_catatan_baca on public.balasan_catatan for select to authenticated
  using (
    exists (
      select 1 from public.catatan_harian c
      where c.id = catatan_id and c.keluarga_id = balasan_catatan.keluarga_id
    )
  );

drop policy balasan_catatan_tulis on public.balasan_catatan;
create policy balasan_catatan_tulis on public.balasan_catatan for insert to authenticated
  with check (
    pengirim_id = auth.uid()
    and public.is_member(keluarga_id)
    and exists (
      select 1 from public.catatan_harian c
      where c.id = catatan_id and c.keluarga_id = balasan_catatan.keluarga_id
        and (c.penulis_id = auth.uid()
             or (c.dibagikan and public.is_parent_role(c.keluarga_id)
                 and public.is_anak_di_rumah(c.keluarga_id, c.penulis_id)))
    )
  );

drop policy cita_cita_baca on public.cita_cita;
create policy cita_cita_baca on public.cita_cita for select to authenticated
  using (public.is_member(keluarga_id));
drop policy cita_cita_tulis on public.cita_cita;
create policy cita_cita_tulis on public.cita_cita for insert to authenticated
  with check (pembuat_id = auth.uid() and public.is_member(keluarga_id));
drop policy cita_cita_hapus on public.cita_cita;
create policy cita_cita_hapus on public.cita_cita for delete to authenticated
  using (pembuat_id = auth.uid() and public.is_member(keluarga_id));

drop policy langkah_cita_cita_baca on public.langkah_cita_cita;
create policy langkah_cita_cita_baca on public.langkah_cita_cita for select to authenticated
  using (public.is_member(keluarga_id));
drop policy langkah_cita_cita_tulis on public.langkah_cita_cita;
create policy langkah_cita_cita_tulis on public.langkah_cita_cita for insert to authenticated
  with check (
    pembuat_id = auth.uid()
    and public.is_member(keluarga_id)
    and exists (
      select 1 from public.cita_cita c
      where c.id = cita_cita_id and c.keluarga_id = langkah_cita_cita.keluarga_id
    )
  );

drop policy materi_selesai_baca on public.materi_selesai;
create policy materi_selesai_baca on public.materi_selesai for select to authenticated
  using (user_id = auth.uid() and public.is_member(keluarga_id));
drop policy apresiasi_baca on public.apresiasi;
create policy apresiasi_baca on public.apresiasi for select to authenticated
  using (public.is_member(keluarga_id));
drop policy apresiasi_tulis on public.apresiasi;
create policy apresiasi_tulis on public.apresiasi for insert to authenticated
  with check (
    pengirim_id = auth.uid()
    and public.is_member(keluarga_id)
    and (
      penerima_id is null
      or exists (
        select 1 from public.anggota a
        where a.keluarga_id = apresiasi.keluarga_id and a.user_id = apresiasi.penerima_id
      )
    )
  );
drop policy apresiasi_hapus on public.apresiasi;
create policy apresiasi_hapus on public.apresiasi for delete to authenticated
  using (pengirim_id = auth.uid() and public.is_member(keluarga_id));

create or replace function public.simpan_checkin(p_keluarga uuid, p_suasana public.suasana_hati)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  insert into public.checkin_perasaan (keluarga_id, user_id, tanggal, suasana)
  values (p_keluarga, auth.uid(), public.hari_ini(), p_suasana)
  on conflict (keluarga_id, user_id, tanggal)
  do update set suasana = excluded.suasana, dibuat_at = now();
end;
$$;

create or replace function public.tandai_materi_selesai(p_keluarga uuid, p_slug text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
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

create or replace function public.tandai_langkah(p_id uuid, p_selesai boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare kid uuid;
begin
  if auth.uid() is null then raise exception 'perlu_masuk'; end if;
  select keluarga_id into kid from public.langkah_cita_cita where id = p_id;
  if kid is null or not public.is_member(kid) then raise exception 'langkah_tidak_ditemukan'; end if;
  update public.langkah_cita_cita
  set selesai_at = case when p_selesai then now() else null end,
      selesai_oleh = case when p_selesai then auth.uid() else null end
  where id = p_id;
end;
$$;

drop policy "pengingat hanya dibuat anggota" on public.pengingat_push;
create policy "pengingat hanya dibuat anggota"
  on public.pengingat_push for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(keluarga_id));
drop policy "pengingat hanya diubah pemilik" on public.pengingat_push;
create policy "pengingat hanya diubah pemilik"
  on public.pengingat_push for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member(keluarga_id));

create or replace function public.klaim_pengingat_harian(p_sekarang timestamptz)
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

create or replace function public._antrikan_notifikasi_tantangan(
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
  on conflict (kunci, pengingat_id) do nothing;
end;
$$;

create or replace function public.klaim_pengingat_event_push(p_sekarang timestamptz)
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

drop policy layanan_masuk_kirim on public.layanan_masuk;
create policy layanan_masuk_kirim on public.layanan_masuk for insert to authenticated
  with check (pengguna_id = auth.uid());
