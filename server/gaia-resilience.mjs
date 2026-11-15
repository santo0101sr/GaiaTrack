import {createHash} from 'node:crypto';

// Private, bounded, process-local state. Never CDN-cache personal conversations.
export function createChatRuntime({now=Date.now,maxEntries=64,maxConcurrent=2}={}){
  const cache=new Map(),pending=new Map();let active=0,cooldown=0;
  const keyFor=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  return {
    now,
    async run(keyValue,work){
      const key=keyFor(keyValue),stamp=now();
      for(const [id,item] of cache)if(item.until<=stamp)cache.delete(id);
      if(cache.has(key)){const item=cache.get(key);cache.delete(key);cache.set(key,item);return {...structuredClone(item.value),cached:true};}
      if(pending.has(key))return structuredClone(await pending.get(key));
      if(cooldown>stamp){const error=Error('La IA está en pausa por un límite del proveedor. Podés usar comandos directos y el explorador.');error.status=429;error.retryAfter=Math.ceil((cooldown-stamp)/1000);throw error;}
      if(active>=maxConcurrent){const error=Error('Gaia está atendiendo otras consultas. Probá en unos segundos o usá un comando directo.');error.status=429;error.retryAfter=10;throw error;}
      active++;
      const promise=Promise.resolve().then(work).then(value=>{
        if(value.status===200){const weather=value.body.actions?.some(action=>['forecast','current'].includes(action.view));cache.set(key,{until:now()+(weather?60000:300000),value:structuredClone(value)});while(cache.size>maxEntries)cache.delete(cache.keys().next().value);}
        return value;
      }).catch(error=>{
        if(error.providerStatus===429||error.providerStatus===402||error.providerStatus>=500||['TimeoutError','TypeError'].includes(error.name)){
          const seconds=Number.isFinite(error.retryAfter)?error.retryAfter:[429,402].includes(error.providerStatus)?300:30;
          const delay=Math.min(86400000,Math.max(10000,seconds*1000));cooldown=now()+delay;error.retryAfter=Math.ceil(delay/1000);
        }
        throw error;
      }).finally(()=>{active--;pending.delete(key);});
      pending.set(key,promise);return structuredClone(await promise);
    }
  };
}
