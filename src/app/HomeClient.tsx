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
    english: "Maintain with care the prayers and the middle prayer and stand before Allah, devoutly obedient.",
    ref: "Quran 2:238",
  },
  {
    arabic: "أَقِمِ الصَّلَاةَ لِدُلُوكِ الشَّمْسِ إِلَىٰ غَسَقِ اللَّيْلِ وَقُرْآنَ الْفَجْرِ ۖ إِنَّ قُرْآنَ الْفَجْرِ كَانَ مَشْهُودًا",
    english: "Establish prayer at the decline of the sun until the darkness of the night and the Quran recitation of dawn. Indeed, the recitation of dawn is ever witnessed.",
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
  const [use24Hour, setUse24Hour] = useState(false); // default to 12h (AM/PM) format
  const [verseIndex, setVerseIndex] = useState(0);
  const [verseFading, setVerseFading] = useState(false);

  // Live Clock Trigger
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
    }, 10000);
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
    <main
      className="min-h-screen text-slate-100 relative overflow-hidden font-sans flex flex-col justify-between"
      style={{
        background: "linear-gradient(160deg, #090e1a 0%, #0d1527 40%, #080c16 100%)",
      }}
    >
      {/* Background radial blurs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-emerald-500/8 blur-[120px] animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-10 right-0 w-[450px] h-[450px] rounded-full bg-teal-500/6 blur-[100px]" />
        <div className="absolute top-1/3 left-0 w-[350px] h-[350px] rounded-full bg-amber-500/5 blur-[90px]" />
      </div>

      {/* Main Layout Container */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 sm:px-6 md:px-8 flex-1 flex flex-col gap-8">
        
        {/* Navigation & Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 flex items-center justify-center rounded-2xl bg-white p-2 shadow-[0_4px_20px_rgba(255,255,255,0.05)] border border-white/10">
              <img src="/logo.svg" alt="Masjid Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-white">
                {masjid.name}
              </h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Live Prayer Portal &middot; {masjid.calc.method.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          {/* Controls Panel */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Format Toggle Switch */}
            <div className="flex items-center bg-slate-900/60 border border-white/10 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setUse24Hour(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  !use24Hour
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                12H (AM/PM)
              </button>
              <button
                onClick={() => setUse24Hour(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  use24Hour
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                24H
              </button>
            </div>

            {/* Quick Action Navigation Buttons */}
            <div className="flex items-center gap-2">
              <a
                href="/display"
                className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold transition shadow-md text-slate-200"
              >
                📺 TV Mode
              </a>
              <a
                href="/api/ical"
                download="prayer-times.ics"
                className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 rounded-xl px-4 py-2 text-xs font-semibold transition shadow-md text-emerald-300"
              >
                📅 Export iCal
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section: Live Clock & Countdown */}
        <section className="grid gap-6 md:grid-cols-[1fr_auto] items-stretch">
          {/* Countdown / Next Prayer Card */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-between shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                UPCOMING PRAYER
              </span>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
                <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  {next.label}
                </span>
                <span className="text-sm font-medium text-slate-400 mt-1">
                  Adhan at {formatDateObj(next.at)}
                </span>
              </div>
            </div>

            <div className="mt-8 relative z-10">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Remaining Time</div>
              <div className="mt-1 text-4xl sm:text-5xl md:text-6xl font-black tracking-tight tabular-nums text-white bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                {countdown}
              </div>
            </div>
          </div>

          {/* Local Clock Widget */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-md p-6 sm:p-8 flex flex-col justify-center items-center sm:items-end text-center sm:text-right shadow-[0_8px_32px_rgba(0,0,0,0.3)] min-w-[240px]">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-3">
              LIVE CLOCK
            </div>
            <div className="text-4xl font-extrabold tracking-tight tabular-nums text-white">
              {new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !use24Hour,
                timeZone: masjid.timezone,
              }).format(now)}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-200">
              {todayString}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Timezone: {masjid.timezone}
            </div>
          </div>
        </section>

        {/* Main Content Dashboard Grid */}
        <section className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
          
          {/* Main Prayer Times Grid */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/20 backdrop-blur-md p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Today's Prayer Timeline
              </h2>
              <div className="flex gap-16 text-xs font-bold uppercase tracking-widest text-slate-500 pr-4 sm:pr-8">
                <span>Adhan</span>
                <span>Jamaat</span>
              </div>
            </div>

            <div className="space-y-3">
              {prayersList.map((p) => {
                const isNext = next.key === p.key;
                return (
                  <div
                    key={p.key}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-all duration-300 ${
                      isNext
                        ? "border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_25px_rgba(16,185,129,0.15)] scale-[1.01]"
                        : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                    }`}
                  >
                    {/* Prayer Info */}
                    <div className="flex items-center gap-3">
                      <span className="text-xl sm:text-2xl">{p.icon}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-extrabold ${isNext ? "text-emerald-300" : "text-white"}`}>
                          {p.label}
                        </span>
                        {isNext && (
                          <span className="rounded-full bg-emerald-400/25 border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400 animate-pulse">
                            Next
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Prayer Times columns */}
                    <div className="flex items-center gap-10 sm:gap-20 text-right font-medium">
                      <div className="w-16 sm:w-20">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Adhan</div>
                        <div className="mt-0.5 text-sm sm:text-base font-bold tabular-nums text-slate-200">
                          {p.adhan}
                        </div>
                      </div>
                      <div className="w-16 sm:w-20">
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Jamaat</div>
                        <div
                          className={`mt-0.5 text-sm sm:text-base font-extrabold tabular-nums ${
                            p.isSunrise
                              ? "text-slate-500"
                              : p.jamaat
                              ? isNext
                                ? "text-emerald-300"
                                : "text-emerald-400"
                              : "text-slate-500"
                          }`}
                        >
                          {p.isSunrise ? "—" : p.jamaat ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            
            {/* Jumu'ah Card */}
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/[0.04] p-6 shadow-md backdrop-blur-md relative overflow-hidden group">
              {/* Conic glowing effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
              
              <div className="relative z-10 flex items-center justify-between border-b border-amber-500/10 pb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-amber-300 flex items-center gap-2">
                  <span>🕌</span> Jumu'ah Schedule
                </h3>
                <span className="text-xs font-bold text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                  Friday
                </span>
              </div>

              <div className="relative z-10 mt-4 space-y-4">
                {jummahSlots.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No slots scheduled.</p>
                ) : (
                  jummahSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 transition-all duration-300 hover:border-amber-500/20"
                    >
                      {jummahSlots.length > 1 && (
                        <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 inline-block px-2 py-0.5 rounded">
                          {i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}rd`} Service
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-r border-white/5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                            Khutbah
                          </span>
                          <span className="text-base font-bold tabular-nums text-slate-100 mt-1 block">
                            {formatTimeStr(slot.khutbah)}
                          </span>
                        </div>
                        <div className="pl-2">
                          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                            Salah
                          </span>
                          <span className="text-base font-black tabular-nums text-amber-300 mt-1 block">
                            {formatTimeStr(slot.salah)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Support/Donation Card */}
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 shadow-md backdrop-blur-md flex flex-col items-center text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
              
              <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-300 flex items-center gap-2 relative z-10">
                <span>❤️</span> Support Your Masjid
              </h3>
              <p className="text-xs text-slate-400 mt-2 max-w-[280px] leading-relaxed relative z-10">
                Establish prayer and help maintain the House of Allah. scan to contribute.
              </p>

              <div className="mt-5 p-2 bg-white rounded-2xl shadow-lg relative z-10 transition-transform duration-300 group-hover:scale-[1.02] border border-white/10">
                <img
                  src="/donation-qr.png"
                  alt="Scan to Donate QR Code"
                  className="h-32 w-32 object-contain"
                />
              </div>

              <div className="mt-4 text-[10px] font-black uppercase text-emerald-400 tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 relative z-10">
                Scan to Donate
              </div>

              <p className="mt-3 text-[10px] italic text-slate-400 leading-normal border-t border-white/5 pt-3 w-full">
                "Who is it that would loan Allah a goodly loan so He may multiply it for him?" &mdash; Quran 2:245
              </p>
            </div>

          </aside>
        </section>
      </div>

      {/* Footer Area with Quran Verses Carousel */}
      <footer className="w-full mt-auto relative z-10 bg-slate-950/80 border-t border-white/5 backdrop-blur-lg">
        {/* Quran verse ticker */}
        <div className="w-full border-b border-white/5 py-4 px-4 overflow-hidden min-h-[64px] flex items-center justify-center">
          <div
            className={`max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-3 text-center transition-all duration-500 ${
              verseFading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            <span className="text-xl md:text-2xl text-amber-500 shrink-0">﷽</span>
            <span className="text-sm font-medium text-slate-300 italic tracking-wide">
              &ldquo;{currentVerse.english}&rdquo;
            </span>
            <span className="text-xs font-bold text-amber-500/70 uppercase tracking-widest shrink-0">
              {currentVerse.ref}
            </span>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} {masjid.name} &middot; All Rights Reserved.
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              Coordinates: {masjid.coordinates.lat}, {masjid.coordinates.lon} &middot; Calculations for {masjid.timezone}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900 border border-white/10 rounded-xl px-4 py-2 transition-colors hover:bg-slate-800"
            >
              🔒 Admin Login
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
