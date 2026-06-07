# Phase 4: Resume Upload & Parsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Assumes Phase 3 (`docs/superpowers/plans/2026-06-07-phase3-llm-matcher.md`) is complete and merged.

**Goal:** Add an optional resume upload (PDF/docx) to the backend that extracts text, asks the LLM to parse it into profile pre-fill values, and returns them to the frontend, which pre-fills the profile form for the user to review/edit before saving. Parsing failures fall back gracefully to the empty/manual form with an inline message — the resume path never blocks the existing manual flow.

**Architecture:** New backend module `app/resume_parser.py` containing:
- `extract_text(filename: str, content: bytes) -> str` — pure-ish function dispatching on file extension (`.pdf` via `pypdf`, `.docx` via `python-docx`); raises `ResumeExtractionError` for unsupported types or unreadable files
- `ProfilePrefill` (Pydantic model: all `Profile` fields as `Optional`, since a resume may not mention everything — e.g. salary expectation)
- `build_resume_prompt(resume_text: str) -> str` — pure function producing a structured prompt asking the LLM to extract profile fields as JSON
- `parse_resume_response(raw_text: str) -> ProfilePrefill` — pure function parsing the LLM's JSON into a `ProfilePrefill`, raising `ResumeParseError` on malformed output
- `parse_resume(filename: str, content: bytes, client) -> ProfilePrefill` — orchestrates extract → prompt → LLM call → parse, raising `ResumeParsingFailed` (wrapping any of the above) for the route layer to translate into a graceful fallback response

`POST /resume` accepts a multipart file upload, calls `parse_resume`, and returns either the pre-fill values or a structured "parsing failed" response (never a 500). The frontend adds a file-uploader above the profile form; on upload it posts to `/resume`, and on success pre-fills the form's widget defaults from the response (via `st.session_state`), or shows an inline "couldn't parse your resume — please fill the form manually" message on failure.

**Tech Stack additions:** `pypdf` (PDF text extraction), `python-docx` (DOCX text extraction)

---

## File Structure

- Modify: `backend/requirements.txt` — add `pypdf`, `python-docx`
- Create: `backend/app/resume_parser.py` — `ProfilePrefill`, `extract_text`, `build_resume_prompt`, `parse_resume_response`, `parse_resume`, and the `ResumeExtractionError` / `ResumeParseError` / `ResumeParsingFailed` exceptions
- Create: `backend/tests/fixtures/sample_resume.pdf` and `backend/tests/fixtures/sample_resume.docx` — small fixture files for extraction tests
- Create: `backend/tests/test_resume_parser.py` — unit tests for extraction, prompt construction, response parsing, and orchestration (mocking the LLM client)
- Modify: `backend/app/main.py` — add `POST /resume`
- Modify: `backend/tests/test_main.py` — API tests for `/resume` (multipart upload, success/failure paths)
- Create: `frontend/resume_upload.py` — `render_resume_uploader()`; renders the uploader, posts to the backend, stores pre-fill values in session state
- Modify: `frontend/profile_form.py` — read pre-fill values from `st.session_state` to seed widget defaults
- Modify: `frontend/app.py` — render the uploader above the profile form

---

## Task 1: Resume Text Extraction

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/fixtures/sample_resume.pdf`
- Create: `backend/tests/fixtures/sample_resume.docx`
- Create: `backend/app/resume_parser.py`
- Create: `backend/tests/test_resume_parser.py`

- [ ] **Step 1: Add extraction libraries to `backend/requirements.txt`**

```
pypdf==5.0.1
python-docx==1.1.2
```

Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Create small fixture resume files**

Generate `backend/tests/fixtures/sample_resume.pdf` and `backend/tests/fixtures/sample_resume.docx`, each containing a few lines of plain text resembling a short resume (e.g., "Jane Doe — Backend Engineer, 5 years experience, Python/Django/PostgreSQL, based in Bengaluru, open to remote roles."). These can be generated with a short one-off script (`pypdf`/`reportlab` for the PDF, `python-docx` for the DOCX) and committed as binary fixtures.

- [ ] **Step 3: Write the failing tests for `extract_text`**

Create `backend/tests/test_resume_parser.py`:

```python
from pathlib import Path

