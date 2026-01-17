"use client";

import { useState, useEffect } from "react";

interface Equipment {
    id: string;
    name: string;
    model: string;
    // other fields if needed
}

interface ReportIncidentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    equipmentList: Equipment[];
    initialData?: any; // For edit mode later
}

export default function ReportIncidentModal({
    isOpen,
    onClose,
    onSuccess,
    equipmentList,
    initialData
}: ReportIncidentModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        equipmentId: "",
        equipmentName: "",
        issueDescription: "",
        status: "open",
        priority: "low"
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    equipmentId: initialData.equipmentId || "",
                    equipmentName: initialData.equipmentName || "",
                    issueDescription: initialData.issueDescription || "",
                    status: initialData.status || "open",
                    priority: initialData.priority || "low"
                });
            } else {
                // Reset form on open if no initial data
                setFormData({
                    equipmentId: "",
                    equipmentName: "",
                    issueDescription: "",
                    status: "open",
                    priority: "low"
                });
            }
        }
    }, [isOpen, initialData]);

    const handleEquipmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedEquipment = equipmentList.find(eq => eq.id === selectedId);

        setFormData(prev => ({
            ...prev,
            equipmentId: selectedId,
            equipmentName: selectedEquipment ? selectedEquipment.name : ""
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const url = initialData?.id
                ? `/api/incidents/${initialData.id}`
                : '/api/incidents';

            const method = initialData?.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                throw new Error("Failed to save incident");
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error submitting form:", error);
            // Optionally set validation error state here to show to user
            alert("Failed to submit report. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {initialData ? "Edit Incident" : "Report New Incident"}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* ID Display - Mocking it as auto-generated on backend, but showing placeholder or ID if edit */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Incident ID
                        </label>
                        <input
                            type="text"
                            disabled
                            value={initialData?.displayId || "Auto-generated"}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm"
                        />
                    </div>

                    {/* Equipment Select */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Equipment <span className="text-red-500">*</span>
                        </label>
                        <select
                            required
                            value={formData.equipmentId}
                            onChange={handleEquipmentChange}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                            <option value="">Select Equipment</option>
                            {equipmentList.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                    {eq.name} - {eq.model || "No Model"}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Issue Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Issue Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            required
                            rows={4}
                            value={formData.issueDescription}
                            onChange={(e) => setFormData(prev => ({ ...prev, issueDescription: e.target.value }))}
                            placeholder="Describe the issue in detail..."
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Status */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Status
                            </label>
                            <select
                                value={formData.status}
                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Priority
                            </label>
                            <select
                                value={formData.priority}
                                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                            </select>
                        </div>
                    </div>

                    {/* Reported At (Read Only) */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Reported At
                        </label>
                        <input
                            type="text"
                            disabled
                            value={initialData?.createdAt ? new Date(initialData.createdAt).toLocaleString() : new Date().toLocaleString()}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-sm"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 font-bold text-sm shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Saving..." : "Submit Incident"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
