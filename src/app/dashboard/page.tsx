
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { ChatVolumeChart } from "@/components/dashboard/ChatVolumeChart";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { RecentIssuesTable } from "@/components/dashboard/RecentIssuesTable";
import { seedAnalyticsData } from "@/lib/seed-analytics";

type DateRange = "today" | "last_7" | "last_30" | "last_90";

const DATE_RANGES: { value: DateRange; label: string; days: number }[] = [
    { value: "today", label: "Today", days: 1 },
    { value: "last_7", label: "Last 7 Days", days: 7 },
    { value: "last_30", label: "Last 30 Days", days: 30 },
    { value: "last_90", label: "Last 90 Days", days: 90 },
];

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [statsData, setStatsData] = useState<any>(null);
    const [chatVolumeData, setChatVolumeData] = useState<any[]>([]);
    const [sentimentData, setSentimentData] = useState<any>(null);
    const [recentIssues, setRecentIssues] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>("last_30");
    const [showRangeDropdown, setShowRangeDropdown] = useState(false);

    useEffect(() => {
        const generateDashboardData = (range: DateRange) => {
            const rangeConfig = DATE_RANGES.find(r => r.value === range)!;
            const days = rangeConfig.days;
            // Scale factor relative to 30 days
            const scale = range === 'today' ? 1 / 30 : days / 30;

            // 1. Generate Dynamic Stats
            // Base values for 30 days
            const baseStats = {
                totalChats: 1204,
                newIssues: 86,
                resolvedIssues: 75,
                avgRating: 4.2
            };

            const newStats = {
                totalChats: Math.round(baseStats.totalChats * scale * (0.9 + Math.random() * 0.2)), // +/- 10% variance
                totalChatsTrend: Math.round((Math.random() * 10 - 5) * 10) / 10,
                newIssues: Math.round(baseStats.newIssues * scale * (0.8 + Math.random() * 0.4)),
                newIssuesTrend: Math.round((Math.random() * 6 - 2) * 10) / 10,
                resolvedIssues: Math.round(baseStats.resolvedIssues * scale * (0.8 + Math.random() * 0.4)),
                resolvedIssuesTrend: Math.round((Math.random() * 6 - 3) * 10) / 10,
                avgRating: Math.round((4.0 + Math.random() * 0.5) * 10) / 10, // Random rating between 4.0 and 4.5
                avgRatingTrend: Math.round((Math.random() * 0.4 - 0.2) * 10) / 10
            };
            setStatsData(newStats);

            // 2. Generate Dynamic Sentiment
            // Vary distribution slightly based on randomness
            const totalRatings = Math.round(256 * scale);
            const positivePct = 0.70 + Math.random() * 0.15; // 70-85%
            const neutralPct = 0.10 + Math.random() * 0.10; // 10-20%
            // Remainder is negative

            setSentimentData({
                positive: Math.round(positivePct * 100),
                neutral: Math.round(neutralPct * 100),
                negative: Math.round((1 - positivePct - neutralPct) * 100),
                totalRatings: totalRatings
            });

            // 3. Generate Chart Data
            const newVolumeData = Array.from({ length: days }, (_, i) => {
                const dayOffset = days - i;
                const baseValue = 100 + Math.sin(i * 0.5) * 40;
                const randomNoise = Math.random() * 20 - 10;

                return {
                    date: range === 'today' ? `${i}:00` : `Day ${i + 1}`,
                    current: Math.floor(Math.max(10, baseValue + randomNoise)),
                    previous: Math.floor(Math.max(10, baseValue + randomNoise - 15))
                };
            });

            if (range === 'today') {
                const hourlyData = Array.from({ length: 24 }, (_, i) => ({
                    date: `${i}:00`,
                    current: Math.floor(Math.random() * 20),
                    previous: Math.floor(Math.random() * 15)
                }));
                setChatVolumeData(hourlyData);
            } else {
                setChatVolumeData(newVolumeData);
            }
        };

        const initDashboard = async () => {
            setLoading(true); // Re-trigger loading state.
            try {
                // Initialize seed data (will only run if needed/safe)
                await seedAnalyticsData();

                // 1. Generate All Dynamic Data (Stats, Charts, Sentiment)
                generateDashboardData(dateRange);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);

                // Fallback for dynamic data
                generateDashboardData(dateRange);
            } finally {
                setLoading(false);
            }
        };

        initDashboard();
    }, [dateRange]);

    // Separate useEffect for Incidents Polling (Bypassing Client SDK permissions/config issues)
    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const res = await fetch('/api/incidents');
                const data = await res.json();

                if (data.incidents) {
                    const mappedIssues = data.incidents.slice(0, 5).map((inc: any) => ({
                        issueId: inc.displayId || inc.id.substring(0, 8),
                        description: inc.issueDescription,
                        equipment: inc.equipmentName,
                        timestamp: new Date(inc.createdAt).toLocaleString(),
                        status: inc.status,
                        priority: inc.priority,
                    }));
                    setRecentIssues(mappedIssues);
                }
            } catch (error) {
                console.error("Error fetching incidents:", error);
            }
        };

        // Initial fetch
        fetchIncidents();

        // Poll every 15 seconds for updates
        const intervalId = setInterval(fetchIncidents, 15000);

        return () => clearInterval(intervalId);
    }, []);

    if (loading && !statsData) { // Only show full loader on initial load
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const currentLabel = DATE_RANGES.find(r => r.value === dateRange)?.label;

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">
                        Performance Dashboard
                    </h1>
                    <div className="flex flex-wrap gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                                className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 pl-4 pr-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 w-40 justify-between"
                            >
                                <span>{currentLabel}</span>
                                <span className="material-symbols-outlined">expand_more</span>
                            </button>

                            {showRangeDropdown && (
                                <>
                                    <div
                                        className="fixed inset-0 z-10"
                                        onClick={() => setShowRangeDropdown(false)}
                                    ></div>
                                    <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                                        {DATE_RANGES.map((range) => (
                                            <button
                                                key={range.value}
                                                onClick={() => {
                                                    setDateRange(range.value);
                                                    setShowRangeDropdown(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${dateRange === range.value
                                                    ? 'text-primary font-semibold'
                                                    : 'text-gray-700 dark:text-gray-200'
                                                    }`}
                                            >
                                                {range.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-primary pl-4 pr-3 text-sm font-medium text-white hover:bg-primary/90">
                            <span>Export Report</span>
                            <span className="material-symbols-outlined">download</span>
                        </button>
                    </div>
                </div>

                {statsData && <StatsGrid data={statsData} />}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {chatVolumeData.length > 0 && <ChatVolumeChart data={chatVolumeData} />}
                    {sentimentData && <SentimentChart data={sentimentData} />}
                </div>

                <RecentIssuesTable issues={recentIssues} />
            </div>
        </main>
    );
}
