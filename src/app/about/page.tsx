import {
  Database,
  Layers,
  Search,
  Zap,
  ShieldCheck,
  Cpu,
  BarChart3,
  GitBranch,
} from "lucide-react";

export default function AboutPage() {
  const concepts = [
    {
      concept: "Atlas Vector Search ($vectorSearch)",
      description: "HNSW approximate nearest neighbor search over high-dimensional embeddings with pre-filtering.",
      files: "src/lib/retrieval/search.ts, scripts/setup-indexes.ts",
      badge: "Vector Search",
    },
    {
      concept: "Atlas Full-Text Search ($search)",
      description: "Lucene BM25 keyword search with fuzzy matching and token filters.",
      files: "src/lib/retrieval/search.ts",
      badge: "Atlas Search",
    },
    {
      concept: "Reciprocal Rank Fusion (RRF)",
      description: "Algorithmic rank fusion combining dense vector and sparse keyword results.",
      files: "src/lib/retrieval/search.ts, tests/rrf.test.ts",
      badge: "Hybrid Search",
    },
    {
      concept: "Semantic Caching",
      description: "Vector similarity matching (cosine > 0.92) across identical document scopes to bypass LLM calls.",
      files: "src/lib/cache/semantic-cache.ts",
      badge: "Semantic Cache",
    },
    {
      concept: "TTL Auto-Purge Indexes",
      description: "Automated document lifecycle expiration for semantic cache (7 days) and inactive sessions (30 days).",
      files: "scripts/setup-indexes.ts",
      badge: "TTL Indexing",
    },
    {
      concept: "Aggregation Pipelines ($facet, $bucket, $group, $lookup, $dateTrunc)",
      description: "Multi-dimensional real-time analytical pipeline computing metrics, distributions, and document joins.",
      files: "src/lib/analytics/aggregation.ts",
      badge: "Aggregations",
    },
    {
      concept: "Normalized Schema Design",
      description: "Separation of document metadata and vector chunks for optimal memory footprint and index performance.",
      files: "src/lib/types/database.ts, docs/schema.md",
      badge: "Schema Design",
    },
  ];

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-8">
      {/* Intro Header */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
            <Database className="w-3.5 h-3.5" />
            MongoDB Atlas Vector Search Showcase
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            DocMind Architecture & MongoDB Design
          </h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            DocMind is an enterprise-grade Retrieval-Augmented Generation (RAG) platform. It
            showcases advanced MongoDB capabilities including dense vector search, BM25 text
            indexing, Reciprocal Rank Fusion, sub-second semantic caching, automated TTL lifecycles,
            and faceted aggregation pipelines.
          </p>
        </div>
      </div>

      {/* Interactive Architecture Flow SVG */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-slate-100">End-to-End System Architecture</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Hybrid RAG Dataflow</span>
        </div>

        <div className="w-full overflow-x-auto py-4">
          <svg
            className="w-full min-w-[760px] h-64 text-slate-200"
            viewBox="0 0 900 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* User Query Block */}
            <rect x="20" y="80" width="130" height="70" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            <text x="85" y="115" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="bold">User Question</text>
            <text x="85" y="132" textAnchor="middle" fill="#94a3b8" fontSize="11">PDF/TXT/MD Scope</text>

            {/* Arrow 1 */}
            <path d="M150 115 L200 115" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />

            {/* Semantic Cache Block */}
            <rect x="200" y="70" width="160" height="90" rx="12" fill="#0f172a" stroke="#06b6d4" strokeWidth="2" />
            <text x="280" y="102" textAnchor="middle" fill="#06b6d4" fontSize="13" fontWeight="bold">Semantic Cache</text>
            <text x="280" y="122" textAnchor="middle" fill="#94a3b8" fontSize="11">$vectorSearch (Cosine &gt; 0.92)</text>
            <text x="280" y="140" textAnchor="middle" fill="#38bdf8" fontSize="10">TTL: 7 Days Expiry</text>

            {/* Cache Hit Branch */}
            <path d="M280 70 L280 25 L750 25 L750 80" stroke="#06b6d4" strokeWidth="2" strokeDasharray="3 3" />
            <text x="470" y="20" textAnchor="middle" fill="#06b6d4" fontSize="11" fontWeight="bold">⚡ Cache Hit (Sub-50ms Bypass)</text>

            {/* Cache Miss Arrow */}
            <path d="M360 115 L410 115" stroke="#10b981" strokeWidth="2" />

            {/* Retrieval Block */}
            <rect x="410" y="60" width="170" height="110" rx="12" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
            <text x="495" y="90" textAnchor="middle" fill="#10b981" fontSize="13" fontWeight="bold">Hybrid Retrieval</text>
            <text x="495" y="112" textAnchor="middle" fill="#cbd5e1" fontSize="11">1. $vectorSearch (HNSW)</text>
            <text x="495" y="130" textAnchor="middle" fill="#cbd5e1" fontSize="11">2. $search (BM25 Lucene)</text>
            <text x="495" y="152" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="bold">RRF Rank Fusion Merger</text>

            {/* Arrow to LLM */}
            <path d="M580 115 L640 115" stroke="#10b981" strokeWidth="2" />

            {/* Guardrails + LLM Block */}
            <rect x="640" y="70" width="150" height="90" rx="12" fill="#1e293b" stroke="#8b5cf6" strokeWidth="2" />
            <text x="715" y="102" textAnchor="middle" fill="#c084fc" fontSize="13" fontWeight="bold">Gemini 1.5 Flash</text>
            <text x="715" y="122" textAnchor="middle" fill="#94a3b8" fontSize="11">Shielded Prompt Context</text>
            <text x="715" y="140" textAnchor="middle" fill="#94a3b8" fontSize="10">Injection Defense</text>

            {/* Arrow to Streaming Output */}
            <path d="M790 115 L830 115" stroke="#10b981" strokeWidth="2" />

            {/* Streaming Output */}
            <rect x="830" y="80" width="60" height="70" rx="12" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
            <text x="860" y="115" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold">Citations</text>
            <text x="860" y="132" textAnchor="middle" fill="#64748b" fontSize="10">Stream</text>
          </svg>
        </div>
      </div>

      {/* MongoDB Concepts Demonstrated Table */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-slate-100">
            MongoDB Advanced Concepts Demonstrated
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
              <tr>
                <th className="py-3 px-4 font-semibold">MongoDB Feature</th>
                <th className="py-3 px-4 font-semibold">Implementation Detail</th>
                <th className="py-3 px-4 font-semibold">Code Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {concepts.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-emerald-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {item.concept}
                  </td>
                  <td className="py-3 px-4 text-slate-300 leading-relaxed">{item.description}</td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{item.files}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
