import { getSemanticCacheCollection } from "../mongodb";
import { SemanticCacheRecord, Citation } from "../types/database";

export interface CacheCheckResult {
  hit: boolean;
  answer?: string;
  citations?: Citation[];
  similarity?: number;
}

export function buildDocScopeKey(documentIds: string[] = []): string {
  if (!documentIds || documentIds.length === 0) {
    return "__all__";
  }
  return [...documentIds].sort().join(",");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches the semantic cache for a semantically equivalent question within the same document scope.
 */
export async function checkSemanticCache(
  sessionId: string,
  questionEmbedding: number[],
  docScopeKey: string,
  threshold: number = 0.92
): Promise<CacheCheckResult> {
  const collection = await getSemanticCacheCollection();
  const cacheIndexName = process.env.CACHE_VECTOR_INDEX || "cache_vector_index";

  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: cacheIndexName,
          path: "questionEmbedding",
          queryVector: questionEmbedding,
          numCandidates: 10,
          limit: 1,
          filter: {
            sessionId,
            docScopeKey,
          },
        },
      },
      {
        $project: {
          answer: 1,
          citations: 1,
          question: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await collection.aggregate<{
      answer: string;
      citations: Citation[];
      score: number;
    }>(pipeline).toArray();

    if (results.length > 0) {
      const topMatch = results[0];
      if (topMatch.score >= threshold) {
        return {
          hit: true,
          answer: topMatch.answer,
          citations: topMatch.citations,
          similarity: topMatch.score,
        };
      }
    }
  } catch {
    // Graceful fallback for local dev or before index activation
    const candidates = await collection.find({ sessionId, docScopeKey }).toArray();
    let bestScore = -1;
    let bestMatch: SemanticCacheRecord | null = null;

    for (const candidate of candidates) {
      const sim = cosineSimilarity(candidate.questionEmbedding, questionEmbedding);
      if (sim > bestScore) {
        bestScore = sim;
        bestMatch = candidate;
      }
    }

    if (bestMatch && bestScore >= threshold) {
      return {
        hit: true,
        answer: bestMatch.answer,
        citations: bestMatch.citations,
        similarity: Number(bestScore.toFixed(4)),
      };
    }
  }

  return { hit: false };
}

/**
 * Saves a question, its vector embedding, answer, and citations to the semantic cache.
 */
export async function saveToSemanticCache(
  sessionId: string,
  question: string,
  questionEmbedding: number[],
  answer: string,
  citations: Citation[],
  docScopeKey: string
): Promise<void> {
  try {
    const collection = await getSemanticCacheCollection();
    await collection.insertOne({
      sessionId,
      question,
      questionEmbedding,
      answer,
      citations,
      docScopeKey,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("Failed to save to semantic cache:", err);
  }
}
