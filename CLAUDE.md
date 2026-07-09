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

## Logo Push&Go (09/07/2026 — commit 613f5ff)

Sostituito il vecchio logo a occhio (retaggio OrdinaLac) con il logo Push&Go: **fulmine dentro anello, gradiente blu (#2563eb→#06b6d4), sfondo trasparente**. Sorgente vettoriale: `public/logo.svg`. Icone rigenerate: `icon.png`/`icon-192`/`icon-512`/`favicon.png` (tutte alpha trasparente), `apple-touch-icon.png` (sfondo bianco, richiesto da iOS). `index.html`: aggiunto favicon SVG vettoriale + apple-touch-icon dedicato. Usato in login/navbar via `<img src="/icon-192.png">`. Deployato in produzione e verificato live. (cairosvg non disponibile in locale; i PNG erano già stati rasterizzati in una sessione precedente — restavano solo non committati.)

## TODO aperti

1. Pagamenti digitali (tab "Pagamento" nella ClientApp è ancora placeholder "disponibile a breve")
2. Range non gestiti dal listino ottico: se il SuperAdmin aggiunge un tipo nuovo a catalogo senza range, i campi tornano input libero (comportamento voluto, ma i range nuovi vanno importati a mano)

## Verifica UI in locale (08/07/2026)

Tutte le sezioni verificate su dev server con screenshot Playwright (playwright preso da `Desktop/nuovaconsole/node_modules`, viewport mobile 390×844 per ClientApp): `/` no-qr ok, `/?dev=1` settings ok, `/?dev=action` action ok con catalogo e pulsante rosso, `/dashboard` login con nuovo brand ok, `/register` ok, `/superadmin` ok. Unico neo estetico: sfondo verde del logo (TODO 4).
