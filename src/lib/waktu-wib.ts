export function waktuWibKeInput(value?: string | null) {
  if (!value) return undefined;
  const bagian = new Map(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(value))
      .map((item) => [item.type, item.value]),
  );
  return `${bagian.get("year")}-${bagian.get("month")}-${bagian.get("day")}T${bagian.get("hour")}:${bagian.get("minute")}`;
}

export function waktuWibKeISO(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, tahunTeks, bulanTeks, hariTeks, jamTeks, menitTeks] = match;
  const tahun = Number(tahunTeks);
  const bulan = Number(bulanTeks);
  const hari = Number(hariTeks);
  const jam = Number(jamTeks);
  const menit = Number(menitTeks);
  const waktuDinding = new Date(0);
  waktuDinding.setUTCFullYear(tahun, bulan - 1, hari);
  waktuDinding.setUTCHours(jam, menit, 0, 0);
  if (
    waktuDinding.getUTCFullYear() !== tahun
    || waktuDinding.getUTCMonth() !== bulan - 1
    || waktuDinding.getUTCDate() !== hari
    || jam > 23
    || menit > 59
  ) {
    return null;
  }

  return new Date(waktuDinding.getTime() - 7 * 60 * 60 * 1000).toISOString();
}
