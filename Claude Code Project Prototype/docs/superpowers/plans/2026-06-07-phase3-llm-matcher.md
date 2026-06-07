# Phase 3: LLM Matcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Assumes Phase 2 (`docs/superpowers/plans/2026-06-07-phase2-job-fetcher.md`) is complete and merged.

**Goal:** Integrate Gemini as the LLM provider in the backend. Build pure, independently-tested prompt-construction and response-parsing functions for fit-scoring each fetched job against the user's profile (score 0-100, rationale, mismatch flags), fold scoring into `POST /search`, sort results by fit score descending, and skip per-job failures without failing the whole batch. Update the frontend to render scored results — this is where AI-driven ranking comes alive.

**Architecture:** New backend module `app/llm_matcher.py` containing:
- `MatchResult` (Pydantic model: `score: int`, `rationale: str`, `mismatches: list[str]`)
- `ScoredJob` (Pydantic model: embeds a `Job` plus a `MatchResult`)
- `build_match_prompt(profile: Profile, job: Job) -> str` — pure function producing a structured prompt asking the LLM to return JSON with `score`, `rationale`, `mismatches`
- `parse_match_response(raw_text: str) -> MatchResult` — pure function parsing the LLM's JSON response into a `MatchResult`, raising `MatchParseError` on malformed output
- `score_job(profile: Profile, job: Job, client) -> ScoredJob` — calls the LLM client with the built prompt, parses the response, returns a `ScoredJob`; raises `MatchScoringError` (wrapping LLM-call or parse failures) for the caller to catch-and-skip
- `score_jobs(profile: Profile, jobs: list[Job], client) -> list[ScoredJob]` — runs `score_job` over the batch sequentially, catches `MatchScoringError` per job (logs a warning and skips), returns the successfully-scored jobs sorted by `score` descending

`POST /search` now calls `fetch_jobs` then `score_jobs`, and returns the sorted, annotated list. The frontend renders each result with its fit score, rationale, and mismatch flags, already sorted by the backend.

**Tech Stack additions:** `google-generativeai` (Gemini SDK)

---

## File Structure

- Modify: `backend/requirements.txt` — add `google-generativeai`
- Modify: `backend/app/config.py` — add `gemini_api_key` to `Settings`
- Create: `backend/app/llm_matcher.py` — `MatchResult`, `ScoredJob`, `build_match_prompt`, `parse_match_response`, `score_job`, `score_jobs`, `MatchParseError`, `MatchScoringError`
- Create: `backend/tests/test_llm_matcher.py` — unit tests for prompt construction, response parsing, and batch scoring (mocking the Gemini client)
- Modify: `backend/app/main.py` — wire `score_jobs` into `POST /search`
- Modify: `backend/tests/test_main.py` — update `/search` tests to cover the scored/sorted response shape
- Modify: `frontend/results.py` — render fit score, rationale, and mismatch flags; rename to reflect scored results (or add a new render function alongside the raw one)
- Modify: `frontend/app.py` — use the scored-results renderer

---

## Task 1: Gemini Config

**Files:**
- Modify: `backend/app/config.py`
- Modify: `backend/tests/test_config.py`
- Modify: `.env.example`

- [ ] **Step 1: Obtain a Gemini API key**

Sign up at Google AI Studio, generate a free-tier API key (e.g., for Gemini 2.0/1.5 Flash). Confirm it works with a one-off script using `google-generativeai`.

- [ ] **Step 2: Write the failing test for the extended `Settings`**

Modify `backend/tests/test_config.py` — update both existing tests to also set/expect `GEMINI_API_KEY` / `gemini_api_key`:

```python
def test_settings_loads_from_environment(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    settings = Settings.from_env()

    assert settings.adzuna_app_id == "abc123"
    assert settings.adzuna_app_key == "secret"
    assert settings.gemini_api_key == "gemini-secret"


def test_settings_raises_clear_error_when_missing(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    with pytest.raises(ConfigError, match="ADZUNA_APP_ID"):
        Settings.from_env()
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest tests/test_config.py -v`
Expected: FAIL — `Settings` has no `gemini_api_key` field/argument

- [ ] **Step 4: Extend `Settings`**

Modify `backend/app/config.py`:

