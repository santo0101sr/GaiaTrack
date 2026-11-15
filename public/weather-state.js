const stores={current:new Map(),forecast:new Map(),sectors:new Map()};
export function publishWeather(kind,data){if(stores[kind].get(data.site)===data)return false;stores[kind].set(data.site,data);document.dispatchEvent(new CustomEvent('gaiatrack:weather-data',{detail:{kind,site:data.site}}));return true;}
export const readWeather=(kind,site)=>stores[kind].get(site);
export function publishSectors(parent,list){stores.sectors.set(parent,list);document.dispatchEvent(new CustomEvent('gaiatrack:weather-sectors',{detail:{parent}}));}
export const readSectors=parent=>stores.sectors.get(parent)??null;
// Current effects expire with the source time, even if a refresh fails.
export function weatherForScene(kind,site,raw,now=Date.now()){
  if(!raw)return null;
  if(kind==='current'){
    const observed=Date.parse(raw.observedAt);
    if(raw.site!==site||!Number.isFinite(observed)||now-observed>3600000||observed-now>900000)return null;
  }
  const interval=kind==='current'?raw.intervalSeconds:(raw.intervalSeconds??3600);
  return {...raw,precipitation:Number.isFinite(raw.precipitation)&&Number.isFinite(interval)&&interval>0?raw.precipitation*3600/interval:null};
}

export const isThunderstorm=data=>[95,96,97,99].includes(data?.weatherCode);
export function normalizeTimeline(raw,today){const h=raw.hourly;if(!h?.time)return [];return h.time.map((time,i)=>({time,isDay:h.is_day?.[i]===1?true:h.is_day?.[i]===0?false:null,temperature:h.temperature_2m?.[i]??null,humidity:h.relative_humidity_2m?.[i]??null,soilMoisture:h.soil_moisture_0_to_1cm?.[i]??null,precipitation:h.precipitation?.[i]??null,clouds:h.cloud_cover?.[i]??null,solarRadiation:h.shortwave_radiation?.[i]??null})).filter(d=>d.time.slice(0,10)>today);}
// Precipitation amount is authoritative for its reporting interval. A current
// weather code (e.g. overcast now) cannot erase rain in the preceding interval.
// Cloud cover by itself never creates precipitation. Missing stays unknown.
export function weatherScales(data){const clamp=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(1,v/max)):null;return {sun:clamp(data.solarRadiation,1000),cloud:clamp(data.clouds,100),rain:Number.isFinite(data.precipitation)?1-Math.exp(-Math.max(0,data.precipitation)/3):null,soil:clamp(data.soilMoisture,.5)};}
