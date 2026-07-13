// Client-side helpers for the OTP-gated auth flow. Shared by the login and
// signup pages so both drive the session/MFA endpoints identically.

export type SessionResult =
    | { status: "ok" }
    | { status: "otp_required" }
    | { status: "enroll_required" }
    | { status: "otp_invalid"; message: string }
    | { status: "rate_limited"; retryAfterSec: number }
    | { status: "error"; message: string };

async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

function rateLimited(res: Response): { status: "rate_limited"; retryAfterSec: number } {
    const retryAfter = res.headers.get("Retry-After");
    return { status: "rate_limited", retryAfterSec: retryAfter ? parseInt(retryAfter, 10) : 900 };
}

/** Attempt to establish a session. Without `otp`, this probes whether the user
 *  needs to enroll or supply a code. */
export async function requestSession(idToken: string, otp?: string): Promise<SessionResult> {
    try {
        const res = await postJson("/api/auth/session", otp ? { idToken, otp } : { idToken });
        if (res.status === 429) return rateLimited(res);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { status: "ok" };
        if (data.mfa === "enroll_required") return { status: "enroll_required" };
        if (data.mfa === "otp_required") return { status: "otp_required" };
        if (data.mfa === "otp_invalid") {
            return { status: "otp_invalid", message: data.error ?? "Invalid authentication code." };
        }
        return { status: "error", message: data.error ?? "Sign in failed. Please try again." };
    } catch {
        return { status: "error", message: "Network error. Please try again." };
    }
}

/** Begin enrollment; returns the otpauth URL (for the QR) and manual key. */
export async function startMfaEnroll(
    idToken: string,
): Promise<{ ok: true; otpauthUrl: string; secret: string } | { ok: false; message: string }> {
    try {
        const res = await postJson("/api/auth/mfa", { idToken });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { ok: true, otpauthUrl: data.otpauthUrl, secret: data.secret };
        return { ok: false, message: data.error ?? "Could not start authenticator setup." };
    } catch {
        return { ok: false, message: "Network error. Please try again." };
    }
}

export type EnrollResult =
    | { status: "ok"; recoveryCodes: string[] }
    | { status: "otp_invalid"; message: string }
    | { status: "rate_limited"; retryAfterSec: number }
    | { status: "error"; message: string };

/** Confirm the first code; on success the session cookie is set server-side and
 *  the one-time recovery codes are returned to show the user once. */
export async function confirmMfaEnroll(idToken: string, otp: string): Promise<EnrollResult> {
    try {
        const res = await postJson("/api/auth/mfa/confirm", { idToken, otp });
        if (res.status === 429) return rateLimited(res);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { status: "ok", recoveryCodes: data.recoveryCodes ?? [] };
        return { status: "otp_invalid", message: data.error ?? "Invalid authentication code." };
    } catch {
        return { status: "error", message: "Network error. Please try again." };
    }
}

/** Redeem a single-use recovery code in place of the authenticator code. */
export async function redeemRecoveryCode(idToken: string, recoveryCode: string): Promise<SessionResult> {
    try {
        const res = await postJson("/api/auth/session", { idToken, recoveryCode });
        if (res.status === 429) return rateLimited(res);
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) return { status: "ok" };
        if (data.mfa === "otp_invalid") {
            return { status: "otp_invalid", message: data.error ?? "Invalid recovery code." };
        }
        return { status: "error", message: data.error ?? "Sign in failed. Please try again." };
    } catch {
        return { status: "error", message: "Network error. Please try again." };
    }
}
