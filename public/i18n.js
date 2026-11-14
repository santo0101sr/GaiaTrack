const STORAGE_KEY='gaiatrack_lang';

export function getLang(){
  try{
    const saved=typeof localStorage!=='undefined'?localStorage.getItem(STORAGE_KEY):null;
    return saved==='es'||saved==='en'?saved:'en';
  }catch{return 'en';}
}

export const locale=()=>getLang()==='es'?'es-CR':'en-US';
export const tx=(en,es)=>getLang()==='es'?es:en;

function setText(sel,text){const el=document.querySelector(sel);if(el)el.textContent=text;}
function setAttr(sel,attr,val){const el=document.querySelector(sel);if(el)el.setAttribute(attr,val);}

export function applyStaticI18n(){
  if(typeof document==='undefined')return;
  const es=getLang()==='es';
  document.documentElement.lang=es?'es':'en';
  document.title=es?'GaiaTrack · Observatorio de Costa Rica':'GaiaTrack · Costa Rica Climate Observatory';
  setAttr('meta[name="description"]','content',es
    ?'Explorá temperatura, lluvia, radiación y humedad en las siete provincias de Costa Rica con datos históricos de NASA POWER.'
    :'Explore temperature, rainfall, solar radiation, and moisture across all seven provinces of Costa Rica with NASA POWER historical data.');

  setText('.brand small',es?'OBSERVATORIO CLIMÁTICO · COSTA RICA':'CLIMATE OBSERVATORY · COSTA RICA');
  setAttr('.brand','aria-label',es?'GaiaTrack, inicio':'GaiaTrack, home');
  setText('.topbar nav a[href="#explorador"]',es?'Explorador':'Explorer');
  setText('.topbar nav a[href="#pronostico"]',es?'Pronóstico':'Forecast');
  setText('.topbar nav a[href="#tendencias"]',es?'Tendencias':'Trends');
  const methodBtn=document.querySelector('#method-open');
  if(methodBtn)methodBtn.innerHTML=es?'Datos y método <span>↗</span>':'Data & method <span>↗</span>';
  const regionBadge=document.querySelector('.region-badge');
  if(regionBadge)regionBadge.innerHTML=`<span class="cr-flag" aria-hidden="true"></span> COSTA RICA <span class="version">${es?'7 PROVINCIAS':'7 PROVINCES'}</span>`;

  setText('.intro .eyebrow',es?'CIENCIA ABIERTA · HECHO EN COSTA RICA':'OPEN SCIENCE · BUILT FOR COSTA RICA');
  const h1=document.querySelector('.intro h1');
  if(h1)h1.innerHTML=es?'Un país. <span>Décadas de cambios.</span>':'One country. <span>Decades of change.</span>';
  setText('.intro p',es
    ?'Investigá las señales del clima en las siete provincias de Costa Rica, del Pacífico al Caribe, con detalle cantonal en todo el país.'
    :'Investigate climate signals across all seven provinces of Costa Rica, from the Pacific to the Caribbean, with canton-level detail nationwide.');
  const cov=document.querySelector('.cr-coverage');
  if(cov)cov.innerHTML=es
    ?'<span><strong>7</strong> provincias</span><span><strong>83</strong> cantones</span><span><strong>2</strong> costas</span>'
    :'<span><strong>7</strong> provinces</span><span><strong>83</strong> cantons</span><span><strong>2</strong> coasts</span>';
  setText('.data-badge',es?'● DATOS REALES · NASA POWER':'● REAL DATA · NASA POWER');
  setText('#coverage-label',es?'2001 — 2025 / SERIES HISTÓRICAS':'2001 — 2025 / HISTORICAL SERIES');

  const layersLabel=document.querySelector('.layers>.section-label');
  if(layersLabel)layersLabel.innerHTML=es?'01 / VARIABLES <span>7</span>':'01 / VARIABLES <span>7</span>';
  const layerHelp=document.querySelector('.layer-help p');
  if(layerHelp)layerHelp.innerHTML=es?'Seguí una señal.<br>Descubrí su historia.':'Follow a signal.<br>Uncover its story.';
  setText('#help-open',es?'Cómo interpretar los datos ↗':'How to read the data ↗');

  const mapTitle=document.querySelector('.map-toolbar>span');
  if(mapTitle)mapTitle.innerHTML=`<span class="live-dot"></span> ${es?'EXPLORADOR · COSTA RICA':'EXPLORER · COSTA RICA'}`;
  setText('#fit-country','Costa Rica');setText('#fit-province',es?'Provincia':'Province');
  setText('#fit-valley',es?'Valle Central':'Central Valley');
  setText('#fit-heredia','Heredia');
  setAttr('#map','aria-label',es?'Mapa interactivo de las siete provincias de Costa Rica y sus cantones':'Interactive map of the seven provinces of Costa Rica and their cantons');
  setText('.map-caption small',es?'Puntos de referencia · no promedios provinciales ni cantonales':'Reference points · not provincial or canton averages');
  setText('#map-fallback',es?'El mapa no pudo cargar. Podés explorar todos los datos con el selector de provincia o cantón.':'Map failed to load. You can still explore all data with the province or canton selector.');

  const inspLabels=document.querySelectorAll('.inspector>.section-label');
  if(inspLabels[0])inspLabels[0].innerHTML=es?'PUNTO DE INVESTIGACIÓN <span>↗</span>':'RESEARCH POINT <span>↗</span>';
  if(inspLabels[1])inspLabels[1].textContent=es?'LECTURA DEL TERRITORIO':'TERRITORY READING';
  setText('label[for="province-select"]',es?'Provincia':'Province');setText('.territory-field-label[for="site-select"]',es?'Cantón / vista provincial':'Canton / province overview');setAttr('#province-select','aria-label',es?'Seleccionar provincia':'Select province');setAttr('#site-select','aria-label',es?'Seleccionar cantón o vista provincial':'Select canton or province overview');
  setText('.comparison-line span',es?'Frente a 2001–2010':'Vs. 2001–2010 baseline');

  setText('#pronostico .eyebrow',es?'02 / MIRÁ LOS PRÓXIMOS DÍAS':'02 / LOOK AHEAD');
  const fcH2=document.querySelector('#pronostico h2');
  if(fcH2)fcH2.innerHTML=es?'El clima cambia. Anticipá el tiempo<span>.</span>':'Weather shifts. Stay ahead<span>.</span>';
  setText('#forecast-refresh',es?'↻ Actualizar pronóstico':'↻ Refresh forecast');
  setText('.forecast-badge',es?'PRONÓSTICO DE MODELOS':'MODEL FORECAST');
  setText('.forecast-heading a',es?'Fuentes y método ↗':'Sources & method ↗');
  setText('#forecast-download',es?'↓ Descargar pronóstico CSV':'↓ Download forecast CSV');
  setText('#pronostico>.science-note',es
    ?'El mapa superior muestra el histórico NASA. Este panel muestra pronósticos diarios de modelos meteorológicos para el punto seleccionado, con incertidumbre creciente a mayor plazo.'
    :'The map above shows NASA historical records. This panel shows daily weather-model forecasts for the selected point, with growing uncertainty at longer lead times.');

  setText('#tendencias .eyebrow',es?'03 / EL TIEMPO REVELA EL PATRÓN':'03 / TIME REVEALS THE PATTERN');
  const trH2=document.querySelector('#tendencias h2');
  if(trH2)trH2.innerHTML=es?'La historia detrás de la señal<span>.</span>':'The story behind the signal<span>.</span>';
  setText('#download span',es?'Descargar CSV':'Download CSV');
  setText('#annual-view',es?'Valores anuales':'Annual values');
  setText('#anomaly-view',es?'Anomalías':'Anomalies');
  const pLabels=document.querySelectorAll('.period-controls label');
  if(pLabels[0]?.firstChild)pLabels[0].firstChild.textContent=es?'Desde ':'From ';
  if(pLabels[1]?.firstChild)pLabels[1].firstChild.textContent=es?'Hasta ':'To ';
  const cmpLabel=document.querySelector('.compare-control');
  if(cmpLabel&&cmpLabel.childNodes[1])cmpLabel.childNodes[1].textContent=es?' Comparar con ':' Compare with ';
  setAttr('#compare-site','aria-label',es?'Provincia o cantón para comparar':'Province or canton to compare');
  const sliderLabel=document.querySelector('.time-control>label');
  if(sliderLabel?.firstChild)sliderLabel.firstChild.textContent=es?'AÑO EN EL MAPA ':'MAP YEAR ';
  setAttr('#play','aria-label',es?'Reproducir evolución temporal':'Play time series');

  const statLabels=document.querySelectorAll('.stat-grid .section-label');
  if(statLabels[0])statLabels[0].textContent=es?'TASA DE CAMBIO / DÉCADA':'RATE OF CHANGE / DECADE';
  if(statLabels[1])statLabels[1].textContent=es?'EVIDENCIA DE TENDENCIA':'TREND EVIDENCE';
  if(statLabels[2])statLabels[2].textContent=es?'PERÍODO ANALIZADO':'ANALYZED PERIOD';
  const slopeSmall=document.querySelector('.stat-grid>div:first-child small');
  if(slopeSmall)slopeSmall.textContent=es?'Estimador robusto de Theil–Sen':'Theil–Sen robust slope estimator';

  setText('.research-title .eyebrow',es?'04 / CONECTÁ LAS SEÑALES':'04 / CONNECT THE SIGNALS');
  setText('.research-title h2',es?'Tu próxima investigación':'Your next investigation');
  setText('.research-title p',es?'Una pregunta es el primer paso.':'A question is the first step.');
  const cards=document.querySelectorAll('.research-card');
  const cardData=es?[
    ['TEMPERATURA','¿Los años recientes<br>han sido más cálidos?','Explorar la serie histórica <b>↗</b>'],
    ['PRECIPITACIÓN','¿Cómo varía la lluvia<br>entre un año y otro?','Investigar la precipitación <b>↗</b>'],
    ['HUMEDAD DEL SUELO','¿Qué cuenta el suelo<br>sobre el agua disponible?','Examinar la humedad <b>↗</b>']
  ]:[
    ['TEMPERATURE','Have recent years<br>grown warmer?','Explore time series <b>↗</b>'],
    ['PRECIPITATION','How does rainfall vary<br>from year to year?','Investigate rainfall <b>↗</b>'],
    ['SOIL MOISTURE','What does soil reveal<br>about water availability?','Examine moisture <b>↗</b>']
  ];
  cards.forEach((c,i)=>{
    if(!cardData[i])return;
    const sm=c.querySelector('small'),h3=c.querySelector('h3'),sp=c.querySelector('span:last-child');
    if(sm)sm.textContent=cardData[i][0];
    if(h3)h3.innerHTML=cardData[i][1];
    if(sp)sp.innerHTML=cardData[i][2];
  });

  const footerBrand=document.querySelector('.footer-brand');
  if(footerBrand)footerBrand.innerHTML=`<span class="cr-flag" aria-hidden="true"></span> GaiaTrack <span>/</span> ${es?'Costa Rica, del Pacífico al Caribe.':'Costa Rica, from Pacific to Caribbean.'}`;
  setText('#sources-open',es?'Fuentes y limitaciones ↗':'Sources & limitations ↗');

  setText('#method-dialog .eyebrow',es?'GAIATRACK / CIENCIA TRANSPARENTE':'GAIATRACK / TRANSPARENT SCIENCE');
  setText('#method-dialog h2',es?'Datos que podés investigar.':'Data you can investigate.');
  setText('#method-done',es?'Volver al observatorio':'Back to observatory');

  document.querySelectorAll('.lang-switch button').forEach(b=>{
    const active=b.dataset.lang===(es?'es':'en');
    b.classList.toggle('selected',active);
    b.setAttribute('aria-pressed',String(active));
  });
  const hudLang=document.querySelector('#hud-lang-toggle');
  if(hudLang){
    hudLang.textContent=es?'🌐 EN':'🌐 ES';
    hudLang.setAttribute('aria-label',es?'Switch to English':'Cambiar a Español');
    hudLang.title=es?'Switch to English':'Cambiar a Español';
  }
}

export function setLang(lang){
  const next=lang==='es'?'es':'en';
  try{if(typeof localStorage!=='undefined')localStorage.setItem(STORAGE_KEY,next);}catch{}
  applyStaticI18n();
  if(typeof document!=='undefined'){
    document.dispatchEvent(new CustomEvent('gaiatrack:lang',{detail:{lang:next}}));
  }
  return next;
}

if(typeof document!=='undefined'){
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.lang-switch button[data-lang]');
    if(btn)setLang(btn.dataset.lang);
  });
}
