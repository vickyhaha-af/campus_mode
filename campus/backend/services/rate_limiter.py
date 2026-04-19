"""
Async token-bucket rate limiter.

Used by the profile enricher to stay under Gemini free-tier limits
(15 RPM on Flash 2.0, higher on embeddings). Callers `await limiter.acquire()`
before each rate-bound API call.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass


@dataclass
class TokenBucket:
    rate_per_minute: int
    capacity: int
    _tokens: float = 0.0
    _last_refill: float = 0.0

    def __post_init__(self) -> None:
        self._tokens = float(self.capacity)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, n: int = 1) -> None:
        """Block until `n` tokens are available, then consume them."""
        async with self._lock:
            while True:
                now = time.monotonic()
                elapsed = now - self._last_refill
                refill = elapsed * (self.rate_per_minute / 60.0)
                if refill > 0:
                    self._tokens = min(self.capacity, self._tokens + refill)
                    self._last_refill = now
                if self._tokens >= n:
                    self._tokens -= n
                    return
                # Wait for the deficit to accrue.
                deficit = n - self._tokens
                wait = deficit / (self.rate_per_minute / 60.0)
                await asyncio.sleep(max(wait, 0.05))
