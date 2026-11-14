const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

export function cameraPan(dx,dy,{distance,pitch,yaw,height,fov=42}){
  const scale=2*distance*Math.tan(fov*Math.PI/360)/Math.max(1,height);
  const along=-dy*scale/Math.max(.25,Math.sin(pitch)),across=-dx*scale;
  return {x:across*Math.cos(yaw)+along*Math.sin(yaw),z:-across*Math.sin(yaw)+along*Math.cos(yaw)};
}

export function createMapCamera({canvas,getState,onChange,onStart,onPick,onRecenter,onModeChange=()=>{}}){
  const pointers=new Map();let mode='pan';
  canvas.style.touchAction='none';canvas.tabIndex=0;
  const change=patch=>{
    if(patch.focus)patch.focus={x:clamp(patch.focus.x,-30,30),y:patch.focus.y,z:clamp(patch.focus.z,-30,30)};
    if(patch.distance!=null)patch.distance=clamp(patch.distance,2,45);
    if(patch.pitch!=null)patch.pitch=clamp(patch.pitch,.2,1.35);
    onChange(patch);
  };
  function pan(dx,dy){const s=getState(),d=cameraPan(dx,dy,{...s,height:canvas.getBoundingClientRect().height});change({focus:{x:s.focus.x+d.x,y:s.focus.y,z:s.focus.z+d.z}});}
  function gesture(){const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};}
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    onStart();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,type:e.pointerType,moved:false,multi:false});
    if(pointers.size>1)for(const p of pointers.values())p.multi=true;
  });
  canvas.addEventListener('pointermove',e=>{
    const p=pointers.get(e.pointerId);if(!p)return;
    const multi=pointers.size===2&&p.type==='touch',before=multi?gesture():null;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    p.moved||=Math.hypot(p.x-p.startX,p.y-p.startY)>4;
    if(multi){
      const after=gesture();pan(after.x-before.x,after.y-before.y);
      const s=getState(),angle=Math.atan2(Math.sin(after.angle-before.angle),Math.cos(after.angle-before.angle));
      change({distance:before.distance>1&&after.distance>1?s.distance*before.distance/after.distance:s.distance,yaw:s.yaw-angle});return;
    }
    if(!p.moved||pointers.size!==1)return;
    if(mode==='rotate'||p.button===2||e.shiftKey){const s=getState();change({yaw:s.yaw-dx*.005,pitch:s.pitch+dy*.005});}
    else pan(dx,dy);
  });
  const finish=(e,pick)=>{
    const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(pick&&!p.moved&&!p.multi&&p.button===0&&Math.hypot(e.clientX-p.startX,e.clientY-p.startY)<=4)onPick(e);
  };
  canvas.addEventListener('pointerup',e=>finish(e,true));
  canvas.addEventListener('pointercancel',e=>finish(e,false));
  canvas.addEventListener('lostpointercapture',e=>pointers.delete(e.pointerId));
  canvas.addEventListener('wheel',e=>{e.preventDefault();onStart();change({distance:getState().distance*Math.exp(clamp(e.deltaY,-1000,1000)*.0012)});},{passive:false});
  canvas.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase(),step=e.shiftKey?80:35;
    if(!['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d','q','e','+','=','-','r','0'].includes(key))return;
    e.preventDefault();onStart();
    if(['arrowleft','a'].includes(key))pan(step,0);
    else if(['arrowright','d'].includes(key))pan(-step,0);
    else if(['arrowup','w'].includes(key))pan(0,step);
    else if(['arrowdown','s'].includes(key))pan(0,-step);
    else if(key==='q'||key==='e')change({yaw:getState().yaw+(key==='q'?.1:-.1)});
    else if(key==='r'||key==='0')onRecenter();
    else change({distance:getState().distance*(key==='-'?1.15:1/1.15)});
  });
  return {get interacting(){return pointers.size>0;},get mode(){return mode;},setMode(next){mode=next==='rotate'?'rotate':'pan';onModeChange(mode);}};
}
