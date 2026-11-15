import {loadHistory} from './data-client.js';
import {trend} from './science.js';
import {readWeather,readSectors} from './weather-state.js';
import {buildRecommendations} from './recommendations.js';
import {getLang,locale,tx} from './i18n.js';

const VARS=[
  {key:'T2M',name:()=>tx('Mean temp','Temp. media'),unit:'°C',d:1},
  {key:'T2M_MAX',name:()=>tx('Max temp','Temp. máxima'),unit:'°C',d:1},
  {key:'T2M_MIN',name:()=>tx('Min temp','Temp. mínima'),unit:'°C',d:1},
  {key:'PRECTOTCORR',name:()=>tx('Rainfall','Lluvia'),unit:'mm/d',d:2},
  {key:'ALLSKY_SFC_SW_DWN',name:()=>tx('Solar rad.','Radiación'),unit:'MJ/m²/d',d:1},
  {key:'GWETTOP',name:()=>tx('Soil moisture','Humedad suelo'),unit:'0–1',d:2},
  {key:'RH2M',name:()=>tx('Rel. humidity','Humedad rel.'),unit:'%',d:0}
];

export function createSimulator({sites,annual,sectorsCatalog,onSelectTerritory}){
  const el=document.createElement('section');
  el.id='gaia-simulator';el.hidden=true;el.setAttribute('aria-label',tx('Climate Simulator','Simulador climático'));
  document.body.append(el);

  const monthlyCache=new Map();
  let state={site:'san-jose',district:null,varKey:'T2M',deltaT:0,deltaP:0};
  const fmt=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
  const signed=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d,signDisplay:'exceptZero'}).format(n):'—';
  async function getMonthly(id){
    if(monthlyCache.has(id))return monthlyCache.get(id);
    try{const m=(await loadHistory(id)).monthly;monthlyCache.set(id,m);return m;}catch{return null;}
  }

  function seriesFor(id,key){
    const years=annual?.years||[],vals=annual?.sites?.[id]?.series?.[key]||[];
    return years.map((y,i)=>({year:y,value:vals[i]})).filter(p=>Number.isFinite(p.value));
  }

  async function render(){
    if(el.hidden)return;
    const siteObj=sites.find(s=>s.id===state.site)||sites[0];
    if(!siteObj)return;
    state.site=siteObj.id;
    const provs=sites.filter(s=>s.type==='province');
    const cantons=sites.filter(s=>s.province===siteObj.province&&s.type!=='province');
    const dists=sectorsCatalog[siteObj.id]||[];
    const distObj=dists.find(d=>d.id===state.district)||null;
    const activeCur=distObj
      ?((readSectors(siteObj.id)||[]).find(s=>s.site===distObj.id)||readWeather('current',siteObj.id))
      :readWeather('current',siteObj.id);
    const forecast=readWeather('forecast',siteObj.id);
    const monthly=await getMonthly(siteObj.id);
    const scenario=(state.deltaT||state.deltaP)?{deltaT:state.deltaT,deltaPPercent:state.deltaP}:null;
    const rec=buildRecommendations(siteObj.id,activeCur||{},forecast?.days||[],{monthly,scenario,lang:getLang()});
    const m=rec.metrics;

    const vMeta=VARS.find(v=>v.key===state.varKey)||VARS[0];
    const pts=seriesFor(siteObj.id,vMeta.key);
    const mk=pts.length>=3?trend(pts):{slope:null,p:null,n:pts.length};
    const last=pts[pts.length-1];
    const meanAll=pts.length?pts.reduce((a,b)=>a+b.value,0)/pts.length:null;
    const stdAll=pts.length>2?Math.sqrt(pts.reduce((a,b)=>a+(b.value-meanAll)**2,0)/(pts.length-1)):0;
    const anoms=stdAll>1e-9?pts.map(p=>({...p,z:(p.value-meanAll)/stdAll,diff:p.value-meanAll})).filter(p=>Math.abs(p.z)>=1.3).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,5):[];

    const rowsHtml=VARS.map(v=>{
      const s=seriesFor(siteObj.id,v.key);if(!s.length)return '';
      const l=s[s.length-1],b=s.filter(p=>p.year>=2001&&p.year<=2010);
      const bAvg=b.length?b.reduce((a,c)=>a+c.value,0)/b.length:null;
      const diff=bAvg!==null?l.value-bAvg:null;
      const t=s.length>=3?trend(s):{slope:null,n:s.length};
      const dec=Number.isFinite(t.slope)?t.slope*10:null;
      const p30=Number.isFinite(t.slope)&&t.n>=10?l.value+t.slope*(2030-l.year):null;
      const p50=Number.isFinite(t.slope)&&t.n>=10?l.value+t.slope*(2050-l.year):null;
      return `<tr><td><strong>${v.name()}</strong><small>${v.unit}</small></td><td>${fmt(bAvg,v.d)}</td><td><strong>${fmt(l.value,v.d)}</strong> <small>(${l.year})</small></td><td class="${diff>0?'is-up':diff<0?'is-down':''}">${signed(diff,v.d)}</td><td>${signed(dec,v.d+1)}</td><td>${p30!==null?`${fmt(p30,v.d)} → ${fmt(p50,v.d)}`:'—'}</td></tr>`;
    }).join('');

    const topTip=rec.tips[0];
    el.innerHTML=`
      <div class="sim-shell">
        <header class="sim-topbar">
          <div class="sim-brand">
            <span>GAIA E&amp;B · ${tx('CLIMATE SIMULATOR','SIMULADOR CLIMÁTICO')}</span>
            <strong>${distObj?`${siteObj.name} · ${distObj.name}`:siteObj.name}</strong>
          </div>
          <div class="sim-pickers">
            <div class="sim-picker"><label for="sim-prov">${tx('Province','Provincia')}</label><select id="sim-prov">${provs.map(p=>`<option value="${p.id}" ${p.id===siteObj.province?'selected':''}>${p.name}</option>`).join('')}</select></div>
            <div class="sim-picker"><label for="sim-canton">${tx('Canton','Cantón')}</label><select id="sim-canton"><option value="${siteObj.province}" ${siteObj.id===siteObj.province?'selected':''}>${tx('Province overview','Vista provincial')}</option>${cantons.map(c=>`<option value="${c.id}" ${c.id===siteObj.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
            ${dists.length?`<div class="sim-picker"><label for="sim-dist">${tx('District','Distrito')}</label><select id="sim-dist"><option value="">${tx('All districts','Todos')} (${dists.length})</option>${dists.map(d=>`<option value="${d.id}" ${d.id===state.district?'selected':''}>${d.name}</option>`).join('')}</select></div>`:''}
            <button type="button" id="sim-close" class="sim-close">← ${tx('Back to 3D','Volver al 3D')}</button>
          </div>
        </header>

        <section class="sim-kpis">
          <article class="sim-kpi"><span>${tx('CURRENT MODEL TEMP','TEMP. ACTUAL MODELO')}</span><strong>${activeCur?`${fmt(activeCur.temperature,1)} °C`:'—'}</strong><small>${activeCur?.name||siteObj.name} · ${tx('Clouds','Nubes')} ${fmt(activeCur?.clouds,0)}%</small></article>
          <article class="sim-kpi"><span>${tx('PRECIPITATION','PRECIPITACIÓN')}</span><strong>${activeCur?`${fmt(activeCur.precipitation,2)} mm`:'—'}</strong><small>${tx('Soil 0–1 cm','Suelo 0–1 cm')}: ${activeCur?fmt(activeCur.soilMoisture,3):'—'} m³/m³</small></article>
          <article class="sim-kpi"><span>${tx('HISTORICAL TREND','TENDENCIA HISTÓRICA')} (${vMeta.name()})</span><strong>${Number.isFinite(mk.slope)?`${signed(mk.slope*10,vMeta.d+1)} ${vMeta.unit}/${tx('dec','déc')}`:'—'}</strong><small>${Number.isFinite(mk.p)?`Mann–Kendall p = ${mk.p<.001?'<0.001':fmt(mk.p,3)}`:''}</small></article>
          <article class="sim-kpi"><span>${tx('STRESS INDEX (IEA)','ÍNDICE DE ESTRÉS (IEA)')}</span><strong>${m&&Number.isFinite(m.iea)?fmt(m.iea,2):'—'}</strong><small>${m?m.ieaLevel:tx('Loading baseline…','Cargando línea base…')}</small></article>
        </section>

        <section class="sim-playground">
          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('What-if Scenario Controls','Controles de Escenario ("¿Qué pasa si…?")')}</h3></div>
            <div class="sim-presets">
              <button type="button" class="sim-preset ${!state.deltaT&&!state.deltaP?'is-on':''}" data-dt="0" data-dp="0">${tx('Real baseline','Base real')}</button>
              <button type="button" class="sim-preset ${state.deltaT===1.5&&!state.deltaP?'is-on':''}" data-dt="1.5" data-dp="0">+1.5 °C ${tx('Warming','Calor')}</button>
              <button type="button" class="sim-preset ${state.deltaT===2.5&&state.deltaP===-30?'is-on':''}" data-dt="2.5" data-dp="-30">+2.5 °C · −30% ${tx('Drought','Sequía')}</button>
              <button type="button" class="sim-preset ${!state.deltaT&&state.deltaP===50?'is-on':''}" data-dt="0" data-dp="50">+50% ${tx('Heavy rain','Temporal')}</button>
            </div>
            <label class="sim-slider-box">
              <div class="sim-slider-top"><span>${tx('Temperature shift (ΔT)','Cambio de temperatura (ΔT)')}</span><strong>${signed(state.deltaT,1)} °C</strong></div>
              <input id="sim-dt" type="range" min="-3" max="4" step="0.5" value="${state.deltaT}">
              <small>${tx('Simulates cooler periods (−) or heatwaves (+) over the current reference.','Simula enfriamiento (−) u olas de calor (+) sobre la referencia actual.')}</small>
            </label>
            <label class="sim-slider-box">
              <div class="sim-slider-top"><span>${tx('Precipitation shift (ΔP)','Variación de lluvia (ΔP)')}</span><strong>${signed(state.deltaP,0)} %</strong></div>
              <input id="sim-dp" type="range" min="-50" max="80" step="10" value="${state.deltaP}">
              <small>${tx('Tests drought deficit (−%) or excess rainfall (+%).','Prueba déficit por sequía (−%) o exceso de lluvia (+%).')}</small>
            </label>
          </div>

          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('Simulated Difference vs. Real','Diferencia Simulada vs. Real')}</h3></div>
            <div class="sim-compare-grid">
              <div class="sim-cmp-item"><span>${tx('TEMP (BASE → SIM)','TEMP (BASE → SIM)')}</span><strong>${m?`${fmt(m.baseObserved?.t,1)} → ${fmt(m.observed.t,1)} °C`:'—'}</strong><small>${tx('Norm','Normal')}: ${m?fmt(m.refs.t.mean,1):'—'} °C</small></div>
              <div class="sim-cmp-item"><span>${tx('RAIN (BASE → SIM)','LLUVIA (BASE → SIM)')}</span><strong>${m?`${fmt(m.baseObserved?.p,2)} → ${fmt(m.observed.p,2)}`:'—'}</strong><small>${tx('Norm','Normal')}: ${m?fmt(m.refs.p.mean,2):'—'} mm/d</small></div>
              <div class="sim-cmp-item"><span>${tx('IEA (BASE → SIM)','IEA (BASE → SIM)')}</span><strong>${m?`${fmt(m.baseIea,2)} → ${fmt(m.iea,2)}`:'—'}</strong><small>${m?m.ieaLevel:'—'}</small></div>
            </div>
            ${topTip?`<div class="sim-rec-box"><strong>${topTip.tag} · ${topTip.title}</strong>${topTip.body}</div>`:''}
            <p class="sim-footnote">${tx('Hypothetical scenarios use real NASA POWER baselines (2001–2025) and do not replace official forecasts.','Los escenarios hipotéticos usan la línea base real NASA POWER (2001–2025) y no sustituyen pronósticos oficiales.')}</p>
          </div>
        </section>

        <section class="sim-bottom-grid">
          <div class="sim-panel">
            <div class="sim-panel-head">
              <h3>${tx('Irregularities','Irregularidades')}</h3>
              <select id="sim-var" style="background:#081322;color:#e8f3fb;border:1px solid rgba(56,189,248,.3);border-radius:7px;padding:4px 8px;font-size:12px">${VARS.map(v=>`<option value="${v.key}" ${v.key===state.varKey?'selected':''}>${v.name()}</option>`).join('')}</select>
            </div>
            <div class="sim-anom-list">
              ${anoms.length?anoms.map(a=>`<div class="sim-anom-row"><strong>${a.year}</strong><span>${fmt(a.value,vMeta.d)} ${vMeta.unit} (${signed(a.diff,vMeta.d)})</span><span class="sim-pill ${a.z>0?'is-warm':'is-cool'}">${signed(a.z,1)}σ</span></div>`).join(''):`<small>${tx('No extreme years (|Z| ≥ 1.3) in this series.','Sin años extremos (|Z| ≥ 1,3) en esta serie.')}</small>`}
            </div>
            <p class="sim-footnote">${last&&Number.isFinite(mk.slope)?tx(`Linear projection ${vMeta.name()}: 2030 = ${fmt(last.value+mk.slope*(2030-last.year),vMeta.d)} · 2050 = ${fmt(last.value+mk.slope*(2050-last.year),vMeta.d)} ${vMeta.unit}`,`Proyección lineal ${vMeta.name()}: 2030 = ${fmt(last.value+mk.slope*(2030-last.year),vMeta.d)} · 2050 = ${fmt(last.value+mk.slope*(2050-last.year),vMeta.d)} ${vMeta.unit}`):''}</p>
          </div>

          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('Specific Data by Variable','Datos Específicos por Variable')}</h3></div>
            <div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>${tx('Variable','Variable')}</th><th>${tx('Base 01–10','Base 01–10')}</th><th>${tx('Latest','Último')}</th><th>${tx('Diff (Δ)','Diferencia')}</th><th>${tx('Rate/dec','Tasa/déc')}</th><th>${tx('Proj. 2030 → 2050','Proy. 2030 → 2050')}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
          </div>
        </section>
      </div>`;

    el.querySelector('#sim-close').onclick=close;
    el.querySelector('#sim-prov').onchange=e=>{
      const firstCanton=sites.find(s=>s.province===e.target.value&&s.type!=='province')||sites.find(s=>s.id===e.target.value);
      state.site=firstCanton?firstCanton.id:e.target.value;state.district=null;onSelectTerritory?.(state.site,null);render();
    };
    el.querySelector('#sim-canton').onchange=e=>{state.site=e.target.value;state.district=null;onSelectTerritory?.(state.site,null);render();};
    el.querySelector('#sim-dist')?.addEventListener('change',e=>{state.district=e.target.value||null;onSelectTerritory?.(state.site,state.district);render();});
    el.querySelector('#sim-var').onchange=e=>{state.varKey=e.target.value;render();};
    el.querySelector('#sim-dt').oninput=e=>{state.deltaT=+e.target.value;render();};
    el.querySelector('#sim-dp').oninput=e=>{state.deltaP=+e.target.value;render();};
    el.querySelectorAll('.sim-preset').forEach(b=>b.onclick=()=>{state.deltaT=+b.dataset.dt;state.deltaP=+b.dataset.dp;render();});
  }

  function open({site,district=null}={}){if(site)state.site=site;state.district=district;el.hidden=false;render();}
  function close(){el.hidden=true;}
  return {open,close,render};
}
