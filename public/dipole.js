import { annualSeries, trend, baseline, detrendedCorrelation } from './science.js';

export const DIPOLE_PRESETS = [
  {
    id: 'guanacaste-limon',
    pacificId: 'guanacaste',
    caribbeanId: 'limon',
    pacific: 'guanacaste',
    caribbean: 'limon',
    en: 'North Pacific vs. Central Caribbean (Guanacaste ↔ Limón)',
    es: 'Pacífico Norte vs. Caribe Central (Guanacaste ↔ Limón)',
    label: {
      en: 'North Pacific vs. Central Caribbean',
      es: 'Pacífico Norte vs. Caribe Central'
    },
    pairLabel: 'Guanacaste ↔ Limón'
  },
  {
    id: 'liberia-sarapiqui',
    pacificId: 'liberia',
    caribbeanId: 'sarapiqui',
    pacific: 'liberia',
    caribbean: 'sarapiqui',
    en: 'Dry Forest Basin vs. Northern Rainforest (Liberia ↔ Sarapiquí)',
    es: 'Cuenca Bosque Seco vs. Selva Norte (Liberia ↔ Sarapiquí)',
    label: {
      en: 'Dry Forest Basin vs. Northern Rainforest',
      es: 'Cuenca Bosque Seco vs. Selva Norte'
    },
    pairLabel: 'Liberia ↔ Sarapiquí'
  },
  {
    id: 'puntarenas-turrialba',
    pacificId: 'puntarenas',
    caribbeanId: 'turrialba',
    pacific: 'puntarenas',
    caribbean: 'turrialba',
    en: 'Central/South Pacific vs. Caribbean Slope (Puntarenas ↔ Turrialba)',
    es: 'Pacífico Central/Sur vs. Vertiente Caribe (Puntarenas ↔ Turrialba)',
    label: {
      en: 'Central/South Pacific vs. Caribbean Slope',
      es: 'Pacífico Central/Sur vs. Vertiente Caribe'
    },
    pairLabel: 'Puntarenas ↔ Turrialba'
  }
];

