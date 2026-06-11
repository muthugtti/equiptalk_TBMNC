"use client";

import { useState, useEffect } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  // Cooldown: disable button for 60s after first submission to prevent abuse.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (cooldownUntil === 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [cooldownUntil]);
  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownRemaining > 0) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Intentionally silent — always show the same success message to
      // prevent email enumeration (attacker can't tell if account exists).
    } finally {
      setLoading(false);
      setSubmitted(true);
      setCooldownUntil(Date.now() + 60_000);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-[#212529] dark:text-gray-300">
      <div className="flex min-h-screen justify-center items-center px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-2 justify-center">
            <span className="material-symbols-outlined text-primary text-3xl">hub</span>
            <span className="text-xl font-bold text-gray-800 dark:text-white">EquipAI</span>
          </div>

          <div className="text-center">
            <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
              Reset Password
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter your email and we&apos;ll send a reset link. Links expire in 1 hour.
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 p-4 rounded-lg text-sm text-center space-y-1">
              <p className="font-semibold">Check your inbox</p>
              <p>
                If <span className="font-medium">{email}</span> is registered, you&apos;ll receive a
                reset link shortly. It will expire in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col">
                <label
                  className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="form-input flex w-full rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 px-4 text-sm font-normal"
                />
              </div>
              <button
                type="submit"
                disabled={loading || cooldownRemaining > 0}
                className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading
                  ? "Sending…"
                  : cooldownRemaining > 0
                  ? `Resend in ${cooldownRemaining}s`
                  : "Send Reset Link"}
              </button>
            </form>
          )}

          <div className="text-center text-sm">
            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
