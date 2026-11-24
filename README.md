# Juanderer

A virtual tabletop for role-playing games: characters, maps, monsters, dice and combat, synced across two screens.

## Stack

- Frontend: React + TypeScript (Vite)
- Backend: Node.js + TypeScript, microservices behind a gateway
- Database: PostgreSQL

## Structure

```
juanderer/
├── package.json              # runs everything with `npm run dev`
├── frontend/                 # React app
│   └── src/App.tsx           # home page
└── backend/
    ├── .env.example          # template for backend/.env (database credentials)
    └── src/
        ├── config.ts         # service ports + database URL
        ├── gateway/          # single entry point, forwards /api/<name>/* to each service
        └── services/
            └── example/      # template service
```

## Getting started

```bash
npm install
cp backend/.env.example backend/.env   # set DATABASE_URL
npm run dev                            # front: http://localhost:5173, gateway: http://localhost:3000, services: 3001+
```

## Checks

The CI runs these from the repository root on every push and pull request:

```bash
npm run format:check   # Prettier (npm run format to fix)
npm run lint           # ESLint
npm run typecheck      # tsc in every workspace
npm run test:coverage  # Vitest, report in coverage/
npm run build          # production build of every workspace
```

## Adding a service

1. Copy `backend/src/services/example/` to `backend/src/services/<name>/`.
2. In `backend/src/config.ts`, add `<name>: { port: <port> }` to `services`. It is then reachable at `/api/<name>/...`.
3. In `backend/package.json`, add `"dev:<name>": "tsx watch src/services/<name>/index.ts"` and append it to the `dev` script.
