"use client";

import { useEffect, useMemo, useState } from "react";
import { masjid } from "@/config/masjid";
import { getAdhanTimes } from "@/lib/prayer";
import {
  fmt12From24,
  fmtDateTime12,
  todayInMasjidTZ,
  addDays,
  msToHMS,
} from "@/lib/time";

/* ================= Types & Setup ================= */

type JummahSlot = { khutbah: string; salah: string };

type Jamaat = {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah: JummahSlot[];
  jummah2?: JummahSlot[];
  updatedAt?: string;
};

type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

interface HomeClientProps {
  initialJamaat: Jamaat;
}

const QURAN_VERSES = [
  {
    arabic: "إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا",
    english: "Indeed, prayer has been decreed upon the believers at specified times.",
    ref: "Quran 4:103",
  },
  {
    arabic: "وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ",
    english: "And establish prayer and give zakah and bow with those who bow.",
    ref: "Quran 2:43",
  },
  {
    arabic: "حَافِظُوا عَلَى الصَّلَوَاتِ وَالصَّلَاةِ الْوُسْطَىٰ وَقُومُوا لِلَّهِ قَانِتِينَ",
    english: "Maintain with care the prayers and the middle prayer and stand before Allah.",
    ref: "Quran 2:238",
  },
  {
    arabic: "أَقِمِ الصَّلَاةَ لِدُلُوكِ الشَّمْسِ إِلَىٰ غَسَقِ اللَّيْلِ وَقُرْآنَ الْفَجْرِ",
    english: "Establish prayer at the decline of the sun until the darkness of the night.",
    ref: "Quran 17:78",
  },
];

const STALENESS_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getNextPrayerInfo(
  now: Date,
  today: ReturnType<typeof getAdhanTimes>,
  tomorrow: ReturnType<typeof getAdhanTimes>
): { key: PrayerKey; label: string; at: Date } {
  const order: { key: PrayerKey; label: string; at: Date }[] = [
    { key: "fajr", label: "Fajr", at: today.fajr },
    { key: "sunrise", label: "Sunrise", at: today.sunrise },
    { key: "dhuhr", label: "Dhuhr", at: today.dhuhr },
    { key: "asr", label: "Asr", at: today.asr },
    { key: "maghrib", label: "Maghrib", at: today.maghrib },
    { key: "isha", label: "Isha", at: today.isha },
  ];

  for (const item of order) {
    if (item.at > now) return item;
  }

  return { key: "fajr", label: "Fajr", at: tomorrow.fajr };
}

