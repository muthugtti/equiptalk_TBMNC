
"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface SentimentData {
    positive: number;
    neutral: number;
    negative: number;
    totalRatings: number;
}

interface SentimentChartProps {
    data: SentimentData;
}

export function SentimentChart({ data }: SentimentChartProps) {
    const chartData = [
        { name: 'Positive', value: data.positive, color: '#22C55E' },
        { name: 'Neutral', value: data.neutral, color: '#EAB308' },
        { name: 'Negative', value: data.negative, color: '#EF4444' },
    ];

    return (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 h-[400px]">
            <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">User Feedback Sentiment</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Based on {data.totalRatings} ratings</p>
            </div>

            <div className="flex-1 w-full relative min-h-0 flex items-center justify-center">
                <div className="absolute inset-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                                startAngle={90}
                                endAngle={-270}
                                stroke="none"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.positive}%</span>
                    <span className="text-base font-medium text-gray-500 dark:text-gray-400">Positive</span>
                </div>
            </div>

            <div className="flex justify-around border-t border-gray-200 dark:border-gray-700 pt-4">
                {chartData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
