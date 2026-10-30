import type { FeatureCollection } from 'geojson'

/**
 * FarmShift API client.
 * All route definitions live in this file so the backend can implement one agreed contract.
 * Set VITE_BACKEND_MODE=api to enable calls. With VITE_BACKEND_MODE=mock, UI demo data stays local
 * and AI Insights do not manufacture recommendations.
 */
const DEFAULT_API_BASE = 'http://localhost:8000'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, '')
export const BACKEND_MODE = (import.meta.env.VITE_BACKEND_MODE || 'mock').toLowerCase() === 'api' ? 'api' : 'mock'
export const backendApiEnabled = BACKEND_MODE === 'api'
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000)

export type ApiErrorBody = { code?: string; message?: string; details?: unknown; request_id?: string }
export class ApiError extends Error {
  status: number
  code: string
  details?: unknown
  requestId?: string
  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown, requestId?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

export type ApiEnvelope<T> = { data: T; request_id?: string; meta?: Record<string, unknown> }
export type CollectionResponse<T> = T[] | { items: T[]; total?: number; page?: number; page_size?: number; next_cursor?: string | null }
export type HealthResponse = { status: 'ok' | 'degraded' | 'error' | string; version?: string; services?: Record<string, string>; timestamp?: string }
export type RegionId = 'nagpur' | 'wardha'
export type CropSeason = { kharif: string; rabi: string; previous_crop: string; sowing_season: string }
export type FarmPayload = {
  name: string
  region_id: RegionId
  area_ha: number
  land_type: string
  crops: CropSeason
  water: { source: string; reliability: string }
  soil: { texture: string; test_status: string }
  constraints: string[]
  boundary_geojson?: FeatureCollection | null
}
export type FarmDto = {
  id: string
  name: string
  region_id: RegionId
  region_label?: string
  area_ha: number
  land_type: string
  crops: CropSeason
  water: { source: string; reliability: string }
  soil: { texture: string; test_status: string }
  constraints: string[]
  boundary_geojson?: FeatureCollection | null
  created_at?: string
  updated_at?: string
}
export type AuthLoginRequest = { email: string; password: string }
export type AuthUser = { id?: string; name?: string; full_name?: string; email: string; roles?: string[] }
export type AuthLoginResponse = { token?: string; access_token?: string; token_type?: string; expires_at?: string; user?: AuthUser }
export type RegionSearchResult = { id: string; name: string; region_id?: RegionId; latitude: number; longitude: number; type?: string }
export type ClimateMetricId = 'rainfall' | 'temperature' | 'soil_moisture' | 'ndvi'
export type ClimateObservation = { label: string; period_start: string; period_end: string; value: number | null; unit: string; source: string; quality: 'verified' | 'estimated' | 'missing' | string; spatial_resolution?: string | null }
export type ClimateSeriesResponse = { farm_id?: string; region_id: RegionId; metric: ClimateMetricId; aggregation: 'monthly' | 'seasonal' | 'annual' | string; unit: string; observations: ClimateObservation[]; source_notes?: string[]; generated_at?: string }
export type AnalysisRequest = { region_id: RegionId; season: string; farm_context?: Record<string, unknown>; boundary_geojson?: FeatureCollection | null }
export type AnalysisResponse = { analysis_id: string; status: 'queued' | 'processing' | 'complete' | 'failed' | string; created_at?: string; result?: Record<string, unknown>; error?: ApiErrorBody }
export type AiInsight = { id: string; title: string; summary: string; category: string; severity?: 'info' | 'watch' | 'warning' | 'critical' | string; confidence?: number | null; evidence?: { label: string; value?: string | number; source?: string; period?: string }[]; actions?: string[]; limitations?: string[]; created_at?: string }
export type AiInsightsResponse = { farm_id: string; analysis_id?: string; summary?: string; insights: AiInsight[]; data_quality?: { status: string; missing_inputs?: string[]; sources?: string[] }; generated_at: string; model?: string }
export type RotationComparisonRequest = { region_id: RegionId; season: string; current_rotation: CropSeason; farm_context: Record<string, unknown> }
export type RotationAlternative = { id: string; name: string; crops: { crop: string; season: string }[]; metrics: { key: string; label: string; value: number | null; unit?: string; quality?: string }[]; benefits: string[]; trade_offs: string[]; constraints: string[]; evidence?: string[]; confidence?: number | null }
export type RotationComparisonResponse = { farm_id: string; alternatives: RotationAlternative[]; data_quality?: { status: string; missing_inputs?: string[] }; generated_at: string }
export type ReportDto = { id: string; title: string; type: string; status: 'queued' | 'processing' | 'ready' | 'failed' | string; created_at: string; download_url?: string | null; error?: string | null }
export type UserPreferences = { language?: 'en' | 'mr' | 'hi'; area_unit?: 'ha' | 'acre'; rainfall_unit?: 'mm' | 'in'; temperature_unit?: 'c' | 'f'; appearance?: 'light' | 'dark'; map_basemap?: 'satellite' | 'streets' | 'light'; map_terrain?: boolean; map_boundaries?: boolean; reduce_motion?: boolean }
export type NotificationDto = { id: string; title: string; message: string; created_at: string; read_at?: string | null; level?: 'info' | 'success' | 'warning' | 'error' | string }
export type MapLayerDto = { id: string; name: string; type: 'raster' | 'vector' | 'terrain' | 'boundary' | string; url?: string; tilejson_url?: string; attribution?: string; enabled?: boolean; metadata?: Record<string, unknown> }

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return window.sessionStorage.getItem('farmshift:auth-token') } catch { return null }
}
function clientRequestId(): string {
  try { return crypto.randomUUID() } catch { return `fs-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
}
function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: { authenticated?: boolean; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS
  const timer = window.setTimeout(() => controller.abort(new DOMException('Request timed out', 'AbortError')), timeoutMs)
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Client-Request-Id', clientRequestId())
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = options.authenticated === false ? null : getSessionToken()
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  try {
    const response = await fetch(resolveUrl(path), { ...init, headers, signal: init.signal ?? controller.signal })
    if (!response.ok) {
      let errorBody: ApiErrorBody = {}
      try {
        const body = await response.json() as { error?: ApiErrorBody; detail?: string; message?: string; request_id?: string }
        errorBody = body.error ?? { message: body.detail || body.message, request_id: body.request_id }
      } catch { /* non-JSON error response */ }
      throw new ApiError(errorBody.message || `Request failed with HTTP ${response.status}`, response.status, errorBody.code, errorBody.details, errorBody.request_id)
    }
    if (response.status === 204) return undefined as T
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await response.json() as T | ApiEnvelope<T>
      if (body && typeof body === 'object' && 'data' in body) {
        const keys = Object.keys(body)
        if (keys.every((key) => ['data', 'request_id', 'meta'].includes(key))) return (body as ApiEnvelope<T>).data
      }
      return body as T
    }
    return await response.text() as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(`Request timed out after ${timeoutMs} ms`, 0, 'TIMEOUT')
    throw new ApiError(error instanceof Error ? error.message : 'Network request failed. Check API URL, server status and CORS settings.', 0, 'NETWORK_ERROR')
  } finally {
    window.clearTimeout(timer)
  }
}

export async function apiDownload(path: string): Promise<{ blob: Blob; fileName: string }> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers = new Headers({ Accept: 'application/pdf, application/octet-stream, application/json' })
  headers.set('X-Client-Request-Id', clientRequestId())
  const token = getSessionToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  try {
    const response = await fetch(resolveUrl(path), { headers, signal: controller.signal })
    if (response.status === 202) throw new ApiError('Report generation is still in progress. Refresh report status before downloading.', 202, 'REPORT_NOT_READY')
    if (!response.ok) {
      let message = `Download failed with HTTP ${response.status}`
      try { const body = await response.json() as { error?: ApiErrorBody; detail?: string }; message = body.error?.message || body.detail || message } catch { /* binary/text error */ }
      throw new ApiError(message, response.status, 'DOWNLOAD_FAILED')
    }
    const disposition = response.headers.get('content-disposition') || ''
    const fileName = disposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i)?.[1] || 'farmshift-report.pdf'
    return { blob: await response.blob(), fileName: decodeURIComponent(fileName.replace(/\"/g, '')) }
  } finally { window.clearTimeout(timer) }
}

const id = (value: string) => encodeURIComponent(value)
const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, String(value)) })
  const text = search.toString()
  return text ? `?${text}` : ''
}
const json = (method: string, payload?: unknown): RequestInit => ({ method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) })

/** Proposed, versioned backend routes. Align this catalog with the backend team before deployment. */
export const API_ROUTES = {
  health: '/health',
  auth: { login: '/v1/auth/login', logout: '/v1/auth/logout', me: '/v1/auth/me' },
  regions: { search: '/v1/regions/search', byId: (regionId: string) => `/v1/regions/${id(regionId)}` },
  farms: {
    collection: '/v1/farms',
    byId: (farmId: string) => `/v1/farms/${id(farmId)}`,
    boundary: (farmId: string) => `/v1/farms/${id(farmId)}/boundary`,
  },
  climate: {
    summary: (farmId: string) => `/v1/farms/${id(farmId)}/climate/summary`,
    series: (farmId: string) => `/v1/farms/${id(farmId)}/climate/series`,
  },
  analysis: { collection: (farmId: string) => `/v1/farms/${id(farmId)}/analysis`, byId: (farmId: string, analysisId: string) => `/v1/farms/${id(farmId)}/analysis/${id(analysisId)}` },
  aiInsights: { collection: (farmId: string) => `/v1/farms/${id(farmId)}/ai-insights`, byId: (farmId: string, insightId: string) => `/v1/farms/${id(farmId)}/ai-insights/${id(insightId)}` },
  rotations: { compare: (farmId: string) => `/v1/farms/${id(farmId)}/rotations/compare`, collection: (farmId: string) => `/v1/farms/${id(farmId)}/rotations` },
  reports: { collection: (farmId: string) => `/v1/farms/${id(farmId)}/reports`, byId: (reportId: string) => `/v1/reports/${id(reportId)}`, download: (reportId: string) => `/v1/reports/${id(reportId)}/download` },
  preferences: '/v1/users/me/preferences',
  notifications: { collection: '/v1/notifications', read: (notificationId: string) => `/v1/notifications/${id(notificationId)}/read` },
  mapLayers: '/v1/map/layers',
} as const

export const farmApi = {
  system: {
    health: () => apiRequest<HealthResponse>(API_ROUTES.health, {}, { authenticated: false, timeoutMs: 6000 }),
  },
  auth: {
    login: (payload: AuthLoginRequest, endpoint: string = API_ROUTES.auth.login) => apiRequest<AuthLoginResponse>(endpoint, json('POST', payload), { authenticated: false }),
    logout: (endpoint: string = API_ROUTES.auth.logout) => apiRequest<void>(endpoint, json('POST')),
    me: () => apiRequest<AuthUser>(API_ROUTES.auth.me),
  },
  regions: {
    search: (q: string, limit = 10) => apiRequest<CollectionResponse<RegionSearchResult>>(`${API_ROUTES.regions.search}${query({ q, limit })}`, {}, { authenticated: false }),
    get: (regionId: RegionId) => apiRequest<RegionSearchResult>(API_ROUTES.regions.byId(regionId), {}, { authenticated: false }),
  },
  farms: {
    list: (params: { regionId?: RegionId; page?: number; pageSize?: number; cursor?: string } = {}) => apiRequest<CollectionResponse<FarmDto>>(`${API_ROUTES.farms.collection}${query({ region_id: params.regionId, page: params.page, page_size: params.pageSize, cursor: params.cursor })}`),
    create: (payload: FarmPayload) => apiRequest<FarmDto>(API_ROUTES.farms.collection, json('POST', payload)),
    get: (farmId: string) => apiRequest<FarmDto>(API_ROUTES.farms.byId(farmId)),
    update: (farmId: string, payload: Partial<FarmPayload>) => apiRequest<FarmDto>(API_ROUTES.farms.byId(farmId), json('PATCH', payload)),
    remove: (farmId: string) => apiRequest<void>(API_ROUTES.farms.byId(farmId), { method: 'DELETE' }),
    getBoundary: (farmId: string) => apiRequest<FeatureCollection>(API_ROUTES.farms.boundary(farmId)),
    saveBoundary: (farmId: string, boundary: FeatureCollection) => apiRequest<FeatureCollection>(API_ROUTES.farms.boundary(farmId), json('PUT', { boundary_geojson: boundary })),
  },
  climate: {
    summary: (farmId: string, params: { season?: string; start?: string; end?: string } = {}) => apiRequest<Record<string, unknown>>(`${API_ROUTES.climate.summary(farmId)}${query(params)}`),
    series: (farmId: string, params: { metric: ClimateMetricId; aggregation: string; start?: string; end?: string }) => apiRequest<ClimateSeriesResponse>(`${API_ROUTES.climate.series(farmId)}${query(params)}`),
  },
  analysis: {
    create: (farmId: string, payload: AnalysisRequest) => apiRequest<AnalysisResponse>(API_ROUTES.analysis.collection(farmId), json('POST', payload)),
    get: (farmId: string, analysisId: string) => apiRequest<AnalysisResponse>(API_ROUTES.analysis.byId(farmId, analysisId)),
  },
  aiInsights: {
    generate: (farmId: string, payload: { region_id: RegionId; season: string; analysis_id?: string; questions?: string[] }) => apiRequest<AiInsightsResponse>(API_ROUTES.aiInsights.collection(farmId), json('POST', payload)),
    list: (farmId: string) => apiRequest<CollectionResponse<AiInsightsResponse>>(API_ROUTES.aiInsights.collection(farmId)),
    get: (farmId: string, insightId: string) => apiRequest<AiInsight>(API_ROUTES.aiInsights.byId(farmId, insightId)),
  },
  rotations: {
    compare: (farmId: string, payload: RotationComparisonRequest) => apiRequest<RotationComparisonResponse>(API_ROUTES.rotations.compare(farmId), json('POST', payload)),
    list: (farmId: string) => apiRequest<CollectionResponse<RotationComparisonResponse>>(API_ROUTES.rotations.collection(farmId)),
  },
  reports: {
    list: (farmId: string) => apiRequest<CollectionResponse<ReportDto>>(API_ROUTES.reports.collection(farmId)),
    create: (farmId: string, payload: { type: string; title?: string; analysis_id?: string; format?: 'pdf' | 'json' }) => apiRequest<ReportDto>(API_ROUTES.reports.collection(farmId), json('POST', payload)),
    get: (reportId: string) => apiRequest<ReportDto>(API_ROUTES.reports.byId(reportId)),
    download: (reportId: string) => apiDownload(API_ROUTES.reports.download(reportId)),
  },
  preferences: {
    get: () => apiRequest<UserPreferences>(API_ROUTES.preferences),
    update: (payload: Partial<UserPreferences>) => apiRequest<UserPreferences>(API_ROUTES.preferences, json('PATCH', payload)),
  },
  notifications: {
    list: (params: { unreadOnly?: boolean; limit?: number } = {}) => apiRequest<CollectionResponse<NotificationDto>>(`${API_ROUTES.notifications.collection}${query({ unread_only: params.unreadOnly, limit: params.limit })}`),
    markRead: (notificationId: string) => apiRequest<NotificationDto | void>(API_ROUTES.notifications.read(notificationId), json('POST')),
  },
  map: {
    layers: (regionId: RegionId) => apiRequest<CollectionResponse<MapLayerDto>>(`${API_ROUTES.mapLayers}${query({ region_id: regionId })}`, {}, { authenticated: false }),
  },
}

export function getEndpointCatalog() {
  return {
    baseUrl: API_BASE_URL,
    mode: BACKEND_MODE,
    timeoutMs: REQUEST_TIMEOUT_MS,
    endpoints: [
      ['GET', API_ROUTES.health, 'Health and readiness'],
      ['POST', API_ROUTES.auth.login, 'Authenticate user'], ['POST', API_ROUTES.auth.logout, 'Invalidate current session'], ['GET', API_ROUTES.auth.me, 'Current account'],
      ['GET', `${API_ROUTES.regions.search}?q=`, 'Search supported regions and locations'],
      ['GET / POST', API_ROUTES.farms.collection, 'List/create farms'], ['GET / PATCH / DELETE', '/v1/farms/{farm_id}', 'Read/update/delete farm'], ['GET / PUT', '/v1/farms/{farm_id}/boundary', 'Read/save GeoJSON boundary'],
      ['GET', '/v1/farms/{farm_id}/climate/summary', 'Climate summary'], ['GET', '/v1/farms/{farm_id}/climate/series', 'Climate chart observations'],
      ['POST / GET', '/v1/farms/{farm_id}/analysis', 'Start/retrieve analysis'], ['POST / GET', '/v1/farms/{farm_id}/ai-insights', 'Generate/list AI insights'],
      ['POST / GET', '/v1/farms/{farm_id}/rotations/compare', 'Compare crop rotations'], ['GET / POST', '/v1/farms/{farm_id}/reports', 'List/generate reports'], ['GET', '/v1/reports/{report_id}/download', 'Download generated report'],
      ['GET / PATCH', API_ROUTES.preferences, 'Read/update preferences'], ['GET / POST', API_ROUTES.notifications.collection, 'List notifications / mark read via /{id}/read'], ['GET', API_ROUTES.mapLayers, 'Map layer catalogue'],
    ] as const,
  }
}
