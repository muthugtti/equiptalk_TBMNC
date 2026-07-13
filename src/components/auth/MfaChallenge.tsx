"use client";

import { useState } from "react";
import { requestSession, redeemRecoveryCode } from "@/lib/auth-client";

const codeInputClass =
    "form-input w-full text-center tracking-[0.5em] text-lg rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 px-4 font-semibold disabled:opacity-60";
const recoveryInputClass =
    "form-input w-full text-center tracking-widest rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 px-4 font-mono disabled:opacity-60";

/** Returning-user step: enter the 6-digit authenticator code, or fall back to a
 *  single-use recovery code if the device is unavailable. */
export function MfaChallenge({
    idToken,
    onComplete,
}: {
    idToken: string;
    onComplete: () => void;
}) {
    const [mode, setMode] = useState<"totp" | "recovery">("totp");
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const canSubmit = mode === "totp" ? code.length === 6 : code.trim().length > 0;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || !canSubmit) return;
        setLoading(true);
        setError(null);

        const r =
            mode === "totp"
                ? await requestSession(idToken, code)
                : await redeemRecoveryCode(idToken, code);

        if (r.status === "ok") {
            onComplete();
            return;
        }
        if (r.status === "rate_limited") {
            setError(`Too many attempts. Try again in ${Math.ceil(r.retryAfterSec / 60)} minute(s).`);
        } else if (r.status === "otp_invalid" || r.status === "error") {
            setError(r.message);
        } else {
            setError("Sign in failed. Please try again.");
        }
        setCode("");
        setLoading(false);
    };

    const switchMode = (next: "totp" | "recovery") => {
        setMode(next);
        setCode("");
        setError(null);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
                    Two-factor authentication
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {mode === "totp"
                        ? "Enter the 6-digit code from your authenticator app."
                        : "Enter one of your single-use recovery codes."}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={submit} className="space-y-6">
                {mode === "totp" ? (
                    <input
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        disabled={loading}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className={codeInputClass}
                        aria-label="Authentication code"
                    />
                ) : (
                    <input
                        autoFocus
                        autoComplete="off"
                        placeholder="xxxxx-xxxxx"
                        value={code}
                        disabled={loading}
                        onChange={(e) => setCode(e.target.value)}
                        className={recoveryInputClass}
                        aria-label="Recovery code"
                    />
                )}
                <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? "Verifying…" : "Verify"}
                </button>
            </form>

            <div className="text-center">
                <button
                    type="button"
                    onClick={() => switchMode(mode === "totp" ? "recovery" : "totp")}
                    className="text-sm font-medium text-primary hover:text-primary/80"
                >
                    {mode === "totp" ? "Use a recovery code instead" : "Use your authenticator app instead"}
                </button>
            </div>
        </div>
    );
}
