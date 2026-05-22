from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


VALID_WORKOUT_TYPES = {"strength", "cardio", "yoga", "stretching", "walk", "sport", "other"}
VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}
VALID_BIOMARKER_TYPES = {
    "hrv",
    "resting_heart_rate",
    "heart_rate",
    "spo2",
    "breathing_rate",
    "blood_pressure_systolic",
    "blood_pressure_diastolic",
    "glucose",
    "cholesterol",
    "weight",
    "body_fat",
    "temperature",
    "other",
}
VALID_MEDICAL_RECORD_TYPES = {"lab", "medication", "visit", "vaccine", "document", "note"}
VALID_GOAL_TYPES = {"lose", "maintain", "gain"}
VALID_ACTIVITY_LEVELS = {"sedentary", "light", "moderate", "active", "very_active"}
VALID_DIET_MODES = {"balanced", "high_protein", "keto", "mediterranean", "vegan"}


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


def _non_negative(value: Optional[float | int], field_name: str) -> Optional[float | int]:
    if value is not None and value < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return value


class HealthDailyLogCreate(BaseModel):
    log_date: date
    mood: Optional[int] = None
    energy: Optional[int] = None
    stress: Optional[int] = None
    readiness_override: Optional[int] = None
    symptoms: list[str] = Field(default_factory=list, max_length=20)
    notes: Optional[str] = None

    @field_validator("mood", "energy", "stress", "readiness_override")
    @classmethod
    def valid_rating(cls, value: Optional[int], info) -> Optional[int]:
        return _rating(value, info.field_name)

    @field_validator("symptoms")
    @classmethod
    def clean_symptoms(cls, value: list[str]) -> list[str]:
        return [item.strip()[:80] for item in value if item.strip()]

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1200, field_name="notes")


class HealthDailyLogUpdate(BaseModel):
    mood: Optional[int] = None
    energy: Optional[int] = None
    stress: Optional[int] = None
    readiness_override: Optional[int] = None
    symptoms: Optional[list[str]] = None
    notes: Optional[str] = None

    @field_validator("mood", "energy", "stress", "readiness_override")
    @classmethod
    def valid_rating(cls, value: Optional[int], info) -> Optional[int]:
        return _rating(value, info.field_name)

    @field_validator("symptoms")
    @classmethod
    def clean_symptoms(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        return None if value is None else [item.strip()[:80] for item in value if item.strip()]

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1200, field_name="notes")


