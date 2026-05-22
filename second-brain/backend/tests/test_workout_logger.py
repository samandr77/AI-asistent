"""Pure unit tests for workout_logger compute helpers (no DB)."""

from __future__ import annotations

from services import workout_logger


def test_compute_training_load_uses_rpe_and_duration():
    score = workout_logger.compute_training_load(
        duration_minutes=60, rpe=7, sets=[]
    )
    # 60 * 0.7 * 10 = 420
    assert score == 420.0


def test_compute_training_load_caps_intensity_factor():
    # RPE 10 → 1.0 factor
    score = workout_logger.compute_training_load(
        duration_minutes=30, rpe=10, sets=[]
    )
    assert score == 300.0


def test_compute_training_load_falls_back_to_avg_set_rpe():
    sets = [
        {"rpe": 8, "is_warmup": False},
        {"rpe": 6, "is_warmup": False},
    ]
    score = workout_logger.compute_training_load(
        duration_minutes=40, rpe=None, sets=sets
    )
    # avg rpe 7 -> 40 * 0.7 * 10 = 280
    assert score == 280.0


def test_compute_training_load_returns_none_when_no_data():
    assert (
        workout_logger.compute_training_load(
            duration_minutes=None, rpe=None, sets=[]
        )
        is None
    )


def test_compute_training_load_estimates_duration_from_sets_when_missing():
    sets = [{"rpe": 6}] * 5
    score = workout_logger.compute_training_load(
        duration_minutes=None, rpe=6, sets=sets
    )
    # 5 sets × 2 min = 10 min approx; 10 * 0.6 * 10 = 60
    assert score == 60.0


def test_compute_intensity_minutes_vigorous_double_counts():
    assert workout_logger.compute_intensity_minutes(
        duration_minutes=30, rpe=8
    ) == 60


def test_compute_intensity_minutes_moderate_one_to_one():
    assert workout_logger.compute_intensity_minutes(
        duration_minutes=45, rpe=5
    ) == 45


def test_compute_intensity_minutes_low_returns_zero():
    assert workout_logger.compute_intensity_minutes(
        duration_minutes=30, rpe=2
    ) == 0


def test_compute_intensity_minutes_defaults_to_moderate_when_rpe_missing():
    assert workout_logger.compute_intensity_minutes(
        duration_minutes=30, rpe=None
    ) == 30


def test_compute_intensity_minutes_none_when_no_duration():
    assert workout_logger.compute_intensity_minutes(
        duration_minutes=None, rpe=7
    ) is None


def test_session_volume_kg_sums_working_sets():
    sets = [
        {"weight_kg": 60, "reps": 10, "is_warmup": False},
        {"weight_kg": 80, "reps": 8, "is_warmup": False},
        {"weight_kg": 40, "reps": 12, "is_warmup": True},  # warmup excluded
    ]
    assert workout_logger.session_volume_kg(sets=sets) == 60 * 10 + 80 * 8


def test_session_volume_kg_handles_missing_fields():
    sets = [
        {"weight_kg": None, "reps": 10},
        {"weight_kg": 50, "reps": None},
        {"weight_kg": 50, "reps": 5, "is_warmup": False},
    ]
    assert workout_logger.session_volume_kg(sets=sets) == 250.0
