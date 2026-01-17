import React from 'react';
import Link from 'next/link';

interface Issue {
    issueId: string;
    description: string;
    equipment: string;
    timestamp: string;
    status: string;
    priority: string; // Added priority
}

interface RecentIssuesTableProps {
    issues: Issue[];
}

export function RecentIssuesTable({ issues }: RecentIssuesTableProps) {
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'resolved':
            case 'closed':
                return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
            case 'in_progress':
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400';
            case 'open':
            case 'pending':
            case 'unresolved':
                return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "critical": return "text-red-600 dark:text-red-400";
            case "high": return "text-orange-600 dark:text-orange-400";
            case "medium": return "text-yellow-600 dark:text-yellow-400";
            case "low": return "text-blue-600 dark:text-blue-400";
            default: return "text-gray-600 dark:text-gray-400";
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "critical": return "priority_high";
            case "high": return "arrow_upward";
            case "medium": return "remove";
            case "low": return "arrow_downward";
            default: return "remove";
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Raised Issues</h3>
                <Link href="/dashboard/incidents" className="text-sm font-semibold text-primary hover:underline">
                    View All
                </Link>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs font-semibold">
                        <tr>
                            <th className="py-3 px-4" scope="col">ID</th>
                            <th className="py-3 px-4" scope="col">Equipment Name</th>
                            <th className="py-3 px-4" scope="col">Issue Description</th>
                            <th className="py-3 px-4" scope="col">Status</th>
                            <th className="py-3 px-4" scope="col">Priority</th>
                            <th className="py-3 px-4" scope="col">Reported At</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {issues.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                                    No recent issues found.
                                </td>
                            </tr>
                        ) : (
                            issues.map((issue) => (
                                <tr key={issue.issueId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-400">{issue.issueId}</td>
                                    <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">{issue.equipment}</td>
                                    <td className="py-4 px-4 text-gray-600 dark:text-gray-300 max-w-xs truncate" title={issue.description}>{issue.description}</td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${issue.status === 'open' ? 'bg-red-500' : issue.status === 'in_progress' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                                            {issue.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center gap-1 font-medium ${getPriorityColor(issue.priority)}`}>
                                            <span className="material-symbols-outlined text-lg">{getPriorityIcon(issue.priority)}</span>
                                            {issue.priority ? issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1) : 'Medium'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-gray-500 dark:text-gray-400">{issue.timestamp}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
