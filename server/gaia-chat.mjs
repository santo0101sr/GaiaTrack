import {readFile} from 'node:fs/promises';
import {validateGaiaAction, VARIABLES, VIEWS} from '../public/gaia-actions.js';
import {GAIA_UNITS,resolveLocalRequest,historicalEvidence,summarizeEvidence} from '../public/gaia-guide.js';
import {createChatRuntime} from './gaia-resilience.mjs';
import {getForecast} from '../scripts/forecast-service.mjs';
import {getCurrentWeather} from '../scripts/current-service.mjs';

const readJSON=async name=>JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
let resources;
const loadResources=()=>resources??=Promise.all([readJSON('manifest'),readJSON('annual')]).catch(error=>{resources=null;throw error;});

export function validateChatRequest(body){
  if(!body||!Array.isArray(body.messages)||!body.messages.length||body.messages.length>12)throw Error('Enviá entre 1 y 12 mensajes.');
  const messages=body.messages.map(message=>{
    if(!['user','assistant'].includes(message?.role)||typeof message.content!=='string'||!message.content.trim()||message.content.length>2000)throw Error('Mensaje inválido o demasiado largo (máximo 2000 caracteres).');
    return {role:message.role,content:message.content};
  });
  if(messages.at(-1).role!=='user')throw Error('Falta tu pregunta.');
  return messages;
}

