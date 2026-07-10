# ordinalac-react — CLAUDE.md

## Progetto
**Push&Go** (ex OrdinaLac) — app ordini lenti per ottici. Ottico genera QR → cliente scansiona → ordina lenti direttamente. Rebranding UI in "Push&Go" fatto l'08/07/2026; dominio e progetto Firebase restano `ordinalac`.

**Deploy:** https://ordinalac.web.app  
**Repo:** `appgestione1/ordinalac-react` (SSH: `git@github-appgestione:appgestione1/ordinalac-react.git`)  
**Firebase project:** `ordinalac`

## Comandi

```bash
cd C:\Users\stefa\ordinalac-react
npm run dev -- --host                             # dev locale (http://localhost:5173 o porta libera)
npm run build && firebase deploy --only hosting   # deploy produzione
firebase deploy --only firestore:rules            # aggiorna regole Firestore
```

## Route e ruoli

| URL | Componente | Ruolo |
|---|---|---|
| `/` | `ClientApp.jsx` | Cliente finale (ordina lenti) |
| `/dashboard` | `Dashboard.jsx` | Ottico (gestione ordini, QR, listino) |
| `/register` | `Register.jsx` | Registrazione nuovo ottico |
| `/superadmin` | `SuperAdmin.jsx` | Admin/Fornitore (catalogo, ottici, forniture) |

**Dev mode cliente:**
- `/?dev=1` → settings view con dati fittizi
- `/?dev=action` → action view con dati fittizi

## Accessi

- **Ottico:** `/dashboard` → email + password Firebase Auth
- **SuperAdmin:** `/superadmin` → solo password (email hardcoded: `solevista@gmail.com`)
- **Easter egg SuperAdmin da Dashboard:** 7 tap su "Dashboard" → modal password (letta da `config/admin.dashboardPassword`, fallback `'admin'`)

## Firestore Collections

| Collection | Uso |
|---|---|
| `orders` | Ordini (`optician_id`, `supply_request` per forniture al fornitore) |
| `change_requests` | Richieste modifica prescrizione cliente → ottico |
| `catalogs/master` | Catalogo lenti master (scritto da SuperAdmin) |
| `optician_config/{uid}/lenses/main` | Listino abilitato + prezzi per ottico |
| `opticians/{uid}` | Profilo ottico (contiene `password` in chiaro — intenzionale per SuperAdmin) |
| `client_profiles/{uid}` | Profilo cliente: dati, lente attuale, `prescription_history[]` |
| `config/admin` | `dashboardPassword` per easter egg |

## Architettura flussi

### Flusso cliente
1. Scansiona QR → URL con params (`oid`, `n`, `ph`, `e`, `cf`, `sa`/`sc`/`sz`/`sp`, `m`, `md`, params lenti OD/OS)
2. `ClientApp` carica dati da URL → localStorage + Firestore `client_profiles`
3. "Conferma Installazione" → salva tutto → modal "ordina subito?"
4. Action view → pulsante rosso → `sendOrder()` → `orders` collection

### Flusso ottico
1. Login Firebase Auth → `DashboardPanel`
2. "Nuovo Cliente / QR" → `ClientModal` → genera QR con `buildQrUrl()`
3. Lista ordini real-time → cambio stato → notifica WhatsApp/email
4. "Ordina al Fornitore" → `supply_request` sull'ordine → visibile in SuperAdmin tab Forniture

### Flusso modifica prescrizione
1. Cliente → "Richiedi aggiornamento prescrizione" → `change_requests` (status: pending)
2. Ottico → campanella notifiche → `RequestModal` → compila nuova prescrizione → status: completed
3. Cliente (via `onSnapshot`) riceve l'aggiornamento → aggiorna stato + localStorage + `client_profiles`

### Flusso SuperAdmin
- Tab Catalogo Master → CRUD lenti (produttore/modello/tipo)
- Tab Gestione Ottici → profilo, prodotti abilitati per ottico
- Tab Clienti → database pazienti per ottico, storico prescrizioni
- Tab Forniture → ordini con `supply_request`, cambio stato, archivia

## Note importanti

