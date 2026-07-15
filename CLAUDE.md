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
- **"Esci dall'app ✕"** in basso a destra del popup "Pronto per l'Ordine" (`window.close()`, per chi non vuole ordinare).
- **Consegna a domicilio disattivabile dall'ottico**: card con toggle in Dashboard (tab Gestione Ordini, sotto il Codice Ottico) → `optician_config/{uid}/settings/main` campo `home_delivery` (bool, assente = attiva; leggibile dai client anonimi con le regole esistenti). ClientApp lo legge in `fetchLensData`: se `false` nasconde il toggle Store/Domicilio (etichetta fissa "Ritiro c/o Store") e forza `delivery=pickup` anche su localStorage.
- **Indirizzo di Consegna**: rimossa casella "N." (`addrNum` resta nello stato/localStorage per retrocompatibilità, ancora unito in `address` full), label "Via / Piazza" → "Via / Piazza e Civico" a tutta larghezza.
- Verifiche Playwright: 7/7 (esci/indirizzo/dashboard smoke) + 3/3 end-to-end consegna disattivata (doc scritto e ripulito con account usa-e-getta).

## Prezzi lenti nella ClientApp + pulsante ESCI (10/07/2026)

- **Pulsante ESCI** (popup ordine, basso a destra): icona di spegnimento + scritta "ESCI" (sostituisce il link "Esci dall'app ✕"), `window.close()`.
- **Prezzi dal listino ottico visibili al cliente**: `fetchLensData` ora ascolta `optician_config/{oid}/lenses/main` con **onSnapshot** (prima getDoc) → catalogo E `pricing_config` in real-time: l'ottico cambia un prezzo dal Listino & Prezzi e il cliente lo vede subito. Stato `pricing` + helper `eyePrice(eye)` (chiave `manuf::model::type`, null se assente/0) e `fmtEur`.
- Dove si vede: popup ordine (prezzo/pz. accanto a ogni occhio + riga **Totale** = prezzo×qtà OD + prezzo×qtà OS, ricalcolata live con le quantità), tab "La tua Lente" (prezzo accanto a OCCHIO DESTRO/SINISTRO via prop `priceLabel` di EyeConfig). Se l'ottico non ha messo il prezzo → semplicemente non compare (niente 0,00).
- L'ordine ora salva anche i prezzi: `lens_order.od/os.price`, `lens_order.total`, e righe "Prezzo: €…" + "TOTALE: €…" nel message.
- Dev fixture con prezzi finti (`DEV_PRICING`). Verifica Playwright 12/12, incluso cambio prezzo su Firestore con app aperta → aggiornato in tempo reale.

## Modello lente per occhio (10/07/2026)

Il produttore resta comune ai due occhi, ma il **modello (e quindi tipo/diottrie) può differire tra OD e OS**:

- **Dato**: gli oggetti occhio (`od`/`os`) ora hanno un campo `model`. Il campo `model` top-level (localStorage, `lens_order`, `client_profiles.lens`, `change_requests`) resta come **legacy = modello OD** per compatibilità; in lettura ovunque si usa `od.model || model`.
- **QR**: nuovo param `mdos` (modello OS); `md` = modello OD e fallback per QR vecchi (inclusi quelli generati da VisionConsole/PushGo.js, che imposta lo stesso modello per entrambi).
- **ClientApp**: select "Modello Lente" dentro ogni `EyeConfig` (tab La tua Lente), tolto il select condiviso; `typesFor(eye)`/`rangesFor(eye)`; prezzi per occhio con chiave `manuf::eye.model::type`; action view mostra il modello nella riga dettagli occhio solo se i due differiscono; localStorage: `modelOD`/`modelOS` (+ `model` legacy).
- **Dashboard**: select Modello per occhio dentro `LensEyeForm` (ClientModal e RequestModal), tolti i select condivisi; `buildQrUrl` emette `mdos`; stampa ordine con colonna Modello per occhio; "Genera QR" richiede entrambi i modelli.
- Verifica Playwright 14/14: selezione per occhio, prezzi/totale con modelli diversi, QR con `mdos`, QR legacy senza `mdos`.
- **Fix viste ottico/admin** (stesso giorno): helper `lensModelLabel(l)` (unico se OD=OS, altrimenti "OD … · OS …") usato in Dashboard OrderCard e in SuperAdmin (forniture, lista/dettaglio clienti, storico prescrizioni e ordini); la **card ordine in Dashboard ora mostra il Totale** (`lens_order.total`) quando presente. E2E Dashboard 14/14 con ottico di prova reale (login, card ordine, Nuovo Cliente/QR con modelli per occhio, RequestModal → `new_data` con `od.model`/`os.model` verificato su Firestore, Listino) — account e dati di prova eliminati (tranne 1 change_request completata orfana: le regole non permettono delete).

