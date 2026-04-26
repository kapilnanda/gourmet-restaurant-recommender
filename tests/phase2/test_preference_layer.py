import pytest
from pydantic import ValidationError

from src.phase2.preference_layer import normalize_preference_payload


def test_normalize_preference_payload_basic_case() -> None:
    payload = {
        "location": "Bengaluru",
        "budget": "affordable",
        "cuisines": ["north indian", "Chinese"],
        "min_rating": 4.0,
        "additional_preferences": ["family friendly"],
        "party_type": "family",
        "max_results": 8,
    }

    output = normalize_preference_payload(payload)
    assert output["location"] == "Bangalore"
    assert output["budget"] == "low"
    assert output["cuisines"] == ["North Indian", "Chinese"]
    assert output["additional_preferences"] == ["family-friendly"]


def test_invalid_budget_raises_validation_error() -> None:
    payload = {
        "location": "Delhi",
        "budget": "free",
        "cuisines": ["Chinese"],
        "min_rating": 3.8,
    }
    with pytest.raises(ValidationError):
        normalize_preference_payload(payload)
