import math
import re

import httpx
from flask import Blueprint, current_app, jsonify, request

from app.security import internal_only

blueprint = Blueprint("barcode", __name__)


def numeric(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result >= 0 else None
    except (ValueError, TypeError):
        return None


def valid_barcode(barcode):
    if not isinstance(barcode, str) or not re.fullmatch(r"\d{8}|\d{12,14}", barcode):
        return False
    digits = list(map(int, barcode))
    checksum = sum(number * (3 if index % 2 == 0 else 1) for index, number in enumerate(reversed(digits[:-1])))
    return (10 - checksum % 10) % 10 == digits[-1]


@blueprint.post("/integrations/barcode/")
@internal_only
def lookup_barcode():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify(detail="Provide a JSON body with barcode and optional portion_grams."), 400
    barcode = body.get("barcode")
    if not valid_barcode(barcode):
        return jsonify(detail="Use a valid 8, 12, 13, or 14 digit EAN/UPC barcode, including its check digit."), 400
    grams = numeric(body.get("portion_grams", 100))
    if grams is None or grams <= 0 or grams > 5000:
        return jsonify(detail="portion_grams must be between 0 and 5000."), 400
    try:
        response = httpx.get(
            f"https://world.openfoodfacts.org/api/v3/product/{barcode}",
            params={"fields": "code,product_name,brands,nutriments,serving_size,allergens_tags,ingredients_text,image_front_url"},
            headers={"User-Agent": current_app.config["OPENFOODFACTS_USER_AGENT"]}, timeout=15,
        )
        if response.status_code == 404:
            return jsonify(detail="This product was not found in Open Food Facts. Enter the label manually."), 404
        if response.status_code == 429:
            return jsonify(detail="The barcode provider is rate limited. Please retry later."), 503
        response.raise_for_status()
        product = response.json().get("product")
        if not isinstance(product, dict) or not product:
            return jsonify(detail="This product was not found in Open Food Facts. Enter the label manually."), 404
        values = product.get("nutriments", {})
        kcal = numeric(values.get("energy-kcal_100g"))
        if kcal is None:
            kj = numeric(values.get("energy-kj_100g", values.get("energy_100g")))
            kcal = round(kj / 4.184, 2) if kj is not None else None
        sodium = numeric(values.get("sodium_100g"))
        nutrients = {
            "calories": kcal, "protein": numeric(values.get("proteins_100g")),
            "carbs": numeric(values.get("carbohydrates_100g")), "fat": numeric(values.get("fat_100g")),
            "fiber": numeric(values.get("fiber_100g")), "sugar": numeric(values.get("sugars_100g")),
            "sodium": round(sodium * 1000, 2) if sodium is not None else None,
        }
        for key, value in nutrients.items():
            upper_bound = 1000 if key == "calories" else 100000 if key == "sodium" else 100
            if value is not None and value > upper_bound:
                nutrients[key] = None
        missing = [key for key in ("calories", "protein", "carbs", "fat") if nutrients[key] is None]
        if missing:
            return jsonify(detail="This product has incomplete nutrition information. Enter its label manually.", missing_nutrients=missing), 422
        item = {
            "name": product.get("product_name") or f"Product {barcode}", "portion_grams": grams,
            "nutrition_per_100g": nutrients,
            "nutrition": {key: round(value * grams / 100, 2) if value is not None else None for key, value in nutrients.items()},
            "source": "Open Food Facts (product label, community maintained)", "source_id": barcode,
            "source_url": f"https://world.openfoodfacts.org/product/{barcode}",
            "is_estimate": False, "confidence": None,
        }
        return jsonify(item=item, product={
            "barcode": barcode, "brand": product.get("brands", ""), "serving_size": product.get("serving_size", ""),
            "allergens": product.get("allergens_tags", []), "ingredients": product.get("ingredients_text", ""),
            "image_url": product.get("image_front_url"),
        }, warnings=["Check the package label: Open Food Facts is community maintained and product formulations can change."], attribution="Open Food Facts contributors, ODbL. Product images are subject to their source license.")
    except (httpx.HTTPError, ValueError, TypeError):
        return jsonify(detail="Open Food Facts is temporarily unavailable. Please try again."), 502
