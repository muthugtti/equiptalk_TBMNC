"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
    DropAnimation,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Interfaces ---

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
    order?: number;
}

interface EquipmentNode extends Equipment {
    children: EquipmentNode[];
}

// --- Components ---

interface SortableNodeProps {
    node: EquipmentNode;
    level: number;
    expandedIds: Set<string>;
    toggleExpand: (id: string, e: React.MouseEvent) => void;
    getStatusColor: (status: string) => string;
    handleCreateChild: (id: string, e: React.MouseEvent) => void;
    router: any;
}

function SortableNode({
    node,
    level,
    expandedIds,
    toggleExpand,
    getStatusColor,
    handleCreateChild,
    router
}: SortableNodeProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: node.id,
        data: {
            type: 'Equipment',
            node,
            parentId: node.parentId // meaningful data for drag handlers
        }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        marginLeft: `${level * 24}px`,
        opacity: isDragging ? 0.4 : 1,
    };

    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    return (
        <div ref={setNodeRef} style={style} className="touch-none relative flex flex-col mb-1">
            <div
                className={`
                    group flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 
                    ${isDragging ? 'border-primary shadow-lg z-10' : 'hover:border-primary/50 shadow-sm'}
                    transition-all cursor-pointer
                `}
                onClick={() => router.push(`/dashboard/equipment/${node.id}`)}
                {...attributes}
                {...listeners}
            >
                <div className="flex items-center gap-4">
                    {/* Expand Toggle - Stop propagation to prevent drag */}
                    {hasChildren ? (
                        <button
                            onPointerDown={e => e.stopPropagation()}
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

                    {/* Icon */}
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
                        onPointerDown={e => e.stopPropagation()}
                        onClick={(e) => handleCreateChild(node.id, e)}
                        className="hidden group-hover:flex items-center gap-1 px-3 py-1.5 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 text-xs font-bold transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Child
                    </button>
                    <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 cursor-grab active:cursor-grabbing">drag_indicator</span>
                </div>
            </div>

            {/* Nested List */}
            {isExpanded && hasChildren && (
                <div className="mt-1">
                    <SortableContext
                        items={node.children.map(c => c.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {node.children.map(child => (
                            <SortableNode
                                key={child.id}
                                node={child}
                                level={level + 1}
                                expandedIds={expandedIds}
                                toggleExpand={toggleExpand}
                                getStatusColor={getStatusColor}
                                handleCreateChild={handleCreateChild}
                                router={router}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}


export default function EquipmentPage() {
    const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy");
    const [filter, setFilter] = useState<"ALL" | "OPERATIONAL" | "MAINTENANCE" | "DOWN">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);

    const router = useRouter();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require movement of 8px to start drag, preventing accidental drags on click
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        fetchEquipment();
    }, []);

    const fetchEquipment = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/equipment");
            const data = await res.json();
            if (data.equipment) {
                // Ensure order provided or default
                const eq = data.equipment.map((e: any) => ({ ...e, order: e.order || 0 }));
                setEquipmentList(eq);
            }
        } catch (error) {
            console.error("Failed to fetch equipment", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Data Processing ---

    // 1. Filter
    const filteredList = useMemo(() => {
        let filtered = equipmentList;
        if (filter !== 'ALL') {
            filtered = filtered.filter(i => i.status === filter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i =>
                i.name.toLowerCase().includes(q) ||
                i.model.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [equipmentList, filter, searchQuery]);

    // 2. Build Hierarchy
    // We memoize this to prevent expensive rebuilds unless data changes
    const hierarchyRoots = useMemo(() => {
        const itemMap = new Map<string, EquipmentNode>();
        const roots: EquipmentNode[] = [];

        // Sort by order first to ensure correct initial display
        const sortedItems = [...filteredList].sort((a, b) => (a.order || 0) - (b.order || 0));

        // Create nodes
        sortedItems.forEach(item => {
            itemMap.set(item.id, { ...item, children: [] });
        });

        // Link
        sortedItems.forEach(item => {
            const node = itemMap.get(item.id)!;
            if (item.parentId && itemMap.has(item.parentId)) {
                itemMap.get(item.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }, [filteredList]);


    // --- Actions ---

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) newExpanded.delete(id);
        else newExpanded.add(id);
        setExpandedIds(newExpanded);
    };

    const collapseAll = () => setExpandedIds(new Set());
    const expandAll = () => setExpandedIds(new Set(equipmentList.map(e => e.id)));

    const handleCreateChild = (parentId: string, e: React.MouseEvent) => {
        e.stopPropagation();
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

    // --- Drag & Drop Handlers ---

    function findItem(id: string, items: Equipment[]) {
        return items.find(i => i.id === id);
    }

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        // DragOver is primarily for visual cues or real-time list switching.
        // With our simple structure, we can defer most logic to DragEnd.
        // However, if we wanted to visually expand a node when hovering, we'd do it here.
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        // Perform optimistic update
        const newEquipmentList = [...equipmentList];
        const activeItemIndex = newEquipmentList.findIndex(i => i.id === activeId);
        const overItemIndex = newEquipmentList.findIndex(i => i.id === overId);

        if (activeItemIndex === -1 || overItemIndex === -1) return;

        const activeItem = newEquipmentList[activeItemIndex];
        const overItem = newEquipmentList[overItemIndex];

        // Logic 1: Reparenting vs Reordering
        // If sorting within the same context is handled by SortableContext,
        // dnd-kit gives us the `over` target.
        // If we drop ON another item, is it a reorder or a reparent?
        // In a flat list, it's reorder. In a tree, it's ambiguous.
        // We will assume:
        // - If `active` and `over` have SAME parent -> Reorder (swap orders)
        // - If `active` and `over` have DIFFERENT parent -> Reparent (change parentId of `active` to `over`'s parent)
        // WAIT: Re-parenting usually means making it a CHILD of `over`.
        // But SortableContext implies we are reordering the list `over` belongs to.

        // Simplifying Assumption for this iteration:
        // We only support reordering within the SAME parent group (siblings).
        // OR moving to a different parent group IF we drag to that group's list.
        // Since we are using recursive SortableContexts, `dnd-kit` will identify the container.

        // Actually, dnd-kit `arrayMove` works on indices.
        // If we move between lists (reparenting), we need to manually update `parentId`.

        // Let's check if the parentIds match.
        const sameParent = activeItem.parentId === overItem.parentId;

        if (sameParent) {
            // Reorder
            // We need to re-sort the SUBSET of items that share this parent
            // But globally, we can just swap orders if we maintain a global list? No, order is usually creating a sequence.
            // We will simply swap the `order` values of the items in the affected list (or shifting logic).
            // A better approach: 
            // 1. Get all siblings.
            // 2. Perform `arrayMove` on siblings.
            // 3. Update `order` for all siblings based on new index.

            const siblings = newEquipmentList.filter(e => e.parentId === activeItem.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const oldIndex = siblings.findIndex(e => e.id === activeId);
            const newIndex = siblings.findIndex(e => e.id === overId);

            const newSiblings = arrayMove(siblings, oldIndex, newIndex);

            // Update orders
            newSiblings.forEach((item, index) => {
                const original = newEquipmentList.find(e => e.id === item.id);
                if (original) original.order = index;
            });

            setEquipmentList(newEquipmentList);

            // Persist
            persistReorder(newSiblings.map(i => ({ id: i.id, order: i.order!, parentId: i.parentId })));
        } else {
            // Moved to a different list (Reparenting)
            // The `over` item belongs to a list. We are inserting `active` into that list, relative to `over`.
            // So `active`'s new parent becomes `over`'s parent.

            const newParentId = overItem.parentId;

            // Get target siblings (including the one we are moving to)
            const targetSiblings = newEquipmentList.filter(e => e.parentId === newParentId).sort((a, b) => (a.order || 0) - (b.order || 0));
            const targetIndex = targetSiblings.findIndex(e => e.id === overId);

            // Insert active item into targetSiblings at targetIndex
            // We can just update activeItem's parentId and execute the reorder logic.

            activeItem.parentId = newParentId;
            // Now it essentially SHOULD be in targetSiblings.
            // We need to place it correctly.
            // Re-fetch siblings with activeItem included
            const updatedSiblings = [...targetSiblings];
            updatedSiblings.splice(targetIndex, 0, activeItem); // simple insert

            // Update orders
            updatedSiblings.forEach((item, index) => {
                const original = newEquipmentList.find(e => e.id === item.id);
                if (original) original.order = index;
            });

            // We also need to remove it from old siblings list order logic? 
            // Strictly speaking, old siblings order is fine, or we can normalize it. 
            // For simplicity, we just save the new state of the MOVED item and its NEW siblings.

            setEquipmentList([...newEquipmentList]);
            persistReorder(updatedSiblings.map(i => ({ id: i.id, order: i.order!, parentId: i.parentId })));
        }
    };

    const persistReorder = async (items: { id: string, order: number, parentId?: string | null }[]) => {
        try {
            await fetch('/api/equipment/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
        } catch (error) {
            console.error("Failed to persist order", error);
        }
    };

    // Animation for Drop
    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    };

    // Find the active node for the DragOverlay
    const activeNode = activeId ? equipmentList.find(e => e.id === activeId) as EquipmentNode : null;
    const ActiveOverlayNode = activeNode ? (
        <div className="p-4 rounded-xl border border-primary bg-white dark:bg-gray-800 shadow-xl opacity-90 cursor-grabbing">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8"></div>
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500">
                    <span className="material-symbols-outlined">
                        {activeNode.type.toLowerCase().includes('factory') ? 'factory' :
                            activeNode.type.toLowerCase().includes('cell') ? 'grid_view' :
                                'precision_manufacturing'}
                    </span>
                </div>
                <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{activeNode.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{activeNode.type}</p>
                </div>
            </div>
        </div>
    ) : null;


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
                        {['ALL', 'OPERATIONAL', 'MAINTENANCE', 'DOWN'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`
                                    px-4 py-1.5 rounded-lg text-sm font-bold whitespace-nowrap transition-colors
                                    ${filter === f ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}
                                `}
                            >
                                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
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
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                            >
                                <div className="space-y-2">
                                    {hierarchyRoots.length > 0 ? (
                                        <SortableContext
                                            items={hierarchyRoots.map(r => r.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {hierarchyRoots.map(node => (
                                                <SortableNode
                                                    key={node.id}
                                                    node={node}
                                                    level={0}
                                                    expandedIds={expandedIds}
                                                    toggleExpand={toggleExpand}
                                                    getStatusColor={getStatusColor}
                                                    handleCreateChild={handleCreateChild}
                                                    router={router}
                                                />
                                            ))}
                                        </SortableContext>
                                    ) : (
                                        <p className="text-gray-500">No matching items configured in hierarchy.</p>
                                    )}
                                </div>
                                <DragOverlay dropAnimation={dropAnimation}>
                                    {ActiveOverlayNode}
                                </DragOverlay>
                            </DndContext>
                        ) : (
                            // Grid View (No Drag Support for now)
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
