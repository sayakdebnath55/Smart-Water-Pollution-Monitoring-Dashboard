# AquaGuard — Smart Water Pollution Monitoring Dashboard

**Tagline:** *Intelligent Water Quality Monitoring*

AquaGuard is a full-stack environmental water-quality monitoring, anomaly detection, pollution alerting, geospatial mapping, and compliance reporting platform built with **React + Vite + TypeScript + Tailwind CSS + Recharts + Leaflet** on the frontend and **Node.js + Express + TypeScript + SQLite** on the backend.

---

## 1. Key Capabilities

- **Executive Watershed Overview**: Real-time KPI summary cards computed from stored records (Total Stations, Active Stations, Stations Requiring Attention, Critical Active Alerts, Composite Water Quality Index with 24h trend deltas, and Last Telemetry Update), gap-aware parameter time-series charts, station status distribution, recent pollution alerts, and filterable station directory.
- **Live Water-Quality Monitoring (`10 Parameters`)**:
  - Supports **pH** (`pH units`), **Turbidity** (`NTU`), **Dissolved Oxygen** (`mg/L`), **Total Dissolved Solids / TDS** (`mg/L`), **Water Temperature** (`°C`), **Electrical Conductivity** (`µS/cm`), **Nitrate** (`mg/L`), **Phosphate** (`mg/L`), **Ammonia** (`mg/L`), and **Biochemical Oxygen Demand / BOD₅** (`mg/L`).
  - Explicitly distinguishes supported vs. non-equipped sensors per station and labels data provenance (**IoT Continuous Probe**, **Specialized Field Analyzer**, **Lab / Grab Sample**, and **DEMO DATA — SIMULATED**).
  - Includes live 5-second simulation controls (**Pause / Resume**, **Refresh Readings**, **Simulate Anomaly**, and **Log Lab Sample**).
- **Monitoring Stations Registry (`CRUD`)**:
  - Seeded with 6 fictional demonstration stations across the Clearwater River Basin (River Upstream, River Downstream, Industrial Discharge, Wastewater Treatment Outlet, Reservoir Buoy, and Offline Water Treatment Intake).
  - Full search, status/connectivity filtering, column sorting, detailed station inspector (capabilities, history, alerts, and station-specific threshold overrides), and persistent Create / Edit / Cascade-Delete operations.
- **Interactive Monitoring Map (`Leaflet + OpenStreetMap`)**:
  - Color- and icon-coded station markers (`Normal`, `Warning`, `Critical`, `Offline`), synchronized station directory, telemetry side panel, status filters, and resilient offline tile fallback.
- **Pollution Alert Management**:
  - Parameter-specific and station-aware threshold evaluation (two-sided ranges for pH/Temperature, lower-bound hypoxia limits for Dissolved Oxygen, upper-bound limits for Turbidity/TDS/Nutrients/BOD).
  - Alert deduplication, severity escalation (`Warning` → `Critical`), configurable cooldowns, unread notifications counter, toast notifications for new critical demo alerts, and persistent **Acknowledge / Resolve / Reopen** workflows with full audit history (`alert_events`).
- **Analytics & Historical Trends**:
  - Multi-horizon time-series (`1h`, `24h`, `7d`, `30d`), Daily/Weekly/Monthly roll-up tables, Station-to-Station comparisons in identical units, Alert frequency by severity, and Missing-Data / Sensor Availability audits.
- **Report Generation (`CSV & Formatted PDF`)**:
  - Configurable date range, station selection, parameter selection, and Summary vs. Detailed modes.
  - RFC-4180 compliant **CSV exports** (Measurements & Alerts) and **Formatted PDF Reports** with explicit `DEMO DATA DISCLOSURE`.

---

## 2. Project Structure

```text
aquaguard/
├── client/
│   └── src/
│       ├── __tests__/          # Frontend unit tests (Vitest + React Testing Library)
│       ├── components/         # Reusable badges, tooltips, AlertDetailModal, InteractiveMapView
│       ├── hooks/              # Global AppContext (live polling, simulation, auth, toasts)
│       ├── layouts/            # Responsive AppLayout (collapsible sidebar + topbar)
│       ├── pages/              # Overview, LiveMonitoring, Stations, Map, Alerts, Analytics, Reports, Settings
│       ├── services/           # Typed REST API client
│       ├── types/              # Frontend TypeScript interfaces
│       └── utils/              # Parameter metadata & formatting utilities
├── server/
│   ├── src/
│   │   ├── database/           # SQLite schema initialization (node:sqlite) & idempotent seed script
│   │   ├── middleware/         # JWT / Role-based access control & IoT API key verification
│   │   ├── routes/             # Express REST API endpoints
│   │   ├── services/           # Threshold engine, Alert manager, Ingestion pipeline, Analytics, Auth
│   │   ├── simulation/         # Deterministic PRNG (Mulberry32) & 5-second Simulation Engine
│   │   └── types/              # Backend models & 10-parameter specifications
│   └── tests/                  # Backend unit & API integration tests (Vitest + Supertest)
├── docs/                       # API documentation & IoT hardware integration guide
├── .env.example                # Documented environment variables
└── package.json                # Unified development, build, seed, and test scripts
```

