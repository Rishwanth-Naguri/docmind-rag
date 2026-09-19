# DocMind 🧠 | MongoDB Atlas Vector Search RAG Chatbot

> A production-quality Retrieval-Augmented Generation (RAG) platform over user-uploaded documents, powered by **MongoDB Atlas Vector Search**, **Atlas Search**, **Reciprocal Rank Fusion (RRF)**, and **Google Gemini**.

[![Next.js](https://img.shields.io/badge/Next.js-15_App_Router-black?logo=next.js)](https://nextjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas_M0-green?logo=mongodb)](https://www.mongodb.com/products/platform/atlas-database)
[![Gemini](https://img.shields.io/badge/Google_AI-Gemini_API-blue?logo=google)](https://aistudio.google.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Live Demo & Preview

- **Live URL**: (https://docmind-rag-xi.vercel.app) *(Deployment Link)*
- **GitHub Repository**: [https://github.com/your-username/docmind-rag](https://github.com/your-username/docmind-rag)

---

## 🚀 Key Features

1. **Multi-Format Document Ingestion**:
   - Upload PDF, TXT, and Markdown files (up to 5 MB each).
   - Serverless PDF parsing via `unpdf` without external native canvas binaries.
   - Token-aware sliding chunker (~800 tokens, 100-token overlap), preserving page numbers and source filenames.
   - Batch vector embedding generation.

2. **Grounded Chat with Streaming & Source Citations**:
   - Real-time token streaming responses.
   - Every claim is grounded with source citations (`filename` + `page number`).
   - Expandable **Evidence Drawer** showing verbatim cited passages and RRF relevance scores.

3. **Hybrid Search via Reciprocal Rank Fusion (RRF)**:
   - Concurrent execution of dense semantic search (`$vectorSearch` with HNSW cosine similarity) and sparse keyword search (`$search` with Lucene BM25).
   - Algorithmic rank combination using RRF ($k=60$) in application code for superior recall over acronyms and domain concepts.
   - Metadata pre-filtering allowing users to scope questions to specific uploaded files.

4. **Sub-Second Semantic Cache**:
   - Compares incoming question embeddings against prior questions using cosine similarity.
   - Cache hits (similarity $\ge 0.92$ in the same document scope) bypass the LLM and return in under 50ms.
   - Marked with a **"Cached"** pill in the UI.
   - MongoDB TTL index automatically cleans expired entries after 7 days.

5. **Conversation Memory & Rolling Summaries**:
   - Anonymous session ID tracked via HTTP-only cookies.
   - Rolling conversation summaries persisted in MongoDB.

6. **Faceted Aggregation Analytics (`/analytics`)**:
   - Real-time aggregation pipelines using `$facet`, `$bucket`, `$group`, `$lookup`, and `$dateTrunc`.
   - Visualizes total queries, cache hit efficiency, latency histograms, and top unanswered questions.

7. **Empirical Retrieval Evaluation Benchmark (`/eval`)**:
   - Golden question-answer benchmark set stored in MongoDB (`eval_cases`).
   - Automated evaluation comparing Hit-Rate@1, Hit-Rate@3, and Hit-Rate@5 between **Vector-only**, **Keyword-only**, and **Hybrid RRF**.

8. **Guardrails & Prompt Injection Defense**:
   - Strict retrieval score thresholding ($<0.45$ yields honest *"I couldn't find that in your documents"* fallback).
   - Context is encapsulated in XML tags and treated strictly as untrusted data to prevent prompt override attacks.

---

## 🏗️ System Architecture

```
                               ┌──────────────────────────┐
                               │     Next.js Frontend     │
                               │ (Chat, Analytics, Eval)  │
                               └─────────────┬────────────┘
                                             │ API Routes (App Router)
                  ┌──────────────────────────┴──────────────────────────┐
                  ▼                                                     ▼
     ┌─────────────────────────┐                               ┌──────────────────────────┐
     │   Document Ingestion    │                               │    Hybrid RAG Pipeline   │
     │  - unpdf / text extract │                               │  - Semantic Cache Check  │
     │  - Token-aware chunking │                               │  - $vectorSearch (HNSW)  │
     │  - Batch Gemini Embed   │                               │  - $search (BM25 Lucene) │
     │  - MongoDB Atlas Store  │                               │  - RRF Merge ($k=60$)    │
     └────────────┬────────────┘                               │  - Prompt Shield Guard   │
                  │                                            │  - Gemini Stream LLM     │
                  └──────────────────────────┬─────────────────┴─────────────┬────────────┘
                                             ▼                               │
                        ┌────────────────────────────────────────┐           │
                        │       MongoDB Atlas (docmind db)       │◄──────────┘
                        │  - documents: metadata & status        │
                        │  - chunks: vector & text indexed       │
                        │  - semantic_cache: 7-day TTL index     │
                        │  - sessions & messages: 30-day TTL     │
                        │  - eval_cases & eval_runs              │
                        └────────────────────────────────────────┘
```

---

## 📊 MongoDB Concepts Demonstrated

| MongoDB Concept | Implementation Detail | Source File |
| :--- | :--- | :--- |
| **Vector Search (`$vectorSearch`)** | HNSW approximate nearest neighbor search over high-dimensional embeddings with `sessionId` pre-filter | [`src/lib/retrieval/search.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/retrieval/search.ts) |
| **Atlas Full-Text Search (`$search`)** | Lucene BM25 keyword search with fuzzy matching (`maxEdits: 1`) and compound filters | [`src/lib/retrieval/search.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/retrieval/search.ts) |
| **Reciprocal Rank Fusion** | Merges dense vector and sparse keyword results into normalized relevance scores | [`src/lib/retrieval/search.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/retrieval/search.ts) |
| **Semantic Vector Caching** | Vector similarity lookup against previous questions within identical document scopes | [`src/lib/cache/semantic-cache.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/cache/semantic-cache.ts) |
| **TTL Indexes** | Background document expiration for semantic cache (7 days) and inactive sessions (30 days) | [`scripts/setup-indexes.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/scripts/setup-indexes.ts) |
| **Faceted Aggregation (`$facet`)** | Single-trip computation of total counts, cache hit rate, and latency averages | [`src/lib/analytics/aggregation.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/analytics/aggregation.ts) |
| **Histogram Buckets (`$bucket`)** | Server-side grouping of query latencies into distribution bins | [`src/lib/analytics/aggregation.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/analytics/aggregation.ts) |
| **Lookup Joins (`$lookup`)** | Joining citations to the `documents` collection to aggregate file formats | [`src/lib/analytics/aggregation.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/analytics/aggregation.ts) |
| **Date Truncation (`$dateTrunc`)** | Time-series query volume grouped by calendar day | [`src/lib/analytics/aggregation.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/analytics/aggregation.ts) |
| **Serverless Connection Pooling** | Cached global `MongoClient` promise preventing connection starvation on Vercel | [`src/lib/mongodb.ts`](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/src/lib/mongodb.ts) |

For comprehensive schema explanations, refer to [docs/schema.md](file:///c:/Users/nagur/OneDrive/Desktop/MONGODB%20PROJECT/docs/schema.md).

---

## ⚙️ Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `MONGODB_URI` | MongoDB Atlas cluster connection string | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB_NAME` | Target database name | `docmind` |
| `GEMINI_API_KEY` | Google AI Studio API key | `AIzaSy...` |
| `EMBEDDING_MODEL` | Embedding model identifier | `text-embedding-004` |
| `EMBEDDING_DIMS` | Vector dimension size | `768` |
| `LLM_MODEL` | Generative chat model | `gemini-1.5-flash` |
| `CHUNK_VECTOR_INDEX` | Atlas Vector Search index on chunks | `chunk_vector_index` |
| `CHUNK_TEXT_INDEX` | Atlas Search index on chunks | `chunk_text_index` |
| `CACHE_VECTOR_INDEX` | Vector index for semantic cache | `cache_vector_index` |
| `SEMANTIC_CACHE_THRESHOLD` | Minimum cosine similarity for cache hit | `0.92` |
| `RETRIEVAL_SCORE_THRESHOLD` | Guardrail threshold below which fallback triggers | `0.45` |
| `RETRIEVAL_TOP_K` | Number of chunks retrieved per engine | `5` |

---

## 🛠️ Local Setup & Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/docmind-rag.git
cd docmind-rag
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and provide your credentials:
```bash
cp .env.example .env.local
```

### 3. Setup MongoDB Indexes
Run the idempotent index setup script to configure Atlas Vector Search, Atlas Search, and TTL indexes:
```bash
npm run setup:indexes
```

### 4. Seed Demo Knowledge Base & Golden Eval Cases
Seed sample documents (Atlas Vector Search Overview, RRF Guide, System Architecture) and benchmark questions:
```bash
npm run seed
```

### 5. Run Tests
```bash
npm run test
```

### 6. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🚀 Deployment to Vercel

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete DocMind production RAG implementation"
   git branch -M main
   git remote add origin https://github.com/your-username/docmind-rag.git
   git push -u origin main
   ```
2. Import the repository in [Vercel](https://vercel.com).
3. Set the required Environment Variables in the Vercel project settings:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `GEMINI_API_KEY`
   - `EMBEDDING_MODEL` (`text-embedding-004`)
   - `EMBEDDING_DIMS` (`768`)
   - `LLM_MODEL` (`gemini-1.5-flash`)
4. In **MongoDB Atlas Network Access**, add `0.0.0.0/0` (allow access from anywhere) so Vercel Serverless Functions can connect.
5. Deploy! Vercel will automatically build the Next.js application.

---

## 🔮 Roadmap & Future Enhancements

- [ ] **LangGraph Agentic Memory**: Long-term reflective memory across multiple sessions.
- [ ] **Cohere / FlashRank Cross-Encoder Reranking**: Second-stage reranking after RRF fusion.
- [ ] **Multi-Tenant OAuth**: GitHub & Google authentication via Auth.js.
- [ ] **Audio & Image Ingestion**: Multi-modal document parsing with Gemini Vision.

---

## 📄 License

MIT © 2026 DocMind Team
