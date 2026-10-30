import { useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import type { ChangeEvent, ReactNode, SetStateAction } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Bell, Check, CheckCircle2,
  ChevronDown, CloudRain, Download, Droplets, FileText, Globe2, Home, Leaf,
  Layers3, MapPin, MapPinned, Menu, Moon, Plus, Search, Settings,
  SlidersHorizontal, Sprout, Sun, Thermometer, Wheat, X, Printer, Satellite,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import LandingPage, { type QuickFarmDraft } from './components/LandingPage'
import MapPanel from './components/MapPanel'
import ProfileAuthDialog, { type FarmShiftSession } from './components/ProfileAuthDialog'
import { translations, type Language } from './lib/i18n'
import { REGIONS, type RegionName } from './lib/regions'
import { API_BASE_URL, API_ROUTES, backendApiEnabled, farmApi, type AiInsightsResponse, type ClimateMetricId, type ClimateSeriesResponse, type FarmDto, type FarmPayload, type NotificationDto, type ReportDto, type RegionId, type RotationComparisonResponse } from './lib/api'

type Section = 'Home' | 'Explore Earth' | 'Map & Analysis' | 'My Farms' | 'Farm Setup' | 'AI Insights' | 'Climate Insights' | 'Crop Rotation' | 'Reports' | 'Settings'
type Lang = Language
type MapBasemap = 'satellite' | 'streets' | 'light'
type ClimateMetric = 'Rainfall' | 'Temperature' | 'Soil Moisture' | 'Vegetation (NDVI)'
type Aggregation = 'Monthly' | 'Seasonal'
type RotationView = 'Cards' | 'Table'
type UnitPreferences = { area: 'Hectares' | 'Acres'; rainfall: 'Millimetres' | 'Inches'; temperature: 'Celsius' | 'Fahrenheit' }
const defaultUnits: UnitPreferences = { area: 'Hectares', rainfall: 'Millimetres', temperature: 'Celsius' }

const nav: { label: Section; icon: LucideIcon }[] = [
  { label: 'Home', icon: Home },
  { label: 'Explore Earth', icon: Globe2 },
  { label: 'My Farms', icon: Sprout },
  { label: 'AI Insights', icon: BarChart3 },
  { label: 'Climate Insights', icon: Activity },
  { label: 'Crop Rotation', icon: Wheat },
  { label: 'Reports', icon: FileText },
  { label: 'Settings', icon: Settings },
]

const cropPhotos = {
  soybean: 'https://images.unsplash.com/photo-1696124651786-218e47e63c73?auto=format&fit=crop&w=900&q=82',
  wheat: 'https://images.unsplash.com/photo-1688320243376-69b68a8f656f?auto=format&fit=crop&w=900&q=82',
  chickpea: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Chickpea_field.jpg',
  fodder: 'https://www.tanuvas.ac.in/img/kcrs/kcrs_pic_05.jpg',
  maize: 'https://images.unsplash.com/photo-1572360463110-18939f36219c?auto=format&fit=crop&w=900&q=82',
  onion: 'https://images.unsplash.com/photo-1681391998321-2efbc53ee940?auto=format&fit=crop&w=900&q=82',
  greenGram: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Moong_crop_in_a_field_in_Hoshangabad%2C_Madhya_Pradesh%2C_on_May_28%2C_2013.jpg',
}

const demoMetrics = [
  { icon: Thermometer, value: '32.4°C', label: 'Avg. temperature', sub: 'Aug 2025 · demo', color: 'orange' },
  { icon: CloudRain, value: '642 mm', label: 'Annual rainfall', sub: '2020–2024 · demo', color: 'blue' },
  { icon: Leaf, value: '0.46', label: 'NDVI (current)', sub: 'Illustrative value', color: 'green' },
  { icon: Droplets, value: '18.2%', label: 'Soil moisture', sub: 'Illustrative value', color: 'gold' },
]

const cropPlans = [
  {
    name: 'Your Current Rotation', tag: 'CURRENT', className: 'current',
    crops: [
      { name: 'Soybean', season: 'Kharif', image: cropPhotos.soybean },
      { name: 'Wheat', season: 'Rabi', image: cropPhotos.wheat },
    ],
    values: [['Soil health', 62], ['Water resilience', 58], ['Diversification', 40]],
    points: ['Familiar and established', 'Market access may be known', 'Use as the baseline plan'],
  },
  {
    name: 'Alternative A', tag: 'COMPARE', className: 'recommended',
    crops: [
      { name: 'Soybean', season: 'Kharif', image: cropPhotos.soybean },
      { name: 'Chickpea', season: 'Rabi', image: cropPhotos.chickpea },
      { name: 'Fodder', season: 'Summer', image: cropPhotos.fodder },
    ],
    values: [['Soil health', 85], ['Water resilience', 78], ['Diversification', 82]],
    points: ['Adds a legume in Rabi', 'Could improve seasonal diversity', 'Check local water and market fit'],
  },
  {
    name: 'Alternative B', tag: 'COMPARE', className: 'alternative',
    crops: [
      { name: 'Maize', season: 'Kharif', image: cropPhotos.maize },
      { name: 'Onion', season: 'Rabi', image: cropPhotos.onion },
      { name: 'Green gram', season: 'Summer', image: cropPhotos.greenGram },
    ],
    values: [['Soil health', 74], ['Water resilience', 68], ['Diversification', 76]],
    points: ['Potentially higher input needs', 'Irrigation access matters', 'Confirm seed and market availability'],
  },
]

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const climateSeries: Record<ClimateMetric, { values: number[]; max: number; unit: string }> = {
  Rainfall: { values: [12, 14, 18, 32, 89, 210, 294, 283, 191, 81, 23, 8], max: 300, unit: 'mm' },
  Temperature: { values: [25, 28, 32, 36, 37, 32, 29, 28, 29, 29, 27, 25], max: 40, unit: '°C' },
  'Soil Moisture': { values: [21, 19, 16, 13, 17, 34, 48, 46, 39, 31, 26, 23], max: 60, unit: '%' },
  'Vegetation (NDVI)': { values: [0.22, 0.23, 0.26, 0.28, 0.31, 0.4, 0.56, 0.54, 0.48, 0.41, 0.33, 0.27], max: 0.8, unit: 'NDVI' },
}
function displayedClimateSeries(metric: ClimateMetric, units: UnitPreferences, aggregation: Aggregation = 'Monthly') {
  const source = climateSeries[metric]
  let values = source.values
  let max = source.max
  let unit = source.unit
  if (metric === 'Rainfall' && units.rainfall === 'Inches') { values = values.map((value) => value / 25.4); max = source.max / 25.4; unit = 'in' }
  if (metric === 'Temperature' && units.temperature === 'Fahrenheit') { values = values.map((value) => (value * 9) / 5 + 32); max = 104; unit = '°F' }
  if (aggregation === 'Monthly') return { values, max, unit, labels: months }
  const labels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec']
  const grouped = labels.map((_, index) => values.slice(index * 3, index * 3 + 3))
  const seasonalValues = grouped.map((valuesInSeason) => metric === 'Rainfall' ? valuesInSeason.reduce((sum, value) => sum + value, 0) : valuesInSeason.reduce((sum, value) => sum + value, 0) / valuesInSeason.length)
  return { values: seasonalValues, max: Math.max(...seasonalValues) * 1.12 || max, unit, labels }
}

const mapLayerNames = ['Satellite imagery', 'Street map', 'Light basemap', '3D terrain', 'Field boundaries']
const mapLayerCaptions = ['Satellite tiles', 'Roads and place labels', 'Lightweight road map', 'Elevation and camera tilt', 'Sample parcel outlines']

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function readSession(): FarmShiftSession | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem('farmshift:session')
    return value ? JSON.parse(value) as FarmShiftSession : null
  } catch { return null }
}

const defaultFarm = { name: 'Farm Field 01', region: 'Nagpur, Maharashtra', area: '12.4', water: 'Borewell', kharif: 'Soybean', rabi: 'Wheat', landType: 'Agricultural field', sowingSeason: 'Kharif', previousCrop: 'Soybean', soilTexture: 'Black / clay loam', waterReliability: 'Seasonal', soilTestStatus: 'Not entered', constraints: ['Low irrigation availability', 'Minimize input cost', 'Prefer locally available seeds'] as string[] }
type FarmFields = typeof defaultFarm
type FarmProfile = FarmFields & { id: string; backendId?: string }

function loadFarmProfiles(): FarmProfile[] {
  const stored = readStored<FarmProfile[] | null>('farmshift:farms', null)
  if (Array.isArray(stored) && stored.length) {
    const valid = stored.filter((farm) => typeof farm?.id === 'string' && typeof farm?.name === 'string')
    if (valid.length) return valid.map((farm) => ({ ...defaultFarm, ...farm, constraints: Array.isArray(farm.constraints) ? farm.constraints : [...defaultFarm.constraints] }))
  }
  const legacy = readStored<Partial<FarmFields>>('farmshift:farm', defaultFarm)
  return [{ id: 'farm-01', ...defaultFarm, ...legacy, constraints: Array.isArray(legacy.constraints) ? legacy.constraints : [...defaultFarm.constraints] }]
}

type SelectedMapField = { region: RegionName; farmId: string; name: string; crop: string; areaHa: number; demo: boolean }

function regionIdFor(region: RegionName): RegionId { return region === 'Wardha' ? 'wardha' : 'nagpur' }

function toFarmPayload(fields: FarmFields, region: RegionName, boundaryGeoJson: FeatureCollection | null): FarmPayload {
  return {
    name: fields.name.trim(),
    region_id: regionIdFor(region),
    area_ha: Number(fields.area),
    land_type: fields.landType,
    crops: { kharif: fields.kharif, rabi: fields.rabi, previous_crop: fields.previousCrop, sowing_season: fields.sowingSeason },
    water: { source: fields.water, reliability: fields.waterReliability },
    soil: { texture: fields.soilTexture, test_status: fields.soilTestStatus },
    constraints: [...fields.constraints],
    boundary_geojson: boundaryGeoJson,
  }
}

function fromFarmDto(dto: FarmDto): FarmProfile {
  const region: RegionName = dto.region_id === 'wardha' ? 'Wardha' : 'Nagpur'
  return {
    id: dto.id,
    backendId: dto.id,
    name: dto.name,
    region: dto.region_label || REGIONS[region].label,
    area: String(dto.area_ha ?? ''),
    landType: dto.land_type || 'Agricultural field',
    kharif: dto.crops?.kharif || 'Soybean',
    rabi: dto.crops?.rabi || 'Wheat',
    previousCrop: dto.crops?.previous_crop || 'Unknown',
    sowingSeason: dto.crops?.sowing_season || 'Kharif',
    water: dto.water?.source || 'Unknown',
    waterReliability: dto.water?.reliability || 'Unknown',
    soilTexture: dto.soil?.texture || 'Unknown',
    soilTestStatus: dto.soil?.test_status || 'Not entered',
    constraints: Array.isArray(dto.constraints) ? dto.constraints : [...defaultFarm.constraints],
  }
}

function collectionItems<T>(response: T[] | { items: T[] }): T[] {
  return Array.isArray(response) ? response : response.items
}

function humanizeApiError(error: unknown): string {
  return error instanceof Error ? error.message : 'The backend request could not be completed.'
}

function SectionTitle({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children?: ReactNode }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{children && <div className="title-actions">{children}</div>}</div>
}

function MetricCards({ compact = false }: { compact?: boolean }) {
  return <div className={`metric-grid ${compact ? 'compact' : ''}`}>{demoMetrics.map(({ icon: Icon, value, label, sub, color }, index) => <motion.article className="metric-card" key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: index * 0.045 }} whileHover={{ y: -3 }}><div className={`metric-icon ${color}`}><Icon size={17} /></div><div className="metric-value"><strong>{value}</strong><small>{label}</small>{!compact && <em>{sub}</em>}</div></motion.article>)}</div>
}

function climateMetricId(metric: ClimateMetric): ClimateMetricId {
  if (metric === 'Temperature') return 'temperature'
  if (metric === 'Soil Moisture') return 'soil_moisture'
  if (metric === 'Vegetation (NDVI)') return 'ndvi'
  return 'rainfall'
}

function RainfallChart({ metric = 'Rainfall', units = defaultUnits, aggregation = 'Monthly', remoteData = null }: { metric?: ClimateMetric; units?: UnitPreferences; aggregation?: Aggregation; remoteData?: ClimateSeriesResponse | null }) {
  const demoSeries = displayedClimateSeries(metric, units, aggregation)
  const isMatchingRemote = Boolean(remoteData && remoteData.metric === climateMetricId(metric) && remoteData.aggregation.toLowerCase() === aggregation.toLowerCase())
  const values = isMatchingRemote ? remoteData!.observations.filter((observation) => observation.value !== null).map((observation) => observation.value as number) : demoSeries.values
  const labels = isMatchingRemote ? remoteData!.observations.filter((observation) => observation.value !== null).map((observation) => observation.label) : demoSeries.labels
  const max = isMatchingRemote ? Math.max(...values, 1) * 1.08 : demoSeries.max
  const unit = isMatchingRemote ? remoteData!.unit : demoSeries.unit
  const ticks = [max, max * (2 / 3), max / 3, 0]
  const format = (value: number) => metric === 'Vegetation (NDVI)' ? value.toFixed(2) : String(Math.round(value * 10) / 10)
  return <div className="rain-chart" role="img" aria-label={`${isMatchingRemote ? 'Backend' : 'Illustrative'} ${aggregation.toLowerCase()} ${metric.toLowerCase()} chart`}>
    <div className="chart-y-labels">{ticks.map((tick, index) => <span key={index}>{format(tick)}</span>)}</div>
    <div className="chart-bars">{values.map((value, index) => <div className="chart-bar-column" key={`${labels[index]}-${index}`} title={`${labels[index]}: ${format(value)} ${unit}`}><span className="chart-bar" style={{ height: `${Math.max(3, (value / max) * 100)}%` }} /><small>{labels[index]}</small></div>)}</div>
  </div>
}

