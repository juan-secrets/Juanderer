# Technical stack

- **Date:** 2026-11-24

## Context

Juanderer is a virtual tabletop compatible with 5th edition. It needs:

- a web app with a **GM view** and a **player view** sharing a live map (tokens, fog of war, line of sight);
- a server that applies the **rules** (dice, checks, attacks, conditions, level-up) and decides what each player is allowed to see;
- a large amount of structured data: the imported SRD (species, classes, spells, items, monsters) plus campaigns, members, characters, maps, combats and roll logs;
- a **native mobile app** (no PWA, no Capacitor, no WebView) on iOS **or** Android;
- continuous deployment on a free tier, CI on every PR, unit, E2E and mobile UI tests.

The subject leaves the stack free but asks us to justify it. It also recommends writing the rules engine **once** and reusing it on mobile.

The team agreed on three constraints: **React** for the web, **Node.js** for the server, and **PostgreSQL** for the database.

### Important guidelines

1. **One rules engine** shared by server, web and mobile, so the three can never disagree on a result.
2. **Server-authoritative**: the server rolls the dice and filters hidden data. Clients only display and preview.
3. **Consistency of linked data**: a combat action touches tokens, turn order, effects and the log at once.
4. **Free hosting** that supports long-lived WebSocket connections.

## Decision

**TypeScript everywhere**, in one **npm workspaces monorepo** (`frontend`, `backend`). The backend is split into **small Express services behind a gateway**.

| Concern         | Decision                                                                                                            | In repo                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Language        | TypeScript (strict) in every workspace                                                                              | Yes                            |
| Runtime         | Node.js 24 LTS                                                                                                      | Yes (no version pinned yet)    |
| Web front-end   | React 19 + Vite                                                                                                     | Yes                            |
| Web state       | TanStack Query (server data) + Zustand (live table state)                                                           | Planned                        |
| Map rendering   | PixiJS 8 (WebGL), with an accessible DOM token list alongside                                                       | Planned                        |
| Server          | Express 5 services, one per domain, each on its own port                                                            | Yes (`example` service)        |
| API entry point | Gateway (Express + `http-proxy-middleware`) forwarding `/api/<service>/*` to each service                           | Yes                            |
| Database        | PostgreSQL (relational + JSONB for raw SRD entries)                                                                 | Yes                            |
| Database access | `pg` connection pool, SQL queries                                                                                   | Yes                            |
| Migrations      | To decide: a SQL migration tool (for example `node-pg-migrate`)                                                     | No                             |
| Validation      | Zod schemas shared by API routes and socket handlers                                                                | Planned                        |
| Real time       | Socket.IO: one room per campaign plus a GM-only room                                                                | Planned                        |
| Rules engine    | Shared `rules` workspace: pure TypeScript, no I/O, injected random generator                                        | Planned                        |
| Mobile          | React Native with Expo, **Android** target                                                                          | Planned                        |
| Auth            | Email + password (argon2 hashes), HTTP-only session cookie on web, bearer token on mobile                           | Planned                        |
| Hosting         | Web: static site (Vercel or Netlify) · Server: Render free web service · Database: Neon free Postgres               | Planned                        |
| Tests           | Vitest (unit) · Playwright (web E2E) · Jest + React Native Testing Library (mobile UI)                              | Planned                        |
| CI/CD           | GitHub Actions: typecheck, tests, build on every PR; deploy on merge to `main`; Android APK artifact on every merge | Planned                        |
| Local setup     | `npm install`, copy `backend/.env.example` to `backend/.env`, `npm run dev`                                         | Yes (needs a local PostgreSQL) |

### Repository layout

```text
juanderer/
├── package.json              # npm workspaces; `npm run dev` starts everything
├── frontend/                 # React 19 + Vite
│   ├── vite.config.ts        # dev server proxies /api to the gateway (port 3000)
│   └── src/
├── backend/
│   ├── .env.example          # DATABASE_URL template
│   └── src/
│       ├── config.ts         # service ports, gateway port, database URL
│       ├── gateway/          # single entry point on port 3000
│       └── services/
│           └── example/      # template service (port 3001), `db.ts` holds the pg pool
└── docs/
```

Planned workspaces: `rules/` (shared rules engine), `shared/` (types and Zod schemas) and `mobile/` (Expo app), each added to the root `workspaces` list.

### Ports in development

| Process         | Port                                                         |
| --------------- | ------------------------------------------------------------ |
| Frontend (Vite) | 5173                                                         |
| Gateway         | 3000                                                         |
| Services        | 3001 and up, one per service, set in `backend/src/config.ts` |