- `password` in `opticians/{uid}` è **intenzionale** — SuperAdmin la mostra in "Profilo & Fatturazione" per supporto agli ottici
- `APP_URL = window.location.origin` → QR puntano all'host corrente (prod: ordinalac.web.app)
- Firebase Auth client anonima per clienti; email/password per ottici e superadmin
- `prescription_history` usa `arrayUnion` → no duplicati, ordinare per `updated_at` desc
- `addrNum` non è nei params QR (il campo street del Dashboard include già il civico)

## Bug fixati (17/06/2026 — commit 6d0fbd3)

- **ClientApp.jsx useEffect**: `signInAnonymously` ora awaited prima di `init()` e del listener `changeReqId` — evita race condition su primo accesso con QR scan (Firestore interrogato prima che auth fosse pronta)
- **Dashboard.jsx handleStatusChange**: aggiunto try/catch con alert utente
- **Dashboard.jsx handleDelete**: aggiunto try/catch con alert utente

## Rifinitura lancio (08/07/2026)

- `index.html`: lang="it", title/description/og "OrdinaLac", theme-color blu, link a `manifest.json` (prima mancava → PWA non installabile), favicon = occhio (`favicon.png` da `icon.png` via ffmpeg)
- `manifest.json`: nome "OrdinaLac", icone locali `icon-192/512.png` (rimossa icona placehold.co e shortcut rotto `#invia-ordine`)
- Login ottico: logo + brand "OrdinaLac / Portale Ottico"
- Navbar Dashboard: h1 "Dashboard" → "OrdinaLac" (**l'easter egg 7 tap ora è sul testo "OrdinaLac"**)
- Register: subtitle cita OrdinaLac

## Catalogo master (08/07/2026)

Popolato con i prodotti di https://www.visionottica.it/collections/lenti-a-contatto (via `products.json` Shopify): 17 produttori/brand, 35 modelli, 58 tipi. Convenzione tipi: "Frequenza + Tipologia" (es. "Giornaliera Torica") — le parole **torica/multifocale** attivano i campi CYL/AXIS/ADD in Dashboard e ClientApp (match case-insensitive su `toric`/`multifocal`). Rimossi i vecchi produttori di prova per casa madre (Alcon, J&J, Bausch + Lomb, CooperVision, pippo) — scelta utente: persi Acuvue Vita, MyDay, Biofinity XR. Eventuali listini ottici (`optician_config`) che citavano le vecchie voci vanno riabilitati dal SuperAdmin. Import fatto con script Node temporaneo (account usa-e-getta creato e cancellato, regole permettono write a ogni auth non anonimo).

## Range diottrici di produzione (08/07/2026)

- `catalogs/master` ha un secondo campo **`ranges`**: mappa `produttore::modello::tipo` → `{ pwr:{min,max}, cyl:{min,max}, axis:{min,max}, add:{min,max}|{values:[LOW,MID,HIGH]}, bc, dia }`. Fonte: schede prodotto visionottica.it (58/58 voci di catalogo coperte).
- `src/lib/lensRanges.js`: `getRange` + generatori opzioni (sfera passi 0.25 fino a ±6.00 poi 0.50; cilindro passi 0.50; asse passi 10°; ADD valori produttore o passi 0.25).
- `src/components/ParamField.jsx`: select vincolato ai valori di produzione, fallback a input libero se il range manca; un valore salvato fuori range resta selezionabile marcato "(fuori produzione)".
- Usato in: `EyeConfig` (ClientApp, che ora legge `catalogs/master` in `fetchLensData`), `LensEyeForm` (Dashboard: ClientModal e RequestModal — RequestModal ora riusa LensEyeForm).
- **Fix EyeConfig**: `showPwr` prima richiedeva keyword 'standard'/'toric'/… e per "Giornaliera Sferica" non mostrava il potere; ora mostra PWR per ogni tipo non "nessun…" (allineato a Dashboard).
- Dev fixture (`?dev=1` / `?dev=action`) aggiornato: usa DAILIES TOTAL1 con tipi reali del catalogo e carica i ranges reali.
- Import fatto con script temporaneo (account usa-e-getta creato/cancellato). Per rigenerare: scrape `products.json` Shopify + pagine prodotto (attenzione rate-limit 429, ~10s tra richieste).

## Integrazione VisionConsole (08/07/2026)

Modulo **Push&Go** dentro nuovaconsole (`Desktop/nuovaconsole/src/PushGo.js`, tab "Push&Go ⚡" nella sezione Contattologia): seconda app Firebase (`initializeApp(..., 'pushgo')`) puntata al progetto `ordinalac`, login con le credenziali ottico del portale, lista ordini real-time (stato/WhatsApp/elimina) e generatore QR con select vincolati ai range. Dipendenza `qrcode.react` aggiunta a nuovaconsole. Vedi CLAUDE.md di nuovaconsole.

## Logo (09/07/2026 — commit 95947e6)

**Il logo ufficiale è l'OCCHIO OrdinaLac** — l'utente lo vuole così, NON sostituirlo (un tentativo di rebrand col fulmine Push&Go è stato deployato e poi revertato lo stesso giorno, commit 2589fdb). Risolto il problema storico dello **sfondo verde**: il sorgente `public/icon.png` (4096px) era già trasparente, ma le miniature `icon-192`/`icon-512`/`favicon.png` erano state appiattite da ffmpeg sul canale colore verde sottostante. Rigenerate con Pillow (`Image.resize` LANCZOS) preservando l'alpha → occhio su sfondo trasparente. Verificato live. Usato in login/navbar via `<img src="/icon-192.png">`.

## Editor range da SuperAdmin (09/07/2026 — commit 223e0a8)

Nel tab **Catalogo Master** ora si editano i range diottrici dalla UI (prima erano importabili solo via script):
- Ogni tipo lente ha un pulsante **"Range"** + badge **"range ✓" / "no range"** (copertura a colpo d'occhio).
- `RangeEditorModal`: form per PWR/CYL/Asse/ADD/BC/DIA. ADD in tre modalità (Nessuna / Valori LOW-MID-HIGH separati da virgola / Intervallo min-max). CYL ha anche il campo **Step** (vuoto = 0.50, salvato come `cyl.step`, usato da `cylOptions`). Hint automatico se il tipo è torico/multifocale. Campo vuoto → quel parametro è **omesso** dal range (nella app torna a input libero).
- Creando un **tipo nuovo** l'editor si apre in automatico → si compila subito il range (chiude il vecchio TODO 2).
- I range dei 58 tipi iniziali sono modificabili allo stesso modo.
- **FIX importante**: `saveMaster` in `CatalogoTab` ora riscrive il doc `catalogs/master` con **entrambi** `data` e `ranges`. Prima `saveCatalog` faceva `setDoc(..., { data })` **senza merge**, quindi ogni modifica al catalogo **cancellava tutti i range**. Rimuovere tipo/modello/produttore ripulisce anche i range orfani.
- Struttura invariata: `ranges["produttore::modello::tipo"] = { pwr, cyl, axis, add:{min,max}|{values:[]}, bc, dia }`. Consumata da `src/lib/lensRanges.js` (invariato).

## Install gate PWA + anagrafica obbligatoria (09/07/2026)

**Blocco totale su mobile** (scelta esplicita dell'utente): la ClientApp è utilizzabile solo come app installata sulla schermata Home.

- `public/sw.js`: service worker minimo (network-first sulle navigazioni) — richiesto da Chrome/Android per il prompt di installazione. Registrato in `main.jsx` solo in PROD.
- `main.jsx` cattura `beforeinstallprompt` il prima possibile in `window.__bipEvent` + evento `bip-ready` (può scattare prima che React monti il gate).
- `src/lib/platform.js`: `isIOS` (incluso iPadOS come MacIntel+touch), `isAndroid`, `isMobile`, `isInAppBrowser`, `isStandalone()`.
- `src/components/InstallGate.jsx` (renderizzato nelle viste loading/settings/action, NON in no-qr): 
  - Android + prompt nativo → pulsante "Installa Push&Go"; senza prompt (Firefox / già installata) → istruzioni menu ⋮
  - iOS → istruzioni Condividi → Aggiungi alla schermata Home
  - Browser in-app (Instagram/FB/TikTok...) → istruzioni "apri nel browser" + copia link
  - Esenti: desktop, standalone, `?dev=...`
- **Storage iOS separato da Safari**: la webapp installata su iOS NON vede il localStorage di Safari. Soluzione (v2, commit 63379fe): su iOS il `<link rel="manifest">` **non viene proprio emesso** — `index.html` lo inietta via JS solo su piattaforme non-iOS. Senza manifest, "Aggiungi alla schermata Home" congela l'**URL corrente coi params del QR** come start URL (per questo su iOS browser i params NON vengono strippati); standalone garantito dai meta `apple-mobile-web-app-capable` ecc. (NB: il primo tentativo con manifest `data:` dinamico veniva ignorato dal Safari reale → "App non configurata"). A ogni avvio standalone, se localStorage è già popolato ha la precedenza sui params (init → `loadFromStorage`), così le prescrizioni aggiornate non vengono sovrascritte.
- Su Android lo storage è condiviso col browser → manifest statico invariato (`start_url: "/"`, aggiunti `id` e `scope`), iniettato via JS da index.html.
- Fix UX (commit d6b9071, 2ae139b): su Android attesa neutra ~4s prima di scegliere pulsante nativo vs istruzioni manuali (beforeinstallprompt arriva in ritardo → prima c'era un flash di due schermate); pulsante "Chiudi" (window.close) nella schermata "App installata!".

**Anagrafica obbligatoria** prima di usare l'app: nome, telefono (≥8 cifre), email, CF (16 char) + privacy; indirizzo completo (via/CAP/città/prov) solo se consegna a domicilio.
- `saveSettings` valida e mostra errori inline (bordo rosso + messaggio, banner in alto, tab Dati Cliente forzata)
- `storedProfileComplete()`: al ritorno con profilo incompleto → vista settings con banner "Completa i dati obbligatori", non action
- `sendOrder` guarda: consegna a domicilio senza indirizzo salvato → rimanda ai settings
- `?dev=1` ora setta anche privacy=true
- Verificato con Playwright (26/26): gate Android/iOS/in-app, standalone senza gate, manifest dinamico iOS con params, validazione, ritorno incompleto, desktop e dev esenti.

## Rifiniture ClientApp (10/07/2026)

- **Popup "Consegna a Domicilio"** (action view): spostando l'interruttore su "c/o Domicilio" con indirizzo incompleto (via + CAP 5 cifre + città + provincia, check `addressComplete()`) si apre un popup; "Annulla" lo chiude e l'interruttore resta su "c/o Store" (checkbox controllato: non si sposta mai finché l'indirizzo manca); "Aggiungi dati mancanti" (`goAddDeliveryData()`) imposta delivery, apre settings > Dati Cliente con i campi indirizzo mancanti già in rosso. Con indirizzo completo il toggle funziona senza popup.
- **"Conferma Installazione" → "Salva"** + pulsante **"Chiudi"** accanto (`window.close()`, affidabile in PWA standalone, può essere ignorato in tab browser aperte a mano). Barra sticky in fondo alla settings view.
- **"Richiedi aggiornamento prescrizione" anche nella tab "La tua Lente"**: blocco unificato in `changeReqSection(prominent)` usato sia in action view (link grigio) sia nella tab lenti (pulsante azzurro 🔄); stessi stati pending/done/Annulla. Compare solo con `opticianId` (quindi non nei dev mode).
- **Rimossa "Quantità (Default)"** da `EyeConfig.jsx` (tab La tua Lente): la quantità si imposta solo nel popup dell'ordine (action view), lo stato `qty` resta gestito internamente.
- Verifiche Playwright: 15/15 popup domicilio, 9/9 Salva/Chiudi/prescrizione, 5/5 rimozione quantità. NB: un doc orfano `change_requests` con `optician_id: "test-optician"` è rimasto in Firestore dai test (innocuo).

## TODO aperti

1. Pagamenti digitali (tab "Pagamento" nella ClientApp è ancora placeholder "disponibile a breve"; quando pronta, i dati di pagamento andranno richiesti al primo ordine — nota già presente nella tab)

## Verifica UI in locale (08/07/2026)

Tutte le sezioni verificate su dev server con screenshot Playwright (playwright preso da `Desktop/nuovaconsole/node_modules`, viewport mobile 390×844 per ClientApp): `/` no-qr ok, `/?dev=1` settings ok, `/?dev=action` action ok con catalogo e pulsante rosso, `/dashboard` login con nuovo brand ok, `/register` ok, `/superadmin` ok. Unico neo estetico: sfondo verde del logo (TODO 4).
