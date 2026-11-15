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
    const raw=(site,precipitation,weatherCode,longitude)=>({site,name:site,precipitation,weatherCode,intervalSeconds:900,observedAt:new Date().toISOString(),clouds:100,isDay:true,solarRadiation:700,requested:{longitude,latitude:0}});
    publishWeather('current',raw('heredia',1,63,0));
    publishWeather('current',raw('limon',0,3,4));
    const scene=createWeatherExperience({root,meshes,light,coords});
    const group=root.getObjectByName('selected-weather');
    const rain=group.children.find(c=>c.isLineSegments);
    const selectedSky=group.getObjectByName('territory-sky');
    assert.equal(selectedSky.userData.cloudCover,1);assert.equal(selectedSky.userData.sunStrength,0);
    for(let t=0;t<1000;t+=33)scene.animate(t,true);
    assert.ok(rain.geometry.drawRange.count>0);
    // Decorative motion/reduced-motion no longer disables data-driven precipitation.
    const dropPositions=rain.geometry.attributes.position.array;
    const positionBefore=dropPositions[1];scene.animate(1020,false);
    assert.notEqual(dropPositions[1],positionBefore);
    document.querySelector('#weather-motion').onclick();
    const paused=dropPositions.slice();scene.animate(1050,false);
    assert.deepEqual(dropPositions,paused);
    document.querySelector('#weather-motion').onclick();scene.animate(1080,false);
    assert.notDeepEqual(dropPositions,paused);

    document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:'limon'}}));
    assert.equal(rain.geometry.drawRange.count,0);
    assert.equal(group.position.x,4);
    scene.animate(1100,true);
    assert.equal(rain.geometry.drawRange.count,0);
    const rainyProvince=root.getObjectByName('province-weather-heredia');
    assert.equal(rainyProvince.visible,true);
    assert.ok(rainyProvince.children.find(c=>c.isLineSegments).geometry.drawRange.count>0);
    assert.equal(root.getObjectByName('province-weather-limon').visible,false);
    publishWeather('current',{...raw('limon',0,2,4),clouds:10,isDay:true});
    assert.equal(selectedSky.userData.cloudCover,.1);assert.ok(selectedSky.userData.sunStrength>0);
    publishWeather('current',{...raw('limon',0,2,4),clouds:10,isDay:false});
    assert.equal(selectedSky.userData.sunStrength,0);
    assert.match(document.querySelector('#weather-date').textContent,/Night/);

    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:'limon'}}));
    scene.animate(1110,true);assert.equal(rainyProvince.visible,false);
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:null}}));
    scene.animate(1120,true);assert.equal(rainyProvince.visible,true);
    assert.equal(group.visible,false);
    // Country view uses all seven province systems, without overlaying a selected canton's rain.
    document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:'heredia'}}));
    scene.animate(1125,true);assert.equal(rainyProvince.visible,true);assert.equal(group.visible,false);

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

test('National and provincial views show a wet canton even with a dry provincial point',async()=>{
  const originalDocument=globalThis.document,originalFetch=globalThis.fetch;
  globalThis.document=sceneDocument();globalThis.fetch=async()=>({ok:true,json:async()=>({monthly:[]})});
  try{
    const root=new THREE.Group(),light=new THREE.DirectionalLight(),coords=(lon,lat)=>new THREE.Vector3(lon,0,lat);
    const sites=[{id:'heredia',name:'Heredia',type:'province',province:'heredia'},{id:'heredia-centro',name:'Heredia centro',type:'canton',province:'heredia'},{id:'limon-centro',name:'Limón centro',type:'canton',province:'limon'}];
    const meshes=sites.filter(item=>item.type==='canton').map((item,index)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.26,1),new THREE.MeshStandardMaterial());mesh.position.x=index*4;mesh.userData={...item};root.add(mesh);return mesh;});
    const raw=(site,rain,x)=>({site,name:site,precipitation:rain,intervalSeconds:900,weatherCode:3,clouds:90,observedAt:new Date().toISOString(),requested:{longitude:x,latitude:0}});
    publishWeather('current',raw('heredia',0,0));publishWeather('current',raw('heredia-centro',2,0));publishWeather('current',raw('limon-centro',0,4));
    const scene=createWeatherExperience({root,meshes,light,coords,sites});
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:null}}));scene.animate(50);
    const wet=root.getObjectByName('canton-weather-heredia-centro'),dry=root.getObjectByName('canton-weather-limon-centro');
    assert.equal(wet.visible,true);assert.equal(dry.visible,true);
    const wetRain=wet.children.find(item=>item.isLineSegments),dryRain=dry.children.find(item=>item.isLineSegments);
    assert.ok(wetRain.geometry.drawRange.count>0);assert.equal(dryRain.geometry.drawRange.count,0);
    assert.equal(root.getObjectByName('selected-weather').visible,false);
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:'limon'}}));scene.animate(100);assert.equal(wet.visible,false);
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:'heredia'}}));
    document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:'heredia-centro'}}));scene.animate(150);
    const selected=root.getObjectByName('selected-weather');assert.equal(selected.visible,true);assert.equal(wet.visible,false);
    const selectedRain=selected.children.find(item=>item.isLineSegments);assert.ok(selectedRain.geometry.drawRange.count>0);
    publishWeather('current',raw('heredia-centro',0,0));assert.equal(selectedRain.geometry.drawRange.count,0);
    await Promise.resolve();
  }finally{globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});

test('Overview territories hide floating sun markers and reflect per-location cloudiness changes',async()=>{
  const originalDocument=globalThis.document,originalFetch=globalThis.fetch;
  globalThis.document=sceneDocument();globalThis.fetch=async()=>({ok:true,json:async()=>({monthly:[]})});
  try{
    const root=new THREE.Group(),light=new THREE.DirectionalLight(),coords=(lon,lat)=>new THREE.Vector3(lon,0,lat);
    const sites=[{id:'heredia-centro',name:'Heredia centro',type:'canton',province:'heredia'},{id:'limon-centro',name:'Limón centro',type:'canton',province:'limon'}];
    const meshes=sites.map((item,index)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,.26,1),new THREE.MeshStandardMaterial());mesh.position.x=index*4;mesh.userData={...item};root.add(mesh);return mesh;});
    const raw=(site,clouds,x)=>({site,name:site,precipitation:0,intervalSeconds:900,weatherCode:clouds>80?3:1,clouds,isDay:true,solarRadiation:800,observedAt:new Date().toISOString(),requested:{longitude:x,latitude:0}});
    publishWeather('current',raw('heredia-centro',20,0));publishWeather('current',raw('limon-centro',95,4));
    const scene=createWeatherExperience({root,meshes,light,coords,sites});
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province:null}}));scene.animate(50);
    const herediaSky=root.getObjectByName('canton-weather-heredia-centro').getObjectByName('territory-sky');
    const limonSky=root.getObjectByName('canton-weather-limon-centro').getObjectByName('territory-sky');
    assert.equal(herediaSky.getObjectByName('territory-sun').visible,false);
    assert.equal(limonSky.getObjectByName('territory-sun').visible,false);
    const herediaClouds=herediaSky.getObjectByName('bounded-cloud-layer'),limonClouds=limonSky.getObjectByName('bounded-cloud-layer');
    assert.ok(limonClouds.count>herediaClouds.count);
    assert.ok(limonClouds.material.opacity>herediaClouds.material.opacity);
    publishWeather('current',raw('heredia-centro',90,0));
    assert.ok(herediaClouds.count>limonClouds.count*.5);
    await Promise.resolve();
  }finally{globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});
