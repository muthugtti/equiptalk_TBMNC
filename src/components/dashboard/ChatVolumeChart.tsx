
"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChatVolumeData {
    date: string;
    current: number;
    previous: number;
}

interface ChatVolumeChartProps {
    data: ChatVolumeData[];
}

export function ChatVolumeChart({ data }: ChatVolumeChartProps) {
    return (
        <div className="lg:col-span-2 flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 h-[400px]">
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

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                            interval={6}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="previous"
                            stroke="#D1D5DB"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            activeDot={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="current"
                            stroke="#137fec"
                            strokeWidth={3}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="hidden sm:flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 1</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 2</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 3</p>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Week 4</p>
            </div>
        </div>
    );
}
