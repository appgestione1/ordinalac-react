import { useState, useEffect, useRef } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, onSnapshot, collection, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import EyeConfig from '../components/EyeConfig';

// ── localStorage keys ────────────────────────────────────────────────
const LS = {
  name: 'otticoApp_patient_name',
  phone: 'otticoApp_patient_phone',
  email: 'otticoApp_patient_email',
  cf: 'otticoApp_patient_cf',
  changeReqId: 'otticoApp_change_req_id',
  delivery: 'otticoApp_delivery_option',
  addrStreet: 'otticoApp_addr_street',
  addrNum: 'otticoApp_addr_num',
  addrCap: 'otticoApp_addr_cap',
  addrCity: 'otticoApp_addr_city',
  addrProv: 'otticoApp_addr_prov',
  address: 'otticoApp_patient_address',
  privacy: 'otticoApp_privacy_accepted',
  opticianId: 'otticoApp_optician_id',
  manufacturer: 'otticoApp_lens_manufacturer',
  model: 'otticoApp_lens_model',
  qtyOD: 'otticoApp_qty_od',
  qtyOS: 'otticoApp_qty_os',
  typeOD: 'otticoApp_lens_type_od',
  pwrOD:  'otticoApp_param_pwr_od',
  cylOD:  'otticoApp_param_cyl_od',
  axisOD: 'otticoApp_param_axis_od',
  addOD:  'otticoApp_param_add_od',
  typeOS: 'otticoApp_lens_type_os',
  pwrOS:  'otticoApp_param_pwr_os',
  cylOS:  'otticoApp_param_cyl_os',
  axisOS: 'otticoApp_param_axis_os',
  addOS:  'otticoApp_param_add_os',
};

const ls  = key => localStorage.getItem(LS[key]) || '';
const lss = (key, val) => localStorage.setItem(LS[key], val ?? '');

function buildEyeParams(e) {
  const parts = [];
  if (e.pwr)  parts.push(`Sf. ${e.pwr}`);
  if (e.cyl)  parts.push(`Cil. ${e.cyl}`);
  if (e.axis) parts.push(`Ax. ${e.axis}`);
  return { line: parts.join(' '), add: e.add };
}

const EMPTY_EYE = { qty: '1', type: '', pwr: '', cyl: '', axis: '', add: '' };

