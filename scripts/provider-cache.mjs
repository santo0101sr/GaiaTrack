// Per-instance cache, coalesced requests and bounded storage with rate-limit cooldowns.
export function cachedLoader(load,{ttlMs=60000,errorTtlMs=60000,maxEntries=256,now=Date.now}={}){
  if(!Number.isFinite(ttlMs)||ttlMs<0||!Number.isInteger(maxEntries)||maxEntries<1)throw TypeError('Invalid cache limits.');
  const values=new Map(),pending=new Map(),errors=new Map();
  function retain(map,key,value){map.delete(key);map.set(key,value);while(map.size>maxEntries)map.delete(map.keys().next().value);}
  return async key=>{
    const cached=values.get(key);
    if(cached&&now()<cached.expires){retain(values,key,cached);return cached.value;}
    values.delete(key);
    const failure=errors.get(key);
    if(failure&&now()<failure.expires)throw failure.error;
    errors.delete(key);
    if(pending.has(key))return pending.get(key);
    // Schedule the loader after registering its promise, including synchronous failures.
    const work=Promise.resolve().then(()=>load(key)).then(value=>{
      retain(values,key,{value,expires:now()+ttlMs});errors.delete(key);return value;
    },error=>{retain(errors,key,{error,expires:now()+(error.status===429?900000:errorTtlMs)});throw error;}).finally(()=>pending.delete(key));
    pending.set(key,work);return work;
  };
}
export function openMeteoUrl(baseUrl,params,apiKey=process.env.OPEN_METEO_API_KEY){const url=new URL(baseUrl);const query=params instanceof URLSearchParams?new URLSearchParams(params):new URLSearchParams(params);if(apiKey){if(url.hostname==='api.open-meteo.com')url.hostname='customer-api.open-meteo.com';else if(url.hostname==='ensemble-api.open-meteo.com')url.hostname='customer-ensemble-api.open-meteo.com';query.set('apikey',apiKey);}url.search=query.toString();return url.toString();}
export const openMeteoJSON=cachedLoader(async url=>{let response;try{response=await fetch(url,{signal:AbortSignal.timeout(20000)});}catch{throw Error('No se pudo conectar con Open-Meteo.');}if(!response.ok){const error=Error(response.status===429?'Open-Meteo alcanzó el límite gratuito. Reintentá más tarde.':`Open-Meteo no disponible (HTTP ${response.status}).`);error.status=response.status;throw error;}return response.json();},{ttlMs:3600000});
