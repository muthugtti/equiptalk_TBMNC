"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, AuthError, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            // Update profile with display name
            await updateProfile(userCredential.user, {
                displayName: name
            });
            router.push("/dashboard");
        } catch (err) {
            const firebaseError = err as AuthError;
            console.error(firebaseError);
            if (firebaseError.code === 'auth/email-already-in-use') {
                setError("Email is already in use.");
            } else if (firebaseError.code === 'auth/weak-password') {
                setError("Password should be at least 6 characters.");
            } else {
                setError("Failed to create account. Please try again.");
            }
            // Log the error for debugging
            console.error("Signup Error Code:", firebaseError.code);
            console.error("Signup Error Message:", firebaseError.message);
            // Show full error in UI for debugging purposes during development/deployment issues
            setError(firebaseError.message);
        }
        setLoading(false);
        setLoading(false);
    };

    const handleGoogleSignin = async () => {
        setLoading(true);
        setError(null);
        try {
            await signInWithPopup(auth, googleProvider);
            router.push("/dashboard");
        } catch (err) {
            const firebaseError = err as AuthError;
            console.error("Google Sign-in Error:", firebaseError);
            setError(`Failed to sign in with Google: ${firebaseError.message} (${firebaseError.code})`);
        }
        setLoading(false);
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col group/design-root overflow-x-hidden">
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
                                    className="w-full max-w-lg bg-center bg-no-repeat aspect-square bg-contain opacity-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4/5 w-4/5"
                                    style={{
                                        backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC1JSOLk7msMVKZkVeRxnuQQTJhGOW-WJN8WB3u36FNMJG3TyXbj2QkRmy4Zjv49Gifj03NzWTcBi1kf_md3H0MyGXtzD_pLsNp1bcBxguzRdVntlRfniGSkBR4q5eMCzFt6kK--l_7mUTvsW7oQwehmfSQNoTzehfIZQ7S-OXx_TV7_aDPnmqeUwaLDNjuRvoeZLroMC7jxIYAAw6w0ezGMNmI0GjmGqBcRIsQlDURwGioBlepoAPge78mUZE9OVNccGthQVffndn-")'
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
                                            <Link href="/login" className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent text-gray-500 dark:text-gray-400 pb-[13px] pt-4">
                                                <p className="text-sm font-bold leading-normal tracking-wide">Sign In</p>
                                            </Link>
                                            <button className="flex flex-col items-center justify-center border-b-[3px] border-b-primary text-gray-900 dark:text-white pb-[13px] pt-4">
                                                <p className="text-sm font-bold leading-normal tracking-wide">Create Account</p>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Headline */}
                                    <h1 className="text-gray-900 dark:text-white tracking-tight text-3xl font-bold leading-tight text-left">
                                        Create Account
                                    </h1>

                                    {/* Error Message */}
                                    {error && (
                                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleSignup} className="mt-8 space-y-6">
                                        <div className="space-y-4 rounded-md">
                                            {/* Name Field */}
                                            <div className="flex flex-col">
                                                <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="name">
                                                    Full Name
                                                </label>
                                                <input
                                                    id="name"
                                                    name="name"
                                                    type="text"
                                                    required
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="Enter your full name"
                                                    className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 px-4 text-sm font-normal leading-normal"
                                                />
                                            </div>

                                            {/* Email Field */}
                                            <div className="flex flex-col">
                                                <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="email-address">
                                                    Email
                                                </label>
                                                <input
                                                    id="email-address"
                                                    name="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    required
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="Enter your email"
                                                    className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 px-4 text-sm font-normal leading-normal"
                                                />
                                            </div>

                                            {/* Password Field */}
                                            <div className="flex flex-col">
                                                <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="password">
                                                    Password
                                                </label>
                                                <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                                                    <input
                                                        id="password"
                                                        name="password"
                                                        type="password"
                                                        autoComplete="new-password"
                                                        required
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="Create a password"
                                                        className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 p-4 rounded-r-none border-r-0 pr-2 text-sm font-normal leading-normal"
                                                    />
                                                    <div className="text-gray-500 dark:text-gray-400 flex border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 items-center justify-center pr-4 rounded-r-lg border-l-0 cursor-pointer">
                                                        <span className="material-symbols-outlined text-xl">visibility</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Confirm Password Field */}
                                            <div className="flex flex-col">
                                                <label className="text-gray-800 dark:text-gray-300 text-sm font-medium leading-normal pb-2" htmlFor="confirm-password">
                                                    Confirm Password
                                                </label>
                                                <div className="relative flex w-full flex-1 items-stretch rounded-lg">
                                                    <input
                                                        id="confirm-password"
                                                        name="confirm-password"
                                                        type="password"
                                                        autoComplete="new-password"
                                                        required
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        placeholder="Confirm your password"
                                                        className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-gray-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-gray-800/50 h-12 placeholder:text-gray-500 dark:placeholder:text-gray-500 p-4 rounded-r-none border-r-0 pr-2 text-sm font-normal leading-normal"
                                                    />
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
                                                {loading ? "Creating Account..." : "Create Account"}
                                            </button>
                                        </div>


                                        {/* Divider */}
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                                            </div>
                                            <div className="relative flex justify-center text-sm">
                                                <span className="px-2 bg-background-light dark:bg-background-dark text-gray-500">Or continue with</span>
                                            </div>
                                        </div>

                                        {/* Google Sign In */}
                                        <button
                                            type="button"
                                            onClick={handleGoogleSignin}
                                            disabled={loading}
                                            className="flex w-full justify-center items-center gap-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-background-dark disabled:opacity-70 disabled:cursor-not-allowed"
                                        >
                                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                                <path
                                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                    fill="#4285F4"
                                                />
                                                <path
                                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                    fill="#34A853"
                                                />
                                                <path
                                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                                    fill="#FBBC05"
                                                />
                                                <path
                                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                    fill="#EA4335"
                                                />
                                            </svg>
                                            Sign up with Google
                                        </button>

                                        {/* Secondary Link */}
                                        <div className="text-center text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">Already have an account? </span>
                                            <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                                                Sign In
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
