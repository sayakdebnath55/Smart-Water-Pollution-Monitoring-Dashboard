# AquaGuard REST API Reference & IoT Integration Guide

## 1. REST API Endpoints

All endpoints are prefixed with `/api` and return JSON responses (except CSV file downloads).

### Health & Metadata
- `GET /api/health` — Returns service health, demo mode status, and simulation engine metrics.
- `GET /api/parameters` — Returns metadata, units, physical bounds, and default benchmarks for all 10 water-quality parameters.

### Authentication & Role Management
- `POST /api/auth/login` — Authenticates `username`/`email` and `password` against `scrypt` password hashes and returns `{ user, token }`.
- `POST /api/auth/switch-role` — Switches active demo role (`admin` or `operator`) when `DEMO_MODE=true`.
- `GET /api/auth/me` — Returns current authenticated user session.

### Dashboard & Stations
- `GET /api/dashboard/summary` — Returns computed KPIs, historical comparison deltas, status distribution, recent alerts, and station summaries.
- `GET /api/stations` — Lists stations with search (`search`), status (`status`), connectivity (`connectivity`), and sorting (`sortBy`, `sortDir`).
- `GET /api/stations/:id` — Returns full station profile, latest readings, station alerts, and effective thresholds.
- `POST /api/stations` *(Admin)* — Creates a new station and initializes its `sensor_capabilities`.
- `PATCH /api/stations/:id` *(Admin)* — Updates station details, connectivity status, and supported sensor capabilities.
- `DELETE /api/stations/:id` *(Admin)* — Cascade-deletes a station and its associated readings, capabilities, and alerts.

### Sensor Readings & IoT Ingestion
- `GET /api/readings` — Queries historical readings with gap-aware time series (`stationId`, `parameter`, `range` = `1h|24h|7d|30d`, `startDate`, `endDate`, `qualityStatus`).
- `GET /api/stations/:id/readings` — Queries historical readings for a specific station.
- `POST /api/readings` *(Requires `X-IoT-API-Key` or Bearer Token)* — Validates and ingests a new reading, evaluates thresholds, updates station WQI, and triggers/deduplicates alerts.

### Pollution Alerts
- `GET /api/alerts` — Lists alerts with filters (`stationId`, `severity`, `status`, `parameter`, `search`, `startDate`, `endDate`) and summary counts.
- `GET /api/alerts/:id` — Returns alert details and full lifecycle audit log (`alert_events`).
- `POST /api/alerts/:id/acknowledge` — Marks an alert as acknowledged and logs an audit event.
- `POST /api/alerts/:id/resolve` — Marks an alert as resolved with resolution notes and recalculates station status.
- `POST /api/alerts/:id/reopen` — Reopens a resolved alert and logs an audit event.
- `POST /api/alerts/mark-all-read` — Marks all unread alerts as read.

### Thresholds, Analytics, Reports & Simulation
- `GET /api/thresholds` — Lists global and station-specific threshold rules.
- `PUT /api/thresholds/:id` *(Admin)* — Validates and updates a threshold rule.
- `POST /api/thresholds` *(Admin)* — Creates or updates a station-specific threshold override.
- `GET /api/analytics/summary` — Computes parameter statistics, daily/weekly/monthly summaries, station comparisons, alert frequencies, and sensor availability audits.
- `GET /api/reports/preview` — Generates a structured JSON report preview.
- `GET /api/reports/export?format=csv&type=readings|alerts` — Exports filtered measurements or alerts as RFC-4180 CSV.
- `GET /api/simulation/status` — Returns simulation engine status.
- `POST /api/simulation/toggle` — Pauses or resumes the background simulation timer.
- `POST /api/simulation/step` — Runs a single simulation tick (with optional `forceAnomaly: true` to test alert generation).

---

## 2. Future Hardware & MQTT IoT Integration Guide

### Connecting an ESP32 or Arduino-Compatible Telemetry Node via HTTP
Physical sensor nodes equipped with Wi-Fi or LTE-M/NB-IoT modems can post measurements directly to `POST /api/readings`:

```bash
curl -X POST http://localhost:4000/api/readings \
  -H "Content-Type: application/json" \
  -H "X-IoT-API-Key: ag-iot-device-ingest-key-demo-2026" \
  -d '{
    "station_id": "STN-RIV-01",
    "parameter": "dissolved_oxygen",
    "value": 8.45,
    "unit": "mg/L",
    "data_source": "IOT_HTTP_INGEST",
    "is_simulated": false
  }'
```

### Extending to MQTT Brokers
To integrate an MQTT broker (such as Eclipse Mosquitto or AWS IoT Core) in a future version:
1. Add the `mqtt` package and connect to `process.env.MQTT_BROKER_URL`.
2. Subscribe to topic `aquaguard/stations/+/telemetry`.
3. Pass incoming payloads directly into `validateAndIngestReading()` in `server/src/services/ingestionService.ts`. All downstream validation, threshold checking, WQI calculation, and alert deduplication work identically regardless of transport.
