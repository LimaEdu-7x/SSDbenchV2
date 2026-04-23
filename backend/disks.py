"""Disk enumeration via lsblk with FILE fallback target."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict, Any

FILE_TARGET_PATH = "/data/ssdbench.test"


def _humanize_tb(b: int) -> float:
    return round(b / (1024 ** 4), 2)


def _get_mount_free(path: str) -> int:
    try:
        st = shutil.disk_usage(path)
        return st.free
    except Exception:
        return 0


def _get_mount_total(path: str) -> int:
    try:
        st = shutil.disk_usage(path)
        return st.total
    except Exception:
        return 0


def _check_rw(path: str) -> (bool, bool):
    readable = os.access(path, os.R_OK)
    writable = os.access(path, os.W_OK)
    return readable, writable


def list_block_devices() -> List[Dict[str, Any]]:
    """Run lsblk -J and return top level disks."""
    try:
        out = subprocess.check_output(
            [
                "lsblk",
                "-J",
                "-b",
                "-o",
                "NAME,SIZE,TYPE,MODEL,ROTA,TRAN,MOUNTPOINT",
            ],
            stderr=subprocess.DEVNULL,
            timeout=5,
        )
        data = json.loads(out)
    except Exception:
        return []

    disks = []
    for dev in data.get("blockdevices", []):
        if dev.get("type") != "disk":
            continue
        name = dev.get("name")
        path = f"/dev/{name}"
        size = int(dev.get("size") or 0)
        rota = bool(dev.get("rota"))
        tran = (dev.get("tran") or "unknown").upper()
        model = (dev.get("model") or "Unknown Disk").strip()

        readable, writable = _check_rw(path)

        # Approx used: sum of children mountpoints usage if any; else 0
        used_bytes = 0
        free_bytes = 0
        for child in dev.get("children", []) or []:
            mp = child.get("mountpoint")
            if mp and os.path.exists(mp):
                try:
                    st = shutil.disk_usage(mp)
                    used_bytes += (st.total - st.free)
                    free_bytes += st.free
                except Exception:
                    pass

        total_bytes = size
        if free_bytes == 0:
            # Unknown free; assume 50% used placeholder
            used_percent = 0
        else:
            used_percent = int(min(100, max(0, (used_bytes / total_bytes) * 100))) if total_bytes else 0

        disks.append(
            {
                "id": name,
                "path": path,
                "label": f"{_humanize_tb(total_bytes)} TB {'SSD' if not rota else 'HDD'}",
                "type": "SSD" if not rota else "HDD",
                "totalBytes": total_bytes,
                "freeBytes": free_bytes if free_bytes else max(0, total_bytes - used_bytes),
                "usedPercent": used_percent,
                "model": model or ("NVMe SSD" if tran == "NVME" else "Disk"),
                "rotation": "Solid State" if not rota else "Rotational",
                "interface": tran,
                "readable": readable,
                "writable": writable,
            }
        )
    return disks


def file_target() -> Dict[str, Any]:
    """Synthetic FILE target so benchmark always works."""
    directory = os.path.dirname(FILE_TARGET_PATH)
    try:
        Path(directory).mkdir(parents=True, exist_ok=True)
    except Exception:
        directory = "/tmp"
    total = _get_mount_total(directory)
    free = _get_mount_free(directory)
    used = max(0, total - free)
    used_pct = int(min(100, (used / total) * 100)) if total else 0
    return {
        "id": "file-target",
        "path": FILE_TARGET_PATH,
        "label": "Arquivo de teste (no container)",
        "type": "FILE",
        "totalBytes": total,
        "freeBytes": free,
        "usedPercent": used_pct,
        "model": "Test file (fallback)",
        "rotation": "—",
        "interface": "FILE",
        "readable": True,
        "writable": True,
    }


def all_targets() -> List[Dict[str, Any]]:
    targets = list_block_devices()
    targets.append(file_target())
    return targets
