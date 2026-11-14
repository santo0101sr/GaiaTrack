import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';
import {createRainDomain,createRainField,rainAppearance} from '../public/rain-field.js';

function randomSource(){let seed=613;return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function meshFor(rings){
  const shape=new THREE.Shape();
  rings[0].forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
  for(const ring of rings.slice(1)){const hole=new THREE.Path();ring.forEach(([x,z],i)=>i?hole.lineTo(x,-z):hole.moveTo(x,-z));shape.holes.push(hole);}
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
}
const square=[[0,0],[2,0],[2,2],[0,2],[0,0]];
const hole=[[.6,.6],[1.4,.6],[1.4,1.4],[.6,1.4],[.6,.6]];
function checkDrops(field,origin,check){
  const positions=field.geometry.attributes.position.array;
  for(let i=0;i<field.geometry.drawRange.count;i+=2){
    const n=i*3,a={x:positions[n]+origin.x,z:positions[n+2]+origin.z},b={x:positions[n+3]+origin.x,z:positions[n+5]+origin.z};
    check(a,b);
  }
}

test('Rain boundary includes concave territory and islands but excludes holes and sea',()=>{
  const meshes=[meshFor([square,hole]),meshFor([[[3,0],[5,0],[5,.4],[3.4,.4],[3.4,2],[3,2],[3,0]]]),meshFor([[[7,0],[8,0],[8,1],[7,1],[7,0]]])];
  const domain=createRainDomain(meshes);
  assert.equal(domain.contains({x:1,z:1}),false);
  assert.equal(domain.contains({x:2.5,z:1}),false);
  assert.equal(domain.contains({x:4,z:1}),false);
  assert.equal(domain.contains({x:7.5,z:.5}),true);
  assert.equal(domain.containsSegment({x:.2,z:1},{x:1.8,z:1}),false);
  assert.equal(domain.containsSegment({x:.2,z:.2},{x:1.8,z:.2}),true);
  assert.equal(domain.containsDisk({x:.4,z:.4},.1),true);
  assert.equal(domain.containsDisk({x:.4,z:.4},.3),false);
  const random=randomSource();
  for(let i=0;i<1000;i++)assert.ok(domain.contains(domain.sample(random)));
});

test('Every positive rate is visible, with increasing density, speed, length and opacity',()=>{
  const values=[.0001,.2,2,8,25].map(precipitation=>rainAppearance({precipitation,weatherCode:61}));
  assert.ok(values[0].count>=1&&values[0].opacity>0);
  for(let i=1;i<values.length;i++)for(const key of ['count','speed','length','opacity'])assert.ok(values[i][key]>values[i-1][key],key);
  for(const data of [{precipitation:0},{precipitation:null},{precipitation:5,weatherCode:3}])assert.equal(rainAppearance(data).count,0);
});

test('Wind never carries a drop or its tail outside the territory over prolonged animation',()=>{
  const domain=createRainDomain([meshFor([square,hole])]);
  const field=createRainField(domain,{count:160,random:randomSource()}),origin=new THREE.Vector3(1,.25,1);
  field.setOrigin(origin);field.setWeather({precipitation:20,weatherCode:65});
  for(let frame=0;frame<600;frame++){
    field.animate(.05);
    checkDrops(field,origin,(a,b)=>assert.ok(domain.containsSegment(a,b),`escaped at frame ${frame}`));
  }
  field.setWeather({precipitation:0,weatherCode:3});
  assert.equal(field.geometry.drawRange.count,0);
  field.animate(.05);assert.equal(field.geometry.drawRange.count,0);
});

test('Narrow cantons retain rain and root zoom/rotation do not change geographic containment',()=>{
  const mesh=meshFor([[[0,0],[.003,0],[.003,1],[0,1],[0,0]]]);
  const root=new THREE.Group();root.add(mesh);root.scale.setScalar(.3);root.rotation.y=1.2;root.updateMatrixWorld(true);
  const domain=createRainDomain([mesh]),field=createRainField(domain,{count:24,random:randomSource()});
  field.setWeather({precipitation:8,weatherCode:63});assert.ok(field.geometry.drawRange.count>0);
  for(let i=0;i<150;i++){field.animate(.05);checkDrops(field,new THREE.Vector3(),(a,b)=>assert.ok(domain.containsSegment(a,b)));}
  const empty=createRainField(createRainDomain([]));empty.setWeather({precipitation:8});assert.equal(empty.geometry.drawRange.count,0);
});

test('Real province rain stays within the original canton polygons, including shared provincial borders',async()=>{
  const geo=JSON.parse(await readFile(new URL('../public/data/cantons.geojson',import.meta.url),'utf8'));
  function insideRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
  for(const province of ['heredia','san-jose','alajuela']){
    const polygons=geo.features.filter(f=>f.properties.province===province).flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates);
    const meshes=polygons.map(poly=>meshFor(poly.map(r=>r.map(([lon,lat])=>[(lon+84.2)*4.4,-(lat-9.75)*4.4]))));
    const field=createRainField(createRainDomain(meshes),{count:48,random:randomSource()});
    field.setWeather({precipitation:15,weatherCode:65});assert.ok(field.geometry.drawRange.count>0,province);
    for(let i=0;i<40;i++){
      field.animate(.05);
      checkDrops(field,new THREE.Vector3(),(a,b)=>{
        for(const p of [a,b,{x:(a.x+b.x)/2,z:(a.z+b.z)/2}]){
          const ll=[p.x/4.4-84.2,9.75-p.z/4.4];
          assert.ok(polygons.some(poly=>insideRing(ll,poly[0])&&!poly.slice(1).some(hole=>insideRing(ll,hole))),province);
        }
      });
    }
  }
});
