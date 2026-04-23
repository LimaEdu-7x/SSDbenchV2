"""Async fio benchmark runner with WebSocket event fan-out."""
from __future__ import annotations

import asyncio
import json
import os
import shlex
import stat
import subprocess
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from disks import FILE_TARGET_PATH

STAGES = ["seq_read", "seq_write", "rand_read", "rand_write", "mixed"]

PRESETS = {
    "fast": {"size": "128M", "runtime": 8},
    "medium": {"size": "512M", "runtime": 20},
    "full": {"size": "2G", "runtime": 45},
}

STAGE_LABELS = {
    "seq_read": "Leitura Sequencial",
    "seq_write": "Escrita Sequencial",
    "rand_read": "Leitura Aleatória",
    "rand_write": "Escrita Aleatória",
    "mixed": "Mixed R/W (70/30)",
}

STAGE_COLOR = {
    "seq_read": "green",
    "seq_write": "yellow",
    "rand_read": "cyan",
    "rand_write": "purple",
    "mixed": "orange",
}


def is_block_device(path: str) -> bool:
    try:
        return stat.S_ISBLK(os.stat(path).st_mode)
    except Exception:
        return False


def ensure_file_target_dir():
    directory = os.path.dirname(FILE_TARGET_PATH)
    try:
        Path(directory).mkdir(parents=True, exist_ok=True)
    except Exception:
        pass


_SIZE_UNITS = {"K": 1024, "M": 1024 ** 2, "G": 1024 ** 3}


def _parse_size(s: str) -> int:
    s = s.strip().upper()
    if s[-1] in _SIZE_UNITS:
        return int(float(s[:-1]) * _SIZE_UNITS[s[-1]])
    return int(s)


def ensure_file_has_size(path: str, size_str: str) -> None:
    """Ensure a regular file exists with at least `size_str` bytes (for read tests)."""
    if is_block_device(path):
        return
    size = _parse_size(size_str)
    try:
        current = os.path.getsize(path) if os.path.exists(path) else 0
    except OSError:
        current = 0
    if current >= size:
        return
    # Create/extend with zeroes (fast via truncate, but we need real data for read perf)
    # Use dd from /dev/urandom only if small; otherwise zero-fill via truncate is fine for throughput read.
    try:
        with open(path, "ab") as f:
            to_write = size - current
            # write in 4MB chunks of zeros
            chunk = b"\0" * (4 * 1024 * 1024)
            while to_write > 0:
                n = min(len(chunk), to_write)
                f.write(chunk[:n])
                to_write -= n
    except Exception:
        pass


def build_fio_args(stage: str, target: str, preset: str) -> List[str]:
    cfg = PRESETS.get(preset, PRESETS["medium"])
    size = cfg["size"]
    runtime = cfg["runtime"]
    is_block = is_block_device(target)
    direct = "1" if is_block else "0"

    base = [
        "fio",
        f"--name=ssdbench_{stage}",
        f"--filename={target}",
        f"--direct={direct}",
        "--ioengine=psync",
        "--group_reporting=1",
        "--output-format=json",
        "--status-interval=1",
    ]
    # Do not pre-create for block device.
    if not is_block:
        base.append("--create_on_open=1")

    if stage == "seq_read":
        return base + [
            "--rw=read",
            "--bs=1M",
            f"--size={size}",
            "--iodepth=8",
        ]
    if stage == "seq_write":
        return base + [
            "--rw=write",
            "--bs=1M",
            f"--size={size}",
            "--iodepth=8",
        ]
    if stage == "rand_read":
        return base + [
            "--rw=randread",
            "--bs=4k",
            "--iodepth=32",
            "--ioengine=libaio" if is_block else "--ioengine=psync",
            f"--size={size}",
            f"--runtime={runtime}",
            "--time_based=1",
        ]
    if stage == "rand_write":
        return base + [
            "--rw=randwrite",
            "--bs=4k",
            "--iodepth=32",
            "--ioengine=libaio" if is_block else "--ioengine=psync",
            f"--size={size}",
            f"--runtime={runtime}",
            "--time_based=1",
        ]
    if stage == "mixed":
        return base + [
            "--rw=randrw",
            "--rwmixread=70",
            "--bs=4k",
            "--iodepth=32",
            "--ioengine=libaio" if is_block else "--ioengine=psync",
            f"--size={size}",
            f"--runtime={runtime}",
            "--time_based=1",
        ]
    raise ValueError(f"unknown stage {stage}")


