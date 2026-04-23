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
  Wifi,
  WifiOff,
  Square,
  AlertTriangle,
} from "lucide-react";
import {
  fetchDisks,
  startBenchmark,
  stopJob,
  clearTestFile,
  openBenchmarkWS,
} from "../api/client";

const ICONS = { BookOpen, Pencil, Zap, Flame, Shuffle };
const STAGE_ORDER = ["seq_read", "seq_write", "rand_read", "rand_write", "mixed"];
const STAGE_META = {
  seq_read: { label: "Leitura Seq.", full: "Leitura Sequencial", icon: "BookOpen", color: "green" },
  seq_write: { label: "Escrita Seq.", full: "Escrita Sequencial", icon: "Pencil", color: "yellow" },
  rand_read: { label: "Leitura Aleat.", full: "Leitura Aleatória", icon: "Zap", color: "cyan" },
  rand_write: { label: "Escrita Aleat.", full: "Escrita Aleatória", icon: "Flame", color: "purple" },
  mixed: { label: "Mixed R/W", full: "Mixed R/W (70/30)", icon: "Shuffle", color: "orange" },
};

const COLOR_CLASS = {
  green: { glow: "glow-green", bar: "bar-green", star: "text-emerald-400" },
  yellow: { glow: "glow-yellow", bar: "bar-yellow", star: "text-yellow-400" },
  cyan: { glow: "glow-cyan", bar: "bar-cyan", star: "text-cyan-300" },
  purple: { glow: "glow-purple", bar: "bar-purple", star: "text-fuchsia-400" },
  orange: { glow: "glow-orange", bar: "bar-orange", star: "text-orange-400" },
};

