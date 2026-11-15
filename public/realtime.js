import {loadHistory} from './data-client.js';
import {publishWeather,readWeather,publishSectors} from './weather-state.js';
import {buildRecommendations} from './recommendations.js';
import {getLang,locale,tx} from './i18n.js';
import {icon} from './icons.js';

const section=document.createElement('section');section.id='tiempo-actual';section.className='forecast-panel current-panel';
document.querySelector('#pronostico').before(section);

function buildSectionShell(){
  section.innerHTML=`<div class="history-heading"><div><div class="eyebrow">${tx('Current Context vs. 2001–2010 Baseline','Contexto actual vs. base 2001–2010')}</div><h2>${tx('Today vs. historical baseline','Hoy frente a la base histórica')}</h2></div><button id="current-refresh" class="outline-button">${icon('refresh')} ${tx('Query conditions','Consultar condiciones')}</button></div><p id="current-status" role="status">${tx('Connecting to atmospheric model…','Conectando con el modelo atmosférico…')}</p><div id="current-values" class="forecast-metrics"></div><p id="current-time" class="forecast-unit-note"></p><p class="forecast-unit-note">${tx('Conditions estimated by weather models for the reference point, not direct measurements from a local station. Precipitation corresponds to the preceding interval indicated. Solar radiation and soil moisture are model estimates, not direct measurements.','Condiciones estimadas por modelos meteorológicos para el punto de referencia, no mediciones directas de una estación local. La precipitación corresponde al intervalo precedente indicado. Radiación y humedad del suelo son estimaciones del modelo, no mediciones directas.')}</p><p class="forecast-unit-note"><a href="/credits.html">${tx('Sources & licenses','Fuentes y licencias')} ${icon('arrow-up-right')}</a> · ${tx('Historical: NASA POWER. Shared queries reduce traffic; the button respects the cache window.','Histórico: NASA POWER. Consultas compartidas para reducir consumo; el botón respeta el período de caché.')}</p>`;
}
buildSectionShell();

