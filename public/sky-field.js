import * as THREE from './vendor/three.module.js';
import {weatherScales} from './weather-state.js';

export function skyAppearance(data){
  const known=Number.isFinite(data.clouds),cover=known?Math.max(0,Math.min(1,data.clouds/100)):null;
  const radiation=Number.isFinite(data.solarRadiation)?Math.max(0,Math.min(1,data.solarRadiation/1000)):null;
  // is_day is the provider's daylight flag; recent radiation alone must not keep a sun at night.
  const daylight=data.isDay===true;
  const sun=daylight&&cover!==null&&cover<.9&&radiation!==null?radiation*(1-cover)**1.5:0;
  return {cover,sun,night:data.isDay===false,storm:weatherScales(data).rain??0};
}

// Each cloud is a group of ellipsoids inscribed in a disk wholly inside the territory.
export function createSkyField(initialDomain){
  const group=new THREE.Group(),origin=new THREE.Vector3(),layers=[];
  group.name='territory-sky';
  const maxClusters=48,puffs=[[-.25,0,0],[.2,.08,.02],[0,.16,-.12],[.06,0,.23]];
  const cloud=new THREE.InstancedMesh(new THREE.SphereGeometry(1,12,10),new THREE.MeshStandardMaterial({color:0xdce9ed,roughness:1,transparent:true,opacity:0,depthWrite:false}),maxClusters*puffs.length);
  cloud.name='bounded-cloud-layer';cloud.frustumCulled=false;cloud.count=0;group.add(cloud);layers.push(cloud);
  const dummy=new THREE.Object3D();let clusters=[],lastTime=0;
  const sun=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:0xffedb0,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
  sun.name='territory-sun';group.add(sun);
  const halo=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{strength:{value:0}},vertexShader:`varying vec2 disk;void main(){disk=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float strength;varying vec2 disk;void main(){float alpha=pow(max(0.0,1.0-length(disk)),2.0)*strength;gl_FragColor=vec4(1.0,.78,.38,alpha);}`}));
  halo.rotation.x=-Math.PI/2;halo.name='territory-sun-halo';group.add(halo);
  let domain=null,appearance=skyAppearance({}),anchor=null,radius=0;

  function placeSun(){
    anchor=null;radius=Number.isFinite(domain?.area)?Math.min(.12,domain.shortSpan*.08,Math.sqrt(domain.area)*.035):0;
    for(let attempt=0;radius>1e-5&&attempt<9;attempt++,radius*=.5){
      if(domain.containsDisk(origin,radius*2.5)){anchor={x:origin.x,y:origin.y,z:origin.z};break;}
      // Repeatable placement: updating weather cannot make the sun jump around the province.
      let seed=3181;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      anchor=domain.sample(random,radius*2.5);if(anchor)break;
    }
    if(anchor){
      sun.position.set(anchor.x-origin.x,1.5,anchor.z-origin.z);sun.scale.setScalar(radius);
      halo.position.copy(sun.position);halo.scale.setScalar(radius*2.5);
    }
    sun.visible=!!anchor&&appearance.sun>0;halo.visible=sun.visible;
  }
  function buildClouds(){
    clusters=[];let seed=5719;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<maxClusters;i++){
      let r=Math.min(domain.shortSpan*.14,Math.sqrt(domain.area/maxClusters)*.72),point=null;
      for(let attempt=0;attempt<10&&r>1e-5;attempt++,r*=.6){point=domain.sample(random,r);if(point)break;}
      if(point)clusters.push({...point,radius:r});
    }
  }
  function animate(time){
    lastTime=time;
    for(let i=0;i<cloud.count/puffs.length;i++){
      const c=clusters[i],r=c.radius,y=c.y+.24+r*.4+Math.sin(time*.00035+i*2.1)*r*.08;
      for(const [j,p] of puffs.entries()){
        dummy.position.set(c.x+p[0]*r-origin.x,y+p[1]*r-origin.y,c.z+p[2]*r-origin.z);
        dummy.scale.set(r*.6,r*.32,r*.58);dummy.updateMatrix();cloud.setMatrixAt(i*puffs.length+j,dummy.matrix);
      }
    }
    cloud.instanceMatrix.needsUpdate=true;
  }
  function applyCloudCount(){
    cloud.count=appearance.cover>0?Math.min(clusters.length,Math.max(1,Math.round(appearance.cover*clusters.length)))*puffs.length:0;
    cloud.visible=cloud.count>0;animate(lastTime);
  }
  function setDomain(next){
    if(domain===next)return;domain=next;buildClouds();placeSun();applyCloudCount();
  }
  function setOrigin(next){if(origin.equals(next))return;origin.copy(next);placeSun();animate(lastTime);}
  function setWeather(data){
    appearance=skyAppearance(data);
    applyCloudCount();
    const dark=Math.min(1,appearance.storm*.55+(appearance.night ? .55 : 0));
    cloud.material.color.setRGB(.86-dark*.42,.92-dark*.4,.95-dark*.36);
    cloud.material.opacity=appearance.cover===null?0:.2+appearance.cover*.3;
    sun.visible=!!anchor&&appearance.sun>0;halo.visible=sun.visible;
    sun.material.opacity=Math.min(1,appearance.sun*1.8);
    halo.material.uniforms.strength.value=appearance.sun*.7;
    group.userData.cloudCover=appearance.cover;group.userData.sunStrength=appearance.sun;
  }
  setDomain(initialDomain);setWeather({});
  return {group,layers,sun,halo,setDomain,setOrigin,setWeather,animate,get appearance(){return appearance;},get cloudFootprints(){return clusters.slice(0,cloud.count/puffs.length).map(c=>({...c}));},get footprint(){return anchor?{...anchor,radius:radius*2.5}:null;}};
}
