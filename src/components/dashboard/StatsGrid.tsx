
import React from 'react';

interface StatsData {
    totalChats: number;
    totalChatsTrend: number;
    newIssues: number;
    newIssuesTrend: number;
    resolvedIssues: number;
    resolvedIssuesTrend: number;
    avgRating: number;
    avgRatingTrend: number;
}

interface StatsGridProps {
    data: StatsData;
}

export function StatsGrid({ data }: StatsGridProps) {
    const StatCard = ({ title, value, trend, isRating = false }: { title: string, value: string | number, trend: number, isRating?: boolean }) => {
        const isPositive = trend > 0;
        const isNeutral = trend === 0;
        const trendColor = isNeutral ? 'text-gray-500' : isPositive ? 'text-green-500' : 'text-red-500';
        const trendPrefix = isPositive ? '+' : '';

        return (
            <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-base font-medium text-gray-500 dark:text-gray-400">{title}</p>
                <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</p>
                <p className={`text-base font-medium ${trendColor}`}>
                    {trendPrefix}{trend}{isRating ? '' : '%'} vs. last period
                </p>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <StatCard
                title="Total Chats"
                value={data.totalChats.toLocaleString()}
                trend={data.totalChatsTrend}
            />
            <StatCard
                title="New Issues Raised"
                value={data.newIssues}
                trend={data.newIssuesTrend}
            />
            <StatCard
                title="Issues Resolved"
                value={data.resolvedIssues}
                trend={data.resolvedIssuesTrend}
            />
            <StatCard
                title="Average User Rating"
                value={`${data.avgRating} / 5`}
                trend={data.avgRatingTrend}
                isRating
            />
        </div>
    );
}
