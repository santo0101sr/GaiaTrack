import {loadHistory} from './data-client.js';
import {createRainDomain,createRainField} from './rain-field.js';
import {createSkyField} from './sky-field.js';
import * as THREE from './vendor/three.module.js';
import {readWeather,weatherScales,weatherForScene,isThunderstorm,readSectors} from './weather-state.js';
import {buildRecommendations} from './recommendations.js';
import {selectWeatherTerritories} from './weather-territories.js';
import {getLang,locale,tx} from './i18n.js';
import {icon} from './icons.js';
export function createWeatherExperience({root,meshes,light,coords,sites=[]}){
const view=document.createElement('button');view.id='weather-clean-view';view.innerHTML=`${icon('eye-off')} ${tx('Clear view','Despejar escena')}`;view.setAttribute('aria-pressed','false');document.querySelector('#immersive').append(view);view.onclick=()=>{const clean=document.body.classList.toggle('clean-cockpit');view.innerHTML=clean?`${icon('eye')} ${tx('Show data','Mostrar datos')}`:`${icon('eye-off')} ${tx('Clear view','Despejar escena')}`;view.setAttribute('aria-pressed',String(clean));};
let site=document.querySelector('#site-select').value||null,selectedDistrict=null,mode='current',index=0,timer=null,latest=null,selected=true,cantonPoints=[],cloudScale=1,provinceView,radarActive=false;
const visual={rain:0};
let weatherMoving=true,splashesAllowed=true,onActivity=()=>{};
const SPLASH_COUNT=12;
const ui=document.createElement('section');ui.className='weather-console';ui.setAttribute('aria-label',tx('3D data-driven weather','Clima conectado a los datos en 3D'));ui.innerHTML=`<div class="weather-title"><span class="live-dot"></span><strong>${tx('ATMOSPHERE / MODEL DATA','ATMÓSFERA / DATOS DEL MODELO')}</strong></div><div class="weather-switch"><button id="weather-now" class="chosen">${tx('Now','Ahora')}</button><button id="weather-future">${tx('3D Forecast','Pronóstico 3D')}</button></div><p id="weather-date" role="status">${tx('Waiting for data…','Esperando datos…')}</p><div class="weather-actions"><button id="weather-motion" type="button" aria-pressed="true">${icon('pause')} ${tx('Weather motion','Animación del clima')}</button><button id="weather-focus">${icon('crosshair')} ${tx('Focus point','Acercar al punto')}</button></div><div class="weather-readings"><div><span>${icon('sun')} ${tx('Solar','Radiación')}</span><strong id="wx-solar">—</strong></div><div><span>${icon('cloud')} ${tx('Clouds','Nubes')}</span><strong id="wx-cloud">—</strong></div><div><span>${icon('cloud-rain')} ${tx('Precipitation','Precipitación')}</span><strong id="wx-rain">—</strong><small id="wx-rain-rate"></small></div><div><span>${icon('droplets')} ${tx('Soil · 0–1 cm','Suelo · 0–1 cm')}</span><strong id="wx-soil">—</strong></div></div><div id="wx-tip" class="wx-tip"></div><div id="weather-timeline"><label for="weather-hour">${tx('Forecast sample · Costa Rica','Muestra de pronóstico · Costa Rica')}</label><input id="weather-hour" type="range" min="0" max="167" value="0" step="1" aria-label="${tx('3D forecast hour','Hora del pronóstico en 3D')}"><div class="weather-timeline-actions"><button id="weather-play" aria-label="${tx('Play 3D forecast','Reproducir pronóstico en 3D')}">${icon('play')} ${tx('Play','Recorrer')}</button><span id="weather-step">—</span></div><div id="weather-days" class="weather-days"></div></div><p class="weather-explainer">${tx('Rain follows reported precipitation; clouds follow cloud cover. Check the source time and interval.','La lluvia sigue la precipitación reportada; las nubes, la nubosidad. Consulta la hora y el intervalo de la fuente.')}</p><a href="/credits.html" target="_blank" rel="noopener">${tx('Sources, transforms & licenses','Fuentes, transformaciones y licencias')} ${icon('arrow-up-right')}</a>`;document.querySelector('#flight-investigate').before(ui);
const $=s=>ui.querySelector(s),group=new THREE.Group(),targetGroupPos=new THREE.Vector3();let hasGroupPos=false;group.name='selected-weather';root.add(group);
const domainCache=new Map(),emptyDomain=createRainDomain([]),dryColor=new THREE.Color(0x6a6548),wetColor=new THREE.Color(0x296c7c),fallbackColor=new THREE.Color(0x627b7c),workColor=new THREE.Color(),monthlyRecords=new Map();
let baseLightIntensity=1.15;light.intensity=baseLightIntensity;
const sky=createSkyField(emptyDomain,{maxClusters:10});group.add(sky.group);
function domainFor(id){if(!domainCache.has(id)){let targets=meshes.filter(m=>m.userData.id===id);if(!targets.length)targets=meshes.filter(m=>m.userData.province===id);domainCache.set(id,createRainDomain(targets));}return domainCache.get(id);}
async function getMonthly(id){try{const d=await loadHistory(id);monthlyRecords.set(id,d.monthly);return d.monthly;}catch{return null;}}
function sampleCanton(siteId){const domain=domainFor(siteId);cloudScale=Math.max(.38,Math.min(1,Math.sqrt(domain.area)/2.6));cantonPoints=Array.from({length:160},()=>domain.sample(Math.random,.073*cloudScale)).filter(Boolean).map(p=>({x:p.x-targetGroupPos.x,y:p.y-targetGroupPos.y,z:p.z-targetGroupPos.z}));rainField.setDomain(domain);rainField.setOrigin(targetGroupPos);sky.setDomain(domain);sky.setOrigin(targetGroupPos);}
function pickPoint(i){return cantonPoints.length?cantonPoints[i%cantonPoints.length]:{x:0,z:0,y:.2};}
const rainField=createRainField(emptyDomain,{count:900}),rain=rainField.mesh;rain.name='territory-rain';group.add(rain);
const splashGeo=new THREE.RingGeometry(.014,.028,16);splashGeo.rotateX(-Math.PI/2);
const splashMat=new THREE.MeshBasicMaterial({color:0x9ce7ff,side:THREE.DoubleSide,transparent:true,opacity:.45,depthWrite:false});
const splashMesh=new THREE.InstancedMesh(splashGeo,splashMat,SPLASH_COUNT);
splashMesh.name='rain-splashes';splashMesh.frustumCulled=false;splashMesh.visible=false;group.add(splashMesh);
const splashState=Array.from({length:SPLASH_COUNT},(_,i)=>({x:0,y:.2,z:0,phase:(i/SPLASH_COUNT)%1}));
const splashDummy=new THREE.Object3D();
let flashPower=0;
const boltGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.9,0),new THREE.Vector3(.05,.62,.02),new THREE.Vector3(-.04,.38,-.02),new THREE.Vector3(.02,.05,0)]);
const bolt=new THREE.Line(boltGeo,new THREE.LineBasicMaterial({color:0xdcf4ff,transparent:true,opacity:0,depthWrite:false}));
bolt.visible=false;group.add(bolt);
const fmt=(n,u,d=1)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{maximumFractionDigits:d}).format(n)+' '+u:tx('No data','Sin dato');
function stop(){if(timer)clearInterval(timer);timer=null;$('#weather-play').innerHTML=`${icon('play')} ${tx('Play','Recorrer')}`;$('#weather-play').setAttribute('aria-label',tx('Play 3D forecast','Reproducir pronóstico en 3D'));}
$('#weather-focus').onclick=()=>{const point=readWeather('forecast',site)?.requested||readWeather('current',site)?.requested;if(point)document.dispatchEvent(new CustomEvent('gaiatrack:focuspoint',{detail:point}));};
$('#weather-motion').onclick=()=>{weatherMoving=!weatherMoving;if(!weatherMoving){flashPower=0;bolt.visible=false;sky.setFlash(0);rainField.setFlash(0);light.intensity=baseLightIntensity;}$('#weather-motion').setAttribute('aria-pressed',String(weatherMoving));$('#weather-motion').innerHTML=weatherMoving?`${icon('pause')} ${tx('Weather motion','Animación del clima')}`:`${icon('play')} ${tx('Weather motion','Animación del clima')}`;onActivity();};
function resetEffects(){latest=null;hasGroupPos=false;group.visible=false;visual.rain=0;rainField.setWeather({});rainField.setFlash(0);sky.setWeather({});sky.setFlash(0);flashPower=0;bolt.visible=false;light.intensity=baseLightIntensity;splashMesh.visible=false;}
function seedRain(){rainField.setOrigin(targetGroupPos);for(let i=0;i<splashState.length;i++){const pt=pickPoint(i*11);splashState[i].x=pt.x;splashState[i].y=pt.y;splashState[i].z=pt.z;}}
function choose(next){stop();resetEffects();mode=next;update();}
$('#weather-now').onclick=()=>choose('current');$('#weather-future').onclick=()=>choose('forecast');$('#weather-hour').oninput=e=>{stop();index=+e.target.value;update();};$('#weather-play').onclick=()=>{if(timer){stop();return;}if(mode!=='forecast')return;const list=readWeather('forecast',site)?.timeline||[];if(!list.length)return;if(index>=list.length-1)index=0;timer=setInterval(()=>{if(index>=list.length-1){stop();return;}index++;update();},650);$('#weather-play').innerHTML=`${icon('pause')} ${tx('Pause','Pausar')}`;$('#weather-play').setAttribute('aria-label',tx('Pause 3D forecast','Pausar pronóstico en 3D'));};
function resolveSectors(id,modeName){
  if(modeName!=='current')return null;
  const rawList=readSectors(id);
  if(!rawList?.length)return null;
  const out=[];
  for(const s of rawList){
    const norm=weatherForScene('current',s.site,s);
    if(!norm||!s.requested)continue;
    const p=coords(s.requested.longitude,s.requested.latitude);
    out.push({...norm,x:p.x,z:p.z});
  }
  return out.length?out:null;
}
function effectiveRainData(base,sectorList){
  if(!sectorList?.length)return base;
  let maxPrecip=Number.isFinite(base.precipitation)?base.precipitation:0;
  for(const s of sectorList)if(Number.isFinite(s.precipitation)&&s.precipitation>maxPrecip)maxPrecip=s.precipitation;
  return maxPrecip>(base.precipitation??0)?{...base,precipitation:maxPrecip}:base;
}
function update(){refreshLayers();const forecast=readWeather('forecast',site),current=readWeather('current',site),list=forecast?.timeline||[];$('#weather-timeline').hidden=mode!=='forecast';$('#weather-now').classList.toggle('chosen',mode==='current');$('#weather-future').classList.toggle('chosen',mode==='forecast');$('#weather-hour').max=Math.max(0,list.length-1);index=Math.min(index,Math.max(0,list.length-1));$('#weather-hour').value=index;const raw=mode==='current'?current:list[index];const sceneData=weatherForScene(mode,site,raw);const modelPoint=mode==='current'?current?.requested:forecast?.requested;if(sceneData&&modelPoint){const pos=coords(modelPoint.longitude,modelPoint.latitude);targetGroupPos.set(pos.x,.25,pos.z);const reposition=!hasGroupPos;group.position.copy(targetGroupPos);hasGroupPos=true;sampleCanton(site);if(reposition)seedRain();}
if(mode==='forecast'){const days=[...new Set(list.map(d=>d.time.slice(0,10)))];$('#weather-days').innerHTML=days.map((day,i)=>`<button data-index="${list.findIndex(d=>d.time.startsWith(day))}" class="${list[index]?.time.startsWith(day)?'chosen':''}">${i===0?tx('Tomorrow','Mañana'):new Date(day+'T12:00:00-06:00').toLocaleDateString(locale(),{weekday:'short',timeZone:'America/Costa_Rica'})}</button>`).join('');ui.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>{stop();index=+b.dataset.index;update();});$('#weather-step').textContent=list.length?`${index+1} / ${list.length} ${tx('samples','muestras')}`:tx('No hourly series','Sin serie horaria');}
if(!sceneData){resetEffects();$('#weather-date').textContent=mode==='forecast'?tx('Waiting for hourly forecast…','Esperando pronóstico horario…'):tx('Waiting for current conditions…','Esperando condiciones actuales…');for(const id of ['solar','cloud','rain','soil'])$('#wx-'+id).textContent=tx('No data','Sin dato');$('#wx-rain-rate').textContent='';return;}
const interval=mode==='current'?raw.intervalSeconds:(raw.intervalSeconds??3600);latest=sceneData;const sectorList=resolveSectors(site,mode);const rainSource=effectiveRainData(latest,sectorList);const scales=weatherScales(rainSource);refreshLayers();sky.setWeather(latest,sectorList);rainField.setCells(sky.cloudFootprints);const rainAmount=scales.rain??0;if(!rainAmount){visual.rain=0;flashPower=0;bolt.visible=false;sky.setFlash(0);rainField.setFlash(0);splashMesh.visible=false;}rainField.setWeather(rainSource);if(provinceView!==null){const cov=scales.cloud??0,isNight=latest.isDay===false;baseLightIntensity=isNight?.65:Math.max(.75,1.32-cov*.34-rainAmount*.25);}else{baseLightIntensity=1.15;}light.intensity=baseLightIntensity;workColor.lerpColors(dryColor,wetColor,scales.soil??.5);if(!radarActive){for(const mesh of meshes){if(provinceView!==null&&mesh.userData.id===site&&mesh.material?.color){mesh.material.color.copy(scales.soil===null?fallbackColor:workColor);mesh.material.emissive?.set(0x123437);}}}onActivity();
const activeRaw=(mode==='current'&&selectedDistrict&&(readSectors(site)||[]).find(s=>s.site===selectedDistrict))||raw;
const activeScene=(activeRaw===raw)?sceneData:(weatherForScene(mode,activeRaw.site,activeRaw)||sceneData);
const date=mode==='current'?new Date(activeRaw.observedAt):new Date(activeRaw.time+'-06:00');$('#weather-date').textContent=(mode==='current'?tx('CURRENT · ','ACTUAL · '):tx('FORECAST · ','PRONÓSTICO · '))+(mode==='current'?activeRaw.name:forecast.name)+' · '+date.toLocaleString(locale(),{timeZone:'America/Costa_Rica',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});$('#weather-date').textContent+=activeRaw.isDay===true?tx(' · Day',' · Día'):activeRaw.isDay===false?tx(' · Night',' · Noche'):'';$('#wx-solar').textContent=fmt(activeRaw.solarRadiation,'W/m²',0);$('#wx-cloud').textContent=fmt(activeRaw.clouds,'%',0);$('#wx-rain').textContent=fmt(activeRaw.precipitation,tx('mm / last ','mm / últimos ')+(interval/60)+' min');$('#wx-rain-rate').textContent=Number.isFinite(activeScene.precipitation)?tx('Equivalent: ','Equivalente: ')+fmt(activeScene.precipitation,'mm/h',2):'';$('#wx-soil').textContent=fmt(activeRaw.soilMoisture,'m³/m³',3);document.querySelector('#flight-value').textContent=fmt(activeRaw.temperature,'',1);document.querySelector('#flight-unit').textContent='°C';document.querySelector('#flight-variable').textContent=(mode==='current'?tx('Current model temperature','Temperatura actual del modelo'):tx('Hourly forecast temperature','Temperatura prevista por hora'));
const source=document.querySelector('.flight-source');source.textContent=tx('ATMOSPHERIC MODEL · ','MODELO ATMOSFÉRICO · ')+(mode==='current'?tx('CURRENT CONDITIONS','CONDICIONES ACTUALES'):tx('HOURLY FORECAST','PRONÓSTICO HORARIO'));const tipSite=site,tipMode=mode;const paintTip=monthly=>{if(site!==tipSite||mode!==tipMode)return;const rec=buildRecommendations(site,raw,forecast?.days,{monthly,lang:getLang()});const topTip=rec.tips[0];const ieaTag=rec.metrics&&Number.isFinite(rec.metrics.iea)?` · IEA ${rec.metrics.iea.toFixed(2)}`:'';const tipEl=$('#wx-tip');if(tipEl){tipEl.innerHTML=`<strong>${topTip.tag}${ieaTag}</strong><span>${topTip.body}</span><button type="button" id="wx-more-tips">${tx('View analysis & simulator','Ver análisis y simulador')} ${icon('arrow-up-right')}</button>`;tipEl.querySelector('#wx-more-tips').onclick=()=>{document.body.classList.add('lab-open');const cl=document.querySelector('#close-lab');if(cl)cl.hidden=false;requestAnimationFrame(()=>{document.querySelector('#recomendaciones')?.scrollIntoView({behavior:'smooth'});window.dispatchEvent(new Event('resize'));});};}};paintTip(monthlyRecords.get(site));if(!monthlyRecords.has(site))getMonthly(site).then(m=>{if(m)paintTip(m);});}
const provSystems=new Map(),territories=new Map(sites.map(item=>[item.id,item]));
for(const mesh of meshes){const {id,name,province}=mesh.userData;if(!territories.has(id))territories.set(id,{id,name:name??id,province,type:'canton'});if(province&&!territories.has(province))territories.set(province,{id:province,name:province,province,type:'province'});}
let activeLayers=[],lastLayerCheck=0;
const rainStatus=document.createElement('details');rainStatus.id='weather-rain-status';rainStatus.setAttribute('aria-label',tx('Precipitation by territory','Precipitación por territorio'));document.querySelector('#immersive').append(rainStatus);
const safe=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function renderRainStatus(){
  if(mode==='forecast'){
    const rate=latest?.precipitation;
    rainStatus.innerHTML=`<summary><span class="rain-status-dot ${rate>0?'is-raining':''}"></span><span>${tx('Forecast','Pronóstico')} · ${Number.isFinite(rate)?fmt(rate,'mm/h',2):tx('Waiting for data','Esperando datos')}</span></summary><p>${tx('For the selected point and hour.','Para el punto y la hora seleccionados.')}</p>`;
    return;
  }
  const known=activeLayers.filter(item=>Number.isFinite(item.normalized.precipitation));
  const wetEntries=[];
  for(const item of known){
    const secRaw=readSectors(item.territory.id)||[];
    const secNorm=secRaw.map(s=>({raw:s,norm:weatherForScene('current',s.site,s)})).filter(x=>x.norm&&Number.isFinite(x.norm.precipitation));
    if(secNorm.length){
      const wetSec=secNorm.filter(x=>x.norm.precipitation>0);
      const maxRate=Math.max(item.normalized.precipitation,...secNorm.map(x=>x.norm.precipitation));
      if(maxRate>0){
        const label=wetSec.length?`${item.territory.name} (${wetSec.length}/${secNorm.length} ${tx('sectors','sectores')})`:item.territory.name;
        wetEntries.push({id:item.territory.id,label,rate:maxRate});
      }
    }else if(item.normalized.precipitation>0){
      wetEntries.push({id:item.territory.id,label:item.territory.name,rate:item.normalized.precipitation});
    }
  }
  const wet=wetEntries.sort((a,b)=>b.rate-a.rate);
  const title=!known.length?tx('Querying precipitation…','Consultando precipitación…'):wet.length?tx(`Rain reported · ${wet.length} territories`,`Lluvia reportada · ${wet.length} territorios`):tx('No precipitation reported','Sin precipitación reportada');
  const stamp=known.length?new Date(Math.max(...known.map(item=>Date.parse(item.raw.observedAt)))).toLocaleTimeString(locale(),{timeZone:'America/Costa_Rica',hour:'2-digit',minute:'2-digit'}):'—';
  rainStatus.innerHTML=`<summary><span class="rain-status-dot ${wet.length?'is-raining':''}"></span><span>${title}</span><span class="rain-status-caret">⌄</span></summary><div class="rain-status-body"><small>${known.length} ${tx('reference points · model valid time','puntos de referencia · hora del modelo')}: ${stamp}</small>${wet.slice(0,6).map(item=>`<button type="button" data-rain-site="${safe(item.id)}"><span>${safe(item.label)}</span><strong>${fmt(item.rate,'mm/h',2)}</strong></button>`).join('')}<p>${tx('Intensity is equivalent to the reported interval. Indicators use point estimates; they are not weather radar.','La intensidad equivale al intervalo reportado. Son indicadores de estimaciones por punto, no un radar meteorológico.')}</p></div>`;
  rainStatus.querySelectorAll('[data-rain-site]').forEach(button=>button.onclick=()=>{rainStatus.open=false;document.dispatchEvent(new CustomEvent('gaiatrack:select-site',{detail:{site:button.dataset.rainSite}}));});
}
function refreshLayers(){
  activeLayers=mode==='current'?selectWeatherTerritories([...territories.values()],id=>readWeather('current',id),{province:provinceView}):[];
  const activeIds=new Set(activeLayers.map(item=>item.territory.id));
  group.visible=!!latest&&provinceView!==null&&(mode==='forecast'||activeIds.has(site));
  for(const sys of provSystems.values())sys.g.visible=false;
  for(const item of activeLayers){const id=item.territory.id;if(id===site&&group.visible)continue;syncProv(id,item.raw,item.territory,item.normalized);const sys=provSystems.get(id);if(sys)sys.g.visible=true;}
  lastLayerCheck=Date.now();renderRainStatus();
}
function syncProv(id,raw,territory,normalized){
  if(!raw?.requested)return;
  let sys=provSystems.get(id);
  if(!sys){
    const g=new THREE.Group(),pos=coords(raw.requested.longitude,raw.requested.latitude);
    g.position.set(pos.x,.25,pos.z);g.name=(territory.type==='canton'?'canton-weather-':'province-weather-')+id;root.add(g);
    const domain=domainFor(id),hasSectors=Boolean(readSectors(id)?.length),field=createRainField(domain,{count:Math.min(240,Math.max(48,Math.ceil(domain.area*95)))});field.setOrigin(g.position);g.add(field.mesh);
    const sky=createSkyField(domain,{maxClusters:hasSectors?Math.max(4,Math.min(8,Math.round(3+domain.area*2.2))):domain.area<.05?1:domain.area<.18?2:domain.area<.55?3:Math.min(5,Math.round(2+domain.area*1.2)),showSun:false});sky.setOrigin(g.position);g.add(sky.group);
    sys={g,sky,field,raw:null,sectors:null,thunder:false,flash:0,nextFlash:0};provSystems.set(id,sys);
  }
  const sec=readSectors(id);
  if(sys.raw!==raw||sys.sectors!==sec||sys.prov!==provinceView){
    sys.raw=raw;sys.sectors=sec;sys.prov=provinceView;
    const secList=resolveSectors(id,'current'),rainSrc=effectiveRainData(normalized,secList);
    const domain=domainFor(id),hasWet=Number.isFinite(rainSrc.precipitation)&&rainSrc.precipitation>0;
    const suppressTinyOverview=provinceView===null&&domain.area<.045&&!hasWet&&(normalized.clouds??0)<45&&!(secList?.some(s=>(s.clouds??0)>=45||(s.precipitation??0)>0));
    sys.thunder=isThunderstorm(normalized)||Boolean(secList?.some(isThunderstorm));
    sys.sky.setWeather(suppressTinyOverview?{...normalized,clouds:0}:normalized,suppressTinyOverview?null:secList);
    sys.field.setCells(sys.sky.cloudFootprints);
    sys.field.setWeather(rainSrc);
  }
}

