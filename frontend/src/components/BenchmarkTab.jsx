import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  BookOpen,
  Pencil,
  Zap,
  Flame,
  Shuffle,
  Trash2,
  HardDrive,
  Cpu,
  Check,
  Star,
  Eraser,
  Download,
  Maximize2,
} from "lucide-react";
import {
  mockDisks,
  benchmarkStages,
  mockResults,
  mockLogLines,
} from "../mock/mockData";

const ICONS = { BookOpen, Pencil, Zap, Flame, Shuffle };

const COLOR_CLASS = {
  green: { glow: "glow-green", bar: "bar-green", text: "text-emerald-400", star: "text-emerald-400" },
  yellow: { glow: "glow-yellow", bar: "bar-yellow", text: "text-yellow-400", star: "text-yellow-400" },
  cyan: { glow: "glow-cyan", bar: "bar-cyan", text: "text-cyan-300", star: "text-cyan-300" },
  purple: { glow: "glow-purple", bar: "bar-purple", text: "text-fuchsia-400", star: "text-fuchsia-400" },
  orange: { glow: "glow-orange", bar: "bar-orange", text: "text-orange-400", star: "text-orange-400" },
};

function DiskCard({ disk, selected, onClick }) {
  const barColor = disk.usedPercent > 60 ? "bar-yellow" : "bar-green";
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left neo-panel-soft p-4 hover:border-cyan-500/40 transition-colors ${
        selected ? "disk-selected" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-slate-100 font-mono text-sm">{disk.path}</div>
          <div className="text-slate-500 text-xs mt-1">{disk.label}</div>
        </div>
        {selected ? (
          <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400/70 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-cyan-300" />
          </div>
        ) : (
          <span
            className={`badge-type ${
              disk.type === "SSD" ? "badge-ssd" : "badge-hdd"
            }`}
          >
            {disk.type}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={`badge-type ${
            disk.type === "SSD" ? "badge-ssd" : "badge-hdd"
          }`}
        >
          {disk.type}
        </span>
        <span className="text-xs text-slate-400">{disk.usedPercent}% usado</span>
      </div>
      <div className="bar-track mt-2">
        <div
          className={`bar-fill ${barColor}`}
          style={{ width: `${disk.usedPercent}%` }}
        />
      </div>
    </button>
  );
}

function StatCard({ label, value, unit, accent = "text-slate-100" }) {
  return (
    <div className="neo-panel-soft px-4 py-3">
      <div className="section-label">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className={`text-2xl md:text-3xl font-semibold ${accent}`}>
          {value}
        </div>
        {unit && (
          <div className="text-xs text-slate-500 tracking-wider">{unit}</div>
        )}
      </div>
    </div>
  );
}

function StarRow({ count, colorKey }) {
  const cls = COLOR_CLASS[colorKey]?.star || "text-slate-400";
  return (
    <div className="flex gap-1 mt-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i <= count ? cls : "text-slate-700"}`}
          fill={i <= count ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}

export default function BenchmarkTab({ selectedDisk, setSelectedDisk }) {
  const disk = useMemo(
    () => mockDisks.find((d) => d.id === selectedDisk) || mockDisks[0],
    [selectedDisk]
  );
  const results = mockResults[disk.id];

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(-1);
  const [logs, setLogs] = useState([]);
  const timerRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const startBenchmark = (onlyStage = null) => {
    if (running) return;
    clearInterval(timerRef.current);
    setRunning(true);
    setLogs([]);
    setProgress(0);

    const stagesToRun =
      onlyStage === null
        ? benchmarkStages.map((_, i) => i)
        : [benchmarkStages.findIndex((s) => s.key === onlyStage)];

    let step = 0;
    const total = stagesToRun.length * 10;
    let logIdx = 0;

    setCurrentStage(stagesToRun[0]);

    timerRef.current = setInterval(() => {
      step += 1;
      const pct = Math.min(100, Math.round((step / total) * 100));
      setProgress(pct);

      const stageIdxInRun = Math.min(
        stagesToRun.length - 1,
        Math.floor(step / 10)
      );
      setCurrentStage(stagesToRun[stageIdxInRun]);

      if (logIdx < mockLogLines.length && step % 2 === 0) {
        setLogs((prev) => [...prev, mockLogLines[logIdx]]);
        logIdx += 1;
      }

      if (step >= total) {
        clearInterval(timerRef.current);
        setRunning(false);
        setCurrentStage(stagesToRun[stagesToRun.length - 1]);
      }
    }, 300);
  };

  const clearTestFile = () => {
    setLogs((prev) => [...prev, "[info] Arquivo de teste removido: /tmp/ssdbench.test"]);
  };

  const clearLog = () => setLogs([]);

  const progressStageIdx =
    currentStage >= 0 ? currentStage : running ? 0 : -1;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* LEFT: Disk selection */}
      <div className="col-span-12 lg:col-span-3 space-y-3">
        <div className="section-label mb-2">Selecionar disco</div>
        {mockDisks.map((d) => (
          <DiskCard
            key={d.id}
            disk={d}
            selected={d.id === disk.id}
            onClick={() => setSelectedDisk(d.id)}
          />
        ))}
      </div>

      {/* CENTER */}
      <div className="col-span-12 lg:col-span-6 space-y-5">
        {/* Disk info */}
        <div className="neo-panel p-5">
          <div className="section-label mb-4">Informações do disco</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Dispositivo"
              value={disk.path}
              accent="text-slate-100 text-base md:text-lg font-mono"
            />
            <StatCard label="Espaço total" value={disk.totalTB} unit="TB" />
            <StatCard label="Espaço livre" value={disk.freeTB} unit="TB" />
            <div className="neo-panel-soft px-4 py-3">
              <div className="section-label">Uso atual</div>
              <div className="mt-2 text-2xl md:text-3xl font-semibold text-slate-100">
                {disk.usedPercent}%
              </div>
              <div className="bar-track mt-2">
                <div
                  className={`bar-fill ${
                    disk.usedPercent > 60 ? "bar-yellow" : "bar-green"
                  }`}
                  style={{ width: `${disk.usedPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-cyan-300" />
              <span>{disk.model}</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-fuchsia-300" />
              <span>{disk.interface}</span>
            </div>
            <div>Rotação: <span className="text-slate-300">{disk.rotation}</span></div>
          </div>
        </div>

        {/* Status / Progress */}
        <div className="neo-panel p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full bg-emerald-400 ${
                  running ? "pulse-dot" : ""
                }`}
              />
              <div className="text-sm tracking-widest text-slate-300">
                STATUS:{" "}
                <span className="text-slate-100 font-semibold">
                  {running ? "EXECUTANDO TESTES…" : progress === 100 ? "CONCLUÍDO" : "PRONTO"}
                </span>
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Etapa{" "}
              <span className="text-slate-200 font-semibold">
                {Math.max(1, progressStageIdx + 1)}
              </span>{" "}
              / {benchmarkStages.length}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="tracking-widest">PROGRESSO GERAL</span>
              <span className="text-cyan-300 font-semibold">{progress}%</span>
            </div>
            <div className="bar-track h-2">
              <div
                className="bar-fill bar-cyan"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stages */}
          <div className="mt-6">
            <div className="section-label mb-3">Etapas do benchmark</div>
            <div className="flex items-center justify-between">
              {benchmarkStages.map((s, i) => {
                const Icon = ICONS[s.icon];
                let state = "pending";
                if (progressStageIdx > i) state = "done";
                else if (progressStageIdx === i && running) state = "active";
                else if (!running && progress === 100) state = "done";
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center relative">
                    <div className={`stage-circle ${state}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="mt-2 text-[11px] tracking-wider text-slate-400 uppercase">
                      {s.label}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      {state === "done" && (
                        <span className="text-emerald-400">✓ Concluído</span>
                      )}
                      {state === "active" && (
                        <span className="text-yellow-400">Executando…</span>
                      )}
                      {state === "pending" && (
                        <span className="text-slate-500">Aguardando</span>
                      )}
                    </div>
                    {i < benchmarkStages.length - 1 && (
                      <div className="step-line absolute top-5 left-[60%] right-[-40%]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="neo-panel p-5">
          <div className="section-label mb-4">Resultados</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {benchmarkStages.map((s) => {
              const r = results[s.key];
              const c = COLOR_CLASS[r.color];
              const labelMap = {
                seq_read: "Leitura Sequencial",
                seq_write: "Escrita Sequencial",
                rand_read: "Leitura Aleatória",
                rand_write: "Escrita Aleatória",
                mixed: "Mixed R/W (70/30)",
              };
              return (
                <div key={s.key} className="result-card">
                  <div className="section-label">{labelMap[s.key]}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <div className={`text-3xl font-bold ${c.glow}`}>
                      {r.value}
                    </div>
                    <div className="text-[11px] text-slate-400 tracking-wider uppercase">
                      {r.unit}
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400 space-y-0.5">
                    <div>
                      Latência:{" "}
                      <span className="text-slate-200">{r.latency} μs</span>
                    </div>
                    <div>
                      P99: <span className="text-slate-200">{r.p99} ms</span>
                    </div>
                  </div>
                  <div className="bar-track mt-3">
                    <div
                      className={`bar-fill ${c.bar}`}
                      style={{ width: `${(r.rating / 5) * 100}%` }}
                    />
                  </div>
                  <StarRow count={r.rating} colorKey={r.color} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal */}
        <div className="neo-panel p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="section-label">Log em tempo real</div>
            <div className="flex items-center gap-2">
              <button className="btn-subtle !w-auto !py-1.5 !px-3 text-xs">
                <Download className="w-3.5 h-3.5" />
                Exportar log
              </button>
              <button
                onClick={clearLog}
                className="btn-subtle !w-auto !py-1.5 !px-3 text-xs"
              >
                <Eraser className="w-3.5 h-3.5" />
                Limpar
              </button>
              <button className="btn-subtle !w-auto !py-1.5 !px-3 text-xs">
                <Maximize2 className="w-3.5 h-3.5" />
                Tela cheia
              </button>
            </div>
          </div>
          <div ref={logRef} className="terminal">
            {logs.length === 0 ? (
              <div className="text-slate-600">
                Aguardando execução do benchmark…
              </div>
            ) : (
              logs.map((l, i) => (
                <div key={i} className="ln">
                  {l}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Actions */}
      <div className="col-span-12 lg:col-span-3 space-y-3">
        <div className="section-label mb-2">Executar testes</div>
        <button
          onClick={() => startBenchmark(null)}
          disabled={running}
          className="btn-run"
        >
          <Play className="w-4 h-4" />
          RODAR TODOS OS TESTES
        </button>
        <button
          onClick={() => startBenchmark("seq_read")}
          disabled={running}
          className="btn-subtle"
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Leitura Sequencial
        </button>
        <button
          onClick={() => startBenchmark("seq_write")}
          disabled={running}
          className="btn-subtle"
        >
          <Pencil className="w-4 h-4 text-yellow-400" />
          Escrita Sequencial
        </button>
        <button
          onClick={() => startBenchmark("rand_read")}
          disabled={running}
          className="btn-subtle"
        >
          <Zap className="w-4 h-4 text-cyan-300" />
          Leitura Aleatória
        </button>
        <button
          onClick={() => startBenchmark("rand_write")}
          disabled={running}
          className="btn-subtle"
        >
          <Flame className="w-4 h-4 text-fuchsia-400" />
          Escrita Aleatória
        </button>
        <button
          onClick={() => startBenchmark("mixed")}
          disabled={running}
          className="btn-subtle"
        >
          <Shuffle className="w-4 h-4 text-orange-400" />
          Mixed R/W
        </button>

        <div className="h-px bg-slate-800/80 my-3" />

        <button onClick={clearTestFile} className="btn-danger">
          <Trash2 className="w-4 h-4" />
          Limpar arquivo de teste
        </button>
      </div>
    </div>
  );
}