def parse_fio_json(out: str, stage: str) -> Dict[str, Any]:
    """Parse fio JSON output into a simplified result."""
    try:
        # fio with status-interval prints multiple JSON docs; take last full one.
        # Find last '{' that starts a valid parse.
        out = out.strip()
        # Try naive last-JSON split: parse successive objects
        decoder = json.JSONDecoder()
        idx = 0
        last = None
        while idx < len(out):
            while idx < len(out) and out[idx] not in "{":
                idx += 1
            if idx >= len(out):
                break
            try:
                obj, end = decoder.raw_decode(out[idx:])
                last = obj
                idx += end
            except Exception:
                idx += 1
        data = last
        if not data:
            return {}
        job = data["jobs"][0]
        read = job.get("read", {})
        write = job.get("write", {})

        def pick(metric):
            if stage in ("seq_read", "rand_read"):
                return read
            if stage in ("seq_write", "rand_write"):
                return write
            # mixed -> combine: prefer total io
            return None

        if stage == "mixed":
            r_iops = read.get("iops", 0)
            w_iops = write.get("iops", 0)
            iops = r_iops + w_iops
            lat_ns = (read.get("clat_ns", {}).get("mean", 0) + write.get("clat_ns", {}).get("mean", 0)) / 2
            p99_ns = max(
                read.get("clat_ns", {}).get("percentile", {}).get("99.000000", 0),
                write.get("clat_ns", {}).get("percentile", {}).get("99.000000", 0),
            )
            value_k = round(iops / 1000.0, 2) if iops >= 1000 else round(iops / 1000.0, 3)
            unit = "K IOPS"
            value = value_k
        elif stage in ("seq_read", "seq_write"):
            target = pick(None)
            bw_bytes_per_s = target.get("bw_bytes", target.get("bw", 0) * 1024)
            gbps = bw_bytes_per_s / (1024 ** 3)
            if gbps >= 1:
                value = round(gbps, 2)
                unit = "GB/s"
            else:
                value = round(bw_bytes_per_s / (1024 ** 2), 1)
                unit = "MB/s"
            lat_ns = target.get("clat_ns", {}).get("mean", 0)
            p99_ns = target.get("clat_ns", {}).get("percentile", {}).get("99.000000", 0)
        else:  # rand_read / rand_write
            target = pick(None)
            iops = target.get("iops", 0)
            if iops >= 1000:
                value = round(iops / 1000.0, 2)
                unit = "K IOPS"
            else:
                value = round(iops / 1000.0, 3)
                unit = "K IOPS"
            lat_ns = target.get("clat_ns", {}).get("mean", 0)
            p99_ns = target.get("clat_ns", {}).get("percentile", {}).get("99.000000", 0)

        latency_us = round(lat_ns / 1000.0, 1) if lat_ns else 0
        p99_ms = round(p99_ns / 1_000_000.0, 2) if p99_ns else 0

        rating = rating_for(stage, value, unit)
        return {
            "value": value,
            "unit": unit,
            "latency_us": latency_us,
            "p99_ms": p99_ms,
            "rating": rating,
            "color": STAGE_COLOR[stage],
        }
    except Exception as e:
        return {"error": str(e), "color": STAGE_COLOR[stage], "value": 0, "unit": "-", "latency_us": 0, "p99_ms": 0, "rating": 0}


