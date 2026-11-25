"""Validated provider and API contracts. Nutrients use kcal/g/mg per 100 g."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Nutrients(StrictModel):
    calories: float = Field(ge=0, le=1000)
    protein: float = Field(ge=0, le=100)
    carbs: float = Field(ge=0, le=100)
    fat: float = Field(ge=0, le=100)
    fiber: float | None = Field(ge=0, le=100)
    sugar: float | None = Field(ge=0, le=100)
    sodium: float | None = Field(ge=0, le=100000)


class RecognizedFood(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    portion_grams: float = Field(gt=0, le=5000)
    nutrition_per_100g: Nutrients


class VisionResponse(StrictModel):
    items: list[RecognizedFood] = Field(max_length=30)
    warnings: list[str] = Field(max_length=12)


class PersonalizationRequest(StrictModel):
    preferences: list[Annotated[str, Field(max_length=80)]] = Field(default_factory=list, max_length=30)
    allergies: list[Annotated[str, Field(max_length=80)]] = Field(default_factory=list, max_length=30)
    context: dict = Field(default_factory=dict)


class EstimateRequest(PersonalizationRequest):
    query: str = Field(min_length=2, max_length=1000)
    portion_grams: float = Field(default=100, gt=0, le=5000)


class RecommendationRequest(PersonalizationRequest):
    query: str = Field(default="Suggest balanced meals", min_length=2, max_length=2000)


class Recommendation(StrictModel):
    name: str
    reason: str


class RecommendationResponse(StrictModel):
    recommendations: list[Recommendation] = Field(max_length=8)
    disclaimer: str


class Recipe(StrictModel):
    name: str
    description: str
    ingredients: list[str] = Field(max_length=30)
    instructions: list[str] = Field(max_length=20)
    prep_minutes: int = Field(ge=1, le=1440)


class RecipeResponse(StrictModel):
    recipes: list[Recipe] = Field(max_length=6)
    disclaimer: str


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AssistantRequest(PersonalizationRequest):
    message: str = Field(min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class AssistantResponse(StrictModel):
    reply: str
    disclaimer: str
