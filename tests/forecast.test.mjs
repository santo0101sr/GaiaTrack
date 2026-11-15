import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSevenDayForecast } from '../public/forecast-science.js';

test('summarizeSevenDayForecast computes thermal trajectory, rain regime, soil change, and GFS spread', () => {
  const days = [
    {
      date: '2026-11-15',
      T2M: 21.0,
      T2M_MIN: 16.5,
      T2M_MAX: 26.0,
      PRECTOTCORR: 0.4,
      ALLSKY_SFC_SW_DWN: 18.0,
      RH2M: 72,
      GWETTOP: 0.30,
      rainProbability: 20,
      ensemble: { n: 31, p10: 20.0, p50: 21.0, p90: 22.0 }
    },
    {
      date: '2026-11-16',
      T2M: 22.0,
      T2M_MIN: 17.0,
      T2M_MAX: 28.5,
      PRECTOTCORR: 12.5,
      ALLSKY_SFC_SW_DWN: 12.0,
      RH2M: 84,
      GWETTOP: 0.34,
      rainProbability: 85,
      ensemble: { n: 31, p10: 20.5, p50: 22.0, p90: 24.5 }
    },
    {
      date: '2026-11-17',
      T2M: 23.0,
      T2M_MIN: 18.0,
      T2M_MAX: 27.5,
      PRECTOTCORR: 3.1,
      ALLSKY_SFC_SW_DWN: 15.0,
      RH2M: 78,
      GWETTOP: 0.36,
      rainProbability: 55,
      ensemble: null
    }
  ];

  const summary = summarizeSevenDayForecast(days);
  assert.ok(Math.abs(summary.tempMean - 22.0) < 1e-12);
  assert.ok(Math.abs(summary.tempDelta - 2.0) < 1e-12);
  assert.deepEqual(summary.warmestDay, { date: '2026-11-16', value: 28.5 });
  assert.deepEqual(summary.coolestDay, { date: '2026-11-15', value: 16.5 });
  assert.ok(Math.abs(summary.totalRain - 16.0) < 1e-12);
  assert.equal(summary.rainyDays, 2);
  assert.deepEqual(summary.wettestDay, { date: '2026-11-16', value: 12.5 });
  assert.equal(summary.maxRainProb, 85);
  assert.ok(Math.abs(summary.meanHumidity - 78) < 1e-12);
  assert.ok(Math.abs(summary.meanRadiation - 15.0) < 1e-12);
  assert.ok(Math.abs(summary.soilStart - 0.30) < 1e-12);
  assert.ok(Math.abs(summary.soilEnd - 0.36) < 1e-12);
  assert.ok(Math.abs(summary.soilDelta - 0.06) < 1e-12);
  assert.ok(Math.abs(summary.ensembleSpreadMean - 3.0) < 1e-12);
  assert.equal(summary.ensembleLastSpread, null);
  assert.equal(summary.ensembleMembers, 31);
});

test('summarizeSevenDayForecast returns null for empty input and preserves missing values', () => {
  assert.equal(summarizeSevenDayForecast([]), null);
  assert.equal(summarizeSevenDayForecast(null), null);

  const sparse = summarizeSevenDayForecast([
    { date: '2026-11-15', T2M: 24, PRECTOTCORR: null, GWETTOP: null },
    { date: '2026-11-16', T2M: null, PRECTOTCORR: 0, GWETTOP: 0.25 }
  ]);
  assert.equal(sparse.tempMean, 24);
  assert.equal(sparse.tempDelta, null);
  assert.equal(sparse.totalRain, 0);
  assert.equal(sparse.rainyDays, 0);
  assert.equal(sparse.soilDelta, null);
  assert.equal(sparse.ensembleSpreadMean, null);
  assert.equal(sparse.ensembleMembers, null);
});
