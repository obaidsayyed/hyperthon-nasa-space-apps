import pytest


def test_step_1_health_check(client):
    """
    Step 1: GET /health from the frontend's configured base URL.
    Verifies service status, version, and database connectivity.
    """
    res = client.get("/health", headers={"X-Client-Request-Id": "req_health_01"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["version"] == "1.0.0"
    assert data["database"] == "connected"
    assert res.headers.get("X-Client-Request-Id") == "req_health_01"


def test_step_2_auth_login_and_me(client):
    """
    Step 2: Sign in and verify /v1/auth/me and the farm-list response.
    """
    # Login with seeded farmer credentials
    login_res = client.post("/v1/auth/login", json={
        "email": "farmer@farmshift.org",
        "password": "farmshift123"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    assert login_data["user"]["email"] == "farmer@farmshift.org"

    token = login_data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify /v1/auth/me
    me_res = client.get("/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "farmer@farmshift.org"
    assert me_data["role"] == "farmer"

    # Verify initial farm-list
    farms_res = client.get("/v1/farms", headers=headers)
    assert farms_res.status_code == 200
    assert isinstance(farms_res.json(), list)


def test_step_3_save_and_edit_farm_roundtrip(client, auth_headers):
    """
    Step 3: Save a new farm and edit it; refresh; verify values round-trip.
    Preserves all normalized fields: name, region_id, area_ha, land_type,
    crops, water, soil, constraints, and boundary_geojson.
    """
    canonical_payload = {
        "name": "Nagpur Agro Bio Park",
        "region_id": "nagpur",
        "area_ha": 3.75,
        "land_type": "Irrigated Vertisol",
        "crops": {
            "kharif": "Cotton",
            "rabi": "Gram (Chickpea)",
            "previous_crop": "Soybean",
            "sowing_season": "Kharif 2026"
        },
        "water": {
            "source": "Borewell",
            "reliability": "High"
        },
        "soil": {
            "texture": "Deep Black Vertisol",
            "test_status": "Tested"
        },
        "constraints": [
            "Heavy clay crusting during early germination",
            "Pink bollworm monitoring needed in late October"
        ],
        "boundary_geojson": {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [79.05, 21.12],
                                [79.06, 21.12],
                                [79.06, 21.13],
                                [79.05, 21.13],
                                [79.05, 21.12]
                            ]
                        ]
                    },
                    "properties": {"name": "Plot A"}
                }
            ]
        }
    }

    # POST /v1/farms
    create_res = client.post("/v1/farms", json=canonical_payload, headers=auth_headers)
    assert create_res.status_code == 201
    created_farm = create_res.json()
    assert "id" in created_farm
    assert created_farm["id"].startswith("farm_")
    farm_id = created_farm["id"]

    # Verify fields round-trip
    assert created_farm["name"] == "Nagpur Agro Bio Park"
    assert created_farm["region_id"] == "nagpur"
    assert created_farm["area_ha"] == 3.75
    assert created_farm["crops"]["kharif"] == "Cotton"
    assert created_farm["water"]["source"] == "Borewell"
    assert created_farm["soil"]["texture"] == "Deep Black Vertisol"
    assert len(created_farm["constraints"]) == 2
    assert created_farm["boundary_geojson"]["type"] == "FeatureCollection"

    # Refresh via GET /v1/farms/{farm_id}
    get_res = client.get(f"/v1/farms/{farm_id}", headers=auth_headers)
    assert get_res.status_code == 200
    refreshed_farm = get_res.json()
    assert refreshed_farm["name"] == "Nagpur Agro Bio Park"

    # Edit via PATCH /v1/farms/{farm_id}
    patch_payload = {
        "name": "Nagpur Agro Bio Park (Updated)",
        "area_ha": 4.25,
        "soil": {
            "texture": "Deep Black Vertisol",
            "test_status": "Tested"
        }
    }
    patch_res = client.patch(f"/v1/farms/{farm_id}", json=patch_payload, headers=auth_headers)
    assert patch_res.status_code == 200
    updated_farm = patch_res.json()
    assert updated_farm["name"] == "Nagpur Agro Bio Park (Updated)"
    assert updated_farm["area_ha"] == 4.25
    # Verify unedited fields were preserved
    assert updated_farm["crops"]["kharif"] == "Cotton"
    assert updated_farm["water"]["source"] == "Borewell"


