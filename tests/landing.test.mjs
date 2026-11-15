import test from 'node:test';
import assert from 'node:assert/strict';

test('Unified single giant slide renders centered logo, Trend Detective quantified benefits, video without chapters, NASA challenge banner, hidden pitch slot, and one-way 3D entry', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalLocation = globalThis.location;

  const elements = new Map();
  const collections = new Map();
  const storage = new Map();

  class ClassList {
    constructor(initial = []) { this.set = new Set(initial); }
    add(...names) { names.forEach(n => this.set.add(n)); }
    remove(...names) { names.forEach(n => this.set.delete(n)); }
    toggle(name, force) {
      const on = force === undefined ? !this.set.has(name) : Boolean(force);
      if (on) this.set.add(name); else this.set.delete(name);
      return on;
    }
    contains(name) { return this.set.has(name); }
  }

  class MockElement extends EventTarget {
    constructor(tag = 'div', attrs = {}, classNames = []) {
      super();
      this.tag = tag;
      this.id = attrs.id || '';
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.scrollTop = 0;
      this.paused = false;
      this.attrs = { ...attrs };
      this.children = [];
      this.classList = new ClassList(classNames);
    }
    set innerHTML(html) {
      this._innerHTML = html;
      collections.clear();
      collections.set('.lp-giant-slide', []);
      collections.set('[data-enter-app]', []);
      collections.set('[data-lp-lang]', []);

      for (const match of html.matchAll(/<([a-z0-9-]+)\s+([^>]*?)>/gi)) {
        const [, tag, attrStr] = match;
        const attrs = {};
        for (const [, k, v] of attrStr.matchAll(/([a-z0-9-]+)(?:="([^"]*)")?/gi)) {
          attrs[k] = v ?? '';
        }
        const classNames = (attrs.class || '').split(/\s+/).filter(Boolean);
        const el = new MockElement(tag, attrs, classNames);
        if (attrs.id) elements.set('#' + attrs.id, el);
        if (classNames.includes('lp-giant-slide')) collections.get('.lp-giant-slide').push(el);
        if ('data-enter-app' in attrs) collections.get('[data-enter-app]').push(el);
        if ('data-lp-lang' in attrs) collections.get('[data-lp-lang]').push(el);
      }
    }
    get innerHTML() { return this._innerHTML || ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    pause() { this.paused = true; }
    append(...nodes) {
      for (const n of nodes) {
        this.children.push(n);
        if (n?.id) elements.set('#' + n.id, n);
      }
    }
    querySelector(sel) { return collections.get(sel)?.[0] || elements.get(sel) || null; }
    querySelectorAll(sel) { return collections.get(sel) || []; }
    click() { this.dispatchEvent(new Event('click', { cancelable: true })); }
  }

  function get(sel) {
    if (!elements.has(sel)) elements.set(sel, new MockElement());
    return elements.get(sel);
  }

  const doc = new EventTarget();
  doc.body = new MockElement('body');
  doc.body.classList.add('intro-playing');
  doc.documentElement = new MockElement('html');
  doc.createElement = tag => new MockElement(tag);
  doc.getElementById = id => elements.get('#' + id) || null;
  doc.querySelector = sel => elements.get(sel) || null;
  doc.querySelectorAll = () => [];

  let resizeEvents = 0;
  globalThis.document = doc;
  globalThis.window = {
    dispatchEvent(evt) { if (evt?.type === 'resize') resizeEvents++; }
  };
  globalThis.localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); }
  };
  globalThis.location = { href: 'http://127.0.0.1:4173/', search: '', hash: '' };

  let regionClicks = 0;
  get('#region-mode').addEventListener('click', () => { regionClicks++; });

  try {
    const landingMod = await import('../public/landing.js?landing-test=' + Date.now());
    const portal = get('#landing-portal');

    assert.equal(doc.body.classList.contains('landing-open'), true);
    assert.equal(portal.getAttribute('aria-hidden'), 'false');

    // Unified single giant slide without bottom section bar or video chapter buttons
    assert.equal(portal.querySelectorAll('.lp-giant-slide').length, 1);
    assert.doesNotMatch(portal.innerHTML, /class="lp-nav"|lp-slider-bar|lp-chapters|lp-chap|data-slide=|lp-prev|lp-next|data-go-next/);

    // Dormant pitch link stays configured in code (empty) and completely hidden from DOM
    assert.equal(landingMod.PITCH_VIDEO_URL, '');
    assert.equal(landingMod.getPitchUrl(), '');
    assert.doesNotMatch(portal.innerHTML, /landing-pitch-btn|landing-pitch-modal|lp-pitch-status/);
    assert.equal(doc.getElementById('landing-pitch-modal'), null);
    assert.equal(doc.getElementById('open-landing-btn'), null);

    // Verify centered brand logo, PDF, demo video, Trend Detective + quantified SbN metrics, 6 authors, and NASA Space Apps banner
    assert.match(portal.innerHTML, /assets\/gaia-eb-final\.png/);
    assert.match(portal.innerHTML, /assets\/gaia-eb-research-paper\.pdf/);
    assert.match(portal.innerHTML, /assets\/gaiatrack-demo\.mp4/);
    for (const token of [
      '2001–2025',
      '84',
      '95%',
      '89%',
      '−44.8%',
      '−32.6%',
      '17.5M',
      'NASA Space Apps Challenge',
      'Earth System Trend Detective'
    ]) {
      assert.ok(portal.innerHTML.includes(token), `Missing quantified metric/challenge token: ${token}`);
    }
    for (const author of [
      'Francinny Saldaña Abarca',
      'Darren Araya Monge',
      'Santiago Ramirez Víquez',
      'Camila Garay Jiménez',
      'Derling Torres Campos',
      'Kendall Rojas Cartín'
    ]) {
      assert.ok(portal.innerHTML.includes(author), `Missing author ${author}`);
    }

    // Entering main app is one-way: closes portal, pauses demo video, resizes, clears intro, and refuses reopening
    get('#landing-enter-app').click();
    assert.equal(doc.body.classList.contains('landing-open'), false);
    assert.equal(portal.hidden, true);
    assert.equal(portal.getAttribute('aria-hidden'), 'true');
    assert.equal(get('#landing-demo-video').paused, true);
    assert.equal(regionClicks, 1);
    assert.ok(resizeEvents >= 1);
    assert.equal(get('.topbar nav').children.some(el => el.id === 'open-landing-btn'), false);

    landingMod.openLanding();
    assert.equal(doc.body.classList.contains('landing-open'), false);
    assert.equal(portal.hidden, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.location = originalLocation;
  }
});
