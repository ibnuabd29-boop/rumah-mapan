alter table public.tantangan
  add column peran_target public.peran_keluarga
  check (peran_target is null or peran_target in ('ayah', 'ibu', 'anak'));

alter table public.tantangan_harian
  add column peran_penugasan public.peran_keluarga not null default 'ortu_tunggal';

update public.tantangan_harian
set peran_penugasan = 'anak'
where anak_id is not null;

update public.tantangan_harian h
set peran_penugasan = a.peran
from public.keluarga k
join public.anggota a on a.keluarga_id = k.id and a.user_id = k.pemilik_id
where h.keluarga_id = k.id and h.anak_id is null;

alter table public.tantangan_harian
  add constraint tantangan_harian_peran_penugasan_valid
  check (
    (anak_id is null and peran_penugasan <> 'anak')
    or (anak_id is not null and peran_penugasan = 'anak')
  );

drop index public.tantangan_harian_rumah_hari_unik;
create unique index tantangan_harian_peran_hari_unik
  on public.tantangan_harian (keluarga_id, tanggal, peran_penugasan)
  where anak_id is null;

update public.tantangan t
set peran_target = 'anak'
where (
   t.segmen is not null
   or t.slug in (
     'anak-siapkan-tas',
     'uang-saku-tiga-bagian',
     'anak-sarapan-sendiri',
     'jadwal-belajar-sendiri',
     'aturan-aman-sebelum-masuk',
     'wawancara-profesi',
     'asisten-ayah-sehari',
     'peta-tempat-kerja',
     'kenalan-rekan-ayah',
     'jurnal-rasa-ingin-tahu',
     'makan-siang-berdua'
   )
)
and not exists (
  select 1
  from public.tantangan_harian h
  where h.tantangan_slug = t.slug
    and h.tanggal = public.hari_ini()
    and h.anak_id is null
)
and not exists (
  select 1
  from public.bukti b
  where b.tantangan_slug = t.slug
    and b.tanggal = public.hari_ini()
    and b.anak_id is null
    and b.status in ('menunggu', 'disetujui', 'ditandai')
);

update public.tantangan t
set peran_target = 'ayah'
where t.slug in (
  'istirahat-dua-puluh-menit',
  'sambutan-di-pintu',
  'pijat-bahu-bercerita',
  'tebak-hari-kerja-ayah',
  'duduk-berdampingan',
  'dongeng-pengantar-tidur',
  'pelukan-dan-satu-syukur'
)
and not exists (
  select 1
  from public.tantangan_harian h
  where h.tantangan_slug = t.slug
    and h.tanggal = public.hari_ini()
    and h.anak_id is null
    and h.peran_penugasan <> 'ayah'
)
and not exists (
  select 1
  from public.bukti b
  join public.anggota a on a.keluarga_id = b.keluarga_id and a.user_id = b.pengirim_id
  where b.tantangan_slug = t.slug
    and b.tanggal = public.hari_ini()
    and b.anak_id is null
    and b.status in ('menunggu', 'disetujui', 'ditandai')
    and a.peran <> 'ayah'
);

