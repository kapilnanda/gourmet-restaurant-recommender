# Phase 1: Profile Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the full-stack foundation as two Dockerized services — a FastAPI backend that owns the `Profile` model, parsing, and validation behind REST endpoints, and a thin Streamlit frontend that renders the profile form, posts raw inputs to the backend, and displays whatever the backend returns (saved profile or validation errors). No external job/LLM integrations yet.

**Architecture:** Two containers orchestrated via `docker-compose`:
- **`backend/`** — a FastAPI app exposing `POST /profile` (parse, validate, store) and `GET /profile` (retrieve). Domain logic lives in a small, independently-testable module (`app/profile.py`) defining the `Profile` model (Pydantic), a pure `build_profile_from_inputs()` parsing function, and `validate_profile()`. The profile is held in-memory (module-level state) for the MVP — no database.
- **`frontend/`** — a Streamlit app (`app.py` + `profile_form.py`) that renders the form, sends raw widget inputs to the backend via HTTP (`requests`), and displays the JSON response (saved profile or validation errors).
- **`docker-compose.yml`** at the repo root wires the two containers together for local development; the frontend reaches the backend via its service name (e.g., `http://backend:8000`).

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic, Streamlit, `requests`, pytest, `httpx` (for FastAPI `TestClient`), Docker, Docker Compose

---

## File Structure

- Create: `backend/requirements.txt` — pins `fastapi`, `uvicorn`, `pydantic`, `pytest`, `httpx`
- Create: `backend/app/__init__.py` — empty, marks the package
- Create: `backend/app/main.py` — FastAPI app; defines `POST /profile` and `GET /profile`
- Create: `backend/app/profile.py` — `Profile` model, `build_profile_from_inputs()` (pure parsing function), `validate_profile()` (pure validation function)
- Create: `backend/tests/__init__.py` — empty, marks the tests directory as a package
- Create: `backend/tests/test_profile.py` — unit tests for `build_profile_from_inputs` and `validate_profile`
- Create: `backend/tests/test_main.py` — API tests for `/profile` endpoints using FastAPI's `TestClient`
- Create: `backend/Dockerfile` — builds and runs the FastAPI app with Uvicorn
- Create: `frontend/requirements.txt` — pins `streamlit`, `requests`
- Create: `frontend/app.py` — Streamlit entry point; renders the page, wires the form, displays results
- Create: `frontend/profile_form.py` — `render_profile_form()`; collects raw widget inputs and posts them to the backend's `/profile` endpoint
- Create: `frontend/Dockerfile` — builds and runs the Streamlit app
- Create: `docker-compose.yml` — orchestrates `backend` and `frontend` services for local development

---

## Task 1: Backend Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/Dockerfile`

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pytest==8.3.2
httpx==0.27.2
```

- [ ] **Step 2: Create the package and tests markers**

Create `backend/app/__init__.py` and `backend/tests/__init__.py`, both empty (zero bytes).

- [ ] **Step 3: Create a minimal FastAPI app with a health check**

Create `backend/app/main.py`:

```python
from fastapi import FastAPI

app = FastAPI(title="Job Search Tool API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Create the backend `Dockerfile`**

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 5: Install dependencies and verify the app runs locally**

Run: `pip install -r backend/requirements.txt`
Then run: `uvicorn app.main:app --reload --app-dir backend`
Expected: server starts on `http://localhost:8000`; `GET /health` returns `{"status": "ok"}`. Stop with Ctrl+C once confirmed.

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/app/__init__.py backend/app/main.py backend/tests/__init__.py backend/Dockerfile
git commit -m "Scaffold FastAPI backend skeleton"
```

---

## Task 2: `Profile` Model

**Files:**
- Create: `backend/app/profile.py`
- Create: `backend/tests/test_profile.py`

- [ ] **Step 1: Write the failing test for `Profile` construction**

Create `backend/tests/test_profile.py`:

```python
from app.profile import Profile


def test_profile_holds_all_expected_fields():
    profile = Profile(
        role="Backend Engineer",
        years_experience=5,
        locations=["Bengaluru", "Remote"],
        skills=["Python", "Django", "PostgreSQL"],
        salary_min=1500000,
        salary_max=2500000,
        work_mode="Hybrid",
        notice_period_days=30,
        seniority="Senior",
    )

    assert profile.role == "Backend Engineer"
    assert profile.years_experience == 5
    assert profile.locations == ["Bengaluru", "Remote"]
    assert profile.skills == ["Python", "Django", "PostgreSQL"]
    assert profile.salary_min == 1500000
    assert profile.salary_max == 2500000
    assert profile.work_mode == "Hybrid"
    assert profile.notice_period_days == 30
    assert profile.seniority == "Senior"
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `backend/`): `pytest tests/test_profile.py::test_profile_holds_all_expected_fields -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.profile'` (or `ImportError: cannot import name 'Profile'`)

