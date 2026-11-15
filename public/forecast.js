import {fetchJSON} from './data-client.js';
import {publishWeather} from './weather-state.js';
import {hasCompleteForecast,summarizeSevenDayForecast} from './forecast-science.js';
import {locale,tx} from './i18n.js';
import {icon} from './icons.js';

const $=s=>document.querySelector(s),cache=new Map(),pending=new Map();
const variableMeta={
  T2M:{en:'Mean temperature',es:'Temperatura media',enShort:'Mean temp',esShort:'Temp. media',unit:'°C',digits:1},
  PRECTOTCORR:{en:'Precipitation',es:'Precipitación',enShort:'Rain',esShort:'Lluvia',unitEn:'mm/day',unitEs:'mm/día',digits:1},
  RH2M:{en:'Relative humidity',es:'Humedad relativa del aire',enShort:'Humidity',esShort:'Humedad',unit:'%',digits:0},
  ALLSKY_SFC_SW_DWN:{en:'Solar radiation',es:'Radiación solar',enShort:'Solar',esShort:'Radiación',unitEn:'MJ/m²/day',unitEs:'MJ/m²/día',digits:1},
  GWETTOP:{en:'Soil moisture (0–1 cm)',es:'Humedad del suelo (0–1 cm)',enShort:'Soil',esShort:'Suelo',unit:'m³/m³',digits:3},
  T2M_MAX:{en:'Maximum temperature',es:'Temperatura máxima',enShort:'Max temp',esShort:'Máxima',unit:'°C',digits:1},
  T2M_MIN:{en:'Minimum temperature',es:'Temperatura mínima',enShort:'Min temp',esShort:'Mínima',unit:'°C',digits:1}
};
const getVar=k=>{const m=variableMeta[k]||variableMeta.T2M;return {name:tx(m.en,m.es),short:tx(m.enShort,m.esShort),unit:m.unit||tx(m.unitEn,m.unitEs),digits:m.digits};};

let selectedSite,selectedVariable='T2M',forecast,request=0,initialized=false;
const fmt=(value,digits=1)=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value):tx('Unavailable','No disponible');
const fmtSigned=(value,digits=1)=>Number.isFinite(value)?new Intl.NumberFormat(locale(),{minimumFractionDigits:digits,maximumFractionDigits:digits,signDisplay:'exceptZero'}).format(value):tx('Unavailable','No disponible');
const dateText=(day,opts={day:'numeric',month:'short'})=>day?new Date(day+'T12:00:00-06:00').toLocaleDateString(locale(),{...opts,timeZone:'America/Costa_Rica'}):'—';

function buildLinePath(pts){
  let d='',open=false;
  for(const p of pts){
    if(!p){open=false;continue;}
    d+=`${open?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    open=true;
  }
  return d;
}

function buildBandSvg(pairs,fill,stroke){
  let out='',seg=[];
  const flush=()=>{
    if(seg.length>=2){
      const top=seg.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.highY.toFixed(1)}`).join('');
      const bot=[...seg].reverse().map(p=>`L${p.x.toFixed(1)},${p.lowY.toFixed(1)}`).join('');
      out+=`<path d="${top}${bot}Z" fill="${fill}" stroke="none"/>`;
      out+=`<path d="${top}" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
      out+=`<path d="${seg.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.lowY.toFixed(1)}`).join('')}" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
    }else if(seg.length===1){
      const p=seg[0];
      out+=`<line x1="${p.x.toFixed(1)}" x2="${p.x.toFixed(1)}" y1="${p.highY.toFixed(1)}" y2="${p.lowY.toFixed(1)}" stroke="${stroke}" stroke-width="2" stroke-dasharray="3 2"/>`;
    }
    seg=[];
  };
  for(const item of pairs){
    if(item)seg.push(item);
    else flush();
  }
  flush();
  return out;
}