```python
@dataclass(frozen=True)
class Settings:
    adzuna_app_id: str
    adzuna_app_key: str
    gemini_api_key: str

    @classmethod
    def from_env(cls) -> "Settings":
        app_id = os.environ.get("ADZUNA_APP_ID")
        app_key = os.environ.get("ADZUNA_APP_KEY")
        gemini_key = os.environ.get("GEMINI_API_KEY")

        missing = [
            name
            for name, value in [
                ("ADZUNA_APP_ID", app_id),
                ("ADZUNA_APP_KEY", app_key),
                ("GEMINI_API_KEY", gemini_key),
            ]
            if not value
        ]
        if missing:
            raise ConfigError(
                f"Missing required environment variable(s): {', '.join(missing)}. "
                "Add them to your .env file (see .env.example)."
            )

        return cls(adzuna_app_id=app_id, adzuna_app_key=app_key, gemini_api_key=gemini_key)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest tests/test_config.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Update `.env.example`** — remove the "(used starting Phase 3)" comment next to `GEMINI_API_KEY` since it's now required.

- [ ] **Step 7: Commit**

```bash
git add backend/app/config.py backend/tests/test_config.py .env.example
git commit -m "Add Gemini API key to backend Settings"
```

---

## Task 2: `MatchResult`, `ScoredJob`, and `parse_match_response`

**Files:**
- Create: `backend/app/llm_matcher.py`
- Create: `backend/tests/test_llm_matcher.py`

- [ ] **Step 1: Write the failing tests for response parsing**

Create `backend/tests/test_llm_matcher.py`:

```python
import pytest

from app.llm_matcher import MatchParseError, MatchResult, parse_match_response

VALID_RESPONSE = """
{
  "score": 82,
  "rationale": "Strong match on Python and Django; location and seniority align well.",
  "mismatches": ["Requires 8+ years, candidate has 5"]
}
"""


def test_parse_match_response_extracts_fields():
    result = parse_match_response(VALID_RESPONSE)

    assert result == MatchResult(
        score=82,
        rationale="Strong match on Python and Django; location and seniority align well.",
        mismatches=["Requires 8+ years, candidate has 5"],
    )


def test_parse_match_response_handles_markdown_code_fences():
    fenced = f"```json\n{VALID_RESPONSE.strip()}\n```"

    result = parse_match_response(fenced)

    assert result.score == 82


def test_parse_match_response_clamps_score_to_0_100():
    raw = '{"score": 145, "rationale": "x", "mismatches": []}'

    result = parse_match_response(raw)

    assert result.score == 100


def test_parse_match_response_raises_on_malformed_json():
    with pytest.raises(MatchParseError):
        parse_match_response("not json at all")


def test_parse_match_response_raises_on_missing_fields():
    with pytest.raises(MatchParseError):
        parse_match_response('{"score": 50}')
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`): `pytest tests/test_llm_matcher.py -v -k parse_match_response`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.llm_matcher'`

- [ ] **Step 3: Implement `MatchResult`, `ScoredJob`, and `parse_match_response`**

Create `backend/app/llm_matcher.py`:

```python
import json
import re

from pydantic import BaseModel, ValidationError

from app.job_fetcher import Job

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class MatchParseError(Exception):
    """Raised when the LLM's match response can't be parsed into a MatchResult."""


class MatchScoringError(Exception):
    """Raised when scoring a single job fails (LLM call error or unparsable response)."""


class MatchResult(BaseModel):
    score: int
    rationale: str
    mismatches: list[str]


class ScoredJob(BaseModel):
    job: Job
    match: MatchResult


def parse_match_response(raw_text: str) -> MatchResult:
    cleaned = _CODE_FENCE_RE.sub("", raw_text).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise MatchParseError(f"LLM response was not valid JSON: {exc}") from exc

    try:
        result = MatchResult(**data)
    except ValidationError as exc:
        raise MatchParseError(f"LLM response was missing expected fields: {exc}") from exc

    if result.score > 100:
        result = result.model_copy(update={"score": 100})
    elif result.score < 0:
        result = result.model_copy(update={"score": 0})

    return result
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_llm_matcher.py -v -k parse_match_response`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/llm_matcher.py backend/tests/test_llm_matcher.py
git commit -m "Add MatchResult/ScoredJob models and parse_match_response"
```

---

## Task 3: `build_match_prompt`

**Files:**
- Modify: `backend/app/llm_matcher.py`
- Modify: `backend/tests/test_llm_matcher.py`

- [ ] **Step 1: Write the failing tests for prompt construction**

Append to `backend/tests/test_llm_matcher.py`:

```python
from app.profile import Profile
from app.llm_matcher import build_match_prompt


