import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';
import { createProvinceExplorer } from '../public/province-explorer.js';

function explorerDom() {
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
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.hidden = false;
      this.scrollTop = 0;
      this.children = [];
      this.attrs = {};
      this.className = '';
      this.classList = new ClassList();
    }
    addEventListener() {}
    setAttribute(k, v) { this.attrs[k] = String(v); }
    append(...nodes) { this.children.push(...nodes); }
    prepend(...nodes) { this.children.unshift(...nodes); }
    replaceChildren(...nodes) { this.children = [...nodes]; }
    getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 }; }
    querySelector(sel) {
      if (!elements.has(sel)) elements.set(sel, new Element());
      return elements.get(sel);
    }
  }
  const doc = new EventTarget();
  doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  return { doc, host: new Element('section'), elements };
}

test('Province explorer starts on Choose a province showing all seven provinces across Costa Rica', async () => {
  const originalDocument = globalThis.document;
  const { doc, host, elements } = explorerDom();
  globalThis.document = doc;
  const events = [];
  doc.addEventListener('gaiatrack:territory-view', e => events.push(e.detail.province));

  try {
    const [manifest, geo] = await Promise.all([
      readFile(new URL('../public/data/manifest.json', import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL('../public/data/cantons.geojson', import.meta.url), 'utf8').then(JSON.parse)
    ]);
    const meshes = manifest.sites.filter(s => s.type === 'canton').map(s => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshStandardMaterial());
      mesh.userData = { id: s.id, province: s.province, targetY: 0 };
      return mesh;
    });
    const borders = manifest.provinces.map(p => {
      const line = new THREE.Line();
      line.userData = { province: p.id };
      return line;
    });
    const beacons = manifest.sites.map(s => ({
      id: s.id,
      province: s.province,
      beacon: new THREE.Mesh(),
      ring: new THREE.Mesh(),
      pulse: new THREE.Mesh()
    }));
    const selectedCalls = [];
    const focusCalls = [];

    const explorer = createProvinceExplorer({
      host,
      manifest,
      geo,
      meshes,
      beacons,
      borders,
      root: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      coords: (lon, lat) => new THREE.Vector3(lon, 0, lat),
      onSelect: id => selectedCalls.push(id),
      onFocus: bounds => focusCalls.push(bounds)
    });

    assert.equal(doc.body.classList.contains('national-view'), true);
    assert.equal(events.at(-1), null);
    assert.equal(focusCalls.at(-1), null);
    assert.equal(elements.get('#hud-province-select').value, '');
    assert.equal(elements.get('#hud-site-select').hidden, true);
    assert.equal(elements.get('.flight-intro h1').textContent, 'Costa Rica');
    assert.ok(meshes.every(m => m.visible === true));
    assert.ok(borders.every(b => b.visible === true));
    const provinceBeacons = beacons.filter(b => manifest.sites.find(s => s.id === b.id)?.type === 'province');
    const cantonBeacons = beacons.filter(b => manifest.sites.find(s => s.id === b.id)?.type === 'canton');
    assert.ok(provinceBeacons.every(b => b.beacon.visible === true));
    assert.ok(cantonBeacons.every(b => b.beacon.visible === false));

    // Selecting a province focuses only that province; returning to country restores all of Costa Rica.
    explorer.sync('guanacaste');
    assert.equal(doc.body.classList.contains('national-view'), false);
    assert.equal(events.at(-1), 'guanacaste');
    assert.notEqual(focusCalls.at(-1), null);
    assert.equal(elements.get('#hud-province-select').value, 'guanacaste');
    assert.equal(elements.get('#hud-site-select').hidden, false);
    assert.ok(meshes.filter(m => m.userData.province === 'guanacaste').every(m => m.visible === true));
    assert.ok(meshes.filter(m => m.userData.province !== 'guanacaste').every(m => m.visible === false));

    explorer.country(true);
    assert.equal(doc.body.classList.contains('national-view'), true);
    assert.equal(events.at(-1), null);
    assert.equal(focusCalls.at(-1), null);
    assert.equal(selectedCalls.at(-1), null);
    assert.ok(meshes.every(m => m.visible === true));
  } finally {
    globalThis.document = originalDocument;
  }
});
