import {cachedLoader,openMeteoUrl} from './provider-cache.mjs';
const CURRENT_FIELDS='temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,is_day,cloud_cover,surface_pressure,wind_speed_10m,shortwave_radiation,soil_moisture_0_to_1cm';
export function normalizeCurrent(raw,site,now=new Date()){
const c=raw.current;if(!Number.isFinite(c?.temperature_2m)||typeof c.time!=='string')throw Error('Respuesta meteorológica incompleta.');const observed=new Date(c.time+'Z');if(!Number.isFinite(observed.getTime()))throw Error('Fecha meteorológica inválida.');const num=v=>Number.isFinite(v)?v:null;
return {site:site.id,name:site.name,provider:'open-meteo',pressureReference:'surface',precipitationDirection:'preceding',source:'Open-Meteo · condiciones actuales del modelo',sourceUrl:'https://open-meteo.com/en/docs',observedAt:observed.toISOString(),retrievedAt:now.toISOString(),requested:{latitude:site.latitude,longitude:site.longitude},temperature:num(c.temperature_2m),feelsLike:num(c.apparent_temperature),humidity:num(c.relative_humidity_2m),pressure:num(c.surface_pressure),windSpeed:num(c.wind_speed_10m),clouds:num(c.cloud_cover),precipitation:num(c.precipitation),intervalSeconds:num(c.interval),solarRadiation:num(c.shortwave_radiation),soilMoisture:num(c.soil_moisture_0_to_1cm),weatherCode:num(c.weather_code),isDay:c.is_day===1?true:c.is_day===0?false:null};
}
async function fetchOpenMeteo(params){const url=openMeteoUrl('https://api.open-meteo.com/v1/forecast',params);let response;try{response=await fetch(url,{signal:AbortSignal.timeout(30000)});}catch{throw Error('No se pudo conectar con Open-Meteo.');}if(!response.ok){const error=Error(`Open-Meteo no disponible (HTTP ${response.status}).`);error.status=response.status;throw error;}return response.json();}
const load=cachedLoader(async key=>{const site=JSON.parse(key);const query=new URLSearchParams({latitude:site.latitude.toFixed(5),longitude:site.longitude.toFixed(5),current:CURRENT_FIELDS,wind_speed_unit:'ms',timezone:'GMT',forecast_days:'1'});return normalizeCurrent(await fetchOpenMeteo(query),site);},{ttlMs:900000});
async function fetchBatch(chunk){
  const query=new URLSearchParams({latitude:chunk.map(s=>s.latitude.toFixed(5)).join(','),longitude:chunk.map(s=>s.longitude.toFixed(5)).join(','),current:CURRENT_FIELDS,wind_speed_unit:'ms',timezone:'GMT',forecast_days:'1'});
  const payload=await fetchOpenMeteo(query);
  const rows=Array.isArray(payload)?payload:[payload];
  if(rows.length!==chunk.length)throw Error('Open-Meteo no devolvió todos los territorios solicitados.');
  return rows;
}
const loadAll=cachedLoader(async key=>{
  const {sites,sectors}=JSON.parse(key);
  const all=[...sites,...sectors];
  const chunks=[];
  for(let i=0;i<all.length;i+=140)chunks.push(all.slice(i,i+140));
  const rowGroups=await Promise.all(chunks.map(fetchBatch));
  const rows=rowGroups.flat();
  const now=new Date();
  const items=all.map((site,i)=>{const row=normalizeCurrent(rows[i],site,now);return site.parent?{...row,parent:site.parent}:row;});
  return {retrievedAt:now.toISOString(),sites:items.slice(0,sites.length),...(sectors.length?{sectors:items.slice(sites.length)}:{})};
},{ttlMs:900000});
export const getCurrentWeather=site=>load(JSON.stringify(site));
export const getAllCurrentWeather=(sites,sectors=[])=>loadAll(JSON.stringify({sites:sites.map(s=>({id:s.id,name:s.name,latitude:s.latitude,longitude:s.longitude})),sectors:sectors.map(s=>({id:s.id,name:s.name||s.id,parent:s.parent,latitude:s.latitude,longitude:s.longitude}))}));