def _profile(**overrides):
    base = dict(
        role="Backend Engineer",
        years_experience=5,
        locations=["Bengaluru"],
        skills=["Python", "Django"],
        salary_min=1000000,
        salary_max=2000000,
        work_mode="Remote",
        notice_period_days=30,
        seniority="Senior",
    )
    base.update(overrides)
    return Profile(**base)


def _job(**overrides):
    base = dict(
        title="Backend Engineer",
        company="Acme Corp",
        description="Build scalable backend services in Python/Django.",
        location="Bengaluru, Karnataka",
        salary_min=1200000,
        salary_max=1800000,
        posted_date="2026-06-05T10:00:00Z",
        url="https://example.com/job/1",
    )
    base.update(overrides)
    return Job(**base)


def test_build_match_prompt_includes_profile_and_job_details():
    prompt = build_match_prompt(_profile(), _job())

    assert "Backend Engineer" in prompt
    assert "Python" in prompt and "Django" in prompt
    assert "Acme Corp" in prompt
    assert "Build scalable backend services" in prompt


def test_build_match_prompt_requests_structured_json_output():
    prompt = build_match_prompt(_profile(), _job())

    assert '"score"' in prompt
    assert '"rationale"' in prompt
    assert '"mismatches"' in prompt
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_llm_matcher.py -v -k build_match_prompt`
Expected: FAIL with `ImportError: cannot import name 'build_match_prompt'`

- [ ] **Step 3: Implement `build_match_prompt`**

Append to `backend/app/llm_matcher.py` (add `from app.profile import Profile` to the imports):

```python
def build_match_prompt(profile: Profile, job: Job) -> str:
    return f"""You are scoring how well a job listing matches a candidate's profile.

Candidate profile:
- Target role: {profile.role}
- Years of experience: {profile.years_experience}
- Preferred locations: {", ".join(profile.locations)}
- Skills: {", ".join(profile.skills)}
- Salary expectation (INR/year): {profile.salary_min} - {profile.salary_max}
- Work mode preference: {profile.work_mode}
- Seniority: {profile.seniority}

Job listing:
- Title: {job.title}
- Company: {job.company}
- Location: {job.location}
- Salary (INR/year): {job.salary_min} - {job.salary_max}
- Description: {job.description}

Score how well this job matches the candidate from 0 (no match) to 100 (perfect match).
Respond with ONLY a JSON object in exactly this shape, no other text:
{{
  "score": <integer 0-100>,
  "rationale": "<2-3 sentences on why this is or isn't a good match>",
  "mismatches": ["<short note on a notable mismatch>", ...]
}}
If there are no notable mismatches, return an empty list for "mismatches"."""
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_llm_matcher.py -v -k build_match_prompt`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/llm_matcher.py backend/tests/test_llm_matcher.py
git commit -m "Add build_match_prompt for fit-scoring jobs against a profile"
```

---

## Task 4: `score_job` and `score_jobs` — Calling the LLM

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/app/llm_matcher.py`
- Modify: `backend/tests/test_llm_matcher.py`

- [ ] **Step 1: Add `google-generativeai` to `backend/requirements.txt`**

```
google-generativeai==0.8.3
```

Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Write the failing tests for `score_job` and `score_jobs`**

Append to `backend/tests/test_llm_matcher.py`:

```python
from unittest.mock import MagicMock

from app.llm_matcher import MatchScoringError, score_job, score_jobs


def _llm_client(response_text: str | Exception):
    client = MagicMock()
    if isinstance(response_text, Exception):
        client.generate_content.side_effect = response_text
    else:
        client.generate_content.return_value = MagicMock(text=response_text)
    return client


def test_score_job_returns_scored_job_on_success():
    client = _llm_client(VALID_RESPONSE)

    scored = score_job(_profile(), _job(), client)

    assert scored.job.title == "Backend Engineer"
    assert scored.match.score == 82
    client.generate_content.assert_called_once()


def test_score_job_raises_match_scoring_error_on_llm_failure():
    client = _llm_client(RuntimeError("rate limited"))

    with pytest.raises(MatchScoringError):
        score_job(_profile(), _job(), client)


