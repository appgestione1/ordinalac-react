import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const FIELD = 'block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white';
const LABEL = 'block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide';

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wide border-b border-gray-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

export default function Register() {
  const [busy, setBusy]   = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    ragioneSociale: '', piva: '', cf: '', telefono: '', pec: '', sdi: '0000000',
    via: '', civico: '', cap: '', citta: '', provincia: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.ragioneSociale.trim()) { setError('Inserisci la ragione sociale o il nome.'); return; }
    if (form.password.length < 6) { setError('La password deve avere almeno 6 caratteri.'); return; }
    if (form.password !== form.confirmPassword) { setError('Le password non coincidono.'); return; }

    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, 'opticians', cred.user.uid), {
        email:          form.email,
        password:       form.password,
        ragioneSociale: form.ragioneSociale.trim(),
        piva:           form.piva.trim(),
        cf:             form.cf.trim().toUpperCase(),
        telefono:       form.telefono.trim(),
        pec:            form.pec.trim(),
        sdi:            form.sdi.trim() || '0000000',
        via:            form.via.trim(),
        civico:         form.civico.trim(),
        cap:            form.cap.trim(),
        citta:          form.citta.trim(),
        provincia:      form.provincia.trim().toUpperCase(),
        created_at:     new Date(),
        last_login:     new Date(),
      });
      window.location.href = '/dashboard';
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use')
        setError('Questa email è già registrata. Accedi dalla pagina di login.');
      else if (code === 'auth/invalid-email')
        setError('Indirizzo email non valido.');
      else if (code === 'auth/weak-password')
        setError('Password troppo debole. Usa almeno 6 caratteri.');
      else
        setError('Errore durante la registrazione. Riprova.');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Registrazione Ottico</h1>
          <p className="text-sm text-gray-500 mt-1">Crea il tuo account per accedere al portale ordini OrdinaLac</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Credenziali di accesso */}
          <Section title="① Credenziali di Accesso">
            <div>
              <label className={LABEL}>Email</label>
              <input type="email" required value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="tuamail@esempio.it" className={FIELD} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Password</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} required value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="min. 6 caratteri" className={FIELD + ' pr-10'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">
                    {showPwd ? 'Nascondi' : 'Mostra'}
                  </button>
                </div>
              </div>
              <div>
                <label className={LABEL}>Conferma Password</label>
                <input type={showPwd ? 'text' : 'password'} required value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="ripeti la password" className={FIELD} />
              </div>
            </div>
          </Section>

          {/* Dati aziendali */}
          <Section title="② Dati Aziendali">
            <div>
              <label className={LABEL}>Ragione Sociale / Nome e Cognome *</label>
              <input type="text" required value={form.ragioneSociale}
                onChange={e => set('ragioneSociale', e.target.value)}
                placeholder="Es. Ottica Rossi di Mario Rossi" className={FIELD} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Partita IVA</label>
                <input type="text" value={form.piva} onChange={e => set('piva', e.target.value)}
                  placeholder="IT12345678901" maxLength={13} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Codice Fiscale</label>
                <input type="text" value={form.cf}
                  onChange={e => set('cf', e.target.value.toUpperCase())}
                  placeholder="RSSMRA80A01H501U" maxLength={16} className={FIELD + ' uppercase'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Telefono</label>
                <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="+39 095 123456" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>Codice SDI</label>
                <input type="text" value={form.sdi} onChange={e => set('sdi', e.target.value)}
                  placeholder="0000000" maxLength={7} className={FIELD} />
              </div>
            </div>
            <div>
              <label className={LABEL}>PEC</label>
              <input type="email" value={form.pec} onChange={e => set('pec', e.target.value)}
                placeholder="ottica@pec.it" className={FIELD} />
            </div>
          </Section>

          {/* Indirizzo */}
          <Section title="③ Indirizzo Sede">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className={LABEL}>Via / Piazza</label>
                <input type="text" value={form.via} onChange={e => set('via', e.target.value)}
                  placeholder="Via Roma" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>N. Civico</label>
                <input type="text" value={form.civico} onChange={e => set('civico', e.target.value)}
                  placeholder="1" className={FIELD} />
              </div>
            </div>
            <div className="grid grid-cols-6 gap-3">
              <div className="col-span-2">
                <label className={LABEL}>CAP</label>
                <input type="text" value={form.cap} onChange={e => set('cap', e.target.value)}
                  placeholder="95100" maxLength={5} className={FIELD} />
              </div>
              <div className="col-span-3">
                <label className={LABEL}>Città</label>
                <input type="text" value={form.citta} onChange={e => set('citta', e.target.value)}
                  placeholder="Catania" className={FIELD} />
              </div>
              <div className="col-span-1">
                <label className={LABEL}>Prov.</label>
                <input type="text" value={form.provincia}
                  onChange={e => set('provincia', e.target.value.toUpperCase())}
                  placeholder="CT" maxLength={2} className={FIELD + ' uppercase text-center'} />
              </div>
            </div>
          </Section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 text-base shadow">
            {busy ? 'Registrazione in corso...' : 'Crea Account'}
          </button>

          <p className="text-center text-sm text-gray-500">
            Hai già un account?{' '}
            <a href="/dashboard" className="text-blue-600 hover:underline font-medium">Accedi</a>
          </p>
        </form>
      </div>
    </div>
  );
}
