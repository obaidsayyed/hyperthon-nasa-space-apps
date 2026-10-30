# FarmShift Backend Documentation

This document provides a comprehensive technical overview and reference for the **FarmShift Backend Engine**, an enterprise-grade agronomic intelligence and climate advisory REST API service built with Python and FastAPI.

---

## 1. System Overview & Architecture

The FarmShift backend serves as the core intelligence and data persistence engine for the FarmShift platform. It is engineered to deliver:
- **Agronomic AI Insights**: Evidence-grounded advisory based on institutional agricultural research (ICAR, PDKV, IMD).
- **Climate Observations & Baseline Analytics**: Calibrated historical and current time-series data (rainfall, temperature, soil moisture, NDVI) for Vidarbha agricultural districts (Nagpur and Wardha).
- **Crop Rotation Comparison**: Multi-year rotation modelling evaluating input costs, biological nitrogen fixation (BNF), water demand, and net return stability indices.
- **Automated PDF Advisory Generation**: Server-side document rendering via ReportLab compiling farm profiles, soil health recommendations, and seasonal advisories.
- **Secure Multitenant Farm Management**: Boundary GeoJSON calculation, spatial validation, user preferences, and notification delivery.

### High-Level Architecture Diagram

```mermaid
flowchart TD
    Client["Client (Web UI / Mobile / Integration API)"]
    
    subgraph Middleware Layer
        ReqId["RequestIdMiddleware\n(X-Client-Request-Id, X-Process-Time)"]
        CORS["CORSMiddleware\n(Configured origins, headers, credentials)"]
    end
    
    subgraph Routing Layer ["FastAPI Routers (/v1)"]
        R_Health["health.py (/health)"]
        R_Auth["auth.py (/v1/auth)"]
        R_Farms["farms.py (/v1/farms)"]
        R_Insights["insights.py (/v1/farms/{id}/ai-insights)"]
        R_Climate["climate.py (/v1/farms/{id}/climate)"]
        R_Rotations["rotations.py (/v1/farms/{id}/rotations)"]
        R_Reports["reports.py (/v1/reports)"]
        R_Regions["regions.py (/v1/regions)"]
        R_Notifs["notifications.py (/v1/notifications)"]
        R_Prefs["preferences.py (/v1/users/me/preferences)"]
        R_Maps["map_layers.py (/v1/map/layers)"]
    end
    
    subgraph Business Logic & Engines Layer ["app/services"]
        S_Auth["auth_service.py (JWT, Bcrypt, Seeding)"]
        S_Insights["insights_engine.py (Agronomic Evidence Engine)"]
        S_Climate["climate_engine.py & climate_service.py"]
        S_Rotation["rotation_engine.py & agronomy_engine.py"]
        S_PDF["pdf_generator.py & pdf_engine.py (ReportLab)"]
        S_Region["region_service.py (Districts & Basemaps)"]
    end
    
    subgraph Core Utilities ["app/core"]
        C_Security["security.py (Token decoding, hashing)"]
        C_Geo["geo.py (WGS84 spherical excess polygon area)"]
        C_Errors["errors.py (AppException hierarchy)"]
    end
    
    subgraph Persistence Layer
        DB[("SQLite Database\nfarmshift.db")]
        Storage[("Local File Storage\nstorage/reports/*.pdf")]
    end

    Client --> ReqId --> CORS
    CORS --> Routing Layer
    Routing Layer --> Business Logic & Engines Layer
    Business Logic & Engines Layer --> Core Utilities
    Business Logic & Engines Layer --> DB
    S_PDF --> Storage
```

---

## 2. Directory & File Structure

The backend code is organized in the `backend/` directory with clear separation of concerns:

