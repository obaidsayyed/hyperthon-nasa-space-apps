import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap, type MapMouseEvent, type StyleSpecification } from 'maplibre-gl'
import { Layers3, LocateFixed, Maximize2, Sun, Check, MapPin, X, Mountain, Satellite, Map as MapIcon } from 'lucide-react'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { REGIONS, type RegionName } from '../lib/regions'

type BasemapMode = 'satellite' | 'streets' | 'light'

const LIBERTY_STYLE = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty'
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'farmshift-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Imagery tiles © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: 'farmshift-satellite', type: 'raster', source: 'farmshift-satellite', minzoom: 0, maxzoom: 19 }],
}

// This is the same TileJSON DEM endpoint used in MapLibre's maintained 3D-terrain example.
// Terrain is real elevation geometry; it is not ground-level 360° Street View.
const TERRAIN_SOURCE_ID = 'farmshift-terrain-dem'
const HILLSHADE_SOURCE_ID = 'farmshift-hillshade-dem'
const TERRAIN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json'
const TERRAIN_ATTRIBUTION = 'Elevation tiles © Mapterhorn / Mapzen data contributors'

type FarmField = {
  id: string
  layerId: string
  name: string
  crop: string
  areaHa: number
  color: string
  coordinates: [number, number][]
}

// These are deliberately illustrative polygons near each target region, not verified farm parcels.
const FIELDS_BY_REGION: Record<RegionName, FarmField[]> = {
  Nagpur: [
    { id: 'FS-DEMO-01', layerId: 'farmshift-field-01', name: 'Sample field 01', crop: 'Soybean (sample)', areaHa: 2.4, color: '#68df9a', coordinates: [[79.048, 21.163], [79.055, 21.165], [79.057, 21.159], [79.050, 21.157], [79.048, 21.163]] },
    { id: 'FS-DEMO-02', layerId: 'farmshift-field-02', name: 'Sample field 02', crop: 'Cotton (sample)', areaHa: 1.8, color: '#e7c16b', coordinates: [[79.112, 21.172], [79.119, 21.174], [79.121, 21.168], [79.114, 21.166], [79.112, 21.172]] },
    { id: 'FS-DEMO-03', layerId: 'farmshift-field-03', name: 'Sample field 03', crop: 'Pigeon pea (sample)', areaHa: 3.1, color: '#7fcbea', coordinates: [[79.073, 21.119], [79.080, 21.120], [79.082, 21.114], [79.075, 21.113], [79.073, 21.119]] },
  ],
  Wardha: [
    { id: 'FS-DEMO-01', layerId: 'farmshift-field-01', name: 'Sample field 01', crop: 'Soybean (sample)', areaHa: 2.4, color: '#68df9a', coordinates: [[78.566, 20.760], [78.573, 20.762], [78.575, 20.756], [78.568, 20.754], [78.566, 20.760]] },
    { id: 'FS-DEMO-02', layerId: 'farmshift-field-02', name: 'Sample field 02', crop: 'Cotton (sample)', areaHa: 1.8, color: '#e7c16b', coordinates: [[78.630, 20.770], [78.637, 20.772], [78.639, 20.766], [78.632, 20.764], [78.630, 20.770]] },
    { id: 'FS-DEMO-03', layerId: 'farmshift-field-03', name: 'Sample field 03', crop: 'Pigeon pea (sample)', areaHa: 3.1, color: '#7fcbea', coordinates: [[78.584, 20.711], [78.591, 20.712], [78.593, 20.706], [78.586, 20.705], [78.584, 20.711]] },
  ],
}

function asFeatureCollection(field: FarmField, region: RegionName): FeatureCollection {
  const feature: Feature<Polygon> = {
    type: 'Feature',
    id: field.id,
    properties: {
      farmshiftId: field.id,
      farmshiftRegion: region,
      farmshiftDemo: true,
      name: field.name,
      crop: field.crop,
      areaHa: field.areaHa,
    },
    geometry: { type: 'Polygon', coordinates: [field.coordinates] },
  }
  return { type: 'FeatureCollection', features: [feature] }
}

