"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, updateProfile, signOut, User } from "firebase/auth";
import { useTheme } from "@/components/ThemeProvider";

export default function AccountPage() {
    const { theme, setTheme } = useTheme();
    const [user, setUser] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setDisplayName(currentUser?.displayName ?? "");
        });
        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!auth.currentUser) return;
        setSaving(true);
        setStatus(null);
        try {
            await updateProfile(auth.currentUser, { displayName: displayName.trim() });
            setStatus({ type: "success", msg: "Profile updated." });
        } catch {
            setStatus({ type: "error", msg: "Could not update profile. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch {
            // Best-effort client-side sign-out.
        }
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch {
            // Proceed with redirect regardless.
        }
        window.location.href = "/login";
    };

    const nameDirty = displayName.trim() !== (user?.displayName ?? "");

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-3xl flex flex-col gap-6">
                {/* Header */}
                <div>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors mb-2"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Back to dashboard
                    </Link>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">
                        My Account
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage your profile and preferences
                    </p>
                </div>

                {/* Profile card */}
                <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                            <img
                                src={
                                    user?.photoURL ||
                                    "https://lh3.googleusercontent.com/aida-public/AB6AXuDpqhkUII6imYBNXQ_tC2fVKezNp9wBFqvFKWZvIhM_BFwQ2v2rbOxLDwXg9-pApQa-Xr_ZTGqBhDZvE8NSqMCLEVhYtEjpc7InGuODI61zdPPe_Dp4fNbfbteoFyDIBxur57u7sxMvSHjoIGBPyWaNvOghhiVUSffuiDBLMjt9o8CpQ7zfywwVsylwifsbuu4Dxm0wkrvRQtckxgVqRiZf2cv1ja_7dWfCPMakrbgYR7x23kPUUe7IlSpQidVobor3hJJjW1ftSp32"
                                }
                                alt="Profile"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                                {user?.displayName || "Guest User"}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {user?.email || "No email"}
                            </p>
                        </div>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display name
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving || !nameDirty}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? "Saving…" : "Save"}
                        </button>
                    </div>

                    <div className="mt-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-not-allowed"
                        />
                    </div>

                    {status && (
                        <p
                            className={`mt-3 text-sm ${
                                status.type === "success"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                            }`}
                        >
                            {status.msg}
                        </p>
                    )}
                </section>

                {/* Appearance card */}
                <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">Appearance</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Choose how Equiptalk looks on this device.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setTheme("light")}
                            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                                theme === "light"
                                    ? "border-primary text-primary bg-blue-50/50 dark:bg-primary/10"
                                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-lg">light_mode</span>
                            Light
                        </button>
                        <button
                            onClick={() => setTheme("dark")}
                            className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all ${
                                theme === "dark"
                                    ? "border-primary text-primary bg-blue-50/50 dark:bg-primary/10"
                                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-lg">dark_mode</span>
                            Dark
                        </button>
                    </div>
                </section>

                {/* Danger / session */}
                <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Session</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Sign out of your account on this device.
                        </p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/50 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        Sign Out
                    </button>
                </section>
            </div>
        </main>
    );
}