function YearTrendChart() {
  return <div className="trend-chart" role="img" aria-label="Illustrative comparison of four years"><svg viewBox="0 0 520 185" preserveAspectRatio="none">
    {[25, 60, 95, 130, 165].map((y) => <line key={y} x1="28" x2="512" y1={y} y2={y} className="chart-gridline" />)}
    {[
      { color: '#1489dd', points: '28,144 72,128 116,133 160,109 204,74 248,61 292,38 336,55 380,83 424,90 468,114 512,127' },
      { color: '#f2a33c', points: '28,151 72,137 116,126 160,121 204,91 248,84 292,68 336,62 380,79 424,94 468,105 512,119' },
      { color: '#24a56a', points: '28,160 72,152 116,141 160,128 204,112 248,88 292,71 336,77 380,89 424,110 468,120 512,138' },
      { color: '#9867d9', points: '28,154 72,145 116,136 160,116 204,94 248,103 292,80 336,91 380,104 424,115 468,129 512,143' },
    ].map((line) => <polyline key={line.color} points={line.points} fill="none" stroke={line.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
    {months.filter((_, i) => i % 2 === 0).map((m, i) => <text key={m} x={28 + i * 88} y="181" className="chart-axis-text">{m}</text>)}
  </svg></div>
}

function CropCard({ plan, onDetails }: { plan: (typeof cropPlans)[number]; onDetails: (name: string) => void }) {
  return <motion.article className={`rotation-card ${plan.className}`} layout whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
    <div className="rotation-head"><div><h3>{plan.name}</h3><span className={`rotation-badge ${plan.className}`}>{plan.tag}</span></div></div>
    <div className={`crop-sequence ${plan.crops.length === 2 ? 'two-crops' : ''}`}>
      {plan.crops.map((crop, index) => <div className="crop-stage" key={crop.name}>
        <div className="crop-photo"><img src={crop.image} alt={`${crop.name} crop photograph`} loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} /><span className="crop-photo-fallback"><Leaf size={20}/></span></div>
        <strong>{crop.name}</strong><small>{crop.season}</small>
        {index < plan.crops.length - 1 && <span className="crop-arrow">→</span>}
      </div>)}
    </div>
    <div className="score-bars">{plan.values.map(([label, value]) => <div className="score-row" key={label as string}><span>{label}</span><div className="score-track"><i style={{ width: `${value}%` }} /></div><b>{value}%</b></div>)}</div>
    <ul className="rotation-notes">{plan.points.map((point, index) => <li key={point} className={index === 2 ? 'risk-note' : ''}>{index === 2 ? <AlertTriangle size={13}/> : <CheckCircle2 size={13}/>}<span>{point}</span></li>)}</ul>
    <button className="detail-btn" onClick={() => onDetails(plan.name)}>View details <ArrowRight size={14}/></button>
  </motion.article>
}

export default function App() {
  const [isLanding, setIsLanding] = useState(() => !window.location.pathname.startsWith('/app'))
  // Prevent browser scroll restoration from opening the landing or workspace halfway down the page.
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }) }, [isLanding])
  const [section, setSection] = useState<Section>('Home')
  const [dark, setDark] = useState(() => readStored<boolean>('farmshift:appearance-v2', false))
  const [lang, setLang] = useState<Lang>(() => { const stored = readStored<Lang>('farmshift:language', 'en'); return stored === 'mr' || stored === 'hi' ? stored : 'en' })
  const [mobileNav, setMobileNav] = useState(false)
  const [season, setSeason] = useState('Kharif 2024–2025')
  const [search, setSearch] = useState('')
  const [searchMessage, setSearchMessage] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [remoteNotifications, setRemoteNotifications] = useState<NotificationDto[]>([])
  const [notificationsApiBusy, setNotificationsApiBusy] = useState(false)
  const [notificationsApiMessage, setNotificationsApiMessage] = useState('')
  const [remoteReports, setRemoteReports] = useState<ReportDto[]>([])
  const [reportsApiBusy, setReportsApiBusy] = useState(false)
  const [reportsApiMessage, setReportsApiMessage] = useState('')
  const [userSession, setUserSession] = useState<FarmShiftSession | null>(readSession)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [backendConnection, setBackendConnection] = useState<'disabled' | 'checking' | 'online' | 'offline'>(backendApiEnabled ? 'checking' : 'disabled')
  const [backendConnectionMessage, setBackendConnectionMessage] = useState(backendApiEnabled ? 'Checking backend readiness…' : 'Backend integration is disabled; local demo mode is active.')
  const [backendActionNotice, setBackendActionNotice] = useState('')
  const [aiInsightResult, setAiInsightResult] = useState<AiInsightsResponse | null>(null)
  const [aiInsightError, setAiInsightError] = useState('')
  const [aiInsightBusy, setAiInsightBusy] = useState(false)
  const [climateLiveData, setClimateLiveData] = useState<ClimateSeriesResponse | null>(null)
  const [climateApiMessage, setClimateApiMessage] = useState('')
  const [climateApiBusy, setClimateApiBusy] = useState(false)
  const [rotationApiMessage, setRotationApiMessage] = useState('')
  const [rotationApiBusy, setRotationApiBusy] = useState(false)
  const [rotationApiResult, setRotationApiResult] = useState<RotationComparisonResponse | null>(null)
  const authLoginEndpoint = backendApiEnabled ? (import.meta.env.VITE_AUTH_LOGIN_ENDPOINT || API_ROUTES.auth.login).trim() : ''
  const authLogoutEndpoint = backendApiEnabled ? (import.meta.env.VITE_AUTH_LOGOUT_ENDPOINT || API_ROUTES.auth.logout).trim() : ''
  const [dashboardTab, setDashboardTab] = useState('Overview')
  const [activeLayer, setActiveLayer] = useState(() => { const mode = readStored<MapBasemap>('farmshift:map-basemap', 'satellite'); return mode === 'streets' ? 'Street map' : mode === 'light' ? 'Light basemap' : 'Satellite imagery' })
  const [mapBasemap, setMapBasemap] = useState<MapBasemap>(() => readStored<MapBasemap>('farmshift:map-basemap', 'satellite'))
  const [mapTerrain, setMapTerrain] = useState(() => readStored<boolean>('farmshift:map-terrain', true))
  const [mapBoundaries, setMapBoundaries] = useState(() => readStored<boolean>('farmshift:map-boundaries', true))
  const [climateMetric, setClimateMetric] = useState<ClimateMetric>('Rainfall')
  const [aggregation, setAggregation] = useState<Aggregation>('Monthly')
  const [rotationView, setRotationView] = useState<RotationView>('Cards')
  const [selectedReport, setSelectedReport] = useState(0)
  const [setupStep, setSetupStep] = useState(0)
  const [setupNotice, setSetupNotice] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [targetRegion, setTargetRegion] = useState<RegionName>(() => { const queryRegion = new URLSearchParams(window.location.search).get('region')?.toLowerCase(); if (queryRegion === 'wardha') return 'Wardha'; if (queryRegion === 'nagpur') return 'Nagpur'; return readStored<RegionName>('farmshift:region', 'Nagpur') === 'Wardha' ? 'Wardha' : 'Nagpur' })
  const [rotationDetail, setRotationDetail] = useState<string | null>(null)
  const [settingsTab, setSettingsTab] = useState('Language')
  const [prefs, setPrefs] = useState(() => readStored('farmshift:settings-prefs', { boundaries: true, terrain: true, dataSource: true, reduceMotion: false }))
  const [units, setUnits] = useState<UnitPreferences>(() => readStored<UnitPreferences>('farmshift:units', defaultUnits))
  const [farmProfiles, setFarmProfiles] = useState<FarmProfile[]>(loadFarmProfiles)
  const [activeFarmId, setActiveFarmId] = useState(() => readStored<string>('farmshift:active-farm-id', 'farm-01'))
  const [isCreatingFarm, setIsCreatingFarm] = useState(false)
  const [farmSaveBusy, setFarmSaveBusy] = useState(false)
  const activeFarmRecord = farmProfiles.find((record) => record.id === activeFarmId) ?? farmProfiles[0] ?? { id: 'farm-01', backendId: undefined, ...defaultFarm }
  const farm = useMemo<FarmFields>(() => ({ ...defaultFarm, ...activeFarmRecord, constraints: Array.isArray(activeFarmRecord.constraints) ? activeFarmRecord.constraints : [...defaultFarm.constraints] }), [activeFarmRecord])
  const setFarm = (updater: SetStateAction<FarmFields>) => {
    setFarmProfiles((records) => {
      const record = records.find((item) => item.id === activeFarmId) ?? records[0]
      if (!record) {
        const next = typeof updater === 'function' ? updater(defaultFarm) : updater
        return [{ id: activeFarmId || `farm-${Date.now()}`, ...next }]
      }
      return records.map((item) => {
        if (item.id !== record.id) return item
        const current: FarmFields = { ...defaultFarm, ...item, constraints: Array.isArray(item.constraints) ? item.constraints : [...defaultFarm.constraints] }
        const next = typeof updater === 'function' ? updater(current) : updater
        return { id: item.id, backendId: item.backendId, ...next }
      })
    })
  }
  const [selectedMapField, setSelectedMapField] = useState<SelectedMapField | null>(null)
  const [importedGeoJson, setImportedGeoJson] = useState<FeatureCollection | null>(() => readStored<FeatureCollection | null>('farmshift:imported-boundary', null))
  const [boundaryImportMessage, setBoundaryImportMessage] = useState('')
  const boundaryFileRef = useRef<HTMLInputElement | null>(null)
  const reducedMotion = useReducedMotion()
  const t = translations[lang]
  const transition = useMemo(() => reducedMotion || prefs.reduceMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' as const }, [reducedMotion, prefs.reduceMotion])
  const navSection = section === 'Map & Analysis' ? 'Explore Earth' : section === 'Farm Setup' || (section === 'My Farms' && showSetup) ? 'My Farms' : section
  const dashboardMetric: ClimateMetric = dashboardTab === 'Soil' ? 'Soil Moisture' : dashboardTab === 'Crops' ? 'Vegetation (NDVI)' : dashboardTab === 'Risks' ? 'Temperature' : 'Rainfall'
  const formatArea = (value: string | number) => { const hectares = Number(value); if (!Number.isFinite(hectares) || hectares <= 0) return '—'; return units.area === 'Acres' ? `${(hectares * 2.47105).toFixed(1)} acres` : `${hectares.toFixed(1)} ha` }
  useEffect(() => {
    try {
      window.localStorage.setItem('farmshift:appearance-v2', JSON.stringify(dark))
      window.localStorage.setItem('farmshift:language', JSON.stringify(lang))
      window.localStorage.setItem('farmshift:region', JSON.stringify(targetRegion))
      window.localStorage.setItem('farmshift:farm', JSON.stringify(farm))
      window.localStorage.setItem('farmshift:farms', JSON.stringify(farmProfiles))
      window.localStorage.setItem('farmshift:active-farm-id', JSON.stringify(activeFarmId))
      window.localStorage.setItem('farmshift:map-basemap', JSON.stringify(mapBasemap))
      window.localStorage.setItem('farmshift:map-terrain', JSON.stringify(mapTerrain))
      window.localStorage.setItem('farmshift:map-boundaries', JSON.stringify(mapBoundaries))
      window.localStorage.setItem('farmshift:units', JSON.stringify(units))
      window.localStorage.setItem('farmshift:settings-prefs', JSON.stringify(prefs))
      if (importedGeoJson) window.localStorage.setItem('farmshift:imported-boundary', JSON.stringify(importedGeoJson))
      else window.localStorage.removeItem('farmshift:imported-boundary')
    } catch (error) {
      console.warn('FarmShift could not persist local preferences; browser storage may be full or disabled.', error)
    }
  }, [dark, lang, targetRegion, farm, farmProfiles, activeFarmId, mapBasemap, mapTerrain, mapBoundaries, importedGeoJson, units, prefs])

  useEffect(() => {
    if (!backendApiEnabled) {
      setBackendConnection('disabled')
      setBackendConnectionMessage('Backend integration is disabled; local demo mode is active.')
      return
    }
    let cancelled = false
    setBackendConnection('checking')
    setBackendConnectionMessage(`Checking ${API_BASE_URL}/health…`)
    farmApi.system.health().then((health) => {
      if (cancelled) return
      if (health.status === 'error') {
        setBackendConnection('offline')
        setBackendConnectionMessage('The API returned an error health status.')
      } else {
        setBackendConnection('online')
        setBackendConnectionMessage(`Backend reachable${health.version ? ` · v${health.version}` : ''}.`)
      }
    }).catch((error: unknown) => {
      if (cancelled) return
      setBackendConnection('offline')
      setBackendConnectionMessage(humanizeApiError(error))
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!farmProfiles.some((record) => record.id === activeFarmId) && farmProfiles[0]) setActiveFarmId(farmProfiles[0].id)
  }, [farmProfiles, activeFarmId])

  useEffect(() => {
    const handleFieldSelected = (event: Event) => {
      const detail = (event as CustomEvent<SelectedMapField>).detail
      if (detail) setSelectedMapField(detail)
    }
    window.addEventListener('farmshift:field-selected', handleFieldSelected)
    return () => window.removeEventListener('farmshift:field-selected', handleFieldSelected)
  }, [])
  useEffect(() => {
    const syncRoute = () => {
      const inWorkspace = window.location.pathname.startsWith('/app')
      setIsLanding(!inWorkspace)
      if (inWorkspace) {
        const region = new URLSearchParams(window.location.search).get('region')?.toLowerCase()
        if (region === 'nagpur' || region === 'wardha') setTargetRegion(region === 'wardha' ? 'Wardha' : 'Nagpur')
      }
    }
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])
  const go = (label: Section) => {
    if (label === 'Farm Setup') {
      setSection('My Farms')
      setShowSetup(true)
    } else {
      const next = label === 'Explore Earth' ? 'Map & Analysis' : label
      setSection(next as Section)
      if (label === 'My Farms') setShowSetup(false)
    }
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: prefs.reduceMotion ? 'auto' : 'smooth' })
  }
  const updateFarm = (key: Exclude<keyof FarmFields, 'constraints'>, value: string) => setFarm((current) => ({ ...current, [key]: value }))
  const updateConstraint = (item: string, checked: boolean) => setFarm((current) => ({ ...current, constraints: checked ? [...new Set([...current.constraints, item])] : current.constraints.filter((value) => value !== item) }))
  const moveToSetupStep = (nextStep: number) => {
    if (nextStep > setupStep) {
      if (nextStep > setupStep + 1) { setSetupNotice('Complete each step in order so the profile is checked before saving.'); return }
      if (setupStep === 0 && !farm.name.trim()) { setSetupNotice('Add a name for this farm before continuing.'); return }
      if (setupStep === 0 && (!Number.isFinite(Number(farm.area)) || Number(farm.area) <= 0)) { setSetupNotice('Enter a farm area greater than zero hectares.'); return }
    }
    setSetupNotice('')
    setSetupStep(Math.max(0, Math.min(4, nextStep)))
  }
  const cancelFarmSetup = () => {
    if (isCreatingFarm) {
      const remaining = farmProfiles.filter((record) => record.id !== activeFarmId)
      setFarmProfiles(remaining)
      if (remaining[0]) setActiveFarmId(remaining[0].id)
    }
    setIsCreatingFarm(false)
    setSetupNotice('')
    setShowSetup(false)
    setSection('My Farms')
  }
  const handleRegionChange = (next: RegionName, updateFarmRegion = false) => {
    setTargetRegion(next)
    setSelectedMapField(null)
    // Exploring a district must not silently edit the selected farm profile.
    if (updateFarmRegion) setFarm((current) => ({ ...current, region: REGIONS[next].label }))
  }
  const openFullMap = (next: RegionName) => {
    handleRegionChange(next)
    go('Explore Earth')
  }
  const chooseMapLayer = (name: string) => {
    if (name === 'Satellite imagery') { setMapBasemap('satellite'); setActiveLayer(name); return }
    if (name === 'Street map') { setMapBasemap('streets'); setActiveLayer(name); return }
    if (name === 'Light basemap') { setMapBasemap('light'); setActiveLayer(name); return }
    if (name === '3D terrain') { setMapTerrain((enabled) => !enabled); setActiveLayer(name); return }
    if (name === 'Field boundaries') { setMapBoundaries((visible) => !visible); setActiveLayer(name) }
  }
  const isMapLayerSelected = (name: string) => {
    if (name === 'Satellite imagery') return mapBasemap === 'satellite'
    if (name === 'Street map') return mapBasemap === 'streets'
    if (name === 'Light basemap') return mapBasemap === 'light'
    if (name === '3D terrain') return mapTerrain
    if (name === 'Field boundaries') return mapBoundaries
    return false
  }
  const startNewFarm = () => {
    const id = `farm-${Date.now()}`
    const nextProfile: FarmProfile = { id, ...defaultFarm, name: `Farm ${farmProfiles.length + 1}`, region: REGIONS[targetRegion].label }
    setFarmProfiles((records) => [...records, nextProfile])
    setActiveFarmId(id)
    setIsCreatingFarm(true)
    setSetupNotice('')
    setSetupStep(0)
    setShowSetup(true)
    setSection('My Farms')
    setMobileNav(false)
  }
  const openFarmProfile = (record: FarmProfile, edit = false) => {
    setActiveFarmId(record.id)
    const region: RegionName = record.region.toLowerCase().includes('wardha') ? 'Wardha' : 'Nagpur'
    setTargetRegion(region)
    setFarmProfiles((records) => records.map((item) => item.id === record.id ? { ...item, region: REGIONS[region].label } : item))
    setIsCreatingFarm(false)
    if (edit) { setSetupNotice(''); setSetupStep(0); setShowSetup(true); setSection('My Farms') }
    else { setShowSetup(false); setSection('Map & Analysis') }
    setMobileNav(false)
  }
  const saveFarmProfile = async () => {
    if (!farm.name.trim()) { setSetupStep(0); setSetupNotice('Add a name for this farm before saving.'); return }
    if (!Number.isFinite(Number(farm.area)) || Number(farm.area) <= 0) { setSetupStep(0); setSetupNotice('Enter a farm area greater than zero hectares.'); return }
    const cleaned: FarmFields = { ...farm, name: farm.name.trim(), region: REGIONS[targetRegion].label }
    if (backendApiEnabled && userSession?.mode === 'server') {
      setFarmSaveBusy(true)
      setSetupNotice('Saving farm profile to the backend…')
      try {
        const payload = toFarmPayload(cleaned, targetRegion, importedGeoJson)
        const remoteFarm = activeFarmRecord.backendId
          ? await farmApi.farms.update(activeFarmRecord.backendId, payload)
          : await farmApi.farms.create(payload)
        const mapped = fromFarmDto(remoteFarm)
        setFarmProfiles((records) => records.map((record) => record.id === activeFarmId ? mapped : record))
        setActiveFarmId(mapped.id)
        setBackendActionNotice(`Saved “${mapped.name}” to the backend.`)
      } catch (error) {
        setSetupNotice(`Backend save failed: ${humanizeApiError(error)}. Your changes remain in the form.`)
        setBackendActionNotice('Farm profile was not synced. Check API status and the backend contract.')
        return
      } finally {
        setFarmSaveBusy(false)
      }
    } else {
      setFarm((current) => ({ ...current, name: current.name.trim(), region: REGIONS[targetRegion].label }))
      if (backendApiEnabled) setBackendActionNotice('Saved in this browser only. Sign in with a backend account to sync farm profiles.')
    }
    setSetupNotice('')
    setIsCreatingFarm(false)
    setShowSetup(false)
    setSection('My Farms')
    setMobileNav(false)
  }
  const handleBoundaryFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onerror = () => setBoundaryImportMessage(`Could not read ${file.name}.`)
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FeatureCollection
        if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features) || parsed.features.length === 0) throw new Error('Choose a non-empty GeoJSON FeatureCollection.')
        const parcelFeaturesOnly = parsed.features.every((feature) => feature?.geometry?.type === 'Polygon' || feature?.geometry?.type === 'MultiPolygon')
        if (!parcelFeaturesOnly) throw new Error('Field boundaries must be Polygon or MultiPolygon features. Remove points and lines, then try again.')
        parsed.features = parsed.features.map((feature, index) => ({ ...feature, properties: { ...(feature.properties ?? {}), farmshiftId: `imported-parcel-${index + 1}`, name: String(feature.properties?.name ?? feature.properties?.Name ?? `Imported parcel ${index + 1}`) } }))
        setImportedGeoJson(parsed)
        setBoundaryImportMessage(`${file.name} loaded · ${parsed.features.length} feature${parsed.features.length === 1 ? '' : 's'}`)
      } catch (error) {
        setBoundaryImportMessage(error instanceof Error ? error.message : 'This file is not a valid GeoJSON FeatureCollection.')
      }
    }
    reader.readAsText(file)
  }
  const downloadDemoReport = () => {
    const reportTitle = ['Farm Analysis Report', 'Rotation Comparison', 'Soil & Climate Summary'][selectedReport]
    const report = `FarmShift — Illustrative ${reportTitle}\nRegion: ${farm.region}\nFarm: ${farm.name}\nArea: ${farm.area} hectares\nLand type: ${farm.landType}\nSeason: ${season}\nCurrent crops: ${farm.kharif} (Kharif) → ${farm.rabi} (Rabi)\nWater source: ${farm.water} (${farm.waterReliability} reliability)\nSoil texture: ${farm.soilTexture}\nSoil test status: ${farm.soilTestStatus}\nPractical constraints: ${farm.constraints.join(', ') || 'None selected'}\nImported boundary features: ${importedGeoJson?.features.length ?? 0}\n\nIMPORTANT: This report is a frontend demo for Nagpur/Wardha. Environmental values, boundaries and crop comparisons are illustrative and are not verified recommendations.\n\nIncluded sections: field profile, climate summary, crop rotation comparison, risks, source notes and limitations.\n`
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `farmshift-${reportTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const printReport = () => window.print()
  const submitLocationSearch = async () => {
    const query = search.trim()
    if (!query) { setSearchMessage('Enter Nagpur, Wardha or latitude, longitude.'); return }
    const lower = query.toLowerCase()
    if (lower.includes('nagpur')) { handleRegionChange('Nagpur'); setSearchMessage('Showing Nagpur, Maharashtra.'); go('Explore Earth'); return }
    if (lower.includes('wardha')) { handleRegionChange('Wardha'); setSearchMessage('Showing Wardha, Maharashtra.'); go('Explore Earth'); return }
    const match = query.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/)
    if (match) {
      const first = Number(match[1]); const second = Number(match[2])
      const candidates: [number, number][] = [] // [latitude, longitude]
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) candidates.push([first, second])
      if (Math.abs(second) <= 90 && Math.abs(first) <= 180) candidates.push([second, first])
      const kmTo = ([lat, lon]: [number, number], name: RegionName) => {
        const [regionLon, regionLat] = REGIONS[name].coordinates
        return Math.hypot((lat - regionLat) * 111, (lon - regionLon) * 104)
      }
      const nearestCandidate = candidates
        .map((pair) => ({ pair, regionDistances: { Nagpur: kmTo(pair, 'Nagpur'), Wardha: kmTo(pair, 'Wardha') } }))
        .sort((a, b) => Math.min(a.regionDistances.Nagpur, a.regionDistances.Wardha) - Math.min(b.regionDistances.Nagpur, b.regionDistances.Wardha))[0]
      if (!nearestCandidate || Math.min(nearestCandidate.regionDistances.Nagpur, nearestCandidate.regionDistances.Wardha) > 120) { setSearchMessage('This prototype currently covers Nagpur and Wardha only.'); return }
      const nearest: RegionName = nearestCandidate.regionDistances.Nagpur <= nearestCandidate.regionDistances.Wardha ? 'Nagpur' : 'Wardha'
      handleRegionChange(nearest)
      setSearchMessage(`Coordinates are nearest to ${nearest}, Maharashtra.`)
      go('Explore Earth')
      return
    }
    if (backendApiEnabled) {
      setSearchMessage('Searching locations in the backend…')
      try {
        const results = collectionItems(await farmApi.regions.search(query))
        const firstResult = results[0]
        if (!firstResult) { setSearchMessage('No location matched that search. Try a village or region in Nagpur/Wardha.'); return }
        const resultRegion: RegionName = firstResult.region_id === 'wardha' || firstResult.name.toLowerCase().includes('wardha') ? 'Wardha' : 'Nagpur'
        handleRegionChange(resultRegion)
        setSearchMessage(`Found ${firstResult.name}. Opening ${resultRegion}, Maharashtra.`)
        go('Explore Earth')
      } catch (error) {
        setSearchMessage(`Backend location search failed: ${humanizeApiError(error)}. Try Nagpur, Wardha or coordinates.`)
      }
      return
    }
    setSearchMessage('Try “Nagpur”, “Wardha”, or coordinates such as 21.1458, 79.0882.')
  }

  const enterWorkspaceFromLanding = (nextRegion: RegionName, destination: 'map' | 'workspace' | 'setup', quickProfile?: QuickFarmDraft) => {
    setTargetRegion(nextRegion)
    setSelectedMapField(null)
    setMobileNav(false)
    setIsLanding(false)
    if (destination === 'setup') setFarm((current) => ({ ...current, region: REGIONS[nextRegion].label, ...(quickProfile ? { area: quickProfile.area, kharif: quickProfile.kharif, rabi: quickProfile.rabi, water: quickProfile.water } : {}) }))
    if (destination === 'map') {
      setSection('Map & Analysis')
      setShowSetup(false)
    } else if (destination === 'setup') {
      setSection('My Farms')
      setShowSetup(true)
      setSetupStep(0)
      setSetupNotice('')
    } else {
      setSection('Home')
      setShowSetup(false)
    }
    window.history.pushState({ farmshift: 'workspace' }, '', `/app?region=${nextRegion.toLowerCase()}`)
  }
  const checkBackendConnection = async () => {
    setBackendConnection('checking')
    setBackendConnectionMessage(`Checking ${API_BASE_URL}/health…`)
    try {
      const health = await farmApi.system.health()
      if (health.status === 'error') {
        setBackendConnection('offline')
        setBackendConnectionMessage('The API returned an error health status.')
      } else {
        setBackendConnection('online')
        setBackendConnectionMessage(`Backend reachable${health.version ? ` · v${health.version}` : ''}.`)
      }
    } catch (error) {
      setBackendConnection('offline')
      setBackendConnectionMessage(humanizeApiError(error))
    }
  }

  const syncPreferencesToBackend = async () => {
    if (!backendApiEnabled) { setBackendActionNotice('Backend mode is disabled; preferences are saved locally in this browser.'); return }
    if (userSession?.mode !== 'server') { setBackendActionNotice('Sign in with your backend account before syncing preferences.'); return }
    try {
      await farmApi.preferences.update({
        language: lang,
        area_unit: units.area === 'Acres' ? 'acre' : 'ha',
        rainfall_unit: units.rainfall === 'Inches' ? 'in' : 'mm',
        temperature_unit: units.temperature === 'Fahrenheit' ? 'f' : 'c',
        appearance: dark ? 'dark' : 'light',
        map_basemap: mapBasemap,
        map_terrain: mapTerrain,
        map_boundaries: mapBoundaries,
        reduce_motion: Boolean(prefs.reduceMotion),
      })
      setBackendActionNotice('Preferences synced to your backend account.')
    } catch (error) { setBackendActionNotice(`Preference sync failed: ${humanizeApiError(error)}`) }
  }

  const syncRemoteFarms = async (sessionMode: FarmShiftSession['mode'] | undefined = userSession?.mode) => {
    if (!backendApiEnabled || sessionMode !== 'server') return
    try {
      const remotePreferences = await farmApi.preferences.get().catch(() => null)
      if (remotePreferences) {
        if (remotePreferences.language) setLang(remotePreferences.language)
        if (remotePreferences.area_unit) setUnits((current) => ({ ...current, area: remotePreferences.area_unit === 'acre' ? 'Acres' : 'Hectares' }))
        if (remotePreferences.rainfall_unit) setUnits((current) => ({ ...current, rainfall: remotePreferences.rainfall_unit === 'in' ? 'Inches' : 'Millimetres' }))
        if (remotePreferences.temperature_unit) setUnits((current) => ({ ...current, temperature: remotePreferences.temperature_unit === 'f' ? 'Fahrenheit' : 'Celsius' }))
        if (remotePreferences.appearance) setDark(remotePreferences.appearance === 'dark')
        if (remotePreferences.map_basemap) setMapBasemap(remotePreferences.map_basemap)
        if (typeof remotePreferences.map_terrain === 'boolean') setMapTerrain(remotePreferences.map_terrain)
        if (typeof remotePreferences.map_boundaries === 'boolean') setMapBoundaries(remotePreferences.map_boundaries)
        if (typeof remotePreferences.reduce_motion === 'boolean') setPrefs((current) => ({ ...current, reduceMotion: remotePreferences.reduce_motion! }))
      }
    } catch {
      // Preferences are optional; a farm list can still be loaded if this endpoint is not implemented yet.
    }
    try {
      const response = await farmApi.farms.list()
      const items = collectionItems(response)
      const mapped = items.map(fromFarmDto)
      if (mapped.length) {
        setFarmProfiles(mapped)
        setActiveFarmId(mapped[0].id)
        const firstRegion: RegionName = mapped[0].region.toLowerCase().includes('wardha') ? 'Wardha' : 'Nagpur'
        setTargetRegion(firstRegion)
        setBackendActionNotice(`Loaded ${mapped.length} farm profile${mapped.length === 1 ? '' : 's'} from the backend.`)
      } else {
        setBackendActionNotice('Backend sign-in succeeded. No saved farms were returned; create or save a farm to start syncing.')
      }
    } catch (error) {
      setBackendActionNotice(`Signed in, but farm sync failed: ${humanizeApiError(error)}`)
    }
  }

  const ensureBackendFarmId = async (): Promise<string> => {
    if (activeFarmRecord.backendId) return activeFarmRecord.backendId
    if (activeFarmRecord.id && !/^farm(?:-|$)/i.test(activeFarmRecord.id)) return activeFarmRecord.id
    const created = await farmApi.farms.create(toFarmPayload(farm, targetRegion, importedGeoJson))
    const mapped = fromFarmDto(created)
    setFarmProfiles((records) => records.map((record) => record.id === activeFarmId ? mapped : record))
    setActiveFarmId(mapped.id)
    setBackendActionNotice(`Created a synced farm record for “${mapped.name}”.`)
    return mapped.id
  }

  const generateAiInsights = async () => {
    setAiInsightError('')
    setAiInsightResult(null)
    if (!backendApiEnabled) {
      setAiInsightError('AI Insights are not available in local demo mode. Set VITE_BACKEND_MODE=api and connect the backend before generating insights.')
      return
    }
    if (userSession?.mode !== 'server') {
      setAiInsightError('Sign in with your backend account before requesting farm-specific AI insights.')
      return
    }
    setAiInsightBusy(true)
    try {
      if (backendConnection !== 'online') await checkBackendConnection()
      const remoteFarmId = await ensureBackendFarmId()
      const result = await farmApi.aiInsights.generate(remoteFarmId, {
        region_id: regionIdFor(targetRegion),
        season,
        questions: ['Summarize verified farm and climate evidence', 'Identify material water and seasonal risks', 'List practical next steps and data limitations'],
      })
      setAiInsightResult(result)
      setBackendActionNotice(`AI Insights returned ${result.insights.length} item${result.insights.length === 1 ? '' : 's'} from the backend.`)
    } catch (error) {
      setAiInsightError(humanizeApiError(error))
    } finally {
      setAiInsightBusy(false)
    }
  }

  const loadClimateFromBackend = async () => {
    setClimateApiMessage('')
    setClimateLiveData(null)
    if (!backendApiEnabled) { setClimateApiMessage('Backend integration is disabled. Set VITE_BACKEND_MODE=api to load verified climate observations.'); return }
    if (userSession?.mode !== 'server') { setClimateApiMessage('Sign in with your backend account to load farm-specific climate data.'); return }
    setClimateApiBusy(true)
    try {
      const remoteFarmId = await ensureBackendFarmId()
      const series = await farmApi.climate.series(remoteFarmId, { metric: climateMetricId(climateMetric), aggregation: aggregation.toLowerCase() })
      setClimateLiveData(series)
      setClimateApiMessage(`${series.observations.length} backend observation${series.observations.length === 1 ? '' : 's'} loaded · ${series.unit} · ${series.source_notes?.join('; ') || 'source metadata returned by API'}`)
    } catch (error) {
      setClimateApiMessage(`Climate API request failed: ${humanizeApiError(error)}`)
    } finally { setClimateApiBusy(false) }
  }

  const compareRotationsWithBackend = async () => {
    setRotationApiMessage('')
    setRotationApiResult(null)
    if (!backendApiEnabled) { setRotationApiMessage('Backend integration is disabled. The rotation cards are labelled demo data until the crop-analysis API is connected.'); return }
    if (userSession?.mode !== 'server') { setRotationApiMessage('Sign in with your backend account to request an evidence-backed crop-rotation comparison.'); return }
    setRotationApiBusy(true)
    try {
      const remoteFarmId = await ensureBackendFarmId()
      const result = await farmApi.rotations.compare(remoteFarmId, {
        region_id: regionIdFor(targetRegion),
        season,
        current_rotation: { kharif: farm.kharif, rabi: farm.rabi, previous_crop: farm.previousCrop, sowing_season: farm.sowingSeason },
        farm_context: { area_ha: Number(farm.area), soil_texture: farm.soilTexture, soil_test_status: farm.soilTestStatus, water_source: farm.water, water_reliability: farm.waterReliability, constraints: farm.constraints },
      })
      setRotationApiResult(result)
      setRotationApiMessage(`Received ${result.alternatives.length} alternatives from the backend. Review evidence and limitations before acting.`)
    } catch (error) { setRotationApiMessage(`Rotation API request failed: ${humanizeApiError(error)}`) }
    finally { setRotationApiBusy(false) }
  }

  const loadBackendReports = async () => {
    setReportsApiMessage('')
    if (!backendApiEnabled) { setReportsApiMessage('Backend mode is disabled. Enable VITE_BACKEND_MODE=api to load account reports.'); return }
    if (userSession?.mode !== 'server') { setReportsApiMessage('Sign in with your backend account to load saved reports.'); return }
    setReportsApiBusy(true)
    try {
      const remoteFarmId = await ensureBackendFarmId()
      const response = await farmApi.reports.list(remoteFarmId)
      const items = collectionItems(response)
      setRemoteReports(items)
      setReportsApiMessage(`${items.length} report${items.length === 1 ? '' : 's'} returned by the backend.`)
    } catch (error) {
      setReportsApiMessage(`Reports could not be loaded: ${humanizeApiError(error)}`)
    } finally { setReportsApiBusy(false) }
  }

  const refreshBackendReport = async (reportId: string) => {
    try {
      const updated = await farmApi.reports.get(reportId)
      setRemoteReports((items) => items.map((item) => item.id === reportId ? updated : item))
      setReportsApiMessage(`Report status: ${updated.status}.`)
    } catch (error) { setReportsApiMessage(`Report status check failed: ${humanizeApiError(error)}`) }
  }

  const downloadBackendReport = async (reportId: string) => {
    try {
      const result = await farmApi.reports.download(reportId)
      const url = URL.createObjectURL(result.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.fileName
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
      setReportsApiMessage('Report downloaded from the backend.')
    } catch (error) { setReportsApiMessage(`Report download failed: ${humanizeApiError(error)}`) }
  }

  const loadNotifications = async () => {
    setNotificationsApiMessage('')
    if (!backendApiEnabled) { setRemoteNotifications([]); setNotificationsApiMessage('Backend mode is disabled. Notifications will appear here after the backend is connected.'); return }
    if (userSession?.mode !== 'server') { setRemoteNotifications([]); setNotificationsApiMessage('Sign in with your backend account to load account notifications.'); return }
    setNotificationsApiBusy(true)
    try {
      const response = await farmApi.notifications.list({ limit: 20 })
      setRemoteNotifications(collectionItems(response))
      setNotificationsApiMessage('')
    } catch (error) { setNotificationsApiMessage(`Notifications could not be loaded: ${humanizeApiError(error)}`) }
    finally { setNotificationsApiBusy(false) }
  }

  const markNotificationRead = async (notificationId: string) => {
    try {
      const updated = await farmApi.notifications.markRead(notificationId)
      setRemoteNotifications((items) => items.map((item) => item.id === notificationId ? (updated || { ...item, read_at: new Date().toISOString() }) : item))
    } catch (error) { setNotificationsApiMessage(`Could not mark notification read: ${humanizeApiError(error)}`) }
  }

  const generateBackendReport = async () => {
    if (!backendApiEnabled) { setBackendActionNotice('Backend mode is disabled; the current report download is a demo export.'); downloadDemoReport(); return }
    if (userSession?.mode !== 'server') { setBackendActionNotice('Sign in with your backend account to generate a report from server data.'); return }
    try {
      setBackendActionNotice('Requesting report generation…')
      const remoteFarmId = await ensureBackendFarmId()
      const types = ['farm-analysis', 'rotation-comparison', 'climate-summary']
      const report = await farmApi.reports.create(remoteFarmId, { type: types[selectedReport], title: `${REGIONS[targetRegion].label} ${['Farm Analysis', 'Rotation Comparison', 'Soil & Climate Summary'][selectedReport]}`, format: 'pdf' })
      setRemoteReports((items) => [report, ...items.filter((item) => item.id !== report.id)])
      if (report.status === 'ready') {
        const file = await farmApi.reports.download(report.id)
        const url = URL.createObjectURL(file.blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = file.fileName
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1500)
        setBackendActionNotice('Report generated and downloaded from the backend.')
      } else {
        setBackendActionNotice(`Report request accepted (${report.status}). Report ID: ${report.id}. Poll GET /v1/reports/${encodeURIComponent(report.id)} until status is ready, then download.`)
      }
    } catch (error) { setBackendActionNotice(`Report API request failed: ${humanizeApiError(error)}`) }
  }

  const handleAuthenticated = (nextSession: FarmShiftSession, token?: string) => {
    try {
      window.sessionStorage.setItem('farmshift:session', JSON.stringify(nextSession))
      if (token) window.sessionStorage.setItem('farmshift:auth-token', token)
    } catch { /* private browsing may disable session storage; keep the UI session in memory */ }
    setUserSession(nextSession)
    if (nextSession.mode === 'server') window.setTimeout(() => { void syncRemoteFarms(nextSession.mode) }, 0)
    setAuthOpen(false)
    setProfileMenuOpen(false)
  }
  const handleLogOut = () => {
    let token = ''
    try { token = window.sessionStorage.getItem('farmshift:auth-token') || '' } catch { /* storage may be unavailable */ }
    // Clear the client session immediately; optionally notify a backend that revokes server sessions.
    if (userSession?.mode === 'server' && token && authLogoutEndpoint) {
      void farmApi.auth.logout(authLogoutEndpoint).catch(() => {
        console.warn('Remote logout failed; the local FarmShift session was still cleared.')
      })
    }
    try { window.sessionStorage.removeItem('farmshift:session'); window.sessionStorage.removeItem('farmshift:auth-token') } catch { /* ignore unavailable session storage */ }
    setUserSession(null)
    setProfileMenuOpen(false)
    setRemoteReports([])
    setRemoteNotifications([])
    setAiInsightResult(null)
    setRotationApiResult(null)
    setClimateLiveData(null)
  }
  const initials = userSession?.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'G'

  const returnToLanding = () => {
    setIsLanding(true)
    setProfileMenuOpen(false)
    window.history.pushState({ farmshift: 'landing' }, '', '/')
    window.scrollTo({ top: 0, behavior: prefs.reduceMotion ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (isLanding || section !== 'Reports' || !backendApiEnabled || userSession?.mode !== 'server') return
    void loadBackendReports()
    // Report loading should re-run when the selected farm or signed-in user changes.
  }, [isLanding, section, backendApiEnabled, userSession?.mode, activeFarmId])

  if (isLanding) return <>
    <LandingPage dark={dark} initialRegion={targetRegion} reduceMotionPreference={prefs.reduceMotion} onToggleTheme={() => setDark((value) => !value)} onEnterWorkspace={enterWorkspaceFromLanding} userSession={userSession} onOpenAuth={() => setAuthOpen(true)} onLogOut={handleLogOut} />
    <ProfileAuthDialog open={authOpen} dark={dark} backendEndpoint={authLoginEndpoint} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
  </>

  const sidebar = <>
    <div className="brand"><div className="brand-mark"><Leaf size={24} fill="currentColor"/></div><div><strong>FarmShift</strong><small>Earth intelligence<br/>for resilient farming</small></div><button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19}/></button></div>
    <nav className="sidebar-nav" aria-label="Main navigation">{nav.map(({ label, icon: Icon }, index) => {
      const translated = label === 'Home' ? t.home : label === 'Explore Earth' ? t.explore : label === 'My Farms' ? t.farms : label === 'Farm Setup' ? t.setup : label === 'AI Insights' ? 'AI Insights' : label === 'Climate Insights' ? t.climate : label === 'Crop Rotation' ? t.rotation : label === 'Reports' ? t.reports : label === 'Settings' ? t.settings : label
      return <motion.button key={label} className={`nav-item ${navSection === label ? 'selected' : ''}`} onClick={() => go(label)} initial={{ opacity: 0, x: -7 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reducedMotion || prefs.reduceMotion ? 0 : 0.22, delay: (reducedMotion || prefs.reduceMotion) ? 0 : index * 0.035 }} whileHover={reducedMotion || prefs.reduceMotion ? undefined : { x: 3 }} whileTap={{ scale: 0.99 }}><Icon size={16}/><span>{translated}</span>{label === 'Climate Insights' && <i className="nav-status"/>}</motion.button>
    })}</nav>
    <div className="sidebar-bottom"><div className="sidebar-language"><Globe2 size={14}/><select value={lang} onChange={(event) => setLang(event.target.value as Lang)} aria-label="Language"><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select><ChevronDown size={13}/></div><button className="profile profile-trigger" type="button" onClick={() => userSession ? handleLogOut() : setAuthOpen(true)} title={userSession ? 'Sign out' : 'Sign in'}><div className="profile-avatar">{initials}</div><div className="profile-data"><strong>{userSession?.name || 'Guest farmer'}</strong><small>{userSession ? (userSession.mode === 'demo' ? 'Demo profile · Sign out' : 'Signed in · Sign out') : 'Not signed in · Sign in'}</small></div><ChevronDown size={14}/></button></div>
  </>

  return <div className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
    <motion.aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reducedMotion || prefs.reduceMotion ? 0 : 0.32, ease: 'easeOut' }}>{sidebar}</motion.aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu"/>}
    <main className="main-area workspace-view">
      <header className="topbar">
        <button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={18}/></button><button className="mobile-landing-link icon-btn" onClick={returnToLanding} aria-label="Return to landing page" title="Landing page"><Leaf size={16}/></button>
        <div className="breadcrumb"><button className="topbar-home-link" onClick={returnToLanding} title="Return to the FarmShift landing page">FarmShift ↗</button><b>/</b><span>India</span><b>/</b><span>Maharashtra</span><b>/</b><strong>{targetRegion}</strong></div>
        <div className="top-actions">
          <div className="searchbox"><Search size={16}/><input value={search} onChange={(event) => { setSearch(event.target.value); setSearchMessage('') }} placeholder="Search Nagpur, Wardha or coordinates…" aria-label="Search location" onKeyDown={(event) => { if (event.key === 'Enter') submitLocationSearch() }}/><button type="button" aria-label="Run location search" onClick={submitLocationSearch}><ArrowRight size={14}/></button></div>
          <select className="season-select" value={season} onChange={(event) => setSeason(event.target.value)} aria-label="Crop season"><option>Kharif 2024–2025</option><option>Rabi 2024–2025</option><option>Historical 2020–2024</option></select>
          <select className="top-language" value={lang} onChange={(event) => setLang(event.target.value as Lang)} aria-label="Language"><option value="en">EN</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select>
          <button className="icon-btn theme-toggle" onClick={() => setDark((value) => !value)} aria-label="Toggle dark and light mode" title="Toggle dark/light mode">{dark ? <Moon size={16}/> : <Sun size={16}/>}</button>
          <div className="notification-wrap"><button className="icon-btn notification-btn" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { const next = !notificationsOpen; setNotificationsOpen(next); if (next) void loadNotifications() }}><Bell size={16}/>{remoteNotifications.some((item) => !item.read_at) && <i/>}</button>{notificationsOpen && <div className="notification-popover"><div className="notification-popover-head"><strong>Notifications</strong>{backendApiEnabled && userSession?.mode === 'server' && <button onClick={() => void loadNotifications()} disabled={notificationsApiBusy}>{notificationsApiBusy ? 'Loading…' : 'Refresh'}</button>}</div>{notificationsApiBusy && <p>Loading account notifications…</p>}{notificationsApiMessage && <p role="status">{notificationsApiMessage}</p>}{!notificationsApiBusy && !notificationsApiMessage && remoteNotifications.length === 0 && <p>No backend notifications returned.</p>}{remoteNotifications.map((item) => <article className={`remote-notification ${item.read_at ? 'is-read' : ''}`} key={item.id}><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small>{!item.read_at && <button onClick={() => void markNotificationRead(item.id)}>Mark as read</button>}</article>)}<button className="notification-close" onClick={() => setNotificationsOpen(false)}>Close</button></div>}</div>
          <div className="profile-menu-wrap"><button className="profile-mini icon-btn" type="button" aria-label={userSession ? 'Open profile menu' : 'Sign in'} aria-expanded={profileMenuOpen} onClick={() => userSession ? setProfileMenuOpen((open) => !open) : setAuthOpen(true)}><span className="profile-avatar">{initials}</span></button>{profileMenuOpen && userSession && <div className="profile-popover"><div className="profile-popover-heading"><span className="profile-avatar">{initials}</span><div><strong>{userSession.name}</strong><small>{userSession.email}</small></div></div><p className="profile-mode-note">{userSession.mode === 'demo' ? 'Browser-only demo session. This is not secure account authentication.' : 'Authenticated using the configured backend.'}</p><button className="profile-menu-action" onClick={handleLogOut}>Sign out <ArrowRight size={14}/></button></div>}</div>
        </div>
      </header>
      {searchMessage && <div className="search-feedback" role="status">{searchMessage}<button onClick={() => setSearchMessage('')} aria-label="Dismiss search message">×</button></div>}
      {backendActionNotice && <div className="backend-action-notice" role="status"><span>{backendActionNotice}</span><button onClick={() => setBackendActionNotice('')} aria-label="Dismiss backend status message">Dismiss</button></div>}

      <AnimatePresence mode="wait"><motion.div key={section} className="page-content" initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }} transition={transition}>
        {section === 'Home' && <>
          <section className="workspace-welcome glass-surface">
            <div className="workspace-welcome-copy"><span className="eyebrow">FARMSHIFT WORKSPACE</span><h1>Start with the field.<br/><em>Plan with context.</em></h1><p>Manage farm details and explore satellite, terrain and seasonal context for Nagpur and Wardha—all in one workspace.</p><div className="workspace-welcome-actions"><button className="primary-btn shimmer-button" onClick={() => go('Explore Earth')}>Open map <ArrowRight size={15}/></button><button className="secondary-btn" onClick={() => go('Farm Setup')}><Sprout size={15}/> Set up a farm</button></div><div className="workspace-welcome-meta"><span><MapPin size={14}/> {REGIONS[targetRegion].label}</span><span><Satellite size={14}/> NASA Blue Marble globe on landing page</span></div></div>
            <div className="workspace-welcome-art" aria-label={`${targetRegion} regional photo`}>
              <img className="workspace-welcome-photo" src={targetRegion === 'Nagpur' ? 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Aerial_view_of_Nagpur.jpg' : 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Another_photo_of_Field_visit_at_Turmeric_field_at_Khairagaon_village.jpg'} alt={targetRegion === 'Nagpur' ? 'Aerial view of Nagpur' : 'Agricultural field in Wardha district'} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />
              <div className="welcome-art-overlay"/><div className="welcome-art-caption"><div><strong>{targetRegion}, Maharashtra</strong><small>{REGIONS[targetRegion].latitude}° N · {REGIONS[targetRegion].longitude}° E</small></div><button onClick={() => go('Explore Earth')} aria-label="Open region map"><ArrowUpRight size={17}/></button></div><span className="welcome-art-glass-tag">REGIONAL CONTEXT · PHOTO</span>
            </div>
          </section>
          <div className="section-heading"><div><span className="eyebrow">REGIONAL OVERVIEW</span><h2>{targetRegion} at a glance</h2></div><span className="demo-tag">Illustrative demo values</span></div>
          <MetricCards/>
          <div className="home-bottom"><section className="panel satellite-card"><div className="panel-title"><div><span className="eyebrow">FIELD INTELLIGENCE</span><h3>Satellite & field view</h3></div><button className="text-btn" onClick={() => go('Explore Earth')}>Open map <ArrowRight size={13}/></button></div><MapPanel region={targetRegion} onRegionChange={handleRegionChange} importedGeoJson={importedGeoJson} basemapPreference={mapBasemap} onBasemapChange={(mode) => { setMapBasemap(mode); setActiveLayer(mode === 'satellite' ? 'Satellite imagery' : mode === 'streets' ? 'Street map' : 'Light basemap') }} terrainPreference={mapTerrain} onTerrainChange={setMapTerrain} boundariesPreference={mapBoundaries} onBoundariesChange={setMapBoundaries}/></section><section className="panel workflow-card"><span className="eyebrow">NEXT STEPS</span><h3>Keep the basics in one place.</h3>{[{ title: 'Locate a field', target: 'Explore Earth' as Section }, { title: 'Add crops and seasons', target: 'Farm Setup' as Section }, { title: 'Record soil and water details', target: 'Farm Setup' as Section }, { title: 'Compare crop rotations', target: 'Crop Rotation' as Section }].map(({ title, target }, index) => <motion.button className="workflow-row" key={title} onClick={() => go(target)} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.28, delay: index * 0.045 }} whileHover={{ x: 3 }}><span className="step">{String(index + 1).padStart(2, '0')}</span><span>{title}</span><ArrowRight size={14}/></motion.button>)}</section></div>
        </>}

        {section === 'AI Insights' && <>
          <SectionTitle eyebrow="FIELD DECISION SUPPORT" title="AI Insights" subtitle="Insights are generated only from the connected backend and its returned evidence.">
            <button className="primary-btn" onClick={() => void generateAiInsights()} disabled={!backendApiEnabled || backendConnection !== 'online' || userSession?.mode !== 'server' || aiInsightBusy}>
              {aiInsightBusy ? 'Generating insights…' : 'Generate AI insights'} <ArrowRight size={14}/>
            </button>
          </SectionTitle>
          <section className="insight-context-panel glass-surface"><div><span className="eyebrow">CURRENT FARM CONTEXT</span><h2>{farm.name}</h2><p>{REGIONS[targetRegion].label} · {formatArea(farm.area)} · {farm.kharif} → {farm.rabi}</p></div><div className="insight-context-meta"><span>Water source <strong>{farm.water || 'Not recorded'}</strong></span><span>Soil test <strong>{farm.soilTestStatus || 'Not recorded'}</strong></span></div></section>
          <section className="insight-backend-state panel">
            <div className="insight-backend-state-top"><div><span className="eyebrow">AI SERVICE CONNECTION</span><h3>{!backendApiEnabled ? 'Backend integration is not enabled' : backendConnection === 'online' ? 'Backend health check passed' : backendConnection === 'checking' ? 'Checking backend connection' : 'Backend is not reachable'}</h3><p>{backendConnectionMessage}</p></div><span className={`backend-state-pill ${backendConnection}`}>{backendConnection === 'online' ? 'Connected' : backendConnection === 'checking' ? 'Checking' : backendConnection === 'offline' ? 'Offline' : 'Not configured'}</span></div>
            {!backendApiEnabled && <p className="api-config-hint">When your backend team is ready, set <code>VITE_BACKEND_MODE=api</code> and <code>VITE_API_BASE_URL</code> in <code>.env.local</code>. Endpoint contracts are documented in <code>docs/API-CONTRACT.md</code>.</p>}
            {backendApiEnabled && userSession?.mode !== 'server' && <p className="api-config-hint">Sign in with your backend account to request farm-specific insights. A browser-only demo session cannot access private farm records.</p>}
            <div className="insight-backend-actions"><button className="secondary-btn" onClick={() => void checkBackendConnection()} disabled={backendConnection === 'checking'}>Check connection</button>{backendApiEnabled && userSession?.mode !== 'server' && <button className="primary-btn" onClick={() => setAuthOpen(true)}>Sign in to backend <ArrowRight size={14}/></button>}</div>
          </section>
          {aiInsightError && <div className="api-message api-message-error" role="alert"><strong>AI Insights unavailable</strong><p>{aiInsightError}</p></div>}
          {aiInsightBusy && <section className="panel ai-result-empty" aria-live="polite"><div className="api-loading-indicator"/><h3>Requesting evidence-backed insights</h3><p>FarmShift is sending the selected farm context to the configured API. This view will render only what the backend returns.</p></section>}
          {aiInsightResult && !aiInsightBusy && <section className="ai-result-section"><div className="ai-result-heading"><div><span className="eyebrow">BACKEND RESPONSE</span><h2>{aiInsightResult.summary || 'Farm insights'}</h2><p>{aiInsightResult.generated_at ? `Generated ${new Date(aiInsightResult.generated_at).toLocaleString()}` : 'Generated by the connected backend'}{aiInsightResult.model ? ` · ${aiInsightResult.model}` : ''}</p></div><span className="backend-state-pill online">API response</span></div>
            {aiInsightResult.data_quality && <div className="ai-data-quality"><strong>Data quality: {aiInsightResult.data_quality.status}</strong>{aiInsightResult.data_quality.missing_inputs?.length ? <span>Missing inputs: {aiInsightResult.data_quality.missing_inputs.join(', ')}</span> : null}{aiInsightResult.data_quality.sources?.length ? <span>Sources: {aiInsightResult.data_quality.sources.join(', ')}</span> : null}</div>}
            {aiInsightResult.insights.length === 0 ? <div className="panel ai-result-empty"><h3>No insights returned</h3><p>The backend response did not include any insight items. Check the analysis service and its input requirements.</p></div> : <div className="insight-card-grid">{aiInsightResult.insights.map((insight) => <article className="insight-card ai-live-insight" key={insight.id}><div className="insight-card-head"><span className={`insight-severity ${insight.severity === 'warning' || insight.severity === 'critical' ? 'watch' : 'plan'}`}>{insight.category || 'Farm insight'}</span><span className="insight-severity record">{insight.severity || 'info'}</span></div><h3>{insight.title}</h3><p>{insight.summary}</p>{typeof insight.confidence === 'number' && <small className="ai-confidence">Confidence returned by model: {Math.round(insight.confidence * (insight.confidence <= 1 ? 100 : 1))}%</small>}{insight.evidence?.length ? <div className="ai-evidence"><strong>Evidence returned</strong>{insight.evidence.map((item, index) => <p key={`${insight.id}-evidence-${index}`}><b>{item.label}:</b> {item.value ?? 'Not supplied'} {item.source ? `· ${item.source}` : ''} {item.period ? `· ${item.period}` : ''}</p>)}</div> : null}{insight.actions?.length ? <div className="ai-actions"><strong>Suggested next steps</strong><ul>{insight.actions.map((action) => <li key={action}>{action}</li>)}</ul></div> : null}{insight.limitations?.length ? <div className="ai-limitations"><strong>Limitations</strong><ul>{insight.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul></div> : null}</article>)}</div>}
          </section>}
          {!aiInsightResult && !aiInsightBusy && !aiInsightError && <section className="panel ai-result-empty"><h3>No AI recommendations have been generated</h3><p>FarmShift will show AI insights only after the backend returns them with source, data-quality and limitation metadata. It will not fill this area with simulated advice.</p></section>}
        </>}

        {section === 'Map & Analysis' && <>
          <SectionTitle eyebrow="EXPLORE EARTH / MAP WORKSPACE" title="Map & Analysis" subtitle="Explore field context, map layers and environmental indicators for the selected region."><button className="secondary-btn compact-btn" onClick={() => go('Farm Setup')}><SlidersHorizontal size={14}/> Edit farm details</button></SectionTitle>
          <div className="analysis-layout">
            <section className="panel map-workspace-panel"><div className="map-heading"><div><div className="location-title"><span className="location-symbol"><MapPin size={16}/></span><div><h3>{REGIONS[targetRegion].label}</h3><small>{REGIONS[targetRegion].latitude}° N, {REGIONS[targetRegion].longitude}° E · target region</small></div></div></div><span className="map-heading-note">Choose a region in the map controls</span></div><MapPanel region={targetRegion} onRegionChange={handleRegionChange} importedGeoJson={importedGeoJson} initialTerrain={mapTerrain} basemapPreference={mapBasemap} onBasemapChange={(mode) => { setMapBasemap(mode); setActiveLayer(mode === 'satellite' ? 'Satellite imagery' : mode === 'streets' ? 'Street map' : 'Light basemap') }} terrainPreference={mapTerrain} onTerrainChange={setMapTerrain} boundariesPreference={mapBoundaries} onBoundariesChange={setMapBoundaries}/><div className="map-layer-section"><div className="panel-title"><div><h4>Map layers</h4><small>Choose a real basemap or toggle the available 3D terrain and sample field outlines.</small></div><span className="layer-status"><span className="pulse-dot"/> Basemaps online</span></div><div className="map-layer-grid">{mapLayerNames.map((name, index) => { const LayerIcon = [Satellite, MapPinned, Sun, Activity, Layers3][index]; const selected = isMapLayerSelected(name); const enabled = selected; return <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }} className={`map-layer-option ${selected ? 'active' : ''} ${enabled ? 'enabled' : ''}`} key={name} onClick={() => chooseMapLayer(name)} aria-pressed={enabled}><span className={`layer-thumb layer-${index}`}><LayerIcon size={18}/></span><strong>{name}</strong><small>{mapLayerCaptions[index]}</small></motion.button> })}</div></div></section>
            <aside className="panel analysis-aside"><div className="location-card"><div className="location-title"><span className="location-symbol rainbow"><Globe2 size={18}/></span><div><h3>{REGIONS[targetRegion].label}</h3><small>Target region · demo</small></div></div><span className="region-coordinates">{REGIONS[targetRegion].latitude}° N</span></div>
              {selectedMapField && selectedMapField.region === targetRegion && <section className="selected-field-summary"><span className="eyebrow">SELECTED MAP FEATURE</span><h4>{selectedMapField.name}</h4><p>{selectedMapField.crop}{selectedMapField.areaHa > 0 ? ` · ${selectedMapField.areaHa.toFixed(1)} ha` : ' · area not provided'}</p><small>{selectedMapField.demo ? 'Illustrative boundary — not a verified farm parcel.' : 'Imported boundary · local preview only.'}</small><button onClick={() => { setFarm((current) => ({ ...current, name: selectedMapField.name, area: selectedMapField.areaHa > 0 ? String(selectedMapField.areaHa) : current.area, region: REGIONS[targetRegion].label })); go('Farm Setup') }}>Use in farm setup <ArrowRight size={13}/></button></section>}
              <div className="analysis-tabs">{['Overview', 'Climate', 'Soil', 'Crops', 'Risks'].map((tab) => <button key={tab} onClick={() => setDashboardTab(tab)} className={dashboardTab === tab ? 'active' : ''}>{tab}</button>)}</div>
              <MetricCards compact/>
              <div className="chart-panel-head"><div><h4>{dashboardTab === 'Overview' ? 'Rainfall trend (monthly average)' : dashboardTab === 'Climate' ? 'Monthly climate pattern' : dashboardTab === 'Soil' ? 'Soil context preview' : dashboardTab === 'Crops' ? 'Crop season view' : 'Seasonal risk overview'}</h4><small>Sample chart · not verified observations</small></div><span className="report-count">2020–2024 · sample</span></div>
              <RainfallChart metric={dashboardMetric} units={units}/>
              <div className="quick-actions"><h4>Quick actions</h4><div><button className="primary-btn" onClick={() => go('Reports')}><FileText size={14}/> Generate report</button><button className="secondary-btn" onClick={downloadDemoReport}><Download size={14}/> Download</button></div></div>
            </aside>
          </div>
        </>}

        {section === 'My Farms' && !showSetup && <>
          <SectionTitle eyebrow="YOUR LAND" title="My farms" subtitle="Manage each field profile, then open its map and seasonal context."><button className="primary-btn" onClick={startNewFarm}><Plus size={16}/> Add a farm</button></SectionTitle>
          <div className="farms-summary"><div><strong>{String(farmProfiles.length).padStart(2, '0')}</strong><span>Saved farm profiles</span></div><div><strong>{formatArea(farm.area)}</strong><span>Selected farm area · demo</span></div><div><strong>{season}</strong><span>Planning season</span></div></div>
          <div className="farm-card-grid">
            {farmProfiles.map((record) => <article className={`farm-card ${record.id === activeFarmId ? 'farm-card-selected' : ''}`} key={record.id}>
              <div className="farm-card-photo"><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=84" alt="Agricultural fields" loading="lazy" onError={(event) => { (event.currentTarget as HTMLImageElement).style.opacity = '0' }}/><span className="farm-demo-badge">LOCAL PROFILE</span><button className="farm-card-menu" onClick={() => openFarmProfile(record, true)} aria-label={`Edit ${record.name}`} title="Edit farm profile"><SlidersHorizontal size={16}/></button></div>
              <div className="farm-card-body"><div className="farm-card-title"><div><h3>{record.name}</h3><p><MapPin size={14}/> {record.region}</p></div><span className="farm-status">{record.id === activeFarmId ? 'Selected' : 'Saved'}</span></div>
                <div className="farm-stats"><span><strong>{formatArea(record.area)}</strong><small>Area · saved locally</small></span><span><strong>{record.kharif}</strong><small>Kharif crop</small></span><span><strong>{record.rabi}</strong><small>Rabi crop</small></span></div>
                <button className="primary-btn full" onClick={() => openFarmProfile(record)}>Open farm workspace <ArrowRight size={15}/></button>
              </div>
            </article>)}
            <button className="add-farm-card" onClick={startNewFarm}><span><Plus size={24}/></span><strong>Add another farm</strong><small>Create a separate local profile</small></button>
          </div>
          <p className="muted-note">Profiles, crop choices, soil notes and practical constraints save in this browser. Real satellite-derived indicators and recommendations will appear after your backend is connected.</p>
        </>}

        {section === 'My Farms' && showSetup && <>
          <SectionTitle eyebrow="FARM PROFILE" title={isCreatingFarm ? "Create a farm profile" : "Edit farm profile"} subtitle="Set the location, crops and field conditions for this local profile."><button className="secondary-btn compact-btn" onClick={cancelFarmSetup}><X size={14}/> Back to My Farms</button></SectionTitle>
          <section className="panel setup-panel"><div className="setup-stepper">{['Location', 'Crops & seasons', 'Soil & water', 'Constraints', 'Review'].map((label, index) => <button key={label} className={`setup-step ${setupStep === index ? 'active' : ''} ${setupStep > index ? 'complete' : ''}`} onClick={() => moveToSetupStep(index)}><span>{setupStep > index ? <Check size={14}/> : index + 1}</span><div><strong>{label}</strong><small>{['Select field', 'Current crops', 'Field conditions', 'Practical priorities', 'Review profile'][index]}</small></div></button>)}</div><div className="setup-content"><div className="setup-map-column"><div className="setup-map-heading"><h3>Field location</h3><span className="demo-tag">Sample boundary</span></div><MapPanel region={targetRegion} onRegionChange={handleRegionChange} importedGeoJson={importedGeoJson} basemapPreference={mapBasemap} onBasemapChange={(mode) => { setMapBasemap(mode); setActiveLayer(mode === 'satellite' ? 'Satellite imagery' : mode === 'streets' ? 'Street map' : 'Light basemap') }} terrainPreference={mapTerrain} onTerrainChange={setMapTerrain} boundariesPreference={mapBoundaries} onBoundariesChange={setMapBoundaries}/><div className="boundary-controls"><button className="secondary-btn" onClick={() => go('Explore Earth')}><MapPinned size={14}/> Choose on map</button><button className="secondary-btn" onClick={() => boundaryFileRef.current?.click()}><Layers3 size={14}/> Import GeoJSON</button>{importedGeoJson && <button className="secondary-btn" onClick={() => { setImportedGeoJson(null); setBoundaryImportMessage('Imported boundary removed from this browser.'); setSelectedMapField(null) }}><X size={14}/> Remove boundary</button>}<input ref={boundaryFileRef} className="visually-hidden-file-input" type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleBoundaryFile}/></div>{boundaryImportMessage && <p className="boundary-import-message" role="status">{boundaryImportMessage}</p>}</div><div className="setup-form-column">
            {setupStep === 0 && <><div className="form-grid"><label>Farm name<input value={farm.name} onChange={(event) => updateFarm('name', event.target.value)}/></label><label>Target region<select value={targetRegion} onChange={(event) => handleRegionChange(event.target.value as RegionName, true)}><option value="Nagpur">Nagpur, Maharashtra</option><option value="Wardha">Wardha, Maharashtra</option></select></label><label>Farm area (hectares)<input type="number" min="0" step="0.1" value={farm.area} onChange={(event) => updateFarm('area', event.target.value)}/></label><label>Land type<select value={farm.landType} onChange={(event) => updateFarm('landType', event.target.value)}><option>Agricultural field</option><option>Orchard</option><option>Mixed farm</option></select></label></div></>}
            {setupStep === 1 && <><div className="form-grid"><label>Current Kharif crop<select value={farm.kharif} onChange={(event) => updateFarm('kharif', event.target.value)}>{['Soybean', 'Cotton', 'Bajra', 'Maize', 'Pigeon pea', 'Other'].map((crop) => <option key={crop}>{crop}</option>)}</select></label><label>Rabi crop<select value={farm.rabi} onChange={(event) => updateFarm('rabi', event.target.value)}>{['Wheat', 'Chickpea', 'Onion', 'Jowar', 'Fallow', 'Other'].map((crop) => <option key={crop}>{crop}</option>)}</select></label><label>Sowing season<select value={farm.sowingSeason} onChange={(event) => updateFarm('sowingSeason', event.target.value)}><option>Kharif</option><option>Rabi</option><option>Summer</option></select></label><label>Previous crop<select value={farm.previousCrop} onChange={(event) => updateFarm('previousCrop', event.target.value)}>{['Soybean', 'Wheat', 'Chickpea', 'Cotton', 'Maize', 'Unknown'].map((crop) => <option key={crop}>{crop}</option>)}</select></label></div><div className="crop-photo-inline"><img src={cropPhotos[farm.kharif.toLowerCase() as keyof typeof cropPhotos] || cropPhotos.soybean} alt={`${farm.kharif} crop example`}/><div><strong>{farm.kharif} → {farm.rabi}</strong><small>Crop photos are reference imagery; not a crop diagnosis.</small></div></div></>}
            {setupStep === 2 && <div className="form-grid"><label>Primary water source<select value={farm.water} onChange={(event) => updateFarm('water', event.target.value)}><option>Borewell</option><option>Canal</option><option>Rain-fed</option><option>Well</option><option>Other</option></select></label><label>Soil texture<select value={farm.soilTexture} onChange={(event) => updateFarm('soilTexture', event.target.value)}><option>Black / clay loam</option><option>Sandy loam</option><option>Red soil</option><option>Unknown</option></select></label><label>Water reliability<select value={farm.waterReliability} onChange={(event) => updateFarm('waterReliability', event.target.value)}><option>Reliable</option><option>Seasonal</option><option>Limited</option><option>Unknown</option></select></label><label>Soil test status<select value={farm.soilTestStatus} onChange={(event) => updateFarm('soilTestStatus', event.target.value)}><option>Not entered</option><option>Recent test available</option><option>Older test</option></select></label></div>}
            {setupStep === 3 && <div className="constraint-list">{['Low irrigation availability', 'Minimize input cost', 'Improve soil cover', 'Prefer locally available seeds', 'Consider market access'].map((item) => <label key={item}><input type="checkbox" checked={farm.constraints.includes(item)} onChange={(event) => updateConstraint(item, event.target.checked)}/><span>{item}</span></label>)}</div>}
            {setupStep === 4 && <div className="setup-review"><CheckCircle2 size={28}/><h3>Review your farm profile</h3><p>{farm.name} · {farm.region}</p><div><span>Farm area</span><strong>{farm.area || '—'} hectares</strong></div><div><span>Kharif</span><strong>{farm.kharif}</strong></div><div><span>Rabi</span><strong>{farm.rabi}</strong></div><div><span>Water source / reliability</span><strong>{farm.water} · {farm.waterReliability}</strong></div><div><span>Soil</span><strong>{farm.soilTexture} · {farm.soilTestStatus}</strong></div><div><span>Previous crop</span><strong>{farm.previousCrop}</strong></div><div><span>Practical priorities</span><strong>{farm.constraints.join(', ') || 'None selected'}</strong></div><p className="muted-note">Saved in this browser. Live analysis and account sync require the backend.</p></div>}
            <div className="form-actions"><span className="muted-note">Step {setupStep + 1} of 5 · {backendApiEnabled && userSession?.mode === 'server' ? 'Backend sync enabled' : 'Browser-local profile'}</span><div>{setupStep > 0 && <button className="secondary-btn" onClick={() => setSetupStep((step) => Math.max(0, step - 1))} disabled={farmSaveBusy}>Back</button>}<button className="primary-btn" disabled={farmSaveBusy} onClick={() => { if (setupStep < 4) moveToSetupStep(setupStep + 1); else void saveFarmProfile() }}>{farmSaveBusy ? 'Saving…' : setupStep === 4 ? 'Save farm profile' : 'Continue'} <ArrowRight size={14}/></button></div></div>
          </div></div>{setupNotice && <p className="setup-notice" role="alert">{setupNotice}</p>}</section>
        </>}

        {section === 'Climate Insights' && <>
          <SectionTitle eyebrow="EARTH OBSERVATION" title="Climate Insights" subtitle="Load climate observations and source metadata from the connected backend.">
            <button className="primary-btn" onClick={() => void loadClimateFromBackend()} disabled={climateApiBusy || !backendApiEnabled || userSession?.mode !== 'server'}>{climateApiBusy ? 'Loading observations…' : 'Load backend observations'} <ArrowRight size={14}/></button>
          </SectionTitle>
          <div className="climate-tabs">{(['Rainfall', 'Temperature', 'Soil Moisture', 'Vegetation (NDVI)'] as ClimateMetric[]).map((tab) => <button className={climateMetric === tab ? 'active' : ''} key={tab} onClick={() => { setClimateMetric(tab); setClimateLiveData(null); setClimateApiMessage('') }}>{tab}</button>)}</div>
          {climateApiMessage && <div className={`api-message ${climateLiveData ? 'api-message-success' : 'api-message-error'}`} role="status">{climateApiMessage}</div>}
          <div className="climate-layout"><section className="panel climate-chart-panel"><div className="panel-title"><div><h3>{aggregation} {climateMetric.toLowerCase()} {climateMetric === 'Rainfall' ? '(average)' : 'pattern'}</h3><small>{climateLiveData && climateLiveData.metric === climateMetricId(climateMetric) && climateLiveData.aggregation.toLowerCase() === aggregation.toLowerCase() ? `Backend observations · ${climateLiveData.unit}` : `Illustrative ${displayedClimateSeries(climateMetric, units, aggregation).unit} · source data not connected`}</small></div><select aria-label="Aggregation period" value={aggregation} onChange={(event) => { setAggregation(event.target.value as Aggregation); setClimateLiveData(null); setClimateApiMessage('') }}><option>Monthly</option><option>Seasonal</option></select></div><RainfallChart metric={climateMetric} units={units} aggregation={aggregation} remoteData={climateLiveData}/><div className="chart-legend"><span><i className="legend-blue"/> {climateMetric} ({climateLiveData && climateLiveData.metric === climateMetricId(climateMetric) && climateLiveData.aggregation.toLowerCase() === aggregation.toLowerCase() ? climateLiveData.unit : displayedClimateSeries(climateMetric, units, aggregation).unit})</span><span><i className="legend-gray"/> {climateLiveData ? 'API result shown only for matching metric and period' : 'Illustrative fallback, not observed'}</span></div></section><section className="panel key-takeaways"><h3>Data quality and interpretation</h3><div className="takeaway"><span><CloudRain size={16}/></span><div><strong>Source and period</strong><p>{climateLiveData ? (climateLiveData.source_notes?.join('; ') || 'Source notes were not returned.') : 'The backend must return observed periods, unit, source and quality for each value.'}</p></div></div><div className="takeaway"><span><Droplets size={16}/></span><div><strong>Missing measurements</strong><p>{climateLiveData ? `${climateLiveData.observations.filter((item) => item.value === null || item.quality === 'missing').length} observation(s) missing or marked missing.` : 'Missing soil or weather values should remain missing, not be replaced with assumed numbers.'}</p></div></div><div className="takeaway"><span><AlertTriangle size={16}/></span><div><strong>Decision limits</strong><p>Verify local field conditions and agricultural advisories before making planting, irrigation or input decisions.</p></div></div></section>
          <section className="panel yearly-panel"><div className="panel-title"><div><h3>Yearly comparison</h3><small>Illustrative trend only · not backend observations</small></div><span className="demo-tag">Demo</span></div><YearTrendChart/><div className="year-legend"><span><i style={{ background: '#1489dd' }}/>2020</span><span><i style={{ background: '#f2a33c' }}/>2021</span><span><i style={{ background: '#24a56a' }}/>2022</span><span><i style={{ background: '#9867d9' }}/>2023</span></div></section></div>
          <p className="source-footnote">Climate-series endpoint: <code>GET /v1/farms/{'{farm_id}'}/climate/series?metric={climateMetricId(climateMetric)}&aggregation={aggregation.toLowerCase()}</code>. Values render as backend data only when an API response is received for the selected metric and period.</p>
        </>}

        {section === 'Crop Rotation' && <>
          <SectionTitle eyebrow="DECISION SUPPORT" title="Crop Rotation Comparison" subtitle="Request a comparison from your backend crop-analysis service."><div className="rotation-title-actions"><button className="secondary-btn" onClick={() => void compareRotationsWithBackend()} disabled={rotationApiBusy || !backendApiEnabled || userSession?.mode !== 'server'}>{rotationApiBusy ? 'Comparing…' : 'Compare via backend'} <ArrowRight size={14}/></button><button className="primary-btn" onClick={() => go('Reports')}><FileText size={14}/> Generate report</button></div></SectionTitle>
          <div className="rotation-intro"><div><span className="pulse-dot"/><span>Current farm: {farm.name} · {farm.region}</span></div><div className="rotation-view-toggle"><button className={rotationView === 'Cards' ? 'active' : ''} onClick={() => setRotationView('Cards')} aria-pressed={rotationView === 'Cards'}>Cards</button><button className={rotationView === 'Table' ? 'active' : ''} onClick={() => setRotationView('Table')} aria-pressed={rotationView === 'Table'}>Table view</button></div></div>
          {rotationApiMessage && <div className={`api-message ${rotationApiResult ? 'api-message-success' : 'api-message-error'}`} role="status">{rotationApiMessage}</div>}
          {rotationView === 'Cards' && rotationApiResult && <div className="rotation-grid">{rotationApiResult.alternatives.map((alternative) => <article className="rotation-card rotation-card-live" key={alternative.id}><div className="rotation-head"><div><h3>{alternative.name}</h3><span className="rotation-badge recommended">BACKEND RESULT</span></div></div><div className="rotation-live-sequence">{alternative.crops.map((crop, index) => <span key={`${alternative.id}-${crop.season}-${crop.crop}`}>{index > 0 ? <b>→</b> : null}<strong>{crop.crop}</strong><small>{crop.season}</small></span>)}</div><div className="rotation-live-metrics">{alternative.metrics.map((metric) => <div key={metric.key}><span>{metric.label}</span><strong>{metric.value === null ? 'Not supplied' : `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`}</strong><small>{metric.quality || 'Quality not specified'}</small></div>)}</div><div className="rotation-live-notes"><div><strong>Benefits</strong><ul>{alternative.benefits.map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Trade-offs</strong><ul>{alternative.trade_offs.map((item) => <li key={item}>{item}</li>)}</ul></div></div>{alternative.constraints.length > 0 && <p className="muted-note">Constraints to verify: {alternative.constraints.join('; ')}</p>}{alternative.evidence?.length ? <p className="muted-note">Evidence: {alternative.evidence.join('; ')}</p> : null}{typeof alternative.confidence === 'number' && <small>Backend confidence: {Math.round(alternative.confidence <= 1 ? alternative.confidence * 100 : alternative.confidence)}%</small>}</article>)}</div>}
          {rotationView === 'Cards' && !rotationApiResult && <div className="rotation-grid">{cropPlans.map((plan) => <CropCard key={plan.name} plan={plan} onDetails={(name) => setRotationDetail(rotationDetail === name ? null : name)}/>)}</div>}
          {rotationDetail && rotationView === 'Cards' && <section className="panel rotation-detail-panel"><button className="detail-close" onClick={() => setRotationDetail(null)} aria-label="Close rotation details"><X size={15}/></button><span className="eyebrow">ROTATION DETAILS</span><h3>{rotationDetail}</h3><p>This is a visual comparison scaffold. FarmShift must connect a validated crop suitability engine and local agronomic evidence before scoring or recommending this sequence.</p><div className="detail-facts"><span><Droplets size={15}/> Check irrigation access</span><span><Leaf size={15}/> Validate soil response</span><span><BarChart3 size={15}/> Confirm local economics</span></div></section>}
          {rotationView === 'Table' && rotationApiResult && <section className="panel rotation-table-panel"><table><thead><tr><th>Alternative</th><th>Sequence</th><th>Returned metrics</th><th>Constraints</th><th>Evidence</th></tr></thead><tbody>{rotationApiResult.alternatives.map((alternative) => <tr key={alternative.id}><td>{alternative.name}</td><td>{alternative.crops.map((crop) => `${crop.crop} (${crop.season})`).join(' → ')}</td><td>{alternative.metrics.map((metric) => `${metric.label}: ${metric.value ?? 'N/A'}${metric.unit ? ` ${metric.unit}` : ''}`).join('; ') || 'Not supplied'}</td><td>{alternative.constraints.join('; ') || 'Not supplied'}</td><td>{alternative.evidence?.join('; ') || 'Not supplied'}</td></tr>)}</tbody></table></section>}
          {rotationView === 'Table' && !rotationApiResult && <section className="panel rotation-table-panel"><table><thead><tr><th>Plan</th><th>Sequence</th><th>Soil health</th><th>Water resilience</th><th>Status</th></tr></thead><tbody>{cropPlans.map((plan) => <tr key={plan.name}><td><button className="table-plan-link" onClick={() => { setRotationView('Cards'); setRotationDetail(plan.name) }}>{plan.name}</button></td><td>{plan.crops.map((crop) => crop.name).join(' → ')}</td><td>{plan.values[0][1]}%</td><td>{plan.values[1][1]}%</td><td>Illustrative demo</td></tr>)}</tbody></table></section>}
          <p className="source-footnote">Crop photographs are for visual reference only. Suitability percentages shown above are mock values, not model outputs or agronomic recommendations.</p>
        </>}

        {section === 'Reports' && <>
          <SectionTitle eyebrow="REPORTS & DOWNLOADS" title="Reports" subtitle={backendApiEnabled ? 'Generate a report from the connected farm and analysis services.' : 'Preview the report layout; exports remain clearly labelled demo files until API mode is enabled.'}><button className="primary-btn" onClick={() => void generateBackendReport()}><Download size={14}/>{backendApiEnabled ? 'Generate backend report' : 'Download demo report'}</button></SectionTitle>
          <div className="reports-api-toolbar">{backendApiEnabled && userSession?.mode === 'server' && <><button className="secondary-btn" onClick={() => void loadBackendReports()} disabled={reportsApiBusy}>{reportsApiBusy ? 'Loading reports…' : 'Refresh backend reports'}</button>{reportsApiMessage && <span role="status">{reportsApiMessage}</span>}</>}</div>
          <div className="reports-layout"><section className="panel report-library"><div className="panel-title"><h3>{backendApiEnabled && userSession?.mode === 'server' ? 'Reports from your account' : 'Recent reports'}</h3><span className="report-count">{backendApiEnabled && userSession?.mode === 'server' ? `${remoteReports.length} backend reports` : '3 sample reports'}</span></div>{backendApiEnabled && userSession?.mode === 'server' ? (remoteReports.length ? remoteReports.map((report) => <div className="backend-report-list-item" key={report.id}><span className="backend-report-kind"><FileText size={18}/></span><span className="backend-report-main"><strong>{report.title}</strong><small>{report.type} · {new Date(report.created_at).toLocaleString()}</small><em>Status: {report.status}</em></span><span className="backend-report-actions">{report.status === 'ready' ? <button className="secondary-btn" onClick={() => void downloadBackendReport(report.id)}><Download size={13}/> Download</button> : <button className="secondary-btn" onClick={() => void refreshBackendReport(report.id)}>Check status</button>}</span></div>) : <div className="report-empty-state"><h4>No backend reports loaded</h4><p>Refresh to request the current farm’s report list, or generate a new report above.</p><button className="secondary-btn" onClick={() => void loadBackendReports()} disabled={reportsApiBusy}>Load reports</button></div>) : [{ name: `${targetRegion} Farm Analysis`, date: 'Generated · Demo', image: cropPhotos.soybean, type: 'Field report' }, { name: 'Rotation Comparison', date: 'Generated · Demo', image: cropPhotos.chickpea, type: 'Crop plan' }, { name: 'Soil & Climate Summary', date: 'Generated · Demo', image: cropPhotos.wheat, type: 'Climate report' }].map((report, index) => <motion.button key={report.name} whileHover={{ x: 2 }} className={`report-list-item ${selectedReport === index ? 'active' : ''}`} onClick={() => setSelectedReport(index)} aria-pressed={selectedReport === index}><img src={report.image} alt="Crop photograph for report"/><span><strong>{report.name}</strong><small>{report.date}</small><em>{report.type}</em></span><ArrowRight size={16}/></motion.button>)}</section>
            <section className="report-preview-shell"><div className="report-preview"><div className="report-cover-image"><img src={[cropPhotos.soybean, cropPhotos.chickpea, cropPhotos.wheat][selectedReport]} alt="Crop field for report cover"/><div className="report-cover-overlay"><div className="report-brand"><Leaf size={20} fill="currentColor"/> FarmShift</div><small>EARTH INTELLIGENCE · FARM REPORT</small><h2>{['Farm Analysis Report', 'Rotation Comparison', 'Soil & Climate Summary'][selectedReport]}</h2><p>{REGIONS[targetRegion].label}</p></div><span className="report-demo-watermark">DEMO PREVIEW</span></div><div className="report-preview-body"><p>Farm profile · {season}</p><h3>{farm.name}</h3><div className="report-stat-row"><span><strong>{farm.area && Number(farm.area) > 0 ? (units.area === 'Acres' ? (Number(farm.area) * 2.47105).toFixed(1) : farm.area) : '—'}</strong><small>{units.area}</small></span><span><strong>{farm.kharif}</strong><small>Kharif crop</small></span><span><strong>{farm.rabi}</strong><small>Rabi crop</small></span></div><h4>Report includes</h4><ul>{['Farm location and boundary', 'Environmental summary', 'Crop rotation comparison', 'Benefits, trade-offs and risks', 'Data sources and limitations'].map((text) => <li key={text}><CheckCircle2 size={14}/>{text}</li>)}</ul><div className="report-actions">{!backendApiEnabled && <button className="primary-btn" onClick={downloadDemoReport}><Download size={14}/> Download demo (.txt)</button>}<button className="secondary-btn" onClick={printReport}><Printer size={14}/> Print / Save PDF</button></div></div></div></section></div>
          <p className="source-footnote">{backendApiEnabled && userSession?.mode === 'server' ? 'Backend report files and status are listed at left. The document preview remains illustrative until the backend returns a ready report.' : 'Exports are demo content only. Printing uses the browser print dialog; the downloadable file is plain text until a report-generation service is connected.'}</p>
        </>}

        {section === 'Settings' && <>
          <SectionTitle eyebrow="PREFERENCES" title="Settings" subtitle="Customize how FarmShift displays language, maps and information."/>
          <section className="panel settings-workspace"><div className="settings-tabs">{['Language', 'Map Preferences', 'Units', 'Appearance', 'Data Display'].map((tab) => <button key={tab} onClick={() => setSettingsTab(tab)} className={settingsTab === tab ? 'active' : ''}>{tab}</button>)}</div>
            {settingsTab === 'Language' && <div className="settings-section"><h3>Select language</h3><p>Choose the language used for navigation and supported labels.</p><div className="language-card-grid">{[{ value: 'en' as Lang, name: 'English', native: 'English', symbol: 'EN', subtitle: 'Continue in English' }, { value: 'mr' as Lang, name: 'Marathi', native: 'मराठी', symbol: 'म', subtitle: 'मराठीमध्ये पुढे जा' }, { value: 'hi' as Lang, name: 'Hindi', native: 'हिन्दी', symbol: 'हि', subtitle: 'हिन्दी में जारी रखें' }].map((item) => <button key={item.value} className={`language-card ${lang === item.value ? 'active' : ''}`} onClick={() => setLang(item.value)}><span className={`language-symbol ${item.value}`}>{item.symbol}</span><strong>{item.native}</strong><small>{item.subtitle}</small>{lang === item.value && <CheckCircle2 size={16} className="language-check"/>}</button>)}</div></div>}
            {settingsTab === 'Map Preferences' && <div className="settings-section"><h3>Map display style</h3><p>Satellite, street and light basemaps are functional. 3D terrain uses global elevation tiles; thematic agriculture rasters still require backend sources.</p><div className="map-style-grid">{[{ name: 'Liberty', caption: 'Street basemap', cls: 'style-liberty' }, { name: 'Positron', caption: 'Light basemap', cls: 'style-positron' }, { name: 'Satellite', caption: 'Esri imagery', cls: 'style-satellite' }, { name: '3D terrain', caption: 'Global elevation DEM', cls: 'style-terrain' }].map((item) => <button className={`map-style-card ${(item.name === 'Satellite' && mapBasemap === 'satellite') || (item.name === 'Liberty' && mapBasemap === 'streets') || (item.name === 'Positron' && mapBasemap === 'light') || (item.name === '3D terrain' && mapTerrain) ? 'active' : ''}`} key={item.name} aria-pressed={(item.name === 'Satellite' && mapBasemap === 'satellite') || (item.name === 'Liberty' && mapBasemap === 'streets') || (item.name === 'Positron' && mapBasemap === 'light') || (item.name === '3D terrain' && mapTerrain)} onClick={() => { if (item.name === 'Satellite') { setMapBasemap('satellite'); setActiveLayer('Satellite imagery') } if (item.name === 'Liberty') { setMapBasemap('streets'); setActiveLayer('Street map') } if (item.name === 'Positron') { setMapBasemap('light'); setActiveLayer('Light basemap') } if (item.name === '3D terrain') { setMapTerrain(true); setActiveLayer('3D terrain') } go('Explore Earth') }}><span className={`map-style-thumb ${item.cls}`}/><strong>{item.name}</strong><small>{item.caption}</small>{((item.name === 'Satellite' && mapBasemap === 'satellite') || (item.name === 'Liberty' && mapBasemap === 'streets') || (item.name === 'Positron' && mapBasemap === 'light') || (item.name === '3D terrain' && mapTerrain)) && <Check size={14}/>}</button>)}</div></div>}
            {settingsTab === 'Units' && <div className="settings-section"><h3>Measurement units</h3><p>Choose how values are displayed. Farm area is stored internally in hectares.</p><div className="setting-row"><div><strong>Area</strong><small>Farm list and report summaries</small></div><select value={units.area} onChange={(event) => setUnits((old) => ({ ...old, area: event.target.value as UnitPreferences['area'] }))}><option>Hectares</option><option>Acres</option></select></div><div className="setting-row"><div><strong>Rainfall</strong><small>Climate charts</small></div><select value={units.rainfall} onChange={(event) => setUnits((old) => ({ ...old, rainfall: event.target.value as UnitPreferences['rainfall'] }))}><option>Millimetres</option><option>Inches</option></select></div><div className="setting-row"><div><strong>Temperature</strong><small>Climate charts</small></div><select value={units.temperature} onChange={(event) => setUnits((old) => ({ ...old, temperature: event.target.value as UnitPreferences['temperature'] }))}><option>Celsius</option><option>Fahrenheit</option></select></div></div>}
            {settingsTab === 'Appearance' && <div className="settings-section"><h3>Appearance</h3><div className="appearance-choice"><button className={!dark ? 'active' : ''} onClick={() => setDark(false)}><Sun size={17}/><strong>Light</strong><small>Bright workspace</small></button><button className={dark ? 'active' : ''} onClick={() => setDark(true)}><Moon size={17}/><strong>Dark</strong><small>Low-light workspace</small></button></div></div>}
            {settingsTab === 'Data Display' && <div className="settings-section"><h3>Data visibility</h3>{[{ key: 'boundaries' as const, title: 'Show field boundaries by default', sub: 'Illustrative farm polygons remain labelled as demo.' }, { key: 'terrain' as const, title: 'Enable 3D terrain view', sub: 'Uses a global elevation DEM and angled camera in the map workspace.' }, { key: 'dataSource' as const, title: 'Show source notes in footer', sub: 'Keep source and demo-data reminders visible.' }, { key: 'reduceMotion' as const, title: 'Reduce motion', sub: 'Reduce animation and transitions.' }].map((item) => { const enabled = item.key === 'boundaries' ? mapBoundaries : item.key === 'terrain' ? mapTerrain : prefs[item.key]; return <div className="setting-row" key={item.key}><div><strong>{item.title}</strong><small>{item.sub}</small></div><button className={`toggle ${enabled ? 'on' : ''}`} onClick={() => { const next = !enabled; setPrefs((old) => ({ ...old, [item.key]: next })); if (item.key === 'boundaries') setMapBoundaries(next); if (item.key === 'terrain') setMapTerrain(next) }} aria-label={`Toggle ${item.title}`} aria-pressed={enabled}><span/></button></div>})}</div>}
          </section>
          <div className="settings-footnote"><span><CheckCircle2 size={16}/> Preferences update this interface immediately.</span><div className="settings-api-status"><span className={`backend-state-pill ${backendApiEnabled ? backendConnection : 'disabled'}`}>API: {backendApiEnabled ? backendConnection : 'disabled'}</span><button className="secondary-btn" onClick={() => void checkBackendConnection()} disabled={backendConnection === 'checking'}>Test backend connection</button><button className="secondary-btn" onClick={() => void syncPreferencesToBackend()} disabled={!backendApiEnabled || userSession?.mode !== 'server'}>Sync preferences</button><span>{backendConnectionMessage}</span></div><small>To enable API writes, set <code>VITE_BACKEND_MODE=api</code> and implement the route contract in <code>docs/API-CONTRACT.md</code>.</small></div>
        </>}
      </motion.div></AnimatePresence>
      <footer className="app-footer"><span>FarmShift · Earth intelligence for resilient farming</span>{prefs.dataSource && <span>Demo values unless a source is explicitly connected</span>}</footer>
    </main>
    <ProfileAuthDialog open={authOpen} dark={dark} backendEndpoint={authLoginEndpoint} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
  </div>
}
