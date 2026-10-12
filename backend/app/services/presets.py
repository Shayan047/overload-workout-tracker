"""Split presets (screen 03), stored as data in code.

Creating a split from a preset copies it into the user's own rows; nothing refers back to
the preset afterwards. Exercises are library exercises named by their free-exercise-db id.
Rest lengths are in seconds.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class PresetExercise:
    source_id: str
    rest_seconds: int


@dataclass(frozen=True)
class PresetDay:
    name: str
    exercises: tuple[PresetExercise, ...]
    weekday: int | None = None  # 0 = Monday


@dataclass(frozen=True)
class Preset:
    key: str
    name: str
    summary: str
    repeat_mode: str
    days: tuple[PresetDay, ...]


def _day(name: str, *exercises: tuple[str, int], weekday: int | None = None) -> PresetDay:
    return PresetDay(name, tuple(PresetExercise(s, r) for s, r in exercises), weekday)


BENCH = ("Barbell_Bench_Press_-_Medium_Grip", 150)
INCLINE_DB_PRESS = ("Incline_Dumbbell_Press", 120)
OVERHEAD_PRESS = ("Standing_Military_Press", 150)
LATERAL_RAISE = ("Side_Lateral_Raise", 60)
PUSHDOWN = ("Triceps_Pushdown", 60)
SKULLCRUSHER = ("EZ-Bar_Skullcrusher", 90)
DEADLIFT = ("Barbell_Deadlift", 180)
PULLUP = ("Pullups", 150)
BARBELL_ROW = ("Bent_Over_Barbell_Row", 150)
LAT_PULLDOWN = ("Wide-Grip_Lat_Pulldown", 90)
CABLE_ROW = ("Seated_Cable_Rows", 90)
FACE_PULL = ("Face_Pull", 60)
BARBELL_CURL = ("Barbell_Curl", 90)
HAMMER_CURL = ("Hammer_Curls", 90)
SQUAT = ("Barbell_Squat", 180)
FRONT_SQUAT = ("Front_Barbell_Squat", 150)
RDL = ("Romanian_Deadlift", 150)
LEG_PRESS = ("Leg_Press", 120)
LEG_CURL = ("Lying_Leg_Curls", 90)
CALF_RAISE = ("Seated_Calf_Raise", 60)

LEGS = _day("Legs", SQUAT, RDL, LEG_PRESS, LEG_CURL, CALF_RAISE)

PRESET_LIST = (
    Preset(
        key="push_pull_legs",
        name="Push, pull, legs",
        summary="3-day rotation",
        repeat_mode="in_order",
        days=(
            _day(
                "Push",
                BENCH,
                OVERHEAD_PRESS,
                INCLINE_DB_PRESS,
                LATERAL_RAISE,
                PUSHDOWN,
                SKULLCRUSHER,
            ),
            _day("Pull", DEADLIFT, PULLUP, BARBELL_ROW, FACE_PULL, BARBELL_CURL, HAMMER_CURL),
            LEGS,
        ),
    ),
    Preset(
        key="arnold",
        name="Arnold split",
        summary="3-day rotation",
        repeat_mode="in_order",
        days=(
            _day(
                "Chest & Back",
                BENCH,
                INCLINE_DB_PRESS,
                PULLUP,
                BARBELL_ROW,
                ("Dumbbell_Flyes", 60),
                LAT_PULLDOWN,
            ),
            # Matches the Edit a day design (05).
            _day(
                "Shoulders & Arms",
                OVERHEAD_PRESS,
                LATERAL_RAISE,
                ("Dumbbell_Bicep_Curl", 90),
                HAMMER_CURL,
                PUSHDOWN,
                ("Chin-Up", 120),
            ),
            LEGS,
        ),
    ),
    Preset(
        key="upper_lower",
        name="Upper, lower",
        summary="4 days a week",
        repeat_mode="in_order",
        days=(
            _day(
                "Upper A",
                BENCH,
                BARBELL_ROW,
                OVERHEAD_PRESS,
                LAT_PULLDOWN,
                ("Dumbbell_Bicep_Curl", 60),
                PUSHDOWN,
            ),
            _day("Lower A", SQUAT, RDL, LEG_PRESS, LEG_CURL, CALF_RAISE),
            _day(
                "Upper B",
                INCLINE_DB_PRESS,
                ("Seated_Cable_Rows", 120),
                ("Dumbbell_Shoulder_Press", 120),
                PULLUP,
                ("Hammer_Curls", 60),
                ("EZ-Bar_Skullcrusher", 60),
            ),
            _day(
                "Lower B",
                DEADLIFT,
                ("Barbell_Hip_Thrust", 120),
                ("Dumbbell_Lunges", 90),
                ("Leg_Extensions", 60),
                ("Seated_Leg_Curl", 60),
                CALF_RAISE,
            ),
        ),
    ),
    Preset(
        key="body_part",
        name="Body part split",
        summary="5 days a week",
        repeat_mode="in_order",
        days=(
            _day(
                "Chest",
                BENCH,
                INCLINE_DB_PRESS,
                ("Dips_-_Chest_Version", 120),
                ("Dumbbell_Flyes", 60),
                ("Butterfly", 60),
            ),
            _day("Back", DEADLIFT, PULLUP, BARBELL_ROW, CABLE_ROW, LAT_PULLDOWN),
            _day(
                "Shoulders",
                OVERHEAD_PRESS,
                LATERAL_RAISE,
                FACE_PULL,
                ("Seated_Bent-Over_Rear_Delt_Raise", 60),
                ("Dumbbell_Shrug", 60),
            ),
            _day(
                "Arms",
                BARBELL_CURL,
                ("Close-Grip_Barbell_Bench_Press", 120),
                ("Hammer_Curls", 60),
                PUSHDOWN,
                ("Incline_Dumbbell_Curl", 60),
                ("Cable_Rope_Overhead_Triceps_Extension", 60),
            ),
            LEGS,
        ),
    ),
    Preset(
        key="full_body",
        name="Full body",
        summary="3 days a week",
        repeat_mode="weekdays",
        days=(
            _day(
                "Full body A",
                SQUAT,
                BENCH,
                BARBELL_ROW,
                LATERAL_RAISE,
                ("Dumbbell_Bicep_Curl", 60),
                weekday=0,
            ),
            _day("Full body B", DEADLIFT, OVERHEAD_PRESS, PULLUP, LEG_PRESS, PUSHDOWN, weekday=2),
            _day(
                "Full body C",
                FRONT_SQUAT,
                INCLINE_DB_PRESS,
                CABLE_ROW,
                RDL,
                ("Hammer_Curls", 60),
                weekday=4,
            ),
        ),
    ),
)

PRESETS: dict[str, Preset] = {preset.key: preset for preset in PRESET_LIST}
