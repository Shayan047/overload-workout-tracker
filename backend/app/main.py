from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    bodyweight,
    exercises,
    health,
    settings,
    splits,
    stats,
    workouts,
)
from app.core.config import get_settings, require_jwt_secret
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    require_jwt_secret()  # fail at boot, not at the first sign-in
    yield
    await engine.dispose()


app = FastAPI(title="Overload API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    # Tokens travel in the Authorization header, never in cookies.
    allow_credentials=False,
)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(splits.router)
app.include_router(settings.router)
app.include_router(workouts.router)
app.include_router(bodyweight.router)
app.include_router(stats.router)
