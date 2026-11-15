export function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointInPolygon(x, z, outer, holes = []) {
  if (!pointInRing(x, z, outer)) return false;
  for (const hole of holes) {
    if (pointInRing(x, z, hole)) return false;
  }
  return true;
}

export function createTerritoryPicker(geojson, coords) {
  const entries = [];
  for (const feature of geojson?.features || []) {
    const id = feature.properties?.id;
    const province = feature.properties?.province;
    if (!id) continue;
    const rawPolys =
      feature.geometry?.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry?.coordinates || [];

    const polys = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const rings of rawPolys) {
      if (!rings?.length || rings[0].length < 3) continue;
      let pMinX = Infinity, pMaxX = -Infinity, pMinZ = Infinity, pMaxZ = -Infinity;
      const toXZ = ring => ring.map(([lon, lat]) => {
        const pt = coords(lon, lat);
        if (pt.x < pMinX) pMinX = pt.x;
        if (pt.x > pMaxX) pMaxX = pt.x;
        if (pt.z < pMinZ) pMinZ = pt.z;
        if (pt.z > pMaxZ) pMaxZ = pt.z;
        return { x: pt.x, z: pt.z };
      });
      const outer = toXZ(rings[0]);
      const holes = rings.slice(1).map(r => r.map(([lon, lat]) => {
        const pt = coords(lon, lat);
        return { x: pt.x, z: pt.z };
      }));
      if (pMinX < minX) minX = pMinX;
      if (pMaxX > maxX) maxX = pMaxX;
      if (pMinZ < minZ) minZ = pMinZ;
      if (pMaxZ > maxZ) maxZ = pMaxZ;
      polys.push({ outer, holes, bbox: { minX: pMinX, maxX: pMaxX, minZ: pMinZ, maxZ: pMaxZ } });
    }

    if (polys.length) {
      entries.push({ id, province, bbox: { minX, maxX, minZ, maxZ }, polys });
    }
  }

  function pickAt(x, z, activeProvince = null) {
    for (const entry of entries) {
      if (activeProvince && entry.province !== activeProvince) continue;
      const b = entry.bbox;
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      for (const poly of entry.polys) {
        const pb = poly.bbox;
        if (x < pb.minX || x > pb.maxX || z < pb.minZ || z > pb.maxZ) continue;
        if (pointInPolygon(x, z, poly.outer, poly.holes)) {
          return { id: entry.id, province: entry.province };
        }
      }
    }
    return null;
  }

  return { pickAt, count: entries.length };
}
