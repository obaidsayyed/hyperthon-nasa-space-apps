import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, LockKeyhole, X } from 'lucide-react'
import { farmApi } from '../lib/api'

export type FarmShiftSession = { name: string; email: string; mode: 'demo' | 'server' }

type Props = {
  open: boolean
  dark?: boolean
  backendEndpoint: string
  onClose: () => void
  onAuthenticated: (session: FarmShiftSession, token?: string) => void
}

export default function ProfileAuthDialog({ open, dark = false, backendEndpoint, onClose, onAuthenticated }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const hasBackend = Boolean(backendEndpoint.trim())

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (!email.trim() || !email.includes('@')) { setError('Enter a valid email address.'); return }
    if (!hasBackend && !name.trim()) { setError('Enter the name to use for this demo profile.'); return }
    if (hasBackend && password.length < 1) { setError('Enter your password.'); return }
    setBusy(true)
    try {
      if (hasBackend) {
        const body = await farmApi.auth.login({ email: email.trim(), password }, backendEndpoint)
        const token = body.token || body.access_token
        if (!token) throw new Error('The auth endpoint must return token or access_token. Ask the backend team to confirm docs/API-CONTRACT.md.')
        onAuthenticated({ name: body.user?.name || body.user?.full_name || email.split('@')[0], email: body.user?.email || email.trim(), mode: 'server' }, token)
      } else {
        // No password is requested or stored in demo mode. This is profile UI, not account security.
        onAuthenticated({ name: name.trim(), email: email.trim(), mode: 'demo' })
      }
      setPassword('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign in. Please try again.')
    } finally { setBusy(false) }
  }

  return <AnimatePresence>{open && <motion.div className="auth-overlay" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <motion.section className={`auth-dialog glass-surface ${dark ? 'auth-dialog-dark' : 'auth-dialog-light'}`} role="dialog" aria-modal="true" aria-labelledby="auth-title" initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.99 }} transition={{ duration: 0.2 }}>
      <button className="auth-close icon-btn" onClick={onClose} aria-label="Close sign-in dialog"><X size={17}/></button>
      <div className="auth-mark"><LockKeyhole size={20}/></div>
      <span className="section-kicker">FARMSHIFT PROFILE</span>
      <h2 id="auth-title">{hasBackend ? 'Sign in to your account' : 'Continue to FarmShift'}</h2>
      <p>{hasBackend ? 'Sign in through your configured FarmShift authentication service.' : 'Demo profile only. Farm data stays in this browser; secure accounts are not connected yet.'}</p>
      <form onSubmit={submit} className="auth-form">
        {!hasBackend && <label>Display name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" required/></label>}
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required/></label>
        {hasBackend && <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required/></label>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {!hasBackend && <p className="auth-demo-note">No password is collected or stored in demo mode. Set <code>VITE_BACKEND_MODE=api</code> and implement the login route in <code>docs/API-CONTRACT.md</code> to connect real backend authentication.</p>}
        <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : hasBackend ? 'Sign in' : 'Continue in demo mode'} <ArrowRight size={15}/></button>
      </form>
    </motion.section>
  </motion.div>}</AnimatePresence>
}
