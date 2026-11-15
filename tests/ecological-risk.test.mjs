import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeAllRisks,
  computeSiteRisk,
  driverLabel,
  riskColor,
  riskLevel
} from '../public/ecological-risk.js';

test('riskColor and riskLevel map ecological risk scores consistently', () => {
  assert.equal(riskColor(0).css, 'rgb(34,197,94)');
  assert.equal(riskColor(100).css, 'rgb(239,68,68)');
  assert.equal(riskColor(null).css, '#7c8791');

  assert.equal(riskLevel(15, 'es').id, 'low');
  assert.equal(riskLevel(40, 'es').id, 'moderate');
  assert.equal(riskLevel(60, 'es').id, 'high');
  assert.equal(riskLevel(85, 'en').id, 'critical');
  assert.equal(driverLabel('biodiversity', 'es').includes('UICN'), true);
});

test('computeAllRisks produces real scores for all 90 territories from NASA POWER and GBIF data', async () => {
  const [manifest, annual, ecological] = await Promise.all([
    readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/data/annual.json', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/data/ecological.json', import.meta.url), 'utf8').then(JSON.parse)
  ]);

  const summary = computeAllRisks({ sites: manifest.sites, annual, ecological });
  assert.equal(summary.byId.size, manifest.sites.length);
  assert.ok(summary.min >= 0 && summary.min <= summary.max && summary.max <= 100);

  for (const site of manifest.sites) {
    const res = summary.byId.get(site.id);
    assert.ok(Number.isFinite(res.score), `Expected finite score for ${site.id}`);
    assert.ok(Number.isFinite(res.bioRisk), `Expected real GBIF bioRisk for ${site.id}`);
    assert.ok(Number.isFinite(res.threatenedOccurrences));
  }

  const missing = computeSiteRisk({ site: { id: 'missing-site' }, annual, ecologicalSite: null });
  assert.equal(missing.score, null);
});
