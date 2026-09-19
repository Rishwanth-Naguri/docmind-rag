"use client";

import { useEffect, useState } from "react";
import {
  Scale,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Award,
  Layers,
  FileCheck,
} from "lucide-react";
import { EvalCaseRecord, EvalRunRecord } from "@/lib/types/database";

export default function EvalPage() {
  const [cases, setCases] = useState<EvalCaseRecord[]>([]);
  const [evalResult, setEvalResult] = useState<EvalRunRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCases();
  }, []);

  async function fetchCases() {
    try {
      const res = await fetch("/api/eval/cases");
      const json = await res.json();
      if (json.cases) {
        setCases(json.cases);
      }
    } catch (err) {
      console.error("Failed to fetch eval cases:", err);
    }
  }

  async function handleRunEval() {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topK: 5 }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to execute evaluation benchmark.");
      }

      setEvalResult(json.evaluation);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Evaluation failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-100">Hybrid Search Evaluation Benchmark</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Empirical comparison of Vector Search, Keyword Search, and Reciprocal Rank Fusion (RRF)
            Hit-Rate@K across the golden test suite stored in MongoDB (<code className="text-emerald-300">eval_cases</code>).
          </p>
        </div>

        <button
          onClick={handleRunEval}
          disabled={running}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Evaluating RAG Pipelines...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Run Eval Benchmark</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Benchmark Results Table */}
      {evalResult && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Comparative Retrieval Performance (Hit-Rate@K)
              </h2>
            </div>
            <span className="text-[11px] text-emerald-400 font-medium">
              Run Completed: {new Date(evalResult.createdAt).toLocaleTimeString()}
            </span>
          </div>

          <p className="text-xs text-slate-300 bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl">
            💡 <strong className="text-emerald-300">Benchmark Insight:</strong> {evalResult.summary}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                <tr>
                  <th className="py-3 px-4 font-semibold">Retrieval Method</th>
                  <th className="py-3 px-4 font-semibold">Hit-Rate@1</th>
                  <th className="py-3 px-4 font-semibold">Hit-Rate@3</th>
                  <th className="py-3 px-4 font-semibold">Hit-Rate@5</th>
                  <th className="py-3 px-4 font-semibold">Avg Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {/* Vector Only */}
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 px-4 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    Vector-Only ($vectorSearch)
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.vectorOnly.hitRateAt1 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.vectorOnly.hitRateAt3 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.vectorOnly.hitRateAt5 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {evalResult.results.vectorOnly.avgLatencyMs} ms
                  </td>
                </tr>

                {/* Keyword Only */}
                <tr className="hover:bg-slate-900/30 transition-colors">
                  <td className="py-3 px-4 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    Keyword-Only ($search)
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.keywordOnly.hitRateAt1 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.keywordOnly.hitRateAt3 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {(evalResult.results.keywordOnly.hitRateAt5 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {evalResult.results.keywordOnly.avgLatencyMs} ms
                  </td>
                </tr>

                {/* Hybrid RRF */}
                <tr className="bg-emerald-950/20 font-bold border-emerald-500/30 text-emerald-200">
                  <td className="py-3 px-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                    Hybrid RRF (Vector + Keyword) 🏆
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-300">
                    {(evalResult.results.hybridRrf.hitRateAt1 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-300">
                    {(evalResult.results.hybridRrf.hitRateAt3 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-300">
                    {(evalResult.results.hybridRrf.hitRateAt5 * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {evalResult.results.hybridRrf.avgLatencyMs} ms
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Detailed Question Verification */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Per-Question Hybrid Retrieval Breakdown
            </h3>
            <div className="space-y-2">
              {evalResult.results.hybridRrf.details.map((detail, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-slate-200">&ldquo;{detail.question}&rdquo;</p>
                    <p className="text-[11px] text-slate-400">
                      Expected Document:{" "}
                      <span className="text-emerald-400 font-mono">{detail.expectedSource}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {detail.hitAt1 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Hit@1
                      </span>
                    ) : detail.hitAt5 ? (
                      <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[10px] font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Hit@5
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-semibold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Missed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Golden Evaluation Cases Section */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">
              Golden Test Cases in MongoDB ({cases.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">eval_cases Collection</span>
        </div>

        {cases.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 space-y-2">
            <p>No evaluation test cases loaded yet.</p>
            <p className="text-[11px] text-slate-600">
              Run <code className="text-emerald-400 font-mono">npm run seed</code> in terminal to
              populate the golden set.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cases.map((c, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-200">{c.question}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono flex-shrink-0">
                    Case #{i + 1}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Target Ground Truth:{" "}
                  <span className="text-emerald-400 font-mono">{c.expectedSource}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
