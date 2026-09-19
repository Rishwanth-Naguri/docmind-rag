import { describe, it, expect } from "vitest";
import { cosineSimilarity, buildDocScopeKey } from "@/lib/cache/semantic-cache";

describe("Semantic Cache Utilities", () => {
  it("should calculate exact cosine similarity for identical vectors", () => {
    const vecA = [0.2, 0.5, 0.8, 0.1];
    const sim = cosineSimilarity(vecA, vecA);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it("should calculate zero cosine similarity for orthogonal vectors", () => {
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(0.0, 5);
  });

  it("should build a deterministic docScopeKey regardless of input order", () => {
    const key1 = buildDocScopeKey(["docB", "docA", "docC"]);
    const key2 = buildDocScopeKey(["docC", "docB", "docA"]);
    expect(key1).toBe("docA,docB,docC");
    expect(key1).toBe(key2);
  });

  it("should return '__all__' when no document scope is restricted", () => {
    expect(buildDocScopeKey([])).toBe("__all__");
    expect(buildDocScopeKey(undefined as any)).toBe("__all__");
  });
});