class HealthSleepLogCreate(BaseModel):
    sleep_date: date
    bedtime_at: Optional[str] = Field(default=None, max_length=40)
    wake_at: Optional[str] = Field(default=None, max_length=40)
    bedtime: Optional[str] = Field(default=None, max_length=16)
    wake_time: Optional[str] = Field(default=None, max_length=16)
    source: str = Field(default="manual", max_length=40)
    time_in_bed_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    duration_minutes: int = Field(gt=0, le=1440)
    sleep_latency_minutes: Optional[int] = Field(default=None, ge=0, le=360)
    awakenings_count: Optional[int] = Field(default=None, ge=0, le=80)
    awake_minutes: Optional[int] = Field(default=None, ge=0, le=720)
    restoration: Optional[int] = None
    quality: Optional[int] = None
    quality_score: Optional[int] = None
    quality_breakdown: dict[str, Any] = Field(default_factory=dict)
    phases: dict[str, Any] = Field(default_factory=dict)
    factors: list[str] = Field(default_factory=list, max_length=20)
    notes: Optional[str] = None

    @field_validator("quality", "restoration")
    @classmethod
    def valid_rating(cls, value: Optional[int], info) -> Optional[int]:
        return _rating(value, info.field_name)

    @field_validator("quality_score")
    @classmethod
    def valid_quality_score(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and not 0 <= value <= 100:
            raise ValueError("quality_score must be between 0 and 100")
        return value

    @field_validator("factors")
    @classmethod
    def clean_factors(cls, value: list[str]) -> list[str]:
        return [item.strip()[:80] for item in value if item.strip()]

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthSleepLogUpdate(BaseModel):
    sleep_date: Optional[date] = None
    bedtime_at: Optional[str] = Field(default=None, max_length=40)
    wake_at: Optional[str] = Field(default=None, max_length=40)
    bedtime: Optional[str] = Field(default=None, max_length=16)
    wake_time: Optional[str] = Field(default=None, max_length=16)
    source: Optional[str] = Field(default=None, max_length=40)
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthSleepSessionStart(BaseModel):
    started_at: Optional[str] = Field(default=None, max_length=40)
    source: str = Field(default="manual", max_length=40)


class HealthSleepSessionWake(BaseModel):
    ended_at: Optional[str] = Field(default=None, max_length=40)
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthSleepGoal(BaseModel):
    target_duration_minutes: int = Field(default=480, ge=240, le=720)
    target_bedtime: Optional[str] = Field(default=None, max_length=16)
    target_wake_time: Optional[str] = Field(default=None, max_length=16)


class HealthActivityLogCreate(BaseModel):
    activity_date: date
    steps: int = 0
    distance_meters: Optional[int] = None
    active_minutes: int = 0
    calories: Optional[int] = None
    stand_hours: Optional[int] = None
    source: str = Field(default="manual", max_length=40)

    @field_validator("steps", "distance_meters", "active_minutes", "calories", "stand_hours")
    @classmethod
    def non_negative_number(cls, value: Optional[int], info) -> Optional[int]:
        return _non_negative(value, info.field_name)  # type: ignore[return-value]


class HealthWorkoutCreate(BaseModel):
    occurred_on: date
    kind: str = "other"
    title: str = Field(min_length=1, max_length=160)
    duration_minutes: Optional[int] = Field(default=None, gt=0, le=1440)
    intensity: Optional[int] = None
    calories: Optional[int] = None
    muscle_groups: list[str] = Field(default_factory=list, max_length=20)
    notes: Optional[str] = None

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, value: str) -> str:
        if value not in VALID_WORKOUT_TYPES:
            raise ValueError(f"kind must be one of {sorted(VALID_WORKOUT_TYPES)}")
        return value

    @field_validator("intensity")
    @classmethod
    def valid_intensity(cls, value: Optional[int]) -> Optional[int]:
        return _rating(value, "intensity")

    @field_validator("calories")
    @classmethod
    def non_negative_calories(cls, value: Optional[int]) -> Optional[int]:
        return _non_negative(value, "calories")  # type: ignore[return-value]

    @field_validator("muscle_groups")
    @classmethod
    def clean_muscles(cls, value: list[str]) -> list[str]:
        return [item.strip()[:80] for item in value if item.strip()]

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthNutritionLogCreate(BaseModel):
    logged_on: date
    calories: Optional[int] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    water_ml: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("calories", "protein_g", "carbs_g", "fat_g", "water_ml")
    @classmethod
    def non_negative_number(cls, value: Optional[float], info) -> Optional[float]:
        return _non_negative(value, info.field_name)  # type: ignore[return-value]

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthFoodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    brand: Optional[str] = Field(default=None, max_length=120)
    barcode: Optional[str] = Field(default=None, max_length=80)
    serving_name: str = Field(default="100 g", max_length=80)
    serving_grams: float = Field(default=100, gt=0, le=5000)
    calories_per_100g: Optional[float] = None
    protein_per_100g: Optional[float] = None
    carbs_per_100g: Optional[float] = None
    fat_per_100g: Optional[float] = None
    fiber_per_100g: Optional[float] = None
    sugar_per_100g: Optional[float] = None
    sodium_mg_per_100g: Optional[float] = None
    saturated_fat_per_100g: Optional[float] = None
    micronutrients: dict[str, Any] = Field(default_factory=dict)
    source_ref: Optional[str] = Field(default=None, max_length=160)
    is_confirmed: bool = True
    food_score: Optional[str] = Field(default=None, max_length=16)
    image_text: Optional[str] = None
    source: str = Field(default="manual", max_length=40)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)

    @field_validator(
        "calories_per_100g",
        "protein_per_100g",
        "carbs_per_100g",
        "fat_per_100g",
        "fiber_per_100g",
        "sugar_per_100g",
        "sodium_mg_per_100g",
        "saturated_fat_per_100g",
    )
    @classmethod
    def non_negative_number(cls, value: Optional[float], info) -> Optional[float]:
        return _non_negative(value, info.field_name)  # type: ignore[return-value]

    @field_validator("name", "brand", "barcode", "serving_name", "source_ref", "food_score")
    @classmethod
    def clean_short_text(cls, value: Optional[str], info) -> Optional[str]:
        max_len = 180 if info.field_name == "name" else 120
        return _clean_text(value, max_len=max_len, field_name=info.field_name)

    @field_validator("image_text")
    @classmethod
    def clean_image_text(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=2000, field_name="image_text")


