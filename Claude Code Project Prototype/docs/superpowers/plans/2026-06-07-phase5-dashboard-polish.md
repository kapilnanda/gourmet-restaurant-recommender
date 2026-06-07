# Phase 5: Dashboard Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Assumes Phase 4 (`docs/superpowers/plans/2026-06-07-phase4-resume-upload.md`) is complete and merged. This is the final MVP phase — it closes out the remaining items from the design spec.

**Goal:** Add filter/sort controls over the ranked results (company, location, salary, posted date, work mode), surface a first-run setup-status check so users with missing API keys get clear instructions instead of opaque errors, and do a final pass over every error-handling path called out in the design spec to confirm each shows a clear inline message and never crashes the app.

**Architecture:**
- Backend: a small `GET /config/status` endpoint that reports which required keys are configured (without leaking their values), so the frontend can show first-run setup instructions proactively rather than waiting for a search to fail.
- Frontend: pure, independently-tested filter/sort helpers (`app/results_filters.py` → actually `frontend/results_filters.py`) operating on the scored-results payload already in `st.session_state` — filtering happens client-side since the full result set is already fetched and held for the duration of the search (per the spec, no new backend query params are needed). A small UI control panel renders above the results and narrows what `render_scored_results` displays.
- A setup-instructions banner renders at the top of the app when `/config/status` reports missing configuration, pointing the user at `.env.example`.

No new external integrations — this phase is entirely about UX polish and the error/setup paths already designed into earlier phases.

---

## File Structure

- Modify: `backend/app/main.py` — add `GET /config/status`
- Modify: `backend/tests/test_main.py` — tests for `/config/status`
- Create: `frontend/results_filters.py` — pure filter/sort helpers + `render_filter_controls()`
- Create: `frontend/tests/test_results_filters.py` — unit tests for the pure filter/sort helpers
- Create: `frontend/tests/__init__.py` — empty, marks the tests package (first frontend tests in the project)
- Modify: `frontend/requirements.txt` — add `pytest` (frontend now has its own test suite)
- Modify: `frontend/results.py` — apply filters/sort before rendering
- Create: `frontend/setup_banner.py` — `render_setup_banner()`; checks `/config/status` and renders instructions if anything is missing
- Modify: `frontend/app.py` — render the setup banner and filter controls

---

## Task 1: `GET /config/status`

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing API tests**

Append to `backend/tests/test_main.py`:

```python
def test_config_status_reports_all_configured(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GROQ_API_KEY", "groq-secret")

    response = client.get("/config/status")

    assert response.status_code == 200
    body = response.json()
    assert body == {"configured": True, "missing": []}


def test_config_status_reports_missing_keys_without_leaking_values(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)

    response = client.get("/config/status")

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert set(body["missing"]) == {"ADZUNA_APP_KEY", "GROQ_API_KEY"}
    assert "abc123" not in response.text  # never echoes configured values
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`): `pytest tests/test_main.py -v -k config_status`
Expected: FAIL — `/config/status` route doesn't exist (404s)

- [ ] **Step 3: Add a `missing_keys` helper to `Settings` and implement the route**

Modify `backend/app/config.py` — add a classmethod that reports missing keys without raising, so the route can use it directly:

```python
    @staticmethod
    def missing_keys() -> list[str]:
        required = ["ADZUNA_APP_ID", "ADZUNA_APP_KEY", "GROQ_API_KEY"]
        return [name for name in required if not os.environ.get(name)]
```

Add to `backend/app/main.py`:

```python
@app.get("/config/status")
def config_status():
    missing = Settings.missing_keys()
    return {"configured": not missing, "missing": missing}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_main.py -v -k config_status`
