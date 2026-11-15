import {getGaiaSelection, applyGaiaAction, getGaiaLocalReply} from './app.js';

const host=document.createElement('aside');
host.id='gaia-chat';
host.innerHTML=`<button id="gaia-launch" type="button" aria-expanded="false" aria-controls="gaia-panel">✦ Preguntale a Gaia</button>
<section id="gaia-panel" role="dialog" aria-labelledby="gaia-title" hidden>
  <header><div><strong id="gaia-title">Preguntale a Gaia</strong><small>Tu guía para explorar Costa Rica</small></div><button id="gaia-clear" type="button" aria-label="Borrar conversación">Nueva</button><button id="gaia-close" type="button" aria-label="Cerrar chat">✕</button></header>
  <p class="gaia-notice">Los comandos claros se resuelven aquí, sin usar cuota. Las consultas que necesitan IA se envían con su contexto a OpenRouter y al proveedor del modelo. Contrastá las respuestas con las fuentes.</p>
  <div id="gaia-messages" role="log" aria-live="polite" aria-relevant="additions"></div>
  <div class="gaia-suggestions"><button type="button">¿Qué puedo investigar?</button><button type="button">Compará la lluvia entre las provincias de Limón y Guanacaste desde 2010</button></div>
  <form id="gaia-form"><label for="gaia-input" class="sr-only">Tu pregunta para Gaia</label><textarea id="gaia-input" rows="2" maxlength="2000" placeholder="¿Está aumentando la temperatura en Heredia?" required></textarea><button id="gaia-send" type="submit">Enviar ↗</button></form>
  <p id="gaia-status" role="status"></p>
</section>`;
document.body.append(host);
const $=selector=>host.querySelector(selector);
const messages=[];
let pending=false,cooldownUntil=0;
function trimMessages(){while($('#gaia-messages').children.length>24)$('#gaia-messages').firstElementChild.remove();}
function addMessage(role,text){
  const item=document.createElement('div');item.className=`gaia-message gaia-${role}`;
  const label=document.createElement('strong');label.textContent=role==='user'?'Vos':'Gaia';
  const content=document.createElement('p');content.textContent=text;
  item.append(label,content);$('#gaia-messages').append(item);trimMessages();item.scrollIntoView({block:'nearest'});
}
function toggle(open){$('#gaia-panel').hidden=!open;$('#gaia-launch').setAttribute('aria-expanded',String(open));if(open)$('#gaia-input').focus();else $('#gaia-launch').focus();}
$('#gaia-launch').onclick=()=>toggle($('#gaia-panel').hidden);
$('#gaia-close').onclick=()=>toggle(false);
host.addEventListener('keydown',event=>{if(event.key==='Escape')toggle(false);});
function reset(){messages.length=0;$('#gaia-messages').replaceChildren();$('#gaia-status').textContent='';addMessage('assistant','¡Hola! Puedo ayudarte a investigar tendencias, comparar territorios y abrir el mapa o el pronóstico. ¿Qué querés explorar?');}
$('#gaia-clear').onclick=reset;
host.querySelectorAll('.gaia-suggestions button').forEach(button=>button.onclick=()=>{$('#gaia-input').value=button.textContent;$('#gaia-form').requestSubmit();});
$('#gaia-form').onsubmit=async event=>{
  event.preventDefault();
  const question=$('#gaia-input').value.trim();if(!question||pending)return;
  pending=true;$('#gaia-send').disabled=true;$('#gaia-clear').disabled=true;
  host.querySelectorAll('.gaia-suggestions button').forEach(button=>button.disabled=true);
  $('#gaia-status').textContent='Gaia está consultando…';
  addMessage('user',question);$('#gaia-input').value='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),32000);
  try{
    let result=getGaiaLocalReply(question);
    if(!result){
      if(!navigator.onLine)throw Error('Sin conexión. Podés usar comandos directos como “Abrí el mapa” o “Mostrá la temperatura de la provincia de Heredia”.');
      if(Date.now()<cooldownUntil)throw Error('La IA está en pausa por un límite del proveedor. Los comandos directos y el explorador siguen disponibles.');
      const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[...messages,{role:'user',content:question}].slice(-5),selection:getGaiaSelection()}),signal:controller.signal});
      result=await response.json();
      if(!response.ok){
        const retry=Number(result.retryAfter??response.headers.get('retry-after'));
        if(retry>0)cooldownUntil=Date.now()+Math.min(retry,86400)*1000;
        throw Error(result.error||'No se pudo consultar a Gaia.');
      }
    }
    if(typeof result.reply!=='string'||!Array.isArray(result.actions))throw Error('La respuesta está incompleta.');
    // Apply only the final validated state; intermediate tool queries need no animation.
    if(result.actions.length)applyGaiaAction(result.actions.at(-1));
    addMessage('assistant',result.reply);
    messages.push({role:'user',content:question},{role:'assistant',content:result.reply.slice(0,2000)});
    while(messages.length>10)messages.splice(0,2);
    if(result.evidence?.length){
      const source=document.createElement('a');source.href='/credits.html';source.target='_blank';source.rel='noopener';source.textContent='Fuentes y método · NASA POWER / Open-Meteo';source.className='gaia-source';$('#gaia-messages').append(source);trimMessages();
    }
    $('#gaia-status').textContent=result.mode==='local'?'Guía local · sin consumir cuota de IA.':result.mode==='cached'?'Respuesta reutilizada · sin consumir otra consulta de IA.':'Respuesta con IA · podés seguir preguntando.';
  }catch(error){
    addMessage('assistant',error.name==='AbortError'?'La consulta tardó demasiado. Podés reintentar.':error.message);
    if(!$('#gaia-input').value.trim())$('#gaia-input').value=question;$('#gaia-status').textContent='Podés seguir usando los comandos directos y el explorador.';
  }finally{
    clearTimeout(timer);pending=false;$('#gaia-send').disabled=false;$('#gaia-clear').disabled=false;
    host.querySelectorAll('.gaia-suggestions button').forEach(button=>button.disabled=false);
  }
};
reset();
