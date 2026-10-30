from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database import Base, engine, SessionLocal
from app.models import (
    User,
    UserPreference,
    Farm,
    Region,
    MapLayer,
    Notification,
)
from app.core.security import hash_password


def seed_database():
    """Initializes tables and seeds baseline reference regions, map layers, and a demo user."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Regions
        regions_data = [
            {
                "id": "nagpur",
                "name": "Nagpur District",
                "state": "Maharashtra",
                "district": "Nagpur",
                "latitude": 21.1458,
                "longitude": 79.0882,
                "bounds": {"north": 21.75, "south": 20.55, "east": 79.70, "west": 78.40},
                "agro_climatic_zone": "Western Plateau and Hills (Vidarbha Agro-Ecological Subzone)",
                "soil_types": ["Deep Black Clay (Vertisols)", "Clay Loam"],
                "annual_rainfall_mm": 1092.0,
            },
            {
                "id": "wardha",
                "name": "Wardha District",
                "state": "Maharashtra",
                "district": "Wardha",
                "latitude": 20.7453,
                "longitude": 78.6022,
                "bounds": {"north": 21.35, "south": 20.30, "east": 79.15, "west": 78.20},
                "agro_climatic_zone": "Central Vidarbha Semi-Arid Agro-Climatic Zone",
                "soil_types": ["Medium Black Soils", "Shallow Loamy Skeletal"],
                "annual_rainfall_mm": 1044.0,
            },
            {
                "id": "amravati",
                "name": "Amravati District",
                "state": "Maharashtra",
                "district": "Amravati",
                "latitude": 20.9320,
                "longitude": 77.7523,
                "bounds": {"north": 21.70, "south": 20.40, "east": 78.30, "west": 76.80},
                "agro_climatic_zone": "Purna Valley Sodic / Vertic Agro-Climatic Zone",
                "soil_types": ["Deep Vertisols", "Sodic Inceptisols"],
                "annual_rainfall_mm": 980.0,
            },
        ]

        for r_item in regions_data:
            existing_reg = db.query(Region).filter(Region.id == r_item["id"]).first()
            if not existing_reg:
                db.add(Region(**r_item))

        # 2. Map Layers (No secrets exposed)
        layers_data = [
            {
                "id": "satellite",
                "name": "Sentinel-2 Cloudless RGB",
                "type": "raster",
                "url": "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
                "attribution": "Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH",
                "enabled": True,
                "layer_metadata": {"max_zoom": 16, "format": "jpg"},
            },
            {
                "id": "osm",
                "name": "OpenStreetMap Standard",
                "type": "raster",
                "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                "attribution": "© OpenStreetMap contributors",
                "enabled": True,
                "layer_metadata": {"max_zoom": 19, "format": "png"},
            },
            {
                "id": "terrain",
                "name": "SRTM Digital Elevation Relief",
                "type": "terrain",
                "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
                "attribution": "USGS, NASA, Esri",
                "enabled": True,
                "layer_metadata": {"max_zoom": 13, "elevation_source": "SRTM"},
            },
        ]

        for l_item in layers_data:
            existing_l = db.query(MapLayer).filter(MapLayer.id == l_item["id"]).first()
            if not existing_l:
                db.add(MapLayer(**l_item))

        # 3. Demo User (farmer@farmshift.org / Password123!)
        demo_email = "farmer@farmshift.org"
        demo_user = db.query(User).filter(User.email == demo_email).first()
        if not demo_user:
            demo_user = User(
                email=demo_email,
                name="Ramesh Patil",
                hashed_password=hash_password("Password123!"),
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

            # User Preferences
            pref = UserPreference(
                user_id=demo_user.id,
                language="en",
                area_unit="ha",
                rainfall_unit="mm",
                temperature_unit="celsius",
                appearance="system",
                map_basemap="satellite",
                map_terrain=True,
                map_boundaries=True,
                reduce_motion=False,
            )
            db.add(pref)

            # Notifications
            notif1 = Notification(
                user_id=demo_user.id,
                title="Welcome to FarmShift",
                message="Your account is connected to the backend engine with local meteorological models.",
                level="info",
            )
            notif2 = Notification(
                user_id=demo_user.id,
                title="Rabi Season Planning Window Open",
                message="Check seasonal water reserve and run crop rotation comparison before winter sowing.",
                level="warning",
            )
            db.add_all([notif1, notif2])

            # Demo Farm (Canonical payload from API-CONTRACT.md)
            demo_farm = Farm(
                user_id=demo_user.id,
                name="Farm Field 01",
                region_id="nagpur",
                region_label="Nagpur District",
                area_ha=2.5,
                land_type="Agricultural field",
                crops={
                    "kharif": "Soybean",
                    "rabi": "Chickpea",
                    "previous_crop": "Soybean",
                    "sowing_season": "Kharif",
                },
                water={"source": "Borewell", "reliability": "Seasonal"},
                soil={"texture": "Black / clay loam", "test_status": "Not entered"},
                constraints=["Low irrigation availability", "Minimize input cost"],
                boundary_geojson=None,
            )
            db.add(demo_farm)

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
    print("Database initialized and seeded successfully.")
