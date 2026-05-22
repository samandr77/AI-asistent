from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

import httpx

from services.vision_ocr import analyze_food_package_image

OPEN_FOOD_FACTS_BASE = "https://world.openfoodfacts.org/api/v2"
OFF_FIELDS = ",".join(
    [
        "code",
        "product_name",
        "product_name_ru",
        "brands",
        "quantity",
        "serving_size",
        "nutriscore_grade",
        "nutriments",
        "image_front_url",
    ]
)


@dataclass
class NutritionFoodCandidate:
    name: str
    brand: str | None = None
    barcode: str | None = None
    serving_name: str = "100 g"
    serving_grams: float = 100
    calories_per_100g: float | None = None
    protein_per_100g: float | None = None
    carbs_per_100g: float | None = None
    fat_per_100g: float | None = None
    fiber_per_100g: float | None = None
    sugar_per_100g: float | None = None
    sodium_mg_per_100g: float | None = None
    saturated_fat_per_100g: float | None = None
    micronutrients: dict[str, Any] | None = None
    source: str = "manual"
    source_ref: str | None = None
    confidence: float | None = None
    needs_confirmation: bool = True
    food_score: str | None = None
    image_text: str | None = None

    def as_row(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "brand": self.brand,
            "barcode": self.barcode,
            "serving_name": self.serving_name,
            "serving_grams": self.serving_grams,
            "calories_per_100g": self.calories_per_100g,
            "protein_per_100g": self.protein_per_100g,
            "carbs_per_100g": self.carbs_per_100g,
            "fat_per_100g": self.fat_per_100g,
            "fiber_per_100g": self.fiber_per_100g,
            "sugar_per_100g": self.sugar_per_100g,
            "sodium_mg_per_100g": self.sodium_mg_per_100g,
            "saturated_fat_per_100g": self.saturated_fat_per_100g,
            "micronutrients": self.micronutrients or {},
            "source": self.source,
            "source_ref": self.source_ref,
            "confidence": self.confidence,
            "is_confirmed": not self.needs_confirmation,
            "food_score": self.food_score or score_food(self.as_score_input()),
            "image_text": self.image_text,
        }

    def as_score_input(self) -> dict[str, Any]:
        return {
            "protein_per_100g": self.protein_per_100g,
            "fiber_per_100g": self.fiber_per_100g,
            "sugar_per_100g": self.sugar_per_100g,
            "sodium_mg_per_100g": self.sodium_mg_per_100g,
            "saturated_fat_per_100g": self.saturated_fat_per_100g,
        }


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result >= 0 else None


def _first_text(*values: Any) -> str | None:
    for value in values:
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _grams_from_serving(value: str | None) -> float:
    if not value:
        return 100
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*g", value.lower())
    if not match:
        return 100
    return max(1, min(5000, float(match.group(1).replace(",", "."))))


def _barcode(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits if 6 <= len(digits) <= 18 else None


def score_food(row: dict[str, Any]) -> str:
    points = 0
    protein = _number(row.get("protein_per_100g")) or 0
    fiber = _number(row.get("fiber_per_100g")) or 0
    sugar = _number(row.get("sugar_per_100g")) or 0
    sodium = _number(row.get("sodium_mg_per_100g")) or 0
    saturated = _number(row.get("saturated_fat_per_100g")) or 0
    if protein >= 10:
        points += 2
    elif protein >= 5:
        points += 1
    if fiber >= 6:
        points += 2
    elif fiber >= 3:
        points += 1
    if sugar >= 22.5:
        points -= 2
    elif sugar >= 10:
        points -= 1
    if sodium >= 600:
        points -= 2
    elif sodium >= 300:
        points -= 1
    if saturated >= 5:
        points -= 2
    elif saturated >= 2:
        points -= 1
    if points >= 2:
        return "green"
    if points <= -2:
        return "red"
    return "yellow"


def candidate_from_open_food_facts(product: dict[str, Any]) -> NutritionFoodCandidate | None:
    nutriments = product.get("nutriments") or {}
    name = _first_text(product.get("product_name_ru"), product.get("product_name"))
    if not name:
        return None
    serving = _first_text(product.get("serving_size"), product.get("quantity")) or "100 g"
    sodium_g = _number(nutriments.get("sodium_100g"))
    candidate = NutritionFoodCandidate(
        name=name,
        brand=_first_text(product.get("brands")),
        barcode=_barcode(str(product.get("code") or "")),
        serving_name=serving,
        serving_grams=_grams_from_serving(serving),
        calories_per_100g=_number(nutriments.get("energy-kcal_100g")),
        protein_per_100g=_number(nutriments.get("proteins_100g")),
        carbs_per_100g=_number(nutriments.get("carbohydrates_100g")),
        fat_per_100g=_number(nutriments.get("fat_100g")),
        fiber_per_100g=_number(nutriments.get("fiber_100g")),
        sugar_per_100g=_number(nutriments.get("sugars_100g")),
        sodium_mg_per_100g=sodium_g * 1000 if sodium_g is not None else None,
        saturated_fat_per_100g=_number(nutriments.get("saturated-fat_100g")),
        micronutrients={
            "calcium_mg": _number(nutriments.get("calcium_100g")),
            "iron_mg": _number(nutriments.get("iron_100g")),
            "magnesium_mg": _number(nutriments.get("magnesium_100g")),
            "zinc_mg": _number(nutriments.get("zinc_100g")),
            "vitamin_d_mcg": _number(nutriments.get("vitamin-d_100g")),
            "nutriscore_grade": product.get("nutriscore_grade"),
            "image_front_url": product.get("image_front_url"),
        },
        source="open_food_facts",
        source_ref=f"openfoodfacts:{product.get('code')}" if product.get("code") else None,
        confidence=0.86,
        needs_confirmation=False,
    )
    candidate.food_score = score_food(candidate.as_score_input())
    return candidate


async def lookup_open_food_facts_barcode(barcode: str) -> NutritionFoodCandidate | None:
    code = _barcode(barcode)
    if not code:
        return None
    url = f"{OPEN_FOOD_FACTS_BASE}/product/{code}.json"
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params={"fields": OFF_FIELDS})
    if response.status_code >= 400:
        return None
    payload = response.json()
    product = payload.get("product") if payload.get("status") in {1, "1", "success"} else None
    return candidate_from_open_food_facts(product or {})


