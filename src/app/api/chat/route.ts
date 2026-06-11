
import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel, getEmbedding, cosineSimilarity } from "@/lib/gemini";
import { getDb } from "@/lib/firebase-admin";
import type { Part } from "@google-cloud/vertexai";

const TOP_K = 5;

export async function POST(req: NextRequest) {
    try {
        const { equipmentId, message, history } = await req.json();

        if (!equipmentId || !message) {
            return NextResponse.json({ error: "Missing equipmentId or message" }, { status: 400 });
        }

        const db = await getDb();

        // 1. RAG: embed the query and find the most relevant chunks
        let context = "";
        try {
            const queryEmbedding = await getEmbedding(message);
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
                context = scored
                    .slice(0, TOP_K)
                    .map(c => `[${c.fileName}]\n${c.text}`)
                    .join("\n\n---\n\n");
            } else {
                // Fallback: use full extracted text if no chunks exist (legacy docs)
                const docsSnap = await db.collection('equipment_docs_text')
                    .where('equipmentId', '==', equipmentId)
                    .get();
                if (!docsSnap.empty) {
                    context = docsSnap.docs
                        .map(d => `[${d.data().fileName}]\n${(d.data().text as string).slice(0, 3000)}`)
                        .join("\n\n---\n\n");
                }
            }
        } catch (ragErr) {
            console.error("[Chat] RAG retrieval failed, continuing without context:", ragErr);
        }

        // 2. Build system prompt with retrieved context
        const systemInstruction = `You are an expert technical assistant for equipment ID: ${equipmentId}.

Answer questions using ONLY the provided context excerpts below.
- If the answer is in the context, give a detailed, accurate response.
- If the answer is NOT in the context, say "I don't have information about that in the uploaded documents."
- Never hallucinate facts. You may use basic engineering principles to clarify concepts found in the docs.

Context:
${context || "No documents have been uploaded for this equipment yet."}`;

        // 3. Build chat history in Vertex AI format (Content[])
        const model = getGeminiModel(systemInstruction);
        const chatHistory = (history ?? []).map((msg: { role: string; message: string }) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }] as Part[],
        }));

        const chat = model.startChat({ history: chatHistory });

        // 4. Stream response, handle create_incident function call
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                async function processStream(resultStream: Awaited<ReturnType<typeof chat.sendMessageStream>>) {
                    let functionCall: { name: string; args: Record<string, string> } | null = null;
                    for await (const item of resultStream.stream) {
                        const parts = item.candidates?.[0]?.content?.parts ?? [];
                        for (const part of parts) {
                            if ('text' in part && part.text) {
                                controller.enqueue(encoder.encode(part.text));
                            }
                            if ('functionCall' in part && part.functionCall) {
                                functionCall = part.functionCall as { name: string; args: Record<string, string> };
                            }
                        }
                    }
                    return functionCall;
                }

                try {
                    const initialResult = await chat.sendMessageStream(message);
                    const call = await processStream(initialResult);

                    if (call?.name === "create_incident") {
                        const equipDoc = await db.collection("equipment").doc(equipmentId).get();
                        const equipmentName = equipDoc.data()?.name ?? "Unknown Equipment";
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

                        const followUp = await chat.sendMessageStream([{
                            functionResponse: {
                                name: "create_incident",
                                response: { success: true, incidentId: incidentRef.id },
                            },
                        } as Part]);
                        await processStream(followUp);
                    }

                    controller.close();
                } catch (err) {
                    console.error("[Chat] Stream error:", err);
                    controller.error(err);
                }
            },
        });

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });

    } catch (error: any) {
        console.error("[Chat] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
