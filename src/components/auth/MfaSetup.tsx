"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { confirmMfaEnroll } from "@/lib/auth-client";

const inputClass =
    "form-input w-full text-center tracking-[0.5em] text-lg rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 px-4 font-semibold disabled:opacity-60";

/**
 * First-time enrollment step: scan the QR (or enter the key) into an
 * authenticator app, then confirm the first code. On success the session cookie
 * is set server-side and onComplete() fires.
 */
export function MfaSetup({
    idToken,
    otpauthUrl,
    secret,
    onComplete,
}: {
    idToken: string;
    otpauthUrl: string;
    secret: string;
    onComplete: () => void;
}) {
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    // After the code is confirmed we show the one-time recovery codes and hold
    // here until the user acknowledges saving them — they're never shown again.
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading || code.length !== 6) return;
        setLoading(true);
        setError(null);

        const r = await confirmMfaEnroll(idToken, code);
        if (r.status === "ok") {
            setRecoveryCodes(r.recoveryCodes);
            setLoading(false);
            return;
        }
        if (r.status === "rate_limited") {
            setError(`Too many attempts. Try again in ${Math.ceil(r.retryAfterSec / 60)} minute(s).`);
        } else if (r.status === "otp_invalid" || r.status === "error") {
            setError(r.message);
        } else {
            setError("Setup failed. Please try again.");
        }
        setCode("");
        setLoading(false);
    };

    if (recoveryCodes) {
        return <RecoveryCodes codes={recoveryCodes} onDone={onComplete} />;
    }

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
                    Set up two-factor authentication
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password),
                    then enter the 6-digit code it shows to finish.
                </p>
            </div>

            <div className="flex flex-col items-center gap-4">
                <div className="rounded-xl bg-white p-4 border border-gray-200">
                    <QRCodeSVG value={otpauthUrl} size={176} />
                </div>
                <div className="text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Can&apos;t scan? Enter this key manually:
                    </p>
                    <code className="text-sm font-mono break-all text-gray-800 dark:text-gray-200 select-all">
                        {secret}
                    </code>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <form onSubmit={submit} className="space-y-6">
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
                    className={inputClass}
                    aria-label="Authentication code"
                />
                <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? "Verifying…" : "Verify & continue"}
                </button>
            </form>
        </div>
    );
}

/** One-time display of recovery codes. The user must acknowledge before we
 *  navigate away — these are never retrievable again. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
    const [saved, setSaved] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(codes.join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard blocked — the user can still copy manually */
        }
    };

    const download = () => {
        const blob = new Blob(
            [`Equiptalk AI recovery codes\n\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n`],
            { type: "text/plain" },
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "equiptalk-recovery-codes.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
                    Save your recovery codes
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    If you lose access to your authenticator, a recovery code lets you sign in. Each
                    works <span className="font-semibold">once</span>. Store them somewhere safe —
                    they won&apos;t be shown again.
                </p>
            </div>

            <ul className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                {codes.map((c) => (
                    <li key={c} className="font-mono text-sm text-gray-800 dark:text-gray-200 text-center select-all">
                        {c}
                    </li>
                ))}
            </ul>

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={copy}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
                <button
                    type="button"
                    onClick={download}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                    Download
                </button>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                    type="checkbox"
                    checked={saved}
                    onChange={(e) => setSaved(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                I&apos;ve saved these recovery codes somewhere safe.
            </label>

            <button
                type="button"
                disabled={!saved}
                onClick={onDone}
                className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
            >
                Continue to dashboard
            </button>
        </div>
    );
}
