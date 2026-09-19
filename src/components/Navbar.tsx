"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MessageSquare,
  BarChart3,
  Scale,
  Info,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const [health, setHealth] = useState<{
    status: string;
    pingLatencyMs?: number;
  } | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHealth({
          status: data.status,
          pingLatencyMs: data.database?.pingLatencyMs,
        });
      } catch {
        setHealth({ status: "error" });
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: "/", label: "Chat & Grounding", icon: MessageSquare },
    { href: "/analytics", label: "Analytics Pipelines", icon: BarChart3 },
    { href: "/eval", label: "Hybrid Evaluation", icon: Scale },
    { href: "/about", label: "Architecture & Schema", icon: Info },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
            <Database className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                DocMind
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
                MongoDB RAG
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Atlas Vector & Hybrid Search with RRF
            </p>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Atlas Cluster Live Status Badge */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            {health?.status === "healthy" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-medium">Atlas Connected</span>
                {health.pingLatencyMs !== undefined && (
                  <span className="text-slate-500 text-[11px]">({health.pingLatencyMs}ms)</span>
                )}
              </>
            ) : health?.status === "error" ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400 font-medium">Fallback Active</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                <span className="text-slate-400">Connecting...</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
