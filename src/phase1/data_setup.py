"""
Phase 1: Foundation and Data Setup

Builds a clean, query-ready restaurant dataset from the Hugging Face
Zomato restaurant recommendation dataset.
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
from datasets import load_dataset


DEFAULT_DATASET = "ManikaSaini/zomato-restaurant-recommendation"
REQUIRED_STANDARD_COLUMNS = [
    "restaurant_name",
    "location",
    "cuisines",
    "estimated_cost_for_two",
    "rating",
]


@dataclass
class ProcessingStats:
    rows_loaded: int = 0
    rows_after_standardization: int = 0
    rows_dropped_missing_required: int = 0
    rows_dropped_invalid_cost: int = 0
    rows_dropped_invalid_rating: int = 0
    rows_dropped_duplicates: int = 0
    rows_output: int = 0


def normalize_column_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def pick_column(df: pd.DataFrame, aliases: list[str]) -> str | None:
    available = set(df.columns)
    for alias in aliases:
        if alias in available:
            return alias
    return None


def standardize_schema(df: pd.DataFrame) -> pd.DataFrame:
    renamed = df.rename(columns={c: normalize_column_name(c) for c in df.columns})

    alias_map = {
        "restaurant_name": ["restaurant_name", "name", "res_name", "restaurant"],
        "location": ["location", "city", "address", "locality"],
        "cuisines": ["cuisines", "cuisine", "food_type", "food_types"],
        "estimated_cost_for_two": [
            "average_cost_for_two",
            "approx_cost_for_two_people",
            "cost_for_two",
            "estimated_cost_for_two",
            "price_for_two",
        ],
        "rating": ["aggregate_rating", "rating", "user_rating", "rate"],
        "votes": ["votes", "num_votes", "review_count"],
    }

    out = pd.DataFrame(index=renamed.index)
    for target, aliases in alias_map.items():
        source = pick_column(renamed, aliases)
        out[target] = renamed[source] if source else None

    return out


def clean_text(value: Any) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null", "-"}:
        return None
    return re.sub(r"\s+", " ", text)


def normalize_location(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None

    lowered = text.lower()
    replacement_map = {
        "bengaluru": "Bangalore",
        "b'lore": "Bangalore",
        "blr": "Bangalore",
        "new delhi": "Delhi",
        "ncr": "Delhi NCR",
        "mumbai suburban": "Mumbai",
        "bombay": "Mumbai",
    }
    if lowered in replacement_map:
        return replacement_map[lowered]
    return text.title()


def parse_rating(value: Any) -> float | None:
    text = clean_text(value)
    if not text:
        return None

    text = text.lower()
    if text in {"new", "not rated"}:
        return None

    match = re.search(r"\d+(\.\d+)?", text)
    if not match:
        return None

    rating = float(match.group())
    if rating < 0 or rating > 5:
        return None
    return round(rating, 1)


def parse_cost(value: Any) -> int | None:
    text = clean_text(value)
    if not text:
        return None

    digits = re.sub(r"[^0-9]", "", text)
    if not digits:
        return None

    cost = int(digits)
    if cost <= 0:
        return None
    return cost


def normalize_cuisines(value: Any) -> tuple[str | None, str | None]:
    text = clean_text(value)
    if not text:
        return None, None

    cuisines = [item.strip().title() for item in text.split(",") if item.strip()]
    if not cuisines:
        return None, None
    return ", ".join(cuisines), "|".join(cuisines)


def budget_category(cost_for_two: int) -> str:
    if cost_for_two <= 500:
        return "low"
    if cost_for_two <= 1500:
        return "medium"
    return "high"


def build_dedup_key(row: pd.Series) -> str:
    name = re.sub(r"[^a-z0-9]", "", str(row["restaurant_name"]).lower())
    location = re.sub(r"[^a-z0-9]", "", str(row["location"]).lower())
    return f"{name}_{location}"


def run_pipeline(dataset_name: str, output_dir: Path, split: str) -> dict[str, Any]:
    stats = ProcessingStats()

    dataset = load_dataset(dataset_name, split=split)
    raw_df = dataset.to_pandas()
    stats.rows_loaded = len(raw_df)

    df = standardize_schema(raw_df)
    stats.rows_after_standardization = len(df)

    df["restaurant_name"] = df["restaurant_name"].map(clean_text)
    df["location"] = df["location"].map(normalize_location)
    df["rating"] = df["rating"].map(parse_rating)
    df["estimated_cost_for_two"] = df["estimated_cost_for_two"].map(parse_cost)
    cuisine_normalized = df["cuisines"].map(normalize_cuisines)
    df["cuisines"] = cuisine_normalized.map(lambda t: t[0])
    df["cuisine_tags"] = cuisine_normalized.map(lambda t: t[1])

    before_required_drop = len(df)
    df = df.dropna(subset=REQUIRED_STANDARD_COLUMNS).copy()
    stats.rows_dropped_missing_required = before_required_drop - len(df)

    before_cost_filter = len(df)
    df = df[df["estimated_cost_for_two"] > 0].copy()
    stats.rows_dropped_invalid_cost = before_cost_filter - len(df)

    before_rating_filter = len(df)
    df = df[(df["rating"] >= 0) & (df["rating"] <= 5)].copy()
    stats.rows_dropped_invalid_rating = before_rating_filter - len(df)

    df["budget_category"] = df["estimated_cost_for_two"].map(budget_category)
    df["dedup_key"] = df.apply(build_dedup_key, axis=1)

    before_dedup = len(df)
    df = df.sort_values(by=["rating", "estimated_cost_for_two"], ascending=[False, True])
    df = df.drop_duplicates(subset=["dedup_key"], keep="first").copy()
    stats.rows_dropped_duplicates = before_dedup - len(df)

    df = df.reset_index(drop=True)
    df.insert(0, "restaurant_id", [f"rest_{i+1:06d}" for i in range(len(df))])
    stats.rows_output = len(df)

    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "zomato_cleaned.csv"
    sqlite_path = output_dir / "zomato_cleaned.sqlite"
    report_path = output_dir / "phase1_validation_report.json"

    df.drop(columns=["dedup_key"]).to_csv(csv_path, index=False)

    with sqlite3.connect(sqlite_path) as conn:
        df.drop(columns=["dedup_key"]).to_sql("restaurants", conn, if_exists="replace", index=False)

    report = {
        "dataset": dataset_name,
        "split": split,
        "output_files": {
            "csv": str(csv_path),
            "sqlite": str(sqlite_path),
        },
        "required_columns": REQUIRED_STANDARD_COLUMNS,
        "stats": stats.__dict__,
        "unique_locations": int(df["location"].nunique()),
        "unique_cuisine_tags": int(
            df["cuisine_tags"].fillna("").str.split("|").explode().replace("", pd.NA).dropna().nunique()
        ),
        "rating_summary": {
            "min": float(df["rating"].min()) if not df.empty else None,
            "max": float(df["rating"].max()) if not df.empty else None,
            "mean": float(round(df["rating"].mean(), 3)) if not df.empty else None,
        },
        "cost_summary": {
            "min": int(df["estimated_cost_for_two"].min()) if not df.empty else None,
            "max": int(df["estimated_cost_for_two"].max()) if not df.empty else None,
            "median": float(df["estimated_cost_for_two"].median()) if not df.empty else None,
        },
    }

    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Phase 1 Zomato data ingestion and preprocessing pipeline.")
    parser.add_argument("--dataset", default=DEFAULT_DATASET, help="Hugging Face dataset identifier.")
    parser.add_argument("--split", default="train", help="Dataset split to load.")
    parser.add_argument(
        "--output-dir",
        default="phase1/data/processed/v1",
        help="Directory for cleaned outputs (CSV, SQLite, validation report).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    report = run_pipeline(
        dataset_name=args.dataset,
        output_dir=Path(args.output_dir),
        split=args.split,
    )
    print("Phase 1 data setup completed.")
    print(json.dumps(report["stats"], indent=2))
    print(f"Validation report: {Path(args.output_dir) / 'phase1_validation_report.json'}")


if __name__ == "__main__":
    main()