function renderForecastChartSvg(days,varKey,variable){
  const mobile=innerWidth<600;
  const W=mobile?440:920,H=mobile?300:260,left=mobile?40:54,right=mobile?12:24,top=28,bottom=46,pw=W-left-right,ph=H-top-bottom;
  const colW=pw/Math.max(1,days.length),xAt=i=>left+colW*(i+.5);
  const isTemp=varKey==='T2M'||varKey==='T2M_MIN'||varKey==='T2M_MAX';
  const vals=[];
  for(const d of days){
    if(Number.isFinite(d[varKey]))vals.push(d[varKey]);
    if(isTemp){
      if(Number.isFinite(d.T2M_MIN))vals.push(d.T2M_MIN);
      if(Number.isFinite(d.T2M_MAX))vals.push(d.T2M_MAX);
      if(varKey==='T2M'&&d.ensemble){
        if(Number.isFinite(d.ensemble.p10))vals.push(d.ensemble.p10);
        if(Number.isFinite(d.ensemble.p90))vals.push(d.ensemble.p90);
      }
    }
  }
  if(varKey==='PRECTOTCORR')vals.push(0);
  if(!vals.length){
    return `<svg id="forecast-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${variable.name}"><text x="50%" y="50%" fill="#a1b0bb" text-anchor="middle">${tx('No numeric forecast data available.','No hay datos numéricos disponibles en el pronóstico.')}</text></svg>`;
  }
  const rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  let min,max;
  if(varKey==='PRECTOTCORR'){
    min=0;
    max=Math.max(2,rawMax*1.2);
  }else{
    const padY=Math.max(varKey==='GWETTOP'?0.02:0.9,(rawMax-rawMin)*0.22);
    min=rawMin-padY;
    max=rawMax+padY;
    if(varKey==='RH2M'||varKey==='GWETTOP'||varKey==='ALLSKY_SFC_SW_DWN')min=Math.max(0,min);
    if(varKey==='RH2M')max=Math.min(100,Math.max(max,rawMax+4));
  }
  const yAt=val=>top+((max-val)/(max-min||1))*ph;

  let html=`<defs><linearGradient id="fc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="100%" stop-color="var(--accent)" stop-opacity=".01"/></linearGradient></defs>`;
  for(let t=0;t<=4;t++){
    const tick=min+(max-min)*t/4,y=yAt(tick);
    html+=`<line x1="${left}" x2="${W-right}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-dasharray="3 5"/>`;
    html+=`<text x="${left-9}" y="${(y+3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10" font-family="var(--mono)">${fmt(tick,variable.digits)}</text>`;
  }

  if(isTemp){
    const tempPairs=days.map((d,i)=>Number.isFinite(d.T2M_MIN)&&Number.isFinite(d.T2M_MAX)?{x:xAt(i),lowY:yAt(d.T2M_MIN),highY:yAt(d.T2M_MAX)}:null);
    html+=buildBandSvg(tempPairs,'rgba(35,185,209,.12)','rgba(35,185,209,.48)');
    if(varKey==='T2M'){
      const ensPairs=days.map((d,i)=>d.ensemble&&Number.isFinite(d.ensemble.p10)&&Number.isFinite(d.ensemble.p90)?{x:xAt(i),lowY:yAt(d.ensemble.p10),highY:yAt(d.ensemble.p90)}:null);
      html+=buildBandSvg(ensPairs,'rgba(252,191,11,.14)','rgba(252,191,11,.55)');
    }
  }

  if(varKey==='PRECTOTCORR'){
    const barW=Math.min(44,colW*0.44),baseY=yAt(0);
    days.forEach((d,i)=>{
      if(!Number.isFinite(d.PRECTOTCORR)||d.PRECTOTCORR<=0)return;
      const topY=yAt(d.PRECTOTCORR),h=Math.max(2,baseY-topY);
      html+=`<rect x="${(xAt(i)-barW/2).toFixed(1)}" y="${topY.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="var(--blue)" fill-opacity=".22" stroke="var(--blue)" stroke-width="1"/>`;
    });
  }

  const pts=days.map((d,i)=>Number.isFinite(d[varKey])?{x:xAt(i),y:yAt(d[varKey]),val:d[varKey]}:null);
  const validPts=pts.filter(Boolean);
  if(validPts.length>=2&&varKey!=='PRECTOTCORR'){
    const area=`${buildLinePath(validPts)} L${validPts.at(-1).x.toFixed(1)},${(H-bottom).toFixed(1)} L${validPts[0].x.toFixed(1)},${(H-bottom).toFixed(1)} Z`;
    html+=`<path d="${area}" fill="url(#fc-area)"/>`;
  }
  const linePath=buildLinePath(pts);
  if(linePath)html+=`<path d="${linePath}" fill="none" stroke="${varKey==='PRECTOTCORR'?'var(--blue)':'var(--accent)'}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;

  days.forEach((d,i)=>{
    const x=xAt(i),p=pts[i];
    const dayTag=i===0?tx('TOMORROW','MAÑANA'):dateText(d.date,{weekday:'short'}).toUpperCase();
    html+=`<text x="${x.toFixed(1)}" y="${H-22}" text-anchor="middle" fill="var(--text)" font-size="10" font-weight="600">${dayTag}</text>`;
    html+=`<text x="${x.toFixed(1)}" y="${H-8}" text-anchor="middle" fill="var(--muted)" font-size="9.5" font-family="var(--mono)">${dateText(d.date)}</text>`;
    if(p){
      const col=varKey==='PRECTOTCORR'?'var(--blue)':'var(--accent)';
      html+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${col}" stroke="var(--surface)" stroke-width="1.5"/>`;
      html+=`<text x="${p.x.toFixed(1)}" y="${Math.max(14,p.y-10).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600">${fmt(p.val,variable.digits)}</text>`;
    }
  });
  return `<svg id="forecast-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${variable.name} (${variable.unit})">${html}</svg>`;
}

