"""
Phase 3: Candidate Retrieval and Filtering

Loads cleaned restaurant data, applies hard filters, computes deterministic
pre-ranking scores, and returns top-N candidates for LLM prompt context.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

import pandas as pd

try:
    from src.phase2.preference_layer import normalize_preference_payload
except ModuleNotFoundError:
    # Allow direct script execution: python src/phase3/retrieval_filtering.py
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from src.phase2.preference_layer import normalize_preference_payload


def _norm_text(value: Any) -> str:
    if hasattr(value, "value"):
        value = value.value
    return str(value or "").strip().lower()


def load_restaurants(csv_path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    required = {
        "restaurant_id",
        "restaurant_name",
        "location",
        "cuisines",
        "cuisine_tags",
        "estimated_cost_for_two",
        "rating",
        "budget_category",
    }
    missing = required - set(df.columns)
    if missing:
        missing_str = ", ".join(sorted(missing))
        raise ValueError(f"Input dataset is missing required columns: {missing_str}")
    return df


def apply_hard_filters(df: pd.DataFrame, preferences: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()
    out = out[out["rating"] >= float(preferences["min_rating"])]
    out = out[out["budget_category"].astype(str).str.lower() == _norm_text(preferences["budget"])]
    target_location = _norm_text(preferences["location"])
    location_matched = out[out["location"].astype(str).str.lower() == target_location]
    if not location_matched.empty:
        return location_matched
    # Fallback for city/locality granularity mismatch in source data.
    return out


def _cuisine_overlap(row_cuisine_tags: str, preferred_cuisines: list[str]) -> int:
    row_set = {c.strip().lower() for c in str(row_cuisine_tags).split("|") if c.strip()}
    pref_set = {c.strip().lower() for c in preferred_cuisines if c.strip()}
    return len(row_set.intersection(pref_set))


def _pref_bonus(row: pd.Series, additional_prefs: list[str]) -> float:
    bonus = 0.0
    rest_type = _norm_text(row.get("rest_type", ""))
    for pref in additional_prefs:
        p = _norm_text(pref)
        if p == "family-friendly" and any(token in rest_type for token in ("family", "casual dining")):
            bonus += 0.2
        if p == "quick-service" and any(token in rest_type for token in ("quick bites", "fast food", "cafe")):
            bonus += 0.2
    return bonus


def score_candidates(df: pd.DataFrame, preferences: dict[str, Any]) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    scored = df.copy()
    cuisine_pref = preferences.get("cuisines", [])
    addl_pref = preferences.get("additional_preferences", [])

    scored["cuisine_overlap"] = scored["cuisine_tags"].map(lambda x: _cuisine_overlap(x, cuisine_pref))

    max_rating = max(float(scored["rating"].max()), 1.0)
    max_votes = max(float(scored["votes"].fillna(0).max()), 1.0) if "votes" in scored.columns else 1.0

    scored["rating_score"] = scored["rating"] / max_rating
    if "votes" in scored.columns:
        scored["votes_score"] = scored["votes"].fillna(0).map(lambda v: math.log1p(float(v)) / math.log1p(max_votes))
    else:
        scored["votes_score"] = 0.0
    scored["pref_bonus"] = scored.apply(lambda row: _pref_bonus(row, addl_pref), axis=1)

    scored["final_score"] = (
        scored["rating_score"] * 0.6
        + scored["cuisine_overlap"] * 0.25
        + scored["votes_score"] * 0.1
        + scored["pref_bonus"] * 0.05
    )

    return scored.sort_values(
        by=["final_score", "rating", "estimated_cost_for_two"],
        ascending=[False, False, True],
    )


def select_top_candidates(scored_df: pd.DataFrame, max_results: int) -> pd.DataFrame:
    columns = [
        "restaurant_id",
        "restaurant_name",
        "location",
        "cuisines",
        "rating",
        "estimated_cost_for_two",
        "budget_category",
        "final_score",
    ]
    available_columns = [col for col in columns if col in scored_df.columns]
    return scored_df.head(max_results)[available_columns].reset_index(drop=True)


def run_phase3(
    data_path: str | Path,
    raw_preferences: dict[str, Any],
) -> dict[str, Any]:
    preferences = normalize_preference_payload(raw_preferences)
    df = load_restaurants(data_path)
    filtered = apply_hard_filters(df, preferences)
    target_location = _norm_text(preferences["location"])
    location_exact_matches = int((df["location"].astype(str).str.lower() == target_location).sum())
    scored = score_candidates(filtered, preferences)
    top_candidates = select_top_candidates(scored, int(preferences["max_results"]))

    return {
        "normalized_preferences": preferences,
        "counts": {
            "input_rows": int(len(df)),
            "location_exact_matches": location_exact_matches,
            "after_hard_filters": int(len(filtered)),
            "final_candidates": int(len(top_candidates)),
        },
        "candidates": top_candidates.to_dict(orient="records"),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 3 candidate retrieval and filtering engine.")
    parser.add_argument(
        "--data-path",
        default="phase1/data/processed/v1/zomato_cleaned.csv",
        help="Path to cleaned restaurant CSV produced by Phase 1.",
    )
    parser.add_argument(
        "--prefs-json",
        default="",
        help="Raw user preference JSON string. If empty, a built-in sample is used.",
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

    raw_preferences = json.loads(args.prefs_json) if args.prefs_json else sample_prefs
    result = run_phase3(args.data_path, raw_preferences)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
