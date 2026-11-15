import test from 'node:test';
import assert from 'node:assert/strict';
import {createShadowTracker} from '../public/shadow-tracker.js';

test('Shadow map is reused when casters are unchanged and refreshed for movement, visibility, scale and context restoration',()=>{
  const renderer={shadowMap:{enabled:true,autoUpdate:true,needsUpdate:false}};
  const root={visible:true,scale:{x:1,y:1,z:1}};
  const caster={visible:true,position:{x:0,y:0,z:0}};
  const tracker=createShadowTracker(renderer,root,[caster]);
  assert.equal(renderer.shadowMap.autoUpdate,false);
  const expectUpdate=()=>{renderer.shadowMap.needsUpdate=false;tracker.update();assert.equal(renderer.shadowMap.needsUpdate,true);};
  expectUpdate();renderer.shadowMap.needsUpdate=false;tracker.update();assert.equal(renderer.shadowMap.needsUpdate,false);
  caster.position.y=.2;expectUpdate();caster.visible=false;expectUpdate();root.visible=false;expectUpdate();root.scale.x=.5;expectUpdate();
  tracker.invalidate();expectUpdate();
  renderer.shadowMap.enabled=false;renderer.shadowMap.needsUpdate=false;caster.position.y=.3;tracker.update();assert.equal(renderer.shadowMap.needsUpdate,false);
  renderer.shadowMap.enabled=true;expectUpdate();
});
