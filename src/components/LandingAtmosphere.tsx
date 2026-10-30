/** Subtle background lighting only. No decorative orbits or synthetic grid motifs. */
export default function LandingAtmosphere() {
  return <div className="landing-atmosphere" aria-hidden="true">
    <span className="atmosphere-glow glow-one" />
    <span className="atmosphere-glow glow-two" />
  </div>
}
