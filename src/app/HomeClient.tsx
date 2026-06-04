"use client";

import { useEffect, useMemo, useState } from "react";
import { masjid } from "@/config/masjid";
import { getAdhanTimes } from "@/lib/prayer";
import {
  fmt12From24,
  fmtDateTime12,
  zonedParts,
  nowInMasjidTZ,
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

function getNextPrayerInfo(
  nowTz: Date,
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
    if (item.at > nowTz) return item;
  }

  return { key: "fajr", label: "Fajr", at: tomorrow.fajr };
}

export default function HomeClient({ initialJamaat }: HomeClientProps) {
  const [jamaat, setJamaat] = useState<Jamaat>(initialJamaat);
  const [now, setNow] = useState<Date>(() => new Date());
  const [use24Hour, setUse24Hour] = useState(false); // default 12h format
  const [verseIndex, setVerseIndex] = useState(0);
  const [verseFading, setVerseFading] = useState(false);

  // Live clock interval
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll for Jamaat updates from API
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/jamaat", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (active && json?.data) {
          setJamaat(json.data);
        }
      } catch (e) {
        console.error("Failed to sync jamaat times", e);
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
  const nowTz = useMemo(() => nowInMasjidTZ(now, masjid.timezone), [now]);
  const todayTz = useMemo(() => todayInMasjidTZ(now, masjid.timezone), [now]);
  const tomorrowTz = useMemo(() => addDays(todayTz, 1), [todayTz]);

  const adhanToday = useMemo(() => getAdhanTimes(todayTz), [todayTz]);
  const adhanTomorrow = useMemo(() => getAdhanTimes(tomorrowTz), [tomorrowTz]);

  const next = useMemo(
    () => getNextPrayerInfo(nowTz, adhanToday, adhanTomorrow),
    [nowTz, adhanToday, adhanTomorrow]
  );

  const countdown = useMemo(() => {
    const diff = next.at.getTime() - nowTz.getTime();
    return msToHMS(diff);
  }, [next, nowTz]);

  const todayString = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: masjid.timezone,
    }).format(now);
  }, [now]);

  // Format Helper: Time String (from DB / HH:MM)
  const formatTimeStr = (time24?: string) => {
    if (!time24) return "—";
    if (use24Hour) return time24;
    return fmt12From24(time24);
  };

  // Format Helper: Date Object (from Adhan)
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

  // List of prayers for the table
  const prayersList = [
    {
      key: "fajr" as PrayerKey,
      label: "Fajr",
      icon: "🌅",
      adhan: formatDateObj(adhanToday.fajr),
      jamaat: formatTimeStr(jamaat.fajr),
    },
    {
      key: "sunrise" as PrayerKey,
      label: "Sunrise",
      icon: "☀️",
      adhan: formatDateObj(adhanToday.sunrise),
      jamaat: null,
      isSunrise: true,
    },
    {
      key: "dhuhr" as PrayerKey,
      label: "Dhuhr",
      icon: "☀️",
      adhan: formatDateObj(adhanToday.dhuhr),
      jamaat: formatTimeStr(jamaat.dhuhr),
    },
    {
      key: "asr" as PrayerKey,
      label: "Asr",
      icon: "🌤️",
      adhan: formatDateObj(adhanToday.asr),
      jamaat: formatTimeStr(jamaat.asr),
    },
    {
      key: "maghrib" as PrayerKey,
      label: "Maghrib",
      icon: "🌇",
      adhan: formatDateObj(adhanToday.maghrib),
      jamaat: formatTimeStr(jamaat.maghrib),
    },
    {
      key: "isha" as PrayerKey,
      label: "Isha",
      icon: "🌙",
      adhan: formatDateObj(adhanToday.isha),
      jamaat: formatTimeStr(jamaat.isha),
    },
  ];

  const jummahSlots = jamaat.jummah ?? [];

  return (
    <main className="min-h-screen islamic-bg text-[#1a1a2e] flex flex-col justify-between">
      <div className="islamic-pattern-overlay" />

      {/* Main Responsive Grid Container */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col gap-5">
        
        {/* Minimalist Header */}
        <header className="flex flex-col items-center text-center gap-2 mt-2">
          <div className="h-14 w-14 flex items-center justify-center rounded-full bg-white p-2 border border-emerald-700/10 shadow-sm">
            <img src="/logo.svg" alt="Masjid Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#1a1a2e]">{masjid.name}</h1>
            <p className="text-[10px] text-emerald-800/80 font-bold uppercase tracking-widest mt-0.5">
              Islamic Center Hattiesburg
            </p>
          </div>
        </header>

        {/* Date, Time, and 12/24H Toggler bar */}
        <section className="islamic-card rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-800">{todayString}</span>
            <span className="text-xs text-slate-500 font-medium tracking-wide mt-0.5 tabular-nums">
              Clock: {new Intl.DateTimeFormat("en-US", {
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
            className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1.5 rounded-xl border border-emerald-500/15 bg-white/80 hover:bg-emerald-500/10 transition-colors shadow-sm"
          >
            {use24Hour ? "Use AM/PM" : "Use 24H"}
          </button>
        </section>

        {/* Simplistic Countdown Panel */}
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center shadow-sm">
          <div className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
            Next Adhan
          </div>
          <div className="mt-1 text-lg font-bold text-[#1a1a2e]">
            {next.label} at <span className="text-emerald-700">{formatDateObj(next.at)}</span>
          </div>
          <div className="mt-1 text-xs text-emerald-900/60 font-semibold">
            Remaining: <span className="tabular-nums font-bold text-emerald-700">{countdown}</span>
          </div>
        </section>

        {/* Prayer Timeline Grid */}
        <section className="flex flex-col gap-2">
          {prayersList.map((p) => {
            const isNext = next.key === p.key;
            return (
              <div
                key={p.key}
                className={`flex items-center justify-between rounded-xl p-3 px-4 border transition-all duration-300 ${
                  isNext
                    ? "islamic-tile-highlight border-l-4 border-l-emerald-600 scale-[1.01]"
                    : "islamic-tile"
                }`}
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <span className="text-base">{p.icon}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-sm ${isNext ? "text-emerald-900" : "text-[#1a1a2e]"}`}>
                      {p.label}
                    </span>
                    {isNext && (
                      <span className="text-[8px] font-black uppercase text-emerald-600 tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md animate-pulse">
                        Now
                      </span>
                    )}
                  </div>
                </div>

                {/* Times */}
                <div className="flex gap-8 text-right font-medium text-slate-700">
                  <div className="w-14">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Adhan</span>
                    <span className="tabular-nums text-xs font-semibold">{p.adhan}</span>
                  </div>
                  <div className="w-14">
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400">Jamaat</span>
                    <span
                      className={`tabular-nums text-xs font-bold ${
                        p.isSunrise
                          ? "text-slate-300"
                          : p.jamaat
                          ? isNext
                            ? "text-emerald-900"
                            : "text-emerald-700"
                          : "text-slate-400"
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

        {/* Jumu'ah Section Card */}
        <section className="jummah-tile rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-amber-800 flex items-center gap-1.5 border-b border-amber-500/10 pb-2 mb-3">
            <span>🕌</span> Jumu'ah Schedule
          </h3>
          <div className="space-y-3">
            {jummahSlots.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No schedule set.</p>
            ) : (
              jummahSlots.map((slot, i) => (
                <div key={i} className="flex justify-between items-center bg-white/40 border border-amber-600/10 rounded-xl p-2.5 px-3">
                  <span className="text-xs font-bold text-amber-900">
                    {jummahSlots.length > 1 ? `${i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}th`} Khutbah` : "Salah"}
                  </span>
                  <div className="flex gap-4 text-xs font-bold text-slate-800">
                    <span className="tabular-nums">Speech: {formatTimeStr(slot.khutbah)}</span>
                    <span className="tabular-nums text-emerald-800">Salah: {formatTimeStr(slot.salah)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Minimalist Donate Box */}
        <section className="islamic-card rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex-1">
            <h3 className="text-xs font-bold text-slate-800">Support Hattiesburg Masjid</h3>
            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
              Establish prayer and support the maintenance of the House of Allah. Scan to donate.
            </p>
          </div>
          <div className="shrink-0 p-1.5 bg-white rounded-xl border border-slate-200/60 shadow-inner">
            <img src="/donation-qr.png" alt="Donate QR" className="h-16 w-16 object-contain" />
          </div>
        </section>

        {/* Clean Footer Controls */}
        <footer className="flex flex-col items-center gap-3 border-t border-slate-200/50 pt-4 mt-2">
          <div className="flex flex-row justify-center gap-4 text-xs font-bold">
            <a href="/display" className="text-emerald-800 hover:text-emerald-600 transition-colors">
              📺 TV Mode
            </a>
            <span className="text-slate-300 font-normal">|</span>
            <a href="/api/ical" download="prayer-times.ics" className="text-emerald-800 hover:text-emerald-600 transition-colors">
              📅 Export iCal
            </a>
            <span className="text-slate-300 font-normal">|</span>
            <a href="/admin" className="text-slate-500 hover:text-slate-700 transition-colors">
              🔒 Admin
            </a>
          </div>
        </footer>

      </div>

      {/* Simplified Rotating Quran Verses */}
      <div className="w-full bg-[#eef2ee]/60 border-t border-slate-200/40 py-3 px-4 mt-8 backdrop-blur-sm relative z-20">
        <div
          className={`max-w-md mx-auto text-center flex flex-col gap-1 transition-all duration-500 ${
            verseFading ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
          }`}
        >
          <span className="quran-arabic text-sm text-[#1a1a2e] block">
            {currentVerse.arabic}
          </span>
          <span className="text-[10px] text-slate-500 leading-relaxed block">
            &ldquo;{currentVerse.english}&rdquo; &mdash; <span className="font-bold text-emerald-800/80">{currentVerse.ref}</span>
          </span>
        </div>
      </div>
    </main>
  );
}
