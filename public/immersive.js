import {createRenderLoop} from './render-loop.js';
import {attachMovablePanel} from './movable-panels.js';
import {loadStaticJSON} from './data-client.js';
import {createMapCamera} from './map-camera.js';
import {createProvinceExplorer} from './province-explorer.js';
import {surfaceMaterial,addSceneAtmosphere} from './scene-art.js';
import {createWeatherExperience} from './weather-experience.js';
import {createQualityManager} from './quality-manager.js';
import {createTerritoryPicker} from './territory-picker.js';
import * as THREE from './vendor/three.module.js';
import {siteOptionsHtml,annualValue} from './territories.js';
import {registerTerritories} from './recommendations.js';
import {getLang,getTheme,locale,setLang,tx} from './i18n.js';
import {readSectors} from './weather-state.js';
import {createSimulator} from './simulator.js';
import {computeAllRisks,driverLabel,fetchLiveRadarTemps,riskColor,riskLevel,topRiskCantons,RISK_GRADIENT_CSS} from './ecological-risk.js';
import {icon} from './icons.js';

const host=document.createElement('section');
host.id='immersive';
host.setAttribute('aria-label',tx('3D exploration of Costa Rica','Exploración tridimensional de Costa Rica'));
host.innerHTML=`<div id="world-canvas"></div><div class="scene-vignette"></div><div class="flight-intro"><span class="eyebrow">GAIA E&amp;B · ENVIRONMENT &amp; BENEFITS / ${tx('COSTA RICA MISSION','MISIÓN COSTA RICA')}</span><h1>${tx('Costa Rica, a living observatory.','Costa Rica, un observatorio vivo.')}</h1><p>${tx('Explore real NASA climate series, district terrain, and ecological signals across 7 provinces and 83 cantons.','Explora series reales de la NASA, relieve distrital y señales ecológicas en 7 provincias y 83 cantones.')}</p></div><aside class="flight-panel"><div class="flight-kicker"><span class="live-dot"></span> ${tx('SCIENTIFIC TELEMETRY','TELEMETRÍA CIENTÍFICA')}</div><label class="territory-field-label" for="hud-province-select">${tx('Province','Provincia')}</label><select id="hud-province-select" class="hud-select" aria-label="Seleccionar provincia"></select><label class="territory-field-label" for="hud-site-select">${tx('Canton','Cantón')}</label><select id="hud-site-select" class="hud-select" aria-label="${tx('Select province or canton','Seleccionar provincia o cantón')}"></select><label class="territory-field-label" id="hud-district-label" for="hud-district-select" hidden>${tx('District','Distrito')}</label><select id="hud-district-select" class="hud-select" aria-label="${tx('Select district','Seleccionar distrito')}" hidden></select><h2 id="flight-place">${tx('Choose a province','Elige una provincia')}</h2><span id="flight-coord" class="mono"></span><div class="flight-reading"><strong id="flight-value">—</strong><span id="flight-unit">°C</span></div><p id="flight-variable">${tx('Mean temperature · historical 2025','Temperatura media · histórico 2025')}</p><div class="flight-rule"></div><p class="flight-source">${tx('REAL DATA / NASA POWER<br><span>One reference point per territory.<br>Select a province or canton to investigate.</span>','DATOS REALES / NASA POWER<br><span>Un punto de referencia por territorio.<br>Selecciona una provincia o cantón para investigar.</span>')}</p><p class="source-integrity"></p><button id="flight-investigate">${tx('Investigate this territory','Investigar este territorio')} ${icon('arrow-up-right')}</button></aside><div class="flight-bottom"><div class="flight-controls"><button id="region-mode" type="button" class="chosen" aria-pressed="true">${icon('compass')} ${tx('3D Territory','Territorio 3D')}</button><button id="radar-mode-3d" type="button" aria-pressed="false">${icon('shield-alert')} ${tx('Ecological Risk','Riesgo ecológico')}</button><button id="lab-mode">${icon('activity')} ${tx('Simulator','Simulador')}</button><button id="forecast-mode">${icon('cloud')} ${tx('7-Day Context','Contexto 7 días')}</button></div><div class="flight-guidance"><span>${tx('Drag to move · Right-drag to rotate · Scroll to zoom','Arrastra para mover · Clic derecho para girar · Rueda para zoom')}</span><label class="quality-control"><span id="quality-label">${tx('Quality:','Calidad:')}</span><select id="quality-select" aria-label="${tx('Render quality','Calidad de renderizado')}"><option value="auto">${tx('Auto','Auto')}</option><option value="high">${tx('High','Alta')}</option><option value="mid">${tx('Mid','Media')}</option><option value="low">${tx('Low','Baja')}</option></select></label><button id="hud-lang-toggle" type="button" aria-label="${tx('Cambiar a Español','Switch to English')}">${icon('globe')} ${tx('ES','EN')}</button><button id="hud-theme-toggle" type="button" data-theme-toggle aria-pressed="${getTheme()==='light'}">${icon(getTheme()==='light'?'moon':'sun')} ${getTheme()==='light'?tx('Dark','Oscuro'):tx('Light','Claro')}</button><button id="camera-mode" type="button" aria-pressed="false">${icon('move')} ${tx('Move','Mover')}</button><button id="camera-reset" type="button">${icon('crosshair')} ${tx('Center','Centrar')}</button><button id="motion-toggle" aria-pressed="true">${icon('pause')} ${tx('Ambient effects','Ambientación')}</button><button id="fullscreen-mode">${icon('maximize')} ${tx('Fullscreen','Pantalla completa')}</button></div></div><div id="flight-label">${tx('COSTA RICA / ORBITAL DESCENT','COSTA RICA / DESCENSO ORBITAL')}</div><div id="hud-radar-legend" hidden><div class="radar-legend-head"><strong id="radar-legend-title"></strong><span id="radar-legend-range"></span></div><div class="radar-legend-bar"></div><small id="radar-legend-note"></small><div id="radar-breakdown"></div><details id="radar-formula-details" class="radar-formula-details"><summary id="radar-formula-summary"></summary><p id="radar-formula-body"></p></details><div id="radar-top5"></div></div><div id="low-quality-offer" class="low-quality-offer" role="status" hidden><span id="low-quality-msg"></span><button type="button" id="open-2d-explorer">${tx('Open 2D Map (#explorador)','Abrir mapa 2D (#explorador)')}</button><button type="button" id="dismiss-2d-offer" aria-label="${tx('Close','Cerrar')}">×</button></div><span class="scene-disclaimer">${tx('Weather indicators driven by model data at reference points · not radar or satellite imagery','Indicadores meteorológicos según datos del modelo en puntos de referencia · no son radar ni imagen satelital')}</span><button id="close-lab" hidden>${icon('arrow-left')} ${tx('Back to 3D exploration','Volver a la exploración 3D')}</button><p id="scene-loading" role="status">${tx('Initializing 3D territory…','Inicializando territorio 3D…')}</p>`;
document.body.append(host);

const telemetryPanel=host.querySelector('.flight-panel');
telemetryPanel.prepend(attachMovablePanel(telemetryPanel,{id:'conditions',english:'Conditions',spanish:'Condiciones',parent:host}));

const $=s=>document.querySelector(s);
const DEBUG_MODE=typeof location!=='undefined'?new URLSearchParams(location.search).has('debug'):false;
const debugEl=DEBUG_MODE?Object.assign(document.createElement('aside'),{id:'debug-overlay',className:'debug-overlay'}):null;
if(debugEl){debugEl.setAttribute('aria-label','3D Render Diagnostics');host.append(debugEl);}

const reducedMotionQuery=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false,addEventListener(){}};
const pendingLandingTarget=document.body.getAttribute('data-landing-entered');
document.body.classList.add('immersive-mode','national-view');
if(!pendingLandingTarget&&!reducedMotionQuery.matches)document.body.classList.add('intro-playing');

let explorer,cameraControls,weather=null,radarMode=false,ecological=null,riskSummary=null,liveTemps=null,liveAt=null;
const provinceBorders=[];
let renderer,scene,camera,root,planet,planetFades=[],meshes=[],beacons=[],sectorDots=null,sectorRings=null,sectorPoints=[],sectorsCatalog={},simulator=null,districtBordersMap={},districtLines=null,activeDistrictLine=null,selectedDistrict=null,activeProvince=null,starPoints,pinRing,selection=null,sites=[],annual,territoryManifest,geo,overviewGeo=null,fullGeoPromise=null,fullGeo=null,territoryPicker=null;
let nationalGroup=null,detailGroup=null,nationalLandMesh=null,nationalOutlineLines=null,nationalSlices=[];
const provinceDetailCache=new Map();
let variable='T2M',year=2025,orbital=!reducedMotionQuery.matches,introStart=null,introDone=reducedMotionQuery.matches,moving=!reducedMotionQuery.matches;
let yaw=.1026,pitch=.1815,distance=13.5,targetYaw=.1026,targetPitch=.1815,targetDistance=13.5,lastFrame=0;
let sceneDirty=true,loop=null,renderTick=0,lastPickTick=-1,offerDismissed=false,webglUnavailable=false;

