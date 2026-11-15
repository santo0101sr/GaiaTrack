import * as THREE from './vendor/three.module.js';
import {cantonsOf,provinceOptionsHtml,territoryOptionsHtml,territoryBounds} from './territories.js';
import {getLang,tx} from './i18n.js';
import {attachMovablePanel} from './movable-panels.js';
import {icon} from './icons.js';

export function createProvinceExplorer({host,manifest,geo,meshes,beacons,borders,root,camera,coords,onSelect,onFocus,initial=null}) {
  let province=null,selected=null,labels=[];
  const navigation=document.createElement('nav');
  navigation.className='territory-browser';
  const labelLayer=document.createElement('div');
  labelLayer.className='territory-map-labels';
  host.append(navigation,labelLayer);
  const toolbar=attachMovablePanel(navigation,{id:'territories',english:'Territories',spanish:'Territorios',parent:host});
  document.body.classList.add('province-explorer');
  const provinceSelect=host.querySelector('#hud-province-select');
  const cantonSelect=host.querySelector('#hud-site-select');
  const sites=new Map(manifest.sites.map(s=>[s.id,s]));
  const name=id=>manifest.provinces.find(p=>p.id===id)?.name??'Costa Rica';
  const provinceSiteId=id=>manifest.provinces.find(p=>p.id===id)?.siteId??id;
  const activate=id=>{selected=null;onSelect(id);};

  provinceSelect.onchange=()=>provinceSelect.value?activate(provinceSiteId(provinceSelect.value)):country(true);
  cantonSelect.onchange=()=>{if(cantonSelect.value)activate(cantonSelect.value);};

  function focus(){
    const site=sites.get(selected);
    const bounds=province?territoryBounds(geo,province,site?.type==='canton'?site.id:null):null;
    onFocus(bounds);
  }

  function setVisibility(){
    for(const mesh of meshes){
      mesh.visible=!province||mesh.userData.province===province;
      if(!province){mesh.material.color.set(0x153e4a);mesh.material.emissive.set(0x04151c);mesh.userData.targetY=0;}
    }
    for(const border of borders)border.visible=!province||border.userData.province===province;
    for(const b of beacons){
      const site=sites.get(b.id);
      const visible=province?site.province===province:site.type==='province';
      b.beacon.visible=visible;b.ring.visible=visible;b.pulse.visible=visible&&b.id===selected;
    }
    document.dispatchEvent(new CustomEvent('gaiatrack:territory-view',{detail:{province}}));
  }

  function makeButton(text,id,className){
    const button=document.createElement('button');
    button.type='button';button.textContent=text;button.className=className;
    button.setAttribute('aria-pressed',String(id===selected));
    button.onclick=()=>activate(id);
    return button;
  }

  function render(){
    document.body.classList.toggle('national-view',!province);
    provinceSelect.innerHTML=`<option value="">${tx('Choose a province','Elige una provincia')}</option>`+provinceOptionsHtml(manifest);
    provinceSelect.value=province??'';
    cantonSelect.innerHTML=territoryOptionsHtml(manifest,province,getLang());
    cantonSelect.value=selected??'';
    cantonSelect.hidden=!province;
    host.querySelector('label[for="hud-site-select"]').hidden=!province;
    host.querySelector('label[for="hud-province-select"]').textContent=tx('Province','Provincia');
    host.querySelector('label[for="hud-site-select"]').textContent=tx('Canton','Cantón');
    provinceSelect.setAttribute('aria-label',tx('Select province','Seleccionar provincia'));
    cantonSelect.setAttribute('aria-label',tx('Select canton or province overview','Seleccionar cantón o vista provincial'));
    const count=province?cantonsOf(manifest,province).length:manifest.provinces.length;
    host.querySelector('.flight-intro .eyebrow').textContent=tx('GAIATRACK / TERRITORY EXPLORER','GAIATRACK / EXPLORADOR TERRITORIAL');
    host.querySelector('.flight-intro h1').textContent=province?name(province):'Costa Rica';
    host.querySelector('.flight-intro p').textContent=province
      ?tx(`${count} cantons · Choose one to explore.`,`${count} cantones · Elige uno para explorar.`)
      :tx('Seven provinces. Choose where to start.','Siete provincias. Elige dónde empezar.');
    host.querySelector('.source-integrity').textContent=tx(
      'NASA POWER + Open-Meteo · Reference-point model estimates. Rain and clouds follow the reported data and update time.',
      'NASA POWER + Open-Meteo · Estimaciones por punto de referencia. Lluvia y nubes responden a los datos reportados y su hora de actualización.');
    navigation.setAttribute('aria-label',tx('Territory navigation','Navegación territorial'));
    navigation.replaceChildren(toolbar);
    const breadcrumb=document.createElement('div');breadcrumb.className='territory-breadcrumb';
    const back=document.createElement('button');back.type='button';back.innerHTML=province?`${icon('arrow-left')} Costa Rica`:'COSTA RICA';back.onclick=()=>country(true);
    breadcrumb.append(back);
    if(province){const text=document.createElement('span');text.textContent='› '+name(province);breadcrumb.append(text);}
    navigation.append(breadcrumb);
    const heading=document.createElement('div');heading.className='territory-list-heading';
    const title=document.createElement('strong');title.textContent=province?tx('Explore its cantons','Explora sus cantones'):tx('Choose a province','Elige una provincia');
    const total=document.createElement('span');total.textContent=String(count);heading.append(title,total);navigation.append(heading);
    if(province){
      const overview=makeButton(`${icon('compass')} ${tx('Entire province','Vista provincial')}`,province,'territory-overview');
      navigation.append(overview);
    }
    const list=document.createElement('div');list.className='territory-list';
    const choices=province?cantonsOf(manifest,province):manifest.provinces.map(p=>sites.get(p.siteId));
    for(const [i,site] of choices.entries()){
      const button=makeButton(site.name,site.id,'territory-choice');
      const number=document.createElement('span');number.className='territory-number';number.textContent=String(i+1).padStart(2,'0');
      button.prepend(number);list.append(button);
    }
    navigation.append(list);
    labelLayer.replaceChildren();
    labels=choices.map(site=>{
      const button=makeButton(site.name,site.id,'territory-map-label');
      button.setAttribute('aria-label',tx('Explore ','Explorar ')+site.name);
      button.hidden=true;labelLayer.append(button);
      const p=coords(site.longitude,site.latitude);p.y=.65;
      return {button,point:p,selected:site.id===selected};
    }).sort((a,b)=>Number(b.selected)-Number(a.selected));
    host.querySelector('#flight-label').textContent=province?`COSTA RICA / ${name(province).toLocaleUpperCase()}`:tx('COSTA RICA / CHOOSE A PROVINCE','COSTA RICA / ELIGE UNA PROVINCIA');
  }

  function sync(id){
    if(!id){if(selected!==null||province!==null)country(false);return;}
    const site=sites.get(id);
    if(!site||(id===selected&&province===site.province))return;
    selected=id;province=site.province;
    render();host.querySelector('.flight-panel').scrollTop=0;setVisibility();focus();
  }

  function country(notify=false){
    province=null;selected=null;
    render();host.querySelector('.flight-panel').scrollTop=0;setVisibility();focus();
    if(notify)onSelect(null);
  }

  function updateLabels(){
    if(!root.visible||document.body.classList.contains('lab-open')||document.body.classList.contains('intro-playing')){
      labelLayer.hidden=true;return;
    }
    labelLayer.hidden=false;
    const width=innerWidth,height=innerHeight,occupied=[];
    const nav=navigation.getBoundingClientRect(),panel=host.querySelector('.flight-panel').getBoundingClientRect();
    occupied.push(nav,panel);
    for(const label of labels){
      const p=root.localToWorld(label.point.clone()).project(camera);
      const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
      const box={left:x-56,right:x+56,top:y-14,bottom:y+14};
      const overlaps=occupied.some(b=>box.left<b.right&&box.right>b.left&&box.top<b.bottom&&box.bottom>b.top);
      const visible=p.z>-1&&p.z<1&&box.left>8&&box.right<width-8&&box.top>90&&box.bottom<height-115&&!overlaps;
      label.button.hidden=!visible;
      if(visible){label.button.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;occupied.push(box);}
    }
  }

  if(initial)sync(initial);else country(false);
  return {sync,render,focus,country,updateLabels,selectMesh(mesh){activate(province===mesh.userData.province?mesh.userData.id:mesh.userData.province);}};
}
