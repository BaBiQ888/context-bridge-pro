#!/bin/sh
set -e

echo "Starting ContextBridge Pro..."

# Start Next.js frontend (standalone mode)
node /app/frontend/server.js &
FRONTEND_PID=$!

# Start Go backend
/app/context-bridge-pro &
BACKEND_PID=$!

echo "Frontend PID: $FRONTEND_PID | Backend PID: $BACKEND_PID"

# Wait for either process to exit
wait -n

echo "A process exited, shutting down..."
kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
