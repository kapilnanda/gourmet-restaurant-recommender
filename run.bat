@echo off
echo ========================================================
echo Starting Gourmet AI - Backend and Next.js Frontend
echo ========================================================
echo.

echo [1/2] Starting Backend API (FastAPI) on Port 8000...
start "Gourmet AI - Backend" cmd /c "python -m uvicorn src.phase5.api:app --reload"

echo [2/2] Starting Frontend (Next.js) on Port 3000...
cd frontend
start "Gourmet AI - Frontend" cmd /c "npm run dev"

echo.
echo Both servers are starting up!
echo The Next.js frontend will be available at: http://localhost:3000
echo.
echo (Two terminal windows have been opened for the servers. Close them to stop the servers.)
pause
