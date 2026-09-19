"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  Zap,
  Clock,
  FileText,
  HelpCircle,
  TrendingUp,
  Database,
  RefreshCw,
  Layers,
} from "lucide-react";
import { AnalyticsSummary } from "@/lib/analytics/aggregation";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"all" | "session">("all");

  async function loadAnalytics(currentScope: "all" | "session") {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?scope=${currentScope}`);
      const json = await res.json();
      if (json.metrics) {
        setData(json.metrics);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(scope);
  }, [scope]);

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-slate-100">Analytics & Aggregations</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time metrics calculated via MongoDB Aggregation Pipelines (
            <code className="text-emerald-300 font-mono">$facet</code>,{" "}
            <code className="text-emerald-300 font-mono">$group</code>,{" "}
            <code className="text-emerald-300 font-mono">$bucket</code>,{" "}
            <code className="text-emerald-300 font-mono">$lookup</code>,{" "}
            <code className="text-emerald-300 font-mono">$dateTrunc</code>).
          </p>
        </div>

        {/* Scope and Refresh Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setScope("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                scope === "all"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              All Data
            </button>
            <button
              onClick={() => setScope("session")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                scope === "session"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              My Session
            </button>
          </div>

          <button
            onClick={() => loadAnalytics(scope)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Queries */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Queries</span>
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-100">{data?.totalQueries ?? 0}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">$facet &gt; $group sum</p>
          </div>
        </div>

        {/* Card 2: Cache Hit Rate */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Semantic Cache Hit Rate</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-100">
              {data ? (data.cacheHitRate * 100).toFixed(1) : 0}%
            </p>
            <p className="text-[11px] text-cyan-400/80 mt-0.5">
              {data?.cacheHits ?? 0} hits (Cosine &gt; 0.92)
            </p>
          </div>
        </div>

        {/* Card 3: Average Latency */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Average Latency</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-100">{data?.avgLatencyMs ?? 0} ms</p>
            <p className="text-[11px] text-emerald-400/80 mt-0.5">$facet &gt; $avg</p>
          </div>
        </div>

        {/* Card 4: Documents Ingested */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Active Documents</span>
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold text-slate-100">{data?.totalDocuments ?? 0}</p>
            <p className="text-[11px] text-purple-400/80 mt-0.5">Vector & text indexed</p>
          </div>
        </div>
      </div>

      {/* Latency Buckets & Daily Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Distribution ($bucket) */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Latency Distribution (via $bucket)
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Aggregation Pipeline</span>
          </div>

          <div className="flex-1 min-h-[160px] flex flex-col justify-center space-y-3 pt-4">
            {(!data?.latencyBuckets || data.latencyBuckets.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No latency records yet. Ask a question to generate metrics!
              </p>
            ) : (
              data.latencyBuckets.map((bucket, i) => {
                const maxCount = Math.max(...data.latencyBuckets.map((b) => b.count), 1);
                const pct = (bucket.count / maxCount) * 100;

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span className="font-mono text-[11px]">{bucket.range}</span>
                      <span className="text-emerald-400 font-semibold">{bucket.count} queries</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Queries per Day ($dateTrunc) */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Queries Per Day (via $dateTrunc)
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Aggregation Pipeline</span>
          </div>

          <div className="flex-1 min-h-[160px] flex flex-col justify-center space-y-3 pt-4">
            {(!data?.queriesPerDay || data.queriesPerDay.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No query timeline data available.
              </p>
            ) : (
              data.queriesPerDay.map((day, i) => {
                const maxCount = Math.max(...data.queriesPerDay.map((d) => d.count), 1);
                const pct = (day.count / maxCount) * 100;

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span className="font-mono text-[11px]">{day.date}</span>
                      <span className="text-cyan-400 font-semibold">{day.count} queries</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 5)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Most-Cited Documents & Unanswered Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Cited Documents ($unwind, $group, $lookup) */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Most-Cited Documents ($lookup joined)
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">$unwind + $lookup</span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {(!data?.mostCitedDocuments || data.mostCitedDocuments.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No documents cited yet.
              </p>
            ) : (
              data.mostCitedDocuments.map((doc, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-xs font-mono text-slate-500 w-4">#{idx + 1}</span>
                    <p className="text-xs font-medium text-slate-200 truncate">{doc.source}</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    {doc.citationCount} citation{doc.citationCount > 1 ? "s" : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Unanswered Questions (Guardrails Triggered) */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Unanswered Queries (Guardrails Triggered)
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Knowledge Gaps</span>
          </div>

          <div className="divide-y divide-slate-800/60 mt-2">
            {(!data?.unansweredQuestions || data.unansweredQuestions.length === 0) ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No unanswered queries found. All retrieved queries met the guardrail threshold!
              </p>
            ) : (
              data.unansweredQuestions.map((q, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-300 italic truncate">&ldquo;{q.question}&rdquo;</p>
                  <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                    {q.date}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