import pytest

from app.resume_parser import ResumeExtractionError, extract_text

FIXTURES = Path(__file__).parent / "fixtures"


def test_extract_text_reads_pdf():
    content = (FIXTURES / "sample_resume.pdf").read_bytes()

    text = extract_text("sample_resume.pdf", content)

    assert "Backend Engineer" in text


def test_extract_text_reads_docx():
    content = (FIXTURES / "sample_resume.docx").read_bytes()

    text = extract_text("sample_resume.docx", content)

    assert "Backend Engineer" in text


def test_extract_text_rejects_unsupported_extension():
    with pytest.raises(ResumeExtractionError, match="Unsupported file type"):
        extract_text("sample_resume.txt", b"plain text")


def test_extract_text_raises_on_unreadable_content():
    with pytest.raises(ResumeExtractionError):
        extract_text("sample_resume.pdf", b"not actually a pdf")
```

- [ ] **Step 4: Run the tests to verify they fail**

Run (from `backend/`): `pytest tests/test_resume_parser.py -v -k extract_text`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.resume_parser'`

- [ ] **Step 5: Implement `extract_text`**

Create `backend/app/resume_parser.py`:

```python
import io

from docx import Document
from pypdf import PdfReader
from pypdf.errors import PdfReadError


class ResumeExtractionError(Exception):
    """Raised when resume text can't be extracted from the uploaded file."""


class ResumeParseError(Exception):
    """Raised when the LLM's resume-parsing response can't be parsed into a ProfilePrefill."""


class ResumeParsingFailed(Exception):
    """Raised when the end-to-end resume parsing pipeline fails for any reason."""


def _extract_pdf_text(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except PdfReadError as exc:
        raise ResumeExtractionError(f"Could not read PDF: {exc}") from exc


def _extract_docx_text(content: bytes) -> str:
    try:
        document = Document(io.BytesIO(content))
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
    except Exception as exc:
        raise ResumeExtractionError(f"Could not read DOCX: {exc}") from exc


def extract_text(filename: str, content: bytes) -> str:
    lower = filename.lower()

    if lower.endswith(".pdf"):
        return _extract_pdf_text(content)
    if lower.endswith(".docx"):
        return _extract_docx_text(content)

    raise ResumeExtractionError(f"Unsupported file type: '{filename}'. Upload a PDF or DOCX.")
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pytest tests/test_resume_parser.py -v -k extract_text`
Expected: PASS (4 passed)

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/tests/fixtures backend/app/resume_parser.py backend/tests/test_resume_parser.py
git commit -m "Add resume text extraction for PDF and DOCX"
```

---

## Task 2: `ProfilePrefill` and `parse_resume_response`

**Files:**
- Modify: `backend/app/resume_parser.py`
- Modify: `backend/tests/test_resume_parser.py`

- [ ] **Step 1: Write the failing tests for response parsing**

Append to `backend/tests/test_resume_parser.py`:

```python
from app.resume_parser import ProfilePrefill, parse_resume_response

VALID_PREFILL_RESPONSE = """
{
  "role": "Backend Engineer",
  "years_experience": 5,
  "locations": ["Bengaluru", "Remote"],
  "skills": ["Python", "Django", "PostgreSQL"],
  "salary_min": null,
  "salary_max": null,
  "work_mode": "Remote",
  "notice_period_days": null,
  "seniority": "Senior"
}
"""


