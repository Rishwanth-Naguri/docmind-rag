# DocMind MongoDB Schema Architecture & Design Decisions

This document outlines the data model, collection design, index topologies, and rationale behind the schema decisions implemented in **DocMind**.

---

## 1. Collections & Data Modeling Overview

DocMind operates on a dedicated MongoDB database: `docmind`.

```
┌─────────────────────────────────────────────────────────────┐
│                   MongoDB Database: docmind                 │
├───────────────────┬───────────────────┬─────────────────────┤
│    documents      │      chunks       │   semantic_cache    │
│ (Metadata & State)│ (Vector Embeddings│ (Cosine Matching &  │
│                   │  & Excerpt Text)  │   7-day TTL Expiry) │
├───────────────────┼───────────────────┼─────────────────────┤
│     sessions      │     messages      │  eval_cases / runs  │
│ (Anonymous Session│ (Chat History &   │ (Benchmark Golden   │
│   & 30-day TTL)   │  Source Citations)│   Sets & Results)   │
└───────────────────┴───────────────────┴─────────────────────┘
```

---

## 2. Key Design Decisions

### A. Embedding vs. Referencing: Why Chunks are a Separate Collection

A common question in document search systems is whether to store text chunks as an embedded array inside the `documents` document or in a separate `chunks` collection.

**Decision: Normalized Referencing (`chunks` collection with `documentId` reference).**

**Rationale:**
1. **16 MB BSON Document Size Limit**: A large technical PDF (e.g. 100+ pages) can produce hundreds of chunks with high-dimensional float vector embeddings. Embedding 1,000 vectors of dimension 768 inside a single BSON document would quickly approach or exceed MongoDB's 16 MB ceiling.
2. **Atlas Vector Search Efficiency**: The `$vectorSearch` operator indexes individual documents in a collection. By storing each chunk as its own document, Atlas Vector Search indexes each vector independently, enabling fine-grained nearest neighbor ranking and sub-second recall.
3. **Atomic Streaming & Updates**: Chunks can be inserted and embedded in batches without locking or rewriting the parent document.
4. **Memory Footprint & Read Projections**: When querying document metadata in the sidebar, we only fetch lightweight fields (`filename`, `sizeBytes`, `chunkCount`), completely avoiding the transfer of multi-megabyte embedding arrays.

### B. Anonymous Session Scoping

Every operational query in DocMind is filtered by `sessionId`:
- In `chunks`: `{ sessionId: <id>, documentId: { $in: [...] } }`
- In `semantic_cache`: `{ sessionId: <id>, docScopeKey: <key> }`

This guarantees absolute multi-tenant data isolation on an open public app without requiring mandatory authentication upfront.

---

## 3. Index Topologies

### 1. Atlas Vector Search Index (`chunk_vector_index`)
Created on the `chunks` collection:
```json
{
  "name": "chunk_vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 768,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "sessionId"
      },
      {
        "type": "filter",
        "path": "documentId"
      }
    ]
  }
}
```
- **HNSW Algorithm**: Atlas Vector Search uses Hierarchical Navigable Small World graphs for sub-second ANN queries.
- **Pre-Filtering**: The `sessionId` and `documentId` filter fields allow Atlas to evaluate access control and document scoping simultaneously with vector traversal.

### 2. Atlas Full-Text Search Index (`chunk_text_index`)
Created on `chunks.text`:
```json
{
  "name": "chunk_text_index",
  "definition": {
    "mappings": {
      "dynamic": false,
      "fields": {
        "text": { "type": "string", "analyzer": "lucene.standard" },
        "sessionId": { "type": "token" },
        "documentId": { "type": "token" }
      }
    }
  }
}
```
Enables BM25 keyword retrieval with fuzzy matching (`maxEdits: 1`) to complement vector search for exact codes, acronyms, and names.

### 3. Semantic Cache Vector Index (`cache_vector_index`)
Created on `semantic_cache`:
- Vector field: `questionEmbedding` (768 dims, cosine)
- Filter fields: `sessionId`, `docScopeKey`
Allows sub-50ms cache hits when a question has cosine similarity ≥ 0.92 within the same active document set.

### 4. TTL Auto-Purge Indexes
- **Semantic Cache TTL**: `semantic_cache.createdAt` with `expireAfterSeconds: 604800` (7 days). Expired answers are purged by MongoDB's background thread without application overhead.
- **Session Cleanup TTL**: `sessions.lastActiveAt` with `expireAfterSeconds: 2592000` (30 days). Automatically frees storage for abandoned anonymous sessions.

### 5. Standard Operational Indexes
- `documents`: `{ sessionId: 1, createdAt: -1 }` (fast sidebar listing)
- `chunks`: `{ documentId: 1 }`, `{ sessionId: 1 }` (instant cascading deletes)
- `messages`: `{ sessionId: 1, createdAt: 1 }` (chronological chat history loading)
