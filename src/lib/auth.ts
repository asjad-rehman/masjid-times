import { createHmac } from "crypto";

/**
 * Server-side session token utilities.
 *
 * Tokens are HMAC-signed with the ADMIN_PASSCODE, so they:
 *   1) Cannot be forged without knowing the passcode
 *   2) Contain a timestamp so they expire after 24 hours
 *   3) Require no server-side storage (stateless — works in serverless)
 */

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function getSecret(): string {
  const secret = process.env.ADMIN_PASSCODE;
  if (!secret) throw new Error("ADMIN_PASSCODE not set");
  return secret;
}

/**
 * Creates a signed session token: `timestamp.hmac_signature`
 */
export function createSessionToken(): string {
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", getSecret())
    .update(timestamp)
    .digest("hex");
  return `${timestamp}.${signature}`;
}

/**
 * Validates a session token — checks signature and expiry.
 */
export function isValidSession(token: string | undefined): boolean {
  if (!token || !token.includes(".")) return false;

  const [timestampStr, signature] = token.split(".");

  // Check signature
  let expectedSig: string;
  try {
    expectedSig = createHmac("sha256", getSecret())
      .update(timestampStr)
      .digest("hex");
  } catch {
    return false; // ADMIN_PASSCODE not set
  }

  if (signature !== expectedSig) return false;

  // Check expiry
  const timestamp = Number(timestampStr);
  if (isNaN(timestamp)) return false;
  if (Date.now() - timestamp > TOKEN_MAX_AGE_MS) return false;

  return true;
}