def test_parse_resume_response_extracts_known_fields():
    prefill = parse_resume_response(VALID_PREFILL_RESPONSE)

    assert prefill == ProfilePrefill(
        role="Backend Engineer",
        years_experience=5,
        locations=["Bengaluru", "Remote"],
        skills=["Python", "Django", "PostgreSQL"],
        salary_min=None,
        salary_max=None,
        work_mode="Remote",
        notice_period_days=None,
        seniority="Senior",
    )


def test_parse_resume_response_handles_markdown_code_fences():
    fenced = f"```json\n{VALID_PREFILL_RESPONSE.strip()}\n```"

    prefill = parse_resume_response(fenced)

    assert prefill.role == "Backend Engineer"


def test_parse_resume_response_raises_on_malformed_json():
    with pytest.raises(ResumeParseError):
        parse_resume_response("not json")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_resume_parser.py -v -k parse_resume_response`
Expected: FAIL with `ImportError: cannot import name 'ProfilePrefill'`

- [ ] **Step 3: Implement `ProfilePrefill` and `parse_resume_response`**

Append to `backend/app/resume_parser.py` (add `import json`, `import re`, `from typing import Optional`, `from pydantic import BaseModel, ValidationError` to the imports):

```python
import json
import re
from typing import Optional

from pydantic import BaseModel, ValidationError

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class ProfilePrefill(BaseModel):
    role: Optional[str] = None
    years_experience: Optional[int] = None
    locations: Optional[list[str]] = None
    skills: Optional[list[str]] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    work_mode: Optional[str] = None
    notice_period_days: Optional[int] = None
    seniority: Optional[str] = None


def parse_resume_response(raw_text: str) -> ProfilePrefill:
    cleaned = _CODE_FENCE_RE.sub("", raw_text).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ResumeParseError(f"LLM response was not valid JSON: {exc}") from exc

    try:
        return ProfilePrefill(**data)
    except ValidationError as exc:
        raise ResumeParseError(f"LLM response had an unexpected shape: {exc}") from exc
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_resume_parser.py -v -k parse_resume_response`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/resume_parser.py backend/tests/test_resume_parser.py
git commit -m "Add ProfilePrefill model and parse_resume_response"
```

---

## Task 3: `build_resume_prompt`

**Files:**
- Modify: `backend/app/resume_parser.py`
- Modify: `backend/tests/test_resume_parser.py`

- [ ] **Step 1: Write the failing tests for prompt construction**

Append to `backend/tests/test_resume_parser.py`:

```python
from app.resume_parser import build_resume_prompt

SAMPLE_RESUME_TEXT = (
    "Jane Doe\nBackend Engineer with 5 years building Python/Django services.\n"
    "Based in Bengaluru, open to remote roles. Comfortable with PostgreSQL."
)


def test_build_resume_prompt_includes_resume_text():
    prompt = build_resume_prompt(SAMPLE_RESUME_TEXT)

    assert "Jane Doe" in prompt
    assert "Backend Engineer with 5 years" in prompt


def test_build_resume_prompt_requests_structured_json_with_all_profile_fields():
    prompt = build_resume_prompt(SAMPLE_RESUME_TEXT)

    for field in (
        '"role"', '"years_experience"', '"locations"', '"skills"',
        '"salary_min"', '"salary_max"', '"work_mode"',
        '"notice_period_days"', '"seniority"',
    ):
        assert field in prompt
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_resume_parser.py -v -k build_resume_prompt`
Expected: FAIL with `ImportError: cannot import name 'build_resume_prompt'`

- [ ] **Step 3: Implement `build_resume_prompt`**

Append to `backend/app/resume_parser.py`:

