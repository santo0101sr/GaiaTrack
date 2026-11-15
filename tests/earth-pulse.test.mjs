import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calibratedStressIndex,
  experimentalStressIndex,
  monthlyReference,
  monthlyZScoreSeries,
  ndviAnomaly,
  pearsonCorrelation,
  precipitationAnomaly,
  simulateScenario,
  siteZSummary,
  stressIndicators,
  temperatureAnomaly,
  temporalPersistenceGate,
  waterBalance,
  zScore
} from '../public/earth-pulse.js';

test('Anomalies and zero-division guards follow Earth Pulse rules', () => {
  assert.equal(temperatureAnomaly(24.5, 22.0), 2.5);
  assert.deepEqual(precipitationAnomaly(15, 10), { abs: 5, pct: 50 });
  // Near-zero historical precipitation must omit percentage ratio
  const nearZero = precipitationAnomaly(2.0, 0.01);
  assert.equal(nearZero.abs, 1.99);
  assert.equal(nearZero.pct, null);
  assert.equal(ndviAnomaly(0.55, 0.65), -0.09999999999999998);
});

test('Z-score, stress indicator signs, and IEA equal/normalized weights', () => {
  assert.equal(zScore(20, 20, 0), null); // sigma = 0 guard
  const refs = {
    t: { mean: 20, std: 2 },
    p: { mean: 100, std: 20 },
    ndvi: { mean: 0.6, std: 0.1 },
    sm: { mean: 0.4, std: 0.05 }
  };
  const ind = stressIndicators({ t: 22, p: 80, ndvi: 0.5, sm: 0.35 }, refs);
  // All unfavorable (+1 std temp, -1 std rain/ndvi/sm) => all +1
  assert.equal(ind.I_T, 1);
  assert.equal(ind.I_P, 1);
  assert.ok(Math.abs(ind.I_V - 1) < 1e-12);
  assert.ok(Math.abs(ind.I_S - 1) < 1e-12);

  const iea4 = experimentalStressIndex(ind);
  assert.ok(Math.abs(iea4.iea - 1) < 1e-12);
  assert.equal(iea4.activeCount, 4);

  // When NDVI is unavailable, weights normalize over active indicators and sum to 1
  const iea3 = experimentalStressIndex({ I_T: 1.5, I_P: 0.5, I_V: null, I_S: 1.0 });
  assert.equal(iea3.activeCount, 3);
  assert.ok(Math.abs(Object.values(iea3.weightsUsed).reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(Math.abs(iea3.iea - 1.0) < 1e-12);
});

test('Seasonal monthlyReference, water balance, Pearson r, and scenario simulator', () => {
  const rows = [
    { year: 2020, month: 11, T2M: 20, PRECTOTCORR: 10 },
    { year: 2021, month: 11, T2M: 22, PRECTOTCORR: 8 },
    { year: 2022, month: 11, T2M: 24, PRECTOTCORR: 6 },
    { year: 2022, month: 3, T2M: 30, PRECTOTCORR: 0 }
  ];
  const refNov = monthlyReference(rows, 'T2M', 11, 2001, 2025);
  assert.equal(refNov.n, 3);
  assert.equal(refNov.mean, 22);
  assert.ok(Math.abs(pearsonCorrelation([20, 22, 24], [10, 8, 6]) + 1) < 1e-12);
  assert.equal(waterBalance({ p: 200, et: 90, r: 40, d: 20 }), 50);

  const scen = simulateScenario({ t: 22, p: 10, ndvi: 0.6, sm: 0.35 }, { deltaT: 2, deltaPPercent: -20, deltaNdvi: -0.1 });
  assert.equal(scen.t, 24);
  assert.equal(scen.p, 8);
  assert.ok(Math.abs(scen.ndvi - 0.5) < 1e-12);
});

test('Calibrated IEA with thermo-hydro coupling, coherence gate, persistence, and siteZSummary', () => {
  const stressed = calibratedStressIndex({ I_T: 1.5, I_P: 1.2, I_V: null, I_S: 1.4 });
  assert.ok(stressed.coupling > 0);
  assert.ok(stressed.iea > stressed.linearIea);
  assert.equal(stressed.status, 'stress');

  const surplus = calibratedStressIndex({ I_T: -0.8, I_P: -1.4, I_V: null, I_S: -1.1 });
  assert.equal(surplus.coupling, 0);
  assert.equal(surplus.benignSurplus, true);
  assert.equal(surplus.status, 'benign-surplus');

  const gate = temporalPersistenceGate([{ iea: 0.2 }, { iea: 0.95 }, { iea: 1.1 }, { iea: 0.4 }], 0.89, 2);
  assert.equal(gate.persistent, true);
  assert.equal(gate.maxConsecutive, 2);
  assert.equal(gate.persistentEvents, 1);

  const monthly = [];
  for (let y = 2001; y <= 2012; y++) {
    monthly.push({
      year: y,
      month: 3,
      T2M: y <= 2010 ? 22 + (y % 2) * 0.4 : 25 + (y - 2011) * 0.5,
      PRECTOTCORR: y <= 2010 ? 5 + (y % 2) * 1.0 : 1,
      GWETTOP: y <= 2010 ? 0.5 + (y % 2) * 0.04 : 0.25
    });
  }
  const zSeries = monthlyZScoreSeries(monthly, 'T2M', { refStart: 2001, refEnd: 2010 });
  assert.equal(zSeries.length, 12);
  assert.ok(zSeries.at(-1).z > 2);

  const summary = siteZSummary(monthly, 2011, 2012, 2001, 2010);
  assert.equal(summary.persistence.persistent, true);
  assert.equal(summary.periodIEA.status, 'stress');
  assert.ok(summary.ciByVar.T2M.lower < summary.ciByVar.T2M.mean);
});
