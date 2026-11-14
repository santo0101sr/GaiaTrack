import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  annualSeries,
  trend,
  baseline,
  detrendedResiduals,
  detrendedCorrelation,
  benjaminiHochberg,
  collapseToUniqueCells
} from '../public/science.js';
import { normalizeForecast, quantile, costaRicaDay } from '../public/forecast-science.js';

test('Annual precipitation sums days and respects leap years', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({
    year: 2024,
    month: i + 1,
    days: new Date(Date.UTC(2024, i + 1, 0)).getUTCDate(),
    PRECTOTCORR: 2,
    T2M: i === 1 ? 20 : 10
  }));
  assert.equal(annualSeries(rows, 'PRECTOTCORR')[0].value, 732);
  assert.ok(Math.abs(annualSeries(rows, 'T2M')[0].value - (10 + 290 / 366)) < 1e-10);
  rows[0].T2M = null;
  assert.equal(annualSeries(rows, 'T2M')[0].value, null);
});

test('Sen slope uses actual elapsed years and Mann-Kendall handles ties', () => {
  const increasing = Array.from({ length: 25 }, (_, i) => ({ year: 2001 + i, value: 2 + 0.3 * i }));
  const t = trend(increasing);
  assert.ok(Math.abs(t.slope - 0.3) < 1e-12);
  assert.ok(t.p < 0.001);
  assert.equal(t.s, 300);
  const flat = trend(increasing.map(p => ({ ...p, value: 4 })));
  assert.equal(flat.slope, 0);
  assert.equal(flat.p, 1);
  assert.equal(trend([{ year: 2000, value: 1 }, { year: 2010, value: 3 }]).slope, 0.2);
  assert.equal(trend(increasing.slice(0, 9)).p, null);
});

test('Baseline excludes missing values and stays fixed outside selected chart period', () => {
  assert.equal(
    baseline([
      { year: 2001, value: 2 },
      { year: 2002, value: 4 },
      { year: 2003, value: null },
      { year: 2020, value: 99 }
    ]),
    3
  );
});

test('detrendedResiduals removes Theil-Sen linear trend and detrendedCorrelation flags spurious trend correlation', () => {
  // Two series with strong shared linear trend but orthogonal year-to-year oscillations
  const seriesA = Array.from({ length: 24 }, (_, i) => ({
    year: 2001 + i,
    value: 10 + 0.8 * i + Math.sin((i * Math.PI) / 2) * 0.4
  }));
  const seriesB = Array.from({ length: 24 }, (_, i) => ({
    year: 2001 + i,
    value: 20 + 0.8 * i + Math.cos((i * Math.PI) / 2) * 0.4
  }));

  const detA = detrendedResiduals(seriesA);
  assert.equal(detA.residuals.length, 24);
  assert.ok(Math.abs(detA.trend.slope - 0.8) < 0.05);

  const corr = detrendedCorrelation(seriesA, seriesB);
  assert.equal(corr.n, 24);
  assert.ok(corr.rawR > 0.9, `Expected high rawR from shared trend, got ${corr.rawR}`);
  assert.ok(Math.abs(corr.r) < 0.15, `Expected near-zero detrended r, got ${corr.r}`);
  assert.equal(corr.spuriousWarning, true);
});

test('benjaminiHochberg computes monotonic adjusted q-values and respects autocorrelation guard', () => {
  const items = [
    { id: 'a', p: 0.005, autocorrelated: false },
    { id: 'b', p: 0.04, autocorrelated: false },
    { id: 'c', p: 0.03, autocorrelated: false },
    { id: 'd', p: 0.2, autocorrelated: false },
    { id: 'e', p: 0.002, autocorrelated: true },
    { id: 'f', p: null, autocorrelated: false }
  ];
  const res = benjaminiHochberg(items, 0.05);
  assert.equal(res.length, 6);
  assert.equal(res[0].m, 5);
  // Rank 1: e (p=0.002) -> raw 0.002*5/1 = 0.010, but autocorrelated=true so fdrSignificant=false
  assert.ok(Math.abs(res[4].q - 0.01) < 1e-12);
  assert.equal(res[4].fdrSignificant, false);
  // Rank 2: a (p=0.005) -> raw 0.005*5/2 = 0.0125 -> fdrSignificant=true
  assert.ok(Math.abs(res[0].q - 0.0125) < 1e-12);
  assert.equal(res[0].fdrSignificant, true);
  // Rank 3 (c, p=0.03 -> 0.05) and Rank 4 (b, p=0.04 -> 0.05): monotonic step-up
  assert.ok(res[2].q <= res[1].q);
  assert.equal(res[5].q, null);
  assert.equal(res[5].fdrSignificant, false);
});

