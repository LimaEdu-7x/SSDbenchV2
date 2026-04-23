import { useEffect, useState } from "react";
import { Search, Trash2, ArrowUpDown, Download } from "lucide-react";
import { fetchHistory, deleteHistory, exportHistoryUrl } from "../api/client";

const STAGE_UNITS = {
  seq_read: { label: "Leitura seq.", color: "text-emerald-400" },
  seq_write: { label: "Escrita seq.", color: "text-yellow-400" },
  rand_read: { label: "Leitura aleat.", color: "text-cyan-300" },
  rand_write: { label: "Escrita aleat.", color: "text-fuchsia-400" },
  mixed: { label: "Mixed R/W", color: "text-orange-400" },
};

function formatVal(r) {
  if (!r) return "—";
  return `${r.value} ${r.unit}`;
}

export default function HistoryTab({ reloadKey }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [diskFilter, setDiskFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchHistory();
      setItems(data.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [reloadKey]);

  const disks = Array.from(new Set(items.map((i) => i.disk)));
  const filtered = items
    .filter((i) => (diskFilter === "all" ? true : i.disk === diskFilter))
    .filter(
      (i) =>
        i.disk.toLowerCase().includes(query.toLowerCase()) ||
        (i.type || "").toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));

  const remove = async (id) => {
    await deleteHistory(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="neo-panel p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <div className="section-label">Histórico de benchmarks</div>
          <div className="text-slate-300 text-lg mt-1">
            {loading ? "Carregando…" : `${filtered.length} execuções`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={diskFilter}
            onChange={(e) => setDiskFilter(e.target.value)}
            className="bg-slate-900/60 border border-slate-700/70 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="all">Todos os discos</option>
            {disks.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/70 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-500 w-44"
            />
          </div>
          <button
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-sm transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Score {sortAsc ? "↑" : "↓"}
          </button>
          <a
            href={exportHistoryUrl()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </a>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-widest text-slate-400 uppercase">
              <th className="py-3 px-3">Data</th>
              <th className="py-3 px-3">Disco</th>
              <th className="py-3 px-3">Tipo</th>
              {Object.keys(STAGE_UNITS).map((k) => (
                <th key={k} className="py-3 px-3">
                  {STAGE_UNITS[k].label}
                </th>
              ))}
              <th className="py-3 px-3">Score</th>
              <th className="py-3 px-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-800/70 hover:bg-slate-900/40 transition-colors"
              >
                <td className="py-3 px-3 text-slate-400 font-mono text-xs">{r.date}</td>
                <td className="py-3 px-3 text-slate-100 font-mono">{r.disk}</td>
                <td className="py-3 px-3">
                  <span
                    className={`badge-type ${
                      r.type === "SSD" ? "badge-ssd" : r.type === "HDD" ? "badge-hdd" : "badge-ssd"
                    }`}
                  >
                    {r.type}
                  </span>
                </td>
                {Object.keys(STAGE_UNITS).map((k) => (
                  <td key={k} className={`py-3 px-3 ${STAGE_UNITS[k].color}`}>
                    {formatVal(r.results?.[k])}
                  </td>
                ))}
                <td className="py-3 px-3">
                  <span className="text-slate-100 font-semibold">{r.score}</span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    className="p-2 rounded-md hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-slate-500">
                  Nenhum registro ainda. Execute um benchmark para popular o histórico.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
