import {
  BookOpen,
  Pencil,
  Zap,
  Flame,
  Shuffle,
  Clock,
  Info,
} from "lucide-react";
import { metricsGuide } from "../mock/mockData";

const ICONS = { BookOpen, Pencil, Zap, Flame, Shuffle, Clock };
const COLOR = {
  green: { text: "text-emerald-400", border: "border-emerald-500/30", glow: "shadow-[0_0_22px_rgba(74,222,128,0.15)]" },
  yellow: { text: "text-yellow-400", border: "border-yellow-500/30", glow: "shadow-[0_0_22px_rgba(250,204,21,0.15)]" },
  cyan: { text: "text-cyan-300", border: "border-cyan-500/30", glow: "shadow-[0_0_22px_rgba(34,211,238,0.15)]" },
  purple: { text: "text-fuchsia-400", border: "border-fuchsia-500/30", glow: "shadow-[0_0_22px_rgba(192,132,252,0.15)]" },
  orange: { text: "text-orange-400", border: "border-orange-500/30", glow: "shadow-[0_0_22px_rgba(251,146,60,0.15)]" },
  blue: { text: "text-sky-300", border: "border-sky-500/30", glow: "shadow-[0_0_22px_rgba(56,189,248,0.15)]" },
};

export default function MetricsGuideTab() {
  return (
    <div className="space-y-5">
      <div className="neo-panel p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Info className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="text-slate-100 text-lg font-semibold">
              Como interpretar as métricas
            </div>
            <div className="text-slate-400 text-sm mt-1 max-w-3xl">
              O SSDBench utiliza o <span className="text-slate-200">fio</span>{" "}
              (Flexible I/O Tester) para avaliar discos em diferentes cenários.
              Conheça o que cada teste significa e como usar os resultados para
              escolher ou diagnosticar seu armazenamento.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {metricsGuide.map((m) => {
          const Icon = ICONS[m.icon];
          const c = COLOR[m.color];
          return (
            <div
              key={m.title}
              className={`neo-panel-soft p-5 border ${c.border} ${c.glow} transition-transform hover:-translate-y-0.5`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg border ${c.border} flex items-center justify-center bg-slate-900/60`}
                >
                  <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                <div>
                  <div className={`font-semibold ${c.text}`}>{m.title}</div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500">
                    {m.unit}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-300 leading-relaxed">
                {m.description}
              </p>
              <div className="mt-4 text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                <span className="text-slate-500 tracking-widest uppercase text-[10px] mr-2">
                  Dica
                </span>
                {m.tip}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
