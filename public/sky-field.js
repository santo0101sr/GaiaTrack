import * as THREE from './vendor/three.module.js';
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

// Density is ray-marched inside bounded ellipsoids, with feathered noise instead of hard sphere surfaces.
// Geometry and all visible density remain inside a disk wholly inside the territory.
export function createSkyField(initialDomain,{maxClusters=20,marchSteps=16,showSun=true}={}){
  const group=new THREE.Group(),origin=new THREE.Vector3(),layers=[];
  group.name='territory-sky';
  // Four organic puffs per cluster; every puff stays inside radius 1.0 of the cluster center.
  const puffs=[[-.26,0,.04,.60,.28,.50],[.22,.08,-.02,.58,.38,.48],[0,.20,-.10,.50,.40,.48],[.08,-.02,.22,.48,.24,.46]];
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{
      time:{value:0},opacity:{value:0},cover:{value:0},storm:{value:0},flash:{value:0},daylight:{value:1},wind:{value:.65},
      steps:{value:Math.max(5,Math.min(12,marchSteps))},
      cloudTop:{value:new THREE.Color(0xeef6fb)},cloudBase:{value:new THREE.Color(0x6e8aa3)}
    },
    vertexShader:`varying vec3 localSurface;varying vec3 localEye;varying float seed;
      void main(){mat4 world=modelMatrix*instanceMatrix;vec3 delta=cameraPosition-world[3].xyz;
        localEye=vec3(dot(delta,world[0].xyz)/dot(world[0].xyz,world[0].xyz),dot(delta,world[1].xyz)/dot(world[1].xyz,world[1].xyz),dot(delta,world[2].xyz)/dot(world[2].xyz,world[2].xyz));
        localSurface=position;seed=fract(dot(instanceMatrix[3].xyz,vec3(13.17,47.23,7.91)));
        gl_Position=projectionMatrix*viewMatrix*world*vec4(position,1.);}`,
    fragmentShader:`uniform float time;uniform float opacity;uniform float cover;uniform float storm;uniform float flash;uniform float daylight;uniform float wind;uniform float steps;uniform vec3 cloudTop;uniform vec3 cloudBase;
      varying vec3 localSurface;varying vec3 localEye;varying float seed;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 q){return noise3(q)*.58+noise3(q*2.07+3.7)*.28+noise3(q*4.19+1.3)*.14;}
      void main(){if(opacity<.01)discard;vec3 ray=normalize(localSurface-localEye);float b=dot(localEye,ray),c=dot(localEye,localEye)-1.,h=b*b-c;if(h<=0.)discard;
        float near=max(0.,-b-sqrt(h)),far=-b+sqrt(h),stepSize=(far-near)/steps,transmission=1.;vec3 light=vec3(0.);
        float cut=mix(.36,.16,cover)-storm*.05;float densGain=mix(3.3,5.8,cover)*(1.+storm*.35);
        vec3 sunDir=vec3(.32,.88,.24);
        for(int j=0;j<12;j++){if(float(j)>=steps)break;vec3 p=localEye+ray*(near+(float(j)+.5)*stepSize);
          vec3 q=p*2.35+vec3(seed*19.+time*wind*.11,time*.08,seed*7.-time*wind*.04);float n=fbm(q);
          float envelope=1.-smoothstep(.26,1.,length(p));float flatBase=smoothstep(-.94,-.46,p.y);
          float density=max(0.,n-cut)*envelope*flatBase*densGain;
          if(density>.005){
            float a=1.-exp(-density*stepSize*2.65);
            float nSun=noise3(q+sunDir*.38);float shadow=exp(-max(0.,nSun-cut)*1.9);
            float sunlight=clamp(smoothstep(-.52,.82,p.y)*(.55+.45*shadow)*(.74+n*.26),0.,1.);
            float rim=pow(sunlight,2.2)*(1.-storm*.75)*daylight*.24;
            vec3 boltGlow=vec3(.76,.91,1.)*flash*(.35+n*1.35);
            vec3 shade=mix(cloudBase,cloudTop,sunlight)+vec3(rim)+boltGlow;
            light+=transmission*a*shade;transmission*=1.-a;
            if(transmission<.02)break;
          }
        }
        float alpha=(1.-transmission)*opacity;if(alpha<.008)discard;gl_FragColor=vec4(light/max(.001,1.-transmission),alpha);}`});
  const cloud=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),material,maxClusters*puffs.length);
  cloud.name='bounded-cloud-layer';cloud.frustumCulled=false;cloud.renderOrder=3;cloud.count=0;group.add(cloud);layers.push(cloud);

  // Subtle low-altitude mist layer for fog (WMO 45/48), heavy rain, or saturated overcast air.
  const mistMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{time:{value:0},opacity:{value:0},tint:{value:new THREE.Color(0x9ab9cc)}},
    vertexShader:`varying vec3 vLocal;varying vec3 vEye;varying float vSeed;
      void main(){mat4 world=modelMatrix*instanceMatrix;vec3 delta=cameraPosition-world[3].xyz;
        vEye=vec3(dot(delta,world[0].xyz)/dot(world[0].xyz,world[0].xyz),dot(delta,world[1].xyz)/dot(world[1].xyz,world[1].xyz),dot(delta,world[2].xyz)/dot(world[2].xyz,world[2].xyz));
        vLocal=position;vSeed=fract(dot(instanceMatrix[3].xyz,vec3(17.3,31.7,11.1)));
        gl_Position=projectionMatrix*viewMatrix*world*vec4(position,1.);}`,
    fragmentShader:`uniform float time;uniform float opacity;uniform vec3 tint;varying vec3 vLocal;varying vec3 vEye;varying float vSeed;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.13,.27,.41));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 ray=normalize(vLocal-vEye);float b=dot(vEye,ray),c=dot(vEye,vEye)-1.,h=b*b-c;if(h<=0.)discard;
        float near=max(0.,-b-sqrt(h)),far=-b+sqrt(h),mid=(near+far)*.5;vec3 p=vEye+ray*mid;
        float r=length(p);float soft=pow(max(0.,1.-r),1.6);
        float n=noise3(p*2.6+vec3(vSeed*13.+time*.05,time*.03,vSeed*5.));
        float a=soft*(.45+.55*n)*opacity;if(a<.006)discard;gl_FragColor=vec4(tint,a);}`});
  const mist=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),mistMat,maxClusters);
  mist.name='bounded-mist-layer';mist.frustumCulled=false;mist.renderOrder=1;mist.count=0;mist.visible=false;group.add(mist);

  const dummy=new THREE.Object3D();let clusters=[],lastTime=0;
  // Soft radial solar corona (no hard flat dot).
  const sun=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{opacity:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=position.xy;float s=length(modelViewMatrix[0].xyz);vec4 mv=modelViewMatrix*vec4(0.,0.,0.,1.);mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float opacity;varying vec2 vUv;void main(){float d=length(vUv)/1.3;if(d>1.)discard;
      float core=exp(-d*d*18.);float corona=exp(-d*4.2)*.55;float a=(core+corona)*opacity;
      vec3 col=mix(vec3(1.,.76,.36),vec3(1.,.97,.84),core);gl_FragColor=vec4(col,clamp(a,0.,1.));}`
  }));
  sun.name='territory-sun';sun.renderOrder=4;group.add(sun);

  const halo=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{strength:{value:0},time:{value:0}},
    vertexShader:`varying vec2 disk;void main(){disk=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform float strength;uniform float time;varying vec2 disk;void main(){float r=length(disk);if(r>1.)discard;
      float angle=atan(disk.y,disk.x);float rays=.88+.12*sin(angle*6.+time*1.2)*smoothstep(.15,.8,r);
      float alpha=pow(max(0.,1.-r),2.1)*strength*rays;gl_FragColor=vec4(1.,.82,.44,alpha);}`}));
  halo.rotation.x=-Math.PI/2;halo.name='territory-sun-halo';halo.renderOrder=1;group.add(halo);
  let domain=null,appearance=skyAppearance({}),anchor=null,radius=0,clusterLayout=[],activeClusters=[];

  function placeSun(){
    anchor=null;radius=Number.isFinite(domain?.area)?Math.min(.12,domain.shortSpan*.08,Math.sqrt(domain.area)*.035):0;
    for(let attempt=0;radius>1e-5&&attempt<9;attempt++,radius*=.5){
      if(domain.containsDisk(origin,radius*2.5)){anchor={x:origin.x,y:origin.y,z:origin.z};break;}
      // Repeatable placement: updating weather cannot make the sun jump around the province.
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
    const baseR=Math.min(domain.shortSpan*.45,Math.sqrt(domain.area/maxClusters)*1.2);
    const minR=baseR*.25;
    for(let i=0;i<maxClusters;i++){
      let r=baseR,point=null;
      for(let attempt=0;attempt<7&&r>=minR;attempt++,r*=.8){
        for(let tries=0;tries<3;tries++){point=domain.sample(random,r);if(point)break;}
        if(point)break;
      }
      if(!point&&!clusters.length){
        for(let attempt=0,rf=minR*.8;attempt<8&&rf>1e-5;attempt++,rf*=.65){point=domain.sample(random,rf);if(point){r=rf;break;}}
      }
      if(point){
        clusters.push({...point,radius:r});
        clusterLayout.push({rotY:(i*2.39996)%(Math.PI*2),variance:.90+(i%4)*.035});
      }
    }
  }
  function applyLayout(){
    const activeCount=activeClusters.length;
    const cov=appearance.cover??0,stm=appearance.storm??0;
    for(let i=0;i<activeCount;i++){
      const item=activeClusters[i],c=item.cluster,lay=item.layout,r=c.radius,cos=Math.cos(lay.rotY),sin=Math.sin(lay.rotY);
      const cCov=item.cover,cStm=item.rain;
      const coverSpread=.76+.24*cCov;
      const coverHeight=.68+.44*cCov+cStm*.16;
      const altDrop=cCov*.08+cStm*.10;
      const spread=coverSpread*lay.variance;
      const yBase=c.y+.88+r*.25-altDrop;
      for(const [j,p] of puffs.entries()){
        const ox=(p[0]*cos-p[2]*sin)*r*spread,oz=(p[0]*sin+p[2]*cos)*r*spread;
        dummy.position.set(c.x+ox-origin.x,yBase+p[1]*r*coverHeight-origin.y,c.z+oz-origin.z);
        dummy.rotation.set(0,lay.rotY,0);
        dummy.scale.set(r*p[3]*spread,r*p[4]*coverHeight,r*p[5]*spread);
        dummy.updateMatrix();
        cloud.setMatrixAt(i*puffs.length+j,dummy.matrix);
      }
    }
    if(activeCount>0)cloud.instanceMatrix.needsUpdate=true;
    const mistActive=mist.visible?Math.min(clusters.length,Math.max(1,Math.round(Math.max(cov,appearance.fog)*.85*clusters.length))):0;
    mist.count=mistActive;
    for(let i=0;i<mistActive;i++){
      const c=clusters[i],r=c.radius*.85;
      dummy.position.set(c.x-origin.x,c.y+.14-origin.y,c.z-origin.z);
      dummy.rotation.set(0,clusterLayout[i].rotY,0);
      dummy.scale.set(r,Math.min(.11,r*.4),r);
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
    const activeCount=activeClusters.length;
    if(!activeCount)return;
    for(let i=0;i<activeCount;i++){
      const item=activeClusters[i],c=item.cluster,r=c.radius,bob=Math.sin(time*.00035+i*2.1)*r*.08;
      const cCov=item.cover,cStm=item.rain;
      const coverHeight=.68+.44*cCov+cStm*.16;
      const altDrop=cCov*.08+cStm*.10;
      const yBase=c.y+.88+r*.25-altDrop+bob;
      for(let j=0;j<puffs.length;j++){
        const idx=i*puffs.length+j;
        cloud.instanceMatrix.array[idx*16+13]=yBase+puffs[j][1]*r*coverHeight-origin.y;
      }
    }
    cloud.instanceMatrix.needsUpdate=true;
  }
  function applyCloudCount(sectors=null){
    activeClusters=[];
    const MIN_COVER=.25;
    if(sectors&&sectors.length&&clusters.length){
      const bySector=new Map(sectors.map((s,idx)=>[idx,[]]));
      for(let i=0;i<clusters.length;i++){
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
    }else if(((appearance.cover??0)>=MIN_COVER||(appearance.storm??0)>0)&&clusters.length){
      const effCov=(appearance.cover??0)>=MIN_COVER?appearance.cover:Math.min(.75,.35+(appearance.storm??0)*.4);
      const count=Math.min(clusters.length,Math.max(1,Math.round(effCov*clusters.length)));
      for(let i=0;i<count;i++)activeClusters.push({cluster:clusters[i],layout:clusterLayout[i],cover:effCov,rain:appearance.storm??0});
    }
    cloud.count=activeClusters.length*puffs.length;
    cloud.visible=cloud.count>0;
    applyLayout();
    animate(lastTime);
  }
  function setDomain(next){
    if(domain===next)return;domain=next;buildClouds();placeSun();applyCloudCount();
  }
  function setOrigin(next){if(origin.equals(next))return;origin.copy(next);placeSun();applyLayout();animate(lastTime);}
  function setFlash(value){material.uniforms.flash.value=Math.max(0,Math.min(1,value));}
  function setWeather(data,sectors=null){
    appearance=skyAppearance(data);
    const cov=appearance.cover??0,stm=appearance.storm??0,isNight=appearance.night;
    const showMist=Boolean(clusters.length&&(appearance.fog>0||stm>.28||(appearance.humidity!==null&&appearance.humidity>=.90&&cov>=.75)));
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
    cloud.material.opacity=appearance.cover===null&&!activeClusters.length?0:Math.min(.92,(.18+maxCov*.52+maxStm*.14)*(clusters.length?Math.min(1,.55+Math.sqrt(clusters[0].radius/.09)*.45):1));
    material.uniforms.opacity.value=cloud.material.opacity;
    sun.visible=showSun&&!!anchor&&appearance.sun>0;halo.visible=sun.visible;
    sun.material.uniforms.opacity.value=Math.min(1,appearance.sun*1.9);
    halo.material.uniforms.strength.value=appearance.sun*.72;
    group.userData.cloudCover=appearance.cover;group.userData.sunStrength=appearance.sun;
  }
  setDomain(initialDomain);setWeather({});
  return {group,layers,sun,halo,setDomain,setOrigin,setWeather,setFlash,animate,get appearance(){return appearance;},get cloudFootprints(){return activeClusters.map(({cluster,cover,rain})=>({...cluster,effectiveRadius:cluster.radius*(.46+.20*cover),rain}));},get footprint(){return anchor?{...anchor,radius:radius*2.5}:null;}};
}
