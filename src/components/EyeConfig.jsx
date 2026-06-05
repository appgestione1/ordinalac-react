export default function EyeConfig({ eye, label, types, values, onChange, locked }) {
  const { qty, type, pwr, cyl, axis, add } = values;
  const t = type.toLowerCase();

  const showPwr = t.includes('standard') || t.includes('astigmatismo') || t.includes('toric') ||
    t.includes('multifocal') || t.includes('presbiopia') || t.includes('xr');
  const showCyl = t.includes('astigmatismo') || t.includes('toric') || t.includes('xr');
  const showAxis = showCyl;
  const showAdd = t.includes('multifocal') || t.includes('presbiopia');
  const noParams = type && !showPwr && !showCyl && !showAxis && !showAdd;

  const inputCls = locked
    ? 'mt-1 block w-full px-3 py-1 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
    : 'mt-1 block w-full px-3 py-1 border border-blue-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="border-t pt-4 mt-4">
      <h3 className="text-md font-bold text-gray-800 mb-3">{label}</h3>
      <div className="flex items-center space-x-2 mb-3">
        <label className="block text-sm font-medium text-gray-700">Quantità (Default)</label>
        <input
          type="number"
          value={qty}
          onChange={e => onChange({ qty: e.target.value })}
          className="mt-1 block w-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm text-center bg-white text-gray-900"
        />
        <span className="text-sm text-gray-700 pt-1">pz.</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Tipo Correzione</label>
        <select
          value={type}
          disabled={locked}
          onChange={e => onChange({ type: e.target.value, pwr: '', cyl: '', axis: '', add: '' })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 disabled:cursor-not-allowed"
        >
          <option value="">-- Seleziona Tipo --</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {type && (
        <div className="space-y-3 mt-3 pl-2 border-l-2 border-blue-200">
          {noParams && <p className="text-xs text-gray-500 italic">Nessun parametro aggiuntivo richiesto.</p>}
          {showPwr && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Potere (Diottria)</label>
              <input type="text" value={pwr} readOnly={locked}
                onChange={e => onChange({ pwr: e.target.value })}
                className={inputCls} />
            </div>
          )}
          {showCyl && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Cilindro (CYL)</label>
              <input type="text" value={cyl} readOnly={locked}
                onChange={e => onChange({ cyl: e.target.value })}
                className={inputCls} />
            </div>
          )}
          {showAxis && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Asse (AXIS)</label>
              <input type="text" value={axis} readOnly={locked}
                onChange={e => onChange({ axis: e.target.value })}
                className={inputCls} />
            </div>
          )}
          {showAdd && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Addizione (ADD)</label>
              <input type="text" value={add} readOnly={locked}
                onChange={e => onChange({ add: e.target.value })}
                className={inputCls} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
