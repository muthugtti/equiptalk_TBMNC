
import { NextRequest, NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";
import { getDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const { equipmentId, message, history } = await req.json();

        if (!equipmentId || !message) {
            return NextResponse.json({ error: "Missing equipmentId or message" }, { status: 400 });
        }

        // 1. Fetch Context
        const db = await getDb();
        const docsSnapshot = await db.collection('equipment_docs_text')
            .where('equipmentId', '==', equipmentId)
            .get();

        let context = "";
        if (!docsSnapshot.empty) {
            const contextParts = docsSnapshot.docs.map(doc => {
                const data = doc.data();
                return `--- Document: ${data.fileName} ---\n${data.text}\n--- End Document ---`;
            });
            context = contextParts.join("\n\n");
        }

        // 2. Construct Prompt
        const systemInstruction = `You are an expert technical assistant for the specific equipment identified by ID: ${equipmentId}.
        
        Your Goal: Answer the user's questions based ONLY on the provided Technical Documents below.
        
        Rules:
        - If the answer is found in the documents, provide a detailed and accurate response.
        - If the answer is NOT in the documents, say "I don't have information about that in the uploaded manuals."
        - Do not hallucinate or provide general knowledge unless it's basic physics/engineering principles to explain a concept found in the docs.
        - Be concise but helpful.

        Technical Documents:
        ${context ? context : "No documents available for this equipment."}
        `;

        // 3. Call Google Generative AI (using gemini.ts)
        const generativeModel = getGeminiModel(systemInstruction);

        // Convert simplified history to Gemini format
        const chatHistory = history ? history.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.message }]
        })) : [];

        const chat = generativeModel.startChat({
            history: chatHistory,
        });

        const initialResult = await chat.sendMessageStream(message);

        // 4. Stream Response with Function Calling Support
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();

                async function processStream(resultStream: any) {
                    let functionCall = null;

                    try {
                        for await (const chunk of resultStream.stream) {
                            const chunkText = chunk.text();
                            // Stream text to user immediately
                            if (chunkText) {
                                controller.enqueue(encoder.encode(chunkText));
                            }

                            // Check for function calls
                            const calls = chunk.functionCalls();
                            if (calls && calls.length > 0) {
                                functionCall = calls[0];
                            }
                        }
                    } catch (e) {
                        // Sometimes chunk.text() throws if it's purely a function call chunk, ignore safely
                    }

                    return functionCall;
                }

                try {
                    // Process initial response
                    const call = await processStream(initialResult);

                    if (call) {
                        if (call.name === "create_incident") {
                            console.log("Creating incident:", call.args);

                            // Write to Firestore
                            const db = await getDb();

                            // Fetch Equipment Name for schema compliance
                            const equipDoc = await db.collection("equipment").doc(equipmentId).get();
                            const equipmentName = equipDoc.exists ? equipDoc.data()?.name || "Unknown Equipment" : "Unknown Equipment";

                            const displayId = `INC-${Date.now()}`;

                            const incidentRef = await db.collection("incidents").add({
                                displayId,
                                equipmentId: equipmentId,
                                equipmentName: equipmentName,
                                issueDescription: `${call.args.title}: ${call.args.description}`,
                                priority: call.args.priority?.toLowerCase() || "medium",
                                status: "open",
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                                source: "AI_CHAT"
                            });

                            // Send confirmation back to model
                            const functionResponse = {
                                functionResponse: {
                                    name: "create_incident",
                                    response: { name: "create_incident", content: { success: true, incidentId: incidentRef.id } }
                                }
                            };

                            const secondResult = await chat.sendMessageStream([functionResponse]);
                            await processStream(secondResult);
                        }
                    }

                    controller.close();
                } catch (err) {
                    console.error("Stream Error:", err);
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
        console.error("Chat API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