document.addEventListener('gaiatrack:district-select',e=>{selectedDistrict=e.detail?.district||null;update();});
document.addEventListener('gaiatrack:weather-sectors',e=>{if(e.detail?.parent===site)update();else if(mode==='current')refreshLayers();});
document.addEventListener('gaiatrack:radar-mode',e=>{radarActive=Boolean(e.detail?.enabled);});
document.addEventListener('gaiatrack:territory-view',e=>{provinceView=e.detail.province;if(provinceView===null&&mode!=='current'){stop();mode='current';index=0;}update();});
document.addEventListener('gaiatrack:selection',e=>{if(site!==e.detail.site){site=e.detail.site;index=0;stop();resetEffects();}update();});document.addEventListener('gaiatrack:weather-data',e=>{if(e.detail.site===site)update();else if(e.detail.kind==='current'&&territories.has(e.detail.site))refreshLayers();});document.addEventListener('gaiatrack:lang',()=>{
  const clean=document.body.classList.contains('clean-cockpit');
  view.innerHTML=clean?`${icon('eye')} ${tx('Show data','Mostrar datos')}`:`${icon('eye-off')} ${tx('Clear view','Despejar escena')}`;
  ui.setAttribute('aria-label',tx('3D data-driven weather','Clima conectado a los datos en 3D'));
  $('.weather-title strong').textContent=tx('ATMOSPHERE / MODEL DATA','ATMÓSFERA / DATOS DEL MODELO');
  $('#weather-now').textContent=tx('Now','Ahora');
  $('#weather-future').textContent=tx('3D Forecast','Pronóstico 3D');
  $('#weather-motion').innerHTML=weatherMoving?`${icon('pause')} ${tx('Weather motion','Animación del clima')}`:`${icon('play')} ${tx('Weather motion','Animación del clima')}`;
  $('#weather-focus').innerHTML=`${icon('crosshair')} ${tx('Focus point','Acercar al punto')}`;
  const labels=ui.querySelectorAll('.weather-readings>div>span');
  [`${icon('sun')} ${tx('Solar','Radiación')}`,`${icon('cloud')} ${tx('Clouds','Nubes')}`,`${icon('cloud-rain')} ${tx('Precipitation','Precipitación')}`,`${icon('droplets')} ${tx('Soil · 0–1 cm','Suelo · 0–1 cm')}`].forEach((t,i)=>{if(labels[i])labels[i].innerHTML=t;});
  const tlLabel=$('#weather-timeline label');if(tlLabel)tlLabel.textContent=tx('Forecast sample · Costa Rica','Muestra de pronóstico · Costa Rica');
  $('#weather-play').innerHTML=timer?`${icon('pause')} ${tx('Pause','Pausar')}`:`${icon('play')} ${tx('Play','Recorrer')}`;
  $('.weather-explainer').textContent=tx('Rain follows reported precipitation; clouds follow cloud cover. Check the source time and interval.','La lluvia sigue la precipitación reportada; las nubes, la nubosidad. Consulta la hora y el intervalo de la fuente.');
  const crLink=ui.querySelector('a');if(crLink)crLink.innerHTML=`${tx('Sources, transforms & licenses','Fuentes, transformaciones y licencias')} ${icon('arrow-up-right')}`;
  update();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});update();