let savedQuality='auto';
try{savedQuality=localStorage.getItem('gaiatrack_quality')||'auto';}catch{}
const qualityManager=createQualityManager({
  initialMode:savedQuality,
  onChange:({active,preset,reason})=>{
    applyQualityPreset(active,preset,{reason});
  }
});

function show2dOffer({webglFailed=false}={}){
  const box=$('#low-quality-offer'),msg=$('#low-quality-msg'),btn=$('#open-2d-explorer'),dismiss=$('#dismiss-2d-offer');
  if(!box||!msg||!btn)return;
  if(!webglFailed&&offerDismissed){box.hidden=true;return;}
  webglUnavailable=webglUnavailable||webglFailed;
  msg.textContent=webglFailed
    ?tx('WebGL unavailable on this device · Use the 2D Leaflet explorer','WebGL no disponible en este dispositivo · Usá el explorador 2D Leaflet')
    :tx('Low quality mode active · Switch to the 2D Leaflet explorer anytime','Modo de calidad baja activo · Podés usar el explorador 2D Leaflet');
  btn.textContent=tx('Open 2D Map (#explorador)','Abrir mapa 2D (#explorador)');
  if(dismiss)dismiss.hidden=webglFailed;
  box.hidden=false;
}

function hide2dOffer(){
  const box=$('#low-quality-offer');
  if(box&&!webglUnavailable)box.hidden=true;
}

$('#open-2d-explorer').onclick=()=>{
  panel('#explorador');
  const box=$('#low-quality-offer');
  if(box)box.hidden=true;
};
$('#dismiss-2d-offer').onclick=()=>{
  offerDismissed=true;
  hide2dOffer();
};

const qualitySelect=$('#quality-select');
if(qualitySelect){
  qualitySelect.value=qualityManager.mode;
  qualitySelect.onchange=()=>{
    offerDismissed=false;
    try{localStorage.setItem('gaiatrack_quality',qualitySelect.value);}catch{}
    qualityManager.setMode(qualitySelect.value);
  };
}

function invalidateScene(){
  sceneDirty=true;
  explorer?.invalidateLabels?.();
  loop?.invalidate?.();
}

function applyQualityPreset(activeTier,preset,{reason='user'}={}){
  if(renderer){
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,preset.maxPixelRatio));
    renderer.shadowMap.enabled=Boolean(preset.shadows);
    renderer.toneMapping=preset.toneMapping?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
    if(renderer.shadowMap)renderer.shadowMap.needsUpdate=Boolean(preset.shadows);
  }
  const keyLight=scene?.getObjectByName?.('key-light');
  if(keyLight)keyLight.castShadow=Boolean(preset.shadows);
  for(const cached of provinceDetailCache.values()){
    for(const m of cached.meshes){
      m.castShadow=Boolean(preset.shadows);
      m.receiveShadow=Boolean(preset.shadows);
    }
  }
  if(starPoints?.material?.uniforms?.pixelRatio&&renderer){
    starPoints.material.uniforms.pixelRatio.value=renderer.getPixelRatio();
  }
  weather?.setQuality?.(preset);
  if(activeTier==='low'){
    show2dOffer({webglFailed:false});
  }else if(reason==='user'){
    hide2dOffer();
  }
  if(qualitySelect&&qualityManager.mode==='auto'&&reason==='governor'){
    qualitySelect.title=tx(`Auto-adjusted to ${activeTier}`,`Autoajustado a ${activeTier}`);
  }
  invalidateScene();
}

function buildBorderPositions(entries,y=.294){
  let count=0;for(const d of entries)for(const r of d.rings)if(r.length>1)count+=r.length-1;
  const arr=new Float32Array(count*6);let off=0;
  for(const d of entries)for(const r of d.rings)for(let i=0;i<r.length-1;i++){
    const a=coords(r[i][0],r[i][1]),b=coords(r[i+1][0],r[i+1][1]);
    arr[off++]=a.x;arr[off++]=y;arr[off++]=a.z;
    arr[off++]=b.x;arr[off++]=y;arr[off++]=b.z;
  }
  return arr;
}

function buildFeatureOutlineSegments(features,y=.285){
  let segs=0;
  for(const f of features){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const rings of polys)for(const ring of rings)if(ring.length>1)segs+=ring.length-1;
  }
  const arr=new Float32Array(segs*6);
  let off=0;
  for(const f of features){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const rings of polys)for(const ring of rings)for(let i=0;i<ring.length-1;i++){
      const a=coords(ring[i][0],ring[i][1]),b=coords(ring[i+1][0],ring[i+1][1]);
      arr[off++]=a.x;arr[off++]=y;arr[off++]=a.z;
      arr[off++]=b.x;arr[off++]=y;arr[off++]=b.z;
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.BufferAttribute(arr,3));
  return geom;
}

function buildFeatureExtrusionGeometry(rings,{bevel=false}={}){
  const shape=new THREE.Shape();
  rings[0].forEach(([lon,lat],i)=>{const p=coords(lon,lat);if(i===0)shape.moveTo(p.x,-p.z);else shape.lineTo(p.x,-p.z);});
  for(const hole of rings.slice(1)){
    const path=new THREE.Path();
    hole.forEach(([lon,lat],i)=>{const p=coords(lon,lat);if(i===0)path.moveTo(p.x,-p.z);else path.lineTo(p.x,-p.z);});
    shape.holes.push(path);
  }
  const geometry=new THREE.ExtrudeGeometry(shape,bevel
    ?{depth:.26,bevelEnabled:true,bevelSize:.012,bevelThickness:.018,bevelSegments:1,steps:1}
    :{depth:.26,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);
  return geometry;
}

function mergeNationalExtrusions(features){
  const parts=[];
  let totalVerts=0;
  for(const f of features){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const rings of polys){
      if(!rings[0]||rings[0].length<3)continue;
      const g=buildFeatureExtrusionGeometry(rings,{bevel:false}).toNonIndexed();
      const count=g.attributes.position.count;
      parts.push({id:f.properties.id,province:f.properties.province,geometry:g,startVertex:totalVerts,vertexCount:count});
      totalVerts+=count;
    }
  }
  const positions=new Float32Array(totalVerts*3);
  const normals=new Float32Array(totalVerts*3);
  const colors=new Float32Array(totalVerts*3);
  const slices=[];
  for(const part of parts){
    positions.set(part.geometry.attributes.position.array,part.startVertex*3);
    normals.set(part.geometry.attributes.normal.array,part.startVertex*3);
    slices.push({id:part.id,province:part.province,startVertex:part.startVertex,vertexCount:part.vertexCount});
    part.geometry.dispose();
  }
  const merged=new THREE.BufferGeometry();
  merged.setAttribute('position',new THREE.BufferAttribute(positions,3));
  merged.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  merged.setAttribute('color',new THREE.BufferAttribute(colors,3));
  merged.computeBoundingSphere();
  return {geometry:merged,slices};
}

function updateDistrictBorders(){
  if(!districtLines||!activeDistrictLine)return;
  const site=sites.find(s=>s.id===selection);
  const list=site?.type==='canton'?districtBordersMap[selection]:null;
  if(!list?.length){districtLines.visible=false;activeDistrictLine.visible=false;invalidateScene();return;}
  districtLines.geometry.dispose();
  districtLines.geometry=new THREE.BufferGeometry();
  districtLines.geometry.setAttribute('position',new THREE.BufferAttribute(buildBorderPositions(list),3));
  districtLines.visible=true;
  const active=selectedDistrict?list.filter(d=>d.id===selectedDistrict):[];
  if(active.length){
    activeDistrictLine.geometry.dispose();
    activeDistrictLine.geometry=new THREE.BufferGeometry();
    activeDistrictLine.geometry.setAttribute('position',new THREE.BufferAttribute(buildBorderPositions(active),3));
    activeDistrictLine.visible=true;
  }else{activeDistrictLine.visible=false;}
  invalidateScene();
}

const secDummy=new THREE.Object3D(),secDryCol=new THREE.Color(0x18d86b),secWetCol=new THREE.Color(0x38bdf8),secSelCol=new THREE.Color(0xf5b316);
function populateDistricts(siteId){
  const sel=$('#hud-district-select'),lbl=$('#hud-district-label');
  if(!sel||!lbl)return;
  const list=sectorsCatalog[siteId]||[];
  if(!list.length){sel.hidden=true;lbl.hidden=true;selectedDistrict=null;return;}
  const prev=selectedDistrict&&list.some(d=>d.id===selectedDistrict)?selectedDistrict:'';
  selectedDistrict=prev||null;
  sel.innerHTML=`<option value="">${tx('All districts','Todos los distritos')} (${list.length})</option>`+list.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  sel.value=prev;sel.hidden=false;lbl.hidden=false;
}

