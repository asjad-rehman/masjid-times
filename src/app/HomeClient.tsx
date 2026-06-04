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
  const [mounted, setMounted] = useState(false);

  // Live clock interval
  useEffect(() => {
    setMounted(true);
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

  // Rotate Quran Verses (fluidly)
  useEffect(() => {
    const id = setInterval(() => {
      setVerseFading(true);
      setTimeout(() => {
        setVerseIndex((prev) => (prev + 1) % QURAN_VERSES.length);
        setVerseFading(false);
      }, 600); // slightly longer fade for manuscript feel
    }, 15000);
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
    { key: "fajr" as PrayerKey, label: "Fajr", adhan: formatDateObj(adhanToday.fajr), jamaat: formatTimeStr(jamaat.fajr) },
    { key: "sunrise" as PrayerKey, label: "Sunrise", adhan: formatDateObj(adhanToday.sunrise), jamaat: null, isSunrise: true },
    { key: "dhuhr" as PrayerKey, label: "Dhuhr", adhan: formatDateObj(adhanToday.dhuhr), jamaat: formatTimeStr(jamaat.dhuhr) },
    { key: "asr" as PrayerKey, label: "Asr", adhan: formatDateObj(adhanToday.asr), jamaat: formatTimeStr(jamaat.asr) },
    { key: "maghrib" as PrayerKey, label: "Maghrib", adhan: formatDateObj(adhanToday.maghrib), jamaat: formatTimeStr(jamaat.maghrib) },
    { key: "isha" as PrayerKey, label: "Isha", adhan: formatDateObj(adhanToday.isha), jamaat: formatTimeStr(jamaat.isha) },
  ];

  const jummahSlots = jamaat.jummah ?? [];

  return (
    <main className="manuscript-bg">
      <div className="manuscript-watermark" />

      <div className="manuscript-container">
        
        {/* Header */}
        <header className="manuscript-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: 'none' }}>
          <img src="/logo.png" alt="Islamic Center of Hattiesburg Logo" style={{ maxWidth: '100%', height: 'auto' }} />
        </header>

        {/* Banners */}
        {apiError && (
          <div className="banner banner-error">
            <strong>Cannot reach server.</strong> Jamaat times shown may be outdated.
          </div>
        )}

        {isStale && !apiError && (
          <div className="banner banner-warning">
            <strong>Notice:</strong> Jamaat times may be outdated ({lastUpdatedLabel ?? "unknown"}).
          </div>
        )}

        {/* Date & Time Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '1.1rem' }} suppressHydrationWarning>{mounted ? todayString : "Loading..."}</div>
            <div style={{ fontSize: '0.9rem', fontStyle: 'italic', opacity: 0.8 }} suppressHydrationWarning>
              {mounted ? new Intl.DateTimeFormat("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: !use24Hour,
                timeZone: masjid.timezone,
              }).format(now) : "--:--:--"}
            </div>
          </div>
          <button onClick={() => setUse24Hour(!use24Hour)} className="traditional-btn">
            {use24Hour ? "Switch to 12-Hour" : "Switch to 24-Hour"}
          </button>
        </div>

        {/* Next Prayer Highlight (Subtle) */}
        <div style={{ textAlign: 'center', marginBottom: '2rem', fontStyle: 'italic' }} suppressHydrationWarning>
          {mounted ? (
            <>Next: <strong>{next.label}</strong> at {formatDateObj(next.at)} (in {countdown})</>
          ) : (
            <>Calculating next prayer...</>
          )}
        </div>

        {/* Prayer List */}
        <div className="prayer-list">
          {prayersList.map((p) => {
            const isNext = next.key === p.key;
            return (
              <div key={p.key} className={`prayer-row ${isNext ? "is-next" : ""}`}>
                <div className="prayer-name">{p.label}</div>
                <div className="prayer-times">
                  <div className="time-block">
                    <span className="time-label">Adhan</span>
                    <span className="time-value">{p.adhan}</span>
                  </div>
                  <div className="time-block">
                    <span className="time-label">Jamaat</span>
                    <span className="time-value">
                      {p.isSunrise ? "—" : p.jamaat ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Jumu'ah */}
        <div className="jummah-section">
          <div className="jummah-title">Jumu&apos;ah Schedule</div>
          {jummahSlots.length === 0 ? (
            <p style={{ fontStyle: 'italic', opacity: 0.7 }}>No schedule available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {jummahSlots.map((slot, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                  <span>
                    {jummahSlots.length > 1 && <strong>{i + 1}. </strong>}
                    Khutbah: <strong>{formatTimeStr(slot.khutbah)}</strong>
                  </span>
                  <span>Salah: <strong>{formatTimeStr(slot.salah)}</strong></span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rotating Quran Verse */}
        <div className="quran-traditional" style={{ opacity: verseFading ? 0 : 1, transition: 'opacity 0.6s ease' }}>
          <div className="arabic-text">{currentVerse.arabic}</div>
          <div className="english-translation">&quot;{currentVerse.english}&quot;</div>
          <div className="verse-ref">{currentVerse.ref}</div>
        </div>

        {/* Footer Links */}
        <footer className="footer-links">
          <a href="/display">Display Mode</a>
          <span>•</span>
          <a href="/api/ical" download="prayer-times.ics">Export iCal</a>
          <span>•</span>
          <a href="/admin">Admin Login</a>
        </footer>

      </div>
    </main>
  );
}
