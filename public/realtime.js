import {publishWeather,readWeather} from './weather-state.js';
import {buildRecommendations,nearestSite} from './recommendations.js';
import {getLang,locale,tx} from './i18n.js';

const section=document.createElement('section');section.id='tiempo-actual';section.className='forecast-panel current-panel';
document.querySelector('#pronostico').before(section);

function buildSectionShell(){
  section.innerHTML=`<div class="history-heading"><div><div class="eyebrow">${tx('TELEMETRY / CURRENT CONDITIONS','TELEMETRÍA / CONDICIONES ACTUALES')}</div><h2>${tx('The pulse right now','El pulso de ahora')}<span>.</span></h2></div><button id="current-refresh" class="outline-button">${tx('↻ Query conditions','↻ Consultar condiciones')}</button></div><p id="current-status" role="status">${tx('Connecting to atmospheric model…','Conectando con el modelo atmosférico…')}</p><div id="current-values" class="forecast-metrics"></div><p id="current-time" class="forecast-unit-note"></p><p class="forecast-unit-note">${tx('Conditions estimated by weather models for the reference point, not direct measurements from a local station. Precipitation corresponds to the preceding interval indicated. Solar radiation and soil moisture are model estimates, not direct measurements.','Condiciones estimadas por modelos meteorológicos para el punto de referencia, no mediciones directas de una estación local. La precipitación corresponde al intervalo precedente indicado. Radiación y humedad del suelo son estimaciones del modelo, no mediciones directas.')}</p><p class="forecast-unit-note"><a href="/credits.html">${tx('Sources & licenses ↗','Fuentes y licencias ↗')}</a> · ${tx('Historical: NASA POWER. Shared queries reduce traffic; the button respects the cache window.','Histórico: NASA POWER. Consultas compartidas para reducir consumo; el botón respeta el período de caché.')}</p>`;
}
buildSectionShell();

