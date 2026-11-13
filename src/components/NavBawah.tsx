"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IkonFitur } from "@/components/IkonFitur";

// Empat tujuan utama menghindari navigasi menyamping di ponsel. Halaman lain ada di Menu.
const MENU = [
  { href: "/beranda", label: "Beranda", ikon: "beranda" },
  { href: "/tantangan", label: "Tantangan", ikon: "tantangan" },
  { href: "/perasaan", label: "Perasaan", ikon: "perasaan" },
  { href: "/menu", label: "Menu", ikon: "menu" },
] as const;

export function NavBawah() {
  const path = usePathname();
  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(28,38,35,0.08)]"
    >
      <ul className="mx-auto flex max-w-3xl gap-1 px-2 py-2">
        {MENU.map((m) => {
          const aktif = path === m.href || path.startsWith(`${m.href}/`);
          return (
            <li key={m.href} className="min-w-0 flex-1">
              <Link
                href={m.href}
                aria-current={aktif ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold transition-colors sm:px-2 sm:text-sm ${
                  aktif
                    ? "bg-primary/10 text-primary"
                    : "text-muted hover:bg-bg hover:text-ink active:bg-line"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1 w-8 rounded-full ${aktif ? "bg-primary" : "bg-transparent"}`}
                />
                <IkonFitur nama={m.ikon} className="size-5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
