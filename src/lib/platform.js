// Rilevamento piattaforma/contesto per il gate di installazione PWA (ClientApp)

const ua = navigator.userAgent;

// iPadOS moderno si presenta come "MacIntel" ma ha il touch
export const isIOS = /iPhone|iPad|iPod/.test(ua)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isAndroid = /Android/i.test(ua);

export const isMobile = isIOS || isAndroid;

// Browser in-app (Instagram, Facebook, TikTok, ...): l'installazione PWA è impossibile lì
export const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Snapchat|Twitter/i.test(ua);

// App già installata e aperta dalla schermata Home
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
