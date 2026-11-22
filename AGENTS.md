# Celerity WebSocket Client

`@celerity-sdk/ws-client`, a TypeScript client for the Celerity WebSocket runtime protocol, for
Node.js and browsers. The Celerity runtime is the server side of the protocol, and the Node
SDK's `@celerity-sdk/testing` uses this client for WebSocket tests.

## Workspace

This repo is one of NewStack's. NewStack's maintainers develop it alongside the others in a
shared workspace, using the NewStack Claude Code plugin for how work is planned, reviewed,
committed and coordinated across repos. The plugin isn't public, and nothing here depends on it:
this file and the repo's own docs cover what a contribution needs.

## Layout

| Path                                                            | Holds                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/`                                                          | The client; `index.ts` and `index.browser.ts` are the Node and browser entry points |
| `src/protocol/`                                                 | Protocol messages: capabilities, auth, heartbeat, acks, deduplication, codecs       |
| `src/transport/`, `src/reconnect/`, `src/state/`, `src/events/` | Socket transport, reconnection with backoff, connection state, event routing        |
| `tests/unit/`, `tests/integration/`, `tests/helpers/`           | Vitest suites and a mock socket; integration tests run against `tests/server/`      |
| `tests/server/`                                                 | A Node WebSocket server that stands in for the Celerity runtime in tests            |
| `examples/browser/`                                             | Example frontend served by `pnpm run dev`                                           |

`docs/` isn't in the repo: maintainers keep working notes there, untracked and not gitignored,
so stage files by path rather than with `git add -A`. `format:check` covers it too.

## Checks

Commands are in [CONTRIBUTING.md](CONTRIBUTING.md).

- **Tools:** Node 24 (`.node-version`; `engines` requires >= 24), pnpm 9.15.4
  (`packageManager`), docker for integration tests. Run `pnpm install` first; the git hooks
  need it.
- **Tests:** `pnpm test` is Vitest in watch mode in an interactive terminal; use
  `pnpm run test:no-coverage` (or `test:run` for coverage), which runs `tests/unit` only.
  - `pnpm run test:with-integration` builds and starts `docker-compose.test.yml` (test servers
    on 9876 for auth by message and 9877 for auth on connect), runs unit and integration tests
    with `vitest.all.config.ts`, and stops the stack on exit. That config sets coverage
    thresholds (79–80%), which only this run enforces. The tests talk only to these local
    containers; building the images pulls from dhi.io and npm.
  - `WS_SERVER_URL` and `WS_CONNECT_SERVER_URL` point the integration tests at other servers,
    such as a local Celerity runtime.
  - Run one stack at a time. In a checkout, `pnpm run dev` and the integration stack share a
    compose project and the `ws-server` service, so the tests' teardown removes the dev
    server; across checkouts, the ports are fixed.
- **Lint and format:** `pnpm run lint` (ESLint on `src/` and `tests/`), `pnpm run format:check`
  (Prettier on everything not gitignored, Markdown included, except `CHANGELOG.md`),
  `pnpm run build`, `pnpm run typecheck`.
- **Gates:**
  - With `git config core.hooksPath .githooks`, pre-commit runs `format:check` and `lint` on
    the working tree, not what's staged, on every commit; typecheck, build and tests are left
    to CI. commit-msg runs commitlint.
  - CI (`ci.yml`) runs format, `pnpm audit --audit-level high`, lint, build, typecheck,
    `test:with-integration` and SonarCloud on pull requests and pushes to `main`.
    `codeql.yml` runs CodeQL on the same triggers and weekly. `security.yml` runs a Trivy
    config scan and actionlint when a Dockerfile, compose file, workflow or shell script
    changes, and weekly.

## Running locally

`pnpm run dev` builds the client, then starts a test server on `ws://localhost:9876` (auth by
message, token `test-token`) and the example frontend on `http://localhost:8080`, which serves
`dist/` read-only. Rebuild to see client changes in the frontend; Ctrl+C stops both.

## Compatibility

- **Protocol:** the client must keep working with released Celerity runtimes. The server side
  is in celerity's `libs/runtime` (`core/src/websocket.rs`, `ws/ws-registry`, `ws/ws-redis`,
  `helpers/src/websockets.rs`), and the protocol is documented in celerity-docs-v2
  (`content/docs/framework/runtime/websocket-runtime-protocol.mdx`). Change the runtime and
  the protocol doc first; `tests/server/` only mirrors them, so passing tests don't show the
  runtime agrees.
- **Package API:** pre-1.0, with `bump-minor-pre-major`, so a `feat` or a breaking change bumps
  the minor version. The Node SDK's `testing` package takes this one as an optional peer
  dependency with a caret range (`^0.3.1`), so each minor release needs that range raised
  there, and a breaking change says what else it needs.
- **Dependencies:** none at runtime. `ws` is an optional peer dependency for Node.js only; the
  browser entry point may import its types but not the module.
- **Persisted state:** none.

## Conventions

- Commits: conventional, with the types in `commitlint.config.cjs`, and no scope: commitlint
  rejects one. Dependabot's scoped prefixes (`ci(deps)`, `deps(ws-client)`) don't go through
  the hooks.
- Releases: release-please opens a release pull request; merging it publishes to npm with
  provenance. Don't edit `CHANGELOG.md`, the version in `package.json` or
  `.release-please-manifest.json` by hand.
- Dependency updates: Dependabot (`.github/dependabot.yml`), for npm and GitHub Actions.
- `type` for data shapes; `interface` only for behavioural contracts (`WebSocketLike`,
  `WebSocketFactory`).

## Safety

- Don't publish to npm, create tags or releases, or merge release pull requests.

## Known mistakes

<!-- One line per mistake an agent has made here, phrased as the rule that prevents it. -->