```text
FarmShift/
└── backend/
    ├── .env                          # Local environment variables (active configuration)
    ├── .env.example                  # Template configuration file for development/production
    ├── BACKEND_INTEGRATION_HANDOFF.md # API contract, frontend-backend handoff specifications
    ├── Backend.md                    # Complete technical and architecture documentation (this file)
    ├── farmshift.db                  # Local development SQLite database
    ├── requirements.txt              # Production and development Python package dependencies
    ├── run.py                        # Programmatic server startup script
    ├── storage/                      # Persistent storage directory
    │   └── reports/                  # Generated PDF reports storage
    ├── tests/                        # Comprehensive test suite
    │   ├── __pycache__/
    │   ├── conftest.py               # Pytest fixtures, test database setup, mock client
    │   ├── test_local_test_order.py  # End-to-end user journey & contract tests (Steps 1-7)
    │   └── test_security_and_extras.py # Security, authentication, and edge-case unit tests
    └── app/                          # Core application package
        ├── __init__.py               # Package marker
        ├── config.py                 # Pydantic Settings management (.env loader)
        ├── database.py               # SQLAlchemy engine, session maker, get_db dependency
        ├── main.py                   # FastAPI initialization, middleware, error handlers, router mounting
        ├── models.py                 # Consolidated SQLAlchemy ORM model definitions
        ├── schemas.py                # Consolidated Pydantic request/response validation schemas
        ├── seed.py                   # Standalone database seeding script
        ├── core/                     # Foundational core utilities
        │   ├── errors.py             # Custom application exceptions and status codes
        │   ├── geo.py                # GeoJSON geometry validation and spherical area calculation
        │   └── security.py           # Passlib/bcrypt password hashing and JWT encoding/decoding
        ├── middleware/               # HTTP middleware modules
        │   └── request_id.py         # Request ID extraction/generation & performance timing
        ├── models/                   # Modular SQLAlchemy ORM models
        │   ├── __init__.py           # Model registry exports
        │   ├── farm.py               # Farm entity model
        │   ├── notification.py       # Notification entity model
        │   ├── preference.py         # UserPreference entity model
        │   ├── report.py             # Report entity model
        │   ├── revoked_token.py      # Revoked JWT token blacklist model
        │   └── user.py               # User identity entity model
        ├── routers/                  # API Endpoint controllers
        │   ├── __init__.py           # Router module exports
        │   ├── analysis.py           # Analysis job management endpoints
        │   ├── auth.py               # Authentication (login, logout, me, refresh)
        │   ├── climate.py            # Climate series and observations
        │   ├── farms.py              # Farm registration, retrieval, updating, deleting
        │   ├── health.py             # Health check and connectivity diagnostics
        │   ├── insights.py           # Evidence-grounded AI insights endpoint
        │   ├── map_layers.py         # GIS map layer metadata catalog
        │   ├── notifications.py      # User notifications (list, mark as read)
        │   ├── preferences.py        # User profile preferences
        │   ├── regions.py            # Regional agro-climatic profile and search
        │   ├── reports.py            # Report creation, retrieval, and PDF download
        │   └── rotations.py          # Crop rotation comparative evaluation
        ├── schemas/                  # Modular Pydantic schemas (mirrors schemas.py)
        └── services/                 # Business logic and computation engines
            ├── agronomy_engine.py    # Crop rotation evaluation & agronomic scoring
            ├── auth_service.py       # Authentication logic, token issuing & demo seeding
            ├── climate_engine.py     # Weather time-series synthesis & regional norms
            ├── climate_service.py    # Climate service orchestration for farms
            ├── insight_engine.py     # Base insight generator
            ├── insights_engine.py    # Advanced ICAR/PDKV research-grounded AI insight generator
            ├── pdf_engine.py         # PDF generation primitives
            ├── pdf_generator.py      # ReportLab PDF advisory report generation
            ├── region_service.py     # Regional catalog and boundary providers
            └── rotation_engine.py    # Rotation scenario comparison engine
```

---

## 3. Technology Stack & Dependencies

Defined in `requirements.txt`:

