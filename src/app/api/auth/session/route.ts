import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clearRateLimit, getClientIp } from "@/lib/rate-limit";
import { initAdmin } from "@/lib/firebase-admin";
import * as admin from "firebase-admin";
import { isAllowedOrigin } from "@/lib/csrf";
import { getUserMfa, consumeRecoveryCode } from "@/lib/mfa-store";
import { verifyTotp } from "@/lib/mfa";
import { mintSessionCookie, attachSessionCookie, clearSessionCookie } from "@/lib/session-cookie";

const LOCKOUT_FALLBACK = 15 * 60 * 1000;

// POST /api/auth/session — exchange a Firebase ID token + TOTP code for a
// session cookie. The cookie is NEVER issued until a valid second factor is
// present: unenrolled users get `mfa: "enroll_required"`, enrolled users who
// haven't supplied a code get `mfa: "otp_required"`, and only a correct code
// mints the cookie. This single endpoint is the chokepoint every sign-in path
// (email login, email signup, Google) funnels through.
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
  let otp: string | undefined;
  let recoveryCode: string | undefined;
  try {
    const body = await req.json();
    idToken = body.idToken;
    otp = typeof body.otp === "string" ? body.otp : undefined;
    recoveryCode = typeof body.recoveryCode === "string" ? body.recoveryCode : undefined;
    if (typeof idToken !== "string" || !idToken) throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await initAdmin();
    // Verify the password-backed ID token first, then look up the user's second
    // factor. verifyIdToken throws on an invalid/expired token → caught below.
    const decoded = await admin.auth().verifyIdToken(idToken);
    const mfa = await getUserMfa(decoded.uid);

    if (!mfa?.active) {
      // No active authenticator yet — the client must run enrollment before a
      // session is granted. No cookie is set.
      return NextResponse.json({ ok: false, mfa: "enroll_required" });
    }

    // A recovery code is an alternative to the authenticator code for users who
    // lost their device. It's single-use — consumed on success.
    if (recoveryCode) {
      const redeemed = await consumeRecoveryCode(decoded.uid, recoveryCode);
      if (!redeemed.ok) {
        await checkRateLimit(rateLimitKey, true);
        return NextResponse.json(
          { ok: false, mfa: "otp_invalid", error: "Invalid recovery code." },
          { status: 401 }
        );
      }
      const sessionCookie = await mintSessionCookie(idToken);
      await clearRateLimit(rateLimitKey);
      const res = NextResponse.json({ ok: true, recoveryRemaining: redeemed.remaining });
      attachSessionCookie(res, sessionCookie);
      return res;
    }

    if (!otp) {
      // Enrolled, but no code supplied yet — ask for it. No cookie is set.
      return NextResponse.json({ ok: false, mfa: "otp_required" });
    }

    if (!verifyTotp(mfa.secret, otp)) {
      // Wrong code counts toward the same lockout that guards passwords, so the
      // code space can't be brute-forced.
      await checkRateLimit(rateLimitKey, true);
      return NextResponse.json(
        { ok: false, mfa: "otp_invalid", error: "Invalid authentication code." },
        { status: 401 }
      );
    }

    // Password + valid code → issue the session.
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