---

## 3. Local Setup & Quickstart Commands

### Prerequisites
- **Node.js** `v22.5+` or `v24+` (uses Node's built-in `node:sqlite` engine — zero native compilation or external database server required)
- **npm** `v10+`

### Installation & Development Startup

```bash
# 1. Navigate to the project directory
cd aquaguard

# 2. Copy environment configuration (optional — sensible local defaults are built in)
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Initialize & seed the SQLite database (also runs automatically on server startup)
npm run seed

# 5. Start both the Express backend (port 4000) and Vite frontend (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser. The Vite development server automatically proxies `/api/*` requests to `http://localhost:4000`.

### Production Build & Execution

```bash
npm run build
npm start
```

---

## 4. Environment Variables (`.env.example`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | HTTP port for the Express backend API server |
| `NODE_ENV` | `development` | Runtime environment (`development`, `test`, `production`) |
| `DB_PATH` | `./server/data/aquaguard.sqlite` | File path for persistent SQLite storage (`:memory:` in tests) |
| `DEMO_MODE` | `true` | Enables local demonstration mode & quick role switcher |
| `SIMULATION_ENABLED` | `true` | Starts the 5-second synthetic telemetry generator on boot |
| `SIMULATION_INTERVAL_MS` | `5000` | Interval in milliseconds between simulated sensor ticks |
| `SIMULATION_SEED` | `42069` | Deterministic PRNG seed for reproducible simulation runs |
| `SIMULATION_ANOMALY_PROBABILITY` | `0.14` | Probability of controlled threshold excursions during simulation |
| `RETENTION_MAX_ROWS_PER_STATION` | `2500` | Maximum stored readings per station before FIFO pruning |
| `JWT_SECRET` | `aquaguard-local-dev-...` | HMAC-SHA256 secret for signing authentication tokens |
| `IOT_INGEST_API_KEY` | `ag-iot-device-ingest-key-demo-2026` | API key (`X-IoT-API-Key`) for authenticated hardware sensor ingestion |
| `VITE_API_BASE_URL` | `/api` | Base URL used by the React frontend to communicate with the API |

---

## 5. Demo Mode & Authentication Credentials

In local demonstration mode (`DEMO_MODE=true`), the dashboard initializes with an active **Administrator** session so all features can be evaluated immediately, and includes a **Quick Role Switcher** (`Administrator` vs `Operator`) and a **Sign In with Credentials** modal in the top-right profile menu.

- **Administrator Account** (Full CRUD on stations, thresholds, settings, alerts, and reports):
  - Email / Username: `admin@aquaguard.local` (or `admin`)
  - Password: `AdminDemo2026!`
- **Operator Account** (Read access, live monitoring, alert acknowledgment/resolution, and report generation; station/threshold mutations return `403 Forbidden`):
  - Email / Username: `operator@aquaguard.local` (or `operator`)
  - Password: `OperatorDemo2026!`

> **Security Note:** Never deploy demo credentials to a public production environment. Set `DEMO_MODE=false` and configure strong `JWT_SECRET` and `IOT_INGEST_API_KEY` secrets before public deployment.

---

## 6. Testing Instructions

Run the automated backend and frontend test suite using Vitest:

```bash
npm test
```

The test suite verifies:
1. Two-sided (`pH`), lower-bound (`Dissolved Oxygen`), and upper-bound (`Turbidity`, `Ammonia`) threshold evaluation.
2. Rejection of contradictory threshold rules (e.g., `min_critical > min_warning` or `max_warning > max_critical`).
3. Station-specific threshold rule overrides.
4. Alert deduplication, escalation (`warning` → `critical`), acknowledgment, resolution, and audit history persistence.
5. Sensor capability validation and physical range enforcement.
6. RFC-4180 CSV escaping and report filtering with missing-data disclosures.
7. REST API endpoints and role-based access control (`admin` vs `operator`).
8. Frontend accessibility and provenance badge rendering (`StatusBadge`, `DemoProvenanceBadge`, `SensorSourceBadge`).
