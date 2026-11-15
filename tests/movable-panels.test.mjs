import test from 'node:test';
import assert from 'node:assert/strict';
import {attachMovablePanel} from '../public/movable-panels.js';

test('Panels can be dragged to either edge, restored, and minimized with their button',()=>{
  const original={document:globalThis.document,localStorage:globalThis.localStorage,innerWidth:globalThis.innerWidth,innerHeight:globalThis.innerHeight};
  class Element extends EventTarget{
    constructor(){super();this.children=[];this.dataset={};this.hidden=false;this.values={};this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)};this.style={setProperty:(k,v)=>this.values[k]=v};}
    append(...nodes){this.children.push(...nodes);}
    setAttribute(){} setPointerCapture(){} focus(){}
    getBoundingClientRect(){const left=parseFloat(this.values['--panel-x'])||100,top=parseFloat(this.values['--panel-y'])||150;return {left,top,width:200,height:200,right:left+200,bottom:top+200};}
  }
  const document=new EventTarget();document.createElement=()=>new Element();globalThis.document=document;
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.innerWidth=1000;globalThis.innerHeight=700;
  const fire=(target,type,props={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);};
  try{
    const panel=new Element(),parent=new Element();
    const toolbar=attachMovablePanel(panel,{id:'test',english:'Conditions',spanish:'Condiciones',parent});
    const [handle,minimize]=toolbar.children,[dock]=parent.children;
    fire(handle,'pointerdown',{button:0,clientX:150,clientY:160,pointerId:1});
    fire(handle,'pointermove',{clientX:10,clientY:200});fire(handle,'pointerup',{clientX:10,clientY:200});
    assert.equal(panel.classList.contains('user-minimized'),true);assert.equal(dock.dataset.side,'left');assert.equal(dock.hidden,false);
    fire(dock,'click');assert.equal(panel.classList.contains('user-minimized'),false);assert.equal(dock.hidden,true);
    fire(handle,'pointerdown',{button:0,clientX:100,clientY:200,pointerId:2});
    fire(handle,'pointermove',{clientX:990,clientY:220});fire(handle,'pointerup',{clientX:990,clientY:220});
    assert.equal(dock.dataset.side,'right');fire(dock,'click');fire(minimize,'click');
    assert.equal(dock.hidden,false);assert.equal(dock.dataset.side,'right');
    assert.equal(JSON.parse(memory.get('gaiatrack-panel-test')).minimized,true);
  }finally{Object.assign(globalThis,original);}
});