def test_score_job_raises_match_scoring_error_on_unparsable_response():
    client = _llm_client("not json")

    with pytest.raises(MatchScoringError):
        score_job(_profile(), _job(), client)


def test_score_jobs_skips_failures_and_sorts_by_score_desc(caplog):
    good_low = _llm_client('{"score": 40, "rationale": "ok fit", "mismatches": []}')
    good_high = _llm_client('{"score": 90, "rationale": "great fit", "mismatches": []}')
    bad = _llm_client(RuntimeError("boom"))

    jobs = [_job(title="Low Fit"), _job(title="Bad"), _job(title="High Fit")]
    clients = {"Low Fit": good_low, "Bad": bad, "High Fit": good_high}

    # score_jobs takes a single client; simulate per-job behaviour via a router client.
    router = MagicMock()
    router.generate_content.side_effect = lambda prompt: (
        clients[_job_title_from_prompt(prompt)].generate_content(prompt)
    )

    scored = score_jobs(_profile(), jobs, router)

    titles_in_order = [s.job.title for s in scored]
    assert titles_in_order == ["High Fit", "Low Fit"]
    assert "Bad" in caplog.text
```

Add this small helper near the top of the test module (used only by the test above to route mocked responses by job title embedded in the prompt):

```python
def _job_title_from_prompt(prompt: str) -> str:
    for line in prompt.splitlines():
        if line.strip().startswith("- Title:"):
            return line.split(":", 1)[1].strip()
    raise AssertionError("prompt did not contain a job title")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest tests/test_llm_matcher.py -v -k "score_job or score_jobs"`
Expected: FAIL with `ImportError: cannot import name 'score_job'`

- [ ] **Step 4: Implement `score_job` and `score_jobs`**

Append to `backend/app/llm_matcher.py` (add `import logging` to the imports):

```python
import logging

logger = logging.getLogger(__name__)


def score_job(profile: Profile, job: Job, client) -> ScoredJob:
    prompt = build_match_prompt(profile, job)

    try:
        response = client.generate_content(prompt)
    except Exception as exc:
        raise MatchScoringError(f"LLM call failed for '{job.title}': {exc}") from exc

    try:
        match = parse_match_response(response.text)
    except MatchParseError as exc:
        raise MatchScoringError(f"Could not parse LLM response for '{job.title}': {exc}") from exc

    return ScoredJob(job=job, match=match)


def score_jobs(profile: Profile, jobs: list[Job], client) -> list[ScoredJob]:
    scored: list[ScoredJob] = []

    for job in jobs:
        try:
            scored.append(score_job(profile, job, client))
        except MatchScoringError as exc:
            logger.warning("Skipping job '%s': %s", job.title, exc)

    return sorted(scored, key=lambda sj: sj.match.score, reverse=True)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest tests/test_llm_matcher.py -v -k "score_job or score_jobs"`
Expected: PASS (4 passed)

- [ ] **Step 6: Run the full llm_matcher test module**

Run: `pytest tests/test_llm_matcher.py -v`
Expected: PASS (11 passed)

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/llm_matcher.py backend/tests/test_llm_matcher.py
git commit -m "Add score_job/score_jobs with skip-on-failure and sort-by-fit"
```

---

## Task 5: Wire Scoring into `POST /search`

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Update the failing/changed `/search` API tests**

Modify `backend/tests/test_main.py` — update `test_post_search_returns_normalized_jobs_for_saved_profile` (and add a new test) to reflect the scored response shape. Replace it with:

```python
from unittest.mock import MagicMock, patch


@respx.mock
def test_post_search_returns_scored_sorted_jobs(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    client.post("/profile", json=_valid_payload())
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(200, json={"results": [RAW_ADZUNA_JOB]})
    )

    fake_llm = MagicMock()
    fake_llm.generate_content.return_value = MagicMock(
        text='{"score": 77, "rationale": "Good overall fit.", "mismatches": []}'
    )

    with patch("app.main._build_llm_client", return_value=fake_llm):
        response = client.post("/search")

    assert response.status_code == 200
    body = response.json()
    assert len(body["jobs"]) == 1
    scored = body["jobs"][0]
    assert scored["job"]["title"] == "Backend Engineer"
    assert scored["match"]["score"] == 77
    assert scored["match"]["rationale"] == "Good overall fit."


@respx.mock
def test_post_search_returns_empty_list_message_when_all_scoring_fails(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    client.post("/profile", json=_valid_payload())
    respx.get("https://api.adzuna.com/v1/api/jobs/in/search/1").mock(
        return_value=httpx.Response(200, json={"results": [RAW_ADZUNA_JOB]})
    )

    failing_llm = MagicMock()
    failing_llm.generate_content.side_effect = RuntimeError("boom")

    with patch("app.main._build_llm_client", return_value=failing_llm):
        response = client.post("/search")

    assert response.status_code == 200
    body = response.json()
    assert body["jobs"] == []
    assert "no jobs" in body["message"].lower()
```

