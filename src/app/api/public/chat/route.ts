import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel, getEmbedding, cosineSimilarity, buildSystemInstruction } from "@/lib/gemini";
import { getDb } from "@/lib/firebase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkSemanticCache, storeSemanticCache } from "@/lib/semantic-cache";
import { getPublicEquipment, isValidLinkId } from "@/lib/public-equipment";

const TOP_K = 5;
// Unauthenticated + hits Gemini on every call, so keep this tighter than the
// authenticated chat limit. Keyed by IP.
const PUBLIC_CHAT_RATE_LIMIT = { maxAttempts: 30, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 };

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
    const ip = getClientIp(req);
    const rateLimit = await checkRateLimit(`public-chat:${ip}`, true, PUBLIC_CHAT_RATE_LIMIT);
    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000);
        return NextResponse.json(
            { error: "Too many requests. Please slow down." },
            { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
        );
    }

    try {
        const { linkId, message, history } = await req.json();

        if (!isValidLinkId(linkId) || !message || typeof message !== "string") {
            return NextResponse.json({ error: "Missing or invalid linkId or message" }, { status: 400 });
        }

        // Authorize: resolve the equipment by its public token. 404 if the
        // token is unknown or public access is not enabled.
        const eq = await getPublicEquipment(linkId);
        if (!eq) {
            return NextResponse.json({ error: "This equipment link is not available." }, { status: 404 });
        }
        const equipmentId = eq.id;
        const equip = eq.data;

        const db = await getDb();

        db.collection("chat_analytics").add({
            equipmentId,
            userId: "public",
            question: message.trim(),
            questionNormalized: message.trim().toLowerCase().replace(/\s+/g, " "),
            timestamp: new Date().toISOString(),
        }).catch((e: any) => console.error("[PublicChat] Analytics log failed:", e.message));

        // 1. Embed query once — reused for cache lookup and RAG retrieval
        let queryEmbedding: number[] = [];
        try {
            queryEmbedding = await getEmbedding(message);
        } catch (embErr) {
            console.error("[PublicChat] Embedding failed:", embErr);
        }

        // 2. Semantic cache — shares the equipment's namespace with authed chat
        if (queryEmbedding.length > 0) {
            const cached = await checkSemanticCache(equipmentId, queryEmbedding);
            if (cached) {
                return new NextResponse(cached, {
                    headers: {
                        "Content-Type": "text/plain; charset=utf-8",
                        "X-RAG-Mode": "cache-hit",
                        "X-Cache": "HIT",
                    },
                });
            }
        }

        // 3. RAG retrieval
        let context = "";
        let sourceFiles: string[] = [];
        let ragMode = "none";
        try {
            if (queryEmbedding.length > 0) {
                const chunksSnap = await db.collection("equipment_doc_chunks")
                    .where("equipmentId", "==", equipmentId)
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
                    const docsSnap = await db.collection("equipment_docs_text")
                        .where("equipmentId", "==", equipmentId)
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
            console.error("[PublicChat] RAG retrieval failed, continuing without context:", ragErr);
            ragMode = "error";
        }

        // 4. System prompt from the equipment's agent configuration
        const systemInstruction = buildSystemInstruction({
            equipmentLabel: (equip.name as string) || "this equipment",
            context,
            persona: equip.persona as string | undefined,
            responseStyle: equip.responseStyle as string | undefined,
            customInstructions: equip.customInstructions as string | undefined,
        });

        const chatHistory = (history ?? []).map((msg: { role: string; message: string }) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.message }],
        }));

        const chat = getGeminiModel(systemInstruction, chatHistory, {
            temperature: typeof equip.temperature === "number" ? equip.temperature : undefined,
        });

        let collectedResponse = "";
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
                        const incidentRef = await db.collection("incidents").add({
                            displayId: `INC-${Date.now()}`,
                            equipmentId,
                            equipmentName: (equip.name as string) ?? "Unknown Equipment",
                            issueDescription: `${call.args.title}: ${call.args.description}`,
                            priority: call.args.priority?.toLowerCase() ?? "medium",
                            status: "open",
                            // Reported by an anonymous technician via the public QR link.
                            source: "AI_CHAT_PUBLIC",
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

                    if (!hadFunctionCall && queryEmbedding.length > 0 && collectedResponse) {
                        storeSemanticCache(equipmentId, queryEmbedding, message, collectedResponse)
                            .catch(e => console.error("[PublicChat] Cache store failed:", e));
                    }

                    controller.close();
                } catch (err) {
                    console.error("[PublicChat] Stream error:", err);
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
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked",
                "X-RAG-Mode": ragMode,
                "X-Cache": "MISS",
            },
        });
    } catch (error: any) {
        console.error("[PublicChat] Error:", error);
        return NextResponse.json({ error: "Failed to process chat message" }, { status: 500 });
    }
}
