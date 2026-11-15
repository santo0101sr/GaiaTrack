import * as THREE from './vendor/three.module.js';
import {softTexture} from './scene-art.js';
import {weatherScales} from './weather-state.js';

export function skyAppearance(data){
  const known=Number.isFinite(data.clouds),cover=known?Math.max(0,Math.min(1,data.clouds/100)):null;
  const radiation=Number.isFinite(data.solarRadiation)?Math.max(0,Math.min(1,data.solarRadiation/1000)):null;
  // is_day is the provider's daylight flag; recent radiation alone must not keep a sun at night.
  const daylight=data.isDay===true;
  const sun=daylight&&cover!==null&&cover<.9&&radiation!==null?radiation*(1-cover)**1.5:0;
  const fog=data.weatherCode===45||data.weatherCode===48?1:0;
  const humidity=Number.isFinite(data.humidity)?Math.max(0,Math.min(1,data.humidity/100)):null;
  const wind=Number.isFinite(data.windSpeed)?Math.max(.25,Math.min(2.2,data.windSpeed/7)):.65;
  return {cover,sun,night:data.isDay===false,storm:weatherScales(data).rain??0,fog,humidity,wind};
}

let sharedCloudPlane=null;
function getCloudGeometry(){
  if(!sharedCloudPlane){
    sharedCloudPlane=new THREE.PlaneGeometry(1,1);
    sharedCloudPlane.rotateX(-Math.PI/2);
  }
  return sharedCloudPlane;
}

