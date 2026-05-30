# Repository Guidelines

## Project Structure & Module Organization
This project combines a Vite/React frontend with an Express + SQL Server backend.

- `src/app/` contains app bootstrapping and runtime config.
- `src/components/` holds shared layout and UI pieces.
- `src/features/` groups business areas such as `balance`, `config`, `projection`, `operations`, and `scheduling`.
- `src/hooks/` contains cross-feature hooks like `usePlannerData`.
- `src/services/` centralizes API access, mock data, and normalization helpers.
- `server.cjs` is the main backend API; `server.js` appears to be a parallel variant and should be kept aligned deliberately.
- `dist/` is build output and must not be edited manually.

## Build, Test, and Development Commands
Run from the repository root.

- `npm install` installs frontend and backend Node dependencies.
- `npm run dev` starts the Vite frontend for local development.
- `npm run build` generates the production bundle in `dist/`.
- `npm run preview` serves the built frontend locally.
- `npm run lint` runs ESLint across `js` and `jsx` files.
- `npm test` runs the Vitest suite once.
- `docker-compose up --build` starts the containerized stack when Docker is preferred.

## Deployment Notes
The live Docker deployment uses frontend on `http://172.20.20.5:3000` and backend on `http://172.20.20.5:4001/api`. Keep `VITE_API_BASE_URL` aligned with that published backend address unless the infrastructure changes. If the backend host changes, update `.env`, `docker-compose.yaml`, and `docker/40-env-config.sh` together before rebuilding containers.

## Coding Style & Naming Conventions
Use ES modules on the frontend and keep React components in `PascalCase` (`BalanceBoard.jsx`). Hooks and helpers should use `camelCase` (`usePlannerData.js`, `projectionModel.js`). Maintain 2-space indentation and prefer feature-local modules over large shared files. Respect the existing ESLint setup in `eslint.config.js` before opening a PR.

## Testing Guidelines
Vitest is configured through `package.json`, but no test files are currently present. Add tests for reusable logic in `src/services/`, `src/utils/`, and feature models before expanding UI coverage. Name tests `*.test.jsx` or `*.test.js` and keep them near the unit under test or under a dedicated `tests/` folder.

## Commit & Pull Request Guidelines
Recent commit history could not be inspected from the network share because Git blocks the repository as an unsafe directory. Until that is resolved, use short imperative commit messages such as `Add scheduling validation` or `Fix API fallback handling`. PRs should include scope, affected screens or endpoints, environment changes, and screenshots for UI work.

## Security & Configuration Tips
Do not commit real credentials in `.env`; use environment-specific local files and sanitized examples instead. `server.cjs` reads SQL Server settings from environment variables, so document any new variables in the PR. Avoid committing generated patches, temporary SQL scripts, or local test data unless they are part of a deliberate migration.
