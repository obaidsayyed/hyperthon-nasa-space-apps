import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, Compass, Leaf,
  MapPinned, Moon, Satellite, Sprout, Sun, Waves, X,
} from 'lucide-react'
import EarthScene from './EarthScene'
import LandingAtmosphere from './LandingAtmosphere'
import { REGIONS, type RegionName } from '../lib/regions'

type LandingPageProps = {
  dark: boolean
  initialRegion: RegionName
  onToggleTheme: () => void
  onEnterWorkspace: (region: RegionName, destination: 'map' | 'workspace' | 'setup', quickProfile?: QuickFarmDraft) => void
  userSession?: { name: string; email: string; mode: 'demo' | 'server' } | null
  onOpenAuth?: () => void
  onLogOut?: () => void
  reduceMotionPreference?: boolean
}

const regionNames: RegionName[] = ['Nagpur', 'Wardha']

export type QuickFarmDraft = { area: string; kharif: string; rabi: string; water: string }
const emptyQuickFarmDraft: QuickFarmDraft = { area: '', kharif: '', rabi: '', water: '' }

function readQuickFarmDraft(): QuickFarmDraft {
  if (typeof window === 'undefined') return emptyQuickFarmDraft
  try {
    const selectedId = JSON.parse(window.localStorage.getItem('farmshift:active-farm-id') || '\"farm-01\"') as string
    const profiles = JSON.parse(window.localStorage.getItem('farmshift:farms') || '[]') as Array<Record<string, unknown>>
    const legacy = JSON.parse(window.localStorage.getItem('farmshift:farm') || '{}') as Record<string, unknown>
    const profile = profiles.find((item) => item.id === selectedId) ?? profiles[0] ?? legacy
    return {
      area: typeof profile.area === 'string' || typeof profile.area === 'number' ? String(profile.area) : '',
      kharif: typeof profile.kharif === 'string' ? profile.kharif : '',
      rabi: typeof profile.rabi === 'string' ? profile.rabi : '',
      water: typeof profile.water === 'string' ? profile.water : '',
    }
  } catch {
    return emptyQuickFarmDraft
  }
}

