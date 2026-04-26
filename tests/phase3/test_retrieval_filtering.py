import pandas as pd

from src.phase3.retrieval_filtering import apply_hard_filters, score_candidates, select_top_candidates


def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "restaurant_id": "rest_1",
                "restaurant_name": "A",
                "location": "Bangalore",
                "cuisines": "North Indian, Chinese",
                "cuisine_tags": "North Indian|Chinese",
                "estimated_cost_for_two": 900,
                "budget_category": "medium",
                "rating": 4.4,
                "votes": 210,
                "rest_type": "Casual Dining",
            },
            {
                "restaurant_id": "rest_2",
                "restaurant_name": "B",
                "location": "Bangalore",
                "cuisines": "Italian",
                "cuisine_tags": "Italian",
                "estimated_cost_for_two": 1100,
                "budget_category": "medium",
                "rating": 4.5,
                "votes": 120,
                "rest_type": "Cafe",
            },
            {
                "restaurant_id": "rest_3",
                "restaurant_name": "C",
                "location": "Delhi",
                "cuisines": "North Indian",
                "cuisine_tags": "North Indian",
                "estimated_cost_for_two": 1000,
                "budget_category": "medium",
                "rating": 4.7,
                "votes": 80,
                "rest_type": "Casual Dining",
            },
        ]
    )


def test_apply_hard_filters_by_location_budget_rating() -> None:
    prefs = {
        "location": "Bangalore",
        "budget": "medium",
        "min_rating": 4.2,
    }
    filtered = apply_hard_filters(_sample_df(), prefs)
    assert list(filtered["restaurant_id"]) == ["rest_1", "rest_2"]


def test_scoring_prioritizes_cuisine_overlap() -> None:
    prefs = {
        "location": "Bangalore",
        "budget": "medium",
        "min_rating": 4.0,
        "cuisines": ["North Indian", "Chinese"],
        "additional_preferences": [],
    }
    filtered = apply_hard_filters(_sample_df(), prefs)
    scored = score_candidates(filtered, prefs)
    assert scored.iloc[0]["restaurant_id"] == "rest_1"


def test_select_top_candidates_limit() -> None:
    prefs = {
        "location": "Bangalore",
        "budget": "medium",
        "min_rating": 4.0,
        "cuisines": ["North Indian", "Chinese"],
        "additional_preferences": [],
    }
    filtered = apply_hard_filters(_sample_df(), prefs)
    scored = score_candidates(filtered, prefs)
    top = select_top_candidates(scored, max_results=1)
    assert len(top) == 1