| Package | Minimum Version | Purpose |
| :--- | :--- | :--- |
| **FastAPI** | `>=0.110.0` | Asynchronous high-performance REST API framework |
| **Uvicorn** | `>=0.28.0` | Production ASGI web server |
| **Pydantic** | `>=2.6.0` | Data validation, parsing, and type enforcement |
| **Pydantic-Settings**| `>=2.2.0` | Environment settings management via `.env` |
| **SQLAlchemy** | `>=2.0.28` | Relational ORM and database query engine |
| **PyJWT** | `>=2.8.0` | JSON Web Token encoding, signing, and verification |
| **Passlib[bcrypt]** / **bcrypt** | `>=1.7.4` / `>=4.0.0` | Secure password hashing (Blowfish cipher) |
| **ReportLab** | `>=4.1.0` | Dynamic PDF document creation and report styling |
| **Python-Multipart** | `>=0.0.9` | Form-data and multi-part upload handling |
| **Python-Dotenv** | `>=1.0.1` | Local environment configuration management |
| **Pytest** | `>=8.0.0` | Automated test suite execution |
| **HTTPX** | `>=0.27.0` | Asynchronous test client and HTTP client |

---

## 4. Configuration & Environment Variables

The backend uses `pydantic-settings` via `app/config.py` to load configuration from the active `.env` file with environment variable fallback.

### Configuration Properties

| Key | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port on which the FastAPI application listens |
| `HOST` | `"0.0.0.0"` | Host interface binding |
| `ENVIRONMENT` | `"development"` | Application environment (`development` enables auto-reload) |
| `DATABASE_URL` | `"sqlite:///./farmshift.db"` | Database connection string (SQLite or PostgreSQL) |
| `JWT_SECRET` | *(string)* | Symmetric secret key used to sign and verify JWT tokens |
| `JWT_ALGORITHM`| `"HS256"` | Cryptographic algorithm for JWT signatures |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) | Validity lifespan of issued access tokens |
| `CORS_ORIGINS` | `"http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"` | Comma-separated list of allowed client origins |

---

## 5. Database Schema & ORM Models

The database models are implemented using SQLAlchemy in `app/models/` and consolidated in `app/models.py`.

### Entity Relationship Overview

1. **`User` (`users`)**:
   - `id`: Primary key (UUID string, e.g., `usr_demo_vidarbha_01`).
   - `email`: Unique index, farmer login identity.
   - `name`: Farmer full name.
   - `hashed_password`: Bcrypt salted password hash.
   - Relationships: One-to-Many with `Farm`, `Notification`, `Report`; One-to-One with `UserPreference`.

2. **`Farm` (`farms`)**:
   - `id`: Primary key (UUID string or prefixed opaque ID, e.g., `farm_...`).
   - `user_id`: Foreign key referencing `users.id` (CASCADE delete).
   - `name`: Display name of the farm.
   - `region_id`: Region identifier (e.g., `nagpur`, `wardha`).
   - `area_ha`: Total farm area in hectares (float).
   - `land_type`: Soil & irrigation category (e.g., `Irrigated Vertisol`, `Rainfed`).
   - `crops`: JSON object containing `{ kharif, rabi, previous_crop, sowing_season }`.
   - `water`: JSON object containing `{ source, reliability }`.
   - `soil`: JSON object containing `{ texture, test_status }`.
   - `constraints`: JSON list of strings (e.g., `["Pink bollworm risk"]`).
   - `boundary_geojson`: JSON GeoJSON FeatureCollection defining geospatial bounds.

3. **`Report` (`reports`)**:
   - `id`: Unique report ID.
   - `farm_id`, `user_id`: Foreign keys to associated farm and owner.
   - `title`: Human-readable title of the advisory report.
   - `type` / `report_type`: Advisory category (`comprehensive`, `crop_health`, `climate_risk`).
   - `status`: Lifecycle state (`ready`, `queued`, `failed`).
   - `download_url`: Relative endpoint path to download the generated PDF.
   - `report_metadata`: JSON summary of metrics, baseline data, and recommendations.

4. **`UserPreference` (`user_preferences`)**:
   - `user_id`: Unique foreign key to `users.id`.
   - Preferences: `theme`, `language`, `email_alerts`, `sms_alerts`, `units_system`, `area_unit`, `rainfall_unit`, `temperature_unit`.

