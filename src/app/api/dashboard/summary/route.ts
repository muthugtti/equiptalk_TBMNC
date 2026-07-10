import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const DASHBOARD_RATE_LIMIT = { maxAttempts: 100, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`dashboard:${auth.uid}`, true, DASHBOARD_RATE_LIMIT);
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many requests." }, {
            status: 429,
            headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)) },
        });
    }

    try {
        const db = await getDb();

        // All aggregates strictly scoped to the authenticated account via createdBy.
        // Sorting/filtering is done in memory to avoid composite index requirements.
        const [equipmentSnap, incidentsSnap, documentsSnap, chatSessionsSnap, analyticsSnap] =
            await Promise.all([
                db.collection("equipment").where("createdBy", "==", auth.uid).get(),
                db.collection("incidents").where("createdBy", "==", auth.uid).get(),
                db.collection("documents").where("createdBy", "==", auth.uid).get(),
                db.collection("users").doc(auth.uid).collection("chatSessions").get(),
                db.collection("chat_analytics").where("userId", "==", auth.uid).get(),
            ]);

        // --- Equipment ---
        let operational = 0;
        let down = 0;
        let needsAttention = 0;
        for (const doc of equipmentSnap.docs) {
            const status = String(doc.data()?.status ?? "").toUpperCase();
            if (status === "OPERATIONAL") {
                operational++;
            } else if (status === "DOWN" || status === "OFFLINE") {
                down++;
            } else {
                // MAINTENANCE and any other non-operational status.
                needsAttention++;
            }
        }

        // --- Incidents ---
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        let openCount = 0;
        let resolvedCount = 0;
        let last7Days = 0;

        const incidents = incidentsSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                displayId: String(data?.displayId ?? ""),
                equipmentName: String(data?.equipmentName ?? ""),
                issueDescription: String(data?.issueDescription ?? ""),
                status: String(data?.status ?? "open"),
                priority: String(data?.priority ?? "low"),
                createdAt: String(data?.createdAt ?? ""),
            };
        });

        for (const inc of incidents) {
            const status = inc.status.toLowerCase();
            if (status === "resolved" || status === "closed") {
                resolvedCount++;
            } else {
                openCount++;
            }
            const created = Date.parse(inc.createdAt);
            if (!Number.isNaN(created) && created >= sevenDaysAgo) {
                last7Days++;
            }
        }

        const recentIncidents = [...incidents]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 5);

        return NextResponse.json({
            equipment: {
                total: equipmentSnap.size,
                operational,
                needsAttention,
                down,
            },
            incidents: {
                total: incidentsSnap.size,
                open: openCount,
                resolved: resolvedCount,
                last7Days,
            },
            documents: {
                total: documentsSnap.size,
            },
            chats: {
                totalSessions: chatSessionsSnap.size,
                totalQuestions: analyticsSnap.size,
            },
            recentIncidents,
        });
    } catch (error: any) {
        console.error("[Dashboard summary] Error:", error);
        return NextResponse.json({ error: "Failed to fetch dashboard summary" }, { status: 500 });
    }
}
