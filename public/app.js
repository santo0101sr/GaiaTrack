import {siteOptionsHtml,provinceOptionsHtml,territoryOptionsHtml} from './territories.js';
import {annualSeries,trend,baseline,mean,historyCoverage} from './science.js';
import {initForecast,updateForecast} from './forecast.js';
import {pearsonCorrelation} from './earth-pulse.js';
import {getLang,locale,tx,applyStaticI18n} from './i18n.js';

const $=s=>document.querySelector(s);
const rawVariables=[
  {id:'T2M',icon:'◴',digits:1,
    en:{name:'Mean temperature',short:'Mean temp.',unit:'°C',definition:'Annual mean of daily air temperature at 2 m.',resolution:'Meteorology: 0.5° × 0.625° grid cells (approx. 55 × 68 km).'},
    es:{name:'Temperatura media',short:'Temp. media',unit:'°C',definition:'Promedio anual de la temperatura diaria del aire a 2 m.',resolution:'Meteorología: celdas de 0,5° × 0,625° (aprox. 55 × 68 km).'}},
  {id:'T2M_MIN',icon:'↓',digits:1,
    en:{name:'Minimum temperature',short:'Min temp.',unit:'°C',definition:'Annual mean of daily minimum air temperature at 2 m; not an all-time record low.',resolution:'Meteorology: 0.5° × 0.625° grid cells (approx. 55 × 68 km).'},
    es:{name:'Temperatura mínima',short:'Temp. mínima',unit:'°C',definition:'Promedio anual de las mínimas diarias del aire a 2 m; no es el mínimo absoluto.',resolution:'Meteorología: celdas de 0,5° × 0,625° (aprox. 55 × 68 km).'}},
  {id:'T2M_MAX',icon:'↑',digits:1,
    en:{name:'Maximum temperature',short:'Max temp.',unit:'°C',definition:'Annual mean of daily maximum air temperature at 2 m; not an all-time record high.',resolution:'Meteorology: 0.5° × 0.625° grid cells (approx. 55 × 68 km).'},
    es:{name:'Temperatura máxima',short:'Temp. máxima',unit:'°C',definition:'Promedio anual de las máximas diarias del aire a 2 m; no es el máximo absoluto.',resolution:'Meteorología: celdas de 0,5° × 0,625° (aprox. 55 × 68 km).'}},
  {id:'ALLSKY_SFC_SW_DWN',icon:'☼',digits:1,
    en:{name:'Solar radiation',short:'Solar radiation',unit:'MJ/m²/day',definition:'Daily downward solar energy at surface, averaged across the year including cloud effects.',resolution:'Radiation: 1° × 1° grid cells (approx. 111 × 109 km).'},
    es:{name:'Radiación solar',short:'Radiación solar',unit:'MJ/m²/día',definition:'Energía solar diaria incidente en superficie, promediada en el año. Incluye el efecto de las nubes.',resolution:'Radiación: celdas de 1° × 1° (aprox. 111 × 109 km).'}},
  {id:'PRECTOTCORR',icon:'≋',digits:0,
    en:{name:'Precipitation',short:'Precipitation',unit:'mm/yr',definition:'Estimated annual total derived from bias-corrected daily precipitation.',resolution:'Meteorology: 0.5° × 0.625° grid cells (approx. 55 × 68 km).'},
    es:{name:'Precipitación',short:'Precipitación',unit:'mm/año',definition:'Acumulación anual estimada a partir de la precipitación diaria corregida.',resolution:'Meteorología: celdas de 0,5° × 0,625° (aprox. 55 × 68 km).'}},
  {id:'GWETTOP',icon:'◉',digits:2,
    en:{name:'Surface soil moisture',short:'Soil moisture',unit:'index 0–1',definition:'Modeled topsoil wetness index (0–1). Not equivalent to volumetric water percentage.',resolution:'MERRA-2: 0.5° × 0.625° grid cells. Modeled surface wetness index.'},
    es:{name:'Humedad superficial del suelo',short:'Humedad del suelo',unit:'índice 0–1',definition:'Índice de humedad de la capa superficial del suelo del modelo. No equivale a porcentaje volumétrico de agua.',resolution:'MERRA-2: celdas de 0,5° × 0,625°. Índice modelado de humedad superficial.'}},
  {id:'RH2M',icon:'◌',digits:1,
    en:{name:'Relative humidity',short:'Air humidity',unit:'%',definition:'Annual mean of relative humidity of air at 2 m above the surface.',resolution:'Meteorology: 0.5° × 0.625° grid cells (approx. 55 × 68 km).'},
    es:{name:'Humedad relativa del aire',short:'Humedad del aire',unit:'%',definition:'Promedio anual de la humedad relativa del aire a 2 m sobre la superficie.',resolution:'Meteorología: celdas de 0,5° × 0,625° (aprox. 55 × 68 km).'}}
];

const state={variable:'T2M',site:null,year:2025,start:2001,end:2025,anomaly:false,compare:false,compareSite:'sarapiqui'};
let lastMapSite=null,mapOverview=true;
let manifest,geo,data={},map,boundaryLayer,markers={},seaMarkers=[],timer=null;
const v=()=>{const r=rawVariables.find(x=>x.id===state.variable);const l=r[getLang()];return {id:r.id,icon:r.icon,digits:r.digits,...l};};
const format=(n,d=v().digits)=>Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):tx('No data','Sin datos');
const signed=(n,d=v().digits)=>(n>0?'+':'')+format(n,d);
const series=(id=state.site)=>annualSeries(data[id].monthly,state.variable);
const valueAt=(id,year)=>series(id).find(d=>d.year===year)?.value;
const deltaUnit=()=>state.variable==='RH2M'?tx('pp','p.p.'):v().unit;
const currentColor='#c3f77a';

function showError(message){$('#status').textContent=message;}
const PROVINCE_IDS=['san-jose','alajuela','cartago','heredia','guanacaste','puntarenas','limon'];
function options(select,value){
  if(select.id==='site-select'){
    const province=value?manifest.sites.find(s=>s.id===value)?.province:null;
    select.innerHTML=province?territoryOptionsHtml(manifest,province,getLang()):`<option value="">${tx('Choose a province first','Elegí primero una provincia')}</option>`;
    select.value=value||'';
    return;
  }
  select.innerHTML=siteOptionsHtml(manifest,getLang());
  select.value=value||'';
}
function selectSite(id){
  if(!id){state.site=null;mapOverview=true;stop();render();return;}
  if(!data[id])return;
  state.site=id;stop();render();
}
document.addEventListener('gaiatrack:select-site',e=>selectSite(e.detail.site));

