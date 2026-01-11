"use client";

import { useState } from "react";

export default function IncidentsPage() {
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPriority, setFilterPriority] = useState("");
    const [showReportModal, setShowReportModal] = useState(false);

    return (
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <a className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary" href="/dashboard">Dashboard</a>
                <span className="text-gray-500 dark:text-gray-400">/</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Incidents Management</span>
            </div>

            <div className="flex flex-wrap justify-between gap-3 mb-8">
                <h1 className="text-3xl font-black tracking-tighter min-w-72 text-gray-900 dark:text-white">Incidents</h1>
                <button
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-xl">add</span>
                    Report New Incident
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Search</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 dark:text-gray-400">
                                <span className="material-symbols-outlined text-xl">search</span>
                            </span>
                            <input
                                className="w-full pl-10 pr-4 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-primary focus:ring-primary text-gray-900 dark:text-white"
                                placeholder="Search by ID or equipment..."
                                type="text"
                            />
                        </div>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full sm:w-48 py-2 px-3 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-primary focus:ring-primary text-gray-900 dark:text-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="open">Open</option>
                            <option value="in_progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Priority</label>
                        <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                            className="w-full sm:w-48 py-2 px-3 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:border-primary focus:ring-primary text-gray-900 dark:text-white"
                        >
                            <option value="">All Priorities</option>
                            <option value="critical">Critical</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <button className="h-[38px] px-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary hover:border-primary transition-colors flex items-center gap-2 text-sm font-medium">
                        <span className="material-symbols-outlined text-lg">filter_list</span>
                        More Filters
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4" scope="col">ID</th>
                                <th className="px-6 py-4" scope="col">Equipment Name</th>
                                <th className="px-6 py-4" scope="col">Issue Description</th>
                                <th className="px-6 py-4" scope="col">Status</th>
                                <th className="px-6 py-4" scope="col">Priority</th>
                                <th className="px-6 py-4" scope="col">Reported At</th>
                                <th className="px-6 py-4 text-right" scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {/* Row 1 */}
                            <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">#INC-2024-001</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">SpectraMax M5</td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">Optical sensor calibration failed during routine check.</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                        Open
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                                        <span className="material-symbols-outlined text-lg">priority_high</span>
                                        Critical
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">Oct 24, 2023 09:42 AM</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                </td>
                            </tr>
                            {/* Row 2 */}
                            <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">#INC-2024-002</td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">Centrifuge 5424 R</td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">Unusual noise detected at high RPM speeds.</td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400">
                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                        In Progress
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                                        <span className="material-symbols-outlined text-lg">arrow_upward</span>
                                        High
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">Oct 23, 2023 02:15 PM</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors">
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Showing <span className="font-medium text-gray-900 dark:text-white">1</span> to <span className="font-medium text-gray-900 dark:text-white">5</span> of <span className="font-medium text-gray-900 dark:text-white">12</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <button className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-primary">
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Simple Modal Placeholder */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Report New Incident</h2>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">Form to report a new incident will go here.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-bold"
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
