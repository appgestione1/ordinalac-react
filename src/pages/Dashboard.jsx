import { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, arrayUnion
} from 'firebase/firestore';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { auth, db } from '../firebase';
import ParamField from '../components/ParamField';
import { getRange, pwrOptions, cylOptions, axisOptions, addOptions } from '../lib/lensRanges';

// ── Helpers ──────────────────────────────────────────────────────────
const APP_URL = window.location.origin;

const STATUS_CONFIG = {
  new:        { label: 'Nuovo',       bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-l-blue-500' },
  processing: { label: 'In Lav.',     bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-l-yellow-500' },
  ready:      { label: 'Pronto',      bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-l-green-500' },
  completed:  { label: 'Consegnato',  bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-l-gray-300' },
  cancelled:  { label: 'Annullato',   bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-l-red-500' },
};

function buildQrUrl(uid, form, od, os) {
  const p = new URLSearchParams({
    oid: uid,
    n: form.name, ph: form.phone, e: form.email, cf: form.cf,
    sa: form.street, sc: form.city, sz: form.cap, sp: form.prov,
    m: od.manufacturer, md: od.model, mdos: os.model,
    tod: od.type, pod: od.pwr, cod: od.cyl, aod: od.axis, addod: od.add,
    tos: os.type, pos: os.pwr, cos: os.cyl, aos: os.axis, addos: os.add,
  });
  return `${APP_URL}/?${p.toString()}`;
}

function EyeParams({ eye }) {
  if (!eye) return null;
  return (
    <span className="flex flex-wrap gap-1 text-xs">
      <b>{eye.type || '-'}</b>
      {eye.pwr  && <span className="bg-gray-100 px-1 rounded border">SF:{eye.pwr}</span>}
      {eye.cyl  && <span className="bg-gray-100 px-1 rounded border">CYL:{eye.cyl}</span>}
      {eye.axis && <span className="bg-gray-100 px-1 rounded border">AX:{eye.axis}</span>}
      {eye.add  && <span className="bg-gray-100 px-1 rounded border">ADD:{eye.add}</span>}
    </span>
  );
}

const EMPTY_EYE_FORM = { manufacturer: '', model: '', type: '', pwr: '', cyl: '', axis: '', add: '' };

// ── Componente LensEyeForm (ottico compila prescrizione) ─────────────
function LensEyeForm({ label, color, lensData, ranges, value, onChange }) {
  const models = lensData && value.manufacturer ? Object.keys(lensData[value.manufacturer] || {}) : [];
  const types  = lensData && value.manufacturer && value.model ? lensData[value.manufacturer]?.[value.model] || [] : [];
  const t = (value.type || '').toLowerCase();
  const showPwr  = t && !t.includes('nessun');
  const showCyl  = t.includes('astigmatismo') || t.includes('toric') || t.includes('xr');
  const showAxis = showCyl;
  const showAdd  = t.includes('multifocal') || t.includes('presbiopia');
  const range = getRange(ranges, value.manufacturer, value.model, value.type);

  const inputCls = "w-full text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-blue-500 focus:border-blue-500";

  return (
    <div className={`relative border ${color === 'blue' ? 'border-blue-100 bg-blue-50/50' : 'border-green-100 bg-green-50/50'} rounded-xl p-4`}>
      <div className={`absolute -top-3 left-4 ${color === 'blue' ? 'bg-blue-600' : 'bg-green-600'} text-white text-xs font-bold px-2 py-1 rounded shadow-sm`}>
        {label}
      </div>
      <div className="mt-2 space-y-2">
        <select value={value.model} disabled={!value.manufacturer}
          onChange={e => onChange({ model: e.target.value, type: '', pwr: '', cyl: '', axis: '', add: '' })}
          className={inputCls}>
          <option value="">-- Modello Lente --</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={value.type} disabled={!value.model}
          onChange={e => onChange({ type: e.target.value, pwr: '', cyl: '', axis: '', add: '' })}
          className={inputCls}>
          <option value="">-- Tipo Lente --</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {value.type && (
          <div className="grid grid-cols-2 gap-2">
            {showPwr  && <div className="col-span-2"><ParamField placeholder="PWR (Sfera)" value={value.pwr} options={pwrOptions(range)} onChange={v => onChange({ pwr: v })} className={inputCls} /></div>}
            {showCyl  && <ParamField placeholder="CYL"  value={value.cyl}  options={cylOptions(range)}  onChange={v => onChange({ cyl: v })}  className={inputCls} />}
            {showAxis && <ParamField placeholder="AXIS" value={value.axis} options={axisOptions(range)} onChange={v => onChange({ axis: v })} className={inputCls} />}
            {showAdd  && <div className="col-span-2"><ParamField placeholder="ADD" value={value.add} options={addOptions(range)} onChange={v => onChange({ add: v })} className={inputCls} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [user, setUser]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        setUser(u);
        // Registra/aggiorna ottico nella collection ottici
        setDoc(doc(db, 'opticians', u.uid), {
          email: u.email,
          last_login: new Date(),
        }, { merge: true }).catch(() => {});
      } else {
        setUser(null);
        if (u?.isAnonymous) await signOut(auth);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  return user ? <DashboardPanel user={user} /> : <LoginView />;
}

// ── Login ─────────────────────────────────────────────────────────────
function LoginView() {
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
        setError('Email o password non corretti.');
      else if (code === 'auth/too-many-requests')
        setError('Troppi tentativi. Riprova tra qualche minuto.');
      else if (code === 'auth/network-request-failed')
        setError('Errore di rete. Controlla la connessione.');
      else if (code === 'auth/user-disabled')
        setError('Account disabilitato. Contatta il supporto.');
      else
        setError('Errore di accesso. Riprova.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-sm w-full space-y-8 p-8">
        <div className="text-center">
          <img src="/icon-192.png" alt="Push&Go" className="w-16 h-16 mx-auto mb-3" />
          <h2 className="text-3xl font-extrabold text-gray-900">Push&Go</h2>
          <p className="mt-1 text-sm font-medium text-blue-600">Portale Ottico</p>
          <p className="mt-2 text-sm text-gray-600">Accedi con le tue credenziali.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="block w-full px-3 py-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="block w-full px-3 py-3 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-200">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
        <div className="mt-6 flex justify-between items-center">
          <a href="/register" className="text-sm text-blue-600 hover:underline font-medium">
            Registrati
          </a>
          <a href="/superadmin" className="text-xs text-gray-300 hover:text-gray-500 transition">
            Pannello Admin →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Panel ───────────────────────────────────────────────────
function DashboardPanel({ user }) {
  const [tab, setTab]         = useState('orders');
  const [orders, setOrders]   = useState([]);
  const [requests, setRequests] = useState([]);
  const [masterCatalog, setMasterCatalog] = useState({});
  const [masterRanges, setMasterRanges] = useState({});
  const [myLensData, setMyLensData]       = useState({});
  const [myPricingConfig, setMyPricingConfig] = useState({});
  const [homeDelivery, setHomeDelivery]   = useState(true);
  const [search, setSearch]   = useState('');
  const [dateStart, setDateStart] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; });
  const [dateEnd, setDateEnd]     = useState(() => new Date().toISOString().split('T')[0]);

  // Modali
  const [showClientModal, setShowClientModal]   = useState(false);
  const [showPwdModal, setShowPwdModal]         = useState(false);
  const [showUserMenu, setShowUserMenu]         = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [supplyOrder, setSupplyOrder]           = useState(null);
  const [notifData, setNotifData]               = useState(null);
  const [pendingRequest, setPendingRequest]     = useState(null);

  // Accesso SuperAdmin nascosto
  const adminTaps = useRef(0);
  const [showAdminModal, setShowAdminModal]     = useState(false);
  const [adminPwd, setAdminPwd]                 = useState('');
  const [adminErr, setAdminErr]                 = useState('');

  const ADMIN_PASSWORD = 'admin';

  function handleAdminTap() {
    adminTaps.current += 1;
    if (adminTaps.current >= 7) {
      adminTaps.current = 0;
      setAdminPwd(''); setAdminErr('');
      setShowAdminModal(true);
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    try {
      const snap = await getDoc(doc(db, 'config', 'admin'));
      const stored = snap.exists() ? (snap.data().dashboardPassword || ADMIN_PASSWORD) : ADMIN_PASSWORD;
      if (adminPwd === stored) {
        setShowAdminModal(false);
        window.location.href = '/superadmin';
      } else {
        setAdminErr('Password non corretta.');
      }
    } catch {
      setAdminErr('Errore di connessione. Riprova.');
    }
  }

  // Carica ordini in real-time
  useEffect(() => {
    const start = new Date(dateStart); start.setHours(0,0,0,0);
    const end   = new Date(dateEnd);   end.setHours(23,59,59,999);
    const q = query(
      collection(db, 'orders'),
      where('optician_id', '==', user.uid),
      where('timestamp', '>=', start),
      where('timestamp', '<=', end)
    );
    const unsub = onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a,b) => (b.timestamp?.seconds||0) - (a.timestamp?.seconds||0));
      setOrders(data);
    });
    return unsub;
  }, [user.uid, dateStart, dateEnd]);

  // Ascolta richieste modifica
  useEffect(() => {
    const q = query(collection(db, 'change_requests'),
      where('optician_id', '==', user.uid), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user.uid]);

  // Carica catalogo master + config ottico
  useEffect(() => {
    getDoc(doc(db, 'catalogs', 'master')).then(s => {
      if (s.exists()) {
        setMasterCatalog(s.data().data || {});
        setMasterRanges(s.data().ranges || {});
      }
    });
    getDoc(doc(db, 'optician_config', user.uid, 'lenses', 'main')).then(s => {
      if (s.exists()) {
        setMyLensData(s.data().data || {});
        setMyPricingConfig(s.data().pricing_config || {});
      }
    });
    getDoc(doc(db, 'optician_config', user.uid, 'settings', 'main')).then(s => {
      if (s.exists()) setHomeDelivery(s.data().home_delivery !== false);
    });
  }, [user.uid]);

  async function toggleHomeDelivery() {
    const next = !homeDelivery;
    setHomeDelivery(next);
    try {
      await setDoc(doc(db, 'optician_config', user.uid, 'settings', 'main'),
        { home_delivery: next }, { merge: true });
    } catch {
      setHomeDelivery(!next);
      alert('Errore nel salvataggio dell\'impostazione. Riprova.');
    }
  }

  async function handleStatusChange(orderId, newStatus) {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
    } catch {
      alert('Errore nel salvataggio dello stato. Riprova.');
      return;
    }
    if (newStatus !== 'ready' && newStatus !== 'processing') return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    const name  = order.patient_name || 'Cliente';
    const phone = order.client_info?.phone;
    const email = order.client_info?.email;
    const body  = newStatus === 'ready'
      ? `Ciao ${name}, le tue lenti sono pronte! Ti aspettiamo.`
      : `Ciao ${name}, abbiamo preso in carico il tuo ordine.`;
    setNotifData({ phone, email, body, subject: newStatus === 'ready' ? 'Lenti pronte! 👓' : 'Ordine in lavorazione' });
  }

  async function handleDelete(id) {
    if (!confirm('Eliminare questo ordine?')) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch {
      alert('Errore durante l\'eliminazione. Riprova.');
    }
  }

  async function handleSupply(orderId, destination) {
    await updateDoc(doc(db, 'orders', orderId), {
      supply_request: { status: 'pending', destination, requested_at: new Date() }
    });
    setSupplyOrder(null);
  }

  async function saveCatalog(pricingConfig, lensData) {
    await setDoc(doc(db, 'optician_config', user.uid, 'lenses', 'main'), {
      data: lensData, pricing_config: pricingConfig
    });
    setMyLensData(lensData); setMyPricingConfig(pricingConfig);
    alert('Listino salvato!');
  }

  function sendNotification() {
    if (!notifData) return;
    const { phone, email, body, subject } = notifData;
    if (phone) {
      let p = phone.replace(/[^0-9]/g, '');
      if (!p.startsWith('39')) p = '39' + p;
      window.open(`https://wa.me/${p}?text=${encodeURIComponent(body)}`, '_blank');
    } else if (email) {
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    }
    setNotifData(null);
  }

  const filtered = orders.filter(o => (o.patient_name||'').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <h1 onClick={handleAdminTap} className="text-xl font-bold text-blue-600 flex items-center gap-2 cursor-default select-none">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Push&Go
            </h1>
            <div className="hidden md:flex gap-6 h-full items-center">
              {['orders','config'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`text-sm px-1 py-5 border-b-2 transition ${tab===t ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {t === 'orders' ? 'Gestione Ordini' : 'Listino & Prezzi'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifiche */}
            <div className="relative">
              <button onClick={() => setShowNotifDropdown(v => !v)} className="p-1 rounded-full text-gray-400 hover:text-gray-600 relative">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {requests.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">
                    {requests.length}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-gray-100 z-50 max-h-64 overflow-y-auto">
                  <div className="px-4 py-2 text-xs font-bold text-gray-500 border-b">Richieste Modifica Dati</div>
                  {requests.length === 0
                    ? <p className="text-xs text-gray-400 p-4 text-center">Nessuna richiesta.</p>
                    : requests.map(r => (
                      <div key={r.id} onClick={() => { setPendingRequest(r); setShowNotifDropdown(false); }}
                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
                        <p className="text-sm font-bold text-gray-800">{r.client_name || 'Cliente'}</p>
                        <p className="text-xs text-gray-500">Richiesta cambio lenti</p>
                        {r.created_at?.seconds && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(r.created_at.seconds * 1000).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-500">Loggato come</p>
              <p className="text-sm font-bold text-gray-800">{user.email}</p>
            </div>
            <div className="relative">
              <button onClick={() => setShowUserMenu(v => !v)} className="text-gray-500 hover:text-gray-700">
                <svg className="h-8 w-8 rounded-full bg-gray-100 p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-100 z-50">
                  <button onClick={() => { setShowPwdModal(true); setShowUserMenu(false); }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Profilo & Password</button>
                  <button onClick={() => signOut(auth)}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Esci</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Contenuto */}
      <main className="flex-1 p-4 sm:p-6 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full">

          {/* ── TAB: ORDINI ── */}
          {tab === 'orders' && (
            <div className="flex flex-col gap-4">
              {/* Toolbar */}
              <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <button onClick={() => setShowClientModal(true)}
                  className="w-full md:w-auto bg-green-600 text-white py-2 px-4 rounded-md text-sm font-bold hover:bg-green-700 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Nuovo Cliente / QR
                </button>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <div className="relative flex-grow">
                    <input type="text" placeholder="Cerca cliente..." value={search} onChange={e => setSearch(e.target.value)}
                      className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                    <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <div className="flex items-center bg-gray-100 rounded-md px-2 border border-gray-200 gap-1">
                    <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0 text-gray-600 w-28" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="bg-transparent border-none text-xs focus:ring-0 text-gray-600 w-28" />
                  </div>
                </div>
              </div>

              {/* Codice ottico */}
              <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-3 rounded shadow-sm flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold">Il tuo Codice Ottico: </span>
                  <code className="font-mono bg-white px-2 py-1 rounded border border-blue-200 ml-2 select-all cursor-pointer text-xs"
                    onClick={() => navigator.clipboard.writeText(user.uid)} title="Clicca per copiare">
                    {user.uid}
                  </code>
                </div>
                <span className="text-xs hidden sm:inline">Clicca per copiare</span>
              </div>

              {/* Servizio consegna a domicilio */}
              <div className={`p-3 rounded shadow-sm flex justify-between items-center text-sm border-l-4 ${homeDelivery ? 'bg-green-50 border-green-500' : 'bg-gray-50 border-gray-400'}`}>
                <div>
                  <span className={`font-bold ${homeDelivery ? 'text-green-800' : 'text-gray-600'}`}>
                    Consegna a domicilio: {homeDelivery ? 'attiva' : 'disattivata'}
                  </span>
                  <p className={`text-xs mt-0.5 ${homeDelivery ? 'text-green-700' : 'text-gray-500'}`}>
                    {homeDelivery
                      ? 'I tuoi clienti possono scegliere la spedizione a casa dall\'app.'
                      : 'I tuoi clienti possono ordinare solo con ritiro in negozio.'}
                  </p>
                </div>
                <label className="toggle-switch flex-shrink-0">
                  <input type="checkbox" checked={homeDelivery} onChange={toggleHomeDelivery} />
                  <span className="slider" />
                </label>
              </div>

              {/* Lista ordini */}
              <div className="space-y-4">
                {filtered.length === 0
                  ? <div className="text-center p-10 bg-white rounded shadow-sm"><p className="text-gray-500">Nessun ordine trovato.</p></div>
                  : filtered.map(order => <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} onDelete={handleDelete} onSupply={setSupplyOrder} />)
                }
              </div>
            </div>
          )}

          {/* ── TAB: LISTINO ── */}
          {tab === 'config' && (
            <CatalogTab masterCatalog={masterCatalog} myPricingConfig={myPricingConfig} onSave={saveCatalog} />
          )}
        </div>
      </main>

      {/* ── MODALI ── */}
      {showClientModal && (
        <ClientModal uid={user.uid} myLensData={myLensData} ranges={masterRanges} onClose={() => setShowClientModal(false)} />
      )}
      {showPwdModal && (
        <PasswordModal onClose={() => setShowPwdModal(false)} />
      )}
      {supplyOrder && (
        <SupplyModal order={supplyOrder} onSupply={handleSupply} onClose={() => setSupplyOrder(null)} />
      )}
      {notifData && (
        <NotificationModal data={notifData} onSend={sendNotification} onClose={() => setNotifData(null)} />
      )}
      {pendingRequest && (
        <RequestModal req={pendingRequest} myLensData={myLensData} ranges={masterRanges} onClose={() => setPendingRequest(null)} />
      )}

      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl p-6 border-t-4 border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Accesso riservato</h3>
            <p className="text-xs text-gray-500 mb-4">Inserisci la password di amministrazione.</p>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input type="password" autoFocus placeholder="Password" value={adminPwd}
                onChange={e => { setAdminPwd(e.target.value); setAdminErr(''); }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-gray-800 focus:border-gray-800" />
              {adminErr && <p className="text-red-500 text-xs">{adminErr}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                  Annulla
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800">
                  Entra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────
function OrderCard({ order, onStatusChange, onDelete, onSupply }) {
  const status = order.status || 'new';
  const conf   = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const l      = order.lens_order || {};
  const isDel  = order.delivery?.mode === 'delivery';
  const date   = order.timestamp?.seconds
    ? new Date(order.timestamp.seconds * 1000).toLocaleString('it-IT', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' })
    : '';

  const hasSupply = order.supply_request?.status === 'pending';
  const supplyDest = order.supply_request?.destination;

  return (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 ${conf.border} p-4 flex flex-col gap-3`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{order.patient_name || 'Sconosciuto'}</h3>
          <div className="flex items-center text-xs text-gray-500 gap-2 mt-1">
            <span>📅 {date}</span>
            <span className="border px-1 rounded bg-gray-50">{isDel ? '🚚 Domicilio' : '🏬 Ritiro'}</span>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${conf.bg} ${conf.text}`}>{conf.label}</span>
      </div>

      <div className="bg-gray-50 p-3 rounded border border-gray-100 text-sm">
        <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
          <span className="font-bold">{l.manufacturer} {l.model}</span>
          {hasSupply
            ? <span className={`px-2 py-1 rounded text-xs font-bold ${supplyDest === 'client' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                {supplyDest === 'client' ? '🟣 Fornitura: CLIENTE' : '🟠 Fornitura: NEGOZIO'}
              </span>
            : status !== 'cancelled' && status !== 'completed' && (
              <button onClick={() => onSupply(order)}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-bold transition">
                📦 Ordina al Fornitore
              </button>
            )
          }
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex justify-between items-center border-b pb-1">
            <span className="font-bold text-blue-600 w-8 text-xs">OD</span>
            <div className="flex-1 text-right"><EyeParams eye={l.od} /></div>
            <span className="font-bold ml-2 bg-white border px-1 rounded text-xs">{l.od?.qty||1}pz</span>
          </div>
          <div className="flex justify-between items-center border-b pb-1">
            <span className="font-bold text-green-600 w-8 text-xs">OS</span>
            <div className="flex-1 text-right"><EyeParams eye={l.os} /></div>
            <span className="font-bold ml-2 bg-white border px-1 rounded text-xs">{l.os?.qty||1}pz</span>
          </div>
        </div>
      </div>

      {order.client_info?.phone && (
        <div className="text-xs text-gray-600">📞 {order.client_info.phone}</div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <select value={status} onChange={e => onStatusChange(order.id, e.target.value)}
          className="text-xs border-gray-300 rounded shadow-sm py-1 pr-8">
          <option value="new">Nuovo</option>
          <option value="processing">In Lavorazione</option>
          <option value="ready">Pronto</option>
          <option value="completed">Consegnato</option>
          <option value="cancelled">Annullato</option>
        </select>
        <div className="flex gap-3">
          <button onClick={() => printOrder(order)} title="Stampa" className="text-gray-400 hover:text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </button>
          <button onClick={() => onDelete(order.id)} title="Elimina" className="text-gray-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function printOrder(order) {
  const l = order.lens_order || {};
  const w = window.open('', '_blank', 'height=600,width=800');
  w.document.write(`<html><head><title>Ordine - ${order.patient_name}</title>
    <style>body{font-family:sans-serif;padding:20px;} table{border-collapse:collapse;width:100%} td,th{border:1px solid #ddd;padding:8px;}</style>
    </head><body>
    <h2>Ordine Lenti — ${order.patient_name}</h2>
    <p><b>Produttore:</b> ${l.manufacturer}</p>
    <table><tr><th>Occhio</th><th>Modello</th><th>Tipo</th><th>PWR</th><th>CYL</th><th>AXIS</th><th>ADD</th><th>Qty</th></tr>
    <tr><td>OD</td><td>${l.od?.model||l.model||'-'}</td><td>${l.od?.type||'-'}</td><td>${l.od?.pwr||'-'}</td><td>${l.od?.cyl||'-'}</td><td>${l.od?.axis||'-'}</td><td>${l.od?.add||'-'}</td><td>${l.od?.qty||1}</td></tr>
    <tr><td>OS</td><td>${l.os?.model||l.model||'-'}</td><td>${l.os?.type||'-'}</td><td>${l.os?.pwr||'-'}</td><td>${l.os?.cyl||'-'}</td><td>${l.os?.axis||'-'}</td><td>${l.os?.add||'-'}</td><td>${l.os?.qty||1}</td></tr>
    </table>
    <p><b>Consegna:</b> ${order.delivery?.mode === 'delivery' ? order.delivery?.address_full : 'Ritiro in negozio'}</p>
    <script>window.print();window.close();<\/script></body></html>`);
  w.document.close();
}

// ── Modale Nuovo Cliente + QR ─────────────────────────────────────────
function ClientModal({ uid, myLensData, ranges, onClose }) {
  const [step, setStep]   = useState('form'); // 'form' | 'qr'
  const [qrUrl, setQrUrl] = useState('');
  const [form, setForm]   = useState({ name:'', cf:'', email:'', phone:'', street:'', city:'', cap:'', prov:'' });
  const [od, setOd]       = useState(EMPTY_EYE_FORM);
  const [os, setOs]       = useState(EMPTY_EYE_FORM);
  const [lensManuf, setLensManuf] = useState(''); // produttore comune; modello per occhio in od/os
  const qrCanvasRef = useRef(null);

  function printQR() {
    const canvas = qrCanvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const w = window.open('', '_blank', 'width=400,height=520');
    w.document.write(`<!DOCTYPE html><html><head><title>QR – ${form.name}</title>
      <style>body{margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#fff;}
      h2{margin:0 0 4px;font-size:18px;} p{margin:0 0 16px;color:#555;font-size:13px;} img{border:1px solid #eee;padding:8px;border-radius:8px;}</style>
      </head><body>
      <h2>${form.name}</h2>
      <p>${lensManuf} ${od.model === os.model ? od.model : `OD: ${od.model} / OS: ${os.model}`}</p>
      <img src="${dataUrl}" width="220" height="220" />
      <script>window.onload=function(){window.print();window.close();}<\/script>
      </body></html>`);
    w.document.close();
  }

  function handleManufChange(m) {
    setLensManuf(m);
    setOd({ ...EMPTY_EYE_FORM, manufacturer: m });
    setOs({ ...EMPTY_EYE_FORM, manufacturer: m });
  }

  function generateQR() {
    const url = buildQrUrl(uid, form,
      { ...od, manufacturer: lensManuf },
      { ...os, manufacturer: lensManuf }
    );
    setQrUrl(url); setStep('qr');
  }

  const inputCls = "block w-full rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 pl-3";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Nuovo Cliente</h2>
            <p className="text-indigo-200 text-sm mt-1">Compila la scheda per generare il QR Code personale.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {step === 'form' ? (
          <>
            <div className="p-6 overflow-y-auto bg-gray-50 space-y-6 flex-1">
              {/* Dati personali */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-4">① Dati Personali</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[['Nome e Cognome','text','name'],['Codice Fiscale','text','cf'],['Email','email','email'],['Telefono','tel','phone']].map(([label,type,key]) => (
                    <div key={key}>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">{label}</label>
                      <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: key==='cf' ? e.target.value.toUpperCase() : e.target.value }))}
                        className={inputCls} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Indirizzo */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-4">② Indirizzo di Spedizione</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Via / Piazza e Civico</label>
                    <input type="text" value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} className={inputCls} placeholder="Via Roma 1" />
                  </div>
                  <div className="grid grid-cols-6 gap-3">
                    <div className="col-span-3">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Città</label>
                      <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">CAP</label>
                      <input type="text" value={form.cap} onChange={e => setForm(f => ({ ...f, cap: e.target.value }))} className={inputCls} />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Prov</label>
                      <input type="text" value={form.prov} maxLength={2} onChange={e => setForm(f => ({ ...f, prov: e.target.value.toUpperCase() }))} className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prescrizione */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-4">③ Prescrizione Lenti</h4>
                <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Produttore (comune ai due occhi)</label>
                  <select value={lensManuf} onChange={e => handleManufChange(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 shadow-sm text-sm py-2 pl-3">
                    <option value="">-- Seleziona --</option>
                    {Object.keys(myLensData).map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-2">Il modello lente si sceglie per ciascun occhio qui sotto (può essere diverso tra OD e OS).</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <LensEyeForm label="OCCHIO DESTRO (OD)" color="blue"  lensData={myLensData} ranges={ranges} value={{ ...od, manufacturer: lensManuf }} onChange={vals => setOd(o => ({ ...o, ...vals }))} />
                  <LensEyeForm label="OCCHIO SINISTRO (OS)" color="green" lensData={myLensData} ranges={ranges} value={{ ...os, manufacturer: lensManuf }} onChange={vals => setOs(o => ({ ...o, ...vals }))} />
                </div>
              </div>
            </div>
            <div className="p-5 border-t bg-white flex justify-end gap-4 sticky bottom-0">
              <button onClick={onClose} className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50">Annulla</button>
              <button onClick={generateQR} disabled={!form.name || !lensManuf || !od.model || !os.model}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">
                Genera QR
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white overflow-y-auto">
            <div className="bg-green-50 rounded-full p-4 mb-4">
              <svg className="h-12 w-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-2">QR Code Pronto!</h3>
            <p className="text-gray-500 mb-8 max-w-sm">Fai scansionare questo codice al cliente per configurare automaticamente la sua App.</p>
            <div ref={qrCanvasRef} className="bg-white p-4 border-2 border-gray-100 rounded-2xl shadow-lg mb-8">
              <QRCodeCanvas value={qrUrl} size={220} />
            </div>
            <div className="flex gap-4 w-full max-w-xs">
              <button onClick={printQR} className="flex-1 bg-gray-800 text-white py-3 rounded-xl font-bold hover:bg-gray-900">Stampa</button>
              <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200">Chiudi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Listino & Prezzi ──────────────────────────────────────────────────
function CatalogTab({ masterCatalog, myPricingConfig, onSave }) {
  const [config, setConfig] = useState(myPricingConfig);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setConfig(myPricingConfig); }, [myPricingConfig]);

  function toggle(key, checked) { setConfig(c => ({ ...c, [key]: { ...c[key], enabled: checked } })); }
  function setPrice(key, price) { setConfig(c => ({ ...c, [key]: { ...c[key], price } })); }

  async function handleSave() {
    setSaving(true);
    const newLensData = {};
    Object.keys(masterCatalog).forEach(manuf => {
      Object.keys(masterCatalog[manuf]).forEach(model => {
        masterCatalog[manuf][model].forEach(type => {
          const key = `${manuf}::${model}::${type}`;
          if (config[key]?.enabled) {
            if (!newLensData[manuf]) newLensData[manuf] = {};
            if (!newLensData[manuf][model]) newLensData[manuf][model] = [];
            newLensData[manuf][model].push(type);
          }
        });
      });
    });
    await onSave(config, newLensData);
    setSaving(false);
  }

  if (Object.keys(masterCatalog).length === 0) return (
    <div className="bg-white rounded-lg shadow-sm p-10 text-center text-gray-500">
      Il catalogo Master è vuoto. Aggiungi lenti dal pannello SuperAdmin.
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
      <div className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-lg flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Listino Lenti</h2>
          <p className="text-sm text-gray-500">Abilita le lenti e imposta i prezzi per i tuoi clienti.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow font-bold transition disabled:opacity-60">
          {saving ? 'Salvataggio...' : 'Salva Listino'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 space-y-6">
        {Object.keys(masterCatalog).sort().map(manuf => (
          <div key={manuf} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-bold text-indigo-800 mb-4 pb-2 border-b border-gray-100">{manuf}</h3>
            {Object.keys(masterCatalog[manuf]).map(model => (
              <div key={model} className="mb-4 pl-2 border-l-2 border-indigo-100">
                <h4 className="text-md font-bold text-gray-700 mb-2">{model}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {masterCatalog[manuf][model].map(type => {
                    const key = `${manuf}::${model}::${type}`;
                    const enabled = config[key]?.enabled || false;
                    const price   = config[key]?.price   || '';
                    return (
                      <div key={type} className="bg-gray-50 p-2 rounded border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={enabled} onChange={e => toggle(key, e.target.checked)}
                            className="h-4 w-4 text-indigo-600 rounded cursor-pointer" />
                          <span className="text-sm font-medium text-gray-700">{type}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-400">€</span>
                          <input type="number" step="0.01" value={price} disabled={!enabled}
                            onChange={e => setPrice(key, e.target.value)}
                            placeholder="0.00" className="w-20 text-sm border-gray-300 rounded px-2 py-1 disabled:bg-gray-100" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal Fornitura ───────────────────────────────────────────────────
function SupplyModal({ order, onSupply, onClose }) {
  const isDel = order.delivery?.mode === 'delivery';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border-t-4 border-indigo-500">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Richiesta Fornitura Lenti</h3>
        <p className="text-sm text-gray-600 mb-6">Seleziona la destinazione per <b>{order.patient_name}</b>.</p>
        <div className="space-y-3">
          {isDel && (
            <button onClick={() => onSupply(order.id, 'client')}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg">
              Spedisci al Cliente (Drop-shipping)
            </button>
          )}
          <button onClick={() => onSupply(order.id, 'store')}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">
            Spedisci in Negozio (Rifornimento)
          </button>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg border border-gray-300">Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Notifica ────────────────────────────────────────────────────
function NotificationModal({ data, onSend, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border-t-4 border-green-500">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Notifica Cliente</h3>
        <p className="text-sm text-gray-600 mb-6">Vuoi inviare una notifica al cliente?</p>
        <div className="space-y-3">
          <button onClick={onSend} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">
            {data.phone ? '📱 Invia su WhatsApp' : '📧 Invia Email'}
          </button>
          <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-lg border border-gray-300">No, grazie</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Password ────────────────────────────────────────────────────
function PasswordModal({ onClose }) {
  const [pwd, setPwd]     = useState('');
  const [msg, setMsg]     = useState('');
  const [ok, setOk]       = useState(false);
  const [busy, setBusy]   = useState(false);

  async function save() {
    if (pwd.length < 6) { setMsg('La password deve avere almeno 6 caratteri.'); return; }
    setBusy(true);
    try {
      await updatePassword(auth.currentUser, pwd);
      // Aggiorna anche la password visibile nel SuperAdmin
      updateDoc(doc(db, 'opticians', auth.currentUser.uid), { password: pwd }).catch(() => {});
      setMsg('Password aggiornata!'); setOk(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      if (e?.code === 'auth/requires-recent-login')
        setMsg('Sessione scaduta. Esci e rientra per modificare la password.');
      else
        setMsg('Errore: ' + e.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-6 z-50">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Modifica Password</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nuova Password</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500" />
          </div>
          {msg && <p className={`text-sm font-medium ${ok ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
          <button onClick={save} disabled={busy}
            className="w-full bg-blue-600 text-white py-2 rounded-md font-bold hover:bg-blue-700 disabled:opacity-60">
            {busy ? 'Salvataggio...' : 'Aggiorna Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Richiesta Modifica ──────────────────────────────────────────
function RequestModal({ req, myLensData, ranges, onClose }) {
  const cur = req.current_data || {};
  const [manuf, setManuf] = useState(cur.manufacturer || '');
  const [od, setOd] = useState({ model: cur.od?.model || cur.model || '', type: cur.od?.type||'', pwr: cur.od?.pwr||'', cyl: cur.od?.cyl||'', axis: cur.od?.axis||'', add: cur.od?.add||'' });
  const [os, setOs] = useState({ model: cur.os?.model || cur.model || '', type: cur.os?.type||'', pwr: cur.os?.pwr||'', cyl: cur.os?.cyl||'', axis: cur.os?.axis||'', add: cur.os?.add||'' });

  const inputCls = "w-full border rounded p-1 text-sm";

  async function save() {
    // model legacy = modello OD (per compatibilità con dati/UI esistenti)
    const newData = { manufacturer: manuf, model: od.model, od, os };
    await updateDoc(doc(db, 'change_requests', req.id), {
      new_data: newData, status: 'completed'
    });

    // Aggiorna client_profiles con nuova prescrizione + voce storico
    const historyEntry = {
      ...newData,
      updated_at:  new Date().toISOString(),
      updated_by:  'optician',
      optician_id: req.optician_id,
      client_name: req.client_name || '',
    };
    const profileUpdate = {
      lens:                  newData,
      updated_at:            new Date(),
      prescription_history:  arrayUnion(historyEntry),
    };

    try {
      if (req.client_uid) {
        // Percorso diretto tramite uid
        await setDoc(doc(db, 'client_profiles', req.client_uid), profileUpdate, { merge: true });
      } else {
        // Fallback: cerca per ottico + telefono o email
        const searchField = req.client_phone ? 'phone' : req.client_email ? 'email' : null;
        const searchValue = req.client_phone || req.client_email || null;
        if (searchField && searchValue) {
          const snap = await getDocs(query(
            collection(db, 'client_profiles'),
            where('optician_id', '==', req.optician_id),
            where(searchField, '==', searchValue)
          ));
          if (!snap.empty) {
            await updateDoc(snap.docs[0].ref, profileUpdate);
          } else {
            console.warn('client_profiles: nessun profilo trovato per questo cliente');
          }
        } else {
          console.warn('client_profiles: client_uid e phone/email mancanti nella change_request');
        }
      }
    } catch (err) {
      console.error('Errore aggiornamento client_profiles:', err);
    }

    alert('Aggiornamento inviato al cliente!');
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6 border-t-4 border-blue-500 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Aggiorna Dati Cliente</h3>
        <p className="text-sm text-gray-600 mb-4">Modifica i parametri e invia l'aggiornamento all'app del cliente.</p>
        <div className="mb-4">
          <label className="text-xs font-bold">Produttore (comune ai due occhi)</label>
          <select value={manuf} onChange={e => { setManuf(e.target.value); setOd(v => ({ ...v, model: '', type: '' })); setOs(v => ({ ...v, model: '', type: '' })); }} className={inputCls}>
            <option value="">--</option>
            {Object.keys(myLensData).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-6 pt-3">
          <LensEyeForm label="OCCHIO DESTRO (OD)" color="blue"  lensData={myLensData} ranges={ranges} value={{ ...od, manufacturer: manuf }} onChange={vals => setOd(v => ({ ...v, ...vals }))} />
          <LensEyeForm label="OCCHIO SINISTRO (OS)" color="green" lensData={myLensData} ranges={ranges} value={{ ...os, manufacturer: manuf }} onChange={vals => setOs(v => ({ ...v, ...vals }))} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold">Annulla</button>
          <button onClick={save} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700">Invia Aggiornamento</button>
        </div>
      </div>
    </div>
  );
}
