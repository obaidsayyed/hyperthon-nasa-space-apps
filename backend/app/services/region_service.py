from typing import List, Optional
from app.schemas.region import RegionResponse
from app.schemas.map_layer import MapLayerResponse

REGIONS_DATA = [
    RegionResponse(
        id="nagpur",
        name="Nagpur District",
        state="Maharashtra",
        agro_climatic_zone="Central Plateau and Hills - Eastern Vidarbha Zone",
        soil_types=["Deep Black Soils (Vertisols)", "Medium Black Soils", "Clay Loam"],
        major_crops=["Cotton", "Soybean", "Nagpur Mandarin (Orange)", "Pigeonpea (Tur)", "Wheat", "Gram"],
        center_lat=21.1458,
        center_lon=79.0882,
        average_annual_rainfall_mm=1064.0
    ),
    RegionResponse(
        id="wardha",
        name="Wardha District",
        state="Maharashtra",
        agro_climatic_zone="Central Plateau and Hills - Wardha Basin Zone",
        soil_types=["Medium to Deep Black Vertisols", "Shallow Loamy Soils"],
        major_crops=["Cotton", "Soybean", "Gram (Chickpea)", "Pigeonpea", "Sorghum (Jowar)"],
        center_lat=20.7453,
        center_lon=78.6022,
        average_annual_rainfall_mm=998.0
    ),
    RegionResponse(
        id="amravati",
        name="Amravati District",
        state="Maharashtra",
        agro_climatic_zone="Western Vidarbha Zone",
        soil_types=["Black Cotton Soil", "Laterite Soils"],
        major_crops=["Cotton", "Soybean", "Jowar", "Pulses"],
        center_lat=20.9320,
        center_lon=77.7523,
        average_annual_rainfall_mm=877.0
    ),
    RegionResponse(
        id="chandrapur",
        name="Chandrapur District",
        state="Maharashtra",
        agro_climatic_zone="Eastern Vidarbha Zone",
        soil_types=["Red & Yellow Soils", "Mixed Black Clay"],
        major_crops=["Paddy (Rice)", "Soybean", "Cotton", "Pulses"],
        center_lat=19.9615,
        center_lon=79.2961,
        average_annual_rainfall_mm=1240.0
    ),
    RegionResponse(
        id="yavatmal",
        name="Yavatmal District",
        state="Maharashtra",
        agro_climatic_zone="South-Central Vidarbha Zone",
        soil_types=["Deep Black Cotton Soil"],
        major_crops=["Cotton", "Soybean", "Pigeonpea", "Gram"],
        center_lat=20.3888,
        center_lon=78.1204,
        average_annual_rainfall_mm=911.0
    )
]

MAP_LAYERS_DATA = [
    MapLayerResponse(
        id="soil_texture_vertisols",
        name="Vidarbha Soil Texture & Classification (ICAR-NBSS&LUP)",
        category="soil",
        description="High-resolution soil taxonomy mapping distinguishing Deep Vertisols, Medium Black, and Inceptisols.",
        crs="EPSG:4326",
        url_template="https://tiles.farmshift.org/layers/soil_texture/{z}/{x}/{y}.png",
        opacity=0.75,
        attribution="ICAR - National Bureau of Soil Survey & Land Use Planning (NBSS&LUP), Nagpur"
    ),
    MapLayerResponse(
        id="imd_monsoon_anomaly",
        name="Monsoon Rainfall Anomaly Contours (IMD Gridded 0.25°)",
        category="climate",
        description="Gridded seasonal precipitation departure percentage compared against 30-year normal baselines.",
        crs="EPSG:4326",
        url_template="https://tiles.farmshift.org/layers/imd_precip_anomaly/{z}/{x}/{y}.png",
        opacity=0.70,
        attribution="India Meteorological Department (IMD) Gridded Climatology"
    ),
    MapLayerResponse(
        id="groundwater_stress_cgwb",
        name="Groundwater Extraction & Aquifer Stress (CGWB)",
        category="water",
        description="Dynamic groundwater assessment indicating safe, semi-critical, and critical recharge zones across talukas.",
        crs="EPSG:4326",
        url_template="https://tiles.farmshift.org/layers/cgwb_groundwater/{z}/{x}/{y}.png",
        opacity=0.65,
        attribution="Central Ground Water Board (CGWB) Ministry of Jal Shakti"
    ),
    MapLayerResponse(
        id="administrative_boundaries",
        name="District & Taluka Cadastral Boundaries",
        category="boundaries",
        description="Standard administrative boundary vectors for Nagpur, Wardha, and neighboring Vidarbha districts in EPSG:4326.",
        crs="EPSG:4326",
        url_template=None,
        opacity=1.0,
        attribution="Survey of India / Maharashtra Remote Sensing Applications Centre (MRSAC)"
    )
]


def search_regions(query: Optional[str] = None) -> List[RegionResponse]:
    """Search regions by name, district, or agro-climatic zone."""
    if not query or not query.strip():
        return REGIONS_DATA
    q = query.strip().lower()
    return [
        r for r in REGIONS_DATA
        if q in r.name.lower() or q in r.id.lower() or q in r.agro_climatic_zone.lower()
    ]


def get_region_by_id(region_id: str) -> Optional[RegionResponse]:
    """Retrieve region by canonical id (e.g. nagpur, wardha)."""
    r_id = region_id.strip().lower()
    for r in REGIONS_DATA:
        if r.id == r_id:
            return r
    return None


def get_map_layers() -> List[MapLayerResponse]:
    """Retrieve metadata for available environmental and cadastral map layers."""
    return MAP_LAYERS_DATA
