import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  const projX = a[0] + t * dx;
  const projY = a[1] + t * dy;
  return Math.hypot(p[0] - projX, p[1] - projY);
}

export function douglasPeucker(points, tolerance) {
  if (!Array.isArray(points) || points.length <= 2 || tolerance <= 0) {
    return Array.isArray(points) ? points.slice() : [];
  }
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    if (end - start <= 1) continue;
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxIdx !== -1 && maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }

  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) out.push(points[i]);
  }
  return out;
}

export function simplifyRing(ring, tolerance = 0.012) {
  if (!Array.isArray(ring) || ring.length <= 5) return Array.isArray(ring) ? ring.slice() : [];
  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const open = closed ? ring.slice(0, -1) : ring.slice();
  if (open.length <= 4) return ring.slice();

  // Split closed ring at farthest pair so Douglas-Peucker preserves ring extremes cleanly.
  let anchorB = 0;
  let bestDist = -1;
  const anchorA = 0;
  for (let i = 1; i < open.length; i++) {
    const d = (open[i][0] - open[anchorA][0]) ** 2 + (open[i][1] - open[anchorA][1]) ** 2;
    if (d > bestDist) {
      bestDist = d;
      anchorB = i;
    }
  }

  const firstHalf = douglasPeucker(open.slice(0, anchorB + 1), tolerance);
  const secondHalf = douglasPeucker([...open.slice(anchorB), open[0]], tolerance);
  const merged = [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)];

  if (merged.length < 3) {
    // Retry at gentler tolerance before falling back so small cantons never collapse.
    const fallback = douglasPeucker(open, tolerance * 0.25);
    if (fallback.length >= 3) {
      return [...fallback.map(roundCoord), roundCoord(fallback[0])];
    }
    return ring.slice();
  }

  const rounded = merged.map(roundCoord);
  rounded.push([rounded[0][0], rounded[0][1]]);
  return rounded;
}

function roundCoord(pt) {
  return [Number(pt[0].toFixed(5)), Number(pt[1].toFixed(5))];
}

export function simplifyGeoJSON(geojson, tolerance = 0.012) {
  return {
    ...geojson,
    features: (geojson.features || []).map(feature => {
      const geom = feature.geometry;
      if (!geom) return feature;
      if (geom.type === 'Polygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(r => simplifyRing(r, tolerance))
          }
        };
      }
      if (geom.type === 'MultiPolygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(poly => poly.map(r => simplifyRing(r, tolerance)))
          }
        };
      }
      return feature;
    })
  };
}

function countPoints(geojson) {
  let pts = 0;
  for (const f of geojson.features || []) {
    const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : (f.geometry?.coordinates || []);
    for (const poly of polys) {
      for (const ring of poly) pts += ring.length;
    }
  }
  return pts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const tolerance = Number(process.argv[2] || 0.012);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const srcPath = path.join(root, 'public/data/cantons.geojson');
  const outPath = path.join(root, 'public/data/cantons-overview.geojson');
  const raw = JSON.parse(await readFile(srcPath, 'utf8'));
  const simplified = simplifyGeoJSON(raw, tolerance);
  await writeFile(outPath, JSON.stringify(simplified));
  const before = countPoints(raw);
  const after = countPoints(simplified);
  const pct = (((before - after) / Math.max(1, before)) * 100).toFixed(1);
  console.log(`Simplified cantons.geojson -> cantons-overview.geojson (tolerance=${tolerance}): ${before} -> ${after} vertices (-${pct}%)`);
}