class HealthMealItemCreate(BaseModel):
    food_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=180)
    serving_qty: float = Field(default=1, gt=0, le=100)
    serving_name: str = Field(default="порция", max_length=80)
    grams: Optional[float] = Field(default=None, gt=0, le=5000)
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)

    @field_validator("calories", "protein_g", "carbs_g", "fat_g", "fiber_g")
    @classmethod
    def non_negative_number(cls, value: Optional[float], info) -> Optional[float]:
        return _non_negative(value, info.field_name)  # type: ignore[return-value]


class HealthMealCreate(BaseModel):
    logged_on: date
    meal_type: str = "snack"
    title: Optional[str] = Field(default=None, max_length=180)
    source: str = Field(default="manual", max_length=40)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    notes: Optional[str] = None
    items: list[HealthMealItemCreate] = Field(default_factory=list, min_length=1, max_length=40)

    @field_validator("meal_type")
    @classmethod
    def valid_meal_type(cls, value: str) -> str:
        if value not in VALID_MEAL_TYPES:
            raise ValueError(f"meal_type must be one of {sorted(VALID_MEAL_TYPES)}")
        return value

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthWaterLogCreate(BaseModel):
    logged_on: date
    amount_ml: int = Field(gt=0, le=10000)
    source: str = Field(default="manual", max_length=40)


class HealthNutritionTargetCreate(BaseModel):
    calories: Optional[int] = Field(default=None, gt=0, le=20000)
    protein_g: Optional[float] = Field(default=None, ge=0, le=1000)
    carbs_g: Optional[float] = Field(default=None, ge=0, le=2000)
    fat_g: Optional[float] = Field(default=None, ge=0, le=1000)
    water_ml: Optional[int] = Field(default=None, gt=0, le=20000)
    sex: Optional[str] = Field(default=None, max_length=16)
    age: Optional[int] = Field(default=None, ge=13, le=120)
    height_cm: Optional[float] = Field(default=None, ge=90, le=250)
    weight_kg: Optional[float] = Field(default=None, ge=25, le=400)
    goal_weight_kg: Optional[float] = Field(default=None, ge=25, le=400)
    activity_level: str = "moderate"
    goal_type: str = "maintain"
    diet_mode: str = "balanced"
    bmr: Optional[int] = Field(default=None, ge=0, le=10000)
    tdee: Optional[int] = Field(default=None, ge=0, le=20000)

    @field_validator("activity_level")
    @classmethod
    def valid_activity_level(cls, value: str) -> str:
        if value not in VALID_ACTIVITY_LEVELS:
            raise ValueError(f"activity_level must be one of {sorted(VALID_ACTIVITY_LEVELS)}")
        return value

    @field_validator("goal_type")
    @classmethod
    def valid_goal_type(cls, value: str) -> str:
        if value not in VALID_GOAL_TYPES:
            raise ValueError(f"goal_type must be one of {sorted(VALID_GOAL_TYPES)}")
        return value

    @field_validator("diet_mode")
    @classmethod
    def valid_diet_mode(cls, value: str) -> str:
        if value not in VALID_DIET_MODES:
            raise ValueError(f"diet_mode must be one of {sorted(VALID_DIET_MODES)}")
        return value


