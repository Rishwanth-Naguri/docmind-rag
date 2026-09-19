import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { MongoClient } from "mongodb";
import { chunkPages } from "../src/lib/ingestion/chunker";
import { getAIProvider } from "../src/lib/ai/provider";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/docmind";
const dbName = process.env.MONGODB_DB_NAME || "docmind";

const DEMO_SESSION_ID = "demo-session-global";

const SAMPLE_DOCS = [
  {
    filename: "MongoDB_Atlas_Vector_Search_Overview.md",
    mimeType: "text/markdown",
    content: `# MongoDB Atlas Vector Search Overview

MongoDB Atlas Vector Search enables developers to build intelligent semantic search and generative AI applications directly inside MongoDB.

## Key Features
- **Native Data Platform Integration**: Store operational application data, documents, metadata, and high-dimensional vector embeddings in the exact same database.
- **Hierarchical Navigable Small World (HNSW)**: Atlas Vector Search utilizes state-of-the-art graph-based indexing algorithms to achieve sub-second approximate nearest neighbor (ANN) retrieval across millions of vectors.
- **Supported Distance Metrics**:
  1. **Cosine Similarity**: Measures the cosine of the angle between two vectors; standard for normalized text embeddings.
  2. **Euclidean Distance**: Measures straight-line geometric distance in multi-dimensional space.
  3. **Dot Product**: Optimized for pre-normalized vectors where dot product equals cosine similarity.
- **Metadata Pre-Filtering**: The \`$vectorSearch\` aggregation stage allows boolean and token filters (such as \`sessionId\`, \`documentId\`, or user tags) to be evaluated alongside or before vector traversal.
- **Serverless and Scalable**: Fully managed on MongoDB Atlas across AWS, GCP, and Azure with automated scaling and backups.`,
  },
  {
    filename: "Reciprocal_Rank_Fusion_Guide.md",
    mimeType: "text/markdown",
    content: `# Reciprocal Rank Fusion (RRF) for Hybrid Search

Reciprocal Rank Fusion (RRF) is a simple yet remarkably robust algorithm for merging ranked retrieval results from multiple distinct information retrieval systems.

## How RRF Works
Given a set of documents and multiple ranking methods (such as Dense Vector Retrieval and Sparse BM25 Keyword Search), RRF calculates a combined score for each document $d$:

$$RRF(d) = \\sum_{m \\in M} \\frac{1}{k + r_m(d)}$$

Where:
- $M$ is the set of retrieval models (e.g., Vector Search and Atlas Search).
- $r_m(d)$ is the 1-based rank position of document $d$ in the result list from system $m$.
- $k$ is a smoothing constant, traditionally set to 60.

## Advantages of Hybrid Search with RRF
1. **Out-of-Vocabulary (OOV) Resilience**: Vector embeddings excel at semantic similarity and conceptual matches, but can falter on exact product codes, acronyms, or rare terms. Keyword search reliably captures exact terms.
2. **Zero Score Normalization Required**: Unlike weighted linear score combinations, RRF depends only on ordinal ranks rather than uncalibrated raw similarity scores.
3. **Consistent Lift**: Empirical evaluations consistently demonstrate that Hybrid Search via RRF achieves higher Hit-Rate@K and Mean Reciprocal Rank (MRR) than either vector-only or keyword-only search alone.`,
  },
  {
    filename: "DocMind_System_Architecture.txt",
    mimeType: "text/plain",
    content: `DocMind System Architecture & Design Specification

DocMind is a high-performance RAG chatbot system engineered for enterprise document grounding with MongoDB Atlas.

1. Document Ingestion Pipeline:
Uploaded documents (PDF, TXT, MD) are parsed in serverless functions without external native binaries. Text is partitioned into token-aware windows of approximately 800 tokens with 100-token overlaps, preserving original page numbers and source metadata.

2. Semantic Caching Engine:
Prior to querying the LLM, the user's question embedding is evaluated against the semantic_cache collection. If a previously answered question in the same document scope achieves a cosine similarity score of 0.92 or higher, the cached answer is returned immediately. This reduces average latency by over 85% and eliminates repetitive LLM API costs. A MongoDB TTL index automatically purges cache entries after 7 days.

3. Guardrails & Prompt Injection Shielding:
Retrieved document chunks are strictly isolated within XML tags and treated as untrusted data. The prompt explicitly instructs the model to ignore any instructions embedded in the documents and fall back to "I couldn't find that in your documents" when retrieval scores fall below 0.45.

4. Aggregation Analytics:
A real-time analytics dashboard leverages MongoDB's $facet, $bucket, $group, $lookup, and $dateTrunc pipeline stages to monitor total queries, cache hit efficiency, latency percentiles, and top unanswered questions.`,
  },
];

