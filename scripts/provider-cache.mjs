// Per-instance cache, coalesced requests and a cooldown on upstream errors.
export function cachedLoader(load,{ttlMs,errorTtlMs=60000,now=Date.now}={}){
const values=new Map(),pending=new Map(),errors=new Map();
return async key=>{const cached=values.get(key);if(cached&&now()<cached.expires)return cached.value;const failure=errors.get(key);if(failure&&now()<failure.expires)throw failure.error;if(pending.has(key))return pending.get(key);
const work=(async()=>{try{const value=await load(key);values.set(key,{value,expires:now()+ttlMs});errors.delete(key);return value;}catch(error){errors.set(key,{error,expires:now()+(error.status===429?900000:errorTtlMs)});throw error;}finally{pending.delete(key);}})();pending.set(key,work);return work;};}
export const openMeteoJSON=cachedLoader(async url=>{let response;try{response=await fetch(url,{signal:AbortSignal.timeout(20000)});}catch{throw Error('No se pudo conectar con Open-Meteo.');}if(!response.ok){const error=Error(response.status===429?'Open-Meteo alcanzó el límite gratuito. Reintentá más tarde.':`Open-Meteo no disponible (HTTP ${response.status}).`);error.status=response.status;throw error;}return response.json();},{ttlMs:3600000});
