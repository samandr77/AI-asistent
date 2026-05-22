from __future__ import annotations

from datetime import date, datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


VALID_PRIMARY_MUSCLES = {
    "chest", "back", "lats", "traps",
    "delts_front", "delts_side", "delts_rear",
    "biceps", "triceps", "forearms",
    "quads", "hamstrings", "glutes", "calves",
    "abs", "obliques", "lower_back", "neck", "full_body",
}
VALID_EQUIPMENT = {
    "barbell", "dumbbell", "kettlebell", "machine", "cable",
    "bodyweight", "band", "smith", "trx", "bench", "pullup_bar", "none",
}
VALID_EXERCISE_CATEGORIES = {"strength", "cardio", "stretching", "plyometric", "mobility"}
VALID_DIFFICULTIES = {"beginner", "intermediate", "advanced"}

VALID_SESSION_TYPES = {"strength", "hypertrophy", "endurance", "hiit", "cardio", "mobility", "sport"}
VALID_SPORT_KINDS = {
    "running", "cycling", "mtb", "gravel", "walking", "hiking",
    "swim_pool", "swim_open_water",
    "ski", "snowboard",
    "climb", "mountaineering",
    "row", "kayak", "sup",
    "golf",
    "yoga", "pilates", "hiit", "dance",
    "other",
}
VALID_SESSION_SOURCES = {"manual", "dump", "voice", "photo", "program", "import"}
VALID_SUPERSET_KINDS = {"superset", "giantset", "circuit", "dropset"}


def _clean_text(value: Optional[str], *, max_len: int, field_name: str) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) > max_len:
        raise ValueError(f"{field_name} must be {max_len} characters or fewer")
    return cleaned or None


def _rating(value: Optional[int], field_name: str) -> Optional[int]:
    if value is not None and not 1 <= value <= 10:
        raise ValueError(f"{field_name} must be between 1 and 10")
    return value


def _non_negative(value, field_name: str):
    if value is not None and value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


def _slugify(value: str) -> str:
    out: list[str] = []
    prev_dash = False
    for ch in value.strip().lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        elif ch in (" ", "-", "_"):
            if not prev_dash and out:
                out.append("-")
                prev_dash = True
    return "".join(out).strip("-")


# ============================================================
# Exercise
# ============================================================