function normalizedImportedCollection(collection: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature, index) => ({
      ...feature,
      properties: {
        ...(feature.properties ?? {}),
        farmshiftId: String(feature.properties?.farmshiftId ?? feature.id ?? `IMPORTED-${index + 1}`),
        farmshiftImported: true,
        name: String(feature.properties?.name ?? `Imported field ${index + 1}`),
        crop: String(feature.properties?.crop ?? 'Crop not supplied'),
        areaHa: Number(feature.properties?.areaHa ?? feature.properties?.area_ha ?? 0),
      },
    })),
  } as FeatureCollection
}

function setGeoJsonSource(map: MapLibreMap, sourceId: string, data: FeatureCollection) {
  const existing = map.getSource(sourceId) as GeoJSONSource | undefined
  if (existing && typeof existing.setData === 'function') {
    existing.setData(data)
    return
  }
  if (!existing) map.addSource(sourceId, { type: 'geojson', data })
}

/**
 * Render the field data through MapLibre's public style/source API.
 * This avoids mixing private MapLibre internals across GeoLibre's and the app's
 * dependency trees, which caused a runtime `transform` getter crash in the
 * browser. Layer and source IDs remain namespaced to FarmShift.
 */
function syncFarmLayers(
  map: MapLibreMap,
  region: RegionName,
  selectedId: string | null,
  fieldsVisible: boolean,
  importedGeoJson: FeatureCollection | null | undefined,
) {
  const regionPrefix = region.toLowerCase()
  const fields = FIELDS_BY_REGION[region]
  const desiredLayers = new Set<string>()
  const desiredSources = new Set<string>()
  const firstSymbolLayer = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id

  const upsertFillLine = (args: {
    sourceId: string
    fillId: string
    lineId: string
    fillColor: string
    lineColor: string
    fillOpacity: number
    lineWidth: number
    visible: boolean
  }) => {
    const { sourceId, fillId, lineId, fillColor, lineColor, fillOpacity, lineWidth, visible } = args
    desiredSources.add(sourceId)
    desiredLayers.add(fillId)
    desiredLayers.add(lineId)
    if (!map.getLayer(fillId)) {
      map.addLayer({
        id: fillId, type: 'fill', source: sourceId,
        paint: { 'fill-color': fillColor, 'fill-opacity': fillOpacity },
        layout: { visibility: visible ? 'visible' : 'none' },
      }, firstSymbolLayer)
    } else {
      map.setPaintProperty(fillId, 'fill-color', fillColor)
      map.setPaintProperty(fillId, 'fill-opacity', fillOpacity)
      map.setLayoutProperty(fillId, 'visibility', visible ? 'visible' : 'none')
    }
    if (!map.getLayer(lineId)) {
      map.addLayer({
        id: lineId, type: 'line', source: sourceId,
        paint: { 'line-color': lineColor, 'line-width': lineWidth },
        layout: { visibility: visible ? 'visible' : 'none' },
      }, firstSymbolLayer)
    } else {
      map.setPaintProperty(lineId, 'line-color', lineColor)
      map.setPaintProperty(lineId, 'line-width', lineWidth)
      map.setLayoutProperty(lineId, 'visibility', visible ? 'visible' : 'none')
    }
  }

  for (const field of fields) {
    const layerBase = `farmshift-field-${regionPrefix}-${field.layerId.replace('farmshift-field-', '')}`
    const sourceId = `${layerBase}-source`
    const fillId = `${layerBase}-fill`
    const lineId = `${layerBase}-line`
    const isSelected = field.id === selectedId
    setGeoJsonSource(map, sourceId, asFeatureCollection(field, region))
    upsertFillLine({
      sourceId, fillId, lineId,
      fillColor: isSelected ? '#a8ffd0' : field.color,
      lineColor: isSelected ? '#ffffff' : field.color,
      fillOpacity: isSelected ? 0.48 : 0.28,
      lineWidth: isSelected ? 3 : 2,
      visible: fieldsVisible,
    })
  }

  if (importedGeoJson) {
    const sourceId = 'farmshift-imported-boundary-source'
    const fillId = 'farmshift-imported-boundary-fill'
    const lineId = 'farmshift-imported-boundary-line'
    setGeoJsonSource(map, sourceId, normalizedImportedCollection(importedGeoJson))
    upsertFillLine({
      sourceId, fillId, lineId,
      fillColor: '#4de5a0', lineColor: '#f8fff9',
      fillOpacity: 0.18, lineWidth: 3, visible: fieldsVisible,
    })
  }

  // Remove overlays left behind after switching region or clearing imported data.
  const styles = map.getStyle()
  for (const layer of [...(styles.layers ?? [])]) {
    const isFarmLayer = layer.id.startsWith('farmshift-field-') || layer.id.startsWith('farmshift-imported-boundary-')
    if (isFarmLayer && !desiredLayers.has(layer.id)) map.removeLayer(layer.id)
  }
  const sources = Object.keys(styles.sources ?? {})
  for (const sourceId of sources) {
    const isFarmSource = sourceId.startsWith('farmshift-field-') || sourceId.startsWith('farmshift-imported-boundary-')
    if (isFarmSource && !desiredSources.has(sourceId) && !map.getStyle().layers?.some((layer) => 'source' in layer && layer.source === sourceId)) {
      map.removeSource(sourceId)
    }
  }
}

