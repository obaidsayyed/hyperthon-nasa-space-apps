import pytest
from app.models.user import User
from app.services.auth_service import hash_password, create_access_token


def test_authenticated_ownership_isolation(client, auth_headers, db):
    """
    Security checklist verification:
    Verify authenticated ownership on every farm, insight, and report endpoint.
    Do not trust farm_id ownership from the browser.
    """
    # Create Farm belonging to User A (the seeded default user)
    farm_res = client.post("/v1/farms", json={
        "name": "User A Private Farm",
        "region_id": "nagpur",
        "area_ha": 2.0,
        "land_type": "Irrigated",
        "crops": {"kharif": "Cotton", "rabi": "Gram"},
        "water": {"source": "Borewell", "reliability": "High"},
        "soil": {"texture": "Black", "test_status": "Tested"},
        "constraints": []
    }, headers=auth_headers)
    user_a_farm_id = farm_res.json()["id"]

    # Create a separate User B in the database
    user_b = User(
        id="usr_attacker_or_separate_user",
        email="other_farmer@farmshift.org",
        name="User B",
        role="farmer",
        hashed_password=hash_password("password123"),
        is_active=True
    )
    db.add(user_b)
    db.commit()

    token_b = create_access_token(data={"sub": user_b.id, "email": user_b.email, "role": user_b.role})
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. User B cannot view User A's farm
    get_res = client.get(f"/v1/farms/{user_a_farm_id}", headers=headers_b)
    assert get_res.status_code == 403

    # 2. User B cannot patch User A's farm
    patch_res = client.patch(f"/v1/farms/{user_a_farm_id}", json={"name": "Hacked Name"}, headers=headers_b)
    assert patch_res.status_code == 403

    # 3. User B cannot trigger AI insights on User A's farm
    insight_res = client.post(f"/v1/farms/{user_a_farm_id}/ai-insights", json={}, headers=headers_b)
    assert insight_res.status_code == 403

    # 4. User B cannot view climate data for User A's farm
    climate_res = client.get(f"/v1/farms/{user_a_farm_id}/climate/series", headers=headers_b)
    assert climate_res.status_code == 403

    # 5. User B cannot generate reports on User A's farm
    rep_res = client.post(f"/v1/farms/{user_a_farm_id}/reports", json={}, headers=headers_b)
    assert rep_res.status_code == 403

    # 6. User B cannot delete User A's farm
    del_res = client.delete(f"/v1/farms/{user_a_farm_id}", headers=headers_b)
    assert del_res.status_code == 403


def test_regions_search_and_detail(client):
    """Test region search and detail endpoints."""
    # Search for 'nagpur'
    res = client.get("/v1/regions/search?q=nagpur")
    assert res.status_code == 200
    results = res.json()
    assert len(results) >= 1
    assert any(r["id"] == "nagpur" for r in results)

    # Search for 'wardha'
    res_w = client.get("/v1/regions/search?q=wardha")
    assert res_w.status_code == 200
    assert any(r["id"] == "wardha" for r in res_w.json())

    # Detail
    res_det = client.get("/v1/regions/nagpur")
    assert res_det.status_code == 200
    assert res_det.json()["name"] == "Nagpur District"


def test_notifications_lifecycle(client, auth_headers):
    """Test notifications list and mark-as-read."""
    list_res = client.get("/v1/notifications", headers=auth_headers)
    assert list_res.status_code == 200
    notifs = list_res.json()
    assert len(notifs) >= 1

    target_id = notifs[0]["id"]
    read_res = client.post(f"/v1/notifications/{target_id}/read", headers=auth_headers)
    assert read_res.status_code == 200
    assert read_res.json()["read"] is True


def test_user_preferences_sync(client, auth_headers):
    """Test getting and updating user preferences."""
    get_res = client.get("/v1/users/me/preferences", headers=auth_headers)
    assert get_res.status_code == 200
    pref = get_res.json()
    assert "theme" in pref

    # Update preference
    update_res = client.patch("/v1/users/me/preferences", json={
        "theme": "dark",
        "language": "mr",
        "sms_alerts": True
    }, headers=auth_headers)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["theme"] == "dark"
    assert updated["language"] == "mr"
    assert updated["sms_alerts"] is True


def test_map_layers_catalog(client):
    """Test map layers metadata catalog."""
    res = client.get("/v1/map/layers")
    assert res.status_code == 200
    layers = res.json()
    assert len(layers) >= 3
    assert any(l["category"] == "soil" for l in layers)
    assert any(l["category"] == "climate" for l in layers)
