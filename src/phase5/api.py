import json
import os
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ValidationError
import time
import uuid

# Adjust path to import from src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

try:
    from src.phase2.preference_layer import UserPreferenceInput
    from src.phase4.llm_recommendation import run_phase4
    from src.phase6.telemetry import log_api_request, log_feedback
except ModuleNotFoundError as e:
    raise RuntimeError(f"Could not import phase modules. Make sure you run from project root. {e}")

app = FastAPI(title="Restaurant Recommendation API")

# Path to the data
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "phase1", "data", "processed", "v1", "zomato_cleaned.csv")
# Fallback to local if running from project root
if not os.path.exists(DATA_PATH):
    DATA_PATH = "phase1/data/processed/v1/zomato_cleaned.csv"


@app.post("/api/recommend")
async def get_recommendations(prefs: dict):
    """
    Accepts raw preferences, validates them via Phase 2,
    and returns recommendations from Phase 4.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())
    status_code = 200
    
    try:
        # Validate input via Phase 2 contract
        validated_input = UserPreferenceInput(**prefs)
    except ValidationError as e:
        status_code = 422
        latency_ms = (time.time() - start_time) * 1000
        log_api_request(request_id, "/api/recommend", latency_ms, status_code)
        raise HTTPException(status_code=422, detail=e.errors())
    
    # Run Phase 4
    try:
        result = run_phase4(DATA_PATH, prefs)
        result["request_id"] = request_id  # Attach request_id for feedback
        
        latency_ms = (time.time() - start_time) * 1000
        provider = result.get("provider", "groq")
        log_api_request(request_id, "/api/recommend", latency_ms, status_code, provider)
        
        return result
    except Exception as e:
        status_code = 500
        latency_ms = (time.time() - start_time) * 1000
        log_api_request(request_id, "/api/recommend", latency_ms, status_code)
        raise HTTPException(status_code=500, detail=str(e))

class FeedbackPayload(BaseModel):
    request_id: str
    feedback_type: str  # "up" or "down"
    comment: str = ""

@app.post("/api/feedback")
async def submit_feedback(payload: FeedbackPayload):
    """
    Accepts user feedback for a specific recommendation request.
    """
    if payload.feedback_type not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="Invalid feedback type. Use 'up' or 'down'.")
    
    log_feedback(payload.request_id, payload.feedback_type, payload.comment)
    return {"status": "success", "message": "Feedback recorded."}

# Mount static files for the frontend UI
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.phase5.api:app", host="127.0.0.1", port=8000, reload=True)
