import { collapseToUniqueCells, confidenceInterval, tTest, trend } from './science.js';

export const DATA_VARIABLES_COUNT = 7;
export const MERRA2_RES = { latDeg: 0.5, lonDeg: 0.625, approxKm: '55 × 68 km' };
export const CERES_RES = { latDeg: 1.0, lonDeg: 1.0, approxKm: '111 × 109 km' };

export const REAL_DATA_SOURCES = [
  {
    id: 'nasa-power-merra2',
    name: 'NASA POWER · MERRA-2',
    scopeEn: 'Daily & monthly 2 m temperature (mean, min, max), precipitation, surface soil moisture index (0–1), and relative humidity (2001–2025)',
    scopeEs: 'Temperatura diaria y mensual a 2 m (media, mínima, máxima), precipitación, índice de humedad superficial del suelo (0–1) y humedad relativa (2001–2025)',
    resolution: '0.5° × 0.625° (~55 × 68 km)'
  },
  {
    id: 'nasa-power-ceres',
    name: 'NASA POWER · CERES SYN1DEG',
    scopeEn: 'All-sky downward surface shortwave solar radiation (2001–2025)',
    scopeEs: 'Radiación solar de onda corta incidente en superficie bajo todo cielo (2001–2025)',
    resolution: '1.0° × 1.0° (~111 × 109 km)'
  },
  {
    id: 'open-meteo',
    name: 'Open-Meteo Forecast & GFS Ensemble',
    scopeEn: 'Current conditions, 48 h hourly timeline, 7-day daily forecast, and P10–P90 temperature ensemble spread (CC BY 4.0)',
    scopeEs: 'Condiciones actuales, serie horaria a 48 h, pronóstico diario a 7 días y dispersión P10–P90 del conjunto GFS (CC BY 4.0)',
    resolution: 'Model grid (point forecast)'
  },
  {
    id: 'gbif-iucn',
    name: 'GBIF · IUCN Red List',
    scopeEn: 'Georeferenced biological occurrence counts and CR/EN/VU/NT threatened records used in the exploratory Ecological Risk score',
    scopeEs: 'Registros biológicos georreferenciados y conteos en categorías CR/EN/VU/NT usados en el índice exploratorio de Riesgo Ecológico',
    resolution: 'Bounding box per territory'
  },
  {
    id: 'copernicus-dem',
    name: 'Open-Meteo Elevation (Copernicus DEM GLO-90)',
    scopeEn: 'Reference elevation (m) for hydrological relief weighting in Ecological Risk',
    scopeEs: 'Elevación de referencia (m) para el ajuste orográfico del estrés hídrico en Riesgo Ecológico',
    resolution: '~90 m'
  }
];

export const MODELED_NBS_SCENARIOS = [
  {
    id: 'urban-corridors',
    areaHa: 450,
    ieaFrom: 2.25,
    ieaTo: 1.18,
    deltaTempC: -2.15,
    waterMillionM3Yr: 3.2,
    fireRiskReductionPct: null,
    nameEn: 'Urban Green Corridors · 450 ha',
    nameEs: 'Corredores Verdes Urbanos (GAM) · 450 ha',
    summaryEn: 'Modeled IEA shift 2.25 → 1.18, −2.15 °C surface effect, 3.2M m³/yr infiltration',
    summaryEs: 'Cambio modelado IEA 2,25 → 1,18, −2,15 °C superficial, 3,2M m³/año infiltrados'
  },
  {
    id: 'agroforestry',
    areaHa: 1800,
    ieaFrom: 2.34,
    ieaTo: 1.29,
    deltaTempC: -1.75,
    waterMillionM3Yr: 6.8,
    fireRiskReductionPct: null,
    nameEn: 'Agroforestry Systems · 1,800 ha',
    nameEs: 'Sistemas Agroforestales · 1.800 ha',
    summaryEn: 'Modeled IEA shift 2.34 → 1.29, −1.75 °C surface effect, 6.8M m³/yr retention',
    summaryEs: 'Cambio modelado IEA 2,34 → 1,29, −1,75 °C superficial, 6,8M m³/año retenidos'
  },
  {
    id: 'wetlands-coast',
    areaHa: 1200,
    ieaFrom: 2.38,
    ieaTo: 1.35,
    deltaTempC: -1.90,
    waterMillionM3Yr: 7.5,
    fireRiskReductionPct: -74,
    nameEn: 'Wetlands & Coast · 1,200 ha',
    nameEs: 'Humedales y Zonas Costeras · 1.200 ha',
    summaryEn: 'Modeled IEA shift 2.38 → 1.35, −1.90 °C, −74% fire risk, 7.5M m³/yr storage',
    summaryEs: 'Cambio modelado IEA 2,38 → 1,35, −1,90 °C, −74 % riesgo de fuego, 7,5M m³/año'
  }
];

