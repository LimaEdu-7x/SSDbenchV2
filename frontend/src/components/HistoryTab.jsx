import { useState } from "react";
import { Search, Trash2, ArrowUpDown } from "lucide-react";
import { mockHistory } from "../mock/mockData";

export default function HistoryTab() {
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [rows, setRows] = useState(mockHistory);

  const filtered = rows
    .filter(
      (r) =>
        r.disk.toLowerCase().includes(query.toLowerCase()) ||
        r.type.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score));

  const remove = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="neo-panel p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div>
          <div className="section-label">Histórico de benchmarks</div>
          <div className="text-slate-300 text-lg mt-1">
            {filtered.length} execuções registradas
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/70 rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar disco ou tipo…"
              className="bg-transparent outline-none text-sm text-slate-200 placeholder:text-slate-500 w-52"
            />
          </div>
          <button
            onClick={() => setSortAsc((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-sm transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Score {sortAsc ? "↑" : "↓"}
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] tracking-widest text-slate-400 uppercase">
              <th className="py-3 px-3">Data</th>
              <th className="py-3 px-3">Disco</th>
              <th className="py-3 px-3">Tipo</th>
              <th className="py-3 px-3">Leitura seq.</th>
              <th className="py-3 px-3">Escrita seq.</th>
              <th className="py-3 px-3">Leitura aleat.</th>
              <th className="py-3 px-3">Escrita aleat.</th>
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
                <td className="py-3 px-3 text-slate-400 font-mono text-xs">
                  {r.date}
                </td>
                <td className="py-3 px-3 text-slate-100 font-mono">{r.disk}</td>
                <td className="py-3 px-3">
                  <span
                    className={`badge-type ${
                      r.type === "SSD" ? "badge-ssd" : "badge-hdd"
                    }`}
                  >
                    {r.type}
                  </span>
                </td>
                <td className="py-3 px-3 text-emerald-400">{r.seq_read}</td>
                <td className="py-3 px-3 text-yellow-400">{r.seq_write}</td>
                <td className="py-3 px-3 text-cyan-300">{r.rand_read}</td>
                <td className="py-3 px-3 text-fuchsia-400">{r.rand_write}</td>
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