function Reveal({ children, className = '', delay = 0, reduceMotion = false }: { children: ReactNode; className?: string; delay?: number; reduceMotion?: boolean }) {
  const preference = useReducedMotion()
  const reduced = Boolean(preference || reduceMotion)
  return <motion.div className={className} initial={{ opacity: 0, y: reduced ? 0 : 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: reduced ? 0 : 0.62, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
}

export default function LandingPage({ dark, initialRegion, onToggleTheme, onEnterWorkspace, userSession = null, onOpenAuth, onLogOut, reduceMotionPreference = false }: LandingPageProps) {
  const preference = useReducedMotion()
  const reduced = Boolean(preference || reduceMotionPreference)
  const [activeRegion, setActiveRegion] = useState<RegionName>(initialRegion)
  const [profileDraft, setProfileDraft] = useState<QuickFarmDraft>(readQuickFarmDraft)
  const [profileMessage, setProfileMessage] = useState('')
  const [loading, setLoading] = useState<{ region: RegionName; destination: 'map' | 'workspace' | 'setup'; quickProfile?: QuickFarmDraft } | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const launch = (region: RegionName, destination: 'map' | 'workspace' | 'setup', quickProfile?: QuickFarmDraft) => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setActiveRegion(region)
    setLoading({ region, destination, quickProfile })
    timer.current = window.setTimeout(() => onEnterWorkspace(region, destination, quickProfile), reduced ? 80 : 920)
  }

  const saveQuickFarmProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const area = Number(profileDraft.area)
    if (!Number.isFinite(area) || area <= 0) {
      setProfileMessage('Enter a farm area greater than zero hectares.')
      return
    }
    if (!profileDraft.kharif || !profileDraft.rabi || !profileDraft.water) {
      setProfileMessage('Choose both crops and a water source to continue.')
      return
    }
    setProfileMessage('Saving your details and opening the full farm setup…')
    launch(activeRegion, 'setup', { ...profileDraft, area: String(area) })
  }

  return <main className={`public-landing ${dark ? 'theme-dark' : 'theme-light'}`}>
    <LandingAtmosphere />
    <header className="landing-nav glass-surface">
      <a className="landing-brand" href="#top" aria-label="FarmShift home"><span className="brand-symbol"><Leaf size={24} fill="currentColor"/></span><span><strong>FarmShift</strong><small>Earth intelligence for resilient farming</small></span></a>
      <nav className="landing-nav-links" aria-label="Landing page navigation"><a href="#approach">How it works</a><a href="#regions">Regions</a><a href="#layers">Earth data</a></nav>
      <div className="landing-nav-actions"><button className="landing-account-button glass-surface" onClick={() => userSession ? onLogOut?.() : onOpenAuth?.()} title={userSession ? 'Sign out of this FarmShift session' : 'Sign in to FarmShift'}>{userSession ? `Sign out · ${userSession.name}` : 'Sign in'}</button><button className="landing-theme-toggle glass-icon-button" onClick={onToggleTheme} aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`}>{dark ? <Sun size={17}/> : <Moon size={17}/>}</button><motion.button className="landing-cta landing-cta-small" whileHover={reduced ? undefined : { y: -2 }} whileTap={{ scale: 0.97 }} onClick={() => launch(activeRegion, 'workspace')}>Open workspace <ArrowUpRight size={16}/></motion.button></div>
    </header>

    <section className="landing-hero" id="top">
      <motion.div className="landing-hero-copy">
        <motion.div className="landing-eyebrow" initial={{ opacity: 0, x: reduced ? 0 : -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduced ? 0 : 0.55 }}><span className="eyebrow-live-dot"/> BUILT FOR VIDARBHA FARMING</motion.div>
        <motion.h1 initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.72, delay: 0.08 }}>Know your land<br/>before you <em>plant.</em></motion.h1>
        <motion.p className="landing-lede" initial={{ opacity: 0, y: reduced ? 0 : 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.64, delay: 0.17 }}>A clearer view of your fields, seasons and water constraints. FarmShift brings Earth imagery and farm planning into one place for Nagpur and Wardha.</motion.p>
        <motion.div className="landing-hero-actions" initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.6, delay: 0.25 }}>
          <motion.button className="landing-cta landing-cta-primary" whileHover={reduced ? undefined : { y: -3, boxShadow: '0 15px 42px rgba(23,143,194,.24)' }} whileTap={{ scale: 0.98 }} onClick={() => launch(activeRegion, 'map')}>Explore the map <ArrowRight size={17}/></motion.button>
          <motion.button className="landing-cta landing-cta-secondary glass-surface" whileHover={reduced ? undefined : { y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => launch(activeRegion, 'setup')}><Sprout size={17}/> Set up a farm</motion.button>
        </motion.div>
        <motion.div className="landing-trust-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.42 }}><span><Satellite size={16}/> Earth imagery</span><i/><span><MapPinned size={16}/> Field-first workflow</span><i/><span><Waves size={16}/> Water-aware planning</span></motion.div>
      </motion.div>

      <div className="landing-earth-wrap">
        <div className="earth-stage-label stage-label-top glass-surface"><span><strong>NASA BLUE MARBLE</strong><small>Global Earth imagery · 2004 composite</small></span></div>
        <EarthScene region={activeRegion} onOpenFullMap={(region) => launch(region, 'map')} reduceMotion={Boolean(reduced)}/>
        <div className="earth-stage-label stage-label-bottom glass-surface"><span className="coordinate-pulse"/><span><strong>{REGIONS[activeRegion].label}</strong><small>{REGIONS[activeRegion].latitude}° N · {REGIONS[activeRegion].longitude}° E</small></span><button aria-label="Open selected region map" onClick={() => launch(activeRegion, 'map')}>Open full map <ArrowUpRight size={15}/></button></div>
      </div>
      <motion.div className="landing-scroll-hint" initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.5, delay: 0.6 }}><span>Scroll to explore</span><ArrowDown size={15}/></motion.div>
    </section>

    <section className="landing-proof-strip" id="layers">
      <Reveal className="proof-intro" reduceMotion={reduced}><span className="section-kicker">ONE WORKSPACE · THREE SOURCES OF CONTEXT</span><h2>See the field.<br/>Plan the next season.</h2></Reveal>
      <Reveal className="proof-item" delay={0.07} reduceMotion={reduced}><span className="proof-number">01</span><div><Satellite size={20}/><h3>See the landscape</h3><p>Start with satellite and street basemaps, then zoom into the area you manage.</p></div></Reveal>
      <Reveal className="proof-item" delay={0.14} reduceMotion={reduced}><span className="proof-number">02</span><div><Compass size={20}/><h3>Add field context</h3><p>Keep field boundaries, crop history, soil notes and water access together.</p></div></Reveal>
      <Reveal className="proof-item" delay={0.21} reduceMotion={reduced}><span className="proof-number">03</span><div><Sprout size={20}/><h3>Compare decisions</h3><p>Compare crop choices against water availability and the season ahead.</p></div></Reveal>
    </section>

    <section className="landing-regions" id="regions">
      <Reveal className="region-section-heading" reduceMotion={reduced}><div><span className="section-kicker">START WITH YOUR REGION</span><h2>Choose where to begin.</h2><p>Open the map at either target region. The same workspace tools are available in both.</p></div><span className="region-count glass-surface">02 <small>target regions</small></span></Reveal>
      <div className="landing-region-grid">{regionNames.map((region, index) => {
        const meta = REGIONS[region]
        const isSelected = activeRegion === region
        return <Reveal className="landing-region-reveal" delay={index * 0.08} key={region} reduceMotion={reduced}><article className={`landing-region-card glass-surface ${isSelected ? 'region-selected' : ''}`}>
          <div className={`region-card-art region-art-${region.toLowerCase()}`}>
            <img className="region-card-photo" src={region === 'Nagpur' ? 'https://upload.wikimedia.org/wikipedia/commons/b/b6/Aerial_view_of_Nagpur.jpg' : 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Another_photo_of_Field_visit_at_Turmeric_field_at_Khairagaon_village.jpg'} alt={region === 'Nagpur' ? 'Aerial photograph of Nagpur city' : 'Field visit at a turmeric farm in Wardha district'} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />
            <span className="region-district-tag">{region === 'Nagpur' ? 'NAGPUR · MAHARASHTRA' : 'WARDHA DISTRICT · MAHARASHTRA'}</span>
            <span className="region-photo-credit">{region === 'Nagpur' ? 'Aerial view · CC0' : 'Farm visit · Khairagaon · CC0'}</span>
          </div>
          <div className="region-card-content"><div><span className="region-card-number">0{index + 1} / TARGET REGION</span><h3>{region}</h3><p>{meta.description}. Open an in-app map view to inspect the surrounding landscape.</p></div><div className="region-card-footer"><button className="region-select-link" onClick={() => setActiveRegion(region)} aria-pressed={isSelected}>{isSelected ? <><Check size={15}/> Selected</> : 'Select region'}</button><motion.button className="region-open-link" whileHover={reduced ? undefined : { x: 3 }} onClick={() => launch(region, 'map')}>Open full map <ArrowUpRight size={16}/></motion.button></div></div>
        </article></Reveal>
      })}</div>
    </section>

    <section className="landing-bottom-cta glass-surface" id="approach">
      <Reveal className="landing-bottom-copy" reduceMotion={reduced}><span className="section-kicker">YOUR FARM PROFILE STARTS HERE</span><h2>Field details in.<br/><em>Clearer choices ahead.</em></h2><p>Record the land area you know, your Kharif and Rabi crops, soil texture and water source. FarmShift keeps those details together so your next season plan has a real starting point.</p><div className="landing-bottom-actions"><motion.button className="landing-cta landing-cta-primary" whileHover={reduced ? undefined : { y: -3 }} whileTap={{ scale: 0.98 }} onClick={() => launch(activeRegion, 'setup')}>Fill farm details <ArrowRight size={17}/></motion.button><button className="landing-cta landing-cta-secondary glass-surface" onClick={() => launch(activeRegion, 'map')}>Open full map <ArrowUpRight size={16}/></button></div><small className="demo-disclosure">Profiles are saved in this browser until the backend connection is added.</small></Reveal>
      <div className="bottom-farm-preview">
        <div className="bottom-farm-photo-wrap">
          <img className="bottom-farm-photo" src={activeRegion === 'Nagpur' ? 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Farm_near_Nagpur%2C_India_2021.jpg' : 'https://upload.wikimedia.org/wikipedia/commons/a/a3/Another_photo_of_Field_visit_at_Turmeric_field_at_Khairagaon_village.jpg'} alt={activeRegion === 'Nagpur' ? 'Agricultural farm near Nagpur at sunset' : 'Agricultural field in Khairagaon, Wardha district'} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />
          <div className="bottom-photo-scrim" />
          <div className="bottom-photo-heading"><span>FIELD PROFILE PREVIEW</span><strong>{REGIONS[activeRegion].label}</strong></div>
          <span className="bottom-photo-credit">{activeRegion === 'Nagpur' ? 'Photo: Ross jobs · CC BY-SA 4.0' : 'Photo: Gaydhane Natural Farm · CC0'}</span>
        </div>
        <div className="bottom-profile-details">
          <div className="bottom-profile-heading"><div><span className="section-kicker">EXAMPLE PROFILE</span><h3>Farm Field 01</h3></div><span className="profile-status">Draft</span></div>
          <form className="bottom-profile-form" onSubmit={saveQuickFarmProfile}>
            <label><span>Farm area (hectares)</span><input type="number" min="0.1" step="0.1" required value={profileDraft.area} onChange={(event) => { setProfileDraft((draft) => ({ ...draft, area: event.target.value })); setProfileMessage('') }} placeholder="e.g. 2.5" /></label>
            <label><span>Kharif crop</span><select required value={profileDraft.kharif} onChange={(event) => { setProfileDraft((draft) => ({ ...draft, kharif: event.target.value })); setProfileMessage('') }}><option value="">Choose crop</option><option>Soybean</option><option>Cotton</option><option>Pigeon pea</option><option>Sorghum</option><option>Maize</option><option>Rice</option></select></label>
            <label><span>Rabi crop</span><select required value={profileDraft.rabi} onChange={(event) => { setProfileDraft((draft) => ({ ...draft, rabi: event.target.value })); setProfileMessage('') }}><option value="">Choose crop</option><option>Wheat</option><option>Chickpea</option><option>Lentil</option><option>Sorghum</option><option>Mustard</option><option>Vegetables</option></select></label>
            <label><span>Water source</span><select required value={profileDraft.water} onChange={(event) => { setProfileDraft((draft) => ({ ...draft, water: event.target.value })); setProfileMessage('') }}><option value="">Choose source</option><option>Rain-fed</option><option>Borewell</option><option>Open well</option><option>Canal</option><option>Farm pond</option><option>Other</option></select></label>
            <div className="bottom-profile-form-footer"><small>Saved locally in this browser. No backend connection is assumed.</small><button type="submit" className="bottom-profile-edit">Save details & continue <ArrowRight size={15}/></button></div>
            {profileMessage && <p className="bottom-profile-message" role="status">{profileMessage}</p>}
          </form>
        </div>
      </div>
    </section>

    <footer className="landing-footer"><a className="landing-brand" href="#top"><span className="brand-symbol"><Leaf size={22} fill="currentColor"/></span><span><strong>FarmShift</strong><small>Earth intelligence for resilient farming</small></span></a><p>Designed for the farming context of Nagpur and Wardha, Maharashtra.</p><a href="#top" className="footer-back-top">Back to top ↑</a></footer>

    <AnimatePresence>{loading && <motion.div className="landing-loading-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.24 }} role="status" aria-live="polite"><motion.div className="loading-glass-card glass-surface" initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}><p className="loading-eyebrow">FARMSHIFT WORKSPACE</p><h2>{loading.destination === 'map' ? `Opening ${loading.region}` : loading.destination === 'setup' ? 'Preparing your farm setup' : 'Opening your workspace'}</h2><p className="loading-detail">Aligning your selected region and workspace tools.</p><div className="loading-progress"><motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: reduced ? 0.08 : 0.82, ease: 'easeInOut' }}/></div><button className="loading-cancel" onClick={() => { if (timer.current !== null) window.clearTimeout(timer.current); setLoading(null) }}><X size={14}/> Cancel</button></motion.div></motion.div>}</AnimatePresence>
  </main>
}
