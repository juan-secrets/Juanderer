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

The team has already agreed on three constraints: **React** for the web, **Node.js** for the server, and **PostgreSQL** for the database. This ADR fills in the rest and records why.

### Important guidelines

1. **One rules engine** shared by server, web and mobile, so the three can never disagree on a result.
2. **Server-authoritative**: the server rolls the dice and filters hidden data. Clients only display and preview.
3. **Consistency of linked data**: a combat action touches tokens, turn order, effects and the log at once.
4. **Team speed**: 3 developers, about 9 working weeks, one language to learn.
5. **Free hosting** that supports long-lived WebSocket connections.

## Decision

**TypeScript everywhere**, in one **npm workspaces monorepo**.

| Concern | Decision |
| --- | --- |
| Language | TypeScript (strict) in every app and package |
| Web front-end | React 18 + Vite |
| Web state | TanStack Query (server data) + Zustand (live table state) |
| Map rendering | PixiJS 8 (WebGL), with an accessible DOM token list alongside |
| Server | Node.js 20 LTS + Fastify |
| ORM / migrations | Prisma (schema, typed client, `prisma migrate`) |
| Database | PostgreSQL 16 (relational + JSONB for raw SRD entries) |
| Validation | Zod schemas in `packages/shared`, used by API routes and socket handlers |
| Real time | Socket.IO: one room per campaign plus a GM-only room |
| Rules engine | `packages/rules`: pure TypeScript, no I/O, injected random generator |
| Mobile | React Native with Expo, **Android** target |
| Auth | Email + password (argon2 hashes), HTTP-only session cookie on web, bearer token on mobile |
| Hosting | Web: static site (Vercel or Netlify) · Server: Render free web service · Database: Neon free Postgres |
| Tests | Vitest (unit) · Playwright (web E2E) · Jest + React Native Testing Library (mobile UI) |
| CI/CD | GitHub Actions: lint, typecheck, tests, build on every PR; deploy on merge to `main`; Android APK artifact on every merge |
| Local setup | `docker compose up` starts Postgres, server and web |

## Options considered

### Web front-end

| Option | Verdict |
| --- | --- |
| **React + Vite** | **Chosen.** Team requirement; largest ecosystem; shares components and hooks logic with React Native. Vite gives fast dev builds. |
| Next.js | Rejected. Server rendering brings nothing to a logged-in, real-time table and complicates hosting the Socket.IO server. |
| Svelte / Vue | Rejected by the team constraint; POC 02 (Svelte) showed no gain worth a second paradigm. |

**State.** TanStack Query caches REST data (campaigns, characters, SRD lookups) and handles refetching. Zustand holds the fast-changing table state fed by socket events (token positions, turn, fog). Redux was rejected as heavier for the same result.

**Map rendering.**

| Option | Verdict |
| --- | --- |
| **WebGL (PixiJS)** | **Chosen.** Handles large maps, many tokens, lighting and fog masks. Already working in POC 01. |
| SVG | Rejected for the map: best accessibility (POC 02) but slows down with thousands of wall segments and fog shapes. Kept for small UI icons. |
| Canvas 2D | Rejected: simpler than Pixi but we would re-build sprites, hit-testing and filters by hand. |

*Consequence:* a canvas is invisible to screen readers, so the map ships with a parallel **token list** (focusable, arrow keys move the selected token), as in POC 03.

### Server

| Option | Verdict |
| --- | --- |
| **Node.js + Fastify** | **Chosen.** Team requirement for Node. Fastify has schema-based validation, good TypeScript types and a plugin system; it hosts Socket.IO on the same HTTP server. |
| Express | Rejected: works, but no built-in validation or typing; we would add them ourselves. |
| NestJS | Rejected: strong structure, but decorators, modules and DI are a lot to learn. |

### Database and ORM

| Option | Verdict |
| --- | --- |
| **PostgreSQL** | **Chosen.** Campaigns, memberships, characters, tokens, combats and logs are linked records; foreign keys and transactions keep a combat action consistent. JSONB stores raw SRD entries as documents where tables would add nothing. |
| MongoDB | Rejected. Flexible for SRD documents, but consistency between records (a combat pointing at a deleted token) would be our code's job. |
| Supabase (managed Postgres + auth + realtime) | Rejected. Saves auth work, but Row Level Security would replace our own permission code, which is harder to test and to explain; free projects pause after a week without activity. |

