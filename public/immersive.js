import {createRenderLoop} from './render-loop.js';
import {attachMovablePanel} from './movable-panels.js';
import {loadStaticJSON} from './data-client.js';
import {createMapCamera} from './map-camera.js';
import {createProvinceExplorer} from './province-explorer.js';
import {surfaceMaterial,addSceneAtmosphere} from './scene-art.js';
import {createWeatherExperience} from './weather-experience.js';
import * as THREE from './vendor/three.module.js';
import {siteOptionsHtml,annualValue} from './territories.js';
import {registerTerritories} from './recommendations.js';
import {getLang,getTheme,locale,setLang,tx} from './i18n.js';
import {createSimulator} from './simulator.js';
import {computeAllRisks,driverLabel,fetchLiveRadarTemps,riskColor,riskLevel,topRiskCantons,RISK_GRADIENT_CSS} from './ecological-risk.js';
const host=document.createElement('section');host.id='immersive';host.setAttribute('aria-label',tx('3D exploration of Costa Rica','Exploración tridimensional de Costa Rica'));host.innerHTML=`<div id="world-canvas"></div><div class="scene-vignette"></div><div class="flight-intro"><span class="eyebrow">GAIA E&amp;B · ENVIRONMENT &amp; BENEFITS / ${tx('COSTA RICA MISSION','MISIÓN COSTA RICA')}</span><h1>Costa Rica,<br><em>${tx('a living world.','un mundo vivo.')}</em></h1><p>${tx('AN OBSERVATORY TO EXPLORE<br>Weather, territory &amp; signals of change.','UN OBSERVATORIO PARA EXPLORAR<br>Tiempo, territorio y señales de cambio.')}</p></div><aside class="flight-panel"><div class="flight-kicker"><span class="live-dot"></span> ${tx('SCIENTIFIC TELEMETRY','TELEMETRÍA CIENTÍFICA')}</div><label class="territory-field-label" for="hud-province-select">01 / Provincia</label><select id="hud-province-select" class="hud-select" aria-label="Seleccionar provincia"></select><label class="territory-field-label" for="hud-site-select">02 / Cantón</label><select id="hud-site-select" class="hud-select" aria-label="${tx('Select province or canton','Seleccionar provincia o cantón')}"></select><label class="territory-field-label" for="hud-district-select" id="hud-district-label" hidden>03 / Distrito</label><select id="hud-district-select" class="hud-select" aria-label="${tx('Select district','Seleccionar distrito')}" hidden></select><h2 id="flight-place">${tx('Choose a province','Elegí una provincia')}</h2><span id="flight-coord" class="mono"></span><div class="flight-reading"><strong id="flight-value">—</strong><span id="flight-unit">°C</span></div><p id="flight-variable">${tx('Mean temperature · historical 2025','Temperatura media · histórico 2025')}</p><div class="flight-rule"></div><p class="flight-source">${tx('REAL DATA / NASA POWER<br><span>One reference point per territory.<br>Select a province or canton to investigate.</span>','DATOS REALES / NASA POWER<br><span>Un punto de referencia por territorio.<br>Seleccioná una provincia o cantón para investigar.</span>')}</p><p class="source-integrity"></p><button id="flight-investigate">${tx('Investigate this territory','Investigar este territorio')} <span>↗</span></button></aside><div class="flight-bottom"><div class="flight-controls"><button id="region-mode" type="button" class="chosen" aria-pressed="true">${tx('⌖ 3D Territory','⌖ Territorio 3D')}</button><button id="radar-mode-3d" type="button" aria-pressed="false">${tx('🌿 Ecological Risk','🌿 Riesgo ecológico')}</button><button id="lab-mode">${tx('≋ Simulator','≋ Simulador')}</button><button id="forecast-mode">${tx('↗ 7-Day Context','↗ Contexto 7 días')}</button></div></div><div id="flight-label">${tx('COSTA RICA / ORBITAL DESCENT','COSTA RICA / DESCENSO ORBITAL')}</div><div id="hud-radar-legend" hidden><div class="radar-legend-head"><strong id="radar-legend-title"></strong><span id="radar-legend-range"></span></div><div class="radar-legend-bar"></div><small id="radar-legend-note"></small><div id="radar-breakdown"></div><div id="radar-top5"></div></div><span class="scene-disclaimer">${tx('Weather indicators driven by model data at reference points · not radar or satellite imagery','Indicadores meteorológicos según datos del modelo en puntos de referencia · no son radar ni imagen satelital')}</span><button id="close-lab" hidden>${tx('← Back to 3D exploration','← Volver a la exploración 3D')}</button><p id="scene-loading" role="status">${tx('Initializing 3D territory…','Inicializando territorio 3D…')}</p>`;document.body.append(host);const pendingLandingTarget=document.body.getAttribute('data-landing-entered')||(typeof location!=='undefined'?new URLSearchParams(location.search).get('view'):'');document.body.classList.add('immersive-mode','national-view');if(!pendingLandingTarget)document.body.classList.add('intro-playing');
const telemetryPanel=host.querySelector('.flight-panel');
telemetryPanel.prepend(attachMovablePanel(telemetryPanel,{id:'conditions',english:'Conditions',spanish:'Condiciones',parent:host}));
const $=s=>document.querySelector(s);let explorer,cameraControls,radarMode=false,ecological=null,riskSummary=null,liveTemps=null,liveAt=null;const provinceBorders=[];let renderer,scene,camera,root,planet,planetFades=[],meshes=[],beacons=[],sectorsCatalog={},simulator=null,districtBordersMap={},districtLines=null,activeDistrictLine=null,selectedDistrict=null,starPoints,pinRing,selection=null,sites=[],annual,territoryManifest,geo,variable='T2M',year=2025,orbital=true,introStart=null,introDone=false,moving=!matchMedia('(prefers-reduced-motion: reduce)').matches,dragging=false,travel=0,yaw=.1026,pitch=.1815,distance=13.5,targetYaw=.1026,targetPitch=.1815,targetDistance=13.5,previous=[0,0],lastFrame=0;
function buildBorderPositions(entries){
  let count=0;for(const d of entries)for(const r of d.rings)if(r.length>1)count+=r.length-1;
  const arr=new Float32Array(count*6);let off=0;
  for(const d of entries)for(const r of d.rings)for(let i=0;i<r.length-1;i++){
    const a=coords(r[i][0],r[i][1]),b=coords(r[i+1][0],r[i+1][1]);
    arr[off++]=a.x;arr[off++]=.294;arr[off++]=a.z;
    arr[off++]=b.x;arr[off++]=.294;arr[off++]=b.z;
  }
  return arr;
}
function updateDistrictBorders(){
  if(!districtLines||!activeDistrictLine)return;
  const site=sites.find(s=>s.id===selection);
  const list=site?.type==='canton'?districtBordersMap[selection]:null;
  if(!list?.length){districtLines.visible=false;activeDistrictLine.visible=false;return;}
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
}
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
const focus=new THREE.Vector3(),targetFocus=new THREE.Vector3();document.addEventListener('gaiatrack:focuspoint',e=>{introDone=true;document.body.classList.remove('intro-playing');mode(false);const p=coords(e.detail.longitude,e.detail.latitude);targetFocus.set(p.x,.6,p.z);targetDistance=6.8;});
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
function panel(anchor){document.body.classList.add('lab-open');$('#close-lab').hidden=false;syncNav(anchor);document.dispatchEvent(new CustomEvent('gaiatrack:view',{detail:{view:({'#tendencias':'trends','#explorador':'explorer','#pronostico':'forecast','#tiempo-actual':'current'})[anchor]??'trends'}}));requestAnimationFrame(()=>{document.querySelector(anchor)?.scrollIntoView({behavior:'instant'});window.dispatchEvent(new Event('resize'));syncNav(anchor);});}
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
}
document.addEventListener('gaiatrack:assistant-view',event=>{
  if(event.detail.view==='3d'){close();return;}
  const anchors={trends:'#tendencias',explorer:'#explorador',forecast:'#pronostico',current:'#tiempo-actual'};
  if(anchors[event.detail.view])panel(anchors[event.detail.view]);
});
$('#close-lab').onclick=close;$('#forecast-mode').onclick=()=>panel('#pronostico');$('#lab-mode').onclick=()=>{if(simulator)simulator.open({site:selection,district:selectedDistrict});else panel('#tendencias');};$('#flight-investigate').onclick=()=>panel('#tendencias');document.querySelectorAll('.topbar nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();panel(a.getAttribute('href'));}));$('.brand')?.addEventListener('click',e=>{
  e.preventDefault();
  if($('#method-dialog')?.open)$('#method-dialog').close();
  if(document.body.classList.contains('clean-cockpit'))$('#weather-clean-view')?.click();
  returnToTerritory3d({resetCountry:true});
});$('.inspector-cta')?.addEventListener('click',e=>{e.preventDefault();panel('#tendencias');});const onNavScroll=()=>{if(document.body.classList.contains('lab-open'))syncNav();};window.addEventListener('scroll',onNavScroll,{passive:true});document.querySelector('main')?.addEventListener('scroll',onNavScroll,{passive:true});syncNav(null);
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
function paintMeshes(){
  const site=sites.find(s=>s.id===selection);
  const isProvince=site?.type==='province';
  if(radarMode&&riskSummary){
    updateRadarLegend();
    for(const mesh of meshes){
      const selected=Boolean(site)&&(mesh.userData.id===selection||(isProvince&&mesh.userData.province===selection));
      const sameProvince=Boolean(site)&&mesh.userData.province===site.province;
      const res=riskSummary.byId.get(mesh.userData.id);
      const rc=riskColor(res?.score);
      mesh.material.color.setHex(rc.hex);
      mesh.material.emissive.setHex(rc.hex).multiplyScalar(selected?.38:.16);
      const riskLift=Number.isFinite(res?.score)?(res.score/100)*.05:0;
      mesh.userData.targetY=selected?(isProvince?.14:.22):(.02+riskLift);
      if(mesh.userData.outline)mesh.userData.outline.material.opacity=selected?.98:sameProvince?.75:.45;
    }
    return;
  }
  updateRadarLegend();
  if(renderer?.shadowMap)renderer.shadowMap.needsUpdate=true;
  const light=getTheme()==='light';
  for(const mesh of meshes){
    const selected=Boolean(site)&&(mesh.userData.id===selection||(isProvince&&mesh.userData.province===selection));
    const sameProvince=Boolean(site)&&mesh.userData.province===site.province;
    if(light){
      mesh.material.color.set(selected?(isProvince?0x0b6e3b:0x0e77f0):sameProvince?0x118a55:0x1b6d52);
      mesh.material.emissive.set(selected?(isProvince?0x042915:0x062d5c):sameProvince?0x06311d:0x052418);
    }else{
      mesh.material.color.set(selected?(isProvince?0x245666:0x408da0):sameProvince?0x1f5562:0x153e4a);
      mesh.material.emissive.set(selected?(isProvince?0x09232c:0x123f4a):sameProvince?0x0a2a33:0x04151c);
    }
    mesh.userData.targetY=selected?(isProvince?.1:.18):0;
    if(mesh.userData.outline)mesh.userData.outline.material.opacity=selected?.95:sameProvince?.7:.4;
  }
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
function sync(detail){selection=detail.site;variable=detail.variable;year=detail.year;const hudSel=$('#hud-site-select');if(hudSel&&hudSel.value!==selection)hudSel.value=selection;const site=sites.find(s=>s.id===selection);if(!site){explorer?.sync(null);paintMeshes();for(const b of beacons){b.beacon.material.color.set(0x18d86b);b.beacon.scale.setScalar(1);b.ring.material.opacity=.65;b.pulse.visible=false;}return;}if(!annual?.sites?.[selection])return;explorer?.sync(selection);const value=annualValue(annual,selection,variable,year);const units={T2M:'°C',T2M_MIN:'°C',T2M_MAX:'°C',PRECTOTCORR:tx('mm/yr','mm/año'),ALLSKY_SFC_SW_DWN:tx('MJ/m²/day','MJ/m²/día'),GWETTOP:tx('index 0–1','índice 0–1'),RH2M:'%'};$('#flight-place').textContent=site.name;$('#flight-coord').textContent=`${site.latitude.toFixed(3)}° N / ${Math.abs(site.longitude).toFixed(3)}° ${tx('W','O')}`;const fv=$('#flight-value');fv.textContent=Number.isFinite(value)?new Intl.NumberFormat(locale(),{maximumFractionDigits:variable==='GWETTOP'?2:1}).format(value):'—';fv.classList.remove('value-pop');void fv.offsetWidth;fv.classList.add('value-pop');$('#flight-unit').textContent=units[variable];$('#flight-variable').textContent=`${$('#metric-name').textContent} · ${tx('historical','histórico')} ${year}`;paintMeshes();for(const b of beacons){const active=b.id===selection,near=b.province===site.province;b.beacon.material.color.set(active?0x18d86b:0x14b8e6);b.beacon.scale.setScalar(active?1.35:near?1:.7);b.ring.visible=active||near;b.ring.material.opacity=active?.9:.35;b.pulse.visible=active;}}
document.addEventListener('gaiatrack:selection',e=>{if(e.detail?.site!==selection)selectedDistrict=null;sync(e.detail);populateDistricts(selection);updateSectorBeacons();updateDistrictBorders();document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:selection,district:selectedDistrict}}));});
function applyHudLang(){
  host.setAttribute('aria-label',tx('3D exploration of Costa Rica','Exploración tridimensional de Costa Rica'));
  $('.flight-intro .eyebrow').textContent='GAIA E&B · ENVIRONMENT & BENEFITS / '+tx('COSTA RICA MISSION','MISIÓN COSTA RICA');
  $('.flight-intro h1').innerHTML=`Costa Rica,<br><em>${tx('a living world.','un mundo vivo.')}</em>`;
  $('.flight-intro p').innerHTML=tx('AN OBSERVATORY TO EXPLORE<br>Weather, territory &amp; signals of change.','UN OBSERVATORIO PARA EXPLORAR<br>Tiempo, territorio y señales de cambio.');
  $('.flight-kicker').innerHTML=`<span class="live-dot"></span> ${tx('SCIENTIFIC TELEMETRY','TELEMETRÍA CIENTÍFICA')}`;
  $('#flight-investigate').innerHTML=`${tx('Investigate this territory','Investigar este territorio')} <span>↗</span>`;
  $('#region-mode').textContent=tx('⌖ 3D Territory','⌖ Territorio 3D');
  $('#radar-mode-3d').textContent=tx('🌿 Ecological Risk','🌿 Riesgo ecológico');
  $('#lab-mode').textContent=tx('≋ Simulator','≋ Simulador');
  $('#forecast-mode').textContent=tx('↗ 7-Day Context','↗ Contexto 7 días');
  $('#flight-label').textContent=orbital?tx('COSTA RICA / ORBITAL DESCENT','COSTA RICA / DESCENSO ORBITAL'):tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');
  $('.scene-disclaimer').textContent=tx('Weather indicators driven by model data at reference points · not radar or satellite imagery','Indicadores meteorológicos según datos del modelo en puntos de referencia · no son radar ni imagen satelital');
  $('#close-lab').textContent=tx('← Back to 3D exploration','← Volver a la exploración 3D');
  const hudSel=$('#hud-site-select');
  if(hudSel&&sites.length){
    const provIds=new Set(['san-jose','alajuela','cartago','heredia','guanacaste','puntarenas','limon']);
    const provs=sites.filter(s=>provIds.has(s.id)),cantons=sites.filter(s=>!provIds.has(s.id));
    hudSel.innerHTML=siteOptionsHtml(territoryManifest,getLang());
    hudSel.value=selection;
  }
}
document.addEventListener('gaiatrack:lang',()=>{applyHudLang();sync({site:selection,variable,year});explorer?.render();});
async function init(){try{const responses=await Promise.all(['data/cantons.geojson?v=18','data/manifest.json?v=18','data/world.geojson','data/costa-rica-provinces.geojson?v=16','data/annual.json?v=18'].map(loadStaticJSON));geo=responses[0];sites=responses[1].sites;annual=responses[4];territoryManifest=responses[1];ecological=await loadStaticJSON('data/ecological.json?v=1').catch(()=>null);riskSummary=computeAllRisks({sites,annual,ecological});registerTerritories(sites);const hudSel=$('#hud-site-select');if(hudSel){hudSel.innerHTML=siteOptionsHtml(responses[1],getLang());hudSel.value=selection||'';hudSel.onchange=e=>{if(e.target.value)document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:e.target.value}}));};}scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x051122,.0045);camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.1,200);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x051020,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=THREE.PCFShadowMap;$('#world-canvas').append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Escena 3D: Costa Rica y sus provincias. Usá el selector de territorio del explorador para acceso por teclado.');scene.add(new THREE.AmbientLight(0x749fd1,.68));const key=new THREE.DirectionalLight(0xd9f7e8,3);key.position.set(4,12,5);key.castShadow=true;key.shadow.mapSize.set(512,512);key.shadow.camera.left=-16;key.shadow.camera.right=16;key.shadow.camera.top=16;key.shadow.camera.bottom=-16;key.shadow.bias=-.0005;scene.add(key);const rim=new THREE.PointLight(0x0e77f0,70);rim.position.set(-6,3,-4);scene.add(rim);root=new THREE.Group();scene.add(root);
const provinceLine=new THREE.LineBasicMaterial({color:0x14c5e8,transparent:true,opacity:.85});for(const f of responses[3].features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const rings of polys){if(!rings[0]||rings[0].length<3)continue;const outline=rings[0].map(([lon,lat])=>{const p=coords(lon,lat);p.y=.3;return p;});const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline),provinceLine);line.userData.province=f.properties.id;provinceBorders.push(line);root.add(line);}}
for(const f of geo.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const rings of polys){const shape=new THREE.Shape();rings[0].forEach(([lon,lat],i)=>{const p=coords(lon,lat);if(i===0)shape.moveTo(p.x,-p.z);else shape.lineTo(p.x,-p.z);});for(const hole of rings.slice(1)){const path=new THREE.Path();hole.forEach(([lon,lat],i)=>{const p=coords(lon,lat);if(i===0)path.moveTo(p.x,-p.z);else path.lineTo(p.x,-p.z);});shape.holes.push(path);}const geometry=new THREE.ExtrudeGeometry(shape,{depth:.26,bevelEnabled:true,bevelSize:.018,bevelThickness:.025,bevelSegments:1,steps:1});geometry.rotateX(-Math.PI/2);const material=surfaceMaterial();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={id:f.properties.id,name:f.properties.name,province:f.properties.province,targetY:0};meshes.push(mesh);root.add(mesh);for(const ring of rings){const outline=ring.map(([lon,lat])=>{const p=coords(lon,lat);p.y=.285;return p;});const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(outline),new THREE.LineBasicMaterial({color:0x2299d4,transparent:true,opacity:.6}));mesh.userData.outline=line;mesh.add(line);}}}
const sectorsMap=await loadStaticJSON('data/sectors.json?v=2').catch(()=>({}));
sectorsCatalog=sectorsMap||{};
simulator=createSimulator({sites,annual,sectorsCatalog,onSelectTerritory:(siteId,distId)=>{
  if(siteId&&siteId!==selection){document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:siteId}}));}
  if(distId!==undefined&&distId!==selectedDistrict){selectedDistrict=distId;const hd=$('#hud-district-select');if(hd)hd.value=distId||'';updateDistrictBorders();document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:siteId||selection,district:selectedDistrict}}));}
}});
districtBordersMap=await loadStaticJSON('data/district-borders.json?v=1').catch(()=>({}));
districtLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x38bdf8,transparent:true,opacity:.45}));districtLines.name='district-borders';districtLines.frustumCulled=false;districtLines.visible=false;root.add(districtLines);
activeDistrictLine=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xf5b316,transparent:true,opacity:.95}));activeDistrictLine.name='active-district-border';activeDistrictLine.frustumCulled=false;activeDistrictLine.visible=false;root.add(activeDistrictLine);
const hudDist=$('#hud-district-select');
if(hudDist)hudDist.onchange=()=>{
  selectedDistrict=hudDist.value||null;
  updateDistrictBorders();
  document.dispatchEvent(new CustomEvent('gaiatrack:district-select',{detail:{site:selection,district:selectedDistrict}}));
  const dObj=(sectorsCatalog[selection]||[]).find(d=>d.id===selectedDistrict);
  if(dObj){$('#flight-place').textContent=dObj.name;$('#flight-coord').textContent=`${dObj.latitude.toFixed(3)}° N / ${Math.abs(dObj.longitude).toFixed(3)}° ${tx('W','O')}`;document.dispatchEvent(new CustomEvent('gaiatrack:focuspoint',{detail:dObj}));}
  else{const sObj=sites.find(s=>s.id===selection);if(sObj){$('#flight-place').textContent=sObj.name;$('#flight-coord').textContent=`${sObj.latitude.toFixed(3)}° N / ${Math.abs(sObj.longitude).toFixed(3)}° ${tx('W','O')}`;explorer?.focus();}}
};
const grid=new THREE.GridHelper(35,55,0x1d4b75,0x0c2440);grid.position.y=-.35;grid.material.transparent=true;grid.material.opacity=.1;root.add(grid);for(const radius of [5,7,9]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.009,160),new THREE.MeshBasicMaterial({color:0x14b8e6,side:THREE.DoubleSide,transparent:true,opacity:.14}));ring.rotation.x=-Math.PI/2;ring.position.y=-.3;root.add(ring);}
const showOrbital=orbital&&!introDone;planet=new THREE.Group();planet.visible=showOrbital;root.visible=!showOrbital;scene.add(planet);const globeMat=new THREE.MeshPhongMaterial({color:0x081e3d,shininess:28,transparent:true,opacity:1});planet.add(new THREE.Mesh(new THREE.SphereGeometry(3.98,64,48),globeMat));const atmoMat=new THREE.MeshBasicMaterial({color:0x14b8e6,wireframe:true,transparent:true,opacity:.065});const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(4.1,48,32),atmoMat);planet.add(atmosphere);const countryMat=new THREE.LineBasicMaterial({color:0x19a6e8,transparent:true,opacity:.78});for(const f of responses[2].features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys){const points=poly[0].map(([lon,lat])=>globe(lon,lat));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),countryMat);planet.add(line);}}const pinMat=new THREE.MeshBasicMaterial({color:0x18d86b,transparent:true,opacity:1});const pin=new THREE.Mesh(new THREE.SphereGeometry(.065,16,16),pinMat);pin.position.copy(globe(-84.12,10.4,4.05));planet.add(pin);const pinRingMat=new THREE.MeshBasicMaterial({color:0xf5b316,side:THREE.DoubleSide,transparent:true,opacity:.85,depthWrite:false});pinRing=new THREE.Mesh(new THREE.RingGeometry(.11,.15,32),pinRingMat);pinRing.position.copy(globe(-84.12,10.4,4.07));pinRing.lookAt(pinRing.position.clone().multiplyScalar(2));planet.add(pinRing);planetFades=[[globeMat,1],[atmoMat,.065],[countryMat,.78],[pinMat,1],[pinRingMat,.85]];
const starPositions=[];for(let i=0;i<1100;i++){const a=Math.random()*Math.PI*2,b=Math.acos(2*Math.random()-1),r=38+Math.random()*32;starPositions.push(r*Math.sin(b)*Math.cos(a),r*Math.cos(b),r*Math.sin(b)*Math.sin(a));}const stars=new THREE.BufferGeometry();stars.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starPoints=new THREE.Points(stars,new THREE.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,uniforms:{opacity:{value:.62},pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:`uniform float pixelRatio;void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=clamp((110.0/-mv.z)*pixelRatio,1.2,3.4);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float opacity;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=smoothstep(1.0,.05,d);if(a<.02||opacity<.01)discard;gl_FragColor=vec4(.64,.80,.90,a*opacity);}`}));scene.add(starPoints);
const art=addSceneAtmosphere(scene,root);
const applySceneTheme=(theme=getTheme())=>{
  const light=theme==='light';
  renderer?.setClearColor(light?0xedf6f1:0x051020,1);
  if(scene?.fog)scene.fog.color.setHex(light?0xedf6f1:0x051122);
  provinceLine.color.setHex(light?0x0e77f0:0x14c5e8);
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
const weather=createWeatherExperience({root,meshes,light:key,coords,sites});
explorer=createProvinceExplorer({host,manifest:territoryManifest,geo,meshes,beacons,borders:provinceBorders,root,camera,coords,initial:selection,
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
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){focus.copy(targetFocus);distance=targetDistance;pitch=targetPitch;yaw=targetYaw;}
  }
});
const canvas=renderer.domElement,pointerRay=new THREE.Raycaster(),pointerVec=new THREE.Vector2();
canvas.setAttribute('aria-label',tx('Interactive map: drag to move, right-drag to rotate, scroll to zoom; arrow keys to move, R to center.','Mapa interactivo: arrastrá para mover, botón derecho para girar y rueda para zoom; flechas para mover y R para centrar.'));
cameraControls=createMapCamera({canvas,
  getState:()=>({focus:targetFocus.clone(),distance:targetDistance,pitch:targetPitch,yaw:targetYaw,fov:camera.fov}),
  onChange:patch=>{if(patch.focus)targetFocus.set(patch.focus.x,patch.focus.y,patch.focus.z);if(patch.distance!=null)targetDistance=patch.distance;if(patch.pitch!=null)targetPitch=patch.pitch;if(patch.yaw!=null)targetYaw=patch.yaw;},
  onStart:()=>{if(!introDone){introDone=true;document.body.classList.remove('intro-playing');mode(false);}},
  onPick:e=>{if(orbital)return;const r=canvas.getBoundingClientRect();pointerVec.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);pointerRay.setFromCamera(pointerVec,camera);const hit=pointerRay.intersectObjects(meshes.filter(m=>m.visible),false)[0];if(hit)explorer.selectMesh(hit.object);},
  onRecenter:()=>explorer?.focus()
});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(starPoints?.material?.uniforms?.pixelRatio)starPoints.material.uniforms.pixelRatio.value=renderer.getPixelRatio();explorer?.focus();});
$('#scene-loading').hidden=true;sync({site:selection,variable,year});if(introDone||!orbital){mode(false);explorer?.focus();explorer?.render();}weather.refresh();function frame(time){if(document.hidden||time-lastFrame<33)return;lastFrame=time;if(!introDone){if(introStart===null)introStart=time;const elapsed=(time-introStart)/1000;if(elapsed<.4){distance=targetDistance=12.5;pitch=targetPitch=.1815;yaw=targetYaw=.1026;planet.scale.setScalar(1);}else if(elapsed<2.0){const t=(elapsed-.4)/1.6;const ease=t*t*(3-2*t);planet.scale.setScalar(1);distance=targetDistance=12.5-ease*7.5;pitch=targetPitch=.1815;yaw=targetYaw=.1026;}else if(elapsed<2.9){const t=(elapsed-2.0)/.9;const ease=1-Math.pow(1-t,3);orbital=false;root.visible=true;root.scale.setScalar(.3+ease*.7);const fade=Math.max(0,1-t*2.2);planet.visible=fade>0;for(const [m,base] of planetFades)m.opacity=base*fade;if(!selection){distance=targetDistance=16.5;pitch=targetPitch=.8;yaw=targetYaw=.22;$('#flight-label').textContent=tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');}}else{introDone=true;document.body.classList.remove('intro-playing');orbital=false;planet.visible=false;root.visible=true;root.scale.setScalar(1);if(!selection){distance=targetDistance=16.5;pitch=targetPitch=.8;yaw=targetYaw=.22;$('#flight-label').textContent=tx('COSTA RICA / 3D OBSERVATORY','COSTA RICA / OBSERVATORIO 3D');}explorer?.focus();explorer?.render();}}if(starPoints){const targetStarOpacity=orbital?.62:0;const u=starPoints.material.uniforms.opacity;u.value+=(targetStarOpacity-u.value)*.12;starPoints.visible=u.value>.01;if(moving&&!dragging&&!document.body.classList.contains('lab-open')&&starPoints.visible)starPoints.rotation.y+=.00004;}const response=cameraControls?.interacting ? .4 : .14;yaw+=(targetYaw-yaw)*response;pitch+=(targetPitch-pitch)*response;distance+=(targetDistance-distance)*response;focus.lerp(targetFocus,response);for(const mesh of meshes){mesh.position.y+=((mesh.userData.targetY||0)-mesh.position.y)*.12;}if(districtLines?.visible){const selMesh=meshes.find(m=>m.userData.id===selection);const dy=selMesh?selMesh.position.y:0;districtLines.position.y=dy;if(activeDistrictLine)activeDistrictLine.position.y=dy+.002;}if(moving){if(pinRing){const ps=1+((time*.001)%1)*1.8;pinRing.scale.set(ps,ps,1);pinRing.material.opacity=(1-((time*.001)%1))*.8;}}camera.position.set(focus.x+Math.sin(yaw)*Math.cos(pitch)*distance,focus.y+Math.sin(pitch)*distance,focus.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(focus);weather.animate(time);art.animate(time,moving);explorer?.updateLabels();renderer.render(scene,camera);}
const loop=createRenderLoop(frame,{isActive:()=>!document.hidden&&!document.body.classList.contains('lab-open')&&!document.body.classList.contains('landing-open')&&!document.body.classList.contains('simulator-open')});
const observer=new MutationObserver(()=>loop.sync());observer.observe(document.body,{attributes:true,attributeFilter:['class']});
document.addEventListener('visibilitychange',()=>loop.sync());
loop.sync();}catch(e){console.error(e);$('#scene-loading').textContent=tx('3D engine unavailable on this device. Open the Lab to explore all data.','El motor 3D no está disponible en este dispositivo. Abrí el laboratorio para explorar todos los datos.');}}
init();