## Options considered

### Web front-end

| Option           | Verdict                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **React + Vite** | **Chosen.** Team requirement; largest ecosystem; same React knowledge as the mobile app, which can share types, rules and data hooks. Vite gives fast dev builds and a dev proxy to the gateway. |
| Next.js          | Rejected. Server rendering brings nothing to a logged-in, real-time table and complicates hosting the real-time server.                                                                          |
| Svelte / Vue     | Rejected by the team constraint; POC 02 (Svelte) showed no gain worth a second paradigm.                                                                                                         |

**State.** TanStack Query caches REST data (campaigns, characters, SRD lookups) and handles refetching. Zustand holds the fast-changing table state fed by socket events (token positions, turn, fog). Redux was rejected as heavier for the same result.

**Map rendering.**

| Option             | Verdict                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **WebGL (PixiJS)** | **Chosen.** Handles large maps, many tokens, lighting and fog masks. Already working in POC 01.                                           |
| SVG                | Rejected for the map: best accessibility (POC 02) but slows down with thousands of wall segments and fog shapes. Kept for small UI icons. |
| Canvas 2D          | Rejected: simpler than Pixi but we would re-build sprites, hit-testing and filters by hand.                                               |

_Consequence:_ a canvas is invisible to screen readers, so the map ships with a parallel **token list** (focusable, arrow keys move the selected token), as in POC 03.

### Server

| Option                                              | Verdict                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Express 5, split into services behind a gateway** | **Chosen.** Express is the framework the whole team already knows, and version 5 forwards errors from `async` handlers without extra code. One service per domain (for example auth, campaigns, characters, game) lets each developer own a service with its own port and restart it alone. The gateway gives the frontend a single `/api` origin. |
| Fastify, single server                              | Not chosen: built-in schema validation and faster routing, but a new framework to learn; validation will come from Zod instead.                                                                                                                                                                                                                    |
| NestJS                                              | Rejected: strong structure, but decorators, modules and dependency injection are a lot to learn.                                                                                                                                                                                                                                                   |

Adding a service: copy `backend/src/services/example/`, register its port in `backend/src/config.ts`, add a `dev:<name>` script in `backend/package.json`. It is then reachable at `/api/<name>/...`.

### Database and access layer

| Option                                        | Verdict                                                                                                                                                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL**                                | **Chosen.** Campaigns, memberships, characters, tokens, combats and logs are linked records; foreign keys and transactions keep a combat action consistent. JSONB stores raw SRD entries as documents where tables would add nothing. |
| MongoDB                                       | Rejected. Flexible for SRD documents, but consistency between records (a combat pointing at a deleted token) would be our code's job.                                                                                                 |
| Supabase (managed Postgres + auth + realtime) | Rejected. Saves auth work, but Row Level Security would replace our own permission code, which is harder to test and to explain; free projects pause after a week without activity.                                                   |

