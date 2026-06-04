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

  const jummahSlots = jamaat.jummah ?? [];

  return (
    <main className="min-h-screen text-slate-100" style={{ background: "linear-gradient(160deg, #1a2236 0%, #1e2a3a 40%, #1a2830 100%)" }}>
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-500/8 blur-[100px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-teal-500/6 blur-[80px]" />
        <div className="absolute top-1/2 left-0 h-64 w-64 rounded-full bg-amber-500/4 blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10 md:px-8 md:py-12">

        {/* ── Hero ── */}
        <section className="mb-10 flex flex-col items-center text-center gap-4">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
              <img src="/logo.svg" alt="Logo" className="h-full w-full" />
            </div>
            <span className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{masjid.name}</span>
          </div>
          <p className="max-w-sm text-sm text-slate-300 sm:max-w-xl sm:text-base">
            View today&apos;s prayer times, Jumu&apos;ah schedule, and more. Stay connected with your masjid community.
          </p>
          <div className="flex flex-wrap justify-center gap-3 w-full sm:w-auto">
            <a href="/display" className="rounded-xl border border-slate-500/40 bg-slate-700/50 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600/50 transition w-full sm:w-auto text-center">
              TV Display
            </a>
            <a href="/api/ical" download="prayer-times.ics" className="rounded-xl border border-emerald-500/40 bg-emerald-600/20 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-600/30 transition w-full sm:w-auto text-center">
              Export iCal
            </a>
            <a href="#donate" className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/25 transition w-full sm:w-auto text-center">
              Donate
            </a>
          </div>
        </section>

        {/* ── Header card ── */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 backdrop-blur-sm mb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md">
                <img src="/logo.svg" alt="" width={44} height={44} className="h-full w-full" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  Live Adhan &amp; Jamaat
                </div>
                <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {masjid.name}
                </h1>
                <p className="mt-0.5 text-xs text-slate-400">
                  {masjid.calc.method.replaceAll("_", " ")} &middot; {masjid.calc.fajrAngle}&deg;/{masjid.calc.ishaAngle}&deg; &middot; Hanafi Asr
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 sm:text-right">
              <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">Today</div>
              <div className="mt-1 text-sm font-semibold text-white">{today}</div>
              <div className="mt-0.5 text-xs text-slate-400">{masjid.timezone}</div>
            </div>
          </div>
        </div>

        {/* ── Sunrise strip ── */}
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-5 py-3">
          <span className="text-sm font-semibold tracking-wide text-amber-300">🌅 Sunrise</span>
          <span className="ml-auto text-sm font-bold tabular-nums text-amber-200">
            {fmtTime(adhan.sunrise)}
          </span>
        </div>

        {/* ── Main grid ── */}
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">

          {/* Prayer times */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6 backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                Today&apos;s Prayer Times
              </h2>
              <div className="flex gap-5 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Adhan</span>
                <span>Jamaat</span>
              </div>
            </div>

            <div className="space-y-2">
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
            <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-5 backdrop-blur-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-amber-200">
                Jumu&apos;ah Schedule
              </h3>

              <div className="mt-4 space-y-3">
                {jummahSlots.length === 0 ? (
                  <p className="text-sm text-slate-400">No schedule set.</p>
                ) : (
                  jummahSlots.map((slot, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      {jummahSlots.length > 1 && (
                        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-300/70">
                          {i === 0 ? "1st" : i === 1 ? "2nd" : `${i + 1}th`} Jumu&apos;ah
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Khutbah</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-200">{slot.khutbah || "—"}</span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between">
                        <span className="text-sm text-slate-400">Salah</span>
                        <span className="text-sm font-bold tabular-nums text-emerald-300">{slot.salah || "—"}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* TV display link */}
            <a
              href="/display"
              className="group flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/8 backdrop-blur-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-700/60">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-slate-300">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-200">TV Display Mode</div>
                <div className="text-xs text-slate-400">Full-screen kiosk view</div>
              </div>
              <span className="ml-auto text-slate-400 transition-transform group-hover:translate-x-0.5">&rarr;</span>
            </a>

          </aside>
        </div>

        {/* ── Donate Section ── */}
        <section id="donate" className="mt-10 flex flex-col items-center gap-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-8 text-center sm:px-8 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 1.343-3 3 0 1.657 1.343 3 3 3s3-1.343 3-3c0-1.657-1.343-3-3-3zm0 0V4m0 16v-4m8-4h-4m-8 0H4" /></svg>
            Support Your Masjid
          </h2>
          <p className="text-slate-300 max-w-xs text-sm sm:max-w-md">Help us maintain and grow our community. Every donation makes a difference!</p>
          <img src="/donation-qr.png" alt="Donation QR" className="h-36 w-36 rounded-xl border border-white/15 bg-white p-2 shadow-lg" />
          <div className="text-xs text-slate-400">Scan to donate</div>
        </section>

        {/* ── Footer ── */}
        <footer className="mt-8 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center sm:mt-10">
          <div className="flex flex-col gap-2 items-center justify-center sm:flex-row sm:gap-3">
            <span className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} {masjid.name} &middot; Times shown in {masjid.timezone}
            </span>
            <span className="hidden sm:inline text-slate-600 mx-1">|</span>
            <a
              href="/admin"
              className="rounded-lg border border-slate-600/50 bg-slate-700/40 px-4 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-600/50 hover:text-white"
            >
              Admin
            </a>
          </div>
          <div className="text-xs text-slate-500">
            Location: {masjid.coordinates.lat}, {masjid.coordinates.lon}
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
      className={[
        "flex flex-row items-center rounded-2xl border px-4 py-3.5 transition",
        isNext
          ? "border-emerald-400/35 bg-emerald-500/12 shadow-[0_0_20px_rgba(16,185,129,0.10)]"
          : "border-white/8 bg-white/4 hover:bg-white/6",
      ].join(" ")}
    >
      {/* Label */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {isNext && (
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400" />
        )}
        <span className={`text-base font-semibold ${isNext ? "text-emerald-200" : "text-slate-200"}`}>
          {props.label}
        </span>
        {isNext && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Next
          </span>
        )}
      </div>

      {/* Times */}
      <div className="flex shrink-0 gap-6 sm:gap-10">
        <div className="w-[72px] text-right">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Adhan</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-200">{props.adhan}</div>
        </div>
        <div className="w-[72px] text-right">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Jamaat</div>
          <div className={`mt-0.5 text-sm font-semibold tabular-nums ${props.jamaat ? "text-emerald-300" : "text-slate-500"}`}>
            {props.jamaat ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
