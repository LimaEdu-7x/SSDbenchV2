# SSDBench Contracts

## REST Endpoints (prefix `/api`)

### Disks
- `GET /disks` -> `{ disks: Disk[] }`
  - Disk: `{ id, path, label, type: 'SSD'|'HDD'|'FILE', totalBytes, freeBytes, usedPercent, model, rotation, interface, readable, writable }`
  - Lists physical block devices via `lsblk -J -b`; always appends a synthetic FILE target (`/data/ssdbench.test`) that works anywhere.

### Benchmark
- `POST /benchmark/start` -> `{ job_id }`
  - body: `{ target: path, stages?: string[], preset: 'fast'|'medium'|'full', rwmix?: 70 }`
  - Stages: `seq_read, seq_write, rand_read, rand_write, mixed`.
- `GET /benchmark/{job_id}` -> full job state with parsed results per stage
- `POST /benchmark/{job_id}/stop` -> cancels running fio
- `POST /benchmark/clear-test-file` -> removes `/data/ssdbench.test`
- `WS /benchmark/ws/{job_id}` -> streams events:
  - `{type:'log', line}`
  - `{type:'progress', overall, stageIdx, stageKey, stagePct}`
  - `{type:'stage_result', stageKey, result}`
  - `{type:'done', history_id}`
  - `{type:'error', message}`

### History
- `GET /history` -> `{ items: HistoryItem[] }`
- `DELETE /history/{id}` -> 204
- `GET /history/export` -> JSON file download

## Data Models
- HistoryItem: `{ id, date, disk, type, results: { [stage]: {value, unit, latency_us, p99_ms, rating} }, score }`

## Mock Replacement
- `mockData.mockDisks` -> replaced by `GET /disks`
- `mockData.mockResults` -> computed live from fio output per job
- `mockData.mockHistory` -> replaced by `GET /history`
- `mockData.mockLogLines` -> replaced by WebSocket stream

## Frontend Integration
- `BenchmarkTab`:
  - On mount: fetch `/disks`, auto-select first readable disk
  - `startBenchmark`: POST `/benchmark/start`, open WebSocket, render logs, progress, stages
  - Polling fallback: GET `/benchmark/{job_id}` every 2s if WS closed
  - After `done` event: refresh history (if on history tab)
- `HistoryTab`: fetch `/history`; delete via API; export via API
- Added preset selector (Fast/Medium/Full) and live WS indicator

## fio Command Blueprints (medium preset)
- `seq_read`: `fio --name=seqread --rw=read --bs=1M --size=512M --direct={0|1} --filename=TARGET --output-format=json --time_based=0`
- `seq_write`: `--rw=write --bs=1M --size=512M ...`
- `rand_read`: `--rw=randread --bs=4k --iodepth=32 --runtime=20 --time_based=1 --size=512M`
- `rand_write`: `--rw=randwrite --bs=4k --iodepth=32 --runtime=20 --time_based=1 --size=512M`
- `mixed`: `--rw=randrw --rwmixread=70 --bs=4k --iodepth=32 --runtime=20 --time_based=1 --size=512M`

## Presets
- `fast`: size=128M, runtime=8s
- `medium`: size=512M, runtime=20s (default)
- `full`: size=2G, runtime=45s
