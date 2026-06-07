# Job Search Tool — Design Spec

**Date:** 2026-06-07
**Status:** Approved for planning

## Purpose

Build a tool that helps tech professionals in India search for jobs matching their profile (role, experience, location, skills/tools, etc.), surfacing recently posted listings (last 5 days) ranked by fit, with explanations of why each job is or isn't a good match.

## Architecture Overview

Two services, each its own Docker container, orchestrated locally via `docker-compose`:

```
[Streamlit Frontend Container]  ──HTTP/REST──▶  [FastAPI Backend Container]
   renders Profile Form,                            owns ALL domain logic:
   Resume Upload, Results                           - Profile model + validation
   Dashboard; calls backend                         - Job Fetcher (aggregator API)
   over HTTP and renders                            - LLM Matcher (fit scoring)
   whatever it returns                              exposes REST endpoints
```

Per-search flow:

```
[Profile Form] → POST /profile → backend validates & stores the profile
        ↓
[Search trigger] → POST /search → backend runs Job Fetcher → LLM Matcher
        ↓             (capped at ~30-50 results, scored 0-100 + rationale)
[Results Dashboard] → renders sorted/filterable list from the API response
```

The backend (FastAPI, Python) owns all business logic — the `Profile` model and its validation, the Job Fetcher, and the LLM Matcher — and exposes it through REST endpoints. The Streamlit frontend is a thin UI layer: it collects input, calls the backend over HTTP, and renders whatever comes back (including validation/error messages). Both run as separate containers defined by their own `Dockerfile`s and wired together with a root-level `docker-compose.yml` for local development. State for an in-progress search lives in the backend (in-memory for MVP — no database); the frontend keeps only what it needs for rendering in `st.session_state`. Data is fetched live on each search (no scheduled background refresh/caching for MVP).

## Components

### Profile Form (frontend) + Profile API (backend)
- Frontend: Streamlit form with structured fields — target role/title, years of experience, location preference(s), skills/tools (tags), salary expectation/CTC range, work mode preference (remote/hybrid/onsite), notice period, seniority level. Posts raw inputs to the backend and renders the saved profile or validation errors it gets back.
- Backend: owns the `Profile` model, input parsing, and validation rules; exposes `POST /profile` (validate & store) and `GET /profile` (retrieve current profile).
- Optional resume upload (PDF/docx): frontend collects the file and sends it to a backend endpoint that parses it via LLM and returns pre-fill values; user reviews/edits before searching.
- Resume parsing failures fall back gracefully to the manual form with an inline message surfaced from the backend response.

### Job Fetcher (backend)
- Wraps a job aggregator API — candidates: **Adzuna** (solid India coverage, free tier) or **JSearch via RapidAPI** as a fallback to evaluate during implementation
- Translates the stored profile into API query params: keywords (role + skills), location, date-posted ≤ 5 days, etc.
- Returns a capped set of ~30-50 raw listings (title, company, description, location, salary if available, posted date, URL)
- API failures (rate limits, no results, network errors) are returned to the frontend as structured error responses; the frontend surfaces them as inline messages and the app does not crash

