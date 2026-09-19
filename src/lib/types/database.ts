import { ObjectId } from "mongodb";

export type DocumentStatus = "processing" | "ready" | "failed";

export interface DocumentRecord {
  _id?: ObjectId;
  sessionId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount: number;
  chunkCount: number;
  status: DocumentStatus;
  errorMessage?: string;
  createdAt: Date;
}

export interface ChunkMetadata {
  source: string;
  page: number;
  chunkIndex: number;
}

export interface ChunkRecord {
  _id?: ObjectId;
  documentId: ObjectId;
  sessionId: string;
  text: string;
  embedding: number[];
  metadata: ChunkMetadata;
  createdAt: Date;
}

export interface SessionRecord {
  _id: string; // Session ID string or UUID
  createdAt: Date;
  lastActiveAt: Date;
  summary?: string;
}

export interface Citation {
  chunkId: string;
  source: string;
  page: number;
  score: number;
  snippet?: string;
}

export type MessageRole = "user" | "assistant" | "system";

export interface MessageRecord {
  _id?: ObjectId;
  sessionId: string;
  role: MessageRole;
  content: string;
  citations?: Citation[];
  latencyMs?: number;
  cacheHit?: boolean;
  unanswered?: boolean;
  createdAt: Date;
}

export interface SemanticCacheRecord {
  _id?: ObjectId;
  sessionId: string;
  questionEmbedding: number[];
  question: string;
  answer: string;
  citations: Citation[];
  docScopeKey: string; // Hash or sorted comma-separated string of active documentIds
  createdAt: Date;
}

export interface EvalCaseRecord {
  _id?: ObjectId;
  question: string;
  expectedSource: string;
  expectedKeywords?: string[];
}

export interface EvalModeResult {
  hitRateAt1: number;
  hitRateAt3: number;
  hitRateAt5: number;
  avgLatencyMs: number;
  details: {
    question: string;
    expectedSource: string;
    retrievedSources: string[];
    hitAt1: boolean;
    hitAt3: boolean;
    hitAt5: boolean;
    score: number;
  }[];
}

export interface EvalRunRecord {
  _id?: ObjectId;
  createdAt: Date;
  results: {
    vectorOnly: EvalModeResult;
    keywordOnly: EvalModeResult;
    hybridRrf: EvalModeResult;
  };
  summary: string;
}
