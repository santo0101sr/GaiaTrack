export function cacheHeaders(kind,result,now=Date.now()){
const midnight=new Date(now);midnight.setUTCHours(30,0,0,0);if(midnight.getTime()-now>86400000)midnight.setUTCDate(midnight.getUTCDate()-1);
const duration=kind==='current'?900:3600;
// Never retain a forecast across the Costa Rica day boundary. Do not keep old fallbacks fresh.
const age=Math.max(0,Math.floor((now-Date.parse(result.retrievedAt))/1000));const remaining=Math.max(1,duration-age);const dayRemaining=Math.max(1,Math.floor((midnight.getTime()-now)/1000));
const ttl=Math.min(remaining,kind==='forecast'?dayRemaining:duration,result.warning?60:duration);const stale=kind==='forecast'?Math.max(0,Math.min(60,dayRemaining-ttl)):60;
return {'Cache-Control':`public, max-age=${Math.min(60,ttl)}`,'Vercel-CDN-Cache-Control':`public, s-maxage=${ttl}, stale-while-revalidate=${stale}`};}
export function publicResult(kind,result){if(kind!=='forecast')return result;const {raw,rawEnsemble,...lean}=result;return lean;}
