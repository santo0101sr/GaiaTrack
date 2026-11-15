import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('forecast.js detects province and canton transitions, refreshes explicitly, and resets at national scope', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;
  const originalLocation = globalThis.location;
  const originalSetInterval = globalThis.setInterval;
  const originalInnerWidth = globalThis.innerWidth;

  const elements = new Map();
  class MockElement extends EventTarget {
    constructor(id = '') {
      super();
      this.id = id;
      this.innerHTML = '';
      this.textContent = '';
      this.hidden = false;
      this.disabled = false;
      this.onclick = null;
      this.classList = { toggle() {}, add() {}, remove() {}, contains: () => false };
      this.attrs = {};
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    querySelectorAll() { return []; }
    appendChild(n) { return n; }
    append() {}
    remove() {}
    click() {
      this.onclick?.();
      this.dispatchEvent(new Event('click'));
    }
  }

  function getEl(sel) {
    if (!elements.has(sel)) elements.set(sel, new MockElement(sel.replace(/^#/, '')));
    return elements.get(sel);
  }

  const doc = new EventTarget();
  doc.hidden = false;
  doc.body = new MockElement('body');
  doc.documentElement = new MockElement('html');
  doc.createElement = tag => new MockElement(tag);
  doc.querySelector = sel => getEl(sel);
  doc.querySelectorAll = () => [];

  const storage = new Map([['gaiatrack_lang', 'en']]);
  globalThis.document = doc;
  globalThis.window = Object.assign(new EventTarget(), {
    innerWidth: 1280,
    location: { href: 'http://127.0.0.1:4173/', search: '' }
  });
  globalThis.innerWidth = 1280;
  globalThis.location = globalThis.window.location;
  globalThis.setInterval = (fn, ms) => {
    const id = originalSetInterval(fn, ms);
    id?.unref?.();
    return id;
  };
  globalThis.localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); }
  };

  const { forecastDates } = await import('../public/forecast-science.js');
  const dates = forecastDates();
  const requestedUrls = [];

  globalThis.fetch = async url => {
    const u = String(url);
    requestedUrls.push(u);
    const siteId = new URL(u, 'http://127.0.0.1:4173').searchParams.get('site') || 'unknown';
    const siteName = siteId === 'guanacaste' ? 'Guanacaste' : siteId === 'liberia' ? 'Liberia' : siteId;
    return new Response(JSON.stringify({
      site: siteId,
      name: siteName,
      requested: { latitude: 10.63, longitude: -85.44 },
      modelPoint: { latitude: 10.65, longitude: -85.47, elevation: 98 },
      retrievedAt: new Date().toISOString(),
      source: 'Open-Meteo Forecast API',
      sourceUrl: 'https://api.open-meteo.com/v1/forecast',
      ensembleSource: 'GFS ensemble',
      ensembleUrl: 'https://ensemble-api.open-meteo.com/v1/ensemble',
      timezone: 'America/Costa_Rica',
      days: dates.map((date, idx) => ({
        date,
        T2M: 27 + idx * 0.2,
        T2M_MIN: 22.5,
        T2M_MAX: 32.1,
        PRECTOTCORR: idx === 2 ? 4.5 : 0.4,
        ALLSKY_SFC_SW_DWN: 19.8,
        RH2M: 76,
        GWETTOP: 0.24,
        rainProbability: 30,
        ensemble: { n: 31, p10: 26.2, p50: 27.1, p90: 28.0 }
      })),
      warning: null,
      cache: false
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const { initForecast, updateForecast } = await import('../public/forecast.js?sync-test=' + Date.now());
    initForecast();

    // National overview (no province/canton selected)
    await updateForecast(null, 'T2M');
    assert.match(getEl('#forecast-location').textContent, /Costa Rica/);
    assert.match(getEl('#forecast-status').textContent, /Choose a province or canton/i);
    assert.equal(getEl('#forecast-refresh').disabled, true);
    assert.equal(getEl('#forecast-download').disabled, true);
    assert.equal(requestedUrls.length, 0);

    // Selecting province Guanacaste loads /api/forecast?site=guanacaste and renders 7 cards
    await updateForecast({ id: 'guanacaste', name: 'Guanacaste', type: 'province' }, 'T2M');
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /site=guanacaste/);
    assert.equal(getEl('#forecast-status').textContent, '');
    assert.equal(getEl('#forecast-location').textContent, 'Guanacaste · reference point');
    assert.equal((getEl('#forecast-days').innerHTML.match(/forecast-day-row/g) || []).length, 7);
    assert.match(getEl('#forecast-days').innerHTML, /<svg id="forecast-chart"/);
    assert.equal(getEl('#forecast-download').disabled, false);

    // Switching to canton Liberia updates location and fetches site=liberia
    await updateForecast({ id: 'liberia', name: 'Liberia', type: 'canton' }, 'T2M');
    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[1], /site=liberia/);
    assert.equal(getEl('#forecast-location').textContent, 'Liberia · reference point');
    assert.equal((getEl('#forecast-days').innerHTML.match(/forecast-day-row/g) || []).length, 7);

    // Cached repeat without refresh=true reuses memory cache; explicit refresh bypasses cache
    await updateForecast({ id: 'liberia', name: 'Liberia', type: 'canton' }, 'T2M');
    assert.equal(requestedUrls.length, 2);
    getEl('#forecast-refresh').click();
    await new Promise(r => setTimeout(r, 15));
    assert.equal(requestedUrls.length, 3);
    assert.match(requestedUrls[2], /site=liberia/);

    // Returning to Costa Rica national scope resets status & clears cards
    await updateForecast(null, 'T2M');
    assert.match(getEl('#forecast-location').textContent, /Costa Rica/);
    assert.equal(getEl('#forecast-days').innerHTML, '');
    assert.equal(getEl('#forecast-refresh').disabled, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
    globalThis.location = originalLocation;
    globalThis.setInterval = originalSetInterval;
    globalThis.innerWidth = originalInnerWidth;
  }
});

test('Selection & early-enter regressions stay resolved across app.js, immersive.js, province-explorer.js, and landing.js', async () => {
  const [appJs, immersiveJs, explorerJs, landingJs] = await Promise.all([
    fs.readFile(path.resolve('public/app.js'), 'utf8'),
    fs.readFile(path.resolve('public/immersive.js'), 'utf8'),
    fs.readFile(path.resolve('public/province-explorer.js'), 'utf8'),
    fs.readFile(path.resolve('public/landing.js'), 'utf8')
  ]);

  // app.js renderStats must use rawVariables/annualPoints/trend — never undefined VARIABLES/s.series/YEARS/mannKendall
  assert.doesNotMatch(appJs, /\bVARIABLES\b|\bs\.series\b|\bYEARS\b|\bmannKendall\b/);
  assert.match(appJs, /rawVariables\.map\(vr\s*=>/);
  assert.match(appJs, /#sim-projection-strip['"`]?\);[\s\S]{0,80}\.innerHTML\s*=\s*''/);
  assert.match(appJs, /pendingSiteId/);

  // immersive.js must dispatch gaiatrack:select-site instead of forcing #site-select across province mismatch
  assert.doesNotMatch(immersiveJs, /\$\('#site-select'\)\.value\s*=/);
  assert.match(immersiveJs, /gaiatrack:select-site/);
  assert.match(immersiveJs, /data-landing-entered/);
  assert.match(immersiveJs, /sync\(\{site:selection,variable,year\}\)/);

  // landing.js must record data-landing-entered for slow/async 3D startup races
  assert.match(landingJs, /data-landing-entered/);

  // province-explorer.js must resolve province.siteId when drilling down into provinces
  assert.match(explorerJs, /manifest\.provinces\.find\(p=>p\.id===id\)\?\.siteId\?\?id/);
});
