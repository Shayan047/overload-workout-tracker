import uuid
from datetime import date

from fastapi import APIRouter, Response, status
from pydantic import AwareDatetime
from sqlalchemy import select

from app.api.deps import CurrentUser, SessionDep
from app.api.errors import not_found_as_404
from app.models import Split, SplitDay, SplitDayExercise
from app.schemas.split import (
    FromPresetIn,
    NextDayOut,
    PresetDayOut,
    PresetExerciseOut,
    PresetOut,
    SplitDayDetail,
    SplitDayExerciseIn,
    SplitDayExerciseOut,
    SplitDayIn,
    SplitDayOut,
    SplitDetail,
    SplitIn,
    SplitOut,
)
from app.seed.exercises import library_exercise_id
from app.services import exercises, splits, sync
from app.services.presets import PRESET_LIST, PRESETS

router = APIRouter(tags=["splits"])


@router.get("/presets")
async def list_presets() -> list[PresetOut]:
    """Public, like the library: onboarding shows presets before the account exists."""
    return [
        PresetOut(
            key=p.key,
            name=p.name,
            summary=p.summary,
            repeat_mode=p.repeat_mode,
            days=[
                PresetDayOut(
                    name=d.name,
                    weekday=d.weekday,
                    exercises=[
                        PresetExerciseOut(
                            exercise_id=library_exercise_id(e.source_id),
                            rest_seconds=e.rest_seconds,
                        )
                        for e in d.exercises
                    ],
                )
                for d in p.days
            ],
        )
        for p in PRESET_LIST
    ]


async def _detail(session: SessionDep, split: Split) -> SplitDetail:
    tree = await splits.split_tree(session, split)
    return SplitDetail(
        **SplitOut.model_validate(split).model_dump(),
        days=[
            SplitDayDetail(
                **SplitDayOut.model_validate(day).model_dump(),
                exercises=[SplitDayExerciseOut.model_validate(e) for e in tree.exercises[day.id]],
            )
            for day in tree.days
        ],
    )


# Splits


@router.get("/splits")
async def list_splits(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[SplitOut]:
    rows = await session.scalars(
        select(Split)
        .where(Split.user_id == user.id, sync.pull_filter(Split, updated_since))
        .order_by(Split.created_at, Split.id)
    )
    return [SplitOut.model_validate(row) for row in rows]


@router.get("/splits/{split_id}")
async def get_split(split_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> SplitDetail:
    with not_found_as_404("Split"):
        split = await splits.require_split(session, split_id, user.id)
        if split.deleted_at is not None:
            raise sync.NotFoundError
    return await _detail(session, split)


@router.put("/splits/{split_id}")
async def put_split(
    split_id: uuid.UUID, body: SplitIn, user: CurrentUser, session: SessionDep
) -> SplitOut:
    with not_found_as_404("Split"):
        row = await sync.upsert(session, Split, split_id, {"user_id": user.id}, body.model_dump())
    await session.commit()
    return SplitOut.model_validate(row)


@router.delete("/splits/{split_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split(split_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    """Also deletes the split's days and their exercises, and clears it as the active split."""
    await splits.delete_split(session, split_id, user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/splits/{split_id}/from-preset")
async def create_split_from_preset(
    split_id: uuid.UUID, body: FromPresetIn, user: CurrentUser, session: SessionDep
) -> SplitDetail:
    """Creates the split at `split_id` from a preset. Idempotent: if the split already exists
    nothing changes. Day ids are uuid5(split_id, "day:{i}") and day exercise ids
    uuid5(split_id, "day:{i}:exercise:{j}"), so the phone can create one offline."""
    with not_found_as_404("Split"):
        await splits.create_from_preset(session, user.id, split_id, PRESETS[body.preset])
    await session.commit()
    split = await splits.require_split(session, split_id, user.id)
    return await _detail(session, split)


@router.get("/splits/{split_id}/next-day")
async def get_next_day(
    split_id: uuid.UUID, on: date, user: CurrentUser, session: SessionDep
) -> NextDayOut:
    """The day to train on `on` (the phone's local date). In order: the day after the last
    finished one, whatever the date. Set weekdays: the day for `on`'s weekday, or null."""
    with not_found_as_404("Split"):
        split = await splits.require_split(session, split_id, user.id)
    day = await splits.next_day_for(session, split, on)
    return NextDayOut(split_id=split.id, day=SplitDayOut.model_validate(day) if day else None)


# Split days


@router.get("/split-days")
async def list_split_days(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[SplitDayOut]:
    rows = await session.scalars(
        select(SplitDay)
        .where(SplitDay.user_id == user.id, sync.pull_filter(SplitDay, updated_since))
        .order_by(SplitDay.split_id, SplitDay.position, SplitDay.created_at, SplitDay.id)
    )
    return [SplitDayOut.model_validate(row) for row in rows]


@router.put("/split-days/{day_id}")
async def put_split_day(
    day_id: uuid.UUID, body: SplitDayIn, user: CurrentUser, session: SessionDep
) -> SplitDayOut:
    with not_found_as_404("Split day"):
        await sync.require_owned(session, Split, body.split_id, user.id)
        row = await sync.upsert(session, SplitDay, day_id, {"user_id": user.id}, body.model_dump())
    await session.commit()
    return SplitDayOut.model_validate(row)


@router.delete("/split-days/{day_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split_day(day_id: uuid.UUID, user: CurrentUser, session: SessionDep) -> Response:
    """Also deletes the day's exercises."""
    await splits.delete_split_day(session, day_id, user.id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Split day exercises


@router.get("/split-day-exercises")
async def list_split_day_exercises(
    user: CurrentUser, session: SessionDep, updated_since: AwareDatetime | None = None
) -> list[SplitDayExerciseOut]:
    rows = await session.scalars(
        select(SplitDayExercise)
        .where(
            SplitDayExercise.user_id == user.id,
            sync.pull_filter(SplitDayExercise, updated_since),
        )
        .order_by(
            SplitDayExercise.split_day_id,
            SplitDayExercise.position,
            SplitDayExercise.created_at,
            SplitDayExercise.id,
        )
    )
    return [SplitDayExerciseOut.model_validate(row) for row in rows]


@router.put("/split-day-exercises/{row_id}")
async def put_split_day_exercise(
    row_id: uuid.UUID, body: SplitDayExerciseIn, user: CurrentUser, session: SessionDep
) -> SplitDayExerciseOut:
    with not_found_as_404("Split day exercise"):
        await sync.require_owned(session, SplitDay, body.split_day_id, user.id)
        await exercises.require_visible(session, body.exercise_id, user.id)
        row = await sync.upsert(
            session, SplitDayExercise, row_id, {"user_id": user.id}, body.model_dump()
        )
    await session.commit()
    return SplitDayExerciseOut.model_validate(row)


@router.delete("/split-day-exercises/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_split_day_exercise(
    row_id: uuid.UUID, user: CurrentUser, session: SessionDep
) -> Response:
    await sync.soft_delete(session, SplitDayExercise, row_id, {"user_id": user.id})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
