import type { Metadata } from "next";
import { batalkanUndangan, keluarkanAnggota } from "@/app/actions-keluarga";
import { FormHapusKeluarga, FormUndangan } from "@/components/FormKeluarga";
import { Tombol } from "@/components/ui";
import { driveSiap } from "@/lib/drive";
import { ambilSesi } from "@/lib/sesi";
import { labelPeran } from "@/lib/umum";

export const metadata: Metadata = { title: "Keluarga" };

const tanggal = new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" });

export default async function Halaman({ searchParams }: PageProps<"/keluarga">) {
  const sp = await searchParams;
  const { supabase, user, rumah } = await ambilSesi();

  if (!rumah) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Keluarga</h1>
        <p className="text-muted">
          Anda belum punya rumah. Buat satu di{" "}
          <a href="/beranda" className="font-semibold underline">
            Beranda
          </a>{" "}
          atau buka tautan undangan dari pemilik rumah.
        </p>
      </section>
    );
  }

  const pemilik = rumah.pemilik_id === user.id;
  const { data: statusDrive } = pemilik ? await supabase.rpc("status_drive", { p_keluarga: rumah.id }) : { data: null };
  const { data: anggota } = await supabase
    .from("anggota")
    .select("user_id, peran, bergabung_at, profil:user_id (nama)")
    .eq("keluarga_id", rumah.id)
    .order("bergabung_at", { ascending: true });
  const { data: undangan } = pemilik
    ? await supabase
        .from("undangan")
        .select("id, peran, kedaluwarsa_at, dipakai_at")
        .eq("keluarga_id", rumah.id)
        .is("dipakai_at", null)
        .gt("kedaluwarsa_at", new Date().toISOString())
        .order("kedaluwarsa_at", { ascending: true })
    : { data: [] };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="judul" className="flex flex-col gap-1">
        <h1 id="judul" className="text-2xl font-semibold">
          {rumah.nama}
        </h1>
        <p className="text-muted">{pemilik ? "Anda pemilik rumah ini." : "Anda anggota rumah ini."}</p>
      </section>

      <section aria-labelledby="anggota" className="flex flex-col gap-3">
        <h2 id="anggota" className="text-lg font-semibold">
          Anggota
        </h2>
        <ul className="divide-y divide-line border-y border-line">
          {(anggota ?? []).map((a) => {
            const nama = (a.profil as unknown as { nama: string } | null)?.nama ?? "Anggota";
            const dirinya = a.user_id === user.id;
            const bisaKeluarkan = pemilik && !dirinya;
            const bisaKeluar = dirinya && !pemilik;
            return (
              <li key={a.user_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {nama}
                    {dirinya ? " (Anda)" : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {labelPeran(a.peran)}
                    {a.user_id === rumah.pemilik_id ? ", pemilik" : ""}
                  </p>
                </div>
                {bisaKeluarkan || bisaKeluar ? (
                  <form action={keluarkanAnggota}>
                    <input type="hidden" name="keluarga_id" value={rumah.id} />
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <Tombol
                      variant="bahaya"
                      aria-label={bisaKeluar ? "Keluar dari rumah ini" : `Keluarkan ${nama} dari rumah`}
                    >
                      {bisaKeluar ? "Keluar" : "Keluarkan"}
                    </Tombol>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {pemilik ? (
        <>
          <section aria-labelledby="drive" className="flex flex-col gap-3">
            <h2 id="drive" className="text-lg font-semibold">
              Google Drive untuk foto bukti
            </h2>
            {sp.drive === "ok" ? <p role="status" className="rounded-lg border border-primary px-3 py-2"><strong>Berhasil: </strong>Google Drive tersambung.</p> : null}
            {sp.drive === "gagal" ? <p role="alert" className="rounded-lg border border-bahaya px-3 py-2 text-bahaya"><strong>Gagal: </strong>Google Drive belum tersambung. Coba lagi.</p> : null}
            <p>
              Status:{" "}
              <strong>
                {statusDrive === "tersambung" ? "tersambung" : statusDrive === "terputus" ? "terputus" : "belum dihubungkan"}
              </strong>
              .
            </p>
            <p className="text-muted">
              Foto bukti disimpan di folder &quot;Rumah Mapan&quot; di Drive Anda. Aplikasi hanya bisa mengakses folder
              dan berkas yang dibuatnya sendiri, bukan isi Drive Anda yang lain. Anggota lain melihat foto lewat
              aplikasi dan tidak perlu akun Google.
            </p>
            {statusDrive !== "tersambung" ? (
              driveSiap() ? (
                <a
                  href={`/api/drive/hubungkan?keluarga=${rumah.id}`}
                  className="inline-flex min-h-11 items-center justify-center self-start rounded-lg bg-primary px-5 py-2.5 font-semibold text-on-primary"
                >
                  {statusDrive === "terputus" ? "Hubungkan ulang Google Drive" : "Hubungkan Google Drive"}
                </a>
              ) : (
                <p className="text-muted">Penghubung Google Drive belum dikonfigurasi di server ini.</p>
              )
            ) : null}
          </section>

          <section aria-labelledby="undang" className="flex flex-col gap-4">
            <h2 id="undang" className="text-lg font-semibold">
              Undang anggota
            </h2>
            <FormUndangan keluargaId={rumah.id} />
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">Undangan yang masih berlaku</h3>
              {undangan && undangan.length > 0 ? (
                <ul className="divide-y divide-line border-y border-line">
                  {undangan.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                      <p>
                        {labelPeran(u.peran)}
                        <span className="block text-sm text-muted">
                          Berlaku sampai {tanggal.format(new Date(u.kedaluwarsa_at))}
                        </span>
                      </p>
                      <form action={batalkanUndangan}>
                        <input type="hidden" name="id" value={u.id} />
                        <Tombol variant="sekunder" aria-label={`Batalkan undangan ${labelPeran(u.peran)}`}>
                          Batalkan
                        </Tombol>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">
                  Tidak ada undangan yang menunggu. Tautan yang sudah dipakai atau kedaluwarsa tidak
                  ditampilkan lagi.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="hapus" className="flex flex-col gap-3 border-t border-line pt-6">
            <h2 id="hapus" className="text-lg font-semibold">
              Hapus rumah
            </h2>
            <p className="text-muted">
              Ini menghapus data seluruh keluarga: semua anggota keluar dari rumah dan data rumah hilang
              untuk semua orang. Akun masing-masing tetap ada. Tindakan ini tidak bisa dibatalkan.
            </p>
            <FormHapusKeluarga keluargaId={rumah.id} nama={rumah.nama} />
          </section>
        </>
      ) : null}
    </div>
  );
}
