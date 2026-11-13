"use client";

import { useEffect } from "react";

export function DaftarServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        console.error("Service worker Rumah Mapan gagal didaftarkan.", error);
      });
  }, []);

  return null;
}