insert into public.tantangan (
  slug, kategori, judul, isi, menit, poin, peran_target
) values
  ('ayah-mendengar-cerita', 'komunikasi', 'Ayah mendengar cerita', 'Ayah mendengarkan anak bercerita tentang harinya selama lima menit tanpa menyela. Setelah itu, ayah mengulang hal yang paling ia pahami.', 10, 10, 'ayah'),
  ('ayah-berbagi-pengalaman', 'komunikasi', 'Ayah berbagi pengalaman', 'Ayah menceritakan satu hal yang ia pelajari hari ini. Anak boleh bertanya, lalu ayah mendengarkan cerita anak tentang hal yang sama.', 15, 10, 'ayah'),
  ('ayah-memilih-kegiatan-bersama', 'kebersamaan', 'Ayah memilih kegiatan bersama', 'Ayah dan anak memilih satu kegiatan sederhana yang bisa dilakukan bersama di rumah, lalu membagi langkahnya.', 20, 10, 'ayah'),
  ('ayah-pulang-kerja-mendengar', 'sepulang_kerja', 'Ayah mendengar kabar hari ini', 'Setelah beristirahat, ayah meminta anak menceritakan satu hal yang menyenangkan dan satu hal yang sulit hari ini. Ayah mendengarkan tanpa langsung memberi nasihat.', 10, 10, 'ayah'),
  ('ayah-mendampingi-kunjungan-kerja', 'ke_tempat_kerja', 'Ayah menyiapkan kunjungan kerja', 'Ayah menjelaskan satu aturan keselamatan di tempat kerja, menunjukkan area yang boleh dikunjungi, dan mendampingi anak sepanjang waktu.', 10, 15, 'ayah'),
  ('ibu-mendengar-cerita', 'komunikasi', 'Ibu mendengar cerita', 'Ibu mendengarkan anak bercerita tentang harinya selama lima menit tanpa menyela. Setelah itu, ibu mengulang hal yang paling ia pahami.', 10, 10, 'ibu'),
  ('ibu-berbagi-pengalaman', 'komunikasi', 'Ibu berbagi pengalaman', 'Ibu menceritakan satu hal yang ia pelajari hari ini. Anak boleh bertanya, lalu ibu mendengarkan cerita anak tentang hal yang sama.', 15, 10, 'ibu'),
  ('ibu-memilih-kegiatan-bersama', 'kebersamaan', 'Ibu memilih kegiatan bersama', 'Ibu dan anak memilih satu kegiatan sederhana yang bisa dilakukan bersama di rumah, lalu membagi langkahnya.', 20, 10, 'ibu'),
  ('ibu-pulang-kerja-mendengar', 'sepulang_kerja', 'Ibu mendengar kabar hari ini', 'Setelah beristirahat, ibu meminta anak menceritakan satu hal yang menyenangkan dan satu hal yang sulit hari ini. Ibu mendengarkan tanpa langsung memberi nasihat.', 10, 10, 'ibu'),
  ('ibu-mendampingi-kunjungan-kerja', 'ke_tempat_kerja', 'Ibu menyiapkan kunjungan kerja', 'Ibu menjelaskan satu aturan keselamatan di tempat kerja, menunjukkan area yang boleh dikunjungi, dan mendampingi anak sepanjang waktu.', 10, 15, 'ibu'),
  ('anak-berbagi-cerita-hari-ini', 'sepulang_kerja', 'Anak berbagi cerita hari ini', 'Saat orang tua pulang kerja, anak menceritakan satu hal yang menyenangkan dan satu hal yang ingin ia ceritakan lebih lanjut.', 10, 10, 'anak')
on conflict (slug) do nothing;

