import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');

function featureBbox(feature) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const visit = coords => {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of coords) visit(child);
  };

  if (feature?.geometry?.coordinates) visit(feature.geometry.coordinates);
  if (!Number.isFinite(minLat)) return null;
  return { minLat, maxLat, minLon, maxLon };
}

function mergeBboxes(boxes) {
  const valid = boxes.filter(Boolean);
  if (!valid.length) return null;
  return {
    minLat: Math.min(...valid.map(b => b.minLat)),
    maxLat: Math.max(...valid.map(b => b.maxLat)),
    minLon: Math.min(...valid.map(b => b.minLon)),
    maxLon: Math.max(...valid.map(b => b.maxLon))
  };
}

function fallbackBbox(site) {
  const pad = site.type === 'province' ? 0.25 : 0.08;
  return {
    minLat: site.latitude - pad,
    maxLat: site.latitude + pad,
    minLon: site.longitude - pad,
    maxLon: site.longitude + pad
  };
}

function parseFacetMap(facets, field) {
  const entry = facets?.find(f => f.field === field);
  const out = {};
  for (const item of entry?.counts ?? []) {
    out[item.name] = item.count;
  }
  return out;
}

async function fetchGbifForBbox(bbox, attempt = 0) {
  const params = new URLSearchParams({
    country: 'CR',
    hasCoordinate: 'true',
    decimalLatitude: `${bbox.minLat.toFixed(4)},${bbox.maxLat.toFixed(4)}`,
    decimalLongitude: `${bbox.minLon.toFixed(4)},${bbox.maxLon.toFixed(4)}`,
    limit: '0'
  });
  params.append('facet', 'iucnRedListCategory');
  params.append('facet', 'kingdomKey');

  const url = `https://api.gbif.org/v1/occurrence/search?${params.toString()}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (err) {
    if (attempt < 5) {
      await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
      return fetchGbifForBbox(bbox, attempt + 1);
    }
    throw err;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1200 * (attempt + 1);
    await new Promise(r => setTimeout(r, waitMs));
    return fetchGbifForBbox(bbox, attempt + 1);
  }
  if (!res.ok) throw Error(`GBIF HTTP ${res.status}`);
  const payload = await res.json();
  const iucnMap = parseFacetMap(payload.facets, 'IUCN_RED_LIST_CATEGORY');
  const kingdomMap = parseFacetMap(payload.facets, 'KINGDOM_KEY');

  const cr = iucnMap.CR ?? 0;
  const en = iucnMap.EN ?? 0;
  const vu = iucnMap.VU ?? 0;
  const nt = iucnMap.NT ?? 0;

  return {
    occurrences: Number.isFinite(payload.count) ? payload.count : null,
    threatenedOccurrences: cr + en + vu,
    iucn: { CR: cr, EN: en, VU: vu, NT: nt },
    animalia: kingdomMap['1'] ?? 0,
    plantae: kingdomMap['6'] ?? 0,
    fungi: kingdomMap['5'] ?? 0
  };
}

async function fetchElevations(sites) {
  const params = new URLSearchParams({
    latitude: sites.map(s => s.latitude.toFixed(5)).join(','),
    longitude: sites.map(s => s.longitude.toFixed(5)).join(',')
  });
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?${params.toString()}`, {
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw Error(`Elevation HTTP ${res.status}`);
  const payload = await res.json();
  return Array.isArray(payload?.elevation) ? payload.elevation : [];
}

async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(DATA_DIR, 'manifest.json'), 'utf8'));
  const cantonsGeo = JSON.parse(await readFile(path.join(DATA_DIR, 'cantons.geojson'), 'utf8'));
  const provincesGeo = JSON.parse(await readFile(path.join(DATA_DIR, 'costa-rica-provinces.geojson'), 'utf8'));

  const cantonBoxes = new Map();
  for (const f of cantonsGeo.features ?? []) {
    if (f?.properties?.id) cantonBoxes.set(f.properties.id, featureBbox(f));
  }
  const provinceBoxes = new Map();
  for (const f of provincesGeo.features ?? []) {
    if (f?.properties?.id) {
      const prev = provinceBoxes.get(f.properties.id);
      provinceBoxes.set(f.properties.id, mergeBboxes([prev, featureBbox(f)]));
    }
  }

  console.log(`Fetching elevations for ${manifest.sites.length} territories...`);
  let elevations = [];
  try {
    elevations = await fetchElevations(manifest.sites);
  } catch (err) {
    console.warn(`Elevation API unavailable (${err.message}); continuing with GBIF biological data.`);
  }

  console.log(`Fetching GBIF biodiversity & IUCN Red List records for ${manifest.sites.length} territories...`);
  const entries = await mapConcurrent(manifest.sites, 2, async (site, idx) => {
    await new Promise(r => setTimeout(r, 180));
    const bbox =
      (site.type === 'province' ? provinceBoxes.get(site.province) : cantonBoxes.get(site.id)) ||
      fallbackBbox(site);
    const gbif = await fetchGbifForBbox(bbox);
    const elevationM = Number.isFinite(elevations[idx]) ? Math.round(elevations[idx]) : null;
    if ((idx + 1) % 15 === 0 || idx === manifest.sites.length - 1) {
      console.log(`  Processed ${idx + 1}/${manifest.sites.length}: ${site.name} (${gbif.occurrences} records, ${gbif.threatenedOccurrences} IUCN)`);
    }
    return [
      site.id,
      {
        ...gbif,
        elevationM,
        bbox: {
          minLat: +bbox.minLat.toFixed(4),
          maxLat: +bbox.maxLat.toFixed(4),
          minLon: +bbox.minLon.toFixed(4),
          maxLon: +bbox.maxLon.toFixed(4)
        }
      }
    ];
  });

  const output = {
    retrievedAt: new Date().toISOString(),
    sources: {
      biodiversity: 'GBIF Occurrence API (country=CR, hasCoordinate=true)',
      biodiversityUrl: 'https://api.gbif.org/v1/occurrence/search',
      elevation: 'Open-Meteo Elevation API (Copernicus DEM GLO-90)',
      elevationUrl: 'https://open-meteo.com/en/docs/elevation-api'
    },
    sites: Object.fromEntries(entries)
  };

  const outPath = path.join(DATA_DIR, 'ecological.json');
  await writeFile(outPath, JSON.stringify(output, null, 2));
  console.log(`Saved real ecological dataset to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
