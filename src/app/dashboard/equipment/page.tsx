"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Equipment {
    id: string;
    name: string;
    type: string;
    model: string;
    serialNumber: string;
    status: string;
    organizationId: string;
    slug: string;
    updatedAt: string;
    parentId?: string | null;
}

interface EquipmentNode extends Equipment {
    children: EquipmentNode[];
    isExpanded?: boolean;
}

export default function EquipmentPage() {
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy");
    const [filter, setFilter] = useState<"all" | "active" | "maintenance" | "down">("all");
    const [searchQuery, setSearchQuery] = useState("");

    // For hierarchy state
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const router = useRouter();

    useEffect(() => {
        fetchEquipment();
    }, []);

    const fetchEquipment = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/equipment");
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

    const buildHierarchy = (items: Equipment[]): EquipmentNode[] => {
        const itemMap = new Map<string, EquipmentNode>();
        const roots: EquipmentNode[] = [];

        // First pass: create nodes
        items.forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
        });

        // Second pass: link parents
        items.forEach(item => {
            const node = itemMap.get(item.id)!;
            if (item.parentId && itemMap.has(item.parentId)) {
                itemMap.get(item.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    };

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const collapseAll = () => setExpandedIds(new Set());
    const expandAll = () => {
        const allIds = new Set(equipmentList.map(e => e.id));
        setExpandedIds(allIds);
    };

    const handleCreateChild = async (parentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        // Redirect to detail create page with parentId query param logic 
        // OR open a modal. For now let's just create a generic child for demo, 
        // effectively we should probably navigate to a create page.
        // But user asked for "Add Child" button.

        // Simple mock create for now or better, navigate to detail page with parentId
        router.push(`/dashboard/equipment/new?parentId=${parentId}`);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "OPERATIONAL": return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
            case "MAINTENANCE": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
            case "DOWN": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
            default: return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
        }
    };

    const filterItems = (items: Equipment[]) => {
        let filtered = items;

        if (filter !== 'all') {
            const mapFilter: Record<string, string> = {
                'active': 'OPERATIONAL',
                'maintenance': 'MAINTENANCE',
                'down': 'DOWN'
            };
            filtered = filtered.filter(i => i.status === mapFilter[filter]);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.model.toLowerCase().includes(q)
            );
        }

        return filtered;
    };

    const filteredList = filterItems(equipmentList);
    const hierarchyRoots = buildHierarchy(filteredList);

    const HierarchyNode = ({ node, level = 0 }: { node: EquipmentNode, level?: number }) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedIds.has(node.id);

        return (
            <div className={`relative flex flex-col`}>
                <div
                    className={`
                        group flex items-center justify-between p-4 my-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 
                        hover:border-primary/50 transition-all cursor-pointer shadow-sm
                    `}
                    style={{ marginLeft: `${level * 24}px` }}
                    onClick={() => router.push(`/dashboard/equipment/${node.id}`)}
                >
                    <div className="flex items-center gap-4">
                        {/* Expand Toggle */}
                        {hasChildren ? (
                            <button
                                onClick={(e) => toggleExpand(node.id, e)}
                                className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                            >
                                <span className="material-symbols-outlined">
                                    {isExpanded ? 'remove' : 'add'}
                                </span>
                            </button>
                        ) : (
                            <div className="w-8 h-8"></div>
                        )}

                        {/* Icon based on type (simple heuristic) */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500">
                            <span className="material-symbols-outlined">
                                {node.type.toLowerCase().includes('factory') ? 'factory' :
                                    node.type.toLowerCase().includes('cell') ? 'grid_view' :
                                        'precision_manufacturing'}
                            </span>
                        </div>

                        {/* Details */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">{node.name}</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{node.type} • {node.model || 'No Model'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${getStatusColor(node.status)}`}>
                            {node.status}
                        </span>

                        <button
                            onClick={(e) => handleCreateChild(node.id, e)}
                            className="hidden group-hover:flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 text-xs font-bold transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                            Add Child
                        </button>
                    </div>
                </div>

                {isExpanded && node.children.map(child => (
                    <div key={child.id} className="relative">
                        {/* Connector Lines could go here via CSS or SVG if needed for strict visual match */}
                        <HierarchyNode node={child} level={level + 1} />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <main className="flex-1 px-4 sm:px-6 md:px-10 py-8 bg-background-light dark:bg-background-dark min-h-screen">
            <div className="mx-auto max-w-7xl space-y-6">

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-[-0.033em]">My Equipment</h1>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center p-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <span className="material-symbols-outlined text-lg">grid_view</span>
                                Grid
                            </button>
                            <button
                                onClick={() => setViewMode("hierarchy")}
                                className={`px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold transition-colors ${viewMode === 'hierarchy' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <span className="material-symbols-outlined text-lg">account_tree</span>
                                Hierarchy
                            </button>
                        </div>
                        <Link
                            href="/dashboard/equipment/new"
                            className="flex h-10 items-center justify-center gap-x-2 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary/90 transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span>Add New Equipment</span>
                        </Link>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="relative flex-1 max-w-md">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400">search</span>
                        <input
                            type="text"
                            placeholder="Search by name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                        {['all', 'active', 'repair', 'decommissioned'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)} // Type loose for demo
                                className={`
                                    px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
                                    ${filter === f || (f === 'active' && filter === 'active') /* simplify logic */ ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}
                                `}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                {viewMode === 'hierarchy' && (
                    <div className="flex items-center gap-4 text-sm font-medium text-primary">
                        <button onClick={collapseAll} className="flex items-center gap-1 hover:underline">
                            <span className="material-symbols-outlined text-base">unfold_less</span>
                            Collapse All
                        </button>
                        <button onClick={expandAll} className="flex items-center gap-1 hover:underline">
                            <span className="material-symbols-outlined text-base">unfold_more</span>
                            Expand All
                        </button>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
                    </div>
                ) : equipmentList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <span className="material-symbols-outlined text-5xl mb-4">inventory_2</span>
                        <p>No equipment found.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {viewMode === 'hierarchy' ? (
                            <div className="space-y-2">
                                {hierarchyRoots.length > 0 ? (
                                    hierarchyRoots.map(node => <HierarchyNode key={node.id} node={node} />)
                                ) : (
                                    <p className="text-gray-500">No matching items configured in hierarchy.</p>
                                )}
                            </div>
                        ) : (
                            // Fallback Node-like grid or table
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredList.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => router.push(`/dashboard/equipment/${item.id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                                                <span className="material-symbols-outlined text-gray-500">precision_manufacturing</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">{item.name}</h3>
                                        <p className="text-xs text-gray-500">{item.type} • {item.serialNumber}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
}