| ORM option | Verdict |
| --- | --- |
| **Prisma** | **Chosen.** Readable schema file, generated typed client, `prisma migrate` for versioned migrations, Prisma Studio for debugging. |
| Drizzle | Good alternative (SQL-like, lighter). Not chosen because Prisma's schema file doubles as data-model documentation. |
| TypeORM / raw `pg` | Rejected: weaker typing or more boilerplate. |

### Real-time transport

| Option | Verdict |
| --- | --- |
| **Socket.IO** | **Chosen.** Rooms map directly to "campaign" and "GM only"; automatic reconnection; acknowledgements for actions; client exists for web and React Native. Proven in POC 01. |
| Raw `ws` | Rejected: we would rebuild rooms, reconnection and acknowledgements. |
| Server-Sent Events + POST | Rejected: works (POC 02) but one-way; every action becomes a separate HTTP call. |
| Supabase / Firebase realtime | Rejected: moves visibility rules out of our server. |

**Protocol rule:** clients send *intents* (`token:move`, `roll:request`, `attack:declare`), the server validates them with Zod, applies the rules, and broadcasts a *filtered* result per room. A player never receives data they are not allowed to see (hidden tokens, fogged areas, GM rolls).

### Rules engine

**Decision:** `packages/rules`, a pure TypeScript package.

- Pure functions only: input state → output state + events. No database, no network, no `Math.random()` inside: the random generator is passed in, so tests are deterministic and the server stays the source of truth.
- Imported by **server** (authoritative resolution), **web** (instant previews: "this attack needs 15 to hit") and **mobile** (sheet maths, dice).
- 100% of the required rules tests (combat resolution, level-up) live here and run with Vitest.

Rejected: rules only on the server (mobile and web previews would need a round-trip for every number), or rules duplicated per app (three implementations to keep in sync).

### Mobile

| Option | Verdict |
| --- | --- |
| **React Native + Expo** | **Chosen.** Native UI components (allowed by the subject: not a WebView). Same language and React knowledge as the web; imports `packages/rules` and `packages/shared` directly. Expo simplifies builds and device testing. |
| Native Kotlin (Jetpack Compose) | Rejected: rules would have to be re-written in Kotlin or only run on the server. |
| Flutter | Rejected: Dart, so no shared rules package. |
| PWA / Capacitor / Ionic | **Forbidden** by the subject. |

**Platform: Android.** Free to build and install (APK), buildable on Linux GitHub runners, no Apple developer account needed. iOS stays possible later from the same codebase.

**Scope of the mobile app:** character sheet, dice roller, spells and actions with one-tap rolls, "your turn" notification, rolls sent to the shared chat. The map stays on the web (large screen).

### Hosting (continuous deployment)

| Part | Decision | Notes |
| --- | --- | --- |
| Web | Static build on **Vercel** or **Netlify** | CDN, no sleep, preview deploy per PR. |
| Server | **Render** free web service | Supports WebSockets. Free services spin down after 15 minutes without inbound traffic (HTTP requests or WebSocket messages), so the first request after idle is slow. Wake it before demos; a health-check ping is acceptable. |
| Database | **Neon** free Postgres | 1 GB per project on the free plan; scales compute to zero when idle. |
| Fallback | Koyeb free instance for the server | Its free instance also sleeps, after 60 minutes of inactivity. |


### Tests

| Level | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | `packages/rules` (dice, attacks, saves, conditions, level-up), server services, React hooks |
| API / socket | Vitest + Fastify `inject` + Socket.IO client | Permissions, GM-only filtering, intent validation |
| Web E2E | Playwright | Sign-up → campaign → invite → character → move token → roll, with a GM and a player browser |
| Mobile UI | Jest + React Native Testing Library | Sheet rendering, roll buttons, turn alert |
| Performance | Scripted socket load + timing logs | Sync latency and line-of-sight computation time (required measurements) |

CI blocks merging when any of these fail.

## Consequences

**Positive**

- One language and one set of types across all workspaces: a renamed field breaks the build everywhere at once instead of failing at runtime.
- Rules are written and tested once; server, web and mobile always agree.
- PostgreSQL + Prisma give consistent combat state and versioned migrations.
- Every piece has a free tier compatible with continuous deployment.

**Negative / to watch**

- **Monorepo tooling**: React Native's bundler (Metro) needs configuring to resolve workspace packages.
- **WebGL accessibility**: the map needs the parallel token list and keyboard controls to pass the audit.
- **Schema changes** need a Prisma migration each time; review migrations like code.
- **Free server sleeps**: the first request after 15 minutes idle is slow; never demo on a cold server.
- **Single server instance**: Socket.IO state lives in memory. If we ever run two instances, add the Redis adapter.
