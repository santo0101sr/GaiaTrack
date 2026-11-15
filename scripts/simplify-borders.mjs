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

function roundCoord(pt) {
  return [Number(pt[0].toFixed(5)), Number(pt[1].toFixed(5))];
}

function ptKey(pt) {
  return `${pt[0].toFixed(6)},${pt[1].toFixed(6)}`;
}

function dedupeOpenRing(ring) {
  if (!Array.isArray(ring) || !ring.length) return [];
  const rawOpen =
    ring.length > 1 && ptKey(ring[0]) === ptKey(ring[ring.length - 1])
      ? ring.slice(0, -1)
      : ring.slice();
  const out = [];
  for (const pt of rawOpen) {
    if (!out.length || ptKey(out[out.length - 1]) !== ptKey(pt)) {
      out.push([pt[0], pt[1]]);
    }
  }
  return out;
}

export function simplifyRing(ring, tolerance = 0.0035) {
  const open = dedupeOpenRing(ring);
  if (open.length <= 4) return ring.slice();

  let anchorB = 0;
  let bestDist = -1;
  for (let i = 1; i < open.length; i++) {
    const d = (open[i][0] - open[0][0]) ** 2 + (open[i][1] - open[0][1]) ** 2;
    if (d > bestDist) {
      bestDist = d;
      anchorB = i;
    }
  }

  const firstHalf = douglasPeucker(open.slice(0, anchorB + 1), tolerance);
  const secondHalf = douglasPeucker([...open.slice(anchorB), open[0]], tolerance);
  const merged = [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)];

  if (merged.length < 3) {
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

// Simplify shared borders once so neighboring cantons stay watertight without gaps or slivers on zoom.
export function simplifyGeoJSON(geojson, tolerance = 0.0035) {
  const features = geojson.features || [];
  const neighbors = new Map();
  const addEdge = (a, b) => {
    const ka = ptKey(a);
    const kb = ptKey(b);
    if (ka === kb) return;
    if (!neighbors.has(ka)) neighbors.set(ka, new Set());
    if (!neighbors.has(kb)) neighbors.set(kb, new Set());
    neighbors.get(ka).add(kb);
    neighbors.get(kb).add(ka);
  };

  for (const f of features) {
    const polys = f.geometry?.type === 'Polygon'
      ? [f.geometry.coordinates]
      : f.geometry?.type === 'MultiPolygon'
        ? f.geometry.coordinates
        : [];
    for (const rings of polys) {
      for (const ring of rings) {
        const open = dedupeOpenRing(ring);
        if (open.length < 3) continue;
        for (let i = 0; i < open.length; i++) {
          addEdge(open[i], open[(i + 1) % open.length]);
        }
      }
    }
  }

  const pinned = new Set();
  for (const [k, adj] of neighbors) {
    if (adj.size !== 2) pinned.add(k);
  }

  const arcCache = new Map();
  function simplifyCanonicalArc(arcPts, tol) {
    if (arcPts.length <= 2 || tol <= 0) return arcPts.map(roundCoord);
    const k0 = ptKey(arcPts[0]);
    const k1 = ptKey(arcPts[arcPts.length - 1]);
    const reverse = k0 > k1;
    const canonPts = reverse ? arcPts.slice().reverse() : arcPts;
    const mid = ptKey(canonPts[Math.floor(canonPts.length / 2)]);
    const key = `${reverse ? k1 : k0}|${reverse ? k0 : k1}|${canonPts.length}|${mid}|${tol}`;
    let cached = arcCache.get(key);
    if (!cached) {
      cached = douglasPeucker(canonPts, tol).map(roundCoord);
      arcCache.set(key, cached);
    }
    return reverse ? cached.slice().reverse() : cached;
  }

  function simplifyTopoRing(ring) {
    const open = dedupeOpenRing(ring);
    if (open.length <= 4) return ring.slice();

    const pinIndices = [];
    for (let i = 0; i < open.length; i++) {
      if (pinned.has(ptKey(open[i]))) pinIndices.push(i);
    }

    if (pinIndices.length < 2) {
      return simplifyRing(ring, tolerance);
    }

    const buildFromPins = tol => {
      const start = pinIndices[0];
      const rotated = [...open.slice(start), ...open.slice(0, start), open[start]];
      const segBreaks = [];
      for (let i = 0; i < rotated.length; i++) {
        if (i === 0 || i === rotated.length - 1 || pinned.has(ptKey(rotated[i]))) {
          segBreaks.push(i);
        }
      }
      const assembled = [];
      for (let s = 0; s < segBreaks.length - 1; s++) {
        const arc = rotated.slice(segBreaks[s], segBreaks[s + 1] + 1);
        const simp = simplifyCanonicalArc(arc, tol);
        for (let k = 0; k < simp.length - 1; k++) {
          assembled.push(simp[k]);
        }
      }
      if (assembled.length >= 3) {
        assembled.push([assembled[0][0], assembled[0][1]]);
        return assembled;
      }
      return null;
    };

    return buildFromPins(tolerance) || buildFromPins(tolerance * 0.25) || ring.slice();
  }

  return {
    ...geojson,
    features: features.map(feature => {
      const geom = feature.geometry;
      if (!geom) return feature;
      if (geom.type === 'Polygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(simplifyTopoRing)
          }
        };
      }
      if (geom.type === 'MultiPolygon') {
        return {
          ...feature,
          geometry: {
            ...geom,
            coordinates: geom.coordinates.map(poly => poly.map(simplifyTopoRing))
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
  const tolerance = Number(process.argv[2] || 0.0035);
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