5. **`Notification` (`notifications`)**:
   - In-app notification messages with title, level (`info`, `success`, `warning`, `error`), and `read` boolean.

6. **`RevokedToken` (`revoked_tokens`)**:
   - Blacklist storage for logged-out JWT tokens to enforce immediate invalidation.

7. **`Region` & `MapLayer`**:
   - Agricultural boundary coordinates, agro-climatic zones, and GIS tile layer configurations.

---

## 6. Core Infrastructure & Security

### Security & Authentication (`app/core/security.py` & `app/services/auth_service.py`)
- **Password Hashing**: Uses `bcrypt.hashpw` with salt rounds = 12. Password inputs are truncated to 72 bytes to conform to standard Bcrypt length limits.
- **JWT Authentication**: Generates RFC 7519 compliant JSON Web Tokens containing `sub` (User ID), `email`, `iat` (issued-at), `exp` (expiration), and `jti` (unique token ID).
- **Token Invalidation**: `POST /v1/auth/logout` records the token in the `revoked_tokens` table. Protected routes verify tokens against this blacklist on every request.
- **Dependency Injection**: `get_current_user` extracts the `Bearer <token>` from the `Authorization` header, decodes the claims, checks revocation, and returns the active `User` instance.

### Request Tracking Middleware (`app/middleware/request_id.py`)
- Reads the `X-Client-Request-Id` header sent by the client (or generates a new UUID if omitted).
- Stores the ID in `request.state.request_id` and attaches it to all outgoing response headers.
- Measures request processing duration and emits `X-Process-Time: <ms>ms`.

### Geospatial Calculations (`app/core/geo.py`)
- Implements the **WGS84 Spherical Excess Formula** to compute exact polygon areas in hectares and square meters directly from GeoJSON coordinates without external heavy GIS dependencies (e.g. GDAL).
- Enforces GeoJSON specifications: coordinates must be `[longitude, latitude]`, outer rings must be closed (first and last coordinate match), and coordinates must lie within `[-180, 180]` and `[-90, 90]`.

### Error Handling (`app/core/errors.py` & `app/main.py`)
- Standardized error envelopes returned across all endpoints:
  ```json
  {
    "error": "RequestValidationError",
    "message": "Input validation failed. Please check the submitted fields.",
    "details": [...],
    "request_id": "req_xyz_123"
  }
  ```

---

## 7. Business Logic Engines (`app/services`)

### 1. Agronomic AI Insights Engine (`insights_engine.py`)
Synthesizes verified institutional guidelines into structured farm recommendations:
- **Verified Sources**: ICAR (Indian Council of Agricultural Research), Dr. PDKV (Panjabrao Deshmukh Krishi Vidyapeeth, Akola), and IMD (India Meteorological Department).
- **Missing Inputs Detection**: Inspects if soil test status is untracked or water reliability is missing, explicitly flagging them under `data_quality.missing_inputs`.
- **Confidence Scoring**: Assigns a `completeness_score` (0-100%) reflecting input data sufficiency.

### 2. Climate Observation Engine (`climate_engine.py` & `climate_service.py`)
- Provides historical averages and monthly anomaly calculations for Vidarbha agro-climatic zones:
  - **Nagpur Baseline**: ~1092 mm annual rainfall, peak in July-August (304 mm / 278 mm).
  - **Wardha Baseline**: ~1044 mm annual rainfall.
- Generates observation time series including:
  - `rainfall_mm` vs. `rainfall_normal_mm` (with `rainfall_anomaly_pct`).
  - `temperature_max_c` and `temperature_min_c`.
  - `soil_moisture_pct` and `ndvi` (vegetation index).

### 3. Crop Rotation Comparison Engine (`rotation_engine.py` & `agronomy_engine.py`)
Evaluates 3 alternative cropping sequences against the farm's baseline:
1. **Soybean + Pigeonpea (4:1 Intercropping)**: Enhances biological nitrogen fixation (+45 kg N/ha), reduces synthetic fertilizer costs by ~12%.
2. **Cotton + Green Gram (Moong) Relay / Strip System**: Provides early cashflow and pest break against Pink Bollworm.
3. **Diversified Cotton + Chickpea + Summer Fodder/Cover**: High-stability rotation maximizing water-use efficiency.

