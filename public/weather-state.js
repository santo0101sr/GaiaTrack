const stores={current:new Map(),forecast:new Map()};
export function publishWeather(kind,data){stores[kind].set(data.site,data);document.dispatchEvent(new CustomEvent('gaiatrack:weather-data',{detail:{kind,site:data.site}}));}
export const readWeather=(kind,site)=>stores[kind].get(site);
export function normalizeTimeline(raw,today){const h=raw.hourly;if(!h?.time)return [];return h.time.map((time,i)=>({time,temperature:h.temperature_2m?.[i]??null,humidity:h.relative_humidity_2m?.[i]??null,soilMoisture:h.soil_moisture_0_to_1cm?.[i]??null,precipitation:h.precipitation?.[i]??null,clouds:h.cloud_cover?.[i]??null,solarRadiation:h.shortwave_radiation?.[i]??null})).filter(d=>d.time.slice(0,10)>today);}
// Monotonic illustration scales; null stays unknown, never silently becomes dry/clear.
export function weatherScales(data){const clamp=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(1,v/max)):null;return {sun:clamp(data.solarRadiation,1000),cloud:clamp(data.clouds,100),rain:Number.isFinite(data.precipitation)?1-Math.exp(-Math.max(0,data.precipitation)/3):null,soil:clamp(data.soilMoisture,.5)};}
