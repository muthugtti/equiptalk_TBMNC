
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
    description: "Report a new maintenance issue, defect, or incident for this equipment. Use this when the user mentions a problem that needs fixing.",
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
}): string {
    const { equipmentLabel, context, persona, responseStyle, customInstructions } = opts;
    const personaLine = persona ? `You are acting as: ${persona}. ` : "";
    const styleLine = responseStyle ? `Preferred response style: ${responseStyle}. ` : "";
    const customBlock = customInstructions?.trim()
        ? `\n\nAdditional instructions from the equipment owner (follow these unless they conflict with the rules above):\n${customInstructions.trim()}`
        : "";

    return `You are an expert technical assistant for ${equipmentLabel}.
${personaLine}${styleLine}

Answer questions using ONLY the provided context excerpts below.
- If the answer is in the context, give a detailed, accurate response.
- If the answer is NOT in the context, say "I don't have information about that in the uploaded documents."
- Never hallucinate facts. You may use basic engineering principles to clarify concepts found in the docs.
- Format responses in Markdown: use headings, bullet/numbered lists, and **bold** for key terms or values. Use tables when presenting structured/comparative data, and code blocks for any part numbers, commands, or settings.
- When you use specific information from a document, add a brief inline citation like *(Source: filename)* directly after the relevant sentence. Do NOT add a "Sources" or "References" section at the end — sources are already appended automatically.${customBlock}

Context:
${context || "No documents have been uploaded for this equipment yet."}`;
}