function buildSynthesisText(days,summary){
  if(!summary)return '';
  const parts=[];
  if(Number.isFinite(summary.tempMean)){
    let trendPhrase=tx('fairly steady temperatures','temperaturas relativamente estables');
    if(Number.isFinite(summary.tempDelta)){
      if(summary.tempDelta>=0.5)trendPhrase=tx(`a warming tendency (${fmtSigned(summary.tempDelta,1)} °C from day 1 to day 7)`,`una tendencia en ascenso (${fmtSigned(summary.tempDelta,1)} °C del día 1 al día 7)`);
      else if(summary.tempDelta<=-0.5)trendPhrase=tx(`a cooling tendency (${fmtSigned(summary.tempDelta,1)} °C from day 1 to day 7)`,`una tendencia en descenso (${fmtSigned(summary.tempDelta,1)} °C del día 1 al día 7)`);
    }
    const peakInfo=summary.warmestDay?tx(`, peaking around ${fmt(summary.warmestDay.value,1)} °C on ${dateText(summary.warmestDay.date,{weekday:'short',day:'numeric',month:'short'})}`,`, con máximo cercano a ${fmt(summary.warmestDay.value,1)} °C el ${dateText(summary.warmestDay.date,{weekday:'short',day:'numeric',month:'short'})}`):'';
    parts.push(tx(
      `Thermal outlook averages ${fmt(summary.tempMean,1)} °C with ${trendPhrase}${peakInfo}.`,
      `La semana promedia ${fmt(summary.tempMean,1)} °C con ${trendPhrase}${peakInfo}.`
    ));
  }
  if(Number.isFinite(summary.totalRain)){
    const wetInfo=summary.wettestDay&&summary.wettestDay.value>0
      ?tx(`; wettest day expected on ${dateText(summary.wettestDay.date,{weekday:'short',day:'numeric',month:'short'})} (${fmt(summary.wettestDay.value,1)} mm)`,`; mayor episodio previsto el ${dateText(summary.wettestDay.date,{weekday:'short',day:'numeric',month:'short'})} (${fmt(summary.wettestDay.value,1)} mm)`)
      :'';
    parts.push(tx(
      `Projected rainfall totals ${fmt(summary.totalRain,1)} mm across ${summary.rainyDays} of ${days.length} days with ≥ 1 mm${wetInfo}.`,
      `Se proyecta un acumulado de ${fmt(summary.totalRain,1)} mm distribuidos en ${summary.rainyDays} de ${days.length} días con ≥ 1 mm${wetInfo}.`
    ));
  }
  if(Number.isFinite(summary.soilDelta)){
    const soilDir=summary.soilDelta>0.01?tx('increases','aumenta'):summary.soilDelta<-0.01?tx('decreases','desciende'):tx('stays steady','se mantiene estable');
    parts.push(tx(
      `Topsoil moisture (0–1 cm) ${soilDir} (${fmtSigned(summary.soilDelta,3)} m³/m³ over the week).`,
      `La humedad superficial del suelo (0–1 cm) ${soilDir} (${fmtSigned(summary.soilDelta,3)} m³/m³ en la semana).`
    ));
  }
  return parts.join(' ');
}

