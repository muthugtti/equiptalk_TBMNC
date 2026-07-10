"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AccountDrawer from "@/components/dashboard/AccountDrawer";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
    // Track whether a user was ever authenticated in this session.
    // We only redirect on onAuthStateChanged(null) during the initial load
    // (no session). Once auth is established, sign-out uses a hard navigation
    // to /api/auth/logout — if we also router.push here we race with that
    // navigation: the proxy still sees the valid cookie and bounces back.
    const authEstablished = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                authEstablished.current = true;
                setLoading(false);
            } else if (!authEstablished.current) {
                router.push("/login");
            }
        });
        return () => unsubscribe();
    }, [router]);

    const isActive = (path: string) => {
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    if (loading || !mounted) {
        return (
            <div className="flex h-screen w-full flex-col bg-gray-50 dark:bg-gray-900 animate-pulse">
                <div className="h-14 w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700" />
                <div className="flex flex-1 overflow-hidden">
                    <div className="hidden md:flex w-56 flex-col gap-3 p-4 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-9 rounded-lg bg-gray-100 dark:bg-gray-700" />
                        ))}
                    </div>
                    <div className="flex-1 p-8 space-y-4">
                        <div className="h-8 w-48 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
                            ))}
                        </div>
                        <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex h-auto min-h-screen w-full flex-col">
            <div className="layout-container flex h-full grow flex-col">
                <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-gray-200 dark:border-gray-700 bg-white dark:bg-background-dark/80 px-6 sm:px-10 py-3 sticky top-0 z-10 backdrop-blur-sm">
                    <div className="flex items-center gap-4 text-gray-800 dark:text-white">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                            <span className="text-sm font-bold tracking-tight">Eq</span>
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Equiptalk.ai</h2>
                    </div>
                    <div className="hidden md:flex items-center gap-9">
                        <Link
                            href="/dashboard"
                            className={`text-sm font-medium ${isActive('/dashboard') && !isActive('/dashboard/equipment') && !isActive('/dashboard/incidents') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary'}`}
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/dashboard/equipment"
                            className={`text-sm font-medium ${isActive('/dashboard/equipment') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary'}`}
                        >
                            Equipment
                        </Link>
                        <Link
                            href="/dashboard/incidents"
                            className={`text-sm font-medium ${isActive('/dashboard/incidents') ? 'text-primary' : 'text-gray-600 dark:text-gray-300 hover:text-primary dark:hover:text-primary'}`}
                        >
                            Incidents
                        </Link>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Agent Online</span>
                        </div>
                        <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button
                            onClick={() => setIsAccountDrawerOpen(true)}
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDpqhkUII6imYBNXQ_tC2fVKezNp9wBFqvFKWZvIhM_BFwQ2v2rbOxLDwXg9-pApQa-Xr_ZTGqBhDZvE8NSqMCLEVhYtEjpc7InGuODI61zdPPe_Dp4fNbfbteoFyDIBxur57u7sxMvSHjoIGBPyWaNvOghhiVUSffuiDBLMjt9o8CpQ7zfywwVsylwifsbuu4Dxm0wkrvRQtckxgVqRiZf2cv1ja_7dWfCPMakrbgYR7x23kPUUe7IlSpQidVobor3hJJjW1ftSp32")' }}
                        ></button>
                    </div>
                </header>
                {children}
            </div>

            <AccountDrawer
                isOpen={isAccountDrawerOpen}
                onClose={() => setIsAccountDrawerOpen(false)}
            />
        </div>
    );
}