function buildLayerButtons(){
  $('#layer-buttons').innerHTML=rawVariables.map(p=>{
    const l=p[getLang()];
    const active=p.id===state.variable;
    return `<button class="layer-button ${active?'selected':''}" data-variable="${p.id}" aria-pressed="${active}"><span class="layer-icon" aria-hidden="true">${p.icon}</span><span>${l.short}</span><small>${l.unit==='°C'?'°C':p.id==='RH2M'?'%':''}</small></button>`;
  }).join('');
  document.querySelectorAll('.layer-button').forEach(b=>b.onclick=()=>setVariable(b.dataset.variable));
}

function setVariable(id){state.variable=id;render();}
function stop(){if(timer){clearInterval(timer);timer=null;}$('#play').textContent='▶';$('#play').setAttribute('aria-label',tx('Play time series','Reproducir evolución temporal'));}
function setYear(year){state.year=Number(year);document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:state.site,variable:state.variable,year:state.year}}));renderMap();renderInspector();renderChart();$('#year-slider').value=state.year;$('#selected-year').textContent=state.year;}

function render(){
  document.querySelectorAll('.layer-button').forEach(b=>{const active=b.dataset.variable===state.variable;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  const selectedSite=state.site?manifest.sites.find(s=>s.id===state.site):null;
  options($('#site-select'),state.site);
  $('#site-select').hidden=!selectedSite;
  const siteLabel=$('.territory-field-label[for="site-select"]');
  if(siteLabel)siteLabel.hidden=!selectedSite;
  $('#province-select').innerHTML=`<option value="">${tx('Choose a province','Elegí una provincia')}</option>`+provinceOptionsHtml(manifest);
  $('#province-select').value=selectedSite?selectedSite.province:'';
  $('#compare-site').value=state.compareSite;
  $('#download').disabled=!selectedSite;
  if($('#fit-province'))$('#fit-province').disabled=!selectedSite;
  $('#metric-name').textContent=v().name;$('#metric-unit').textContent=v().unit;$('#metric-definition').textContent=v().definition;
  $('#resolution-note').textContent=v().resolution+tx(' One point does not represent the entire territory.',' Un punto no representa todo el territorio.');
  renderMap();renderInspector();renderChart();renderStats();
  document.dispatchEvent(new CustomEvent('gaiatrack:selection',{detail:{site:state.site,variable:state.variable,year:state.year}}));
  updateForecast(selectedSite?data[state.site]:null,state.variable);
}

function renderInspector(){
  if(!state.site){
    $('#point-coordinates').textContent=tx('COSTA RICA · 7 PROVINCES · 83 CANTONS','COSTA RICA · 7 PROVINCIAS · 83 CANTONES');
    $('#metric-year').textContent=state.year;$('#metric-value').textContent='—';
    $('#history-quality').textContent=tx(
      'Choose a province on the map or selector to inspect a NASA POWER reference point.',
      'Elegí una provincia en el mapa o en el selector para inspeccionar un punto de referencia NASA POWER.'
    );
    $('#baseline-difference').textContent=tx('Choose a province','Elegí una provincia');
    $('#insight').textContent=tx(
      'Showing all of Costa Rica. Select a province or canton on the map to explore its historical evolution.',
      'Mostrando todo Costa Rica. Seleccioná una provincia o cantón en el mapa para explorar su evolución histórica.'
    );
    $('#mini-chart').innerHTML='';
    return;
  }
  const s=data[state.site],points=series(),current=valueAt(state.site,state.year),base=baseline(points),diff=Number.isFinite(current)&&Number.isFinite(base)?current-base:null;
  $('#point-coordinates').textContent=`${s.latitude.toFixed(4)}° N / ${Math.abs(s.longitude).toFixed(4)}° ${tx('W','O')} · ${tx('REFERENCE POINT','PUNTO DE REFERENCIA')}`;
  $('#metric-year').textContent=state.year;$('#metric-value').textContent=format(current);
  const coverage=historyCoverage(s.monthly,state.variable,state.year);
  $('#history-quality').textContent=tx(
    `${coverage.validDays}/${coverage.expectedDays} valid days (${format(coverage.percent,1)}%) · ${coverage.validMonths}/12 valid months · ${state.year}${coverage.estimated?' · Accumulated rain estimated due to missing days':''}.`,
    `${coverage.validDays}/${coverage.expectedDays} días válidos (${format(coverage.percent,1)} %) · ${coverage.validMonths}/12 meses válidos · ${state.year}${coverage.estimated?' · Lluvia acumulada estimada por días faltantes':''}.`
  );
  $('#baseline-difference').textContent=Number.isFinite(diff)?`${signed(diff)} ${deltaUnit()}`:tx('No baseline','Sin referencia');
  const t=trend(points.filter(p=>p.year>=state.start&&p.year<=state.end));
  const direction=tx(t.slope>0?'an increase':t.slope<0?'a decrease':'stability',t.slope>0?'aumento':t.slope<0?'descenso':'estabilidad');
  $('#insight').textContent=t.n>=10
    ?tx(
      `In ${s.name}, the ${state.start}–${state.end} series shows ${direction}: ${signed(t.slope*10)} ${deltaUnit()} per decade. ${t.autocorrelated?'Temporal dependence requires reviewing significance.':t.p<.05?'The exploratory test detects a statistical signal.':'The test finds insufficient evidence of a trend.'}`,
      `En ${s.name}, la serie ${state.start}–${state.end} muestra ${direction}: ${signed(t.slope*10)} ${deltaUnit()} por década. ${t.autocorrelated?'La dependencia temporal requiere revisar la significancia.':t.p<.05?'La prueba exploratoria detecta una señal estadística.':'La prueba no encuentra evidencia suficiente de una tendencia.'}`
    )
    :tx('Expand the period to at least ten complete years to evaluate trend evidence.','Ampliá el período a por lo menos diez años completos para evaluar la evidencia de tendencia.');
  const valid=points.filter(p=>Number.isFinite(p.value));const values=valid.map(p=>p.value),min=Math.min(...values),max=Math.max(...values);const x=y=>8+(y-2001)/24*264,y=n=>55-(n-min)/(max-min||1)*44;
  $('#mini-chart').innerHTML=`<path d="${valid.map((p,i)=>`${i?'L':'M'}${x(p.year)},${y(p.value)}`).join(' ')}" fill="none" stroke="${currentColor}" stroke-width="1.7"/>${Number.isFinite(current)?`<circle cx="${x(state.year)}" cy="${y(current)}" r="3.5" fill="${currentColor}"/>`:''}`;
}

function color(value,min,max){if(!Number.isFinite(value))return '#7c8791';const t=(value-min)/(max-min||1);return `rgb(${Math.round(55+140*t)},${Math.round(101+146*t)},${Math.round(140-18*t)})`;}

function renderMap(){
  const values=manifest.sites.map(s=>valueAt(s.id,state.year)).filter(Number.isFinite),min=Math.min(...values),max=Math.max(...values);
  $('#map-variable').textContent=v().name;$('#map-year').textContent=state.year;$('#map-range').textContent=`${format(min)} — ${format(max)} ${v().unit}`;
  if(!map)return;
  const selectedSite=state.site?manifest.sites.find(s=>s.id===state.site):null;
  const province=selectedSite?.province??null;
  if(!selectedSite){
    if(lastMapSite!==null){mapOverview=true;lastMapSite=null;map.fitBounds(boundaryLayer.getBounds().pad(.08));}
  }else if(lastMapSite!==state.site){
    mapOverview=false;const features=geo.features.filter(f=>f.properties.province===province);map.fitBounds(L.geoJSON({type:'FeatureCollection',features}).getBounds().pad(.12));lastMapSite=state.site;
  }
  for(const s of manifest.sites){
    const visible=mapOverview||!province||s.province===province;
    if(visible&&!map.hasLayer(markers[s.id]))markers[s.id].addTo(map);
    if(!visible&&map.hasLayer(markers[s.id]))map.removeLayer(markers[s.id]);
    const value=valueAt(s.id,state.year),selected=s.id===state.site;
    markers[s.id].setStyle({fillColor:color(value,min,max),color:selected?'#f1ffda':'#10232c',weight:selected?3:1.5,fillOpacity:.95}).setRadius(selected?9:6);
    markers[s.id].setTooltipContent(`${s.name} · ${format(value)} ${v().unit}`);
    if(selected)markers[s.id].bringToFront();
  }
  boundaryLayer.setStyle(f=>{const selected=Boolean(selectedSite)&&(f.properties.id===state.site||(selectedSite.type==='province'&&f.properties.province===selectedSite.province));const shown=mapOverview||!province||f.properties.province===province;return {opacity:shown?1:0,color:selected?'#c3f77a':'#617f85',weight:selected?2:1,fillColor:'#344b48',fillOpacity:shown?(selected?.18:.04):0};});
}

function paintSeaLabels(){
  if(!map)return;
  seaMarkers.forEach(m=>map.removeLayer(m));
  seaMarkers=[];
  for(const [lat,lon,en,es,size] of [[9.05,-85.55,'PACIFIC OCEAN','OCÉANO PACÍFICO',130],[10.55,-83.05,'CARIBBEAN SEA','MAR CARIBE',110]]){
    seaMarkers.push(L.marker([lat,lon],{icon:L.divIcon({className:'point-label sea-label',html:tx(en,es),iconSize:[size,15]}),interactive:false}).addTo(map));
  }
}

function initMap(){
  if(!globalThis.L){$('#map-fallback').hidden=false;return;}
  map=L.map('map',{zoomControl:false,scrollWheelZoom:true,minZoom:7,maxZoom:14}).fitBounds(L.geoJSON(geo).getBounds().pad(.08));
  L.control.zoom({position:'bottomright'}).addTo(map);
  const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).addTo(map);
  let tileErrors=0;tiles.on('tileerror',()=>{if(++tileErrors===5)showError(tx('Base map is unavailable. Boundaries, points, and scientific data still work.','El mapa base no está disponible. Los límites, puntos y datos científicos siguen funcionando.'));});
  boundaryLayer=L.geoJSON(geo,{style:{color:'#617f85',weight:1,fillOpacity:.04},onEachFeature:(f,l)=>{l.bindTooltip(f.properties.name,{sticky:true});l.on('click',()=>selectSite(f.properties.id));}}).addTo(map);
  for(const s of manifest.sites){markers[s.id]=L.circleMarker([s.latitude,s.longitude],{radius:6,fillOpacity:.95}).addTo(map).bindTooltip(s.name,{direction:'top',offset:[0,-8]}).on('click',()=>selectSite(s.id));}
  paintSeaLabels();
  $('#fit-country').onclick=()=>{mapOverview=true;renderMap();map.fitBounds(boundaryLayer.getBounds().pad(.08));};$('#fit-province').onclick=()=>{if(!state.site){mapOverview=true;renderMap();map.fitBounds(boundaryLayer.getBounds().pad(.08));return;}mapOverview=false;renderMap();const province=manifest.sites.find(s=>s.id===state.site).province;const features=geo.features.filter(f=>f.properties.province===province);map.fitBounds(L.geoJSON({type:'FeatureCollection',features}).getBounds().pad(.08));};
  $('#fit-valley').onclick=()=>map.fitBounds([[9.75,-84.45],[10.15,-83.80]]);
  $('#fit-heredia')&&($('#fit-heredia').onclick=()=>map.fitBounds([[9.95,-84.25],[10.80,-83.75]]));
}

function renderChart(){
  const svg=$('#history-chart');
  const mobile=innerWidth<580,W=mobile?500:1100,H=230,left=mobile?48:64,right=18,top=16,bottom=32;
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  if(!state.site){
    svg.innerHTML=`<text x="50%" y="50%" fill="#a1b0bb" text-anchor="middle">${tx('Choose a province above or in the regional scan below to plot its 2001–2025 series.','Elegí una provincia arriba o en el escaneo regional de abajo para graficar su serie 2001–2025.')}</text>`;
    $('#chart-label').textContent=`${v().name} · Costa Rica`;
    const legendWrap=document.querySelector('.chart-legend');
    if(legendWrap)legendWrap.innerHTML=`<i></i><span id="legend-site">${tx('Choose a province','Elegí una provincia')}</span><i class="dash"></i> ${tx('Sen trend','Tendencia de Sen')}`;
    const tooltip=$('#chart-tooltip');
    if(tooltip){tooltip.hidden=true;tooltip.classList.remove('is-visible');tooltip.setAttribute('aria-hidden','true');}
    return;
  }
  const all=series();
  const display=s=>s.filter(p=>p.year>=state.start&&p.year<=state.end&&Number.isFinite(p.value)).map(p=>({...p,value:p.value-(state.anomaly?baseline(s):0)}));
  const primary=display(all),secondary=state.compare?display(series(state.compareSite)):[];
  const combined=[...primary,...secondary];
  if(!combined.length){svg.innerHTML=`<text x="50%" y="50%" fill="#a1b0bb" text-anchor="middle">${tx('No complete years available.','No hay años completos disponibles.')}</text>`;return;}
  let min=Math.min(...combined.map(p=>p.value)),max=Math.max(...combined.map(p=>p.value));
  const padding=(max-min||1)*.18;min-=padding;max+=padding;
  const x=year=>left+(year-state.start)/(state.end-state.start||1)*(W-left-right),y=value=>top+(max-value)/(max-min)*(H-top-bottom);
  const tr=trend(primary),displayTrend=p=>tr.intercept+tr.slope*p.year;
  const ticks=Array.from({length:5},(_,i)=>min+(max-min)*i/4);
  let html=`<defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${currentColor}" stop-opacity=".18"/><stop offset="100%" stop-color="${currentColor}" stop-opacity="0"/></linearGradient></defs>`;
  for(const tick of ticks){html+=`<line x1="${left}" x2="${W-right}" y1="${y(tick)}" y2="${y(tick)}" stroke="#293641" stroke-dasharray="3 5"/><text x="${left-12}" y="${y(tick)+4}" text-anchor="end" fill="#92a4b2" font-size="${mobile?11:10}" font-family="monospace">${format(tick,state.variable==='GWETTOP'?2:state.variable==='PRECTOTCORR'?0:1)}</text>`;}
  const years=Array.from({length:state.end-state.start+1},(_,i)=>state.start+i).filter((yr,i,arr)=>i===0||i===arr.length-1||yr%(mobile?5:3)===0);
  for(const year of years){if(year!==state.start&&year-state.start<2||year!==state.end&&state.end-year<2)continue;html+=`<text x="${x(year)}" y="${H-8}" text-anchor="middle" fill="#92a4b2" font-size="${mobile?11:10}" font-family="monospace">${year}</text>`;}
  const path=pts=>pts.map((p,i)=>`${i?'L':'M'}${x(p.year)},${y(p.value)}`).join(' ');
  if(primary.length){
    html+=`<path d="${path(primary)} L${x(primary.at(-1).year)},${H-bottom} L${x(primary[0].year)},${H-bottom} Z" fill="url(#area)"/><path d="${path(primary)}" stroke="${currentColor}" fill="none" stroke-width="2"/>`;
    if(primary.length>1)html+=`<path d="M${x(primary[0].year)},${y(displayTrend(primary[0]))} L${x(primary.at(-1).year)},${y(displayTrend(primary.at(-1)))}" stroke="${currentColor}" stroke-width="2.2" stroke-dasharray="7 4" opacity=".9"/>`;
  }
  if(secondary.length)html+=`<path d="${path(secondary)}" fill="none" stroke="#62c9ed" stroke-width="2"/>`;
  if(state.year>=state.start&&state.year<=state.end)html+=`<line x1="${x(state.year)}" x2="${x(state.year)}" y1="${top}" y2="${H-bottom}" stroke="#c3f77a" opacity=".25"/>`;
  for(const [kind,pts] of [['main',primary],['compare',secondary]])for(const p of pts){
    const name=kind==='main'?data[state.site].name:data[state.compareSite].name;
    const label=`${name}, ${p.year}: ${signed(p.value)} ${state.anomaly?deltaUnit():v().unit}`;
    html+=`<circle class="chart-point" data-kind="${kind}" data-year="${p.year}" data-value="${p.value}" cx="${x(p.year)}" cy="${y(p.value)}" r="${mobile?4.5:3.8}" fill="${kind==='main'?currentColor:'#62c9ed'}" tabindex="0" aria-label="${label}"><title>${label}</title></circle>`;
  }
  svg.innerHTML=html;

  let corrText='';
  if(state.compare&&primary.length&&secondary.length){
    const mapB=new Map(secondary.map(p=>[p.year,p.value]));
    const xs=[],ys=[];
    for(const p of primary)if(mapB.has(p.year)){xs.push(p.value);ys.push(mapB.get(p.year));}
    const r=pearsonCorrelation(xs,ys);
    if(Number.isFinite(r))corrText=` · r = ${format(r,2)}`;
  }

  const legendWrap=document.querySelector('.chart-legend');
  if(legendWrap)legendWrap.innerHTML=`<i></i><span id="legend-site">${data[state.site].name}${state.compare?` / ${data[state.compareSite].name} (${tx('blue','azul')}${corrText})`:''}</span><i class="dash"></i> ${tx('Sen trend','Tendencia de Sen')}`;

  $('#chart-label').textContent=`${v().name} · ${state.anomaly?tx('deviation from 2001–2010 · ','desviación respecto a 2001–2010 · '):''}${state.anomaly?deltaUnit():v().unit}`;
  const tooltip=$('#chart-tooltip');
  tooltip.hidden=false;
  tooltip.classList.remove('is-visible');
  tooltip.setAttribute('aria-hidden','true');
  const mainBase=baseline(series(state.site));
  const cmpBase=state.compare?baseline(series(state.compareSite)):null;
  svg.querySelectorAll('.chart-point').forEach(el=>{
    const show=()=>{
      const yr=+el.dataset.year,val=+el.dataset.value,kind=el.dataset.kind;
      const siteId=kind==='main'?state.site:state.compareSite;
      const base=kind==='main'?mainBase:cmpBase;
      const unit=state.anomaly?deltaUnit():v().unit;
      const anom=state.anomaly?val:(Number.isFinite(base)?val-base:null);
      const otherId=state.compare?(kind==='main'?state.compareSite:state.site):null;
      const otherRaw=otherId?valueAt(otherId,yr):null;
      const otherVal=Number.isFinite(otherRaw)?(state.anomaly&&Number.isFinite(kind==='main'?cmpBase:mainBase)?otherRaw-(kind==='main'?cmpBase:mainBase):state.anomaly?null:otherRaw):null;
      tooltip.innerHTML=`<div class="tt-head"><span>${data[siteId].name}</span><b>${yr}</b></div><div class="tt-val">${state.anomaly?signed(val):format(val)} <small>${unit}</small></div>${Number.isFinite(anom)&&!state.anomaly?`<div class="tt-sub">${tx('vs 2001–2010','vs 2001–2010')}: ${signed(anom)} ${deltaUnit()}</div>`:''}${Number.isFinite(otherVal)?`<div class="tt-cmp">${data[otherId].name}: ${state.anomaly?signed(otherVal):format(otherVal)} ${unit}</div>`:''}`;
      const p=svg.createSVGPoint();p.x=+el.getAttribute('cx');p.y=+el.getAttribute('cy');
      const pos=p.matrixTransform(svg.getScreenCTM()),rect=$('.chart-wrap').getBoundingClientRect();
      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden','false');
      tooltip.style.left=Math.min(Math.max(4,pos.x-rect.left-tooltip.offsetWidth/2),Math.max(4,rect.width-tooltip.offsetWidth-4))+'px';
      tooltip.style.top=Math.max(4,pos.y-rect.top-tooltip.offsetHeight-12)+'px';
    };
    const hide=()=>{tooltip.classList.remove('is-visible');tooltip.setAttribute('aria-hidden','true');};
    el.addEventListener('pointerenter',show);el.addEventListener('focus',show);el.addEventListener('pointerleave',hide);el.addEventListener('blur',hide);
    el.addEventListener('click',()=>setYear(+el.dataset.year));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setYear(+el.dataset.year);}});
  });
}

