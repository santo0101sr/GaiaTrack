import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPan,createMapCamera} from '../public/map-camera.js';

function setup(){
  class Canvas extends EventTarget {
    style={};captures=new Set();
    focus(){}
    getBoundingClientRect(){return {width:1000,height:700};}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
  }
  const canvas=new Canvas();let state={focus:{x:0,y:.4,z:0},distance:16,pitch:.8,yaw:.2},picks=0,resets=0;
  const controls=createMapCamera({canvas,getState:()=>state,onChange:patch=>state={...state,...patch},onStart(){},onPick(){picks++;},onRecenter(){resets++;}});
  const emit=(type,props)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,clientX:100,clientY:100,button:0,pointerType:'mouse',...props});canvas.dispatchEvent(event);};
  return {canvas,controls,emit,get state(){return state;},get picks(){return picks;},get resets(){return resets;}};
}

test('Dragging moves the ground under the pointer at different camera angles and zoom levels',()=>{
  const a=cameraPan(100,100,{distance:10,pitch:Math.PI/2,yaw:0,height:700});
  assert.ok(a.x<0&&a.z<0);
  const b=cameraPan(100,100,{distance:20,pitch:Math.PI/2,yaw:0,height:700});
  assert.equal(b.x,a.x*2);assert.equal(b.z,a.z*2);
  const s=setup();s.emit('pointerdown');s.emit('pointermove',{clientX:200});s.emit('pointerup',{clientX:200});
  assert.ok(s.state.focus.x<0);assert.equal(s.state.yaw,.2);assert.equal(s.picks,0);
  s.emit('pointerdown');s.emit('pointerup');assert.equal(s.picks,1);
});

test('Right drag and rotate mode orbit without changing the ground focus',()=>{
  const s=setup();s.emit('pointerdown',{button:2});s.emit('pointermove',{clientX:180,clientY:150});s.emit('pointerup',{button:2});
  assert.notEqual(s.state.yaw,.2);assert.notEqual(s.state.pitch,.8);assert.equal(s.state.focus.x,0);assert.equal(s.picks,0);
  s.controls.setMode('rotate');const yaw=s.state.yaw;s.emit('pointerdown');s.emit('pointermove',{clientX:200});s.emit('pointerup');assert.notEqual(s.state.yaw,yaw);
});

test('Pinch zoom, keyboard movement and recenter work without accidentally selecting provinces',()=>{
  const s=setup();s.emit('pointerdown',{pointerType:'touch'});s.emit('pointerdown',{pointerType:'touch',pointerId:2,clientX:200});
  s.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:300});
  assert.ok(s.state.distance<16);assert.notEqual(s.state.focus.x,0);
  s.emit('pointerup',{pointerType:'touch',pointerId:2});s.emit('pointerup',{pointerType:'touch'});assert.equal(s.picks,0);
  const x=s.state.focus.x;s.emit('keydown',{key:'ArrowRight'});assert.notEqual(s.state.focus.x,x);
  s.emit('keydown',{key:'r'});assert.equal(s.resets,1);
  for(let i=0;i<20;i++)s.emit('wheel',{deltaY:-1000});assert.equal(s.state.distance,2);
  for(let i=0;i<20;i++)s.emit('wheel',{deltaY:1000});assert.equal(s.state.distance,45);
});

test('Cancelled gestures do not select a territory or leave the camera dragging',()=>{
  const s=setup();s.emit('pointerdown');assert.equal(s.controls.interacting,true);
  s.emit('pointercancel');assert.equal(s.controls.interacting,false);assert.equal(s.picks,0);
});
