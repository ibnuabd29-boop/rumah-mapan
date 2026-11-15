"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { hapusLanggananPush, periksaLanggananPush, simpanLanggananPush } from "@/app/actions-pwa";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Perangkat = {
  terpasang: boolean;
  ios: boolean;
  didukung: boolean;
  izin: NotificationPermission | "tidak-tersedia";
  zonaWaktu: string;
};

function ambilKeadaanPerangkat(): string {
  const ios =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const keadaan: Perangkat = {
    terpasang:
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && navigator.standalone === true),
    ios,
    didukung: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    izin: "Notification" in window ? Notification.permission : "tidak-tersedia",
    zonaWaktu: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
  };
  return JSON.stringify(keadaan);
}

function dengarkanPerangkat(berubah: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  window.addEventListener("appinstalled", berubah);
  window.addEventListener("pageshow", berubah);
  document.addEventListener("visibilitychange", berubah);
  media.addEventListener("change", berubah);
  return () => {
    window.removeEventListener("appinstalled", berubah);
    window.removeEventListener("pageshow", berubah);
    document.removeEventListener("visibilitychange", berubah);
    media.removeEventListener("change", berubah);
  };
}

function kunciVapidKeBytes(encoded: string) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function PengaturanPWA({
  kunciPublik,
  pengingatSiap,
}: {
  kunciPublik: string | null;
  pengingatSiap: boolean;
}) {
  const perangkat = JSON.parse(useSyncExternalStore(
    dengarkanPerangkat,
    ambilKeadaanPerangkat,
    () => JSON.stringify({
      terpasang: false,
      ios: false,
      didukung: false,
      izin: "default",
      zonaWaktu: "Asia/Jakarta",
    }),
  )) as Perangkat;
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [izinOverride, setIzinOverride] = useState<NotificationPermission | "tidak-tersedia" | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [aktif, setAktif] = useState(false);
  const [waktuLokal, setWaktuLokal] = useState("19:00");
  const [zonaTersimpan, setZonaTersimpan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [status, setStatus] = useState("");
  const { didukung, ios, izin, terpasang, zonaWaktu } = perangkat;
  const izinAktif = izinOverride ?? izin;

  useEffect(() => {
    const tangkapInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const selesaiInstall = () => {
      setInstallEvent(null);
    };
    window.addEventListener("beforeinstallprompt", tangkapInstall);
    window.addEventListener("appinstalled", selesaiInstall);

    let masihTerpasang = true;
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((registration) => registration.pushManager.getSubscription())
        .then(async (sub) => {
          if (!masihTerpasang || !sub) return;
          setSubscription(sub);
          const hasil = await periksaLanggananPush(sub.endpoint);
          if (!masihTerpasang) return;
          setAktif(hasil.aktif);
          if (hasil.waktuLokal) setWaktuLokal(hasil.waktuLokal);
          if (hasil.zonaWaktu) setZonaTersimpan(hasil.zonaWaktu);
          if (hasil.galat) setStatus(hasil.galat);
        })
        .catch(() => {
          if (masihTerpasang) setStatus("Pendaftaran notifikasi perangkat belum berhasil. Muat ulang halaman untuk mencoba lagi.");
        });
    }

    return () => {
      masihTerpasang = false;
      window.removeEventListener("beforeinstallprompt", tangkapInstall);
      window.removeEventListener("appinstalled", selesaiInstall);
    };
  }, []);

  async function pasangAplikasi() {
    if (!installEvent) return;
    await installEvent.prompt();
    const pilihan = await installEvent.userChoice;
    setStatus(pilihan.outcome === "accepted" ? "Rumah Mapan ditambahkan ke perangkat." : "Pemasangan belum dilakukan.");
    setInstallEvent(null);
  }

  async function aktifkanPengingat() {
    if (!kunciPublik || !pengingatSiap) {
      setStatus("Pengingat belum dikonfigurasi oleh pengelola situs.");
      return;
    }
    if (!didukung) {
      setStatus("Browser ini belum mendukung notifikasi push.");
      return;
    }
    setSibuk(true);
    setStatus("");
    try {
      const izinBaru = izinAktif === "granted" ? izinAktif : await Notification.requestPermission();
      setIzinOverride(izinBaru);
      if (izinBaru !== "granted") {
        setStatus(izinBaru === "denied"
          ? "Izin notifikasi ditolak. Ubah izin Rumah Mapan di pengaturan browser untuk mengaktifkannya."
          : "Izin notifikasi belum diberikan.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub = subscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: kunciVapidKeBytes(kunciPublik),
      });
      const hasil = await simpanLanggananPush({
        ...sub.toJSON(),
        waktuLokal,
        zonaWaktu: zonaTersimpan ?? zonaWaktu,
      });
      if (hasil.galat) {
        if (!subscription) await sub.unsubscribe();
        setStatus(hasil.galat);
        return;
      }
      setSubscription(sub);
      setAktif(true);
      setStatus(hasil.ok ?? "Pengingat aktif.");
    } catch {
      setStatus("Pengingat belum berhasil diaktifkan. Periksa koneksi dan pengaturan browser, lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  async function nonaktifkanPengingat() {
    if (!subscription) return;
    setSibuk(true);
    setStatus("");
    try {
      const hasil = await hapusLanggananPush(subscription.endpoint);
      if (hasil.galat) {
        setStatus(hasil.galat);
        return;
      }
      const berhenti = await subscription.unsubscribe();
      setAktif(false);
      setSubscription(null);
      setStatus(berhenti
        ? hasil.ok ?? "Pengingat dinonaktifkan."
        : "Pengingat server dinonaktifkan, tetapi browser belum menghapus langganan perangkat.");
    } catch {
      setStatus("Pengingat belum berhasil dinonaktifkan. Periksa koneksi lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <section aria-labelledby="judul-pwa" className="flex flex-col gap-3 border-y border-line py-4">
      <h2 id="judul-pwa" className="text-lg font-semibold">Aplikasi di perangkat</h2>
      <p className="text-sm text-muted">
        Materi dan kartu obrolan bisa dibaca luring setelah tersimpan. Progres dan data keluarga tetap memerlukan internet.
      </p>
      {!terpasang && installEvent && (
        <button
          type="button"
          onClick={pasangAplikasi}
          className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90"
        >
          Pasang Rumah Mapan
        </button>
      )}
      {!terpasang && ios && (
        <p className="text-sm">
          Untuk memasang di iPhone atau iPad, buka menu Bagikan di Safari lalu pilih Tambahkan ke Layar Utama.
        </p>
      )}
      {!terpasang && !ios && !installEvent && (
        <p className="text-sm">Gunakan menu browser dan pilih Pasang aplikasi atau Tambahkan ke layar utama, jika tersedia.</p>
      )}
      {terpasang && <p className="text-sm">Rumah Mapan sudah dibuka sebagai aplikasi di perangkat ini.</p>}

      <h2 className="pt-2 text-lg font-semibold">Pengingat tantangan</h2>
      <p className="text-sm text-muted">
        Pilih waktu setempat untuk pengingat harian. Jika notifikasi aktif, tantangan baru, tenggat, dan tantangan yang dipin juga dapat dikirim ke perangkat.
      </p>
      {pengingatSiap && (
        <div className="flex flex-col gap-1">
          <label htmlFor="waktu-pengingat" className="font-semibold">Waktu pengingat</label>
          <input
            id="waktu-pengingat"
            type="time"
            value={waktuLokal}
            onChange={(event) => setWaktuLokal(event.target.value)}
            disabled={sibuk}
            className="min-h-11 w-fit rounded-lg border border-field bg-surface px-3 py-2 text-ink disabled:opacity-60"
          />
          <span className="text-sm text-muted">Zona waktu perangkat: {zonaWaktu}</span>
          {aktif && <span className="text-sm text-muted">Simpan perubahan dengan tombol di bawah.</span>}
        </div>
      )}
      {(!kunciPublik || !pengingatSiap) && (
        <p className="text-sm">Pengingat belum dikonfigurasi oleh pengelola situs.</p>
      )}
      {pengingatSiap && !didukung && (
        <p className="text-sm">Browser ini belum mendukung notifikasi push. Tantangan tetap bisa dibuka dari Beranda.</p>
      )}
      {pengingatSiap && ios && !terpasang && (
        <p className="text-sm">Di iPhone dan iPad, pasang aplikasi ke Layar Utama sebelum mengaktifkan notifikasi.</p>
      )}
      {pengingatSiap && didukung && !(ios && !terpasang) && (aktif ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={aktifkanPengingat}
            disabled={sibuk}
            className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {sibuk ? "Menyimpan..." : "Simpan waktu pengingat"}
          </button>
          <button
            type="button"
            onClick={nonaktifkanPengingat}
            disabled={sibuk}
            className="inline-flex min-h-11 w-fit items-center rounded-lg border border-field px-4 py-2 font-semibold hover:bg-line/50 disabled:opacity-60"
          >
            Nonaktifkan pengingat
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={aktifkanPengingat}
          disabled={sibuk || izinAktif === "denied"}
          className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary hover:opacity-90 disabled:opacity-60"
        >
          {sibuk ? "Menyimpan..." : "Aktifkan pengingat"}
        </button>
      ))}
      {izinAktif === "denied" && (
        <p className="text-sm">Izin notifikasi ditolak. Ubah izin Rumah Mapan di pengaturan browser sebelum mencoba lagi.</p>
      )}
      {izinAktif === "tidak-tersedia" && <p className="text-sm text-muted">Izin notifikasi tidak tersedia di browser ini.</p>}
      {status && <p role="status" aria-live="polite" className="text-sm">{status}</p>}
    </section>
  );
}
