-- 0015: Fungsi admin hapus keluarga & hapus data keluarga, serta peran_target pada daftar konten

create or replace function public.admin_hapus_keluarga(p_keluarga uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  k public.keluarga;
begin
  perform public._perlu_admin();
  select * into k from public.keluarga where id = p_keluarga;
  if not found then raise exception 'keluarga_tidak_ada'; end if;

  perform public._catat(
    'hapus_keluarga',
    p_keluarga::text,
    p_keluarga,
    jsonb_build_object('nama', k.nama, 'pemilik_id', k.pemilik_id)
  );

  delete from public.keluarga where id = p_keluarga;
end;
$$;

create or replace function public.admin_hapus_data_keluarga(p_keluarga uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  k public.keluarga;
begin
  perform public._perlu_admin();
  select * into k from public.keluarga where id = p_keluarga;
  if not found then raise exception 'keluarga_tidak_ada'; end if;

  -- Hapus seluruh riwayat aktivitas, bukti, dan progres keluarga
  delete from public.bukti where keluarga_id = p_keluarga;
  delete from public.tantangan_harian where keluarga_id = p_keluarga;
  delete from public.checkin_perasaan where keluarga_id = p_keluarga;
  delete from public.catatan_harian where keluarga_id = p_keluarga;
  delete from public.cita_cita where keluarga_id = p_keluarga;
  delete from public.materi_selesai where keluarga_id = p_keluarga;
  delete from public.apresiasi where keluarga_id = p_keluarga;
  delete from public.lencana_poin_keluarga where keluarga_id = p_keluarga;
  delete from public.lencana_keluarga_perolehan where keluarga_id = p_keluarga;
  delete from public.pengingat_event_push where keluarga_id = p_keluarga;

  perform public._catat(
    'hapus_data_keluarga',
    p_keluarga::text,
    p_keluarga,
    jsonb_build_object('nama', k.nama)
  );
end;
$$;

-- Perbarui admin_daftar_konten agar menyertakan peran_target
create or replace function public.admin_daftar_konten() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_konten', null, null);
  return jsonb_build_object(
    'tantangan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug, 'kategori', t.kategori, 'segmen', t.segmen,
        'peran_target', t.peran_target,
        'judul', t.judul, 'isi', t.isi,
        'menit', t.menit, 'poin', t.poin, 'peringatan', t.peringatan,
        'aktif', t.aktif,
        'poin_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        ),
        'kategori_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        ),
        'segmen_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        )
      ) order by t.kategori, t.judul)
      from public.tantangan t
    ), '[]'::jsonb),
    'kelompok', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jenis', k.jenis, 'slug', k.slug, 'nama', k.nama
      ) order by k.jenis, k.nama)
      from public.kelompok_pertanyaan k
    ), '[]'::jsonb),
    'pertanyaan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'jenis', p.jenis, 'kelompok', p.kelompok, 'teks', p.teks,
        'aktif', p.aktif
      ) order by p.jenis, k.nama, p.dibuat_at, p.id)
      from public.pertanyaan_konten p
      join public.kelompok_pertanyaan k
        on k.jenis = p.jenis and k.slug = p.kelompok
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function
  public.admin_hapus_keluarga(uuid),
  public.admin_hapus_data_keluarga(uuid)
  from public, anon, authenticated;
grant execute on function
  public.admin_hapus_keluarga(uuid),
  public.admin_hapus_data_keluarga(uuid)
  to authenticated;

-- Opsional / satu kali: pastikan seluruh user yang ada sudah terkonfirmasi
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;
