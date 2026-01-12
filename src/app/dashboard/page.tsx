"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Equipment {
    id: string;
    name: string;
    type: string;
    model: string;
    serialNumber: string;
    status: string;
    slug: string;
}

export default function DashboardPage() {
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchEquipment();
    }, []);

    const fetchEquipment = async () => {
        try {
            const res = await fetch('/api/equipment');
            const data = await res.json();
            if (data.equipment) {
                setEquipmentList(data.equipment);
            }
        } catch (error) {
            console.error("Failed to fetch equipment", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTestEquipment = async () => {
        const name = prompt("Enter Equipment Name:");
        if (!name) return;
        const type = prompt("Enter Equipment Type (e.g. Compressor):") || "General";

        try {
            const res = await fetch('/api/equipment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    type,
                    model: "Test Model",
                    serialNumber: "SN-" + Date.now(),
                    status: "OPERATIONAL",
                    organizationId: "org-123" // Hardcoded for now
                })
            });
            if (res.ok) {
                fetchEquipment();
            } else {
                alert("Failed to create equipment");
            }
        } catch (e) {
            alert("Error creating equipment");
        }
    };

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">Equipment Dashboard</h1>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCreateTestEquipment}
                            className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-primary pl-4 pr-3 text-sm font-medium text-white hover:bg-primary/90"
                        >
                            <span>Add Equipment</span>
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid - Keeping original design */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="text-base font-medium text-gray-500 dark:text-gray-400">Total Equipment</p>
                        <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{equipmentList.length}</p>
                        <p className="text-base font-medium text-green-500">Active</p>
                    </div>
                    {/* ... other stats placeholders ... */}
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 overflow-x-auto">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Equipment Inventory</h3>
                    </div>
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
                            <tr>
                                <th className="py-3 px-4 font-medium">Name</th>
                                <th className="py-3 px-4 font-medium">Type</th>
                                <th className="py-3 px-4 font-medium">Model</th>
                                <th className="py-3 px-4 font-medium">Serial Number</th>
                                <th className="py-3 px-4 font-medium">Status</th>
                                <th className="py-3 px-4 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {loading ? (
                                <tr><td colSpan={6} className="py-4 text-center">Loading...</td></tr>
                            ) : equipmentList.length === 0 ? (
                                <tr><td colSpan={6} className="py-4 text-center">No equipment found.</td></tr>
                            ) : (
                                equipmentList.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="py-4 px-4 font-medium text-gray-900 dark:text-white">{item.name}</td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{item.type}</td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{item.model}</td>
                                        <td className="py-4 px-4 text-gray-600 dark:text-gray-300">{item.serialNumber}</td>
                                        <td className="py-4 px-4">
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.status === 'OPERATIONAL' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                                                    item.status === 'MAINTENANCE' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <Link href={`/dashboard/equipment/${item.id}`} className="text-primary hover:underline">
                                                View
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
