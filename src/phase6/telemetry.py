import sqlite3
import os
import time
import uuid

# Define path for telemetry DB
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "telemetry")
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "telemetry.sqlite")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create API Logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS api_logs (
            request_id TEXT PRIMARY KEY,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            endpoint TEXT,
            latency_ms REAL,
            status_code INTEGER,
            model_provider TEXT
        )
    ''')
    
    # Create Feedback table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            feedback_type TEXT,
            comment TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(request_id) REFERENCES api_logs(request_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def log_api_request(request_id: str, endpoint: str, latency_ms: float, status_code: int, model_provider: str = "groq"):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO api_logs (request_id, endpoint, latency_ms, status_code, model_provider) VALUES (?, ?, ?, ?, ?)",
            (request_id, endpoint, latency_ms, status_code, model_provider)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging telemetry: {e}")

def log_feedback(request_id: str, feedback_type: str, comment: str = ""):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO user_feedback (request_id, feedback_type, comment) VALUES (?, ?, ?)",
            (request_id, feedback_type, comment)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error logging feedback: {e}")

# Initialize DB on import
init_db()
