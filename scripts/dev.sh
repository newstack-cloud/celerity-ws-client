#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"

cleanup() {
  echo ""
  echo "Shutting down..."
  docker compose -f "$COMPOSE_FILE" down --timeout 5
}
trap cleanup EXIT

echo "Building SDK..."
pnpm run build

echo ""
echo "Starting test server and example frontend..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "  WebSocket server:    ws://localhost:9876"
echo "  Example frontend:    http://localhost:8080"
echo "  Auth token:          test-token"
echo ""
echo "Press Ctrl+C to stop."

docker compose -f "$COMPOSE_FILE" logs -f
