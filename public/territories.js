// Utilidades compartidas del catálogo territorial (7 provincias + 83 cantones).
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function provinceList(manifest){return manifest.provinces??[];}
export function cantonsOf(manifest,provinceId){return manifest.sites.filter(s=>s.type!=='province'&&s.province===provinceId);}
export function siteOptionsHtml(manifest,lang='es'){const provinces=provinceList(manifest);
const head=`<optgroup label="${lang==='en'?'Provinces of Costa Rica':'Provincias de Costa Rica'}">${provinces.map(p=>`<option value="${esc(p.siteId)}">${esc(p.name)}</option>`).join('')}</optgroup>`;
return head+provinces.map(p=>`<optgroup label="${lang==='en'?'Cantons of':'Cantones de'} ${esc(p.name)}">${cantonsOf(manifest,p.id).map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>`).join('');}
// Valor anual precalculado (annual.json) sin descargar el histórico mensual completo.
export function annualValue(annual,id,variable,year){const v=annual?.sites?.[id]?.[variable]?.[year-annual.start];return Number.isFinite(v)?v:null;}
export function annualPoints(annual,id,variable){const values=annual?.sites?.[id]?.[variable]??[];return values.map((value,i)=>({year:annual.start+i,value:Number.isFinite(value)?value:null}));}
