
import { VertexAI } from '@google-cloud/vertexai';

// Initialize Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'equiptalk-317d8';
const location = 'us-central1'; // Or your prefered region

const vertexAI = new VertexAI({ project: project, location: location });

// Instantiate Gemini model
export const getGeminiModel = () => {
    return vertexAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
            topP: 0.8,
            topK: 40,
        },
    });
};
