import { annualPoints } from './territories.js';
import { baseline, mean, trend } from './science.js';

export const RISK_STOPS = [
  { t: 0.0, rgb: [34, 197, 94] },   // Low risk green (#22c55e)
  { t: 0.35, rgb: [234, 179, 8] },  // Moderate risk amber (#eab308)
  { t: 0.7, rgb: [249, 115, 22] },  // High risk orange (#f97316)
  { t: 1.0, rgb: [239, 68, 68] }    // Critical risk red (#ef4444)
];

export const RISK_GRADIENT_CSS =
  'linear-gradient(90deg, #22c55e 0%, #eab308 35%, #f97316 70%, #ef4444 100%)';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function riskColor(score) {
  if (!Number.isFinite(score)) {
    return { r: 124, g: 135, b: 145, css: '#7c8791', hex: 0x7c8791 };
  }
  const t = clamp(score / 100, 0, 1);
  let left = RISK_STOPS[0];
  let right = RISK_STOPS[RISK_STOPS.length - 1];
  for (let i = 0; i < RISK_STOPS.length - 1; i++) {
    if (t >= RISK_STOPS[i].t && t <= RISK_STOPS[i + 1].t) {
      left = RISK_STOPS[i];
      right = RISK_STOPS[i + 1];
      break;
    }
  }
  const localT = right.t === left.t ? 0 : (t - left.t) / (right.t - left.t);
  const r = Math.round(left.rgb[0] + (right.rgb[0] - left.rgb[0]) * localT);
  const g = Math.round(left.rgb[1] + (right.rgb[1] - left.rgb[1]) * localT);
  const b = Math.round(left.rgb[2] + (right.rgb[2] - left.rgb[2]) * localT);
  return { r, g, b, css: `rgb(${r},${g},${b})`, hex: (r << 16) | (g << 8) | b };
}

export function riskLevel(score, lang = 'es') {
  if (!Number.isFinite(score)) {
    return { id: 'unknown', label: lang === 'en' ? 'No data' : 'Sin datos' };
  }
  if (score >= 70) return { id: 'critical', label: lang === 'en' ? 'Critical' : 'Crítico' };
  if (score >= 50) return { id: 'high', label: lang === 'en' ? 'High' : 'Alto' };
  if (score >= 30) return { id: 'moderate', label: lang === 'en' ? 'Moderate' : 'Moderado' };
  return { id: 'low', label: lang === 'en' ? 'Low' : 'Bajo' };
}

export function driverLabel(driver, lang = 'es') {
  const labels = {
    thermal: { es: 'Calentamiento anómalo', en: 'Anomalous warming' },
    drought: { es: 'Estrés por sequía', en: 'Drought stress' },
    saturation: { es: 'Saturación y lluvia extrema', en: 'Extreme rain & saturation' },
    biodiversity: { es: 'Alta sensibilidad biológica (UICN)', en: 'High biological sensitivity (IUCN)' }
  };
  return labels[driver]?.[lang] ?? labels.thermal[lang];
}

