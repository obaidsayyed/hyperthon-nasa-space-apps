/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Use `mock` for browser-local demo mode or `api` once the backend implements docs/API-CONTRACT.md. */
  readonly VITE_BACKEND_MODE?: 'mock' | 'api' | string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_TIMEOUT_MS?: string
  readonly VITE_AUTH_LOGIN_ENDPOINT?: string
  readonly VITE_AUTH_LOGOUT_ENDPOINT?: string
  readonly VITE_GEOCODING_ENDPOINT?: string
  readonly VITE_MAP_STYLE_URL?: string
  /** Accepts an ElevenLabs agent ID or a share URL containing ?agent_id=...&branch_id=... */
  readonly VITE_ELEVENLABS_AGENT_ID?: string
}