type BuildingStyleLayer = {
  id: string
  type: string
  source?: string
  'source-layer'?: string
}

function apply3DBuildings(map: MapLibreMap) {
  try {
    if (map.getLayer('farmshift-3d-buildings')) return
    // MapLibre's LayerSpecification is a discriminated union. Narrow the style
    // layer to the vector-source fields we need instead of indexing the union.
    const layers = (map.getStyle().layers ?? []) as unknown as BuildingStyleLayer[]
    const buildingLayer = layers.find((layer) => {
      const sourceLayer = layer['source-layer']
      return typeof sourceLayer === 'string' &&
        sourceLayer.toLowerCase().includes('building') &&
        typeof layer.source === 'string'
    })
    if (!buildingLayer) return
    const buildingSource = buildingLayer.source
    const buildingSourceLayer = buildingLayer['source-layer']
    if (typeof buildingSource !== 'string' || typeof buildingSourceLayer !== 'string') return
    const firstSymbol = layers.find((layer) => layer.type === 'symbol')?.id
    map.addLayer({
      id: 'farmshift-3d-buildings',
      type: 'fill-extrusion',
      source: buildingSource,
      'source-layer': buildingSourceLayer,
      minzoom: 13,
      paint: {
        'fill-extrusion-color': '#bdc9bd',
        'fill-extrusion-height': ['max', 2, ['coalesce', ['to-number', ['get', 'render_height']], ['to-number', ['get', 'height']], 7]],
        'fill-extrusion-base': ['max', 0, ['coalesce', ['to-number', ['get', 'render_min_height']], ['to-number', ['get', 'min_height']], 0]],
        'fill-extrusion-opacity': 0.78,
        'fill-extrusion-vertical-gradient': true,
      },
    }, firstSymbol)
  } catch (error) {
    // Some hosted street styles do not expose building-height attributes. Roads and labels still work.
    console.info('FarmShift: 3D buildings unavailable in this basemap style.', error)
  }
}

function applyTerrain(map: MapLibreMap, enabled: boolean) {
  try {
    if (!enabled) {
      map.setTerrain(null)
      if (map.getLayer('farmshift-hillshade')) map.setLayoutProperty('farmshift-hillshade', 'visibility', 'none')
      map.easeTo({ pitch: 0, duration: 420 })
      return
    }
    // TileJSON declares the DEM tile template and encoding; don't guess an XYZ template.
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, { type: 'raster-dem', url: TERRAIN_TILEJSON, attribution: TERRAIN_ATTRIBUTION })
    }
    if (!map.getSource(HILLSHADE_SOURCE_ID)) {
      map.addSource(HILLSHADE_SOURCE_ID, { type: 'raster-dem', url: TERRAIN_TILEJSON, attribution: TERRAIN_ATTRIBUTION })
    }
    if (!map.getLayer('farmshift-hillshade')) {
      const firstSymbolLayer = map.getStyle().layers?.find((layer) => layer.type === 'symbol')?.id
      map.addLayer({
        id: 'farmshift-hillshade', type: 'hillshade', source: HILLSHADE_SOURCE_ID,
        paint: { 'hillshade-shadow-color': '#425447', 'hillshade-highlight-color': '#fff7e8', 'hillshade-exaggeration': 0.24 },
      }, firstSymbolLayer)
    } else {
      map.setLayoutProperty('farmshift-hillshade', 'visibility', 'visible')
    }
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.08 })
    map.easeTo({ pitch: 62, duration: 620 })
  } catch (error) {
    console.warn('FarmShift terrain could not be activated; check the DEM service and browser network access.', error)
  }
}

