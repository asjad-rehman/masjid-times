import { cookies } from "next/headers";
import { getJamaatTimes, saveJamaatTimes, type Jamaat } from "@/lib/db";
import { isValidSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isValidJamaat(x: unknown): x is Jamaat {
  if (!x || typeof x !== "object") return false;
  const v = x as Record<string, unknown>;
  return (
    typeof v.fajr === "string" &&
    typeof v.dhuhr === "string" &&
    typeof v.asr === "string" &&
    typeof v.maghrib === "string" &&
    typeof v.isha === "string" &&
    Array.isArray(v.jummah)
  );
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!isValidSession(session)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const candidate = body.data ?? body;

    if (!isValidJamaat(candidate)) {
      return Response.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    // Merging logic to preserve fields like jummah2 not present in the admin panel form
    const existing = await getJamaatTimes();
    const mergedData = { 
      ...existing, 
      ...candidate,
      // Ensure jummah array from admin panel takes priority
      jummah: candidate.jummah || existing.jummah 
    };

    // saveJamaatTimes automatically sets updatedAt
    await saveJamaatTimes(mergedData);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Failed to update jamaat times:", error);
    return Response.json({ ok: false, error: "Failed to save times" }, { status: 500 });
  }
}