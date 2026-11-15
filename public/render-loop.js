// On-demand render scheduler: pauses when hidden or idle, wakes cleanly on invalidate().
export function createRenderLoop(frame,{isActive=()=>true,shouldContinue=()=>true,request=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
  let handle=null,disposed=false;
  const tick=time=>{
    handle=null;
    if(disposed||!isActive())return;
    frame(time);
    if(!disposed&&isActive()&&shouldContinue()&&handle===null)handle=request(tick);
  };
  return {
    sync(){
      if(disposed)return;
      if(isActive()&&shouldContinue()){if(handle===null)handle=request(tick);}
      else if(handle!==null){cancel(handle);handle=null;}
    },
    invalidate(){
      if(disposed||!isActive())return;
      if(handle===null)handle=request(tick);
    },
    dispose(){disposed=true;if(handle!==null)cancel(handle);handle=null;}
  };
}
