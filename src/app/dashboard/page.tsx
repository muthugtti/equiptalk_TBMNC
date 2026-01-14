
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { ChatVolumeChart } from "@/components/dashboard/ChatVolumeChart";
import { SentimentChart } from "@/components/dashboard/SentimentChart";
import { RecentIssuesTable } from "@/components/dashboard/RecentIssuesTable";
import { seedAnalyticsData } from "@/lib/seed-analytics";

export default function DashboardPage() {
    const [loading, setLoading] = useState(true);
    const [statsData, setStatsData] = useState<any>(null);
    const [chatVolumeData, setChatVolumeData] = useState<any[]>([]);
    const [sentimentData, setSentimentData] = useState<any>(null);
    const [recentIssues, setRecentIssues] = useState<any[]>([]);

    useEffect(() => {
        const initDashboard = async () => {
            try {
                // Initialize seed data (will only run if needed/safe, but for now we force it for the user request)
                await seedAnalyticsData();

                // 1. Fetch Summary Stats
                const summaryDoc = await getDoc(doc(db, "analytics_summary", "dashboard"));
                if (summaryDoc.exists()) {
                    setStatsData(summaryDoc.data());
                }

                // 2. Fetch Chat Volume
                const volumeDoc = await getDoc(doc(db, "analytics_chat_volume", "current_period"));
                if (volumeDoc.exists()) {
                    setChatVolumeData(volumeDoc.data().data || []);
                }

                // 3. Fetch Sentiment
                const sentimentDoc = await getDoc(doc(db, "analytics_sentiment", "current"));
                if (sentimentDoc.exists()) {
                    setSentimentData(sentimentDoc.data());
                }

                // 4. Fetch Recent Issues
                const issuesQuery = query(collection(db, "analytics_recent_issues"), limit(10));
                const issuesSnapshot = await getDocs(issuesQuery);
                const issues = issuesSnapshot.docs.map(doc => ({
                    issueId: doc.data().issueId,
                    ...doc.data()
                }));
                // Sort roughly by timestamp string or just rely on natural order for mock
                setRecentIssues(issues);


            } catch (error) {
                console.error("Error fetching dashboard data, using fallback:", error);
                // Fallback to placeholder data on error (e.g. permission issues)
                setStatsData({
                    totalChats: 1204,
                    totalChatsTrend: 5,
                    newIssues: 86,
                    newIssuesTrend: 2,
                    resolvedIssues: 75,
                    resolvedIssuesTrend: -1,
                    avgRating: 4.2,
                    avgRatingTrend: 0.1
                });

                // Generate fallback chat volume data
                const fallbackVolume = Array.from({ length: 30 }, (_, i) => ({
                    date: `Day ${i + 1}`,
                    current: Math.floor(Math.random() * 100) + 50,
                    previous: Math.floor(Math.random() * 100) + 40
                }));
                setChatVolumeData(fallbackVolume);

                setSentimentData({
                    positive: 75,
                    neutral: 15,
                    negative: 10,
                    totalRatings: 256
                });

                setRecentIssues([
                    {
                        issueId: "#8214",
                        description: "Incorrect pressure readings",
                        equipment: "Compressor C-101",
                        timestamp: "2023-10-27 10:45 AM",
                        status: "Pending"
                    },
                    {
                        issueId: "#8213",
                        description: "Agent provided wrong maintenance date",
                        equipment: "Pump P-205",
                        timestamp: "2023-10-27 09:12 AM",
                        status: "Resolved"
                    },
                    {
                        issueId: "#8211",
                        description: "Cannot find documentation for HX-300",
                        equipment: "Heat Exchanger HX-300",
                        timestamp: "2023-10-26 03:20 PM",
                        status: "Unresolved"
                    }
                ]);
            } finally {
                setLoading(false);
            }
        };

        initDashboard();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">
                        Performance Dashboard
                    </h1>
                    <div className="flex flex-wrap gap-2">
                        <button className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 pl-4 pr-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                            <span>Last 30 Days</span>
                            <span className="material-symbols-outlined">expand_more</span>
                        </button>
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
