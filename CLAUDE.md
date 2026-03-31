# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Balancefull** es un sistema de planificación operativa y gestión de balances para instalaciones de producción de fruta (Agroindustrial Almahue). Gestiona las operaciones de cosecha, curado y procesamiento en exportadoras, familias y especies, estas segun su familia va separada, para el caso de solo el kiwi este se le agrega el curado.

Stack: React 19 + Vite (frontend), Express 5 + MSSQL (backend).

## Commands

```bash
npm run dev          # Vite dev server (frontend only, port from vite.config)
node server.js       # Express API server on port 4001
npm run build        # Production build
npm run preview      # Preview production build
npm test             # Vitest (single run)
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint, zero warnings allowed
```

To run the full app locally you need both `npm run dev` and `node server.js` running simultaneously.

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:4001/api
VITE_PLANNING_START=2026-03-12
VITE_PLANNING_DAYS=100
DB_SERVER=172.20.20.5
DB_USER=sa
DB_PASSWORD=...
DB_NAME=almahue_balance
```

## Architecture

### Frontend (`src/`)

```
src/app/App.jsx            — Root component: view switching (Balance/Dashboard/Scheduling/Config)
src/app/config.js          — Reads VITE_ env vars (API URL, planning window dates)
src/hooks/usePlannerData.js — Fetches all initial data; falls back to mockData if API fails
src/services/api.js        — Thin fetch wrapper for all API calls
src/services/normalizers.js — Transforms raw API responses into frontend models
```

Feature modules under `src/features/`:

| Feature | Key files | Purpose |
|---------|-----------|---------|
| `balance/` | `BalanceFamilyTable.jsx`, `balanceModel.js` | Main editable grid; calculates running balance per day |
| `dashboard/` | `ProjectionPanel.jsx`, `projectionModel.js` | Recharts visualizations of projected metrics |
| `config/` | `ConfigEditor.jsx` (27KB), `ParametrosDiaEditor.jsx` | CRUD for familias, especies, parámetros, feriados |
| `operations/` | `useOperationsEditor.js` | Cell-edit state, debounced API saves, optimistic cache |
| `scheduling/` | `WeeklyScheduleEditor.jsx` (46KB), `TurnoDefinitionEditor.jsx` | Weekly shift planning with restrictions |

### Backend (`server.js`)

Single-file Express API (~1200 lines). All database access is here via `mssql` pool. Key endpoint groups:
- `/api/exportadoras`, `/api/familias`, `/api/especies` — master catalog CRUD
- `/api/datos` — operational data (cosecha/curado/proceso per exportadora per date)
- `/api/parametros-especie`, `/api/parametros-dia` — per-species and per-day overrides
- `/api/turnos-definicion`, `/api/tipos-restriccion` — shift and restriction config
- `/api/curado-horas-config` — curing hours per exportadora
- `/api/feriados` — holidays

### Core Data Flow

1. `usePlannerData()` fetches all master + operational data on mount
2. `balanceModel.js` computes running balance:
   - Families **with** curing: `balance += curado - proceso`
   - Families **without** curing: `balance += cosecha - proceso`
   - Curing is auto-calculated from harvest date + `horas_curado ÷ 24` days lag
3. `BalanceFamilyTable` renders one column per day across the planning window
4. Cell edits go through `useOperationsEditor` → `api.js` → `POST /api/datos`

### Key Domain Concepts

- **Exportadora**: a fruit exporter entity (has especie, variedad, familia, color, horas_curado)
- **Familia**: groups exportadoras; controls whether curing applies (`usa_curado`)
- **Planning window**: defined by `VITE_PLANNING_START` + `VITE_PLANNING_DAYS`
- **Negative balance** cells use `.blink-negative` CSS animation

## Styling

No CSS framework. Styles live in `src/styles/global.css` (utility classes: `.panel`, `.stat-grid`, `.table-wrap`) plus heavy inline style objects in components. Color theme: blue/slate (`#2563eb` primary, `#eef3f8` background).
