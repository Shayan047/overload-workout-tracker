from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import auth, bodyweight, exercises, health, settings, splits, workouts
from app.core.config import require_jwt_secret
from app.db.session import engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    require_jwt_secret()  # fail at boot, not at the first sign-in
    yield
    await engine.dispose()


app = FastAPI(title="Overload API", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(exercises.router)
app.include_router(splits.router)
app.include_router(settings.router)
app.include_router(workouts.router)
app.include_router(bodyweight.router)