function updateSectorBeacons(){
  if(!sectorDots||!sectorRings||!sectorPoints.length)return;
  if(!activeProvince){sectorDots.count=0;sectorRings.count=0;sectorDots.visible=false;sectorRings.visible=false;invalidateScene();return;}
  let n=0;const wetIds=new Set();
  const seenParents=new Set();
  for(const sp of sectorPoints){
    if(sp.province!==activeProvince)continue;
    if(!seenParents.has(sp.parent)){seenParents.add(sp.parent);for(const sr of readSectors(sp.parent)||[])if(Number.isFinite(sr.precipitation)&&sr.precipitation>0)wetIds.add(sr.site);}
    const chosen=sp.id===selectedDistrict,raised=sp.parent===selection,y=chosen?.56:raised?.50:.34,sc=chosen?1.55:raised?1.15:.92;
    secDummy.position.set(sp.x,y,sp.z);secDummy.rotation.set(0,0,0);secDummy.scale.setScalar(sc);secDummy.updateMatrix();
    sectorDots.setMatrixAt(n,secDummy.matrix);
    secDummy.position.set(sp.x,y-.025,sp.z);secDummy.rotation.set(-Math.PI/2,0,0);secDummy.scale.setScalar(sc);secDummy.updateMatrix();
    sectorRings.setMatrixAt(n,secDummy.matrix);
    const col=chosen?secSelCol:wetIds.has(sp.id)?secWetCol:secDryCol;
    sectorDots.setColorAt(n,col);sectorRings.setColorAt(n,col);
    n++;
  }
  sectorDots.count=n;sectorRings.count=n;sectorDots.visible=n>0;sectorRings.visible=n>0;
  if(n>0){sectorDots.instanceMatrix.needsUpdate=true;sectorRings.instanceMatrix.needsUpdate=true;if(sectorDots.instanceColor)sectorDots.instanceColor.needsUpdate=true;if(sectorRings.instanceColor)sectorRings.instanceColor.needsUpdate=true;}
  invalidateScene();
}

async function ensureFullGeo(){
  if(fullGeo)return fullGeo;
  if(!fullGeoPromise){
    fullGeoPromise=loadStaticJSON('data/cantons.geojson?v=18').then(data=>{
      fullGeo=data;
      if(data?.features?.length)territoryPicker=createTerritoryPicker(data,coords);
      return data;
    }).catch(()=>overviewGeo);
  }
  return fullGeoPromise;
}

function buildProvinceDetailEntry(provId,sourceGeo){
  if(provinceDetailCache.has(provId))return provinceDetailCache.get(provId);
  const provFeatures=(sourceGeo?.features||[]).filter(f=>f.properties?.province===provId);
  const pGroup=new THREE.Group();
  pGroup.name='detail-'+provId;
  const provMeshes=[];
  const bevel=qualityManager.active==='high';
  const sharedMat=surfaceMaterial({styled:qualityManager.active!=='low'});
  for(const f of provFeatures){
    const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
    for(const rings of polys){
      if(!rings[0]||rings[0].length<3)continue;
      const geometry=buildFeatureExtrusionGeometry(rings,{bevel});
      const mat=sharedMat.clone();
      const mesh=new THREE.Mesh(geometry,mat);
      mesh.castShadow=qualityManager.preset.shadows;
      mesh.receiveShadow=qualityManager.preset.shadows;
      mesh.userData={id:f.properties.id,name:f.properties.name,province:provId,targetY:0};
      provMeshes.push(mesh);
      pGroup.add(mesh);
    }
  }
  sharedMat.dispose();
  const outlineMat=new THREE.LineBasicMaterial({color:getTheme()==='light'?0x0e77f0:0x2299d4,transparent:true,opacity:.68});
  const outlineLine=new THREE.LineSegments(buildFeatureOutlineSegments(provFeatures,.285),outlineMat);
  pGroup.add(outlineLine);
  const entry={group:pGroup,meshes:provMeshes,outlineLine,fullDetail:sourceGeo===fullGeo};
  provinceDetailCache.set(provId,entry);
  return entry;
}

async function syncProvinceGeometryVisibility(){
  if(!nationalGroup||!detailGroup)return;
  if(!activeProvince){
    nationalGroup.visible=true;
    detailGroup.visible=false;
    for(const entry of provinceDetailCache.values())entry.group.visible=false;
    paintMeshes();
    invalidateScene();
    return;
  }
  nationalGroup.visible=false;
  detailGroup.visible=true;
  const targetProv=activeProvince;
  const sourceGeo=fullGeo||overviewGeo;
  let entry=buildProvinceDetailEntry(targetProv,sourceGeo);
  if(!entry.group.parent)detailGroup.add(entry.group);
  for(const [k,v] of provinceDetailCache.entries())v.group.visible=(k===targetProv);
  paintMeshes();
  invalidateScene();
  if(!entry.fullDetail){
    const loaded=await ensureFullGeo();
    if(loaded&&loaded!==overviewGeo&&activeProvince===targetProv){
      detailGroup.remove(entry.group);
      for(const m of entry.meshes){m.geometry.dispose();m.material.dispose();}
      entry.outlineLine.geometry.dispose();
      entry.outlineLine.material.dispose();
      provinceDetailCache.delete(targetProv);
      entry=buildProvinceDetailEntry(targetProv,loaded);
      detailGroup.add(entry.group);
      entry.group.visible=true;
      paintMeshes();
      invalidateScene();
    }
  }
}

document.addEventListener('gaiatrack:territory-view',e=>{
  activeProvince=e.detail?.province??null;
  syncProvinceGeometryVisibility();
  updateSectorBeacons();
});
document.addEventListener('gaiatrack:weather-sectors',()=>updateSectorBeacons());

const focus=new THREE.Vector3(),targetFocus=new THREE.Vector3();
document.addEventListener('gaiatrack:focuspoint',e=>{
  introDone=true;document.body.classList.remove('intro-playing');mode(false);
  const p=coords(e.detail.longitude,e.detail.latitude);
  targetFocus.set(p.x,.6,p.z);targetDistance=6.8;
  invalidateScene();
});

function activeSectionAnchor(){
  const sections=['#tendencias','#explorador','#pronostico'];
  const mainEl=document.querySelector('main');
  const topOffset=mainEl&&document.body.classList.contains('lab-open')?mainEl.getBoundingClientRect().top+160:140;
  let current='#tendencias';
  for(const id of sections){
    const el=document.querySelector(id==='#pronostico'?'#tiempo-actual':id)||document.querySelector(id);
    if(el&&el.getBoundingClientRect().top<=topOffset)current=id;
  }
  return current;
}

function syncNav(forcedAnchor=null){
  const labOpen=document.body.classList.contains('lab-open');
  const current=labOpen?(forcedAnchor||activeSectionAnchor()):null;
  document.querySelectorAll('.topbar nav a').forEach(a=>a.classList.toggle('active',Boolean(current)&&a.getAttribute('href')===current));
  $('#lab-mode')?.classList.toggle('chosen',labOpen&&current!=='#pronostico');
  $('#forecast-mode')?.classList.toggle('chosen',labOpen&&current==='#pronostico');
  const regionActive=!labOpen&&!orbital&&!radarMode;
  $('#region-mode')?.classList.toggle('chosen',regionActive);
  $('#region-mode')?.setAttribute('aria-pressed',String(regionActive));
}

function panel(anchor){
  document.body.classList.add('lab-open');$('#close-lab').hidden=false;syncNav(anchor);
  document.dispatchEvent(new CustomEvent('gaiatrack:view',{detail:{view:({'#tendencias':'trends','#explorador':'explorer','#pronostico':'forecast','#tiempo-actual':'current'})[anchor]??'trends'}}));
  requestAnimationFrame(()=>{document.querySelector(anchor)?.scrollIntoView({behavior:'instant'});window.dispatchEvent(new Event('resize'));syncNav(anchor);});
}

function close(){
  document.body.classList.remove('lab-open');
  $('#close-lab').hidden=true;
  if(!introDone||orbital){
    introDone=true;
    document.body.classList.remove('intro-playing');
    mode(false);
  }
  syncNav(null);
  const fp=$('.flight-panel');
  if(fp)fp.scrollTop=0;
  explorer?.focus();
  document.dispatchEvent(new CustomEvent('gaiatrack:view',{detail:{view:'3d'}}));
  invalidateScene();
}

function returnToTerritory3d({resetCountry=false}={}){
  introDone=true;
  document.body.classList.remove('intro-playing');
  if(radarMode)setRadarMode3d(false);
  mode(false);
  if(document.body.classList.contains('lab-open'))close();
  else syncNav(null);
  if(resetCountry)explorer?.country(true);
  else explorer?.focus();
  paintMeshes();
  invalidateScene();
}

document.addEventListener('gaiatrack:assistant-view',event=>{
  if(event.detail.view==='3d'){close();return;}
  const anchors={trends:'#tendencias',explorer:'#explorador',forecast:'#pronostico',current:'#tiempo-actual'};
  if(anchors[event.detail.view])panel(anchors[event.detail.view]);
});