function renderProvinceScan(slopeDigits){
  const scanEl=$('#province-scan');
  if(!scanEl||!manifest)return;
  scanEl.innerHTML=PROVINCE_IDS.filter(id=>data[id]).map(id=>{
    const pt=trend(series(id).filter(d=>d.year>=state.start&&d.year<=state.end));
    const pSig=pt.n>=10&&!pt.autocorrelated&&pt.p<.05;
    const pSlope=pt.slope===null?'—':`${signed(pt.slope*10,slopeDigits)} ${deltaUnit()}`;
    const tag=pt.n<10?`< 10${tx('y','a')}`:pt.autocorrelated?tx('autocorr.','autocorr.'):pSig?`p ${pt.p<.001?'<0.001':'='+format(pt.p,3)} ★`:`n.s.`;
    const cls=`prov-card${id===state.site?' is-active':''}${pSig?' is-sig':pt.autocorrelated?' is-warn':''}`;
    return `<button type="button" class="${cls}" data-prov="${id}"><span class="prov-name">${data[id].name}</span><strong class="prov-slope">${pSlope}<small>/${tx('dec','déc')}</small></strong><span class="prov-tag">${tag}</span></button>`;
  }).join('');
  scanEl.querySelectorAll('.prov-card').forEach(btn=>{
    btn.onclick=()=>selectSite(btn.dataset.prov);
  });
}