Expected: PASS (2 passed)

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/app/main.py backend/tests/test_main.py
git commit -m "Add GET /config/status for first-run setup detection"
```

---

## Task 2: Frontend Test Scaffolding

**Files:**
- Modify: `frontend/requirements.txt`
- Create: `frontend/tests/__init__.py`

- [ ] **Step 1: Add `pytest` to `frontend/requirements.txt`**

```
streamlit==1.38.0
requests==2.32.3
pytest==8.3.2
```

Run: `pip install -r frontend/requirements.txt`

- [ ] **Step 2: Create the tests package marker**

Create `frontend/tests/__init__.py`, empty (zero bytes).

- [ ] **Step 3: Commit**

```bash
git add frontend/requirements.txt frontend/tests/__init__.py
git commit -m "Add pytest to the frontend for testing pure filter/sort helpers"
```

---

## Task 3: Pure Filter/Sort Helpers

**Files:**
- Create: `frontend/results_filters.py`
- Create: `frontend/tests/test_results_filters.py`

- [ ] **Step 1: Write the failing tests for the pure filter/sort functions**

Create `frontend/tests/test_results_filters.py`:

```python
from results_filters import FilterOptions, apply_filters, derive_filter_options

ENTRIES = [
    {
        "job": {"title": "Backend Engineer", "company": "Acme", "location": "Bengaluru, Karnataka",
                "salary_min": 1200000, "salary_max": 1800000, "posted_date": "2026-06-05T10:00:00Z",
                "description": "...", "url": "https://x/1"},
        "match": {"score": 90, "rationale": "great", "mismatches": []},
    },
    {
        "job": {"title": "Platform Engineer", "company": "Globex", "location": "Pune, Maharashtra",
                "salary_min": 900000, "salary_max": 1400000, "posted_date": "2026-06-03T10:00:00Z",
                "description": "...", "url": "https://x/2"},
        "match": {"score": 65, "rationale": "ok", "mismatches": ["needs more experience"]},
    },
    {
        "job": {"title": "Remote Backend Dev", "company": "Acme", "location": "Remote",
                "salary_min": None, "salary_max": None, "posted_date": "2026-06-06T10:00:00Z",
                "description": "...", "url": "https://x/3"},
        "match": {"score": 80, "rationale": "good", "mismatches": []},
    },
]


def test_derive_filter_options_collects_unique_companies_and_locations():
    options = derive_filter_options(ENTRIES)

    assert options.companies == ["Acme", "Globex"]
    assert options.locations == ["Bengaluru, Karnataka", "Pune, Maharashtra", "Remote"]


def test_apply_filters_with_no_filters_returns_all_sorted_by_score_desc():
    result = apply_filters(ENTRIES, FilterOptions())

    assert [e["job"]["title"] for e in result] == [
        "Backend Engineer", "Remote Backend Dev", "Platform Engineer",
    ]


def test_apply_filters_by_company():
    result = apply_filters(ENTRIES, FilterOptions(company="Acme"))

    assert {e["job"]["title"] for e in result} == {"Backend Engineer", "Remote Backend Dev"}


def test_apply_filters_by_minimum_salary():
    result = apply_filters(ENTRIES, FilterOptions(min_salary=1000000))

    titles = {e["job"]["title"] for e in result}
    assert titles == {"Backend Engineer"}  # Globex's max (1.4M) and Remote's None are excluded


def test_apply_filters_by_work_mode_using_location_text():
    result = apply_filters(ENTRIES, FilterOptions(location="Remote"))

    assert [e["job"]["title"] for e in result] == ["Remote Backend Dev"]


def test_apply_filters_sort_by_posted_date_desc():
    result = apply_filters(ENTRIES, FilterOptions(sort_by="posted_date"))

    assert [e["job"]["title"] for e in result] == [
        "Backend Engineer", "Remote Backend Dev", "Platform Engineer",
    ]
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `frontend/`): `pytest tests/test_results_filters.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'results_filters'`

- [ ] **Step 3: Implement `FilterOptions`, `derive_filter_options`, and `apply_filters`**

Create `frontend/results_filters.py`:

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class FilterOptions:
    company: Optional[str] = None
    location: Optional[str] = None
    min_salary: Optional[int] = None
    sort_by: str = "score"  # "score" | "salary" | "posted_date"


@dataclass
class DerivedOptions:
    companies: list[str]
    locations: list[str]


def derive_filter_options(entries: list[dict]) -> DerivedOptions:
    companies = sorted({e["job"]["company"] for e in entries})
    locations = sorted({e["job"]["location"] for e in entries})
    return DerivedOptions(companies=companies, locations=locations)


def _matches(entry: dict, options: FilterOptions) -> bool:
    job = entry["job"]

    if options.company and job["company"] != options.company:
        return False

    if options.location and options.location.lower() not in job["location"].lower():
        return False

    if options.min_salary is not None:
        salary_max = job.get("salary_max")
        if salary_max is None or salary_max < options.min_salary:
            return False

    return True