$('#motion-toggle').innerHTML=moving?`${icon('pause')} ${tx('Ambient effects','Ambientación')}`:`${icon('play')} ${tx('Ambient effects','Ambientación')}`;
$('#motion-toggle').setAttribute('aria-pressed',String(moving));
$('#close-lab').onclick=close;
$('#forecast-mode').onclick=()=>panel('#pronostico');
$('#lab-mode').onclick=()=>{if(simulator)simulator.open({site:selection,district:selectedDistrict});else panel('#tendencias');};
$('#flight-investigate').onclick=()=>panel('#tendencias');
document.querySelectorAll('.topbar nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();panel(a.getAttribute('href'));}));
$('.brand')?.addEventListener('click',e=>{
  e.preventDefault();
  if($('#method-dialog')?.open)$('#method-dialog').close();
  if(document.body.classList.contains('clean-cockpit'))$('#weather-clean-view')?.click();
  returnToTerritory3d({resetCountry:true});
});
$('.inspector-cta')?.addEventListener('click',e=>{e.preventDefault();panel('#tendencias');});
const onNavScroll=()=>{if(document.body.classList.contains('lab-open'))syncNav();};
window.addEventListener('scroll',onNavScroll,{passive:true});
document.querySelector('main')?.addEventListener('scroll',onNavScroll,{passive:true});
syncNav(null);

$('#fullscreen-mode').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('#fullscreen-mode').textContent=tx('Fullscreen unavailable','Pantalla completa no disponible');}};
$('#camera-mode').onclick=()=>cameraControls?.setMode(cameraControls.mode==='pan'?'rotate':'pan');
$('#camera-reset').onclick=()=>explorer?.focus();
$('#hud-lang-toggle').onclick=()=>setLang(getLang()==='en'?'es':'en');
$('#motion-toggle').onclick=()=>{
  moving=!moving;
  $('#motion-toggle').innerHTML=moving?`${icon('pause')} ${tx('Ambient effects','Ambientación')}`:`${icon('play')} ${tx('Ambient effects','Ambientación')}`;
  $('#motion-toggle').setAttribute('aria-pressed',String(moving));
  invalidateScene();
  loop?.sync?.();
};

function mode(value){
  targetFocus.set(0,0,0);
  orbital=value;
  if(root){root.visible=!value;root.scale.setScalar(1);}
  if(planet)planet.visible=value;
  targetDistance=value?13.5:16;
  targetPitch=value?.1815:.8;
  targetYaw=value?.1026:.22;
  const regionActive=!value&&!radarMode&&!document.body.classList.contains('lab-open');
  $('#region-mode')?.classList.toggle('chosen',regionActive);
  $('#region-mode')?.setAttribute('aria-pressed',String(regionActive));
  $('#flight-label').textContent=value?tx('COSTA RICA / ORBITAL DESCENT','COSTA RICA / DESCENSO ORBITAL'):tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');
  updateRadarLegend();
  invalidateScene();
}

$('#region-mode').onclick=()=>{
  const shouldResetCountry=!radarMode&&Boolean(selection);
  returnToTerritory3d({resetCountry:shouldResetCountry});
};

function updateRadarLegend(){
  const leg=$('#hud-radar-legend');
  if(!leg)return;
  leg.hidden=!radarMode||orbital;
  if(leg.hidden)return;
  const lang=getLang();
  $('#radar-legend-title').textContent=tx('ECOLOGICAL RISK RADAR','RADAR DE RIESGO ECOLÓGICO');
  $('#radar-legend-range').textContent=riskSummary?`${riskSummary.min} — ${riskSummary.max} / 100`:'0 — 100';
  const bar=leg.querySelector('.radar-legend-bar');if(bar)bar.style.background=RISK_GRADIENT_CSS;
  const liveTxt=liveAt?` · ${tx('Live','Actual')} ${new Date(liveAt).toLocaleTimeString(locale(),{timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit'})}`:'';
  const site=sites.find(s=>s.id===selection);
  const res=site&&riskSummary?.byId?.get(site.id);
  const bd=$('#radar-breakdown');
  if(res&&Number.isFinite(res.score)){
    const lvl=riskLevel(res.score,lang);
    const iucn=Number.isFinite(res.threatenedOccurrences)?` · ${new Intl.NumberFormat(locale()).format(res.threatenedOccurrences)} ${tx('IUCN','UICN')}`:'';
    $('#radar-legend-note').textContent=`${site.name}: ${res.score}/100 (${lvl.label}) · ${driverLabel(res.driver,lang)}${iucn}${liveTxt}`;
    if(bd){
      const rows=[
        [tx('Thermal','Térmico'),res.thermalRisk],
        [tx('Hydro','Hídrico'),res.hydroRisk],
        [tx('IUCN Bio','Bio UICN'),res.bioRisk]
      ].filter(([,val])=>Number.isFinite(val));
      bd.innerHTML=rows.map(([lbl,val])=>`<div class="rb-row"><span>${lbl}</span><div class="rb-track"><i style="width:${val}%;background:${riskColor(val).css}"></i></div><b>${val}</b></div>`).join('');
    }
  }else{
    $('#radar-legend-note').textContent=tx(`NASA POWER + GBIF IUCN + DEM${liveTxt}`,`NASA POWER + GBIF UICN + DEM${liveTxt}`);
    if(bd)bd.innerHTML='';
  }
  const fSum=$('#radar-formula-summary'),fBody=$('#radar-formula-body');
  if(fSum)fSum.textContent=tx('How it is calculated (0–100)','Cómo se calcula (0–100)');
  if(fBody)fBody.textContent=tx(
    'Risk = 0.65 × Climate (0.55×Thermal [0.80 NASA + 0.20 live] + 0.45×Hydro + coupling≤8) + 0.35 × IUCN Biodiversity (GBIF). Exploratory index; not official CNE/SINAC hazard maps.',
    'Riesgo = 0,65 × Clima (0,55×Térmico [0,80 NASA + 0,20 vivo] + 0,45×Hídrico + acople≤8) + 0,35 × Bio UICN (GBIF). Índice exploratorio; no sustituye mapas oficiales CNE/SINAC.'
  );
  const topEl=$('#radar-top5');
  if(topEl&&riskSummary){
    const top=topRiskCantons(riskSummary,sites,5);
    topEl.innerHTML=`<div class="rt-title">${tx('TOP 5 HIGHEST RISK','TOP 5 MAYOR RIESGO')}</div>`+
      top.map(({site:cs,risk})=>`<button type="button" class="rt-item ${cs.id===selection?'active':''}" data-site="${cs.id}"><span>${cs.name}</span><b style="color:${riskColor(risk.score).css}">${risk.score}</b></button>`).join('');
    topEl.querySelectorAll('.rt-item').forEach(btn=>{
      btn.onclick=()=>document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:btn.dataset.site}}));
    });
  }
}

const tmpColor=new THREE.Color();
function paintMeshes(){
  const site=sites.find(s=>s.id===selection);
  const isProvince=site?.type==='province';
  const light=getTheme()==='light';

  if(nationalLandMesh&&nationalSlices.length){
    const colAttr=nationalLandMesh.geometry.attributes.color;
    const arr=colAttr.array;
    for(const slice of nationalSlices){
      const selected=Boolean(site)&&(slice.id===selection||(isProvince&&slice.province===selection));
      const sameProvince=Boolean(site)&&slice.province===site.province;
      if(radarMode&&riskSummary){
        const res=riskSummary.byId.get(slice.id);
        tmpColor.setHex(riskColor(res?.score).hex);
        if(selected)tmpColor.offsetHSL(0,0,.08);
      }else if(light){
        tmpColor.setHex(selected?(isProvince?0x0b6e3b:0x0e77f0):sameProvince?0x118a55:0x1b6d52);
      }else{
        tmpColor.setHex(selected?(isProvince?0x245666:0x408da0):sameProvince?0x1f5562:0x153e4a);
      }
      for(let i=slice.startVertex;i<slice.startVertex+slice.vertexCount;i++){
        arr[i*3]=tmpColor.r;arr[i*3+1]=tmpColor.g;arr[i*3+2]=tmpColor.b;
      }
    }
    colAttr.needsUpdate=true;
  }

  const activeDetail=activeProvince?provinceDetailCache.get(activeProvince):null;
  const targetMeshes=activeDetail?activeDetail.meshes:meshes;
  if(radarMode&&riskSummary){
    updateRadarLegend();
    for(const mesh of targetMeshes){
      const selected=Boolean(site)&&(mesh.userData.id===selection||(isProvince&&mesh.userData.province===selection));
      const res=riskSummary.byId.get(mesh.userData.id);
      const rc=riskColor(res?.score);
      mesh.material.color.setHex(rc.hex);
      mesh.material.emissive?.setHex(rc.hex).multiplyScalar(selected?.38:.16);
      const riskLift=Number.isFinite(res?.score)?(res.score/100)*.05:0;
      mesh.userData.targetY=selected?(isProvince?.14:.22):(.02+riskLift);
    }
    invalidateScene();
    return;
  }

  updateRadarLegend();
  if(renderer?.shadowMap&&qualityManager.preset.shadows)renderer.shadowMap.needsUpdate=true;
  for(const mesh of targetMeshes){
    const selected=Boolean(site)&&(mesh.userData.id===selection||(isProvince&&mesh.userData.province===selection));
    const sameProvince=Boolean(site)&&mesh.userData.province===site.province;
    if(light){
      mesh.material.color.setHex(selected?(isProvince?0x0b6e3b:0x0e77f0):sameProvince?0x118a55:0x1b6d52);
      mesh.material.emissive?.setHex(selected?(isProvince?0x042915:0x062d5c):sameProvince?0x06311d:0x052418);
    }else{
      mesh.material.color.setHex(selected?(isProvince?0x245666:0x408da0):sameProvince?0x1f5562:0x153e4a);
      mesh.material.emissive?.setHex(selected?(isProvince?0x09232c:0x123f4a):sameProvince?0x0a2a33:0x04151c);
    }
    mesh.userData.targetY=selected?(isProvince?.1:.18):0;
  }
  invalidateScene();
}

