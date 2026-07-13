"use client";

import { useEffect, useState } from "react";
import { RecentIssuesTable } from "@/components/dashboard/RecentIssuesTable";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface DashboardSummary {
    equipment: { total: number; operational: number; needsAttention: number; down: number };
    incidents: { total: number; open: number; resolved: number; last7Days: number };
    documents: { total: number };
    chats: { totalSessions: number; totalQuestions: number };
    recentIncidents: Array<{
        id: string;
        displayId: string;
        equipmentName: string;
        issueDescription: string;
        status: string;
        priority: string;
        createdAt: string;
    }>;
}

interface MappedIssue {
    issueId: string;
    description: string;
    equipment: string;
    timestamp: string;
    status: string;
    priority: string;
}

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">
                        Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Operational overview for your account.
                    </p>
                </div>

                <OverviewTab />
            </div>
        </main>
    );
}

/* ------------------------------------------------------------------ */
/* Overview — real data from /api/dashboard/summary                    */
/* ------------------------------------------------------------------ */

function OverviewTab() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(false);
            try {
                const res = await fetch("/api/dashboard/summary");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as DashboardSummary;
                if (!cancelled) setSummary(data);
            } catch (err) {
                console.error("Dashboard summary fetch failed:", err);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    ))}
                </div>
                <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-16 text-center">
                <span className="material-symbols-outlined text-4xl text-red-400">error</span>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    Couldn&apos;t load dashboard data.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Please refresh the page or try again shortly.
                </p>
            </div>
        );
    }

    const recentIssues: MappedIssue[] = summary.recentIncidents.map((inc) => ({
        issueId: inc.displayId || inc.id.substring(0, 8),
        description: inc.issueDescription,
        equipment: inc.equipmentName,
        timestamp: new Date(inc.createdAt).toLocaleString(),
        status: inc.status,
        priority: inc.priority,
    }));

    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Equipment */}
                <StatCard title="Total Equipment" value={summary.equipment.total} icon="handyman">
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <Breakdown color="bg-green-500" label="Operational" value={summary.equipment.operational} />
                        <Breakdown color="bg-yellow-500" label="Needs attention" value={summary.equipment.needsAttention} />
                        <Breakdown color="bg-red-500" label="Down" value={summary.equipment.down} />
                    </div>
                </StatCard>

                {/* Incidents */}
                <StatCard title="Incidents" value={summary.incidents.total} icon="report">
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        <Breakdown color="bg-red-500" label="Open" value={summary.incidents.open} />
                        <Breakdown color="bg-green-500" label="Resolved" value={summary.incidents.resolved} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {summary.incidents.last7Days} new in last 7 days
                    </p>
                </StatCard>

                {/* Documents */}
                <StatCard title="Documents" value={summary.documents.total} icon="description">
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Files powering equipment chat
                    </p>
                </StatCard>

                {/* Chats */}
                <StatCard title="Chat Sessions" value={summary.chats.totalSessions} icon="forum">
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {summary.chats.totalQuestions.toLocaleString()} questions asked
                    </p>
                </StatCard>
            </div>

            {/* Recent incidents glance */}
            <RecentIssuesTable issues={recentIssues} />
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    children,
}: {
    title: string;
    value: number;
    icon: string;
    children?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col rounded-xl p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <span className="material-symbols-outlined text-primary text-xl">{icon}</span>
            </div>
            <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                {value.toLocaleString()}
            </p>
            {children}
        </div>
    );
}

function Breakdown({ color, label, value }: { color: string; label: string; value: number }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
            <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
            {value} {label}
        </span>
    );
}
