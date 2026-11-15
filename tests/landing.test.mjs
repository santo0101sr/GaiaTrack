import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('Unified slide renders creators carousel with dormant photo support, outside NASA footnote, Light/Dark theme toggle, and one-way 3D entry', async () => {
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
      this.hidden = 'hidden' in attrs;
      this.scrollTop = 0;
      this.paused = false;
      this.currentTime = 0;
      this.attrs = { ...attrs };
      this.children = [];
      this.classList = new ClassList(classNames);
      const cssProps = new Map();
      this.style = {
        setProperty(k, v) { cssProps.set(k, String(v)); },
        getPropertyValue(k) { return cssProps.get(k) || ''; }
      };
    }
    set innerHTML(html) {
      this._innerHTML = html;
      if (this.id !== 'landing-portal') return;
      collections.clear();
      collections.set('.lp-giant-slide', []);
      collections.set('[data-enter-app]', []);
      collections.set('[data-lp-lang]', []);
      collections.set('[data-lp-theme]', []);
      collections.set('[data-theme-toggle]', []);
      collections.set('[data-author-dot]', []);
      collections.set('.lp-authors-track', []);

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
        if (classNames.includes('lp-authors-track')) collections.get('.lp-authors-track').push(el);
        if ('data-enter-app' in attrs) collections.get('[data-enter-app]').push(el);
        if ('data-lp-lang' in attrs) collections.get('[data-lp-lang]').push(el);
        if ('data-lp-theme' in attrs) collections.get('[data-lp-theme]').push(el);
        if ('data-theme-toggle' in attrs) collections.get('[data-theme-toggle]').push(el);
        if ('data-author-dot' in attrs) collections.get('[data-author-dot]').push(el);
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
  doc.querySelector = sel => collections.get(sel)?.[0] || elements.get(sel) || null;
  doc.querySelectorAll = sel => collections.get(sel) || [];

  let resizeEvents = 0;
  globalThis.document = doc;
  globalThis.window = {
    innerWidth: 1280,
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
    const i18nMod = await import('../public/i18n.js?i18n-test=' + Date.now());
    const landingMod = await import('../public/landing.js?landing-test=' + Date.now());
    const portal = get('#landing-portal');

    assert.equal(doc.body.classList.contains('landing-open'), true);
    assert.equal(portal.getAttribute('aria-hidden'), 'false');

    // Unified single giant slide without bottom section bar, video chapters, or inside NASA box
    assert.equal(portal.querySelectorAll('.lp-giant-slide').length, 1);
    assert.doesNotMatch(portal.innerHTML, /class="lp-nav"|lp-slider-bar|lp-chapters|lp-chap|data-slide=|lp-prev|lp-next|data-go-next|lp-nasa-banner/);

    // Simplified gray NASA footnote strictly outside .lp-giant-slide with zero emojis
    const fnMatch = portal.innerHTML.match(/<p class="lp-nasa-footnote">([^<]+)<\/p>/);
    assert.ok(fnMatch, 'Expected .lp-nasa-footnote outside the box');
    assert.equal(fnMatch[1].trim(), '2026 NASA Space Apps Challenge · Earth System Trend Detective');
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(fnMatch[1]), false);
    assert.ok(portal.innerHTML.lastIndexOf('</div>') < portal.innerHTML.indexOf('lp-nasa-footnote'));

    // Dormant pitch link stays configured in code (empty) and completely hidden from DOM
    assert.equal(landingMod.PITCH_VIDEO_URL, '');
    assert.equal(landingMod.getPitchUrl(), '');
    assert.doesNotMatch(portal.innerHTML, /landing-pitch-btn|landing-pitch-modal|lp-pitch-status/);
    assert.equal(doc.getElementById('landing-pitch-modal'), null);
    assert.equal(doc.getElementById('open-landing-btn'), null);

    // Creators carousel & dormant photo option in code without upload UI
    assert.equal(landingMod.AUTHORS.length, 6);
    for (const a of landingMod.AUTHORS) {
      assert.equal(a.photo, '');
      assert.ok(portal.innerHTML.includes(a.name), `Missing author ${a.name}`);
      assert.ok(portal.innerHTML.includes(`>${a.initials}<`), `Missing initials ${a.initials}`);
    }
    assert.equal(
      landingMod.renderAuthorAvatar({ name: 'Test User', initials: 'TU', photo: '' }),
      '<div class="lp-avatar" aria-hidden="true">TU</div>'
    );
    assert.equal(
      landingMod.renderAuthorAvatar({ name: 'Test User', initials: 'TU', photo: 'assets/creators/tu.jpg' }),
      '<div class="lp-avatar has-photo"><img src="http://127.0.0.1:4173/assets/creators/tu.jpg" alt="Test User" loading="lazy"></div>'
    );
    assert.equal(
      landingMod.renderAuthorAvatar({ name: 'Test User', initials: 'TU', photo: 'javascript:alert(1)' }),
      '<div class="lp-avatar" aria-hidden="true">TU</div>'
    );
    assert.doesNotMatch(portal.innerHTML, /type="file"|upload-photo|edit-photo/i);
    assert.match(portal.innerHTML, /lp-authors-carousel/);

    // Step carousel forward and backward
    const track = portal.querySelector('.lp-authors-track');
    assert.equal(track.getAttribute('data-author-index'), '0');
    get('#lp-authors-next').click();
    assert.equal(track.getAttribute('data-author-index'), '1');
    get('#lp-authors-prev').click();
    assert.equal(track.getAttribute('data-author-index'), '0');

    // Logo-based Light/Dark mode toggle across landing and shared i18n state
    assert.equal(i18nMod.getTheme(), 'dark');
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(doc.body.classList.contains('light-mode'), false);
    get('#lp-theme-toggle').click();
    assert.equal(i18nMod.getTheme(), 'light');
    assert.equal(doc.documentElement.getAttribute('data-theme'), 'light');
    assert.equal(doc.body.classList.contains('light-mode'), true);
    assert.equal(storage.get('gaiatrack_theme'), 'light');
    get('#lp-theme-toggle').click();
    assert.equal(i18nMod.getTheme(), 'dark');
    assert.equal(doc.body.classList.contains('light-mode'), false);

    // Main app static HTML also exposes topbar theme toggle with SVG icon (no emoji) and cropped official logo favicon
    const indexHtml = await fs.readFile(path.resolve('public/index.html'), 'utf8');
    const mapHtml = await fs.readFile(path.resolve('public/map.html'), 'utf8');
    const creditsHtml = await fs.readFile(path.resolve('public/credits.html'), 'utf8');
    assert.match(mapHtml, /id="topbar-theme-toggle"[^>]*data-theme-toggle/);
    assert.match(mapHtml, /<button[^>]*id="topbar-theme-toggle"[^>]*><svg class="theme-icon"/);
    assert.doesNotMatch(mapHtml, /☀️|🌙/);
    assert.doesNotMatch(get('#lp-theme-toggle').innerHTML, /☀️|🌙/);
    assert.match(get('#lp-theme-toggle').innerHTML, /<svg class="theme-icon"/);

    for (const [name, html] of [['index.html', indexHtml], ['map.html', mapHtml], ['credits.html', creditsHtml]]) {
      assert.match(html, /<link rel="icon"[^>]*href="assets\/gaia-favicon\.png"/, `Expected cropped favicon in ${name}`);
      assert.doesNotMatch(html, /data:image\/svg\+xml/, `Found AI SVG data-URI favicon in ${name}`);
    }
    const faviconBytes = await fs.readFile(path.resolve('public/assets/gaia-favicon.png'));
    assert.equal(faviconBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');

    // Verify centered brand logo, PDF, pitch & demo videos, and quantified Trend Detective metrics
    assert.match(portal.innerHTML, /assets\/gaia-eb-final\.png/);
    assert.match(portal.innerHTML, /assets\/gaia-eb-research-paper\.pdf/);
    assert.match(portal.innerHTML, /id="landing-pitch-video"\s+src="assets\/gaiatrack-pitch\.mp4[^"]*"/);
    assert.doesNotMatch(portal.innerHTML, /id="landing-pitch-video"[^>]*muted/);
    assert.match(portal.innerHTML, /id="landing-demo-video"\s+src="assets\/gaiatrack-demo\.mp4[^"]*"[^>]*muted/);
    for (const token of ['2001–2025', '84', '95%', '89%', '−44.8%', '−32.6%', '17.5M']) {
      assert.ok(portal.innerHTML.includes(token), `Missing quantified metric token: ${token}`);
    }

    // Entering main app is one-way: closes portal, pauses pitch & demo videos, resizes, clears intro, and refuses reopening
    get('#landing-enter-app').click();
    assert.equal(doc.body.classList.contains('landing-open'), false);
    assert.equal(portal.hidden, true);
    assert.equal(portal.getAttribute('aria-hidden'), 'true');
    assert.equal(get('#landing-pitch-video').paused, true);
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