const EVAL_CASES = [
  {
    question: "What is Reciprocal Rank Fusion and what constant k is typically used?",
    expectedSource: "Reciprocal_Rank_Fusion_Guide.md",
    expectedKeywords: ["Reciprocal Rank Fusion", "60", "ranking"],
  },
  {
    question: "How does Atlas Vector Search perform approximate nearest neighbor queries?",
    expectedSource: "MongoDB_Atlas_Vector_Search_Overview.md",
    expectedKeywords: ["HNSW", "Hierarchical Navigable", "ANN"],
  },
  {
    question: "What role does the semantic cache play in reducing LLM latency and costs?",
    expectedSource: "DocMind_System_Architecture.txt",
    expectedKeywords: ["semantic cache", "0.92", "latency", "TTL"],
  },
  {
    question: "What similarity metrics are supported by MongoDB Atlas Vector Search?",
    expectedSource: "MongoDB_Atlas_Vector_Search_Overview.md",
    expectedKeywords: ["Cosine Similarity", "Euclidean Distance", "Dot Product"],
  },
];

async function seed() {
  console.log("Seeding MongoDB DocMind database...");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const docsCol = db.collection("documents");
  const chunksCol = db.collection("chunks");
  const evalCol = db.collection("eval_cases");
  const ai = getAIProvider();

  // 1. Seed Eval Cases
  console.log("Seeding golden evaluation test cases...");
  await evalCol.deleteMany({});
  await evalCol.insertMany(EVAL_CASES);
  console.log(`Inserted ${EVAL_CASES.length} evaluation cases.`);

  // 2. Seed Sample Documents
  console.log("Ingesting sample documents and generating embeddings...");
  for (const doc of SAMPLE_DOCS) {
    // Upsert document record
    const existingDoc = await docsCol.findOne({
      sessionId: DEMO_SESSION_ID,
      filename: doc.filename,
    });

    if (existingDoc) {
      console.log(`Document "${doc.filename}" already exists for demo session.`);
      continue;
    }

    const docInsert = await docsCol.insertOne({
      sessionId: DEMO_SESSION_ID,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: Buffer.byteLength(doc.content, "utf-8"),
      pageCount: 1,
      chunkCount: 0,
      status: "processing",
      createdAt: new Date(),
    });

    const documentId = docInsert.insertedId;

    // Chunk document
    const generatedChunks = chunkPages(
      [{ pageNumber: 1, text: doc.content }],
      doc.filename
    );

    // Embed chunks
    const chunkTexts = generatedChunks.map((c) => c.text);
    const embeddings = await ai.embedTexts(chunkTexts);

    const chunkDocs = generatedChunks.map((chunk, idx) => ({
      documentId,
      sessionId: DEMO_SESSION_ID,
      text: chunk.text,
      embedding: embeddings[idx] || [],
      metadata: chunk.metadata,
      createdAt: new Date(),
    }));

    await chunksCol.insertMany(chunkDocs);

    await docsCol.updateOne(
      { _id: documentId },
      {
        $set: {
          status: "ready",
          chunkCount: generatedChunks.length,
        },
      }
    );

    console.log(`Seeded "${doc.filename}" with ${generatedChunks.length} chunks.`);
  }

  await client.close();
  console.log("Database seeding completed successfully!");
}

seed().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
