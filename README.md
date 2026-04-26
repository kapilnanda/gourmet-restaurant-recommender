# Zomato AI Recommender (Phase-Wise)

Phase-wise implementation of an AI-powered restaurant recommendation system.

## Project Structure

- `src/phase1`: Data ingestion, cleaning, normalization, and dataset export.
- `src/phase2`: User preference validation, normalization, and payload contract mapping.
- `src/phase3`: Candidate retrieval, filtering, and deterministic pre-ranking.
- `src/phase4`: Groq-based LLM ranking and explanation generation with fallback.
- `tests/phase1`: Unit tests for Phase 1 functions.
- `tests/phase2`: Unit tests for Phase 2 functions.
- `tests/phase3`: Unit tests for Phase 3 functions.
- `tests/phase4`: Unit tests for Phase 4 functions.
- `phase1/data/processed/v1`: Generated output artifacts from Phase 1 pipeline.

## Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run Phase 1

Downloads and processes the restaurant dataset:

```bash
python src/phase1/data_setup.py
```

Optional custom output location:

```bash
python src/phase1/data_setup.py --output-dir phase1/data/processed/v2
```

## Run Phase 2

Validates and normalizes a sample user-preference payload:

```bash
python src/phase2/preference_layer.py
```

## Run Phase 3

Builds top-N candidates after hard filters and pre-ranking:

```bash
python src/phase3/retrieval_filtering.py
```

Optional custom user preferences:

```bash
python src/phase3/retrieval_filtering.py --prefs-json "{\"location\":\"Bangalore\",\"budget\":\"medium\",\"cuisines\":[\"North Indian\"],\"min_rating\":4.0,\"additional_preferences\":[\"family friendly\"],\"max_results\":5}"
```

## Run Phase 4 (Groq)

Generate LLM-ranked recommendations and explanations:

```bash
python src/phase4/llm_recommendation.py
```

Set API key in PowerShell first:

```bash
$env:GROQ_API_KEY="your_key_here"
```

## Run Tests

```bash
python -m pytest
```

## Generated Phase 1 Outputs

- `phase1/data/processed/v1/zomato_cleaned.csv`
- `phase1/data/processed/v1/zomato_cleaned.sqlite`
- `phase1/data/processed/v1/phase1_validation_report.json`
