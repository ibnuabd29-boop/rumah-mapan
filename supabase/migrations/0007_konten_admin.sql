-- Admin-managed challenges and discussion prompts.

alter table public.tantangan
  add column aktif boolean not null default true;

create table public.kelompok_pertanyaan (
  jenis text not null check (jenis in ('obrolan', 'materi_genre')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nama text not null check (char_length(btrim(nama)) between 1 and 100),
  primary key (jenis, slug)
);

create table public.pertanyaan_konten (
  id uuid primary key default gen_random_uuid(),
  jenis text not null,
  kelompok text not null,
  teks text not null check (char_length(btrim(teks)) between 5 and 500),
  aktif boolean not null default true,
  dibuat_at timestamptz not null default now(),
  diubah_at timestamptz not null default now(),
  foreign key (jenis, kelompok)
    references public.kelompok_pertanyaan (jenis, slug)
);
create index pertanyaan_konten_daftar_idx
  on public.pertanyaan_konten (jenis, kelompok, aktif, dibuat_at);

insert into public.kelompok_pertanyaan (jenis, slug, nama) values
  ('obrolan', 'hati', 'Hati'),
  ('obrolan', 'mimpi', 'Mimpi'),
  ('obrolan', 'kenangan', 'Kenangan'),
  ('obrolan', 'seru', 'Seru'),
  ('materi_genre', 'pendewasaan-usia-perkawinan', 'Pendewasaan usia perkawinan'),
  ('materi_genre', 'fungsi-keluarga', 'Delapan fungsi keluarga'),
  ('materi_genre', 'seksualitas', 'Tubuh, batasan, dan rasa aman'),
  ('materi_genre', 'hiv-aids', 'Mengenal HIV dan AIDS'),
  ('materi_genre', 'napza', 'Mengenal NAPZA'),
  ('materi_genre', 'kecakapan-hidup', 'Pendidikan keterampilan hidup'),
  ('materi_genre', 'gender', 'Gender dan kesempatan yang setara'),
  ('materi_genre', 'advokasi-kie', 'Advokasi, komunikasi, dan informasi');

insert into public.pertanyaan_konten (jenis, kelompok, teks) values
  ('obrolan', 'hati', 'Hal apa yang membuatmu merasa didengarkan?'),
  ('obrolan', 'hati', 'Kapan kamu ingin ditemani, bukan langsung diberi saran?'),
  ('obrolan', 'hati', 'Apa satu hal yang belakangan terasa berat?'),
  ('obrolan', 'hati', 'Bagaimana cara terbaik keluarga meminta maaf kepadamu?'),
  ('obrolan', 'hati', 'Siapa orang yang membuatmu merasa aman untuk bercerita?'),
  ('obrolan', 'mimpi', 'Hal apa yang ingin kamu pelajari tahun ini?'),
  ('obrolan', 'mimpi', 'Kalau bisa mencoba satu kegiatan baru, apa pilihanmu?'),
  ('obrolan', 'mimpi', 'Siapa yang ingin kamu ajak saat mencoba sesuatu yang baru?'),
  ('obrolan', 'mimpi', 'Langkah kecil apa yang bisa kita mulai bersama?'),
  ('obrolan', 'mimpi', 'Apa yang berubah dari cita-citamu sejak dulu?'),
  ('obrolan', 'kenangan', 'Momen keluarga mana yang ingin kamu ulang?'),
  ('obrolan', 'kenangan', 'Apa makanan rumah yang paling mengingatkanmu pada keluarga?'),
  ('obrolan', 'kenangan', 'Kapan terakhir kali kita tertawa bersama?'),
  ('obrolan', 'kenangan', 'Cerita siapa di keluarga yang ingin kamu dengar lagi?'),
  ('obrolan', 'kenangan', 'Perjalanan mana yang paling kamu ingat, dan mengapa?'),
  ('obrolan', 'seru', 'Kalau rumah kita punya nama tim, apa namanya?'),
  ('obrolan', 'seru', 'Permainan apa yang ingin kamu ajarkan ke keluarga?'),
  ('obrolan', 'seru', 'Siapa paling mungkin lupa menaruh kunci, dan kenapa?'),
  ('obrolan', 'seru', 'Kalau bisa memasak satu menu bersama, pilih apa?'),
  ('obrolan', 'seru', 'Tebak kegiatan keluarga yang belum pernah kita coba.'),
  ('materi_genre', 'pendewasaan-usia-perkawinan', 'Hal apa yang ingin kamu capai sebelum membangun keluarga sendiri?'),
  ('materi_genre', 'fungsi-keluarga', 'Kebiasaan rumah apa yang membuatmu merasa disayangi atau aman?'),
  ('materi_genre', 'seksualitas', 'Siapa orang dewasa yang bisa kamu datangi saat merasa tidak aman?'),
  ('materi_genre', 'hiv-aids', 'Mengapa kita perlu mencari informasi kesehatan dari tenaga kesehatan?'),
  ('materi_genre', 'napza', 'Apa yang bisa kamu katakan bila seseorang mengajak mencoba sesuatu yang tidak kamu kenal?'),
  ('materi_genre', 'kecakapan-hidup', 'Masalah kecil apa yang ingin kita pecahkan bersama minggu ini?'),
  ('materi_genre', 'gender', 'Tugas rumah apa yang bisa kita bagi dengan lebih adil?'),
  ('materi_genre', 'advokasi-kie', 'Bagaimana kita memeriksa apakah informasi kesehatan bisa dipercaya?');

alter table public.kelompok_pertanyaan enable row level security;
alter table public.pertanyaan_konten enable row level security;

create policy kelompok_pertanyaan_baca
  on public.kelompok_pertanyaan for select to anon, authenticated using (true);
create policy pertanyaan_konten_baca
  on public.pertanyaan_konten for select to anon, authenticated using (aktif);

revoke all on public.kelompok_pertanyaan, public.pertanyaan_konten
  from public, anon, authenticated;
grant select on public.kelompok_pertanyaan, public.pertanyaan_konten
  to anon, authenticated;

create or replace function public.atur_tantangan_hari_ini(
  p_keluarga uuid, p_mode public.mode_hari, p_ganti boolean default false
) returns text
language plpgsql security definer set search_path = public as $$
declare
  hari date := public.hari_ini();
  ada public.tantangan_harian;
  pilihan text;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  select * into ada from public.tantangan_harian
    where keluarga_id = p_keluarga and tanggal = hari;

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
  where t.aktif and (
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
    where t.aktif and (
        (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
        or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
        or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
      ) and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    order by random() limit 1;
  end if;
  if pilihan is null and ada.tantangan_slug is not null then
    select t.slug into pilihan from public.tantangan t
    where t.slug = ada.tantangan_slug and t.aktif;
  end if;
  if pilihan is null then raise exception 'tantangan_tidak_tersedia'; end if;

  insert into public.tantangan_harian (keluarga_id, tanggal, tantangan_slug, mode, dilewati)
  values (p_keluarga, hari, pilihan, p_mode, false)
  on conflict (keluarga_id, tanggal) do update
    set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  return pilihan;
end;
$$;

create function public._validasi_tantangan_aktif_bukti() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.tantangan t
    where t.slug = new.tantangan_slug and t.aktif
  ) and not exists (
    select 1 from public.tantangan_harian h
    where h.keluarga_id = new.keluarga_id
      and h.tanggal = new.tanggal
      and h.tantangan_slug = new.tantangan_slug
  ) then
    raise exception 'tantangan_diarsipkan';
  end if;
  return new;
end;
$$;
create trigger bukti_tantangan_aktif
  before insert on public.bukti
  for each row execute function public._validasi_tantangan_aktif_bukti();

create function public.admin_daftar_konten() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._perlu_admin();
  perform public._catat('lihat_konten', null, null);
  return jsonb_build_object(
    'tantangan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', t.slug, 'kategori', t.kategori, 'judul', t.judul, 'isi', t.isi,
        'menit', t.menit, 'poin', t.poin, 'peringatan', t.peringatan,
        'aktif', t.aktif,
        'poin_terkunci', exists (
          select 1 from public.bukti b where b.tantangan_slug = t.slug
        ),
        'kategori_terkunci', exists (
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

create function public.admin_simpan_tantangan(
  p_slug text,
  p_kategori public.kategori_tantangan,
  p_judul text,
  p_isi text,
  p_menit int,
  p_poin int,
  p_peringatan text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  poin_lama int;
  kategori_lama public.kategori_tantangan;
  aktif_lama boolean;
begin
  perform public._perlu_admin();
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_slug) > 80 then
    raise exception 'slug_tidak_valid';
  end if;
  if char_length(btrim(coalesce(p_judul, ''))) not between 3 and 100 then
    raise exception 'judul_tidak_valid';
  end if;
  if char_length(btrim(coalesce(p_isi, ''))) not between 5 and 2000 then
    raise exception 'isi_tidak_valid';
  end if;
  if p_kategori is null then raise exception 'kategori_tidak_valid'; end if;
  if p_menit is null or p_menit not between 3 and 120 then raise exception 'durasi_tidak_valid'; end if;
  if p_poin is null or p_poin not between 5 and 30 then raise exception 'poin_tidak_valid'; end if;
  if char_length(coalesce(p_peringatan, '')) > 500 then raise exception 'peringatan_tidak_valid'; end if;

  select t.poin, t.kategori, t.aktif
    into poin_lama, kategori_lama, aktif_lama
    from public.tantangan t
    where t.slug = p_slug for update;
  if found then
    if exists (select 1 from public.bukti b where b.tantangan_slug = p_slug) then
      if poin_lama <> p_poin then raise exception 'poin_tidak_boleh_diubah'; end if;
      if kategori_lama <> p_kategori then raise exception 'kategori_tidak_boleh_diubah'; end if;
    end if;
    if aktif_lama and kategori_lama <> p_kategori and not exists (
      select 1 from public.tantangan lain
      where lain.kategori = kategori_lama and lain.aktif and lain.slug <> p_slug
    ) then
      raise exception 'tantangan_terakhir_kategori';
    end if;
    update public.tantangan
    set kategori = p_kategori, judul = btrim(p_judul), isi = btrim(p_isi),
        menit = p_menit, poin = p_poin, peringatan = nullif(btrim(coalesce(p_peringatan, '')), '')
    where slug = p_slug;
  else
    begin
      insert into public.tantangan (slug, kategori, judul, isi, menit, poin, peringatan)
      values (
        p_slug, p_kategori, btrim(p_judul), btrim(p_isi), p_menit, p_poin,
        nullif(btrim(coalesce(p_peringatan, '')), '')
      );
    exception when unique_violation then
      raise exception 'slug_sudah_dipakai';
    end;
  end if;
  perform public._catat('simpan_tantangan', p_slug, null,
    jsonb_build_object('judul', btrim(p_judul), 'kategori', p_kategori));
  return p_slug;
end;
$$;

create function public.admin_status_tantangan(p_slug text, p_aktif boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  judul_tantangan text;
begin
  perform public._perlu_admin();
  if p_aktif is null then raise exception 'status_tidak_valid'; end if;
  if not p_aktif and exists (
    select 1
    from public.tantangan t
    where t.slug = p_slug and t.aktif
      and not exists (
        select 1 from public.tantangan lain
        where lain.kategori = t.kategori and lain.aktif and lain.slug <> t.slug
      )
  ) then
    raise exception 'tantangan_terakhir_kategori';
  end if;
  update public.tantangan set aktif = p_aktif
  where slug = p_slug returning judul into judul_tantangan;
  if not found then raise exception 'tantangan_tidak_ada'; end if;
  perform public._catat(
    case when p_aktif then 'aktifkan_tantangan' else 'arsipkan_tantangan' end,
    p_slug, null, jsonb_build_object('judul', judul_tantangan)
  );
end;
$$;

create function public.admin_simpan_pertanyaan(
  p_id uuid,
  p_jenis text,
  p_kelompok text,
  p_teks text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  id_pertanyaan uuid;
begin
  perform public._perlu_admin();
  if p_jenis is null or p_jenis not in ('obrolan', 'materi_genre') then raise exception 'jenis_tidak_valid'; end if;
  if char_length(btrim(coalesce(p_teks, ''))) not between 5 and 500 then
    raise exception 'pertanyaan_tidak_valid';
  end if;
  if not exists (
    select 1 from public.kelompok_pertanyaan k
    where k.jenis = p_jenis and k.slug = p_kelompok
  ) then raise exception 'kelompok_tidak_valid'; end if;

  if p_id is null then
    insert into public.pertanyaan_konten (jenis, kelompok, teks)
    values (p_jenis, p_kelompok, btrim(p_teks))
    returning id into id_pertanyaan;
  else
    update public.pertanyaan_konten
    set jenis = p_jenis, kelompok = p_kelompok, teks = btrim(p_teks), diubah_at = now()
    where id = p_id returning id into id_pertanyaan;
    if not found then raise exception 'pertanyaan_tidak_ada'; end if;
  end if;

  perform public._catat('simpan_pertanyaan', id_pertanyaan::text, null,
    jsonb_build_object('jenis', p_jenis, 'kelompok', p_kelompok));
  return id_pertanyaan;
end;
$$;

create function public.admin_status_pertanyaan(p_id uuid, p_aktif boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  jenis_pertanyaan text;
  kelompok_pertanyaan text;
begin
  perform public._perlu_admin();
  if p_aktif is null then raise exception 'status_tidak_valid'; end if;
  update public.pertanyaan_konten
  set aktif = p_aktif, diubah_at = now()
  where id = p_id
  returning jenis, kelompok into jenis_pertanyaan, kelompok_pertanyaan;
  if not found then raise exception 'pertanyaan_tidak_ada'; end if;
  perform public._catat(
    case when p_aktif then 'aktifkan_pertanyaan' else 'arsipkan_pertanyaan' end,
    p_id::text, null,
    jsonb_build_object('jenis', jenis_pertanyaan, 'kelompok', kelompok_pertanyaan)
  );
end;
$$;

revoke all on function
  public._validasi_tantangan_aktif_bukti(),
  public.admin_daftar_konten(),
  public.admin_simpan_tantangan(text, public.kategori_tantangan, text, text, int, int, text),
  public.admin_status_tantangan(text, boolean),
  public.admin_simpan_pertanyaan(uuid, text, text, text),
  public.admin_status_pertanyaan(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.admin_daftar_konten(),
  public.admin_simpan_tantangan(text, public.kategori_tantangan, text, text, int, int, text),
  public.admin_status_tantangan(text, boolean),
  public.admin_simpan_pertanyaan(uuid, text, text, text),
  public.admin_status_pertanyaan(uuid, boolean)
  to authenticated;
