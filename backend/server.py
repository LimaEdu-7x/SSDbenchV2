from __future__ import annotations

import asyncio
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from benchmark import (
    PRESETS,
    STAGES,
    STAGE_COLOR,
    STAGE_LABELS,
    manager,
    score_from_results,
)
from disks import FILE_TARGET_PATH, all_targets
from history import HistoryStore

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
history_store = HistoryStore(db)

app = FastAPI(title="SSDBench API")
api = APIRouter(prefix="/api")


# -------- Models --------
class StartBenchmarkRequest(BaseModel):
    target: str
    preset: str = Field(default="medium")
    stages: Optional[List[str]] = None


class StartBenchmarkResponse(BaseModel):
    job_id: str


# -------- Health --------
@api.get("/")
async def root():
    return {"message": "SSDBench API", "fio": shutil.which("fio") is not None}


# -------- Disks --------
@api.get("/disks")
async def get_disks():
    return {"disks": all_targets()}


# -------- Benchmark --------
@api.post("/benchmark/start", response_model=StartBenchmarkResponse)
async def start_benchmark(req: StartBenchmarkRequest):
    if req.preset not in PRESETS:
        raise HTTPException(400, f"invalid preset, allowed: {list(PRESETS)}")
    stages = req.stages or STAGES
    for s in stages:
        if s not in STAGES:
            raise HTTPException(400, f"invalid stage {s}")

    if not shutil.which("fio"):
        raise HTTPException(500, "fio binary not found in backend container")

    job = manager.create(target=req.target, stages=stages, preset=req.preset)

    async def _launch():
        await manager.run(job)
        if job.status == "done":
            doc = {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
                "disk": job.target,
                "type": _infer_type(job.target),
                "preset": job.preset,
                "results": job.results,
                "score": score_from_results(job.results),
            }
            hid = await history_store.add(doc)
            job.history_id = hid

    asyncio.create_task(_launch())
    return StartBenchmarkResponse(job_id=job.job_id)


def _infer_type(target: str) -> str:
    if target == FILE_TARGET_PATH or not target.startswith("/dev/"):
        return "FILE"
    for d in all_targets():
        if d["path"] == target:
            return d["type"]
    return "DISK"


@api.get("/benchmark/{job_id}")
async def get_job(job_id: str):
    job = manager.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job.public()


@api.post("/benchmark/{job_id}/stop")
async def stop_job(job_id: str):
    ok = await manager.cancel(job_id)
    if not ok:
        raise HTTPException(400, "cannot cancel")
    return {"ok": True}


@api.post("/benchmark/clear-test-file")
async def clear_test_file():
    removed = False
    try:
        if os.path.exists(FILE_TARGET_PATH):
            os.remove(FILE_TARGET_PATH)
            removed = True
    except Exception as e:
        raise HTTPException(500, f"failed to remove: {e}")
    return {"removed": removed, "path": FILE_TARGET_PATH}


# -------- WebSocket --------
@api.websocket("/benchmark/ws/{job_id}")
async def ws_benchmark(ws: WebSocket, job_id: str):
    await ws.accept()
    q = await manager.attach_listener(job_id)
    if q is None:
        await ws.send_json({"type": "error", "message": "job not found"})
        await ws.close()
        return
    try:
        while True:
            try:
                evt = await asyncio.wait_for(q.get(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "ping"})
                continue
            await ws.send_json(evt)
            if evt.get("type") == "done":
                break
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        manager.detach_listener(job_id, q)
        try:
            await ws.close()
        except Exception:
            pass


# -------- History --------
@api.get("/history")
async def list_history():
    items = await history_store.list()
    return {"items": items}


@api.delete("/history/{item_id}")
async def delete_history(item_id: str):
    deleted = await history_store.delete(item_id)
    if not deleted:
        raise HTTPException(404, "not found")
    return {"ok": True}


@api.get("/history/export")
async def export_history():
    items = await history_store.list(limit=1000)
    return JSONResponse(
        {"exported_at": datetime.now(timezone.utc).isoformat(), "items": items},
        headers={
            "Content-Disposition": "attachment; filename=ssdbench_history.json"
        },
    )


# -------- Metadata --------
@api.get("/meta")
async def meta():
    return {
        "presets": PRESETS,
        "stages": [
            {"key": s, "label": STAGE_LABELS[s], "color": STAGE_COLOR[s]}
            for s in STAGES
        ],
        "file_target": FILE_TARGET_PATH,
    }


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
