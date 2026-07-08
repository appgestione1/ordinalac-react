// Range diottrici di produzione (catalogs/master → campo `ranges`).
// Chiave: "produttore::modello::tipo" → { pwr:{min,max}, cyl:{min,max},
// axis:{min,max}, add:{min,max}|{values:[...]}, bc, dia }
// Fonte: schede prodotto visionottica.it — se un range manca, la UI
// ripiega sull'input libero.

export function getRange(ranges, manufacturer, model, type) {
  if (!ranges || !manufacturer || !model || !type) return null;
  return ranges[`${manufacturer}::${model}::${type}`] || null;
}

const signed = v => (v > 0 ? '+' : '') + v.toFixed(2);
const quarter = v => Math.round(v * 4) / 4;

// Sfera: passi 0.25 fino a ±6.00, 0.50 oltre (standard di produzione)
export function pwrOptions(range) {
  const r = range?.pwr;
  if (!r || r.min == null || r.max == null) return null;
  const out = [];
  for (let v = r.min; v <= r.max + 1e-6; v += (v < -6 || v >= 6 ? 0.5 : 0.25))
    out.push(signed(quarter(v)));
  return out;
}

// Cilindro: passi 0.50 (es. -2.25 / -1.75 / -1.25 / -0.75)
export function cylOptions(range) {
  const r = range?.cyl;
  if (!r || r.min == null || r.max == null) return null;
  const out = [];
  for (let v = r.min; v <= r.max + 1e-6; v += 0.5) out.push(signed(quarter(v)));
  return out;
}

// Asse: passi di 10°
export function axisOptions(range) {
  const r = range?.axis;
  if (!r || r.min == null || r.max == null) return null;
  const out = [];
  for (let v = r.min; v <= r.max + 1e-6; v += 10) out.push(String(Math.round(v)));
  return out;
}

// Addizione: valori espliciti del produttore (LOW/MID/HIGH) o range a passi 0.25
export function addOptions(range) {
  const r = range?.add;
  if (!r) return null;
  if (r.values) return r.values;
  if (r.min == null || r.max == null) return null;
  const out = [];
  for (let v = r.min; v <= r.max + 1e-6; v += 0.25) out.push(signed(quarter(v)));
  return out;
}
