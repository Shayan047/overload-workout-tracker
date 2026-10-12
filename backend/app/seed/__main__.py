"""`python -m app.seed`: load or refresh the exercise library. Safe to run on every start."""

import asyncio

from app.db.session import SessionLocal, engine
from app.seed.exercises import seed_exercises


async def main() -> None:
    async with SessionLocal() as session:
        result = await seed_exercises(session)
    await engine.dispose()
    print(
        f"Exercise library: {result.inserted} inserted, {result.updated} updated, "
        f"{result.unchanged} unchanged, {result.removed} removed"
    )


if __name__ == "__main__":
    asyncio.run(main())
