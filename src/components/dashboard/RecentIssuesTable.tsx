
import React from 'react';

interface Issue {
    issueId: string;
    description: string;
    equipment: string;
    timestamp: string;
    status: string;
}

interface RecentIssuesTableProps {
    issues: Issue[];
}

export function RecentIssuesTable({ issues }: RecentIssuesTableProps) {
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'resolved':
                return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
            case 'unresolved':
                return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-x-auto">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Raised Issues</h3>
                <button className="text-sm font-semibold text-primary hover:underline">View All</button>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                    <tr>
                        <th className="py-3 px-4 font-medium">Issue ID</th>
                        <th className="py-3 px-4 font-medium">Description</th>
                        <th className="py-3 px-4 font-medium">Equipment</th>
                        <th className="py-3 px-4 font-medium">Timestamp</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {issues.map((issue) => (
                        <tr key={issue.issueId}>
                            <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">{issue.issueId}</td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{issue.description}</td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{issue.equipment}</td>
                            <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{issue.timestamp}</td>
                            <td className="py-4 px-4">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(issue.status)}`}>
                                    {issue.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