function humanTB(bytes) {
  if (!bytes) return "0 GB";
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

function DiskCard({ disk, selected, onClick }) {
  const barColor = disk.usedPercent > 60 ? "bar-yellow" : "bar-green";
  const typeBadge =
    disk.type === "SSD" ? "badge-ssd" : disk.type === "HDD" ? "badge-hdd" : "badge-ssd";
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left neo-panel-soft p-4 hover:border-cyan-500/40 transition-colors ${
        selected ? "disk-selected" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-slate-100 font-mono text-sm truncate">{disk.path}</div>
          <div className="text-slate-500 text-xs mt-1">
            {disk.type === "FILE"
              ? "Teste em arquivo"
              : `${humanTB(disk.totalBytes)} ${disk.type}`}
          </div>
        </div>
        {selected ? (
          <div className="w-6 h-6 shrink-0 rounded-full bg-cyan-500/20 border border-cyan-400/70 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-cyan-300" />
          </div>
        ) : (
          <span className={`badge-type ${typeBadge}`}>{disk.type}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`badge-type ${typeBadge}`}>{disk.type}</span>
        <span className="text-xs text-slate-400">{disk.usedPercent}% usado</span>
      </div>
      <div className="bar-track mt-2">
        <div className={`bar-fill ${barColor}`} style={{ width: `${disk.usedPercent}%` }} />
      </div>
      {disk.type !== "FILE" && !disk.readable && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-400/90">
          <AlertTriangle className="w-3 h-3" />
          sem permissão direta (Docker privilegiado)
        </div>
      )}
    </button>
  );
}

function StatCard({ label, value, unit, accent = "text-slate-100" }) {
  return (
    <div className="neo-panel-soft px-4 py-3">
      <div className="section-label">{label}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className={`text-2xl md:text-3xl font-semibold ${accent}`}>{value}</div>
        {unit && <div className="text-xs text-slate-500 tracking-wider">{unit}</div>}
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

export default function BenchmarkTab({ selectedDiskPath, setSelectedDiskPath, onHistoryChanged }) {
  const [disks, setDisks] = useState([]);
  const [loadingDisks, setLoadingDisks] = useState(true);
  const [preset, setPreset] = useState("medium");
  const [jobId, setJobId] = useState(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("PRONTO");
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(-1);
  const [stagePct, setStagePct] = useState(0);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const logRef = useRef(null);

  const selectedDisk = useMemo(
    () => disks.find((d) => d.path === selectedDiskPath) || disks[0],
    [disks, selectedDiskPath]
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchDisks();
        setDisks(data.disks || []);
        if (!selectedDiskPath && data.disks?.length) {
          const pick =
            data.disks.find((d) => d.readable && d.writable) ||
            data.disks.find((d) => d.type === "FILE") ||
            data.disks[0];
          setSelectedDiskPath(pick.path);
        }
      } catch (e) {
        setError("Falha ao listar discos");
      } finally {
        setLoadingDisks(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch { /* noop */ }
      }
    };
  }, []);

  const resetState = () => {
    setLogs([]);
    setResults({});
    setProgress(0);
    setStagePct(0);
    setStageIdx(-1);
    setStatus("INICIANDO…");
    setError(null);
  };

  const runBenchmark = async (onlyStage = null) => {
    if (!selectedDisk) return;
    if (running) return;
    if (selectedDisk.type !== "FILE" && !selectedDisk.readable) {
      setError("Sem permissão no device — use o preset em arquivo ou Docker privilegiado");
      return;
    }
    resetState();
    setRunning(true);
    try {
      const payload = {
        target: selectedDisk.path,
        preset,
        stages: onlyStage ? [onlyStage] : STAGE_ORDER,
      };
      const { job_id } = await startBenchmark(payload);
      setJobId(job_id);
      setStatus("EXECUTANDO TESTES…");
      const ws = openBenchmarkWS(job_id, {
        onOpen: () => setWsConnected(true),
        onClose: () => setWsConnected(false),
        onError: () => setWsConnected(false),
        onEvent: (evt) => {
          if (evt.type === "log") {
            setLogs((prev) => [...prev, evt.line].slice(-2000));
          } else if (evt.type === "progress") {
            setProgress(evt.overall);
            setStageIdx(evt.stageIdx);
            setStagePct(evt.stagePct);
          } else if (evt.type === "stage_start") {
            setStageIdx(evt.stageIdx);
            setStagePct(0);
          } else if (evt.type === "stage_result") {
            setResults((prev) => ({ ...prev, [evt.stageKey]: evt.result }));
            setProgress(evt.overall);
          } else if (evt.type === "snapshot") {
            const s = evt.state || {};
            if (s.results) setResults(s.results);
            if (typeof s.overall === "number") setProgress(s.overall);
            if (typeof s.stage_idx === "number") setStageIdx(s.stage_idx);
          } else if (evt.type === "done") {
            setRunning(false);
            setStatus(
              evt.status === "done" ? "CONCLUÍDO" : (evt.status || "FINALIZADO").toUpperCase()
            );
            if (evt.status === "done") setProgress(100);
            if (onHistoryChanged) onHistoryChanged();
          } else if (evt.type === "error") {
            setError(evt.message);
            setRunning(false);
            setStatus("ERRO");
          }
        },
      });
      wsRef.current = ws;
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Erro ao iniciar benchmark");
      setRunning(false);
      setStatus("ERRO");
    }
  };

  const stopCurrent = async () => {
    if (!jobId) return;
    try {
      await stopJob(jobId);
    } catch { /* noop */ }
  };

  const handleClearTestFile = async () => {
    try {
      const res = await clearTestFile();
      setLogs((prev) => [
        ...prev,
        res.removed ? `[info] Arquivo removido: ${res.path}` : `[info] Nenhum arquivo em ${res.path}`,
      ]);
    } catch (e) {
      setError("Falha ao remover arquivo");
    }
  };

  const clearLog = () => setLogs([]);

  const exportLog = () => {
    const blob = new Blob([logs.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ssdbench_log_${jobId || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressStageIdx = stageIdx;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* LEFT: Disk selection */}
      <div className="col-span-12 lg:col-span-3">
        <div className="flex items-center justify-between mb-2">
          <div className="section-label">Selecionar disco</div>
          <div className="text-[11px] text-slate-500">{disks.length} alvos</div>
        </div>
        <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
          {loadingDisks && <div className="text-slate-500 text-sm">Carregando discos…</div>}
          {disks.map((d) => (
            <DiskCard
              key={d.path}
              disk={d}
              selected={d.path === selectedDisk?.path}
              onClick={() => setSelectedDiskPath(d.path)}
            />
          ))}
        </div>
      </div>

      {/* CENTER */}
      <div className="col-span-12 lg:col-span-6 space-y-5">
        {/* Disk info */}
        <div className="neo-panel p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="section-label">Informações do disco</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="section-label">Preset</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-700/70">
                {["fast", "medium", "full"].map((p) => (
                  <button
                    key={p}
                    disabled={running}
                    onClick={() => setPreset(p)}
                    className={`px-3 py-1.5 text-[11px] tracking-widest uppercase transition-colors disabled:opacity-60 ${
                      preset === p
                        ? "bg-cyan-500/20 text-cyan-200"
                        : "bg-slate-900/60 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p === "fast" ? "Rápido" : p === "medium" ? "Médio" : "Completo"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {selectedDisk ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard
                  label="Dispositivo"
                  value={selectedDisk.path}
                  accent="text-slate-100 text-base md:text-lg font-mono"
                />
                <StatCard label="Espaço total" value={humanTB(selectedDisk.totalBytes)} />
                <StatCard label="Espaço livre" value={humanTB(selectedDisk.freeBytes)} />
                <div className="neo-panel-soft px-4 py-3">
                  <div className="section-label">Uso atual</div>
                  <div className="mt-2 text-2xl md:text-3xl font-semibold text-slate-100">
                    {selectedDisk.usedPercent}%
                  </div>
                  <div className="bar-track mt-2">
                    <div
                      className={`bar-fill ${
                        selectedDisk.usedPercent > 60 ? "bar-yellow" : "bar-green"
                      }`}
                      style={{ width: `${selectedDisk.usedPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{selectedDisk.model}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-fuchsia-300" />
                  <span>{selectedDisk.interface}</span>
                </div>
                <div>
                  Rotação: <span className="text-slate-300">{selectedDisk.rotation}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-slate-500">Nenhum disco disponível</div>
          )}
        </div>

        {/* Status / Progress */}
        <div className="neo-panel p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`w-3 h-3 rounded-full bg-emerald-400 ${running ? "pulse-dot" : ""}`}
              />
              <div className="text-sm tracking-widest text-slate-300">
                STATUS: <span className="text-slate-100 font-semibold">{status}</span>
              </div>
              <div
                className={`ml-3 flex items-center gap-1 text-[11px] ${
                  wsConnected ? "text-emerald-400" : "text-slate-500"
                }`}
              >
                {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                {wsConnected ? "WS conectado" : "WS offline"}
              </div>
            </div>
            <div className="text-xs text-slate-400">
              Etapa{" "}
              <span className="text-slate-200 font-semibold">
                {Math.max(1, progressStageIdx + 1)}
              </span>{" "}
              / {STAGE_ORDER.length}
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="tracking-widest">PROGRESSO GERAL</span>
              <span className="text-cyan-300 font-semibold">{progress}%</span>
            </div>
            <div className="bar-track h-2">
              <div className="bar-fill bar-cyan" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="mt-6">
            <div className="section-label mb-3">Etapas do benchmark</div>
            <div className="flex items-center justify-between">
              {STAGE_ORDER.map((key, i) => {
                const Icon = ICONS[STAGE_META[key].icon];
                let state = "pending";
                if (progressStageIdx > i) state = "done";
                else if (progressStageIdx === i && running) state = "active";
                else if (results[key]) state = "done";
                else if (!running && progress === 100) state = "done";
                return (
                  <div key={key} className="flex-1 flex flex-col items-center relative">
                    <div className={`stage-circle ${state}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="mt-2 text-[11px] tracking-wider text-slate-400 uppercase text-center">
                      {STAGE_META[key].label}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      {state === "done" && <span className="text-emerald-400">✓ Concluído</span>}
                      {state === "active" && (
                        <span className="text-yellow-400">{stagePct}%…</span>
                      )}
                      {state === "pending" && <span className="text-slate-500">Aguardando</span>}
                    </div>
                    {i < STAGE_ORDER.length - 1 && (
                      <div className="step-line absolute top-5 left-[60%] right-[-40%]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/5 border border-red-500/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="neo-panel p-5">
          <div className="section-label mb-4">Resultados</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {STAGE_ORDER.map((key) => {
              const r = results[key];
              const meta = STAGE_META[key];
              const c = COLOR_CLASS[meta.color];
              return (
                <div key={key} className="result-card">
                  <div className="section-label">{meta.full}</div>
                  {r ? (
                    <>
                      <div className="mt-3 flex items-baseline gap-1">
                        <div className={`text-3xl font-bold ${c.glow}`}>{r.value}</div>
                        <div className="text-[11px] text-slate-400 tracking-wider uppercase">
                          {r.unit}
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-slate-400 space-y-0.5">
                        <div>
                          Latência:{" "}
                          <span className="text-slate-200">{r.latency_us} μs</span>
                        </div>
                        <div>
                          P99: <span className="text-slate-200">{r.p99_ms} ms</span>
                        </div>
                      </div>
                      <div className="bar-track mt-3">
                        <div
                          className={`bar-fill ${c.bar}`}
                          style={{ width: `${((r.rating || 0) / 5) * 100}%` }}
                        />
                      </div>
                      <StarRow count={r.rating || 0} colorKey={meta.color} />
                    </>
                  ) : (
                    <div className="mt-6 text-sm text-slate-600">— aguardando —</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal */}
        <div className="neo-panel p-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="section-label">Log em tempo real</div>
            <div className="flex items-center gap-2">
              <button onClick={exportLog} className="btn-subtle !w-auto !py-1.5 !px-3 text-xs">
                <Download className="w-3.5 h-3.5" />
                Exportar log
              </button>
              <button onClick={clearLog} className="btn-subtle !w-auto !py-1.5 !px-3 text-xs">
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
              <div className="text-slate-600">Aguardando execução do benchmark…</div>
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
        {running ? (
          <button onClick={stopCurrent} className="btn-danger">
            <Square className="w-4 h-4" />
            Parar execução
          </button>
        ) : (
          <button onClick={() => runBenchmark(null)} disabled={!selectedDisk} className="btn-run">
            <Play className="w-4 h-4" />
            RODAR TODOS OS TESTES
          </button>
        )}
        <button onClick={() => runBenchmark("seq_read")} disabled={running || !selectedDisk} className="btn-subtle">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Leitura Sequencial
        </button>
        <button onClick={() => runBenchmark("seq_write")} disabled={running || !selectedDisk} className="btn-subtle">
          <Pencil className="w-4 h-4 text-yellow-400" />
          Escrita Sequencial
        </button>
        <button onClick={() => runBenchmark("rand_read")} disabled={running || !selectedDisk} className="btn-subtle">
          <Zap className="w-4 h-4 text-cyan-300" />
          Leitura Aleatória
        </button>
        <button onClick={() => runBenchmark("rand_write")} disabled={running || !selectedDisk} className="btn-subtle">
          <Flame className="w-4 h-4 text-fuchsia-400" />
          Escrita Aleatória
        </button>
        <button onClick={() => runBenchmark("mixed")} disabled={running || !selectedDisk} className="btn-subtle">
          <Shuffle className="w-4 h-4 text-orange-400" />
          Mixed R/W
        </button>

        <div className="h-px bg-slate-800/80 my-3" />

        <button onClick={handleClearTestFile} className="btn-danger">
          <Trash2 className="w-4 h-4" />
          Limpar arquivo de teste
        </button>
      </div>
    </div>
  );
}
