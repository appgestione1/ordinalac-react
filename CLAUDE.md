# ordinalac-react — CLAUDE.md

## Progetto
App ordini lenti per ottici. Ottico genera QR → cliente scansiona → ordina lenti direttamente.

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

## TODO aperti

1. **Integrazione VisionConsole** (nuovaconsole): collegare OrdinaLac alla console gestionale come modulo Contattologia — l'ottico VisionOttica deve poter generare QR e vedere gli ordini dalla console. Nel video presentazione v4 è annunciato come teaser "Push&Go — L'ordine delle lenti a contatto, con un click".
2. Pagamenti digitali (tab "Pagamento" nella ClientApp è ancora placeholder "disponibile a breve")
3. Valutare rebranding completo in "Push&Go" (nome usato nel teaser del video)
