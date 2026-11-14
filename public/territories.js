// Utilidades compartidas del catálogo territorial (7 provincias + 83 cantones).
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function provinceList(manifest){return manifest.provinces??[];}
export function cantonsOf(manifest,provinceId){return manifest.sites.filter(s=>s.type!=='province'&&s.province===provinceId);}
export function provinceOptionsHtml(manifest){return provinceList(manifest).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');}
export function territoryOptionsHtml(manifest,provinceId,lang='es'){
  const province=provinceList(manifest).find(p=>p.id===provinceId);
  if(!province)return '';
  return `<option value="${esc(province.siteId)}">${lang==='en'?'Province overview':'Vista de la provincia'}</option>`+cantonsOf(manifest,provinceId).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
}
export function territoryBounds(geo,provinceId,siteId){
  const features=geo.features.filter(f=>f.properties.province===provinceId&&(!siteId||f.properties.id===siteId));
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  function visit(value){if(typeof value[0]==='number'){west=Math.min(west,value[0]);east=Math.max(east,value[0]);south=Math.min(south,value[1]);north=Math.max(north,value[1]);}else value.forEach(visit);}
  features.forEach(f=>visit(f.geometry.coordinates));
  return Number.isFinite(west)?{west,south,east,north}:null;
}
export function siteOptionsHtml(manifest,lang='es'){const provinces=provinceList(manifest);
const head=`<optgroup label="${lang==='en'?'Provinces of Costa Rica':'Provincias de Costa Rica'}">${provinces.map(p=>`<option value="${esc(p.siteId)}">${esc(p.name)}</option>`).join('')}</optgroup>`;
return head+provinces.map(p=>`<optgroup label="${lang==='en'?'Cantons of':'Cantones de'} ${esc(p.name)}">${cantonsOf(manifest,p.id).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('');}
// Valor anual precalculado (annual.json) sin descargar el histórico mensual completo.
export function annualValue(annual,id,variable,year){const v=annual?.sites?.[id]?.[variable]?.[year-annual.start];return Number.isFinite(v)?v:null;}
export function annualPoints(annual,id,variable){const values=annual?.sites?.[id]?.[variable]??[];return values.map((value,i)=>({year:annual.start+i,value:Number.isFinite(value)?value:null}));}