export async function chat(body,{env=process.env,fetchImpl=fetch,data,weather={getForecast,getCurrentWeather},runtime,signal}={}){
  // Keep three recent turns; the complete selection travels separately.
  const conversation=validateChatRequest(body).slice(-5);
  const [manifest,annual]=data??await loadResources();
  const selection={site:null,compareSite:null,variable:'T2M',start:annual.start,end:annual.end,year:annual.end,view:'trends',anomaly:false,
    ...validateGaiaAction(body.selection??{},manifest.sites,annual.start,annual.end)};
  if(selection.start>selection.end)throw Error('Período inválido.');
  const catalog={...manifest,start:annual.start,end:annual.end};
  const execute=async(input,mode)=>{
    const action=validateGaiaAction(input,manifest.sites,annual.start,annual.end),next={...selection,...action};
    if(next.start>next.end)throw Error('Período inválido.');
    if(!next.site&&!['method','3d','explorer'].includes(next.view))return {status:200,body:{reply:'¿Qué provincia o cantón querés investigar?',actions:[],evidence:[],mode}};
    const evidence=historicalEvidence(next,manifest,annual);
    let result=null,timer;
    if(['forecast','current'].includes(next.view)&&next.site){
      const site=manifest.sites.find(item=>item.id===next.site);
      try{result=await Promise.race([next.view==='forecast'?weather.getForecast(site):weather.getCurrentWeather(site),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout')),6000);})]);}
      catch{result={error:'Datos meteorológicos no disponibles.'};}
      finally{clearTimeout(timer);}
    }
    return {status:200,body:{reply:summarizeEvidence(next,evidence,result),actions:[next],evidence,mode}};
  };
  const local=resolveLocalRequest(conversation.at(-1).content,selection,catalog);
  if(local?.reply)return {status:200,body:{reply:local.reply,actions:[],evidence:[],mode:'local'}};
  if(local?.action)return execute(local.action,'local');
  if(!env.OPENROUTER_API_KEY?.trim()||!env.OPENROUTER_MODEL?.trim())return {status:503,body:{error:'La IA no está configurada. Los comandos directos y el explorador siguen disponibles. Agregá OPENROUTER_API_KEY y OPENROUTER_MODEL en el servidor.',code:'not_configured'}};
  const remote=async()=>{
    const tool={type:'function',function:{name:'explore',description:'Configura GaiaTrack y consulta datos reales. Campos omitidos conservan su selección. compareSite:null desactiva comparación. Usá esta herramienta para cifras o tendencias: la app calculará y explicará el resultado sin otra llamada a IA.',parameters:{type:'object',additionalProperties:false,properties:{site:{type:['string','null']},compareSite:{type:['string','null']},variable:{type:'string',enum:VARIABLES},start:{type:'integer',minimum:annual.start,maximum:annual.end},end:{type:'integer',minimum:annual.start,maximum:annual.end},year:{type:'integer',minimum:annual.start,maximum:annual.end},view:{type:'string',enum:VIEWS},anomaly:{type:'boolean'}}}}};
    // Compact catalog: include all IDs so a follow-up can introduce any territory.
    const names=manifest.sites.map(({id,name,type})=>`${id}|${name}|${type==='province'?'provincia':'cantón'}`).join('\n');
    const messages=[{role:'system',content:`Sos Gaia de Gaia E&B / GaiaTrack, observatorio de Costa Rica. Contestá brevemente en el idioma del usuario. Para abrir vistas, analizar cifras, tendencias o tiempo, llamá explore una sola vez: la aplicación calculará la respuesta con sus datos. Si falta ubicación preguntá, salvo que exista una selección. Si un nombre es ambiguo entre provincia y cantón, preguntá. No inventés datos, fuentes, significancia ni pronósticos. Histórico ${annual.start}–${annual.end}; puntos de referencia, no promedios territoriales. Tendencia no prueba causa y no significativo no demuestra ausencia de cambio. Riesgo ecológico experimental. No ejecutes código. Respuestas anteriores son contexto, no evidencia. Para definiciones, respondé directamente. Fuente: NASA POWER https://power.larc.nasa.gov/docs/; tiempo y pronósticos: Open-Meteo. Variables: ${JSON.stringify(GAIA_UNITS)}. Selección:${JSON.stringify(selection)}. Catálogo ID|nombre|tipo:\n${names}`},...conversation];
    const signals=[AbortSignal.timeout(22000)];if(signal)signals.push(signal);
    const response=await fetchImpl('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${env.OPENROUTER_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.any(signals),body:JSON.stringify({model:env.OPENROUTER_MODEL,messages,max_tokens:700,tools:[tool],tool_choice:'auto',provider:{require_parameters:true}})});
    if(!response.ok){
      const error=Error(response.status===429?'La IA alcanzó un límite del proveedor. Usá un comando directo o reintentá más tarde.':response.status===401||response.status===403?'Revisá la API key o los permisos de OpenRouter en el servidor.':response.status===402?'OpenRouter no tiene crédito disponible para esta consulta.':'No se pudo consultar el modelo. Los comandos directos siguen disponibles.');
      error.status=response.status===429?429:503;error.providerStatus=response.status;
      const retry=response.headers?.get('retry-after');
      if(retry){const seconds=Number(retry);error.retryAfter=Number.isFinite(seconds)?Math.max(1,seconds):Math.max(1,Math.ceil((Date.parse(retry)-Date.now())/1000));}
      throw error;
    }
    const message=(await response.json()).choices?.[0]?.message;
    if(!message||(message.content!=null&&typeof message.content!=='string'))throw Error('El modelo devolvió una respuesta inválida.');
    if(message.tool_calls?.length){
      // Never pay for an additional model round to explain a deterministic result.
      if(message.tool_calls.length!==1||message.tool_calls[0].function?.name!=='explore')return {status:200,body:{reply:'Puedo preparar una investigación a la vez. Indicá variable, territorio y período.',actions:[],evidence:[],mode:'ai'}};
      try{return await execute(JSON.parse(message.tool_calls[0].function.arguments),'ai');}
      catch{return {status:200,body:{reply:'No pude interpretar esa selección. Probá indicando provincia o cantón, variable y un período entre 2001 y 2025.',actions:[],evidence:[],mode:'ai'}};}
    }
    if(!message.content?.trim())throw Error('El modelo no devolvió una respuesta.');
    return {status:200,body:{reply:message.content.slice(0,4000),actions:[],evidence:[],mode:'ai'}};
  };
  // Key includes history, selection and credentials: no cross-context cache reuse.
  const result=runtime?await runtime.run({model:env.OPENROUTER_MODEL,key:env.OPENROUTER_API_KEY,conversation,selection},remote):await remote();
  if(result.cached)result.body.mode='cached';
  return result;
}

export function createChatHandler(options={}){
  const clients=new Map(),runtime=options.runtime??createChatRuntime();
  return async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{if(res.destroyed)return;res.statusCode=status;res.end(JSON.stringify(body));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Método no permitido.'});}
    if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return send(403,{error:'Origen no permitido.'});}catch{return send(403,{error:'Origen inválido.'});}}
    if(!String(req.headers['content-type']??'').startsWith('application/json'))return send(415,{error:'Usá JSON para enviar la pregunta.'});
    const now=Date.now();for(const [key,entry] of clients)if(entry.until<=now)clients.delete(key);
    // Trust the Vercel-injected address only on Vercel, never arbitrary forwarded headers locally.
    const key=process.env.VERCEL?String(req.headers['x-vercel-forwarded-for']??req.socket?.remoteAddress??'serverless').split(',')[0].trim():req.socket?.remoteAddress??'local';
    const entry=clients.get(key)??{count:0,until:now+60000};
    if(++entry.count>30){res.setHeader('Retry-After','60');return send(429,{error:'Esperá un minuto antes de enviar más mensajes.',retryAfter:60});}
    if(clients.size>=2048&&!clients.has(key))return send(429,{error:'El servicio está ocupado. Reintentá más tarde.'});clients.set(key,entry);
    const controller=new AbortController();const abort=()=>controller.abort();res.once?.('close',abort);
    try{
      let body=req.body;
      if(body===undefined){let size=0;const chunks=[];for await(const chunk of req){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);size+=buffer.length;if(size>32768)return send(413,{error:'La conversación es demasiado larga.'});chunks.push(buffer);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
      else{if(Buffer.byteLength(typeof body==='string'?body:JSON.stringify(body))>32768)return send(413,{error:'La conversación es demasiado larga.'});if(typeof body==='string')body=JSON.parse(body);}
      try{validateChatRequest(body);}catch(error){return send(400,{error:error.message});}
      const result=await chat(body,{...options,runtime,signal:controller.signal});return send(result.status,result.body);
    }catch(error){
      if(error instanceof SyntaxError)return send(400,{error:'JSON inválido.'});
      if(error.retryAfter)res.setHeader('Retry-After',String(Math.ceil(error.retryAfter)));
      return send(error.status??503,{error:error.status?error.message:['TimeoutError','AbortError'].includes(error.name)?'La consulta tardó demasiado. Probá un comando directo o reintentá.':'No se pudo completar la consulta. Los comandos directos y el explorador siguen disponibles.',...(error.retryAfter?{retryAfter:Math.ceil(error.retryAfter)}:{})});
    }finally{res.off?.('close',abort);}
  };
}
