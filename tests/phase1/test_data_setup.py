from src.phase1.data_setup import budget_category, normalize_location, parse_cost, parse_rating


def test_parse_rating_from_fraction_string() -> None:
    assert parse_rating("4.2/5") == 4.2


def test_parse_cost_with_currency_symbol() -> None:
    assert parse_cost("₹1,200") == 1200


def test_location_alias_normalization() -> None:
    assert normalize_location("bengaluru") == "Bangalore"


def test_budget_category_mapping() -> None:
    assert budget_category(400) == "low"
    assert budget_category(900) == "medium"
    assert budget_category(2200) == "high"