export interface MapPanelProps {
  region?: RegionName
  onRegionChange?: (region: RegionName) => void
  /** Start the main analysis map with actual DEM terrain enabled. */
  initialTerrain?: boolean
  basemapPreference?: BasemapMode
  onBasemapChange?: (mode: BasemapMode) => void
  terrainPreference?: boolean
  onTerrainChange?: (enabled: boolean) => void
  boundariesPreference?: boolean
  onBoundariesChange?: (visible: boolean) => void
  /** Locally imported polygon boundaries. Never presented as backend-verified parcels. */
  importedGeoJson?: FeatureCollection | null
}

export default function MapPanel({
  region = 'Nagpur', onRegionChange, initialTerrain = false,
  basemapPreference, onBasemapChange, terrainPreference, onTerrainChange,
  boundariesPreference, onBoundariesChange, importedGeoJson,
}: MapPanelProps) {

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const importedGeoJsonRef = useRef(importedGeoJson)
  const regionRef = useRef(region)
  const baseStyleRef = useRef<BasemapMode>('satellite')
  const terrainEnabledRef = useRef(terrainPreference ?? initialTerrain)
  const fieldsVisibleRef = useRef(boundariesPreference ?? true)
  const selectedIdRef = useRef<string | null>(null)
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)
  const [mapError, setMapError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fieldsVisible, setFieldsVisible] = useState(boundariesPreference ?? true)
  const [baseStyle, setBaseStyle] = useState<BasemapMode>(basemapPreference ?? 'satellite')
  const [terrainEnabled, setTerrainEnabled] = useState(terrainPreference ?? initialTerrain)

  importedGeoJsonRef.current = importedGeoJson
  regionRef.current = region
  baseStyleRef.current = baseStyle
  terrainEnabledRef.current = terrainEnabled
  fieldsVisibleRef.current = fieldsVisible
  selectedIdRef.current = selectedId

  const selectedField = useMemo(() => FIELDS_BY_REGION[region].find((field) => field.id === selectedId) ?? null, [region, selectedId])

  const styleFor = useCallback((mode: BasemapMode) => mode === 'satellite' ? SATELLITE_STYLE : mode === 'light' ? LIGHT_STYLE : LIBERTY_STYLE, [])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || mapRef.current) return
    let disposed = false
    const initial = REGIONS[regionRef.current]
    let map: MapLibreMap
    try {
      map = new maplibregl.Map({
        container,
        style: styleFor(baseStyleRef.current),
        center: initial.coordinates,
        zoom: 11.2,
        pitch: (terrainPreference ?? initialTerrain) ? 58 : 0,
        bearing: 0,
        maxPitch: 75,
        attributionControl: false,
        cooperativeGestures: true,
      })
    } catch (error) {
      console.error('FarmShift could not initialize the map renderer:', error)
      setMapError(error instanceof Error ? error.message : 'The map renderer could not be initialized.')
      setReady(false)
      return
    }
    mapRef.current = map
    const handleWebGLContextLost = () => {
      if (disposed) return
      setReady(false)
      readyRef.current = false
      setMapError('The browser graphics context was lost. Retry the map or close other GPU-heavy tabs.')
    }
    map.getCanvas().addEventListener('webglcontextlost', handleWebGLContextLost)
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    const syncFields = () => {
      if (disposed) return
      try {
        if (terrainEnabledRef.current) applyTerrain(map, true)
        if (baseStyleRef.current === 'streets') apply3DBuildings(map)
        syncFarmLayers(map, regionRef.current, selectedIdRef.current, fieldsVisibleRef.current, importedGeoJsonRef.current)
        setMapError('')
        readyRef.current = true
        setReady(true)
      } catch (error) {
        console.error('FarmShift field overlay setup failed:', error)
        setMapError('The basemap opened, but field overlays could not be added. Try switching the basemap or reloading the map.')
      }
    }
    map.on('style.load', syncFields)
    map.on('error', (event) => {
      if (!readyRef.current) {
        const message = event.error instanceof Error ? event.error.message : 'Basemap style or tiles could not be loaded.'
        setMapError(message)
      }
    })

    const findFieldAtPoint = (event: MapMouseEvent): FarmField | null => {
      const hit = map.queryRenderedFeatures(event.point).find((feature) => typeof feature.properties?.farmshiftId === 'string')
      if (!hit) return null
      const id = String(hit.properties?.farmshiftId)
      const sampleField = FIELDS_BY_REGION[regionRef.current].find((candidate) => candidate.id === id)
      if (sampleField) return sampleField
      const imported = importedGeoJsonRef.current?.features.find((feature, index) => String(feature.properties?.farmshiftId ?? feature.id ?? `IMPORTED-${index + 1}`) === id)
      if (!imported) return null
      const properties = imported.properties ?? {}
      return {
        id,
        layerId: 'farmshift-imported-boundary',
        name: String(properties.name ?? 'Imported parcel'),
        crop: String(properties.crop ?? 'Crop not supplied'),
        areaHa: Number(properties.areaHa ?? properties.area_ha ?? 0),
        color: '#4de5a0',
        coordinates: [],
      }
    }
    map.on('click', (event: MapMouseEvent) => {
      const field = findFieldAtPoint(event)
      if (!field) return
      setSelectedId(field.id)
      map.getCanvas().style.cursor = 'pointer'
      window.dispatchEvent(new CustomEvent('farmshift:field-selected', {
        detail: { region: regionRef.current, farmId: field.id, name: field.name, crop: field.crop, areaHa: field.areaHa, demo: field.layerId !== 'farmshift-imported-boundary' },
      }))
    })
    map.on('mousemove', (event: MapMouseEvent) => {
      map.getCanvas().style.cursor = findFieldAtPoint(event) ? 'pointer' : ''
    })

    return () => {
      disposed = true
      map.off('style.load', syncFields)
      map.getCanvas().removeEventListener('webglcontextlost', handleWebGLContextLost)
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
  }, [styleFor, retryNonce])

  useEffect(() => {
    if (!basemapPreference || basemapPreference === baseStyleRef.current) return
    baseStyleRef.current = basemapPreference
    setBaseStyle(basemapPreference)
    const map = mapRef.current
    if (map) map.setStyle(styleFor(basemapPreference))
  }, [basemapPreference, styleFor])

  useEffect(() => {
    if (terrainPreference === undefined || terrainPreference === terrainEnabledRef.current) return
    terrainEnabledRef.current = terrainPreference
    setTerrainEnabled(terrainPreference)
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyTerrain(map, terrainPreference)
  }, [terrainPreference])

  useEffect(() => {
    if (boundariesPreference === undefined || boundariesPreference === fieldsVisibleRef.current) return
    fieldsVisibleRef.current = boundariesPreference
    setFieldsVisible(boundariesPreference)
  }, [boundariesPreference])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !map.isStyleLoaded()) return
    try {
      syncFarmLayers(map, region, selectedId, fieldsVisible, importedGeoJson)
    } catch (error) {
      console.error('Could not update FarmShift map layers:', error)
      setMapError('Could not update field overlays. Try reloading the map.')
    }
  }, [ready, region, selectedId, fieldsVisible, importedGeoJson])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({ center: REGIONS[region].coordinates, zoom: 11.2, pitch: terrainEnabled ? 62 : 0, bearing: 0, duration: 850 })
  }, [region, terrainEnabled])

  const focusRegion = () => mapRef.current?.flyTo({ center: REGIONS[regionRef.current].coordinates, zoom: 11.2, pitch: terrainEnabledRef.current ? 62 : 0, bearing: 0, duration: 850 })
  const chooseBasemap = (mode: BasemapMode) => {
    if (!mapRef.current || mode === baseStyleRef.current) return
    baseStyleRef.current = mode
    setBaseStyle(mode)
    mapRef.current.setStyle(styleFor(mode))
    onBasemapChange?.(mode)
  }
  const toggleTerrain = () => {
    const next = !terrainEnabledRef.current
    terrainEnabledRef.current = next
    setTerrainEnabled(next)
    onTerrainChange?.(next)
    const map = mapRef.current
    if (map?.isStyleLoaded()) applyTerrain(map, next)
  }
  const toggleBoundaries = () => {
    const next = !fieldsVisibleRef.current
    fieldsVisibleRef.current = next
    setFieldsVisible(next)
    onBoundariesChange?.(next)
  }
  const toggleFullscreen = () => {
    const wrapper = mapContainerRef.current?.closest('.map-wrap') as HTMLElement | null
    if (!wrapper) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void wrapper.requestFullscreen()
  }

  return <div className={`map-wrap farmshift-map-wrap ${terrainEnabled ? 'terrain-on' : ''}`}>
    <div ref={mapContainerRef} className="map-visual farmshift-map-canvas" aria-label={`Interactive ${baseStyle} map around ${REGIONS[region].label}`} />
    <div className="map-controls-glass">
      <div className="map-region-switcher" role="group" aria-label="Select target region">
        {(['Nagpur', 'Wardha'] as RegionName[]).map((option) => <button key={option} onClick={() => onRegionChange?.(option)} className={region === option ? 'active' : ''}>{option}</button>)}
      </div>
      <div className="map-basemap-switcher" role="group" aria-label="Map style">
        <button className={baseStyle === 'satellite' ? 'active' : ''} onClick={() => chooseBasemap('satellite')} title="Satellite imagery"><Satellite size={13}/>Satellite</button>
        <button className={baseStyle === 'streets' ? 'active' : ''} onClick={() => chooseBasemap('streets')} title="Street map"><MapIcon size={13}/>Streets</button>
        <button className={baseStyle === 'light' ? 'active' : ''} onClick={() => chooseBasemap('light')} title="Light map"><Sun size={13}/>Light</button>
      </div>
    </div>
    <div className="map-toolbar farmshift-map-toolbar" role="group" aria-label="Map tools">
      <button onClick={focusRegion} aria-label={`Focus ${region}`} title={`Focus ${region}`}><LocateFixed size={16}/></button>
      <button onClick={toggleBoundaries} aria-label={fieldsVisible ? 'Hide field outlines' : 'Show field outlines'} title={fieldsVisible ? 'Hide field outlines' : 'Show field outlines'} className={fieldsVisible ? 'map-tool-active' : ''}><Layers3 size={16}/></button>
      <button onClick={toggleTerrain} aria-label={terrainEnabled ? 'Disable 3D terrain' : 'Enable 3D terrain'} title={terrainEnabled ? 'Disable 3D terrain' : 'Enable 3D terrain'} className={terrainEnabled ? 'map-tool-active terrain-control' : 'terrain-control'}><Mountain size={16}/><span>3D</span></button>
      <button onClick={toggleFullscreen} aria-label="Toggle map fullscreen" title="Toggle fullscreen"><Maximize2 size={16}/></button>
    </div>
    {!ready && <div className="farmshift-map-loading" role="status">
      <MapPin size={19}/><strong>{mapError ? 'Map is unavailable' : 'Loading regional map'}</strong>
      <span>{mapError || 'Connecting to regional satellite and street tiles…'}</span>
      {mapError && <button onClick={() => { setMapError(''); setReady(false); readyRef.current = false; setRetryNonce((value) => value + 1) }}>Retry map</button>}
    </div>}
    <div className="map-label farmshift-map-label"><span className="pulse-dot"/> {REGIONS[region].label}</div>
    <div className="farmshift-map-disclaimer">Sample boundaries only · not verified farm parcels</div>
    {selectedField && <div className="farmshift-field-card">
      <button className="farmshift-field-close" onClick={() => setSelectedId(null)} aria-label="Close selected field"><X size={14}/></button>
      <span className="farmshift-field-eyebrow"><Check size={12}/> SELECTED SAMPLE FIELD</span>
      <strong>{selectedField.name}</strong><span>{selectedField.crop}</span><small>{selectedField.areaHa.toFixed(1)} ha · demo geometry</small>
    </div>}
  </div>
}
