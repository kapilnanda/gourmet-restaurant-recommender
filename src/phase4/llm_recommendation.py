"""
Phase 4: LLM Recommendation and Explanation Engine (Groq)

Uses Phase 3 top-N candidates and user preferences to build a grounded prompt,
call Groq, validate structured output, and return robust recommendations.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Callable

from pydantic import BaseModel, Field, ValidationError

try:
    from groq import Groq
except ModuleNotFoundError:
    Groq = None  # type: ignore[assignment]

try:
    from src.phase3.retrieval_filtering import run_phase3
except ModuleNotFoundError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
    from src.phase3.retrieval_filtering import run_phase3


DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class RecommendationItem(BaseModel):
    restaurant_id: str
    restaurant_name: str
    rank: int = Field(..., ge=1)
    explanation: str = Field(..., min_length=10)


class RecommendationResponse(BaseModel):
    summary: str = Field(..., min_length=10)
    recommendations: list[RecommendationItem] = Field(..., min_length=1)


def build_prompt(preferences: dict[str, Any], candidates: list[dict[str, Any]]) -> str:
    prompt_payload = {
        "task": (
            "Rank restaurant candidates and provide grounded explanations. "
            "Use only given candidates, do not invent any restaurant."
        ),
        "output_format": {
            "summary": "string",
            "recommendations": [
                {
                    "restaurant_id": "string",
                    "restaurant_name": "string",
                    "rank": "integer starting at 1",
                    "explanation": "1-2 sentences why this matches preferences",
                }
            ],
        },
        "constraints": [
            "Return valid JSON only. No markdown.",
            "Use each restaurant at most once.",
            "Rank in descending suitability.",
            "Ground every explanation in provided fields (rating, cuisine, cost, location).",
        ],
        "user_preferences": preferences,
        "candidates": candidates,
    }
    return json.dumps(prompt_payload, indent=2)


def _fallback_recommendations(candidates: list[dict[str, Any]]) -> RecommendationResponse:
    fallback_items: list[RecommendationItem] = []
    for idx, item in enumerate(candidates, start=1):
        fallback_items.append(
            RecommendationItem(
                restaurant_id=str(item.get("restaurant_id", "")),
                restaurant_name=str(item.get("restaurant_name", "")),
                rank=idx,
                explanation=(
                    f"Selected via deterministic fallback based on rating and filter score. "
                    f"Cuisine: {item.get('cuisines', 'N/A')}, rating: {item.get('rating', 'N/A')}."
                ),
            )
        )
    return RecommendationResponse(
        summary="LLM unavailable; returned deterministic fallback ranking from Phase 3 candidates.",
        recommendations=fallback_items or [
            RecommendationItem(
                restaurant_id="",
                restaurant_name="",
                rank=1,
                explanation="No candidates available after filtering.",
            )
        ],
    )


def call_groq_json(
    prompt: str,
    model: str = DEFAULT_GROQ_MODEL,
    temperature: float = 0.2,
) -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or Groq is None:
        raise RuntimeError("Groq SDK/API key unavailable")

    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a recommendation assistant. "
                    "Return strict JSON matching the requested schema."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content
    return json.loads(raw)


def generate_recommendations(
    preferences: dict[str, Any],
    candidates: list[dict[str, Any]],
    llm_callable: Callable[[str], dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if not candidates:
        return {
            "mode": "fallback",
            "recommendation_response": _fallback_recommendations(candidates).model_dump(),
        }

    prompt = build_prompt(preferences, candidates)
    llm_fn = llm_callable or call_groq_json

    try:
        raw = llm_fn(prompt)
        validated = RecommendationResponse(**raw)
        return {
            "mode": "llm",
            "provider": "groq",
            "prompt": prompt,
            "recommendation_response": validated.model_dump(),
        }
    except (ValidationError, RuntimeError, json.JSONDecodeError, KeyError, TypeError):
        fallback = _fallback_recommendations(candidates)
        return {
            "mode": "fallback",
            "provider": "groq",
            "prompt": prompt,
            "recommendation_response": fallback.model_dump(),
        }


def run_phase4(data_path: str, prefs: dict[str, Any]) -> dict[str, Any]:
    phase3_result = run_phase3(data_path, prefs)
    return generate_recommendations(
        preferences=phase3_result["normalized_preferences"],
        candidates=phase3_result["candidates"],
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 4 LLM recommendation engine using Groq.")
    parser.add_argument(
        "--data-path",
        default="phase1/data/processed/v1/zomato_cleaned.csv",
        help="Path to cleaned CSV from Phase 1.",
    )
    parser.add_argument(
        "--prefs-json",
        default="",
        help="Raw user preferences JSON string.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sample_prefs = {
        "location": "Bangalore",
        "budget": "medium",
        "cuisines": ["North Indian", "Chinese"],
        "min_rating": 4.0,
        "additional_preferences": ["family friendly", "quick service"],
        "party_type": "family",
        "max_results": 5,
    }
    prefs = json.loads(args.prefs_json) if args.prefs_json else sample_prefs
    result = run_phase4(args.data_path, prefs)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
