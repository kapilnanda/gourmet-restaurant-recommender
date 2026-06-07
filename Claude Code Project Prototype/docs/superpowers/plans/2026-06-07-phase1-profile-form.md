# Phase 1: Profile Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Streamlit app that captures a user's job-search profile through a structured form and displays it back — establishing the UI foundation for later phases (no external APIs/LLM yet).

**Architecture:** A single-file Streamlit entry point (`app.py`) renders a profile form backed by a small, independently-testable module (`profile.py`) that defines the `Profile` data model, pure input-parsing logic, and validation. The form's raw inputs are converted to a `Profile` via a pure function so the conversion/validation logic can be unit tested without a running Streamlit server. The submitted profile is stored in `st.session_state` and displayed back to the user.

**Tech Stack:** Python 3.11+, Streamlit, pytest

---

## File Structure

- Create: `requirements.txt` — pins `streamlit` and `pytest`
- Create: `app.py` — Streamlit entry point; renders the form, stores the submitted profile in session state, displays it
- Create: `profile.py` — `Profile` dataclass, `build_profile_from_inputs()` (pure parsing function), `validate_profile()` (pure validation function)
- Create: `profile_form.py` — `render_profile_form()`; Streamlit UI that collects raw widget inputs, calls `build_profile_from_inputs` + `validate_profile`, shows errors or returns a `Profile`
- Create: `tests/test_profile.py` — unit tests for `build_profile_from_inputs` and `validate_profile`
- Create: `tests/__init__.py` — empty, marks the tests directory as a package

---

## Task 1: Project Scaffolding

**Files:**
- Create: `requirements.txt`
- Create: `app.py`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create `requirements.txt`**

```
streamlit==1.38.0
pytest==8.3.2
```

- [ ] **Step 2: Create the tests package marker**

Create `tests/__init__.py` with empty content (zero bytes).

- [ ] **Step 3: Create a minimal `app.py`**

```python
import streamlit as st

st.set_page_config(page_title="Job Search Tool", page_icon="🔎")
st.title("Job Search Tool")
st.write("Profile form coming up.")
```

- [ ] **Step 4: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: streamlit and pytest install without errors.

- [ ] **Step 5: Run the app to verify it launches**

Run: `streamlit run app.py`
Expected: Browser opens to `http://localhost:8501` showing the title "Job Search Tool" and the placeholder text. Stop the server with Ctrl+C once confirmed.

- [ ] **Step 6: Commit**

```bash
git add requirements.txt app.py tests/__init__.py
git commit -m "Scaffold Streamlit app skeleton"
```

---

## Task 2: `Profile` Data Model

**Files:**
- Create: `profile.py`
- Test: `tests/test_profile.py`

- [ ] **Step 1: Write the failing test for `Profile` construction**

Create `tests/test_profile.py`:

```python
from profile import Profile


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

Run: `pytest tests/test_profile.py::test_profile_holds_all_expected_fields -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'profile'` (or `ImportError: cannot import name 'Profile'`)

- [ ] **Step 3: Implement the `Profile` dataclass**

Create `profile.py`:

```python
from dataclasses import dataclass
from typing import Optional


@dataclass
class Profile:
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
git add profile.py tests/test_profile.py
git commit -m "Add Profile data model"
```

---

## Task 3: `build_profile_from_inputs` — Parsing Raw Form Inputs

**Files:**
- Modify: `profile.py`
- Modify: `tests/test_profile.py`

- [ ] **Step 1: Write the failing test for parsing comma-separated strings**

Append to `tests/test_profile.py`:

```python
from profile import build_profile_from_inputs


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

Append to `profile.py`:

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
git add profile.py tests/test_profile.py
git commit -m "Add build_profile_from_inputs parsing function"
```

---

## Task 4: `validate_profile` — Validation Rules

**Files:**
- Modify: `profile.py`
- Modify: `tests/test_profile.py`

- [ ] **Step 1: Write the failing tests for validation**

Append to `tests/test_profile.py`:

```python
from profile import validate_profile


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

Append to `profile.py`:

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

- [ ] **Step 5: Run the full test suite**

Run: `pytest tests/test_profile.py -v`
Expected: PASS (11 passed)

- [ ] **Step 6: Commit**

```bash
git add profile.py tests/test_profile.py
git commit -m "Add validate_profile validation rules"
```

---

## Task 5: Profile Form UI

**Files:**
- Create: `profile_form.py`

- [ ] **Step 1: Implement `render_profile_form`**

Create `profile_form.py`:

```python
import streamlit as st

from profile import Profile, build_profile_from_inputs, validate_profile

WORK_MODES = ["Remote", "Hybrid", "Onsite"]
SENIORITY_LEVELS = ["Junior", "Mid", "Senior", "Lead", "Principal"]


def render_profile_form() -> Profile | None:
    """Render the profile form. Returns a validated Profile on submit, else None."""
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

    profile = build_profile_from_inputs(
        role=role,
        years_experience=int(years_experience),
        locations_raw=locations_raw,
        skills_raw=skills_raw,
        salary_min=int(salary_min) or None,
        salary_max=int(salary_max) or None,
        work_mode=work_mode,
        notice_period_days=int(notice_period_days),
        seniority=seniority,
    )

    errors = validate_profile(profile)
    if errors:
        for error in errors:
            st.error(error)
        return None

    return profile
```

- [ ] **Step 2: Commit**

```bash
git add profile_form.py
git commit -m "Add profile form UI"
```

---

## Task 6: Wire the Form into the App

**Files:**
- Modify: `app.py`

- [ ] **Step 1: Replace the placeholder app with the wired-up version**

Replace the contents of `app.py`:

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
    st.json(vars(st.session_state["profile"]))
```

- [ ] **Step 2: Run the app and walk through the golden path**

Run: `streamlit run app.py`

Manually verify:
1. The form renders with all fields (role, experience, locations, skills, salary range, work mode, notice period, seniority).
2. Submitting with all fields filled in validly shows "Profile saved." and a JSON dump of the profile below the form.
3. Submitting with the role left blank shows the error "Role is required." and does not save a profile.
4. Submitting with min CTC greater than max CTC shows "Minimum salary cannot be greater than maximum salary."

Stop the server with Ctrl+C once verified.

- [ ] **Step 3: Commit**

```bash
git add app.py
git commit -m "Wire profile form into the app and display saved profile"
```

---

## Task 7: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `pytest -v`
Expected: All tests pass (11 passed), no failures or errors.

- [ ] **Step 2: Run the app one more time for a final manual smoke test**

Run: `streamlit run app.py`

Confirm the full golden path (fill form → submit → see saved profile JSON) and at least one validation error path work as expected. Stop the server with Ctrl+C.

- [ ] **Step 3: Confirm working tree is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean"
