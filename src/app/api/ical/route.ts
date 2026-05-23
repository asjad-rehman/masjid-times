import { NextRequest } from "next/server";
import { getAdhanTimes } from "@/lib/prayer";
import { getJamaatTimes } from "@/lib/db";
import { masjid } from "@/config/masjid";

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatICSDate(date: Date) {
  // Returns YYYYMMDDTHHmmssZ in UTC
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

function buildPrayerEvents(startDate: Date, days: number, jamaat: any) {
  const events: string[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const adhan = getAdhanTimes(date);
    const prayers = [
      { key: "fajr", label: "Fajr", time: adhan.fajr, jamaat: jamaat.fajr },
      { key: "dhuhr", label: "Dhuhr", time: adhan.dhuhr, jamaat: jamaat.dhuhr },
      { key: "asr", label: "Asr", time: adhan.asr, jamaat: jamaat.asr },
      { key: "maghrib", label: "Maghrib", time: adhan.maghrib, jamaat: jamaat.maghrib },
      { key: "isha", label: "Isha", time: adhan.isha, jamaat: jamaat.isha },
    ];
    for (const p of prayers) {
      // Adhan event
      events.push(`BEGIN:VEVENT\nSUMMARY:${p.label} Adhan\nDTSTART:${formatICSDate(p.time)}\nDTEND:${formatICSDate(new Date(p.time.getTime() + 15 * 60000))}\nDESCRIPTION:${p.label} Adhan at ${masjid.name}\nLOCATION:${masjid.name}\nEND:VEVENT`);
      // Jamaat event (if set)
      if (p.jamaat && /^\d{1,2}:\d{2}$/.test(p.jamaat)) {
        const [h, m] = p.jamaat.split(":").map(Number);
        const jamaatDate = new Date(p.time);
        jamaatDate.setHours(h, m, 0, 0);
        events.push(`BEGIN:VEVENT\nSUMMARY:${p.label} Jamaat\nDTSTART:${formatICSDate(jamaatDate)}\nDTEND:${formatICSDate(new Date(jamaatDate.getTime() + 15 * 60000))}\nDESCRIPTION:${p.label} Jamaat at ${masjid.name}\nLOCATION:${masjid.name}\nEND:VEVENT`);
      }
    }
    // Jumu'ah slots
    if (jamaat.jummah && Array.isArray(jamaat.jummah)) {
      jamaat.jummah.forEach((slot: any, idx: number) => {
        if (slot.khutbah && /^\d{1,2}:\d{2}$/.test(slot.khutbah)) {
          const [h, m] = slot.khutbah.split(":").map(Number);
          const khutbahDate = new Date(date);
          khutbahDate.setHours(h, m, 0, 0);
          events.push(`BEGIN:VEVENT\nSUMMARY:Jumu'ah ${idx + 1} Khutbah\nDTSTART:${formatICSDate(khutbahDate)}\nDTEND:${formatICSDate(new Date(khutbahDate.getTime() + 30 * 60000))}\nDESCRIPTION:Jumu'ah Khutbah at ${masjid.name}\nLOCATION:${masjid.name}\nEND:VEVENT`);
        }
        if (slot.salah && /^\d{1,2}:\d{2}$/.test(slot.salah)) {
          const [h, m] = slot.salah.split(":").map(Number);
          const salahDate = new Date(date);
          salahDate.setHours(h, m, 0, 0);
          events.push(`BEGIN:VEVENT\nSUMMARY:Jumu'ah ${idx + 1} Salah\nDTSTART:${formatICSDate(salahDate)}\nDTEND:${formatICSDate(new Date(salahDate.getTime() + 30 * 60000))}\nDESCRIPTION:Jumu'ah Salah at ${masjid.name}\nLOCATION:${masjid.name}\nEND:VEVENT`);
        }
      });
    }
  }
  return events;
}

export async function GET(req: NextRequest) {
  // Default: 30 days
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, parseInt(searchParams.get("days") || "30", 10));
  const start = new Date();
  const jamaat = await getJamaatTimes();
  const events = buildPrayerEvents(start, days, jamaat);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${masjid.name.replace(/\s+/g, "-")}//PrayerTimes//EN`,
    ...events,
    "END:VCALENDAR"
  ].join("\n");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=prayer-times.ics`,
    },
  });
}