- [ ] **Step 3: Implement the `Profile` model**

Create `backend/app/profile.py`:

```python
from typing import Optional

from pydantic import BaseModel


class Profile(BaseModel):
    role: str
    years_experience: int
    locations: list[str]
    skills: list[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    work_mode: str
    notice_period_days: int
    seniority: str
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pytest tests/test_profile.py::test_profile_holds_all_expected_fields -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/profile.py backend/tests/test_profile.py
git commit -m "Add Profile model"
```

---

## Task 3: `build_profile_from_inputs` — Parsing Raw Form Inputs

**Files:**
- Modify: `backend/app/profile.py`
- Modify: `backend/tests/test_profile.py`

- [ ] **Step 1: Write the failing test for parsing comma-separated strings**

Append to `backend/tests/test_profile.py`:

```python
from app.profile import build_profile_from_inputs


def test_build_profile_from_inputs_parses_and_trims_lists():
    profile = build_profile_from_inputs(
        role="  Backend Engineer  ",
        years_experience=5,
        locations_raw="Bengaluru,  Remote ,Pune",
        skills_raw="Python, Django ,PostgreSQL",
        salary_min=1500000,
        salary_max=2500000,
        work_mode="Hybrid",
        notice_period_days=30,
        seniority="Senior",
    )

    assert profile.role == "Backend Engineer"
    assert profile.locations == ["Bengaluru", "Remote", "Pune"]
    assert profile.skills == ["Python", "Django", "PostgreSQL"]


def test_build_profile_from_inputs_drops_empty_list_entries():
    profile = build_profile_from_inputs(
        role="Backend Engineer",
        years_experience=5,
        locations_raw="Bengaluru,, ,Remote",
        skills_raw="Python,,Django",
        salary_min=None,
        salary_max=None,
        work_mode="Remote",
        notice_period_days=0,
        seniority="Mid",
    )

    assert profile.locations == ["Bengaluru", "Remote"]
    assert profile.skills == ["Python", "Django"]
    assert profile.salary_min is None
    assert profile.salary_max is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_profile.py -v -k build_profile_from_inputs`
Expected: FAIL with `ImportError: cannot import name 'build_profile_from_inputs'`

- [ ] **Step 3: Implement `build_profile_from_inputs`**

Append to `backend/app/profile.py`:

```python
def _parse_list(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


def build_profile_from_inputs(
    role: str,
    years_experience: int,
    locations_raw: str,
    skills_raw: str,
    salary_min: Optional[int],
    salary_max: Optional[int],
    work_mode: str,
    notice_period_days: int,
    seniority: str,
) -> Profile:
    return Profile(
        role=role.strip(),
        years_experience=years_experience,
        locations=_parse_list(locations_raw),
        skills=_parse_list(skills_raw),
        salary_min=salary_min,
        salary_max=salary_max,
        work_mode=work_mode,
        notice_period_days=notice_period_days,
        seniority=seniority,
    )
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_profile.py -v -k build_profile_from_inputs`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/app/profile.py backend/tests/test_profile.py
git commit -m "Add build_profile_from_inputs parsing function"
```

---

## Task 4: `validate_profile` — Validation Rules

**Files:**
- Modify: `backend/app/profile.py`
- Modify: `backend/tests/test_profile.py`

- [ ] **Step 1: Write the failing tests for validation**

Append to `backend/tests/test_profile.py`:

```python
from app.profile import validate_profile