### 4. PDF Generation Engine (`pdf_generator.py`)
- Generates print-ready A4 agronomic advisory documents using ReportLab.
- Outputs clean tabular layouts covering:
  - Farm Profile Header & Geographic Coordinates.
  - Climate Risk & Rainfall Summary.
  - AI Agronomic Recommendations & Critical Actions.
  - Crop Rotation Matrix & Economic Tradeoffs.
- Stores output files under `storage/reports/FarmShift_Report_<id>.pdf`.

---

## 8. Complete API Endpoint Reference

### Health & System
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/health` | No | System status, database connection test, version string |

### Authentication
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/v1/auth/login` | No | Authenticate with email & password, returns JWT token |
| `POST` | `/v1/auth/logout` | Yes | Invalidate active access token |
| `GET` | `/v1/auth/me` | Yes | Retrieve profile details of authenticated user |

### Farm Profiles
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/v1/farms` | Yes | List all farm profiles belonging to authenticated user |
| `POST` | `/v1/farms` | Yes | Register new farm profile with boundary GeoJSON |
| `GET` | `/v1/farms/{farm_id}` | Yes | Retrieve single farm details by ID |
| `PATCH` | `/v1/farms/{farm_id}` | Yes | Update specific farm attributes |
| `DELETE` | `/v1/farms/{farm_id}` | Yes | Delete farm profile |

### Agronomic Intelligence & Analysis
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `POST` | `/v1/farms/{farm_id}/ai-insights` | Yes | Generate ICAR-grounded AI recommendations |
| `GET` | `/v1/farms/{farm_id}/climate/series` | Yes | Fetch environmental & climate observation series |
| `POST` | `/v1/farms/{farm_id}/rotations/compare`| Yes | Compare multi-year crop rotation alternatives |

### Advisory Reports
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/v1/farms/{farm_id}/reports` | Yes | List existing reports generated for a farm |
| `POST` | `/v1/farms/{farm_id}/reports` | Yes | Generate a new PDF advisory report |
| `GET` | `/v1/reports/{report_id}` | Yes | Get status and metadata of a specific report |
| `GET` | `/v1/reports/{report_id}/download` | Optional (Query token supported) | Download generated PDF report binary |

### Regions & Spatial Metadata
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/v1/regions/search` | No | Search supported agro-climatic zones |
| `GET` | `/v1/regions/{region_id}` | No | Get agro-climatic profile for a specific region |
| `GET` | `/v1/map/layers` | No | Retrieve GIS layer catalog (cadastral, satellite, NDVI) |

### User Settings & Notifications
| Method | Path | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/v1/users/me/preferences` | Yes | Retrieve user display & unit preferences |
| `PATCH` | `/v1/users/me/preferences` | Yes | Update user display & unit preferences |
| `GET` | `/v1/notifications` | Yes | Retrieve in-app notifications |
| `POST` | `/v1/notifications/{id}/read`| Yes | Mark notification as read |

---

## 9. Default Seed Credentials

Upon startup, the application initializes database tables and automatically seeds a demonstration account if one does not exist:

- **Email**: `farmer@farmshift.org`
- **Password**: `farmshift123`
- **Role**: `farmer`
- **Region**: Vidarbha (Nagpur / Wardha)

---

## 10. How to Run & Test the Backend

### Prerequisites
- Python 3.10+ installed.
- Virtual environment recommended.

### 1. Installation
Navigate into the `backend/` directory and install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

### 2. Running the Server
Run using the startup script:
```bash
python run.py
```
Or start directly with `uvicorn`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Once running:
- **Interactive OpenAPI Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc Documentation**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

### 3. Running Automated Tests
The backend test suite covers all integration steps, contract validations, and security policies:
```bash
cd backend
pytest -v
```
To run specific test categories:
```bash
pytest tests/test_local_test_order.py -v
pytest tests/test_security_and_extras.py -v
```

