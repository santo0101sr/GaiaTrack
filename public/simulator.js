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
  el.id='gaia-simulator';el.hidden=true;el.setAttribute('aria-label',tx('Climate Predictor & Simulator','Predictor y Simulador Climático'));
  document.body.append(el);

  const monthlyCache=new Map();
  let state={site:'san-jose',district:null,varKey:'T2M',targetYear:2035,deltaT:0,deltaP:0};
  const fmt=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
  const signed=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d,signDisplay:'exceptZero'}).format(n):'—';
  async function getMonthly(id){
    if(monthlyCache.has(id))return monthlyCache.get(id);
    try{const m=(await loadHistory(id)).monthly;monthlyCache.set(id,m);return m;}catch{return null;}
  }

  function seriesFor(id,key){
    const start=annual?.start??2001,vals=annual?.sites?.[id]?.[key]||[];
    return vals.map((v,i)=>({year:start+i,value:v})).filter(p=>Number.isFinite(p.value));
  }

  function buildChartSvg(pts,mk,targetYear,unit,digits){
    if(pts.length<3)return `<p class="sim-footnote">${tx('Insufficient historical series for chart.','Serie histórica insuficiente para graficar.')}</p>`;
    const W=680,H=210,padL=46,padR=18,padT=16,padB=28;
    const minYYear=pts[0].year,maxYYear=Math.max(targetYear,pts[pts.length-1].year+2);
    const last=pts[pts.length-1],slope=Number.isFinite(mk.slope)?mk.slope:0;
    const loSlope=Number.isFinite(mk.slopeCI?.lower)?mk.slopeCI.lower:slope;
    const hiSlope=Number.isFinite(mk.slopeCI?.upper)?mk.slopeCI.upper:slope;
    const projVal=y=>last.value+slope*(y-last.year);
    const projLo=y=>last.value+loSlope*(y-last.year);
    const projHi=y=>last.value+hiSlope*(y-last.year);

    const allVals=[...pts.map(p=>p.value),projVal(targetYear),projLo(targetYear),projHi(targetYear)];
    let vMin=Math.min(...allVals),vMax=Math.max(...allVals);
    if(vMax-vMin<1e-6){vMin-=1;vMax+=1;}
    const margin=(vMax-vMin)*.14;vMin-=margin;vMax+=margin;
    const xOf=yr=>padL+((yr-minYYear)/Math.max(1,maxYYear-minYYear))*(W-padL-padR);
    const yOf=v=>padT+(1-(v-vMin)/(vMax-vMin))*(H-padT-padB);

    const histPath=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(p.year).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
    const xLast=xOf(last.year).toFixed(1),yLast=yOf(last.value).toFixed(1);
    const xTarget=xOf(targetYear).toFixed(1),yTarget=yOf(projVal(targetYear)).toFixed(1);
    const bandPoly=`${xLast},${yLast} ${xTarget},${yOf(projHi(targetYear)).toFixed(1)} ${xTarget},${yOf(projLo(targetYear)).toFixed(1)}`;
    const ticks=[minYYear,Math.round((minYYear+last.year)/2),last.year,targetYear];

    return `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" role="img" aria-label="${tx('Historical series and future projection','Serie histórica y proyección futura')}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${xLast}" y1="${padT}" x2="${xLast}" y2="${H-padB}" stroke="rgba(148,163,184,.2)" stroke-dasharray="3 3"/>
      <polygon points="${bandPoly}" fill="rgba(245,179,22,.16)"/>
      <path d="${histPath}" fill="none" stroke="#38bdf8" stroke-width="2.2"/>
      <line x1="${xLast}" y1="${yLast}" x2="${xTarget}" y2="${yTarget}" stroke="#f5b316" stroke-width="2.2" stroke-dasharray="5 4"/>
      <circle cx="${xTarget}" cy="${yTarget}" r="4.5" fill="#f5b316"/>
      <text x="${padL-6}" y="${padT+8}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMax,digits)}</text>
      <text x="${padL-6}" y="${H-padB}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMin,digits)}</text>
      <text x="${xTarget}" y="${Math.max(12,yOf(projVal(targetYear))-9)}" text-anchor="end" fill="#fde68a" font-size="11" font-weight="600">${targetYear}: ${fmt(projVal(targetYear),digits)} ${unit}</text>
      ${[...new Set(ticks)].map(yr=>`<text x="${xOf(yr).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#8bb0cc" font-size="10">${yr}</text>`).join('')}
    </svg>`;
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
    const mk=pts.length>=3?trend(pts):{slope:null,p:null,n:pts.length,slopeCI:null};
    const last=pts[pts.length-1];
    const basePts=pts.filter(p=>p.year>=2001&&p.year<=2010);
    const baseAvg=basePts.length?basePts.reduce((a,b)=>a+b.value,0)/basePts.length:null;
    const predVal=(last&&Number.isFinite(mk.slope))?last.value+mk.slope*(state.targetYear-last.year):null;
    const predLo=(last&&Number.isFinite(mk.slopeCI?.lower))?last.value+mk.slopeCI.lower*(state.targetYear-last.year):null;
    const predHi=(last&&Number.isFinite(mk.slopeCI?.upper))?last.value+mk.slopeCI.upper*(state.targetYear-last.year):null;
    const predDiffBase=(predVal!==null&&baseAvg!==null)?predVal-baseAvg:null;
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
      const pTarget=Number.isFinite(t.slope)&&t.n>=10?l.value+t.slope*(state.targetYear-l.year):null;
      return `<tr class="${v.key===state.varKey?'is-row-on':''}" data-pick-var="${v.key}"><td><strong>${v.name()}</strong><small>${v.unit}</small></td><td>${fmt(bAvg,v.d)}</td><td><strong>${fmt(l.value,v.d)}</strong> <small>(${l.year})</small></td><td class="${diff>0?'is-up':diff<0?'is-down':''}">${signed(diff,v.d)}</td><td>${signed(dec,v.d+1)}</td><td><strong>${pTarget!==null?fmt(pTarget,v.d):'—'}</strong></td></tr>`;
    }).join('');

    const topTip=rec.tips[0];
    const fc7=forecast?.days?.slice(0,7)||[];
    const fcTempAvg=fc7.length?fc7.reduce((s,d)=>s+(Number.isFinite(d.tempMean)?d.tempMean:0),0)/fc7.length:null;
    const fcRainSum=fc7.length?fc7.reduce((s,d)=>s+(Number.isFinite(d.precipSum)?d.precipSum:0),0):null;

    el.innerHTML=`
      <div class="sim-shell">
        <header class="sim-topbar">
          <div class="sim-brand">
            <span>GAIA E&amp;B · ${tx('FUTURE PREDICTOR & SIMULATOR','PREDICTOR FUTURO Y SIMULADOR')}</span>
            <strong>${distObj?`${siteObj.name} · ${distObj.name}`:siteObj.name}</strong>
          </div>
          <div class="sim-pickers">
            <div class="sim-picker"><label for="sim-prov">${tx('Province','Provincia')}</label><select id="sim-prov">${provs.map(p=>`<option value="${p.id}" ${p.id===siteObj.province?'selected':''}>${p.name}</option>`).join('')}</select></div>
            <div class="sim-picker"><label for="sim-canton">${tx('Canton','Cantón')}</label><select id="sim-canton"><option value="${siteObj.province}" ${siteObj.id===siteObj.province?'selected':''}>${tx('Province overview','Vista provincial')}</option>${cantons.map(c=>`<option value="${c.id}" ${c.id===siteObj.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
            ${dists.length?`<div class="sim-picker"><label for="sim-dist">${tx('District','Distrito')}</label><select id="sim-dist"><option value="">${tx('All districts','Todos')} (${dists.length})</option>${dists.map(d=>`<option value="${d.id}" ${d.id===state.district?'selected':''}>${d.name}</option>`).join('')}</select></div>`:''}
            <button type="button" id="sim-close" class="sim-close">← ${tx('Back to 3D','Volver al 3D')}</button>
          </div>
        </header>

        <section class="sim-panel">
          <div class="sim-panel-head">
            <h3>${tx('Future Prediction Based on 25 Years of NASA POWER Data','Predicción Futura basada en 25 Años de Datos NASA POWER')}</h3>
            <div class="sim-pickers">
              <select id="sim-var" style="background:#081322;color:#e8f3fb;border:1px solid rgba(56,189,248,.3);border-radius:7px;padding:6px 10px;font-size:12.5px">${VARS.map(v=>`<option value="${v.key}" ${v.key===state.varKey?'selected':''}>${v.name()} (${v.unit})</option>`).join('')}</select>
            </div>
          </div>
          <div class="sim-predict-grid">
            <div>
              ${buildChartSvg(pts,mk,state.targetYear,vMeta.unit,vMeta.d)}
              <label class="sim-slider-box" style="margin-top:8px">
                <div class="sim-slider-top"><span>${tx('Target future year','Año futuro a predecir')}</span><strong>${state.targetYear}</strong></div>
                <input id="sim-year" type="range" min="2026" max="2050" step="1" value="${state.targetYear}">
              </label>
            </div>
            <div class="sim-kpis" style="grid-template-columns:1fr 1fr">
              <article class="sim-kpi"><span>${tx('PREDICTED','PREDICCIÓN')} ${state.targetYear}</span><strong>${predVal!==null?`${fmt(predVal,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${predLo!==null?`${tx('95% range','Rango 95%')}: [${fmt(predLo,vMeta.d)}, ${fmt(predHi,vMeta.d)}]`:''}</small></article>
              <article class="sim-kpi"><span>${tx('CHANGE VS. 01–10 BASE','DIFERENCIA VS. BASE 01–10')}</span><strong>${predDiffBase!==null?`${signed(predDiffBase,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${tx('Observed slope','Tasa observada')}: ${Number.isFinite(mk.slope)?`${signed(mk.slope*10,vMeta.d+1)}/${tx('dec','déc')}`:'—'}</small></article>
              <article class="sim-kpi"><span>${tx('CURRENT + 7-DAY FORECAST','ACTUAL + PRONÓSTICO 7 DÍAS')}</span><strong>${activeCur?`${fmt(activeCur.temperature,1)} °C`:'—'}</strong><small>${fc7.length?`7d: ${fmt(fcTempAvg,1)} °C · ${fmt(fcRainSum,1)} mm`:tx('7-day series pending','Serie 7 días pendiente')}</small></article>
              <article class="sim-kpi"><span>${tx('STRESS INDEX (IEA)','ÍNDICE DE ESTRÉS (IEA)')}</span><strong>${m&&Number.isFinite(m.iea)?fmt(m.iea,2):'—'}</strong><small>${m?m.ieaLevel:'—'}</small></article>
            </div>
          </div>
          <p class="sim-footnote">${tx('Statistical projection extrapolates the observed Theil–Sen trend (2001–2025) with its 95% confidence band; short-term 7-day values come from Open-Meteo/GFS.','La proyección estadística extrapola la tendencia real Theil–Sen (2001–2025) con su banda IC 95%; los próximos 7 días provienen de Open-Meteo/GFS.')}</p>
        </section>

        <section class="sim-playground">
          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('What-if Scenario Stress Test','Simulador de Escenarios ("¿Qué pasa si…?")')}</h3></div>
            <div class="sim-presets">
              <button type="button" class="sim-preset ${!state.deltaT&&!state.deltaP?'is-on':''}" data-dt="0" data-dp="0">${tx('Real baseline','Base real')}</button>
              <button type="button" class="sim-preset ${state.deltaT===1.5&&!state.deltaP?'is-on':''}" data-dt="1.5" data-dp="0">+1.5 °C ${tx('Warming','Calor')}</button>
              <button type="button" class="sim-preset ${state.deltaT===2.5&&state.deltaP===-30?'is-on':''}" data-dt="2.5" data-dp="-30">+2.5 °C · −30% ${tx('Drought','Sequía')}</button>
              <button type="button" class="sim-preset ${!state.deltaT&&state.deltaP===50?'is-on':''}" data-dt="0" data-dp="50">+50% ${tx('Heavy rain','Temporal')}</button>
            </div>
            <label class="sim-slider-box">
              <div class="sim-slider-top"><span>${tx('Temperature shift (ΔT)','Cambio de temperatura (ΔT)')}</span><strong>${signed(state.deltaT,1)} °C</strong></div>
              <input id="sim-dt" type="range" min="-3" max="4" step="0.5" value="${state.deltaT}">
            </label>
            <label class="sim-slider-box">
              <div class="sim-slider-top"><span>${tx('Precipitation shift (ΔP)','Variación de lluvia (ΔP)')}</span><strong>${signed(state.deltaP,0)} %</strong></div>
              <input id="sim-dp" type="range" min="-50" max="80" step="10" value="${state.deltaP}">
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
          </div>
        </section>

        <section class="sim-bottom-grid">
          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('Irregularities','Irregularidades')} (${vMeta.name()})</h3></div>
            <div class="sim-anom-list">
              ${anoms.length?anoms.map(a=>`<div class="sim-anom-row"><strong>${a.year}</strong><span>${fmt(a.value,vMeta.d)} ${vMeta.unit} (${signed(a.diff,vMeta.d)})</span><span class="sim-pill ${a.z>0?'is-warm':'is-cool'}">${signed(a.z,1)}σ</span></div>`).join(''):`<small>${tx('No extreme years (|Z| ≥ 1.3) in this series.','Sin años extremos (|Z| ≥ 1,3) en esta serie.')}</small>`}
            </div>
          </div>

          <div class="sim-panel">
            <div class="sim-panel-head"><h3>${tx('Specific Data & Prediction by Variable','Datos Específicos y Predicción por Variable')}</h3></div>
            <div class="sim-table-wrap"><table class="sim-table"><thead><tr><th>${tx('Variable','Variable')}</th><th>${tx('Base 01–10','Base 01–10')}</th><th>${tx('Latest','Último')}</th><th>${tx('Diff (Δ)','Diferencia')}</th><th>${tx('Rate/dec','Tasa/déc')}</th><th>${tx('Pred.','Pred.')} ${state.targetYear}</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>
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
    el.querySelector('#sim-year').oninput=e=>{state.targetYear=+e.target.value;render();};
    el.querySelector('#sim-dt').oninput=e=>{state.deltaT=+e.target.value;render();};
    el.querySelector('#sim-dp').oninput=e=>{state.deltaP=+e.target.value;render();};
    el.querySelectorAll('.sim-preset').forEach(b=>b.onclick=()=>{state.deltaT=+b.dataset.dt;state.deltaP=+b.dataset.dp;render();});
    el.querySelectorAll('[data-pick-var]').forEach(r=>r.onclick=()=>{state.varKey=r.dataset.pickVar;render();});
  }

  function open({site,district=null}={}){if(site)state.site=site;state.district=district;el.hidden=false;render();}
  function close(){el.hidden=true;}
  return {open,close,render};
}