def _valid_profile(**overrides):
    base = dict(
        role="Backend Engineer",
        years_experience=5,
        locations=["Bengaluru"],
        skills=["Python"],
        salary_min=1000000,
        salary_max=2000000,
        work_mode="Remote",
        notice_period_days=30,
        seniority="Mid",
    )
    base.update(overrides)
    return Profile(**base)


def test_validate_profile_accepts_a_valid_profile():
    assert validate_profile(_valid_profile()) == []


def test_validate_profile_flags_empty_role():
    errors = validate_profile(_valid_profile(role=""))
    assert "Role is required." in errors


def test_validate_profile_flags_negative_experience():
    errors = validate_profile(_valid_profile(years_experience=-1))
    assert "Years of experience cannot be negative." in errors


def test_validate_profile_flags_empty_locations():
    errors = validate_profile(_valid_profile(locations=[]))
    assert "At least one location is required." in errors


def test_validate_profile_flags_empty_skills():
    errors = validate_profile(_valid_profile(skills=[]))
    assert "At least one skill is required." in errors


def test_validate_profile_flags_inverted_salary_range():
    errors = validate_profile(_valid_profile(salary_min=2000000, salary_max=1000000))
    assert "Minimum salary cannot be greater than maximum salary." in errors


def test_validate_profile_flags_negative_notice_period():
    errors = validate_profile(_valid_profile(notice_period_days=-5))
    assert "Notice period cannot be negative." in errors
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest tests/test_profile.py -v -k validate_profile`
Expected: FAIL with `ImportError: cannot import name 'validate_profile'`

- [ ] **Step 3: Implement `validate_profile`**

Append to `backend/app/profile.py`:

```python
def validate_profile(profile: Profile) -> list[str]:
    errors: list[str] = []

    if not profile.role.strip():
        errors.append("Role is required.")

    if profile.years_experience < 0:
        errors.append("Years of experience cannot be negative.")

    if not profile.locations:
        errors.append("At least one location is required.")

    if not profile.skills:
        errors.append("At least one skill is required.")

    if (
        profile.salary_min is not None
        and profile.salary_max is not None
        and profile.salary_min > profile.salary_max
    ):
        errors.append("Minimum salary cannot be greater than maximum salary.")

    if profile.notice_period_days < 0:
        errors.append("Notice period cannot be negative.")

    return errors
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_profile.py -v -k validate_profile`
Expected: PASS (7 passed)

- [ ] **Step 5: Run the full profile test module**

Run: `pytest tests/test_profile.py -v`
Expected: PASS (11 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/profile.py backend/tests/test_profile.py
git commit -m "Add validate_profile validation rules"
```

---

## Task 5: `/profile` Endpoints

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_main.py`

- [ ] **Step 1: Write the failing API tests**

Create `backend/tests/test_main.py`:

```python
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _valid_payload(**overrides):
    base = dict(
        role="Backend Engineer",
        years_experience=5,
        locations_raw="Bengaluru, Remote",
        skills_raw="Python, Django",
        salary_min=1000000,
        salary_max=2000000,
        work_mode="Remote",
        notice_period_days=30,
        seniority="Mid",
    )
    base.update(overrides)
    return base


