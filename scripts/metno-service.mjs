import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {costaRicaDay} from '../public/forecast-science.js';

const source='MET Norway · Locationforecast',sourceUrl='https://api.met.no/weatherapi/locationforecast/2.0/';
const memory=new Map(),pending=new Map(),failures=new Map();
const folder=new URL('../.cache/metno/',import.meta.url);
const num=v=>Number.isFinite(v)?v:null;
const local=iso=>new Date(Date.parse(iso)-6*3600000).toISOString().slice(0,16);

export function metnoTimeline(raw){
  const series=raw.properties?.timeseries;
  if(!Array.isArray(series)||!series.length)throw Error('MET Norway no devolvió una serie meteorológica.');
  return series.map((row,i)=>{
    if(!Number.isFinite(Date.parse(row.time)))throw Error('Fecha inválida de MET Norway.');
    const d=row.data?.instant?.details??{};
    const period=row.data?.next_1_hours??row.data?.next_6_hours;
    const intervalSeconds=row.data?.next_1_hours?3600:row.data?.next_6_hours?21600:null;
    return {time:local(row.time),validAt:row.time,temperature:num(d.air_temperature),feelsLike:num(d.apparent_air_temperature),humidity:num(d.relative_humidity),pressure:num(d.air_pressure_at_sea_level),windSpeed:num(d.wind_speed),clouds:num(d.cloud_area_fraction),precipitation:num(period?.details?.precipitation_amount),intervalSeconds,solarRadiation:null,soilMoisture:null,sampleSeconds:series[i+1]?Math.min(21600,(Date.parse(series[i+1].time)-Date.parse(row.time))/1000):null};
  });
}

export function normalizeMetnoForecast(raw,site,now=new Date()){
  const today=costaRicaDay(now),timeline=metnoTimeline(raw).filter(r=>r.time.slice(0,10)>today);
  const days=[];
  for(let i=1;i<=7;i++){
    const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+i);const day=date.toISOString().slice(0,10);
    const start=Date.parse(day+'T00:00:00-06:00'),end=start+86400000;
    const rows=timeline.filter(r=>r.time.startsWith(day));
    const weighted=field=>{let sum=0,seconds=0;for(const r of rows){const length=Math.max(0,Math.min(r.sampleSeconds??0,(end-Date.parse(r.validAt))/1000));if(Number.isFinite(r[field])&&length>0){sum+=r[field]*length;seconds+=length;}}return seconds===86400?sum/seconds:null;};
    const temps=rows.map(r=>r.temperature).filter(Number.isFinite);
    let rainfall=0,rainEnd=start,rainComplete=true;
    for(const r of rows){if(Date.parse(r.validAt)!==rainEnd||!Number.isFinite(r.precipitation)||!r.intervalSeconds||rainEnd+r.intervalSeconds*1000>end){rainComplete=false;break;}rainfall+=r.precipitation;rainEnd+=r.intervalSeconds*1000;}
    const temperature=weighted('temperature');
    days.push({date:day,T2M:temperature,T2M_MIN:temperature!==null&&temps.length?Math.min(...temps):null,T2M_MAX:temperature!==null&&temps.length?Math.max(...temps):null,RH2M:weighted('humidity'),PRECTOTCORR:rainComplete&&rainEnd===end?rainfall:null,ALLSKY_SFC_SW_DWN:null,GWETTOP:null,rainProbability:null,ensemble:null,sampleCount:rows.length});
  }
  if(days.some(d=>d.T2M===null))throw Error('MET Norway no cubre siete días completos de temperatura.');
  const coordinates=raw.geometry?.coordinates??[];
  return {site:site.id,name:site.name,provider:'metno',source,sourceUrl,requested:{latitude:site.latitude,longitude:site.longitude},modelPoint:{longitude:coordinates[0]??site.longitude,latitude:coordinates[1]??site.latitude,elevation:coordinates[2]??null},retrievedAt:now.toISOString(),modelUpdatedAt:raw.properties.meta?.updated_at??null,timezone:'America/Costa_Rica',days,timeline,warning:'Medias diarias ponderadas entre muestras del modelo (pasos de 1 o 6 horas). Mínimas y máximas entre muestras; no extremos diarios exactos. Radiación, humedad del suelo y conjunto GFS no disponibles en esta fuente.'};
}