_SORT_KEYS = {
    "score": lambda e: e["match"]["score"],
    "salary": lambda e: e["job"].get("salary_max") or 0,
    "posted_date": lambda e: e["job"]["posted_date"],
}


def apply_filters(entries: list[dict], options: FilterOptions) -> list[dict]:
    filtered = [e for e in entries if _matches(e, options)]
    key = _SORT_KEYS.get(options.sort_by, _SORT_KEYS["score"])
    return sorted(filtered, key=key, reverse=True)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_results_filters.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add frontend/results_filters.py frontend/tests/test_results_filters.py
git commit -m "Add pure filter/sort helpers for the results dashboard"
```

---

## Task 4: Filter Controls UI and Wiring into Results

**Files:**
- Modify: `frontend/results_filters.py`
- Modify: `frontend/results.py`

- [ ] **Step 1: Add `render_filter_controls` to `results_filters.py`**

Append to `frontend/results_filters.py`:

```python
import streamlit as st


def render_filter_controls(entries: list[dict]) -> FilterOptions:
    derived = derive_filter_options(entries)

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        company = st.selectbox("Company", ["All"] + derived.companies)
    with col2:
        location = st.text_input("Location contains", value="")
    with col3:
        min_salary = st.number_input("Minimum salary (INR/year)", min_value=0, step=100000, value=0)
    with col4:
        sort_by = st.selectbox("Sort by", ["score", "salary", "posted_date"], format_func=lambda s: {
            "score": "Fit score", "salary": "Salary", "posted_date": "Posted date",
        }[s])

    return FilterOptions(
        company=None if company == "All" else company,
        location=location or None,
        min_salary=min_salary or None,
        sort_by=sort_by,
    )
```

- [ ] **Step 2: Apply filters before rendering in `results.py`**

Modify `frontend/results.py` — wrap the body of `render_scored_results` with the filter controls:

```python
from results_filters import apply_filters, render_filter_controls


def render_scored_results(payload: dict) -> None:
    jobs = payload.get("jobs", [])

    if not jobs:
        st.info(payload.get("message", "No jobs found for these filters."))
        return

    options = render_filter_controls(jobs)
    filtered = apply_filters(jobs, options)

    if not filtered:
        st.info("No results match these filters — try widening them.")
        return

    st.subheader(f"Showing {len(filtered)} of {len(jobs)} matches")
    for entry in filtered:
        # ... existing per-entry rendering body is unchanged ...
```

- [ ] **Step 3: Manual verification via `docker-compose up`**

Run: `docker-compose up --build`

Manually verify:
1. After a search returns results, filter controls (company, location, minimum salary, sort-by) appear above the list.
2. Selecting a company narrows the list to that company only; the "Showing N of M matches" count updates.
3. Typing a location substring (e.g., "Remote") filters to matching listings.
4. Setting a minimum salary excludes listings whose max salary is below it (and listings with no salary data).
5. Switching "Sort by" between fit score, salary, and posted date re-orders the list accordingly.
6. Filtering down to zero results shows "No results match these filters — try widening them." without breaking the page.

- [ ] **Step 4: Commit**

```bash
git add frontend/results_filters.py frontend/results.py
git commit -m "Add filter/sort controls to the results dashboard"
```

---

## Task 5: First-Run Setup Banner

**Files:**
- Create: `frontend/setup_banner.py`
- Modify: `frontend/app.py`

- [ ] **Step 1: Implement `render_setup_banner`**

Create `frontend/setup_banner.py`:

```python
import requests
import streamlit as st

from profile_form import BACKEND_URL


def render_setup_banner() -> None:
    try:
        response = requests.get(f"{BACKEND_URL}/config/status", timeout=10)
        response.raise_for_status()
    except requests.RequestException:
        st.error(
            "Can't reach the backend service. Make sure it's running "
            "(`docker-compose up`) and reachable at " + BACKEND_URL + "."
        )
        return

    status = response.json()
    if status["configured"]:
        return

    missing = ", ".join(status["missing"])
    st.warning(
        f"Setup needed: missing environment variable(s) **{missing}**. "
        "Copy `.env.example` to `.env` at the project root, fill in your "
        "Adzuna and Groq API keys, then restart the backend "
        "(`docker-compose up --build`)."
    )
