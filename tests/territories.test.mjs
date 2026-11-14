import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cantonsOf,siteOptionsHtml,annualValue,provinceOptionsHtml,territoryOptionsHtml,territoryBounds} from '../public/territories.js';

const read = async name => JSON.parse(await readFile(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));

test('Province-first selectors contain only that province and its cantons',async()=>{
  const manifest=await read('manifest.json');
  assert.equal((provinceOptionsHtml(manifest).match(/<option /g)??[]).length,7);
  for(const province of manifest.provinces){
    const html=territoryOptionsHtml(manifest,province.id);
    const ids=[...html.matchAll(/value="([^"]+)"/g)].map(match=>match[1]);
    assert.deepEqual(ids,[province.siteId,...cantonsOf(manifest,province.id).map(s=>s.id)]);
  }
  assert.equal(territoryOptionsHtml(manifest,'unknown'),'');
  assert.match(territoryOptionsHtml(manifest,'heredia','en'),/Province overview/);
});

test('Camera bounds contain every polygon of the requested province or canton',async()=>{
  const [manifest,geo]=await Promise.all(['manifest.json','cantons.geojson'].map(read));
  for(const province of manifest.provinces){
    const bounds=territoryBounds(geo,province.id);
    assert.ok(bounds.east>bounds.west&&bounds.north>bounds.south);
    for(const site of cantonsOf(manifest,province.id)){
      const canton=territoryBounds(geo,province.id,site.id);
      assert.ok(canton.west>=bounds.west&&canton.east<=bounds.east);
      assert.ok(canton.south>=bounds.south&&canton.north<=bounds.north);
    }
  }
  assert.equal(territoryBounds(geo,'unknown'),null);
  assert.equal(territoryBounds(geo,'heredia','nicoya'),null);
});

test('National catalog connects every province, canton polygon and annual series', async () => {
  const [manifest, geo, annual] = await Promise.all(['manifest.json', 'cantons.geojson', 'annual.json'].map(read));
  const sites = new Map(manifest.sites.map(s => [s.id, s]));
  assert.equal(sites.size, 90);
  assert.equal(geo.features.length, 83);
  assert.equal(new Set(geo.features.map(f => f.properties.id)).size, 83);
  const counts = {'san-jose':20, alajuela:16, cartago:8, heredia:10, guanacaste:11, puntarenas:12, limon:6};
  for (const p of manifest.provinces) {
    assert.equal(sites.get(p.siteId).type, 'province');
    assert.equal(cantonsOf(manifest, p.id).length, counts[p.id]);
  }
  for (const f of geo.features) {
    const site = sites.get(f.properties.id);
    assert.equal(site.type, 'canton');
    assert.equal(site.province, f.properties.province);
  }
  for (const site of sites.values()) {
    assert.ok(Number.isFinite(annualValue(annual, site.id, 'T2M', 2025)), site.id);
  }
  assert.equal((siteOptionsHtml(manifest).match(/<option /g) ?? []).length, 90);
});
