import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getEmbedding } from "@/lib/gemini";
import { invalidateCachedAnswer, recordNegativeExample } from "@/lib/semantic-cache";
import { getPublicEquipment, isValidLinkId } from "@/lib/public-equipment";

// POST /api/chat-feedback — record a thumbs up / down / report on a bot answer.
// Feedback is the raw signal for analytics AND the learning loop: a down/report
// removes the bad answer from the semantic cache and stores it as a negative
// example so future similar questions steer away from it.
const FEEDBACK_RATE_LIMIT = { maxAttempts: 60, windowMs: 5 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };
const VALID_RATINGS = ["up", "down", "report"] as const;
type Rating = (typeof VALID_RATINGS)[number];

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rl = await checkRateLimit(`chat-feedback:${auth.uid}`, true, FEEDBACK_RATE_LIMIT);
    if (!rl.allowed) {
        return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    try {
        const body = await req.json();
        const rating = body.rating as Rating;
        const question = typeof body.question === "string" ? body.question.slice(0, 2000) : "";
        const answer = typeof body.answer === "string" ? body.answer.slice(0, 8000) : "";
        const comment = typeof body.comment === "string" ? body.comment.slice(0, 1000) : "";

        // Callers identify the equipment either directly (authenticated chat) or
        // by its public link token (QR chat) — resolve the latter to an id.
        let equipmentId = typeof body.equipmentId === "string" ? body.equipmentId : "";
        if (!equipmentId && isValidLinkId(body.linkId)) {
            const eq = await getPublicEquipment(body.linkId);
            if (!eq) {
                return NextResponse.json({ error: "This equipment link is not available." }, { status: 404 });
            }
            equipmentId = eq.id;
        }

        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(equipmentId)) {
            return NextResponse.json({ error: "Invalid equipmentId" }, { status: 400 });
        }
        if (!VALID_RATINGS.includes(rating)) {
            return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
        }
        if (!answer) {
            return NextResponse.json({ error: "Missing answer" }, { status: 400 });
        }

        const db = await getDb();
        await db.collection("chat_feedback").add({
            equipmentId,
            userId: auth.uid,
            rating,
            question,
            answer,
            comment,
            createdAt: new Date().toISOString(),
        });

        // Learning: only negative signals affect what the bot does next.
        if (rating === "down" || rating === "report") {
            try {
                const embedding = await getEmbedding(question || answer);
                if (embedding.length > 0) {
                    await Promise.all([
                        invalidateCachedAnswer(equipmentId, embedding),
                        recordNegativeExample(equipmentId, embedding, question, answer),
                    ]);
                }
            } catch (e: any) {
                // Best-effort — never fail the feedback write over the learning step.
                console.error("[ChatFeedback] Learning step failed:", e?.message);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error("[ChatFeedback] Error:", error?.message);
        return NextResponse.json({ error: "Failed to record feedback" }, { status: 500 });
    }
}