function setRadarMode3d(enabled,{broadcast=true}={}){
  radarMode=Boolean(enabled);
  const btn=$('#radar-mode-3d');
  if(btn){btn.classList.toggle('chosen',radarMode);btn.setAttribute('aria-pressed',String(radarMode));}
  const regionActive=!orbital&&!radarMode&&!document.body.classList.contains('lab-open');
  $('#region-mode')?.classList.toggle('chosen',regionActive);
  $('#region-mode')?.setAttribute('aria-pressed',String(regionActive));
  if(radarMode&&orbital){introDone=true;document.body.classList.remove('intro-playing');mode(false);}
  paintMeshes();
  if(radarMode&&!liveTemps){
    fetchLiveRadarTemps().then(data=>{
      liveTemps=data.temps;liveAt=data.retrievedAt;
      if(sites.length&&annual)riskSummary=computeAllRisks({sites,annual,ecological,liveTemps});
      paintMeshes();
    }).catch(()=>{});
  }
  if(broadcast)document.dispatchEvent(new CustomEvent('gaiatrack:radar-mode',{detail:{enabled:radarMode}}));
}

$('#radar-mode-3d').onclick=()=>setRadarMode3d(!radarMode);
if(pendingLandingTarget){
  introDone=true;document.body.classList.remove('intro-playing');mode(false);
  if(pendingLandingTarget==='trends')$('#lab-mode')?.click();
  else if(pendingLandingTarget==='forecast')$('#forecast-mode')?.click();
  else if(pendingLandingTarget==='radar')setRadarMode3d(true);
  else returnToTerritory3d({resetCountry:false});
}
document.addEventListener('gaiatrack:radar-mode',e=>setRadarMode3d(e.detail?.enabled,{broadcast:false}));

const coords=(lon,lat)=>new THREE.Vector3((lon+84.2)*4.4,0,-(lat-9.75)*4.4);
function globe(lon,lat,r=4){const phi=lat*Math.PI/180,theta=lon*Math.PI/180;return new THREE.Vector3(r*Math.cos(phi)*Math.cos(theta),r*Math.sin(phi),-r*Math.cos(phi)*Math.sin(theta));}

function sync(detail){
  selection=detail.site;variable=detail.variable;year=detail.year;
  const hudSel=$('#hud-site-select');if(hudSel&&hudSel.value!==selection)hudSel.value=selection;
  const site=sites.find(s=>s.id===selection);
  if(!site){
    explorer?.sync(null);paintMeshes();
    for(const b of beacons){b.beacon.material.color.set(0x18d86b);b.beacon.scale.setScalar(1);b.ring.material.opacity=.65;b.pulse.visible=false;}
    invalidateScene();
    return;
  }
  if(!annual?.sites?.[selection])return;
  explorer?.sync(selection);
  const value=annualValue(annual,selection,variable,year);
  const units={T2M:'°C',T2M_MIN:'°C',T2M_MAX:'°C',PRECTOTCORR:tx('mm/yr','mm/año'),ALLSKY_SFC_SW_DWN:tx('MJ/m²/day','MJ/m²/día'),GWETTOP:tx('index 0–1','índice 0–1'),RH2M:'%'};
  $('#flight-place').textContent=site.name;
  $('#flight-coord').textContent=`${site.latitude.toFixed(3)}° N / ${Math.abs(site.longitude).toFixed(3)}° ${tx('W','O')}`;
  const fv=$('#flight-value');
  fv.textContent=Number.isFinite(value)?new Intl.NumberFormat(locale(),{maximumFractionDigits:variable==='GWETTOP'?2:1}).format(value):'—';
  fv.classList.remove('value-pop');void fv.offsetWidth;fv.classList.add('value-pop');
  $('#flight-unit').textContent=units[variable];
  $('#flight-variable').textContent=`${$('#metric-name').textContent} · ${tx('historical','histórico')} ${year}`;
  paintMeshes();
  for(const b of beacons){
    const active=b.id===selection,near=b.province===site.province;
    b.beacon.material.color.set(active?0x18d86b:0x14b8e6);
    b.beacon.scale.setScalar(active?1.35:near?1:.7);
    b.ring.visible=active||near;
    b.ring.material.opacity=active?.9:.35;
    b.pulse.visible=active;
  }
  invalidateScene();
}

document.addEventListener('gaiatrack:selection',e=>{
  if(e.detail?.site!==selection)selectedDistrict=null;
  sync(e.detail);
  populateDistricts(selection);
  updateSectorBeacons();
  updateDistrictBorders();
  document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:selection,district:selectedDistrict}}));
});

function applyHudLang(){
  host.setAttribute('aria-label',tx('3D exploration of Costa Rica','Exploración tridimensional de Costa Rica'));
  $('.flight-intro .eyebrow').textContent='GAIA E&B · ENVIRONMENT & BENEFITS / '+tx('COSTA RICA MISSION','MISIÓN COSTA RICA');
  $('.flight-intro h1').textContent=tx('Costa Rica, a living observatory.','Costa Rica, un observatorio vivo.');
  $('.flight-intro p').textContent=tx('Explore real NASA climate series, district terrain, and ecological signals across 7 provinces and 83 cantons.','Explora series reales de la NASA, relieve distrital y señales ecológicas en 7 provincias y 83 cantones.');
  $('.flight-kicker').innerHTML=`<span class="live-dot"></span> ${tx('SCIENTIFIC TELEMETRY','TELEMETRÍA CIENTÍFICA')}`;
  $('#flight-investigate').innerHTML=`${tx('Investigate this territory','Investigar este territorio')} ${icon('arrow-up-right')}`;
  $('#region-mode').innerHTML=`${icon('compass')} ${tx('3D Territory','Territorio 3D')}`;
  $('#radar-mode-3d').innerHTML=`${icon('shield-alert')} ${tx('Ecological Risk','Riesgo ecológico')}`;
  $('#lab-mode').innerHTML=`${icon('activity')} ${tx('Simulator','Simulador')}`;
  $('#forecast-mode').innerHTML=`${icon('cloud')} ${tx('7-Day Context','Contexto 7 días')}`;
  const guide=$('.flight-guidance span');if(guide)guide.textContent=tx('Drag to move · Right-drag to rotate · Scroll to zoom','Arrastra para mover · Clic derecho para girar · Rueda para zoom');
  const qLabel=$('#quality-label');if(qLabel)qLabel.textContent=tx('Quality:','Calidad:');
  if(qualitySelect){
    qualitySelect.setAttribute('aria-label',tx('Render quality','Calidad de renderizado'));
    const opts=qualitySelect.options;
    if(opts[0])opts[0].textContent=tx('Auto','Auto');
    if(opts[1])opts[1].textContent=tx('High','Alta');
    if(opts[2])opts[2].textContent=tx('Mid','Media');
    if(opts[3])opts[3].textContent=tx('Low','Baja');
  }
  $('#motion-toggle').innerHTML=moving?`${icon('pause')} ${tx('Ambient effects','Ambientación')}`:`${icon('play')} ${tx('Ambient effects','Ambientación')}`;
  const hudTheme=$('#hud-theme-toggle');
  if(hudTheme)hudTheme.innerHTML=`${icon(getTheme()==='light'?'moon':'sun')} ${getTheme()==='light'?tx('Dark','Oscuro'):tx('Light','Claro')}`;
  $('#fullscreen-mode').innerHTML=`${icon('maximize')} ${tx('Fullscreen','Pantalla completa')}`;
  $('#flight-label').textContent=orbital?tx('COSTA RICA / ORBITAL DESCENT','COSTA RICA / DESCENSO ORBITAL'):tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');
  $('.scene-disclaimer').textContent=tx('Weather indicators driven by model data at reference points · not radar or satellite imagery','Indicadores meteorológicos según datos del modelo en puntos de referencia · no son radar ni imagen satelital');
  $('#camera-mode').innerHTML=cameraControls?.mode==='rotate'?`${icon('rotate-cw')} ${tx('Rotate','Girar')}`:`${icon('move')} ${tx('Move','Mover')}`;
  $('#camera-reset').innerHTML=`${icon('crosshair')} ${tx('Center','Centrar')}`;
  $('#close-lab').innerHTML=`${icon('arrow-left')} ${tx('Back to 3D exploration','Volver a la exploración 3D')}`;
  if(qualityManager.active==='low'||webglUnavailable)show2dOffer({webglFailed:webglUnavailable});
  const hudSel=$('#hud-site-select');
  if(hudSel&&sites.length){
    hudSel.innerHTML=siteOptionsHtml(territoryManifest,getLang());
    hudSel.value=selection;
  }
}

