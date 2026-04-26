"""
Phase 2: User Preference Capture Layer

Provides a stable API payload contract and normalization/validation logic
for recommendation requests.
"""

from __future__ import annotations

import json
import re
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator


class BudgetLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PartyType(str, Enum):
    solo = "solo"
    couple = "couple"
    family = "family"
    group = "group"


LOCATION_SYNONYMS = {
    "bengaluru": "bangalore",
    "b'lore": "bangalore",
    "blr": "bangalore",
    "new delhi": "delhi",
    "bombay": "mumbai",
}

BUDGET_SYNONYMS = {
    "cheap": BudgetLevel.low,
    "budget": BudgetLevel.low,
    "affordable": BudgetLevel.low,
    "mid range": BudgetLevel.medium,
    "mid-range": BudgetLevel.medium,
    "moderate": BudgetLevel.medium,
    "premium": BudgetLevel.high,
    "expensive": BudgetLevel.high,
    "luxury": BudgetLevel.high,
}

CUISINE_SYNONYMS = {
    "north indian": "North Indian",
    "south indian": "South Indian",
    "chinese": "Chinese",
    "italian": "Italian",
    "mughlai": "Mughlai",
    "fast food": "Fast Food",
    "street food": "Street Food",
    "desserts": "Desserts",
}

ADDITIONAL_PREFERENCE_SYNONYMS = {
    "veg": "vegetarian",
    "pure veg": "vegetarian",
    "family friendly": "family-friendly",
    "quick service": "quick-service",
    "pet friendly": "pet-friendly",
}


def normalize_text(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip().lower())
    return normalized


def title_case_location(value: str) -> str:
    if value.lower() == "delhi ncr":
        return "Delhi NCR"
    return value.title()


class UserPreferenceInput(BaseModel):
    location: str = Field(..., min_length=2, description="City or area preference")
    budget: str | BudgetLevel = Field(..., description="Budget bucket or free-text equivalent")
    cuisines: list[str] = Field(..., min_length=1, description="Preferred cuisines")
    min_rating: float = Field(..., ge=0.0, le=5.0, description="Minimum acceptable rating")
    additional_preferences: list[str] = Field(default_factory=list, description="Optional constraints")
    party_type: PartyType | None = Field(default=None, description="Dining context")
    max_results: int = Field(default=10, ge=1, le=20, description="Top recommendations requested")

    @field_validator("location")
    @classmethod
    def validate_location(cls, value: str) -> str:
        cleaned = normalize_text(value)
        if cleaned in {"na", "none", "unknown", "-"}:
            raise ValueError("location must be a valid city/area")
        mapped = LOCATION_SYNONYMS.get(cleaned, cleaned)
        return title_case_location(mapped)

    @field_validator("budget")
    @classmethod
    def normalize_budget(cls, value: str | BudgetLevel) -> BudgetLevel:
        if isinstance(value, BudgetLevel):
            return value
        cleaned = normalize_text(value)
        mapped = BUDGET_SYNONYMS.get(cleaned, cleaned)
        if isinstance(mapped, BudgetLevel):
            return mapped
        try:
            return BudgetLevel(mapped)
        except ValueError as exc:
            valid = ", ".join(level.value for level in BudgetLevel)
            raise ValueError(f"budget must map to one of: {valid}") from exc

    @field_validator("cuisines")
    @classmethod
    def normalize_cuisines(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in values:
            if not item or not item.strip():
                continue
            cleaned = normalize_text(item)
            mapped = CUISINE_SYNONYMS.get(cleaned, cleaned.title())
            if mapped not in seen:
                seen.add(mapped)
                normalized.append(mapped)
        if not normalized:
            raise ValueError("at least one non-empty cuisine is required")
        return normalized

    @field_validator("additional_preferences")
    @classmethod
    def normalize_additional_preferences(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for item in values:
            cleaned = normalize_text(item)
            if not cleaned:
                continue
            mapped = ADDITIONAL_PREFERENCE_SYNONYMS.get(cleaned, cleaned)
            if mapped not in seen:
                seen.add(mapped)
                normalized.append(mapped)
        return normalized

    @model_validator(mode="after")
    def validate_request_feasibility(self) -> "UserPreferenceInput":
        if self.min_rating >= 4.8 and self.budget == BudgetLevel.low:
            self.additional_preferences = list(
                dict.fromkeys(self.additional_preferences + ["strict-preferences"])
            )
        return self


class UserPreferenceOutput(BaseModel):
    location: str
    budget: BudgetLevel
    cuisines: list[str]
    min_rating: float
    additional_preferences: list[str]
    party_type: PartyType | None
    max_results: int
    filter_hints: dict[str, Any] = Field(default_factory=dict)


def build_output_contract(user_input: UserPreferenceInput) -> UserPreferenceOutput:
    filter_hints = {
        "strict_mode": "strict-preferences" in user_input.additional_preferences,
        "cuisine_match_mode": "any",
        "rating_floor": user_input.min_rating,
    }

    return UserPreferenceOutput(
        location=user_input.location,
        budget=user_input.budget,
        cuisines=user_input.cuisines,
        min_rating=user_input.min_rating,
        additional_preferences=user_input.additional_preferences,
        party_type=user_input.party_type,
        max_results=user_input.max_results,
        filter_hints=filter_hints,
    )


def normalize_preference_payload(payload: dict[str, Any]) -> dict[str, Any]:
    validated_input = UserPreferenceInput(**payload)
    output = build_output_contract(validated_input)
    return output.model_dump()


def main() -> None:
    sample_payload = {
        "location": "Bengaluru",
        "budget": "affordable",
        "cuisines": ["north indian", "Chinese", "  "],
        "min_rating": 4.0,
        "additional_preferences": ["family friendly", "quick service"],
        "party_type": "family",
        "max_results": 8,
    }

    print("Input payload:")
    print(json.dumps(sample_payload, indent=2))
    print("\nNormalized output contract:")
    try:
        print(json.dumps(normalize_preference_payload(sample_payload), indent=2))
    except ValidationError as exc:
        print(exc.json(indent=2))


if __name__ == "__main__":
    main()