export function initForecast(){
  if(initialized)return;initialized=true;
  let resizeFrame;
  window.addEventListener('resize',()=>{
    if(!forecast)return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(render);
  });
  $('#forecast-refresh').onclick=()=>{if(selectedSite)updateForecast(selectedSite,selectedVariable,true);};
  $('#forecast-download').onclick=download;
  const refresh=()=>{if(!document.hidden&&selectedSite)updateForecast(selectedSite,selectedVariable);};
  setInterval(refresh,60000);document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
  document.addEventListener('gaiatrack:lang',()=>{
    if(selectedSite)$('#forecast-location').textContent=`${selectedSite.name} · ${tx('reference point','punto de referencia')}`;
    else{
      $('#forecast-location').textContent=tx('Costa Rica · Choose a province','Costa Rica · Elige una provincia');
      $('#forecast-status').textContent=tx('Choose a province or canton in the Explorer to load its 7-day forecast.','Elige una provincia o cantón en el Explorador para consultar su pronóstico de 7 días.');
    }
    if(forecast)render();
  });
}

export async function updateForecast(site,variable,refresh=false){
  initForecast();
  if(!site){
    selectedSite=null;forecast=null;request++;
    $('#forecast-location').textContent=tx('Costa Rica · Choose a province','Costa Rica · Elige una provincia');
    $('#forecast-status').textContent=tx('Choose a province or canton in the Explorer to load its 7-day forecast.','Elige una provincia o cantón en el Explorador para consultar su pronóstico de 7 días.');
    $('#forecast-status').hidden=false;$('#forecast-days').innerHTML='';$('#forecast-detail').innerHTML='';$('#forecast-period').textContent='';$('#forecast-update').textContent='';$('#forecast-refresh').disabled=true;$('#forecast-download').disabled=true;
    return;
  }
  $('#forecast-refresh').disabled=false;
  const changed=site.id!==selectedSite?.id;selectedSite=site;selectedVariable=variable;
  $('#forecast-location').textContent=`${site.name} · ${tx('reference point','punto de referencia')}`;
  const stored=cache.get(site.id);
  if(!refresh&&stored&&hasCompleteForecast(stored.days)&&Date.now()-Date.parse(stored.retrievedAt)<60*60*1000){forecast=stored;request++;render();return;}
  if(!changed&&pending.has(site.id))return;
  forecast=null;const token=++request;
  $('#forecast-status').textContent=tx('Querying Open-Meteo and GFS ensemble…','Consultando Open-Meteo y el conjunto GFS…');
  $('#forecast-status').hidden=false;$('#forecast-days').innerHTML='';$('#forecast-detail').innerHTML='';$('#forecast-period').textContent='';$('#forecast-update').textContent='';$('#forecast-refresh').disabled=true;$('#forecast-download').disabled=true;
  try{
    if(!pending.has(site.id)){
      const work=fetchJSON(`/api/forecast?site=${encodeURIComponent(site.id)}`).then(result=>{
        if(result.site!==site.id||!hasCompleteForecast(result.days))throw Error(tx('The source has no complete forecast for the next seven days.','La fuente no contiene un pronóstico completo para los próximos siete días.'));
        cache.set(site.id,result);return result;
      }).finally(()=>pending.delete(site.id));
      pending.set(site.id,work);
    }
    const result=await pending.get(site.id);if(token!==request)return;
    forecast=result;render();
  }catch(e){
    if(token!==request)return;
    $('#forecast-status').textContent=e.message||tx('Forecast unavailable. Click Refresh to retry.','El pronóstico no está disponible. Usa Actualizar para reintentar.');
    $('#forecast-status').hidden=false;
  }finally{if(token===request){$('#forecast-refresh').disabled=false;$('#forecast-download').disabled=!forecast;}}
}

