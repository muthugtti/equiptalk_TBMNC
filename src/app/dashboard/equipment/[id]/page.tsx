"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function EquipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const parentIdParam = searchParams.get('parentId');

    const isNew = id === 'new';

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState("knowledge");

    // Default form data
    const [formData, setFormData] = useState({
        name: "",
        type: "",
        model: "",
        serialNumber: "",
        status: "OPERATIONAL",
        parentId: parentIdParam || "",
        organizationId: "default-org",
        // Agent Config Fields
        responseStyle: "Professional & Concise",
        persona: "Expert Technician",
        customInstructions: "You are an expert on the SpectraMax M5 Spectrophotometer. Your role is to assist lab personnel with operating the equipment, troubleshooting issues, and following standard operating procedures. Be precise and refer to the knowledge documents provided.",
        llmModel: "GPT-4 Turbo",
        temperature: 0.2,
        // Public Access Fields
        publicLinkId: "eq-" + Math.random().toString(36).substring(2, 12), // Mock default for now
        isPublicAccessEnabled: false,
        documents: [] as any[],
        imageUrl: ""
    });

    useEffect(() => {
        if (!isNew) {
            fetchEquipmentDetails();
        } else {
            // Basic defaults for new item to match design feel
            setFormData(prev => ({ ...prev, name: "New Equipment" }));
        }
    }, [id]);

    const fetchEquipmentDetails = async () => {
        try {
            const res = await fetch(`/api/equipment/${id}`);
            if (res.ok) {
                const data = await res.json();
                setFormData({
                    name: data.name,
                    type: data.type,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    status: data.status,
                    parentId: data.parentId || "",
                    organizationId: data.organizationId,
                    responseStyle: data.responseStyle || "Professional & Concise",
                    persona: data.persona || "Expert Technician",
                    customInstructions: data.customInstructions || "You are an expert on this equipment. Assist users with operation and troubleshooting.",
                    llmModel: data.llmModel || "GPT-4 Turbo",
                    temperature: data.temperature !== undefined ? data.temperature : 0.2,
                    publicLinkId: data.publicLinkId || "eq-" + Math.random().toString(36).substring(2, 12),
                    isPublicAccessEnabled: data.isPublicAccessEnabled || false,
                    documents: data.documents || [],
                    imageUrl: data.imageUrl || ""
                });
            } else {
                console.error("Equipment not found");
            }
        } catch (error) {
            console.error("Error fetching details", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];

        // Validation
        if (file.size > 10 * 1024 * 1024) {
            alert("Image size must be less than 10MB");
            return;
        }

        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("equipmentId", id);

        setSaving(true);
        try {
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: uploadFormData
            });

            if (!uploadRes.ok) {
                const error = await uploadRes.json();
                console.error("❌ Upload API Error:", error);
                throw new Error(error.error || "Upload failed");
            }
            const uploadData = await uploadRes.json();

            setFormData(prev => ({ ...prev, imageUrl: uploadData.url }));
        } catch (error: any) {
            console.error("Error uploading image", error);
            alert(`Failed to upload image: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];

        // Validation
        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be less than 10MB");
            return;
        }

        const uploadFormData = new FormData();
        uploadFormData.append("file", file);
        uploadFormData.append("equipmentId", id);

        setSaving(true);
        try {
            // 1. Upload File
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: uploadFormData
            });

            if (!uploadRes.ok) {
                const error = await uploadRes.json();
                console.error("❌ Upload API Error:", error);
                throw new Error(error.error || "Upload failed");
            }
            const uploadData = await uploadRes.json();

            // 2. Save Document Record
            const docRes = await fetch('/api/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    url: uploadData.url,
                    filename: uploadData.filename, // Store filename for deletion
                    type: "document",
                    equipmentId: id
                })
            });

            if (docRes.ok) {
                fetchEquipmentDetails(); // Refresh list
            } else {
                throw new Error("Failed to save document record");
            }
        } catch (error: any) {
            console.error("Error uploading file", error);
            alert(`Failed to upload file: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const url = isNew ? "/api/equipment" : `/api/equipment/${id}`;
            const method = isNew ? "POST" : "PUT";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                if (isNew) {
                    const data = await res.json();
                    router.push(`/dashboard/equipment/${data.id}`);
                } else {
                    // Show success feedback
                }
            } else {
                const errorText = await res.text();
                console.error(`Failed to save. Status: ${res.status}. Response: ${errorText}`);
                alert(`Failed to save: ${res.status} ${res.statusText}`);
            }
        } catch (error) {
            console.error("Error saving", error);
            alert("An unexpected error occurred while saving.");
        } finally {
            setSaving(false);
        }
    };

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDeleteClick = () => {
        setIsDeleteModalOpen(true);
        setDeleteConfirmationText("");
    };

    const confirmDelete = async () => {
        if (deleteConfirmationText !== "DELETE") return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/equipment/${id}`, { method: "DELETE" });
            if (res.ok) {
                router.push("/dashboard/equipment");
            } else {
                const error = await res.json();
                alert(`Failed to delete: ${error.details || error.error}`);
            }
        } catch (error: any) {
            console.error("Error deleting", error);
            alert(`Error deleting: ${error.message}`);
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    // --- RENDER HELPERS ---

    const DeleteModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3 mb-4 text-red-600 dark:text-red-400">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                    <h3 className="text-xl font-bold">Delete Equipment?</h3>
                </div>

                <p className="text-gray-600 dark:text-gray-300 mb-4">
                    This action is <span className="font-bold">irreversible</span>.
                    It will permanently delete <strong>{formData.name}</strong> and all associated documents and images.
                </p>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Type <strong>DELETE</strong> to confirm:
                    </label>
                    <input
                        type="text"
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        placeholder="DELETE"
                    />
                </div>

                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={confirmDelete}
                        disabled={deleteConfirmationText !== "DELETE" || isDeleting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold"
                    >
                        {isDeleting && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                        {isDeleting ? "Deleting..." : "Delete Forever"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
        );
    }

    return (
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-background-light dark:bg-background-dark min-h-screen">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <Link href="/dashboard" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary">Dashboard</Link>
                <span className="text-gray-500 dark:text-gray-400">/</span>
                <Link href="/dashboard/equipment" className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-primary">Equipment List</Link>
                <span className="text-gray-500 dark:text-gray-400">/</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formData.name}</span>
            </div>

            {/* Page Heading */}
            <div className="flex flex-wrap justify-between gap-3 mb-8">
                <h1 className="text-3xl font-black tracking-tighter min-w-72 text-gray-900 dark:text-white">
                    {/* Editable Title */}
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-primary focus:ring-0 p-0 text-3xl font-black w-full"
                    />
                </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Sidebar (Identity Panel) */}
                <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col items-center text-center">
                        <div className="relative group mb-4">
                            {/* Image with overlay */}
                            <div
                                className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg w-32 h-32 bg-gray-100 dark:bg-gray-700"
                                style={{
                                    backgroundImage: `url("${formData.imageUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCgLXcDY4ZjP55LKJrTcEKJPDuFFlPkdfJnAlECaXAqSp6e4Du1wwCCsN9pvGKBcWpYMHWacve7vs_MQwIalif_aBG-mA5WTd9rAFHdgqQnVb-_NUciO_WLPQXw7ygzJ7wZP4KLdxHUIfIaWOddGTe5fr5BnInZ6fRkcLZe7gOeBe8bCNiEpPJx0EOK123OVfPFqVFHzFn0KXrNpRGnMI2i1Z7Uuv-OTQE1MTclupPRcd_Hf3udqqNAun6yePhQXCwhDO8neJixbUYd'}")`
                                }}
                            ></div>
                            {isNew ? (
                                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center text-white p-2 text-center text-xs">
                                    Save first to upload
                                </div>
                            ) : (
                                <label className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <span className="material-symbols-outlined mr-2">upload_file</span> Change
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                    />
                                </label>
                            )}
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{formData.name}</h2>

                        <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium
                             ${formData.status === 'OPERATIONAL' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                formData.status === 'DOWN' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'}`}>
                            <span className={`h-2 w-2 rounded-full ${formData.status === 'OPERATIONAL' ? 'bg-green-500' :
                                formData.status === 'DOWN' ? 'bg-red-500' : 'bg-yellow-500'
                                }`}></span>
                            Status: {formData.status}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col gap-3">
                            <div className="space-y-1 mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                                <input
                                    type="text"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-transparent dark:text-white"
                                />
                            </div>
                            <div className="space-y-1 mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Equipment ID</label>
                                <input
                                    type="text"
                                    value={formData.model}
                                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                    className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-transparent dark:text-white"
                                />
                            </div>
                            <div className="space-y-1 mb-2">
                                <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full text-sm rounded-md border-gray-300 dark:border-gray-600 bg-transparent dark:text-white"
                                >
                                    <option value="OPERATIONAL">Operational</option>
                                    <option value="MAINTENANCE">Maintenance</option>
                                    <option value="DOWN">Down</option>
                                </select>
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary/20 dark:bg-primary/30 text-primary text-sm font-bold tracking-wide hover:bg-primary/30 dark:hover:bg-primary/40 disabled:opacity-70"
                            >
                                {saving ? "Saving..." : "Save Changes"}
                            </button>

                            {!isNew && (
                                <button
                                    onClick={handleDeleteClick}
                                    className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold tracking-wide hover:bg-red-500/20 dark:hover:bg-red-500/30"
                                >
                                    Delete Equipment
                                </button>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main Content Area (Tabbed Interface) */}
                <div className="lg:col-span-8 xl:col-span-9">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        {/* Tabs */}
                        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
                            <nav className="flex gap-8 -mb-px">
                                <button
                                    onClick={() => setActiveTab("knowledge")}
                                    className={`flex items-center justify-center gap-2 border-b-2 py-4 px-1 transition-colors ${activeTab === 'knowledge' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary/50'}`}
                                >
                                    <span className="material-symbols-outlined text-xl">school</span>
                                    <p className="text-sm font-bold">Knowledge & Training</p>
                                </button>
                                <button
                                    onClick={() => setActiveTab("config")}
                                    className={`flex items-center justify-center gap-2 border-b-2 py-4 px-1 transition-colors ${activeTab === 'config' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary/50'}`}
                                >
                                    <span className="material-symbols-outlined text-xl">smart_toy</span>
                                    <p className="text-sm font-bold">Agent Configuration</p>
                                </button>
                                <button
                                    onClick={() => setActiveTab("access")}
                                    className={`flex items-center justify-center gap-2 border-b-2 py-4 px-1 transition-colors ${activeTab === 'access' ? 'border-primary text-primary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary hover:border-primary/50'}`}
                                >
                                    <span className="material-symbols-outlined text-xl">share</span>
                                    <p className="text-sm font-bold">Public Access</p>
                                </button>
                            </nav>
                        </div>

                        {/* Tab Content */}
                        <div className="p-6">
                            {activeTab === 'knowledge' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Upload Knowledge Documents</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">Add manuals, SOPs, and troubleshooting guides for the agent to learn from.</p>
                                    </div>

                                    {/* Upload Area */}
                                    {isNew ? (
                                        <div className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed">
                                            <span className="material-symbols-outlined text-5xl text-gray-400">cloud_off</span>
                                            <p className="mt-2 font-semibold text-gray-900 dark:text-white">Upload Disabled</p>
                                            <p className="text-sm text-gray-500 font-bold mt-1">Please save the equipment details first.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                                            <span className="material-symbols-outlined text-5xl text-gray-400">cloud_upload</span>
                                            <p className="mt-2 font-semibold text-gray-900 dark:text-white">Upload Documents</p>
                                            <label className="mt-2 cursor-pointer">
                                                <span className="text-sm font-bold text-primary hover:underline">Browse files</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileUpload}
                                                    accept=".pdf,.docx,.txt"
                                                />
                                            </label>
                                            <p className="text-xs text-gray-400 mt-4">Supported file types: PDF, DOCX, TXT</p>
                                        </div>
                                    )}

                                    {/* File List */}
                                    <div className="space-y-3">
                                        <h4 className="font-bold text-gray-900 dark:text-white">Uploaded Documents</h4>
                                        {formData.documents && formData.documents.length > 0 ? (
                                            formData.documents.map((doc: any) => (
                                                <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary/30 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <span className="material-symbols-outlined text-blue-500 text-3xl">description</span>
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">{doc.name}</p>
                                                            <p className="text-sm text-gray-500">Uploaded on {new Date(doc.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-primary/10 text-gray-400 hover:text-primary"><span className="material-symbols-outlined text-xl">visibility</span></a>
                                                        <button className="p-2 rounded-full hover:bg-red-500/10 text-gray-400 hover:text-red-500"><span className="material-symbols-outlined text-xl">delete</span></button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'config' && (
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Agent Personality</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">Define how the agent interacts with users. This will shape its tone and communication style.</p>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Response Style</label>
                                                <select
                                                    value={formData.responseStyle}
                                                    onChange={(e) => setFormData({ ...formData, responseStyle: e.target.value })}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none px-4 py-2.5"
                                                >
                                                    <option>Friendly & Helpful</option>
                                                    <option>Professional & Concise</option>
                                                    <option>Formal & Detailed</option>
                                                    <option>Enthusiastic & Casual</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Persona</label>
                                                <select
                                                    value={formData.persona}
                                                    onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none px-4 py-2.5"
                                                >
                                                    <option>Default Agent</option>
                                                    <option>Expert Technician</option>
                                                    <option>Lab Assistant</option>
                                                    <option>Support Specialist</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Custom Instructions (System Prompt)</label>
                                            <textarea
                                                value={formData.customInstructions}
                                                onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
                                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none px-4 py-2.5"
                                                placeholder="e.g., Always refer to the user manual for specific page numbers. Never guess an answer. If you don't know, say so."
                                                rows={5}
                                            ></textarea>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Provide specific guidelines for the agent's behavior and response generation.</p>
                                        </div>

                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Advanced Settings</h3>
                                            <p className="text-gray-500 dark:text-gray-400 mt-1">Configure integrations and other advanced parameters for the agent.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">LLM Model</label>
                                                <select
                                                    value={formData.llmModel}
                                                    onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                                                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:outline-none px-4 py-2.5"
                                                >
                                                    <option>GPT-4 Turbo</option>
                                                    <option>Claude 3 Opus</option>
                                                    <option>Gemini 1.5 Pro</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Creativity (Temperature)</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.1"
                                                        value={formData.temperature}
                                                        onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary"
                                                    />
                                                    <span className="font-mono text-sm w-8 text-gray-900 dark:text-white">{formData.temperature}</span>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lower values are more deterministic, higher values are more creative.</p>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="flex min-w-[180px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-11 px-6 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 disabled:opacity-70"
                                            >
                                                <span className="material-symbols-outlined text-xl">save</span>
                                                <span className="truncate">{saving ? "Saving..." : "Save Configuration"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'access' && (
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Public Link</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">Generate a unique link and QR code to provide public access to the equipment's AI agent.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                                        <div className="md:col-span-2 space-y-4">
                                            <div>
                                                <label className="font-semibold text-sm text-gray-900 dark:text-white">Unique Public Link</label>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={`https://app.equipmanager.com/public/${formData.publicLinkId}`}
                                                        readOnly
                                                        className="w-full flex-grow rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:border-primary focus:ring-primary px-4 py-2.5"
                                                    />
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(`https://app.equipmanager.com/public/${formData.publicLinkId}`)}
                                                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                                        title="Copy link"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">content_copy</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                <button
                                                    onClick={() => setFormData({ ...formData, publicLinkId: "eq-" + Math.random().toString(36).substring(2, 12) })}
                                                    className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-primary/20 dark:bg-primary/30 text-primary text-sm font-bold tracking-wide hover:bg-primary/30 dark:hover:bg-primary/40"
                                                >
                                                    <span className="material-symbols-outlined text-xl">refresh</span>
                                                    <span>Regenerate Link</span>
                                                </button>
                                                <button className="flex cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-10 px-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white text-sm font-bold tracking-wide hover:bg-gray-300 dark:hover:bg-gray-600">
                                                    <span className="material-symbols-outlined text-xl">download</span>
                                                    <span>Download QR Code</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="bg-white p-3 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                                                {/* Mock QR Code */}
                                                <img
                                                    alt="QR code"
                                                    className="h-32 w-32"
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5CrheVVBObA7Z7Ys0U1Z8qR9rV9-46xgbehp2J4tTp8rY7VUZKuTbIBpj3TaFPF9WDddfvP5Zowzp5B-CH_WS_IS18z0DaGx6a-oE0OazaIoYYw8OY3Z7WGtAZgvgoVu91MuGdQe9tuF6WcphTTzWl-shSoT6YV1gZpM3i0KH1NAQ7UDJ3uHcteSfg6GcK9wo85jcQ3QiEe2bgmIKfAYhjIAeW6_9zh7nIOnit4hvKFdmuCumqEH5-X6DS9EzflRmFMa99mufMoaA"
                                                />
                                            </div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Scan to access the agent</p>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Permissions</h3>
                                        <p className="text-gray-500 dark:text-gray-400 mt-1">Control who can access this public link.</p>

                                        <div className="mt-4 space-y-4">
                                            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">Enable Public Access</h4>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Anyone with the link can interact with the agent.</p>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.isPublicAccessEnabled}
                                                        onChange={(e) => setFormData({ ...formData, isPublicAccessEnabled: e.target.checked })}
                                                        className="peer sr-only"
                                                    />
                                                    <div className="peer h-6 w-11 rounded-full bg-gray-200 dark:bg-gray-700 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/30"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex min-w-[180px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg h-11 px-6 bg-primary text-white text-sm font-bold tracking-wide hover:bg-primary/90 disabled:opacity-70"
                                        >
                                            <span className="material-symbols-outlined text-xl">save</span>
                                            <span className="truncate">{saving ? "Saving..." : "Save Configuration"}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {isDeleteModalOpen && <DeleteModal />}
        </main>
    );
}
