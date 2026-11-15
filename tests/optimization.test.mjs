import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';
import { douglasPeucker, simplifyRing } from '../scripts/simplify-borders.mjs';
import { createTerritoryPicker } from '../public/territory-picker.js';
import { createQualityManager, detectHardwareTier } from '../public/quality-manager.js';
import { createRenderLoop } from '../public/render-loop.js';
import { createProvinceExplorer } from '../public/province-explorer.js';

test('Douglas-Peucker simplification reduces ADM2 vertices while keeping valid closed polygons', async () => {
  const line = [[0, 0], [0.5, 0.001], [1, 0], [1, 1], [0, 1], [0, 0]];
  const dp = douglasPeucker(line.slice(0, -1), 0.01);
  assert.ok(dp.length < line.length);

  const ring = simplifyRing(line, 0.01);
  assert.ok(ring.length >= 4);
  assert.deepEqual(ring[0], ring[ring.length - 1]);

  const [full, overview] = await Promise.all([
    readFile(new URL('../public/data/cantons.geojson', import.meta.url), 'utf8').then(JSON.parse),
    readFile(new URL('../public/data/cantons-overview.geojson', import.meta.url), 'utf8').then(JSON.parse)
  ]);
  assert.equal(overview.features.length, full.features.length);
  const countPts = gj => gj.features.reduce((s, f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return s + polys.reduce((ps, rings) => ps + rings.reduce((rs, r) => rs + r.length, 0), 0);
  }, 0);
  assert.ok(countPts(overview) < countPts(full) * 0.3);
});

test('createTerritoryPicker uses bbox + point-in-polygon selection across national and province scope', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8'));
  const geo = JSON.parse(await readFile(new URL('../public/data/cantons-overview.geojson', import.meta.url), 'utf8'));
  const coords = (lon, lat) => new THREE.Vector3((lon + 84.2) * 4.4, 0, -(lat - 9.75) * 4.4);
  const picker = createTerritoryPicker(geo, coords);
  assert.equal(picker.count, 83);

  const sj = manifest.sites.find(s => s.type === 'canton' && s.province === 'san-jose');
  const pt = coords(sj.longitude, sj.latitude);
  const hitNat = picker.pickAt(pt.x, pt.z, null);
  assert.equal(hitNat?.province, 'san-jose');
  assert.equal(picker.pickAt(pt.x, pt.z, 'guanacaste'), null);
  assert.equal(picker.pickAt(999, 999, null), null);
});

test('Quality manager detects low/mid/high tiers and steps down when sustained frame time exceeds 33 ms', () => {
  assert.equal(detectHardwareTier({ deviceMemory: 2, hardwareConcurrency: 4, prefersReducedMotion: false }), 'low');
  assert.equal(detectHardwareTier({ deviceMemory: 8, hardwareConcurrency: 8, prefersReducedMotion: true }), 'low');
  assert.equal(detectHardwareTier({ deviceMemory: 4, hardwareConcurrency: 8, prefersReducedMotion: false }), 'mid');
  assert.equal(detectHardwareTier({ deviceMemory: 8, hardwareConcurrency: 8, prefersReducedMotion: false }), 'high');

  const changes = [];
  const qm = createQualityManager({
    initialMode: 'auto',
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, prefersReducedMotion: false },
    windowSize: 6,
    minSlowCount: 5,
    cooldownFrames: 2,
    onChange: ev => changes.push(ev)
  });
  assert.equal(qm.active, 'high');
  for (let i = 0; i < 6; i++) qm.recordFrameTime(40);
  assert.equal(qm.active, 'mid');
  for (let i = 0; i < 2; i++) qm.recordFrameTime(40); // cooldown
  for (let i = 0; i < 6; i++) qm.recordFrameTime(38);
  assert.equal(qm.active, 'low');
  assert.equal(changes.length, 2);
});

test('Render loop pauses when idle/landing-open and wakes cleanly on invalidate', () => {
  let scheduled = null;
  let frames = 0;
  let active = true;
  let dirty = true;
  const loop = createRenderLoop(
    () => { frames++; dirty = false; },
    {
      isActive: () => active,
      shouldContinue: () => dirty,
      request: cb => { scheduled = cb; return 1; },
      cancel: () => { scheduled = null; }
    }
  );
  loop.sync();
  assert.ok(scheduled);
  const runTick = scheduled;
  scheduled = null;
  runTick(16);
  assert.equal(frames, 1);
  assert.equal(scheduled, null); // Stopped automatically after rendering single dirty frame!

  dirty = true;
  loop.invalidate();
  assert.ok(scheduled);
  active = false;
  loop.sync();
  assert.equal(scheduled, null);
});

test('Province explorer updates at most 7 national labels with translate3d and only when camera moves', async () => {
  const originalDocument = globalThis.document;
  const originalInnerWidth = globalThis.innerWidth;
  const originalInnerHeight = globalThis.innerHeight;
  class El {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.attrs = {};
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.scrollTop = 0;
      this.transformCount = 0;
      const self = this;
      this.style = {
        set transform(v) { self._transform = v; self.transformCount++; },
        get transform() { return self._transform || ''; }
      };
      this.classList = { set: new Set(), add(...n) { n.forEach(x => this.set.add(x)); }, remove(...n) { n.forEach(x => this.set.delete(x)); }, toggle() {}, contains() { return false; } };
    }
    addEventListener() {}
    setAttribute(k, v) { this.attrs[k] = String(v); }
    append(...n) { this.children.push(...n); }
    prepend(n) { this.children.unshift(n); }
    replaceChildren(...n) { this.children = [...n]; }
    getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; }
    querySelector(sel) { this._q ??= new Map(); if (!this._q.has(sel)) this._q.set(sel, new El()); return this._q.get(sel); }
  }
  const doc = new EventTarget();
  doc.body = new El('body');
  doc.createElement = tag => new El(tag);
  globalThis.document = doc;
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 720;

  try {
    const manifest = JSON.parse(await readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8'));
    const geo = JSON.parse(await readFile(new URL('../public/data/cantons-overview.geojson', import.meta.url), 'utf8'));
    const camera = new THREE.PerspectiveCamera(42, 1280 / 720, 0.1, 200);
    camera.position.set(0, 10, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const host = new El('section');
    const root = new THREE.Group();
    const explorer = createProvinceExplorer({
      host,
      manifest,
      geo,
      meshes: [],
      beacons: [],
      borders: [],
      root,
      camera,
      coords: (lon, lat) => new THREE.Vector3((lon + 84.2) * 4.4, 0, -(lat - 9.75) * 4.4),
      onSelect() {},
      onFocus() {}
    });

    const labelLayer = host.children.find(c => c.className === 'territory-map-labels');
    assert.equal(labelLayer.children.length, 7);

    explorer.updateLabels();
    const visibleLabels = labelLayer.children.filter(c => !c.hidden);
    assert.ok(visibleLabels.length > 0);
    assert.match(visibleLabels[0].style.transform, /^translate3d\(/);
    const writesAfterFirst = visibleLabels.reduce((s, c) => s + c.transformCount, 0);

    // Second call without camera movement performs zero transform DOM writes
    explorer.updateLabels();
    const writesAfterIdle = visibleLabels.reduce((s, c) => s + c.transformCount, 0);
    assert.equal(writesAfterIdle, writesAfterFirst);
  } finally {
    globalThis.document = originalDocument;
    globalThis.innerWidth = originalInnerWidth;
    globalThis.innerHeight = originalInnerHeight;
  }
});
