import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { mountElevenLabsWidget } from './lib/elevenLabsWidget'

// Install the official ElevenLabs orb outside React's route tree.
mountElevenLabsWidget()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)