import {weatherForScene} from './weather-state.js';

// A dry provincial reference point must not hide a wet canton. Prefer the
// available canton samples, never paint a provincial sample over those cells.
export function selectWeatherTerritories(territories,read,{province=null,now=Date.now()}={}){
  const valid=territories.flatMap(territory=>{
    if(province&&territory.province!==province&&territory.id!==province)return [];
    const raw=read(territory.id),normalized=weatherForScene('current',territory.id,raw,now);
    if(!normalized||(!Number.isFinite(normalized.precipitation)&&!Number.isFinite(normalized.clouds)))return [];
    return [{territory,raw,normalized}];
  });
  const detailed=new Set(valid.filter(item=>item.territory.type==='canton').map(item=>item.territory.province));
  return valid.filter(item=>item.territory.type==='canton'||!detailed.has(item.territory.id));
}
