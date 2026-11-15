import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

test('i18n setLang and setTheme update state cleanly across ES/EN and Light/Dark', async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  const storage = new Map();
  const attrs = new Map();
  const nodes = new Map();
  const bodyClasses = new Set();

  const makeNode = (initial = '') => {
    const nodeAttrs = new Map();
    return {
      textContent: initial,
      innerHTML: initial,
      title: '',
      classList: { toggle() {} },
      setAttribute(k, v) { nodeAttrs.set(k, String(v)); },
      getAttribute(k) { return nodeAttrs.get(k) || ''; }
    };
  };

  const navTrend = makeNode();
  const metaTheme = makeNode();
  const themeBtn = makeNode();
  nodes.set('.topbar nav a[href="#tendencias"]', navTrend);
  nodes.set('meta[name="theme-color"]', metaTheme);

  const listeners = new Map();
  globalThis.localStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, String(v))
  };
  globalThis.window = {
    dispatchEvent() {}
  };
  globalThis.document = {
    documentElement: {
      lang: 'en',
      setAttribute: (k, v) => attrs.set(k, String(v))
    },
    body: {
      classList: {
        toggle: (name, force) => {
          if (force) bodyClasses.add(name);
          else bodyClasses.delete(name);
        }
      }
    },
    querySelector: sel => nodes.get(sel) || null,
    querySelectorAll: sel => (sel === '[data-theme-toggle]' ? [themeBtn] : []),
    addEventListener: (ev, fn) => listeners.set(ev, fn),
    dispatchEvent() {}
  };

  try {
    const mod = await import(`../public/i18n.js?t=${Date.now()}`);
    mod.setLang('es');
    assert.equal(globalThis.document.documentElement.lang, 'es');
    assert.equal(navTrend.textContent, 'Tendencias');
    assert.equal(mod.tx('Trend', 'Tendencia'), 'Tendencia');

    mod.setLang('en');
    assert.equal(globalThis.document.documentElement.lang, 'en');
    assert.equal(navTrend.textContent, 'Trends');
    assert.equal(mod.tx('Trend', 'Tendencia'), 'Trend');

    mod.setTheme('light');
    assert.equal(attrs.get('data-theme'), 'light');
    assert.equal(bodyClasses.has('light-mode'), true);
    assert.equal(metaTheme.getAttribute('content'), '#f4f8f7');
    assert.match(themeBtn.innerHTML, /<svg[^>]*ui-icon/);

    mod.setTheme('dark');
    assert.equal(attrs.get('data-theme'), 'dark');
    assert.equal(bodyClasses.has('light-mode'), false);
    assert.equal(metaTheme.getAttribute('content'), '#041315');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});

test('Public UI copy enforces español neutro (zero voseo) and avoids placeholder emojis', async () => {
  const publicDir = path.resolve('public');
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile() && /\.(js|html)$/i.test(e.name))
    .map(e => path.join(publicDir, e.name));

  const voseoPattern = /\b(Consultá|Elegí|Hacé|Probá|explorá|Explorá|Mirá|Fijate)\b/;
  const emojiPattern = /[☀️🌙🌿🎬⚡🌡️🌀📖🌐🌵🌊💧☀️]/;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const rel = path.relative(process.cwd(), file);
    assert.equal(voseoPattern.test(content), false, `Found voseo in ${rel}`);
    assert.equal(emojiPattern.test(content), false, `Found decorative emoji in ${rel}`);
  }
});

test('icons.js renders inline Lucide SVG primitives cleanly', async () => {
  const { icon } = await import('../public/icons.js');
  const svg = icon('compass', 'custom-cls');
  assert.match(svg, /^<svg\s/);
  assert.match(svg, /class="ui-icon custom-cls"/);
  assert.match(svg, /aria-hidden="true"/);
});