def test_step_4_climate_series_units_and_sources(client, auth_headers):
    """
    Step 4: Request climate series and check units/period labels/source notes.
    """
    # Create farm to query climate for
    farm_res = client.post("/v1/farms", json={
        "name": "Wardha Test Field",
        "region_id": "wardha",
        "area_ha": 2.5,
        "land_type": "Rainfed",
        "crops": {"kharif": "Soybean", "rabi": "Wheat"},
        "water": {"source": "Rainfed", "reliability": "Medium"},
        "soil": {"texture": "Medium Black", "test_status": "Tested"},
        "constraints": []
    }, headers=auth_headers)
    farm_id = farm_res.json()["id"]

    # GET /v1/farms/{farm_id}/climate/series
    res = client.get(f"/v1/farms/{farm_id}/climate/series", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["farm_id"] == farm_id
    assert data["region_id"] == "wardha"
    assert "IMD" in data["source"]
    assert "spatial_resolution" in data
    assert "quality_status" in data
    assert "units" in data
    assert data["units"]["rainfall"] == "mm"
    assert data["units"]["temperature_max"] == "°C"
    assert len(data["series"]) > 0

    first_point = data["series"][0]
    assert "period" in first_point
    assert "rainfall_mm" in first_point
    assert "rainfall_normal_mm" in first_point
    assert "rainfall_anomaly_pct" in first_point
    assert "temperature_max_c" in first_point
    assert "status" in first_point


def test_step_5_ai_insights_contract(client, auth_headers):
    """
    Step 5: Generate AI insights and verify the UI shows only returned items:
    renders only summary, insights, evidence, actions, limitations, data_quality, generated_at.
    """
    farm_res = client.post("/v1/farms", json={
        "name": "Insights Test Farm",
        "region_id": "nagpur",
        "area_ha": 3.0,
        "land_type": "Irrigated",
        "crops": {"kharif": "Cotton", "rabi": "Gram (Chickpea)", "previous_crop": "Cotton"},
        "water": {"source": "Borewell", "reliability": "High"},
        "soil": {"texture": "Deep Black Vertisol", "test_status": "Untested"},
        "constraints": ["Pink bollworm infestation risk"]
    }, headers=auth_headers)
    farm_id = farm_res.json()["id"]

    req_payload = {
        "region_id": "nagpur",
        "season": "Kharif 2026",
        "questions": ["How do I manage Pink Bollworm in heavy Vertisols?"]
    }
    res = client.post(f"/v1/farms/{farm_id}/ai-insights", json=req_payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    # Verify only canonical handoff fields exist
    expected_keys = {"summary", "insights", "evidence", "actions", "limitations", "data_quality", "generated_at"}
    assert set(data.keys()) == expected_keys

    assert len(data["summary"]) > 20
    assert len(data["insights"]) > 0
    assert len(data["evidence"]) > 0
    assert len(data["actions"]) > 0
    assert len(data["limitations"]) > 0

    # Verify evidence source is verified institutional
    assert any("ICAR" in e["source"] or "PDKV" in e["source"] for e in data["evidence"])

    # Verify missing soil testing card is flagged in limitations/missing_inputs
    assert any("soil" in m.lower() for m in data["data_quality"]["missing_inputs"])
    assert data["data_quality"]["completeness_score"] < 100


def test_step_6_rotations_compare(client, auth_headers):
    """
    Step 6: Compare rotations; inspect benefits, trade-offs, evidence and missing inputs.
    """
    farm_res = client.post("/v1/farms", json={
        "name": "Rotation Test Farm",
        "region_id": "nagpur",
        "area_ha": 2.0,
        "land_type": "Semi-irrigated",
        "crops": {"kharif": "Cotton", "rabi": "Gram"},
        "water": {"source": "Borewell", "reliability": "Medium"},
        "soil": {"texture": "Deep Black Vertisol", "test_status": "Tested"},
        "constraints": []
    }, headers=auth_headers)
    farm_id = farm_res.json()["id"]

    res = client.post(f"/v1/farms/{farm_id}/rotations/compare", json={}, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()

    assert data["farm_id"] == farm_id
    assert len(data["comparison"]) >= 3

    for option in data["comparison"]:
        assert len(option["benefits"]) > 0
        assert len(option["trade_offs"]) > 0
        assert len(option["evidence"]) > 0
        assert isinstance(option["missing_inputs"], list)
        assert option["estimated_margin_inr_ha"] > 0
        assert "water_demand_m3_ha" in option


def test_step_7_reports_generation_and_pdf_download(client, auth_headers):
    """
    Step 7: Generate a report, poll status if queued, and download a valid PDF.
    """
    farm_res = client.post("/v1/farms", json={
        "name": "Report Test Holding",
        "region_id": "nagpur",
        "area_ha": 5.0,
        "land_type": "Irrigated",
        "crops": {"kharif": "Cotton", "rabi": "Wheat"},
        "water": {"source": "Canal", "reliability": "High"},
        "soil": {"texture": "Deep Black Vertisol", "test_status": "Tested"},
        "constraints": ["Drainage required in July"]
    }, headers=auth_headers)
    farm_id = farm_res.json()["id"]

    # Generate report
    gen_res = client.post(f"/v1/farms/{farm_id}/reports", json={
        "title": "Field Advisory & Rotation Assessment Report",
        "report_type": "full_farm_advisory"
    }, headers=auth_headers)
    assert gen_res.status_code == 201
    rep_data = gen_res.json()
    report_id = rep_data["id"]
    assert rep_data["status"] == "completed"
    assert f"/v1/reports/{report_id}/download" in rep_data["download_url"]

    # Poll status via GET /v1/reports/{report_id}
    poll_res = client.get(f"/v1/reports/{report_id}", headers=auth_headers)
    assert poll_res.status_code == 200
    assert poll_res.json()["status"] == "completed"

    # Download valid PDF
    dl_res = client.get(f"/v1/reports/{report_id}/download", headers=auth_headers)
    assert dl_res.status_code == 200
    assert dl_res.headers.get("content-type") == "application/pdf"
    assert dl_res.content.startswith(b"%PDF-")  # Valid PDF binary signature
    assert len(dl_res.content) > 1000


def test_step_8_logout_revokes_token(client):
    """
    Step 8: Verify logout revokes/invalidates server session.
    """
    login_res = client.post("/v1/auth/login", json={
        "email": "farmer@farmshift.org",
        "password": "farmshift123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Verify token works before logout
    check_before = client.get("/v1/auth/me", headers=headers)
    assert check_before.status_code == 200

    # Logout
    logout_res = client.post("/v1/auth/logout", headers=headers)
    assert logout_res.status_code == 200
    assert "revoked" in logout_res.json()["message"].lower()

    # Verify token is now invalid/revoked
    check_after = client.get("/v1/auth/me", headers=headers)
    assert check_after.status_code == 401
    assert "revoked" in check_after.json()["detail"].lower()
