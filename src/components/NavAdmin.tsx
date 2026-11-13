"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/admin", label: "Ringkasan", tepat: true },
  { href: "/admin/progres", label: "Progres" },
  { href: "/admin/konten", label: "Konten" },
  { href: "/admin/drive", label: "Google Drive" },
  { href: "/admin/keluarga", label: "Keluarga" },
  { href: "/admin/pengguna", label: "Pengguna" },
  { href: "/admin/bukti", label: "Bukti" },
  { href: "/admin/audit", label: "Audit" },
];

export function NavAdmin() {
  const path = usePathname();
  return (
    <nav aria-label="Menu admin">
      <ul className="flex flex-wrap gap-2">
        {MENU.map((m) => {
          const aktif = m.tepat ? path === m.href : path === m.href || path.startsWith(`${m.href}/`);
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2 font-semibold transition-colors ${
                  aktif
                    ? "border-primary bg-primary text-on-primary"
                    : "border-field hover:bg-line/50 active:bg-line"
                }`}
              >
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