## Card ordine riorganizzata + parità console (10/07/2026, sera)

- **Dashboard OrderCard**: nuovo layout per occhio (`EyeOrderRow`: modello → tipo/diottrie → quantità → **prezzo**), header solo produttore, totale già presente; **stampa ordine** con colonna Prezzo e riga TOTALE. Helper `fmtEur` condiviso nel file.
- **PushGo.js (nuovaconsole) allineato al portale**: stessa `EyeOrderRow`, telefono cliente, **pulsante Stampa** (stesso layout di stampa), **"Ordina al Fornitore"** con modal destinazione (Cliente solo se delivery / Negozio) → scrive `supply_request` come il portale, badge 🟣/🟠 quando pending; totale. Rimossi `lensModelLabel`/`eyeLine` ormai inutili in PushGo.
- Verifica e2e 17/17 su entrambi (dev server + ottico di prova reale): card con modelli/prezzi/totale, fornitura end-to-end dalla console (badge NEGOZIO scritto su Firestore), zero errori JS. Dati di prova ripuliti.

## Auto-aggiornamento PWA + settings real-time (10/07/2026)

Problema segnalato dall'utente: l'app installata recepiva i deploy solo disinstallando/reinstallando, e il toggle consegna a domicilio non era in tempo reale. Tre cause e tre fix:

1. **Firebase Hosting serviva index.html con cache 1h** (default senza `headers`) → in `firebase.json`: `**` = `no-cache` come base, poi eccezioni `**/*.@(png|ico|webp|jpg)` = 1h e `/assets/**` = `max-age=31536000, immutable` (i nomi hanno l'hash). ATTENZIONE: un pattern `**/*.html` NON copre i path riscritti dalla SPA (`/`, `/dashboard`…) — serve la base `**` (verificato con curl sugli header live).
2. **L'app installata riprende dalla memoria senza mai ricaricare la pagina** → auto-update in `main.jsx`: `vite.config.js` genera `__BUILD_ID__` (define) e scrive `dist/version.json` a ogni build (plugin `write-version-json`); in PROD a ogni avvio e a ogni `visibilitychange→visible` l'app fa fetch no-store di `/version.json` e se la build è diversa fa `location.reload()` (guard sessionStorage `pushgo_reloaded_for` contro i loop se il CDN è indietro).
3. **`home_delivery` letto una volta con getDoc** → ora `onSnapshot` su `optician_config/{oid}/settings/main` in `fetchLensData` (unsub in `settingsUnsub`, pulito allo smontaggio): se l'ottico disattiva mentre l'app è aperta il toggle sparisce in tempo reale e delivery torna pickup.

NB: le app installate PRIMA di questo deploy non hanno il codice di auto-update → per quelle serve ancora un refresh/reinstallazione manuale una tantum; dai deploy successivi l'aggiornamento è automatico alla riapertura.

## Pagamenti online via link dell'ottico (15/07/2026)

Chiuso l'ultimo TODO: la tab "Pagamento" non è più un placeholder. Scelta dell'utente: **link di pagamento esterno configurato dall'ottico** (PayPal.Me, Satispay, Stripe Payment Link...) — zero backend, i soldi vanno direttamente all'ottico.

- **Dato**: campo `payment_link` (string, vuoto/assente = disattivo) in `optician_config/{uid}/settings/main`, accanto a `home_delivery`. Leggibile dai client anonimi con le regole esistenti.
- **Dashboard** (tab Gestione Ordini, card sotto "Consegna a domicilio"): input URL + Salva (`savePaymentLink`); se manca il protocollo viene aggiunto `https://` in automatico; bordo verde smeraldo quando attivo. Lascia vuoto per disattivare.
- **ClientApp**: `paymentLink` letto dallo stesso `onSnapshot` di `home_delivery` in `fetchLensData` → real-time. Due punti di contatto:
  - **Schermata successo ordine**: pulsante verde "💳 Paga ora · € totale" (`lastOrderTotal`, congelato in `sendOrder` prima del reset quantità) che apre il link in nuova scheda + "Chiudi" per tornare; con link attivo la schermata NON si auto-chiude dopo 4s (senza link comportamento invariato).
  - **Tab Pagamento** (settings): se attivo spiega il flusso e offre "Apri pagamento online"; se non attivo, testo "il tuo Ottico non ha ancora attivato i pagamenti online".
- Dev fixtures (`?dev=1` / `?dev=action`) con link PayPal finto.
- Verifica Playwright 16/16 con ottico di prova reale (dev fixtures, QR reale, ordine con Paga ora € 70,00, card Dashboard con precompilazione, aggiornamento real-time sul client, disattivazione) — account e dati di prova eliminati.
- NB: il pagamento è "fiduciario": l'importo lo digita il cliente nel sistema esterno (PayPal.Me ecc. non ricevono l'importo dal link). Se un giorno serve importo precompilato → Stripe Payment Links con prezzo fisso o PayPal.Me con `/importo` appeso.

