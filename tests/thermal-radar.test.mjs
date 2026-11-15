import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchLiveTemperatures,
  indexCurrentTemperatures,
  isTemperatureVariable,
  radarVariableFor,
  thermalColor,
  thermalRange
} from '../public/thermal-radar.js';

test('thermalColor maps minimum, midpoint, maximum, clamped, and missing temperatures', () => {
  const cold = thermalColor(14, 14, 30);
  assert.equal(cold.css, 'rgb(43,108,176)');
  assert.equal(cold.hex, 0x2b6cb0);

  const mid = thermalColor(22, 14, 30);
  assert.equal(mid.css, 'rgb(132,204,22)');
  assert.equal(mid.hex, 0x84cc16);

  const hot = thermalColor(30, 14, 30);
  assert.equal(hot.css, 'rgb(239,68,68)');
  assert.equal(hot.hex, 0xef4444);

  assert.equal(thermalColor(5, 14, 30).css, cold.css);
  assert.equal(thermalColor(42, 14, 30).css, hot.css);
  assert.equal(thermalColor(Number.NaN, 14, 30).css, '#7c8791');
  assert.equal(thermalColor(null, 14, 30).hex, 0x7c8791);
});

test('thermalRange computes min/max and protects against empty or flat series', () => {
  assert.deepEqual(thermalRange([16.2, 28.4, Number.NaN, 21.0]), { min: 16.2, max: 28.4 });
  assert.deepEqual(thermalRange([]), { min: 14, max: 30 });
  assert.deepEqual(thermalRange([24, 24]), { min: 23.5, max: 24.5 });
});

test('isTemperatureVariable and radarVariableFor select temperature variables cleanly', () => {
  assert.equal(isTemperatureVariable('T2M'), true);
  assert.equal(isTemperatureVariable('T2M_MIN'), true);
  assert.equal(isTemperatureVariable('T2M_MAX'), true);
  assert.equal(isTemperatureVariable('PRECTOTCORR'), false);

  assert.equal(radarVariableFor('T2M_MAX'), 'T2M_MAX');
  assert.equal(radarVariableFor('PRECTOTCORR'), 'T2M');
  assert.equal(radarVariableFor('GWETTOP'), 'T2M');
});

test('indexCurrentTemperatures and fetchLiveTemperatures extract and cache live canton temperatures', async () => {
  const parsed = indexCurrentTemperatures({
    retrievedAt: '2026-11-14T18:00:00.000Z',
    sites: [
      { site: 'san-jose', temperature: 21.8 },
      { site: 'liberia', temperature: 30.2 },
      { site: 'dota', temperature: null }
    ]
  });
  assert.equal(parsed.retrievedAt, '2026-11-14T18:00:00.000Z');
  assert.equal(parsed.temps.get('san-jose'), 21.8);
  assert.equal(parsed.temps.get('liberia'), 30.2);
  assert.equal(parsed.temps.has('dota'), false);

  let calls = 0;
  const mockFetch = async url => {
    calls += 1;
    assert.equal(url, '/api/current?site=all');
    return {
      ok: true,
      json: async () => ({
        retrievedAt: '2026-11-14T18:05:00.000Z',
        sites: [{ site: 'heredia', temperature: 20.5 }]
      })
    };
  };

  const first = await fetchLiveTemperatures({ force: true, fetchImpl: mockFetch });
  const second = await fetchLiveTemperatures({ fetchImpl: mockFetch });
  assert.equal(calls, 1);
  assert.equal(first.temps.get('heredia'), 20.5);
  assert.equal(second.temps.get('heredia'), 20.5);
});
