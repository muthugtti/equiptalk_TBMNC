import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";

const COOKIE_NAME = "__session";
// 5-day session. Firebase session cookies max out at 14 days.
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
const LOCKOUT_FALLBACK = 15 * 60 * 1000;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    // Next.js dev server doesn't set forwarded headers; fall back to the
    // socket IP so localhost doesn't collapse all requests into one bucket.
    (req as any).ip ??
    "127.0.0.1"
  );
}

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  // Firebase Hosting CDN rewrites Host to the Cloud Run internal address;
  // x-forwarded-host carries the original public hostname.
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

// POST /api/auth/session — exchange a Firebase ID token for an HttpOnly session cookie
export async function POST(req: NextRequest) {
  // CSRF: reject cross-origin requests
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = clientIp(req);
  const rateLimitKey = `login:${ip}`;

  // Pre-check: is this IP already locked out? (read-only, no increment yet)
  const preCheck = checkRateLimit(rateLimitKey, false);
  if (!preCheck.allowed) {
    const retryAfterSec = Math.ceil((preCheck.retryAfterMs ?? LOCKOUT_FALLBACK) / 1000);
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let idToken: string;
  try {
    ({ idToken } = await req.json());
    if (typeof idToken !== "string" || !idToken) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await initAdmin();
    const sessionCookie = await admin
      .auth()
      .createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });

    // Success — clear the failure counter so a legitimate user isn't penalised.
    clearRateLimit(rateLimitKey);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_DURATION_MS / 1000,
      path: "/",
    });
    return res;
  } catch (err: any) {
    // Only count failures toward the lockout — valid logins never increment.
    checkRateLimit(rateLimitKey, true);
    console.error("[auth/session POST]", err?.message);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
}

// DELETE /api/auth/session — clear the session cookie on logout
export async function DELETE(req: NextRequest) {
  // CSRF: reject cross-origin requests
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
