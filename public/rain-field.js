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

export function rainAppearance(data,count=1200){
  const intensity=weatherScales(data).rain??0;
  const wind=Number.isFinite(data.windSpeed)?Math.max(.3,Math.min(1.8,data.windSpeed/8)):.8;
  return {intensity,count:intensity>0?Math.min(count,Math.max(Math.min(8,count),Math.round(intensity**.65*count))):0,
    speed:1.05+Math.sqrt(intensity)*3.4,length:.14+intensity*.34,width:.75+intensity*1.5,opacity:intensity>0?.34+intensity*.52:0,wind};
}

export function createRainField(initialDomain,{count=1200,random=Math.random}={}){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(count*6),origin=new THREE.Vector3();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setDrawRange(0,0);
  const fades=new Float32Array(count*2);
  for(let i=0;i<count;i++){fades[i*2]=.7+(i%5)*.075;fades[i*2+1]=.02;}
  geometry.setAttribute('dropFade',new THREE.BufferAttribute(fades,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
    uniforms:{opacity:{value:0},tint:{value:new THREE.Color(0xb4d9eb)}},
    vertexShader:`attribute float dropFade;varying float fade;void main(){fade=dropFade;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float opacity;uniform vec3 tint;varying float fade;void main(){gl_FragColor=vec4(tint,opacity*fade);}`});
  const mesh=new THREE.LineSegments(geometry,material);
  // WebGL lines are usually one pixel wide. Camera-facing ribbons give light
  // rain a visible tapered drop and heavy rain genuinely wider/denser streaks.
  const ribbons=new THREE.InstancedBufferGeometry();
  ribbons.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,-1,1,0,1,0,0,1,1,0],3));
  const dropBuffer=new THREE.InstancedInterleavedBuffer(positions,6,1);
  ribbons.setAttribute('dropStart',new THREE.InterleavedBufferAttribute(dropBuffer,3,0));
  ribbons.setAttribute('dropEnd',new THREE.InterleavedBufferAttribute(dropBuffer,3,3));
  ribbons.instanceCount=0;
  const ribbonMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    uniforms:{opacity:{value:0},width:{value:1},flash:{value:0},resolution:{value:new THREE.Vector2(1280,720)},pixelRatio:{value:1}},
    vertexShader:`attribute vec3 dropStart;attribute vec3 dropEnd;uniform vec2 resolution;uniform float width;uniform float pixelRatio;varying vec2 dropUV;
      void main(){vec4 a=projectionMatrix*modelViewMatrix*vec4(dropStart,1.),b=projectionMatrix*modelViewMatrix*vec4(dropEnd,1.);
        vec2 ndcA=a.xy/a.w,ndcB=b.xy/b.w;vec2 screenAxis=(ndcB-ndcA)*resolution;float rawLen=length(screenAxis);
        vec2 dir=rawLen>.001?screenAxis/rawLen:vec2(.12,.99);
        float minLen=8.0*pixelRatio;if(rawLen<minLen){ndcB=ndcA+dir*(minLen/resolution);b.xy=ndcB*b.w;}
        vec2 side=vec2(-dir.y,dir.x);
        vec4 p=mix(a,b,position.y);p.xy+=side*position.x*width*pixelRatio*(1.-position.y*.68)/resolution*p.w;
        dropUV=position.xy;gl_Position=p;}`,
    fragmentShader:`uniform float opacity;uniform float flash;varying vec2 dropUV;
      void main(){float edge=pow(max(0.,1.-abs(dropUV.x)),1.75);float tip=smoothstep(0.,.07,dropUV.y);float tail=pow(max(0.,1.-dropUV.y),.72);
        vec3 col=mix(vec3(.58,.82,.97),vec3(.92,.97,1.),(1.-dropUV.y)*.7+flash*.35);
        gl_FragColor=vec4(col,opacity*edge*tip*tail);}`});
  const streaks=new THREE.Mesh(ribbons,ribbonMaterial);streaks.name='intensity-rain-streaks';streaks.frustumCulled=false;streaks.renderOrder=2;
  streaks.onBeforeRender=renderer=>{renderer.getDrawingBufferSize(ribbonMaterial.uniforms.resolution.value);ribbonMaterial.uniforms.pixelRatio.value=renderer.getPixelRatio();};
  mesh.add(streaks);material.visible=false;
  // Buffers change as drops respawn; avoid a stale bounding sphere culling a different territory.
  mesh.frustumCulled=false;
  let domain=null,drops=[],appearance=rainAppearance({},count),cells=null;
  function pickCell(){
    if(!cells||!cells.length)return null;
    const total=cells.reduce((s,c)=>s+c.weight,0);
    let r=random()*total;
    for(const c of cells){r-=c.weight;if(r<=0)return c;}
    return cells[cells.length-1];
  }
  function spawn(){
    if(cells){
      if(!cells.length)return null;
      for(let attempt=0;attempt<16;attempt++){
        const cell=pickCell(),rad=cell.radius*Math.sqrt(random()),ang=random()*Math.PI*2;
        const px=cell.x+Math.cos(ang)*rad,pz=cell.z+Math.sin(ang)*rad;
        const point={x:px,y:cell.y,z:pz};
        if(!domain?.contains(point))continue;
        let tail=Math.min(.02,domain.shortSpan*.03);
        for(let i=0;i<8&&(!domain.containsSegment(point,{x:point.x+tail,z:point.z})||(point.x+tail-cell.x)**2+(point.z-cell.z)**2>cell.radius*cell.radius);i++)tail/=2;
        if(!domain.containsSegment(point,{x:point.x+tail,z:point.z})||(point.x+tail-cell.x)**2+(point.z-cell.z)**2>cell.radius*cell.radius)tail=0;
        return {...point,tail,ground:point.y,y:point.y+.06+random()*.78,cell};
      }
      return null;
    }
    const point=domain?.sample(random);
    if(!point)return null;
    let tail=Math.min(.02,domain.shortSpan*.03);
    for(let i=0;i<8&&!domain.containsSegment(point,{x:point.x+tail,z:point.z});i++)tail/=2;
    if(!domain.containsSegment(point,{x:point.x+tail,z:point.z}))tail=0;
    return {...point,tail,ground:point.y,y:point.y+.12+random()*.88,cell:null};
  }
  function refillDrops(){
    drops=[];
    for(let i=0;i<count;i++){const d=spawn();if(d)drops.push(d);}
    drops.forEach((d,i)=>write(i,d));geometry.attributes.position.needsUpdate=true;dropBuffer.needsUpdate=true;
    geometry.setDrawRange(0,Math.min(drops.length,appearance.count)*2);
    ribbons.instanceCount=Math.min(drops.length,appearance.count);
    mesh.visible=ribbons.instanceCount>0;
  }
  function write(i,d){
    const length=appearance.length*(.7+(i%7)*.1);
    positions.set([d.x-origin.x,d.y-origin.y,d.z-origin.z,d.x+d.tail-origin.x,d.y+length-origin.y,d.z-origin.z],i*6);
  }
  function setDomain(next){
    if(domain===next)return;
    domain=next;refillDrops();
  }
  function setCells(nextCells=null){
    if(nextCells===null){cells=null;return;}
    cells=nextCells.filter(c=>(c.rain??1)>0).map(c=>{
      const r=Math.max(1e-4,c.effectiveRadius??c.radius??.05);
      return {x:c.x,y:c.y??0,z:c.z,radius:r,weight:r*r*(c.rain??1)};
    });
    if(domain)refillDrops();
  }
  function setOrigin(next){origin.copy(next);drops.forEach((d,i)=>write(i,d));geometry.attributes.position.needsUpdate=true;dropBuffer.needsUpdate=true;}
  function setWeather(data){
    appearance=rainAppearance(data,count);mesh.material.opacity=appearance.opacity;material.uniforms.opacity.value=appearance.opacity;
    ribbonMaterial.uniforms.opacity.value=appearance.opacity;ribbonMaterial.uniforms.width.value=appearance.width;
    mesh.userData.precipitationMmPerHour=data.precipitation??null;
    mesh.userData.rainIntensity=appearance.intensity;
    geometry.setDrawRange(0,Math.min(drops.length,appearance.count)*2);
    ribbons.instanceCount=Math.min(drops.length,appearance.count);
    mesh.visible=ribbons.instanceCount>0;
    // A paused scene also reflects new intensity and drop length immediately.
    drops.forEach((d,i)=>write(i,d));geometry.attributes.position.needsUpdate=true;dropBuffer.needsUpdate=true;
  }
  function setFlash(value){ribbonMaterial.uniforms.flash.value=Math.max(0,Math.min(1,value));}
  function animate(dt){
    const active=Math.min(drops.length,appearance.count);
    if(!active)return;
    for(let i=0;i<active;i++){
      let d=drops[i];
      const fall=appearance.speed*(.82+(i%7)*.055)*dt;
      const previousX=d.x;d.x-=fall*.08*appearance.wind;d.y-=fall;
      // Wind stops at the edge of both the territory and its parent cloud cell.
      const outOfCloud=d.cell&&((d.x-d.cell.x)**2+(d.z-d.cell.z)**2>d.cell.radius*d.cell.radius||(d.x+d.tail-d.cell.x)**2+(d.z-d.cell.z)**2>d.cell.radius*d.cell.radius);
      if(outOfCloud||!domain.containsSegment(d,{x:d.x+d.tail,z:d.z}))d.x=previousX;
      if(d.y<d.ground){
        const replacement=spawn();
        if(replacement)d=drops[i]=replacement;
        else {geometry.setDrawRange(0,0);ribbons.instanceCount=0;mesh.visible=false;return;}
      }
      write(i,d);
    }
    geometry.attributes.position.needsUpdate=true;dropBuffer.needsUpdate=true;
  }
  setDomain(initialDomain);
  return {mesh,geometry,setDomain,setCells,setOrigin,setWeather,setFlash,animate,get domain(){return domain;},get appearance(){return appearance;}};
}