const VARIABLE_META = {
  T2M: { digits: 1, slopeDigits: 2, en: { name: 'Mean temperature', unit: '°C', deltaUnit: '°C' }, es: { name: 'Temperatura media', unit: '°C', deltaUnit: '°C' } },
  T2M_MIN: { digits: 1, slopeDigits: 2, en: { name: 'Minimum temperature', unit: '°C', deltaUnit: '°C' }, es: { name: 'Temperatura mínima', unit: '°C', deltaUnit: '°C' } },
  T2M_MAX: { digits: 1, slopeDigits: 2, en: { name: 'Maximum temperature', unit: '°C', deltaUnit: '°C' }, es: { name: 'Temperatura máxima', unit: '°C', deltaUnit: '°C' } },
  ALLSKY_SFC_SW_DWN: { digits: 1, slopeDigits: 2, en: { name: 'Solar radiation', unit: 'MJ/m²/day', deltaUnit: 'MJ/m²/day' }, es: { name: 'Radiación solar', unit: 'MJ/m²/día', deltaUnit: 'MJ/m²/día' } },
  PRECTOTCORR: { digits: 0, slopeDigits: 1, en: { name: 'Precipitation', unit: 'mm/yr', deltaUnit: 'mm/yr' }, es: { name: 'Precipitación', unit: 'mm/año', deltaUnit: 'mm/año' } },
  GWETTOP: { digits: 2, slopeDigits: 3, en: { name: 'Surface soil moisture', unit: 'index 0–1', deltaUnit: 'index 0–1' }, es: { name: 'Humedad superficial del suelo', unit: 'índice 0–1', deltaUnit: 'índice 0–1' } },
  RH2M: { digits: 1, slopeDigits: 2, en: { name: 'Relative humidity', unit: '%', deltaUnit: 'pp' }, es: { name: 'Humedad relativa del aire', unit: '%', deltaUnit: 'p.p.' } }
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function extractFullSeries(annualData, siteId, variable) {
  if (!annualData || !siteId) return [];
  if (typeof annualData === 'function') {
    return annualData(siteId, variable) ?? [];
  }
  const siteEntry = annualData.sites?.[siteId] ?? annualData[siteId];
  if (!siteEntry) return [];
  if (Array.isArray(siteEntry)) {
    return siteEntry.map((item, idx) =>
      typeof item === 'object' && item !== null
        ? { year: Number(item.year), value: Number.isFinite(item.value) ? item.value : null }
        : { year: (annualData.start ?? 2001) + idx, value: Number.isFinite(item) ? item : null }
    );
  }
  if (Array.isArray(siteEntry.monthly)) {
    return annualSeries(siteEntry.monthly, variable);
  }
  const varArr = siteEntry[variable];
  if (Array.isArray(varArr)) {
    const startYear = Number.isFinite(annualData.start) ? annualData.start : 2001;
    return varArr.map((item, idx) =>
      typeof item === 'object' && item !== null
        ? { year: Number(item.year), value: Number.isFinite(item.value) ? item.value : null }
        : { year: startYear + idx, value: Number.isFinite(item) ? item : null }
    );
  }
  return [];
}

function classifyContrast(pacSlopeDecade, carSlopeDecade, pacTrend, carTrend) {
  if (
    !Number.isFinite(pacSlopeDecade) ||
    !Number.isFinite(carSlopeDecade) ||
    (pacTrend?.n ?? 0) < 5 ||
    (carTrend?.n ?? 0) < 5
  ) {
    return 'indeterminate';
  }
  const eps = 1e-6;
  const pacZero = Math.abs(pacSlopeDecade) <= eps;
  const carZero = Math.abs(carSlopeDecade) <= eps;
  if (pacZero && carZero) {
    return 'indeterminate';
  }
  if (!pacZero && !carZero && Math.sign(pacSlopeDecade) !== Math.sign(carSlopeDecade)) {
    return 'opposite-trends';
  }
  const maxAbs = Math.max(Math.abs(pacSlopeDecade), Math.abs(carSlopeDecade));
  const diffAbs = Math.abs(carSlopeDecade - pacSlopeDecade);
  if (maxAbs > eps && diffAbs / maxAbs >= 0.35) {
    return 'asymmetric-pace';
  }
  return 'parallel-shift';
}

function classifyCoupling(r) {
  if (!Number.isFinite(r)) return 'indeterminate';
  if (r > 0.35) return 'in-phase';
  if (r < -0.35) return 'anti-phase';
  return 'decoupled';
}

export function analyzeDipole(
  annualData,
  pacificId = 'guanacaste',
  caribbeanId = 'limon',
  variable = 'PRECTOTCORR',
  startYear = 2001,
  endYear = 2025
) {
  const start = Math.min(Number(startYear) || 2001, Number(endYear) || 2025);
  const end = Math.max(Number(startYear) || 2001, Number(endYear) || 2025);

  const pacFull = extractFullSeries(annualData, pacificId, variable);
  const carFull = extractFullSeries(annualData, caribbeanId, variable);

  const pacSeries = pacFull.filter(d => d.year >= start && d.year <= end && Number.isFinite(d.value));
  const carSeries = carFull.filter(d => d.year >= start && d.year <= end && Number.isFinite(d.value));

  const pacBase2001 = baseline(pacFull, 2001, 2010);
  const carBase2001 = baseline(carFull, 2001, 2010);
  const pacBaseline = Number.isFinite(pacBase2001) ? pacBase2001 : baseline(pacSeries, start, end);
  const carBaseline = Number.isFinite(carBase2001) ? carBase2001 : baseline(carSeries, start, end);

  const pacTrend = trend(pacSeries);
  const carTrend = trend(carSeries);

  const pacSlopeDecade = pacTrend.slope !== null ? pacTrend.slope * 10 : null;
  const carSlopeDecade = carTrend.slope !== null ? carTrend.slope * 10 : null;
  const deltaSlopeDecade =
    pacSlopeDecade !== null && carSlopeDecade !== null ? carSlopeDecade - pacSlopeDecade : null;

  const carMap = new Map(carSeries.map(d => [d.year, d.value]));
  const yearly = pacSeries
    .filter(d => carMap.has(d.year))
    .sort((a, b) => a.year - b.year)
    .map(d => {
      const pacValue = d.value;
      const carValue = carMap.get(d.year);
      const pacAnomaly = Number.isFinite(pacBaseline) ? pacValue - pacBaseline : 0;
      const carAnomaly = Number.isFinite(carBaseline) ? carValue - carBaseline : 0;
      const divergence = carAnomaly - pacAnomaly;
      return {
        year: d.year,
        pacValue,
        carValue,
        pacAnomaly,
        carAnomaly,
        divergence
      };
    });

  const divergenceTrend = trend(yearly.map(d => ({ year: d.year, value: d.divergence })));
  const correlation = detrendedCorrelation(pacSeries, carSeries);
  const coupling = classifyCoupling(correlation.r);
  const contrastClass = classifyContrast(pacSlopeDecade, carSlopeDecade, pacTrend, carTrend);

  return {
    pacificId,
    caribbeanId,
    variable,
    startYear: start,
    endYear: end,
    pacSeries,
    carSeries,
    pacBaseline,
    carBaseline,
    pacTrend,
    carTrend,
    pacSlopeDecade,
    carSlopeDecade,
    deltaSlopeDecade,
    yearly,
    anomalies: yearly,
    divergenceTrend,
    correlation,
    r: correlation.r,
    rawR: correlation.rawR,
    spuriousWarning: correlation.spuriousWarning,
    coupling,
    contrastClass
  };
}

const dipoleUiState = {
  pacificId: 'guanacaste',
  caribbeanId: 'limon'
};

function formatNum(n, digits, lang) {
  if (!Number.isFinite(n)) return lang === 'es' ? 'Sin datos' : 'No data';
  return new Intl.NumberFormat(lang === 'es' ? 'es-CR' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(n);
}

function formatSigned(n, digits, lang) {
  if (!Number.isFinite(n)) return lang === 'es' ? 'Sin datos' : 'No data';
  return `${n > 0 ? '+' : ''}${formatNum(n, digits, lang)}`;
}

function formatP(t, lang) {
  if (!t || t.n < 10 || t.p === null) {
    return lang === 'es' ? 'n < 10 años' : 'n < 10 yrs';
  }
  const pStr = t.p < 0.001 ? 'p < 0.001' : `p = ${formatNum(t.p, 3, lang)}`;
  if (t.autocorrelated) {
    return `${pStr} (${lang === 'es' ? 'autocorr. lag-1' : 'lag-1 autocorr.'})`;
  }
  return `${pStr}${t.p < 0.05 ? ' ★' : ' (n.s.)'}`;
}

function buildDynamicVerdictCopy(analysis, pacName, carName, meta, lang) {
  const es = lang === 'es';
  const unit = `${meta[es ? 'es' : 'en'].deltaUnit}/${es ? 'década' : 'decade'}`;
  const pacStr = `${formatSigned(analysis.pacSlopeDecade, meta.slopeDigits, lang)} ${unit}`;
  const carStr = `${formatSigned(analysis.carSlopeDecade, meta.slopeDigits, lang)} ${unit}`;
  const deltaStr = `${formatSigned(analysis.deltaSlopeDecade, meta.slopeDigits, lang)} ${unit}`;

  let badge = '';
  let title = '';
  let summary = '';

  if (analysis.contrastClass === 'opposite-trends') {
    badge = es ? 'TENDENCIAS OPUESTAS ENTRE VERTIENTES' : 'OPPOSITE CROSS-CORDILLERA TRENDS';
    title = es
      ? `Divergencia de signo opuesto: ${carName} (${carStr}) frente a ${pacName} (${pacStr})`
      : `Opposite-sign slope divergence: ${carName} (${carStr}) vs. ${pacName} (${pacStr})`;
    summary = es
      ? `En ${analysis.startYear}–${analysis.endYear}, ambas vertientes exhiben pendientes de Theil–Sen de signo contrario (Δβ = ${deltaStr}).`
      : `Over ${analysis.startYear}–${analysis.endYear}, the two slopes exhibit opposite-sign Theil–Sen trajectories (Δβ = ${deltaStr}).`;
  } else if (analysis.contrastClass === 'asymmetric-pace') {
    badge = es ? 'RITMO ASIMÉTRICO ENTRE VERTIENTES' : 'ASYMMETRIC PACE ACROSS SLOPES';
    const steeper =
      Math.abs(analysis.carSlopeDecade) >= Math.abs(analysis.pacSlopeDecade) ? carName : pacName;
    title = es
      ? `Cambio en la misma dirección con ritmo asimétrico (más pronunciado en ${steeper}; Δβ = ${deltaStr})`
      : `Same-direction shift at asymmetric pace (steeper in ${steeper}; Δβ = ${deltaStr})`;
    summary = es
      ? `${pacName} registra ${pacStr} mientras ${carName} registra ${carStr} en ${analysis.startYear}–${analysis.endYear}. Ambas series apuntan al mismo signo, pero con magnitud desigual a través de la Cordillera.`
      : `${pacName} records ${pacStr} while ${carName} records ${carStr} over ${analysis.startYear}–${analysis.endYear}. Both move in the same direction, but at markedly different rates across the divide.`;
  } else if (analysis.contrastClass === 'parallel-shift') {
    badge = es ? 'DESPLAZAMIENTO PARALELO' : 'PARALLEL MULTI-YEAR SHIFT';
    title = es
      ? `Evolución paralela entre ${pacName} (${pacStr}) y ${carName} (${carStr})`
      : `Parallel trajectory between ${pacName} (${pacStr}) and ${carName} (${carStr})`;
    summary = es
      ? `Ambas vertientes presentan pendientes de magnitud y signo comparables (Δβ = ${deltaStr}) durante ${analysis.startYear}–${analysis.endYear}.`
      : `Both watersheds exhibit comparable slope sign and magnitude (Δβ = ${deltaStr}) during ${analysis.startYear}–${analysis.endYear}.`;
  } else {
    badge = es ? 'CONTRASTE INDETERMINADO' : 'INDETERMINATE CONTRAST';
    title = es
      ? `Evidencia insuficiente para clasificar divergencia entre ${pacName} y ${carName}`
      : `Insufficient data to classify slope contrast between ${pacName} and ${carName}`;
    summary = es
      ? `Seleccioná un intervalo con al menos 10 años completos para evaluar la divergencia decadal.`
      : `Select a window with at least 10 complete years to evaluate decadal divergence.`;
  }

  return { badge, title, summary };
}

function buildMirrorSvg(analysis, pacName, carName, meta, lang) {
  const W = 960;
  const H = 240;
  const left = 64;
  const right = 24;
  const top = 22;
  const bottom = 34;
  const pts = analysis.yearly;
  const es = lang === 'es';
  const unit = meta[es ? 'es' : 'en'].deltaUnit;

  if (!pts.length) {
    return `<svg class="dipole-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${es ? 'Sin datos suficientes' : 'Insufficient data'}"><text x="50%" y="50%" fill="#92a4b2" text-anchor="middle">${es ? 'No hay años completos alineados en este período.' : 'No aligned complete years in this period.'}</text></svg>`;
  }

  const allVals = [0, ...pts.flatMap(d => [d.pacAnomaly, d.carAnomaly, d.divergence])];
  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  const pad = (max - min || 1) * 0.16;
  min -= pad;
  max += pad;

  const start = analysis.startYear;
  const end = analysis.endYear;
  const x = yr => left + ((yr - start) / (end - start || 1)) * (W - left - right);
  const y = val => top + ((max - val) / (max - min || 1)) * (H - top - bottom);

  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  let svg = `<svg class="dipole-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(
    es
      ? `Gráfico espejo de anomalías 2001-2010: ${pacName} vs ${carName}`
      : `Mirror anomaly chart (2001-2010 baseline): ${pacName} vs ${carName}`
  )}">`;

  for (const tick of ticks) {
    svg += `<line x1="${left}" x2="${W - right}" y1="${y(tick).toFixed(1)}" y2="${y(tick).toFixed(1)}" stroke="#24343f" stroke-dasharray="3 5"/>`;
    svg += `<text x="${left - 10}" y="${(y(tick) + 4).toFixed(1)}" text-anchor="end" fill="#8fa3b0" font-size="10" font-family="monospace">${formatSigned(tick, meta.digits, lang)}</text>`;
  }

  // Zero reference line (2001-2010 baseline)
  if (min <= 0 && max >= 0) {
    svg += `<line x1="${left}" x2="${W - right}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" stroke="#9fb4c2" stroke-width="1.2" stroke-opacity="0.55"/>`;
  }

  // Shaded divergence band between Caribbean anomaly and Pacific anomaly
  if (pts.length > 1) {
    const forward = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.year).toFixed(1)},${y(d.carAnomaly).toFixed(1)}`).join(' ');
    const backward = [...pts]
      .reverse()
      .map(d => `L${x(d.year).toFixed(1)},${y(d.pacAnomaly).toFixed(1)}`)
      .join(' ');
    svg += `<path d="${forward} ${backward} Z" fill="#58d5f7" fill-opacity="0.11"/>`;
  }

  const pacPath = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.year).toFixed(1)},${y(d.pacAnomaly).toFixed(1)}`).join(' ');
  const carPath = pts.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(d.year).toFixed(1)},${y(d.carAnomaly).toFixed(1)}`).join(' ');

  svg += `<path d="${pacPath}" fill="none" stroke="#f4b860" stroke-width="2.2"/>`;
  svg += `<path d="${carPath}" fill="none" stroke="#58d5f7" stroke-width="2.2"/>`;

  // Theil-Sen trend lines on anomalies
  const pacAnomTrend = trend(pts.map(d => ({ year: d.year, value: d.pacAnomaly })));
  const carAnomTrend = trend(pts.map(d => ({ year: d.year, value: d.carAnomaly })));
  if (pts.length > 1 && pacAnomTrend.slope !== null) {
    const y0 = pacAnomTrend.intercept + pacAnomTrend.slope * pts[0].year;
    const y1 = pacAnomTrend.intercept + pacAnomTrend.slope * pts.at(-1).year;
    svg += `<line x1="${x(pts[0].year).toFixed(1)}" y1="${y(y0).toFixed(1)}" x2="${x(pts.at(-1).year).toFixed(1)}" y2="${y(y1).toFixed(1)}" stroke="#f4b860" stroke-width="1.6" stroke-dasharray="6 4" opacity="0.85"/>`;
  }
  if (pts.length > 1 && carAnomTrend.slope !== null) {
    const y0 = carAnomTrend.intercept + carAnomTrend.slope * pts[0].year;
    const y1 = carAnomTrend.intercept + carAnomTrend.slope * pts.at(-1).year;
    svg += `<line x1="${x(pts[0].year).toFixed(1)}" y1="${y(y0).toFixed(1)}" x2="${x(pts.at(-1).year).toFixed(1)}" y2="${y(y1).toFixed(1)}" stroke="#58d5f7" stroke-width="1.6" stroke-dasharray="6 4" opacity="0.85"/>`;
  }

  for (const d of pts) {
    const pacLabel = `${pacName} (${d.year}): ${formatSigned(d.pacAnomaly, meta.digits, lang)} ${unit}`;
    const carLabel = `${carName} (${d.year}): ${formatSigned(d.carAnomaly, meta.digits, lang)} ${unit}`;
    svg += `<circle cx="${x(d.year).toFixed(1)}" cy="${y(d.pacAnomaly).toFixed(1)}" r="3.4" fill="#f4b860"><title>${esc(pacLabel)}</title></circle>`;
    svg += `<circle cx="${x(d.year).toFixed(1)}" cy="${y(d.carAnomaly).toFixed(1)}" r="3.4" fill="#58d5f7"><title>${esc(carLabel)}</title></circle>`;
  }

  const labelYears = pts
    .map(d => d.year)
    .filter((yr, i, arr) => i === 0 || i === arr.length - 1 || yr % 4 === 0);
  for (const yr of labelYears) {
    if (yr !== start && yr - start < 2) continue;
    if (yr !== end && end - yr < 2) continue;
    svg += `<text x="${x(yr).toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="#8fa3b0" font-size="10" font-family="monospace">${yr}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