function setQuality(preset){
  if(!preset)return;
  splashesAllowed=Boolean(preset.splashesEnabled);
  if(!splashesAllowed)splashMesh.visible=false;
  rainField.setMaxCount(preset.maxRainDrops??900);
  sky.setQuality({maxClouds:preset.maxClouds??10,mistEnabled:preset.mistEnabled??true});
  for(const sys of provSystems.values()){
    sys.field.setMaxCount(preset.maxOverviewRain??200);
    sys.sky.setQuality({maxClouds:Math.max(2,Math.round((preset.maxClouds??10)*.6)),mistEnabled:preset.mistEnabled??true});
  }
  onActivity();
}
function isAnimating(){
  if(!weatherMoving||!selected)return false;
  if(group.visible&&latest){
    if(rain.visible||(sky.layers[0]?.visible)||flashPower>0.01)return true;
  }
  for(const sys of provSystems.values()){
    if(sys.g.visible&&(sys.field.mesh.visible||sys.sky.layers[0]?.visible||sys.flash>0.01))return true;
  }
  return false;
}
let previousFrame=0,nextFlash=0;return {refresh:update,setQuality,isAnimating,onActivityChange(fn){onActivity=fn||(()=>{});},animate(time){const dt=Math.min(.05,(time-previousFrame)/1000||.033);previousFrame=time;if(mode==='current'&&latest&&!weatherForScene('current',site,readWeather('current',site)))resetEffects();if(Date.now()-lastLayerCheck>15000)refreshLayers();if(!weatherMoving||!selected)return;for(const [,sys] of provSystems){if(!sys.g.visible)continue;sys.sky.animate(time);sys.field.animate(dt);if(sys.thunder&&sys.field.appearance.intensity>0){if(time>sys.nextFlash){sys.flash=1;sys.nextFlash=time+2600+Math.random()*5200;}else{sys.flash=THREE.MathUtils.lerp(sys.flash,0,1-Math.exp(-dt*14));}sys.sky.setFlash(sys.flash);sys.field.setFlash(sys.flash);}else if(sys.flash>0){sys.flash=0;sys.sky.setFlash(0);sys.field.setFlash(0);}}if(!latest||!group.visible)return;const target=weatherScales(effectiveRainData(latest,resolveSectors(site,mode)));const targetRain=target.rain??0;const k=1-Math.exp(-dt*3.5);visual.rain=targetRain===0?0:THREE.MathUtils.lerp(visual.rain,targetRain,k);sky.animate(time);rainField.animate(dt);const rainyClouds=splashesAllowed?sky.cloudFootprints.filter(c=>(c.rain??1)>0):[];if(!splashesAllowed||!rainyClouds.length||visual.rain<.04){splashMesh.visible=false;}else{splashMesh.visible=true;splashMat.opacity=Math.min(.55,visual.rain*.55);for(let i=0;i<SPLASH_COUNT;i++){const st=splashState[i];st.phase=(st.phase+dt*(1.4+visual.rain))%1;const sc=(.5+st.phase*2.0)*cloudScale*(1-st.phase*.25);if(st.phase<.04){const c=rainyClouds[Math.floor(Math.random()*rainyClouds.length)],r=(c.effectiveRadius??c.radius)*Math.sqrt(Math.random()),a=Math.random()*Math.PI*2;st.x=c.x+Math.cos(a)*r-targetGroupPos.x;st.y=c.y-targetGroupPos.y+.015;st.z=c.z+Math.sin(a)*r-targetGroupPos.z;}splashDummy.position.set(st.x,st.y,st.z);splashDummy.scale.set(sc,1,sc);splashDummy.updateMatrix();splashMesh.setMatrixAt(i,splashDummy.matrix);}splashMesh.instanceMatrix.needsUpdate=true;}const thunder=isThunderstorm(latest)&&visual.rain>0;if(thunder&&time>nextFlash){flashPower=1;nextFlash=time+2800+Math.random()*4500;if(cantonPoints.length){const pt=pickPoint(Math.floor(Math.random()*160));bolt.position.set(pt.x,pt.y,pt.z);bolt.rotation.y=Math.random()*Math.PI*2;}}else{flashPower=thunder?THREE.MathUtils.lerp(flashPower,0,1-Math.exp(-dt*18)):0;}const flashGlow=Math.min(1,flashPower);sky.setFlash(flashGlow);rainField.setFlash(flashGlow);light.intensity=baseLightIntensity+flashGlow*.55;bolt.visible=thunder&&flashGlow>.22;bolt.material.opacity=flashGlow;}};
}