```python
def build_resume_prompt(resume_text: str) -> str:
    return f"""You are extracting a job-search profile from a candidate's resume text.

Resume text:
\"\"\"
{resume_text}
\"\"\"

Extract whatever profile fields you can confidently determine from the resume.
Respond with ONLY a JSON object in exactly this shape, no other text. Use null
for any field you cannot confidently determine — do not guess:
{{
  "role": <string or null>,
  "years_experience": <integer or null>,
  "locations": <list of strings or null>,
  "skills": <list of strings or null>,
  "salary_min": <integer or null>,
  "salary_max": <integer or null>,
  "work_mode": <"Remote" | "Hybrid" | "Onsite" or null>,
  "notice_period_days": <integer or null>,
  "seniority": <"Junior" | "Mid" | "Senior" | "Lead" | "Principal" or null>
}}"""
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_resume_parser.py -v -k build_resume_prompt`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/resume_parser.py backend/tests/test_resume_parser.py
git commit -m "Add build_resume_prompt for resume-to-profile extraction"
```

---

## Task 4: `parse_resume` — Orchestration

**Files:**
- Modify: `backend/app/resume_parser.py`
- Modify: `backend/tests/test_resume_parser.py`

- [ ] **Step 1: Write the failing tests for `parse_resume`**

Append to `backend/tests/test_resume_parser.py`:

```python
from unittest.mock import MagicMock

from app.resume_parser import ResumeParsingFailed, parse_resume


def _llm_client(response_text):
    client = MagicMock()
    if isinstance(response_text, Exception):
        client.generate_content.side_effect = response_text
    else:
        client.generate_content.return_value = MagicMock(text=response_text)
    return client


def test_parse_resume_returns_prefill_on_success():
    content = (FIXTURES / "sample_resume.pdf").read_bytes()
    client = _llm_client(VALID_PREFILL_RESPONSE)

    prefill = parse_resume("sample_resume.pdf", content, client)

    assert prefill.role == "Backend Engineer"
    client.generate_content.assert_called_once()


def test_parse_resume_raises_resume_parsing_failed_on_unsupported_file():
    client = _llm_client(VALID_PREFILL_RESPONSE)

    with pytest.raises(ResumeParsingFailed):
        parse_resume("resume.txt", b"plain text", client)


def test_parse_resume_raises_resume_parsing_failed_on_llm_error():
    content = (FIXTURES / "sample_resume.pdf").read_bytes()
    client = _llm_client(RuntimeError("rate limited"))

    with pytest.raises(ResumeParsingFailed):
        parse_resume("sample_resume.pdf", content, client)


def test_parse_resume_raises_resume_parsing_failed_on_unparsable_response():
    content = (FIXTURES / "sample_resume.pdf").read_bytes()
    client = _llm_client("not json")

    with pytest.raises(ResumeParsingFailed):
        parse_resume("sample_resume.pdf", content, client)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_resume_parser.py -v -k "parse_resume and not response"`
Expected: FAIL with `ImportError: cannot import name 'parse_resume'`

- [ ] **Step 3: Implement `parse_resume`**

Append to `backend/app/resume_parser.py`:

```python
def parse_resume(filename: str, content: bytes, client) -> ProfilePrefill:
    try:
        text = extract_text(filename, content)
    except ResumeExtractionError as exc:
        raise ResumeParsingFailed(str(exc)) from exc

    prompt = build_resume_prompt(text)

    try:
        response = client.generate_content(prompt)
    except Exception as exc:
        raise ResumeParsingFailed(f"LLM call failed while parsing resume: {exc}") from exc

    try:
        return parse_resume_response(response.text)
    except ResumeParseError as exc:
        raise ResumeParsingFailed(str(exc)) from exc
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_resume_parser.py -v -k "parse_resume and not response"`
Expected: PASS (4 passed)

- [ ] **Step 5: Run the full resume_parser test module**

Run: `pytest tests/test_resume_parser.py -v`
Expected: PASS (13 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/resume_parser.py backend/tests/test_resume_parser.py
git commit -m "Add parse_resume orchestrating extraction, prompting, and parsing"
```

---

## Task 5: `POST /resume` Endpoint

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing API tests**

Append to `backend/tests/test_main.py`:

