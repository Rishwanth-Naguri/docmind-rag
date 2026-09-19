import { describe, it, expect } from "vitest";
import { chunkPages } from "@/lib/ingestion/chunker";

describe("Document Chunker", () => {
  it("should return a single chunk for short text without unnecessary splitting", () => {
    const pages = [{ pageNumber: 1, text: "MongoDB Atlas Vector Search is powerful." }];
    const chunks = chunkPages(pages, "test.md");

    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("MongoDB Atlas Vector Search is powerful.");
    expect(chunks[0].metadata.source).toBe("test.md");
    expect(chunks[0].metadata.page).toBe(1);
    expect(chunks[0].metadata.chunkIndex).toBe(0);
  });

  it("should split long text into overlapping chunks preserving page metadata", () => {
    // Generate text longer than targetChars (targetTokens * charsPerToken)
    const longParagraph = "DocMind is an intelligent document retrieval chatbot. ".repeat(70);
    const pages = [
      { pageNumber: 1, text: longParagraph },
      { pageNumber: 2, text: "Second page brief content." },
    ];

    const chunks = chunkPages(pages, "manual.pdf", {
      targetTokens: 100,
      overlapTokens: 20,
      charsPerToken: 4,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.page).toBe(1);
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.metadata.page).toBe(2);
    expect(lastChunk.text).toContain("Second page brief content");
  });

  it("should filter out empty pages", () => {
    const pages = [
      { pageNumber: 1, text: "" },
      { pageNumber: 2, text: "   " },
      { pageNumber: 3, text: "Valid content here." },
    ];
    const chunks = chunkPages(pages, "sparse.txt");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].metadata.page).toBe(3);
  });
});