document.addEventListener('gaiatrack:lang',()=>{applyHudLang();sync({site:selection,variable,year});explorer?.render();invalidateScene();});

async function init(){
  try{
    const responses=await Promise.all([
      loadStaticJSON('data/cantons-overview.geojson?v=1').catch(()=>loadStaticJSON('data/cantons.geojson?v=18')),
      loadStaticJSON('data/manifest.json?v=18'),
      loadStaticJSON('data/world.geojson'),
      loadStaticJSON('data/costa-rica-provinces.geojson?v=16'),
      loadStaticJSON('data/annual.json?v=18')
    ]);
    overviewGeo=responses[0];
    geo=overviewGeo;
    sites=responses[1].sites;
    annual=responses[4];
    territoryManifest=responses[1];
    ecological=await loadStaticJSON('data/ecological.json?v=1').catch(()=>null);
    riskSummary=computeAllRisks({sites,annual,ecological});
    registerTerritories(sites);
    territoryPicker=createTerritoryPicker(overviewGeo,coords);

    const hudSel=$('#hud-site-select');
    if(hudSel){
      hudSel.innerHTML=siteOptionsHtml(responses[1],getLang());
      hudSel.value=selection||'';
      hudSel.onchange=e=>{if(e.target.value)document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:e.target.value}}));};
    }

    const preset=qualityManager.preset;
    scene=new THREE.Scene();
    scene.fog=new THREE.FogExp2(0x051122,.0045);
    camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,200);
    renderer=new THREE.WebGLRenderer({antialias:preset.antialias,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,preset.maxPixelRatio));
    renderer.setSize(innerWidth,innerHeight);
    renderer.setClearColor(0x051020,1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=preset.toneMapping?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
    renderer.toneMappingExposure=1.2;
    renderer.shadowMap.enabled=Boolean(preset.shadows);
    renderer.shadowMap.autoUpdate=false;
    renderer.shadowMap.needsUpdate=Boolean(preset.shadows);
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    $('#world-canvas').append(renderer.domElement);
    renderer.domElement.setAttribute('aria-label','Escena 3D: Costa Rica y sus provincias. Usá el selector de territorio del explorador para acceso por teclado.');
    renderer.domElement.addEventListener('webglcontextlost',e=>{
      e.preventDefault();
      loop?.dispose?.();
      show2dOffer({webglFailed:true});
    });

    scene.add(new THREE.AmbientLight(0x749fd1,.68));
    const key=new THREE.DirectionalLight(0xd9f7e8,3);
    key.name='key-light';
    key.position.set(4,12,5);
    key.castShadow=Boolean(preset.shadows);
    key.shadow.mapSize.set(512,512);
    key.shadow.camera.left=-16;key.shadow.camera.right=16;key.shadow.camera.top=16;key.shadow.camera.bottom=-16;
    key.shadow.bias=-.0005;
    scene.add(key);

    const rim=new THREE.PointLight(0x0e77f0,70);
    rim.position.set(-6,3,-4);
    scene.add(rim);

    root=new THREE.Group();
    scene.add(root);

    const provinceLine=new THREE.LineBasicMaterial({color:0x14c5e8,transparent:true,opacity:.85});
    const provBorderSegs=new Map();
    for(const f of responses[3].features){
      const pid=f.properties.id;
      if(!provBorderSegs.has(pid))provBorderSegs.set(pid,[]);
      const arr=provBorderSegs.get(pid);
      const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      for(const rings of polys){
        if(!rings[0]||rings[0].length<3)continue;
        const ring=rings[0];
        for(let i=0;i<ring.length-1;i++){
          const a=coords(ring[i][0],ring[i][1]),b=coords(ring[i+1][0],ring[i+1][1]);
          arr.push(a.x,.3,a.z,b.x,.3,b.z);
        }
      }
    }
    for(const [pid,pts] of provBorderSegs){
      if(!pts.length)continue;
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
      const line=new THREE.LineSegments(g,provinceLine);
      line.userData.province=pid;
      provinceBorders.push(line);
      root.add(line);
    }

    // Build light overview meshes in memory for weather domain clipping + merged national land mesh (1 draw call).
    const dummyMat=new THREE.MeshBasicMaterial();
    for(const f of overviewGeo.features){
      const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      for(const rings of polys){
        if(!rings[0]||rings[0].length<3)continue;
        const geometry=buildFeatureExtrusionGeometry(rings,{bevel:false});
        const m=new THREE.Mesh(geometry,dummyMat);
        m.userData={id:f.properties.id,name:f.properties.name,province:f.properties.province,targetY:0};
        meshes.push(m);
      }
    }

    nationalGroup=new THREE.Group();
    nationalGroup.name='national-overview';
    root.add(nationalGroup);

    const merged=mergeNationalExtrusions(overviewGeo.features);
    nationalSlices=merged.slices;
    nationalLandMesh=new THREE.Mesh(merged.geometry,surfaceMaterial({vertexColors:true,styled:qualityManager.active!=='low'}));
    nationalLandMesh.castShadow=Boolean(preset.shadows);
    nationalLandMesh.receiveShadow=Boolean(preset.shadows);
    nationalGroup.add(nationalLandMesh);

    const nationalOutlineMat=new THREE.LineBasicMaterial({color:0x2299d4,transparent:true,opacity:.55});
    nationalOutlineLines=new THREE.LineSegments(buildFeatureOutlineSegments(overviewGeo.features,.285),nationalOutlineMat);
    nationalGroup.add(nationalOutlineLines);

    detailGroup=new THREE.Group();
    detailGroup.name='province-detail';
    detailGroup.visible=false;
    root.add(detailGroup);

    // Share geometries across all 90 territorial beacons.
    const sphereProvGeo=new THREE.SphereGeometry(.034,10,10);
    const sphereCantonGeo=new THREE.SphereGeometry(.02,8,8);
    const beaconRingGeo=new THREE.RingGeometry(.09,.108,24);
    const beaconPulseGeo=new THREE.RingGeometry(.11,.135,24);

    for(const s of sites){
      const province=s.type==='province';
      const point=coords(s.longitude,s.latitude);point.y=.36;
      const beacon=new THREE.Mesh(province?sphereProvGeo:sphereCantonGeo,new THREE.MeshBasicMaterial({color:0x18d86b}));
      beacon.position.copy(point);root.add(beacon);
      const ring=new THREE.Mesh(beaconRingGeo,new THREE.MeshBasicMaterial({color:0x18d86b,side:THREE.DoubleSide,transparent:true,opacity:.65}));
      ring.rotation.x=-Math.PI/2;ring.position.copy(point);ring.position.y=.32;root.add(ring);
      const pulse=new THREE.Mesh(beaconPulseGeo,new THREE.MeshBasicMaterial({color:0x14b8e6,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));
      pulse.rotation.x=-Math.PI/2;pulse.position.copy(point);pulse.position.y=.325;pulse.visible=false;root.add(pulse);
      beacons.push({id:s.id,province:s.province,beacon,ring,pulse,baseY:.36});
    }

    const sectorsMap=await loadStaticJSON('data/sectors.json?v=2').catch(()=>({}));
    sectorsCatalog=sectorsMap||{};
    simulator=createSimulator({sites,annual,sectorsCatalog,onSelectTerritory:(siteId,distId)=>{
      if(siteId&&siteId!==selection){document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:siteId}}));}
      if(distId!==undefined&&distId!==selectedDistrict){
        selectedDistrict=distId;
        const hd=$('#hud-district-select');if(hd)hd.value=distId||'';
        updateSectorBeacons();updateDistrictBorders();
        document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:siteId||selection,district:selectedDistrict}}));
      }
    }});

    districtBordersMap=await loadStaticJSON('data/district-borders.json?v=1').catch(()=>({}));
    districtLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x38bdf8,transparent:true,opacity:.45}));
    districtLines.name='district-borders';districtLines.frustumCulled=false;districtLines.visible=false;root.add(districtLines);
    activeDistrictLine=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xf5b316,transparent:true,opacity:.95}));
    activeDistrictLine.name='active-district-border';activeDistrictLine.frustumCulled=false;activeDistrictLine.visible=false;root.add(activeDistrictLine);

    const hudDist=$('#hud-district-select');
    if(hudDist)hudDist.onchange=()=>{
      selectedDistrict=hudDist.value||null;
      updateSectorBeacons();
      updateDistrictBorders();
      document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:selection,district:selectedDistrict}}));
      const dObj=(sectorsCatalog[selection]||[]).find(d=>d.id===selectedDistrict);
      if(dObj){
        $('#flight-place').textContent=dObj.name;
        $('#flight-coord').textContent=`${dObj.latitude.toFixed(3)}° N / ${Math.abs(dObj.longitude).toFixed(3)}° ${tx('W','O')}`;
        document.dispatchEvent(new CustomEvent('gaiatrack:focuspoint',{detail:dObj}));
      }else{
        const sObj=sites.find(s=>s.id===selection);
        if(sObj){
          $('#flight-place').textContent=sObj.name;
          $('#flight-coord').textContent=`${sObj.latitude.toFixed(3)}° N / ${Math.abs(sObj.longitude).toFixed(3)}° ${tx('W','O')}`;
          explorer?.focus();
        }
      }
    };

    const siteProv=new Map(sites.map(s=>[s.id,s.province]));
    sectorPoints=[];
    for(const [parent,list] of Object.entries(sectorsMap||{})){
      const prov=siteProv.get(parent);if(!prov||!Array.isArray(list))continue;
      for(const item of list){const pt=coords(item.longitude,item.latitude);sectorPoints.push({id:item.id,parent,province:prov,x:pt.x,z:pt.z});}
    }
    if(sectorPoints.length){
      sectorDots=new THREE.InstancedMesh(new THREE.SphereGeometry(.013,8,8),new THREE.MeshBasicMaterial({color:0xffffff}),sectorPoints.length);
      sectorDots.name='sector-beacons';sectorDots.frustumCulled=false;sectorDots.count=0;sectorDots.visible=false;root.add(sectorDots);
      sectorRings=new THREE.InstancedMesh(new THREE.RingGeometry(.042,.054,16),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.6}),sectorPoints.length);
      sectorRings.name='sector-rings';sectorRings.frustumCulled=false;sectorRings.count=0;sectorRings.visible=false;root.add(sectorRings);
    }

    const grid=new THREE.GridHelper(35,55,0x1d4b75,0x0c2440);grid.position.y=-.35;grid.material.transparent=true;grid.material.opacity=.1;root.add(grid);
    for(const radius of [5,7,9]){
      const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.009,96),new THREE.MeshBasicMaterial({color:0x14b8e6,side:THREE.DoubleSide,transparent:true,opacity:.14}));
      ring.rotation.x=-Math.PI/2;ring.position.y=-.3;root.add(ring);
    }

    const showOrbital=orbital&&!introDone;
    planet=new THREE.Group();planet.visible=showOrbital;root.visible=!showOrbital;scene.add(planet);
    const globeMat=new THREE.MeshLambertMaterial({color:0x081e3d,transparent:true,opacity:1});
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(3.98,48,36),globeMat));
    const atmoMat=new THREE.MeshBasicMaterial({color:0x14b8e6,wireframe:true,transparent:true,opacity:.065});
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(4.1,32,24),atmoMat));
    const countryMat=new THREE.LineBasicMaterial({color:0x19a6e8,transparent:true,opacity:.78});
    for(const f of responses[2].features){
      const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      for(const poly of polys){
        const points=poly[0].map(([lon,lat])=>globe(lon,lat));
        planet.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),countryMat));
      }
    }
    const pinMat=new THREE.MeshBasicMaterial({color:0x18d86b,transparent:true,opacity:1});
    const pin=new THREE.Mesh(new THREE.SphereGeometry(.065,12,12),pinMat);
    pin.position.copy(globe(-84.12,10.4,4.05));planet.add(pin);
    const pinRingMat=new THREE.MeshBasicMaterial({color:0xf5b316,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false});
    pinRing=new THREE.Mesh(new THREE.RingGeometry(.11,.15,24),pinRingMat);
    pinRing.position.copy(globe(-84.12,10.4,4.07));pinRing.lookAt(pinRing.position.clone().multiplyScalar(2));planet.add(pinRing);
    planetFades=[[globeMat,1],[atmoMat,.065],[countryMat,.78],[pinMat,1],[pinRingMat,.85]];

    const starPositions=[];
    for(let i=0;i<700;i++){const a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),r=38+Math.random()*32;starPositions.push(r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a));}
    const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
    starPoints=new THREE.Points(stars,new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{opacity:{value:.62},pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:`uniform float pixelRatio;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp((110.0/-mv.z)*pixelRatio,1.2,3.4);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float opacity;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=smoothstep(1.0,.05,d);if(a<.02||opacity<.01)discard;gl_FragColor=vec4(.64,.80,.90,a*opacity);}`}));
    scene.add(starPoints);

    const art=addSceneAtmosphere(scene,root);

    const applySceneTheme=(theme=getTheme())=>{
      const light=theme==='light';
      renderer?.setClearColor(light?0xedf6f1:0x051020,1);
      if(scene?.fog)scene.fog.color.setHex(light?0xedf6f1:0x051122);
      provinceLine.color.setHex(light?0x0e77f0:0x14c5e8);
      nationalOutlineMat.color.setHex(light?0x0e77f0:0x2299d4);
      for(const entry of provinceDetailCache.values())entry.outlineLine.material.color.setHex(light?0x0e77f0:0x2299d4);
      globeMat.color.setHex(light?0xd8ece4:0x081e3d);
      countryMat.color.setHex(light?0x0e77f0:0x19a6e8);
      atmoMat.color.setHex(light?0x0b6e3b:0x14b8e6);
      root?.children?.forEach(child=>{
        const u=child?.material?.uniforms;
        if(u?.innerColor&&u?.outerColor){
          u.innerColor.value.setHex(light?0xf4faf7:0x071929);
          u.outerColor.value.setHex(light?0xe3f0ea:0x040d18);
        }
      });
      paintMeshes();
    };
    applySceneTheme();
    document.addEventListener('gaiatrack:theme',e=>applySceneTheme(e.detail?.theme));

    weather=createWeatherExperience({root,meshes,light:key,coords,sites});
    weather.setQuality(preset);
    weather.onActivityChange(()=>{invalidateScene();loop?.sync?.();});

    explorer=createProvinceExplorer({
      host,manifest:territoryManifest,geo:overviewGeo,meshes,beacons,borders:provinceBorders,root,camera,coords,initial:selection,
      onSelect:id=>document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:id}})),
      onFocus:bounds=>{
        if(!introDone)return;
        mode(false);
        if(bounds){
          const a=coords(bounds.west,bounds.south),b=coords(bounds.east,bounds.north);
          targetFocus.set((a.x+b.x)/2,.4,(a.z+b.z)/2);
          const narrow=innerWidth<700;
          const usableWidth=narrow?innerWidth*.90:Math.max(innerWidth*.35,innerWidth-650);
          const usableHeight=narrow?innerHeight*.30:innerHeight*.68;
          const tan=Math.tan(camera.fov*Math.PI/360);
          targetDistance=Math.max(3.4,Math.max(Math.abs(b.x-a.x)/(usableWidth/innerHeight),Math.abs(b.z-a.z)*innerHeight/usableHeight)/(2*tan)*1.18+1);
          targetPitch=1.08;targetYaw=.08;if(narrow)targetFocus.z+=targetDistance*.14;
        }else{targetFocus.set(0,0,0);targetDistance=16.5;targetPitch=.8;targetYaw=.22;}
        if(reducedMotionQuery.matches){focus.copy(targetFocus);distance=targetDistance;pitch=targetPitch;yaw=targetYaw;}
        invalidateScene();
      }
    });

    // Top-plane intersection + bbox-prefiltered 2D point-in-polygon selection (max once per frame, never while dragging).
    const canvas=renderer.domElement,pointerRay=new THREE.Raycaster(),pointerVec=new THREE.Vector2();
    const topPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.26),pickPoint=new THREE.Vector3();
    canvas.setAttribute('aria-label',tx('Interactive map: drag to move, right-drag to rotate, scroll to zoom; arrow keys to move, R to center.','Mapa interactivo: arrastrá para mover, botón derecho para girar y rueda para zoom; flechas para mover y R para centrar.'));
    cameraControls=createMapCamera({canvas,
      getState:()=>({focus:targetFocus.clone(),distance:targetDistance,pitch:targetPitch,yaw:targetYaw,fov:camera.fov}),
      onChange:patch=>{
        if(patch.focus)targetFocus.set(patch.focus.x,patch.focus.y,patch.focus.z);
        if(patch.distance!=null)targetDistance=patch.distance;
        if(patch.pitch!=null)targetPitch=patch.pitch;
        if(patch.yaw!=null)targetYaw=patch.yaw;
        invalidateScene();
      },
      onStart:()=>{
        if(!introDone){introDone=true;document.body.classList.remove('intro-playing');mode(false);}
        invalidateScene();
      },
      onPick:e=>{
        if(orbital||cameraControls?.interacting)return;
        if(lastPickTick===renderTick)return;
        lastPickTick=renderTick;
        const r=canvas.getBoundingClientRect();
        pointerVec.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
        pointerRay.setFromCamera(pointerVec,camera);
        if(!pointerRay.ray.intersectPlane(topPlane,pickPoint))return;
        root.worldToLocal(pickPoint);
        const hit=territoryPicker?.pickAt(pickPoint.x,pickPoint.z,activeProvince);
        if(hit)explorer.selectMesh({userData:hit});
      },
      onRecenter:()=>explorer?.focus(),
      onModeChange:m=>{$('#camera-mode').innerHTML=m==='rotate'?`${icon('rotate-cw')} ${tx('Rotate','Girar')}`:`${icon('move')} ${tx('Move','Mover')}`;$('#camera-mode').setAttribute('aria-pressed',String(m==='rotate'));}
    });

    window.addEventListener('resize',()=>{
      camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
      if(starPoints?.material?.uniforms?.pixelRatio)starPoints.material.uniforms.pixelRatio.value=renderer.getPixelRatio();
      explorer?.focus();
      invalidateScene();
    });

    $('#scene-loading').hidden=true;
    sync({site:selection,variable,year});
    if(introDone||!orbital){mode(false);explorer?.focus();explorer?.render();}
    weather.refresh();
    if(qualityManager.active==='low')show2dOffer({webglFailed:false});

    let dbgFrames=0,dbgLastReport=performance.now(),dbgFps=0;

    function isSceneRenderAllowed(){
      return !document.hidden
        &&!document.body.classList.contains('lab-open')
        &&!document.body.classList.contains('landing-open');
    }

    function hasCameraSettling(){
      return Math.abs(targetYaw-yaw)>1e-4
        ||Math.abs(targetPitch-pitch)>1e-4
        ||Math.abs(targetDistance-distance)>1e-4
        ||focus.distanceToSquared(targetFocus)>1e-6;
    }

    function hasMeshLiftSettling(){
      const activeDetail=activeProvince?provinceDetailCache.get(activeProvince):null;
      if(!activeDetail)return false;
      for(const m of activeDetail.meshes){
        if(Math.abs((m.userData.targetY||0)-m.position.y)>1e-4)return true;
      }
      return false;
    }

    function hasAmbientActivity(){
      if(reducedMotionQuery.matches)return false;
      if(moving&&(weather?.isAnimating?.()||orbital||Boolean(selection)))return true;
      return Boolean(weather?.isAnimating?.());
    }

    function shouldContinueLoop(){
      return sceneDirty||!introDone||hasCameraSettling()||hasMeshLiftSettling()||hasAmbientActivity();
    }

    function frame(time){
      if(!isSceneRenderAllowed())return;
      const ambient=hasAmbientActivity();
      if(ambient&&time-lastFrame<33)return;
      const tStart=performance.now();
      lastFrame=time;
      renderTick++;

      if(!introDone){
        if(introStart===null)introStart=time;
        const elapsed=(time-introStart)/1000;
        if(elapsed<.4){
          distance=targetDistance=12.5;pitch=targetPitch=.1815;yaw=targetYaw=.1026;planet.scale.setScalar(1);
        }else if(elapsed<2.0){
          const t=(elapsed-.4)/1.6,ease=t*t*(3-2*t);
          planet.scale.setScalar(1);distance=targetDistance=12.5-ease*7.5;pitch=targetPitch=.1815;yaw=targetYaw=.1026;
        }else if(elapsed<2.9){
          const t=(elapsed-2.0)/.9,ease=1-Math.pow(1-t,3);
          orbital=false;root.visible=true;root.scale.setScalar(.3+ease*.7);
          const fade=Math.max(0,1-t*2.2);planet.visible=fade>0;
          for(const [m,base] of planetFades)m.opacity=base*fade;
          if(!selection){distance=targetDistance=16.5;pitch=targetPitch=.8;yaw=targetYaw=.22;$('#flight-label').textContent=tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');}
        }else{
          introDone=true;document.body.classList.remove('intro-playing');orbital=false;planet.visible=false;root.visible=true;root.scale.setScalar(1);
          if(!selection){distance=targetDistance=16.5;pitch=targetPitch=.8;yaw=targetYaw=.22;$('#flight-label').textContent=tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');}
          explorer?.focus();explorer?.render();
        }
      }

      if(starPoints){
        const targetStarOpacity=orbital?.62:0;
        const u=starPoints.material.uniforms.opacity;
        u.value+=(targetStarOpacity-u.value)*.12;
        starPoints.visible=u.value>.01;
        if(moving&&!reducedMotionQuery.matches&&!cameraControls?.interacting&&starPoints.visible)starPoints.rotation.y+=.00004;
      }

      const snap=reducedMotionQuery.matches;
      const response=snap?1:(cameraControls?.interacting?.4:.14);
      yaw+=(targetYaw-yaw)*response;
      pitch+=(targetPitch-pitch)*response;
      distance+=(targetDistance-distance)*response;
      focus.lerp(targetFocus,response);
      if(Math.abs(targetYaw-yaw)<1e-4)yaw=targetYaw;
      if(Math.abs(targetPitch-pitch)<1e-4)pitch=targetPitch;
      if(Math.abs(targetDistance-distance)<1e-4)distance=targetDistance;
      if(focus.distanceToSquared(targetFocus)<1e-6)focus.copy(targetFocus);

      const activeDetail=activeProvince?provinceDetailCache.get(activeProvince):null;
      const animMeshes=activeDetail?activeDetail.meshes:null;
      if(animMeshes){
        for(const mesh of animMeshes){
          const targetY=mesh.userData.targetY||0;
          mesh.position.y=snap?targetY:mesh.position.y+(targetY-mesh.position.y)*.12;
          if(Math.abs(targetY-mesh.position.y)<1e-4)mesh.position.y=targetY;
        }
      }
      if(districtLines?.visible&&animMeshes){
        const selMesh=animMeshes.find(m=>m.userData.id===selection);
        const dy=selMesh?selMesh.position.y:0;
        districtLines.position.y=dy;
        if(activeDistrictLine)activeDistrictLine.position.y=dy+.002;
      }

      if(moving&&!reducedMotionQuery.matches){
        const wave=(time*.0012)%1;
        for(const b of beacons){
          const active=b.id===selection;
          if(!b.beacon.visible)continue;
          b.beacon.position.y=(active?.54:b.baseY)+Math.sin(time*.003+(active?0:1))*.015;
          b.ring.position.y=active?.50:.32;
          if(active){b.pulse.position.y=.505;const s=1+wave*2.1;b.pulse.scale.set(s,s,1);b.pulse.material.opacity=(1-wave)*.65;}
        }
        if(pinRing&&planet.visible){
          const ps=1+((time*.001)%1)*1.8;
          pinRing.scale.set(ps,ps,1);
          pinRing.material.opacity=(1-((time*.001)%1))*.8;
        }
      }

      camera.position.set(
        focus.x+Math.sin(yaw)*Math.cos(pitch)*distance,
        focus.y+Math.sin(pitch)*distance,
        focus.z+Math.cos(yaw)*Math.cos(pitch)*distance
      );
      camera.lookAt(focus);
      camera.updateMatrixWorld();

      weather.animate(time);
      art.animate(time,moving&&!reducedMotionQuery.matches);
      explorer?.updateLabels();
      renderer.render(scene,camera);
      sceneDirty=false;

      const cpuMs=performance.now()-tStart;
      qualityManager.recordFrameTime(cpuMs);

      if(debugEl){
        dbgFrames++;
        const now=performance.now();
        if(now-dbgLastReport>=400){
          dbgFps=Math.round((dbgFrames*1000)/(now-dbgLastReport));
          dbgFrames=0;
          dbgLastReport=now;
        }
        const stats={
          fps:dbgFps,
          calls:renderer.info.render.calls,
          triangles:renderer.info.render.triangles,
          geometries:renderer.info.memory.geometries,
          programs:renderer.info.programs?.length??0,
          cpuMs:+cpuMs.toFixed(2),
          dpr:+renderer.getPixelRatio().toFixed(2),
          quality:qualityManager.active,
          mode:qualityManager.mode,
          landing:document.body.classList.contains('landing-open')
        };
        globalThis.__gaiaDebug=stats;
        debugEl.textContent=`FPS: ${stats.fps}\nCalls: ${stats.calls}\nTriangles: ${stats.triangles}\nFrame CPU: ${stats.cpuMs} ms\nGeometries: ${stats.geometries} · DPR: ${stats.dpr}\nQuality: ${stats.quality} (${stats.mode})`;
      }
    }

    loop=createRenderLoop(frame,{
      isActive:isSceneRenderAllowed,
      shouldContinue:shouldContinueLoop
    });
    const observer=new MutationObserver(()=>{
      if(!document.body.classList.contains('landing-open'))invalidateScene();
      loop.sync();
    });
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidateScene();loop.sync();});
    reducedMotionQuery.addEventListener?.('change',()=>{
      if(reducedMotionQuery.matches){
        moving=false;
        introDone=true;
        document.body.classList.remove('intro-playing');
        mode(false);
        qualityManager.setMode('low');
      }
      invalidateScene();
      loop.sync();
    });
    loop.sync();
  }catch(e){
    console.error(e);
    $('#scene-loading').textContent=tx('3D engine unavailable on this device. Open the 2D Explorer (#explorador) or Simulator.','El motor 3D no está disponible en este dispositivo. Usá el explorador 2D (#explorador) o el Simulador.');
    show2dOffer({webglFailed:true});
  }
}

init();
