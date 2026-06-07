# Phase 2: Job Fetcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Assumes Phase 1 (`docs/superpowers/plans/2026-06-07-phase1-profile-form.md`) is complete and merged.

**Goal:** Integrate a job aggregator API (Adzuna, primary) into the backend. Build a pure query-builder (profile → API params) and response normalizer (raw API job → internal `Job` model) as independently-tested modules, expose them via `POST /search`, and wire a "Search" button in the frontend that displays the raw, unranked results. Proves the data pipeline end-to-end — no LLM scoring yet (that's Phase 3).

**Architecture:** New backend module `app/job_fetcher.py` containing:
- `Job` (Pydantic model: title, company, description, location, salary, posted_date, url)
- `build_query_params(profile: Profile) -> dict` — pure function translating the profile into Adzuna query params (keywords from role + skills, location, `max_days_old=5`, results capped at 50)
- `normalize_job(raw: dict) -> Job` — pure function mapping a raw Adzuna listing to the internal `Job` model, tolerant of missing optional fields (salary, etc.)
- `fetch_jobs(profile: Profile) -> list[Job]` — calls the Adzuna API with the built params, normalizes each result, caps at 50; raises a typed `JobFetchError` on failure (network error, non-2xx, rate limit) for the route layer to translate into a clean error response

`POST /search` reads the currently-stored profile, calls `fetch_jobs`, and returns the list of normalized jobs (or a structured error). The frontend gets a "Search" button that posts to `/search` and renders a simple unranked list (title, company, location, salary, posted date, apply link).

**Tech Stack additions:** `httpx` (outbound HTTP from the backend; already a dev dependency from Phase 1's `TestClient`, now also used at runtime), `respx` (mocking `httpx` calls in tests)

---

## File Structure

- Modify: `backend/requirements.txt` — add `httpx` as a runtime dep (move from test-only), add `respx` for tests
- Create: `backend/app/job_fetcher.py` — `Job` model, `build_query_params`, `normalize_job`, `fetch_jobs`, `JobFetchError`
- Create: `backend/app/config.py` — reads `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` from the environment, raises a clear startup error if missing
- Modify: `backend/app/main.py` — add `POST /search`
- Create: `backend/tests/test_job_fetcher.py` — unit tests for `build_query_params`, `normalize_job`, and `fetch_jobs` (mocked HTTP)
- Modify: `backend/tests/test_main.py` — API tests for `/search`
- Create: `.env.example` (repo root) — documents `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `GROQ_API_KEY` (placeholder for Phase 3) with setup instructions
- Modify: `docker-compose.yml` — pass `.env` through to the backend service
- Create: `frontend/results.py` — `render_raw_results(jobs)`; renders the unranked list
- Modify: `frontend/app.py` — add the "Search" button and wire in `render_raw_results`

---

## Task 1: Adzuna Credentials & Config

**Files:**
- Create: `backend/app/config.py`
- Create: `.env.example`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Sign up for Adzuna API access**

Register at Adzuna's developer portal, obtain `app_id` and `app_key` for the India job market. Confirm with a manual `curl` call against `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=...&app_key=...&what=python` that it returns results.

- [ ] **Step 2: Write the failing test for config loading**

Create `backend/tests/test_config.py`:

```python
import pytest

from app.config import Settings, ConfigError


def test_settings_loads_from_environment(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")

    settings = Settings.from_env()

    assert settings.adzuna_app_id == "abc123"
    assert settings.adzuna_app_key == "secret"


def test_settings_raises_clear_error_when_missing(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)

    with pytest.raises(ConfigError, match="ADZUNA_APP_ID"):
        Settings.from_env()
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `backend/`): `pytest tests/test_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 4: Implement `Settings`**

Create `backend/app/config.py`:

```python
import os
from dataclasses import dataclass


class ConfigError(Exception):
    """Raised when required configuration is missing."""


@dataclass(frozen=True)
class Settings:
    adzuna_app_id: str
    adzuna_app_key: str

    @classmethod
    def from_env(cls) -> "Settings":
        app_id = os.environ.get("ADZUNA_APP_ID")
        app_key = os.environ.get("ADZUNA_APP_KEY")

        missing = [
            name
            for name, value in [("ADZUNA_APP_ID", app_id), ("ADZUNA_APP_KEY", app_key)]
            if not value
        ]
        if missing:
            raise ConfigError(
                f"Missing required environment variable(s): {', '.join(missing)}. "
                "Add them to your .env file (see .env.example)."
            )

        return cls(adzuna_app_id=app_id, adzuna_app_key=app_key)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pytest tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Create `.env.example` at the repo root**

```
# Adzuna job aggregator API — https://developer.adzuna.com/
ADZUNA_APP_ID=your-adzuna-app-id
ADZUNA_APP_KEY=your-adzuna-app-key

# Groq LLM — https://console.groq.com/  (used starting Phase 3)
GROQ_API_KEY=your-groq-api-key
```

- [ ] **Step 7: Wire `.env` into `docker-compose.yml`**

Add `env_file: .env` to the `backend` service in `docker-compose.yml`:

```yaml
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env
```

- [ ] **Step 8: Commit**

```bash
git add backend/app/config.py backend/tests/test_config.py .env.example docker-compose.yml
git commit -m "Add Adzuna config loading with clear missing-key errors"
```

---

## Task 2: `Job` Model and `normalize_job`

**Files:**
- Create: `backend/app/job_fetcher.py`
- Create: `backend/tests/test_job_fetcher.py`

- [ ] **Step 1: Write the failing test for normalization**

Create `backend/tests/test_job_fetcher.py`:

```python
from app.job_fetcher import Job, normalize_job

RAW_ADZUNA_JOB = {
    "title": "Backend Engineer",
    "company": {"display_name": "Acme Corp"},
    "description": "Build and maintain backend services...",
    "location": {"display_name": "Bengaluru, Karnataka"},
    "salary_min": 1200000.0,
    "salary_max": 2000000.0,
    "created": "2026-06-05T10:00:00Z",
    "redirect_url": "https://www.adzuna.in/details/123456",
}


def test_normalize_job_maps_known_fields():
    job = normalize_job(RAW_ADZUNA_JOB)

    assert job == Job(
        title="Backend Engineer",
        company="Acme Corp",
        description="Build and maintain backend services...",
        location="Bengaluru, Karnataka",
        salary_min=1200000,
        salary_max=2000000,
        posted_date="2026-06-05T10:00:00Z",
        url="https://www.adzuna.in/details/123456",
    )


def test_normalize_job_tolerates_missing_optional_fields():
    raw = dict(RAW_ADZUNA_JOB)
    del raw["salary_min"]
    del raw["salary_max"]

    job = normalize_job(raw)

    assert job.salary_min is None
    assert job.salary_max is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_job_fetcher.py -v -k normalize_job`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.job_fetcher'`

- [ ] **Step 3: Implement `Job` and `normalize_job`**

Create `backend/app/job_fetcher.py`:

```python
from typing import Optional

from pydantic import BaseModel


class Job(BaseModel):
    title: str
    company: str
    description: str
    location: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    posted_date: str
    url: str


def _to_int(value) -> Optional[int]:
    return int(value) if value is not None else None


def normalize_job(raw: dict) -> Job:
    return Job(
        title=raw.get("title", ""),
        company=raw.get("company", {}).get("display_name", ""),
        description=raw.get("description", ""),
        location=raw.get("location", {}).get("display_name", ""),
        salary_min=_to_int(raw.get("salary_min")),
        salary_max=_to_int(raw.get("salary_max")),
        posted_date=raw.get("created", ""),
        url=raw.get("redirect_url", ""),
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_job_fetcher.py -v -k normalize_job`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/job_fetcher.py backend/tests/test_job_fetcher.py
git commit -m "Add Job model and normalize_job"
```

---

## Task 3: `build_query_params`

**Files:**
- Modify: `backend/app/job_fetcher.py`
- Modify: `backend/tests/test_job_fetcher.py`

- [ ] **Step 1: Write the failing tests for query building**

Append to `backend/tests/test_job_fetcher.py`:

```python
from app.profile import Profile
from app.job_fetcher import build_query_params


def _profile(**overrides):
    base = dict(
        role="Backend Engineer",
        years_experience=5,
        locations=["Bengaluru", "Remote"],
        skills=["Python", "Django"],
        salary_min=1000000,
        salary_max=2000000,
        work_mode="Hybrid",
        notice_period_days=30,
        seniority="Senior",
    )
    base.update(overrides)
    return Profile(**base)


def test_build_query_params_combines_role_and_skills_into_keywords():
    params = build_query_params(_profile())

    assert params["what"] == "Backend Engineer Python Django"
    assert params["where"] == "Bengaluru"
    assert params["max_days_old"] == 5
    assert params["results_per_page"] == 50


def test_build_query_params_uses_first_location_only():
    params = build_query_params(_profile(locations=["Pune", "Remote"]))

    assert params["where"] == "Pune"


def test_build_query_params_omits_where_when_no_locations():
    params = build_query_params(_profile(locations=[]))

    assert "where" not in params
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_job_fetcher.py -v -k build_query_params`
Expected: FAIL with `ImportError: cannot import name 'build_query_params'`

- [ ] **Step 3: Implement `build_query_params`**

Append to `backend/app/job_fetcher.py`:

```python
from app.profile import Profile

MAX_RESULTS = 50
MAX_DAYS_OLD = 5


def build_query_params(profile: Profile) -> dict:
    keywords = " ".join([profile.role, *profile.skills]).strip()

    params: dict = {
        "what": keywords,
        "max_days_old": MAX_DAYS_OLD,
        "results_per_page": MAX_RESULTS,
    }

    if profile.locations:
        params["where"] = profile.locations[0]

    return params
```

(Note: place this function and its `MAX_RESULTS`/`MAX_DAYS_OLD` constants above `normalize_job`, and move the `from app.profile import Profile` import to the top of the file alongside the existing imports.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_job_fetcher.py -v -k build_query_params`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/job_fetcher.py backend/tests/test_job_fetcher.py
git commit -m "Add build_query_params for the Adzuna query builder"
```

---

## Task 4: `fetch_jobs` — Calling the Adzuna API

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/job_fetcher.py`
- Modify: `backend/tests/test_job_fetcher.py`

- [ ] **Step 1: Add `httpx` (runtime) and `respx` (test mocking) to `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pytest==8.3.2
httpx==0.27.2
respx==0.21.1
```

Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Write the failing tests for `fetch_jobs`**

Append to `backend/tests/test_job_fetcher.py`:

```python
import httpx
import respx

from app.config import Settings
from app.job_fetcher import JobFetchError, fetch_jobs

SETTINGS = Settings(adzuna_app_id="abc123", adzuna_app_key="secret")


@respx.mock
def test_fetch_jobs_returns_normalized_capped_results():
    route = respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(200, json={"results": [RAW_ADZUNA_JOB, RAW_ADZUNA_JOB]})
    )

    jobs = fetch_jobs(_profile(), SETTINGS)

    assert route.called
    assert len(jobs) == 2
    assert all(isinstance(job, Job) for job in jobs)
    assert jobs[0].title == "Backend Engineer"


@respx.mock
def test_fetch_jobs_raises_job_fetch_error_on_http_error():
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(429)
    )

    try:
        fetch_jobs(_profile(), SETTINGS)
        assert False, "expected JobFetchError"
    except JobFetchError as exc:
        assert "429" in str(exc) or "rate" in str(exc).lower()


@respx.mock
def test_fetch_jobs_raises_job_fetch_error_on_network_failure():
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        side_effect=httpx.ConnectError("connection refused")
    )

    try:
        fetch_jobs(_profile(), SETTINGS)
        assert False, "expected JobFetchError"
    except JobFetchError:
        pass
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest tests/test_job_fetcher.py -v -k fetch_jobs`
Expected: FAIL with `ImportError: cannot import name 'fetch_jobs'`

- [ ] **Step 4: Implement `JobFetchError` and `fetch_jobs`**

Append to `backend/app/job_fetcher.py`:

```python
import httpx

from app.config import Settings

ADZUNA_SEARCH_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1"


class JobFetchError(Exception):
    """Raised when the job aggregator API call fails."""


def fetch_jobs(profile: Profile, settings: Settings) -> list[Job]:
    params = {
        **build_query_params(profile),
        "app_id": settings.adzuna_app_id,
        "app_key": settings.adzuna_app_key,
        "content-type": "application/json",
    }

    try:
        response = httpx.get(ADZUNA_SEARCH_URL, params=params, timeout=10)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise JobFetchError(f"Adzuna returned HTTP {exc.response.status_code}") from exc
    except httpx.HTTPError as exc:
        raise JobFetchError(f"Failed to reach Adzuna: {exc}") from exc

    raw_jobs = response.json().get("results", [])
    return [normalize_job(raw) for raw in raw_jobs[:MAX_RESULTS]]
```

(Consolidate the `httpx`/`Settings` imports with the existing import block at the top of the file rather than duplicating them.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest tests/test_job_fetcher.py -v -k fetch_jobs`
Expected: PASS (3 passed)

- [ ] **Step 6: Run the full job_fetcher test module**

Run: `pytest tests/test_job_fetcher.py -v`
Expected: PASS (8 passed)

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/job_fetcher.py backend/tests/test_job_fetcher.py
git commit -m "Add fetch_jobs with typed JobFetchError on failure"
```

---

## Task 5: `POST /search` Endpoint

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing API tests**

Append to `backend/tests/test_main.py`:

```python
import respx
import httpx

from app.job_fetcher import RAW_ADZUNA_JOB  # re-export from test_job_fetcher if needed, or duplicate the fixture dict here


@respx.mock
def test_post_search_returns_normalized_jobs_for_saved_profile(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")

    client.post("/profile", json=_valid_payload())
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(200, json={"results": [RAW_ADZUNA_JOB]})
    )

    response = client.post("/search")

    assert response.status_code == 200
    body = response.json()
    assert len(body["jobs"]) == 1
    assert body["jobs"][0]["title"] == "Backend Engineer"


def test_post_search_returns_400_when_no_profile_saved(monkeypatch):
    from app.main import _STATE
    _STATE.pop("profile", None)

    response = client.post("/search")

    assert response.status_code == 400
    assert "profile" in response.json()["detail"].lower()


@respx.mock
def test_post_search_returns_502_with_clear_message_on_fetch_failure(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")

    client.post("/profile", json=_valid_payload())
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(503)
    )

    response = client.post("/search")

    assert response.status_code == 502
    assert "job search api" in response.json()["detail"].lower()
```

(Note: `RAW_ADZUNA_JOB` lives in `test_job_fetcher.py` as a module-level fixture dict — either move it to a shared `tests/fixtures.py` and import from both test modules, or duplicate the small dict in `test_main.py`. Prefer the shared fixtures module to avoid duplication.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_main.py -v -k search`
Expected: FAIL — `/search` route doesn't exist (404s)

- [ ] **Step 3: Implement `POST /search`**

Add to `backend/app/main.py` (alongside the existing imports and routes):

```python
from app.config import ConfigError, Settings
from app.job_fetcher import JobFetchError, fetch_jobs


@app.post("/search")
def search():
    profile = _STATE.get("profile")
    if profile is None:
        raise HTTPException(status_code=400, detail="Save a profile before searching.")

    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    try:
        jobs = fetch_jobs(profile, settings)
    except JobFetchError:
        raise HTTPException(
            status_code=502,
            detail="Job search API unavailable, please try again shortly.",
        )

    if not jobs:
        return {"jobs": [], "message": "No jobs found for these filters."}

    return {"jobs": jobs}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_main.py -v -k search`
Expected: PASS (3 passed)

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v`
Expected: All passing (≈26 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_main.py backend/tests/fixtures.py
git commit -m "Add POST /search endpoint wiring profile to the job fetcher"
```

---

## Task 6: Frontend — "Search" Button and Raw Results List

**Files:**
- Create: `frontend/results.py`
- Modify: `frontend/app.py`

- [ ] **Step 1: Implement `render_raw_results`**

Create `frontend/results.py`:

```python
import streamlit as st


def render_raw_results(payload: dict) -> None:
    jobs = payload.get("jobs", [])

    if not jobs:
        st.info(payload.get("message", "No jobs found for these filters."))
        return

    st.subheader(f"Found {len(jobs)} listings")
    for job in jobs:
        with st.container(border=True):
            st.markdown(f"**{job['title']}** — {job['company']}")
            st.caption(f"{job['location']} · posted {job['posted_date']}")
            if job.get("salary_min") or job.get("salary_max"):
                st.caption(f"Salary: {job.get('salary_min', '?')} – {job.get('salary_max', '?')}")
            st.write(job["description"][:280] + ("…" if len(job["description"]) > 280 else ""))
            st.markdown(f"[Apply]({job['url']})")
```

- [ ] **Step 2: Wire the "Search" button into `app.py`**

Modify `frontend/app.py` — add below the existing profile section:

```python
import requests

from results import render_raw_results

# ... existing profile form section stays as-is ...

if "profile" in st.session_state:
    st.header("Search for Jobs")
    if st.button("Search"):
        try:
            response = requests.post(f"{BACKEND_URL}/search", timeout=60)
        except requests.RequestException:
            st.error("Backend unavailable, please try again.")
        else:
            if response.status_code == 200:
                st.session_state["search_results"] = response.json()
            elif response.status_code == 400:
                st.warning(response.json()["detail"])
            elif response.status_code == 502:
                st.error(response.json()["detail"])
            elif response.status_code == 503:
                st.error(response.json()["detail"])
            else:
                st.error("Unexpected error running the search, please try again.")

    if "search_results" in st.session_state:
        render_raw_results(st.session_state["search_results"])
```

(`BACKEND_URL` is already defined in `profile_form.py` — import it from there, e.g. `from profile_form import BACKEND_URL`, rather than redefining it.)

- [ ] **Step 3: Manual verification via `docker-compose up`**

Run: `docker-compose up --build`

Manually verify:
1. After saving a valid profile, a "Search for Jobs" section with a "Search" button appears.
2. Clicking "Search" shows a spinner/runs, then displays a list of raw job listings (title, company, location, salary if present, posted date, truncated description, apply link).
3. If Adzuna returns no results for the profile's filters, the "No jobs found for these filters." message appears.
4. Temporarily set an invalid `ADZUNA_APP_KEY` in `.env`, restart the backend, and confirm the frontend shows "Job search API unavailable, please try again shortly." without crashing.

- [ ] **Step 4: Commit**

```bash
git add frontend/results.py frontend/app.py
git commit -m "Add Search button and raw results list to the frontend"
```

---

## Task 7: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: All tests pass, no failures or errors.

- [ ] **Step 2: Full-stack smoke test**

Run: `docker-compose up --build`. Confirm: save profile → click Search → see raw, unranked listings; confirm the no-results and API-failure paths show clear inline messages and the app doesn't crash. Stop with `docker-compose down`.

- [ ] **Step 3: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"
