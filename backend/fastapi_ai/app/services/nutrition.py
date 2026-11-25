"""Resolve recognized foods against USDA FoodData Central, with traceable sources."""
import asyncio
import math
import re

import httpx

from app.config import settings
from app.schemas.food import RecognizedFood

NUTRIENTS = ("calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium")
USDA_IDS = {1008: "calories", 1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber", 2000: "sugar", 1093: "sodium"}


def scale_nutrition(nutrition: dict, grams: float) -> dict:
    return {key: round(nutrition[key] * grams / 100, 2) if nutrition.get(key) is not None else None for key in NUTRIENTS}


def nutrient_map(foods: list[dict]) -> dict:
    result = dict.fromkeys(NUTRIENTS)
    for record in foods:
        nutrient = record.get("nutrient", {})
        nutrient_id = record.get("nutrientId", nutrient.get("id"))
        if nutrient_id in USDA_IDS:
            amount = record.get("value", record.get("amount"))
            try:
                number = float(amount)
                key = USDA_IDS[nutrient_id]
                upper_bound = 1000 if key == "calories" else 100000 if key == "sodium" else 100
                if math.isfinite(number) and 0 <= number <= upper_bound:
                    result[key] = number
            except (ValueError, TypeError):
                continue
    return result


async def usda_match(client: httpx.AsyncClient, name: str) -> dict | None:
    config = settings()
    if not config.usda_api_key:
        return None
    response = await client.post("https://api.nal.usda.gov/fdc/v1/foods/search",
        headers={"X-Api-Key": config.usda_api_key},
        json={"query": name, "pageSize": 8, "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]},
    )
    response.raise_for_status()
    candidates = response.json().get("foods", [])
    # Avoid substituting unrelated high-ranking matches for unfamiliar Indian or mixed dishes.
    stopwords = {"with", "and", "the", "of", "as", "ingredient", "nfs"}
    tokens = set(re.findall(r"[a-z]+", name.lower())) - stopwords
    def candidate_score(candidate):
        match_tokens = set(re.findall(r"[a-z]+", candidate.get("description", "").lower())) - stopwords
        overlap = len(tokens & match_tokens)
        # Rank the simplest matching food ahead of derivatives: cooked rice should
        # resolve to cooked rice, not the first upstream result (often rice noodles).
        return overlap / max(len(tokens), 1) + overlap / max(len(match_tokens), 1)

    for candidate in sorted(candidates, key=candidate_score, reverse=True):
        match_tokens = set(re.findall(r"[a-z]+", candidate.get("description", "").lower())) - stopwords
        if not tokens or len(tokens & match_tokens) / len(tokens) < 0.6:
            continue
        nutrients = nutrient_map(candidate.get("foodNutrients", []))
        if all(nutrients[key] is not None for key in ("calories", "protein", "carbs", "fat")):
            # FDC energy is kcal, macros are grams, and sodium is milligrams, all per 100g.
            return {"nutrition": nutrients, "id": str(candidate["fdcId"]), "description": candidate.get("description", name)}
    return None


async def enrich_food(food: RecognizedFood, client: httpx.AsyncClient) -> tuple[dict, str | None]:
    source = "AI estimate (not composition-database verified)"
    source_id = ""
    source_url = ""
    nutrition = food.nutrition_per_100g.model_dump()
    warning = None
    try:
        match = await usda_match(client, food.name)
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        match = None
        warning = "FoodData Central is unavailable; review the AI nutrition estimates before saving."
    if match:
        nutrition = match["nutrition"]
        source = f"USDA FoodData Central: {match['description']}"[:200]
        source_id = match["id"]
        source_url = f"https://fdc.nal.usda.gov/food-details/{source_id}/nutrients"
    elif not warning:
        warning = f"No verified composition match for {food.name}; nutrients are AI estimates."
    return {
        "name": food.name, "portion_grams": food.portion_grams,
        "nutrition_per_100g": nutrition, "nutrition": scale_nutrition(nutrition, food.portion_grams),
        "source": source, "source_id": source_id, "source_url": source_url,
        "confidence": None, "is_estimate": True,
    }, warning


async def analyze_foods(foods: list[RecognizedFood], warnings: list[str]) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        results = await asyncio.gather(*(enrich_food(food, client) for food in foods))
    items = [item for item, _ in results]
    all_warnings = list(warnings) + [warning for _, warning in results if warning]
    if not settings().usda_api_key:
        all_warnings.append("USDA_API_KEY is not configured. Nutrition is based on AI estimates and should be corrected against a food label or composition source.")
    totals = {key: round(sum(item["nutrition"][key] or 0 for item in items), 2) if all(item["nutrition"][key] is not None for item in items) else None for key in NUTRIENTS}
    return {
        "items": items, "totals": totals, "warnings": list(dict.fromkeys(all_warnings)),
        "model": settings().openai_model, "estimated": True,
        "disclaimer": "Image-based portion sizes and nutrients are estimates. Check every item and adjust portions before saving. Confidence scores are unavailable for this provider.",
    }
