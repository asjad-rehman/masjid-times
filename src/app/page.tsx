import { getAdhanTimes, fmtTime } from "@/lib/prayer";
import { masjid } from "@/config/masjid";
import { getJamaatTimes } from "@/lib/db";

export const revalidate = 0;

function getNextPrayerKey(adhan: ReturnType<typeof getAdhanTimes>): string | null {
  const now = new Date();
  const prayers = [
    { key: "fajr", time: adhan.fajr },
    { key: "dhuhr", time: adhan.dhuhr },
    { key: "asr", time: adhan.asr },
    { key: "maghrib", time: adhan.maghrib },
    { key: "isha", time: adhan.isha },
  ];
  for (const { key, time } of prayers) {
    if (time > now) return key;
  }
  return null;
}

export default async function Home() {
  const adhan = getAdhanTimes(new Date());
  const jamaat = await getJamaatTimes();
  const nextPrayer = getNextPrayerKey(adhan);

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: masjid.timezone,
  }).format(new Date());

  const prayers = [
    { key: "fajr",    label: "Fajr",    adhan: fmtTime(adhan.fajr),    jamaat: jamaat.fajr },
    { key: "dhuhr",   label: "Dhuhr",   adhan: fmtTime(adhan.dhuhr),   jamaat: jamaat.dhuhr },
    { key: "asr",     label: "Asr",     adhan: fmtTime(adhan.asr),     jamaat: jamaat.asr },
    { key: "maghrib", label: "Maghrib", adhan: fmtTime(adhan.maghrib), jamaat: jamaat.maghrib },
    { key: "isha",    label: "Isha",    adhan: fmtTime(adhan.isha),    jamaat: jamaat.isha },
  ];

  const allJummah = [
    ...(jamaat.jummah ?? []),
    ...(jamaat.jummah2 ?? []),
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-64 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-600/5 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-96 w-96 -translate-y-1/2 rounded-full bg-emerald-600/4 blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-2 py-6 sm:px-4 sm:py-10 md:px-6 md:py-12">

        {/* ── Hero Section ── */}
        <section className="mb-8 flex flex-col items-center text-center gap-3 sm:mb-10 sm:gap-4">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <img src="/logo.svg" alt="Logo" className="h-12 w-12 rounded-xl bg-white p-1 shadow" />
            <span className="text-2xl font-extrabold tracking-tight text-emerald-200 drop-shadow sm:text-3xl">{masjid.name}</span>
          </div>
          <p className="max-w-xs text-sm text-white/60 sm:max-w-xl sm:text-base">
            Welcome to the {masjid.name}! View today’s prayer times, Jumu’ah schedule, and more. Stay connected with your masjid community.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-2 sm:gap-3 w-full sm:w-auto">
            <a href="/display" className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/20 transition w-full sm:w-auto text-center">TV Display</a>
            <a href="/api/ical" download="prayer-times.ics" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors w-full sm:w-auto text-center">Export iCal</a>
            <a href="#donate" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition-colors w-full sm:w-auto text-center">Donate</a>
          </div>
        </section>

        {/* ── Header ── */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="" width={44} height={44} className="h-full w-full" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Live Adhan + Jamaat
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {masjid.name}
              </h1>
              <p className="mt-1 text-xs text-white/40">
                {masjid.calc.method.replaceAll("_", " ")} &middot; {masjid.calc.fajrAngle}&deg;/{masjid.calc.ishaAngle}&deg; &middot; Hanafi Asr
              </p>
            </div>
          </div>

          {/* Date card */}
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:text-right mt-4 sm:mt-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Today</div>
            <div className="mt-1 text-base font-semibold">{today}</div>
            <div className="mt-0.5 text-[11px] text-white/35">{masjid.timezone}</div>
          </div>
        </header>

        {/* ── Sunrise strip ── */}
        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/5 px-5 py-3.5">
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-300/60">Sunrise</span>
          <span className="ml-auto font-semibold tabular-nums text-amber-200/70">
            {fmtTime(adhan.sunrise)}
          </span>
        </div>

        {/* ── Main grid ── */}
        <div className="mt-4 grid gap-4 md:grid-cols-1 lg:grid-cols-[1fr_300px]">

          {/* Prayer times */}
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Today&apos;s Prayer Times
              </h2>
              <div className="flex gap-5 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                <span>Adhan</span>
                <span>Jamaat</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {prayers.map((p) => (
                <PrayerRow
                  key={p.key}
                  label={p.label}
                  adhan={p.adhan}
                  jamaat={p.jamaat}
                  isNext={nextPrayer === p.key}
                />
              ))}
            </div>
          </section>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">

            {/* Jummah schedule */}
            <section className="rounded-3xl border border-amber-400/15 bg-amber-400/[0.04] p-5">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-300/60">
                Jumu&apos;ah Schedule
              </h3>

              <div className="mt-4 space-y-3">
                {allJummah.length === 0 ? (
                  <p className="text-sm text-white/30">No schedule set.</p>
                ) : (
                  allJummah.map((slot, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/8 bg-black/20 p-4"
                    >
                      {allJummah.length > 1 && (
                        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                          {i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}th`} Jumu&apos;ah
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">Khutbah</span>
                        <span className="text-sm font-semibold tabular-nums">{slot.khutbah || "—"}</span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-sm text-white/50">Salah</span>
                        <span className="text-sm font-semibold tabular-nums text-emerald-300">{slot.salah || "—"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* TV display link */}
            <a
              href="/display"
              className="group flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 transition-colors hover:bg-white/[0.06]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white/50">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/75">TV Display Mode</div>
                <div className="text-xs text-white/35">Full-screen kiosk view</div>
              </div>
              <span className="ml-auto text-sm text-white/20 transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </a>

          </aside>
        </div>

        {/* ── Donate Section ── */}
        <section id="donate" className="mt-10 flex flex-col items-center gap-3 rounded-3xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-6 text-center sm:mt-12 sm:gap-4 sm:px-6 sm:py-8">
          <h2 className="text-base font-bold text-emerald-200 flex items-center gap-2 sm:text-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3 0 1.657 1.343 3 3 3s3-1.343 3-3c0-1.657-1.343-3-3-3zm0 0V4m0 16v-4m8-4h-4m-8 0H4" /></svg>
            Support Your Masjid
          </h2>
          <p className="text-white/60 max-w-xs text-sm sm:max-w-md sm:text-base">Help us maintain and grow our community. Every donation makes a difference!</p>
          <img src="/donation-qr.png" alt="Donation QR" className="h-32 w-32 rounded-xl border border-white/10 bg-white/10 p-2 shadow sm:h-36 sm:w-36" />
          <div className="text-xs text-white/30">Scan to donate</div>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-8 flex flex-col items-center gap-2 border-t border-white/8 pt-5 text-center sm:mt-10 sm:pt-6">
          <div className="flex flex-col gap-1 items-center justify-center sm:flex-row sm:gap-2">
            <span className="text-xs text-white/25">
              &copy; {new Date().getFullYear()} {masjid.name} &middot; Times shown in {masjid.timezone}
            </span>
            <span className="hidden sm:inline text-xs text-white/15 mx-2">|</span>
            <a
              href="/admin"
              className="text-[11px] text-white/15 transition-colors hover:text-white/40"
            >
              Admin
            </a>
          </div>
          <div className="mt-1 text-xs text-white/20">
            <span>Location: {masjid.coordinates.lat}, {masjid.coordinates.lon}</span>
          </div>
        </footer>

      </div>
    </main>
  );
}

/* ── Components ── */

function PrayerRow(props: {
  label: string;
  adhan: string;
  jamaat?: string;
  isNext: boolean;
}) {
  const isNext = props.isNext;
  return (
    <div
      className={["flex flex-col xs:flex-row items-center rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5",
        isNext
          ? "border-emerald-500/30 bg-emerald-500/[0.08] shadow-[0_0_24px_rgba(16,185,129,0.06)]"
          : "border-white/8 bg-black/15",
      ].join(" ")}
    >
      {/* Label */}
      <div className="flex min-w-0 flex-1 items-center gap-2 mb-2 xs:mb-0">
        {isNext && (
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
        )}
        <span
          className={`text-sm font-semibold ${
            isNext ? "text-emerald-200" : "text-white/75"
          }`}
        >
          {props.label}
        </span>
        {isNext && (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
            Next
          </span>
        )}
      </div>

      {/* Times */}
      <div className="flex shrink-0 gap-4 xs:gap-6 sm:gap-10 w-full xs:w-auto">
        <div className="flex-1 text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">Adhan</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{props.adhan}</div>
        </div>
        <div className="flex-1 w-[70px] xs:w-[90px] text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">Jamaat</div>
          <div
            className={`mt-0.5 text-sm font-semibold tabular-nums ${
              props.jamaat ? "text-emerald-300" : "text-white/20"
            }`}
          >
            {props.jamaat ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