```python
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def test_post_resume_returns_prefill_on_success(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    fake_llm = MagicMock()
    fake_llm.generate_content.return_value = MagicMock(text=VALID_PREFILL_RESPONSE)

    content = (FIXTURES / "sample_resume.pdf").read_bytes()

    with patch("app.main._build_llm_client", return_value=fake_llm):
        response = client.post(
            "/resume",
            files={"file": ("sample_resume.pdf", content, "application/pdf")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["prefill"]["role"] == "Backend Engineer"


def test_post_resume_returns_structured_failure_on_unsupported_type(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    response = client.post(
        "/resume",
        files={"file": ("resume.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["parsed"] is False
    assert "couldn't parse" in body["message"].lower() or "unsupported" in body["message"].lower()


def test_post_resume_returns_structured_failure_on_llm_error(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "abc123")
    monkeypatch.setenv("ADZUNA_APP_KEY", "secret")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini-secret")

    failing_llm = MagicMock()
    failing_llm.generate_content.side_effect = RuntimeError("boom")

    content = (FIXTURES / "sample_resume.pdf").read_bytes()

    with patch("app.main._build_llm_client", return_value=failing_llm):
        response = client.post(
            "/resume",
            files={"file": ("sample_resume.pdf", content, "application/pdf")},
        )

    assert response.status_code == 422
    assert response.json()["parsed"] is False
```

(`VALID_PREFILL_RESPONSE` and `MagicMock`/`patch` need to be imported/defined in `test_main.py` — either import the fixture string from `test_resume_parser` or duplicate the small JSON literal; prefer moving shared fixtures like this into `tests/fixtures.py` alongside `RAW_ADZUNA_JOB` from Phase 2.)

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`): `pytest tests/test_main.py -v -k resume`
Expected: FAIL — `/resume` route doesn't exist (404s)

- [ ] **Step 3: Implement `POST /resume`**

Add to `backend/app/main.py`:

```python
from fastapi import UploadFile, File

from app.resume_parser import ResumeParsingFailed, parse_resume


@app.post("/resume")
async def upload_resume(file: UploadFile = File(...)):
    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    content = await file.read()
    llm_client = _build_llm_client(settings)

    try:
        prefill = parse_resume(file.filename, content, llm_client)
    except ResumeParsingFailed as exc:
        return JSONResponse(
            status_code=422,
            content={
                "parsed": False,
                "message": "We couldn't parse your resume. Please fill in the form manually.",
                "detail": str(exc),
            },
        )

    return {"parsed": True, "prefill": prefill}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_main.py -v -k resume`
Expected: PASS (3 passed)

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v`
Expected: All passing

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "Add POST /resume endpoint with graceful parsing-failure responses"
```

---

## Task 6: Frontend — Resume Uploader and Form Pre-fill

**Files:**
- Create: `frontend/resume_upload.py`
- Modify: `frontend/profile_form.py`
- Modify: `frontend/app.py`

- [ ] **Step 1: Implement `render_resume_uploader`**

Create `frontend/resume_upload.py`:

```python
import requests
import streamlit as st

from profile_form import BACKEND_URL


def render_resume_uploader() -> None:
    st.subheader("Optional: upload your resume to pre-fill the form")
    uploaded = st.file_uploader("Resume (PDF or DOCX)", type=["pdf", "docx"])

    if uploaded is None:
        return

    if st.session_state.get("resume_processed_name") == uploaded.name:
        return  # already processed this exact upload

    try:
        response = requests.post(
            f"{BACKEND_URL}/resume",
            files={"file": (uploaded.name, uploaded.getvalue(), uploaded.type)},
            timeout=60,
        )
    except requests.RequestException:
        st.error("Backend unavailable — please fill in the form manually.")
        return

    st.session_state["resume_processed_name"] = uploaded.name

    if response.status_code == 200:
        body = response.json()
        st.session_state["profile_prefill"] = {
            k: v for k, v in body["prefill"].items() if v is not None
        }
        st.success("Resume parsed — review the pre-filled form below before saving.")
    else:
        st.warning(response.json().get("message", "We couldn't parse your resume. Please fill in the form manually."))