const $=s=>document.querySelector(s),cache=new Map(),pending=new Map();let site=null,sequence=0;
const download=document.createElement('button');download.className='outline-button';download.disabled=true;
function attachDownload(){
  download.innerHTML=`${icon('download')} ${tx('Export conditions CSV','Exportar condiciones CSV')}`;
  section.querySelector('.history-heading').append(download);
}
attachDownload();
download.onclick=()=>{
  const d=cache.get(site)?.value;if(!d)return;
  const fields=['site','observedAt','retrievedAt','temperature','feelsLike','humidity','pressure','pressureReference','precipitationDirection','windSpeed','clouds','precipitation','intervalSeconds','solarRadiation','soilMoisture'];
  const rows=['# GaiaTrack | Model-estimated conditions, not a local weather station',`# Source: ${d.sourceUrl}`,'# Units: temperature C; humidity %; pressure hPa; wind m/s; clouds %; modeled precipitation mm over preceding intervalSeconds; radiation W/m2; soil m3/m3',fields.join(','),fields.map(k=>d[k]??'').join(',')];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`GaiaTrack_current_${d.site}_${d.observedAt.slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};

window.addEventListener('online',()=>load());
const fmt=(n,unit)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{maximumFractionDigits:unit==='m³/m³'?3:1}).format(n)+' '+unit:tx('Not reported','No reportado');
const hasFullTelemetry=v=>Boolean(v&&[v.feelsLike,v.humidity,v.pressure,v.windSpeed,v.clouds].some(Number.isFinite));
function hud(text){let el=$('.flight-live');if(!el&&$('.flight-panel')){el=document.createElement('div');el.className='flight-live';$('.flight-panel').insertBefore(el,$('.flight-panel h2'));}if(el)el.textContent=text;}

function paint(result){
  download.disabled=false;publishWeather('current',result);
  $('#current-status').textContent=result.name+' · '+tx('model-estimated conditions','condiciones estimadas por el modelo');
  $('#current-values').replaceChildren();
  const intervalMin=result.intervalSeconds?result.intervalSeconds/60:15;
  const fields=[
    [tx('Temperature','Temperatura'),result.temperature,'°C'],
    [tx('Feels like','Sensación térmica'),result.feelsLike,'°C'],
    [tx('Relative humidity','Humedad del aire'),result.humidity,'%'],
    [tx('Surface pressure','Presión superficial'),result.pressure,'hPa'],
    [tx('Wind at 10 m','Viento a 10 m'),result.windSpeed,'m/s'],
    [tx('Cloud cover','Nubosidad'),result.clouds,'%'],
    [tx('Precipitation','Precipitación')+(result.intervalSeconds?tx(' · last '+intervalMin+' min',' · últimos '+intervalMin+' min'):''),result.precipitation,'mm'],
    [tx('Solar radiation','Radiación solar'),result.solarRadiation,'W/m²'],
    [tx('Soil moisture · 0–1 cm','Humedad del suelo · 0–1 cm'),result.soilMoisture,'m³/m³']
  ];
  for(const [name,value,unit] of fields){const item=document.createElement('div'),label=document.createElement('span'),reading=document.createElement('strong');label.textContent=name;reading.textContent=fmt(value,unit);item.append(label,reading);$('#current-values').append(item);}
  const stamp=new Date(result.observedAt).toLocaleString(locale(),{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'});
  const age=Date.now()-Date.parse(result.observedAt);
  $('#current-time').textContent=tx(
    `Model valid time: ${stamp} (Costa Rica). Query retrieved: ${new Date(result.retrievedAt).toLocaleTimeString(locale(),{timeZone:'America/Costa_Rica'})}. Model updated: ${result.modelUpdatedAt?new Date(result.modelUpdatedAt).toLocaleString(locale(),{timeZone:'America/Costa_Rica'}):'Not reported'}. Shared cache: up to 15 minutes.${age>3600000?' Warning: reading is over one hour old.':''}`,
    `Hora válida del modelo: ${stamp} (Costa Rica). Consulta original: ${new Date(result.retrievedAt).toLocaleTimeString(locale(),{timeZone:'America/Costa_Rica'})}. Modelo actualizado: ${result.modelUpdatedAt?new Date(result.modelUpdatedAt).toLocaleString(locale(),{timeZone:'America/Costa_Rica'}):'No reportado'}. Caché compartida: hasta 15 minutos.${age>3600000?' Atención: el dato tiene más de una hora de antigüedad.':''}`
  );
  hud(tx('TELEMETRY','TELEMETRÍA')+' · '+fmt(result.temperature,'°C')+' · '+new Date(result.observedAt).toLocaleTimeString(locale(),{timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit'})+(age>3600000?tx(' · STALE DATA',' · DATO ANTIGUO'):''));
}

async function load(){
  download.disabled=true;
  if(!site){
    sequence++;
    $('#current-status').textContent=tx('Choose a province or canton to query local telemetry. National summary below:','Elige una provincia o cantón para consultar su telemetría local. Resumen nacional abajo:');
    $('#current-values').replaceChildren();$('#current-time').textContent='';recSection.replaceChildren();$('#current-refresh').disabled=false;
    return;
  }
  const requested=site,token=++sequence,stored=cache.get(requested);
  if(stored&&Date.now()-stored.time<900000&&(stored.error||hasFullTelemetry(stored.value))){
    if(stored.error){$('#current-status').textContent=stored.error;hud(tx('TELEMETRY · UNAVAILABLE','TELEMETRÍA · NO DISPONIBLE'));}
    else paint(stored.value);
    $('#current-refresh').disabled=false;return;
  }
  $('#current-status').textContent=tx('Querying current conditions…','Consultando condiciones actuales…');
  $('#current-refresh').disabled=true;$('#current-values').replaceChildren();$('#current-time').textContent='';
  hud(tx('TELEMETRY · QUERYING…','TELEMETRÍA · CONSULTANDO…'));
  try{
    if(!pending.has(requested)){
      const query=fetch('/api/current?site='+encodeURIComponent(requested)).then(async response=>{
        const result=await response.json();
        if(!response.ok)throw Error(result.error||tx('Could not query current conditions.','No se pudieron consultar las condiciones actuales.'));
        cache.set(requested,{time:Date.parse(result.retrievedAt),value:result});return result;
      }).finally(()=>pending.delete(requested));
      pending.set(requested,query);
    }
    const result=await pending.get(requested);if(token===sequence)paint(result);
  }catch(e){
    cache.set(requested,{time:Date.now()-840000,error:e.message});
    if(token!==sequence)return;$('#current-status').textContent=e.message;
    hud(tx('TELEMETRY · UNAVAILABLE','TELEMETRÍA · NO DISPONIBLE'));
  }finally{if(token===sequence)$('#current-refresh').disabled=false;}
}

const provinces=['san-jose','alajuela','cartago','heredia','guanacaste','puntarenas','limon'];
const summary=document.createElement('div');summary.id='country-live';summary.className='forecast-metrics';summary.style.marginTop='18px';
const recSection=document.createElement('div');recSection.id='recomendaciones';recSection.className='rec-box';
function mountExtras(){
  section.querySelector('#current-time').after(summary);
  summary.after(recSection);
}
mountExtras();

const monthlyCache=new Map(),scenario={deltaT:0,deltaPPercent:0};
async function loadMonthly(id){try{return (await loadHistory(id)).monthly;}catch{return null;}}
const fmtNum=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{maximumFractionDigits:d,signDisplay:'exceptZero'}).format(n):'—';
const fmtPlain=(n,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';

function renderEpMetricsInner(metrics,scaleTag){
  const monthName=new Intl.DateTimeFormat(locale(),{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2025,(metrics.month||1)-1,15)));
  return `<div><span>${tx('EXPERIMENTAL IEA','IEA EXPERIMENTAL')}</span><strong>${Number.isFinite(metrics.iea)?metrics.iea.toFixed(2):'—'}</strong><small>${metrics.ieaLevel} · ${metrics.activeIndicators} ${tx('indicators','indicadores')}</small><span class="ep-scale-note">${tx('Average of thermal (Iₜ), rain-deficit (Iₚ) & dry-soil (Iₛ) Z-scores; ≥ 0.35 indicates stress.','Promedio de Z-scores de calor (Iₜ), déficit de lluvia (Iₚ) y suelo seco (Iₛ); ≥ 0,35 indica estrés.')}</span></div>`
    +`<div><span>${tx('THERMAL ANOMALY (Aₜ)','ANOMALÍA TÉRMICA (Aₜ)')}</span><strong>${fmtNum(metrics.anomalies.tempC,1)} °C</strong><small>${tx(`Active ${fmtPlain(metrics.observed.t,1)} °C vs. ${monthName} norm ${fmtPlain(metrics.refs.t.mean,1)} °C · Z = ${fmtNum(metrics.indicators.I_T,2)}`,`Activo ${fmtPlain(metrics.observed.t,1)} °C vs. normal de ${monthName} (${fmtPlain(metrics.refs.t.mean,1)} °C) · Z = ${fmtNum(metrics.indicators.I_T,2)}`)}</small><span class="ep-scale-note">${scaleTag}</span></div>`
    +`<div><span>${tx('RAINFALL ANOMALY (Aₚ%)','ANOMALÍA LLUVIA (Aₚ%)')}</span><strong>${Number.isFinite(metrics.anomalies.precipPct)?fmtNum(metrics.anomalies.precipPct,0)+' %':fmtNum(metrics.anomalies.precipAbs,2)+' mm/d'}</strong><small>${tx(`Active ${fmtPlain(metrics.observed.p,2)} vs. NASA avg ${fmtPlain(metrics.refs.p.mean,2)} mm/d · Iₚ = ${fmtNum(metrics.indicators.I_P,2)} · Iₛ = ${fmtNum(metrics.indicators.I_S,2)}`,`Activo ${fmtPlain(metrics.observed.p,2)} vs. prom. NASA ${fmtPlain(metrics.refs.p.mean,2)} mm/d · Iₚ = ${fmtNum(metrics.indicators.I_P,2)} · Iₛ = ${fmtNum(metrics.indicators.I_S,2)}`)}</small><span class="ep-scale-note">${tx(`NASA ${metrics.historyYear} vs 2001–2025 · Iₚ > 0 means drier than usual`,`NASA ${metrics.historyYear} vs 2001–2025 · Iₚ > 0 indica menos lluvia de lo normal`)}</span></div>`
    +`<div><span>${tx('CORRELATION r(T, P)','CORRELACIÓN r(T, P)')}</span><strong>${Number.isFinite(metrics.pearsonTP)?metrics.pearsonTP.toFixed(2):'—'}</strong><small>${tx('Month-to-month relationship between temperature and rain (2001–2025)','Relación histórica mes a mes entre temperatura y lluvia (2001–2025)')}</small><span class="ep-scale-note">${tx('r < 0: drier years for this month tend to be warmer · not causation','r < 0: meses más secos suelen ser más cálidos · no implica causalidad')}</span></div>`;
}

function simSummaryHtml(metrics){
  const deltaIea=Number.isFinite(metrics.iea)&&Number.isFinite(metrics.baseIea)?metrics.iea-metrics.baseIea:null;
  const dtReadout=tx(
    `Base: ${fmtPlain(metrics.baseObserved?.t,1)} °C → Simulated: <b>${fmtPlain(metrics.observed.t,1)} °C</b> (NASA norm: ${fmtPlain(metrics.refs.t.mean,1)} °C)`,
    `Base: ${fmtPlain(metrics.baseObserved?.t,1)} °C → Simulado: <b>${fmtPlain(metrics.observed.t,1)} °C</b> (Normal NASA: ${fmtPlain(metrics.refs.t.mean,1)} °C)`
  );
  const dpReadout=tx(
    `Base: ${fmtPlain(metrics.baseObserved?.p,2)} mm/d → Simulated: <b>${fmtPlain(metrics.observed.p,2)} mm/d</b> (NASA norm: ${fmtPlain(metrics.refs.p.mean,2)} mm/d)`,
    `Base: ${fmtPlain(metrics.baseObserved?.p,2)} mm/d → Simulado: <b>${fmtPlain(metrics.observed.p,2)} mm/d</b> (Normal NASA: ${fmtPlain(metrics.refs.p.mean,2)} mm/d)`
  );
  const summary=tx(
    `<strong>Simulated effect:</strong> Base IEA ${fmtPlain(metrics.baseIea,2)} → Simulated IEA <b class="${metrics.isScenario?'is-active':''}">${fmtPlain(metrics.iea,2)}</b>${deltaIea!==null?` (shift ${fmtNum(deltaIea,2)} · ${metrics.ieaLevel})`:''}. Soil moisture Iₛ stays at its latest NASA record (${fmtPlain(metrics.observed.sm,2)} index 0–1, distinct from Open-Meteo m³/m³); recommendation cards below update live.`,
    `<strong>Efecto simulado:</strong> IEA base ${fmtPlain(metrics.baseIea,2)} → IEA simulado <b class="${metrics.isScenario?'is-active':''}">${fmtPlain(metrics.iea,2)}</b>${deltaIea!==null?` (cambio ${fmtNum(deltaIea,2)} · ${metrics.ieaLevel})`:''}. La humedad del suelo Iₛ se mantiene en su último cierre NASA (índice ${fmtPlain(metrics.observed.sm,2)} en escala 0–1, distinta de m³/m³ de Open-Meteo); los consejos de abajo se recalculan al instante.`
  );
  return {dtReadout,dpReadout,summary};
}

async function renderRecs(result,{fromSlider=false}={}){
  if(!result)return;
  const monthly=await loadMonthly(result.site);
  if(site!==result.site)return;
  const forecastDays=readWeather('forecast',result.site)?.days||[];
  const {profile,metrics,tips}=buildRecommendations(result.site,result,forecastDays,{monthly,scenario:(scenario.deltaT||scenario.deltaPPercent)?scenario:null,lang:getLang()});
  const scaleTag=metrics?(metrics.tempScale==='daily-24h'
    ?tx('Uses 24h forecast mean vs. 24h NASA baseline (aligned scales)','Usa media diaria de 24 h vs. línea base NASA de 24 h (escalas alineadas)')
    :metrics.tempScale==='instant'
      ?tx('Instant reading vs. 24h monthly mean','Lectura puntual vs. media mensual de 24 h')
      :tx(`NASA ${metrics.historyYear} vs 2001–2025`,`NASA ${metrics.historyYear} vs 2001–2025`)):'';

  if(fromSlider&&metrics&&recSection.querySelector('#ep-metrics-slot')){
    const {dtReadout,dpReadout,summary}=simSummaryHtml(metrics);
    recSection.querySelector('#ep-metrics-slot').innerHTML=renderEpMetricsInner(metrics,scaleTag);
    const dtVal=recSection.querySelector('#sc-dt-val');if(dtVal)dtVal.textContent=`${fmtNum(scenario.deltaT,1)} °C`;
    const dpVal=recSection.querySelector('#sc-dp-val');if(dpVal)dpVal.textContent=`${fmtNum(scenario.deltaPPercent,0)} %`;
    const dtOut=recSection.querySelector('#ep-dt-readout');if(dtOut)dtOut.innerHTML=dtReadout;
    const dpOut=recSection.querySelector('#ep-dp-readout');if(dpOut)dpOut.innerHTML=dpReadout;
    const simOut=recSection.querySelector('#ep-sim-summary');if(simOut)simOut.innerHTML=summary;
    const recGrid=recSection.querySelector('.rec-grid');if(recGrid)recGrid.innerHTML=tips.map(t=>`<article class="rec-card tone-${t.tone}"><span>${t.tag}</span><strong>${t.title}</strong><p>${t.body}</p></article>`).join('');
    return;
  }

  let epHtml='';
  if(metrics){
    const monthName=new Intl.DateTimeFormat(locale(),{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2025,(metrics.month||1)-1,15)));
    const {dtReadout,dpReadout,summary}=simSummaryHtml(metrics);
    epHtml=`<div class="ep-explainer"><p>${tx(
      `<strong>What are you seeing?</strong> Earth Pulse compares ${result.name}'s current thermal and moisture state against its own historical NASA POWER average for <b>${monthName} (2001–2025)</b>. Each indicator is expressed as a <b>Z-score</b> (standard deviations away from normal for this month) and averaged into the <b>IEA</b>: values &lt; 0 indicate cool/wet surplus, −0.35 to +0.35 normal conditions, +0.35 to +0.99 moderate stress, and ≥ 1.00 elevated stress.`,
      `<strong>¿Qué estás viendo aquí?</strong> Earth Pulse compara las condiciones actuales de ${result.name} contra su propio promedio histórico NASA POWER para <b>${monthName} (2001–2025)</b>. Cada indicador se expresa como <b>Z-score</b> (cuántas desviaciones estándar se aleja de lo habitual en este mes) y se resume en el <b>IEA</b>: &lt; 0 indica holgura fresca/húmeda, −0,35 a +0,35 rango habitual, +0,35 a +0,99 estrés moderado y ≥ 1,00 estrés elevado.`
    )}</p></div>`
    +`<div id="ep-metrics-slot" class="ep-metrics">${renderEpMetricsInner(metrics,scaleTag)}</div>`
    +`<div class="ep-scenario"><div class="ep-scenario-head"><div><span class="eyebrow">${tx('SCENARIO SIMULATOR (WHAT IF…?)','SIMULADOR DE ESCENARIOS (¿QUÉ PASARÍA SI…?)')}</span><p>${tx('These sliders do not alter real data: they apply hypothetical shifts to test how the territory\'s thermal anomaly, rainfall anomaly, IEA stress index, and recommendations respond against the same historical baseline for this month.','Estos controles no alteran datos reales: aplican variaciones hipotéticas para explorar cómo responderían las anomalías, el índice de estrés IEA y los consejos usando la misma línea base histórica del mes.')}</p></div><button type="button" id="sc-reset" class="text-button">${icon('refresh')} ${tx('Reset to real baseline','Restablecer datos base')}</button></div>`
    +`<div class="ep-scenario-grid"><label class="ep-slider-card"><div class="ep-slider-top"><span>${tx('ΔT · Hypothetical temperature shift','ΔT · Cambio hipotético de temperatura')}</span><strong id="sc-dt-val">${fmtNum(scenario.deltaT,1)} °C</strong></div><input id="sc-dt" type="range" min="-3" max="4" step="0.5" value="${scenario.deltaT}"><span id="ep-dt-readout" class="ep-sim-readout">${dtReadout}</span><small>${tx('Adds or subtracts °C relative to the current 24h thermal reference to simulate heatwaves (+) or cooler periods (−), shifting Z-score Iₜ.','Suma o resta °C sobre la referencia térmica actual de 24 h para probar olas de calor (+) o enfriamiento (−), ajustando el Z-score Iₜ.')}</small></label>`
    +`<label class="ep-slider-card"><div class="ep-slider-top"><span>${tx('ΔP · Hypothetical monthly rain change','ΔP · Variación porcentual de lluvia')}</span><strong id="sc-dp-val">${fmtNum(scenario.deltaPPercent,0)} %</strong></div><input id="sc-dp" type="range" min="-50" max="80" step="10" value="${scenario.deltaPPercent}"><span id="ep-dp-readout" class="ep-sim-readout">${dpReadout}</span><small>${tx('Scales the latest NASA monthly rainfall rate (mm/day) by percentage: negative values test drought stress and positive values test wet excess (Iₚ).','Escala por porcentaje la tasa diaria de lluvia del cierre NASA (mm/día): valores negativos simulan sequía y positivos exceso hídrico (Iₚ).')}</small></label></div>`
    +`<p id="ep-sim-summary" class="ep-sim-summary">${summary}</p></div>`;
  }

  recSection.innerHTML=`<div class="rec-head"><div><span class="eyebrow">${tx('ECOLOGICAL & CLIMATE ENGINE · EARTH PULSE','MOTOR ECOLÓGICO Y CLIMÁTICO · EARTH PULSE')}</span><h3>${result.name} · ${profile.zone}</h3></div></div>${epHtml}<div class="rec-grid">${tips.map(t=>`<article class="rec-card tone-${t.tone}"><span>${t.tag}</span><strong>${t.title}</strong><p>${t.body}</p></article>`).join('')}</div>${metrics?`<p class="ep-note">${metrics.ieaNote} ${tx('Simple hypothetical scenarios: they do not by themselves predict real ecosystem responses.','Escenarios hipotéticos sencillos: no predicen por sí solos la respuesta real del ecosistema.')}</p>`:''}`;
  recSection.querySelector('#sc-dt')?.addEventListener('input',e=>{scenario.deltaT=+e.target.value;renderRecs(result,{fromSlider:true});});
  recSection.querySelector('#sc-dp')?.addEventListener('input',e=>{scenario.deltaPPercent=+e.target.value;renderRecs(result,{fromSlider:true});});
  recSection.querySelector('#sc-reset')?.addEventListener('click',()=>{scenario.deltaT=0;scenario.deltaPPercent=0;renderRecs(result);});
}

document.addEventListener('gaiatrack:weather-data',e=>{
  if((e.detail.kind==='current'||e.detail.kind==='forecast')&&e.detail.site===site&&cache.get(site)?.value){
    renderRecs(cache.get(site).value);
  }
});

let countryPending=null;
function paintCountrySummary(){
  summary.replaceChildren();
  for(const id of provinces){
    const d=cache.get(id)?.value;if(!d)continue;
    const card=document.createElement('div'),label=document.createElement('span'),val=document.createElement('strong'),sub=document.createElement('small');
    label.textContent=d.name;val.textContent=fmt(d.temperature,'°C');
    sub.textContent=`${tx('Clouds','Nubes')} ${fmt(d.clouds,'%')} · ${tx('Rain','Lluvia')} ${fmt(d.precipitation,'mm')}`;
    card.append(label,val,sub);summary.append(card);
  }
}

async function loadCountry(){
  try{
    const fresh=provinces.every(id=>{const s=cache.get(id);return s&&Date.now()-s.time<900000&&!s.error&&hasFullTelemetry(s.value);});
    if(!fresh){
      countryPending??=fetch('/api/current?site=all').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).finally(()=>{countryPending=null;});
      const batch=await countryPending;
      for(const d of batch.sites||[]){
        const prev=cache.get(d.site);
        if(!hasFullTelemetry(d)&&prev&&Date.now()-prev.time<900000&&hasFullTelemetry(prev.value))continue;
        cache.set(d.site,{time:Date.parse(d.retrievedAt),value:d});publishWeather('current',d);if(d.site===site)paint(d);
      }
      if(Array.isArray(batch.sectors)){
        const byParent=new Map();
        for(const s of batch.sectors){if(!byParent.has(s.parent))byParent.set(s.parent,[]);byParent.get(s.parent).push(s);}
        for(const [parent,list] of byParent)publishSectors(parent,list);
      }
    }
  }catch{}
  paintCountrySummary();
}

function wireRefresh(){$('#current-refresh').onclick=()=>{load();loadCountry();};}
wireRefresh();

document.addEventListener('gaiatrack:lang',()=>{
  buildSectionShell();
  attachDownload();
  mountExtras();
  wireRefresh();
  const cached=cache.get(site)?.value;
  if(cached){paint(cached);renderRecs(cached);}
  else load();
  paintCountrySummary();
});

document.addEventListener('gaiatrack:selection',e=>{const next=e.detail.site||null;const changed=site!==next;site=next;if(changed)load();});
setInterval(()=>{if(!document.hidden){load();loadCountry();}},900000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();loadCountry();}});
load();loadCountry();
