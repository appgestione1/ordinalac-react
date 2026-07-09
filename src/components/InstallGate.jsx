import { useState, useEffect } from 'react';
import { isIOS, isAndroid, isMobile, isInAppBrowser, isStandalone } from '../lib/platform';

// Blocco totale: su mobile l'app cliente è utilizzabile solo se installata
// sulla schermata Home. Scenari gestiti:
//  - Android con prompt nativo (beforeinstallprompt) → pulsante "Installa"
//  - Android senza prompt (Firefox, o app già installata ma aperta nel browser) → istruzioni manuali
//  - iOS → istruzioni "Condividi → Aggiungi alla schermata Home" + manifest
//    dinamico con start_url = URL corrente (lo storage della webapp installata
//    su iOS è separato da Safari: i dati rientrano dai parametri del QR)
//  - Browser in-app (Instagram/Facebook/...) → l'installazione è impossibile,
//    istruzioni per aprire il link nel browser vero
// Desktop, app installata e modalità dev (?dev=...) non vengono bloccati.

export default function InstallGate() {
  const [bip, setBip] = useState(window.__bipEvent || null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  const devMode = new URLSearchParams(window.location.search).has('dev');
  const active = isMobile && !isStandalone() && !devMode;

  useEffect(() => {
    if (!active) return;
    const onBip = () => setBip(window.__bipEvent);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('bip-ready', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('bip-ready', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !isIOS) return;
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const abs = p => window.location.origin + p;
    const manifest = {
      name: 'Push&Go — Ordina le tue lenti',
      short_name: 'Push&Go',
      lang: 'it',
      start_url: window.location.href,
      scope: window.location.origin + '/',
      display: 'standalone',
      background_color: '#FFFFFF',
      theme_color: '#2563eb',
      icons: [
        { src: abs('/icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: abs('/icon-512.png'), sizes: '512x512', type: 'image/png' },
      ],
    };
    link.setAttribute('href', 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify(manifest)));
  }, [active]);

  if (!active) return null;

  async function promptInstall() {
    if (!bip) return;
    bip.prompt();
    try {
      const { outcome } = await bip.userChoice;
      if (outcome === 'accepted') setInstalled(true);
    } catch { /* prompt già consumato */ }
    window.__bipEvent = null;
    setBip(null);
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 3000); })
      .catch(() => {});
  }

  const Step = ({ n, children }) => (
    <li className="flex items-start text-left">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mr-3 mt-0.5">{n}</span>
      <span className="text-sm text-gray-700">{children}</span>
    </li>
  );

  let content;

  if (installed) {
    content = (
      <>
        <div className="text-green-500 text-5xl mb-3">✓</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">App installata!</h2>
        <p className="text-gray-600 text-sm">
          Ora apri <strong>Push&Go</strong> dalla schermata Home del tuo telefono per continuare.
        </p>
      </>
    );
  } else if (isInAppBrowser) {
    content = (
      <>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Apri nel browser</h2>
        <p className="text-gray-600 text-sm mb-4">
          Stai usando il browser interno di un'altra app: da qui non è possibile installare Push&Go.
        </p>
        <ol className="space-y-3 mb-6">
          <Step n="1">Tocca il menu <strong>⋯</strong> (in alto a destra)</Step>
          <Step n="2">Scegli <strong>{isIOS ? 'Apri in Safari' : 'Apri nel browser / Apri in Chrome'}</strong></Step>
        </ol>
        <button onClick={copyLink}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg shadow hover:bg-blue-700">
          {copied ? '✓ Link copiato!' : 'Copia il link'}
        </button>
        <p className="text-xs text-gray-400 mt-2">
          In alternativa copia il link e incollalo in {isIOS ? 'Safari' : 'Chrome'}.
        </p>
      </>
    );
  } else if (isAndroid && bip) {
    content = (
      <>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Installa l'app per continuare</h2>
        <p className="text-gray-600 text-sm mb-6">
          Per ordinare le tue lenti con un tocco, Push&Go va installata sulla schermata Home. È gratis e occupa pochissimo spazio.
        </p>
        <button onClick={promptInstall}
          className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg text-lg hover:bg-blue-700">
          ⬇ Installa Push&Go
        </button>
      </>
    );
  } else if (isAndroid) {
    content = (
      <>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Installa l'app per continuare</h2>
        <p className="text-gray-600 text-sm mb-4">
          Per usare Push&Go aggiungila alla schermata Home:
        </p>
        <ol className="space-y-3 mb-6">
          <Step n="1">Tocca il menu <strong>⋮</strong> del browser (in alto a destra)</Step>
          <Step n="2">Tocca <strong>"Installa app"</strong> o <strong>"Aggiungi a schermata Home"</strong></Step>
          <Step n="3">Apri <strong>Push&Go</strong> dalla schermata Home</Step>
        </ol>
        <p className="text-xs text-gray-400">
          L'hai già installata? Chiudi il browser e aprila dalla schermata Home.
        </p>
      </>
    );
  } else {
    // iOS
    content = (
      <>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Installa l'app per continuare</h2>
        <p className="text-gray-600 text-sm mb-4">
          Per usare Push&Go aggiungila alla schermata Home:
        </p>
        <ol className="space-y-3 mb-6">
          <Step n="1">
            Tocca il tasto <strong>Condividi</strong>
            <svg className="inline-block w-4 h-4 mx-1 text-blue-600 align-text-bottom" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
            </svg>
            nella barra del browser
          </Step>
          <Step n="2">Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong></Step>
          <Step n="3">Tocca <strong>"Aggiungi"</strong>, poi apri <strong>Push&Go</strong> dalla Home</Step>
        </ol>
        <p className="text-xs text-gray-400">
          Non vedi "Aggiungi alla schermata Home"? Apri questo link con <strong>Safari</strong>.
          L'hai già installata? Aprila dalla schermata Home.
        </p>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center overflow-y-auto">
      <div className="w-full max-w-sm">
        <img src="/icon-192.png" alt="Push&Go" className="w-20 h-20 mx-auto mb-3" />
        <h1 className="text-2xl font-extrabold text-blue-600 mb-6">Push&Go</h1>
        {content}
      </div>
    </div>
  );
}
