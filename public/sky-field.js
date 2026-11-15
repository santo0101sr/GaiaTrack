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

// Density is ray-marched inside bounded ellipsoids, with feathered noise instead of hard sphere surfaces.
// Geometry and all visible density remain inside a disk wholly inside the territory.
export function createSkyField(initialDomain){
  const group=new THREE.Group(),origin=new THREE.Vector3(),layers=[];
  group.name='territory-sky';
  const maxClusters=32,puffs=[[-.25,0,0],[.2,.08,.02],[0,.16,-.12],[.06,0,.23]];
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{time:{value:0},opacity:{value:0},cloudTop:{value:new THREE.Color(0xe8f2f7)},cloudBase:{value:new THREE.Color(0x7792aa)}},
    vertexShader:`varying vec3 localSurface;varying vec3 localEye;varying float seed;
      void main(){mat4 world=modelMatrix*instanceMatrix;vec3 delta=cameraPosition-world[3].xyz;
        localEye=vec3(dot(delta,world[0].xyz)/dot(world[0].xyz,world[0].xyz),dot(delta,world[1].xyz)/dot(world[1].xyz,world[1].xyz),dot(delta,world[2].xyz)/dot(world[2].xyz,world[2].xyz));
        localSurface=position;seed=fract(dot(instanceMatrix[3].xyz,vec3(13.17,47.23,7.91)));
        gl_Position=projectionMatrix*viewMatrix*world*vec4(position,1.);}`,
    fragmentShader:`uniform float time;uniform float opacity;uniform vec3 cloudTop;uniform vec3 cloudBase;
      varying vec3 localSurface;varying vec3 localEye;varying float seed;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 ray=normalize(localSurface-localEye);float b=dot(localEye,ray),c=dot(localEye,localEye)-1.,h=b*b-c;if(h<=0.)discard;
        float near=max(0.,-b-sqrt(h)),far=-b+sqrt(h),stepSize=(far-near)/12.,transmission=1.;vec3 light=vec3(0.);
        for(int j=0;j<12;j++){vec3 p=localEye+ray*(near+(float(j)+.5)*stepSize);
          vec3 q=p*2.6+vec3(seed*19.,time*.15,seed*7.);float n=noise3(q)*.72+noise3(q*2.1+3.7)*.28;
          float envelope=1.-smoothstep(.35,1.,length(p));float density=max(0.,n-.24)*envelope*4.;
          float a=1.-exp(-density*stepSize*2.8);vec3 shade=mix(cloudBase,cloudTop,smoothstep(-.65,.7,p.y));
          light+=transmission*a*shade;transmission*=1.-a;}
        float alpha=(1.-transmission)*opacity;if(alpha<.008)discard;gl_FragColor=vec4(light/max(.001,1.-transmission),alpha);}`});
  const cloud=new THREE.InstancedMesh(new THREE.SphereGeometry(1,14,10),material,maxClusters*puffs.length);
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
    material.uniforms.time.value=time*.00012;
    for(let i=0;i<cloud.count/puffs.length;i++){
      const c=clusters[i],r=c.radius,y=c.y+.88+r*.25+Math.sin(time*.00035+i*2.1)*r*.08;
      for(const [j,p] of puffs.entries()){
        dummy.position.set(c.x+p[0]*r-origin.x,y+p[1]*r-origin.y,c.z+p[2]*r-origin.z);
        dummy.scale.set(r*.6,r*.4,r*.58);dummy.updateMatrix();cloud.setMatrixAt(i*puffs.length+j,dummy.matrix);
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
    material.uniforms.cloudTop.value.setRGB(.92-dark*.3,.96-dark*.28,1.-dark*.23);
    material.uniforms.cloudBase.value.setRGB(.5-dark*.25,.62-dark*.22,.73-dark*.18);
    cloud.material.opacity=appearance.cover===null?0:.28+appearance.cover*.48;
    material.uniforms.opacity.value=cloud.material.opacity;
    sun.visible=!!anchor&&appearance.sun>0;halo.visible=sun.visible;
    sun.material.opacity=Math.min(1,appearance.sun*1.8);
    halo.material.uniforms.strength.value=appearance.sun*.7;
    group.userData.cloudCover=appearance.cover;group.userData.sunStrength=appearance.sun;
  }
  setDomain(initialDomain);setWeather({});
  return {group,layers,sun,halo,setDomain,setOrigin,setWeather,animate,get appearance(){return appearance;},get cloudFootprints(){return clusters.slice(0,cloud.count/puffs.length).map(c=>({...c}));},get footprint(){return anchor?{...anchor,radius:radius*2.5}:null;}};
}
