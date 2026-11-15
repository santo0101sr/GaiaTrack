// Pause the actual animation scheduler when the scene cannot be seen.
export function createRenderLoop(frame,{isActive=()=>true,request=requestAnimationFrame,cancel=cancelAnimationFrame}={}){
  let handle=null,disposed=false;
  const tick=time=>{
    handle=null;
    if(disposed||!isActive())return;
    frame(time);
    if(!disposed&&isActive()&&handle===null)handle=request(tick);
  };
  return {
    sync(){
      if(disposed)return;
      if(isActive()){if(handle===null)handle=request(tick);}
      else if(handle!==null){cancel(handle);handle=null;}
    },
    dispose(){disposed=true;if(handle!==null)cancel(handle);handle=null;}
  };
}