function renderStats(){
  const slopeDigits=state.variable==='GWETTOP'?3:2;
  if(!state.site){
    $('#slope').textContent='—';
    $('#significance').textContent=tx('Choose a province','Elegí una provincia');
    $('#significance').style.color='var(--text)';
    $('#pvalue').textContent=tx('Select a province or canton to compute Mann–Kendall','Seleccioná una provincia o cantón para calcular Mann–Kendall');
    $('#sample-count').textContent=`— / ${state.start}–${state.end}`;
    $('#coverage-note').textContent=tx('Daily data aggregation · years with 12 valid months','Agregación de datos diarios · años con 12 meses válidos');
    $('#flow-variable').textContent=v().short;
    $('#flow-region').textContent=tx('Costa Rica (choose)','Costa Rica (elegí)');
    $('#flow-period').textContent=`${state.start}–${state.end}`;
    $('#flow-trend').textContent='—';
    $('#flow-significance').textContent='—';
    $('#flow-sig-step')?.classList.toggle('is-sig',false);
    $('#stat-significance')?.classList.toggle('is-sig',false);
    const verdictEl=$('#trend-verdict');
    if(verdictEl){
      verdictEl.className='trend-verdict is-neutral';
      $('#verdict-badge').textContent=tx('NATIONAL OVERVIEW','VISTA NACIONAL');
      $('#verdict-summary').textContent=tx(
        'Choose a province in the Explorer or click any province card below to inspect its Theil–Sen slope and Mann–Kendall test.',
        'Elegí una provincia en el Explorador o hacé clic en cualquier provincia abajo para inspeccionar su pendiente Theil–Sen y prueba Mann–Kendall.'
      );
    }
    const pop=$('#stat-popover');
    if(pop){
      pop.innerHTML=getLang()==='es'
        ?`<strong>¿Cómo interpreta GaiaTrack esta tendencia?</strong><ul><li><b>Pendiente de Theil–Sen:</b> mediana de todas las pendientes entre pares de años, resistente a valores atípicos.</li><li><b>Prueba de Mann–Kendall (α = 0,05):</b> evalúa aumentos o descensos monótonos sostenidos.</li><li><b>Selección territorial:</b> elegí una provincia para ver los resultados de su punto de referencia.</li></ul>`
        :`<strong>How does GaiaTrack test this trend?</strong><ul><li><b>Theil–Sen slope:</b> median of pairwise year-to-year slopes, resistant to isolated extremes.</li><li><b>Mann–Kendall test (α = 0.05):</b> non-parametric test for sustained monotonic increases or decreases.</li><li><b>Territory selection:</b> choose a province to inspect its reference point results.</li></ul>`;
    }
    renderProvinceScan(slopeDigits);
    $('#science-note').textContent=tx('Annual aggregation removes seasonal cycles to isolate multi-year trends. Exploratory test without multiple-comparison correction; a trend does not establish causes.','La agregación anual elimina ciclos estacionales para aislar tendencias multianuales. Prueba exploratoria sin corrección por comparaciones múltiples; una tendencia no determina sus causas.');
    return;
  }
  const s=data[state.site],points=series().filter(d=>d.year>=state.start&&d.year<=state.end),t=trend(points);
  const decSlope=t.slope===null?null:t.slope*10;
  const slopeStr=decSlope===null?tx('No data','Sin datos'):`${signed(decSlope,slopeDigits)} ${deltaUnit()}`;
  const isSig=t.n>=10&&!t.autocorrelated&&t.p<.05;
  $('#slope').textContent=slopeStr;
  $('#significance').textContent=t.n<10?tx('Period too short','Período insuficiente'):t.autocorrelated?tx('Check dependence','Revisar dependencia'):isSig?tx('Statistical signal','Señal estadística'):tx('Insufficient evidence','Sin evidencia suficiente');
  $('#significance').style.color=isSig?'var(--accent)':t.autocorrelated?'#f5b942':'var(--text)';
  $('#pvalue').textContent=t.p===null?tx('At least 10 complete years required','Se requieren al menos 10 años completos'):`p ${t.p<.001?'< 0.001':'= '+format(t.p,3)} · ${tx('Two-sided Mann–Kendall · α = 0.05','Mann–Kendall bilateral · α = 0,05')}`;
  $('#sample-count').textContent=`${t.n} ${tx('years','años')} / ${state.start}–${state.end}`;
  $('#coverage-note').textContent=tx('Daily data aggregation · years with 12 valid months','Agregación de datos diarios · años con 12 meses válidos');

  // 5-step Detective workflow bar
  $('#flow-variable').textContent=v().short;
  $('#flow-region').textContent=s.name;
  $('#flow-period').textContent=`${state.start}–${state.end} (${t.n}${tx('y','a')})`;
  $('#flow-trend').textContent=decSlope===null?'—':`${signed(decSlope,slopeDigits)} ${deltaUnit()}/${tx('dec','déc')}`;
  $('#flow-significance').textContent=t.n<10?tx('< 10 yrs','< 10 años'):t.autocorrelated?tx('Check lag-1','Revisar lag-1'):isSig?`p ${t.p<.001?'<0.001':'='+format(t.p,3)} ✓`:`p = ${format(t.p,3)} (n.s.)`;
  $('#flow-sig-step')?.classList.toggle('is-sig',isSig);
  $('#stat-significance')?.classList.toggle('is-sig',isSig);

  // Verdict banner
  const verdictEl=$('#trend-verdict');
  if(verdictEl){
    verdictEl.className=`trend-verdict ${isSig?'is-sig':t.autocorrelated?'is-warn':'is-neutral'}`;
    $('#verdict-badge').textContent=t.n<10?tx('SHORT PERIOD','PERÍODO CORTO'):t.autocorrelated?tx('CHECK DEPENDENCE','REVISAR DEPENDENCIA'):isSig?tx('SIGNIFICANT TREND · α = 0.05','TENDENCIA SIGNIFICATIVA · α = 0,05'):tx('NOT SIGNIFICANT · α = 0.05','SIN SIGNIFICANCIA · α = 0,05');
    $('#verdict-summary').textContent=t.n<10
      ?tx(`Select at least 10 complete years in ${s.name} to run the Mann–Kendall significance test.`,`Seleccioná al menos 10 años completos en ${s.name} para ejecutar la prueba de significancia Mann–Kendall.`)
      :t.autocorrelated
        ?tx(`${s.name} (${v().short}, ${state.start}–${state.end}): ${slopeStr}/${tx('decade','década')}. Lag-1 residual autocorrelation exceeded |r| > 1.96/√n; treat p ${t.p<.001?'< 0.001':'= '+format(t.p,3)} as exploratory.`,
            `${s.name} (${v().short}, ${state.start}–${state.end}): ${slopeStr}/década. La autocorrelación residual de orden 1 superó |r| > 1,96/√n; interpretá p ${t.p<.001?'< 0.001':'= '+format(t.p,3)} como exploratorio.`)
        :isSig
          ?tx(`${s.name} (${v().short}, ${state.start}–${state.end}): ${decSlope>0?tx('upward','ascendente'):decSlope<0?tx('downward','descendente'):tx('flat','estable')} slope of ${slopeStr}/decade with significant trend evidence (p ${t.p<.001?'< 0.001':'= '+format(t.p,3)}).`,
              `${s.name} (${v().short}, ${state.start}–${state.end}): tendencia ${decSlope>0?'ascendente':decSlope<0?'descendente':'estable'} de ${slopeStr}/década con evidencia significativa (p ${t.p<.001?'< 0.001':'= '+format(t.p,3)}).`)
          :tx(`${s.name} (${v().short}, ${state.start}–${state.end}): estimated change of ${slopeStr}/decade, but natural interannual variability keeps p = ${format(t.p,3)} above 0.05.`,
              `${s.name} (${v().short}, ${state.start}–${state.end}): cambio estimado de ${slopeStr}/década, pero la variabilidad interanual mantiene p = ${format(t.p,3)} por encima de 0,05.`);
  }

  // Interactive "?" significance explainer popover content
  const pop=$('#stat-popover');
  if(pop){
    pop.innerHTML=getLang()==='es'
      ?`<strong>¿Cómo interpreta GaiaTrack esta tendencia?</strong><ul><li><b>Pendiente de Theil–Sen:</b> mediana de todas las pendientes entre pares de años (${slopeStr}/década). Resiste valores atípicos extremos.</li><li><b>Prueba de Mann–Kendall (α = 0,05):</b> evalúa si existe un aumento o descenso monótono sostenido sin asumir distribución normal.</li><li><b>Autocorrelación lag-1:</b> ${t.autocorrelated?'Detectada aquí (|r| > 1,96/√n); puede inflar falsos positivos, por lo que no confirmamos significancia.':'Sin dependencia residual relevante en este período.'}</li></ul>`
      :`<strong>How does GaiaTrack test this trend?</strong><ul><li><b>Theil–Sen slope:</b> median of all pairwise year-to-year slopes (${slopeStr}/decade), resistant to isolated extremes.</li><li><b>Mann–Kendall test (α = 0.05):</b> non-parametric test checking whether values consistently rise or fall over the selected window.</li><li><b>Lag-1 autocorrelation:</b> ${t.autocorrelated?'Detected here (|r| > 1.96/√n); year-to-year persistence can inflate false positives, so significance is held back.':'No strong residual lag-1 dependence detected for this window.'}</li></ul>`;
  }

  // 7-province regional scan ("Where is it changing?")
  renderProvinceScan(slopeDigits);

  $('#science-note').textContent=t.autocorrelated
    ?tx('Annual aggregation removes seasonal cycles, yet lag-1 residual autocorrelation was detected here. Unadjusted p-value is exploratory and cannot confirm significance.','La agregación anual elimina ciclos estacionales, pero aquí se detectó autocorrelación de orden 1 en los residuos. El valor p sin corrección se muestra como exploratorio; no permite confirmar significancia.')
    :tx('Annual aggregation removes seasonal cycles to isolate multi-year trends. Exploratory test without multiple-comparison correction; a trend does not establish causes.','La agregación anual elimina ciclos estacionales para aislar tendencias multianuales. Prueba exploratoria sin corrección por comparaciones múltiples; una tendencia no determina sus causas.');
}