## Metodi di pagamento alla scelta del cliente (15/07/2026, sera)

Il cliente sceglie il metodo al momento dell'ordine (selettore "PAGAMENTO" a 3 pulsanti nella action view, persistito in `otticoApp_pay_method`):

1. **🏪 In negozio / 🚚 Alla consegna** (default, etichetta segue il toggle delivery) → `payment: { method:'on_delivery', status:'unpaid' }`; comportamento classico, success si auto-chiude in 4s.
2. **🔗 Con link** → `payment: { method:'link', status:'pending' }` = **ordine in attesa di pagamento, confermato al pagamento**. Success view: se l'ottico ha `payment_link` → "Paga ora · €tot" subito; altrimenti box ambra "il tuo ottico ti invierà un link (WhatsApp/email)". In entrambi i casi niente auto-chiusura + pulsante Chiudi.
3. **💳 Carta** (disabilitato, badge "in arrivo") → predisposto per l'integrazione Stripe: si attiverà con `card_payments: true` in `optician_config/{uid}/settings/main` (letto già ora dallo stesso onSnapshot; se disattivato mentre selezionato → fallback 'later'). Ordine previsto: `{ method:'card', status:'pending' }`. **Richiede Firebase Blaze + Functions + Stripe (SetupIntent/PaymentIntent) — MAI salvare dati carta in Firestore.** L'utente attiverà Stripe più avanti.

**Dashboard (OrderCard)**: riga stato pagamento per gli ordini col campo `payment` (i vecchi non la mostrano): badge 🕓 "In attesa di pagamento (· link inviato)" ambra / ✅ "Pagato il gg/mm" verde / 💶 "Paga alla consegna|in negozio" grigio. Pulsanti finché non pagato: **"🔗 Invia link"** (solo method link: apre wa.me col messaggio "paga qui: link + €totale", scrive `payment.link_sent_at`) e **"Segna pagato"** (con confirm: `payment.status='paid'` + `paid_at` — è la conferma manuale per Satispay/PayPal ecc. che non hanno webhook). Stampa ordine con riga Pagamento. Il messaggio ordine include "PAGAMENTO: …".

Tab "Pagamento" della ClientApp: descrive le 3 modalità (carta con badge IN ARRIVO), niente più riferimento al vecchio flusso. Verifica Playwright 26/26 (selettore, tab, ordine link end-to-end con Invia link→wa.me e Segna pagato, ordine in negozio con auto-chiusura) — dati e account di prova eliminati.

