import { useState } from "react";
import { Upload, RefreshCw } from "lucide-react";
import BenchmarkTab from "./BenchmarkTab";
import HistoryTab from "./HistoryTab";
import MetricsGuideTab from "./MetricsGuideTab";

const TABS = [
  { key: "benchmark", label: "Benchmark" },
  { key: "history", label: "Histórico" },
  { key: "guide", label: "Guia de Métricas" },
];

export default function SSDBenchApp() {
  const [tab, setTab] = useState("benchmark");
  const [selectedDisk, setSelectedDisk] = useState("nvme0n1");

  return (
    <div className="relative z-10 min-h-screen px-6 py-6 md:px-10 md:py-8">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-5">
          <div className="brand-logo">
            <span className="glow-cyan">S</span>
            <span className="brand-bench">SDBENCH</span>
          </div>
          <div className="hidden md:block h-8 w-px bg-slate-700/60" />
          <div className="text-slate-400 text-sm tracking-wide">
            Disk Benchmark Suite{" "}
            <span className="text-slate-500">— Docker Edition</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-sm transition-colors">
            <Upload className="w-4 h-4" />
            Exportar histórico
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-sm transition-colors">
            <RefreshCw className="w-4 h-4" />
            Atualizar discos
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-8 border-b border-slate-800/80 mb-6 px-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-item ${tab === t.key ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "benchmark" && (
        <BenchmarkTab
          selectedDisk={selectedDisk}
          setSelectedDisk={setSelectedDisk}
        />
      )}
      {tab === "history" && <HistoryTab />}
      {tab === "guide" && <MetricsGuideTab />}

      {/* Footer features strip */}
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-3 neo-panel-soft px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" />
          <span className="text-slate-300">Volumes persistentes</span>
        </div>
        <div className="flex items-center gap-3 neo-panel-soft px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.8)]" />
          <span className="text-slate-300">Interface moderna</span>
        </div>
        <div className="flex items-center gap-3 neo-panel-soft px-4 py-3">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          <span className="text-slate-300">Fácil de usar</span>
        </div>
      </div>
    </div>
  );
}
