import math
from typing import Any, Dict, List, Optional, Tuple
from app.core.errors import ValidationError

EARTH_RADIUS_METERS = 6371000.0  # WGS84 mean radius


def _calculate_ring_area_sq_meters(coordinates: List[List[float]]) -> float:
    """Calculate the spherical excess area of a closed polygon ring on WGS84 earth."""
    if len(coordinates) < 4:
        return 0.0

    total = 0.0
    rad = math.pi / 180.0
    num_points = len(coordinates)

    for i in range(num_points - 1):
        p1 = coordinates[i]
        p2 = coordinates[i + 1]

        lon1 = p1[0] * rad
        lat1 = p1[1] * rad
        lon2 = p2[0] * rad
        lat2 = p2[1] * rad

        d_lon = lon2 - lon1
        # Spherical trapezoidal formula
        total += d_lon * (2.0 + math.sin(lat1) + math.sin(lat2))

    area_sq_meters = abs(total * (EARTH_RADIUS_METERS ** 2) / 2.0)
    return area_sq_meters


def _validate_polygon_ring(ring: List[Any], ring_name: str = "exterior") -> None:
    if not isinstance(ring, list) or len(ring) < 4:
        raise ValidationError(
            "The field boundary is invalid.",
            details=[{"field": "boundary_geojson", "issue": f"{ring_name.capitalize()} ring must have at least 4 coordinate pairs."}],
        )

    for pt in ring:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": "Coordinate must be [longitude, latitude]."}],
            )
        lon, lat = pt[0], pt[1]
        if not (-180.0 <= lon <= 180.0):
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": f"Longitude {lon} is out of bounds [-180, 180]."}],
            )
        if not (-90.0 <= lat <= 90.0):
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": f"Latitude {lat} is out of bounds [-90, 90]."}],
            )

    # Check closed ring
    first_pt = ring[0]
    last_pt = ring[-1]
    if abs(first_pt[0] - last_pt[0]) > 1e-7 or abs(first_pt[1] - last_pt[1]) > 1e-7:
        raise ValidationError(
            "The field boundary is invalid.",
            details=[{"field": "boundary_geojson", "issue": "Polygon ring is not closed."}],
        )


def validate_and_calculate_geojson_area(geojson_data: Optional[Dict[str, Any]]) -> Tuple[Optional[Dict[str, Any]], float]:
    """
    Validates GeoJSON EPSG:4326 polygon or multipolygon.
    Calculates area in hectares.
    Returns normalized FeatureCollection and calculated area in hectares.
    """
    if geojson_data is None:
        return None, 0.0

    if not isinstance(geojson_data, dict):
        raise ValidationError(
            "The field boundary is invalid.",
            details=[{"field": "boundary_geojson", "issue": "GeoJSON must be a JSON object."}],
        )

    geo_type = geojson_data.get("type")
    polygons = []

    if geo_type == "FeatureCollection":
        features = geojson_data.get("features", [])
        if not isinstance(features, list) or len(features) == 0:
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": "FeatureCollection must contain at least one feature."}],
            )
        for feat in features:
            geom = feat.get("geometry", {})
            g_type = geom.get("type")
            coords = geom.get("coordinates", [])
            if g_type == "Polygon":
                polygons.append(coords)
            elif g_type == "MultiPolygon":
                polygons.extend(coords)
            else:
                raise ValidationError(
                    "The field boundary is invalid.",
                    details=[{"field": "boundary_geojson", "issue": f"Unsupported geometry type: {g_type}. Must be Polygon or MultiPolygon."}],
                )

    elif geo_type == "Feature":
        geom = geojson_data.get("geometry", {})
        g_type = geom.get("type")
        coords = geom.get("coordinates", [])
        if g_type == "Polygon":
            polygons.append(coords)
        elif g_type == "MultiPolygon":
            polygons.extend(coords)
        else:
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": f"Unsupported geometry type: {g_type}. Must be Polygon or MultiPolygon."}],
            )

    elif geo_type == "Polygon":
        polygons.append(geojson_data.get("coordinates", []))

    elif geo_type == "MultiPolygon":
        polygons.extend(geojson_data.get("coordinates", []))

    else:
        raise ValidationError(
            "The field boundary is invalid.",
            details=[{"field": "boundary_geojson", "issue": f"Invalid GeoJSON type '{geo_type}'. Expected FeatureCollection, Polygon, or MultiPolygon."}],
        )

    if not polygons:
        raise ValidationError(
            "The field boundary is invalid.",
            details=[{"field": "boundary_geojson", "issue": "No polygon coordinates found."}],
        )

    total_area_sq_meters = 0.0

    for poly in polygons:
        if not isinstance(poly, list) or len(poly) == 0:
            raise ValidationError(
                "The field boundary is invalid.",
                details=[{"field": "boundary_geojson", "issue": "Polygon must contain at least one exterior ring."}],
            )
        # Exterior ring
        exterior_ring = poly[0]
        _validate_polygon_ring(exterior_ring, "exterior")
        poly_area = _calculate_ring_area_sq_meters(exterior_ring)

        # Interior rings (holes)
        for hole_idx, hole in enumerate(poly[1:], start=1):
            _validate_polygon_ring(hole, f"interior hole {hole_idx}")
            hole_area = _calculate_ring_area_sq_meters(hole)
            poly_area -= hole_area

        total_area_sq_meters += max(0.0, poly_area)

    # 1 hectare = 10,000 square meters
    area_ha = round(total_area_sq_meters / 10000.0, 3)

    # Ensure standardized FeatureCollection representation
    if geo_type != "FeatureCollection":
        normalized = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"calculated_area_ha": area_ha},
                    "geometry": (
                        {"type": "Polygon", "coordinates": polygons[0]}
                        if len(polygons) == 1
                        else {"type": "MultiPolygon", "coordinates": polygons}
                    ),
                }
            ],
        }
    else:
        normalized = geojson_data

    return normalized, area_ha