## Metodi di pagamento decisi dall'ottico + default del cliente (15/07/2026, notte)

Terza iterazione pagamenti (sostituisce la card "Pagamenti online" a link singolo):

- **Dato**: `optician_config/{uid}/settings/main.payment_methods` = `{ store:{enabled:true}, link:{enabled,url}, alma:{enabled,url}, card:{enabled} }`. Il vecchio `payment_link` viene **tenuto in sync** al salvataggio (compat app installate vecchie); in lettura la ClientApp usa `payment_methods` se presente, altrimenti fallback su `payment_link`.
- **Dashboard — card "Pagamenti accettati"**: checkbox per metodo. Negozio/consegna sempre attivo (checkbox disabilitata), Link di pagamento + URL, **Rateizzazione Alma** (anche 1 rata) + URL, Carta salvata disabilitata "si attiva con l'integrazione Stripe — IN ARRIVO". `savePayMethods` valida (spunta senza URL → alert), auto-`https://`, scrive `payment_methods` con merge **senza toccare `card`** (la attiverà l'integrazione Stripe).
- **ClientApp — tab Pagamento**: mostra SOLO i metodi abilitati (real-time dallo stesso onSnapshot delle settings); il cliente tocca una card per impostare il **predefinito** (badge blu PREDEFINITO, persistito in `otticoApp_pay_method`) che vale per ogni ordine, modificabile anche dal selettore in action view prima di ordinare. Se l'ottico disabilita il metodo predefinito → fallback automatico a negozio/consegna. Blocco Carta: descrizione "inserisci la carta una sola volta (custodita da Stripe, mai da noi), addebito automatico col pulsante rosso" — IN ARRIVO finché `card.enabled` è false.
- **Action view**: selettore dinamico coi soli metodi abilitati (nascosto se c'è solo negozio/consegna); opzione '💠 Rate Alma'.
- **Ordini `method:'alma'`**: stesso flusso pending del link (confermato al pagamento); success screen con pulsante viola "💠 Paga a rate con Alma · €tot" (o box "riceverai il link Alma"); Dashboard: badge "🕓 In attesa di pagamento · rate Alma", pulsante "💠 Invia link Alma" (wa.me con messaggio rate + totale), Segna pagato, stampa con riga dedicata.
- Verifica Playwright 31/31 (tab con predefinito, selettore, ordine Alma end-to-end, card Dashboard con flag e URL, invio link Alma, disabilitazione real-time → opzioni sparite dal client) — dati e account di prova eliminati.
- NB Alma: l'URL è il link della pagina di pagamento Alma del negozio (da dashboard Alma); per link per-ordine con importo servirebbe l'API Alma (backend) — per ora l'importo è nel messaggio WhatsApp.

## TODO aperti

1. **Integrazione Stripe per la carta salvata** (l'utente attiverà Stripe e Firebase Blaze più avanti): Firebase Functions + Stripe SetupIntent (il cliente salva la carta una volta nella tab Pagamento) e PaymentIntent off-session al pulsante rosso con conferma "stai pagando con la carta ****XXXX"; webhook Checkout per auto-confermare gli ordini pagati con link Stripe generati da noi. UI già predisposta: `payment_methods.card.enabled` (oggi sempre false) accende automaticamente checkbox Dashboard, card nella tab Pagamento e opzione nel selettore. Decidere: account Stripe per ottico (consigliato) o centrale.

## Verifica UI in locale (08/07/2026)

Tutte le sezioni verificate su dev server con screenshot Playwright (playwright preso da `Desktop/nuovaconsole/node_modules`, viewport mobile 390×844 per ClientApp): `/` no-qr ok, `/?dev=1` settings ok, `/?dev=action` action ok con catalogo e pulsante rosso, `/dashboard` login con nuovo brand ok, `/register` ok, `/superadmin` ok. Unico neo estetico: sfondo verde del logo (TODO 4).