```

- [ ] **Step 2: Render it at the top of `app.py`**

Modify `frontend/app.py` — render the banner immediately after `st.title(...)`, before the resume uploader and profile form:

```python
from setup_banner import render_setup_banner

# ...
st.title("Job Search Tool")
render_setup_banner()
```

- [ ] **Step 3: Manual verification via `docker-compose up`**

Manually verify:
1. With all keys configured in `.env`, no banner appears.
2. Temporarily remove a key from `.env`, restart (`docker-compose up --build`), and confirm the warning banner names exactly the missing key(s) and points at `.env.example` — without ever displaying configured key values.
3. Stop the backend container (`docker-compose stop backend`) while the frontend is running, reload the page, and confirm the "Can't reach the backend service" message appears instead of a stack trace.

- [ ] **Step 4: Commit**

```bash
git add frontend/setup_banner.py frontend/app.py
git commit -m "Add first-run setup banner driven by /config/status"
```

---

## Task 6: Error-Path Review Pass

**Files:** none (review and, where gaps are found, small fixes to existing files)

Walk through every error-handling scenario named in the design spec's "Error Handling" section and confirm each produces a clear inline message with no crash. This is a verification task — if any path is missing or unclear, fix it in the relevant file from the phase that introduced it (Phase 2 for job-fetch errors, Phase 3 for LLM errors, Phase 4 for resume-parsing errors) rather than adding new abstractions here.

- [ ] **Step 1: API failures** — temporarily set an invalid `ADZUNA_APP_KEY`, run a search, confirm "Job search API unavailable, please try again shortly." appears (from Phase 2's `/search` 502 handling) and the app stays usable.
- [ ] **Step 2: No results** — search with an unrealistic filter combination that returns zero listings; confirm "No jobs found for these filters." appears (from Phase 2/3's empty-results handling).
- [ ] **Step 3: LLM scoring failures** — temporarily set an invalid `GROQ_API_KEY`, run a search with valid job results; confirm the app shows either a partial ranked list (if some jobs scored) or "No jobs found for these filters." (if all failed) per Phase 3's skip-on-failure behavior, and check the backend logs show per-job warnings.
- [ ] **Step 4: Resume parsing failures** — upload an unsupported file type and, separately, a resume while the Groq key is invalid; confirm both show "We couldn't parse your resume. Please fill in the form manually." (Phase 4) and the manual form remains fully usable.
- [ ] **Step 5: Missing/invalid API keys** — covered by Task 5's setup banner; confirm it appears on first run with a fresh `.env` copied from `.env.example` with placeholder values.
- [ ] **Step 6: Backend unreachable** — covered by Task 5's banner and the per-action `requests.RequestException` handlers added in Phases 1-4 (`profile_form.py`, `app.py`'s search handler, `resume_upload.py`, `setup_banner.py`); confirm each shows "Backend unavailable, please try again." (or the banner's variant) rather than an unhandled exception.
- [ ] **Step 7: Record findings** — if every path already behaves correctly, no code changes are needed; simply check off this task. If a gap is found, fix it directly in the owning file and note the fix in the commit message below.

- [ ] **Step 8: Commit (only if fixes were made)**

```bash
git add -A
git commit -m "Close gaps found in the error-handling review pass"
```

---

## Task 7: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: All tests pass, no failures or errors.

- [ ] **Step 2: Run the full frontend test suite**

Run (from `frontend/`): `pytest -v`
Expected: All tests pass (filter/sort helper tests), no failures or errors.

- [ ] **Step 3: Full end-to-end MVP smoke test**

Run: `docker-compose up --build`. Walk the complete golden path described in the design spec: (optionally) upload a resume → review/edit pre-filled profile → save → search → filter/sort ranked results → open an apply link. Then exercise each error path from Task 6 once more as a final regression check. Stop with `docker-compose down`.

- [ ] **Step 4: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"

---

This completes the MVP as scoped in the design spec (`docs/superpowers/specs/2026-06-07-job-search-tool-design.md`). Items explicitly out of scope (scheduled refresh/caching, rule-based pre-filtering, multi-user accounts, cross-session favorites) remain candidate future enhancements per that spec.
