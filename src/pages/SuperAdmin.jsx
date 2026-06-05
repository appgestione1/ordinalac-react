import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Email dedicata SuperAdmin — non collegata a nessun ottico registrato
// Per cambiarla: creare un nuovo utente Firebase Auth e aggiornare questa costante
const SUPERADMIN_EMAIL = 'solevista@gmail.com';

// ── Login (solo password, email nascosta) ─────────────────────────────
function LoginView() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, SUPERADMIN_EMAIL, password);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password')
        setError('Password non corretta.');
      else if (code === 'auth/too-many-requests')
        setError('Troppi tentativi. Riprova tra qualche minuto.');
      else
        setError('Errore di accesso. Riprova.');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-sm w-full p-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-100 rounded-full mb-4">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Pannello Admin</h2>
          <p className="text-sm text-gray-500 mt-1">Accesso riservato</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" required autoFocus placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            className="block w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
          {error && <p className="text-red-600 text-sm text-center bg-red-50 p-2 rounded border border-red-200">{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {busy ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Gestione Ottici ───────────────────────────────────────────────────
function OtticiTab({ catalog }) {
  const [opticians, setOpticians]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [selOptician, setSelOptician] = useState(null);
  const [innerTab, setInnerTab]       = useState('profilo'); // 'profilo' | 'prodotti'
  const [opticianCfg, setOpticianCfg] = useState({});
  const [loadingCfg, setLoadingCfg]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saveMsg, setSaveMsg]         = useState('');
  const [showPwd, setShowPwd]         = useState(false);

  // Edit modal
  const [editModal, setEditModal]     = useState(false);
  const [editForm, setEditForm]       = useState({});
  const [editBusy, setEditBusy]       = useState(false);
  const [editMsg, setEditMsg]         = useState('');
  const setE = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    getDocs(collection(db, 'opticians')).then(snap => {
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.ragioneSociale || a.email || '').localeCompare(b.ragioneSociale || b.email || ''));
      setOpticians(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function selectOptician(opt) {
    setSelOptician(opt);
    setInnerTab('profilo');
    setShowPwd(false);
    setLoadingCfg(true);
    setOpticianCfg({});
    try {
      const snap = await getDoc(doc(db, 'optician_config', opt.uid, 'lenses', 'main'));
      setOpticianCfg(snap.exists() ? (snap.data().pricing_config || {}) : {});
    } catch { /* vuoto */ }
    setLoadingCfg(false);
  }

  function toggle(key, checked) { setOpticianCfg(c => ({ ...c, [key]: { ...c[key], enabled: checked } })); }
  function setPrice(key, price) { setOpticianCfg(c => ({ ...c, [key]: { ...c[key], price } })); }

  async function deleteOptician(opt) {
    if (!confirm(`Eliminare l'ottico "${opt.ragioneSociale || opt.email}"?\n\nVerranno rimossi profilo e configurazione prodotti.\nNota: l'account Firebase rimane attivo (rimuoverlo dalla console Firebase se necessario).`)) return;
    try {
      await deleteDoc(doc(db, 'opticians', opt.uid));
      await deleteDoc(doc(db, 'optician_config', opt.uid, 'lenses', 'main')).catch(() => {});
      setOpticians(list => list.filter(o => o.uid !== opt.uid));
      if (selOptician?.uid === opt.uid) setSelOptician(null);
    } catch { alert('Errore durante l\'eliminazione. Riprova.'); }
  }

  function openEdit(opt) {
    setEditForm({
      ragioneSociale: opt.ragioneSociale || '',
      piva:           opt.piva || '',
      cf:             opt.cf || '',
      telefono:       opt.telefono || '',
      pec:            opt.pec || '',
      sdi:            opt.sdi || '0000000',
      via:            opt.via || '',
      civico:         opt.civico || '',
      cap:            opt.cap || '',
      citta:          opt.citta || '',
      provincia:      opt.provincia || '',
    });
    setEditMsg('');
    setEditModal(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!selOptician) return;
    setEditBusy(true); setEditMsg('');
    try {
      const updates = {
        ragioneSociale: editForm.ragioneSociale.trim(),
        piva:           editForm.piva.trim(),
        cf:             editForm.cf.trim().toUpperCase(),
        telefono:       editForm.telefono.trim(),
        pec:            editForm.pec.trim(),
        sdi:            editForm.sdi.trim() || '0000000',
        via:            editForm.via.trim(),
        civico:         editForm.civico.trim(),
        cap:            editForm.cap.trim(),
        citta:          editForm.citta.trim(),
        provincia:      editForm.provincia.trim().toUpperCase(),
      };
      await updateDoc(doc(db, 'opticians', selOptician.uid), updates);
      const updated = { ...selOptician, ...updates };
      setSelOptician(updated);
      setOpticians(list => list.map(o => o.uid === selOptician.uid ? updated : o));
      setEditMsg('ok');
      setTimeout(() => { setEditModal(false); setEditMsg(''); }, 900);
    } catch { setEditMsg('Errore nel salvataggio. Riprova.'); }
    setEditBusy(false);
  }

  async function saveCfg() {
    if (!selOptician) return;
    setSaving(true); setSaveMsg('');
    const newLensData = {};
    Object.keys(catalog).forEach(manuf => {
      Object.keys(catalog[manuf]).forEach(model => {
        catalog[manuf][model].forEach(type => {
          const key = `${manuf}::${model}::${type}`;
          if (opticianCfg[key]?.enabled) {
            if (!newLensData[manuf]) newLensData[manuf] = {};
            if (!newLensData[manuf][model]) newLensData[manuf][model] = [];
            newLensData[manuf][model].push(type);
          }
        });
      });
    });
    try {
      await setDoc(doc(db, 'optician_config', selOptician.uid, 'lenses', 'main'), {
        data: newLensData, pricing_config: opticianCfg,
      });
      setSaveMsg('Salvato!');
    } catch { setSaveMsg('Errore nel salvataggio.'); }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 2500);
  }

  const manufs = Object.keys(catalog).sort();
  const o = selOptician;

  const InfoRow = ({ label, value, mono }) => value ? (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide w-36 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  ) : null;

  return (
    <div className="max-w-7xl mx-auto p-6 flex gap-6">

      {/* Lista ottici */}
      <div className="w-72 flex-shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex justify-between items-center">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Ottici Registrati</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full">{opticians.length}</span>
          </div>
          <div className="overflow-y-auto max-h-[75vh]">
            {loading
              ? <p className="text-gray-400 text-sm text-center p-6">Caricamento...</p>
              : opticians.length === 0
                ? <div className="p-6 text-center">
                    <p className="text-gray-500 text-sm font-medium">Nessun ottico registrato.</p>
                    <p className="text-gray-400 text-xs mt-2">Gli ottici appaiono qui dopo la registrazione o il primo accesso.</p>
                  </div>
                : opticians.map(opt => (
                  <div key={opt.uid}
                    className={`border-b border-gray-50 transition ${selOptician?.uid === opt.uid ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : 'hover:bg-gray-50'}`}>
                    <button onClick={() => selectOptician(opt)} className="w-full text-left px-4 py-3">
                      <p className={`text-sm font-semibold truncate ${selOptician?.uid === opt.uid ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {opt.ragioneSociale || opt.email}
                      </p>
                      {opt.ragioneSociale && <p className="text-xs text-gray-400 truncate">{opt.email}</p>}
                      {opt.last_login?.seconds && (
                        <p className="text-xs text-gray-300 mt-0.5">
                          Accesso: {new Date(opt.last_login.seconds * 1000).toLocaleDateString('it-IT')}
                        </p>
                      )}
                    </button>
                    <div className="flex gap-1 px-4 pb-2">
                      <button onClick={() => { selectOptician(opt); openEdit(opt); }}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Modifica
                      </button>
                      <button onClick={() => deleteOptician(opt)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Elimina
                      </button>
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      </div>

      {/* Pannello dettaglio ottico */}
      <div className="flex-1 min-w-0">
        {!selOptician ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-64 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Seleziona un ottico dalla lista.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">

            {/* Header + tab interni */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{o.ragioneSociale || o.email}</h2>
                  {o.ragioneSociale && <p className="text-xs text-gray-500">{o.email}</p>}
                </div>
                {innerTab === 'prodotti' && (
                  <div className="flex items-center gap-2">
                    {saveMsg && <span className={`text-sm font-bold ${saveMsg.startsWith('Err') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</span>}
                    <button onClick={saveCfg} disabled={saving || loadingCfg}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60">
                      {saving ? 'Salvataggio...' : 'Salva Prodotti'}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[['profilo','Profilo & Fatturazione'],['prodotti','Prodotti Visibili']].map(([id, label]) => (
                    <button key={id} onClick={() => setInnerTab(id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${innerTab === id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {innerTab === 'profilo' && (
                  <button onClick={() => openEdit(selOptician)}
                    className="flex items-center gap-1.5 text-xs bg-white border border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-700 px-3 py-1.5 rounded-lg transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Modifica dati
                  </button>
                )}
              </div>
            </div>

            {/* Tab: Profilo & Fatturazione */}
            {innerTab === 'profilo' && (
              <div className="p-5 overflow-y-auto max-h-[65vh]">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* Dati accesso */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Credenziali di Accesso</h4>
                    <InfoRow label="Email" value={o.email} mono />
                    <div className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide w-36 flex-shrink-0">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800 font-mono">
                          {showPwd ? (o.password || '—') : (o.password ? '••••••••' : '—')}
                        </span>
                        {o.password && (
                          <button onClick={() => setShowPwd(v => !v)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 underline">
                            {showPwd ? 'Nascondi' : 'Mostra'}
                          </button>
                        )}
                      </div>
                    </div>
                    {o.created_at?.seconds && (
                      <InfoRow label="Registrazione"
                        value={new Date(o.created_at.seconds * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })} />
                    )}
                    {o.last_login?.seconds && (
                      <InfoRow label="Ultimo Accesso"
                        value={new Date(o.last_login.seconds * 1000).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                    )}
                  </div>

                  {/* Dati aziendali */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Dati Aziendali</h4>
                    <InfoRow label="Ragione Sociale" value={o.ragioneSociale} />
                    <InfoRow label="Partita IVA" value={o.piva} mono />
                    <InfoRow label="Cod. Fiscale" value={o.cf} mono />
                    <InfoRow label="Telefono" value={o.telefono} />
                    <InfoRow label="PEC" value={o.pec} mono />
                    <InfoRow label="Cod. SDI" value={o.sdi} mono />
                  </div>

                  {/* Indirizzo */}
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 lg:col-span-2">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-3">Indirizzo Sede</h4>
                    {(o.via || o.citta) ? (
                      <p className="text-sm text-gray-800">
                        {[o.via, o.civico].filter(Boolean).join(' ')}
                        {(o.cap || o.citta) && <><br />{[o.cap, o.citta, o.provincia ? `(${o.provincia})` : ''].filter(Boolean).join(' ')}</>}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Indirizzo non inserito</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Prodotti */}
            {innerTab === 'prodotti' && (
              loadingCfg ? (
                <div className="p-10 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : manufs.length === 0 ? (
                <p className="p-6 text-gray-400 text-sm text-center">Catalogo master vuoto — aggiungilo nel tab Catalogo.</p>
              ) : (
                <div className="overflow-y-auto p-5 space-y-5 max-h-[65vh]">
                  {manufs.map(manuf => (
                    <div key={manuf} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-bold text-indigo-800 text-base mb-3 pb-2 border-b border-gray-100">{manuf}</h3>
                      {Object.keys(catalog[manuf]).sort().map(model => (
                        <div key={model} className="mb-4 pl-3 border-l-2 border-indigo-100">
                          <h4 className="font-semibold text-gray-700 text-sm mb-2">{model}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {catalog[manuf][model].map(type => {
                              const key = `${manuf}::${model}::${type}`;
                              const enabled = opticianCfg[key]?.enabled || false;
                              const price   = opticianCfg[key]?.price   || '';
                              return (
                                <div key={type} className={`p-2 rounded-lg border flex items-center justify-between transition ${enabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input type="checkbox" checked={enabled}
                                      onChange={e => toggle(key, e.target.checked)}
                                      className="h-4 w-4 text-indigo-600 rounded cursor-pointer flex-shrink-0" />
                                    <span className="text-xs font-medium text-gray-700 truncate">{type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    <span className="text-xs text-gray-400">€</span>
                                    <input type="number" step="0.01" min="0" value={price} disabled={!enabled}
                                      onChange={e => setPrice(key, e.target.value)} placeholder="0.00"
                                      className="w-16 text-xs border border-gray-300 rounded px-1.5 py-1 disabled:bg-gray-100 disabled:text-gray-400" />
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
              )
            )}
          </div>
        )}
      </div>

      {/* Modal modifica dati ottico */}
      {editModal && selOptician && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-t-4 border-indigo-600 my-4">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Modifica Dati Ottico</h3>
              <button onClick={() => setEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              {/* Dati aziendali */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Dati Aziendali</h4>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Ragione Sociale / Nome *</label>
                  <input type="text" required value={editForm.ragioneSociale} onChange={e => setE('ragioneSociale', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Partita IVA</label>
                    <input type="text" value={editForm.piva} onChange={e => setE('piva', e.target.value)} maxLength={13}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Codice Fiscale</label>
                    <input type="text" value={editForm.cf} onChange={e => setE('cf', e.target.value.toUpperCase())} maxLength={16}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Telefono</label>
                    <input type="tel" value={editForm.telefono} onChange={e => setE('telefono', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Codice SDI</label>
                    <input type="text" value={editForm.sdi} onChange={e => setE('sdi', e.target.value)} maxLength={7}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">PEC</label>
                  <input type="email" value={editForm.pec} onChange={e => setE('pec', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                </div>
              </div>

              {/* Indirizzo */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Indirizzo Sede</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Via / Piazza</label>
                    <input type="text" value={editForm.via} onChange={e => setE('via', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">N. Civico</label>
                    <input type="text" value={editForm.civico} onChange={e => setE('civico', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">CAP</label>
                    <input type="text" value={editForm.cap} onChange={e => setE('cap', e.target.value)} maxLength={5}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Città</label>
                    <input type="text" value={editForm.citta} onChange={e => setE('citta', e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Prov.</label>
                    <input type="text" value={editForm.provincia} onChange={e => setE('provincia', e.target.value.toUpperCase())} maxLength={2}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase text-center focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              {editMsg === 'ok' && <p className="text-green-600 text-sm font-bold">Salvato!</p>}
              {editMsg && editMsg !== 'ok' && <p className="text-red-500 text-sm">{editMsg}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200">
                  Annulla
                </button>
                <button type="submit" disabled={editBusy}
                  className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-60">
                  {editBusy ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forniture ─────────────────────────────────────────────────────────
const SUPPLY_STATUS = {
  pending:    { label: 'In attesa',     bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  processing: { label: 'In lavorazione', bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300'   },
  shipped:    { label: 'Spedito',        bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
};

function FornitureTab() {
  const [orders, setOrders]         = useState([]);
  const [opticians, setOpticians]   = useState({}); // uid → data
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(null); // orderId being updated
  const [filter, setFilter]         = useState('active'); // 'active' | 'shipped'

  useEffect(() => {
    // Carica ottici per nome/indirizzo
    getDocs(collection(db, 'opticians')).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setOpticians(map);
    });

    // Carica ordini con supply_request
    getDocs(query(
      collection(db, 'orders'),
      where('supply_request.status', 'in', ['pending', 'processing', 'shipped']),
      orderBy('supply_request.requested_at', 'desc')
    )).then(snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }).catch(() => {
      // Fallback senza orderBy se l'indice non esiste
      getDocs(query(
        collection(db, 'orders'),
        where('supply_request.status', 'in', ['pending', 'processing', 'shipped'])
      )).then(snap => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.supply_request?.requested_at?.seconds || 0) - (a.supply_request?.requested_at?.seconds || 0));
        setOrders(list);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, []);

  async function updateStatus(orderId, newStatus) {
    setUpdating(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        'supply_request.status': newStatus,
        ...(newStatus === 'shipped' ? { 'supply_request.shipped_at': new Date() } : {}),
      });
      setOrders(list => list.map(o => o.id === orderId
        ? { ...o, supply_request: { ...o.supply_request, status: newStatus } }
        : o
      ));
    } catch { alert('Errore aggiornamento. Riprova.'); }
    setUpdating(null);
  }

  const visible = orders.filter(o =>
    filter === 'active'
      ? ['pending','processing'].includes(o.supply_request?.status)
      : o.supply_request?.status === 'shipped'
  );

  return (
    <div className="max-w-5xl mx-auto p-6">

      {/* Filtri */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2">
          {[['active','In attesa / Lavorazione'],['shipped','Spediti']].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition ${filter === id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'}`}>
              {label}
              {id === 'active' && orders.filter(o => ['pending','processing'].includes(o.supply_request?.status)).length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {orders.filter(o => ['pending','processing'].includes(o.supply_request?.status)).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400">{visible.length} ordini</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 font-medium">Nessun ordine fornitore {filter === 'active' ? 'in attesa' : 'spedito'}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(order => {
            const sr   = order.supply_request || {};
            const l    = order.lens_order || {};
            const conf = SUPPLY_STATUS[sr.status] || SUPPLY_STATUS.pending;
            const opt  = opticians[order.optician_id] || {};
            const isClient = sr.destination === 'client';
            const reqDate  = sr.requested_at?.seconds
              ? new Date(sr.requested_at.seconds * 1000).toLocaleString('it-IT', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—';

            // Indirizzo destinazione
            const clientAddr = order.delivery?.address_full || '—';
            const storeAddr  = opt.via
              ? `${[opt.via, opt.civico].filter(Boolean).join(' ')}, ${opt.cap} ${opt.citta} (${opt.provincia})`
              : '—';

            return (
              <div key={order.id} className={`bg-white rounded-xl border-l-4 ${conf.border} shadow-sm p-5`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${conf.bg} ${conf.text}`}>{conf.label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isClient ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                        {isClient ? '🟣 Spedizione → CLIENTE' : '🟠 Spedizione → NEGOZIO'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Richiesto: {reqDate}</p>
                  </div>
                  <div className="flex gap-2">
                    {sr.status === 'pending' && (
                      <button onClick={() => updateStatus(order.id, 'processing')} disabled={updating === order.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg disabled:opacity-60">
                        Prendi in carico
                      </button>
                    )}
                    {sr.status === 'processing' && (
                      <button onClick={() => updateStatus(order.id, 'shipped')} disabled={updating === order.id}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg disabled:opacity-60">
                        Segna come Spedito
                      </button>
                    )}
                    {sr.status === 'pending' && (
                      <button onClick={() => updateStatus(order.id, 'shipped')} disabled={updating === order.id}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-lg disabled:opacity-60">
                        Spedito direttamente
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {/* Lente */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Lente</p>
                    <p className="font-semibold text-gray-800">{l.manufacturer} {l.model}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-bold text-blue-600">OD</span> {l.od?.type || '—'}
                      {l.od?.pwr  && ` · Sf.${l.od.pwr}`}
                      {l.od?.cyl  && ` · Cil.${l.od.cyl}`}
                      {l.od?.axis && ` · Ax.${l.od.axis}`}
                      {l.od?.add  && ` · ADD ${l.od.add}`}
                      {` (${l.od?.qty || 1} pz.)`}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      <span className="font-bold text-green-600">OS</span> {l.os?.type || '—'}
                      {l.os?.pwr  && ` · Sf.${l.os.pwr}`}
                      {l.os?.cyl  && ` · Cil.${l.os.cyl}`}
                      {l.os?.axis && ` · Ax.${l.os.axis}`}
                      {l.os?.add  && ` · ADD ${l.os.add}`}
                      {` (${l.os?.qty || 1} pz.)`}
                    </p>
                  </div>

                  {/* Paziente */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Paziente</p>
                    <p className="font-semibold text-gray-800">{order.patient_name || '—'}</p>
                    {order.client_info?.phone && <p className="text-xs text-gray-600 mt-1">📞 {order.client_info.phone}</p>}
                    {order.client_info?.email && <p className="text-xs text-gray-600">✉ {order.client_info.email}</p>}
                  </div>

                  {/* Destinazione spedizione */}
                  <div className={`rounded-lg p-3 border ${isClient ? 'bg-purple-50 border-purple-100' : 'bg-orange-50 border-orange-100'}`}>
                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">
                      {isClient ? 'Indirizzo Cliente' : 'Indirizzo Ottico'}
                    </p>
                    {isClient ? (
                      <>
                        <p className="font-semibold text-gray-800">{order.patient_name}</p>
                        <p className="text-xs text-gray-600 mt-1">{clientAddr}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-gray-800">{opt.ragioneSociale || opt.email || '—'}</p>
                        <p className="text-xs text-gray-600 mt-1">{storeAddr}</p>
                        {opt.telefono && <p className="text-xs text-gray-600 mt-0.5">📞 {opt.telefono}</p>}
                      </>
                    )}
                  </div>
                </div>

                {/* Ottico richiedente */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Ottico:</span>
                  <span className="text-xs font-semibold text-gray-600">{opt.ragioneSociale || opt.email || order.optician_id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Catalogo Master (3 colonne) ───────────────────────────────────────
function CatalogoTab({ catalog, setCatalog, saving, setSaving }) {
  const [saveMsg, setSaveMsg]   = useState('');
  const [newManuf, setNewManuf] = useState('');
  const [selManuf, setSelManuf] = useState('');
  const [newModel, setNewModel] = useState('');
  const [selModel, setSelModel] = useState('');
  const [newType, setNewType]   = useState('');

  async function saveCatalog(next) {
    setSaving(true); setSaveMsg('');
    try {
      await setDoc(doc(db, 'catalogs', 'master'), { data: next });
      setCatalog(next);
      setSaveMsg('Salvato!');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch {
      setSaveMsg('Errore nel salvataggio!');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSaving(false);
  }

  function addManuf() {
    const m = newManuf.trim();
    if (!m || catalog[m]) return;
    saveCatalog({ ...catalog, [m]: {} });
    setNewManuf('');
  }
  function removeManuf(m) {
    if (!confirm(`Eliminare "${m}" e tutti i suoi modelli?`)) return;
    const next = { ...catalog }; delete next[m];
    if (selManuf === m) { setSelManuf(''); setSelModel(''); }
    saveCatalog(next);
  }
  function addModel() {
    const mo = newModel.trim();
    if (!mo || !selManuf || catalog[selManuf]?.[mo]) return;
    saveCatalog({ ...catalog, [selManuf]: { ...catalog[selManuf], [mo]: [] } });
    setNewModel('');
  }
  function removeModel(manuf, model) {
    if (!confirm(`Eliminare "${model}"?`)) return;
    const next = { ...catalog, [manuf]: { ...catalog[manuf] } };
    delete next[manuf][model];
    if (selModel === model) setSelModel('');
    saveCatalog(next);
  }
  function addType() {
    const t = newType.trim();
    if (!t || !selManuf || !selModel) return;
    const types = catalog[selManuf]?.[selModel] || [];
    if (types.includes(t)) return;
    saveCatalog({ ...catalog, [selManuf]: { ...catalog[selManuf], [selModel]: [...types, t] } });
    setNewType('');
  }
  function removeType(manuf, model, type) {
    const types = (catalog[manuf]?.[model] || []).filter(t => t !== type);
    saveCatalog({ ...catalog, [manuf]: { ...catalog[manuf], [model]: types } });
  }
  function moveType(manuf, model, type, dir) {
    const types = [...(catalog[manuf]?.[model] || [])];
    const i = types.indexOf(type);
    if (dir === 'up' && i === 0) return;
    if (dir === 'down' && i === types.length - 1) return;
    const j = dir === 'up' ? i - 1 : i + 1;
    [types[i], types[j]] = [types[j], types[i]];
    saveCatalog({ ...catalog, [manuf]: { ...catalog[manuf], [model]: types } });
  }

  const manufs = Object.keys(catalog).sort();
  const models = selManuf ? Object.keys(catalog[selManuf] || {}).sort() : [];
  const types  = (selManuf && selModel) ? (catalog[selManuf]?.[selModel] || []) : [];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {saveMsg && (
        <div className={`mb-4 text-sm font-bold text-center py-2 rounded-lg ${saveMsg.startsWith('Err') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {saveMsg}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Produttori */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">① Produttori</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 max-h-96">
            {manufs.length === 0
              ? <p className="text-gray-400 text-sm text-center py-4">Nessun produttore.</p>
              : manufs.map(m => (
                <div key={m} onClick={() => { setSelManuf(m); setSelModel(''); }}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg cursor-pointer transition ${selManuf === m ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <span className={`font-medium text-sm ${selManuf === m ? 'text-indigo-700' : 'text-gray-700'}`}>{m}</span>
                  <button onClick={e => { e.stopPropagation(); removeManuf(m); }} disabled={saving}
                    className="text-gray-300 hover:text-red-500 transition ml-2 disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))
            }
          </div>
          <div className="p-4 border-t border-gray-100 flex gap-2">
            <input type="text" placeholder="Nuovo produttore..." value={newManuf}
              onChange={e => setNewManuf(e.target.value)} onKeyDown={e => e.key === 'Enter' && addManuf()}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500" />
            <button onClick={addManuf} disabled={!newManuf.trim() || saving}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40">+</button>
          </div>
        </div>

        {/* Modelli */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
              ② Modelli {selManuf && <span className="text-indigo-600 normal-case font-normal">— {selManuf}</span>}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 max-h-96">
            {!selManuf ? <p className="text-gray-400 text-sm text-center py-4">Seleziona un produttore.</p>
              : models.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Nessun modello.</p>
              : models.map(m => (
                <div key={m} onClick={() => setSelModel(m)}
                  className={`flex justify-between items-center px-3 py-2 rounded-lg cursor-pointer transition ${selModel === m ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                  <span className={`font-medium text-sm ${selModel === m ? 'text-indigo-700' : 'text-gray-700'}`}>{m}</span>
                  <button onClick={e => { e.stopPropagation(); removeModel(selManuf, m); }} disabled={saving}
                    className="text-gray-300 hover:text-red-500 transition ml-2 disabled:opacity-30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))
            }
          </div>
          <div className="p-4 border-t border-gray-100 flex gap-2">
            <input type="text" placeholder="Nuovo modello..." value={newModel} disabled={!selManuf}
              onChange={e => setNewModel(e.target.value)} onKeyDown={e => e.key === 'Enter' && addModel()}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400 focus:ring-indigo-500 focus:border-indigo-500" />
            <button onClick={addModel} disabled={!selManuf || !newModel.trim() || saving}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40">+</button>
          </div>
        </div>

        {/* Tipi */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
            <h2 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
              ③ Tipi Lente {selModel && <span className="text-indigo-600 normal-case font-normal">— {selModel}</span>}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 max-h-96">
            {!selModel ? <p className="text-gray-400 text-sm text-center py-4">Seleziona un modello.</p>
              : types.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Nessun tipo.</p>
              : types.map((t, i) => (
                <div key={t} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm text-gray-700 flex-1">{t}</span>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={() => moveType(selManuf, selModel, t, 'up')} disabled={i === 0 || saving} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button onClick={() => moveType(selManuf, selModel, t, 'down')} disabled={i === types.length - 1 || saving} className="text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button onClick={() => removeType(selManuf, selModel, t)} disabled={saving} className="text-gray-300 hover:text-red-500 transition disabled:opacity-30">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
          <div className="p-4 border-t border-gray-100 flex gap-2">
            <input type="text" placeholder="Nuovo tipo lente..." value={newType} disabled={!selModel}
              onChange={e => setNewType(e.target.value)} onKeyDown={e => e.key === 'Enter' && addType()}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400 focus:ring-indigo-500 focus:border-indigo-500" />
            <button onClick={addType} disabled={!selModel || !newType.trim() || saving}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40">+</button>
          </div>
        </div>
      </div>

      {/* Anteprima JSON */}
      <div className="mt-6">
        <details className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <summary className="text-sm font-bold text-gray-600 cursor-pointer select-none">Anteprima struttura catalogo</summary>
          <pre className="mt-3 text-xs text-gray-500 overflow-x-auto bg-gray-50 p-4 rounded-lg border border-gray-100">{JSON.stringify(catalog, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}

// ── SuperAdmin Panel ──────────────────────────────────────────────────
function SuperAdminPanel({ user }) {
  const [activeTab, setActiveTab] = useState('catalog');
  const [catalog, setCatalog]     = useState({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Cambio password dashboard (easter egg)
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdNew, setPwdNew]             = useState('');
  const [pwdConfirm, setPwdConfirm]     = useState('');
  const [pwdMsg, setPwdMsg]             = useState('');
  const [pwdOk, setPwdOk]               = useState(false);
  const [pwdBusy, setPwdBusy]           = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'catalogs', 'master')).then(snap => {
      setCatalog(snap.exists() ? (snap.data().data || {}) : {});
      setLoading(false);
    });
  }, []);

  async function handleChangePwd(e) {
    e.preventDefault();
    if (pwdNew.length < 4) { setPwdMsg('La password deve avere almeno 4 caratteri.'); return; }
    if (pwdNew !== pwdConfirm) { setPwdMsg('Le password non coincidono.'); return; }
    setPwdBusy(true); setPwdMsg('');
    try {
      await setDoc(doc(db, 'config', 'admin'), { dashboardPassword: pwdNew }, { merge: true });
      setPwdOk(true); setPwdMsg('Password aggiornata!');
      setTimeout(() => { setShowPwdModal(false); setPwdNew(''); setPwdConfirm(''); setPwdMsg(''); setPwdOk(false); }, 1500);
    } catch { setPwdMsg('Errore nel salvataggio. Riprova.'); }
    setPwdBusy(false);
  }

  const TABS = [
    { id: 'catalog',   label: 'Catalogo Master' },
    { id: 'ottici',    label: 'Gestione Ottici' },
    { id: 'forniture', label: 'Forniture' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-gray-900 text-white shadow sticky top-0 z-20">
        <div className="px-6 flex justify-between items-center h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-bold text-base">SuperAdmin</span>
            </div>
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setShowPwdModal(true); setPwdNew(''); setPwdConfirm(''); setPwdMsg(''); setPwdOk(false); }}
              className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Password
            </button>
            <button onClick={() => signOut(auth)} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg">Esci</button>
          </div>
        </div>
      </nav>

      {activeTab === 'catalog' && <CatalogoTab catalog={catalog} setCatalog={setCatalog} saving={saving} setSaving={setSaving} />}
      {activeTab === 'ottici'    && <OtticiTab catalog={catalog} />}
      {activeTab === 'forniture' && <FornitureTab />}

      {/* Modal cambio password dashboard */}
      {showPwdModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 border-t-4 border-indigo-600">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cambia Password Accesso Admin</h3>
            <p className="text-xs text-gray-500 mb-5">Questa password viene usata per il pulsante segreto nella dashboard ottico.</p>
            <form onSubmit={handleChangePwd} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Nuova password</label>
                <input type="password" value={pwdNew} onChange={e => { setPwdNew(e.target.value); setPwdMsg(''); }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Conferma password</label>
                <input type="password" value={pwdConfirm} onChange={e => { setPwdConfirm(e.target.value); setPwdMsg(''); }}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              {pwdMsg && <p className={`text-sm font-medium ${pwdOk ? 'text-green-600' : 'text-red-500'}`}>{pwdMsg}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowPwdModal(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Annulla</button>
                <button type="submit" disabled={pwdBusy}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-60">
                  {pwdBusy ? 'Salvataggio...' : 'Salva'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      if (u && !u.isAnonymous && u.email === SUPERADMIN_EMAIL) setUser(u);
      else setUser(null);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400" />
    </div>
  );

  return user ? <SuperAdminPanel user={user} /> : <LoginView />;
}