def rating_for(stage: str, value: float, unit: str) -> int:
    """Heuristic 1-5 rating."""
    if stage in ("seq_read", "seq_write"):
        # GB/s thresholds
        if unit == "GB/s":
            if value >= 3: return 5
            if value >= 2: return 4
            if value >= 1: return 3
            if value >= 0.5: return 2
            return 1
        # MB/s
        if value >= 500: return 3
        if value >= 250: return 2
        return 1
    # IOPS in K
    if value >= 300: return 5
    if value >= 150: return 4
    if value >= 50: return 3
    if value >= 5: return 2
    return 1


def score_from_results(results: Dict[str, Any]) -> int:
    total = 0
    for st, r in results.items():
        if not r or r.get("error"):
            continue
        v = r.get("value", 0)
        u = r.get("unit", "")
        if u == "GB/s":
            total += int(v * 1000)
        elif u == "MB/s":
            total += int(v)
        elif u == "K IOPS":
            total += int(v * 10)
    return total


@dataclass
class JobState:
    job_id: str
    target: str
    preset: str
    stages: List[str]
    status: str = "queued"  # queued|running|done|error|cancelled
    stage_idx: int = -1
    stage_pct: int = 0
    overall: int = 0
    logs: List[str] = field(default_factory=list)
    results: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    started_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    history_id: Optional[str] = None
    _proc: Optional[asyncio.subprocess.Process] = None
    _listeners: List[asyncio.Queue] = field(default_factory=list)
    _cancelled: bool = False

    def public(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "target": self.target,
            "preset": self.preset,
            "stages": self.stages,
            "status": self.status,
            "stage_idx": self.stage_idx,
            "stage_pct": self.stage_pct,
            "overall": self.overall,
            "results": self.results,
            "error": self.error,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "history_id": self.history_id,
            "logs_tail": self.logs[-200:],
        }


