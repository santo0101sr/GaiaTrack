export function costaRicaDay(now=new Date()){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=t=>parts.find(p=>p.type===t).value;return `${part('year')}-${part('month')}-${part('day')}`;}
export function forecastDates(today=costaRicaDay()){
  const date=new Date(today+'T12:00:00Z');
  return Array.from({length:7},()=>{date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);});
}
export function hasCompleteForecast(days,today=costaRicaDay()){
  if(!Array.isArray(days)||days.length!==7)return false;
  return forecastDates(today).every((date,i)=>days[i]?.date===date);
}
export function quantile(values,q){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const x=(sorted.length-1)*q,i=Math.floor(x);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(x-i);}
export function normalizeForecast(raw,ensemble,today=costaRicaDay()){
if(!raw.daily?.time?.length)throw Error('La fuente no devolvió fechas de pronóstico.');
const days=raw.daily.time.map((date,i)=>{const hours=(raw.hourly?.time||[]).map((t,k)=>t.startsWith(date)?k:-1).filter(k=>k>=0);const avg=name=>{const values=hours.map(k=>raw.hourly[name]?.[k]).filter(Number.isFinite);return values.length>=22?values.reduce((a,b)=>a+b,0)/values.length:null;};const ei=ensemble?.daily?.time?.indexOf(date)??-1;const members=ei>=0?Object.keys(ensemble.daily).filter(k=>k==='temperature_2m_mean'||/^temperature_2m_mean_member\d+$/.test(k)).map(k=>ensemble.daily[k][ei]).filter(Number.isFinite):[];return {date,T2M:raw.daily.temperature_2m_mean?.[i]??null,T2M_MIN:raw.daily.temperature_2m_min?.[i]??null,T2M_MAX:raw.daily.temperature_2m_max?.[i]??null,PRECTOTCORR:raw.daily.precipitation_sum?.[i]??null,ALLSKY_SFC_SW_DWN:raw.daily.shortwave_radiation_sum?.[i]??null,RH2M:avg('relative_humidity_2m'),GWETTOP:avg('soil_moisture_0_to_1cm'),rainProbability:raw.daily.precipitation_probability_max?.[i]??null,ensemble:members.length>=10?{n:members.length,p10:quantile(members,.1),p50:quantile(members,.5),p90:quantile(members,.9)}:null};}).filter(d=>d.date>today).slice(0,7);
return days;
}

function extremeDay(days,key,pickMax){
let best=null;
for(const d of days){
const val=d?.[key];
if(!Number.isFinite(val))continue;
if(!best||(pickMax?val>best.value:val<best.value))best={date:d.date,value:val};
}
return best;
}

/**
 * Computes synoptic summary metrics from a 7-day normalized forecast array without fabricating missing values.
 */
export function summarizeSevenDayForecast(days){
if(!Array.isArray(days)||!days.length)return null;
const meanOf=key=>{
const vals=days.map(d=>d?.[key]).filter(Number.isFinite);
return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
};
const firstT=days[0]?.T2M,lastT=days.at(-1)?.T2M;
const rainVals=days.map(d=>d?.PRECTOTCORR).filter(Number.isFinite);
const probVals=days.map(d=>d?.rainProbability).filter(Number.isFinite);
const soilStart=Number.isFinite(days[0]?.GWETTOP)?days[0].GWETTOP:null;
const soilEnd=Number.isFinite(days.at(-1)?.GWETTOP)?days.at(-1).GWETTOP:null;
const spreads=days.map(d=>d?.ensemble).filter(e=>e&&Number.isFinite(e.p10)&&Number.isFinite(e.p90)).map(e=>e.p90-e.p10);
const lastEns=days.at(-1)?.ensemble;
return {
tempMean:meanOf('T2M'),
tempDelta:Number.isFinite(lastT)&&Number.isFinite(firstT)?lastT-firstT:null,
warmestDay:extremeDay(days,'T2M_MAX',true)||extremeDay(days,'T2M',true),
coolestDay:extremeDay(days,'T2M_MIN',false)||extremeDay(days,'T2M',false),
totalRain:rainVals.length?rainVals.reduce((a,b)=>a+b,0):null,
rainyDays:days.filter(d=>Number.isFinite(d?.PRECTOTCORR)&&d.PRECTOTCORR>=1).length,
wettestDay:extremeDay(days,'PRECTOTCORR',true),
maxRainProb:probVals.length?Math.max(...probVals):null,
meanHumidity:meanOf('RH2M'),
meanRadiation:meanOf('ALLSKY_SFC_SW_DWN'),
soilStart,
soilEnd,
soilDelta:Number.isFinite(soilEnd)&&Number.isFinite(soilStart)?soilEnd-soilStart:null,
ensembleSpreadMean:spreads.length?spreads.reduce((a,b)=>a+b,0)/spreads.length:null,
ensembleLastSpread:lastEns&&Number.isFinite(lastEns.p10)&&Number.isFinite(lastEns.p90)?lastEns.p90-lastEns.p10:null,
ensembleMembers:days.find(d=>Number.isFinite(d?.ensemble?.n))?.ensemble?.n??null
};
}
