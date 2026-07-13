import { Index } from '@upstash/vector';

// Lazily construct the Upstash client. Constructing it at module load with
// `new Index({ url: undefined!, token: undefined! })` THROWS when the env vars
// are absent (e.g. not provisioned in the deployed runtime), which would crash
// the entire route module that imports this file — surfacing as a raw
// "Internal Server Error" before any handler try/catch can run. Init lazily and
// degrade gracefully instead: if the cache isn't configured, callers just skip
// it (semantic cache is a best-effort optimization, never a correctness path).
let cachedIndex: Index | null = null;
let indexInitAttempted = false;

function getIndex(): Index | null {
    if (indexInitAttempted) return cachedIndex;
    indexInitAttempted = true;
    const url = process.env.UPSTASH_VECTOR_REST_URL;
    const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
    if (!url || !token) {
        console.warn('[SemanticCache] UPSTASH_VECTOR_REST_URL/TOKEN not set — semantic cache disabled.');
        return null;
    }
    try {
        cachedIndex = new Index({ url, token });
    } catch (err) {
        console.error('[SemanticCache] Failed to initialize Upstash index:', err);
        cachedIndex = null;
    }
    return cachedIndex;
}

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
    const index = getIndex();
    if (!index) return null;
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
    const index = getIndex();
    if (!index) return;
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
    const index = getIndex();
    if (!index) return;
    try {
        await index.namespace(equipmentId).reset();
    } catch (err) {
        console.error('[SemanticCache] Invalidation failed:', err);
    }
}
