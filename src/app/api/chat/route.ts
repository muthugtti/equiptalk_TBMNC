
import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel, getEmbedding, cosineSimilarity, buildSystemInstruction } from "@/lib/gemini";
import { getDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkSemanticCache, storeSemanticCache } from "@/lib/semantic-cache";

const TOP_K = 5;
const CHAT_RATE_LIMIT = { maxAttempts: 30, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 };

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelayMs = 1500): Promise<T> {
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const isTransient = /"code":\s*(503|429)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(msg);
            if (!isTransient || attempt >= retries) throw err;
            await new Promise(r => setTimeout(r, baseDelayMs * (attempt + 1)));
        }
    }
}

export async function POST(req: NextRequest) {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const rateLimitKey = `chat:${auth.uid}`;
    const rateLimit = await checkRateLimit(rateLimitKey, true, CHAT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
        return NextResponse.json(
            { error: "Too many requests. Please slow down." },
            { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
    }

    try {
        const { equipmentId, message, history } = await req.json();

        if (!equipmentId || typeof equipmentId !== "string" || !message || typeof message !== "string") {
            return NextResponse.json({ error: "Missing equipmentId or message" }, { status: 400 });
        }

        // Validate equipmentId format to prevent prompt injection via interpolation
        // into the system instruction (see line ~118 below).
        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(equipmentId)) {
            return NextResponse.json({ error: "Invalid equipmentId" }, { status: 400 });
        }

        const db = await getDb();

        // Load the equipment's agent configuration (persona, response style,
        // custom instructions, temperature) so the assistant behaves the way
        // the owner configured it in the Agent Configuration tab.
        const equipSnap = await db.collection("equipment").doc(equipmentId).get();

        // Ownership scoping: a user may only chat against their OWN equipment.
        // Without this, any authenticated account could pass a foreign equipmentId
        // and exfiltrate that equipment's RAG document chunks, agent config, and
        // create incidents / analytics against it. Return 404 (not 403) so foreign
        // ids are indistinguishable from non-existent ones, matching
        // GET /api/equipment/[id]. Legacy records without createdBy are treated as
        // not-owned (strict scoping), consistent with isEquipmentOwnedBy().
        if (!equipSnap.exists || equipSnap.data()?.createdBy !== auth.uid) {
            return NextResponse.json({ error: "Equipment not found" }, { status: 404 });
        }
        const equip = equipSnap.data() ?? {};

        db.collection("chat_analytics").add({
            equipmentId,
            userId: auth.uid,
            question: message.trim(),
            questionNormalized: message.trim().toLowerCase().replace(/\s+/g, " "),
            timestamp: new Date().toISOString(),
        }).catch((e: any) => console.error("[Chat] Analytics log failed:", e.message));

        // 1. Embed query once — reused for both semantic cache lookup and RAG retrieval
        let queryEmbedding: number[] = [];
        try {
            queryEmbedding = await getEmbedding(message);
        } catch (embErr) {
            console.error("[Chat] Embedding failed:", embErr);
        }

        // 2. Check semantic cache — skip full RAG + Gemini if we have a similar answer
        if (queryEmbedding.length > 0) {
            const cached = await checkSemanticCache(equipmentId, queryEmbedding);
            if (cached) {
                return new NextResponse(cached, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'X-RAG-Mode': 'cache-hit',
                        'X-Cache': 'HIT',
                    },
                });
            }
        }

        // 3. RAG: find the most relevant chunks using the embedding we already have
        let context = "";
        let sourceFiles: string[] = [];
        let ragMode = "none";
        try {
            if (queryEmbedding.length > 0) {
                const chunksSnap = await db.collection('equipment_doc_chunks')
                    .where('equipmentId', '==', equipmentId)
                    .get();

                if (!chunksSnap.empty) {
                    const scored = chunksSnap.docs.map(doc => {
                        const data = doc.data();
                        const sim = cosineSimilarity(queryEmbedding, data.embedding as number[]);
                        return { text: data.text as string, fileName: data.fileName as string, sim };
                    });

                    scored.sort((a, b) => b.sim - a.sim);
                    const topK = scored.slice(0, TOP_K);
                    context = topK.map(c => `[${c.fileName}]\n${c.text}`).join("\n\n---\n\n");
                    sourceFiles = [...new Set(topK.map(c => c.fileName))];
                    ragMode = `chunks:${chunksSnap.size}`;
                } else {
                    const docsSnap = await db.collection('equipment_docs_text')
                        .where('equipmentId', '==', equipmentId)
                        .get();
                    if (!docsSnap.empty) {
                        context = docsSnap.docs
                            .map(d => `[${d.data().fileName}]\n${(d.data().text as string).slice(0, 3000)}`)
                            .join("\n\n---\n\n");
                        sourceFiles = docsSnap.docs.map(d => d.data().fileName as string);
                        ragMode = "fallback-fulltext";
                    }
                }
            }
        } catch (ragErr) {
            console.error("[Chat] RAG retrieval failed, continuing without context:", ragErr);
            ragMode = "error";
        }

        // 4. Build system prompt with retrieved context + per-equipment config
        const systemInstruction = buildSystemInstruction({
            equipmentLabel: (equip.name as string) || `equipment ${equipmentId}`,
            context,
            persona: equip.persona as string | undefined,
            responseStyle: equip.responseStyle as string | undefined,
            customInstructions: equip.customInstructions as string | undefined,
        });

        // 5. Build chat history
        const chatHistory = (history ?? []).map((msg: { role: string; message: string }) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }],
        }));

        const chat = getGeminiModel(systemInstruction, chatHistory, {
            temperature: typeof equip.temperature === "number" ? equip.temperature : undefined,
        });

        // 6. Stream response, collect for caching, handle create_incident function call
        let collectedResponse = '';
        let hadFunctionCall = false;

        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                async function processStream(resultStream: AsyncIterable<any>) {
                    let functionCall: { name: string; args: Record<string, string> } | null = null;
                    for await (const chunk of resultStream) {
                        if (chunk.text) {
                            controller.enqueue(encoder.encode(chunk.text));
                            collectedResponse += chunk.text;
                        }
                        const calls = chunk.functionCalls;
                        if (calls?.length) {
                            functionCall = { name: calls[0].name, args: calls[0].args };
                        }
                    }
                    return functionCall;
                }

                try {
                    const initialStream = await withRetry(() => chat.sendMessageStream({ message }));
                    const call = await processStream(initialStream);

                    if (call?.name === "create_incident") {
                        hadFunctionCall = true;
                        const equipmentName = (equip.name as string) ?? "Unknown Equipment";
                        const incidentRef = await db.collection("incidents").add({
                            displayId: `INC-${Date.now()}`,
                            equipmentId,
                            equipmentName,
                            issueDescription: `${call.args.title}: ${call.args.description}`,
                            priority: call.args.priority?.toLowerCase() ?? "medium",
                            status: "open",
                            source: "AI_CHAT",
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        });

                        const followUp = await withRetry(() => chat.sendMessageStream({
                            message: [{
                                functionResponse: {
                                    name: "create_incident",
                                    response: { success: true, incidentId: incidentRef.id },
                                },
                            }],
                        }));
                        await processStream(followUp);
                    }

                    if (sourceFiles.length > 0) {
                        const footer = `\n\n---\n**Sources**\n${sourceFiles.map(f => `- 📄 ${f}`).join("\n")}`;
                        controller.enqueue(encoder.encode(footer));
                        collectedResponse += footer;
                    }

                    // Store in semantic cache — skip if an incident was created to avoid
                    // replaying stale incident IDs on future cache hits
                    if (!hadFunctionCall && queryEmbedding.length > 0 && collectedResponse) {
                        storeSemanticCache(equipmentId, queryEmbedding, message, collectedResponse)
                            .catch(e => console.error("[Chat] Cache store failed:", e));
                    }

                    controller.close();
                } catch (err) {
                    console.error("[Chat] Stream error:", err);
                    const msg = err instanceof Error ? err.message : String(err);
                    const isTransient = /"code":\s*(503|429)|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(msg);
                    const friendly = isTransient
                        ? "The AI service is temporarily overloaded. Please try again in a moment."
                        : "Something went wrong. Please try again.";
                    controller.enqueue(encoder.encode(`\n\n_${friendly}_`));
                    controller.close();
                }
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-RAG-Mode': ragMode,
                'X-Cache': 'MISS',
            },
        });

    } catch (error: any) {
        console.error("[Chat] Error:", error);
        return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 });
    }
}
