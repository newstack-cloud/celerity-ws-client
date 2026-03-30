#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.test.yml"

cleanup() {
  echo "Tearing down test server..."
  docker compose -f "$COMPOSE_FILE" down --timeout 5
}
trap cleanup EXIT

echo "Starting test server..."
docker compose -f "$COMPOSE_FILE" up -d --build --wait

echo ""
echo "Running all tests with combined coverage..."
npx vitest run --config vitest.all.config.ts --coverage

echo ""
echo "All tests passed."
