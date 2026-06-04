import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const passcode = String(body?.passcode ?? "").trim();
    
    // Fallback to a developer default if env is missing, but WARN about it
    const expected = String(process.env.ADMIN_PASSCODE ?? "").trim();

    if (!expected) {
      console.error("ADMIN_PASSCODE is not set in .env file");
      return NextResponse.json(
        { ok: false, error: "Server config error" },
        { status: 500 }
      );
    }

    if (passcode !== expected) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const cookieStore = await cookies();
    const token = createSessionToken();

    // Set secure cookie with HMAC-signed token
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}