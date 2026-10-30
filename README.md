# FarmShift — Earth Intelligence for Resilient Farming

Part of the `hyperthon-nasa-space-apps` repository.

A responsive React + TypeScript + Vite frontend with a **separate public landing page** and an in-app workspace. `/` is the animated landing experience; `/app?region=nagpur` and `/app?region=wardha` open the product workspace at the selected region. The workspace includes map analysis, farms and setup, AI Insights, crop rotation, climate insights, reports, settings, profile sign-in/out UI, and the official ElevenLabs ConvAI orb as a site-wide embedded widget. Section 07 (a standalone Voice Assistant page) is intentionally omitted.

## Motion and design systems

- **GetLayers** (`https://www.getlayers.ai/`) informed the landing page's self-contained visual-layer approach: soft lighting, depth, and a Three.js Earth scene. Decorative orbit lines, wireframe overlays, and artificial map grids have been removed. The ambient layer is implemented locally so it stays easy to edit.

- **21st.dev** (`https://21st.dev/community/components`) was used as a reference for interaction patterns: liquid-glass CTA buttons, staggered sidebar entrances, scroll-triggered reveals, animated card hover states, and a focused loading overlay. These patterns are adapted locally with the already-installed `motion` package (`motion/react`) rather than depending on private component source.

- **Glass surfaces** use blue-tinted translucent fills, borders, blur, and highlights in light mode, then darker cyan/teal translucent fills in dark mode. Respect `prefers-reduced-motion` and the Settings reduced-motion toggle.

## Routes

- `/` — landing page, animated Earth scene, clickable Nagpur/Wardha globe markers, region cards, and loading transition.

- `/app?region=nagpur` — workspace defaulting to Nagpur.

- `/app?region=wardha` — workspace defaulting to Wardha.

- The workspace breadcrumb includes a return path to the landing page. Browser back/forward updates the landing/workspace state.

## What is included

- Dark emerald sidebar with Home, Explore Earth, **one combined My Farms destination** (farm list and setup wizard are inside the same section), Climate Insights, Crop Rotation, Reports, and Settings. The duplicate Farm Setup sidebar item is removed.

- Separate landing page with a slow-rotating 3D Earth using NASA Earth Observatory’s Blue Marble: Next Generation image, a globe anchored in a stable hero position (not scroll-linked), geographically positioned Nagpur/Wardha markers, and Open full map actions. On small screens, the globe returns to normal document flow to avoid trapping scroll. If the direct NASA asset is blocked by a network or CORS policy, it tries the same Blue Marble texture mirrored by an open-source three-globe example; if all sources fail, it shows a clear loading error rather than a synthetic green sphere. This is a static 2004 composite, not live satellite imagery.

- Native in-app MapLibre map using the public GeoJSON source/layer APIs; no GeoLibre iframe, external app shell, or redirect button. Field overlay behavior follows the same self-contained layer-management approach without mixing MapLibre runtime internals.

- In-app MapLibre map with online satellite imagery, street and light basemaps, global DEM-backed 3D terrain using MapLibre's documented TileJSON terrain pattern, map navigation, fullscreen, sample polygon overlays, field selection, and demo-field events. Street styles may show 3D building extrusions when the chosen style provides building-height data. This is not 360-degree ground-level Street View. Tile services require internet access.

- Farm Setup with five-step form, crop photos, and demo field map.

- Crop rotation comparison cards with photographs of soybean, wheat, chickpea, fodder, maize, onion and green gram.

- Climate insight charts, report preview and sample text export, language selection (English/Marathi/Hindi), theme toggle, and data display preferences.

- AI Insights section that renders recommendations only from the configured backend AI endpoint. No profile-derived or fabricated advice is shown in the AI Insights panel.

- Profile sign-in/sign-out dialog: browser-only demo mode works locally; real authentication is enabled only when your backend login endpoint follows the documented contract.

- Official ElevenLabs ConvAI orb/widget is mounted once by `src/lib/elevenLabsWidget.ts`; its initializer normalizes either a bare Agent ID or a share URL before rendering.

- Responsive CSS breakpoints for tablet and mobile, including reduced-motion support.

- Motion-driven section reveals, button/card feedback, and a focused loading transition. The globe stays in its hero layout and spins slowly without scroll-linked translation, synthetic wireframe or orbit-line decoration.

