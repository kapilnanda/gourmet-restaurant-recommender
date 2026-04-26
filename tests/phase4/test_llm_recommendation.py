from src.phase4.llm_recommendation import build_prompt, generate_recommendations


def _sample_preferences() -> dict:
    return {
        "location": "Bangalore",
        "budget": "medium",
        "cuisines": ["North Indian", "Chinese"],
        "min_rating": 4.0,
        "additional_preferences": ["family-friendly"],
        "max_results": 2,
    }


def _sample_candidates() -> list[dict]:
    return [
        {
            "restaurant_id": "rest_1",
            "restaurant_name": "A",
            "location": "Indiranagar",
            "cuisines": "North Indian, Chinese",
            "rating": 4.6,
            "estimated_cost_for_two": 1200,
            "budget_category": "medium",
            "final_score": 1.2,
        },
        {
            "restaurant_id": "rest_2",
            "restaurant_name": "B",
            "location": "Koramangala",
            "cuisines": "Chinese",
            "rating": 4.5,
            "estimated_cost_for_two": 1000,
            "budget_category": "medium",
            "final_score": 1.1,
        },
    ]


def test_build_prompt_contains_constraints_and_candidates() -> None:
    prompt = build_prompt(_sample_preferences(), _sample_candidates())
    assert "Return valid JSON only" in prompt
    assert "rest_1" in prompt


def test_generate_recommendations_uses_llm_mode_when_valid() -> None:
    def fake_llm(_: str) -> dict:
        return {
            "summary": "Great options for your preference.",
            "recommendations": [
                {
                    "restaurant_id": "rest_1",
                    "restaurant_name": "A",
                    "rank": 1,
                    "explanation": "High rating and matching cuisines in your budget.",
                }
            ],
        }

    result = generate_recommendations(_sample_preferences(), _sample_candidates(), llm_callable=fake_llm)
    assert result["mode"] == "llm"
    assert result["recommendation_response"]["recommendations"][0]["restaurant_id"] == "rest_1"


def test_generate_recommendations_falls_back_on_invalid_llm_output() -> None:
    def invalid_llm(_: str) -> dict:
        return {"oops": "bad format"}

    result = generate_recommendations(_sample_preferences(), _sample_candidates(), llm_callable=invalid_llm)
    assert result["mode"] == "fallback"
    assert len(result["recommendation_response"]["recommendations"]) >= 1
