import * as THREE from './vendor/three.module.js';
import {weatherScales} from './weather-state.js';

const EPS=1e-8;
const cross=(a,b,p)=>(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const edgeKey=(a,b)=>{
  const key=p=>`${Math.round(p.x*1e6)},${Math.round(p.z*1e6)}`;
  const x=key(a),y=key(b);return x<y?`${x}/${y}`:`${y}/${x}`;
};

// Clip the whole projected drop segment to a triangle, including concave coastlines and holes.
function triangleInterval(a,b,t){
  let lo=0,hi=1;
  const sign=cross(t.a,t.b,t.c)>0?1:-1;
  for(const [p,q] of [[t.a,t.b],[t.b,t.c],[t.c,t.a]]){
    const start=cross(p,q,a)*sign,end=cross(p,q,b)*sign,delta=end-start;
    if(Math.abs(delta)<EPS){if(start< -EPS)return null;continue;}
    const at=(-EPS-start)/delta;
    if(delta>0)lo=Math.max(lo,at);else hi=Math.min(hi,at);
    if(lo>hi)return null;
  }
  return [lo,hi];
}

export function createRainDomain(meshes){
  const triangles=[],edges=new Map();
  let area=0,west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
  const normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  for(const mesh of meshes){
    const {position,normal:normals}=mesh.geometry.attributes,index=mesh.geometry.index;
    mesh.updateMatrix();normalMatrix.getNormalMatrix(mesh.matrix);
    const length=index?index.count:position.count;
    for(let i=0;i<length;i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      if(normals&&!ids.every(id=>normal.fromBufferAttribute(normals,id).applyMatrix3(normalMatrix).normalize().y>.99))continue;
      const [a,b,c]=ids.map(id=>new THREE.Vector3().fromBufferAttribute(position,id).applyMatrix4(mesh.matrix));
      const signed=cross(a,b,c);
      // The top triangles are precisely the rendered land surface, excluding bevels and side walls.
      if(Math.abs(signed)<EPS||(!normals&&new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).y<=0))continue;
      area+=Math.abs(signed)/2;
      const t={a,b,c,mesh,offsetY:mesh.position.y,total:area,west:Math.min(a.x,b.x,c.x),east:Math.max(a.x,b.x,c.x),south:Math.min(a.z,b.z,c.z),north:Math.max(a.z,b.z,c.z)};
      triangles.push(t);west=Math.min(west,t.west);east=Math.max(east,t.east);south=Math.min(south,t.south);north=Math.max(north,t.north);
      for(const [p,q] of [[a,b],[b,c],[c,a]]){const key=edgeKey(p,q),entry=edges.get(key);if(entry)entry.count++;else edges.set(key,{a:p,b:q,count:1});}
    }
  }
  const boundary=[...edges.values()].filter(e=>e.count===1);
  const side=Math.max(1,Math.min(32,Math.ceil(Math.sqrt(triangles.length))));
  const dx=(east-west)||1,dz=(north-south)||1,grid=new Map();
  const cellX=x=>Math.max(0,Math.min(side-1,Math.floor((x-west)/dx*side)));
  const cellZ=z=>Math.max(0,Math.min(side-1,Math.floor((z-south)/dz*side)));
  for(const t of triangles)for(let x=cellX(t.west);x<=cellX(t.east);x++)for(let z=cellZ(t.south);z<=cellZ(t.north);z++){
    const key=x+z*side;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(t);
  }
  function candidates(a,b=a){
    const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minZ=Math.min(a.z,b.z),maxZ=Math.max(a.z,b.z);
    if(minX<west-EPS||maxX>east+EPS||minZ<south-EPS||maxZ>north+EPS)return [];
    const found=new Set();
    for(let x=cellX(minX);x<=cellX(maxX);x++)for(let z=cellZ(minZ);z<=cellZ(maxZ);z++)for(const t of grid.get(x+z*side)??[])found.add(t);
    return [...found];
  }
  function contains(p){return candidates(p).some(t=>triangleInterval(p,p,t)!==null);}
  function containsSegment(a,b){
    const intervals=candidates(a,b).map(t=>triangleInterval(a,b,t)).filter(Boolean).sort((x,y)=>x[0]-y[0]);
    let covered=0;
    for(const [lo,hi] of intervals){if(lo>covered+EPS)return false;covered=Math.max(covered,hi);if(covered>=1-EPS)return true;}
    return false;
  }
  function containsDisk(p,radius){
    if(!contains(p))return false;
    for(const {a,b} of boundary){
      const x=b.x-a.x,z=b.z-a.z,len=x*x+z*z;
      const u=len?Math.max(0,Math.min(1,((p.x-a.x)*x+(p.z-a.z)*z)/len)):0;
      if((p.x-a.x-u*x)**2+(p.z-a.z-u*z)**2<radius*radius)return false;
    }
    return true;
  }
  function sample(random=Math.random,margin=0){
    if(!triangles.length)return null;
    for(let attempt=0;attempt<32;attempt++){
      const target=random()*area;let lo=0,hi=triangles.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].total<target)lo=mid+1;else hi=mid;}
      const t=triangles[lo],u=Math.sqrt(random()),v=random(),wa=1-u,wb=u*(1-v),wc=u*v;
      const point={x:t.a.x*wa+t.b.x*wb+t.c.x*wc,z:t.a.z*wa+t.b.z*wb+t.c.z*wc,
        y:t.a.y*wa+t.b.y*wb+t.c.y*wc+(t.mesh.userData.targetY??t.mesh.position.y)-t.offsetY+.015};
      if(!margin||containsDisk(point,margin))return point;
    }
    return null;
  }
  return {area,shortSpan:Math.min(dx,dz),contains,containsSegment,containsDisk,sample};
}

