// Thermal color ramp and helpers for the 2D and 3D canton temperature radar.

export const THERMAL_STOPS = [
  { t: 0.0, rgb: [43, 108, 176] },   // Cool mountain blue (#2b6cb0)
  { t: 0.25, rgb: [56, 178, 172] },  // Fresh highland cyan (#38b2ac)
  { t: 0.5, rgb: [132, 204, 22] },   // Temperate valley lime (#84cc16)
  { t: 0.75, rgb: [245, 158, 11] },  // Warm lowland amber (#f59e0b)
  { t: 1.0, rgb: [239, 68, 68] }     // Hot coastal red (#ef4444)
];

export const THERMAL_GRADIENT_CSS =
  'linear-gradient(90deg, #2b6cb0 0%, #38b2ac 25%, #84cc16 50%, #f59e0b 75%, #ef4444 100%)';

const TEMP_VARIABLES = new Set(['T2M', 'T2M_MIN', 'T2M_MAX']);

export function isTemperatureVariable(variable) {
  return TEMP_VARIABLES.has(variable);
}

export function radarVariableFor(variable) {
  return isTemperatureVariable(variable) ? variable : 'T2M';
}

export function thermalRange(values = []) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return { min: 14, max: 30 };
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max - min < 0.5) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

export function thermalColor(value, min = 14, max = 30) {
  if (!Number.isFinite(value)) {
    return { r: 124, g: 135, b: 145, css: '#7c8791', hex: 0x7c8791 };
  }
  const span = max - min || 1;
  const clamped = Math.max(0, Math.min(1, (value - min) / span));

  let left = THERMAL_STOPS[0];
  let right = THERMAL_STOPS[THERMAL_STOPS.length - 1];
  for (let i = 0; i < THERMAL_STOPS.length - 1; i++) {
    if (clamped >= THERMAL_STOPS[i].t && clamped <= THERMAL_STOPS[i + 1].t) {
      left = THERMAL_STOPS[i];
      right = THERMAL_STOPS[i + 1];
      break;
    }
  }

  const localT = right.t === left.t ? 0 : (clamped - left.t) / (right.t - left.t);
  const r = Math.round(left.rgb[0] + (right.rgb[0] - left.rgb[0]) * localT);
  const g = Math.round(left.rgb[1] + (right.rgb[1] - left.rgb[1]) * localT);
  const b = Math.round(left.rgb[2] + (right.rgb[2] - left.rgb[2]) * localT);
  const hex = (r << 16) | (g << 8) | b;
  return { r, g, b, css: `rgb(${r},${g},${b})`, hex };
}

const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;
let liveCache = null;
let liveInflight = null;

export function indexCurrentTemperatures(payload) {
  const temps = new Map();
  const rows = Array.isArray(payload?.sites) ? payload.sites : [];
  for (const row of rows) {
    if (row?.site && Number.isFinite(row.temperature)) {
      temps.set(row.site, row.temperature);
    }
  }
  return {
    temps,
    retrievedAt: payload?.retrievedAt ?? null
  };
}

export async function fetchLiveTemperatures({ force = false, fetchImpl = globalThis.fetch } = {}) {
  const now = Date.now();
  if (!force && liveCache && now - liveCache.fetchedAt < LIVE_CACHE_TTL_MS) {
    return liveCache.data;
  }
  if (!force && liveInflight) return liveInflight;
  liveInflight = (async () => {
    const res = await fetchImpl('/api/current?site=all');
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const data = indexCurrentTemperatures(payload);
    if (!data.temps.size) throw Error('No current temperature data available.');
    liveCache = { fetchedAt: Date.now(), data };
    return data;
  })().finally(() => {
    liveInflight = null;
  });
  return liveInflight;
}
