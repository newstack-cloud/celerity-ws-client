# Contributing

## Prerequisites

- Node.js >= 24
- pnpm >= 9

## Getting Started

```bash
# Clone the repository
git clone git@github.com:newstack-cloud/celerity-ws-client.git
cd celerity-ws-client

# Install dependencies
pnpm install

# Set up git hooks for conventional commits
git config core.hooksPath .githooks

# Build the SDK
pnpm run build

# Run unit tests
pnpm run test:no-coverage
```

## Development

```bash
# Type checking
pnpm run typecheck

# Run tests in watch mode with coverage
pnpm test

# Lint
pnpm run lint

# Format
pnpm run format

# Clean build artifacts
pnpm run clean

# Start the dev environment (build + test server + example frontend)
pnpm run dev
```

## Testing

Unit tests run without any external services. Coverage is included by default; use `test:no-coverage` to skip it.

```bash
# Unit tests with coverage
pnpm run test:run

# Unit tests without coverage
pnpm run test:no-coverage

# Unit + integration tests with coverage (manages Docker lifecycle)
pnpm run test:with-integration

# Watch mode with coverage
pnpm test
```

The `test:with-integration` command handles the full Docker Compose lifecycle automatically, starting services, running tests, and tearing down, so you never need to manage Docker manually.

### Running Integration Tests Manually

To manage Docker services yourself for iterative development:

```bash
# Start services in the background
docker compose -f docker-compose.test.yml up -d --wait

# Run all tests directly (services already running)
VITEST_INCLUDE_INTEGRATION=true vitest run --config vitest.all.config.ts

# Stop services
docker compose -f docker-compose.test.yml down -v
```

## Conventional Commits

This project uses [conventional commits](https://www.conventionalcommits.org/) enforced by commitlint.

Format: `type(scope): description`

**Types**: `feat`, `fix`, `build`, `revert`, `wip`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test`, `instr`, `deps`

Examples:

```
feat: add binary message compression support
fix: resolve reconnection loop on auth failure
chore: update TypeScript to 5.8
```
