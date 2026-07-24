"""FastAPI application factory.

Phase 0: app boots, mounts routers, emits OpenAPI, exposes /health. Route bodies
are contract stubs (HTTP 501) until Phase 1/2 fill in logic — the schemas in
app/schemas are the single source of truth for the Next client (PHASE0 §4).
"""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from arq import create_pool
from arq.connections import RedisSettings
from arq.worker import Worker
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, feedback, health, imports, profiles, recommendations

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    app.state.redis = aioredis.from_url(settings.redis_url)
    app.state.arq = await create_pool(RedisSettings.from_dsn(settings.redis_url))

    worker: Worker | None = None
    worker_task: asyncio.Task[None] | None = None
    if settings.run_worker_in_process:
        from workers.arq_app import WorkerSettings

        worker = Worker(
            functions=WorkerSettings.functions,
            on_startup=WorkerSettings.on_startup,
            on_shutdown=WorkerSettings.on_shutdown,
            redis_settings=WorkerSettings.redis_settings,
            job_timeout=WorkerSettings.job_timeout,
            # uvicorn owns SIGINT/SIGTERM in this process, so the embedded
            # worker must not also register signal handlers.
            handle_signals=False,
        )
        worker_task = asyncio.create_task(worker.async_run())

    try:
        yield
    finally:
        if worker is not None and worker_task is not None:
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass
            await worker.close()
        await app.state.arq.aclose()
        await app.state.redis.aclose()


app = FastAPI(
    title="Film Recommendation API",
    version="0.1.0",
    description="Taste-driven film recommendations layered on Letterboxd data.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.app_base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(imports.router)
app.include_router(profiles.router)
app.include_router(recommendations.router)
app.include_router(feedback.router)
