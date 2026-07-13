import { test } from "node:test";
import assert from "node:assert/strict";
import {
    base32Encode,
    base32Decode,
    generateTotp,
    verifyTotp,
    generateSecret,
    buildOtpauthUrl,
    generateRecoveryCodes,
    normalizeRecoveryCode,
    hashRecoveryCode,
    matchRecoveryCode,
} from "../src/lib/mfa.ts";

// The login OTP is RFC 6238 TOTP over HMAC-SHA1. The most valuable guard is the
// published RFC test vector set: if our HOTP/base32/counter math is wrong, these
// exact codes won't match. The RFC uses the ASCII secret "12345678901234567890";
// its 8-digit values are truncated to our 6 digits (value mod 1_000_000).
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

/* ------------------------------------------------------------------ */
/* RFC 6238 test vectors (SHA-1)                                        */
/* ------------------------------------------------------------------ */

test("RFC 6238 vector @ T=59s -> 287082", () => {
    assert.equal(generateTotp(RFC_SECRET, 59_000), "287082");
});

test("RFC 6238 vector @ T=1111111109s -> 081804", () => {
    assert.equal(generateTotp(RFC_SECRET, 1_111_111_109_000), "081804");
});

test("RFC 6238 vector @ T=1111111111s -> 050471", () => {
    assert.equal(generateTotp(RFC_SECRET, 1_111_111_111_000), "050471");
});

test("RFC 6238 vector @ T=1234567890s -> 005924", () => {
    assert.equal(generateTotp(RFC_SECRET, 1_234_567_890_000), "005924");
});

test("RFC 6238 vector @ T=2000000000s -> 279037", () => {
    assert.equal(generateTotp(RFC_SECRET, 2_000_000_000_000), "279037");
});

/* ------------------------------------------------------------------ */
/* base32 round-trip                                                    */
/* ------------------------------------------------------------------ */

test("base32 encode/decode round-trips arbitrary bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 253, 254, 255, 42, 99, 100]);
    assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
});

test("base32 decode ignores case, spaces and padding", () => {
    const secret = base32Encode(Buffer.from("hello world"));
    const messy = secret.toLowerCase().replace(/(.{4})/g, "$1 ") + "===";
    assert.deepEqual(base32Decode(messy), Buffer.from("hello world"));
});

/* ------------------------------------------------------------------ */
/* verifyTotp — the actual login check                                  */
/* ------------------------------------------------------------------ */

test("verifyTotp accepts the code for the current time step", () => {
    const now = 1_700_000_000_000;
    const code = generateTotp(RFC_SECRET, now);
    assert.equal(verifyTotp(RFC_SECRET, code, now), true);
});

test("verifyTotp tolerates the previous step (clock drift / typing lag)", () => {
    const now = 1_700_000_000_000;
    const prev = generateTotp(RFC_SECRET, now - 30_000);
    assert.equal(verifyTotp(RFC_SECRET, prev, now, 1), true);
});

test("verifyTotp rejects a code two steps away (outside the window)", () => {
    const now = 1_700_000_000_000;
    const old = generateTotp(RFC_SECRET, now - 90_000);
    assert.equal(verifyTotp(RFC_SECRET, old, now, 1), false);
});

test("verifyTotp rejects a wrong code", () => {
    const now = 1_700_000_000_000;
    const code = generateTotp(RFC_SECRET, now);
    const wrong = code === "000000" ? "111111" : "000000";
    assert.equal(verifyTotp(RFC_SECRET, wrong, now), false);
});

test("verifyTotp rejects malformed input (non-6-digit)", () => {
    const now = 1_700_000_000_000;
    for (const bad of ["", "12345", "1234567", "abcdef", "12 34 56"]) {
        assert.equal(verifyTotp(RFC_SECRET, bad, now), false, `should reject "${bad}"`);
    }
});

test("a code from one secret does not verify against another", () => {
    const now = 1_700_000_000_000;
    const secretA = generateSecret();
    const secretB = generateSecret();
    const codeA = generateTotp(secretA, now);
    assert.equal(verifyTotp(secretA, codeA, now), true);
    assert.equal(verifyTotp(secretB, codeA, now), false);
});

/* ------------------------------------------------------------------ */
/* secret + otpauth URL                                                 */
/* ------------------------------------------------------------------ */

test("generateSecret returns a decodable 20-byte (160-bit) base32 secret", () => {
    const s = generateSecret();
    assert.match(s, /^[A-Z2-7]+$/);
    assert.equal(base32Decode(s).length, 20);
});

test("buildOtpauthUrl encodes issuer, account and secret for authenticator apps", () => {
    const url = buildOtpauthUrl({ secret: "ABC234", accountName: "tech@example.com" });
    assert.match(url, /^otpauth:\/\/totp\//);
    assert.match(url, /secret=ABC234/);
    assert.match(url, /issuer=Equiptalk%20AI/);
    assert.match(url, /digits=6/);
    assert.match(url, /period=30/);
    assert.match(url, /tech%40example.com/);
});

/* ------------------------------------------------------------------ */
/* Recovery codes — single-use backup for a lost authenticator          */
/* ------------------------------------------------------------------ */

test("generateRecoveryCodes returns 10 unique formatted codes", () => {
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10, "codes must be unique");
    for (const c of codes) assert.match(c, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
});

test("normalizeRecoveryCode is case- and formatting-insensitive", () => {
    // What the user types (with dashes/spaces/caps) must match what we hashed.
    assert.equal(normalizeRecoveryCode("A3K7P-Q2M9X"), "a3k7pq2m9x");
    assert.equal(normalizeRecoveryCode("a3k7p q2m9x"), "a3k7pq2m9x");
    assert.equal(normalizeRecoveryCode(" a3k7p-q2m9x "), "a3k7pq2m9x");
});

test("matchRecoveryCode finds a code regardless of how it's typed", () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    // pick the 4th code and mangle its formatting
    const typed = codes[3].toUpperCase().replace("-", " ");
    assert.equal(matchRecoveryCode(typed, hashes), 3);
});

test("matchRecoveryCode returns -1 for an unknown code", () => {
    const hashes = generateRecoveryCodes().map(hashRecoveryCode);
    assert.equal(matchRecoveryCode("zzzzz-zzzzz", hashes), -1);
});

test("matchRecoveryCode returns -1 against an empty code list", () => {
    assert.equal(matchRecoveryCode("a3k7p-q2m9x", []), -1);
});

test("recovery codes are only stored as hashes (plaintext never equals stored value)", () => {
    const codes = generateRecoveryCodes();
    const hashes = codes.map(hashRecoveryCode);
    for (let i = 0; i < codes.length; i++) {
        assert.notEqual(hashes[i], normalizeRecoveryCode(codes[i]));
        assert.match(hashes[i], /^[0-9a-f]{64}$/); // sha256 hex
    }
});
