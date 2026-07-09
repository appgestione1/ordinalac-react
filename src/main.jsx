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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
