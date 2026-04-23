"""MongoDB-backed benchmark history."""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase


class HistoryStore:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db.benchmark_history

    async def add(self, item: Dict[str, Any]) -> str:
        _id = uuid.uuid4().hex
        doc = {"_id": _id, **item}
        await self.col.insert_one(doc)
        return _id

    async def list(self, limit: int = 200) -> List[Dict[str, Any]]:
        items = []
        async for d in self.col.find().sort("created_at", -1).limit(limit):
            d["id"] = d.pop("_id")
            items.append(d)
        return items

    async def delete(self, _id: str) -> int:
        r = await self.col.delete_one({"_id": _id})
        return r.deleted_count

    async def get(self, _id: str) -> Optional[Dict[str, Any]]:
        d = await self.col.find_one({"_id": _id})
        if d:
            d["id"] = d.pop("_id")
        return d
