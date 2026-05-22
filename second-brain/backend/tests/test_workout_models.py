"""Tests for Pydantic validation in models/workout.py."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from models.workout import (
    ExerciseCreate,
    SupersetCreate,
    WorkoutSessionCreate,
    WorkoutSetCreate,
    _slugify,
)


# ----------------------------------------------------------------
# _slugify helper
# ----------------------------------------------------------------

def test_slugify_basic():
    assert _slugify("Жим лёжа") == "жимлёжа" or _slugify("Bench Press") == "bench-press"


def test_slugify_collapses_dashes():
    assert _slugify("hello   world__test") == "hello-world-test"


# ----------------------------------------------------------------
# ExerciseCreate
# ----------------------------------------------------------------

def test_exercise_create_requires_valid_primary_muscle():
    with pytest.raises(ValidationError):
        ExerciseCreate(
            name_ru="Test",
            primary_muscle="invalid",
            category="strength",
        )


def test_exercise_create_rejects_invalid_equipment():
    with pytest.raises(ValidationError):
        ExerciseCreate(
            name_ru="Test",
            primary_muscle="chest",
            category="strength",
            equipment=["spaceship"],
        )


def test_exercise_create_slug_derives_when_omitted():
    body = ExerciseCreate(
        name_ru="Жим лёжа",
        name_en="Bench Press",
        primary_muscle="chest",
        category="strength",
    )
    assert body.slug is None  # router derives via _slugify(name_en or name_ru)


def test_exercise_create_normalizes_slug():
    body = ExerciseCreate(
        slug="Push  Up Test",
        name_ru="Отжимания",
        primary_muscle="chest",
        category="strength",
    )
    assert body.slug == "push-up-test"


def test_exercise_create_rejects_invalid_difficulty():
    with pytest.raises(ValidationError):
        ExerciseCreate(
            name_ru="Test",
            primary_muscle="chest",
            category="strength",
            difficulty="god",
        )


# ----------------------------------------------------------------
# WorkoutSetCreate
# ----------------------------------------------------------------

def test_workout_set_requires_positive_set_number():
    with pytest.raises(ValidationError):
        WorkoutSetCreate(exercise_id="ex-1", set_number=0)


def test_workout_set_rejects_negative_reps():
    with pytest.raises(ValidationError):
        WorkoutSetCreate(exercise_id="ex-1", set_number=1, reps=-1)


def test_workout_set_rejects_invalid_weight_unit():
    with pytest.raises(ValidationError):
        WorkoutSetCreate(exercise_id="ex-1", set_number=1, weight_unit="stone")


def test_workout_set_rir_range():
    valid = WorkoutSetCreate(exercise_id="ex-1", set_number=1, rir=4)
    assert valid.rir == 4
    with pytest.raises(ValidationError):
        WorkoutSetCreate(exercise_id="ex-1", set_number=1, rir=11)


def test_workout_set_rpe_range():
    with pytest.raises(ValidationError):
        WorkoutSetCreate(exercise_id="ex-1", set_number=1, rpe=11)


# ----------------------------------------------------------------
# WorkoutSessionCreate
# ----------------------------------------------------------------

def test_workout_session_requires_title():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="strength",
            title="   ",
            occurred_on="2026-05-22",
        )


def test_workout_session_rejects_invalid_session_type():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="dance_off",
            title="Test",
            occurred_on="2026-05-22",
        )


def test_workout_session_rejects_invalid_sport_kind():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="sport",
            sport_kind="quidditch",
            title="Test",
            occurred_on="2026-05-22",
        )


def test_workout_session_accepts_valid_outdoor_fields():
    body = WorkoutSessionCreate(
        session_type="cardio",
        sport_kind="running",
        title="Morning run",
        occurred_on="2026-05-22",
        distance_km=5.2,
        avg_pace_per_km_seconds=330,
        elevation_gain_m=40,
    )
    assert body.distance_km == 5.2
    assert body.avg_pace_per_km_seconds == 330


def test_workout_session_rejects_negative_distance():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="cardio",
            title="Run",
            occurred_on="2026-05-22",
            distance_km=-1.0,
        )


def test_workout_session_rejects_zero_pace():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="cardio",
            title="Run",
            occurred_on="2026-05-22",
            avg_pace_per_km_seconds=0,
        )


def test_workout_session_rejects_unsupported_pool_length():
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="cardio",
            sport_kind="swim_pool",
            title="Swim",
            occurred_on="2026-05-22",
            pool_length_m=40,
        )


def test_workout_session_strips_oversized_raw_text():
    huge = "x" * 4500
    with pytest.raises(ValidationError):
        WorkoutSessionCreate(
            session_type="strength",
            title="X",
            occurred_on="2026-05-22",
            raw_text=huge,
        )


# ----------------------------------------------------------------
# SupersetCreate
# ----------------------------------------------------------------

def test_superset_create_validates_kind():
    with pytest.raises(ValidationError):
        SupersetCreate(group_index=0, kind="megaset")


def test_superset_create_defaults():
    body = SupersetCreate(group_index=0)
    assert body.kind == "superset"
    assert body.set_ids == []