test('collapseToUniqueCells groups shared NASA POWER grid cells without pseudo-replication', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  const cantons = manifest.sites.filter(s => s.type === 'canton');
  const uniqueCells = collapseToUniqueCells(cantons, 0.5);
  assert.ok(uniqueCells.length > 5 && uniqueCells.length < cantons.length);
  const totalMembers = uniqueCells.reduce((acc, c) => acc + c.memberSites.length, 0);
  assert.equal(totalMembers, cantons.length);
  for (const cell of uniqueCells) {
    assert.ok(typeof cell.cellKey === 'string' && cell.cellKey.includes(','));
    assert.equal(cell.representativeSite, cell.memberSites[0]);
    assert.ok(Number.isFinite(cell.latitude) && Number.isFinite(cell.longitude));
  }
});

test('Costa Rica date differs from UTC around midnight', () => {
  assert.equal(costaRicaDay(new Date('2026-11-15T01:00:00Z')), '2026-11-14');
  assert.equal(costaRicaDay(new Date('2026-11-15T07:00:00Z')), '2026-11-15');
});

test('Forecast normalization excludes today and preserves unknown hourly fields', () => {
  const raw = {
    daily: { time: ['2026-11-14', '2026-11-15'], temperature_2m_mean: [22, 23], precipitation_sum: [0, null] },
    hourly: { time: ['2026-11-15T01:00'], relative_humidity_2m: [88], soil_moisture_0_to_1cm: [null] }
  };
  const days = normalizeForecast(raw, null, '2026-11-14');
  assert.equal(days.length, 1);
  assert.equal(days[0].date, '2026-11-15');
  assert.equal(days[0].T2M, 23);
  assert.equal(days[0].RH2M, null);
  assert.equal(days[0].GWETTOP, null);
  assert.equal(days[0].PRECTOTCORR, null);
  assert.equal(days[0].ensemble, null);
  assert.equal(quantile([0, 10, 20, 30], 0.5), 15);
});

test('Every canton has complete source-backed historical data and consistent units', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  assert.equal(manifest.provinces.length, 7);
  assert.equal(manifest.sites.filter(s => s.type === 'canton').length, 83);
  assert.equal(manifest.sites.filter(s => s.type === 'province').length, 7);
  for (const s of manifest.sites) {
    const d = JSON.parse(await readFile(new URL(`../public/data/${s.id}.json`, import.meta.url)));
    assert.equal(d.monthly.length, 300);
    for (const p of ['T2M', 'T2M_MIN', 'T2M_MAX', 'ALLSKY_SFC_SW_DWN', 'PRECTOTCORR', 'GWETTOP', 'RH2M']) {
      assert.equal(annualSeries(d.monthly, p).filter(p => Number.isFinite(p.value)).length, 25);
    }
    assert.equal(d.parameters.PRECTOTCORR.units, 'mm/day');
    assert.equal(d.parameters.GWETTOP.units, '1');
    for (const row of d.monthly) {
      assert.ok(row.T2M_MIN <= row.T2M && row.T2M <= row.T2M_MAX);
      assert.ok(row.GWETTOP >= 0 && row.GWETTOP <= 1);
      assert.ok(row.RH2M >= 0 && row.RH2M <= 100);
    }
  }
});

test('Cached forecasts reproduce real source arrays, complete humidity and genuine member spread', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  for (const s of manifest.sites) {
    const d = JSON.parse(await readFile(new URL(`../public/data/forecast/${s.id}.json`, import.meta.url)));
    const today = d.raw.daily.time[0];
    const normalized = normalizeForecast(d.raw, d.rawEnsemble, today);
    assert.deepEqual(normalized, d.days);
    assert.equal(d.days.length, 7);
    assert.equal(d.raw.timezone, 'America/Costa_Rica');
    for (const day of d.days) {
      assert.ok(day.date > today);
      assert.ok(day.T2M_MIN <= day.T2M && day.T2M <= day.T2M_MAX);
      assert.ok(Number.isFinite(day.RH2M));
      assert.ok(Number.isFinite(day.GWETTOP));
      assert.equal(day.ensemble.n, 31);
      assert.ok(day.ensemble.p10 <= day.ensemble.p50 && day.ensemble.p50 <= day.ensemble.p90);
    }
  }
});
