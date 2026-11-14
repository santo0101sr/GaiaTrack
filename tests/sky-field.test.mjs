import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {createRainDomain} from '../public/rain-field.js';
import {createSkyField,skyAppearance} from '../public/sky-field.js';
import {normalizeTimeline} from '../public/weather-state.js';

function territory(){
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(3,0);shape.lineTo(3,-1);shape.lineTo(1,-1);shape.lineTo(1,-3);shape.lineTo(0,-3);shape.closePath();
  const hole=new THREE.Path();hole.moveTo(.2,-.2);hole.lineTo(.7,-.2);hole.lineTo(.7,-.7);hole.lineTo(.2,-.7);hole.closePath();shape.holes.push(hole);
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
  return createRainDomain([new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())]);
}

test('Sun requires reported daylight, radiation and cloud data; cloudier skies obscure it',()=>{
  const clear=skyAppearance({isDay:true,solarRadiation:900,clouds:0});
  const partial=skyAppearance({isDay:true,solarRadiation:900,clouds:50});
  assert.ok(clear.sun>partial.sun&&partial.sun>0);
  assert.ok(skyAppearance({isDay:true,solarRadiation:100,clouds:0}).sun<clear.sun);
  for(const data of [
    {isDay:false,solarRadiation:900,clouds:0},
    {isDay:true,solarRadiation:0,clouds:0},
    {isDay:true,solarRadiation:900,clouds:100},
    {solarRadiation:900,clouds:0},
    {isDay:true,solarRadiation:900}
  ])assert.equal(skyAppearance(data).sun,0);
  assert.equal(skyAppearance({}).cover,null);
});

test('Cloud layers and solar halo remain inside concave boundaries and holes throughout animation',()=>{
  const domain=territory(),sky=createSkyField(domain),origin=new THREE.Vector3(.9,.25,.9);
  sky.setOrigin(origin);sky.setWeather({isDay:true,solarRadiation:900,clouds:40});
  assert.ok(sky.layers.length>0);assert.equal(sky.sun.visible,true);
  assert.ok(domain.containsDisk(sky.footprint,sky.footprint.radius));
  const cloud=sky.layers[0],matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  function checkClouds(){
    for(const disk of sky.cloudFootprints)assert.ok(domain.containsDisk(disk,disk.radius));
    const vertices=cloud.geometry.attributes.position;
    for(let i=0;i<cloud.count;i++){
      cloud.getMatrixAt(i,matrix);
      for(let j=0;j<vertices.count;j++){
        point.fromBufferAttribute(vertices,j).applyMatrix4(matrix).add(origin);
        assert.ok(domain.contains(point),'cloud vertex crossed a boundary');
      }
    }
  }
  checkClouds();
  const before=cloud.instanceMatrix.array.slice();
  for(let frame=0;frame<600;frame++)sky.animate(frame*50);
  checkClouds();
  // Buoyancy changes height; neither the cloud center nor its width can drift into a neighbour.
  for(let i=0;i<cloud.count;i++)for(const offset of [0,2,8,10,12,14])assert.equal(cloud.instanceMatrix.array[i*16+offset],before[i*16+offset]);
  assert.equal(domain.contains({x:.5,z:.5}),false);
  assert.equal(domain.contains({x:2,z:2}),false);
});

test('Independent province canopies reset immediately for clear skies, night and missing data',()=>{
  const domain=territory(),a=createSkyField(domain),b=createSkyField(domain);
  a.setWeather({isDay:true,clouds:100,solarRadiation:150});
  b.setWeather({isDay:true,clouds:0,solarRadiation:850});
  assert.equal(a.layers[0].visible,true);assert.equal(a.sun.visible,false);
  assert.equal(b.layers[0].visible,false);assert.equal(b.sun.visible,true);
  assert.equal(a.group.userData.cloudCover,1);
  assert.equal(b.group.userData.cloudCover,0);
  b.setWeather({isDay:true,clouds:20,solarRadiation:600});
  const count=b.layers[0].count,opacity=b.layers[0].material.opacity;
  b.setWeather({isDay:true,clouds:80,solarRadiation:600});
  assert.ok(b.layers[0].count>count);assert.ok(b.layers[0].material.opacity>opacity);
  b.setWeather({isDay:false,clouds:20,solarRadiation:50});
  assert.equal(b.sun.visible,false);assert.equal(b.halo.visible,false);
  a.setWeather({});assert.equal(a.layers[0].visible,false);assert.equal(a.sun.visible,false);
  a.setWeather({isDay:true,clouds:50,solarRadiation:500});assert.equal(a.layers[0].visible,true);
  a.setDomain(createRainDomain([]));a.setWeather({isDay:true,clouds:50,solarRadiation:500});
  assert.equal(a.layers[0].visible,false);assert.equal(a.sun.visible,false);
});

test('Hourly forecast preserves the provider daylight flags and unknown daylight stays unknown',()=>{
  const timeline=normalizeTimeline({hourly:{time:['2026-11-15T06:00','2026-11-15T18:00','2026-11-15T19:00'],is_day:[1,0,null],shortwave_radiation:[500,40,0],cloud_cover:[10,10,10]}},'2026-11-14');
  assert.deepEqual(timeline.map(d=>d.isDay),[true,false,null]);
  assert.ok(skyAppearance(timeline[0]).sun>0);
  assert.equal(skyAppearance(timeline[1]).sun,0);
  assert.equal(skyAppearance(timeline[2]).sun,0);
});