| Access option                     | Verdict                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pg` (node-postgres) with SQL** | **Chosen.** No generated client or build step; every query is visible SQL, which keeps transactions explicit. Each service creates its pool lazily from `DATABASE_URL`. |
| Prisma                            | Not chosen for now: typed client and migrations, but adds a schema file and a generation step to every service.                                                         |
| Drizzle                           | Possible later if typed queries become necessary; it works on top of the same `pg` driver.                                                                              |

**Open point:** a migration tool is still needed so every developer and the hosted database share the same schema. Decide it before the first table is created.

### Real-time transport

| Option                       | Verdict                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Socket.IO**                | **Chosen.** Rooms map directly to "campaign" and "GM only"; automatic reconnection; acknowledgements for actions; client exists for web and React Native. Proven in POC 01. |
| Raw `ws`                     | Rejected: we would rebuild rooms, reconnection and acknowledgements.                                                                                                        |
| Server-Sent Events + POST    | Rejected: works (POC 02) but one-way; every action becomes a separate HTTP call.                                                                                            |
| Supabase / Firebase realtime | Rejected: moves visibility rules out of our server.                                                                                                                         |

Socket.IO will live in one dedicated service (the game service). The gateway must forward WebSocket upgrades to it (`ws: true` in its proxy options), and the Vite dev proxy must do the same.

**Protocol rule:** clients send _intents_ (`token:move`, `roll:request`, `attack:declare`), the server validates them with Zod, applies the rules, and broadcasts a _filtered_ result per room. A player never receives data they are not allowed to see (hidden tokens, fogged areas, GM rolls).

### Rules engine

**Decision:** a `rules` workspace, a pure TypeScript package.

- Pure functions only: input state → output state + events. No database, no network, no `Math.random()` inside: the random generator is passed in, so tests are deterministic and the server stays the source of truth.
- Imported by the **backend services** (authoritative resolution), the **frontend** (instant previews: "this attack needs 15 to hit") and **mobile** (sheet maths, dice).
- The required rules tests (combat resolution, level-up) live here and run with Vitest.

Rejected: rules only on the server (mobile and web previews would need a round-trip for every number), or rules duplicated per app (three implementations to keep in sync).

### Mobile

| Option                          | Verdict                                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **React Native + Expo**         | **Chosen.** Native UI components (allowed by the subject: not a WebView). Same language and React knowledge as the web; imports the `rules` and `shared` workspaces directly. Expo simplifies builds and device testing. |
| Native Kotlin (Jetpack Compose) | Rejected: rules would have to be re-written in Kotlin or only run on the server.                                                                                                                                         |
| Flutter                         | Rejected: Dart, so no shared rules package.                                                                                                                                                                              |
| PWA / Capacitor / Ionic         | **Forbidden** by the subject.                                                                                                                                                                                            |

**Platform: Android.** Free to build and install (APK), buildable on Linux GitHub runners, no Apple developer account needed. iOS stays possible later from the same codebase.

**Scope of the mobile app:** character sheet, dice roller, spells and actions with one-tap rolls, "your turn" notification, rolls sent to the shared chat. The map stays on the web (large screen).

### Hosting (continuous deployment)

| Part     | Decision                                  | Notes                                                                                                                                                                                                                          |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web      | Static build on **Vercel** or **Netlify** | CDN, no sleep, preview deploy per PR.                                                                                                                                                                                          |
| Server   | **Render** free web service               | Supports WebSockets. Free services spin down after 15 minutes without inbound traffic (HTTP requests or WebSocket messages), so the first request after idle is slow. Wake it before demos; a health-check ping is acceptable. |
| Database | **Neon** free Postgres                    | 1 GB per project on the free plan; scales compute to zero when idle.                                                                                                                                                           |
| Fallback | Koyeb free instance for the server        | Its free instance also sleeps, after 60 minutes of inactivity.                                                                                                                                                                 |

**Deploying the services:** in production the gateway and all services run as **one** web service (one container starting every process), so the free tier sleeps and wakes them together instead of once per service.

### Tests

| Level         | Tool                                                                | What it covers                                                                              |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Type checking | `tsc` (`npm run typecheck -w backend`, `npm run build -w frontend`) | Already in the repo                                                                         |
| Unit          | Vitest                                                              | `rules` (dice, attacks, saves, conditions, level-up), service logic, React hooks            |
| API / socket  | Vitest + Supertest + Socket.IO client                               | Permissions, GM-only filtering, intent validation                                           |
| Web E2E       | Playwright                                                          | Sign-up → campaign → invite → character → move token → roll, with a GM and a player browser |
| Mobile UI     | Jest + React Native Testing Library                                 | Sheet rendering, roll buttons, turn alert                                                   |
| Performance   | Scripted socket load + timing logs                                  | Sync latency and line-of-sight computation time (required measurements)                     |

CI blocks merging when any of these fail.

## Consequences

**Positive**

- One language and one set of types across all workspaces: a renamed field breaks the build everywhere at once instead of failing at runtime.
- Rules are written and tested once; server, web and mobile always agree.
- Each developer can own and restart a service without stopping the others.
- Plain SQL keeps transactions visible and needs no code generation.
- Every piece has a free tier compatible with continuous deployment.

**Negative / to watch**

- **Consistency across services**: a database transaction cannot span two services. Keep everything a combat action touches (tokens, turn order, effects, log) inside the game service.
- **Untyped SQL results**: `pg` returns untyped rows; validate them with Zod or type each query by hand.
- **No migrations yet**: until a migration tool is chosen, schemas can drift between developers.
- **WebSockets through the gateway**: the proxy needs `ws: true`, otherwise Socket.IO falls back to slow polling.
- **Monorepo tooling**: React Native's bundler (Metro) needs configuring to resolve workspace packages.
- **WebGL accessibility**: the map needs the parallel token list and keyboard controls to pass the audit.
- **Free server sleeps**: the first request after 15 minutes idle is slow; never demo on a cold server.
- **Single game-service instance**: Socket.IO state lives in memory. If we ever run two instances, add the Redis adapter.
