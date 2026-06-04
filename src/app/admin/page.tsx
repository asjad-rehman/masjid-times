"use client";

import { useEffect, useState } from "react";
import { fmt12From24 } from "@/lib/time";
import { masjid } from "@/config/masjid";
import Image from "next/image";
import Link from "next/link";

type JummahSlot = { khutbah: string; salah: string };

type Jamaat = {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah: JummahSlot[];
};

const EMPTY: Jamaat = {
  fajr: "",
  dhuhr: "",
  asr: "",
  maghrib: "",
  isha: "",
  jummah: [{ khutbah: "", salah: "" }],
};

const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

function normalizeTime(v: string) {
  const s = v.trim();
  if (!s) return s;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return s;
  const hh = String(Math.min(23, Math.max(0, parseInt(m[1], 10)))).padStart(2, "0");
  const mm = String(Math.min(59, Math.max(0, parseInt(m[2], 10)))).padStart(2, "0");
  return `${hh}:${mm}`;
}

function isValidTime(v: string) {
  if (!v) return true;
  return /^\d{1,2}:\d{2}$/.test(v.trim());
}

function sanitizeIncoming(incoming: unknown): Jamaat {
  const safe = { ...EMPTY };
  if (!incoming || typeof incoming !== "object") return safe;

  const source = incoming as Record<string, unknown>;
  for (const key of PRAYER_KEYS) {
    safe[key] = typeof source[key] === "string" ? (source[key] as string) : "";
  }

  if (Array.isArray(source.jummah) && source.jummah.length) {
    safe.jummah = (source.jummah as Record<string, unknown>[]).map((j) => ({
      khutbah: typeof j?.khutbah === "string" ? j.khutbah : "",
      salah: typeof j?.salah === "string" ? j.salah : "",
    }));
  }
  return safe;
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [status, setStatus] = useState("");
  const [data, setData] = useState<Jamaat>(EMPTY);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/jamaat", { cache: "no-store" });
      const json = await res.json();
      if (json.data) setData(sanitizeIncoming(json.data));
    } catch {
      setStatus("Error loading times");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function login() {
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        setLoggedIn(true);
        setStatus("");
      } else {
        setStatus("Wrong passcode");
      }
    } finally {
      setLoggingIn(false);
    }
  }

  async function save() {
    // Validate all times
    const allTimes = [
      ...PRAYER_KEYS.map((k) => ({ key: k, val: data[k] })),
      ...data.jummah.flatMap((j, i) => [
        { key: `Jummah ${i + 1} Khutbah`, val: j.khutbah },
        { key: `Jummah ${i + 1} Salah`, val: j.salah },
      ]),
    ];
    const invalid = allTimes.find((t) => t.val && !isValidTime(t.val));
    if (invalid) {
      setStatus(`Invalid time format for ${invalid.key}: "${invalid.val}" (use HH:MM)`);
      return;
    }

    setSaving(true);
    const payload = {
      ...data,
      fajr: normalizeTime(data.fajr),
      dhuhr: normalizeTime(data.dhuhr),
      asr: normalizeTime(data.asr),
      maghrib: normalizeTime(data.maghrib),
      isha: normalizeTime(data.isha),
      jummah: data.jummah.map(j => ({
        khutbah: normalizeTime(j.khutbah),
        salah: normalizeTime(j.salah)
      }))
    };

    try {
      const res = await fetch("/api/jamaat/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });
      if (res.ok) setStatus("Saved successfully");
      else setStatus("Save failed");
    } catch {
      setStatus("Network error");
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") login();
  }

  function updateJummahSlot(index: number, field: "khutbah" | "salah", value: string) {
    const next = [...data.jummah];
    next[index] = { ...next[index], [field]: value };
    setData({ ...data, jummah: next });
  }

  function removeJummahSlot(index: number) {
    if (data.jummah.length <= 1) return;
    setData({ ...data, jummah: data.jummah.filter((_, i) => i !== index) });
  }

  if (!loggedIn) {
    return (
      <main className="min-h-screen bg-[#fdfbf7] text-[#1a1a2e]">
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <Image
                src="/logo.png"
                alt={masjid.name}
                width={80}
                height={80}
                className="mx-auto w-[80px] h-[80px]"
                priority
              />
              <h1 className="mt-4 text-2xl font-bold">{masjid.name}</h1>
              <p className="mt-1 text-[#1a1a2e]/60 text-sm">Admin Panel</p>
            </div>
            <div className="rounded-2xl bg-white shadow-sm border border-black/10 p-6 space-y-4">
              <input
                type="password"
                className="w-full p-3 bg-[#1a1a2e]/5 border border-[#1a1a2e]/10 rounded-xl outline-none focus:border-emerald-500/50 transition-colors"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter passcode"
                autoFocus
              />
              <button
                onClick={login}
                disabled={loggingIn || !passcode}
                className="w-full bg-emerald-500 p-3 rounded-xl text-black font-bold disabled:opacity-50 hover:bg-emerald-400 transition-colors"
              >
                {loggingIn ? "Logging in..." : "Login"}
              </button>
              {status && <p className="text-sm text-center text-red-600">{status}</p>}
            </div>
            <div className="text-center">
              <Link href="/" className="text-sm text-[#1a1a2e]/50 hover:text-[#1a1a2e]/80 transition-colors">
                &larr; Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfbf7] text-[#1a1a2e]">
      <div className="relative z-10 p-6 md:p-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <Image
                src="/logo.png"
                alt={masjid.name}
                width={50}
                height={50}
                className="w-[50px] h-[50px]"
              />
              <div>
                <h1 className="text-2xl font-bold">Update Jamaat Times</h1>
                <p className="text-sm text-[#1a1a2e]/50">{masjid.name}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href="/" className="px-4 py-2 rounded-xl border border-[#1a1a2e]/10 text-[#1a1a2e]/70 hover:bg-[#1a1a2e]/5 transition-colors text-sm">
                Home
              </Link>
              <button onClick={save} disabled={saving} className="bg-emerald-500 px-6 py-2 rounded-xl text-black font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Daily Prayers */}
          <section className="rounded-2xl bg-white shadow-sm border border-black/10 p-6">
            <h2 className="text-lg font-semibold mb-4">Daily Prayer Jamaat Times</h2>
            <p className="text-sm text-[#1a1a2e]/50 mb-4">Enter times in 24-hour format (HH:MM)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRAYER_KEYS.map((key) => (
                <div key={key} className="rounded-xl border border-emerald-700/10 bg-white/50 p-4">
                  <label className="block text-sm font-semibold text-[#1a1a2e]/80 mb-2 capitalize">{key}</label>
                  <input
                    className={[
                      "w-full p-3 bg-white/80 border rounded-xl outline-none transition-colors text-lg tabular-nums",
                      data[key] && !isValidTime(data[key])
                        ? "border-red-500/50 focus:border-red-500"
                        : "border-[#1a1a2e]/10 focus:border-emerald-500/50",
                    ].join(" ")}
                    value={data[key]}
                    onChange={(e) => setData({ ...data, [key]: e.target.value })}
                    placeholder="HH:MM"
                  />
                  {data[key] && isValidTime(data[key]) && (
                    <div className="mt-1 text-xs text-emerald-600/70">{fmt12From24(normalizeTime(data[key]))}</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Jummah Slots */}
          <section className="rounded-2xl bg-white shadow-sm border border-black/10 p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold">Jumu&apos;ah Slots</h2>
                <p className="text-sm text-[#1a1a2e]/50 mt-1">Khutbah and Salah times for each Friday session</p>
              </div>
              <button
                onClick={() => setData({...data, jummah: [...data.jummah, {khutbah: "", salah: ""}]})}
                className="text-sm bg-amber-500/15 border border-amber-600/25 text-amber-800 px-4 py-2 rounded-xl hover:bg-amber-500/25 transition-colors"
              >
                + Add Slot
              </button>
            </div>
            <div className="space-y-4">
              {data.jummah.map((j, i) => (
                <div key={i} className="rounded-xl border border-amber-600/15 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-amber-800">Jummah {i + 1}</span>
                    {data.jummah.length > 1 && (
                      <button
                        onClick={() => removeJummahSlot(i)}
                        className="text-xs text-red-500/70 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#1a1a2e]/50 mb-1">Khutbah</label>
                      <input
                        className="w-full p-3 bg-white/80 border border-[#1a1a2e]/10 rounded-xl outline-none focus:border-amber-500/50 transition-colors tabular-nums"
                        value={j.khutbah}
                        onChange={(e) => updateJummahSlot(i, "khutbah", e.target.value)}
                        placeholder="HH:MM"
                      />
                      {j.khutbah && isValidTime(j.khutbah) && (
                        <div className="mt-1 text-xs text-amber-700/70">{fmt12From24(normalizeTime(j.khutbah))}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-[#1a1a2e]/50 mb-1">Salah</label>
                      <input
                        className="w-full p-3 bg-white/80 border border-[#1a1a2e]/10 rounded-xl outline-none focus:border-amber-500/50 transition-colors tabular-nums"
                        value={j.salah}
                        onChange={(e) => updateJummahSlot(i, "salah", e.target.value)}
                        placeholder="HH:MM"
                      />
                      {j.salah && isValidTime(j.salah) && (
                        <div className="mt-1 text-xs text-amber-700/70">{fmt12From24(normalizeTime(j.salah))}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Status */}
          {status && (
            <div className={[
              "p-4 rounded-xl border text-center text-sm",
              status.includes("successfully") || status.includes("Saved")
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border-red-500/30 bg-red-500/10 text-red-600",
            ].join(" ")}>
              {status}
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-4">
            <Link href="/" className="text-sm text-[#1a1a2e]/40 hover:text-[#1a1a2e]/70 transition-colors">
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