function render(){
  if(!forecast)return;
  publishWeather('forecast',forecast);
  const variable=getVar(selectedVariable);
  const isTemp=selectedVariable==='T2M'||selectedVariable==='T2M_MIN'||selectedVariable==='T2M_MAX';
  const summary=summarizeSevenDayForecast(forecast.days);
  const hasEns=forecast.days.some(d=>d.ensemble);
  $('#forecast-period').textContent=`${dateText(forecast.days[0].date)} — ${dateText(forecast.days.at(-1).date)} · America/Costa_Rica`;
  $('#forecast-status').textContent=forecast.warning||'';$('#forecast-status').hidden=!forecast.warning;$('#forecast-download').disabled=false;

  const pillsHtml=Object.keys(variableMeta).map(key=>{
    const p=getVar(key);
    return `<button type="button" class="${key===selectedVariable?'selected':''}" data-fvar="${key}" aria-pressed="${key===selectedVariable}">${p.short}</button>`;
  }).join('');
  const legendHtml=`<span class="fc-legend"><i></i>${variable.name}${isTemp?` <b class="band"></b>${tx('Min–Max range','Rango mín–máx')}`:''}${selectedVariable==='T2M'&&hasEns?` <b class="ens"></b>GFS P10–P90`:''}</span>`;
  const focusVals=forecast.days.map(d=>d[selectedVariable]).filter(Number.isFinite);
  const fMin=focusVals.length?Math.min(...focusVals):0;
  const fMax=focusVals.length?Math.max(...focusVals):1;
  const fSpan=Math.max(1e-6,fMax-fMin);
  const daysTableHtml=forecast.days.map((d,i)=>{
    const known=Number.isFinite(d.PRECTOTCORR),rainy=known&&d.PRECTOTCORR>=1;
    const condIcon=known?icon(rainy?'cloud-rain':'cloud'):'—';
    const val=d[selectedVariable];
    const barPct=Number.isFinite(val)?(selectedVariable==='PRECTOTCORR'?(fMax>0?(val/fMax)*100:0):(18+((val-fMin)/fSpan)*82)):0;
    const dayLabel=i===0?tx('Tomorrow','Mañana'):dateText(d.date,{weekday:'short'});
    return `<tr class="forecast-day-row${i===0?' is-tomorrow':''}">
      <td>
        <span class="forecast-weekday">${dayLabel}</span>
        <span class="forecast-date">${dateText(d.date)}</span>
      </td>
      <td class="forecast-cond-cell"><span class="forecast-symbol" aria-hidden="true">${condIcon}</span></td>
      <td class="forecast-focus-cell">
        <div class="forecast-val-bar">
          <strong>${fmt(val,variable.digits)} <small>${variable.unit}</small></strong>
          <span class="forecast-bar-track" aria-hidden="true"><i style="width:${barPct.toFixed(0)}%"></i></span>
        </div>
      </td>
      <td class="forecast-range-cell">${fmt(d.T2M_MIN,1)}° / ${fmt(d.T2M_MAX,1)}°C</td>
      <td class="forecast-rain-cell">${fmt(d.PRECTOTCORR,1)} mm <small>${Number.isFinite(d.rainProbability)?`(${fmt(d.rainProbability,0)}%)`:''}</small></td>
      <td class="forecast-more-cell">
        <details class="forecast-day-more"><summary>${tx('Details','Detalles')}</summary><dl class="forecast-day-metrics"><div><dt>${tx('Humidity','Humedad')}</dt><dd>${fmt(d.RH2M,0)}%</dd></div><div><dt>${tx('Solar','Radiación')}</dt><dd>${fmt(d.ALLSKY_SFC_SW_DWN,1)} MJ/m²</dd></div><div><dt>${tx('Soil','Suelo')}</dt><dd>${fmt(d.GWETTOP,3)} m³/m³</dd></div><div><dt>GFS P10–P90</dt><dd>${d.ensemble?`${fmt(d.ensemble.p10,1)}–${fmt(d.ensemble.p90,1)} °C`:'—'}</dd></div></dl></details>
      </td>
    </tr>`;
  }).join('');

  $('#forecast-days').innerHTML=`<div class="forecast-chart-box"><div class="forecast-chart-head"><div><span class="section-label">${tx('7-DAY VARIATION CHART','GRÁFICO DE VARIACIÓN A 7 DÍAS')}</span>${legendHtml}</div><div class="forecast-var-pills" role="group" aria-label="${tx('Select forecast variable','Seleccionar variable del pronóstico')}">${pillsHtml}</div></div>${renderForecastChartSvg(forecast.days,selectedVariable,variable)}</div><div class="forecast-table-wrap"><table class="forecast-table"><thead><tr><th>${tx('Day','Día')}</th><th>${tx('Sky','Cielo')}</th><th>${variable.short}</th><th>${tx('Min / Max','Mín / Máx')}</th><th>${tx('Rain (Prob.)','Lluvia (Prob.)')}</th><th>${tx('Extras','Variables')}</th></tr></thead><tbody>${daysTableHtml}</tbody></table></div>`;
  $('#forecast-days').querySelectorAll('[data-fvar]').forEach(btn=>{
    btn.onclick=()=>{selectedVariable=btn.dataset.fvar;render();};
  });

  const synthesis=buildSynthesisText(forecast.days,summary);
  const analysisCardsHtml=summary?`<div class="forecast-analysis-grid">
    <div><span>${tx('THERMAL TRAJECTORY','TRAYECTORIA TÉRMICA')}</span><strong>${fmt(summary.tempMean,1)} °C</strong><small>${tx('Day 1 → Day 7 shift:','Cambio día 1 → día 7:')} ${fmtSigned(summary.tempDelta,1)} °C</small><small>${summary.warmestDay?`${tx('Warmest','Más cálido')}: ${fmt(summary.warmestDay.value,1)} °C (${dateText(summary.warmestDay.date)})`:''}${summary.coolestDay?` · ${tx('Coolest','Más fresco')}: ${fmt(summary.coolestDay.value,1)} °C`:''}</small></div>
    <div><span>${tx('PRECIPITATION REGIME','RÉGIMEN DE LLUVIA')}</span><strong>${fmt(summary.totalRain,1)} mm</strong><small>${summary.rainyDays}/${forecast.days.length} ${tx('days with ≥ 1 mm','días con ≥ 1 mm')}${Number.isFinite(summary.maxRainProb)?` · ${tx('Max hourly prob.','Prob. máx. horaria')} ${fmt(summary.maxRainProb,0)}%`:''}</small><small>${summary.wettestDay?`${tx('Peak day','Día máximo')}: ${dateText(summary.wettestDay.date)} (${fmt(summary.wettestDay.value,1)} mm)`:tx('No rain peak data','Sin dato máximo de lluvia')}</small></div>
    <div><span>${tx('ATMOSPHERE & SOIL','ATMÓSFERA Y SUELO')}</span><strong>${fmt(summary.meanHumidity,0)} % · ${fmt(summary.meanRadiation,1)} MJ/m²</strong><small>${tx('7-day mean relative humidity & solar radiation','Promedio semanal de humedad relativa y radiación')}</small><small>${tx('Topsoil (0–1 cm):','Suelo superficial (0–1 cm):')} ${fmt(summary.soilStart,3)} → ${fmt(summary.soilEnd,3)} m³/m³ (${fmtSigned(summary.soilDelta,3)})</small></div>
    <div><span>${tx('GFS ENSEMBLE UNCERTAINTY','INCERTIDUMBRE CONJUNTO GFS')}</span><strong>${Number.isFinite(summary.ensembleSpreadMean)?`${fmt(summary.ensembleSpreadMean,1)} °C`:tx('Unavailable','No disponible')}</strong><small>${summary.ensembleMembers?`${tx('Mean P10–P90 spread across','Dispersión media P10–P90 en')} ${summary.ensembleMembers} ${tx('members','miembros')}`:tx('No ensemble spread reported','Sin dispersión reportada del conjunto')}</small><small>${Number.isFinite(summary.ensembleLastSpread)?`${tx('Day 7 spread','Amplitud en el día 7')}: ${fmt(summary.ensembleLastSpread,1)} °C`:tx('Day 7 uncertainty unavailable','Amplitud del día 7 no disponible')}</small></div>
  </div>`:'';

  const ensText=hasEns
    ?tx(`<strong>Mean temperature spread · GFS ensemble</strong><br>Shaded P10–P90 band shows 10th to 90th percentile spread across ${summary?.ensembleMembers??'—'} GFS members for each forecast date. Range may differ from the auto-selected main model and is not a calibrated confidence interval.`,`<strong>Dispersión de temperatura media · conjunto GFS</strong><br>La banda P10–P90 muestra el rango entre los percentiles 10 y 90 de ${summary?.ensembleMembers??'—'} miembros GFS para cada fecha. Puede diferir del modelo principal automático y no equivale a un intervalo de confianza calibrado.`)
    :tx('Ensemble spread is unavailable for these dates; no uncertainty range is fabricated.','El conjunto de pronósticos no está disponible para estas fechas; no se inventa un rango de incertidumbre.');

  $('#forecast-detail').innerHTML=`<div class="forecast-detail-top"><span class="section-label">${tx('7-DAY AUTOMATED OUTLOOK ANALYSIS','ANÁLISIS AUTOMÁTICO DE LOS 7 DÍAS')}</span><span>${tx('Model synthesis · not a direct observation','Síntesis automática del modelo · no es observación directa')}</span></div>${synthesis?`<p class="forecast-synthesis">${synthesis}</p>`:''}${analysisCardsHtml}<div class="ensemble-note"><span>${icon('activity')}</span><p>${ensText}</p></div><p class="forecast-unit-note">${tx('Forecast soil moisture is volumetric content at 0–1 cm (m³/m³). It is not directly comparable to the 0–1 NASA historical index.','La humedad del suelo del pronóstico es contenido volumétrico en 0–1 cm (m³/m³). No se compara directamente con el índice 0–1 del histórico NASA.')}</p>`;
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
