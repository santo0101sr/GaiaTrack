/**
 * EARTH PULSE mathematical engine for environmental anomalies, Z-scores,
 * experimental environmental stress index (IEA), water balance, correlation,
 * and hypothetical scenario simulation.
 */

export function monthlyReference(monthlyRows = [], variable, month, startYear = 2001, endYear = 2025) {
  const vals = monthlyRows
    .filter(r => r.month === month && r.year >= startYear && r.year <= endYear && Number.isFinite(r[variable]))
    .map(r => r[variable]);
  if (!vals.length) return { mean: null, std: null, n: 0 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
  return { mean, std: Math.sqrt(variance), n: vals.length };
}

export function temperatureAnomaly(observed, historicalMean) {
  if (!Number.isFinite(observed) || !Number.isFinite(historicalMean)) return null;
  return observed - historicalMean;
}

export function precipitationAnomaly(observed, historicalMean) {
  if (!Number.isFinite(observed) || !Number.isFinite(historicalMean)) return { abs: null, pct: null };
  const abs = observed - historicalMean;
  // Rule: avoid percentage ratio when historical mean is zero or near zero.
  const pct = Math.abs(historicalMean) >= 0.05 ? (abs / historicalMean) * 100 : null;
  return { abs, pct };
}

export function ndviAnomaly(observed, historicalMean) {
  if (!Number.isFinite(observed) || !Number.isFinite(historicalMean)) return null;
  return observed - historicalMean;
}

export function zScore(observed, mean, std) {
  if (!Number.isFinite(observed) || !Number.isFinite(mean) || !Number.isFinite(std) || std === 0) return null;
  return (observed - mean) / std;
}

export function stressIndicators(obs = {}, refs = {}) {
  const zT = zScore(obs.t, refs.t?.mean, refs.t?.std);
  const zP = zScore(obs.p, refs.p?.mean, refs.p?.std);
  const zV = zScore(obs.ndvi, refs.ndvi?.mean, refs.ndvi?.std);
  const zS = zScore(obs.sm, refs.sm?.mean, refs.sm?.std);
  return {
    I_T: zT !== null ? zT : null,
    I_P: zP !== null ? -zP : null,
    I_V: zV !== null ? -zV : null,
    I_S: zS !== null ? -zS : null
  };
}

export function experimentalStressIndex(indicators = {}, customWeights = { I_T: 0.25, I_P: 0.25, I_V: 0.25, I_S: 0.25 }) {
  const entries = Object.entries(customWeights).filter(([k, w]) => Number.isFinite(indicators[k]) && Number.isFinite(w) && w > 0);
  if (!entries.length) return { iea: null, weightsUsed: {}, activeCount: 0, note: 'Sin indicadores suficientes para calcular IEA.' };
  const sumW = entries.reduce((acc, [, w]) => acc + w, 0);
  const weightsUsed = {};
  let iea = 0;
  for (const [k, w] of entries) {
    const normW = w / sumW;
    weightsUsed[k] = normW;
    iea += normW * indicators[k];
  }
  return {
    iea,
    weightsUsed,
    activeCount: entries.length,
    note: 'Índice experimental con pesos iniciales iguales (no equivale a una clasificación oficial de salud del ecosistema).'
  };
}

export function waterBalance({ p, et, r, d }) {
  if (![p, et, r, d].every(Number.isFinite)) return null;
  return p - et - r - d;
}

export function pearsonCorrelation(xs = [], ys = []) {
  const pairs = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx, dy = y - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : num / denom;
}

export function simulateScenario(base = {}, { deltaT = 0, deltaPPercent = 0, deltaNdvi = 0 } = {}) {
  return {
    t: Number.isFinite(base.t) ? base.t + deltaT : null,
    p: Number.isFinite(base.p) ? Math.max(0, base.p * (1 + deltaPPercent / 100)) : null,
    ndvi: Number.isFinite(base.ndvi) ? Math.max(-1, Math.min(1, base.ndvi + deltaNdvi)) : null,
    sm: Number.isFinite(base.sm) ? base.sm : null
  };
}
