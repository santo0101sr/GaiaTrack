import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRecommendations, nearestSite, territoryProfile } from '../public/recommendations.js';

test('nearestSite finds closest Costa Rica province or canton from coordinates', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url)));
  const nearLiberia = nearestSite(10.63, -85.44, manifest.sites);
  assert.equal(nearLiberia.site.id, 'guanacaste');
  const nearSarapiqui = nearestSite(10.45, -84.01, manifest.sites);
  assert.equal(nearSarapiqui.site.id, 'sarapiqui');
  const nearSanJose = nearestSite(9.93, -84.08, manifest.sites);
  assert.ok(['santo-domingo', 'san-jose', 'san-pablo', 'heredia'].includes(nearSanJose.site.id));
});

test('buildRecommendations adapts advice to rural heavy rain, saturated soil, and dry heat', () => {
  const stormRural = buildRecommendations('sarapiqui', {
    precipitation: 2.5,
    intervalSeconds: 900,
    soilMoisture: 0.42,
    clouds: 95,
    solarRadiation: 120,
    temperature: 23
  });
  assert.equal(stormRural.profile.kind, 'rural-wet');
  assert.ok(stormRural.tips.some(t => t.tone === 'alert' && /cauces|ríos|truenos/i.test(t.body)));
  assert.ok(stormRural.tips.some(t => /suelo/i.test(t.tag)));

  const hotDry = buildRecommendations('guanacaste', {
    precipitation: 0,
    intervalSeconds: 3600,
    soilMoisture: 0.14,
    clouds: 15,
    solarRadiation: 780,
    temperature: 32
  });
  assert.equal(hotDry.profile.kind, 'dry-coast');
  assert.ok(hotDry.tips.some(t => /radiación|calor/i.test(t.tag)));
  assert.ok(hotDry.tips.some(t => /seco/i.test(t.tag)));

  const empty = buildRecommendations('barva', {});
  assert.equal(empty.profile.zone, territoryProfile('barva').zone);
  assert.ok(empty.tips.length >= 1);
});
