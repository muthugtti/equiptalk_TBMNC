
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

export async function getEmbedding(text: string): Promise<number[]> {
    const result = await embeddingModel.embedContent(text.slice(0, 10000));
    return result.embedding.values;
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

// Tool definition for creating incidents
export const incidentTool: any = {
    functionDeclarations: [
        {
            name: "create_incident",
            description: "Report a new maintenance issue, defect, or incident for this equipment. Use this when the user mentions a problem that needs fixing.",
            parameters: {
                type: SchemaType.OBJECT,
                properties: {
                    title: {
                        type: SchemaType.STRING,
                        description: "Short summary of the issue (e.g., 'Engine Overheating', 'Safety Guard Loose')."
                    },
                    description: {
                        type: SchemaType.STRING,
                        description: "Detailed description of the problem based on user's input."
                    },
                    priority: {
                        type: SchemaType.STRING,
                        enum: ["Low", "Medium", "High", "Critical"],
                        description: "Assess priority based on safety and urgency. Default to 'Medium'."
                    },
                },
                required: ["title", "description", "priority"],
            },
        },
    ],
};

export const getGeminiModel = (systemInstruction?: string) => {
    return genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: systemInstruction,
        tools: [incidentTool],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
        generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
            topP: 0.95,
            topK: 64,
        },
    });
};