// Lightweight clouds using one shared CanvasTexture and few instanced layers (zero 3D FBM raymarch).
export function createSkyField(initialDomain,{maxClusters=10,showSun=true}={}){
  const group=new THREE.Group(),origin=new THREE.Vector3(),layers=[];
  group.name='territory-sky';
  const maxCapacity=Math.max(1,maxClusters);
  let activeMaxClusters=maxCapacity;
  const cloudTexture=softTexture('cloud');

  // Two compact soft-textured overlapping puffs per cluster, scaled cleanly inside cluster radius.
  const puffs=[[0,0,0,1.15,.95],[.14,.06,-.08,.82,.72]];
  const material=new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    toneMapped:false,
    uniforms:{
      map:{value:cloudTexture},
      time:{value:0},
      opacity:{value:0},
      cover:{value:0},
      storm:{value:0},
      flash:{value:0},
      daylight:{value:1},
      wind:{value:.65},
      cloudTop:{value:new THREE.Color(0xeef6fb)},
      cloudBase:{value:new THREE.Color(0x6e8aa3)}
    },
    vertexShader:`
      varying vec2 vUv;
      varying float vHeight;
      uniform float time;
      void main(){
        vUv=uv;
        float seed=fract(dot(instanceMatrix[3].xyz,vec3(13.17,47.23,7.91)));
        vec4 world=modelMatrix*instanceMatrix*vec4(position,1.0);
        world.y+=sin(time*2.6+seed*12.56)*0.025;
        vHeight=uv.y;
        gl_Position=projectionMatrix*viewMatrix*world;
      }`,
    fragmentShader:`
      uniform sampler2D map;
      uniform float opacity;
      uniform float storm;
      uniform float flash;
      uniform vec3 cloudTop;
      uniform vec3 cloudBase;
      varying vec2 vUv;
      varying float vHeight;
      void main(){
        if(opacity<0.01)discard;
        vec4 tex=texture2D(map,vUv);
        float a=tex.a*opacity;
        if(a<0.01)discard;
        vec3 base=mix(cloudBase,cloudTop,0.45+0.55*vHeight);
        vec3 boltGlow=vec3(0.76,0.91,1.0)*flash*0.85;
        gl_FragColor=vec4(base*(1.0-storm*0.22)+boltGlow,a);
      }`
  });

  const cloud=new THREE.InstancedMesh(getCloudGeometry(),material,maxCapacity*puffs.length);
  cloud.name='bounded-cloud-layer';
  cloud.frustumCulled=false;
  cloud.renderOrder=3;
  cloud.count=0;
  cloud.visible=false;
  group.add(cloud);
  layers.push(cloud);

  const mistMat=new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    side:THREE.DoubleSide,
    toneMapped:false,
    uniforms:{
      map:{value:cloudTexture},
      time:{value:0},
      opacity:{value:0},
      tint:{value:new THREE.Color(0x9ab9cc)}
    },
    vertexShader:`
      varying vec2 vUv;
      void main(){
        vUv=uv;
        gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D map;
      uniform float opacity;
      uniform vec3 tint;
      varying vec2 vUv;
      void main(){
        if(opacity<0.01)discard;
        float a=texture2D(map,vUv).a*opacity;
        if(a<0.01)discard;
        gl_FragColor=vec4(tint,a);
      }`
  });

  const mist=new THREE.InstancedMesh(getCloudGeometry(),mistMat,maxCapacity);
  mist.name='bounded-mist-layer';
  mist.frustumCulled=false;
  mist.renderOrder=1;
  mist.count=0;
  mist.visible=false;
  group.add(mist);

  const dummy=new THREE.Object3D();
  let clusters=[],lastTime=0,mistAllowed=true;

  const sun=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{opacity:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=position.xy;float s=length(modelViewMatrix[0].xyz);vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float opacity;varying vec2 vUv;void main(){float d=length(vUv)/1.3;if(d>1.)discard;
      float core=exp(-d*d*18.);float corona=exp(-d*4.2)*.55;float a=(core+corona)*opacity;
      vec3 col=mix(vec3(1.,.76,.36),vec3(1.,.97,.84),core);gl_FragColor=vec4(col,clamp(a,0.,1.));}`
  }));
  sun.name='territory-sun';sun.renderOrder=4;group.add(sun);

  const halo=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{strength:{value:0},time:{value:0}},
    vertexShader:`varying vec2 disk;void main(){disk=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float strength;uniform float time;varying vec2 disk;void main(){float r=length(disk);if(r>1.)discard;
      float angle=atan(disk.y,disk.x);float rays=.88+.12*sin(angle*6.+time*1.2)*smoothstep(.15,.8,r);
      float alpha=pow(max(0.,1.-r),2.1)*strength*rays;gl_FragColor=vec4(1.,.82,.44,alpha);}`}));
  halo.rotation.x=-Math.PI/2;halo.name='territory-sun-halo';halo.renderOrder=1;group.add(halo);
  let domain=null,appearance=skyAppearance({}),anchor=null,radius=0,clusterLayout=[],activeClusters=[],lastWeatherArgs=[{},null];

  function placeSun(){
    anchor=null;radius=Number.isFinite(domain?.area)?Math.min(.12,domain.shortSpan*.08,Math.sqrt(domain.area)*.035):0;
    for(let attempt=0;radius>1e-5&&attempt<9;attempt++,radius*=.5){
      if(domain.containsDisk(origin,radius*2.5)){anchor={x:origin.x,y:origin.y,z:origin.z};break;}
      let seed=3181;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      anchor=domain.sample(random,radius*2.5);if(anchor)break;
    }
    if(anchor){
      sun.position.set(anchor.x-origin.x,1.5,anchor.z-origin.z);sun.scale.setScalar(radius*1.4);
      halo.position.set(anchor.x-origin.x,1.35,anchor.z-origin.z);halo.scale.setScalar(radius*2.5);
    }
    sun.visible=showSun&&!!anchor&&appearance.sun>0;halo.visible=sun.visible;
  }

  function buildClouds(){
    clusters=[];clusterLayout=[];let seed=5719;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const MIN_CLOUD_R=showSun?.10:.20;
    const baseR=Math.min(domain.shortSpan*.45,Math.sqrt(domain.area/maxCapacity)*1.35);
    if(baseR<MIN_CLOUD_R)return;
    const minR=Math.max(MIN_CLOUD_R,baseR*.28);
    for(let i=0;i<maxCapacity;i++){
      let r=baseR,point=null;
      for(let attempt=0;attempt<7&&r>=minR;attempt++,r*=.8){
        for(let tries=0;tries<3;tries++){point=domain.sample(random,r);if(point)break;}
        if(point)break;
      }
      if(point){
        clusters.push({...point,radius:r});
        clusterLayout.push({rotY:(i*2.39996)%(Math.PI*2),variance:.90+(i%4)*.03});
      }
    }
  }

  function applyLayout(){
    const activeCount=activeClusters.length;
    const cov=appearance.cover??0;
    for(let i=0;i<activeCount;i++){
      const item=activeClusters[i],c=item.cluster,lay=item.layout,r=c.radius,cos=Math.cos(lay.rotY),sin=Math.sin(lay.rotY);
      const cCov=item.cover,cStm=item.rain;
      const spread=(.76+.24*cCov)*lay.variance;
      const altDrop=cCov*.08+cStm*.10;
      const yBase=c.y+.88+r*.25-altDrop;
      for(const [j,p] of puffs.entries()){
        const ox=(p[0]*cos-p[2]*sin)*r*spread,oz=(p[0]*sin+p[2]*cos)*r*spread;
        dummy.position.set(c.x+ox-origin.x,yBase+p[1]*r-origin.y,c.z+oz-origin.z);
        dummy.rotation.set(0,lay.rotY,0);
        dummy.scale.set(r*p[3]*spread,1,r*p[4]*spread);
        dummy.updateMatrix();
        cloud.setMatrixAt(i*puffs.length+j,dummy.matrix);
      }
    }
    if(activeCount>0)cloud.instanceMatrix.needsUpdate=true;
    const limitClusters=Math.min(clusters.length,activeMaxClusters);
    const mistActive=mist.visible?Math.min(limitClusters,Math.max(1,Math.round(Math.max(cov,appearance.fog)*.85*limitClusters))):0;
    mist.count=mistActive;
    for(let i=0;i<mistActive;i++){
      const c=clusters[i],r=c.radius*1.45;
      dummy.position.set(c.x-origin.x,c.y+.14-origin.y,c.z-origin.z);
      dummy.rotation.set(0,clusterLayout[i].rotY,0);
      dummy.scale.set(r,1,r);
      dummy.updateMatrix();
      mist.setMatrixAt(i,dummy.matrix);
    }
    if(mistActive>0)mist.instanceMatrix.needsUpdate=true;
  }

  function animate(time){
    lastTime=time;
    material.uniforms.time.value=time*.00012;
    mistMat.uniforms.time.value=time*.00015;
    halo.material.uniforms.time.value=time*.0004;
  }

  function applyCloudCount(sectors=null){
    activeClusters=[];
    const MIN_COVER=.35;
    const poolLen=Math.min(clusters.length,activeMaxClusters);
    if(sectors&&sectors.length&&poolLen){
      const bySector=new Map(sectors.map((_,idx)=>[idx,[]]));
      for(let i=0;i<poolLen;i++){
        const c=clusters[i];let best=0,bestD=Infinity;
        for(let s=0;s<sectors.length;s++){const d=(c.x-sectors[s].x)**2+(c.z-sectors[s].z)**2;if(d<bestD){bestD=d;best=s;}}
        bySector.get(best).push(i);
      }
      for(const [sIdx,indices] of bySector){
        const sec=sectors[sIdx],secApp=skyAppearance(sec);
        const sCov=secApp.cover??appearance.cover??0,sRain=secApp.storm??appearance.storm??0;
        if((sCov<MIN_COVER&&sRain<=0)||(!sCov&&sRain<=0))continue;
        const effCov=sCov>=MIN_COVER?sCov:Math.min(.75,.35+sRain*.4);
        const keep=Math.min(indices.length,Math.max(1,Math.round(effCov*indices.length)));
        for(let k=0;k<keep;k++){
          const idx=indices[k];
          activeClusters.push({cluster:clusters[idx],layout:clusterLayout[idx],cover:effCov,rain:sRain});
        }
      }
    }else if(((appearance.cover??0)>=MIN_COVER||(appearance.storm??0)>0)&&poolLen){
      const effCov=(appearance.cover??0)>=MIN_COVER?appearance.cover:Math.min(.75,.35+(appearance.storm??0)*.4);
      const count=Math.min(poolLen,Math.max(1,Math.round(effCov*poolLen)));
      for(let i=0;i<count;i++)activeClusters.push({cluster:clusters[i],layout:clusterLayout[i],cover:effCov,rain:appearance.storm??0});
    }
    cloud.count=activeClusters.length*puffs.length;
    cloud.visible=cloud.count>0;
    applyLayout();
  }

  function setDomain(next){
    if(domain===next)return;domain=next;buildClouds();placeSun();applyCloudCount();
  }
  function setOrigin(next){if(origin.equals(next))return;origin.copy(next);placeSun();applyLayout();}
  function setFlash(value){material.uniforms.flash.value=Math.max(0,Math.min(1,value));}
  function setQuality({maxClouds,mistEnabled}={}){
    if(Number.isFinite(maxClouds))activeMaxClusters=Math.max(1,Math.min(maxCapacity,Math.round(maxClouds)));
    if(mistEnabled!==undefined)mistAllowed=Boolean(mistEnabled);
    setWeather(lastWeatherArgs[0],lastWeatherArgs[1]);
  }
  function setWeather(data,sectors=null){
    lastWeatherArgs=[data||{},sectors];
    appearance=skyAppearance(lastWeatherArgs[0]);
    const cov=appearance.cover??0,stm=appearance.storm??0,isNight=appearance.night;
    const showMist=Boolean(mistAllowed&&clusters.length&&(appearance.fog>0||stm>.28||(appearance.humidity!==null&&appearance.humidity>=.90&&cov>=.75)));
    mist.visible=showMist;
    mistMat.uniforms.opacity.value=showMist?Math.min(.28,.08+appearance.fog*.18+stm*.14):0;
    mistMat.uniforms.tint.value.setRGB(isNight?.32:.62,isNight?.42:.74,isNight?.56:.84);
    applyCloudCount(sectors);
    const maxCov=activeClusters.length?Math.max(cov,...activeClusters.map(a=>a.cover)):cov;
    const maxStm=activeClusters.length?Math.max(stm,...activeClusters.map(a=>a.rain)):stm;
    const overcastTone=Math.max(0,(maxCov-.45)/.55);
    const dark=Math.min(1,Math.sqrt(maxStm)*.75+overcastTone*.22+(isNight?.42:0));
    material.uniforms.cover.value=maxCov;
    material.uniforms.storm.value=maxStm;
    material.uniforms.wind.value=appearance.wind;
    material.uniforms.daylight.value=isNight?0:1;
    material.uniforms.cloudTop.value.setRGB(.96-dark*.44,.98-dark*.40,1.-dark*.32);
    material.uniforms.cloudBase.value.setRGB(.58-dark*.38,.70-dark*.40,.82-dark*.38);
    cloud.material.opacity=appearance.cover===null&&!activeClusters.length?0:Math.min(.92,(.22+maxCov*.54+maxStm*.14)*(clusters.length?Math.min(1,.55+Math.sqrt(clusters[0].radius/.09)*.45):1));
    material.uniforms.opacity.value=cloud.material.opacity;
    sun.visible=showSun&&!!anchor&&appearance.sun>0;halo.visible=sun.visible;
    sun.material.uniforms.opacity.value=Math.min(1,appearance.sun*1.9);
    halo.material.uniforms.strength.value=appearance.sun*.72;
    group.userData.cloudCover=appearance.cover;group.userData.sunStrength=appearance.sun;
  }
  setDomain(initialDomain);setWeather({});
  return {group,layers,sun,halo,setDomain,setOrigin,setQuality,setWeather,setFlash,animate,get appearance(){return appearance;},get cloudFootprints(){return activeClusters.map(({cluster,cover,rain})=>({...cluster,effectiveRadius:cluster.radius*(.46+.20*cover),rain}));},get footprint(){return anchor?{...anchor,radius:radius*2.5}:null;}};
}
