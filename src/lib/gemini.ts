
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

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
