import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {normalizeForecast,costaRicaDay} from '../public/forecast-science.js';
import {openMeteoJSON} from './provider-cache.mjs';
import {normalizeTimeline} from '../public/weather-state.js';
const folder=new URL('../public/data/forecast/',import.meta.url);const memory=new Map(),inflight=new Map();
export async function getForecast(site){if(inflight.has(site.id))return inflight.get(site.id);const work=load(site).finally(()=>inflight.delete(site.id));inflight.set(site.id,work);return work;}
async function load(site){let cached=memory.get(site.id);if(!cached){try{cached=JSON.parse(await readFile(new URL(`${site.id}.json`,folder),'utf8'));}catch{}}
const valid=cached&&cached.days?.[0]?.date>costaRicaDay()&&cached.days?.length===7;
if(valid&&cached.timeline?.length>=168&&Date.now()-Date.parse(cached.retrievedAt)<60*60*1000)return {...cached,cache:true};
const start=costaRicaDay();const finalDate=new Date(start+'T12:00:00Z');finalDate.setUTCDate(finalDate.getUTCDate()+7);const end=finalDate.toISOString().slice(0,10);
const query=new URLSearchParams({latitude:site.latitude.toFixed(5),longitude:site.longitude.toFixed(5),daily:'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,shortwave_radiation_sum,precipitation_probability_max',hourly:'temperature_2m,relative_humidity_2m,soil_moisture_0_to_1cm,precipitation,cloud_cover,shortwave_radiation',timezone:'America/Costa_Rica',start_date:start,end_date:end});
const sourceUrl='https://api.open-meteo.com/v1/forecast?'+query;
const ensembleQuery=new URLSearchParams({latitude:site.latitude.toFixed(5),longitude:site.longitude.toFixed(5),daily:'temperature_2m_mean',models:'gfs_seamless',timezone:'America/Costa_Rica',start_date:start,end_date:end});
const ensembleUrl='https://ensemble-api.open-meteo.com/v1/ensemble?'+ensembleQuery;
const json=openMeteoJSON;
const [main,ens]=await Promise.allSettled([json(sourceUrl),json(ensembleUrl)]);
if(main.status==='rejected'){if(valid)return {...cached,cache:true,warning:'No se pudo actualizar la fuente. Se muestra la última consulta conservada con sus fechas originales.'};throw main.reason;}
const raw=main.value,ensemble=ens.status==='fulfilled'?ens.value:null;const days=normalizeForecast(raw,ensemble);if(days.length!==7)throw Error('La fuente no cubre los próximos siete días completos.');
const result={site:site.id,name:site.name,requested:{latitude:site.latitude,longitude:site.longitude},modelPoint:{latitude:raw.latitude,longitude:raw.longitude,elevation:raw.elevation},retrievedAt:new Date().toISOString(),source:'Open-Meteo Forecast API · selección automática de modelos',sourceUrl,ensembleSource:'GFS ensemble vía Open-Meteo',ensembleUrl,timezone:raw.timezone,days,timeline:normalizeTimeline(raw,start),warning:ensemble?null:'El conjunto GFS no está disponible; no se muestran rangos de dispersión.',raw,rawEnsemble:ensemble};
memory.set(site.id,result);if(!process.env.VERCEL){await mkdir(folder,{recursive:true});await writeFile(new URL(`${site.id}.json`,folder),JSON.stringify(result));}return result;}
