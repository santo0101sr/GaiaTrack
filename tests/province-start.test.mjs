import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createProvinceExplorer} from '../public/province-explorer.js';

test('Explorer opens unselected, selects only after input, and returning to country clears selection',()=>{
  const previous=globalThis.document,elements=new Map(),classes=new Set();
  class Element {
    children=[];attributes=new Map();value='';textContent='';hidden=false;
    classList={add:(...names)=>names.forEach(n=>classes.add(n)),toggle:(n,on)=>on?classes.add(n):classes.delete(n)};
    append(...children){this.children.push(...children);}
    prepend(child){this.children.unshift(child);}
    replaceChildren(...children){this.children=children;}
    setAttribute(name,value){this.attributes.set(name,value);}
    querySelector(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);}
  }
  const document=new EventTarget();document.createElement=()=>new Element();document.body=new Element();globalThis.document=document;
  try {
    const manifest={provinces:[{id:'heredia',name:'Heredia',siteId:'heredia'},{id:'alajuela',name:'Alajuela',siteId:'alajuela'}],sites:[
      {id:'heredia',name:'Heredia',type:'province',province:'heredia',longitude:0,latitude:0},
      {id:'barva',name:'Barva',type:'canton',province:'heredia',longitude:0,latitude:0},
      {id:'alajuela',name:'Alajuela',type:'province',province:'alajuela',longitude:2,latitude:2}
    ]};
    const geo={features:[{properties:{id:'barva',province:'heredia'},geometry:{coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}]};
    const meshes=['heredia','alajuela'].map(province=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.userData.province=province;return mesh;});
    const host=new Element(),choices=[];let explorer;
    explorer=createProvinceExplorer({host,manifest,geo,meshes,beacons:[],borders:[],root:new THREE.Group(),camera:new THREE.PerspectiveCamera(),coords:(x,z)=>new THREE.Vector3(x,0,z),onFocus(){},onSelect:id=>{choices.push(id);explorer.sync(id);}});
    assert.equal(host.querySelector('#hud-province-select').value,'');
    assert.equal(host.querySelector('.flight-intro h1').textContent,'Costa Rica');
    assert.equal(choices.length,0);assert.ok(meshes.every(m=>m.visible));
    const buttons=()=>{const walk=e=>[...e.children,...e.children.flatMap(walk)];return walk(host).filter(e=>e.className==='territory-choice');};
    assert.equal(buttons().length,2);assert.ok(buttons().every(b=>b.attributes.get('aria-pressed')==='false'));
    const select=host.querySelector('#hud-province-select');select.value='heredia';select.onchange();
    assert.deepEqual(choices,['heredia']);assert.equal(select.value,'heredia');assert.equal(meshes[1].visible,false);
    explorer.country(true);
    assert.deepEqual(choices,['heredia',null]);assert.equal(select.value,'');assert.ok(meshes.every(m=>m.visible));
    assert.ok(buttons().every(b=>b.attributes.get('aria-pressed')==='false'));
  }finally{globalThis.document=previous;}
});
