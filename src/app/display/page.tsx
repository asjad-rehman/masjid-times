"use client";

import { useEffect, useMemo, useState } from "react";
import { Coordinates, CalculationMethod, Madhab, PrayerTimes } from "adhan";
import { masjid } from "@/config/masjid";
import { fmt12From24, fmtDateTime12, zonedParts, nowInMasjidTZ, todayInMasjidTZ, addDays, msToHMS } from "@/lib/time";
import Image from "next/image";

/* ================= Types ================= */

type Jamaat = {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah: { khutbah: string; salah: string }[];
  jummah2?: { khutbah: string; salah: string }[];
};

type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

type SalahKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

/* ================= Quran Ayahs ================= */

const QURAN_AYAHS = [
  { arabic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", english: "In the name of Allah, the Most Gracious, the Most Merciful", ref: "1:1" },
  { arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا", english: "Indeed, with hardship comes ease", ref: "94:6" },
  { arabic: "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ", english: "Remember Me, and I will remember you. Be grateful to Me and never deny Me", ref: "2:152" },
  { arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ", english: "Whoever puts their trust in Allah, He is sufficient for them", ref: "65:3" },
  { arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", english: "Our Lord, give us good in this world and good in the Hereafter, and protect us from the torment of the Fire", ref: "2:201" },
  { arabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا", english: "And say: My Lord, increase me in knowledge", ref: "20:114" },
  { arabic: "إِنَّ اللَّهَ مَعَ الصَّابِرِينَ", english: "Indeed, Allah is with the patient", ref: "2:153" },
  { arabic: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ", english: "And your Lord will give you, and you will be satisfied", ref: "93:5" },
  { arabic: "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ", english: "Verily, in the remembrance of Allah do hearts find rest", ref: "13:28" },
  { arabic: "وَنَحْنُ أَقْرَبُ إِلَيْهِ مِنْ حَبْلِ الْوَرِيدِ", english: "And We are closer to him than his jugular vein", ref: "50:16" },
  { arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ∗ إِنَّ مَعَ الْعُسْرِ يُسْرًا", english: "So surely with hardship comes ease. Surely with that hardship comes more ease", ref: "94:5-6" },
  { arabic: "وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ", english: "And He is with you wherever you are", ref: "57:4" },
  { arabic: "ادْعُونِي أَسْتَجِبْ لَكُمْ", english: "Call upon Me, I will respond to you", ref: "40:60" },
  { arabic: "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ", english: "And when My servants ask you about Me, indeed I am near", ref: "2:186" },
];

/* ================= Fallback ================= */

const FALLBACK: Jamaat = {
  fajr: "05:30",
  dhuhr: "12:35",
  asr: "16:15",
  maghrib: "17:55",
  isha: "19:30",
  jummah: [{ khutbah: "12:15", salah: "12:15" }],
  jummah2: [{ khutbah: "13:15", salah: "13:15" }],
};

/* ================= Timezone helpers ================= */


function isFriday(now: Date): boolean {
  const p = zonedParts(now, masjid.timezone);
  const localDate = new Date(p.year, p.month - 1, p.day);
  return localDate.getDay() === 5;
}

/* ================= Utilities ================= */

function formatTime(date: Date) {
  return fmtDateTime12(date, masjid.timezone);
}

function formatClock(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: masjid.timezone,
  }).formatToParts(date);

  const hh = (parts.find((p) => p.type === "hour")?.value ?? "12").padStart(2, "0");
  const mm = (parts.find((p) => p.type === "minute")?.value ?? "00").padStart(2, "0");
  const ss = (parts.find((p) => p.type === "second")?.value ?? "00").padStart(2, "0");
  const dpRaw = parts.find((p) => p.type === "dayPeriod")?.value ?? "PM";
  const dp = dpRaw.toUpperCase().includes("A") ? "AM" : "PM";

  return `${hh}:${mm}:${ss} ${dp}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: masjid.timezone,
  }).format(date);
}

function calculateAdhanTimes(date: Date) {
  const coords = new Coordinates(masjid.coordinates.lat, masjid.coordinates.lon);
  const params = CalculationMethod.NorthAmerica();

  if (masjid.calc.fajrAngle !== undefined) params.fajrAngle = masjid.calc.fajrAngle;
  if (masjid.calc.ishaAngle !== undefined) params.ishaAngle = masjid.calc.ishaAngle;
  params.madhab = Madhab.Hanafi;

  const pt = new PrayerTimes(coords, date, params);

  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

function getNextPrayerInfo(
  now: Date,
  todayTimes: ReturnType<typeof calculateAdhanTimes>,
  tomorrowTimes: ReturnType<typeof calculateAdhanTimes>
): { key: PrayerKey; at: Date } {
  const order: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  for (const key of order) {
    if (todayTimes[key] > now) return { key, at: todayTimes[key] };
  }

  return { key: "fajr", at: tomorrowTimes.fajr };
}


function isValidJamaat(x: unknown): x is Jamaat {
  if (!x || typeof x !== "object") return false;

  const value = x as Partial<Jamaat> & { jummah?: unknown };

  return (
    typeof value.fajr === "string" &&
    typeof value.dhuhr === "string" &&
    typeof value.asr === "string" &&
    typeof value.maghrib === "string" &&
    typeof value.isha === "string" &&
    Array.isArray(value.jummah)
  );
}

/* ================= Component ================= */

export default function DisplayPage() {
  const [jamaat, setJamaat] = useState<Jamaat>(FALLBACK);
  const [now, setNow] = useState<Date>(() => new Date());
  const [isPortraitScreen, setIsPortraitScreen] = useState(false);
  const [ayahIndex, setAyahIndex] = useState(0);
  const [ayahFading, setAyahFading] = useState(false);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const updateOrientation = () => {
      setIsPortraitScreen(window.innerHeight > window.innerWidth);
    };

    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    return () => window.removeEventListener("resize", updateOrientation);
  }, []);

  // Rotate Quran ayahs
  useEffect(() => {
    const id = setInterval(() => {
      setAyahFading(true);
      setTimeout(() => {
        setAyahIndex((prev) => (prev + 1) % QURAN_AYAHS.length);
        setAyahFading(false);
      }, 600);
    }, 12000);
    return () => clearInterval(id);
  }, []);

  // Poll for jamaat updates
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/jamaat", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data;
        if (active && isValidJamaat(data)) setJamaat(data);
      } catch (e) {
        console.error("Failed to load jamaat times", e);
      }
    }

    load();
    const id = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Calculations based on current time
  const todayTz = useMemo(() => now ? todayInMasjidTZ(now, masjid.timezone) : todayInMasjidTZ(new Date(), masjid.timezone), [now]);
  const tomorrowTz = useMemo(() => addDays(todayTz, 1), [todayTz]);

  const adhanToday = useMemo(() => calculateAdhanTimes(todayTz), [todayTz]);
  const adhanTomorrow = useMemo(() => calculateAdhanTimes(tomorrowTz), [tomorrowTz]);

  // BUG #2 FIX: use real `now` (UTC) for comparisons, not the fake nowInMasjidTZ
  const next = useMemo(
    () => getNextPrayerInfo(now, adhanToday, adhanTomorrow),
    [now, adhanToday, adhanTomorrow]
  );

  const countdown = useMemo(() => msToHMS(next.at.getTime() - now.getTime()), [next, now]);

  const friday = isFriday(now);
  const todayDate = formatDate(now);

  // Use actual jamaat data for Jummah times
  const jummah1Time = jamaat.jummah?.[0]?.salah || "12:15";
  const jummah2Time = jamaat.jummah?.[1]?.salah || jamaat.jummah2?.[0]?.salah || "13:15";

  const tiles = friday
    ? [
        { key: "fajr" as SalahKey, title: "Fajr", jamaat: jamaat.fajr },
        { key: "dhuhr" as SalahKey, title: "Jummah", isJummah: true },
        { key: "asr" as SalahKey, title: "Asr", jamaat: jamaat.asr },
        { key: "maghrib" as SalahKey, title: "Maghrib", jamaat: jamaat.maghrib },
        { key: "isha" as SalahKey, title: "Isha", jamaat: jamaat.isha },
      ]
    : [
        { key: "fajr" as SalahKey, title: "Fajr", jamaat: jamaat.fajr },
        { key: "dhuhr" as SalahKey, title: "Dhuhr", jamaat: jamaat.dhuhr },
        { key: "asr" as SalahKey, title: "Asr", jamaat: jamaat.asr },
        { key: "maghrib" as SalahKey, title: "Maghrib", jamaat: jamaat.maghrib },
        { key: "isha" as SalahKey, title: "Isha", jamaat: jamaat.isha },
      ];

  const clock = formatClock(now);

  const nextLabel = friday && next.key === "dhuhr" ? "JUMMAH" : next.key.toUpperCase();

  const currentAyah = QURAN_AYAHS[ayahIndex];

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#fdfbf7] text-[#1a1a2e] flex flex-col font-serif">

      <div
        className={[
          "flex-1 min-h-0 w-full p-4 md:p-6 flex flex-col gap-4 md:gap-5 relative z-10",
        ].join(" ")}
      >
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image
              src="/logo.png"
              alt={masjid.name}
              width={280}
              height={140}
              className="object-contain max-h-[100px] md:max-h-[140px] w-auto"
              priority
            />
            <div className="opacity-60 text-[clamp(14px,1.5vw,22px)] self-end pb-2">
              {todayDate}
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow-sm border border-black/10 px-6 py-4 text-center">
            <div className="font-semibold tabular-nums text-[clamp(26px,2.8vw,52px)]">
              {clock}
            </div>
            <div className="mt-1 text-[clamp(11px,1vw,16px)] opacity-60 tabular-nums">
              Next: <span className="font-semibold text-amber-700">{nextLabel}</span>{" "}
              in <span className="font-semibold text-amber-700">{countdown}</span>
            </div>
          </div>
        </header>

        {/* Tiles */}
        <section
          className={[
            "flex-1 min-h-0 grid gap-4 md:gap-5",
            isPortraitScreen ? "grid-cols-2 grid-rows-3" : "grid-cols-3 grid-rows-2",
          ].join(" ")}
        >
          {tiles.map((t) => {
            const adhan = formatTime(adhanToday[t.key]);
            const isNext = next.key === t.key && next.at.getTime() === adhanToday[t.key].getTime();

            if ("isJummah" in t && t.isJummah) {
              return (
                <JummahTile
                  key={t.key}
                  adhan={adhan}
                  jummah1={fmt12From24(jummah1Time)}
                  jummah2={fmt12From24(jummah2Time)}
                  highlight={isNext}
                />
              );
            }

            return (
              <Tile
                key={t.key}
                title={t.title}
                adhan={adhan}
                jamaat={"jamaat" in t && t.jamaat ? fmt12From24(t.jamaat) : undefined}
                highlight={isNext}
                sunrise={t.key === "fajr" ? formatTime(adhanToday.sunrise) : undefined}
              />
            );
          })}

          {/* Donation QR Code Tile */}
          <DonationTile />
        </section>

        {/* Footer with Integrated Verse */}
        <footer className="rounded-2xl bg-white shadow-sm border border-black/10 flex flex-col justify-center px-6 py-4 shrink-0 gap-4 mt-auto">
          {/* Verse */}
          <div className="text-center transition-opacity duration-500 w-full" style={{ opacity: ayahFading ? 0 : 1 }}>
            <div className="flex flex-col items-center">
              <span className="font-arabic text-xl md:text-2xl mb-1 text-[#2b2216]">{currentAyah.arabic}</span>
              <span className="italic text-sm md:text-base text-[#2b2216]/80">&ldquo;{currentAyah.english}&rdquo;</span>
              <span className="text-xs text-[#8b1e0b] mt-1">[{currentAyah.ref}]</span>
            </div>
          </div>

          <div className="w-full h-px bg-black/5" />

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[clamp(14px,1.4vw,24px)] text-amber-700">&#9774;</span>
              <div className="text-[clamp(14px,1.4vw,26px)]">
                Jumu&apos;ah:{" "}
                <span className="font-semibold text-amber-800 whitespace-nowrap">
                  1st &mdash; {fmt12From24(jummah1Time)}
                  &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                  2nd &mdash; {fmt12From24(jummah2Time)}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0 flex items-center gap-3">
              <div className="text-[clamp(11px,1vw,16px)] opacity-50 whitespace-nowrap">
                Next Prayer
              </div>
              <div className="text-[clamp(14px,1.4vw,24px)] font-semibold tabular-nums whitespace-nowrap">
                <span className="text-amber-700">{nextLabel}</span> &bull; {formatTime(next.at)} &bull; {countdown}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

/* ================= Jummah Tile ================= */

function JummahTile({
  adhan,
  jummah1,
  jummah2,
  highlight,
}: {
  adhan: string;
  jummah1: string;
  jummah2: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 flex flex-col justify-center min-h-0 transition-all duration-300",
        highlight
          ? "bg-[#b8860b]/10 border-[#b8860b] shadow-md scale-[1.01]"
          : "bg-white border-black/10 shadow-sm",
      ].join(" ")}
    >
      <div className="relative z-10 flex items-center gap-2">
        <span className="text-[clamp(16px,1.4vw,28px)]">&#x1F54C;</span>
        <span className="font-bold text-amber-800 text-[clamp(18px,1.6vw,34px)]">
          Jummah
        </span>
      </div>

      <div className="relative z-10 mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-amber-900/60 text-[clamp(14px,1.3vw,24px)] whitespace-nowrap">1st Jummah</span>
          <span className="font-semibold tabular-nums text-[clamp(20px,2.2vw,48px)] leading-none text-amber-800 whitespace-nowrap">
            {jummah1}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="font-medium text-amber-900/60 text-[clamp(14px,1.3vw,24px)] whitespace-nowrap">2nd Jummah</span>
          <span className="font-semibold tabular-nums text-[clamp(20px,2.2vw,48px)] leading-none text-amber-800 whitespace-nowrap">
            {jummah2}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-2 opacity-40 text-[clamp(10px,0.8vw,14px)]">
        Adhan: {adhan}
      </div>
    </div>
  );
}

/* ================= Donation Tile ================= */

function DonationTile() {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm p-5 flex flex-col items-center justify-center min-h-0">
      <div className="font-semibold text-emerald-800 text-[clamp(16px,1.4vw,28px)]">
        Support Your Masjid
      </div>
      <div className="mt-2 flex-1 flex items-center justify-center min-h-0">
        <Image
          src="/donation-qr.png"
          alt="Scan to donate"
          width={200}
          height={200}
          className="rounded-lg max-h-full w-auto object-contain"
        />
      </div>
      <p className="mt-2 text-center text-[clamp(11px,0.9vw,16px)] opacity-70 leading-snug">
        Scan to donate &bull; Jazakum Allahu Khairan
      </p>
      <p className="mt-1 text-center text-emerald-700 font-medium text-[clamp(10px,0.8vw,14px)] leading-snug italic">
        &ldquo;Who is it that would loan Allah a goodly loan so He may multiply
        it for him many times over?&rdquo; &mdash; 2:245
      </p>
    </div>
  );
}

/* ================= Tile ================= */

function Tile({
  title,
  adhan,
  jamaat,
  highlight,
  sunrise,
}: {
  title: string;
  adhan: string;
  jamaat?: string;
  highlight?: boolean;
  sunrise?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-6 flex flex-col justify-center min-h-0 transition-all duration-300",
        highlight
          ? "bg-[#b8860b]/10 border-[#b8860b] shadow-md scale-[1.01]"
          : "bg-white border-black/10 shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold opacity-80 text-[clamp(18px,1.6vw,34px)]">
          {title}
        </span>
        {sunrise && (
          <span className="opacity-50 text-[clamp(11px,0.9vw,16px)]">
            Sunrise: {sunrise}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-5 items-end min-h-0">
        <div className="min-w-0">
          <div className="opacity-50 text-[clamp(11px,0.9vw,16px)]">
            Adhan
          </div>
          <div className="mt-2 font-semibold tracking-tight tabular-nums text-[clamp(28px,3vw,64px)] leading-none text-[#1a1a2e] whitespace-nowrap">
            {adhan}
          </div>
        </div>

        {jamaat ? (
          <div className="text-right min-w-0">
            <div className="opacity-50 text-[clamp(11px,0.9vw,16px)]">Jamaat</div>
            <div className="mt-2 font-semibold tracking-tight tabular-nums text-[clamp(28px,3vw,64px)] leading-none text-emerald-700 whitespace-nowrap">
              {jamaat}
            </div>
          </div>
        ) : (
          <div className="text-right opacity-20 text-[clamp(24px,2.2vw,48px)] leading-none">
            —
          </div>
        )}
      </div>
    </div>
  );
}
