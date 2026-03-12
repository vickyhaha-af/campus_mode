#!/bin/zsh
# Tech Vista — Start both servers cleanly
# Usage: ./start.sh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "🧹 Clearing stale processes..."
for port in 8000 5173; do
  pid=$(lsof -ti :$port 2>/dev/null)
  [ -n "$pid" ] && kill -9 $pid 2>/dev/null && echo "  Killed process on :$port"
done
sleep 1

echo ""
echo "🚀 Starting backend (FastAPI + Uvicorn on :8000)..."
cd "$BACKEND_DIR"
(./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/techvista_backend.log 2>&1 &)
sleep 3

if curl -s --max-time 3 http://localhost:8000/api/health > /dev/null 2>&1; then
  echo "  ✅ Backend healthy at http://localhost:8000"
else
  echo "  ❌ Backend failed to start — check /tmp/techvista_backend.log"
  cat /tmp/techvista_backend.log | tail -20
  exit 1
fi

echo ""
echo "⚡ Starting frontend (Vite on :5173)..."
cd "$FRONTEND_DIR"
(npm run dev -- --host > /tmp/techvista_frontend.log 2>&1 &)
sleep 4

if curl -s --max-time 3 http://localhost:5173 > /dev/null 2>&1; then
  echo "  ✅ Frontend live at http://localhost:5173"
else
  echo "  ❌ Frontend failed — check /tmp/techvista_frontend.log"
  cat /tmp/techvista_frontend.log | tail -20
  exit 1
fi

echo ""
echo "✅ Tech Vista is running!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

# Keep script alive, kill children on exit
trap 'pkill -f "uvicorn main:app"; pkill -f "vite --host"; echo "Servers stopped."' EXIT INT TERM
wait
