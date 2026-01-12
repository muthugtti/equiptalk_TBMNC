import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT_ID || 'missing-project-id';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: project, location: location });

export function getGenerativeModel(modelName: string = 'gemini-1.5-pro-preview-0409') {
    return vertexAI.getGenerativeModel({ model: modelName });
}

/**
 * Generates an answer based on the provided context (RAG pattern).
 * Mimics "Notebook LLM" by using a large context window model (Gemini 1.5).
 */
export async function generateAnswerFromContext(query: string, contextDocuments: string[]) {
    // Combine documents into a single context block
    const context = contextDocuments.join("\n\n---\n\n");

    const model = getGenerativeModel('gemini-1.5-pro-preview-0409');

    const prompt = `
    You are an intelligent equipment assistant. Use the following context documents to answer the user's question.
    If the answer is not in the documents, say "I don't have enough information in the provided documents."
    
    Context:
    ${context}
    
    User Question: ${query}
    
    Answer:
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.candidates?.[0].content.parts[0].text;
}

/**
 * Summarizes a document's content.
 */
export async function summarizeDocument(documentContent: string) {
    const model = getGenerativeModel('gemini-1.5-pro-preview-0409');

    const prompt = `
    Please provide a concise summary of the following document. Highlight key operational procedures and safety warnings.
    
    Document Content:
    ${documentContent}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.candidates?.[0].content.parts[0].text;
}
