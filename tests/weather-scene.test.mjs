import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createWeatherExperience} from '../public/weather-experience.js';
import {publishWeather} from '../public/weather-state.js';

// Minimal DOM/canvas shell; geometry, materials and animation use the real Three.js module.
function sceneDocument(){
  const elements=new Map();
  class Element {
    value='';textContent='';hidden=false;
    classList={toggle(){},contains(){return false;}};
    setAttribute(){}
    append(){}
    before(){}
    set innerHTML(html){for(const [,id] of html.matchAll(/id="([^"]+)"/g))get('#'+id);}
    querySelector(selector){return get(selector);}
    querySelectorAll(){return [];}
    getContext(){return {createRadialGradient(){return {addColorStop(){}};},fillRect(){}};}
  }
  function get(selector){if(!elements.has(selector))elements.set(selector,new Element());return elements.get(selector);}
  const doc=new EventTarget();
  doc.querySelector=get;doc.createElement=()=>new Element();doc.body=new Element();
  get('#site-select').value='heredia';
  return doc;
}

test('Rain stops immediately when selecting a dry province, and province effects remain independent',async()=>{
  const originalDocument=globalThis.document,originalFetch=globalThis.fetch;
  globalThis.document=sceneDocument();
  globalThis.fetch=async()=>({ok:true,json:async()=>({monthly:[]})});
  try {
    const root=new THREE.Group(),light=new THREE.DirectionalLight();
    const coords=(lon,lat)=>new THREE.Vector3(lon,0,lat);
    const meshes=['heredia','limon'].map((province,i)=>{
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.26,1),new THREE.MeshStandardMaterial());
      mesh.position.x=i*4;mesh.userData={id:province+'-centro',province};root.add(mesh);return mesh;
    });
    const raw=(site,precipitation,weatherCode,longitude)=>({site,name:site,precipitation,weatherCode,intervalSeconds:900,observedAt:new Date().toISOString(),clouds:100,requested:{longitude,latitude:0}});
    publishWeather('current',raw('heredia',1,63,0));
    publishWeather('current',raw('limon',0,3,4));
    const scene=createWeatherExperience({root,meshes,light,coords});
    const group=root.getObjectByName('selected-weather');
    const rain=group.children.find(c=>c.isLineSegments);
    for(let t=0;t<1000;t+=33)scene.animate(t,true);
    assert.ok(rain.geometry.drawRange.count>0);

    document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:'limon'}}));
    assert.equal(rain.geometry.drawRange.count,0);
    assert.equal(group.position.x,4);
    scene.animate(1100,true);
    assert.equal(rain.geometry.drawRange.count,0);
    const rainyProvince=root.getObjectByName('province-weather-heredia');
    assert.equal(rainyProvince.visible,true);
    assert.ok(rainyProvince.children.find(c=>c.isLineSegments).geometry.drawRange.count>0);
    assert.equal(root.getObjectByName('province-weather-limon').visible,false);

    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:'limon'}}));
    scene.animate(1110,true);assert.equal(rainyProvince.visible,false);
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:null}}));
    scene.animate(1120,true);assert.equal(rainyProvince.visible,true);

    // No current data for this canton must not freeze other provinces' rain.
    document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:'unknown-canton'}}));
    const positions=rainyProvince.children.find(c=>c.isLineSegments).geometry.attributes.position.array;
    const before=positions[1];scene.animate(1133,true);
    assert.equal(group.visible,false);assert.notEqual(positions[1],before);

    // Current province weather must not appear in the hourly forecast scene.
    document.querySelector('#weather-future').onclick();scene.animate(1166,true);
    assert.equal(rainyProvince.visible,false);
    publishWeather('current',{...raw('heredia',5,65,0),observedAt:new Date(Date.now()-7200000).toISOString()});
    document.querySelector('#weather-now').onclick();scene.animate(1199,true);
    assert.equal(rainyProvince.visible,false);
    await Promise.resolve();
  } finally {
    globalThis.document=originalDocument;globalThis.fetch=originalFetch;
  }
});