export function rainAppearance(data,count=900){
  const intensity=weatherScales(data).rain??0;
  const wind=Number.isFinite(data.windSpeed)?Math.max(.3,Math.min(1.8,data.windSpeed/8)):.8;
  return {intensity,count:intensity>0?Math.min(count,Math.max(Math.min(8,count),Math.round(intensity**.65*count))):0,
    speed:1.05+Math.sqrt(intensity)*3.4,length:.14+intensity*.34,width:.75+intensity*1.5,opacity:intensity>0?.34+intensity*.52:0,wind};
}

// Single THREE.Points rain field driven strictly by vertex shader + one uTime uniform update per frame.
export function createRainField(initialDomain,{count=900,random=Math.random}={}){
  const maxCapacity=Math.max(1,count);
  let activeMaxCount=maxCapacity;
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(maxCapacity*3);
  const seeds=new Float32Array(maxCapacity*4);
  const origin=new THREE.Vector3();

  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  geometry.setDrawRange(0,0);

  const material=new THREE.ShaderMaterial({
    transparent:true,
    depthWrite:false,
    toneMapped:false,
    uniforms:{
      uTime:{value:0},
      uSpeed:{value:0},
      uWind:{value:.8},
      uLength:{value:.2},
      uWidth:{value:1},
      uOpacity:{value:0},
      uFlash:{value:0},
      uPixelRatio:{value:1},
      uHeightPx:{value:720},
      uTint:{value:new THREE.Color(0xb4d9eb)}
    },
    vertexShader:`
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uSpeed;
      uniform float uWind;
      uniform float uLength;
      uniform float uWidth;
      uniform float uPixelRatio;
      uniform float uHeightPx;
      varying float vFade;
      void main(){
        float h=max(0.25,aSeed.z);
        float cycle=fract(aSeed.x+(uTime*uSpeed*aSeed.y)/h);
        vec3 p=position;
        p.y+=(1.0-cycle)*h;
        p.x-=cycle*aSeed.w*min(1.0,uWind);
        vFade=(0.68+fract(aSeed.x*13.7)*0.32)*smoothstep(0.0,0.08,cycle)*smoothstep(1.0,0.84,cycle);
        vec4 mv=modelViewMatrix*vec4(p,1.0);
        float baseSize=max(4.0,(uLength*56.0+uWidth*4.5)*(uHeightPx/720.0));
        gl_PointSize=clamp((baseSize*uPixelRatio)/max(1.0,-mv.z),3.0,28.0);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform float uOpacity;
      uniform float uFlash;
      uniform vec3 uTint;
      varying float vFade;
      void main(){
        vec2 uv=gl_PointCoord-vec2(0.5);
        float halfW=0.09+0.04*(1.0-gl_PointCoord.y);
        float horiz=smoothstep(halfW,0.0,abs(uv.x));
        float vert=smoothstep(0.0,0.14,gl_PointCoord.y)*smoothstep(1.0,0.18,gl_PointCoord.y);
        float a=uOpacity*vFade*horiz*vert;
        if(a<0.01)discard;
        vec3 col=mix(uTint,vec3(0.92,0.97,1.0),(1.0-gl_PointCoord.y)*0.65+uFlash*0.35);
        gl_FragColor=vec4(col,a);
      }`
  });

  const mesh=new THREE.Points(geometry,material);
  mesh.name='intensity-rain-points';
  mesh.frustumCulled=false;
  mesh.renderOrder=2;
  mesh.visible=false;
  mesh.onBeforeRender=renderer=>{
    material.uniforms.uPixelRatio.value=renderer.getPixelRatio();
    const size=renderer.getSize(originSizeVec);
    material.uniforms.uHeightPx.value=Math.max(240,size.y);
  };
  const originSizeVec=new THREE.Vector2();

  let domain=null,drops=[],appearance=rainAppearance({},activeMaxCount),cells=null,lastWeather={};

  function pickCell(){
    if(!cells||!cells.length)return null;
    const total=cells.reduce((s,c)=>s+c.weight,0);
    let r=random()*total;
    for(const c of cells){r-=c.weight;if(r<=0)return c;}
    return cells[cells.length-1];
  }

  function clampDrift(point,cell){
    let drift=Math.min(.02,domain.shortSpan*.03);
    for(let i=0;i<8;i++){
      const target={x:point.x-drift,z:point.z};
      const inDomain=domain.containsSegment(point,target);
      const inCell=!cell||((target.x-cell.x)**2+(target.z-cell.z)**2<=cell.radius*cell.radius);
      if(inDomain&&inCell)return drift;
      drift*=0.5;
    }
    return 0;
  }

  function spawn(){
    if(cells){
      if(!cells.length)return null;
      for(let attempt=0;attempt<16;attempt++){
        const cell=pickCell(),rad=cell.radius*Math.sqrt(random()),ang=random()*Math.PI*2;
        const point={x:cell.x+Math.cos(ang)*rad,y:cell.y,z:cell.z+Math.sin(ang)*rad};
        if(!domain?.contains(point))continue;
        return {...point,ground:point.y,height:.72+random()*.22,phase:random(),speed:.82+(attempt%7)*.055,drift:clampDrift(point,cell),cell};
      }
      return null;
    }
    const point=domain?.sample(random);
    if(!point)return null;
    return {...point,ground:point.y,height:.76+random()*.24,phase:random(),speed:.82+random()*.36,drift:clampDrift(point,null),cell:null};
  }

  function uploadBuffers(){
    for(let i=0;i<drops.length;i++){
      const d=drops[i];
      positions[i*3]=d.x-origin.x;
      positions[i*3+1]=d.ground-origin.y;
      positions[i*3+2]=d.z-origin.z;
      seeds[i*4]=d.phase;
      seeds[i*4+1]=d.speed;
      seeds[i*4+2]=d.height;
      seeds[i*4+3]=d.drift;
    }
    geometry.attributes.position.needsUpdate=true;
    geometry.attributes.aSeed.needsUpdate=true;
    const drawCount=Math.min(drops.length,appearance.count);
    geometry.setDrawRange(0,drawCount);
    mesh.visible=drawCount>0&&appearance.opacity>0;
  }

  function refillDrops(){
    drops=[];
    if(domain&&domain.area>0){
      for(let i=0;i<maxCapacity;i++){
        const d=spawn();
        if(d)drops.push(d);
      }
    }
    uploadBuffers();
  }

  function setDomain(next){
    if(domain===next)return;
    domain=next;
    refillDrops();
  }

  function setCells(nextCells=null){
    if(nextCells===null){cells=null;return;}
    cells=nextCells.filter(c=>(c.rain??1)>0).map(c=>{
      const r=Math.max(1e-4,c.effectiveRadius??c.radius??.05);
      return {x:c.x,y:c.y??0,z:c.z,radius:r,weight:r*r*(c.rain??1)};
    });
    if(domain)refillDrops();
  }

  function setOrigin(next){
    if(origin.equals(next))return;
    origin.copy(next);
    for(let i=0;i<drops.length;i++){
      const d=drops[i];
      positions[i*3]=d.x-origin.x;
      positions[i*3+1]=d.ground-origin.y;
      positions[i*3+2]=d.z-origin.z;
    }
    geometry.attributes.position.needsUpdate=true;
  }

  function setMaxCount(nextMax){
    const clamped=Math.max(1,Math.min(maxCapacity,Math.round(nextMax)));
    if(clamped===activeMaxCount)return;
    activeMaxCount=clamped;
    setWeather(lastWeather);
  }

  function setWeather(data){
    lastWeather=data||{};
    appearance=rainAppearance(lastWeather,activeMaxCount);
    material.uniforms.uOpacity.value=appearance.opacity;
    material.uniforms.uSpeed.value=appearance.speed;
    material.uniforms.uWind.value=appearance.wind;
    material.uniforms.uLength.value=appearance.length;
    material.uniforms.uWidth.value=appearance.width;
    mesh.userData.precipitationMmPerHour=lastWeather.precipitation??null;
    mesh.userData.rainIntensity=appearance.intensity;
    const drawCount=Math.min(drops.length,appearance.count);
    geometry.setDrawRange(0,drawCount);
    mesh.visible=drawCount>0&&appearance.opacity>0;
  }

  function setFlash(value){
    material.uniforms.uFlash.value=Math.max(0,Math.min(1,value));
  }

  function animate(dt){
    if(!mesh.visible||appearance.speed<=0)return;
    material.uniforms.uTime.value+=dt;
  }

  function evaluateDropXZ(i,timeSec=material.uniforms.uTime.value){
    const d=drops[i];
    if(!d)return null;
    const h=Math.max(.25,d.height);
    const cycle=(d.phase+(timeSec*appearance.speed*d.speed)/h)%1;
    return {
      x:d.x-cycle*d.drift*Math.min(1,appearance.wind),
      y:d.ground+(1-cycle)*h,
      z:d.z
    };
  }

  setDomain(initialDomain);
  return {
    mesh,
    geometry,
    setDomain,
    setCells,
    setOrigin,
    setMaxCount,
    setWeather,
    setFlash,
    animate,
    evaluateDropXZ,
    get dropCount(){return geometry.drawRange.count;},
    get domain(){return domain;},
    get appearance(){return appearance;}
  };
}
