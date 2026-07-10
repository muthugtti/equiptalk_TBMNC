"use client";

import { useEffect, useState, useCallback } from "react";
import { RecentIssuesTable } from "@/components/dashboard/RecentIssuesTable";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Tab = "overview" | "analytics";

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

interface TopQuestion {
    question: string;
    count: number;
    equipmentCount: number;
    equipmentIds: string[];
}

interface RecentQuestion {
    equipmentId: string;
    question: string;
    timestamp: string;
}

interface EquipmentBreakdown {
    equipmentId: string;
    count: number;
}

interface AnalyticsData {
    total: number;
    unique: number;
    topQuestions: TopQuestion[];
    recent: RecentQuestion[];
    equipmentBreakdown: EquipmentBreakdown[];
}

interface Equipment {
    id: string;
    name: string;
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
/* Page shell + tabs                                                   */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
    const [tab, setTab] = useState<Tab>("overview");

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">
                        Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Operational overview and chat analytics for your account.
                    </p>
                </div>

                {/* Tab bar */}
                <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex gap-6" aria-label="Dashboard sections">
                        {([
                            { id: "overview", label: "Overview", icon: "dashboard" },
                            { id: "analytics", label: "Analytics", icon: "insights" },
                        ] as { id: Tab; label: string; icon: string }[]).map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id)}
                                className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                                    tab === t.id
                                        ? "border-primary text-primary"
                                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {tab === "overview" ? <OverviewTab /> : <AnalyticsTab />}
            </div>
        </main>
    );
}

/* ------------------------------------------------------------------ */
/* Overview tab — real data from /api/dashboard/summary                */
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

/* ------------------------------------------------------------------ */
/* Analytics tab — chat analytics + recent issues                      */
/* ------------------------------------------------------------------ */

function AnalyticsTab() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [equipment, setEquipment] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterEquipmentId, setFilterEquipmentId] = useState("");
    const [recentIssues, setRecentIssues] = useState<MappedIssue[]>([]);

    const equipmentMap = Object.fromEntries(equipment.map((e) => [e.id, e.name]));

    const fetchAnalytics = useCallback(async (equipmentId: string) => {
        setLoading(true);
        try {
            const url = equipmentId
                ? `/api/analytics?equipmentId=${encodeURIComponent(equipmentId)}`
                : "/api/analytics";
            const res = await fetch(url);
            if (res.ok) {
                setData(await res.json());
            }
        } catch (err) {
            console.error("Analytics fetch failed:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch("/api/equipment")
            .then((r) => r.json())
            .then((d) => {
                if (d.equipment) setEquipment(d.equipment);
            })
            .catch(() => {});
        fetchAnalytics("");
    }, [fetchAnalytics]);

    // Recent issues feed (15s polling) — mirrors the incidents API mapping.
    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const res = await fetch("/api/incidents");
                const d = await res.json();
                if (d.incidents) {
                    const mapped: MappedIssue[] = d.incidents.slice(0, 5).map((inc: any) => ({
                        issueId: inc.displayId || inc.id.substring(0, 8),
                        description: inc.issueDescription,
                        equipment: inc.equipmentName,
                        timestamp: new Date(inc.createdAt).toLocaleString(),
                        status: inc.status,
                        priority: inc.priority,
                    }));
                    setRecentIssues(mapped);
                }
            } catch (err) {
                console.error("Error fetching incidents:", err);
            }
        };

        fetchIncidents();
        const intervalId = setInterval(fetchIncidents, 15000);
        return () => clearInterval(intervalId);
    }, []);

    const handleFilterChange = (id: string) => {
        setFilterEquipmentId(id);
        fetchAnalytics(id);
    };

    function timeAgo(iso: string) {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Header row with equipment filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chat Analytics</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Most common questions across all equipment chats
                    </p>
                </div>
                <select
                    value={filterEquipmentId}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="">All Equipment</option>
                    {equipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                            {eq.name}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-xl bg-gray-200 dark:bg-gray-700" />
                        ))}
                    </div>
                    <div className="h-64 rounded-xl bg-gray-200 dark:bg-gray-700" />
                </div>
            ) : !data ? (
                <div className="flex items-center justify-center h-64 text-gray-400">
                    Failed to load analytics.
                </div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: "Total Questions", value: data.total, icon: "chat" },
                            { label: "Unique Questions", value: data.unique, icon: "help" },
                            {
                                label: "Equipment Chatted",
                                value: data.equipmentBreakdown.length,
                                icon: "handyman",
                            },
                            {
                                label: "Most Asked",
                                value: data.topQuestions[0]?.count ?? 0,
                                icon: "trending_up",
                                suffix: "×",
                            },
                        ].map((card) => (
                            <div
                                key={card.label}
                                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1"
                            >
                                <span className="material-symbols-outlined text-primary text-xl">
                                    {card.icon}
                                </span>
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {card.value}
                                    {card.suffix ?? ""}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {card.label}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Questions */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
                            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Top Questions</h3>
                                <p className="text-xs text-gray-400 mt-0.5">Ranked by frequency</p>
                            </div>
                            {data.topQuestions.length === 0 ? (
                                <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                                    No data yet
                                </div>
                            ) : (
                                <ol className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {data.topQuestions.map((q, i) => (
                                        <li key={i} className="flex items-start gap-3 px-5 py-3">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-2">
                                                    {q.question}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {q.equipmentCount} equipment · {q.count}× asked
                                                </p>
                                            </div>
                                            <span className="flex-shrink-0 text-sm font-semibold text-primary">
                                                {q.count}×
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </div>

                        {/* Right column */}
                        <div className="flex flex-col gap-6">
                            {/* Equipment breakdown */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        Questions by Equipment
                                    </h3>
                                </div>
                                {data.equipmentBreakdown.length === 0 ? (
                                    <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                                        No data yet
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {data.equipmentBreakdown.slice(0, 8).map((item) => {
                                            const maxCount = data.equipmentBreakdown[0]?.count || 1;
                                            const pct = Math.round((item.count / maxCount) * 100);
                                            return (
                                                <li
                                                    key={item.equipmentId}
                                                    className="px-5 py-3 flex items-center gap-3"
                                                >
                                                    <span className="text-sm text-gray-700 dark:text-gray-300 w-32 truncate flex-shrink-0">
                                                        {equipmentMap[item.equipmentId] ?? item.equipmentId}
                                                    </span>
                                                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className="bg-primary h-2 rounded-full transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">
                                                        {item.count}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>

                            {/* Recent questions feed */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col">
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        Recent Questions
                                    </h3>
                                </div>
                                {data.recent.length === 0 ? (
                                    <div className="flex items-center justify-center h-24 text-sm text-gray-400">
                                        No data yet
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-64 overflow-y-auto">
                                        {data.recent.slice(0, 10).map((r, i) => (
                                            <li key={i} className="px-5 py-3">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-1">
                                                    {r.question}
                                                </p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {equipmentMap[r.equipmentId] ?? r.equipmentId} ·{" "}
                                                    {timeAgo(r.timestamp)}
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Recently raised issues — always at the bottom of the Analytics tab */}
            <RecentIssuesTable issues={recentIssues} />
        </div>
    );
}