class Exercise(BaseModel):
    id: str
    user_id: Optional[str] = None
    slug: str
    name_ru: str
    name_en: Optional[str] = None
    primary_muscle: str
    secondary_muscles: list[str] = Field(default_factory=list)
    equipment: list[str] = Field(default_factory=list)
    category: str
    is_compound: bool = False
    is_unilateral: bool = False
    default_rest_seconds: Optional[int] = None
    tempo_default: Optional[str] = None
    instructions: Optional[str] = None
    gif_url: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    difficulty: Optional[str] = None
    sport_kind: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ExerciseCreate(BaseModel):
    slug: Optional[str] = None
    name_ru: str
    name_en: Optional[str] = None
    primary_muscle: str
    secondary_muscles: list[str] = Field(default_factory=list)
    equipment: list[str] = Field(default_factory=list)
    category: str
    is_compound: bool = False
    is_unilateral: bool = False
    default_rest_seconds: Optional[int] = None
    tempo_default: Optional[str] = None
    instructions: Optional[str] = None
    gif_url: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    difficulty: Optional[str] = None
    sport_kind: Optional[str] = None

    @field_validator("name_ru")
    @classmethod
    def _name_ru(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("name_ru is required")
        if len(cleaned) > 160:
            raise ValueError("name_ru must be 160 characters or fewer")
        return cleaned

    @field_validator("name_en")
    @classmethod
    def _name_en(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=160, field_name="name_en")

    @field_validator("slug")
    @classmethod
    def _slug(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = _slugify(value)
        if not cleaned:
            raise ValueError("slug must contain alphanumeric characters")
        if len(cleaned) > 80:
            raise ValueError("slug must be 80 characters or fewer")
        return cleaned

    @field_validator("primary_muscle")
    @classmethod
    def _primary(cls, value: str) -> str:
        if value not in VALID_PRIMARY_MUSCLES:
            raise ValueError(f"primary_muscle must be one of {sorted(VALID_PRIMARY_MUSCLES)}")
        return value

    @field_validator("secondary_muscles")
    @classmethod
    def _secondary(cls, value: list[str]) -> list[str]:
        bad = [m for m in value if m not in VALID_PRIMARY_MUSCLES]
        if bad:
            raise ValueError(f"secondary_muscles contains invalid values: {bad}")
        return value

    @field_validator("equipment")
    @classmethod
    def _equipment(cls, value: list[str]) -> list[str]:
        bad = [e for e in value if e not in VALID_EQUIPMENT]
        if bad:
            raise ValueError(f"equipment contains invalid values: {bad}")
        return value

    @field_validator("category")
    @classmethod
    def _category(cls, value: str) -> str:
        if value not in VALID_EXERCISE_CATEGORIES:
            raise ValueError(f"category must be one of {sorted(VALID_EXERCISE_CATEGORIES)}")
        return value

    @field_validator("difficulty")
    @classmethod
    def _difficulty(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_DIFFICULTIES:
            raise ValueError(f"difficulty must be one of {sorted(VALID_DIFFICULTIES)}")
        return value

    @field_validator("sport_kind")
    @classmethod
    def _sport(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_SPORT_KINDS:
            raise ValueError(f"sport_kind must be one of {sorted(VALID_SPORT_KINDS)}")
        return value

    @field_validator("default_rest_seconds")
    @classmethod
    def _rest(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        if not 0 <= value <= 600:
            raise ValueError("default_rest_seconds must be between 0 and 600")
        return value

    @field_validator("instructions")
    @classmethod
    def _instr(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=2000, field_name="instructions")


# ============================================================
# Workout sets
# ============================================================

class WorkoutSetCreate(BaseModel):
    exercise_id: str
    set_number: int = 1
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    weight_unit: str = "kg"
    rir: Optional[int] = None
    rpe: Optional[int] = None
    tempo: Optional[str] = None
    is_warmup: bool = False
    is_dropset: bool = False
    dropset_group: Optional[int] = None
    superset_id: Optional[str] = None
    rest_seconds_actual: Optional[int] = None
    distance_m: Optional[float] = None
    duration_seconds: Optional[int] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("set_number")
    @classmethod
    def _set_number(cls, value: int) -> int:
        if value < 1:
            raise ValueError("set_number must be >= 1")
        return value

    @field_validator("reps")
    @classmethod
    def _reps(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative(value, "reps")

    @field_validator("weight_kg")
    @classmethod
    def _weight(cls, value: Optional[float]) -> Optional[float]:
        return _non_negative(value, "weight_kg")

    @field_validator("weight_unit")
    @classmethod
    def _unit(cls, value: str) -> str:
        if value not in ("kg", "lb"):
            raise ValueError("weight_unit must be 'kg' or 'lb'")
        return value

    @field_validator("rir")
    @classmethod
    def _rir(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not 0 <= value <= 10:
            raise ValueError("rir must be between 0 and 10")
        return value

    @field_validator("rpe")
    @classmethod
    def _rpe(cls, value: Optional[int]) -> Optional[int]:
        return _rating(value, "rpe")

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=400, field_name="notes")


class WorkoutSetUpdate(BaseModel):
    set_number: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    weight_unit: Optional[str] = None
    rir: Optional[int] = None
    rpe: Optional[int] = None
    tempo: Optional[str] = None
    is_warmup: Optional[bool] = None
    is_dropset: Optional[bool] = None
    dropset_group: Optional[int] = None
    superset_id: Optional[str] = None
    rest_seconds_actual: Optional[int] = None
    distance_m: Optional[float] = None
    duration_seconds: Optional[int] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("reps")
    @classmethod
    def _reps(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative(value, "reps")

    @field_validator("weight_kg")
    @classmethod
    def _weight(cls, value: Optional[float]) -> Optional[float]:
        return _non_negative(value, "weight_kg")

    @field_validator("rpe")
    @classmethod
    def _rpe(cls, value: Optional[int]) -> Optional[int]:
        return _rating(value, "rpe")

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=400, field_name="notes")


class WorkoutSet(BaseModel):
    id: str
    user_id: str
    session_id: str
    exercise_id: str
    set_number: int
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    weight_unit: str = "kg"
    rir: Optional[int] = None
    rpe: Optional[int] = None
    tempo: Optional[str] = None
    is_warmup: bool = False
    is_dropset: bool = False
    dropset_group: Optional[int] = None
    superset_id: Optional[str] = None
    rest_seconds_actual: Optional[int] = None
    distance_m: Optional[float] = None
    duration_seconds: Optional[int] = None
    completed_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# Workout sessions
# ============================================================

class WorkoutSessionCreate(BaseModel):
    session_type: str = "strength"
    sport_kind: Optional[str] = None
    title: str
    location: Optional[str] = None
    occurred_on: date
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    rpe: Optional[int] = None
    mood_before: Optional[int] = None
    mood_after: Optional[int] = None
    energy_before: Optional[int] = None
    energy_after: Optional[int] = None
    calories: Optional[int] = None
    program_session_id: Optional[str] = None
    program_id: Optional[str] = None
    goal_id: Optional[str] = None
    source: str = "manual"
    raw_text: Optional[str] = None
    weather_conditions: Optional[dict[str, Any]] = None
    is_planned: bool = False
    planned_for: Optional[date] = None
    notes: Optional[str] = None
    # Outdoor / sport-specific
    distance_km: Optional[float] = None
    avg_pace_per_km_seconds: Optional[int] = None
    elevation_gain_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    vertical_descent_m: Optional[int] = None
    cadence_avg: Optional[int] = None
    stroke_rate: Optional[int] = None
    swolf: Optional[int] = None
    pool_length_m: Optional[int] = None
    laps: Optional[int] = None

    @field_validator("session_type")
    @classmethod
    def _session_type(cls, value: str) -> str:
        if value not in VALID_SESSION_TYPES:
            raise ValueError(f"session_type must be one of {sorted(VALID_SESSION_TYPES)}")
        return value

    @field_validator("sport_kind")
    @classmethod
    def _sport(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_SPORT_KINDS:
            raise ValueError(f"sport_kind must be one of {sorted(VALID_SPORT_KINDS)}")
        return value

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("title is required")
        if len(cleaned) > 200:
            raise ValueError("title must be 200 characters or fewer")
        return cleaned

    @field_validator("location")
    @classmethod
    def _location(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=120, field_name="location")

    @field_validator("rpe", "mood_before", "mood_after", "energy_before", "energy_after")
    @classmethod
    def _rating(cls, value: Optional[int], info) -> Optional[int]:
        return _rating(value, info.field_name)

    @field_validator("duration_minutes")
    @classmethod
    def _duration(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("duration_minutes must be positive")
        return value

    @field_validator("source")
    @classmethod
    def _source(cls, value: str) -> str:
        if value not in VALID_SESSION_SOURCES:
            raise ValueError(f"source must be one of {sorted(VALID_SESSION_SOURCES)}")
        return value

    @field_validator("raw_text")
    @classmethod
    def _raw(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=4000, field_name="raw_text")

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=2000, field_name="notes")

    @field_validator("distance_km", "max_speed_kmh")
    @classmethod
    def _non_neg_float(cls, value, info):
        return _non_negative(value, info.field_name)

    @field_validator("elevation_gain_m", "vertical_descent_m", "cadence_avg", "stroke_rate", "swolf", "laps")
    @classmethod
    def _non_neg_int(cls, value, info):
        return _non_negative(value, info.field_name)

    @field_validator("avg_pace_per_km_seconds")
    @classmethod
    def _pace(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value <= 0:
            raise ValueError("avg_pace_per_km_seconds must be positive")
        return value

    @field_validator("pool_length_m")
    @classmethod
    def _pool(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value not in (25, 33, 50):
            raise ValueError("pool_length_m must be 25, 33 or 50")
        return value


class WorkoutSessionUpdate(BaseModel):
    session_type: Optional[str] = None
    sport_kind: Optional[str] = None
    title: Optional[str] = None
    location: Optional[str] = None
    occurred_on: Optional[date] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    rpe: Optional[int] = None
    mood_before: Optional[int] = None
    mood_after: Optional[int] = None
    energy_before: Optional[int] = None
    energy_after: Optional[int] = None
    calories: Optional[int] = None
    goal_id: Optional[str] = None
    is_completed: Optional[bool] = None
    is_planned: Optional[bool] = None
    planned_for: Optional[date] = None
    notes: Optional[str] = None
    distance_km: Optional[float] = None
    avg_pace_per_km_seconds: Optional[int] = None
    elevation_gain_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    vertical_descent_m: Optional[int] = None
    cadence_avg: Optional[int] = None
    stroke_rate: Optional[int] = None
    swolf: Optional[int] = None
    pool_length_m: Optional[int] = None
    laps: Optional[int] = None

    @field_validator("session_type")
    @classmethod
    def _session_type(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_SESSION_TYPES:
            raise ValueError(f"session_type must be one of {sorted(VALID_SESSION_TYPES)}")
        return value

    @field_validator("sport_kind")
    @classmethod
    def _sport(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_SPORT_KINDS:
            raise ValueError(f"sport_kind must be one of {sorted(VALID_SPORT_KINDS)}")
        return value

    @field_validator("title")
    @classmethod
    def _title(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=200, field_name="title")

    @field_validator("rpe", "mood_before", "mood_after", "energy_before", "energy_after")
    @classmethod
    def _rating(cls, value: Optional[int], info) -> Optional[int]:
        return _rating(value, info.field_name)


class WorkoutSession(BaseModel):
    id: str
    user_id: str
    session_type: str
    sport_kind: Optional[str] = None
    title: str
    location: Optional[str] = None
    occurred_on: date
    started_at: Optional[str] = None
    ended_at: Optional[str] = None
    duration_minutes: Optional[int] = None
    rpe: Optional[int] = None
    mood_before: Optional[int] = None
    mood_after: Optional[int] = None
    energy_before: Optional[int] = None
    energy_after: Optional[int] = None
    training_load_score: Optional[float] = None
    intensity_minutes: Optional[int] = None
    calories: Optional[int] = None
    program_session_id: Optional[str] = None
    program_id: Optional[str] = None
    goal_id: Optional[str] = None
    source: str
    raw_text: Optional[str] = None
    weather_conditions: Optional[dict[str, Any]] = None
    is_completed: bool = False
    is_planned: bool = False
    planned_for: Optional[date] = None
    notes: Optional[str] = None
    distance_km: Optional[float] = None
    avg_pace_per_km_seconds: Optional[int] = None
    elevation_gain_m: Optional[int] = None
    max_speed_kmh: Optional[float] = None
    vertical_descent_m: Optional[int] = None
    cadence_avg: Optional[int] = None
    stroke_rate: Optional[int] = None
    swolf: Optional[int] = None
    pool_length_m: Optional[int] = None
    laps: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Joined: present on detail endpoints
    sets: list[WorkoutSet] = Field(default_factory=list)


# ============================================================
# Supersets
# ============================================================

class SupersetCreate(BaseModel):
    group_index: int = 0
    kind: str = "superset"
    notes: Optional[str] = None
    set_ids: list[str] = Field(default_factory=list)

    @field_validator("kind")
    @classmethod
    def _kind(cls, value: str) -> str:
        if value not in VALID_SUPERSET_KINDS:
            raise ValueError(f"kind must be one of {sorted(VALID_SUPERSET_KINDS)}")
        return value

    @field_validator("notes")
    @classmethod
    def _notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=300, field_name="notes")


class Superset(BaseModel):
    id: str
    user_id: str
    session_id: str
    group_index: int
    kind: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
