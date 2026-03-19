import asyncio
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket


class HandoffHub:
    def __init__(self) -> None:
        self._org_clients: Dict[int, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, organization_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._org_clients[organization_id].add(websocket)

    async def disconnect(self, organization_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            clients = self._org_clients.get(organization_id)
            if not clients:
                return
            clients.discard(websocket)
            if not clients:
                self._org_clients.pop(organization_id, None)

    async def broadcast(self, organization_id: int, payload: dict) -> None:
        async with self._lock:
            clients = list(self._org_clients.get(organization_id, set()))

        stale = []
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:
                stale.append(ws)

        if stale:
            async with self._lock:
                current = self._org_clients.get(organization_id)
                if not current:
                    return
                for ws in stale:
                    current.discard(ws)
                if not current:
                    self._org_clients.pop(organization_id, None)


handoff_hub = HandoffHub()
