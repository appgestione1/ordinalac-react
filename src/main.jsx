/* global __BUILD_ID__ */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Cattura l'evento di installazione PWA il prima possibile (può scattare
// prima che React monti InstallGate); il gate lo recupera da window.__bipEvent
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  window.__bipEvent = e
  window.dispatchEvent(new Event('bip-ready'))
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Auto-aggiornamento PWA: l'app installata riprende dalla memoria senza mai
// ricaricare la pagina, quindi a ogni riapertura (visibilitychange) e all'avvio
// confrontiamo la build corrente con /version.json e ricarichiamo se è cambiata.
// sessionStorage evita loop se il CDN serve ancora la versione vecchia.
if (import.meta.env.PROD) {
  const checkForUpdate = async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' })
      const { build } = await res.json()
      if (build && build !== __BUILD_ID__ && sessionStorage.getItem('pushgo_reloaded_for') !== build) {
        sessionStorage.setItem('pushgo_reloaded_for', build)
        location.reload()
      }
    } catch { /* offline: ignora */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
  checkForUpdate()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
