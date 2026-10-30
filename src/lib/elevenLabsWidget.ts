
const DEFAULT_AGENT_ID = 'agent_5301m64nw8dnenjrtta28828fwz3'
const EMBED_SCRIPT_ID = 'farmshift-elevenlabs-embed-script'
const WIDGET_ELEMENT_ID = 'farmshift-elevenlabs-widget'

/**
 * Accept either the bare agent ID or an ElevenLabs share URL. `branch_id` is
 * deliberately not copied into `agent-id`: the official ConvAI widget expects
 * only an agent ID and uses the agent's configured default branch.
 */
export function normalizeElevenLabsAgentId(rawValue?: string | null): string | null {
  if (!rawValue) return null
  const raw = rawValue.trim().replace(/^['"]|['"]$/g, '').replace(/\\&/g, '&')
  if (!raw) return null

  let candidate = raw
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      candidate = url.searchParams.get('agent_id') || url.searchParams.get('agent-id') || ''
    } catch {
      return null
    }
  } else if (/^[?&]?agent_id=/.test(raw)) {
    const params = new URLSearchParams(raw.replace(/^\?/, ''))
    candidate = params.get('agent_id') || ''
  } else {
    // Defensive cleanup for legacy env values that accidentally appended branch_id.
    candidate = raw.split(/[?&]/, 1)[0]
  }

  candidate = candidate.trim()
  return /^agent_[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null
}

let mounted = false

export function mountElevenLabsWidget(): void {
  if (typeof document === 'undefined' || mounted) return
  mounted = true

  const rawConfiguredId = import.meta.env.VITE_ELEVENLABS_AGENT_ID
  const agentId = normalizeElevenLabsAgentId(rawConfiguredId) || DEFAULT_AGENT_ID

  // Remove any static/legacy or HMR-created instances to guarantee one orb.
  document.querySelectorAll('elevenlabs-convai').forEach((element) => element.remove())

  const widget = document.createElement('elevenlabs-convai')
  widget.id = WIDGET_ELEMENT_ID
  widget.setAttribute('agent-id', agentId)
  widget.setAttribute('variant', 'compact')
  widget.setAttribute('dismissible', 'true')
  widget.setAttribute('avatar-orb-color-1', '#30D79B')
  widget.setAttribute('avatar-orb-color-2', '#68D7E9')
  widget.setAttribute('action-text', 'Talk to FarmShift')
  widget.setAttribute('start-call-text', 'Start conversation')
  widget.setAttribute('end-call-text', 'End conversation')
  widget.setAttribute('expand-text', 'Open FarmShift assistant')
  widget.setAttribute('collapse-text', 'Minimize assistant')
  // Do not force server-location=us. The account's region may differ; default
  // routing avoids sending all agents to api.us.elevenlabs.io accidentally.
  document.body.appendChild(widget)

  let script = document.getElementById(EMBED_SCRIPT_ID) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = EMBED_SCRIPT_ID
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed'
    script.async = true
    script.type = 'text/javascript'
    document.head.appendChild(script)
  }

  if (rawConfiguredId && !normalizeElevenLabsAgentId(rawConfiguredId)) {
    console.warn('[FarmShift] VITE_ELEVENLABS_AGENT_ID could not be parsed; falling back to the configured default Agent ID. Use a bare agent ID or an ElevenLabs talk-to URL.')
  }
}