export function computeSiteRisk({ site, annual, ecologicalSite = null, liveTemp = null }) {
  if (!site?.id || !annual?.sites?.[site.id]) {
    return { score: null, climateRisk: null, bioRisk: null, driver: 'thermal', hasLive: false };
  }

  // 1. Thermal pressure (NASA POWER T2M: recent 2021-2025 vs 2001-2010 + Theil-Sen slope + optional live temp)
  const t2m = annualPoints(annual, site.id, 'T2M');
  const baseT = baseline(t2m, 2001, 2010);
  const recentT = mean(t2m.filter(p => p.year >= 2021 && Number.isFinite(p.value)).map(p => p.value));
  const deltaT = Number.isFinite(baseT) && Number.isFinite(recentT) ? recentT - baseT : 0;
  const slopeDecade = (trend(t2m).slope ?? 0) * 10;
  const baseThermal = clamp(
    clamp((deltaT / 1.0) * 65, 0, 70) + clamp((slopeDecade / 0.5) * 30, 0, 30),
    0,
    100
  );
  const hasLive = Number.isFinite(liveTemp) && Number.isFinite(baseT);
  const liveAnomalyRisk = hasLive ? clamp(((liveTemp - baseT) / 4.0) * 100, 0, 100) : null;
  const thermalRisk = hasLive ? clamp(0.65 * baseThermal + 0.35 * liveAnomalyRisk, 0, 100) : baseThermal;

  // 2. Hydrological stress (NASA POWER PRECTOTCORR + GWETTOP + elevation)
  const prec = annualPoints(annual, site.id, 'PRECTOTCORR');
  const soil = annualPoints(annual, site.id, 'GWETTOP');
  const baseP = baseline(prec, 2001, 2010);
  const recentP = mean(prec.filter(p => p.year >= 2021 && Number.isFinite(p.value)).map(p => p.value));
  const pctP = Number.isFinite(baseP) && baseP > 0 && Number.isFinite(recentP)
    ? ((recentP - baseP) / baseP) * 100
    : 0;
  const recentSM = mean(soil.filter(p => p.year >= 2021 && Number.isFinite(p.value)).map(p => p.value)) ?? 0.7;

  const kind = site?.climate?.kind ?? 'urban-valley';
  let hydroRisk = 0;
  let hydroDriver = 'saturation';
  if (kind === 'dry-coast' || kind === 'urban-valley') {
    hydroDriver = 'drought';
    const dryAnomaly = clamp((-pctP / 25) * 55, 0, 55);
    const drySoil = clamp(((0.68 - recentSM) / 0.25) * 45, 0, 45);
    hydroRisk = clamp(dryAnomaly + drySoil, 0, 100);
  } else {
    hydroDriver = 'saturation';
    const wetAnomaly = clamp((pctP / 45) * 48, 0, 48);
    const wetSoil = clamp(((recentSM - 0.74) / 0.22) * 40, 0, 40);
    const elevBonus = Number.isFinite(ecologicalSite?.elevationM) && ecologicalSite.elevationM >= 900 ? 12 : 0;
    hydroRisk = clamp(wetAnomaly + wetSoil + elevBonus, 0, 100);
  }

  // 3. Biological sensitivity (GBIF georeferenced records & IUCN Red List threatened occurrences)
  const occ = ecologicalSite?.occurrences;
  const threat = ecologicalSite?.threatenedOccurrences;
  let bioRisk = null;
  if (Number.isFinite(occ) && Number.isFinite(threat)) {
    const threatPart = clamp((Math.log10(threat + 1) / 3.8) * 65, 0, 65);
    const occPart = clamp((Math.log10(occ + 1) / 6.3) * 35, 0, 35);
    bioRisk = clamp(threatPart + occPart, 0, 100);
  }

  const climateRisk = 0.55 * thermalRisk + 0.45 * hydroRisk;
  const score = Math.round(bioRisk !== null ? 0.60 * climateRisk + 0.40 * bioRisk : climateRisk);

  const candidates = [
    ['thermal', thermalRisk],
    [hydroDriver, hydroRisk]
  ];
  if (bioRisk !== null) candidates.push(['biodiversity', bioRisk]);
  candidates.sort((a, b) => b[1] - a[1]);

  return {
    score,
    climateRisk: Math.round(climateRisk),
    thermalRisk: Math.round(thermalRisk),
    hydroRisk: Math.round(hydroRisk),
    bioRisk: bioRisk !== null ? Math.round(bioRisk) : null,
    driver: candidates[0][0],
    threatenedOccurrences: Number.isFinite(threat) ? threat : null,
    occurrences: Number.isFinite(occ) ? occ : null,
    elevationM: Number.isFinite(ecologicalSite?.elevationM) ? ecologicalSite.elevationM : null,
    liveTemp: Number.isFinite(liveTemp) ? liveTemp : null,
    hasLive
  };
}

export function computeAllRisks({ sites = [], annual, ecological = null, liveTemps = null }) {
  const byId = new Map();
  let min = Infinity;
  let max = -Infinity;
  for (const site of sites) {
    const res = computeSiteRisk({
      site,
      annual,
      ecologicalSite: ecological?.sites?.[site.id] ?? null,
      liveTemp: liveTemps?.get?.(site.id) ?? null
    });
    byId.set(site.id, res);
    if (Number.isFinite(res.score)) {
      if (res.score < min) min = res.score;
      if (res.score > max) max = res.score;
    }
  }
  return {
    byId,
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 100
  };
}

export function topRiskCantons(riskSummary, sites = [], limit = 5) {
  if (!riskSummary?.byId) return [];
  return sites
    .filter(s => s.type === 'canton')
    .map(s => ({ site: s, risk: riskSummary.byId.get(s.id) }))
    .filter(item => Number.isFinite(item.risk?.score))
    .sort((a, b) => b.risk.score - a.risk.score)
    .slice(0, limit);
}

const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;
let liveCache = null;
let liveInflight = null;

export async function fetchLiveRadarTemps({ force = false, fetchImpl = globalThis.fetch } = {}) {
  const now = Date.now();
  if (!force && liveCache && now - liveCache.fetchedAt < LIVE_CACHE_TTL_MS) {
    return liveCache.data;
  }
  if (!force && liveInflight) return liveInflight;
  liveInflight = (async () => {
    const res = await fetchImpl('/api/current?site=all');
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const temps = new Map();
    for (const row of payload?.sites ?? []) {
      if (row?.site && Number.isFinite(row.temperature)) temps.set(row.site, row.temperature);
    }
    const data = { temps, retrievedAt: payload?.retrievedAt ?? null };
    liveCache = { fetchedAt: Date.now(), data };
    return data;
  })().finally(() => {
    liveInflight = null;
  });
  return liveInflight;
}