export default function ClientApp() {
  const [view, setView] = useState('loading'); // 'loading' | 'no-qr' | 'settings' | 'action'
  const [activeTab, setActiveTab] = useState('patient');
  const [lensData, setLensData] = useState(null);
  const [opticianId, setOpticianId] = useState('');
  const [lensLocked, setLensLocked] = useState(true);
  const unlockTaps = useRef(0);

  // Dati paziente
  const [name, setName]   = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cf, setCf]       = useState('');
  const [privacy, setPrivacy] = useState(false);

  // Consegna
  const [delivery, setDelivery]     = useState('pickup');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNum, setAddrNum]       = useState('');
  const [addrCap, setAddrCap]       = useState('');
  const [addrCity, setAddrCity]     = useState('');
  const [addrProv, setAddrProv]     = useState('');

  // Lenti
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel]               = useState('');
  const [od, setOd] = useState(EMPTY_EYE);
  const [os, setOs] = useState(EMPTY_EYE);

  // Ordine
  const [orderStatus, setOrderStatus] = useState('idle'); // 'idle'|'sending'|'success'|'error'
  const [quickQtyOD, setQuickQtyOD]   = useState('1');
  const [quickQtyOS, setQuickQtyOS]   = useState('1');
  const [askModal, setAskModal]       = useState(false);

  // Richiesta modifica prescrizione
  const [changeReqPending, setChangeReqPending] = useState(false);
  const [changeReqDone, setChangeReqDone]       = useState(false);
  const changeReqUnsub = useRef(null);

  const models = lensData && manufacturer ? Object.keys(lensData[manufacturer] || {}) : [];
  const types  = lensData && manufacturer && model ? lensData[manufacturer]?.[model] || [] : [];

  function listenChangeReq(reqId) {
    if (changeReqUnsub.current) changeReqUnsub.current();
    changeReqUnsub.current = onSnapshot(doc(db, 'change_requests', reqId), snap => {
      if (!snap.exists() || snap.data().status !== 'completed') return;
      const nd = snap.data().new_data || {};
      const newOd = { qty: ls('qtyOD') || '1', type: nd.od?.type || '', pwr: nd.od?.pwr || '', cyl: nd.od?.cyl || '', axis: nd.od?.axis || '', add: nd.od?.add || '' };
      const newOs = { qty: ls('qtyOS') || '1', type: nd.os?.type || '', pwr: nd.os?.pwr || '', cyl: nd.os?.cyl || '', axis: nd.os?.axis || '', add: nd.os?.add || '' };
      setManufacturer(nd.manufacturer || '');
      setModel(nd.model || '');
      setOd(newOd); setOs(newOs);
      lss('manufacturer', nd.manufacturer || ''); lss('model', nd.model || '');
      lss('typeOD', newOd.type); lss('pwrOD', newOd.pwr); lss('cylOD', newOd.cyl); lss('axisOD', newOd.axis); lss('addOD', newOd.add);
      lss('typeOS', newOs.type); lss('pwrOS', newOs.pwr); lss('cylOS', newOs.cyl); lss('axisOS', newOs.axis); lss('addOS', newOs.add);
      lss('changeReqId', '');
      if (changeReqUnsub.current) changeReqUnsub.current();
      setChangeReqPending(false);
      setChangeReqDone(true);
      setTimeout(() => setChangeReqDone(false), 6000);
      fetchLensData(ls('opticianId'));

      // Aggiorna client_profiles lato cliente — auth garantita (client scrive il proprio uid)
      const uid = auth.currentUser?.uid;
      const oid = ls('opticianId');
      if (uid && oid) {
        const newLens = {
          manufacturer: nd.manufacturer || '',
          model:        nd.model || '',
          od:           nd.od || {},
          os:           nd.os || {},
        };
        const historyEntry = {
          ...newLens,
          updated_at:  new Date().toISOString(),
          updated_by:  'optician',
          optician_id: oid,
          client_name: ls('name'),
        };
        setDoc(doc(db, 'client_profiles', uid), {
          lens:                 newLens,
          updated_at:           serverTimestamp(),
          prescription_history: arrayUnion(historyEntry),
        }, { merge: true })
          .then(() => console.log('client_profiles aggiornato con nuova prescrizione'))
          .catch(err => console.error('client_profiles update error:', err));
      }
    });
  }

  async function requestChange() {
    if (!opticianId) return;
    try {
      const docRef = await addDoc(collection(db, 'change_requests'), {
        optician_id:  opticianId,
        client_name:  name,
        client_uid:   auth.currentUser?.uid || null,
        client_phone: phone || null,
        client_email: email || null,
        status:       'pending',
        created_at:   serverTimestamp(),
        current_data: { manufacturer, model, od, os },
      });
      lss('changeReqId', docRef.id);
      setChangeReqPending(true);
      listenChangeReq(docRef.id);
    } catch (e) { console.error(e); }
  }

  function cancelChangeReq() {
    if (changeReqUnsub.current) changeReqUnsub.current();
    lss('changeReqId', '');
    setChangeReqPending(false);
  }

  useEffect(() => {
    let mounted = true;
    async function setup() {
      try { await signInAnonymously(auth); } catch (e) { console.error(e); }
      if (!mounted) return;
      await init();
      if (!mounted) return;
      const savedReqId = ls('changeReqId');
      if (savedReqId) { setChangeReqPending(true); listenChangeReq(savedReqId); }
    }
    setup();
    return () => {
      mounted = false;
      if (changeReqUnsub.current) changeReqUnsub.current();
    };
  }, []);

  // ── Init ────────────────────────────────────────────────────────────
  async function init() {
    const params = new URLSearchParams(window.location.search);

    // Modalità sviluppo: /?dev=1 (settings) | /?dev=action
    if (params.get('dev') === '1') {
      setName('Mario Rossi'); setPhone('3331234567');
      setEmail('mario@test.it'); setCf('RSSMRO80A01H501A');
      setOd({ qty: '1', type: 'Standard', pwr: '-2.50', cyl: '', axis: '', add: '' });
      setOs({ qty: '1', type: 'Standard', pwr: '-1.75', cyl: '', axis: '', add: '' });
      setLensLocked(false);
      setView('settings');
      return;
    }
    if (params.get('dev') === 'action') {
      setName('Mario Rossi'); setPhone('3331234567');
      setOd({ qty: '1', type: 'Standard', pwr: '-2.50', cyl: '', axis: '', add: '' });
      setOs({ qty: '1', type: 'Standard', pwr: '-1.75', cyl: '', axis: '', add: '' });
      setManufacturer('Acuvue'); setModel('Oasys');
      setDelivery('pickup');
      setView('action');
      return;
    }

    // QR code scan
    if (params.has('oid') || params.has('n')) {
      const qr = {
        n: params.get('n') || '', oid: params.get('oid') || '',
        ph: params.get('ph') || '', e: params.get('e') || '', cf: params.get('cf') || '',
        sa: params.get('sa') || '', sc: params.get('sc') || '',
        sz: params.get('sz') || '', sp: params.get('sp') || '',
        m: params.get('m') || '', md: params.get('md') || '',
        tod: params.get('tod') || '', pod: params.get('pod') || '',
        cod: params.get('cod') || '', aod: params.get('aod') || '', addod: params.get('addod') || '',
        tos: params.get('tos') || '', pos: params.get('pos') || '',
        cos: params.get('cos') || '', aos: params.get('aos') || '', addos: params.get('addos') || '',
      };
      history.replaceState(null, document.title, window.location.pathname);
      await loadFromQR(qr);
      return;
    }

    // Ritorno senza QR → carica da localStorage
    const savedId   = ls('opticianId');
    const savedName = ls('name');
    if (!savedId && !savedName) { setView('no-qr'); return; }
    await loadFromStorage(savedId);
  }

  // ── Carica da QR ────────────────────────────────────────────────────
  async function loadFromQR(qr) {
    setName(qr.n); setPhone(qr.ph); setEmail(qr.e); setCf(qr.cf);
    setAddrStreet(qr.sa); setAddrCity(qr.sc); setAddrCap(qr.sz); setAddrProv(qr.sp);
    setDelivery('pickup');
    setOpticianId(qr.oid);
    setManufacturer(qr.m); setModel(qr.md);

    const newOd = { qty: '1', type: qr.tod, pwr: qr.pod, cyl: qr.cod, axis: qr.aod, add: qr.addod };
    const newOs = { qty: '1', type: qr.tos, pwr: qr.pos, cyl: qr.cos, axis: qr.aos, add: qr.addos };
    setOd(newOd); setOs(newOs);

    // Salva tutto in localStorage (inclusi parametri lenti)
    lss('name', qr.n); lss('phone', qr.ph); lss('email', qr.e); lss('cf', qr.cf);
    lss('addrStreet', qr.sa); lss('addrCity', qr.sc); lss('addrCap', qr.sz); lss('addrProv', qr.sp);
    lss('delivery', 'pickup'); lss('opticianId', qr.oid);
    lss('manufacturer', qr.m); lss('model', qr.md);
    lss('typeOD', qr.tod); lss('pwrOD', qr.pod); lss('cylOD', qr.cod); lss('axisOD', qr.aod); lss('addOD', qr.addod);
    lss('typeOS', qr.tos); lss('pwrOS', qr.pos); lss('cylOS', qr.cos); lss('axisOS', qr.aos); lss('addOS', qr.addos);

    await fetchLensData(qr.oid);
    setLensLocked(true);
    setView('settings');
  }

  // ── Carica da localStorage ──────────────────────────────────────────
  async function loadFromStorage(savedId) {
    setName(ls('name')); setPhone(ls('phone')); setEmail(ls('email')); setCf(ls('cf'));
    setDelivery(ls('delivery') || 'pickup');
    setAddrStreet(ls('addrStreet')); setAddrNum(ls('addrNum'));
    setAddrCap(ls('addrCap')); setAddrCity(ls('addrCity')); setAddrProv(ls('addrProv'));
    setPrivacy(ls('privacy') === 'true');
    setOpticianId(savedId);
    setManufacturer(ls('manufacturer')); setModel(ls('model'));

    // FIX: ripristina tutti i parametri lenti da localStorage
    setOd({
      qty: ls('qtyOD') || '1', type: ls('typeOD'),
      pwr: ls('pwrOD'), cyl: ls('cylOD'), axis: ls('axisOD'), add: ls('addOD'),
    });
    setOs({
      qty: ls('qtyOS') || '1', type: ls('typeOS'),
      pwr: ls('pwrOS'), cyl: ls('cylOS'), axis: ls('axisOS'), add: ls('addOS'),
    });
    setQuickQtyOD(ls('qtyOD') || '1');
    setQuickQtyOS(ls('qtyOS') || '1');

    if (savedId) await fetchLensData(savedId);
    setLensLocked(true);
    setView('action');
  }

  // ── Fetch catalogo lenti ────────────────────────────────────────────
  async function fetchLensData(oid) {
    if (!oid) return null;
    try {
      const snap = await getDoc(doc(db, 'optician_config', oid, 'lenses', 'main'));
      if (snap.exists()) { setLensData(snap.data().data); return snap.data().data; }
    } catch (e) { console.error(e); }
    return null;
  }

  // ── Salva impostazioni ──────────────────────────────────────────────
  async function saveSettings() {
    if (!name.trim()) { alert('Inserisci il tuo nome e cognome per continuare.'); return; }
    if (!privacy) { alert('Devi accettare la Privacy Policy per continuare.'); return; }
    const streetFull = [addrStreet.trim(), addrNum.trim()].filter(Boolean).join(' ');
    const addrFull = `${streetFull}, ${addrCap} ${addrCity} (${addrProv})`.trim();

    const cleanName  = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanCf    = cf.trim().toUpperCase();

    lss('name', cleanName); lss('phone', cleanPhone);
    lss('email', cleanEmail); lss('cf', cleanCf);
    lss('addrStreet', addrStreet); lss('addrNum', addrNum);
    lss('addrCap', addrCap); lss('addrCity', addrCity); lss('addrProv', addrProv);
    lss('address', addrFull); lss('privacy', 'true');
    lss('delivery', delivery); lss('opticianId', opticianId);
    lss('manufacturer', manufacturer); lss('model', model);
    lss('qtyOD', od.qty); lss('typeOD', od.type);
    lss('pwrOD', od.pwr); lss('cylOD', od.cyl); lss('axisOD', od.axis); lss('addOD', od.add);
    lss('qtyOS', os.qty); lss('typeOS', os.type);
    lss('pwrOS', os.pwr); lss('cylOS', os.cyl); lss('axisOS', os.axis); lss('addOS', os.add);

    // Salva/aggiorna profilo cliente su Firestore
    const uid = auth.currentUser?.uid;
    if (uid && opticianId) {
      setDoc(doc(db, 'client_profiles', uid), {
        name: cleanName, phone: cleanPhone, email: cleanEmail, cf: cleanCf,
        optician_id: opticianId,
        address: { street: addrStreet, num: addrNum, cap: addrCap, city: addrCity, province: addrProv, full: addrFull },
        lens: { manufacturer, model, od, os },
        privacy_accepted: true,
        updated_at: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    setAskModal(true);
  }

  // ── Invia ordine ────────────────────────────────────────────────────
  async function sendOrder() {
    setOrderStatus('sending');
    const addrFull  = ls('address');
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const odParams  = buildEyeParams(od);
    const osParams  = buildEyeParams(os);

    let msg = `--- INFO CLIENTE ---\nTEL: ${phone || 'N/D'}\n`;
    if (email) msg += `EMAIL: ${email}\n`;
    if (cf)    msg += `C.F.: ${cf}\n`;
    msg += delivery === 'delivery'
      ? `**CONSEGNA A DOMICILIO**\n${addrFull}\n`
      : `**RITIRO IN NEGOZIO**\n`;
    msg += `\n--- ORDINE LENTI ---\nOrdine: ${manufacturer} ${model}\n\n`;
    msg += `OCCHIO DESTRO [${quickQtyOD} pz.]\nTipo: ${od.type || 'N/D'}\n`;
    if (odParams.line) msg += odParams.line + '\n';
    if (odParams.add)  msg += `ADD: ${odParams.add}\n`;
    msg += `\nOCCHIO SINISTRO [${quickQtyOS} pz.]\nTipo: ${os.type || 'N/D'}\n`;
    if (osParams.line) msg += osParams.line + '\n';
    if (osParams.add)  msg += `ADD: ${osParams.add}\n`;
    msg += '\nGrazie!';

    try {
      await addDoc(collection(db, 'orders'), {
        patient_name: name,
        optician_id:  opticianId,
        message:      msg,
        status:       'new',
        timestamp:    serverTimestamp(),
        client_info:  { phone: cleanPhone, email, cf, privacy_accepted: true },
        delivery: {
          mode:         delivery,
          address_full: addrFull,
          address_details: {
            street: addrStreet, number: addrNum,
            cap: addrCap, city: addrCity, province: addrProv,
          },
        },
        lens_order: {
          manufacturer, model,
          od: { qty: quickQtyOD, type: od.type, pwr: od.pwr, cyl: od.cyl, axis: od.axis, add: od.add },
          os: { qty: quickQtyOS, type: os.type, pwr: os.pwr, cyl: os.cyl, axis: os.axis, add: os.add },
        },
      });

      // Reset quantità a 1 dopo l'ordine
      setQuickQtyOD('1'); setQuickQtyOS('1');
      lss('qtyOD', '1'); lss('qtyOS', '1');

      // Crea/aggiorna client_profiles — garantisce che esiste anche senza "Conferma Installazione"
      const uid = auth.currentUser?.uid;
      if (uid && opticianId) {
        setDoc(doc(db, 'client_profiles', uid), {
          name, phone: cleanPhone, email, cf,
          optician_id: opticianId,
          address: { street: addrStreet, num: addrNum, cap: addrCap, city: addrCity, province: addrProv, full: addrFull },
          lens: { manufacturer, model, od, os },
          privacy_accepted: true,
          updated_at: serverTimestamp(),
        }, { merge: true }).catch(err => console.error('client_profiles write error:', err));
      }

      setOrderStatus('success');
      setTimeout(() => setOrderStatus('idle'), 4000);
    } catch (e) {
      console.error(e);
      setOrderStatus('error');
      setTimeout(() => setOrderStatus('idle'), 4000);
    }
  }

  const deliveryLabel = delivery === 'delivery' ? 'c/o Domicilio' : 'c/o Store';
  const odParams = buildEyeParams(od);
  const osParams = buildEyeParams(os);

  // ── NO QR ────────────────────────────────────────────────────────────
  if (view === 'no-qr') return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center p-8 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm">
        <div className="bg-red-100 p-4 rounded-full inline-block mb-4">
          <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">App non configurata</h2>
        <p className="text-gray-600 mb-6">Per utilizzare questa applicazione, devi scansionare il <strong>QR Code</strong> fornito dal tuo ottico di fiducia.</p>
        <p className="text-sm text-gray-400">Richiedi la configurazione in negozio.</p>
      </div>
    </div>
  );

  if (view === 'loading') return (
    <div className="fixed inset-0 flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  // ── SETTINGS VIEW ─────────────────────────────────────────────────────
  if (view === 'settings') return (
    <>
      <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg p-6 flex flex-col">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-800">Benvenuto</h1>
          <p className="text-gray-600 text-xs">Verifica i tuoi dati per completare l'installazione.</p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 mb-6">
          {[['patient','Dati Cliente'],['lenses','La tua Lente'],['payment','Pagamento']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 py-2 px-1 text-center text-sm ${activeTab === id
                ? 'border-b-2 border-blue-600 text-blue-600 font-semibold'
                : 'text-gray-500 border-b-2 border-transparent'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Dati Cliente */}
        {activeTab === 'patient' && (
          <div className="space-y-4 flex-1 pb-24">
            <h2 className="text-lg font-semibold text-gray-700 pb-2">Informazioni Personali</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nome e Cognome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefono</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Codice Fiscale</label>
              <input type="text" value={cf} onChange={e => setCf(e.target.value.toUpperCase())}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm uppercase bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
            </div>

            <div className={`p-4 rounded-md border space-y-3 transition ${delivery === 'delivery' ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-dashed border-gray-200 opacity-60'}`}>
              <div className="flex justify-between items-center border-b pb-1">
                <h2 className="text-sm font-semibold text-gray-700">Indirizzo di Consegna</h2>
                {delivery !== 'delivery' && (
                  <span className="text-xs text-gray-400 italic">usato solo per consegna a domicilio</span>
                )}
              </div>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500">Via / Piazza</label>
                  <input type="text" value={addrStreet} onChange={e => setAddrStreet(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-gray-500">N.</label>
                  <input type="text" value={addrNum} onChange={e => setAddrNum(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="flex space-x-2">
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500">CAP</label>
                  <input type="text" value={addrCap} onChange={e => setAddrCap(e.target.value)} maxLength={5}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500">Città</label>
                  <input type="text" value={addrCity} onChange={e => setAddrCity(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="w-16">
                  <label className="block text-xs font-medium text-gray-500">Prov.</label>
                  <input type="text" value={addrProv} onChange={e => setAddrProv(e.target.value.toUpperCase())} maxLength={2}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm uppercase bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500 text-center" />
                </div>
              </div>
            </div>

            <div className="flex items-start mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
              <input id="privacy" type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)}
                className="h-5 w-5 text-blue-600 border-gray-300 rounded mt-0.5 cursor-pointer" />
              <div className="ml-3 text-sm">
                <label htmlFor="privacy" className="font-bold text-gray-800 cursor-pointer">Consenso Privacy (GDPR)</label>
                <p className="text-gray-600 text-xs mt-1 text-justify">
                  Dichiaro di aver preso visione dell'informativa privacy ai sensi del Regolamento UE 2016/679. Acconsento al trattamento dei miei dati personali (inclusi i dati optometrici) per la gestione dell'ordine, la fatturazione e le comunicazioni di servizio. I dati potranno essere comunicati a terzi (fornitore, corriere) esclusivamente per l'evasione dell'ordine e la spedizione.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Lenti */}
        {activeTab === 'lenses' && (
          <div className="space-y-4 flex-1 pb-24">
            <h2 className="text-lg font-semibold text-gray-700 pb-2">Configurazione Lenti</h2>
            <div
              className="bg-green-50 border border-green-200 p-3 rounded mb-2 cursor-pointer select-none active:bg-green-100 transition"
              onClick={() => { unlockTaps.current += 1; if (unlockTaps.current >= 5) { setLensLocked(false); unlockTaps.current = 0; } }}>
              <p className="text-xs text-green-800 font-bold">
                {lensLocked ? '✔ Configurazione caricata dal tuo Ottico.' : '🔓 Modifica abilitata.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Produttore</label>
              {lensLocked ? (
                <div className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 text-sm min-h-[42px]">
                  {manufacturer || <span className="text-gray-400 italic">Non specificato</span>}
                </div>
              ) : (
                <select value={manufacturer} disabled={!lensData}
                  onChange={e => { setManufacturer(e.target.value); setModel(''); setOd(o => ({ ...o, type: '' })); setOs(o => ({ ...o, type: '' })); }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white disabled:cursor-not-allowed">
                  <option value="">-- Seleziona Produttore --</option>
                  {lensData && Object.keys(lensData).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Modello Lente</label>
              {lensLocked ? (
                <div className="mt-1 block w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700 text-sm min-h-[42px]">
                  {model || <span className="text-gray-400 italic">Non specificato</span>}
                </div>
              ) : (
                <select value={model} disabled={!manufacturer}
                  onChange={e => { setModel(e.target.value); setOd(o => ({ ...o, type: '' })); setOs(o => ({ ...o, type: '' })); }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white disabled:cursor-not-allowed">
                  <option value="">-- Seleziona Modello --</option>
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )}
            </div>

            <EyeConfig eye="od" label="OCCHIO DESTRO"  types={types} values={od} locked={lensLocked} onChange={vals => setOd(o => ({ ...o, ...vals }))} />
            <EyeConfig eye="os" label="OCCHIO SINISTRO" types={types} values={os} locked={lensLocked} onChange={vals => setOs(o => ({ ...o, ...vals }))} />
          </div>
        )}

        {/* Tab: Pagamento */}
        {activeTab === 'payment' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
            <div className="bg-gray-100 p-6 rounded-full mb-4">
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Pagamenti Digitali</h2>
            <p className="text-gray-500 mt-2">Questa funzionalità sarà disponibile a breve.<br />Per ora il pagamento avverrà in negozio o alla consegna.</p>
          </div>
        )}

        <button onClick={saveSettings}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md shadow-lg font-semibold hover:bg-blue-700 mt-6 sticky bottom-4">
          Conferma Installazione
        </button>
      </div>

      {/* Modal: ordina subito? */}
      {askModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center border-t-4 border-blue-500">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Configurazione Completata!</h3>
            <p className="text-gray-600 mb-6 text-sm">I tuoi dati sono stati salvati. Vuoi inviare subito un ordine per le tue lenti?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setAskModal(false); setView('action'); }}
                className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Sì, ordina ora</button>
              <button onClick={() => setAskModal(false)}
                className="w-full bg-gray-100 text-gray-700 font-bold py-3 rounded-lg hover:bg-gray-200">No, ordinerò più tardi</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── ACTION VIEW ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 relative text-center">

        {orderStatus === 'sending' && (
          <>
            <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mt-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <h1 className="text-3xl font-bold text-gray-800 mt-4">Invio in corso...</h1>
          </>
        )}

        {orderStatus === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h1 className="text-3xl font-bold text-gray-800">Grazie!</h1>
            <p className="text-lg text-gray-600 mt-4">Il tuo ordine è stato inviato.<br />Riceverai una notifica quando sarà pronto!</p>
          </>
        )}

        {orderStatus === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h1 className="text-3xl font-bold text-red-600">Errore</h1>
            <p className="text-gray-600 mt-4">Impossibile inviare l'ordine. Controlla la connessione e riprova.</p>
            <button onClick={() => setOrderStatus('idle')} className="mt-4 text-blue-600 underline text-sm">Riprova</button>
          </>
        )}

        {orderStatus === 'idle' && (
          <>
            <h1 className="text-3xl font-bold text-gray-800">Pronto per l'Ordine</h1>

            <div className="text-left bg-gray-50 p-4 rounded-lg my-6 border">
              <p className="text-gray-800 font-medium">{name}</p>
              <p className="text-gray-700 text-sm mt-1">
                {phone}{email ? ` | ${email}` : ''}
              </p>
              <p className="text-gray-600 text-sm">
                {delivery === 'delivery' ? `📦 Consegna: ${ls('address')}` : '🏪 Ritiro in negozio'}
              </p>
              <p className="text-gray-600 text-sm font-medium mt-1">{manufacturer} {model}</p>

              {/* OD */}
              <div className="flex justify-between items-center mt-3">
                <span className="text-gray-700 font-medium text-sm">OCCHIO DESTRO</span>
                <div className="flex items-center space-x-1">
                  <input type="number" min="1" value={quickQtyOD}
                    onChange={e => setQuickQtyOD(e.target.value)}
                    onBlur={e => setQuickQtyOD(Math.max(1, parseInt(e.target.value) || 1).toString())}
                    className="w-14 px-2 py-1 border border-gray-300 rounded-md text-center bg-white text-gray-900 text-sm" />
                  <span className="text-sm text-gray-600">pz.</span>
                </div>
              </div>
              <p className="text-gray-600 text-xs mt-1">
                {od.type || 'N/D'}{odParams.line ? ' · ' + odParams.line : ''}{odParams.add ? ' · ADD ' + odParams.add : ''}
              </p>

              {/* OS */}
              <div className="flex justify-between items-center mt-3">
                <span className="text-gray-700 font-medium text-sm">OCCHIO SINISTRO</span>
                <div className="flex items-center space-x-1">
                  <input type="number" min="1" value={quickQtyOS}
                    onChange={e => setQuickQtyOS(e.target.value)}
                    onBlur={e => setQuickQtyOS(Math.max(1, parseInt(e.target.value) || 1).toString())}
                    className="w-14 px-2 py-1 border border-gray-300 rounded-md text-center bg-white text-gray-900 text-sm" />
                  <span className="text-sm text-gray-600">pz.</span>
                </div>
              </div>
              <p className="text-gray-600 text-xs mt-1">
                {os.type || 'N/D'}{osParams.line ? ' · ' + osParams.line : ''}{osParams.add ? ' · ADD ' + osParams.add : ''}
              </p>
            </div>

            {/* Richiesta modifica prescrizione */}
            {changeReqDone && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center text-sm text-green-700 font-semibold">
                ✓ Prescrizione aggiornata dal tuo ottico!
              </div>
            )}
            {!changeReqDone && changeReqPending && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between text-sm text-yellow-800">
                <span>⏳ Richiesta modifica in attesa...</span>
                <button onClick={cancelChangeReq} className="text-xs underline text-yellow-600 ml-2 flex-shrink-0">Annulla</button>
              </div>
            )}
            {!changeReqDone && !changeReqPending && opticianId && (
              <button onClick={requestChange}
                className="text-xs text-gray-400 hover:text-blue-500 underline w-full text-center py-1">
                Richiedi aggiornamento prescrizione
              </button>
            )}

            {/* Toggle consegna + pulsanti */}
            <div className="flex items-center justify-between my-4 space-x-2">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <label className="toggle-switch flex-shrink-0">
                  <input type="checkbox" checked={delivery === 'delivery'}
                    onChange={e => {
                      const val = e.target.checked ? 'delivery' : 'pickup';
                      setDelivery(val);
                      lss('delivery', val);
                    }} />
                  <span className="slider" />
                </label>
                <span className="text-gray-900 font-bold text-sm truncate">{deliveryLabel}</span>
              </div>
              <button onClick={() => setView('settings')} title="Impostazioni"
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            <div className="mt-2">
              <button onClick={sendOrder} className="mx-auto block focus:outline-none rounded-full focus:ring-4 focus:ring-red-300 pulse-active">
                <img src="/buttonRed.png" alt="Invia Ordine Ora" className="w-36 h-36" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