export default function HomeClient({ initialJamaat }: HomeClientProps) {
  const [jamaat, setJamaat] = useState<Jamaat>(initialJamaat);
  const [now, setNow] = useState<Date>(() => new Date());
  const [use24Hour, setUse24Hour] = useState(false);
  const [verseIndex, setVerseIndex] = useState(0);
  const [verseFading, setVerseFading] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Live clock interval
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll for Jamaat updates from API
  useEffect(() => {
    let active = true;
    let consecutiveFailures = 0;

    async function load() {
      try {
        const res = await fetch("/api/jamaat", { cache: "no-store" });
        if (!res.ok) {
          consecutiveFailures++;
          if (active && consecutiveFailures >= 2) setApiError(true);
          return;
        }
        const json = await res.json();
        if (active && json?.data) {
          setJamaat(json.data);
          setApiError(false);
          consecutiveFailures = 0;
        }
      } catch {
        consecutiveFailures++;
        if (active && consecutiveFailures >= 2) setApiError(true);
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Rotate Quran Verses
  useEffect(() => {
    const id = setInterval(() => {
      setVerseFading(true);
      setTimeout(() => {
        setVerseIndex((prev) => (prev + 1) % QURAN_VERSES.length);
        setVerseFading(false);
      }, 500);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  // Time calculations
  const todayTz = useMemo(() => todayInMasjidTZ(now, masjid.timezone), [now]);
  const tomorrowTz = useMemo(() => addDays(todayTz, 1), [todayTz]);

  const adhanToday = useMemo(() => getAdhanTimes(todayTz), [todayTz]);
  const adhanTomorrow = useMemo(() => getAdhanTimes(tomorrowTz), [tomorrowTz]);

  const next = useMemo(
    () => getNextPrayerInfo(now, adhanToday, adhanTomorrow),
    [now, adhanToday, adhanTomorrow]
  );

  const countdown = useMemo(() => {
    const diff = next.at.getTime() - now.getTime();
    return msToHMS(diff);
  }, [next, now]);

  const todayString = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: masjid.timezone,
    }).format(now);
  }, [now]);

  const isStale = useMemo(() => {
    if (!jamaat.updatedAt) return true;
    const updatedMs = new Date(jamaat.updatedAt).getTime();
    if (isNaN(updatedMs)) return true;
    return Date.now() - updatedMs > STALENESS_THRESHOLD_MS;
  }, [jamaat.updatedAt]);

  const lastUpdatedLabel = useMemo(() => {
    if (!jamaat.updatedAt) return null;
    const d = new Date(jamaat.updatedAt);
    if (isNaN(d.getTime())) return null;
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return "Updated today";
    if (days === 1) return "Updated yesterday";
    return `Updated ${days} days ago`;
  }, [jamaat.updatedAt]);

  // Format helpers
  const formatTimeStr = (time24?: string) => {
    if (!time24) return "—";
    if (use24Hour) return time24;
    return fmt12From24(time24);
  };

  const formatDateObj = (d: Date | null | undefined) => {
    if (!d) return "—";
    if (use24Hour) {
      return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: masjid.timezone,
      }).format(d);
    }
    return fmtDateTime12(d, masjid.timezone);
  };

  const currentVerse = QURAN_VERSES[verseIndex];

  const prayersList = [
    { key: "fajr" as PrayerKey, label: "Fajr", icon: "🌅", adhan: formatDateObj(adhanToday.fajr), jamaat: formatTimeStr(jamaat.fajr) },
    { key: "sunrise" as PrayerKey, label: "Sunrise", icon: "☀️", adhan: formatDateObj(adhanToday.sunrise), jamaat: null, isSunrise: true },
    { key: "dhuhr" as PrayerKey, label: "Dhuhr", icon: "☀️", adhan: formatDateObj(adhanToday.dhuhr), jamaat: formatTimeStr(jamaat.dhuhr) },
    { key: "asr" as PrayerKey, label: "Asr", icon: "🌤️", adhan: formatDateObj(adhanToday.asr), jamaat: formatTimeStr(jamaat.asr) },
    { key: "maghrib" as PrayerKey, label: "Maghrib", icon: "🌇", adhan: formatDateObj(adhanToday.maghrib), jamaat: formatTimeStr(jamaat.maghrib) },
    { key: "isha" as PrayerKey, label: "Isha", icon: "🌙", adhan: formatDateObj(adhanToday.isha), jamaat: formatTimeStr(jamaat.isha) },
  ];

  const jummahSlots = jamaat.jummah ?? [];

  return (
    <main className="min-h-screen islamic-bg flex flex-col justify-between">
      <div className="islamic-pattern-overlay" />

      <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-8 sm:py-12 flex-1 flex flex-col gap-6">
        
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-3">
          {/* Logo container - sharp edges, dark premium background */}
          <div className="h-16 w-16 flex items-center justify-center bg-slate-900 border border-slate-700/50 shadow-2xl">
            <img src="/logo.svg" alt="Masjid Logo" className="h-10 w-10 object-contain filter invert opacity-90" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">{masjid.name}</h1>
            <p className="text-[11px] text-emerald-500 font-bold uppercase tracking-[0.2em] mt-1">
              Prayer Times Portal
            </p>
          </div>
        </header>

        {/* API Error Banner */}
        {apiError && (
          <div className="border border-red-900/50 bg-red-950/40 p-4 text-center backdrop-blur-md">
            <p className="text-xs font-bold text-red-400 tracking-wide uppercase">⚠️ Unable to reach server</p>
            <p className="text-[10px] text-red-300/70 mt-1">
              Jamaat times shown may be outdated. Adhan times are always accurate.
            </p>
          </div>
        )}

        {/* Staleness Warning */}
        {isStale && !apiError && (
          <div className="border border-amber-900/50 bg-amber-950/40 p-4 text-center backdrop-blur-md">
            <p className="text-xs font-bold text-amber-500 tracking-wide uppercase">⏰ Jamaat times may be outdated</p>
            <p className="text-[10px] text-amber-200/70 mt-1">
              {lastUpdatedLabel ?? "Last update date unknown"} — please verify with the masjid.
            </p>
          </div>
        )}

        {/* Date, Time, and Toggle */}
        <section className="islamic-card p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-200">{todayString}</span>
            <span className="text-sm text-emerald-400 font-mono tracking-widest mt-1">
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !use24Hour,
                timeZone: masjid.timezone,
              }).format(now)}
            </span>
          </div>
          <button
            onClick={() => setUse24Hour(!use24Hour)}
            className="sharp-btn text-[10px]"
          >
            {use24Hour ? "12H" : "24H"}
          </button>
        </section>

        {/* Next Prayer Panel - Sharp architectural highlight */}
        <section className="border-l-4 border-l-emerald-500 bg-slate-900/60 p-5 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Subtle gradient glow inside the next prayer panel */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />
          
          <div className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">
            Next Adhan
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-100 tracking-tight">
            {next.label} <span className="text-slate-400 font-light mx-1">at</span> <span className="text-emerald-400">{formatDateObj(next.at)}</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Remaining time <span className="font-mono text-emerald-300 ml-1 bg-emerald-950/50 px-2 py-0.5 border border-emerald-900/50">{countdown}</span>
          </div>
        </section>

        {/* Prayer Timeline */}
        <section className="flex flex-col gap-3">
          {prayersList.map((p) => {
            const isNext = next.key === p.key;
            return (
              <div
                key={p.key}
                className={`flex items-center justify-between p-4 px-5 ${
                  isNext ? "islamic-tile-highlight" : "islamic-tile"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-xl opacity-80">{p.icon}</span>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold tracking-wide ${isNext ? "text-emerald-400" : "text-slate-200"}`}>
                      {p.label}
                    </span>
                    {isNext && (
                      <span className="text-[9px] font-black uppercase text-slate-900 tracking-wider bg-emerald-500 px-1.5 py-0.5 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                        NEXT
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-6 sm:gap-10 text-right">
                  <div className="w-16">
                    <span className="block text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-0.5">Adhan</span>
                    <span className="font-mono text-sm text-slate-300">{p.adhan}</span>
                  </div>
                  <div className="w-16 relative">
                    {/* Subtle divider line between Adhan and Jamaat */}
                    <div className="absolute -left-3 sm:-left-5 top-1 bottom-1 w-[1px] bg-slate-700/50" />
                    <span className="block text-[9px] uppercase tracking-[0.15em] text-slate-500 mb-0.5">Jamaat</span>
                    <span
                      className={`font-mono text-sm font-bold ${
                        p.isSunrise
                          ? "text-slate-600"
                          : p.jamaat
                          ? isNext
                            ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            : "text-amber-500"
                          : "text-slate-600"
                      }`}
                    >
                      {p.isSunrise ? "—" : p.jamaat ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* Jumu'ah */}
        <section className="jummah-tile p-5">
          <h3 className="text-xs font-black uppercase tracking-[0.15em] text-amber-500 flex items-center gap-2 border-b border-amber-500/20 pb-3 mb-4">
            <span className="text-lg opacity-90">🕌</span> Jumu'ah Schedule
          </h3>
          <div className="space-y-3">
            {jummahSlots.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No schedule set.</p>
            ) : (
              jummahSlots.map((slot, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-900/50 border border-slate-700/50 p-3 px-4">
                  <span className="text-xs font-bold text-amber-500/90 tracking-wide">
                    {jummahSlots.length > 1 ? `${i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}th`} Jumu'ah` : "Jumu'ah"}
                  </span>
                  <div className="flex gap-5 text-sm font-mono text-slate-300">
                    <span><span className="text-[9px] font-sans text-slate-500 uppercase tracking-widest mr-1">Khutbah</span>{formatTimeStr(slot.khutbah)}</span>
                    <span className="text-amber-400"><span className="text-[9px] font-sans text-amber-600/70 uppercase tracking-widest mr-1">Salah</span>{formatTimeStr(slot.salah)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Footer Links */}
        <footer className="flex flex-col items-center gap-4 border-t border-slate-800 pt-6 mt-4 pb-2">
          {lastUpdatedLabel && (
            <span className={`text-[10px] font-medium tracking-wide uppercase ${isStale ? "text-amber-600/80" : "text-slate-600"}`}>
              Jamaat {lastUpdatedLabel.toLowerCase()}
            </span>
          )}
          <div className="flex flex-row justify-center gap-5 text-xs font-bold tracking-wider uppercase">
            <a href="/display" className="text-emerald-500 hover:text-emerald-400 transition-colors">
              TV Mode
            </a>
            <span className="text-slate-800">|</span>
            <a href="/api/ical" download="prayer-times.ics" className="text-emerald-500 hover:text-emerald-400 transition-colors">
              iCal
            </a>
            <span className="text-slate-800">|</span>
            <a href="/admin" className="text-slate-500 hover:text-slate-400 transition-colors">
              Admin
            </a>
          </div>
        </footer>

      </div>

      {/* Quran Verses - Sharp Container */}
      <div className="w-full quran-container py-4 px-5 mt-8 relative z-20">
        <div
          className={`max-w-2xl mx-auto text-center flex flex-col gap-3 transition-all duration-700 ${
            verseFading ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          }`}
        >
          <span className="quran-arabic text-xl sm:text-2xl text-slate-100 block px-4">
            {currentVerse.arabic}
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs sm:text-sm text-slate-400 font-light italic tracking-wide">
              &ldquo;{currentVerse.english}&rdquo;
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-amber-600/80 mt-1">
              {currentVerse.ref}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
