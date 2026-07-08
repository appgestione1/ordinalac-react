// Campo parametro lente: select vincolato ai valori di produzione quando
// disponibili, altrimenti input libero. Un valore salvato che non è più a
// listino resta selezionabile, marcato "(fuori produzione)".
export default function ParamField({ value, onChange, options, locked, className, placeholder }) {
  if (!options || options.length === 0) {
    return (
      <input type="text" value={value} readOnly={locked} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className={className} />
    );
  }
  const extra = value && !options.includes(value) ? value : null;
  return (
    <select value={value} disabled={locked} onChange={e => onChange(e.target.value)} className={className}>
      <option value="">{placeholder ? `-- ${placeholder} --` : '--'}</option>
      {extra && <option value={extra}>{extra} (fuori produzione)</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
