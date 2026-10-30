# FarmShift backend integration handoff

This handoff is for the backend team. The frontend now has a typed API client and route catalog in `src/lib/api.ts`. Do not start implementing routes from memory—treat `docs/API-CONTRACT.md` as the proposed source of truth, then update both sides if the team chooses different path or field names.

## Enable API mode

```dotenv
VITE_BACKEND_MODE=api
VITE_API_BASE_URL=http://localhost:8000
VITE_API_TIMEOUT_MS=20000
VITE_AUTH_LOGIN_ENDPOINT=/v1/auth/login
VITE_AUTH_LOGOUT_ENDPOINT=/v1/auth/logout
```

Restart Vite after saving `.env.local`. Keep `VITE_BACKEND_MODE=mock` until the service is available and the contract is agreed. `mock` mode retains local profile editing but does not generate pretend AI insights.

## First routes to implement (minimum usable vertical slice)

1. `GET /health`
2. `POST /v1/auth/login`, `POST /v1/auth/logout`, `GET /v1/auth/me`
3. `GET /v1/farms`, `POST /v1/farms`, `GET /v1/farms/{farm_id}`, `PATCH /v1/farms/{farm_id}`
4. `POST /v1/farms/{farm_id}/ai-insights`
5. `GET /v1/farms/{farm_id}/climate/series`
6. `POST /v1/farms/{farm_id}/rotations/compare`
7. `POST /v1/farms/{farm_id}/reports`, `GET /v1/reports/{report_id}`, `GET /v1/reports/{report_id}/download`

Other wrappers already prepared in `src/lib/api.ts`: region search/detail, boundary read/write, analysis jobs, saved rotations, report list/status, preferences, notification list/read, and map-layer metadata. Notifications and reports are connected to the UI in API mode; the additional routes are callable through the typed service layer.

## Farm data contract

Frontend farm profile fields are normalized into this canonical request:

- `name`
- `region_id`: `nagpur` or `wardha`
- `area_ha`: positive number
- `land_type`
- `crops`: `kharif`, `rabi`, `previous_crop`, `sowing_season`
- `water`: `source`, `reliability`
- `soil`: `texture`, `test_status`
- `constraints`: string array
- `boundary_geojson`: nullable GeoJSON FeatureCollection in EPSG:4326

The response must include an opaque server-owned `id` and preserve those fields. The frontend associates that server id with its local farm profile and uses it for subsequent calls.

## AI insights behavior

The AI Insights page is deliberately blank-state-first. No rule-based browser cards are shown as if they were model output. When the user requests insights, the frontend:

1. requires API mode and a backend-authenticated session;
2. ensures the selected farm has a backend id (creates it if it is still local-only);
3. calls `POST /v1/farms/{farm_id}/ai-insights` with `region_id`, `season`, and requested analysis questions;
4. renders only the response's `summary`, `insights`, `evidence`, `actions`, `limitations`, `data_quality`, and `generated_at` fields.

The backend should base recommendations on verified/identified sources; return missing inputs and limitations; and never imply forecasts, soil readings, yields, or crop suitability scores exist if they do not.

## Security and deployment checklist

- Configure local + production CORS origins; permit `Authorization`, `Content-Type`, and `X-Client-Request-Id` headers.
- Verify authenticated ownership on every farm, insight, report, notification and preference endpoint.
- Do not trust `farm_id` ownership from the browser.
- Never expose database/model/provider secrets in frontend environment variables.
- Use time-bounded signed URLs or an authorized download endpoint for reports and protected map layers.
- Include units, time periods, source, spatial resolution, and quality status for environmental observations.
- Implement request validation, rate limiting, structured errors and request IDs.
- Add contract tests for each route before enabling API mode in production.

## Local test order

1. `GET /health` from the frontend's configured base URL.
2. Sign in and verify `/v1/auth/me` and the farm-list response.
3. Save a new farm and edit it; refresh; verify values round-trip.
4. Request climate series and check units/period labels/source notes.
5. Generate AI insights and verify the UI shows only returned items.
6. Compare rotations; inspect benefits, trade-offs, evidence and missing inputs.
7. Generate a report, poll status if queued, and download a valid PDF.
8. Verify logout revokes/invalidates server session if the backend supports it.


## Endpoint reference

The versioned routes and schemas are defined in `docs/openapi.yaml` (OpenAPI 3.1), with additional implementation notes in `docs/API-CONTRACT.md`. The frontend keeps route strings and request types in `src/lib/api.ts`; do not scatter direct `fetch()` calls across components. Add backend integration/contract tests against the OpenAPI spec, then run the frontend with `VITE_BACKEND_MODE=api` and the backend's base URL.

### Frontend-to-end UI wiring

| Feature | Frontend action | Backend route |
|---|---|---|
| Backend status | Settings → Test backend connection | `GET /health` |
| Sign-in / sign-out | Profile dialog / Sign out | `POST /v1/auth/login`, `POST /v1/auth/logout`; `GET /v1/auth/me` is available in the client |
| Region search | Top-bar search | `GET /v1/regions/search` |
| Farm profile | My Farms / Farm Setup save | `GET/POST /v1/farms`, `PATCH /v1/farms/{farm_id}` |
| AI Insights | Generate AI Insights | `POST /v1/farms/{farm_id}/ai-insights` |
| Climate | Load backend observations | `GET /v1/farms/{farm_id}/climate/series` |
| Crop rotation | Compare via backend | `POST /v1/farms/{farm_id}/rotations/compare` |
| Reports | Open Reports / generate / status / download | `GET/POST /v1/farms/{farm_id}/reports`, `GET /v1/reports/{report_id}`, `GET /v1/reports/{report_id}/download` |
| Notifications | Open notification menu / Mark as read | `GET /v1/notifications`, `POST /v1/notifications/{notification_id}/read` |
| Preferences | Sync preferences | `GET/PATCH /v1/users/me/preferences` |
| Optional map/data services | Shared API client | boundaries, analysis jobs, saved insights/rotations, and `GET /v1/map/layers` |

The frontend code and OpenAPI specification are ready as an integration contract, but backend routes and real data must still be implemented, authenticated, and tested by the backend team.