```

- [ ] **Step 2: Read pre-fill values in `render_profile_form`**

Modify `frontend/profile_form.py` — at the top of `render_profile_form`, read any stored prefill and use it to seed widget defaults:

```python
def render_profile_form() -> dict | None:
    prefill = st.session_state.get("profile_prefill", {})

    with st.form("profile_form"):
        role = st.text_input(
            "Target role / title",
            value=prefill.get("role", ""),
            placeholder="e.g. Backend Engineer",
        )
        years_experience = st.number_input(
            "Years of experience", min_value=0, max_value=50, step=1,
            value=prefill.get("years_experience", 0),
        )
        locations_raw = st.text_input(
            "Preferred location(s)",
            value=", ".join(prefill.get("locations", [])),
            placeholder="e.g. Bengaluru, Remote, Pune (comma-separated)",
        )
        skills_raw = st.text_input(
            "Skills / tools",
            value=", ".join(prefill.get("skills", [])),
            placeholder="e.g. Python, Django, PostgreSQL (comma-separated)",
        )

        col1, col2 = st.columns(2)
        with col1:
            salary_min = st.number_input(
                "Minimum CTC (INR/year)", min_value=0, step=100000,
                value=prefill.get("salary_min") or 0,
            )
        with col2:
            salary_max = st.number_input(
                "Maximum CTC (INR/year)", min_value=0, step=100000,
                value=prefill.get("salary_max") or 0,
            )

        work_mode = st.selectbox(
            "Work mode preference", WORK_MODES,
            index=WORK_MODES.index(prefill["work_mode"]) if prefill.get("work_mode") in WORK_MODES else 0,
        )
        notice_period_days = st.number_input(
            "Notice period (days)", min_value=0, max_value=365, step=1,
            value=prefill.get("notice_period_days") or 0,
        )
        seniority = st.selectbox(
            "Seniority level", SENIORITY_LEVELS,
            index=SENIORITY_LEVELS.index(prefill["seniority"]) if prefill.get("seniority") in SENIORITY_LEVELS else 0,
        )

        submitted = st.form_submit_button("Save profile")

    # ... rest of the function (payload build, POST, response handling) is unchanged
```

- [ ] **Step 3: Render the uploader above the form in `app.py`**

Modify `frontend/app.py`:

```python
from resume_upload import render_resume_uploader

# ... after st.title(...) and before render_profile_form() ...
render_resume_uploader()
```

- [ ] **Step 4: Manual verification via `docker-compose up`**

Run: `docker-compose up --build`

Manually verify:
1. Uploading a valid PDF/DOCX resume shows "Resume parsed — review the pre-filled form below before saving," and the form below is pre-filled with extracted values (role, experience, locations, skills, etc.), still editable.
2. Uploading an unsupported file type (e.g., `.txt`) shows the "couldn't parse your resume" message and the form remains empty/manual, fully usable.
3. Submitting the pre-filled form (after review/edits) saves the profile exactly as the manual flow does.
4. Re-uploading the same file doesn't re-trigger parsing (idempotent within a session).

- [ ] **Step 5: Commit**

```bash
git add frontend/resume_upload.py frontend/profile_form.py frontend/app.py
git commit -m "Add resume upload with LLM-based profile pre-fill and graceful fallback"
```

---

## Task 7: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: All tests pass, no failures or errors.

- [ ] **Step 2: Full-stack smoke test**

Run: `docker-compose up --build`. Confirm: resume upload → pre-filled form → review/edit → save → search, and the parsing-failure fallback path (bad file type, or temporarily-broken Gemini key) shows a clear inline message without blocking the manual form. Stop with `docker-compose down`.

- [ ] **Step 3: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"
