import test from 'node:test';
import assert from 'node:assert/strict';

test('Pre-app landing portal renders paper authors, media assets, pitch slot, and enters/reopens 3D app', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const originalLocation = globalThis.location;

  const elements = new Map();
  const storage = new Map();
  const openedUrls = [];

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

  class MockElement extends EventTarget {
    constructor(tag = 'div') {
      super();
      this.tag = tag;
      this.id = '';
      this.value = '';
      this.textContent = '';
      this.hidden = false;
      this.open = false;
      this.scrollTop = 0;
      this.paused = false;
      this.attrs = {};
      this.children = [];
      this.classList = new ClassList();
    }
    set innerHTML(html) {
      this._innerHTML = html;
      for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
        const fresh = new MockElement();
        fresh.id = id;
        elements.set('#' + id, fresh);
      }
    }
    get innerHTML() { return this._innerHTML || ''; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    removeAttribute(k) { delete this.attrs[k]; }
    append(...nodes) {
      for (const n of nodes) {
        this.children.push(n);
        if (n?.id) elements.set('#' + n.id, n);
      }
    }
    prepend(...nodes) {
      for (const n of [...nodes].reverse()) {
        this.children.unshift(n);
        if (n?.id) elements.set('#' + n.id, n);
      }
    }
    pause() { this.paused = true; }
    showModal() { this.open = true; this.setAttribute('open', ''); }
    close() { this.open = false; this.removeAttribute('open'); }
    scrollTo() {}
    scrollIntoView() {}
    querySelector(sel) { return get(sel); }
    querySelectorAll(sel) {
      if (sel === '[data-launch]') return [];
      if (sel === '[data-lp-lang]') return [];
      if (sel === '.lp-chap') return [];
      return [];
    }
    click() {
      this.onclick?.();
      this.dispatchEvent(new Event('click', { cancelable: true }));
    }
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
  doc.querySelector = sel => get(sel);
  doc.querySelectorAll = () => [];

  globalThis.document = doc;
  globalThis.window = {
    open(url) { openedUrls.push(url); return {}; }
  };
  globalThis.localStorage = {
    getItem(k) { return storage.has(k) ? storage.get(k) : null; },
    setItem(k, v) { storage.set(k, String(v)); },
    removeItem(k) { storage.delete(k); }
  };
  globalThis.location = { href: 'http://127.0.0.1:4173/', search: '', hash: '' };

  let regionClicks = 0;
  get('#region-mode').addEventListener('click', () => { regionClicks++; });

  try {
    await import('../public/landing.js?landing-test=' + Date.now());

    const portal = get('#landing-portal');
    assert.equal(doc.body.classList.contains('landing-open'), true);
    assert.equal(portal.getAttribute('aria-hidden'), 'false');

    // Verify branding, media links, and all 6 authors from the research paper
    assert.match(portal.innerHTML, /assets\/gaia-eb-final\.png/);
    assert.match(portal.innerHTML, /assets\/gaia-eb-research-paper\.pdf/);
    assert.match(portal.innerHTML, /assets\/gaiatrack-demo\.mp4/);
    assert.match(portal.innerHTML, /landing-pitch-btn/);
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

    // Verify #open-landing-btn was added to .topbar nav
    assert.ok(get('.topbar nav').children.some(el => el.id === 'open-landing-btn'));

    // Opening pitch button when empty opens config dialog; unsafe URLs are rejected; valid https URL opens & saves
    get('#landing-pitch-btn').click();
    assert.equal(get('#landing-pitch-modal').open, true);

    get('#lp-pitch-url-input').value = 'javascript:alert(1)';
    get('#lp-pitch-save').click();
    assert.equal(openedUrls.length, 0);
    assert.equal(get('#landing-pitch-modal').open, true);

    get('#lp-pitch-url-input').value = 'https://www.youtube.com/watch?v=gaiatrack-pitch';
    get('#lp-pitch-save').click();
    assert.deepEqual(openedUrls, ['https://www.youtube.com/watch?v=gaiatrack-pitch']);
    assert.equal(get('#landing-pitch-modal').open, false);

    // Entering main app closes landing portal, pauses video, and invokes #region-mode while intro is active
    get('#landing-enter-app').click();
    assert.equal(doc.body.classList.contains('landing-open'), false);
    assert.equal(portal.getAttribute('aria-hidden'), 'true');
    assert.equal(get('#landing-demo-video').paused, true);
    assert.equal(regionClicks, 1);

    // Reopening from topbar restores landing view
    get('#open-landing-btn').click();
    assert.equal(doc.body.classList.contains('landing-open'), true);
    assert.equal(portal.getAttribute('aria-hidden'), 'false');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
    globalThis.location = originalLocation;
  }
});
