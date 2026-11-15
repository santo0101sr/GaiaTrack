// The shadow-casting territory geometry is static between selection transitions.
// Reuse the existing shadow map until a caster or its parent actually changes.
export function createShadowTracker(renderer, root, casters) {
  let previous=null;
  renderer.shadowMap.autoUpdate=false;
  return {
    invalidate(){previous=null;},
    update(){
      if(!renderer.shadowMap.enabled)return;
      const state=[root.visible,root.scale.x,root.scale.y,root.scale.z];
      for(const mesh of casters)state.push(mesh.visible,mesh.position.x,mesh.position.y,mesh.position.z);
      if(!previous||state.length!==previous.length||state.some((value,index)=>value!==previous[index])){
        renderer.shadowMap.needsUpdate=true;
        previous=state;
      }
    }
  };
}