export function normalizeMetnoCurrent(raw,site,now=new Date()){
  const rows=metnoTimeline(raw),row=rows.find(r=>Date.parse(r.validAt)>=now.getTime())??rows.at(-1);
  if(Math.abs(Date.parse(row.validAt)-now.getTime())>3600000)throw Error('La fuente no tiene una estimación próxima a la hora actual.');
  return {...row,site:site.id,name:site.name,provider:'metno',source,sourceUrl,observedAt:row.validAt,retrievedAt:now.toISOString(),modelUpdatedAt:raw.properties.meta?.updated_at??null,requested:{latitude:site.latitude,longitude:site.longitude},pressureReference:'sea-level',precipitationDirection:'following',weatherCode:null};
}

async function load(site){
  if(process.env.METNO_TERMS_ACCEPTED!=='true'||!process.env.METNO_USER_AGENT)throw Error('MET Norway pendiente de configuración: aceptar términos y definir METNO_USER_AGENT en el servidor.');
  const key=site.id;let cached=memory.get(key);
  if(!cached&&!process.env.VERCEL){try{cached=JSON.parse(await readFile(new URL(key+'.json',folder),'utf8'));memory.set(key,cached);}catch{}}
  if(cached&&Date.now()<cached.expiresAt)return cached;
  const failure=failures.get(key);if(failure&&Date.now()<failure.until)throw Error(failure.message);
  const query=new URLSearchParams({lat:(Math.trunc(site.latitude*1e4)/1e4).toFixed(4),lon:(Math.trunc(site.longitude*1e4)/1e4).toFixed(4)});
  const url=sourceUrl+'compact?'+query;
  const headers={'User-Agent':process.env.METNO_USER_AGENT,'Accept':'application/json'};
  if(cached?.lastModified)headers['If-Modified-Since']=cached.lastModified;
  try{
    const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});
    if(response.status!==304&&!response.ok){const e=Error(`MET Norway no disponible (HTTP ${response.status}).`);e.status=response.status;e.retryAfter=response.headers.get('retry-after');throw e;}
    const raw=response.status===304?cached?.raw:await response.json();
    metnoTimeline(raw); // Do not cache invalid source payloads.
    const retrievedAt=new Date().toISOString();
    const entry={raw,retrievedAt,lastModified:response.headers.get('last-modified')??cached?.lastModified,expiresAt:Math.max(Date.now()+3*3600000,Date.parse(response.headers.get('expires'))||0),sourceUrl:url};
    memory.set(key,entry);failures.delete(key);
    if(!process.env.VERCEL){await mkdir(folder,{recursive:true});const target=new URL(key+'.json',folder),temporary=new URL(key+'.tmp',folder);await writeFile(temporary,JSON.stringify(entry));await rename(temporary,target);}
    return entry;
  }catch(e){const retry=Number(e.retryAfter)*1000||Date.parse(e.retryAfter)-Date.now()||0;failures.set(key,{until:Date.now()+Math.max(e.status===429?3*3600000:60000,retry),message:e.message});throw e;}
}
export async function getMetnoData(site){if(pending.has(site.id))return pending.get(site.id);const work=load(site).finally(()=>pending.delete(site.id));pending.set(site.id,work);return work;}
export async function getMetnoCurrent(site){const entry=await getMetnoData(site);return {...normalizeMetnoCurrent(entry.raw,site),retrievedAt:entry.retrievedAt,sourceUrl:entry.sourceUrl};}
export async function getMetnoForecast(site){const entry=await getMetnoData(site);return {...normalizeMetnoForecast(entry.raw,site),retrievedAt:entry.retrievedAt,sourceUrl:entry.sourceUrl};}