async def search_open_food_facts(query: str, *, limit: int = 8) -> list[NutritionFoodCandidate]:
    term = query.strip()
    if len(term) < 2:
        return []
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(
            f"{OPEN_FOOD_FACTS_BASE}/search",
            params={
                "search_terms": term,
                "fields": OFF_FIELDS,
                "page_size": min(max(limit, 1), 20),
            },
        )
    if response.status_code >= 400:
        return []
    products = response.json().get("products") or []
    return [item for product in products if (item := candidate_from_open_food_facts(product))]


def meal_item_from_food(food: dict[str, Any], *, grams: float | None = None) -> dict[str, Any]:
    serving_grams = grams or _number(food.get("serving_grams")) or 100
    factor = serving_grams / 100
    return {
        "food_id": food.get("id"),
        "name": food.get("name") or "Еда",
        "serving_qty": 1,
        "serving_name": food.get("serving_name") or f"{round(serving_grams)} g",
        "grams": serving_grams,
        "calories": (_number(food.get("calories_per_100g")) or 0) * factor,
        "protein_g": (_number(food.get("protein_per_100g")) or 0) * factor,
        "carbs_g": (_number(food.get("carbs_per_100g")) or 0) * factor,
        "fat_g": (_number(food.get("fat_per_100g")) or 0) * factor,
        "fiber_g": (_number(food.get("fiber_per_100g")) or 0) * factor,
        "confidence": food.get("confidence"),
    }


async def analyze_package_photo(image_bytes: bytes, mime_type: str) -> NutritionFoodCandidate:
    parsed = await analyze_food_package_image(image_bytes, mime_type)
    name = _first_text(parsed.get("name"), parsed.get("product_name")) or "Продукт с упаковки"
    serving = _first_text(parsed.get("serving_name"), parsed.get("serving_size")) or "100 g"
    candidate = NutritionFoodCandidate(
        name=name,
        brand=_first_text(parsed.get("brand")),
        barcode=_barcode(_first_text(parsed.get("barcode"))),
        serving_name=serving,
        serving_grams=_number(parsed.get("serving_grams")) or _grams_from_serving(serving),
        calories_per_100g=_number(parsed.get("calories_per_100g")),
        protein_per_100g=_number(parsed.get("protein_per_100g")),
        carbs_per_100g=_number(parsed.get("carbs_per_100g")),
        fat_per_100g=_number(parsed.get("fat_per_100g")),
        fiber_per_100g=_number(parsed.get("fiber_per_100g")),
        sugar_per_100g=_number(parsed.get("sugar_per_100g")),
        sodium_mg_per_100g=_number(parsed.get("sodium_mg_per_100g")),
        saturated_fat_per_100g=_number(parsed.get("saturated_fat_per_100g")),
        micronutrients=parsed.get("micronutrients") if isinstance(parsed.get("micronutrients"), dict) else {},
        source="ai_photo",
        source_ref="openai:gpt-4o-mini",
        confidence=_number(parsed.get("confidence")) or 0.62,
        needs_confirmation=True,
        image_text=_first_text(parsed.get("raw_text")),
    )
    candidate.food_score = score_food(candidate.as_score_input())
    return candidate


def calculate_tdee_target(payload: dict[str, Any]) -> dict[str, Any]:
    sex = payload.get("sex")
    age = int(payload.get("age") or 30)
    height_cm = float(payload.get("height_cm") or 170)
    weight_kg = float(payload.get("weight_kg") or 70)
    activity = payload.get("activity_level") or "moderate"
    goal = payload.get("goal_type") or "maintain"
    diet = payload.get("diet_mode") or "balanced"
    bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (5 if sex == "male" else -161)
    activity_factor = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }.get(activity, 1.55)
    calories = round(bmr * activity_factor)
    if goal == "lose":
        calories -= 400
    elif goal == "gain":
        calories += 300
    calories = max(1200, min(5000, calories))
    macro_pct = {
        "balanced": (0.30, 0.40, 0.30),
        "high_protein": (0.35, 0.35, 0.30),
        "keto": (0.25, 0.05, 0.70),
        "mediterranean": (0.25, 0.45, 0.30),
        "vegan": (0.25, 0.50, 0.25),
    }.get(diet, (0.30, 0.40, 0.30))
    protein_pct, carbs_pct, fat_pct = macro_pct
    return {
        "calories": calories,
        "protein_g": round(calories * protein_pct / 4),
        "carbs_g": round(calories * carbs_pct / 4),
        "fat_g": round(calories * fat_pct / 9),
        "water_ml": int(payload.get("water_ml") or max(1800, min(4500, weight_kg * 35))),
        "bmr": round(bmr),
        "tdee": round(bmr * activity_factor),
    }


def weekly_window(today_value: date | None = None) -> tuple[str, str]:
    current = today_value or date.today()
    start = current - timedelta(days=current.weekday())
    end = start + timedelta(days=6)
    return start.isoformat(), end.isoformat()


def parse_json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}
    return parsed if isinstance(parsed, dict) else {}
