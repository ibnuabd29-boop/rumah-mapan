"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function DaftarServiceWorker() {
  const path = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Service worker Rumah Mapan gagal didaftarkan.", error);
      });
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !["/obrolan", "/materi"].includes(path)) return;

    const perbaruiKontenLuring = async () => {
      if (!navigator.onLine) return;
      try {
        await navigator.serviceWorker.ready;
        const response = await fetch("/offline-content", { cache: "no-store" });
        if (!response.ok) console.error("Konten offline Rumah Mapan belum berhasil diperbarui.", response.status);
      } catch (error: unknown) {
        if (navigator.onLine) console.error("Konten offline Rumah Mapan gagal diperbarui.", error);
      }
    };

    void perbaruiKontenLuring();
    window.addEventListener("online", perbaruiKontenLuring);
    return () => window.removeEventListener("online", perbaruiKontenLuring);
  }, [path]);

  return null;
}
