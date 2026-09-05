from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any, Dict, Optional

from app.services.chat.types import CacheProvider


@dataclass
class _CacheItem:
    value: Any
    expires_at: float


class InMemoryTTLCache(CacheProvider):
    def __init__(self, default_ttl_seconds: int = 120, max_items: int = 512) -> None:
        self.default_ttl_seconds = default_ttl_seconds
        self.max_items = max_items
        self._items: Dict[str, _CacheItem] = {}
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        now = monotonic()
        with self._lock:
            item = self._items.get(key)
            if not item:
                return None
            if item.expires_at < now:
                self._items.pop(key, None)
                return None
            return item.value

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None) -> None:
        expires_at = monotonic() + float(ttl_seconds or self.default_ttl_seconds)
        with self._lock:
            if len(self._items) >= self.max_items:
                oldest_key = min(self._items, key=lambda cache_key: self._items[cache_key].expires_at)
                self._items.pop(oldest_key, None)
            self._items[key] = _CacheItem(value=value, expires_at=expires_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._items.pop(key, None)


def build_cache_key(*parts: object) -> str:
    return "::".join("" if part is None else str(part) for part in parts)


chat_cache = InMemoryTTLCache()
