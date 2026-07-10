"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const LOCKOUT_KEY = "equiptalk_lockout";
const MAX_CLIENT_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function getClientLockout(): { locked: boolean; remainingMs: number } {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { locked: false, remainingMs: 0 };
    const { lockedUntil } = JSON.parse(raw);
    const remaining = lockedUntil - Date.now();
    if (remaining <= 0) {
      sessionStorage.removeItem(LOCKOUT_KEY);
      return { locked: false, remainingMs: 0 };
    }
    return { locked: true, remainingMs: remaining };
  } catch {
    return { locked: false, remainingMs: 0 };
  }
}

function incrementClientFailures(): void {
  try {
    const raw = sessionStorage.getItem(LOCKOUT_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0 };
    data.count = (data.count ?? 0) + 1;
    if (data.count >= MAX_CLIENT_ATTEMPTS) {
      data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(data));
  } catch {}
}

function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-email":
      return "Invalid email or password.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a few minutes and try again.";
    default:
      return "Sign in failed. Please try again.";
  }
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("from");
  const redirectTo = (raw && raw.startsWith("/") && !raw.includes("://")) ? raw : "/dashboard";

  useEffect(() => {
    const { locked, remainingMs } = getClientLockout();
    if (locked) setLockoutMs(remainingMs);
  }, []);

  useEffect(() => {
    if (lockoutMs <= 0) return;
    const timer = setInterval(() => {
      const { locked, remainingMs } = getClientLockout();
      setLockoutMs(locked ? remainingMs : 0);
      if (!locked) setError(null);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutMs]);

  const isLocked = lockoutMs > 0;
  const lockoutMinutes = Math.ceil(lockoutMs / 60000);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLocked) return;

    setLoading(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const secs = retryAfter ? parseInt(retryAfter, 10) : 900;
        setError(`Too many attempts. Try again in ${Math.ceil(secs / 60)} minute(s).`);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Sign in failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch (err) {
      const code = (err as AuthError).code ?? "";
      incrementClientFailures();
      const { locked, remainingMs } = getClientLockout();
      if (locked) {
        setLockoutMs(remainingMs);
        setError(null);
      } else {
        setError(friendlyError(code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark font-display text-[#212529] dark:text-gray-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Left Panel: Branding */}
        <div className="relative hidden lg:flex flex-col gap-6 px-10 py-10 bg-gray-100 dark:bg-background-dark/50 justify-center items-center">
          <div className="absolute top-8 left-8 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">hub</span>
            <span className="text-xl font-bold text-gray-800 dark:text-white">EquipAI</span>
          </div>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4/5 w-4/5 bg-center bg-no-repeat bg-contain opacity-20"
            style={{
              backgroundImage:
                'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC1JSOLk7msMVKZkVeRxnuQQTJhGOW-WJN8WB3u36FNMJG3TyXbj2QkRmy4Zjv49Gifj03NzWTcBi1kf_md3H0MyGXtzD_pLsNp1bcBxguzRdVntlRfniGSkBR4q5eMCzFt6kK--l_7mUTvsW7oQwehmfSQNoTzehfIZQ7S-OXx_TV7_aDPnmqeUwaLDNjuRvoeZLroMC7jxIYAAw6w0ezGMNmI0GjmGqBcRIsQlDURwGioBlepoAPge78mUZE9OVNccGthQVffndn-")',
            }}
          />
          <div className="z-10 flex flex-col gap-6 text-center max-w-md">
            <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tight">
              Intelligent Equipment Management, Powered by AI
            </h1>
            <h2 className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal">
              Access your dashboard to manage equipment, create AI agents, and gain insights from
              your data.
            </h2>
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="flex flex-1 flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 bg-background-light dark:bg-background-dark">
          <div className="w-full max-w-md space-y-8">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 gap-8">
              <span className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-gray-900 dark:text-white pb-[13px] pt-4">
                <p className="text-sm font-bold leading-normal tracking-wide">Sign In</p>
              </span>
              <Link
                href="/signup"
                className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-gray-500 dark:text-gray-400 pb-[13px] pt-4"
              >
                <p className="text-sm font-bold leading-normal tracking-wide">Create Account</p>
              </Link>
            </div>

            <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight">
              Welcome Back
            </h1>

            {isLocked && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">lock</span>
                Too many failed attempts. Try again in {lockoutMinutes} minute
                {lockoutMinutes !== 1 ? "s" : ""}.
              </div>
            )}

            {error && !isLocked && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                {/* Email */}
                <div className="flex flex-col">
                  <label
                    className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2"
                    htmlFor="email-address"
                  >
                    Email
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={isLocked || loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="form-input flex w-full rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 px-4 text-sm font-normal disabled:opacity-60"
                  />
                </div>

                {/* Password */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm font-medium text-primary hover:text-primary/80 pb-2"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative flex w-full items-stretch rounded-lg">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      disabled={isLocked || loading}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="form-input flex w-full rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 p-4 rounded-r-none border-r-0 text-sm font-normal disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-gray-500 dark:text-gray-400 flex border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 items-center justify-center pr-4 pl-3 rounded-r-lg border-l-0 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                className="flex w-full justify-center rounded-lg bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? "Signing In…" : "Sign In"}
              </button>

              <div className="text-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Don&apos;t have an account? </span>
                <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
                  Sign Up
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