class HealthBarcodeLookup(BaseModel):
    barcode: str = Field(min_length=6, max_length=32)


class HealthWeightLogCreate(BaseModel):
    logged_on: date
    weight_kg: float = Field(gt=25, le=400)
    body_fat_pct: Optional[float] = Field(default=None, ge=1, le=80)
    muscle_mass_kg: Optional[float] = Field(default=None, ge=1, le=250)
    source: str = Field(default="manual", max_length=40)
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthRecipeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    servings: float = Field(default=1, gt=0, le=200)
    items: list[HealthMealItemCreate] = Field(default_factory=list, min_length=1, max_length=80)
    notes: Optional[str] = None

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthBiomarkerCreate(BaseModel):
    measured_on: date
    kind: str
    value: float
    unit: str = Field(min_length=1, max_length=24)
    source: str = Field(default="manual", max_length=40)
    notes: Optional[str] = None

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, value: str) -> str:
        if value not in VALID_BIOMARKER_TYPES:
            raise ValueError(f"kind must be one of {sorted(VALID_BIOMARKER_TYPES)}")
        return value

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1000, field_name="notes")


class HealthMedicalRecordCreate(BaseModel):
    record_date: date
    kind: str = "note"
    title: str = Field(min_length=1, max_length=180)
    provider: Optional[str] = None
    summary: Optional[str] = None
    file_url: Optional[str] = None
    is_sensitive: bool = True

    @field_validator("kind")
    @classmethod
    def valid_kind(cls, value: str) -> str:
        if value not in VALID_MEDICAL_RECORD_TYPES:
            raise ValueError(f"kind must be one of {sorted(VALID_MEDICAL_RECORD_TYPES)}")
        return value

    @field_validator("provider")
    @classmethod
    def clean_provider(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=160, field_name="provider")

    @field_validator("summary")
    @classmethod
    def clean_summary(cls, value: Optional[str]) -> Optional[str]:
        return _clean_text(value, max_len=1600, field_name="summary")


class HealthInsight(BaseModel):
    id: str
    severity: str
    title: str
    message: str
    suggested_action: Optional[str] = None
    used_data: list[str]


class HealthNutritionSummary(BaseModel):
    logged_on: str
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    fiber_g: float = 0
    water_ml: int = 0
    target: Optional[dict] = None
    remaining_calories: Optional[float] = None


class HealthNutritionScanResult(BaseModel):
    candidate: dict
    saved_food: Optional[dict] = None
    needs_confirmation: bool = True
    source: str
    confidence: Optional[float] = None


class HealthNutritionWeeklyReport(BaseModel):
    week_start: str
    week_end: str
    average_calories: float
    average_protein_g: float
    average_water_ml: float
    macro_completion_pct: dict[str, float]
    water_consistency_days: int
    weight_trend_kg: Optional[float] = None
    frequent_foods: list[dict] = Field(default_factory=list)
    ai_summary: str
    safety_note: str


class HealthDashboard(BaseModel):
    score: int
    readiness_score: int
    trend_days: int
    latest_daily_log: Optional[dict] = None
    latest_sleep: Optional[dict] = None
    latest_activity: Optional[dict] = None
    recent_workouts: list[dict]
    nutrition_today: Optional[dict] = None
    nutrition_summary: Optional[HealthNutritionSummary] = None
    meals_today: list[dict] = Field(default_factory=list)
    biomarkers: list[dict]
    medical_records_count: int
    insights: list[HealthInsight]
    safety_note: str
