# Job Search Tool — Design Spec

**Date:** 2026-06-07
**Status:** Approved for planning

## Purpose

Build a tool that helps tech professionals in India search for jobs matching their profile (role, experience, location, skills/tools, etc.), surfacing recently posted listings (last 5 days) ranked by fit, with explanations of why each job is or isn't a good match.

## Architecture Overview

A single Streamlit app (Python) with an on-demand pipeline, run per search:

```
[Profile Form + Resume Upload]
        ↓
[Job Fetcher] → calls job aggregator API (e.g., Adzuna or JSearch)
        ↓ (capped at ~30-50 results, filtered by location, recency, keywords)
[LLM Matcher] → scores each job against the user's profile (fit score 0-100 + rationale)
        ↓
[Results Dashboard] → sorted/filterable list of scored jobs with details + apply links
```

Everything runs locally as a single Streamlit process — no backend server, no database for the MVP. State lives in Streamlit's session state for the duration of a search. Data is fetched live on each search (no scheduled background refresh/caching for MVP).

## Components

### Profile Form
- Structured fields: target role/title, years of experience, location preference(s), skills/tools (tags), salary expectation/CTC range, work mode preference (remote/hybrid/onsite), notice period, seniority level
- Optional resume upload (PDF/docx) parsed via LLM to pre-fill form fields; user reviews/edits before searching
- Resume parsing failures fall back gracefully to the manual form with an inline message

### Job Fetcher
- Wraps a job aggregator API — candidates: **Adzuna** (solid India coverage, free tier) or **JSearch via RapidAPI** as a fallback to evaluate during implementation
- Translates form inputs into API query params: keywords (role + skills), location, date-posted ≤ 5 days, etc.
- Returns a capped set of ~30-50 raw listings (title, company, description, location, salary if available, posted date, URL)
- API failures (rate limits, no results, network errors) surface as clear inline dashboard messages; the app does not crash

### LLM Matcher
- Pure LLM-based matching (no rule-based pre-filter) — every fetched job is scored against the profile
- For each job, returns: a fit score (0-100), a short rationale (2-3 sentences on why it is/isn't a good match), and flags for notable mismatches (e.g., "requires 8+ yrs, you have 4")
- Runs sequentially or in small batches to manage rate limits/cost
- Per-job scoring failures are skipped (logged) rather than failing the whole batch

### Results Dashboard
- Sorted by fit score (desc) by default; filterable/sortable by company, location, salary, posted date, work mode
- Each result shows: title, company, location, salary (if present), posted date, fit score, LLM rationale, and apply link

## Data Flow (per search)

1. User fills/edits profile form → clicks "Search"
2. Fetcher builds query params → calls aggregator API → returns capped raw listings
3. Each listing + profile is sent to the LLM Matcher → returns scored, annotated job
4. Dashboard renders sorted/filterable results from session state

## Error Handling

- API failures → inline message ("No jobs found for these filters" / "Job search API unavailable, try again"); app does not crash
- LLM scoring failures for individual jobs → skip with a logged warning, continue with the rest of the batch
- Resume parsing failures → fall back to empty/manual form with a message that parsing didn't work
- Missing/invalid API keys → clear setup instructions on first run (e.g., "Add your Adzuna and Anthropic keys to `.env`")

## Testing

- Unit tests for query-building logic (form inputs → API params) and response normalization (raw API job → internal job model)
- Unit tests for LLM Matcher prompt construction and response parsing (mocking the LLM call)
- Manual end-to-end runs through the Streamlit UI for the golden path (fill profile → search → ranked results) and edge cases (no results, API error, malformed resume)

## Setup / Prerequisites

- No existing API access — implementation will need to:
  - Sign up for a job aggregator API (Adzuna or JSearch)
  - Obtain an LLM provider API key (Anthropic recommended)
- Both keys configured via `.env` / local config, with setup instructions shown if missing

## Implementation Phases

The build is divided into five phases. Each phase produces working, demoable software on its own:

1. **Profile Form** — Streamlit app skeleton with the structured profile form (role, experience, location, skills, salary, work mode, notice period, seniority). No external integrations; captures and displays the profile in session state. Establishes the working UI foundation.
2. **Job Fetcher** — Sign up for and integrate the job aggregator API (Adzuna, with JSearch as fallback). Build the query-builder (form → API params) and response normalizer (raw API job → internal job model). Wire a "Search" button that fetches and displays raw, unranked results. Proves the data pipeline end-to-end.
3. **LLM Matcher** — Integrate the LLM provider; build prompt construction and response parsing for fit-scoring each job against the profile (score, rationale, mismatch flags). Wire scored results into the dashboard, sorted by fit score. This is where AI-driven ranking comes alive.
4. **Resume Upload & Parsing** — Add optional resume upload (PDF/docx) with LLM-based parsing to pre-fill the profile form, falling back gracefully to manual entry on parse failure.
5. **Dashboard Polish** — Add filter/sort controls (company, location, salary, posted date, work mode) on top of ranked results, plus the error-handling paths from this spec (no results, API failures, missing keys) and first-run setup instructions.

Each phase will get its own detailed implementation plan when work on it begins, so later phases can incorporate what's learned from earlier ones.

## Out of Scope (for MVP)

- Scheduled/background refresh and caching (candidate future enhancement)
- Rule-based pre-filtering before LLM scoring
- Multi-user accounts / persistent profile storage across sessions
- Saving/tracking favorite jobs across sessions
