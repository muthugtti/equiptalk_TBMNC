import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { isAllowedOrigin } from "@/lib/csrf";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getUserMfa, startEnrollment } from "@/lib/mfa-store";
import { buildOtpauthUrl } from "@/lib/mfa";

// POST /api/auth/mfa — begin authenticator enrollment for the signed-in user.
// Requires a valid Firebase ID token (proves the password step). Returns the
// otpauth URL + manual key so the client can render a QR; the code is confirmed
// separately at /api/auth/mfa/confirm. No session cookie is issued here.
export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit(`mfa-enroll:${ip}`, true, { maxAttempts: 15 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
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
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Don't let a valid password silently reset an existing authenticator — that
    // would defeat the second factor. Recovering a lost device is an out-of-band
    // admin action, not this endpoint.
    const existing = await getUserMfa(decoded.uid);
    if (existing?.active) {
      return NextResponse.json({ error: "Authenticator already set up." }, { status: 409 });
    }

    const secret = await startEnrollment(decoded.uid);
    const accountName = decoded.email ?? decoded.uid;
    const otpauthUrl = buildOtpauthUrl({ secret, accountName });

    return NextResponse.json({ ok: true, otpauthUrl, secret });
  } catch (err: any) {
    console.error("[auth/mfa POST]", err?.message);
    return NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
}