function setPeriod(){
  stop();state.start=+$('#start-year').value;state.end=+$('#end-year').value;
  if(state.end<state.start){state.end=state.start;$('#end-year').value=state.end;}
  state.year=Math.max(state.start,Math.min(state.end,state.year));
  $('#year-slider').min=state.start;$('#year-slider').max=state.end;$('#year-slider').value=state.year;$('#selected-year').textContent=state.year;
  const tickYears=[state.start,...[2005,2010,2015,2020].filter(y=>y>state.start&&y<state.end),state.end];
  $('.slider-ticks').innerHTML=[...new Set(tickYears)].map(y=>`<span>${y}</span>`).join('');
  document.querySelectorAll('.period-presets .preset-btn').forEach(b=>{
    const p=b.dataset.preset;
    const match=(p==='all'&&state.start===2001&&state.end===2025)||(p==='15'&&state.start===2011&&state.end===2025)||(p==='10'&&state.start===2016&&state.end===2025);
    b.classList.toggle('selected',match);
    b.setAttribute('aria-pressed',String(match));
  });
  render();
}

let methodTab='all';
function renderMethodContent(){
  const s=state.site?data[state.site]:data['san-jose'];
  const loc=locale();
  const rows=rawVariables.map(p=>`<tr><td>${p[getLang()].name}<br><small>${p.id}</small></td><td>${p[getLang()].definition}</td></tr>`).join('');
  const es=getLang()==='es';
  const tabs=es
    ?[['all','Todo'],['sources','Fuentes'],['variables','Variables'],['stats','Tendencia y p'],['credits','Cartografía']]
    :[['all','All'],['sources','Sources'],['variables','Variables'],['stats','Trend & p-value'],['credits','Cartography']];
  const nav=`<div class="method-tabs" role="tablist" aria-label="${es?'Secciones del método':'Method sections'}">${tabs.map(([id,lbl])=>`<button type="button" class="method-tab ${methodTab===id?'selected':''}" data-mtab="${id}" role="tab" aria-selected="${methodTab===id}">${lbl}</button>`).join('')}</div>`;
  const body=es
    ?`<section class="method-section" data-msec="sources"><h3>Fuente real y reproducible</h3><p>NASA POWER: series diarias entre 2001 y 2025. Descarga original del punto: ${s.sourceRetrievedAt?new Date(s.sourceRetrievedAt).toLocaleString(loc,{timeZone:'America/Costa_Rica'}):'fecha no registrada en la copia inicial'}. Procesamiento local: ${s.processedAt?new Date(s.processedAt).toLocaleString(loc,{timeZone:'America/Costa_Rica'}):'fecha no registrada'}. Los datos se conservan localmente para que la demostración funcione sin depender de la API. Esta versión no utiliza datos ambientales simulados.</p><p><a href="${s.url}" target="_blank" rel="noopener">Abrir consulta original del punto de ${s.name}</a> · <a href="https://power.larc.nasa.gov/docs/" target="_blank" rel="noopener">Documentación NASA POWER</a></p><h3>Cobertura nacional; muestreo por punto</h3><p>Se incluyen las siete provincias de Costa Rica y los 83 cantones de la cartografía incluida. Cada consulta usa un punto interior calculado a partir de su polígono; no representa una estación meteorológica, la cabecera ni un promedio de toda la provincia o el cantón. Los polígonos sirven para seleccionar el territorio. Los círculos muestran valores de los puntos.</p><p>La meteorología y la humedad provienen del modelo MERRA-2; la radiación de los productos de NASA POWER (CERES en este período). Las celdas son amplias: 0,5° × 0,625° para meteorología y 1° × 1° para radiación. Territorios cercanos pueden tener valores idénticos. No se pueden inferir diferencias entre barrios ni condiciones de una finca.</p></section><section class="method-section" data-msec="variables"><h3>Qué mide cada variable</h3><table><thead><tr><th>Variable</th><th>Definición anual</th></tr></thead><tbody>${rows}</tbody></table><h3>Agregación y referencia</h3><p>Los valores faltantes de NASA se excluyen. Un mes requiere al menos 90 % de días válidos por variable; un año requiere 12 meses válidos. Los promedios se ponderan por los días del mes. La lluvia es la suma de las medias diarias mensuales multiplicadas por los días del mes; con días faltantes es una estimación de acumulación. Temperatura mínima y máxima son promedios de extremos diarios, no récords absolutos.</p><p>Las anomalías usan la media de los valores anuales de 2001–2010 de cada punto. Es una referencia interna de diez años, no una normal climatológica de treinta años. Los períodos inicial y final controlan el análisis; el deslizador cambia el año mostrado en el mapa.</p></section><section class="method-section" data-msec="stats"><h3>Tendencia y evidencia</h3><p>La pendiente es la mediana de las pendientes entre pares de años (Theil–Sen), expresada por década. La prueba bilateral de Mann–Kendall usa corrección por empates, corrección de continuidad y aproximación normal; se muestra p solo con 10 o más años válidos. Se usa α = 0,05. Se revisa la correlación de orden 1 de los residuos sin tendencia y se marca para revisión si |r| &gt; 1,96/√n. Este control es orientativo y no corrige el valor p. No se corrige por múltiples pruebas. La evidencia es exploratoria.</p><p>Una tendencia del período no prueba atribución al cambio climático global. Las variaciones estacionales se reducen mediante agregación anual; la variabilidad interanual permanece. El histórico no se extrapola para pronosticar. El panel de próximos días usa modelos meteorológicos vía Open-Meteo; no se emiten alertas de emergencia.</p></section><section class="method-section" data-msec="credits"><h3>Cartografía y créditos</h3><p>Límites cantonales: <a href="https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/" target="_blank" rel="noopener">geoBoundaries gbOpen / Wikimedia Commons</a>, representación de 2020, CC0 1.0. No constituyen cartografía oficial vigente. Mapa base: OpenStreetMap. Pronósticos: Open-Meteo (CC BY 4.0); serie horaria, radiación solar y humedad del suelo, con dispersión GFS independiente. Motor: Leaflet 1.9.4 (BSD-2-Clause). GaiaTrack es un proyecto independiente inspirado en NASA Space Apps; no es una aplicación oficial de NASA.</p></section>`
    :`<section class="method-section" data-msec="sources"><h3>Real &amp; reproducible source</h3><p>NASA POWER: daily series from 2001 to 2025. Original point retrieval: ${s.sourceRetrievedAt?new Date(s.sourceRetrievedAt).toLocaleString(loc,{timeZone:'America/Costa_Rica'}):'not recorded in initial snapshot'}. Local processing: ${s.processedAt?new Date(s.processedAt).toLocaleString(loc,{timeZone:'America/Costa_Rica'}):'not recorded'}. Data are stored locally so the observatory works reliably offline. This version uses no simulated environmental data.</p><p><a href="${s.url}" target="_blank" rel="noopener">Open original NASA POWER query for ${s.name}</a> · <a href="https://power.larc.nasa.gov/docs/" target="_blank" rel="noopener">NASA POWER documentation</a></p><h3>National coverage; point sampling</h3><p>All seven provinces of Costa Rica are included alongside the 83 cantons in the included boundary dataset. Each query uses an interior point computed from its polygon; it does not represent a weather station, town center, or an area-wide average. Polygons select the territory; circles display point values.</p><p>Meteorology and moisture come from MERRA-2; solar radiation comes from NASA POWER products (CERES for this period). Grid cells are coarse: 0.5° × 0.625° for meteorology and 1° × 1° for radiation. Nearby territories may share identical values. Neighborhood or farm-scale differences cannot be inferred.</p></section><section class="method-section" data-msec="variables"><h3>What each variable measures</h3><table><thead><tr><th>Variable</th><th>Annual definition</th></tr></thead><tbody>${rows}</tbody></table><h3>Aggregation &amp; baseline</h3><p>NASA missing values are excluded. A valid month requires at least 90% valid days per variable; a valid year requires 12 valid months. Annual means are weighted by days per month. Rainfall sums monthly daily means multiplied by days in each month; with missing days it is an estimated accumulation. Minimum and maximum temperatures are averages of daily extremes, not all-time records.</p><p>Anomalies use the 2001–2010 annual mean of each point as a 10-year internal baseline (not a 30-year climatological normal). Start and end selectors control the trend analysis; the slider changes the year shown on the map.</p></section><section class="method-section" data-msec="stats"><h3>Trend &amp; significance</h3><p>Slope is the median of pairwise year slopes (Theil–Sen), expressed per decade. The two-sided Mann–Kendall test applies tie correction, continuity correction, and normal approximation; p is shown only with 10 or more valid years at α = 0.05. Lag-1 autocorrelation of detrended residuals is flagged for review when |r| &gt; 1.96/√n; this check is advisory and does not adjust p. No multiple-testing correction is applied. Evidence is exploratory.</p><p>A period trend does not by itself attribute global climate change. Seasonal cycles are dampened by annual aggregation while interannual variability remains. Historical data are not extrapolated to forecast. The 7-day forecast panel uses Open-Meteo weather models; no emergency alerts are issued.</p></section><section class="method-section" data-msec="credits"><h3>Cartography &amp; credits</h3><p>Boundaries: <a href="https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/" target="_blank" rel="noopener">geoBoundaries gbOpen / Wikimedia Commons</a>, 2020 snapshot, CC0 1.0 (not official legal boundaries). Base map: OpenStreetMap. Forecasts: Open-Meteo (CC BY 4.0); hourly timeline, solar radiation, soil moisture, and independent GFS ensemble spread. Map engine: Leaflet 1.9.4 (BSD-2-Clause). GaiaTrack is an independent NASA Space Apps project, not an official NASA application.</p></section>`;
  const box=$('#method-content');
  box.innerHTML=nav+body;
  const applyFilter=()=>{
    box.querySelectorAll('.method-tab').forEach(t=>{const on=t.dataset.mtab===methodTab;t.classList.toggle('selected',on);t.setAttribute('aria-selected',String(on));});
    box.querySelectorAll('.method-section').forEach(sec=>{sec.hidden=methodTab!=='all'&&sec.dataset.msec!==methodTab;});
  };
  applyFilter();
  box.querySelectorAll('.method-tab').forEach(btn=>btn.onclick=()=>{methodTab=btn.dataset.mtab;applyFilter();});
}

