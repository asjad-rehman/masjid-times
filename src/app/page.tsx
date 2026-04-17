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

      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">

        {/* ── Header ── */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 sm:text-right">
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
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">

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

        {/* ── Footer ── */}
        <footer className="mt-10 flex flex-col items-center gap-2 border-t border-white/8 pt-6 text-center">
          <p className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} {masjid.name} &middot; Times shown in {masjid.timezone}
          </p>
          <a
            href="/admin"
            className="text-[11px] text-white/15 transition-colors hover:text-white/40"
          >
            Admin
          </a>
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
        "flex items-center rounded-2xl border px-4 py-3.5",
        isNext
          ? "border-emerald-500/30 bg-emerald-500/[0.08] shadow-[0_0_24px_rgba(16,185,129,0.06)]"
          : "border-white/8 bg-black/15",
      ].join(" ")}
    >
      {/* Label */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
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
      <div className="flex shrink-0 gap-6 sm:gap-10">
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">Adhan</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{props.adhan}</div>
        </div>
        <div className="w-[90px] text-right">
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