class BenchmarkManager:
    def __init__(self):
        self.jobs: Dict[str, JobState] = {}

    def get(self, job_id: str) -> Optional[JobState]:
        return self.jobs.get(job_id)

    def create(self, target: str, stages: List[str], preset: str) -> JobState:
        job_id = uuid.uuid4().hex[:12]
        job = JobState(job_id=job_id, target=target, preset=preset, stages=stages)
        self.jobs[job_id] = job
        return job

    async def _emit(self, job: JobState, event: Dict[str, Any]):
        dead = []
        for q in job._listeners:
            try:
                await q.put(event)
            except Exception:
                dead.append(q)
        for d in dead:
            try:
                job._listeners.remove(d)
            except ValueError:
                pass

    async def attach_listener(self, job_id: str) -> Optional[asyncio.Queue]:
        job = self.get(job_id)
        if not job:
            return None
        q: asyncio.Queue = asyncio.Queue()
        job._listeners.append(q)
        # send snapshot
        await q.put({"type": "snapshot", "state": job.public()})
        return q

    def detach_listener(self, job_id: str, q: asyncio.Queue):
        job = self.get(job_id)
        if not job:
            return
        try:
            job._listeners.remove(q)
        except ValueError:
            pass

    async def cancel(self, job_id: str) -> bool:
        job = self.get(job_id)
        if not job or job.status != "running":
            return False
        job._cancelled = True
        if job._proc and job._proc.returncode is None:
            try:
                job._proc.terminate()
            except ProcessLookupError:
                pass
        return True

    async def run(self, job: JobState):
        job.status = "running"
        total_stages = len(job.stages)
        await self._emit(job, {"type": "snapshot", "state": job.public()})
        try:
            for i, stage in enumerate(job.stages):
                if job._cancelled:
                    job.status = "cancelled"
                    break
                job.stage_idx = i
                job.stage_pct = 0
                await self._emit(
                    job,
                    {
                        "type": "stage_start",
                        "stageIdx": i,
                        "stageKey": stage,
                        "stageLabel": STAGE_LABELS[stage],
                    },
                )
                await self._run_stage(job, stage, i, total_stages)
                if job._cancelled:
                    job.status = "cancelled"
                    break
            if job.status != "cancelled":
                job.status = "done"
        except Exception as e:
            job.status = "error"
            job.error = str(e)
            await self._emit(job, {"type": "error", "message": str(e)})
        finally:
            job.finished_at = time.time()
            job.overall = 100 if job.status == "done" else job.overall
            await self._emit(job, {"type": "snapshot", "state": job.public()})
            await self._emit(job, {"type": "done", "status": job.status, "history_id": job.history_id})

    async def _run_stage(self, job: JobState, stage: str, idx: int, total: int):
        args = build_fio_args(stage, job.target, job.preset)
        cmd_str = " ".join(shlex.quote(a) for a in args)
        await self._push_log(job, f"$ {cmd_str}")

        ensure_file_target_dir()
        # For read-based stages on file targets we need pre-existing data
        if stage in ("seq_read", "rand_read") and not is_block_device(job.target):
            preset_cfg = PRESETS.get(job.preset, PRESETS["medium"])
            await self._push_log(job, f"[prepare] garantindo arquivo de {preset_cfg['size']} para leitura…")
            ensure_file_has_size(job.target, preset_cfg["size"])
        # Use combined stdout (json goes to stdout) with separate stderr for log text
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        job._proc = proc

        stdout_chunks: List[str] = []

        async def read_stderr():
            assert proc.stderr is not None
            while True:
                line = await proc.stderr.readline()
                if not line:
                    break
                text = line.decode(errors="ignore").rstrip("\n")
                await self._push_log(job, text)

        async def read_stdout():
            assert proc.stdout is not None
            buf = ""
            while True:
                chunk = await proc.stdout.read(4096)
                if not chunk:
                    break
                text = chunk.decode(errors="ignore")
                stdout_chunks.append(text)
                buf += text
                # Emit progress from interval JSON snapshots
                while True:
                    # Try to extract a full top-level JSON object from buf
                    start = buf.find("{")
                    if start < 0:
                        break
                    try:
                        decoder = json.JSONDecoder()
                        obj, end = decoder.raw_decode(buf[start:])
                        buf = buf[start + end:]
                        try:
                            jb = obj["jobs"][0]
                            eta = obj.get("eta") or 0
                            elapsed = obj.get("elapsed") or 0
                            job_runtime = max(1, elapsed + max(1, eta))
                            pct = int(min(99, (elapsed / job_runtime) * 100))
                            job.stage_pct = pct
                            job.overall = int(((idx + pct / 100.0) / total) * 100)
                            await self._emit(
                                job,
                                {
                                    "type": "progress",
                                    "overall": job.overall,
                                    "stageIdx": idx,
                                    "stageKey": stage,
                                    "stagePct": pct,
                                },
                            )
                        except Exception:
                            pass
                    except json.JSONDecodeError:
                        break

        await asyncio.gather(read_stdout(), read_stderr())
        rc = await proc.wait()
        full_out = "".join(stdout_chunks)

        if job._cancelled:
            await self._push_log(job, f"[stage {stage}] cancelado")
            return
        if rc != 0:
            await self._push_log(job, f"[stage {stage}] fio exit={rc}")
        result = parse_fio_json(full_out, stage)
        job.results[stage] = result
        job.stage_pct = 100
        job.overall = int(((idx + 1) / total) * 100)
        await self._emit(
            job,
            {
                "type": "stage_result",
                "stageIdx": idx,
                "stageKey": stage,
                "result": result,
                "overall": job.overall,
            },
        )

    async def _push_log(self, job: JobState, line: str):
        job.logs.append(line)
        if len(job.logs) > 2000:
            job.logs = job.logs[-2000:]
        await self._emit(job, {"type": "log", "line": line})


manager = BenchmarkManager()
