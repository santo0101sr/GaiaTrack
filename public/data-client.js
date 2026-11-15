// Static scientific resources are shared by the laboratory, scene and recommendations.
// Failed loads are never retained, so retrying does not require reloading the page.
export async function fetchJSON(url,{timeoutMs=20000,signal}={}){
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new Error('La consulta tardó demasiado. Reintenta.')),timeoutMs);
  try {
    const response=await fetch(url,{signal:controller.signal});
    if(!response.ok){
      let detail;try{detail=await response.json();}catch{}
      throw Error(typeof detail?.error==='string'?detail.error:`No se pudo cargar el recurso (HTTP ${response.status}).`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);
  }
}

export function createResourceCache(load=fetchJSON,{maxEntries=128}={}){
  if(!Number.isInteger(maxEntries)||maxEntries<1)throw TypeError('maxEntries must be a positive integer.');
  const values=new Map(),pending=new Map();
  function read(key){
    if(values.has(key)){const value=values.get(key);values.delete(key);values.set(key,value);return Promise.resolve(value);}
    if(pending.has(key))return pending.get(key);
    const work=Promise.resolve().then(()=>load(key)).then(value=>{
      values.set(key,value);while(values.size>maxEntries)values.delete(values.keys().next().value);
      return value;
    }).finally(()=>pending.delete(key));
    pending.set(key,work);return work;
  }
  return {read,peek:key=>values.get(key)};
}

const resources=createResourceCache();
export const loadStaticJSON=url=>resources.read(url);
const histories=createResourceCache(async id=>{
  const data=await fetchJSON(`data/${id}.json`);
  if(data.id!==id||!Array.isArray(data.monthly)||!data.monthly.length)throw Error('El histórico está incompleto.');
  return data;
});
export function loadHistory(id){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))return Promise.reject(Error('Territorio inválido.'));
  return histories.read(id);
}
