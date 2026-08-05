import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limit";
import { initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { isAllowedOrigin } from "@/lib/csrf";
import { mintSessionCookie, attachSessionCookie, clearSessionCookie } from "@/lib/session-cookie";

const LOCKOUT_FALLBACK = 15 * 60 * 1000;

// POST /api/auth/session — exchange a verified Firebase ID token for a session
// cookie. This single endpoint is the chokepoint every sign-in path (email
// login, email signup, Google) funnels through.
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimitKey = `login:${ip}`;

  // Pre-check: is this IP already locked out? (read-only, no increment yet)
  const preCheck = await checkRateLimit(rateLimitKey, false);
  if (!preCheck.allowed) {
    const retryAfterSec = Math.ceil((preCheck.retryAfterMs ?? LOCKOUT_FALLBACK) / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let idToken: string;
  try {
    const body = await req.json();
    idToken = body.idToken;
    if (typeof idToken !== "string" || !idToken) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await initAdmin();
    // Verify the password-backed ID token; throws on an invalid/expired token,
    // which is caught below and counted toward the lockout.
    await admin.auth().verifyIdToken(idToken);

    const sessionCookie = await mintSessionCookie(idToken);
    await clearRateLimit(rateLimitKey);

    const res = NextResponse.json({ ok: true });
    attachSessionCookie(res, sessionCookie);
    return res;
  } catch (err: any) {
    // Only count failures toward the lockout — valid logins never increment.
    await checkRateLimit(rateLimitKey, true);
    console.error("[auth/session POST]", err?.message);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
}

// DELETE /api/auth/session — clear the session cookie on logout
export async function DELETE(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
