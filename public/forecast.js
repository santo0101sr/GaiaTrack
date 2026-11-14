import {publishWeather} from './weather-state.js';
import {costaRicaDay} from './forecast-science.js';
import {locale,tx} from './i18n.js';

const $=s=>document.querySelector(s),cache=new Map();
const variableMeta={
  T2M:{en:'Mean temperature',es:'Temperatura media',unit:'°C',digits:1},
  T2M_MIN:{en:'Minimum temperature',es:'Temperatura mínima',unit:'°C',digits:1},
  T2M_MAX:{en:'Maximum temperature',es:'Temperatura máxima',unit:'°C',digits:1},
  ALLSKY_SFC_SW_DWN:{en:'Solar radiation',es:'Radiación solar',unitEn:'MJ/m²/day',unitEs:'MJ/m²/día',digits:1},
  PRECTOTCORR:{en:'Precipitation',es:'Precipitación',unitEn:'mm/day',unitEs:'mm/día',digits:1},
  GWETTOP:{en:'Soil moisture (0–1 cm)',es:'Humedad del suelo (0–1 cm)',unit:'m³/m³',digits:3},
  RH2M:{en:'Relative humidity',es:'Humedad relativa del aire',unit:'%',digits:0}
};
const getVar=k=>{const m=variableMeta[k];return {name:tx(m.en,m.es),unit:m.unit||tx(m.unitEn,m.unitEs),digits:m.digits};};

let selectedSite,selectedVariable='T2M',selectedDay=0,forecast,request=0,initialized=false;
const fmt=(value,digits=1)=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):tx('Unavailable','No disponible');
const dateText=(day,opts={day:'numeric',month:'short'})=>new Date(day+'T12:00:00-06:00').toLocaleDateString(locale(),{...opts,timeZone:'America/Costa_Rica'});

export function initForecast(){
  if(initialized)return;initialized=true;
  $('#forecast-refresh').onclick=()=>updateForecast(selectedSite,selectedVariable,true);
  $('#forecast-download').onclick=download;
  const refresh=()=>{if(!document.hidden&&selectedSite)updateForecast(selectedSite,selectedVariable);};
  setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
  document.addEventListener('gaiatrack:lang',()=>{
    if(selectedSite)$('#forecast-location').textContent=`${selectedSite.name} · ${tx('reference point','punto de referencia')}`;
    if(forecast)render();
  });
}

export async function updateForecast(site,variable,refresh=false){
  if(!site){selectedSite=null;forecast=null;request++;$('#forecast-location').textContent=tx('Choose a province','Elegí una provincia');for(const id of ['forecast-days','forecast-detail','forecast-period','forecast-update'])$('#'+id).textContent='';$('#forecast-status').hidden=false;$('#forecast-status').textContent=tx('Choose a province to see its forecast.','Elegí una provincia para ver su pronóstico.');$('#forecast-refresh').disabled=true;$('#forecast-download').disabled=true;return;}initForecast();
  const changed=site.id!==selectedSite?.id;selectedSite=site;selectedVariable=variable;
  $('#forecast-location').textContent=`${site.name} · ${tx('reference point','punto de referencia')}`;
  if(changed)selectedDay=0;
  const stored=cache.get(site.id);
  if(stored&&stored.days[0].date>costaRicaDay()&&Date.now()-Date.parse(stored.retrievedAt)<60*60*1000){forecast=stored;request++;render();return;}
  if(!changed&&!refresh&&$('#forecast-refresh').disabled)return;
  forecast=null;const token=++request;
  $('#forecast-status').textContent=tx('Querying Open-Meteo and GFS ensemble…','Consultando Open-Meteo y el conjunto GFS…');
  $('#forecast-status').hidden=false;$('#forecast-days').innerHTML='';$('#forecast-detail').innerHTML='';$('#forecast-period').textContent='';$('#forecast-update').textContent='';$('#forecast-refresh').disabled=true;$('#forecast-download').disabled=true;
  try{
    const response=await fetch(`/api/forecast?site=${encodeURIComponent(site.id)}`);
    const result=await response.json();if(!response.ok)throw Error(result.error);
    if(token!==request)return;
    if(!result.days?.length||result.days[0].date<=costaRicaDay())throw Error(tx('The source has no valid forecast for upcoming days.','La fuente no contiene un pronóstico vigente para los próximos días.'));
    cache.set(site.id,result);forecast=result;render();
  }catch(e){
    if(token!==request)return;
    $('#forecast-status').textContent=e.message||tx('Forecast unavailable. Click Refresh to retry.','El pronóstico no está disponible. Usá Actualizar para reintentar.');
    $('#forecast-status').hidden=false;
  }finally{if(token===request){$('#forecast-refresh').disabled=false;$('#forecast-download').disabled=!forecast;}}
}