def test_post_profile_returns_saved_profile_for_valid_input():
    response = client.post("/profile", json=_valid_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "Backend Engineer"
    assert body["locations"] == ["Bengaluru", "Remote"]
    assert body["skills"] == ["Python", "Django"]


def test_post_profile_returns_validation_errors_for_invalid_input():
    response = client.post("/profile", json=_valid_payload(role="  "))

    assert response.status_code == 422
    body = response.json()
    assert "Role is required." in body["errors"]


def test_get_profile_returns_the_last_saved_profile():
    client.post("/profile", json=_valid_payload(role="Data Engineer"))

    response = client.get("/profile")

    assert response.status_code == 200
    assert response.json()["role"] == "Data Engineer"


def test_get_profile_returns_404_when_no_profile_saved_yet():
    fresh_client = TestClient(app)
    # No profile posted via this client's app state.
    from app.main import _STATE

    _STATE.pop("profile", None)

    response = fresh_client.get("/profile")

    assert response.status_code == 404
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `backend/`): `pytest tests/test_main.py -v`
Expected: FAIL — `/profile` routes don't exist yet (404s where 200/422 expected)

- [ ] **Step 3: Implement the endpoints**

Replace the contents of `backend/app/main.py`:

```python
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.profile import Profile, build_profile_from_inputs, validate_profile

app = FastAPI(title="Job Search Tool API")

# In-memory store for the MVP — single profile, no persistence across restarts.
_STATE: dict[str, Profile] = {}


class ProfileInput(BaseModel):
    role: str
    years_experience: int
    locations_raw: str
    skills_raw: str
    salary_min: Optional[int]
    salary_max: Optional[int]
    work_mode: str
    notice_period_days: int
    seniority: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/profile")
def create_profile(payload: ProfileInput):
    profile = build_profile_from_inputs(**payload.model_dump())
    errors = validate_profile(profile)
    if errors:
        return JSONResponse(status_code=422, content={"errors": errors})

    _STATE["profile"] = profile
    return profile


@app.get("/profile")
def get_profile():
    profile = _STATE.get("profile")
    if profile is None:
        raise HTTPException(status_code=404, detail="No profile saved yet.")
    return profile
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest tests/test_main.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Run the full backend test suite**

Run: `pytest -v`
Expected: PASS (15 passed)

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/test_main.py
git commit -m "Add POST/GET /profile endpoints"
```

---

## Task 6: Frontend Scaffolding

**Files:**
- Create: `frontend/requirements.txt`
- Create: `frontend/app.py`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `frontend/requirements.txt`**

```
streamlit==1.38.0
requests==2.32.3
```

- [ ] **Step 2: Create a minimal `app.py`**

Create `frontend/app.py`:

```python
import streamlit as st

st.set_page_config(page_title="Job Search Tool", page_icon="🔎")
st.title("Job Search Tool")
st.write("Profile form coming up.")
```

- [ ] **Step 3: Create the frontend `Dockerfile`**

Create `frontend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.address=0.0.0.0", "--server.port=8501"]
```

- [ ] **Step 4: Install dependencies and verify the app launches locally**

Run: `pip install -r frontend/requirements.txt`
Then run (from `frontend/`): `streamlit run app.py`
Expected: Browser opens to `http://localhost:8501` showing the title "Job Search Tool" and the placeholder text. Stop with Ctrl+C once confirmed.

- [ ] **Step 5: Commit**

```bash
git add frontend/requirements.txt frontend/app.py frontend/Dockerfile
git commit -m "Scaffold Streamlit frontend skeleton"
```

---

## Task 7: Profile Form UI (calls the backend)

**Files:**
- Create: `frontend/profile_form.py`

- [ ] **Step 1: Implement `render_profile_form`**

Create `frontend/profile_form.py`:

```python
import os

import requests
import streamlit as st

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

WORK_MODES = ["Remote", "Hybrid", "Onsite"]
SENIORITY_LEVELS = ["Junior", "Mid", "Senior", "Lead", "Principal"]


def render_profile_form() -> dict | None:
    """Render the profile form, post raw inputs to the backend.

    Returns the saved profile dict on success, else None (errors are
    rendered inline and nothing is returned).
    """
    with st.form("profile_form"):
        role = st.text_input("Target role / title", placeholder="e.g. Backend Engineer")
        years_experience = st.number_input("Years of experience", min_value=0, max_value=50, step=1)
        locations_raw = st.text_input(
            "Preferred location(s)", placeholder="e.g. Bengaluru, Remote, Pune (comma-separated)"
        )
        skills_raw = st.text_input(
            "Skills / tools", placeholder="e.g. Python, Django, PostgreSQL (comma-separated)"
        )

        col1, col2 = st.columns(2)
        with col1:
            salary_min = st.number_input("Minimum CTC (INR/year)", min_value=0, step=100000, value=0)
        with col2:
            salary_max = st.number_input("Maximum CTC (INR/year)", min_value=0, step=100000, value=0)

        work_mode = st.selectbox("Work mode preference", WORK_MODES)
        notice_period_days = st.number_input("Notice period (days)", min_value=0, max_value=365, step=1)
        seniority = st.selectbox("Seniority level", SENIORITY_LEVELS)

        submitted = st.form_submit_button("Save profile")

    if not submitted:
        return None

    payload = {
        "role": role,
        "years_experience": int(years_experience),
        "locations_raw": locations_raw,
        "skills_raw": skills_raw,
        "salary_min": int(salary_min) or None,
        "salary_max": int(salary_max) or None,
        "work_mode": work_mode,
        "notice_period_days": int(notice_period_days),
        "seniority": seniority,
    }

    try:
        response = requests.post(f"{BACKEND_URL}/profile", json=payload, timeout=10)
    except requests.RequestException:
        st.error("Backend unavailable, please try again.")
        return None

    if response.status_code == 200:
        return response.json()

    if response.status_code == 422:
        for error in response.json().get("errors", []):
            st.error(error)
        return None

    st.error("Unexpected error saving your profile, please try again.")
    return None
```

- [ ] **Step 2: Commit**

```bash
git add frontend/profile_form.py
git commit -m "Add profile form UI calling the backend API"
```

---

## Task 8: Wire the Form into the App

**Files:**
- Modify: `frontend/app.py`

- [ ] **Step 1: Replace the placeholder app with the wired-up version**

Replace the contents of `frontend/app.py`:

```python
import streamlit as st

from profile_form import render_profile_form

st.set_page_config(page_title="Job Search Tool", page_icon="🔎")
st.title("Job Search Tool")

st.header("Your Profile")
profile = render_profile_form()

if profile is not None:
    st.session_state["profile"] = profile

if "profile" in st.session_state:
    st.success("Profile saved.")
    st.subheader("Saved Profile")
    st.json(st.session_state["profile"])
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app.py
git commit -m "Wire profile form into the app and display saved profile"
```

---

## Task 9: Docker Compose — Run Both Services Together

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

Create `docker-compose.yml` at the repo root:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "8501:8501"
    environment:
      - BACKEND_URL=http://backend:8000
    depends_on:
      - backend
```

- [ ] **Step 2: Build and run both containers**

Run: `docker-compose up --build`
Expected: both services build and start; backend logs show Uvicorn listening on port 8000, frontend logs show Streamlit listening on port 8501.

- [ ] **Step 3: Walk through the golden path end-to-end**

With `docker-compose up` running, open `http://localhost:8501` and manually verify:
1. The form renders with all fields (role, experience, locations, skills, salary range, work mode, notice period, seniority).
2. Submitting with all fields filled in validly shows "Profile saved." and a JSON dump of the profile returned by the backend.
3. Submitting with the role left blank shows the error "Role is required." and does not save a profile.
4. Submitting with min CTC greater than max CTC shows "Minimum salary cannot be greater than maximum salary."
5. `curl http://localhost:8000/profile` returns the most recently saved profile as JSON.

Stop the stack with `docker-compose down` once verified.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "Add docker-compose to orchestrate backend and frontend"
```

---

## Task 10: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run (from `backend/`): `pytest -v`
Expected: All tests pass (15 passed), no failures or errors.

- [ ] **Step 2: Run the full stack one more time for a final manual smoke test**

Run: `docker-compose up --build`

Confirm the full golden path (fill form → submit → see saved profile JSON returned by the backend) and at least one validation error path work as expected. Stop the stack with `docker-compose down`.

- [ ] **Step 3: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"
