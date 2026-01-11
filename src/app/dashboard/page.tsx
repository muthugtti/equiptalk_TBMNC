export default function DashboardPage() {
    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">LLM Agent Performance Dashboard</h1>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">Total Chats</p>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">1,204</p>
                        <p className="text-base font-medium text-green-500">+5% vs. last period</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">New Issues Raised</p>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">86</p>
                        <p className="text-base font-medium text-green-500">+2% vs. last period</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">Issues Resolved</p>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">75</p>
                        <p className="text-base font-medium text-red-500">-1% vs. last period</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">Average User Rating</p>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">4.2 / 5</p>
                        <p className="text-base font-medium text-green-500">+0.1 vs. last period</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-gray-900 dark:text-white">Chat Volume Over Time</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Daily interactions over the last 30 days</p>
                            </div>
                            <div className="flex items-center gap-4 mt-2 sm:mt-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">This Period</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Previous Period</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex min-h-[300px] flex-1 flex-col justify-end">
                            <svg className="w-full h-full" fill="none" preserveAspectRatio="none" viewBox="0 0 478 150" width="100%" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 109C18.1538 109 18.1538 21 36.3077 21C54.4615 21 54.4615 41 72.6154 41C90.7692 41 90.7692 93 108.923 93C127.077 93 127.077 33 145.231 33C163.385 33 163.385 101 181.538 101C199.692 101 199.692 61 217.846 61C236 61 236 45 254.154 45C272.308 45 272.308 121 290.462 121C308.615 121 308.615 149 326.769 149C344.923 149 344.923 1 363.077 1C381.231 1 381.231 81 399.385 81C417.538 81 417.538 129 435.692 129C453.846 129 453.846 25 472 25" stroke="#137fec" strokeLinecap="round" strokeWidth="3"></path>
                                <path className="dark:stroke-gray-600" d="M0 132C18.1538 132 18.1538 64 36.3077 64C54.4615 64 54.4615 84 72.6154 84C90.7692 84 90.7692 126 108.923 126C127.077 126 127.077 76 145.231 76C163.385 76 163.385 134 181.538 134C199.692 134 199.692 104 217.846 104C236 104 236 88 254.154 88C272.308 88 272.308 144 290.462 144C308.615 144 308.615 149 326.769 149C344.923 149 344.923 54 363.077 54C381.231 54 381.231 124 399.385 124C417.538 124 417.538 149 435.692 149C453.846 149 453.846 78 472 78" stroke="#CFD8E3" strokeDasharray="4 4" strokeLinecap="round" strokeWidth="3"></path>
                            </svg>
                            <div className="flex justify-between mt-2 border-t border-gray-200 dark:border-gray-700 pt-2">
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 1</p>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 2</p>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 3</p>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 4</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
                        <div>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">User Feedback Sentiment</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Based on 256 ratings</p>
                        </div>
                        <div className="flex flex-1 items-center justify-center min-h-[300px] relative">
                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                <path className="stroke-gray-200 dark:stroke-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeWidth="3"></path>
                                <path className="stroke-green-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray="75, 100" strokeWidth="3"></path>
                                <path className="stroke-yellow-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray="15, 100" strokeDashoffset="-75" strokeWidth="3"></path>
                                <path className="stroke-red-500" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" strokeDasharray="10, 100" strokeDashoffset="-90" strokeWidth="3"></path>
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-gray-900 dark:text-white">75%</span>
                                <span className="text-base font-medium text-gray-500 dark:text-gray-400">Positive</span>
                            </div>
                        </div>
                        <div className="flex justify-around border-t border-gray-200 dark:border-gray-700 pt-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Positive</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Neutral</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Negative</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-x-auto">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recently Raised Issues</h3>
                        <a className="text-sm font-semibold text-primary hover:underline" href="#">View All</a>
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
                            <tr>
                                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">#8214</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Incorrect pressure readings</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Compressor C-101</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">2023-10-27 10:45 AM</td>
                                <td className="py-4 px-4">
                                    <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/50 px-2.5 py-0.5 text-xs font-semibold text-yellow-800 dark:text-yellow-300">Pending</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">#8213</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Agent provided wrong maintenance date</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Pump P-205</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">2023-10-27 09:12 AM</td>
                                <td className="py-4 px-4">
                                    <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/50 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:text-green-300">Resolved</span>
                                </td>
                            </tr>
                            <tr>
                                <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">#8211</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Cannot find documentation for HX-300</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">Heat Exchanger HX-300</td>
                                <td className="py-4 px-4 text-gray-600 dark:text-gray-300">2023-10-26 03:20 PM</td>
                                <td className="py-4 px-4">
                                    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/50 px-2.5 py-0.5 text-xs font-semibold text-red-800 dark:text-red-300">Unresolved</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
