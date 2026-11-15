import {fetchJSON,loadHistory} from './data-client.js';
import {trend} from './science.js';
import {publishWeather,readWeather,readSectors} from './weather-state.js';
import {buildRecommendations} from './recommendations.js';
import {buildAnnualPrediction,buildDailyPrediction,buildHourlyPrediction,buildMonthlyPrediction} from './predictor.js';
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
  const liveFetchInflight=new Map();
  let state={site:'san-jose',district:null,varKey:'T2M',horizon:'months',targetYear:2035,deltaT:0,deltaP:0};
  const fmt=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
  const signed=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d,signDisplay:'exceptZero'}).format(n):'—';

  async function getMonthly(id){
    if(monthlyCache.has(id))return monthlyCache.get(id);
    try{const m=(await loadHistory(id)).monthly;monthlyCache.set(id,m);return m;}catch{return null;}
  }

  function ensureLiveWeather(siteId){
    const cur=readWeather('current',siteId);
    const fc=readWeather('forecast',siteId);
    const curStale=!cur||!cur.observedAt||(Date.now()-Date.parse(cur.observedAt)>15*60*1000);
    const fcStale=!fc||!fc.retrievedAt||(Date.now()-Date.parse(fc.retrievedAt)>60*60*1000);
    if((!curStale&&!fcStale)||liveFetchInflight.has(siteId))return;
    const tasks=[];
    if(curStale)tasks.push(fetchJSON(`/api/current?site=${encodeURIComponent(siteId)}`).then(d=>{if(d?.site===siteId)publishWeather('current',d);}).catch(()=>{}));
    if(fcStale)tasks.push(fetchJSON(`/api/forecast?site=${encodeURIComponent(siteId)}`).then(d=>{if(d?.site===siteId&&Array.isArray(d.days))publishWeather('forecast',d);}).catch(()=>{}));
    if(!tasks.length)return;
    const work=Promise.all(tasks).finally(()=>{
      liveFetchInflight.delete(siteId);
      if(!el.hidden&&state.site===siteId)render();
    });
    liveFetchInflight.set(siteId,work);
  }

  function seriesFor(id,key){
    const start=annual?.start??2001,vals=annual?.sites?.[id]?.[key]||[];
    return vals.map((v,i)=>({year:start+i,value:v})).filter(p=>Number.isFinite(p.value));
  }

  function buildHourlySvg(hPred){
    const pts=hPred.points;
    if(pts.length<2)return `<p class="sim-footnote">${tx('Loading live 48-hour forecast from Open-Meteo…','Cargando pronóstico horario en vivo de Open-Meteo…')}</p>`;
    const W=680,H=220,padL=48,padR=20,padT=28,padB=30;
    const vals=pts.map(p=>p.value);
    let vMin=Math.min(...vals),vMax=Math.max(...vals);
    if(vMax-vMin<1e-6){vMin-=1;vMax+=1;}
    const m=(vMax-vMin)*.14;vMin-=m;vMax+=m;
    const t0=pts[0].timeMs,tSpan=Math.max(1,pts[pts.length-1].timeMs-t0);
    const xOf=t=>padL+((t-t0)/tSpan)*(W-padL-padR);
    const yOf=v=>padT+(1-(v-vMin)/(vMax-vMin))*(H-padT-padB);
    const path=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(p.timeMs).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
    const area=`${path} L${xOf(pts[pts.length-1].timeMs).toFixed(1)},${(H-padB).toFixed(1)} L${xOf(t0).toFixed(1)},${(H-padB).toFixed(1)} Z`;

    // Ordered 6-hour grid ticks (00h, 06h, 12h, 18h) with day label at midnight or first tick
    const ticks=[];
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      if(!p.isNow&&p.hour%6===0){
        const text=p.hour===0||ticks.length===0?`${p.dayName} ${p.hh}`:p.hh;
        ticks.push({x:xOf(p.timeMs),text,midnight:p.hour===0});
      }
    }
    if(!ticks.length||ticks[0].x-padL>55)ticks.unshift({x:xOf(t0),text:pts[0].label,midnight:false});

    const peakX=xOf(hPred.max.timeMs),peakY=yOf(hPred.max.value);
    const peakAnchor=peakX<padL+95?'start':peakX>W-padR-95?'end':'middle';
    const midV=(vMin+vMax)/2;
    return `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" role="img" aria-label="${tx('Live 48-hour hourly forecast','Pronóstico horario en vivo 48 h')}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${padL}" y1="${yOf(midV).toFixed(1)}" x2="${W-padR}" y2="${yOf(midV).toFixed(1)}" stroke="rgba(148,163,184,.12)" stroke-dasharray="3 3"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      ${ticks.map(t=>`<line x1="${t.x.toFixed(1)}" y1="${padT}" x2="${t.x.toFixed(1)}" y2="${H-padB}" stroke="${t.midnight?'rgba(56,189,248,.22)':'rgba(148,163,184,.08)'}" stroke-dasharray="3 3"/><text x="${t.x.toFixed(1)}" y="${H-9}" text-anchor="middle" fill="${t.midnight?'#bae6fd':'#8bb0cc'}" font-size="10">${t.text}</text>`).join('')}
      <path d="${area}" fill="rgba(56,189,248,.12)"/>
      <path d="${path}" fill="none" stroke="#38bdf8" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${xOf(t0).toFixed(1)}" cy="${yOf(pts[0].value).toFixed(1)}" r="4.5" fill="#4ade80"/>
      <circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="4" fill="#f5b316"/>
      <text x="${peakX.toFixed(1)}" y="${Math.max(15,peakY-9)}" text-anchor="${peakAnchor}" fill="#fde68a" font-size="10.5" font-weight="600">${hPred.max.label}: ${fmt(hPred.max.value,hPred.digits)} ${hPred.unit}</text>
      <text x="${padL-6}" y="${padT+4}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMax,hPred.digits)}</text>
      <text x="${padL-6}" y="${yOf(midV).toFixed(1)}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(midV,hPred.digits)}</text>
      <text x="${padL-6}" y="${H-padB}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMin,hPred.digits)}</text>
    </svg>`;
  }

  function buildDailySvg(dPred,unit,digits){
    const pts=dPred.points;
    if(pts.length<2)return `<p class="sim-footnote">${tx('Loading 7-day forecast from Open-Meteo…','Cargando pronóstico de 7 días desde Open-Meteo…')}</p>`;
    const W=680,H=210,padL=48,padR=18,padT=18,padB=28;
    const all=[...pts.map(p=>p.value),...pts.map(p=>p.lo).filter(Number.isFinite),...pts.map(p=>p.hi).filter(Number.isFinite)];
    let vMin=Math.min(...all),vMax=Math.max(...all);
    if(vMax-vMin<1e-6){vMin-=1;vMax+=1;}
    const m=(vMax-vMin)*.16;vMin-=m;vMax+=m;
    const xOf=i=>padL+(i/Math.max(1,pts.length-1))*(W-padL-padR);
    const yOf=v=>padT+(1-(v-vMin)/(vMax-vMin))*(H-padT-padB);
    const hasBand=pts.every(p=>Number.isFinite(p.lo)&&Number.isFinite(p.hi));
    const bandPoly=hasBand?[...pts.map((p,i)=>`${xOf(i).toFixed(1)},${yOf(p.hi).toFixed(1)}`),...[...pts].reverse().map((p,i)=>`${xOf(pts.length-1-i).toFixed(1)},${yOf(p.lo).toFixed(1)}`)].join(' '):'';
    const path=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" role="img" aria-label="${tx('7-day forecast','Pronóstico 7 días')}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      ${hasBand?`<polygon points="${bandPoly}" fill="rgba(245,179,22,.16)"/>`:''}
      <path d="${path}" fill="none" stroke="#f5b316" stroke-width="2.4"/>
      ${pts.map((p,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.value).toFixed(1)}" r="4" fill="#f5b316"/><text x="${xOf(i).toFixed(1)}" y="${Math.max(12,yOf(p.value)-8)}" text-anchor="middle" fill="#fde68a" font-size="10">${fmt(p.value,digits)}</text><text x="${xOf(i).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#8bb0cc" font-size="10">${p.label}</text>`).join('')}
      <text x="${padL-6}" y="${padT+8}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMax,digits)}</text>
      <text x="${padL-6}" y="${H-padB}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMin,digits)}</text>
    </svg>`;
  }

  function buildMonthlySvg(mPred,unit,digits){
    const pts=mPred.points;
    if(pts.length<3)return `<p class="sim-footnote">${tx('Monthly climatology unavailable for this site.','Climatología mensual no disponible para este sitio.')}</p>`;
    const W=680,H=210,padL=48,padR=18,padT=18,padB=28;
    const all=[...pts.map(p=>p.predicted),...pts.map(p=>p.normal),...pts.map(p=>p.p10).filter(Number.isFinite),...pts.map(p=>p.p90).filter(Number.isFinite)];
    let vMin=Math.min(...all),vMax=Math.max(...all);
    if(vMax-vMin<1e-6){vMin-=1;vMax+=1;}
    const m=(vMax-vMin)*.14;vMin-=m;vMax+=m;
    const xOf=i=>padL+(i/Math.max(1,pts.length-1))*(W-padL-padR);
    const yOf=v=>padT+(1-(v-vMin)/(vMax-vMin))*(H-padT-padB);
    const hasBand=pts.every(p=>Number.isFinite(p.p10)&&Number.isFinite(p.p90));
    const bandPoly=hasBand?[...pts.map((p,i)=>`${xOf(i).toFixed(1)},${yOf(p.p90).toFixed(1)}`),...[...pts].reverse().map((p,i)=>`${xOf(pts.length-1-i).toFixed(1)},${yOf(p.p10).toFixed(1)}`)].join(' '):'';
    const normPath=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(p.normal).toFixed(1)}`).join(' ');
    const predPath=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(i).toFixed(1)},${yOf(p.predicted).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" role="img" aria-label="${tx('12-month seasonal projection','Proyección estacional 12 meses')}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      ${hasBand?`<polygon points="${bandPoly}" fill="rgba(56,189,248,.13)"/>`:''}
      <path d="${normPath}" fill="none" stroke="#38bdf8" stroke-width="1.8" stroke-dasharray="4 3" opacity="0.8"/>
      <path d="${predPath}" fill="none" stroke="#f5b316" stroke-width="2.5"/>
      ${pts.map((p,i)=>`<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.predicted).toFixed(1)}" r="3.4" fill="#f5b316"/><text x="${xOf(i).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#8bb0cc" font-size="9.5">${i%2===0||i===pts.length-1?p.shortLabel:''}</text>`).join('')}
      <text x="${padL-6}" y="${padT+8}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMax,digits)}</text>
      <text x="${padL-6}" y="${H-padB}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMin,digits)}</text>
      <text x="${W-padR}" y="${padT+8}" text-anchor="end" fill="#fde68a" font-size="10">${tx('Amber: model · Blue dashed: 25y norm · Band: P10–P90','Ámbar: modelo · Azul: normal 25a · Banda: P10–P90')}</text>
    </svg>`;
  }

  function buildAnnualSvg(pts,annPred,targetYear,unit,digits){
    if(pts.length<3||!annPred)return `<p class="sim-footnote">${tx('Insufficient historical series for chart.','Serie histórica insuficiente para graficar.')}</p>`;
    const W=680,H=210,padL=48,padR=18,padT=18,padB=28;
    const minYYear=pts[0].year,maxYYear=Math.max(targetYear,annPred.lastYear+2);
    const last=pts[pts.length-1];
    const allVals=[...pts.map(p=>p.value),annPred.predicted,annPred.trendBand[0],annPred.trendBand[1],annPred.variabilityBand[0],annPred.variabilityBand[1]];
    let vMin=Math.min(...allVals),vMax=Math.max(...allVals);
    if(vMax-vMin<1e-6){vMin-=1;vMax+=1;}
    const margin=(vMax-vMin)*.14;vMin-=margin;vMax+=margin;
    const xOf=yr=>padL+((yr-minYYear)/Math.max(1,maxYYear-minYYear))*(W-padL-padR);
    const yOf=v=>padT+(1-(v-vMin)/(vMax-vMin))*(H-padT-padB);

    const histPath=pts.map((p,i)=>`${i===0?'M':'L'}${xOf(p.year).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');
    const xFirst=xOf(minYYear).toFixed(1),xLast=xOf(last.year).toFixed(1),xTarget=xOf(targetYear).toFixed(1);
    const yAnchorLast=yOf(annPred.anchorLast).toFixed(1),yTarget=yOf(annPred.predicted).toFixed(1);
    const varPoly=`${xLast},${yOf(annPred.anchorLast+annPred.sigma).toFixed(1)} ${xTarget},${yOf(annPred.variabilityBand[1]).toFixed(1)} ${xTarget},${yOf(annPred.variabilityBand[0]).toFixed(1)} ${xLast},${yOf(annPred.anchorLast-annPred.sigma).toFixed(1)}`;
    const ciPoly=`${xLast},${yAnchorLast} ${xTarget},${yOf(annPred.trendBand[1]).toFixed(1)} ${xTarget},${yOf(annPred.trendBand[0]).toFixed(1)}`;
    const ticks=[minYYear,Math.round((minYYear+last.year)/2),last.year,targetYear];

    return `<svg viewBox="0 0 ${W} ${H}" class="sim-svg" role="img" aria-label="${tx('Historical series and future projection','Serie histórica y proyección futura')}">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="rgba(148,163,184,.25)"/>
      <line x1="${xLast}" y1="${padT}" x2="${xLast}" y2="${H-padB}" stroke="rgba(148,163,184,.2)" stroke-dasharray="3 3"/>
      <polygon points="${varPoly}" fill="rgba(56,189,248,.11)"/>
      <polygon points="${ciPoly}" fill="rgba(245,179,22,.22)"/>
      <line x1="${xFirst}" y1="${yOf(annPred.atYear(minYYear)).toFixed(1)}" x2="${xLast}" y2="${yAnchorLast}" stroke="#f5b316" stroke-width="1.3" opacity="0.45"/>
      <path d="${histPath}" fill="none" stroke="#38bdf8" stroke-width="2.2"/>
      <line x1="${xLast}" y1="${yAnchorLast}" x2="${xTarget}" y2="${yTarget}" stroke="#f5b316" stroke-width="2.3" stroke-dasharray="5 4"/>
      <circle cx="${xTarget}" cy="${yTarget}" r="4.5" fill="#f5b316"/>
      <text x="${padL-6}" y="${padT+8}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMax,digits)}</text>
      <text x="${padL-6}" y="${H-padB}" text-anchor="end" fill="#8bb0cc" font-size="10">${fmt(vMin,digits)}</text>
      <text x="${xTarget}" y="${Math.max(12,yOf(annPred.predicted)-9)}" text-anchor="end" fill="#fde68a" font-size="11" font-weight="600">${targetYear}: ${fmt(annPred.predicted,digits)} ${unit}</text>
      ${[...new Set(ticks)].map(yr=>`<text x="${xOf(yr).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="#8bb0cc" font-size="10">${yr}</text>`).join('')}
    </svg>`;
  }

  async function render(){
    if(el.hidden)return;
    const siteObj=sites.find(s=>s.id===state.site)||sites[0];
    if(!siteObj)return;
    state.site=siteObj.id;
    ensureLiveWeather(siteObj.id);

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
    const annPred=buildAnnualPrediction(pts,mk,state.targetYear);
    const hPred=buildHourlyPrediction(forecast?.timeline,activeCur,vMeta.key,Date.now(),{todayTimeline:forecast?.todayTimeline,lang:getLang()});
    const dPred=buildDailyPrediction(forecast?.days,vMeta.key);
    const mPred=buildMonthlyPrediction(monthly,vMeta.key,{currentObs:activeCur,forecastDays:forecast?.days,annualSlope:mk.slope??0,lang:getLang()});

    const basePts=pts.filter(p=>p.year>=2001&&p.year<=2010);
    const baseAvg=basePts.length?basePts.reduce((a,b)=>a+b.value,0)/basePts.length:null;
    const meanAll=pts.length?pts.reduce((a,b)=>a+b.value,0)/pts.length:null;
    const stdAll=pts.length>2?Math.sqrt(pts.reduce((a,b)=>a+(b.value-meanAll)**2,0)/(pts.length-1)):0;
    const anoms=stdAll>1e-9?pts.map(p=>({...p,z:(p.value-meanAll)/stdAll,diff:p.value-meanAll})).filter(p=>Math.abs(p.z)>=1.3).sort((a,b)=>Math.abs(b.z)-Math.abs(a.z)).slice(0,5):[];

    let chartHtml='',kpisHtml='',footnote='';
    if(state.horizon==='hours'){
      chartHtml=buildHourlySvg(hPred);
      kpisHtml=`
        <article class="sim-kpi"><span>${tx('NOW (LIVE)','AHORA (EN VIVO)')}</span><strong>${hPred.points[0]?`${fmt(hPred.points[0].value,hPred.digits)} ${hPred.unit}`:'—'}</strong><small>${activeCur?.observedAt?new Date(activeCur.observedAt).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',timeZone:'America/Costa_Rica'}):tx('Syncing…','Sincronizando…')}</small></article>
        <article class="sim-kpi"><span>${tx('48H PEAK','PICO PRÓX. 48H')}</span><strong>${hPred.max?`${fmt(hPred.max.value,hPred.digits)} ${hPred.unit}`:'—'}</strong><small>${hPred.max?`${tx('At','A las')} ${hPred.max.label}`:''}</small></article>
        <article class="sim-kpi"><span>${tx('48H MINIMUM','MÍNIMO PRÓX. 48H')}</span><strong>${hPred.min?`${fmt(hPred.min.value,hPred.digits)} ${hPred.unit}`:'—'}</strong><small>${hPred.min?`${tx('At','A las')} ${hPred.min.label}`:''}</small></article>
        <article class="sim-kpi"><span>${vMeta.key==='PRECTOTCORR'?tx('48H ACCUMULATED','ACUMULADO 48H'):tx('48H MEAN','PROMEDIO 48H')}</span><strong>${Number.isFinite(hPred.mean)?`${fmt(vMeta.key==='PRECTOTCORR'?hPred.sum:hPred.mean,hPred.digits)} ${vMeta.key==='PRECTOTCORR'?'mm':hPred.unit}`:'—'}</strong><small>${tx('Open-Meteo hourly NWP','Modelo horario Open-Meteo')}</small></article>`;
      footnote=tx('Real-time hourly weather forecast from Open-Meteo anchored to the latest live observation.','Pronóstico horario en tiempo real de Open-Meteo anclado a la última observación en vivo.');
    }else if(state.horizon==='days'){
      chartHtml=buildDailySvg(dPred,vMeta.unit,vMeta.d);
      kpisHtml=`
        <article class="sim-kpi"><span>${tx('7-DAY MEAN','PROMEDIO 7 DÍAS')}</span><strong>${Number.isFinite(dPred.mean)?`${fmt(dPred.mean,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${tx('Open-Meteo + GFS ensemble','Open-Meteo + conjunto GFS')}</small></article>
        <article class="sim-kpi"><span>${tx('7-DAY PEAK','MÁXIMO 7 DÍAS')}</span><strong>${dPred.max?`${fmt(dPred.max.value,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${dPred.max?dPred.max.date:''}</small></article>
        <article class="sim-kpi"><span>${tx('7-DAY LOWEST','MÍNIMO 7 DÍAS')}</span><strong>${dPred.min?`${fmt(dPred.min.value,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${dPred.min?dPred.min.date:''}</small></article>
        <article class="sim-kpi"><span>${tx('7-DAY RAINFALL','LLUVIA TOTAL 7 DÍAS')}</span><strong>${forecast?.days?.length?`${fmt(forecast.days.slice(0,7).reduce((s,d)=>s+(Number.isFinite(d.PRECTOTCORR)?d.PRECTOTCORR:0),0),1)} mm`:'—'}</strong><small>${tx('STRESS (IEA)','ESTRÉS (IEA)')}: ${m&&Number.isFinite(m.iea)?fmt(m.iea,2):'—'}</small></article>`;
      footnote=tx('7-day deterministic and GFS ensemble P10–P90 forecast updated from Open-Meteo.','Pronóstico diario a 7 días y rango P10–P90 del conjunto GFS actualizado desde Open-Meteo.');
    }else if(state.horizon==='months'){
      chartHtml=buildMonthlySvg(mPred,vMeta.unit,vMeta.d);
      const nextM=mPred.points[0],peakM=mPred.points.reduce((a,b)=>!a||b.predicted>a.predicted?b:a,null),lowM=mPred.points.reduce((a,b)=>!a||b.predicted<a.predicted?b:a,null);
      kpisHtml=`
        <article class="sim-kpi"><span>${tx('NEXT MONTH','PRÓXIMO MES')} (${nextM?nextM.label:'—'})</span><strong>${nextM?`${fmt(nextM.predicted,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${nextM?`${tx('Normal','Normal')}: ${fmt(nextM.normal,vMeta.d)} ${vMeta.unit}`:''}</small></article>
        <article class="sim-kpi"><span>${tx('LIVE ANOMALY (A₀)','ANOMALÍA ACTUAL (A₀)')}</span><strong>${signed(mPred.liveAnomaly,vMeta.d)} ${vMeta.unit}</strong><small>${tx('Persistence φ','Persistencia φ')} = ${fmt(mPred.phi,2)}</small></article>
        <article class="sim-kpi"><span>${tx('SEASONAL PEAK','PICO ESTACIONAL')}</span><strong>${peakM?`${fmt(peakM.predicted,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${peakM?peakM.label:''}</small></article>
        <article class="sim-kpi"><span>${tx('SEASONAL LOW','MÍNIMO ESTACIONAL')}</span><strong>${lowM?`${fmt(lowM.predicted,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${lowM?lowM.label:''}</small></article>`;
      footnote=tx('12-month formula: y(h) = Normal_month(2001–2025) + φ^h · LiveAnomaly + Trend·(h/12), bounded by real P10–P90 climatology.','Fórmula 12 meses: y(h) = Normal_mes(2001–2025) + φ^h · AnomalíaActual + Tendencia·(h/12), con banda real P10–P90.');
    }else{
      chartHtml=`${buildAnnualSvg(pts,annPred,state.targetYear,vMeta.unit,vMeta.d)}
        <label class="sim-slider-box" style="margin-top:8px">
          <div class="sim-slider-top"><span>${tx('Target future year','Año futuro a predecir')}</span><strong>${state.targetYear}</strong></div>
          <input id="sim-year" type="range" min="2026" max="2050" step="1" value="${state.targetYear}">
        </label>`;
      const predDiffBase=(annPred&&baseAvg!==null)?annPred.predicted-baseAvg:null;
      kpisHtml=`
        <article class="sim-kpi"><span>${tx('TREND','TENDENCIA')} ${state.targetYear}</span><strong>${annPred?`${fmt(annPred.predicted,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${annPred?`${tx('95% trend CI','IC 95% tendencia')}: [${fmt(annPred.trendBand[0],vMeta.d)}, ${fmt(annPred.trendBand[1],vMeta.d)}]`:''}</small></article>
        <article class="sim-kpi"><span>${tx('YEAR-TO-YEAR SWING (±1σ)','OSCILACIÓN ANUAL (±1σ)')}</span><strong>±${annPred?`${fmt(annPred.sigma,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${annPred?`${tx('Expected range','Rango esperado')}: [${fmt(annPred.variabilityBand[0],vMeta.d)}, ${fmt(annPred.variabilityBand[1],vMeta.d)}]`:''}</small></article>
        <article class="sim-kpi"><span>${tx('CHANGE VS. 01–10 BASE','DIFERENCIA VS. BASE 01–10')}</span><strong>${predDiffBase!==null?`${signed(predDiffBase,vMeta.d)} ${vMeta.unit}`:'—'}</strong><small>${tx('Rate','Tasa')}: ${Number.isFinite(mk.slope)?`${signed(mk.slope*10,vMeta.d+1)}/${tx('dec','déc')}`:'—'}</small></article>
        <article class="sim-kpi"><span>${tx('STRESS INDEX (IEA)','ÍNDICE DE ESTRÉS (IEA)')}</span><strong>${m&&Number.isFinite(m.iea)?fmt(m.iea,2):'—'}</strong><small>${m?m.ieaLevel:'—'}</small></article>`;
      footnote=tx('Anchored Theil–Sen trend (2001–2025) with 95% slope CI (amber) and ±1σ historical interannual variability (blue).','Tendencia Theil–Sen anclada (2001–2025) con IC 95% de pendiente (ámbar) y variabilidad interanual ±1σ (azul).');
    }

    const rowsHtml=VARS.map(v=>{
      const s=seriesFor(siteObj.id,v.key);if(!s.length)return '';
      const l=s[s.length-1],b=s.filter(p=>p.year>=2001&&p.year<=2010);
      const bAvg=b.length?b.reduce((a,c)=>a+c.value,0)/b.length:null;
      const diff=bAvg!==null?l.value-bAvg:null;
      const t=s.length>=3?trend(s):{slope:null,n:s.length};
      const ap=t.n>=10?buildAnnualPrediction(s,t,state.targetYear):null;
      return `<tr class="${v.key===state.varKey?'is-row-on':''}" data-pick-var="${v.key}"><td><strong>${v.name()}</strong><small>${v.unit}</small></td><td>${fmt(bAvg,v.d)}</td><td><strong>${fmt(l.value,v.d)}</strong> <small>(${l.year})</small></td><td class="${diff>0?'is-up':diff<0?'is-down':''}">${signed(diff,v.d)}</td><td>${signed(Number.isFinite(t.slope)?t.slope*10:null,v.d+1)}</td><td><strong>${ap?fmt(ap.predicted,v.d):'—'}</strong></td></tr>`;
    }).join('');

    const topTip=rec.tips[0];
    const liveTime=activeCur?.observedAt?new Date(activeCur.observedAt).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',timeZone:'America/Costa_Rica'}):null;

    el.innerHTML=`
      <div class="sim-shell">
        <header class="sim-topbar">
          <div class="sim-brand">
            <span>GAIA E&amp;B · ${tx('REAL-TIME PREDICTOR & SIMULATOR','PREDICTOR EN TIEMPO REAL Y SIMULADOR')}</span>
            <strong>${distObj?`${siteObj.name} · ${distObj.name}`:siteObj.name}</strong>
          </div>
          <div class="sim-pickers">
            <span class="sim-live-badge"><i class="sim-live-dot"></i>${liveTime?`${tx('Live','En vivo')} · ${liveTime}`:tx('Syncing live…','Sincronizando…')}</span>
            <div class="sim-picker"><label for="sim-prov">${tx('Province','Provincia')}</label><select id="sim-prov">${provs.map(p=>`<option value="${p.id}" ${p.id===siteObj.province?'selected':''}>${p.name}</option>`).join('')}</select></div>
            <div class="sim-picker"><label for="sim-canton">${tx('Canton','Cantón')}</label><select id="sim-canton"><option value="${siteObj.province}" ${siteObj.id===siteObj.province?'selected':''}>${tx('Province overview','Vista provincial')}</option>${cantons.map(c=>`<option value="${c.id}" ${c.id===siteObj.id?'selected':''}>${c.name}</option>`).join('')}</select></div>
            ${dists.length?`<div class="sim-picker"><label for="sim-dist">${tx('District','Distrito')}</label><select id="sim-dist"><option value="">${tx('All districts','Todos')} (${dists.length})</option>${dists.map(d=>`<option value="${d.id}" ${d.id===state.district?'selected':''}>${d.name}</option>`).join('')}</select></div>`:''}
            <button type="button" id="sim-close" class="sim-close">← ${tx('Back to 3D','Volver al 3D')}</button>
          </div>
        </header>

        <section class="sim-panel">
          <div class="sim-panel-head">
            <div class="sim-horizon-tabs">
              <button type="button" class="sim-horizon-tab ${state.horizon==='hours'?'is-on':''}" data-hz="hours">${tx('Next 48h','Próximas 48 h')}</button>
              <button type="button" class="sim-horizon-tab ${state.horizon==='days'?'is-on':''}" data-hz="days">${tx('Next 7 days','Próximos 7 días')}</button>
              <button type="button" class="sim-horizon-tab ${state.horizon==='months'?'is-on':''}" data-hz="months">${tx('Next 12 months','Próximos 12 meses')}</button>
              <button type="button" class="sim-horizon-tab ${state.horizon==='years'?'is-on':''}" data-hz="years">${tx('Next years (2026–2050)','Próximos años')}</button>
            </div>
            <div class="sim-pickers">
              <select id="sim-var" style="background:#081322;color:#e8f3fb;border:1px solid rgba(56,189,248,.3);border-radius:7px;padding:6px 10px;font-size:12.5px">${VARS.map(v=>`<option value="${v.key}" ${v.key===state.varKey?'selected':''}>${v.name()} (${v.unit})</option>`).join('')}</select>
            </div>
          </div>
          <div class="sim-predict-grid">
            <div>${chartHtml}</div>
            <div class="sim-kpis" style="grid-template-columns:1fr 1fr">${kpisHtml}</div>
          </div>
          <p class="sim-footnote">${footnote}</p>
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
    el.querySelector('#sim-year')?.addEventListener('input',e=>{state.targetYear=+e.target.value;render();});
    el.querySelector('#sim-dt').oninput=e=>{state.deltaT=+e.target.value;render();};
    el.querySelector('#sim-dp').oninput=e=>{state.deltaP=+e.target.value;render();};
    el.querySelectorAll('[data-hz]').forEach(b=>b.onclick=()=>{state.horizon=b.dataset.hz;render();});
    el.querySelectorAll('.sim-preset').forEach(b=>b.onclick=()=>{state.deltaT=+b.dataset.dt;state.deltaP=+b.dataset.dp;render();});
    el.querySelectorAll('[data-pick-var]').forEach(r=>r.onclick=()=>{state.varKey=r.dataset.pickVar;render();});
  }

  function open({site,district=null}={}){if(site)state.site=site;state.district=district;el.hidden=false;render();}
  function close(){el.hidden=true;}
  return {open,close,render};
}
