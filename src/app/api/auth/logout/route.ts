import { NextRequest, NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { initAdmin } from "@/lib/firebase-admin";

function isAllowedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// GET /api/auth/logout — harmless redirect only (no security action).
// The actual logout (cookie clear + token revoke) requires a POST.
export async function GET(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const base = forwardedHost ? `https://${forwardedHost}` : req.url;
  return NextResponse.redirect(new URL("/login", base), 302);
}

// POST /api/auth/logout — CSRF-protected logout.
// Clears the session cookie and revokes the Firebase refresh token.
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const cookie = req.cookies.get("__session")?.value;
  if (cookie) {
    try {
      await initAdmin();
      const decoded = await admin.auth().verifySessionCookie(cookie, false);
      await admin.auth().revokeRefreshTokens(decoded.uid);
    } catch {
      // Best-effort revocation — proceed with cookie deletion regardless.
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("__session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