export function deriveManifestFacts(manifest, { districtsCount = null, sectorsCount = null } = {}) {
  const sites = Array.isArray(manifest?.sites) ? manifest.sites : [];
  const provinces = Array.isArray(manifest?.provinces)
    ? manifest.provinces
    : sites.filter(s => s.type === 'province');
  const cantonSites = sites.filter(s => s.type === 'canton');
  const startYear = Number.isFinite(manifest?.start) ? manifest.start : 2001;
  const endYear = Number.isFinite(manifest?.end) ? manifest.end : 2025;
  const yearsCount = Math.max(0, endYear - startYear + 1);
  const monthsCount = yearsCount * 12;

  const uniqueCantonMetCells = collapseToUniqueCells(cantonSites, MERRA2_RES.latDeg, MERRA2_RES.lonDeg).length;
  const uniqueCantonRadCells = collapseToUniqueCells(cantonSites, CERES_RES.latDeg, CERES_RES.lonDeg).length;
  const uniqueProvinceMetCells = collapseToUniqueCells(
    sites.filter(s => s.type === 'province'),
    MERRA2_RES.latDeg,
    MERRA2_RES.lonDeg
  ).length;

  return {
    provincesCount: provinces.length,
    cantonsCount: cantonSites.length,
    totalSitesCount: sites.length,
    variablesCount: DATA_VARIABLES_COUNT,
    startYear,
    endYear,
    yearsCount,
    monthsCount,
    uniqueCantonMetCells,
    uniqueCantonRadCells,
    uniqueProvinceMetCells,
    districtsCount: Number.isFinite(districtsCount) ? districtsCount : null,
    sectorsCount: Number.isFinite(sectorsCount) ? sectorsCount : null
  };
}

export function uniqueCellCountForSites(sites = [], variable = 'T2M') {
  const res = variable === 'ALLSKY_SFC_SW_DWN' ? CERES_RES : MERRA2_RES;
  return collapseToUniqueCells(sites, res.latDeg, res.lonDeg).length;
}

export function computeSiteTrendHighlight(annual, siteId, variable = 'T2M', startYear = 2001, endYear = 2025) {
  const rawArr = annual?.sites?.[siteId]?.[variable];
  if (!Array.isArray(rawArr) || !annual?.start) return null;
  const pts = rawArr
    .map((value, i) => ({ year: annual.start + i, value: Number.isFinite(value) ? value : null }))
    .filter(p => p.year >= startYear && p.year <= endYear && Number.isFinite(p.value));
  if (pts.length < 2) return null;

  const baseVals = pts.filter(p => p.year >= 2001 && p.year <= 2010).map(p => p.value);
  const recentVals = pts.filter(p => p.year >= 2016 && p.year <= endYear).map(p => p.value);
  const baseMean = baseVals.length ? baseVals.reduce((a, b) => a + b, 0) / baseVals.length : null;
  const baseStd = baseVals.length > 1
    ? Math.sqrt(baseVals.reduce((a, v) => a + (v - baseMean) ** 2, 0) / (baseVals.length - 1))
    : null;
  const zPts = Number.isFinite(baseMean) && Number.isFinite(baseStd) && baseStd > 0
    ? pts.map(p => ({ year: p.year, value: (p.value - baseMean) / baseStd }))
    : [];

  const valTrend = trend(pts);
  const zTrend = zPts.length >= 2 ? trend(zPts) : null;
  const welch = recentVals.length >= 2 && baseVals.length >= 2 ? tTest(recentVals, baseVals, 0.05) : null;
  const meanCI = confidenceInterval(pts.map(p => p.value), 0.05);

  return {
    siteId,
    variable,
    nYears: pts.length,
    points: pts,
    zPoints: zPts,
    baseMean,
    baseStd,
    latestPoint: pts[pts.length - 1],
    latestZ: zPts.length ? zPts[zPts.length - 1].value : null,
    slopePerDecade: Number.isFinite(valTrend.slope) ? valTrend.slope * 10 : null,
    slopeCIDecade: valTrend.slopeCI
      ? { lower: valTrend.slopeCI.lower * 10, upper: valTrend.slopeCI.upper * 10 }
      : null,
    zSlopePerDecade: Number.isFinite(zTrend?.slope) ? zTrend.slope * 10 : null,
    valTrend: { slope: valTrend.slope, intercept: valTrend.intercept },
    zTrend: zTrend ? { slope: zTrend.slope, intercept: zTrend.intercept } : null,
    mkP: valTrend.p,
    autocorrelated: valTrend.autocorrelated,
    welchP: welch?.p ?? null,
    welchDiff: welch?.meanDiff ?? null,
    meanCI
  };
}
