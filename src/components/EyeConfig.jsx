import ParamField from './ParamField';
import { pwrOptions, cylOptions, axisOptions, addOptions } from '../lib/lensRanges';

export default function EyeConfig({ eye, label, types, values, onChange, locked, rangesByType, priceLabel }) {
  const { type, pwr, cyl, axis, add } = values;
  const t = type.toLowerCase();

  const showPwr = !!type && !t.includes('nessun');
  const showCyl = t.includes('astigmatismo') || t.includes('toric') || t.includes('xr');
  const showAxis = showCyl;
  const showAdd = t.includes('multifocal') || t.includes('presbiopia');
  const noParams = type && !showPwr && !showCyl && !showAxis && !showAdd;
  const range = rangesByType?.[type] || null;

  const inputCls = locked
    ? 'mt-1 block w-full px-3 py-1 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed'
    : 'mt-1 block w-full px-3 py-1 border border-blue-300 rounded-md bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-md font-bold text-gray-800">{label}</h3>
        {priceLabel && <span className="text-sm font-bold text-blue-700">{priceLabel}</span>}
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
              <ParamField value={pwr} options={pwrOptions(range)} locked={locked}
                onChange={v => onChange({ pwr: v })} className={inputCls} />
            </div>
          )}
          {showCyl && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Cilindro (CYL)</label>
              <ParamField value={cyl} options={cylOptions(range)} locked={locked}
                onChange={v => onChange({ cyl: v })} className={inputCls} />
            </div>
          )}
          {showAxis && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Asse (AXIS)</label>
              <ParamField value={axis} options={axisOptions(range)} locked={locked}
                onChange={v => onChange({ axis: v })} className={inputCls} />
            </div>
          )}
          {showAdd && (
            <div>
              <label className="block text-xs font-medium text-gray-500">Addizione (ADD)</label>
              <ParamField value={add} options={addOptions(range)} locked={locked}
                onChange={v => onChange({ add: v })} className={inputCls} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
