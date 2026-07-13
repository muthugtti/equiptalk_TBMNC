// Self-contained TOTP (RFC 6238) — the OTP second factor for login.
//
// Implemented on Node's built-in crypto so there is no external dependency and
// no third party ever sees the secret. These functions are pure (time can be
// injected), so tests/mfa.test.ts pins them against the RFC 6238 test vectors.
//
// This module must stay server-only in practice (it derives codes from the
// shared secret) but carries no "server-only" pragma so the test runner can
// import it. Do NOT import it from client components — the client only ever
// handles the otpauth URL string the server returns, never the raw secret.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "Equiptalk AI";

/** RFC 4648 base32 encode (no padding). */
export function base32Encode(buf: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = "";
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i];
        bits += 8;
        while (bits >= 5) {
            output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += B32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

/** RFC 4648 base32 decode. Ignores padding, whitespace and case. */
export function base32Decode(input: string): Buffer {
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
    let bits = 0;
    let value = 0;
    const out: number[] = [];
    for (const ch of clean) {
        const idx = B32_ALPHABET.indexOf(ch);
        if (idx === -1) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

/** HMAC-based one-time password for a specific counter (RFC 4226). */
function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
    // 64-bit big-endian counter. JS bitwise is 32-bit, so build the bytes by
    // repeated division rather than shifting.
    const buf = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
        buf[i] = tmp & 0xff;
        tmp = Math.floor(tmp / 256);
    }
    const hmac = createHmac("sha1", secret).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const bin =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return (bin % 10 ** digits).toString().padStart(digits, "0");
}

/** The current 6-digit TOTP for a base32 secret. `atMs` is injectable for tests. */
export function generateTotp(secretBase32: string, atMs: number = Date.now()): string {
    const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
    return hotp(base32Decode(secretBase32), counter);
}

/**
 * Verify a submitted code against the secret, allowing ±`window` time steps to
 * tolerate clock drift and the user typing as a code rolls over. Comparison is
 * constant-time to avoid leaking timing information.
 */
export function verifyTotp(
    secretBase32: string,
    token: string,
    atMs: number = Date.now(),
    window = 1,
): boolean {
    const t = (token ?? "").trim();
    if (!/^\d{6}$/.test(t)) return false;
    const secret = base32Decode(secretBase32);
    const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
    const submitted = Buffer.from(t);
    for (let w = -window; w <= window; w++) {
        const candidate = Buffer.from(hotp(secret, counter + w));
        if (candidate.length === submitted.length && timingSafeEqual(candidate, submitted)) {
            return true;
        }
    }
    return false;
}

/** A fresh random base32 secret (160 bits, the RFC-recommended size for SHA1). */
export function generateSecret(bytes = 20): string {
    return base32Encode(randomBytes(bytes));
}

// ---------------------------------------------------------------------------
// Recovery codes — single-use backups for when the authenticator is lost.
// ---------------------------------------------------------------------------

const RECOVERY_CODE_COUNT = 10;

/**
 * Generate human-friendly single-use recovery codes, e.g. "a3k7p-q2m9x". Each
 * carries ~50 bits of entropy, so a fast hash (SHA-256) is safe at rest — an
 * attacker with the hashes still can't feasibly brute-force a code.
 */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const raw = base32Encode(randomBytes(7)).toLowerCase().slice(0, 10);
        codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    return codes;
}

/** Canonical form for hashing/compare: lowercase, alphanumerics only. */
export function normalizeRecoveryCode(code: string): string {
    return (code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** SHA-256 hex of the normalized code. Only hashes are ever stored. */
export function hashRecoveryCode(code: string): string {
    return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}

/**
 * Return the index of the stored hash matching `input`, or -1. Uses a
 * constant-time compare so a match doesn't leak through timing.
 */
export function matchRecoveryCode(input: string, hashes: string[]): number {
    const candidate = Buffer.from(hashRecoveryCode(input), "hex");
    for (let i = 0; i < hashes.length; i++) {
        let stored: Buffer;
        try {
            stored = Buffer.from(hashes[i], "hex");
        } catch {
            continue;
        }
        if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
            return i;
        }
    }
    return -1;
}

/**
 * Build the otpauth:// URI that authenticator apps consume (usually via QR).
 * The account name is shown to the user inside their authenticator app.
 */
export function buildOtpauthUrl(opts: { secret: string; accountName: string; issuer?: string }): string {
    const issuer = opts.issuer ?? ISSUER;
    const label = encodeURIComponent(`${issuer}:${opts.accountName}`);
    const query =
        `secret=${opts.secret}` +
        `&issuer=${encodeURIComponent(issuer)}` +
        `&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
    return `otpauth://totp/${label}?${query}`;
}
