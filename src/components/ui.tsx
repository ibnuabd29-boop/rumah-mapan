"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";

const dasar =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-colors disabled:opacity-60";

const varian = {
  utama: "bg-primary text-on-primary hover:brightness-110 active:brightness-90",
  aksen: "bg-aksen text-on-aksen hover:brightness-105 active:brightness-95",
  sekunder:
    "border border-field bg-transparent text-ink hover:bg-line/50 active:bg-line",
  bahaya:
    "border border-bahaya bg-transparent text-bahaya hover:bg-bahaya/10 active:bg-bahaya/20",
  // Dipakai di atas kartu beraksen kuning: warna teks mengikuti on-aksen agar kontras di dua tema.
  padaAksen:
    "border border-on-aksen bg-transparent text-on-aksen hover:bg-on-aksen/10 active:bg-on-aksen/20",
  gelapPadaAksen: "bg-on-aksen text-aksen hover:brightness-125 active:brightness-90",
} as const;

export function Tombol({
  variant = "utama",
  className = "",
  children,
  teksTunggu = "Memproses...",
  ...rest
}: ComponentProps<"button"> & { variant?: keyof typeof varian; teksTunggu?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      {...rest}
      disabled={pending || rest.disabled}
      aria-disabled={pending || rest.disabled}
      className={`${dasar} ${varian[variant]} ${className}`}
    >
      {pending ? teksTunggu : children}
    </button>
  );
}

export function TautanTombol({
  variant = "sekunder",
  className = "",
  ...rest
}: ComponentProps<"a"> & { variant?: keyof typeof varian }) {
  return <a {...rest} className={`${dasar} ${varian[variant]} ${className}`} />;
}

export function Medan({
  label,
  id,
  petunjuk,
  ...rest
}: ComponentProps<"input"> & { label: string; id: string; petunjuk?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={rest.name ?? id}
        aria-describedby={petunjuk ? `${id}-petunjuk` : undefined}
        {...rest}
        className="min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink placeholder:text-muted transition-colors focus:border-primary"
      />
      {petunjuk ? (
        <p id={`${id}-petunjuk`} className="text-sm text-muted">
          {petunjuk}
        </p>
      ) : null}
    </div>
  );
}

export function Pilihan({
  label,
  id,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <select
        id={id}
        name={rest.name ?? id}
        {...rest}
        className="min-h-11 rounded-lg border border-field bg-surface px-3 py-2 text-ink transition-colors focus:border-primary"
      >
        {children}
      </select>
    </div>
  );
}

export function Centang({
  id,
  children,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { id: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={rest.name ?? id}
        type="checkbox"
        {...rest}
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
      />
      <label htmlFor={id} className="text-sm leading-snug">
        {children}
      </label>
    </div>
  );
}

/** Pesan hasil aksi. Galat memakai ikon teks "Gagal:" agar tidak hanya bergantung pada warna. */
export function Pesan({ galat, ok }: { galat?: string; ok?: string }) {
  if (!galat && !ok) return null;
  return (
    <p
      role={galat ? "alert" : "status"}
      className={`rounded-lg border px-3 py-2 text-sm ${
        galat ? "border-bahaya text-bahaya" : "border-primary text-ink"
      }`}
    >
      <strong>{galat ? "Gagal: " : "Berhasil: "}</strong>
      {galat ?? ok}
    </p>
  );
}