update public.tantangan
set peringatan = 'Pastikan tempat kerja mengizinkan anak berkunjung dan orang tua mendampingi anak sepanjang waktu. Ikuti aturan keselamatan di sana.'
where peran_target in ('ayah', 'ibu') and kategori = 'ke_tempat_kerja';

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
  target_peran public.peran_keluarga;
  tgl_lahir date;
  segmen_target public.segmen_tantangan;
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
    target_peran := 'anak';
    segmen_target := public.segmen_usia_anak(tgl_lahir, hari);
  else
    select a.peran into target_peran
    from public.anggota a
    where a.keluarga_id = p_keluarga and a.user_id = auth.uid();
    if target_peran is null or target_peran = 'anak' then
      raise exception 'khusus_orang_tua';
    end if;
  end if;

  select * into ada from public.tantangan_harian
  where keluarga_id = p_keluarga and tanggal = hari
    and (
      (p_anak is not null and anak_id = p_anak)
      or (p_anak is null and anak_id is null and peran_penugasan = target_peran)
    );

  if found and ada.mode = p_mode and not p_ganti and not ada.dilewati
     and public.tantangan_tersedia(p_keluarga, ada.tantangan_slug)
     and exists (
       select 1 from public.tantangan t
       where t.slug = ada.tantangan_slug
         and (t.peran_target is null or t.peran_target = target_peran)
         and (t.segmen is null or t.segmen = segmen_target)
     ) then
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
    and (t.peran_target is null or t.peran_target = target_peran)
    and (t.segmen is null or t.segmen = segmen_target)
    and (
      (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
      or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
      or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
    )
    and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
    and (
      p_anak is not null
      or not exists (
        select 1 from public.tantangan_harian h
        where h.keluarga_id = p_keluarga and h.tanggal = hari
          and h.anak_id is null
          and h.peran_penugasan <> target_peran
          and h.tantangan_slug = t.slug
      )
    )
    and not exists (
      select 1 from public.bukti b
      where b.keluarga_id = p_keluarga and b.tantangan_slug = t.slug
        and b.anak_id is not distinct from p_anak
        and b.tanggal > hari - 14 and b.status in ('menunggu', 'disetujui')
    )
  order by (t.peran_target is not null) desc, random()
  limit 1;

  if pilihan is null then
    select t.slug into pilihan
    from public.tantangan t
    where t.aktif
      and public.tantangan_tersedia(p_keluarga, t.slug)
      and (t.peran_target is null or t.peran_target = target_peran)
      and (t.segmen is null or t.segmen = segmen_target)
      and (
        (p_mode = 'pulang_kerja' and t.kategori = 'sepulang_kerja')
        or (p_mode = 'hari_kunjungan' and t.kategori = 'ke_tempat_kerja')
        or (p_mode = 'biasa' and t.kategori not in ('sepulang_kerja', 'ke_tempat_kerja'))
      )
      and (ada.tantangan_slug is null or t.slug <> ada.tantangan_slug)
      and (
        p_anak is not null
        or not exists (
          select 1 from public.tantangan_harian h
          where h.keluarga_id = p_keluarga and h.tanggal = hari
            and h.anak_id is null
            and h.peran_penugasan <> target_peran
            and h.tantangan_slug = t.slug
        )
      )
    order by (t.peran_target is not null) desc, random()
    limit 1;
  end if;

  if pilihan is null and ada.tantangan_slug is not null then
    select t.slug into pilihan
    from public.tantangan t
    where t.slug = ada.tantangan_slug and t.aktif
      and public.tantangan_tersedia(p_keluarga, t.slug)
      and (t.peran_target is null or t.peran_target = target_peran)
      and (t.segmen is null or t.segmen = segmen_target);
  end if;
  if pilihan is null then raise exception 'tantangan_tidak_tersedia'; end if;

  if p_anak is null then
    insert into public.tantangan_harian (
      keluarga_id, tanggal, tantangan_slug, mode, dilewati, peran_penugasan
    ) values (p_keluarga, hari, pilihan, p_mode, false, target_peran)
    on conflict (keluarga_id, tanggal, peran_penugasan) where anak_id is null do update
      set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  else
    insert into public.tantangan_harian (
      keluarga_id, tanggal, anak_id, tantangan_slug, mode, dilewati, peran_penugasan
    ) values (p_keluarga, hari, p_anak, pilihan, p_mode, false, 'anak')
    on conflict (keluarga_id, tanggal, anak_id) where anak_id is not null do update
      set tantangan_slug = excluded.tantangan_slug, mode = excluded.mode, dilewati = false;
  end if;
  return pilihan;
end;
$$;

create or replace function public.lewati_tantangan(
  p_keluarga uuid,
  p_anak uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  target_peran public.peran_keluarga;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  if p_anak is not null then
    if not exists (
      select 1 from public.anggota
      where keluarga_id = p_keluarga and user_id = p_anak and peran = 'anak'
    ) then raise exception 'anak_tidak_ada'; end if;
    if auth.uid() <> p_anak and not public.is_parent_role(p_keluarga) then
      raise exception 'khusus_orang_tua';
    end if;
    target_peran := 'anak';
  else
    select a.peran into target_peran
    from public.anggota a
    where a.keluarga_id = p_keluarga and a.user_id = auth.uid();
    if target_peran is null or target_peran = 'anak' then
      raise exception 'khusus_orang_tua';
    end if;
  end if;

  update public.tantangan_harian
  set dilewati = true
  where keluarga_id = p_keluarga and tanggal = public.hari_ini()
    and (
      (p_anak is not null and anak_id = p_anak)
      or (p_anak is null and anak_id is null and peran_penugasan = target_peran)
    );
end;
$$;

create or replace function public.kirim_bukti(
  p_keluarga uuid,
  p_tantangan text,
  p_jenis public.jenis_bukti,
  p_teks text,
  p_hash text,
  p_drive_file_id text,
  p_drive_sumber text default 'keluarga',
  p_anak uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  bid uuid;
  huruf int;
  t public.tantangan;
  segmen_target public.segmen_tantangan;
  tgl_lahir date;
  peran_pengirim public.peran_keluarga;
begin
  if not public.is_member(p_keluarga) then raise exception 'bukan_anggota'; end if;
  select * into t from public.tantangan where slug = p_tantangan;
  if not found then raise exception 'tantangan_tidak_ada'; end if;

  if t.peran_target = 'anak' and p_anak is null then
    raise exception 'anak_wajib';
  end if;

  if t.peran_target is not null then
    if p_anak is null then
      select a.peran into peran_pengirim
      from public.anggota a
      where a.keluarga_id = p_keluarga and a.user_id = auth.uid();
      if peran_pengirim is distinct from t.peran_target then
        raise exception 'tantangan_tidak_sesuai_peran';
      end if;
    elsif t.peran_target <> 'anak' then
      raise exception 'tantangan_tidak_sesuai_peran';
    end if;
  end if;

  if p_anak is null and t.segmen is not null then raise exception 'anak_wajib'; end if;
  if p_anak is not null then
    select p.tgl_lahir into tgl_lahir
    from public.anggota a
    join public.profiles p on p.id = a.user_id
    where a.keluarga_id = p_keluarga and a.user_id = p_anak and a.peran = 'anak';
    if not found then raise exception 'anak_tidak_ada'; end if;
    if auth.uid() <> p_anak and not public.is_parent_role(p_keluarga) then
      raise exception 'khusus_orang_tua';
    end if;
    segmen_target := public.segmen_usia_anak(tgl_lahir);
    if t.segmen is not null and t.segmen is distinct from segmen_target then
      raise exception 'segmen_tidak_sesuai';
    end if;
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

  if exists (
    select 1 from public.bukti
    where keluarga_id = p_keluarga and hash = p_hash
      and status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'bukti_kembar'; end if;
  if exists (
    select 1 from public.bukti
    where keluarga_id = p_keluarga and tantangan_slug = p_tantangan
      and tanggal = public.hari_ini() and anak_id is not distinct from p_anak
      and status in ('menunggu', 'disetujui', 'ditandai')
  ) then raise exception 'sudah_dikirim_hari_ini'; end if;

  insert into public.bukti (
    keluarga_id, tantangan_slug, anak_id, pengirim_id, jenis, teks,
    drive_file_id, drive_sumber, hash
  )
  values (
    p_keluarga, p_tantangan, p_anak, auth.uid(), p_jenis, nullif(trim(p_teks), ''),
    p_drive_file_id, case when p_jenis = 'foto' then p_drive_sumber else 'keluarga' end, p_hash
  )
  returning id into bid;
  return bid;
end;
$$;

revoke all on function
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean, uuid),
  public.lewati_tantangan(uuid, uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function
  public.atur_tantangan_hari_ini(uuid, public.mode_hari, boolean, uuid),
  public.lewati_tantangan(uuid, uuid),
  public.kirim_bukti(uuid, text, public.jenis_bukti, text, text, text, text, uuid)
  to authenticated;
