import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "@/lib/retrieval/search";
import { ChunkRecord } from "@/lib/types/database";
import { ObjectId } from "mongodb";

describe("Reciprocal Rank Fusion (RRF)", () => {
  const mockChunkA: ChunkRecord = {
    _id: new ObjectId(),
    documentId: new ObjectId(),
    sessionId: "test-session",
    text: "Chunk A content",
    embedding: [],
    metadata: { source: "fileA.pdf", page: 1, chunkIndex: 0 },
    createdAt: new Date(),
  };

  const mockChunkB: ChunkRecord = {
    _id: new ObjectId(),
    documentId: new ObjectId(),
    sessionId: "test-session",
    text: "Chunk B content",
    embedding: [],
    metadata: { source: "fileB.pdf", page: 2, chunkIndex: 1 },
    createdAt: new Date(),
  };

  const mockChunkC: ChunkRecord = {
    _id: new ObjectId(),
    documentId: new ObjectId(),
    sessionId: "test-session",
    text: "Chunk C content",
    embedding: [],
    metadata: { source: "fileC.pdf", page: 1, chunkIndex: 0 },
    createdAt: new Date(),
  };

  it("should rank items present in both vector and keyword lists highest", () => {
    // Chunk A is ranked #1 in vector and #2 in keyword
    // Chunk B is ranked #2 in vector only
    // Chunk C is ranked #1 in keyword only
    const vectorRankings = [mockChunkA, mockChunkB];
    const keywordRankings = [mockChunkC, mockChunkA];

    const fused = reciprocalRankFusion(vectorRankings, keywordRankings, 60);

    expect(fused.length).toBe(3);
    // Chunk A has scores from BOTH systems, so it must be ranked #1
    expect(fused[0].chunk._id?.toString()).toBe(mockChunkA._id?.toString());
    expect(fused[0].score).toBe(1); // Normalized to 1.0
    expect(fused[0].rankVector).toBe(1);
    expect(fused[0].rankKeyword).toBe(2);
  });

  it("should handle disjoint ranked lists without dropping items", () => {
    const vectorRankings = [mockChunkA];
    const keywordRankings = [mockChunkB];

    const fused = reciprocalRankFusion(vectorRankings, keywordRankings, 60);
    expect(fused).toHaveLength(2);
    const ids = fused.map((f) => f.chunk._id?.toString());
    expect(ids).toContain(mockChunkA._id?.toString());
    expect(ids).toContain(mockChunkB._id?.toString());
  });
});
