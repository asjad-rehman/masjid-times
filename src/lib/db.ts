import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";

export type JummahSlot = { khutbah: string; salah: string };

export type Jamaat = {
  fajr: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  jummah: JummahSlot[];
  jummah2?: JummahSlot[]; // Optional second slot for display page
  updatedAt?: string; // ISO 8601 timestamp of last admin update
};

const DEFAULTS: Jamaat = {
  fajr: "05:30",
  dhuhr: "12:35",
  asr: "16:15",
  maghrib: "17:55",
  isha: "19:30",
  jummah: [{ khutbah: "12:45", salah: "13:15" }],
  jummah2: [{ khutbah: "13:15", salah: "13:45" }],
};

const FS_DATA_PATH = path.join(process.cwd(), "data", "jamaat.json");

// Helper to check if Upstash Redis is configured
// Support both Upstash env vars and legacy Vercel KV env vars
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const hasRedis = !!(redisUrl && redisToken);
const isVercelRuntime = process.env.VERCEL === "1";

// Lazily initialize Redis client only when needed
let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!hasRedis) return null;
  if (!_redis) {
    _redis = new Redis({ url: redisUrl!, token: redisToken! });
  }
  return _redis;
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

export async function getJamaatTimes(): Promise<Jamaat> {
  async function readFromRedis() {
    const redis = getRedis();
    if (!redis) return null;

    try {
      const data = await redis.get<Jamaat>("jamaat_times");
      if (data && isValidJamaat(data)) return data;
    } catch (error) {
      console.error("Redis Read Error:", error);
    }

    return null;
  }

  async function readFromFS() {
    try {
      const raw = await fs.readFile(FS_DATA_PATH, "utf8");
      const json = JSON.parse(raw);
      if (isValidJamaat(json)) return json;
    } catch {
      // File doesn't exist or error reading, ignore
    }

    return null;
  }

  // In local dev, filesystem is the source of truth. On Vercel, prefer Redis.
  const preferred = isVercelRuntime ? await readFromRedis() : await readFromFS();
  if (preferred) return preferred;

  const fallback = isVercelRuntime ? await readFromFS() : await readFromRedis();
  if (fallback) return fallback;

  return DEFAULTS;
}

export async function saveJamaatTimes(data: Jamaat): Promise<void> {
  if (!isValidJamaat(data)) throw new Error("Invalid payload");

  // Stamp the update time
  data.updatedAt = new Date().toISOString();

  // 1. Save to Upstash Redis
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set("jamaat_times", data);
    } catch (error) {
      // Do not block local persistence if Redis is misconfigured/unavailable.
      console.error("Redis Write Error:", error);
    }
  }

  // 2. Always sync to Filesystem (useful for local dev or backup)
  try {
    await fs.mkdir(path.dirname(FS_DATA_PATH), { recursive: true });
    await fs.writeFile(FS_DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    // If running in a read-only serverless environment, this might fail, which is expected.
    if (!hasRedis) console.error("FS Write Error:", error);
  }
}