- A usable landing-page quick-profile form for area, Kharif crop, Rabi crop, and water source. Submitting validates the fields, saves them to the same local-storage profile keys consumed by the workspace, and continues to the full setup flow.

- Water-blue glassmorphism for light surfaces and translucent cyan/teal glass surfaces in dark mode.

## Run locally

1. Install Node.js 20 or newer.

2. Copy `.env.example` to `.env`.

3. Run `npm install`.

4. Run `npm run dev`.

5. For a production bundle, run `npm run build`.

## What is demo-only

- The map supports Nagpur and Wardha, Maharashtra. Its three field polygons per region are illustrative coordinates, not verified farm parcels. The displayed area and crop labels are sample values. Replace the sample geometry in `src/components/MapPanel.tsx` with validated farm boundary GeoJSON from the backend.

- Climate figures, NDVI, soil moisture, rainfall charts and crop rotation scores are mock values. They are not measurements or agronomic recommendations for Nagpur or Wardha. The 2004 Blue Marble globe image is contextual imagery and not current crop/land conditions.

- Farm profile persistence (including crops, soil/water notes and constraints) works in browser local storage. Real report generation, crop suitability calculations, geocoding and account sync are not connected yet. The report download is an honest plain-text demo export until a PDF/report API is integrated.

- The official ElevenLabs ConvAI widget is mounted outside the React tree by `src/lib/elevenLabsWidget.ts`; it appears on both landing and workspace routes and accepts a bare Agent ID or a talk-to share URL in `VITE_ELEVENLABS_AGENT_ID`. The agent must allow public widget embedding, and localhost must be allowed in the agent security allowlist. See `docs/ELEVENLABS_SETUP.md`.

- The satellite basemap depends on the external Esri World Imagery tile service; review current provider terms and attribution for deployment. Street and light basemaps use OpenFreeMap style endpoints. Terrain uses the public Mapterhorn TileJSON DEM service. These are online services, not owned/offline datasets; review provider terms and attribution before deployment.

- Crop and Earth images are loaded from the source URLs below at runtime, so an internet connection is required. If you redistribute or deploy this prototype, preserve the relevant attribution and review each source's terms.

## Landing page motion and quick profile

The landing globe stays in its original hero position and rotates slowly around its vertical axis (about one revolution every seven minutes at the configured rate). The rest of the page scrolls naturally, with Motion for React section reveals and interaction transitions. Reduced-motion preferences stop continuous globe rotation. There are no orbital-line or wireframe decoration layers. The bottom quick-profile form validates an area over zero plus Kharif, Rabi, and water-source choices, then writes the profile fields to `farmshift:farm` and `farmshift:farms` before routing into full setup. This is browser-local persistence, not backend sync.

## Image sources / attribution

- **Earth globe texture:** NASA Earth Observatory, Blue Marble: Next Generation (January 2004), high-resolution global map: `https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/`. The runtime prefers the January 2004 global NASA Blue Marble image directly. It then falls back to the same Blue Marble texture mirrored by the open-source three-globe example if the NASA asset is blocked. This is a static composite, not a live Earth stream.

- **Soybean photo:** Unsplash image `photo-1696124651786-218e47e63c73`, used under the Unsplash License.

- **Wheat photo:** Unsplash image `photo-1688320243376-69b68a8f656f`, used under the Unsplash License.

- **Maize photo:** Unsplash image `photo-1572360463110-18939f36219c`, used under the Unsplash License.

- **Onion photo:** Unsplash image `photo-1681391998321-2efbc53ee940`, used under the Unsplash License.

- **Chickpea photo:** Eitan Ferman, “Chickpea field”, Wikimedia Commons: `https://commons.wikimedia.org/wiki/File:Chickpea_field.jpg`. Follow the license and attribution on the file page.

- **Fodder photo:** Kangayam Cattle Research Station / TANUVAS, `https://www.tanuvas.ac.in/kcrs.php`; the site does not declare a clear reuse license on that page, so replace this source or obtain permission before production redistribution.

