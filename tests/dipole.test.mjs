import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DIPOLE_PRESETS, analyzeDipole, renderDipoleSection } from '../public/dipole.js';

test('DIPOLE_PRESETS reference real manifest territories across the Cordillera divide', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  const ids = new Set(manifest.sites.map(s => s.id));
  assert.equal(DIPOLE_PRESETS.length, 3);
  for (const preset of DIPOLE_PRESETS) {
    assert.ok(ids.has(preset.pacificId), `Missing Pacific site ${preset.pacificId}`);
    assert.ok(ids.has(preset.caribbeanId), `Missing Caribbean site ${preset.caribbeanId}`);
    assert.notEqual(preset.pacificId, preset.caribbeanId);
  }
});

test('analyzeDipole classifies opposite-trends, asymmetric-pace, parallel-shift, and indeterminate strictly from data', () => {
  const years = Array.from({ length: 20 }, (_, i) => 2001 + i);

  // 1) Opposite trends + anti-phase residuals
  const oppData = {
    pac: years.map((year, i) => ({ year, value: 2000 - 15 * i + (i % 2 === 0 ? 30 : -30) })),
    car: years.map((year, i) => ({ year, value: 2500 + 25 * i + (i % 2 === 0 ? -30 : 30) }))
  };
  const opp = analyzeDipole(oppData, 'pac', 'car', 'PRECTOTCORR', 2001, 2020);
  assert.equal(opp.contrastClass, 'opposite-trends');
  assert.ok(opp.pacSlopeDecade < 0 && opp.carSlopeDecade > 0);
  assert.ok(opp.deltaSlopeDecade > 0);
  assert.equal(opp.coupling, 'anti-phase');

  // 2) Asymmetric pace (same sign, Caribbean much steeper) + decoupled residuals
  const asymData = {
    pac: years.map((year, i) => ({ year, value: 1500 + 8 * i + Math.sin(i) * 15 })),
    car: years.map((year, i) => ({ year, value: 2200 + 40 * i + Math.cos(i) * 15 }))
  };
  const asym = analyzeDipole(asymData, 'pac', 'car', 'PRECTOTCORR', 2001, 2020);
  assert.equal(asym.contrastClass, 'asymmetric-pace');
  assert.ok(asym.pacSlopeDecade > 0 && asym.carSlopeDecade > 0);
  assert.ok(asym.carSlopeDecade > asym.pacSlopeDecade * 2);

  // 3) Parallel shift + in-phase residuals
  const parData = {
    pac: years.map((year, i) => ({ year, value: 26 + 0.03 * i + (i % 3 === 0 ? 0.2 : -0.1) })),
    car: years.map((year, i) => ({ year, value: 24 + 0.032 * i + (i % 3 === 0 ? 0.2 : -0.1) }))
  };
  const par = analyzeDipole(parData, 'pac', 'car', 'T2M', 2001, 2020);
  assert.equal(par.contrastClass, 'parallel-shift');
  assert.equal(par.coupling, 'in-phase');

  // 4) Indeterminate when period has fewer than 5 years
  const shortRes = analyzeDipole(parData, 'pac', 'car', 'T2M', 2001, 2003);
  assert.equal(shortRes.contrastClass, 'indeterminate');
});

test('analyzeDipole and renderDipoleSection work with real Costa Rica annual data and include epistemological guardrail', async () => {
  const annual = JSON.parse(await readFile(new URL('../public/data/annual.json', import.meta.url)));
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));

  const res = analyzeDipole(annual, 'guanacaste', 'limon', 'PRECTOTCORR', 2001, 2025);
  assert.equal(res.yearly.length, 25);
  assert.ok(Number.isFinite(res.pacSlopeDecade));
  assert.ok(Number.isFinite(res.carSlopeDecade));
  assert.ok(Number.isFinite(res.deltaSlopeDecade));
  assert.ok(Number.isFinite(res.r) && Number.isFinite(res.rawR));

  // Verify DOM rendering in both Spanish and English
  const mockContainer = {
    innerHTML: '',
    querySelectorAll() {
      return [];
    },
    querySelector() {
      return null;
    }
  };

  renderDipoleSection(mockContainer, {
    annualData: annual,
    manifest,
    variable: 'PRECTOTCORR',
    startYear: 2001,
    endYear: 2025,
    lang: 'es'
  });
  assert.ok(mockContainer.innerHTML.includes('viewBox="0 0 960 240"'));
  assert.ok(mockContainer.innerHTML.includes('MERRA-2'));
  assert.ok(mockContainer.innerHTML.includes('hipótesis'));

  renderDipoleSection(mockContainer, {
    annualData: annual,
    manifest,
    variable: 'T2M',
    startYear: 2001,
    endYear: 2025,
    lang: 'en'
  });
  assert.ok(mockContainer.innerHTML.includes('Epistemological Guardrail'));
  assert.ok(mockContainer.innerHTML.includes('hypotheses'));
});
