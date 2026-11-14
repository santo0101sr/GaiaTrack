import * as THREE from './vendor/three.module.js';
export function softTexture(kind='cloud'){
const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');
if(kind==='cloud'){for(const [x,y,r,a] of [[128,140,88,.65],[77,137,53,.45],[174,139,55,.45],[119,102,60,.65],[155,115,43,.4]]){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(235,248,255,${a})`);g.addColorStop(.5,`rgba(205,228,244,${a*.6})`);g.addColorStop(1,'rgba(140,174,209,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}}
else{const g=ctx.createRadialGradient(128,128,0,128,128,128);g.addColorStop(0,'rgba(255,250,221,1)');g.addColorStop(.15,'rgba(255,213,136,.75)');g.addColorStop(.4,'rgba(255,158,77,.18)');g.addColorStop(1,'rgba(255,130,50,0)');ctx.fillStyle=g;ctx.fillRect(0,0,256,256);}
const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function surfaceMaterial(){const material=new THREE.MeshStandardMaterial({color:0x153e4a,emissive:0x04151c,metalness:.28,roughness:.75});material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSurface;').replace('#include <color_fragment>',`#include <color_fragment>
float contour=sin(vSurface.x*12.0+sin(vSurface.z*6.0)*1.6+sin(vSurface.x*3.0+vSurface.z*2.0));
float grain=fract(sin(dot(floor(vSurface.xz*180.0),vec2(12.9898,78.233)))*43758.5453);
float top=smoothstep(.10,.16,vSurface.y);
diffuseColor.rgb*=mix(.30,1.0,top);
diffuseColor.rgb*=.91+.07*contour+.035*grain;
diffuseColor.rgb+=vec3(.003,.008,.009)*top*pow(abs(contour),24.0);`);};return material;}
export function addSceneAtmosphere(scene,root){
const hemisphere=new THREE.HemisphereLight(0x9cd8ee,0x07101f,1.6);scene.add(hemisphere);
const base=new THREE.Mesh(new THREE.CircleGeometry(28,96),new THREE.MeshStandardMaterial({color:0x030c14,roughness:.85,metalness:.3,transparent:true,opacity:.75}));base.rotation.x=-Math.PI/2;base.position.y=-.5;base.receiveShadow=true;root.add(base);
const halo=new THREE.Mesh(new THREE.RingGeometry(10.5,10.54,180),new THREE.MeshBasicMaterial({color:0x3d91a3,side:THREE.DoubleSide,transparent:true,opacity:.23}));halo.rotation.x=-Math.PI/2;halo.position.y=-.38;root.add(halo);
const sweepGeo=new THREE.RingGeometry(10.46,10.6,96,1,0,Math.PI*.45);
const sweep=new THREE.Mesh(sweepGeo,new THREE.MeshBasicMaterial({color:0xa8ebcc,side:THREE.DoubleSide,transparent:true,opacity:.22,depthWrite:false}));
sweep.rotation.x=-Math.PI/2;sweep.position.y=-.375;root.add(sweep);
const beams=[];for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(12+i*2.6,12.02+i*2.6,128),new THREE.MeshBasicMaterial({color:0x4b82ae,side:THREE.DoubleSide,transparent:true,opacity:.08}));ring.rotation.x=-Math.PI/2;ring.position.y=-.42;root.add(ring);beams.push(ring);}
const dustGeo=new THREE.BufferGeometry(),points=new Float32Array(220*3);for(let i=0;i<220;i++)points.set([(Math.random()-.5)*18,.4+Math.random()*4.4,(Math.random()-.5)*16],i*3);dustGeo.setAttribute('position',new THREE.BufferAttribute(points,3));const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x83dce6,size:.022,transparent:true,opacity:.42,depthWrite:false}));root.add(dust);
return {animate(time,moving){if(!moving)return;dust.rotation.y=Math.sin(time*.00003)*.12;dust.position.y=Math.sin(time*.0004)*.06;sweep.rotation.z=-time*.00028;beams.forEach((r,i)=>{r.material.opacity=.065+Math.sin(time*.0004+i)*.028;const s=1+Math.sin(time*.0003+i*1.4)*.008;r.scale.set(s,s,1);});}};
}
