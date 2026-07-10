import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth, isEquipmentOwnedBy } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const db = await getDb();
        const { searchParams } = new URL(req.url);
        const equipmentId = searchParams.get("equipmentId") || null;

        // When an equipmentId filter is supplied, confirm the caller owns it
        // before exposing any analytics for that equipment.
        if (equipmentId && !(await isEquipmentOwnedBy(equipmentId, auth.uid))) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Scope the ENTIRE aggregation to the authenticated account. Filter by
        // userId only (no composite index needed) and sort/slice in memory.
        // NOTE: legacy analytics rows without a `userId` field are excluded.
        const snap = await db
            .collection("chat_analytics")
            .where("userId", "==", auth.uid)
            .get();

        let rows = snap.docs
            .map(d => d.data() as {
                equipmentId: string;
                question: string;
                questionNormalized: string;
                timestamp: string;
                userId?: string;
            })
            .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));

        // Optional per-equipment filter (already ownership-verified above).
        if (equipmentId) {
            rows = rows.filter(r => r.equipmentId === equipmentId);
        }

        // Optional time-range filter (7d / 30d / 90d / all). Timestamps are ISO
        // strings, so a lexicographic >= comparison against an ISO cutoff is
        // correct. "all" (or any unknown value) means lifetime — no filtering.
        const range = searchParams.get("range") || "all";
        const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
        const days = RANGE_DAYS[range];
        if (days) {
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
            rows = rows.filter(r => String(r.timestamp ?? "") >= cutoff);
        }

        rows = rows.slice(0, 1000);

        // Frequency map — scoped to this account only (rows are already filtered by userId).
        const freq = new Map<string, { question: string; count: number; equipmentIds: Set<string> }>();
        for (const row of rows) {
            const key = row.questionNormalized;
            const existing = freq.get(key);
            if (existing) {
                existing.count++;
                existing.equipmentIds.add(row.equipmentId);
            } else {
                freq.set(key, { question: row.question, count: 1, equipmentIds: new Set([row.equipmentId]) });
            }
        }

        const topQuestions = [...freq.values()]
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map(q => ({
                question: q.question,
                count: q.count,
                equipmentCount: q.equipmentIds.size,
                equipmentIds: [...q.equipmentIds],
            }));

        const byEquipment = new Map<string, number>();
        for (const row of rows) {
            byEquipment.set(row.equipmentId, (byEquipment.get(row.equipmentId) ?? 0) + 1);
        }
        const equipmentBreakdown = [...byEquipment.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, count]) => ({ equipmentId: id, count }));

        // Rows are already scoped to this account (userId === auth.uid).
        const recentRows = rows.slice(0, 50);

        return NextResponse.json({
            total: rows.length,
            unique: freq.size,
            topQuestions,
            recent: recentRows,
            equipmentBreakdown,
        });
    } catch (error: any) {
        console.error("[Analytics] Error:", error);
        return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
    }
}