const $=s=>document.querySelector(s),cache=new Map(),pending=new Map();let site='heredia',sequence=0;
const download=document.createElement('button');download.className='outline-button';download.disabled=true;
function attachDownload(){
  download.textContent=tx('↓ Export conditions CSV','↓ Exportar condiciones CSV');
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
  download.disabled=true;const requested=site,token=++sequence,stored=cache.get(requested);
  if(stored&&Date.now()-stored.time<900000){
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
async function loadMonthly(id){if(monthlyCache.has(id))return monthlyCache.get(id);try{const r=await fetch(`data/${id}.json`);if(!r.ok)return null;const d=await r.json();monthlyCache.set(id,d.monthly);return d.monthly;}catch{return null;}}
const fmtNum=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{maximumFractionDigits:d,signDisplay:'exceptZero'}).format(n):'—';

async function renderRecs(result){
  if(!result)return;
  const monthly=await loadMonthly(result.site);
  const forecastDays=readWeather('forecast',result.site)?.days||[];
  const {profile,metrics,tips}=buildRecommendations(result.site,result,forecastDays,{monthly,scenario:(scenario.deltaT||scenario.deltaPPercent)?scenario:null,lang:getLang()});
  const scaleTag=metrics?(metrics.tempScale==='daily-24h'
    ?tx('24h daily mean vs 2001–2025','Media diaria 24 h vs 2001–2025')
    :metrics.tempScale==='instant'
      ?tx('Instant reading vs 24h mean','Lectura puntual vs media 24 h')
      :tx(`NASA ${metrics.historyYear} vs 2001–2025`,`NASA ${metrics.historyYear} vs 2001–2025`)):'';
  const epHtml=metrics?`<div class="ep-metrics"><div><span>${tx('EXPERIMENTAL IEA','IEA EXPERIMENTAL')}</span><strong>${Number.isFinite(metrics.iea)?metrics.iea.toFixed(2):'—'}</strong><small>${metrics.ieaLevel} · ${metrics.activeIndicators} ${tx('indicators','indicadores')}</small></div><div><span>${tx('THERMAL ANOMALY (Aₜ)','ANOMALÍA TÉRMICA (Aₜ)')}</span><strong>${fmtNum(metrics.anomalies.tempC,1)} °C</strong><small>${tx('Month','Mes')} ${metrics.month} · Z = ${fmtNum(metrics.indicators.I_T,2)}</small><span class="ep-scale-note">${scaleTag}</span></div><div><span>${tx('RAINFALL ANOMALY (Aₚ%)','ANOMALÍA LLUVIA (Aₚ%)')}</span><strong>${Number.isFinite(metrics.anomalies.precipPct)?fmtNum(metrics.anomalies.precipPct,0)+' %':fmtNum(metrics.anomalies.precipAbs,2)+' mm/d'}</strong><small>Iₚ = ${fmtNum(metrics.indicators.I_P,2)} · Iₛ = ${fmtNum(metrics.indicators.I_S,2)}</small><span class="ep-scale-note">${tx(`NASA closure ${metrics.historyYear} vs 2001–2025`,`Cierre NASA ${metrics.historyYear} vs 2001–2025`)}</span></div><div><span>${tx('CORRELATION r(T, P)','CORRELACIÓN r(T, P)')}</span><strong>${Number.isFinite(metrics.pearsonTP)?metrics.pearsonTP.toFixed(2):'—'}</strong><small>${tx('Monthly association · not causation','Asociación mensual · no implica causalidad')}</small></div></div>
  <div class="ep-scenario"><div><span class="eyebrow">${tx('SCENARIO SIMULATOR (EARTH PULSE)','SIMULADOR DE ESCENARIOS (EARTH PULSE)')}</span><small>${tx('Adjust ΔT and ΔP to recompute anomalies, IEA stress, and advice against the same monthly historical baseline.','Ajustá ΔT y ΔP para recalcular anomalías, IEA y consejos usando la misma referencia histórica del mes.')}</small></div><label>ΔT: <strong id="sc-dt-val">${fmtNum(scenario.deltaT,1)} °C</strong><input id="sc-dt" type="range" min="-3" max="4" step="0.5" value="${scenario.deltaT}"></label><label>ΔP: <strong id="sc-dp-val">${fmtNum(scenario.deltaPPercent,0)} %</strong><input id="sc-dp" type="range" min="-50" max="80" step="10" value="${scenario.deltaPPercent}"></label><button type="button" id="sc-reset" class="text-button">${tx('Reset','Restablecer')}</button></div>`:'';

  recSection.innerHTML=`<div class="rec-head"><div><span class="eyebrow">${tx('ECOLOGICAL & CLIMATE ENGINE · EARTH PULSE','MOTOR ECOLÓGICO Y CLIMÁTICO · EARTH PULSE')}</span><h3>${result.name} · ${profile.zone}</h3></div><button type="button" id="rec-locate" class="outline-button">${tx('📍 Detect my location','📍 Detectar mi ubicación')}</button></div>${epHtml}<div class="rec-grid">${tips.map(t=>`<article class="rec-card tone-${t.tone}"><span>${t.tag}</span><strong>${t.title}</strong><p>${t.body}</p></article>`).join('')}</div>${metrics?`<p class="ep-note">${metrics.ieaNote} ${tx('Simple hypothetical scenarios: they do not by themselves predict real ecosystem responses.','Escenarios hipotéticos sencillos: no predicen por sí solos la respuesta real del ecosistema.')}</p>`:''}`;
  recSection.querySelector('#sc-dt')?.addEventListener('input',e=>{scenario.deltaT=+e.target.value;renderRecs(result);});
  recSection.querySelector('#sc-dp')?.addEventListener('input',e=>{scenario.deltaPPercent=+e.target.value;renderRecs(result);});
  recSection.querySelector('#sc-reset')?.addEventListener('click',()=>{scenario.deltaT=0;scenario.deltaPPercent=0;renderRecs(result);});
  recSection.querySelector('#rec-locate').onclick=()=>{
    const b=recSection.querySelector('#rec-locate');
    if(!navigator.geolocation){b.textContent=tx('GPS unavailable','GPS no disponible');return;}
    b.textContent=tx('Locating…','Ubicando…');
    navigator.geolocation.getCurrentPosition(async pos=>{
      try{
        const sites=(await (await fetch('data/manifest.json?v=18')).json()).sites;
        const m=nearestSite(pos.coords.latitude,pos.coords.longitude,sites);
        if(m){document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:m.site.id}}));b.textContent=`📍 ${m.site.name} (${m.distanceKm.toFixed(1)} km)`;}
      }catch{b.textContent=tx('📍 Detect my location','📍 Detectar mi ubicación');}
    },()=>{b.textContent=tx('Permission denied','Permiso denegado');},{timeout:8000});
  };
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
    const fresh=provinces.every(id=>{const s=cache.get(id);return s&&Date.now()-s.time<900000&&!s.error;});
    if(!fresh){
      countryPending??=fetch('/api/current?site=all').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).finally(()=>{countryPending=null;});
      const batch=await countryPending;
      for(const d of batch.sites||[]){cache.set(d.site,{time:Date.parse(d.retrievedAt),value:d});publishWeather('current',d);if(d.site===site)paint(d);}
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

document.addEventListener('gaiatrack:selection',e=>{const changed=site!==e.detail.site;site=e.detail.site;if(changed)load();});
setInterval(()=>{if(!document.hidden){load();loadCountry();}},900000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();loadCountry();}});
load();loadCountry();
