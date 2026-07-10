import { Index } from '@upstash/vector';

const index = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL!,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

const SIMILARITY_THRESHOLD = 0.92;
// gemini-embedding-001 outputs 3072 dims; Upstash index is 1536
const UPSTASH_DIMS = 1536;

function truncate(embedding: number[]): number[] {
    return embedding.slice(0, UPSTASH_DIMS);
}

export async function checkSemanticCache(
    equipmentId: string,
    embedding: number[]
): Promise<string | null> {
    try {
        const results = await index.namespace(equipmentId).query({
            vector: truncate(embedding),
            topK: 1,
            includeMetadata: true,
        });
        const top = results[0];
        if (top?.score >= SIMILARITY_THRESHOLD && top.metadata?.answer) {
            return top.metadata.answer as string;
        }
    } catch (err) {
        console.error('[SemanticCache] Check failed:', err);
    }
    return null;
}

export async function storeSemanticCache(
    equipmentId: string,
    embedding: number[],
    question: string,
    answer: string
): Promise<void> {
    try {
        await index.namespace(equipmentId).upsert({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            vector: truncate(embedding),
            metadata: { question, answer, cachedAt: new Date().toISOString() },
        });
    } catch (err) {
        console.error('[SemanticCache] Store failed:', err);
    }
}

// Called on new document upload to prevent stale answers
export async function invalidateEquipmentCache(equipmentId: string): Promise<void> {
    try {
        await index.namespace(equipmentId).reset();
    } catch (err) {
        console.error('[SemanticCache] Invalidation failed:', err);
    }
}
