import type { Metadata } from "next";
import { FormLayanan } from "@/components/FormLayanan";
import { Tombol } from "@/components/ui";
import { ubahStatusLayanan } from "@/app/actions-layanan";
import { ambilSesi } from "@/lib/sesi";

export const metadata: Metadata = { title: "Layanan keluarga" };

type PesanLayanan = {
  id: string;
  pengguna_id: string;
  jenis: "kritik_saran" | "kesehatan_mental" | "konselor_sebaya";
  isi: string;
  status: "baru" | "ditinjau" | "selesai";
  dibuat_at: string;
};

const WAKTU = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const STATUS = {
  baru: "Baru",
  ditinjau: "Sedang ditinjau",
  selesai: "Selesai",
} as const;

function DaftarKonselor({ pesan }: { pesan: PesanLayanan[] }) {
  if (!pesan.length) return <p className="text-muted">Belum ada permintaan untuk ditinjau.</p>;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {pesan.map((item) => (
        <li key={item.id} className="flex flex-col gap-2 py-4">
          <p className="text-sm text-muted">
            {WAKTU.format(new Date(item.dibuat_at))}, {STATUS[item.status]}
          </p>
          <p className="whitespace-pre-wrap break-words">{item.isi}</p>
          {item.status !== "selesai" ? (
            <div className="flex flex-wrap gap-2">
              {item.status === "baru" ? (
                <form action={ubahStatusLayanan}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="status" value="ditinjau" />
                  <Tombol variant="sekunder">Tandai sedang ditinjau</Tombol>
                </form>
              ) : null}
              <form action={ubahStatusLayanan}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="status" value="selesai" />
                <Tombol variant="sekunder">Tandai selesai</Tombol>
              </form>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function Halaman() {
  const { supabase, user } = await ambilSesi();
  const [riwayat, psikolog, konselor] = await Promise.all([
    supabase.from("layanan_masuk")
      .select("id, pengguna_id, jenis, isi, status, dibuat_at")
      .eq("pengguna_id", user.id).order("dibuat_at", { ascending: false }),
    supabase.rpc("is_konselor_layanan", { p_jenis: "kesehatan_mental" }),
    supabase.rpc("is_konselor_layanan", { p_jenis: "konselor_sebaya" }),
  ]);
  const [{ data: antreanPsikolog, error: errorPsikolog }, { data: antreanSebaya, error: errorSebaya }] =
    await Promise.all([
      psikolog.data
        ? supabase.from("layanan_masuk")
            .select("id, pengguna_id, jenis, isi, status, dibuat_at")
            .eq("jenis", "kesehatan_mental").neq("pengguna_id", user.id)
            .order("dibuat_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      konselor.data
        ? supabase.from("layanan_masuk")
            .select("id, pengguna_id, jenis, isi, status, dibuat_at")
            .eq("jenis", "konselor_sebaya").neq("pengguna_id", user.id)
            .order("dibuat_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Layanan keluarga</h1>
        <p className="text-muted">Pilih layanan dan tulis pesan yang ingin disampaikan.</p>
      </header>

      <section aria-labelledby="kritik-saran" className="flex flex-col gap-3 border-t border-line pt-5">
        <div>
          <h2 id="kritik-saran" className="text-lg font-semibold">Kritik dan saran</h2>
          <p className="text-sm text-muted">Pesan ini dapat dibaca oleh Anda dan admin platform.</p>
        </div>
        <FormLayanan jenis="kritik_saran" judul="Pesan" />
      </section>

      <section aria-labelledby="kesehatan-mental" className="flex flex-col gap-3 border-t border-line pt-5">
        <div>
          <h2 id="kesehatan-mental" className="text-lg font-semibold">Pengaduan kesehatan mental</h2>
          <p className="text-sm text-muted">
            Pesan hanya dapat dibaca oleh Anda dan psikolog yang ditunjuk melalui kerja sama. Admin lain dan keluarga tidak dapat membacanya.
            Akses psikolog disiapkan terpisah sebelum layanan profesional tersedia.
          </p>
          <p className="mt-2 text-sm text-muted">
            Jika Anda berada dalam bahaya saat ini, hubungi layanan darurat setempat. Formulir ini bukan layanan darurat.
          </p>
        </div>
        <FormLayanan jenis="kesehatan_mental" judul="Ceritakan hal yang ingin disampaikan" />
      </section>

      <section aria-labelledby="konselor-sebaya" className="flex flex-col gap-3 border-t border-line pt-5">
        <div>
          <h2 id="konselor-sebaya" className="text-lg font-semibold">Konselor sebaya</h2>
          <p className="text-sm text-muted">
            Kirim permintaan atau pertanyaan. Isinya hanya dapat dibaca oleh Anda dan konselor sebaya yang ditunjuk. Admin lain tidak dapat membacanya. Akses konselor disiapkan terpisah.
          </p>
        </div>
        <FormLayanan jenis="konselor_sebaya" judul="Pesan untuk konselor sebaya" />
      </section>

      <section aria-labelledby="riwayat-layanan" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="riwayat-layanan" className="text-lg font-semibold">Pesan Anda</h2>
        {riwayat.error ? (
          <p role="alert" className="text-bahaya">Riwayat pesan belum bisa dimuat. Muat ulang halaman.</p>
        ) : riwayat.data?.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {(riwayat.data as PesanLayanan[]).map((item) => (
              <li key={item.id} className="flex flex-col gap-2 py-4">
                <p className="text-sm text-muted">
                  {item.jenis.replaceAll("_", " ")}, {WAKTU.format(new Date(item.dibuat_at))}, {STATUS[item.status]}
                </p>
                <p className="whitespace-pre-wrap break-words">{item.isi}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Belum ada pesan yang dikirim.</p>
        )}
      </section>

      {psikolog.error || konselor.error ? (
        <p role="alert" className="text-bahaya">Status akses konselor belum bisa diperiksa. Muat ulang halaman.</p>
      ) : null}
      {psikolog.data || konselor.data ? (
        <section aria-labelledby="antrean-konselor" className="flex flex-col gap-4 border-t border-line pt-5">
          <div>
            <h2 id="antrean-konselor" className="text-lg font-semibold">Pesan yang ditugaskan kepada Anda</h2>
            <p className="text-sm text-muted">Pesan hanya tampil untuk jenis layanan yang ditetapkan pada akun Anda.</p>
          </div>
          {psikolog.data ? (
            <section aria-labelledby="antrean-mental" className="flex flex-col gap-2">
              <h3 id="antrean-mental" className="font-semibold">Pengaduan kesehatan mental</h3>
              {errorPsikolog ? (
                <p role="alert" className="text-bahaya">Antrean belum bisa dimuat.</p>
              ) : <DaftarKonselor pesan={(antreanPsikolog ?? []) as PesanLayanan[]} />}
            </section>
          ) : null}
          {konselor.data ? (
            <section aria-labelledby="antrean-sebaya" className="flex flex-col gap-2">
              <h3 id="antrean-sebaya" className="font-semibold">Konselor sebaya</h3>
              {errorSebaya ? (
                <p role="alert" className="text-bahaya">Antrean belum bisa dimuat.</p>
              ) : <DaftarKonselor pesan={(antreanSebaya ?? []) as PesanLayanan[]} />}
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
