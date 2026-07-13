import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { isAllowedOrigin } from "@/lib/csrf";
import { checkRateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limit";
import { confirmEnrollment } from "@/lib/mfa-store";
import { mintSessionCookie, attachSessionCookie } from "@/lib/session-cookie";

// POST /api/auth/mfa/confirm — verify the first code against the pending secret,
// activate the authenticator, and (since password + code are now both proven)
// issue the session cookie in one step.
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rateLimitKey = `login:${ip}`;
  const preCheck = await checkRateLimit(rateLimitKey, false);
  if (!preCheck.allowed) {
    const retryAfterSec = Math.ceil((preCheck.retryAfterMs ?? 15 * 60 * 1000) / 1000);
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  let idToken: string;
  let otp: string;
  try {
    const body = await req.json();
    idToken = body.idToken;
    otp = body.otp;
    if (typeof idToken !== "string" || !idToken || typeof otp !== "string") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await initAdmin();
    const decoded = await admin.auth().verifyIdToken(idToken);

    const result = await confirmEnrollment(decoded.uid, otp);
    if (!result.ok) {
      await checkRateLimit(rateLimitKey, true);
      return NextResponse.json(
        { ok: false, error: "Invalid authentication code." },
        { status: 401 }
      );
    }

    const sessionCookie = await mintSessionCookie(idToken);
    await clearRateLimit(rateLimitKey);

    // Return the one-time recovery codes so the client can show them once.
    const res = NextResponse.json({ ok: true, recoveryCodes: result.recoveryCodes });
    attachSessionCookie(res, sessionCookie);
    return res;
  } catch (err: any) {
    console.error("[auth/mfa/confirm POST]", err?.message);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
}
