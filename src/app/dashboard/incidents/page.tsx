"use client";

import { useState, useEffect } from "react";
import ReportIncidentModal from "@/components/dashboard/incidents/ReportIncidentModal";

interface Incident {
    id: string;
    displayId?: string;
    equipmentId: string;
    equipmentName: string;
    issueDescription: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
}

interface Equipment {
    id: string;
    name: string;
    model: string;
}

export default function IncidentsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPriority, setFilterPriority] = useState("");

    // Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [editingIncident, setEditingIncident] = useState<Incident | undefined>(undefined);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [incidentsRes, equipmentRes] = await Promise.all([
                fetch("/api/incidents"),
                fetch("/api/equipment")
            ]);

            const incidentsData = await incidentsRes.json();
            const equipmentData = await equipmentRes.json();

            if (incidentsData.incidents) {
                setIncidents(incidentsData.incidents);
            }
            if (equipmentData.equipment) {
                setEquipmentList(equipmentData.equipment);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateClick = () => {
        setEditingIncident(undefined);
        setShowReportModal(true);
    };

    const handleEditClick = (incident: Incident) => {
        setEditingIncident(incident);
        setShowReportModal(true);
    };

    const handleDeleteClick = async (id: string) => {
        if (!confirm("Are you sure you want to delete this incident?")) return;

        try {
            const res = await fetch(`/api/incidents/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                setIncidents(prev => prev.filter(inc => inc.id !== id));
            } else {
                alert("Failed to delete incident");
            }
        } catch (error) {
            console.error("Error deleting incident:", error);
        }
    };

    const filteredIncidents = incidents.filter(incident => {
        if (filterStatus && incident.status !== filterStatus) return false;
        if (filterPriority && incident.priority !== filterPriority) return false;
        return true;
    });

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
            case "in_progress": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400";
            case "resolved": return "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400";
            case "closed": return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
            default: return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "critical": return "text-red-600 dark:text-red-400";
            case "high": return "text-orange-600 dark:text-orange-400";
            case "medium": return "text-yellow-600 dark:text-yellow-400";
            case "low": return "text-blue-600 dark:text-blue-400";
            default: return "text-gray-600 dark:text-gray-400";
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case "critical": return "priority_high";
            case "high": return "arrow_upward";
            case "medium": return "remove";
            case "low": return "arrow_downward";
            default: return "remove";
        }
    };

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
                    onClick={handleCreateClick}
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
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                        Loading incidents...
                                    </td>
                                </tr>
                            ) : filteredIncidents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                                        No incidents found.
                                    </td>
                                </tr>
                            ) : (
                                filteredIncidents.map(incident => (
                                    <tr key={incident.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-gray-400">
                                            {incident.displayId || incident.id.substring(0, 8)}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {incident.equipmentName}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate" title={incident.issueDescription}>
                                            {incident.issueDescription}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(incident.status)}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${incident.status === 'open' ? 'bg-red-500' : incident.status === 'in_progress' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                                                {incident.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 font-medium ${getPriorityColor(incident.priority)}`}>
                                                <span className="material-symbols-outlined text-lg">{getPriorityIcon(incident.priority)}</span>
                                                {incident.priority.charAt(0).toUpperCase() + incident.priority.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                            {new Date(incident.createdAt).toLocaleDateString()} {new Date(incident.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditClick(incident)}
                                                    className="text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
                                                    title="Edit"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(incident.id)}
                                                    className="text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Delete"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        Showing <span className="font-medium text-gray-900 dark:text-white">{filteredIncidents.length}</span> results
                    </div>
                </div>
            </div>

            <ReportIncidentModal
                isOpen={showReportModal}
                onClose={() => setShowReportModal(false)}
                onSuccess={fetchData}
                equipmentList={equipmentList}
                initialData={editingIncident}
            />
        </main>
    );
}
