import { ObjectId } from "mongodb";
import { getChunksCollection } from "../mongodb";
import { ChunkRecord, Citation } from "../types/database";
import { getAIProvider } from "../ai/provider";

export interface SearchOptions {
  sessionId: string;
  documentIds?: string[];
  topK?: number;
  mode?: "hybrid" | "vector" | "keyword";
}

export interface ScoredChunk {
  chunk: ChunkRecord;
  score: number;
  rankVector?: number;
  rankKeyword?: number;
  source: string;
  page: number;
}

const RRF_K = 60; // Standard Reciprocal Rank Fusion constant

/**
 * Calculates Reciprocal Rank Fusion score for items appearing in ranked lists
 */
export function reciprocalRankFusion(
  vectorRankings: ChunkRecord[],
  keywordRankings: ChunkRecord[],
  k: number = RRF_K
): ScoredChunk[] {
  const scoreMap = new Map<
    string,
    {
      chunk: ChunkRecord;
      rrfScore: number;
      rankVector?: number;
      rankKeyword?: number;
    }
  >();

  // Vector list scoring
  vectorRankings.forEach((chunk, index) => {
    const id = chunk._id?.toString() || `${chunk.metadata.source}-${chunk.metadata.chunkIndex}`;
    const rank = index + 1;
    const score = 1 / (k + rank);

    const existing = scoreMap.get(id);
    if (existing) {
      existing.rrfScore += score;
      existing.rankVector = rank;
    } else {
      scoreMap.set(id, {
        chunk,
        rrfScore: score,
        rankVector: rank,
      });
    }
  });

  // Keyword list scoring
  keywordRankings.forEach((chunk, index) => {
    const id = chunk._id?.toString() || `${chunk.metadata.source}-${chunk.metadata.chunkIndex}`;
    const rank = index + 1;
    const score = 1 / (k + rank);

    const existing = scoreMap.get(id);
    if (existing) {
      existing.rrfScore += score;
      existing.rankKeyword = rank;
    } else {
      scoreMap.set(id, {
        chunk,
        rrfScore: score,
        rankKeyword: rank,
      });
    }
  });

  // Normalize scores between 0 and 1
  const sorted = Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);

  const maxScore = sorted.length > 0 ? sorted[0].rrfScore : 1;

  return sorted.map((item) => ({
    chunk: item.chunk,
    score: Number((item.rrfScore / (maxScore || 1)).toFixed(4)),
    rankVector: item.rankVector,
    rankKeyword: item.rankKeyword,
    source: item.chunk.metadata.source,
    page: item.chunk.metadata.page,
  }));
}

/**
 * Executes Vector Search via Atlas $vectorSearch
 */
export async function runVectorSearch(
  queryEmbedding: number[],
  options: SearchOptions
): Promise<ChunkRecord[]> {
  const collection = await getChunksCollection();
  const topK = options.topK || 5;
  const indexName = process.env.CHUNK_VECTOR_INDEX || "chunk_vector_index";

  const filter: Record<string, unknown> = {
    sessionId: options.sessionId,
  };

  if (options.documentIds && options.documentIds.length > 0) {
    const validIds = options.documentIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (validIds.length > 0) {
      filter.documentId = { $in: validIds };
    }
  }

  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: topK * 10,
          limit: topK,
          filter: filter,
        },
      },
    ];

    const results = await collection.aggregate<ChunkRecord>(pipeline).toArray();
    return results;
  } catch (error: unknown) {
    // If $vectorSearch is not yet provisioned in Atlas or running against local Mongo,
    // fallback to in-memory cosine similarity over session chunks
    console.warn("Vector search failed or index building, using in-memory fallback:", error);
    return fallbackVectorSearch(collection, queryEmbedding, options);
  }
}

/**
 * Executes Keyword Search via Atlas Search ($search)
 */
