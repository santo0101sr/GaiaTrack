import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeAllRisks,
  computeSiteRisk,
  driverLabel,
  riskColor,
  riskLevel,
  topRiskCantons
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

  const top5 = topRiskCantons(summary, manifest.sites, 5);
  assert.equal(top5.length, 5);
  assert.ok(top5.every(item => item.site.type === 'canton'));
  assert.ok(top5[0].risk.score >= top5[4].risk.score);

  const sj = manifest.sites.find(s => s.id === 'san-jose-centro');
  const baseSj = computeSiteRisk({ site: sj, annual, ecologicalSite: ecological.sites[sj.id] });
  const hotSj = computeSiteRisk({ site: sj, annual, ecologicalSite: ecological.sites[sj.id], liveTemp: 32 });
  assert.equal(hotSj.hasLive, true);
  assert.ok(hotSj.thermalRisk >= baseSj.thermalRisk);
});

test('Pressing Territorio 3D or the brand logo exits Ecological Risk mode and returns to 3D Territory', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalMatchMedia = globalThis.matchMedia;
  const originalFetch = globalThis.fetch;
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;
  const originalConsoleError = console.error;

  const elements = new Map();
  class ClassList {
    constructor() { this.set = new Set(); }
    add(...names) { names.forEach(n => this.set.add(n)); }
    remove(...names) { names.forEach(n => this.set.delete(n)); }
    toggle(name, force) {
      const on = force === undefined ? !this.set.has(name) : Boolean(force);
      if (on) this.set.add(name); else this.set.delete(name);
      return on;
    }
    contains(name) { return this.set.has(name); }
  }
  class Element extends EventTarget {
    constructor(tag = 'div') {
      super();
      this.tag = tag;
      this.id = '';
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.open = false;
      this.scrollTop = 0;
      this.style = {};
      this.attrs = {};
      this.children = [];
      this.classList = new ClassList();
    }
    set innerHTML(html) {
      this._innerHTML = html;
      for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
        const el = get('#' + id);
        if (id === 'hud-radar-legend' || id === 'close-lab') el.hidden = true;
        if (id === 'region-mode') {
          el.classList.add('chosen');
          el.setAttribute('aria-pressed', 'true');
        }
      }
    }
    get innerHTML() { return this._innerHTML || ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    click() {
      this.onclick?.();
      this.dispatchEvent(new Event('click', { cancelable: true }));
    }
    close() { this.open = false; }
    scrollIntoView() {}
    querySelector(sel) { return get(sel); }
    querySelectorAll() { return []; }
  }
  function get(sel) {
    if (!elements.has(sel)) elements.set(sel, new Element());
    return elements.get(sel);
  }

  const doc = new EventTarget();
  doc.hidden = false;
  doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  doc.querySelector = get;
  doc.querySelectorAll = () => [];

  const radarEvents = [];
  const viewEvents = [];
  doc.addEventListener('gaiatrack:radar-mode', e => radarEvents.push(Boolean(e.detail?.enabled)));
  doc.addEventListener('gaiatrack:view', e => viewEvents.push(e.detail?.view));

  const cleanBtn = get('#weather-clean-view');
  cleanBtn.onclick = () => doc.body.classList.toggle('clean-cockpit');

  globalThis.document = doc;
  globalThis.window = doc;
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  console.error = () => {};

  try {
    await import('../public/immersive.js?ecological-return-test=' + Date.now());
    await new Promise(resolve => setTimeout(resolve, 15));

    const regionBtn = get('#region-mode');
    const radarBtn = get('#radar-mode-3d');
    const legend = get('#hud-radar-legend');
    const brand = get('.brand');
    const labBtn = get('#lab-mode');
    const closeLabBtn = get('#close-lab');
    const methodDialog = get('#method-dialog');

    // 1. Activate Ecological Risk mode
    radarBtn.click();
    assert.equal(radarBtn.classList.contains('chosen'), true);
    assert.equal(radarBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(regionBtn.classList.contains('chosen'), false);
    assert.equal(regionBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(legend.hidden, false);
    assert.equal(radarEvents.at(-1), true);

    // 2. Click "Territorio 3D" -> must disable Ecological Risk and restore 3D Territory
    regionBtn.click();
    assert.equal(radarBtn.classList.contains('chosen'), false);
    assert.equal(radarBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(regionBtn.classList.contains('chosen'), true);
    assert.equal(regionBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(legend.hidden, true);
    assert.equal(radarEvents.at(-1), false);

    // 3. Re-enable Ecological Risk, open Lab + dialog + clean-cockpit, then click Logo (.brand)
    radarBtn.click();
    assert.equal(radarBtn.classList.contains('chosen'), true);
    assert.equal(legend.hidden, false);

    labBtn.click();
    assert.equal(doc.body.classList.contains('lab-open'), true);
    assert.equal(closeLabBtn.hidden, false);
    methodDialog.open = true;
    doc.body.classList.add('clean-cockpit');

    const brandClick = new Event('click', { cancelable: true });
    brand.dispatchEvent(brandClick);

    assert.equal(brandClick.defaultPrevented, true);
    assert.equal(methodDialog.open, false);
    assert.equal(doc.body.classList.contains('clean-cockpit'), false);
    assert.equal(doc.body.classList.contains('lab-open'), false);
    assert.equal(closeLabBtn.hidden, true);
    assert.equal(radarBtn.classList.contains('chosen'), false);
    assert.equal(radarBtn.getAttribute('aria-pressed'), 'false');
    assert.equal(regionBtn.classList.contains('chosen'), true);
    assert.equal(regionBtn.getAttribute('aria-pressed'), 'true');
    assert.equal(legend.hidden, true);
    assert.equal(radarEvents.at(-1), false);
    assert.equal(viewEvents.at(-1), '3d');
  } finally {
    console.error = originalConsoleError;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.matchMedia = originalMatchMedia;
    globalThis.fetch = originalFetch;
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  }
});
