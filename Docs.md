# Problem Statement: AI-Powered Restaurant Recommendation System (Zomato Use Case)

Build an AI-powered restaurant recommendation application inspired by Zomato.  
The system should combine structured restaurant data with a Large Language Model (LLM) to deliver personalized, natural-language recommendations.

## Objective

Design and implement an application that:

- Accepts user preferences (location, budget, cuisine, rating, etc.)
- Uses a real-world restaurant dataset
- Applies an LLM to generate personalized recommendations
- Presents clear, useful, and easy-to-read results

## System Workflow

### 1) Data Ingestion

- Load and preprocess the Zomato dataset from Hugging Face:  
  [https://huggingface.co/datasets/ManikaSaini/zomato-restaurant-recommendation](https://huggingface.co/datasets/ManikaSaini/zomato-restaurant-recommendation)
- Extract key fields such as:
  - Restaurant name
  - Location
  - Cuisine
  - Estimated cost
  - Rating
  - Other useful attributes (if available)

### 2) User Input

Collect user preferences, including:

- Source: Basic web UI form (primary input channel)
- Location (for example, Delhi or Bangalore)
- Budget range (low, medium, high)
- Preferred cuisine (for example, Italian or Chinese)
- Minimum acceptable rating
- Additional preferences (for example, family-friendly, quick service)

### 3) Integration Layer

- Filter and prepare restaurant records based on user preferences
- Convert filtered data into a structured prompt context
- Design prompts that help the LLM compare, reason, and rank options

### 4) Recommendation Engine

Use the LLM to:

- Rank the best matching restaurants
- Explain why each recommendation fits the user needs
- Optionally provide a short summary or comparison of top choices

### 5) Output Display

Present top recommendations in a user-friendly format with:

- Restaurant name
- Cuisine
- Rating
- Estimated cost
- AI-generated reasoning

## Phase-Wise Architecture

### Phase 1: Foundation and Data Setup

**Goal:** Prepare reliable restaurant data for downstream recommendation logic.

**Core Components:**
- Dataset Connector (Hugging Face loader)
- Data Cleaning and Validation Pipeline
- Feature Standardization Module
- Data Storage Layer (CSV/SQLite/PostgreSQL)
- Basic Web UI (initial user input source for recommendation requests)

**Input:**
- Raw Zomato dataset

**Processing:**
- Remove null/duplicate records
- Normalize fields (location names, cuisines, cost range, rating scale)
- Create derived attributes (budget category, cuisine tags)

**Output:**
- Clean, query-ready restaurant dataset

**Deliverable:**
- Versioned data ingestion script and validated dataset snapshot

### Phase 2: User Preference Capture Layer

**Goal:** Collect user intent in a structured and consistent format.

**Core Components:**
- UI Form or Chat Input Interface
- Input Validation Module
- Preference Schema Mapper

**Input:**
- User choices (location, budget, cuisine, minimum rating, additional constraints)

**Processing:**
- Validate ranges and required fields
- Map free-text preferences to normalized values (for example, "cheap" -> low budget)

**Output:**
- Structured user preference object

**Deliverable:**
- Stable API payload contract for recommendations

### Phase 3: Candidate Retrieval and Filtering

**Goal:** Narrow dataset to high-relevance restaurant candidates before LLM reasoning.

**Core Components:**
- Query Builder
- Rule-Based Filter Engine
- Candidate Scoring Pre-Ranker

**Input:**
- Structured user preference object
- Clean restaurant dataset

**Processing:**
- Apply hard filters (location, minimum rating, budget bounds)
- Apply soft matching (cuisine similarity, special preferences)
- Select top-N candidate restaurants for prompt context

**Output:**
- Ranked candidate list (pre-LLM)

**Deliverable:**
- Deterministic filtering logic with configurable weights

### Phase 4: LLM Recommendation and Explanation Engine

**Goal:** Convert candidate list into personalized, human-like recommendations.

**Core Components:**
- Prompt Builder
- LLM Inference Service
- Response Formatter and Guardrails

**Input:**
- Top-N candidate restaurants
- User preference summary

**Processing:**
- Build constrained prompt with restaurant facts
- Ask LLM to rank options and justify each choice
- Enforce output structure (JSON/template) for consistency

**Output:**
- Personalized ranked recommendations with explanations

**Deliverable:**
- Prompt template library and model response schema

### Phase 5: Presentation and User Experience

**Goal:** Deliver recommendations in a clear and actionable interface.

**Core Components:**
- Result Card Renderer (web/mobile)
- Sorting and Comparison View
- Optional Follow-Up Query Support

**Input:**
- Structured recommendation response from LLM layer

**Processing:**
- Render restaurant cards with key attributes
- Show explanation text and comparison summary
- Support refinement actions (change budget, cuisine, rating)

**Output:**
- User-facing recommendation screen

**Deliverable:**
- Production-ready results UI with responsive design

### Phase 6: Observability, Evaluation, and Improvement

**Goal:** Measure quality, reliability, and business impact over time.

**Core Components:**
- Logging and Monitoring
- Recommendation Quality Evaluator
- Feedback Collection Module

**Input:**
- User interactions and feedback
- System logs (latency, token usage, failures)

**Processing:**
- Track metrics: precision of matches, click-through rate, satisfaction score
- Run offline and online evaluation for prompt/model variants
- Improve filtering weights and prompt strategy iteratively

**Output:**
- Performance reports and tuning insights

**Deliverable:**
- Continuous improvement loop for recommendation quality

## High-Level Data Flow

`Dataset -> Cleaned Store -> User Preferences -> Filter Engine -> Top-N Candidates -> LLM Ranking -> UI Output -> Feedback Loop`

## Suggested Tech Stack (Optional)

- **Backend:** Python (FastAPI/Flask)
- **Data:** Pandas + SQLite/PostgreSQL
- **LLM Layer:** OpenAI/other LLM API via prompt templates
- **Frontend:** HTML/CSS/JavaScript or React
- **Monitoring:** Basic logs first, then metrics dashboard

## Detailed Edge Cases

### 1) Data Ingestion and Dataset Quality

- **Missing critical fields:** Restaurant rows missing location, cuisine, cost, or rating should be excluded or filled with safe defaults.
- **Duplicate restaurants across multiple rows:** Same restaurant with slight name variation (for example, "Dominos" vs "Domino's") should be deduplicated using fuzzy matching.
- **Inconsistent rating formats:** Ratings like `4.2/5`, `NEW`, `-`, or text labels should be normalized before filtering.
- **Invalid cost values:** Negative cost, zero cost for premium restaurants, or mixed currency symbols should be flagged and cleaned.
- **Inconsistent location naming:** Variants like `Bengaluru`, `Bangalore`, `B'lore` should map to one canonical value.
- **Cuisine string noise:** Combined formats like `North Indian, Chinese, Fast Food` should split into normalized tags.
- **Outlier entries:** Unrealistic ratings/costs can skew ranking and should be capped or handled by anomaly rules.
- **Schema drift from source:** Upstream dataset column names may change; ingestion should fail with clear error logs, not silently.

### 2) User Input Validation and Preference Interpretation

- **Empty user submission:** If user submits no preferences, system should ask follow-up questions instead of returning random choices.
- **Unknown city input:** If location is outside dataset coverage, suggest nearest supported city or fallback to popular areas.
- **Budget ambiguity:** Inputs like `affordable`, `not too expensive`, `mid-range` should be mapped through NLP rules.
- **Contradictory constraints:** Very low budget + very high rating + niche cuisine may produce zero candidates; return best alternatives with explanation.
- **Invalid rating bounds:** Inputs like rating `> 5` or negative values should be clamped/rejected with user-friendly feedback.
- **Spelling mistakes:** Cuisine typos such as `Itallian` or `Chineese` should be corrected via fuzzy matching.
- **Multiple cuisines with AND/OR ambiguity:** Clarify whether user wants all cuisines or any one of them.
- **Language variation in inputs:** Mixed-language queries (English + local terms) should be interpreted consistently.

### 3) Candidate Filtering and Pre-Ranking

- **No candidate after hard filters:** Trigger relaxation strategy (expand budget range, nearby localities, slightly lower rating threshold).
- **Too many candidates:** Apply deterministic pre-ranking and cap context size before sending to LLM.
- **Bias toward highly reviewed chains:** Include diversity constraints to prevent all recommendations being large chains only.
- **Conflicting metadata:** Same restaurant with different ratings across rows should use latest or weighted average.
- **Fresh vs old ratings imbalance:** Old ratings may not reflect current quality; include recency if available.
- **Sparse data for niche cuisines:** If few matches exist, include close cuisine alternatives and label them clearly.
- **Location granularity mismatch:** User gives neighborhood but dataset has city-level location only; apply hierarchical fallback.
- **Special requirements not in data:** Preferences like `wheelchair accessible` or `pet friendly` may be unavailable; surface limitation transparently.

### 4) Prompt Construction and LLM Robustness

- **Prompt overflow/token limit:** Large candidate payloads should be truncated with stable top-N policy.
- **Hallucinated restaurants:** Model may invent options not in dataset; enforce output grounding to candidate IDs only.
- **Wrong factual details in explanation:** Cross-check model response against source fields before display.
- **Prompt injection via user text:** Sanitize user input and isolate it from system/developer instructions.
- **Overconfident tone on low-signal data:** Force model to include uncertainty wording when data quality is weak.
- **Inconsistent ranking logic:** Same input should produce similar ranking; lower randomness and add deterministic tie-breaks.
- **Formatting breakage:** LLM may return unstructured text; use schema validation and repair pass.
- **Multilingual output mismatch:** User language preference should be honored; fallback language should be explicit.

### 5) Recommendation Output and User Experience

- **Empty explanation text:** If model explanation is blank, show safe template-based explanation from structured fields.
- **Cost/rating display mismatch:** Ensure displayed values are formatted and units are consistent with dataset.
- **Repeated restaurants in top list:** Enforce uniqueness by restaurant ID/name-location pair.
- **Misleading confidence:** Avoid showing precise confidence scores unless calibrated by evaluation.
- **Unclear fallback messaging:** If constraints are relaxed, clearly tell user what was relaxed and why.
- **Accessibility issues in UI:** Long explanations should wrap properly and support screen-reader compatibility.
- **Slow response perception:** Show loading state and progressive updates for long LLM calls.
- **User refinement loop failure:** Preserve prior preferences when user edits only one field.

### 6) Performance, Reliability, and Scalability

- **High concurrent traffic:** Introduce caching for repeated preference combinations and rate limiting for API endpoints.
- **LLM API timeout/failure:** Return deterministic rule-based recommendations as fallback.
- **Partial pipeline failure:** If LLM fails but filtering succeeds, still return candidate list with non-LLM explanations.
- **Cold start latency:** Pre-load model client and warm caches during service startup.
- **Database lock/contention:** Use connection pooling and retry policies for write/read conflicts.
- **Memory spikes on large datasets:** Use batch processing and indexed queries instead of full in-memory scans.
- **Third-party outage (dataset/API):** Circuit breaker and graceful degradation path should be in place.
- **Regional network issues:** Add retry with backoff and user-visible status for transient failures.

### 7) Security and Abuse Handling

- **Input abuse/spam:** Throttle repeated requests and validate payload size.
- **Prompt-level attacks:** Strip hidden instructions and detect suspicious patterns in free-text preferences.
- **Sensitive data leakage in logs:** Avoid logging raw user PII and redact request payload fields if needed.
- **Unauthorized API access:** Protect endpoints with auth tokens where required.
- **CORS misconfiguration:** Restrict frontend origins in production.
- **Dependency vulnerabilities:** Pin and regularly scan packages used for API, LLM SDK, and parsing.

### 8) Monitoring, Evaluation, and Feedback Loop

- **Silent quality degradation:** Track recommendation quality metrics over time and alert on drops.
- **Feedback skew:** Only unhappy users may submit feedback; balance with implicit signals (clicks, saves).
- **A/B test contamination:** Ensure users remain in same experiment bucket across sessions.
- **Metric gaming:** CTR can rise with clickbait recommendations; monitor downstream satisfaction too.
- **Unlabeled failure causes:** Tag failures by stage (ingestion/filter/LLM/UI) for faster debugging.
- **Drift in user behavior:** Periodically retrain or retune ranking weights and prompt examples.
- **Insufficient observability:** Correlate each response with trace ID to debug end-to-end flow.

### 9) Domain-Specific Business Edge Cases (Restaurant Context)

- **Restaurant permanently closed but still listed:** Include freshness checks and stale-record suppression.
- **Temporary closures or delivery-only mode:** Recommendation output should mark availability status if known.
- **Festival/holiday demand spikes:** Wait times may rise; recommendations should consider time-based context when available.
- **Different branches, same name:** Distinguish by locality to prevent wrong branch recommendation.
- **Pure veg/jain/halal constraints:** Must be treated as hard constraints when user specifies dietary restrictions.
- **Family vs solo dining expectations:** Ranking criteria should adjust by party context (ambience, seating, noise).
- **Peak-hour suitability:** Quick-service request during peak hours should prefer fast-turnaround options.

## Edge-Case Test Strategy (Recommended)

- **Unit tests:** Data cleaning rules, normalization functions, filter logic, prompt builders.
- **Integration tests:** End-to-end flow from user input to final response with mock LLM.
- **Contract tests:** Validate LLM response schema and fallback behavior on malformed output.
- **Load tests:** Measure latency and failure rates under concurrent usage.
- **Chaos tests:** Simulate LLM timeout, DB outage, and network errors to verify graceful degradation.
- **Golden test set:** Maintain fixed input scenarios and expected top recommendations for regression checks.

## Phase 1 Implementation (Completed)

The Phase 1 data setup pipeline is implemented in:

- `src/phase1/data_setup.py`

### What it does

- Loads the dataset from Hugging Face (`ManikaSaini/zomato-restaurant-recommendation`)
- Standardizes schema and handles column aliasing
- Cleans and normalizes:
  - restaurant name
  - location
  - cuisines
  - estimated cost for two
  - rating
- Drops invalid/missing records for required fields
- Deduplicates restaurants using normalized name + location keys
- Creates derived fields:
  - `budget_category` (`low`, `medium`, `high`)
  - `cuisine_tags` (pipe-separated normalized tags)
- Exports outputs:
  - cleaned CSV
  - SQLite table (`restaurants`)
  - validation report JSON with row-level stats

### How to run

1. Install dependencies:
   - `pip install -r requirements.txt`
2. Run Phase 1 pipeline:
   - `python src/phase1/data_setup.py`
3. Optional custom output version:
   - `python src/phase1/data_setup.py --output-dir phase1/data/processed/v2`

### Default output files

- `phase1/data/processed/v1/zomato_cleaned.csv`
- `phase1/data/processed/v1/zomato_cleaned.sqlite`
- `phase1/data/processed/v1/phase1_validation_report.json`

## Phase 2 Implementation (Completed)

The Phase 2 preference capture and validation layer is implemented in:

- `src/phase2/preference_layer.py`

### What it does

- Defines a stable API payload contract for user preferences
- Validates required inputs:
  - location
  - budget
  - cuisines
  - minimum rating
  - optional additional preferences
  - optional party type
  - max results
- Normalizes free-text values:
  - location aliases (for example, Bengaluru -> Bangalore)
  - budget aliases (for example, affordable -> low)
  - cuisine labels and deduplication
  - additional preference labels
- Produces a normalized output contract for Phase 3 filtering
- Adds machine-friendly `filter_hints` for downstream ranking/filter logic

### How to run

1. Install dependencies:
   - `pip install -r requirements.txt`
2. Run sample validation/normalization:
   - `python src/phase2/preference_layer.py`

### Deliverable mapping (Phase 2)

- **Input Validation Module:** Implemented via Pydantic validators
- **Preference Schema Mapper:** Implemented via normalization and synonym mapping
- **Stable API Payload Contract:** Implemented via `UserPreferenceInput` and `UserPreferenceOutput`

## Phase 3 Implementation (Completed)

The Phase 3 candidate retrieval and filtering layer is implemented in:

- `src/phase3/retrieval_filtering.py`

### What it does

- Loads cleaned dataset from Phase 1 output CSV
- Accepts raw preferences and normalizes them using Phase 2 contract
- Applies hard filters:
  - location
  - minimum rating
  - budget category
- Applies deterministic pre-ranking:
  - cuisine overlap score
  - normalized rating score
  - normalized votes score
  - small bonus for matching additional preferences
- Returns top-N candidates for prompt context (Phase 4 input)

### How to run

1. Ensure Phase 1 output exists:
   - `phase1/data/processed/v1/zomato_cleaned.csv`
2. Run Phase 3 with sample preferences:
   - `python src/phase3/retrieval_filtering.py`
3. Run with custom preferences:
   - `python src/phase3/retrieval_filtering.py --prefs-json "{\"location\":\"Bangalore\",\"budget\":\"medium\",\"cuisines\":[\"North Indian\"],\"min_rating\":4.0,\"additional_preferences\":[\"family friendly\"],\"max_results\":5}"`

### Deliverable mapping (Phase 3)

- **Query Builder:** Implemented via normalized preference-to-filter mapping
- **Rule-Based Filter Engine:** Implemented via hard filter functions
- **Candidate Scoring Pre-Ranker:** Implemented via weighted deterministic scoring
- **Top-N Candidate Output:** Implemented via bounded candidate selection

## Phase 4 Implementation (Completed)

The Phase 4 LLM recommendation and explanation layer is implemented in:

- `src/phase4/llm_recommendation.py`

### LLM provider

- **Provider:** Groq
- **SDK dependency:** `groq` (added in `requirements.txt`)
- **Environment variable:** `GROQ_API_KEY`

### What it does

- Builds constrained prompt payload from:
  - normalized user preferences
  - Phase 3 top-N candidates
- Calls Groq Chat Completions API and requests JSON output
- Validates model output against structured response schema
- Returns ranked recommendations with per-item explanations
- Falls back gracefully to deterministic Phase 3 ranking when:
  - API key is missing
  - Groq API fails/times out
  - LLM response is malformed or schema-invalid

### How to run

1. Set Groq API key:
   - Windows PowerShell: `$env:GROQ_API_KEY="your_key_here"`
2. Run Phase 4:
   - `python src/phase4/llm_recommendation.py`
3. Optional custom preferences:
   - `python src/phase4/llm_recommendation.py --prefs-json "{\"location\":\"Bangalore\",\"budget\":\"medium\",\"cuisines\":[\"North Indian\",\"Chinese\"],\"min_rating\":4.0,\"additional_preferences\":[\"family friendly\"],\"max_results\":5}"`

### Deliverable mapping (Phase 4)

- **Prompt Builder:** `build_prompt(...)`
- **LLM Inference Service (Groq):** `call_groq_json(...)`
- **Response Formatter + Guardrails:** `RecommendationResponse` schema validation + fallback logic

## UI Input Schema (Web Form -> API)

Use this schema for the basic web UI so frontend and backend remain aligned.

### Form fields

- `location` (string, required): City/area, for example `Bangalore`
- `budget` (string, required): `low` | `medium` | `high` (or synonyms like `affordable`)
- `cuisines` (array of strings, required): At least one cuisine
- `min_rating` (number, required): Range `0.0` to `5.0`
- `additional_preferences` (array of strings, optional): For example `family friendly`, `quick service`
- `party_type` (string, optional): `solo` | `couple` | `family` | `group`
- `max_results` (integer, optional): Range `1` to `20` (default `10`)

### Example request payload

```json
{
  "location": "Bengaluru",
  "budget": "affordable",
  "cuisines": ["north indian", "chinese"],
  "min_rating": 4.0,
  "additional_preferences": ["family friendly", "quick service"],
  "party_type": "family",
  "max_results": 8
}
```

### Example normalized payload (Phase 2 output contract)

```json
{
  "location": "Bangalore",
  "budget": "low",
  "cuisines": ["North Indian", "Chinese"],
  "min_rating": 4.0,
  "additional_preferences": ["family-friendly", "quick-service"],
  "party_type": "family",
  "max_results": 8,
  "filter_hints": {
    "strict_mode": false,
    "cuisine_match_mode": "any",
    "rating_floor": 4.0
  }
}
```
