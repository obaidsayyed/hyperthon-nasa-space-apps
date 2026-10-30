import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { ArrowUpRight, ChevronDown, MapPin } from 'lucide-react'
import { REGIONS, type RegionName } from '../lib/regions'

// NASA Blue Marble: Next Generation. The jsDelivr URL is a mirror of the
// Blue Marble texture used by the open-source three-globe examples.
const EARTH_TEXTURES = [
  { url: 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg', source: 'NASA Earth Observatory · Blue Marble' },
  // Fallback copies use the same Blue Marble global texture bundled by the open-source three-globe example.
  { url: 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg', source: 'Blue Marble texture mirror' },
  { url: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg', source: 'Blue Marble texture mirror' },
]
const EARTH_RADIUS = 1.5

type EarthProps = {
  region: RegionName
  reduceMotion?: boolean
  onOpenFullMap: (region: RegionName) => void
  onTextureReady: (source: string) => void
  onTextureError: () => void
}

// SphereGeometry uses a seam at -180° longitude. This projection follows its
// UV convention, so map markers sit on the corresponding real-world location.
function geoToSphere(lng: number, lat: number, radius: number): [number, number, number] {
  const phi = ((lng + 180) * Math.PI) / 180
  const theta = ((90 - lat) * Math.PI) / 180
  return [
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
  ]
}

function rotationToFace(lng: number, lat: number): number {
  const [x, , z] = geoToSphere(lng, lat, 1)
  return Math.atan2(-x, z)
}

function RegionMarker({ region, onOpenFullMap }: { region: RegionName; onOpenFullMap: (region: RegionName) => void }) {
  const meta = REGIONS[region]
  const [expanded, setExpanded] = useState(false)
  const [lng, lat] = meta.coordinates
  const [x, y, z] = geoToSphere(lng, lat, EARTH_RADIUS * 1.018)
  const isNagpur = region === 'Nagpur'
  return <Html
    position={[x, y, z]}
    center
    occlude
    zIndexRange={[30, 0]}
    style={{ pointerEvents: 'auto' }}
  >
    <div className={`globe-pin-root ${isNagpur ? 'pin-nagpur' : 'pin-wardha'}`}>
      <span className="globe-pin-core" aria-hidden="true" />
      <span className="globe-pin-pulse" aria-hidden="true" />
      <section className="globe-pin-card" aria-label={`${region} location marker`} onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" className="globe-pin-card-title" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          <MapPin size={14} strokeWidth={2.3}/><strong>{region}</strong><span>MH</span><ChevronDown size={13} className={expanded ? 'expanded' : ''}/>
        </button>
        <small>{meta.latitude}° N · {meta.longitude}° E</small>
        {expanded && <button type="button" className="globe-pin-open-map" onClick={() => onOpenFullMap(region)}>Open full map <ArrowUpRight size={13}/></button>}
      </section>
    </div>
  </Html>
}

function Earth({ region, reduceMotion = false, onOpenFullMap, onTextureReady, onTextureError }: EarthProps) {
  const group = useRef<THREE.Group>(null)
  const [earthMap, setEarthMap] = useState<THREE.Texture | null>(null)
  const animationStarted = useRef(false)

  useEffect(() => {
    let cancelled = false
    let activeTexture: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    const tryTexture = (index: number) => {
      if (cancelled) return
      if (index >= EARTH_TEXTURES.length) {
        onTextureError()
        return
      }
      loader.load(
        EARTH_TEXTURES[index].url,
        (texture) => {
          if (cancelled) {
            texture.dispose()
            return
          }
          activeTexture = texture
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = 8
          texture.wrapS = THREE.RepeatWrapping
          setEarthMap(texture)
          onTextureReady(EARTH_TEXTURES[index].source)
        },
        undefined,
        () => tryTexture(index + 1),
      )
    }

    tryTexture(0)
    return () => {
      cancelled = true
      activeTexture?.dispose()
    }
  }, [onTextureError, onTextureReady])

  useEffect(() => {
    if (group.current) {
      group.current.rotation.y = rotationToFace(...REGIONS[region].coordinates)
      animationStarted.current = true
    }
  }, [region])

  useFrame((_, delta) => {
    if (!reduceMotion && group.current && animationStarted.current) {
      // A slow drift adds life without moving the target districts out of view.
      group.current.rotation.y += delta * 0.015
    }
  })

  return <group ref={group}>
    {earthMap && <>
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshStandardMaterial map={earthMap} roughness={0.96} metalness={0.015} />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshBasicMaterial color="#3b9fe8" side={THREE.BackSide} transparent opacity={0.13} />
      </mesh>
      <RegionMarker region="Nagpur" onOpenFullMap={onOpenFullMap} />
      <RegionMarker region="Wardha" onOpenFullMap={onOpenFullMap} />
    </>}
  </group>
}

export default function EarthScene({ region, onOpenFullMap, reduceMotion = false }: { region: RegionName; onOpenFullMap: (region: RegionName) => void; reduceMotion?: boolean }) {
  const [textureLoaded, setTextureLoaded] = useState(false)
  const [textureSource, setTextureSource] = useState('NASA Blue Marble · satellite composite')
  const [textureFailed, setTextureFailed] = useState(false)
  const handleTextureError = useCallback(() => { setTextureLoaded(false); setTextureFailed(true) }, [])
  const handleTextureReady = useCallback((source: string) => { setTextureLoaded(true); setTextureFailed(false); setTextureSource(source) }, [])

  return <div className="earth-canvas" aria-label="Interactive Earth globe with correctly located Nagpur and Wardha markers">
    <Canvas camera={{ position: [0, 0, 4.65], fov: 43 }} dpr={[1, 1.7]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 2, 4]} intensity={2.25} color="#fff0d6" />
      <pointLight position={[-3, -1, -2]} intensity={1.1} color="#36a5f5" />
      <Earth region={region} reduceMotion={reduceMotion} onOpenFullMap={onOpenFullMap} onTextureError={handleTextureError} onTextureReady={handleTextureReady} />
      <OrbitControls enablePan={false} minDistance={3.25} maxDistance={5.8} enableDamping dampingFactor={0.06} rotateSpeed={0.42} zoomSpeed={0.55} />
    </Canvas>
    {!textureLoaded && <div className={`earth-texture-status ${textureFailed ? 'failed' : ''}`} role="status">
      {textureFailed ? 'NASA Earth texture could not be loaded. Check your connection.' : 'Loading NASA Blue Marble imagery…'}
    </div>}
    <div className="earth-source-credit">{textureSource} · satellite composite, not live imagery</div>
  </div>
}
