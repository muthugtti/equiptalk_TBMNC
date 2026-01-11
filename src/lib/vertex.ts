import { VertexAI } from '@google-cloud/vertexai';

const project = process.env.GOOGLE_CLOUD_PROJECT_ID || 'missing-project-id';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: project, location: location });

export function getGenerativeModel(modelName: string = 'gemini-1.0-pro') {
    return vertexAI.getGenerativeModel({ model: modelName });
}