Remove or update the old `test_post_search_returns_normalized_jobs_for_saved_profile` so its assertions match the new `{"jobs": [{"job": ..., "match": ...}]}` shape (or replace it outright with the test above).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_main.py -v -k search`
Expected: FAIL — response shape doesn't include `match`, and `_build_llm_client` doesn't exist to patch

- [ ] **Step 3: Wire `score_jobs` into `/search`**

Modify `backend/app/main.py`:

```python
import google.generativeai as genai

from app.llm_matcher import score_jobs


def _build_llm_client(settings: Settings):
    genai.configure(api_key=settings.gemini_api_key)
    return genai.GenerativeModel("gemini-2.0-flash")


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

    llm_client = _build_llm_client(settings)
    scored = score_jobs(profile, jobs, llm_client)

    if not scored:
        return {"jobs": [], "message": "No jobs found for these filters."}

    return {"jobs": scored}
```

(This replaces the body of the existing `/search` route added in Phase 2 — keep the `_STATE`/profile/fetch-error handling unchanged, just extend it with scoring.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_main.py -v -k search`
Expected: PASS

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "Wire LLM scoring into /search, sorted by fit score"
```

---

## Task 6: Frontend — Render Scored Results

**Files:**
- Modify: `frontend/results.py`
- Modify: `frontend/app.py`

- [ ] **Step 1: Add `render_scored_results`**

Add to `frontend/results.py` (keep `render_raw_results` from Phase 2 — it's still useful as a fallback for unscored payloads, or can be removed if `/search` always returns scored results now; prefer removing it and updating its one call site, since dead code shouldn't linger):

```python
def render_scored_results(payload: dict) -> None:
    jobs = payload.get("jobs", [])

    if not jobs:
        st.info(payload.get("message", "No jobs found for these filters."))
        return

    st.subheader(f"Found {len(jobs)} matches, ranked by fit")
    for entry in jobs:
        job = entry["job"]
        match = entry["match"]
        with st.container(border=True):
            st.markdown(f"**{job['title']}** — {job['company']}  ·  Fit: **{match['score']}/100**")
            st.caption(f"{job['location']} · posted {job['posted_date']}")
            if job.get("salary_min") or job.get("salary_max"):
                st.caption(f"Salary: {job.get('salary_min', '?')} – {job.get('salary_max', '?')}")
            st.write(match["rationale"])
            if match["mismatches"]:
                st.warning("Mismatches: " + "; ".join(match["mismatches"]))
            st.markdown(f"[Apply]({job['url']})")
```

- [ ] **Step 2: Switch `app.py` to use it**

In `frontend/app.py`, replace the `render_raw_results` import and call with `render_scored_results`, and delete `render_raw_results` from `results.py` once nothing references it.

- [ ] **Step 3: Manual verification via `docker-compose up`**

Run: `docker-compose up --build`

Manually verify:
1. After saving a profile and clicking "Search", results render sorted by fit score (highest first), each showing the score, rationale, and any mismatch flags.
2. Temporarily make the Gemini key invalid and confirm `/search` still returns gracefully (either an empty-with-message result if all scoring fails, or a clear `503` setup message) — the app must not crash.

- [ ] **Step 4: Commit**

```bash
git add frontend/results.py frontend/app.py
git commit -m "Render fit-scored, ranked results in the frontend"
```

---

## Task 7: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: All tests pass, no failures or errors.

- [ ] **Step 2: Full-stack smoke test**

Run: `docker-compose up --build`. Confirm the golden path (profile → search → ranked, scored results with rationale and mismatches) and at least one degraded path (LLM failure → partial or empty results with a clear message, app doesn't crash). Stop with `docker-compose down`.

- [ ] **Step 3: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"