function render(){
  if(!forecast)return;
  publishWeather('forecast',forecast);
  const variable=getVar(selectedVariable);
  $('#forecast-period').textContent=`${dateText(forecast.days[0].date)} — ${dateText(forecast.days.at(-1).date)} · America/Costa_Rica`;
  $('#forecast-status').textContent=forecast.warning||'';$('#forecast-status').hidden=!forecast.warning;$('#forecast-download').disabled=false;
  $('#forecast-days').innerHTML=forecast.days.map((d,i)=>`<button class="forecast-day ${i===selectedDay?'selected':''}" data-day="${i}" aria-pressed="${i===selectedDay}"><span class="forecast-weekday">${i===0?tx('TOMORROW','MAÑANA'):dateText(d.date,{weekday:'long'}).toUpperCase()}</span><span class="forecast-date">${dateText(d.date)}</span><span class="forecast-symbol" aria-hidden="true">${Number.isFinite(d.PRECTOTCORR)&&d.PRECTOTCORR>1?'≋':'◌'}</span><strong>${fmt(d[selectedVariable],variable.digits)}</strong><small>${variable.unit}</small><span class="forecast-day-sub">${variable.name}</span></button>`).join('');
  document.querySelectorAll('.forecast-day').forEach(b=>b.onclick=()=>{selectedDay=+b.dataset.day;render();});
  const d=forecast.days[selectedDay],ensemble=d.ensemble;
  $('#forecast-detail').innerHTML=`<div class="forecast-detail-top"><span class="section-label">${tx('DETAIL','DETALLE')} / ${dateText(d.date,{weekday:'long',day:'numeric',month:'long'}).toUpperCase()}</span><span>${tx('Model estimate, not an observation','Estimación del modelo, no observación')}</span></div><div class="forecast-metrics">${Object.keys(variableMeta).map(key=>{const p=getVar(key);return `<div><span>${p.name}</span><strong>${fmt(d[key],p.digits)} <small>${p.unit}</small></strong></div>`;}).join('')}</div><div class="ensemble-note"><span>◎</span><p>${ensemble?tx(`<strong>Mean temperature spread · GFS, ${ensemble.n} members</strong><br>P10–P90: ${fmt(ensemble.p10)} to ${fmt(ensemble.p90)} °C. Median: ${fmt(ensemble.p50)} °C. Range reflects the GFS ensemble and may differ from the auto-selected main forecast. Not a calibrated confidence interval.`,`<strong>Dispersión de temperatura media · GFS, ${ensemble.n} miembros</strong><br>P10–P90: ${fmt(ensemble.p10)} a ${fmt(ensemble.p90)} °C. Mediana: ${fmt(ensemble.p50)} °C. El rango corresponde al conjunto GFS; puede diferir del pronóstico principal de selección automática. No es un intervalo de confianza calibrado.`):tx('Ensemble spread is unavailable for this date; no uncertainty range is fabricated.','El conjunto de pronósticos no está disponible para esta fecha; no se inventa un rango de incertidumbre.')}</p></div><p class="forecast-unit-note">${tx('Forecast soil moisture is volumetric content at 0–1 cm (m³/m³). It is not directly comparable to the 0–1 NASA historical index.','La humedad del suelo del pronóstico es contenido volumétrico en 0–1 cm (m³/m³). No se compara directamente con el índice 0–1 del histórico NASA.')}${Number.isFinite(d.rainProbability)?tx(` Maximum hourly precipitation probability: ${fmt(d.rainProbability,0)}%; not equivalent to all-day rain probability.`,` Probabilidad horaria máxima de precipitación: ${fmt(d.rainProbability,0)} %; no equivale a la probabilidad de lluvia de todo el día.`):''}</p>`;
  const stamp=new Date(forecast.retrievedAt).toLocaleString(locale(),{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'short'});
  $('#forecast-update').textContent=tx(
    `Retrieved: ${stamp} (Costa Rica). Open-Meteo · automatic model selection. Reference elevation: ${fmt(forecast.modelPoint.elevation,0)} m. Shared cache up to 60 minutes.`,
    `Consulta: ${stamp} (Costa Rica). Open-Meteo · selección automática de modelos. Elevación de referencia: ${fmt(forecast.modelPoint.elevation,0)} m. Caché compartida hasta 60 minutos.`
  );
  $('#forecast-refresh').disabled=false;
}

function download(){
  if(!forecast)return;
  const rows=[`# GaiaTrack | WEATHER FORECAST | ${forecast.name}`,`# Retrieved: ${forecast.retrievedAt}; timezone: America/Costa_Rica`,`# Source: ${forecast.sourceUrl}`,'# Transformations: provider daily aggregations; mean hourly humidity; independent GFS percentiles','date,mean_temp_C,min_temp_C,max_temp_C,radiation_MJ_m2_day,precipitation_mm_day,soil_moisture_0_1cm_m3_m3,relative_humidity_pct,gfs_mean_temp_p10_C,gfs_mean_temp_median_C,gfs_mean_temp_p90_C,gfs_members'];
  for(const d of forecast.days)rows.push([d.date,d.T2M,d.T2M_MIN,d.T2M_MAX,d.ALLSKY_SFC_SW_DWN,d.PRECTOTCORR,d.GWETTOP,d.RH2M,d.ensemble?.p10,d.ensemble?.p50,d.ensemble?.p90,d.ensemble?.n].map(x=>x??'').join(','));
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=`GaiaTrack_forecast_${forecast.site}_${forecast.days[0].date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