function buildSiteOptions(sites, selectedId) {
  return sites
    .map(s => `<option value="${esc(s.id)}"${s.id === selectedId ? ' selected' : ''}>${esc(s.name)}</option>`)
    .join('');
}

export function renderDipoleSection(container, state = {}) {
  const el = typeof container === 'string' ? document.querySelector(container) : container;
  if (!el) return null;

  if (state.pacificId) dipoleUiState.pacificId = state.pacificId;
  if (state.caribbeanId) dipoleUiState.caribbeanId = state.caribbeanId;

  const lang = state.lang || (typeof document !== 'undefined' && document.documentElement?.lang === 'en' ? 'en' : 'es');
  const es = lang === 'es';
  const variable = state.variable || 'PRECTOTCORR';
  const startYear = state.startYear ?? state.start ?? 2001;
  const endYear = state.endYear ?? state.end ?? 2025;
  const annualData = state.annualData ?? state.data ?? {};
  const meta = VARIABLE_META[variable] || VARIABLE_META.PRECTOTCORR;

  const sites =
    state.manifest?.sites ??
    Object.values(annualData)
      .filter(s => s && typeof s === 'object' && s.id && s.name)
      .map(s => ({ id: s.id, name: s.name, province: s.province }));

  const pacificId = dipoleUiState.pacificId;
  const caribbeanId = dipoleUiState.caribbeanId;
  const pacSite = sites.find(s => s.id === pacificId) || { id: pacificId, name: pacificId };
  const carSite = sites.find(s => s.id === caribbeanId) || { id: caribbeanId, name: caribbeanId };

  const analysis = analyzeDipole(annualData, pacificId, caribbeanId, variable, startYear, endYear);
  const verdict = buildDynamicVerdictCopy(analysis, pacSite.name, carSite.name, meta, lang);
  const unitDecade = `${meta[es ? 'es' : 'en'].deltaUnit}/${es ? 'déc' : 'dec'}`;

  const couplingLabel =
    analysis.coupling === 'in-phase'
      ? es
        ? 'En fase (r > 0,35)'
        : 'In-phase coupled (r > 0.35)'
      : analysis.coupling === 'anti-phase'
        ? es
          ? 'Dipolo en antifase (r < −0,35)'
          : 'Anti-phase dipole (r < −0.35)'
        : analysis.coupling === 'decoupled'
          ? es
            ? 'Variabilidad interanual desacoplada (|r| ≤ 0,35)'
            : 'Decoupled interannual variability (|r| ≤ 0.35)'
          : es
            ? 'Período insuficiente'
            : 'Insufficient period';

  el.innerHTML = `
    <div class="dipole-header">
      <div>
        <p class="eyebrow">${es ? 'DETECTIVE DE VERTIENTES · PACÍFICO VS. CARIBE' : 'WATERSHED DIPOLE DETECTIVE · PACIFIC VS. CARIBBEAN'}</p>
        <h2>${es ? 'El Duelo del Dipolo: contraste transcordillerano' : 'The Watershed Dipole: Cross-Cordillera Contrast'}</h2>
        <p class="dipole-lead">${
          es
            ? 'Compará la pendiente decadal de Theil–Sen (Δβ) y la correlación residual sin tendencia entre celdas de referencia del Pacífico y del Caribe.'
            : 'Compare the Theil–Sen decadal slope divergence (Δβ) and detrended residual correlation between Pacific and Caribbean reference cells.'
        }</p>
      </div>
      <div class="dipole-presets" role="group" aria-label="${es ? 'Pares transcordilleranos sugeridos' : 'Curated cross-Cordillera pairs'}">
        ${DIPOLE_PRESETS.map(preset => {
          const active = preset.pacificId === pacificId && preset.caribbeanId === caribbeanId;
          return `<button type="button" class="preset-btn dipole-preset-btn${active ? ' selected' : ''}" data-pac="${esc(preset.pacificId)}" data-car="${esc(preset.caribbeanId)}" aria-pressed="${active}">
            <span>${esc(preset.label[es ? 'es' : 'en'])}</span>
            <small>${esc(preset.pairLabel)}</small>
          </button>`;
        }).join('')}
      </div>
    </div>

    <div class="dipole-controls">
      <label class="dipole-select-group">
        <span>${es ? 'Vertiente Pacífico (celda/punto)' : 'Pacific Slope (cell/point)'}</span>
        <select data-dipole-pacific aria-label="${es ? 'Territorio del Pacífico' : 'Pacific territory'}">
          ${buildSiteOptions(sites, pacificId)}
        </select>
      </label>
      <span class="dipole-vs-pill" aria-hidden="true">⇄</span>
      <label class="dipole-select-group">
        <span>${es ? 'Vertiente Caribe (celda/punto)' : 'Caribbean Slope (cell/point)'}</span>
        <select data-dipole-caribbean aria-label="${es ? 'Territorio del Caribe' : 'Caribbean territory'}">
          ${buildSiteOptions(sites, caribbeanId)}
        </select>
      </label>
      <button type="button" class="ghost-button dipole-sync-btn" data-dipole-sync>
        ${es ? 'Sincronizar con serie principal' : 'Sync with main trend chart'}
      </button>
    </div>

    <div class="dipole-verdict-card is-${esc(analysis.contrastClass)}" role="status">
      <div class="dipole-verdict-top">
        <span class="dipole-badge">${esc(verdict.badge)}</span>
        <span class="dipole-var-tag">${esc(meta[es ? 'es' : 'en'].name)} · ${analysis.startYear}–${analysis.endYear}</span>
      </div>
      <h3 class="dipole-verdict-title">${esc(verdict.title)}</h3>
      <p class="dipole-verdict-summary">${esc(verdict.summary)}</p>

      <div class="dipole-metrics-grid">
        <article class="dipole-metric">
          <span>${es ? 'Divergencia decadal (Δβ = β_Caribe − β_Pacífico)' : 'Decadal slope divergence (Δβ = β_Carib − β_Pac)'}</span>
          <strong>${formatSigned(analysis.deltaSlopeDecade, meta.slopeDigits, lang)} <small>${esc(unitDecade)}</small></strong>
          <small>${es ? 'Tendencia de la brecha:' : 'Gap trend:'} ${formatP(analysis.divergenceTrend, lang)}</small>
        </article>
        <article class="dipole-metric is-pacific">
          <span>${es ? `Pacífico · ${pacSite.name}` : `Pacific · ${pacSite.name}`}</span>
          <strong>${formatSigned(analysis.pacSlopeDecade, meta.slopeDigits, lang)} <small>${esc(unitDecade)}</small></strong>
          <small>Mann–Kendall: ${formatP(analysis.pacTrend, lang)}</small>
        </article>
        <article class="dipole-metric is-caribbean">
          <span>${es ? `Caribe · ${carSite.name}` : `Caribbean · ${carSite.name}`}</span>
          <strong>${formatSigned(analysis.carSlopeDecade, meta.slopeDigits, lang)} <small>${esc(unitDecade)}</small></strong>
          <small>Mann–Kendall: ${formatP(analysis.carTrend, lang)}</small>
        </article>
        <article class="dipole-metric">
          <span>${es ? 'Correlación interanual sin tendencia (r_detrended)' : 'Detrended residual correlation (r_detrended)'}</span>
          <strong>r = ${formatNum(analysis.r, 2, lang)} <small>(${es ? 'cruda' : 'raw'} r = ${formatNum(analysis.rawR, 2, lang)})</small></strong>
          <small class="${analysis.spuriousWarning ? 'is-spurious-warn' : ''}">${esc(couplingLabel)}${
            analysis.spuriousWarning
              ? es
                ? ' · ¡Alerta! r cruda inflada por tendencia compartida'
                : ' · Warning: raw r inflated by shared trend'
              : ''
          }</small>
        </article>
      </div>
      <p class="dipole-detrend-note">
        ${
          es
            ? '¿Por qué correlacionar residuos sin tendencia? Dos series con tendencia secular pueden mostrar alta correlación cruda (r_raw) por simple deriva temporal; al restar la recta de Theil–Sen de cada serie antes de calcular Pearson (r_detrended), evaluamos si los años anómalos realmente oscilan juntos o en oposición.'
            : 'Why correlate detrended residuals? Two series with multi-decade trends can exhibit a high raw Pearson correlation (r_raw) purely from shared drift; subtracting each series’ Theil–Sen trend before computing Pearson (r_detrended) isolates whether year-to-year anomalies genuinely covary in-phase or as an anti-phase dipole.'
        }
      </p>
    </div>

    <div class="dipole-chart-wrap">
      <div class="dipole-chart-head">
        <span>${
          es
            ? `Anomalías respecto a 2001–2010 (${meta.es.deltaUnit}) y banda de divergencia`
            : `Anomalies vs. 2001–2010 baseline (${meta.en.deltaUnit}) & divergence band`
        }</span>
        <div class="dipole-legend">
          <span><i class="swatch-pac"></i> ${esc(pacSite.name)} (${es ? 'Pacífico' : 'Pacific'})</span>
          <span><i class="swatch-car"></i> ${esc(carSite.name)} (${es ? 'Caribe' : 'Caribbean'})</span>
          <span><i class="swatch-band"></i> ${es ? 'Brecha Caribe − Pacífico' : 'Caribbean − Pacific gap'}</span>
        </div>
      </div>
      ${buildMirrorSvg(analysis, pacSite.name, carSite.name, meta, lang)}
    </div>

    <aside class="dipole-epistemology-note" aria-label="${es ? 'Nota epistemológica y límite causal' : 'Scientific epistemology and causal guardrail'}">
      <strong>${
        es
          ? 'Rigor epistemológico · Contraste empírico observado vs. hipótesis dinámicas:'
          : 'Epistemological Guardrail · Observed Empirical Contrast vs. Dynamical Hypotheses:'
      }</strong>
      <p>${
        es
          ? 'Las series de NASA POWER (reálisis MERRA-2 a 0,5° × 0,625° y radiación CERES a 1° × 1°) documentan la divergencia empírica observada entre puntos de referencia a ambos lados de la Cordillera. Las causas dinámicas propuestas en la literatura —como modulaciones del Chorro de Bajo Nivel del Caribe (alisios), teleconexiones ENOS (El Niño/La Niña) o cambios en la sombra orográfica— constituyen hipótesis físicas que no se demuestran solo con series puntuales y requieren modelos acoplados de circulación e instrumentación in situ.'
          : 'NASA POWER series (MERRA-2 reanalysis at 0.5° × 0.625° and CERES radiation at 1° × 1°) quantify the observed empirical divergence between reference cells across the Cordillera divide. Proposed dynamical drivers—such as Caribbean Low-Level Jet (trade-wind) modulation, ENSO teleconnections, or orographic rain-shadow shifts—remain scientific hypotheses that cannot be proven from point reanalysis series alone and require coupled circulation models and in-situ station networks.'
      }</p>
    </aside>
  `;

  el.querySelectorAll('.dipole-preset-btn').forEach(btn => {
    btn.onclick = () => {
      dipoleUiState.pacificId = btn.dataset.pac;
      dipoleUiState.caribbeanId = btn.dataset.car;
      renderDipoleSection(el, {
        ...state,
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
      state.onSelectPair?.({
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
    };
  });

  const pacSelect = el.querySelector('[data-dipole-pacific]');
  const carSelect = el.querySelector('[data-dipole-caribbean]');
  if (pacSelect) {
    pacSelect.onchange = e => {
      dipoleUiState.pacificId = e.target.value;
      renderDipoleSection(el, {
        ...state,
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
      state.onSelectPair?.({
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
    };
  }
  if (carSelect) {
    carSelect.onchange = e => {
      dipoleUiState.caribbeanId = e.target.value;
      renderDipoleSection(el, {
        ...state,
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
      state.onSelectPair?.({
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
    };
  }

  const syncBtn = el.querySelector('[data-dipole-sync]');
  if (syncBtn) {
    syncBtn.onclick = () => {
      state.onSync?.({
        pacificId: dipoleUiState.pacificId,
        caribbeanId: dipoleUiState.caribbeanId
      });
      if (typeof document !== 'undefined') {
        document.dispatchEvent(
          new CustomEvent('gaiatrack:dipole-sync', {
            detail: {
              pacificId: dipoleUiState.pacificId,
              caribbeanId: dipoleUiState.caribbeanId
            }
          })
        );
      }
    };
  }

  return analysis;
}
