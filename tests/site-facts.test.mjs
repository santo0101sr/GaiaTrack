import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  DATA_VARIABLES_COUNT,
  REAL_DATA_SOURCES,
  MODELED_NBS_SCENARIOS,
  deriveManifestFacts,
  uniqueCellCountForSites,
  computeSiteTrendHighlight
} from '../public/site-facts.js';

test('deriveManifestFacts matches actual manifest counts and unique MERRA-2 / CERES cells', async () => {
  const manifest = JSON.parse(await fs.readFile(path.resolve('public/data/manifest.json'), 'utf8'));
  const sectors = JSON.parse(await fs.readFile(path.resolve('public/data/sectors.json'), 'utf8'));
  const districtBorders = JSON.parse(await fs.readFile(path.resolve('public/data/district-borders.json'), 'utf8'));
  const sectorsCount = Object.values(sectors).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  const districtsCount = Object.values(districtBorders).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  const facts = deriveManifestFacts(manifest, { sectorsCount, districtsCount });

  assert.equal(facts.provincesCount, 7);
  assert.equal(facts.cantonsCount, 83);
  assert.equal(facts.totalSitesCount, 90);
  assert.equal(facts.variablesCount, DATA_VARIABLES_COUNT);
  assert.equal(facts.startYear, 2001);
  assert.equal(facts.endYear, 2025);
  assert.equal(facts.yearsCount, 25);
  assert.equal(facts.monthsCount, 300);
  assert.equal(facts.uniqueCantonMetCells, 20);
  assert.equal(facts.uniqueCantonRadCells, 10);
  assert.equal(facts.uniqueProvinceMetCells, 6);
  assert.equal(facts.sectorsCount, 479);
  assert.equal(facts.districtsCount, 472);

  const provSites = manifest.sites.filter(s => s.type === 'province');
  assert.equal(uniqueCellCountForSites(provSites, 'T2M'), 6);
  assert.equal(uniqueCellCountForSites(provSites, 'ALLSKY_SFC_SW_DWN'), 4);
});

test('REAL_DATA_SOURCES and MODELED_NBS_SCENARIOS never advertise MODIS, GPM, SMAP, or unverified aggregates', () => {
  const realText = JSON.stringify(REAL_DATA_SOURCES);
  assert.match(realText, /MERRA-2/);
  assert.match(realText, /CERES SYN1DEG/);
  assert.match(realText, /Open-Meteo/);
  assert.match(realText, /GBIF/);
  assert.doesNotMatch(realText, /\b(MODIS|GPM|SMAP)\b/);
  assert.equal(MODELED_NBS_SCENARIOS.length, 3);
});

test('computeSiteTrendHighlight returns observed Z, 95% CI, and Mann-Kendall p for Heredia and Guanacaste', async () => {
  const annual = JSON.parse(await fs.readFile(path.resolve('public/data/annual.json'), 'utf8'));
  const heredia = computeSiteTrendHighlight(annual, 'heredia', 'T2M');
  const guanacaste = computeSiteTrendHighlight(annual, 'guanacaste', 'T2M');

  assert.equal(heredia.nYears, 25);
  assert.ok(Number.isFinite(heredia.latestZ));
  assert.ok(Number.isFinite(heredia.slopePerDecade) && heredia.slopePerDecade > 0);
  assert.ok(heredia.slopeCIDecade && heredia.slopeCIDecade.lower < heredia.slopeCIDecade.upper);
  assert.ok(Number.isFinite(heredia.mkP) && heredia.mkP < 0.05);
  assert.ok(Number.isFinite(heredia.welchP));

  assert.equal(guanacaste.nYears, 25);
  assert.ok(Number.isFinite(guanacaste.slopePerDecade) && guanacaste.slopePerDecade > 0);
  assert.ok(Number.isFinite(guanacaste.mkP));
});
