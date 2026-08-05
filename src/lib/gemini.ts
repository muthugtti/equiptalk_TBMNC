
import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";

const apiKey = process.env.GOOGLE_AI_API_KEY ?? process.env.GEMINI_API_KEY ?? '';

if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY not set. AI features will fail. Add it to .env.local');
}

export const ai = new GoogleGenAI({ apiKey });

export async function getEmbedding(text: string): Promise<number[]> {
    const result = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: [text.slice(0, 10000)],
    });
    return result.embeddings?.[0]?.values ?? [];
}

/**
 * Embed many texts in a single API call. `gemini-embedding-001` accepts a batch
 * of `contents` and returns one embedding per input, in order.
 *
 * This is ~50x faster than calling getEmbedding() per chunk: embedding a large
 * manual one-chunk-at-a-time (with pacing) can exceed the 60s Cloud Run/Hosting
 * request timeout and crash the upload. Batching keeps ingestion well within
 * budget. Callers should page in groups of <= EMBED_BATCH_SIZE.
 */
export const EMBED_BATCH_SIZE = 50;

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const result = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: texts.map((t) => t.slice(0, 10000)),
    });
    const embeddings = result.embeddings ?? [];
    // Map back to plain number[][], preserving input order and length.
    return texts.map((_, i) => embeddings[i]?.values ?? []);
}

export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
        if (i + overlap >= text.length) break;
    }
    if (chunks.length === 0 || text.slice(chunks[chunks.length - 1].length) !== '') {
        const last = text.slice(Math.max(0, text.length - chunkSize));
        if (chunks.length === 0 || chunks[chunks.length - 1] !== last) chunks.push(last);
    }
    return chunks.filter(c => c.trim().length > 0);
}

export function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const incidentFunctionDeclaration = {
    name: "create_incident",
    description: "Create a maintenance ticket/incident for this equipment. Call this whenever the user reports a fault, defect, or problem that needs fixing, OR explicitly asks to raise, open, log, file, or create a ticket / incident / issue / maintenance request (e.g. 'raise a ticket', 'log an issue', 'report a problem'). Prefer calling this tool over just replying in text when the user asks for a ticket.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Short summary of the issue (e.g., 'Engine Overheating', 'Safety Guard Loose')." },
            description: { type: Type.STRING, description: "Detailed description of the problem based on user's input." },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"], description: "Assess priority based on safety and urgency. Default to 'Medium'." },
        },
        required: ["title", "description", "priority"],
    },
};

export const getGeminiModel = (
    systemInstruction?: string,
    history?: Array<{ role: string; parts: Array<{ text: string }> }>,
    options?: { temperature?: number }
) => {
    // Clamp to a sane range; fall back to 0.7 when the equipment has no setting.
    const rawTemp = options?.temperature;
    const temperature = typeof rawTemp === "number" && rawTemp >= 0 && rawTemp <= 2
        ? rawTemp
        : 0.7;
    return ai.chats.create({
        model: "gemini-2.5-flash",
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: [incidentFunctionDeclaration] }],
            toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
            maxOutputTokens: 8192,
            temperature,
            topP: 0.95,
        },
        history: history ?? [],
    });
};

/**
 * Strip the auto-appended "Sources" footer (and any duplicate copies) from an
 * assistant message. The chat routes append a "---\n**Sources**…" block to every
 * answer; that block is streamed to the client and echoed back as conversation
 * history on the next turn. If left in the history, the model imitates it and
 * writes its own Sources block, which the code then duplicates — producing two
 * footers. Strip it from history so the model never sees a footer to copy.
 *
 * Anchored to the first "---\n**Sources**" marker through end-of-string, so it
 * removes one or many stacked footers in a single pass.
 */
export function stripSourcesFooter(text: string): string {
    return text.replace(/\n*---\n\*\*Sources\*\*[\s\S]*$/, "").trimEnd();
}

/**
 * Build the RAG chat system prompt, folding in the per-equipment agent config
 * (persona, response style, custom instructions). Shared by the authenticated
 * chat route and the public (QR) chat route so both behave identically.
 */
export function buildSystemInstruction(opts: {
    equipmentLabel: string;
    context: string;
    persona?: string;
    responseStyle?: string;
    customInstructions?: string;
    /** Past answers users marked unhelpful for similar questions — the model is
     *  told to avoid repeating them. Sourced from feedback (see chat-feedback). */
    negativeExamples?: Array<{ question: string; answer: string }>;
}): string {
    const { equipmentLabel, context, persona, responseStyle, customInstructions, negativeExamples } = opts;
    const personaLine = persona ? `You are acting as: ${persona}. ` : "";
    const styleLine = responseStyle ? `Preferred response style: ${responseStyle}. ` : "";
    const customBlock = customInstructions?.trim()
        ? `\n\nAdditional instructions from the equipment owner (follow these unless they conflict with the rules above):\n${customInstructions.trim()}`
        : "";
    const negativeBlock = negativeExamples && negativeExamples.length > 0
        ? `\n\nLearn from past feedback: users marked the following answers as unhelpful for similar questions. Do NOT repeat these mistakes — take a different, more accurate or more useful approach:\n` +
          negativeExamples
              .map((ex, i) => `${i + 1}. Question: "${ex.question}"\n   Unhelpful answer to avoid: "${ex.answer}"`)
              .join("\n")
        : "";

    return `You are an expert technical assistant for ${equipmentLabel}.
${personaLine}${styleLine}

Answer questions using ONLY the provided context excerpts below.
- If the answer is in the context, give a detailed, accurate response.
- If the answer is NOT in the context, say "I don't have information about that in the uploaded documents."
- Never hallucinate facts. You may use basic engineering principles to clarify concepts found in the docs.
- Format responses in Markdown: use headings, bullet/numbered lists, and **bold** for key terms or values. Use tables when presenting structured/comparative data, and code blocks for any part numbers, commands, or settings.
- Do NOT cite sources inline (no "(Source: filename)"), and do NOT add a "Sources" or "References" section — the list of source documents is appended automatically after your answer, so any citation you write would be a duplicate.

Raising tickets (separate from answering questions): if the user reports a fault or defect, or explicitly asks to raise/open/log/create a ticket or incident, call the create_incident tool. Provide a short title, a clear description of the problem drawn from what the user told you, and a priority (Low/Medium/High/Critical) based on safety and urgency. You may raise a ticket even for a problem that is not covered by the documents — this is not bound by the context-only rule above. If key details are missing you may ask one brief clarifying question first, but do not refuse a direct request to raise a ticket. After the ticket is created, confirm it to the user in one short sentence.${customBlock}${negativeBlock}

Context:
${context || "No documents have been uploaded for this equipment yet."}`;
}
