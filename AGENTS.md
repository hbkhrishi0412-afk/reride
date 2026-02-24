# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ReRide is a full-stack vehicle marketplace (React 19 + Vite frontend, Express.js dev API server, Supabase backend). See `README.md` for full documentation.

### Running the application

- `npm run dev` starts both the Vite frontend (port 5173) and Express API server (port 3001) via `concurrently`.
- The Vite dev server proxies `/api/*` requests to the Express dev API server on port 3001.
- The dev API server (`dev-api-server.js`) includes mock vehicle data and Socket.io for real-time events, so it works without a Supabase connection for basic browsing.

### Key commands

See `package.json` scripts for the full list. Highlights:

| Task | Command |
|------|---------|
| Dev (frontend + API) | `npm run dev` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Build | `npm run build` |
| Type check | `npm run type-check` |
| E2E tests | `npm run test:e2e` (requires Playwright browsers: `npx playwright install`) |

### Non-obvious caveats

- **Lint has pre-existing failures**: `npm run lint` uses `--max-warnings 0`, so the 2700+ existing warnings cause a non-zero exit. This is a known codebase state, not an environment issue.
- **Unit test suite failures**: 5 of 8 test suites fail to parse due to `import.meta` and `TextEncoder` not being available in the jsdom test environment. The 65 individual tests that do run all pass. This is a pre-existing test configuration gap.
- **Supabase not required for basic dev**: The Express dev API server provides mock data for vehicles, users, plans, FAQs, etc. Full Supabase connectivity requires configuring `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- **Environment file**: Copy `.env.example` to `.env.local` for local development. The dev API server loads from `.env.local` then `.env`.
- **Pre-commit hook**: `.husky/pre-commit` runs `npm run verify:functions` to check serverless function count before commits. This may need `npx husky install` if hooks don't fire.