### LLM Matcher (backend)
- Pure LLM-based matching (no rule-based pre-filter) — every fetched job is scored against the profile
- For each job, returns: a fit score (0-100), a short rationale (2-3 sentences on why it is/isn't a good match), and flags for notable mismatches (e.g., "requires 8+ yrs, you have 4")
- Runs sequentially or in small batches to manage rate limits/cost
- Per-job scoring failures are skipped (logged) rather than failing the whole batch

### Results Dashboard (frontend)
- Sorted by fit score (desc) by default; filterable/sortable by company, location, salary, posted date, work mode
- Each result shows: title, company, location, salary (if present), posted date, fit score, LLM rationale, and apply link
- Renders directly from the JSON the backend's `/search` endpoint returns

## Data Flow (per search)

1. User fills/edits the profile form in the frontend → submits → frontend `POST`s raw inputs to the backend's `/profile` endpoint
2. Backend parses and validates the profile, stores it (in-memory), and returns the saved profile or validation errors as JSON; frontend renders whichever comes back
3. User clicks "Search" → frontend `POST`s to the backend's `/search` endpoint
4. Backend's Job Fetcher builds query params from the stored profile → calls the aggregator API → returns capped raw listings
5. Backend's LLM Matcher scores each listing against the profile → backend returns sorted, annotated jobs as JSON
6. Frontend's Results Dashboard renders the sorted/filterable list from the API response (cached in `st.session_state` for the duration of the search)

## Error Handling

- API failures → backend returns a structured error payload; frontend shows an inline message ("No jobs found for these filters" / "Job search API unavailable, try again"); app does not crash
- LLM scoring failures for individual jobs → backend skips with a logged warning, continues with the rest of the batch, and returns the partial results
- Resume parsing failures → backend returns a "parsing failed" response; frontend falls back to the empty/manual form with a message that parsing didn't work
- Missing/invalid API keys → backend fails fast on startup with a clear log message; first-run setup instructions (e.g., "Add your Adzuna and Groq keys to the backend's `.env`") are shown to the user if the backend reports it's unconfigured
- Frontend ↔ backend connectivity issues (backend container not reachable) → frontend shows a clear "Backend unavailable, please try again" message rather than a stack trace

## Testing

- Backend: unit tests for the `Profile` model, parsing, and validation; for query-building logic (profile → aggregator API params) and response normalization (raw API job → internal job model); for LLM Matcher prompt construction and response parsing (mocking the LLM call)
- Backend: API/integration tests for each endpoint using FastAPI's `TestClient` (request/response shape, validation error payloads, error-path responses)
- Frontend: unit tests for any pure helpers, with HTTP calls to the backend mocked
- Manual end-to-end runs through `docker-compose up` exercising the full golden path (fill profile → search → ranked results) and edge cases (no results, API error, malformed resume, backend unreachable)

## Setup / Prerequisites

- Docker and Docker Compose installed locally; the app is run via `docker-compose up`
- No existing external API access — implementation will need to:
  - Sign up for a job aggregator API (Adzuna or JSearch)
  - Obtain a Groq API key from the Groq Console (used for the LLM Matcher and resume parsing, via the `groq` Python SDK; free tier available, e.g. Llama 3.1/3.3 models served on Groq's fast inference)
- Both keys configured via a `.env` file consumed by the backend container (mounted/passed through `docker-compose.yml`), with setup instructions shown if missing

## Implementation Phases

The build is divided into five phases. Each phase produces working, demoable software on its own:

1. **Profile Form** — Stand up both containers (FastAPI backend, Streamlit frontend) wired together via `docker-compose`. Backend owns the `Profile` model, parsing, and validation behind a `POST /profile` (and `GET /profile`) endpoint; frontend renders the structured profile form (role, experience, location, skills, salary, work mode, notice period, seniority), posts raw inputs to the backend, and displays the saved profile or validation errors it gets back. No external job/LLM integrations yet. Establishes the working full-stack foundation, including Dockerization.
2. **Job Fetcher** — Sign up for and integrate the job aggregator API (Adzuna, with JSearch as fallback) into the backend. Build the query-builder (profile → API params) and response normalizer (raw API job → internal job model) as backend modules, exposed via a `POST /search` endpoint. Wire a "Search" button in the frontend that calls it and displays raw, unranked results. Proves the data pipeline end-to-end.
3. **LLM Matcher** — Integrate the LLM provider into the backend; build prompt construction and response parsing for fit-scoring each job against the profile (score, rationale, mismatch flags), folded into the `/search` response. Wire scored results into the frontend dashboard, sorted by fit score. This is where AI-driven ranking comes alive.
4. **Resume Upload & Parsing** — Add an optional resume upload endpoint on the backend (PDF/docx) with LLM-based parsing to produce pre-fill values; frontend collects the file, posts it, and pre-fills the profile form from the response, falling back gracefully to manual entry on parse failure.
5. **Dashboard Polish** — Add filter/sort controls (company, location, salary, posted date, work mode) on top of ranked results in the frontend, plus the error-handling paths from this spec (no results, API failures, missing keys, backend unreachable) and first-run setup instructions.

Each phase will get its own detailed implementation plan when work on it begins, so later phases can incorporate what's learned from earlier ones.

## Out of Scope (for MVP)

- Scheduled/background refresh and caching (candidate future enhancement)
- Rule-based pre-filtering before LLM scoring
- Multi-user accounts / persistent profile storage across sessions
- Saving/tracking favorite jobs across sessions
