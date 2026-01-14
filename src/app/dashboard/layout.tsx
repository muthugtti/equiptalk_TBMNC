
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [loading, setLoading] = useState(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('equiptalk_dev_user') === 'true') {
            return false;
        }
        return true;
    });

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // Dev bypass - already handled in init, but we still need to subscribe if NOT bypassed
        if (!loading && typeof window !== 'undefined' && localStorage.getItem('equiptalk_dev_user') === 'true') {
            return;
        }


        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/login");
            } else {
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [router]);

    const isActive = (path: string) => {
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!mounted) {
        return null;
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
                        <div
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10"
                            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDpqhkUII6imYBNXQ_tC2fVKezNp9wBFqvFKWZvIhM_BFwQ2v2rbOxLDwXg9-pApQa-Xr_ZTGqBhDZvE8NSqMCLEVhYtEjpc7InGuODI61zdPPe_Dp4fNbfbteoFyDIBxur57u7sxMvSHjoIGBPyWaNvOghhiVUSffuiDBLMjt9o8CpQ7zfywwVsylwifsbuu4Dxm0wkrvRQtckxgVqRiZf2cv1ja_7dWfCPMakrbgYR7x23kPUUe7IlSpQidVobor3hJJjW1ftSp32")' }}
                        ></div>
                    </div>
                </header>
                {children}
            </div>
        </div>
    );
}
