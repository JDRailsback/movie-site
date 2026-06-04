"""Import progress over Redis pub/sub -> SSE (PLAN §5).

The worker publishes stage events to `import:{id}`; the API's SSE endpoint
subscribes and forwards them to the browser as text/event-stream.
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

CHANNEL = "import:{import_id}"
DONE_MARKER = "__done__"


def _channel(import_id: str) -> str:
    return CHANNEL.format(import_id=import_id)


async def publish(redis: Any, import_id: str, event: dict[str, Any]) -> None:
    await redis.publish(_channel(import_id), json.dumps(event))


async def subscribe(redis: Any, import_id: str) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted frames for an import until a terminal event arrives."""
    pubsub = redis.pubsub()
    await pubsub.subscribe(_channel(import_id))
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            yield f"data: {data}\n\n"
            event = json.loads(data)
            if event.get("status") in ("ready", "failed"):
                break
    finally:
        await pubsub.unsubscribe(_channel(import_id))
        await pubsub.aclose()
