import "server-only";
import { getDb } from "./firebase-admin";
import {
    generateSecret,
    verifyTotp,
    generateRecoveryCodes,
    hashRecoveryCode,
    matchRecoveryCode,
} from "./mfa";

// Per-user TOTP enrollment, keyed by Firebase uid. This collection is only
// reachable through the Admin SDK — firestore.rules denies all direct client
// access — so the base32 secret is stored as-is. If this app later needs
// defence against a Firestore/backup compromise, encrypt `secret` at rest with
// a server-held key here; nothing else would change.
const COLLECTION = "user_mfa";

export interface MfaRecord {
    secret: string;
    active: boolean;
}

export async function getUserMfa(uid: string): Promise<MfaRecord | null> {
    const db = await getDb();
    const snap = await db.collection(COLLECTION).doc(uid).get();
    if (!snap.exists) return null;
    const d = snap.data() as { secret?: string; active?: boolean };
    if (!d.secret) return null;
    return { secret: d.secret, active: !!d.active };
}

export async function isMfaActive(uid: string): Promise<boolean> {
    const rec = await getUserMfa(uid);
    return !!rec?.active;
}

/**
 * Begin (or restart) enrollment: write a fresh, not-yet-active secret and return
 * it so the caller can show the QR / manual key. Overwriting a pending record is
 * fine; an already-active record is protected by the route (re-enrollment there
 * is rejected so a stolen password can't silently reset someone's second factor).
 */
export async function startEnrollment(uid: string): Promise<string> {
    const db = await getDb();
    const secret = generateSecret();
    await db.collection(COLLECTION).doc(uid).set({
        secret,
        active: false,
        createdAt: new Date().toISOString(),
    });
    return secret;
}

/**
 * Verify the first code against a pending secret and, on success, activate it
 * and mint a fresh set of single-use recovery codes. The plaintext codes are
 * returned so the caller can show them once — only their hashes are stored.
 */
export async function confirmEnrollment(
    uid: string,
    token: string,
): Promise<{ ok: boolean; recoveryCodes?: string[] }> {
    const db = await getDb();
    const ref = db.collection(COLLECTION).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false };
    const d = snap.data() as { secret?: string; active?: boolean };
    if (!d.secret || d.active) return { ok: false }; // nothing pending to confirm
    if (!verifyTotp(d.secret, token)) return { ok: false };

    const recoveryCodes = generateRecoveryCodes();
    await ref.update({
        active: true,
        confirmedAt: new Date().toISOString(),
        recoveryCodes: recoveryCodes.map(hashRecoveryCode),
    });
    return { ok: true, recoveryCodes };
}

/** Verify a login-time code against the user's active secret. */
export async function verifyUserToken(uid: string, token: string): Promise<boolean> {
    const rec = await getUserMfa(uid);
    if (!rec?.active) return false;
    return verifyTotp(rec.secret, token);
}

/**
 * Redeem a single-use recovery code at login. On success the matched code is
 * removed (consumed) and the number of remaining codes is returned so the UI
 * can warn the user when they're running low.
 */
export async function consumeRecoveryCode(
    uid: string,
    code: string,
): Promise<{ ok: boolean; remaining?: number }> {
    const db = await getDb();
    const ref = db.collection(COLLECTION).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false };
    const d = snap.data() as { active?: boolean; recoveryCodes?: string[] };
    if (!d.active) return { ok: false };

    const hashes = Array.isArray(d.recoveryCodes) ? [...d.recoveryCodes] : [];
    const idx = matchRecoveryCode(code, hashes);
    if (idx === -1) return { ok: false };

    hashes.splice(idx, 1);
    await ref.update({ recoveryCodes: hashes });
    return { ok: true, remaining: hashes.length };
}