export async function runKeywordSearch(
  query: string,
  options: SearchOptions
): Promise<ChunkRecord[]> {
  const collection = await getChunksCollection();
  const topK = options.topK || 5;
  const indexName = process.env.CHUNK_TEXT_INDEX || "chunk_text_index";

  try {
    const compoundFilters: unknown[] = [
      {
        equals: {
          path: "sessionId",
          value: options.sessionId,
        },
      },
    ];

    if (options.documentIds && options.documentIds.length > 0) {
      const validIds = options.documentIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
      if (validIds.length > 0) {
        compoundFilters.push({
          in: {
            path: "documentId",
            value: validIds,
          },
        });
      }
    }

    const pipeline = [
      {
        $search: {
          index: indexName,
          compound: {
            must: [
              {
                text: {
                  query: query,
                  path: "text",
                  fuzzy: { maxEdits: 1 },
                },
              },
            ],
            filter: compoundFilters,
          },
        },
      },
      { $limit: topK },
    ];

    const results = await collection.aggregate<ChunkRecord>(pipeline).toArray();
    return results;
  } catch (error: unknown) {
    console.warn("Atlas Search $search failed or index not ready, using text fallback:", error);
    return fallbackKeywordSearch(collection, query, options);
  }
}

/**
 * Hybrid retrieval combining Vector and Keyword search with Reciprocal Rank Fusion
 */
export async function runHybridSearch(
  query: string,
  options: SearchOptions
): Promise<ScoredChunk[]> {
  const ai = getAIProvider();
  const topK = options.topK || 5;

  const [queryEmbedding] = await Promise.all([ai.embedQuery(query)]);

  if (options.mode === "vector") {
    const vectorResults = await runVectorSearch(queryEmbedding, options);
    return vectorResults.map((chunk, idx) => ({
      chunk,
      score: 1 / (idx + 1),
      rankVector: idx + 1,
      source: chunk.metadata.source,
      page: chunk.metadata.page,
    }));
  }

  if (options.mode === "keyword") {
    const keywordResults = await runKeywordSearch(query, options);
    return keywordResults.map((chunk, idx) => ({
      chunk,
      score: 1 / (idx + 1),
      rankKeyword: idx + 1,
      source: chunk.metadata.source,
      page: chunk.metadata.page,
    }));
  }

  // Hybrid Mode: Run both concurrently and merge via RRF
  const [vectorHits, keywordHits] = await Promise.all([
    runVectorSearch(queryEmbedding, options),
    runKeywordSearch(query, options),
  ]);

  const fused = reciprocalRankFusion(vectorHits, keywordHits, RRF_K);
  return fused.slice(0, topK);
}

/**
 * Transforms scored chunks into clean citation objects
 */
export function buildCitations(scoredChunks: ScoredChunk[]): Citation[] {
  return scoredChunks.map((item) => ({
    chunkId: item.chunk._id?.toString() || "",
    source: item.chunk.metadata.source,
    page: item.chunk.metadata.page,
    score: item.score,
    snippet: item.chunk.text.slice(0, 200).replace(/\s+/g, " ") + "...",
  }));
}

/* ---------------- Fallback Helpers for Local Dev / Index Building ---------------- */

function cosineSimilarity(a: number[], b: number[]): number {
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

async function fallbackVectorSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: any,
  queryEmbedding: number[],
  options: SearchOptions
): Promise<ChunkRecord[]> {
  const filter: Record<string, unknown> = { sessionId: options.sessionId };
  if (options.documentIds && options.documentIds.length > 0) {
    const validIds = options.documentIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (validIds.length > 0) filter.documentId = { $in: validIds };
  }

  const allChunks = await collection.find(filter).toArray();
  const scored = allChunks.map((chunk: ChunkRecord) => ({
    chunk,
    sim: cosineSimilarity(chunk.embedding, queryEmbedding),
  }));

  scored.sort((a: { sim: number }, b: { sim: number }) => b.sim - a.sim);
  return scored.slice(0, options.topK || 5).map((s: { chunk: ChunkRecord }) => s.chunk);
}

async function fallbackKeywordSearch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: any,
  query: string,
  options: SearchOptions
): Promise<ChunkRecord[]> {
  const filter: Record<string, unknown> = { sessionId: options.sessionId };
  if (options.documentIds && options.documentIds.length > 0) {
    const validIds = options.documentIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
    if (validIds.length > 0) filter.documentId = { $in: validIds };
  }

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const regexQuery = words.length > 0 ? words.join("|") : query;

  filter.text = { $regex: regexQuery, $options: "i" };

  const results = await collection.find(filter).limit(options.topK || 5).toArray();
  return results;
}
