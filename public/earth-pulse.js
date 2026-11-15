import { confidenceInterval, trend } from './science.js';

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
  const denom = vals.length > 1 ? vals.length - 1 : 1;
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / denom;
  return { mean, std: Math.sqrt(variance), n: vals.length };
}

export function monthlyZScoreSeries(monthlyRows = [], variable, { refStart = 2001, refEnd = 2010 } = {}) {
  const refs = new Map();
  for (let m = 1; m <= 12; m++) {
    refs.set(m, monthlyReference(monthlyRows, variable, m, refStart, refEnd));
  }
  return monthlyRows
    .filter(r => Number.isFinite(r.year) && r.month >= 1 && r.month <= 12)
    .map(r => {
      const ref = refs.get(r.month);
      const value = Number.isFinite(r[variable]) ? r[variable] : null;
      const z = value !== null && ref ? zScore(value, ref.mean, ref.std) : null;
      return { year: r.year, month: r.month, value, mean: ref?.mean ?? null, std: ref?.std ?? null, z };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);
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

export function calibratedStressIndex(
  indicators = {},
  { weights = { I_S: 0.28, I_T: 0.24, I_P: 0.20, I_V: 0.18 }, gamma = 0.15, stressThreshold = 0.89 } = {}
) {
  const linear = experimentalStressIndex(indicators, weights);
  if (linear.iea === null) {
    return { ...linear, coupling: 0, status: 'unavailable', benignSurplus: false };
  }
  const thermal = Number.isFinite(indicators.I_LST) ? indicators.I_LST : indicators.I_T;
  const sm = indicators.I_S;
  const coupling = Number.isFinite(thermal) && Number.isFinite(sm)
    ? gamma * Math.max(0, sm) * Math.max(0, thermal)
    : 0;
  const iea = linear.iea + coupling;
  const benignSurplus = iea < 0 || (Number.isFinite(indicators.I_P) && indicators.I_P <= -0.65 && (!Number.isFinite(thermal) || thermal <= 0));
  const status = iea >= stressThreshold
    ? 'stress'
    : benignSurplus
      ? 'benign-surplus'
      : iea >= 0.35
        ? 'elevated'
        : 'normal';
  return {
    iea,
    linearIea: linear.iea,
    coupling,
    weightsUsed: linear.weightsUsed,
    activeCount: linear.activeCount,
    status,
    benignSurplus
  };
}

export function temporalPersistenceGate(ieaSeries = [], threshold = 0.89, minConsecutive = 2) {
  let run = 0;
  let maxRun = 0;
  let persistentEvents = 0;
  for (const point of ieaSeries) {
    const val = typeof point === 'number' ? point : point?.iea;
    if (Number.isFinite(val) && val >= threshold) {
      run += 1;
      maxRun = Math.max(maxRun, run);
      if (run === minConsecutive) persistentEvents += 1;
    } else {
      run = 0;
    }
  }
  return {
    persistent: maxRun >= minConsecutive,
    maxConsecutive: maxRun,
    currentConsecutive: run,
    persistentEvents,
    threshold,
    minConsecutive
  };
}

export function siteZSummary(monthlyRows = [], startYear = 2001, endYear = 2025, refStart = 2001, refEnd = 2010) {
  const vars = ['T2M', 'T2M_MIN', 'T2M_MAX', 'ALLSKY_SFC_SW_DWN', 'PRECTOTCORR', 'GWETTOP', 'RH2M'];
  const seriesByVar = {};
  const ciByVar = {};
  const mkByVar = {};
  for (const param of vars) {
    const zAll = monthlyZScoreSeries(monthlyRows, param, { refStart, refEnd });
    const inWindow = zAll.filter(r => r.year >= startYear && r.year <= endYear && Number.isFinite(r.z));
    seriesByVar[param] = inWindow;
    ciByVar[param] = confidenceInterval(inWindow.map(r => r.z), 0.05);
    mkByVar[param] = trend(inWindow.map(r => ({ year: r.year + (r.month - 0.5) / 12, value: r.z })));
  }

  const byMonthKey = new Map();
  for (const r of monthlyRows) {
    if (r.year >= startYear && r.year <= endYear && r.month >= 1 && r.month <= 12) {
      byMonthKey.set(`${r.year}-${r.month}`, { year: r.year, month: r.month });
    }
  }
  for (const r of seriesByVar.T2M) {
    const k = `${r.year}-${r.month}`;
    if (byMonthKey.has(k)) byMonthKey.get(k).zT = r.z;
  }
  for (const r of seriesByVar.PRECTOTCORR) {
    const k = `${r.year}-${r.month}`;
    if (byMonthKey.has(k)) byMonthKey.get(k).zP = r.z;
  }
  for (const r of seriesByVar.GWETTOP) {
    const k = `${r.year}-${r.month}`;
    if (byMonthKey.has(k)) byMonthKey.get(k).zS = r.z;
  }

  const ieaTimeline = [...byMonthKey.values()]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map(row => {
      const indicators = {
        I_T: Number.isFinite(row.zT) ? row.zT : null,
        I_P: Number.isFinite(row.zP) ? -row.zP : null,
        I_V: null,
        I_S: Number.isFinite(row.zS) ? -row.zS : null
      };
      return { year: row.year, month: row.month, ...calibratedStressIndex(indicators) };
    });

  const validIea = ieaTimeline.filter(d => Number.isFinite(d.iea)).map(d => d.iea);
  const meanIndicators = {
    I_T: Number.isFinite(ciByVar.T2M.mean) ? ciByVar.T2M.mean : null,
    I_P: Number.isFinite(ciByVar.PRECTOTCORR.mean) ? -ciByVar.PRECTOTCORR.mean : null,
    I_V: null,
    I_S: Number.isFinite(ciByVar.GWETTOP.mean) ? -ciByVar.GWETTOP.mean : null
  };
  return {
    seriesByVar,
    ciByVar,
    mkByVar,
    ieaTimeline,
    ieaCI: confidenceInterval(validIea, 0.05),
    periodIEA: calibratedStressIndex(meanIndicators),
    persistence: temporalPersistenceGate(ieaTimeline)
  };
}
