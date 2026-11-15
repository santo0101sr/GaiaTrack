import {tx} from './i18n.js';

export function attachMovablePanel(panel, {id, english, spanish, parent}) {
  const toolbar=document.createElement('div');
  toolbar.className='panel-toolbar';
  const handle=document.createElement('button');
  handle.type='button';handle.className='panel-move';
  const minimize=document.createElement('button');
  minimize.type='button';minimize.className='panel-minimize';minimize.textContent='−';
  const dock=document.createElement('button');
  dock.type='button';dock.className='panel-dock';dock.hidden=true;
  toolbar.append(handle,minimize);parent.append(dock);
  let drag=null,position=null,side='left';
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,Math.max(min,max)));
  function labels(){
    const name=tx(english,spanish);
    handle.textContent=tx('⠿ Move','⠿ Mover');
    handle.setAttribute('aria-label',tx(`Move ${name}; use arrow keys`,`Mover ${name}; usá las flechas`));
    minimize.setAttribute('aria-label',tx(`Minimize ${name}`,`Minimizar ${name}`));
    dock.textContent=tx(`› ${name}`,`› ${name}`);
    dock.setAttribute('aria-label',tx(`Restore ${name}`,`Restaurar ${name}`));
  }
  function place(x,y){
    const r=panel.getBoundingClientRect();
    position={x:clamp(x,0,innerWidth-r.width),y:clamp(y,0,innerHeight-Math.min(r.height,innerHeight))};
    panel.classList.add('panel-moved');
    panel.style.setProperty('--panel-x',`${position.x}px`);
    panel.style.setProperty('--panel-y',`${position.y}px`);
  }
  function save(){try{localStorage.setItem(`gaiatrack-panel-${id}`,JSON.stringify({position,side,minimized:!dock.hidden}));}catch{}}
  function collapse(edge){
    side=edge;dock.dataset.side=side;
    const r=panel.getBoundingClientRect();
    dock.style.top=`${clamp(r.top,80,innerHeight-100)}px`;
    panel.classList.add('user-minimized');dock.hidden=false;save();
  }
  minimize.addEventListener('click',()=>{const r=panel.getBoundingClientRect();collapse(r.left+r.width/2<innerWidth/2?'left':'right');dock.focus();});
  dock.addEventListener('click',()=>{panel.classList.remove('user-minimized');dock.hidden=true;if(position)place(position.x,position.y);save();handle.focus();});
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const r=panel.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
    handle.setPointerCapture(event.pointerId);event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>5)drag.moved=true;
    if(drag.moved)place(drag.left+dx,drag.top+dy);
  });
  handle.addEventListener('pointerup',event=>{
    if(!drag)return;
    if(drag.moved&&(event.clientX<48||event.clientX>innerWidth-48))collapse(event.clientX<48?'left':'right');
    else if(drag.moved)save();
    drag=null;
  });
  handle.addEventListener('pointercancel',()=>{drag=null;});
  handle.addEventListener('keydown',event=>{
    const moves={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]};
    if(!moves[event.key])return;
    event.preventDefault();const r=panel.getBoundingClientRect(),[dx,dy]=moves[event.key];place(r.left+dx,r.top+dy);save();
  });
  globalThis.addEventListener?.('resize',()=>{if(position&&!panel.classList.contains('user-minimized'))place(position.x,position.y);});
  document.addEventListener('gaiatrack:lang',labels);labels();
  try{
    const stored=JSON.parse(localStorage.getItem(`gaiatrack-panel-${id}`));
    if(stored?.position&&Number.isFinite(stored.position.x)&&Number.isFinite(stored.position.y))place(stored.position.x,stored.position.y);
    if(stored?.minimized)collapse(stored.side==='right'?'right':'left');
  }catch{}
  return toolbar;
}
