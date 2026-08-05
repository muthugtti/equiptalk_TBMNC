import { NextRequest, NextResponse } from "next/server";
import { Type } from "@google/genai";
import { ai } from "@/lib/gemini";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Generating questions is a Gemini call, so cap abuse. It's usually a cache hit,
// so this limit only bites when a user repeatedly opens chats for freshly
// re-uploaded equipment.
const SUGGEST_RATE_LIMIT = { maxAttempts: 40, windowMs: 15 * 60 * 1000, lockoutMs: 2 * 60 * 1000 };

// How many chunks to sample as source material for the prompt, and how much
// total text to feed Gemini. Kept small — three questions don't need the whole
// manual, and a bounded prompt keeps latency and cost low.
const SAMPLE_CHUNKS = 20;
const MAX_CONTEXT_CHARS = 6000;

export async function GET(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimit = await checkRateLimit(`suggest:${auth.uid}`, true, SUGGEST_RATE_LIMIT);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
        return NextResponse.json(
            { error: "Too many requests. Please slow down." },
            { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
    }

    try {
        const equipmentId = req.nextUrl.searchParams.get("equipmentId") ?? "";

        if (!equipmentId || !/^[a-zA-Z0-9_-]{1,128}$/.test(equipmentId)) {
            return NextResponse.json({ error: "Invalid equipmentId" }, { status: 400 });
        }

        const db = await getDb();

        // Ownership scoping — identical to the chat route: a user may only read
        // suggestions for their OWN equipment. Return 404 (not 403) so foreign
        // ids are indistinguishable from non-existent ones.
        const equipSnap = await db.collection("equipment").doc(equipmentId).get();
        if (!equipSnap.exists || equipSnap.data()?.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }
        const equip = equipSnap.data() ?? {};

        // How many chunks exist for this equipment. Doubles as a cheap cache key:
        // if the count hasn't changed since we last generated, the uploaded docs
        // haven't meaningfully changed, so we can reuse the cached questions.
        const countSnap = await db.collection("equipment_doc_chunks")
            .where("equipmentId", "==", equipmentId)
            .count()
            .get();
        const chunkCount = countSnap.data().count;

        // No documents uploaded yet → no document-specific questions to offer.
        // The client falls back to its generic starter prompts.
        if (chunkCount === 0) {
            return NextResponse.json({ questions: [], source: "none" });
        }

        // Cache hit: same doc corpus as when we last generated.
        if (
            Array.isArray(equip.suggestedQuestions) &&
            equip.suggestedQuestions.length > 0 &&
            equip.suggestedQuestionsChunkCount === chunkCount
        ) {
            return NextResponse.json({ questions: equip.suggestedQuestions, source: "cache" });
        }

        // Sample chunk text as source material. No orderBy so we don't require a
        // composite index; a representative sample is enough to seed 3 questions.
        const chunksSnap = await db.collection("equipment_doc_chunks")
            .where("equipmentId", "==", equipmentId)
            .select("text")
            .limit(SAMPLE_CHUNKS)
            .get();

        const context = chunksSnap.docs
            .map(d => (d.data().text as string) ?? "")
            .filter(Boolean)
            .join("\n\n")
            .slice(0, MAX_CONTEXT_CHARS);

        if (!context.trim()) {
            return NextResponse.json({ questions: [], source: "none" });
        }

        const equipmentLabel = (equip.name as string) || `equipment ${equipmentId}`;

        const prompt = `You are helping a technician who is about to chat with an AI assistant about "${equipmentLabel}". Below are excerpts from the documents that were uploaded for this equipment.

Write exactly 3 short, natural questions the technician is most likely to ask, based ONLY on what these excerpts actually cover. Rules:
- Each question must be answerable from the documents below — do not invent topics that aren't present.
- Keep each question under 12 words, specific and practical.
- Vary the topics (e.g. procedures, specs, safety, troubleshooting) when the documents support it.
- Do not number them or add any extra text.

Document excerpts:
${context}`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.4,
                // gemini-2.5-flash is a thinking model: reasoning tokens draw from
                // maxOutputTokens. Disable thinking (this task doesn't need it) and
                // keep generous headroom so the JSON is never truncated — a too-low
                // budget returns a cut-off, unparseable string.
                thinkingConfig: { thinkingBudget: 0 },
                maxOutputTokens: 1024,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    minItems: "3",
                    maxItems: "3",
                },
            },
        });

        let questions: string[] = [];
        try {
            const parsed = JSON.parse(result.text ?? "[]");
            if (Array.isArray(parsed)) {
                questions = parsed
                    .filter((q): q is string => typeof q === "string")
                    .map(q => q.trim())
                    .filter(Boolean)
                    .slice(0, 3);
            }
        } catch (parseErr) {
            console.error("[Suggested] Failed to parse model output:", parseErr);
        }

        // If the model returned nothing usable, don't cache — let the client fall
        // back to generic prompts and try again next time.
        if (questions.length === 0) {
            return NextResponse.json({ questions: [], source: "none" });
        }

        // Cache on the equipment doc so repeat chat opens don't re-hit Gemini until
        // the document corpus changes (chunk count differs).
        db.collection("equipment").doc(equipmentId).set(
            { suggestedQuestions: questions, suggestedQuestionsChunkCount: chunkCount },
            { merge: true }
        ).catch(e => console.error("[Suggested] Cache write failed:", e));

        return NextResponse.json({ questions, source: "generated" });
    } catch (error: any) {
        console.error("[Suggested] Error:", error);
        return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
    }
}
