"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, AuthError } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/dashboard");
        } catch (err) {
            const firebaseError = err as AuthError;
            console.error(firebaseError);
            setError(firebaseError.message || "Invalid email or password.");
        }
        setLoading(false);
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden bg-background-light dark:bg-background-dark font-display text-[#212529] dark:text-gray-300">
            <div className="layout-container flex h-full grow flex-col">
                <div className="flex flex-1 justify-center">
                    <div className="layout-content-container flex flex-col w-full flex-1">
                        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
                            {/* Left Panel: Branding */}
                            <div className="relative hidden lg:flex flex-col gap-6 px-10 py-10 bg-gray-100 dark:bg-background-dark/50 justify-center items-center">
                                <div className="absolute top-8 left-8 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-3xl">hub</span>
                                    <span className="text-xl font-bold text-gray-800 dark:text-white">EquipAI</span>
                                </div>
                                <div
                                    className="w-full max-w-lg bg-center bg-no-repeat aspect-square bg-contain"
                                    style={{
                                        backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC1JSOLk7msMVKZkVeRxnuQQTJhGOW-WJN8WB3u36FNMJG3TyXbj2QkRmy4Zjv49Gifj03NzWTcBi1kf_md3H0MyGXtzD_pLsNp1bcBxguzRdVntlRfniGSkBR4q5eMCzFt6kK--l_7mUTvsW7oQwehmfSQNoTzehfIZQ7S-OXx_TV7_aDPnmqeUwaLDNjuRvoeZLroMC7jxIYAAw6w0ezGMNmI0GjmGqBcRIsQlDURwGioBlepoAPge78mUZE9OVNccGthQVffndn-")',
                                        opacity: 0.2,
                                        position: 'absolute',
                                        top: '50%',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        height: '80%',
                                        width: '80%'
                                    }}
                                ></div>
                                <div className="z-10 flex flex-col gap-6 text-center max-w-md">
                                    <div className="flex flex-col gap-2">
                                        <h1 className="text-gray-900 dark:text-white text-4xl font-black leading-tight tracking-tight">
                                            Intelligent Equipment Management, Powered by AI
                                        </h1>
                                        <h2 className="text-gray-600 dark:text-gray-400 text-base font-normal leading-normal">
                                            Access your dashboard to manage equipment, create AI agents, and gain insights from your data.
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Right Panel: Form */}
                            <div className="flex flex-1 flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8 bg-background-light dark:bg-background-dark">
                                <div className="w-full max-w-md space-y-8">
                                    {/* Tabs */}
                                    <div>
                                        <div className="flex border-b border-gray-200 dark:border-gray-700 gap-8">
                                            <a href="#" className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-gray-900 dark:text-white pb-[13px] pt-4">
                                                <p className="text-sm font-bold leading-normal tracking-wide">Sign In</p>
                                            </a>
                                            <Link href="/signup" className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-gray-500 dark:text-gray-400 pb-[13px] pt-4">
                                                <p className="text-sm font-bold leading-normal tracking-wide">Create Account</p>
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Headline */}
                                    <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight text-left">
                                        Welcome Back
                                    </h1>

                                    {error && (
                                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleLogin} className="mt-8 space-y-6">
                                        <div className="space-y-4 rounded-md">
                                            {/* Email Field */}
                                            <div className="flex flex-col">
                                                <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="email-address">
                                                    Email / Username
                                                </label>
                                                <input
                                                    id="email-address"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Enter your email or username"
                                                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 px-4 text-sm font-normal leading-normal"
                                                />
                                            </div>

                                            {/* Password Field */}
                                            <div className="flex flex-col">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="password">
                                                        Password
                                                    </label>
                                                    <a href="#" className="text-sm font-medium text-primary hover:text-primary/80">
                                                        Forgot Password?
                                                    </a>
                                                </div>
                                                <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                                                    <input
                                                        id="password"
                                                        name="password"
                                                        type="password"
                                                        autoComplete="current-password"
                                                        required
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="Enter your password"
                                                        className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 p-4 rounded-r-none border-r-0 pr-2 text-sm font-normal leading-normal"
                                                    />
                                                    <div className="text-gray-500 dark:text-gray-400 flex border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 items-center justify-center pr-4 rounded-r-lg border-l-0 cursor-pointer">
                                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* CTA Button */}
                                        <div>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="group relative flex w-full justify-center rounded-lg border border-transparent bg-primary py-3 px-4 text-sm font-bold text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                {loading ? "Signing In..." : "Sign In"}
                                            </button>
                                        </div>

                                        {/* Secondary Link */}
                                        <div className="text-center text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
                                            <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
                                                Sign Up
                                            </Link>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