function showMethod(){methodTab='all';renderMethodContent();$('#method-dialog').showModal();}

function download(){
  if(!state.site)return;
  const rows=['# GaiaTrack | NASA POWER | Reference point, not territorial average',`# Variable: ${v().id}; ${v().definition}`,`# Anomaly baseline: 2001-2010; source retrieved: ${data[state.site].sourceRetrievedAt??'not recorded'}`,`# Source query: ${data[state.site].url}`,'territory,latitude,longitude,year,variable,unit,value,anomaly_2001_2010,valid_days,expected_days,coverage_pct,valid_months,estimated_accumulation'];
  const ids=state.compare?[state.site,state.compareSite]:[state.site];
  for(const id of [...new Set(ids)]){
    const all=series(id),b=baseline(all);
    for(const p of all.filter(p=>p.year>=state.start&&p.year<=state.end)){
      const quality=historyCoverage(data[id].monthly,state.variable,p.year);
      rows.push([data[id].name,data[id].latitude,data[id].longitude,p.year,v().id,v().unit,Number.isFinite(p.value)?p.value.toFixed(5):'',Number.isFinite(p.value)&&Number.isFinite(b)?(p.value-b).toFixed(5):'',quality.validDays,quality.expectedDays,quality.percent.toFixed(2),quality.validMonths,quality.estimated].join(','));
    }
  }
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`GaiaTrack_${state.site}_${state.variable}_${state.start}-${state.end}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function boot(){
  applyStaticI18n();
  const quality=document.createElement('p');quality.id='history-quality';quality.className='forecast-unit-note';quality.setAttribute('role','status');$('#metric-definition').after(quality);
  initForecast();
  try{
    const r=await fetch('data/manifest.json?v=18');if(!r.ok)throw Error('manifest');manifest=await r.json();
    await Promise.all(manifest.sites.map(async s=>{const r=await fetch(`data/${s.id}.json`);if(!r.ok)throw Error(s.id);data[s.id]=await r.json();}));
    const boundaryResponse=await fetch('data/cantons.geojson?v=18');if(!boundaryResponse.ok)throw Error('cantons');geo=await boundaryResponse.json();
    buildLayerButtons();
    options($('#site-select'),state.site);options($('#compare-site'),state.compareSite);
    for(const id of ['#start-year','#end-year']){$(id).innerHTML=Array.from({length:25},(_,i)=>`<option>${2001+i}</option>`).join('');$(id).onchange=setPeriod;}
    $('#start-year').value=state.start;$('#end-year').value=state.end;
    $('#site-select').onchange=e=>selectSite(e.target.value);$('#province-select').onchange=e=>{if(!e.target.value){selectSite(null);return;}const p=manifest.provinces.find(x=>x.id===e.target.value);if(p)selectSite(p.siteId);};
    $('#year-slider').oninput=e=>{stop();setYear(e.target.value);};
    $('#compare').onchange=e=>{state.compare=e.target.checked;renderChart();};
    $('#compare-site').onchange=e=>{state.compareSite=e.target.value;state.compare=true;$('#compare').checked=true;renderChart();};
    $('#annual-view').onclick=()=>{state.anomaly=false;updateView();};
    $('#anomaly-view').onclick=()=>{state.anomaly=true;updateView();};
    function updateView(){for(const [id,active] of [['#annual-view',!state.anomaly],['#anomaly-view',state.anomaly]]){$(id).classList.toggle('selected',active);$(id).setAttribute('aria-pressed',String(active));}renderChart();}
    $('#play').onclick=()=>{
      if(timer){stop();return;}if(state.start===state.end)return;if(state.year>=state.end)setYear(state.start);
      $('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label',tx('Pause time series','Pausar evolución temporal'));
      timer=setInterval(()=>{if(state.year>=state.end){stop();return;}setYear(state.year+1);},850);
    };
    for(const id of ['#method-open','#sources-open','#help-open'])$(id).onclick=showMethod;
    $('#method-close').onclick=$('#method-done').onclick=()=>$('#method-dialog').close();
    $('#method-dialog').addEventListener('click',e=>{if(e.target===$('#method-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
    $('#download').onclick=download;
    document.querySelectorAll('.period-presets .preset-btn').forEach(btn=>btn.onclick=()=>{
      const p=btn.dataset.preset;
      $('#end-year').value='2025';
      $('#start-year').value=p==='10'?'2016':p==='15'?'2011':'2001';
      setPeriod();
    });
    const helpBtn=$('#sig-help-btn'),pop=$('#stat-popover');
    if(helpBtn&&pop){
      const togglePop=open=>{pop.hidden=!open;pop.classList.toggle('is-open',open);helpBtn.setAttribute('aria-expanded',String(open));};
      helpBtn.onclick=e=>{e.stopPropagation();togglePop(pop.hidden);};
      document.addEventListener('click',e=>{if(!pop.hidden&&!pop.contains(e.target)&&e.target!==helpBtn)togglePop(false);});
    }
    document.querySelectorAll('[data-investigate]').forEach(b=>b.onclick=()=>{
      stop();
      if(b.dataset.site&&data[b.dataset.site])state.site=b.dataset.site;
      if(b.dataset.compare&&data[b.dataset.compare]){state.compareSite=b.dataset.compare;state.compare=true;$('#compare').checked=true;}
      state.variable=b.dataset.investigate;
      $('#start-year').value='2001';$('#end-year').value='2025';
      setPeriod();
      $('#tendencias').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    });
    initMap();render();$('#status').textContent='';
    document.addEventListener('gaiatrack:lang',()=>{
      buildLayerButtons();
      options($('#site-select'),state.site);
      options($('#compare-site'),state.compareSite);
      paintSeaLabels();
      render();
      if($('#method-dialog').open)renderMethodContent();
    });
    window.addEventListener('resize',()=>{renderChart();map?.invalidateSize();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  }catch(e){
    console.error(e);
    showError(tx('Could not load observatory data. Run npm run data and start GaiaTrack with npm start; do not open index.html directly.','No se pudieron cargar los datos del observatorio. Ejecutá npm run data y abrí GaiaTrack con npm start; no abras index.html directamente.'));
  }
}
boot();