- **Green gram (moong) photo:** Ministry of Agriculture & Farmers Welfare, Government of India, “Moong crop in a field in Hoshangabad, Madhya Pradesh, on May 28, 2013”, Wikimedia Commons: `https://commons.wikimedia.org/wiki/File:Moong_crop_in_a_field_in_Hoshangabad,_Madhya_Pradesh,_on_May_28,_2013.jpg` (Government Open Data License—India as listed on the file page).

- **Farm-cover landscape:** Unsplash image `photo-1500382017468-9049fed747ef`, used under the Unsplash License.

- **Terrain elevation:** Mapterhorn's public `https://tiles.mapterhorn.com/tilejson.json` DEM service used by the official MapLibre 3D-terrain example. Confirm service terms, attribution, uptime and rate policy before production deployment.

## GeoLibre integration

The map is rendered by MapLibre GL JS, while FarmShift owns field-source synchronization and controls using MapLibre's public APIs. The integration does not embed GeoLibre's full application or invoke GeoLibre's headless adapter at runtime, since that adapter caused a MapLibre `transform` getter crash in this project's installed dependency mix. The included GeoLibre license remains as project history/reference.

## Backend contract

See `docs/API-CONTRACT.md`, `docs/openapi.yaml` (OpenAPI 3.1), and `docs/BACKEND_INTEGRATION_HANDOFF.md`. Keep `src/lib/api.ts` as the single frontend integration point and agree request/response fields with the backend developer before enabling production API mode.

## Runtime blank-screen fix

The map panel uses a structural style-layer type when looking for a building vector layer, avoiding unsafe property access on MapLibre's discriminated `LayerSpecification` union. The unsupported `projection` constructor option was removed (Mercator is the default). Native map setup is guarded so renderer initialization errors are reported in the map panel rather than causing a blank workspace.

The previous `createLayerSync(map)` integration could crash the workspace with `Cannot set property transform ... which has only a getter` in the installed MapLibre/GeoLibre dependency combination. This build removes that runtime adapter and uses MapLibre's public GeoJSON source/layer APIs for field overlays. If you are updating an existing folder, stop Vite, then remove `node_modules` and `package-lock.json` before running `npm install` again so the removed adapter is not left in the local dependency tree. Do not delete your source files.

## ElevenLabs voice assistant

See [`docs/ELEVENLABS_SETUP.md`]\(docs/ELEVENLABS_SETUP.md). FarmShift embeds the official ElevenLabs widget statically in `index.html` using the provided public Agent ID. Never put an ElevenLabs API key in frontend environment variables.

## Profile sign-in and sign-out

The profile menu supports a browser-only demo session when `VITE_AUTH_LOGIN_ENDPOINT` is blank. This is **not secure authentication** and does not store passwords. To enable a real login, configure `VITE_AUTH_LOGIN_ENDPOINT` (for example `/v1/auth/login`) against your backend. FarmShift sends `{ email, password }` and expects a JSON response containing `token` or `access_token` plus an optional `user` object. Confirm this contract with the backend team before enabling it. Tokens are kept in `sessionStorage`, and logout removes the session/token without deleting farm profiles. Optionally set `VITE_AUTH_LOGOUT_ENDPOINT` if the backend requires a remote logout request.

## Backend integration

The frontend now has a typed, centralized API client in `src/lib/api.ts` covering health, authentication, regions, farm CRUD/boundaries, climate, analysis jobs, AI insights, crop rotations, reports/downloads, preferences, notifications and map-layer metadata. A matching OpenAPI 3.1 document is included at `docs/openapi.yaml` for backend implementation and API tooling.

- Read `docs/API-CONTRACT.md` for the proposed endpoint and JSON contract.

- Read `docs/BACKEND_INTEGRATION_HANDOFF.md` for the backend team's implementation order and verification checklist.

- Leave `VITE_BACKEND_MODE=mock` until the backend team agrees on and implements the contract. Set `VITE_BACKEND_MODE=api` and `VITE_API_BASE_URL` in `.env.local` to enable calls; restart Vite after changing environment variables.

- The AI Insights page no longer displays browser-generated farming advice. It requests data from `POST /v1/farms/{farm_id}/ai-insights` and displays only the response returned by the configured API.

- Do not put private API keys, model keys or database credentials into `VITE_*` variables.

The frontend does not itself create a backend, train the AI model, or provide live satellite/climate observations. Those require the backend services and verified data sources.
