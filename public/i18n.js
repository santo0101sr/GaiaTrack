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
  setText('.topbar nav a[href="#tendencias"]',es?'Tendencias':'Trends');
  setText('.topbar nav a[href="#pronostico"]',es?'Contexto y pronóstico':'Context & Forecast');
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
  if(layersLabel)layersLabel.innerHTML=es?'03 / VARIABLES <span>7</span>':'03 / VARIABLES <span>7</span>';
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
  setAttr('#province-select','aria-label',es?'Seleccionar provincia':'Select province');setAttr('#site-select','aria-label',es?'Seleccionar cantón o vista provincial':'Select canton or province overview');
  setText('#sticky-kicker',es?'⌖ TERRITORIO':'⌖ TERRITORY');
  setText('#sticky-var-kicker','◉ VARIABLE');
  setAttr('#sticky-territory-bar','aria-label',es?'Selector rápido de territorio':'Quick territory selector');
  setAttr('#quick-variable-select','aria-label',es?'Seleccionar variable':'Select variable');
  setText('.comparison-line span',es?'Frente a 2001–2010':'Vs. 2001–2010 baseline');

  setText('.inspector-cta',es?'Analizar tendencia y significancia ':'Analyze trend & significance ');
  const cta=document.querySelector('.inspector-cta');
  if(cta){const sp=document.createElement('span');sp.textContent='↑';cta.appendChild(sp);}

  setText('#tendencias .eyebrow',es?'01 / SERIES TEMPORALES Y SIGNIFICANCIA':'01 / TIME SERIES & SIGNIFICANCE');
  const trH2=document.querySelector('#tendencias h2');
  if(trH2)trH2.innerHTML=es?'La historia detrás de la señal<span>.</span>':'The story behind the signal<span>.</span>';
  setText('#download span',es?'Descargar CSV':'Download CSV');
  const flowLabels=document.querySelectorAll('#analysis-flow .flow-step small');
  const flowCopy=es?['VARIABLE','REGIÓN','PERÍODO','TENDENCIA VISUAL','SIGNIFICANCIA']:['VARIABLE','REGION','PERIOD','VISUAL TREND','SIGNIFICANCE'];
  flowLabels.forEach((el,i)=>{if(flowCopy[i])el.textContent=flowCopy[i];});
  setText('#annual-view',es?'Valores anuales':'Annual values');
  setText('#anomaly-view',es?'Anomalías':'Anomalies');
  const pLabels=document.querySelectorAll('.period-controls label');
  if(pLabels[0]?.firstChild)pLabels[0].firstChild.textContent=es?'Desde ':'From ';
  if(pLabels[1]?.firstChild)pLabels[1].firstChild.textContent=es?'Hasta ':'To ';
  setText('.period-presets button[data-preset="all"]',es?'Todo':'All');
  setText('.period-presets button[data-preset="15"]',es?'15 a':'15y');
  setText('.period-presets button[data-preset="10"]',es?'10 a':'10y');
  setAttr('#sig-help-btn','title',es?'¿Cómo se evalúa la significancia?':'How is significance tested?');
  setAttr('#sig-help-btn','aria-label',es?'¿Cómo se evalúa la significancia?':'How is significance tested?');
  const cmpLabel=document.querySelector('.compare-control');
  if(cmpLabel&&cmpLabel.childNodes[1])cmpLabel.childNodes[1].textContent=es?' Comparar con ':' Compare with ';
  setAttr('#compare-site','aria-label',es?'Provincia o cantón para comparar':'Province or canton to compare');
  const legend=document.querySelector('.chart-legend');
  if(legend&&legend.lastChild&&legend.lastChild.nodeType===3)legend.lastChild.textContent=es?' Tendencia Sen':' Sen trend';
  const sliderLabel=document.querySelector('.time-control>label');
  if(sliderLabel?.firstChild)sliderLabel.firstChild.textContent=es?'AÑO EN EL MAPA ':'MAP YEAR ';
  setAttr('#play','aria-label',es?'Reproducir evolución temporal':'Play time series');

  const statLabels=document.querySelectorAll('.stat-grid .section-label');
  if(statLabels[0])statLabels[0].textContent=es?'TASA DE CAMBIO / DÉCADA':'RATE OF CHANGE / DECADE';
  if(statLabels[1])statLabels[1].textContent=es?'EVIDENCIA DE TENDENCIA':'TREND EVIDENCE';
  if(statLabels[2])statLabels[2].textContent=es?'PERÍODO ANALIZADO':'ANALYZED PERIOD';
  const slopeSmall=document.querySelector('.stat-grid>div:first-child small');
  if(slopeSmall)slopeSmall.textContent=es?'Estimador robusto de Theil–Sen':'Theil–Sen robust slope estimator';
  const calcLabels=document.querySelectorAll('.calc-grid .section-label');
  if(calcLabels[0])calcLabels[0].textContent=es?'Z DESESTACIONALIZADO E IEA':'DESEASONALIZED Z & IEA';
  if(calcLabels[1])calcLabels[1].textContent=es?'PRUEBA T DE WELCH VS. 2001–2010':'WELCH T-TEST VS. 2001–2010';
  if(calcLabels[2])calcLabels[2].textContent=es?'INTERVALOS DE CONFIANZA 95%':'95% CONFIDENCE INTERVALS';
  setText('#calc-guide-summary',es
    ?'📖 Guía rápida: ¿qué mide cada fórmula y cómo interpretarla?'
    :'📖 Quick guide: What does each formula measure and how do I read it?');
  const guideBody=document.querySelector('#calc-guide-body');
  if(guideBody){
    const cards=es?[
      ['Z-Score Desestacionalizado','Z = (X − μ) / s','Mide cuántas desviaciones estándar se aleja un mes respecto a su propio promedio histórico (2001–2010), eliminando el ciclo estación seca/lluviosa.','Cómo leerlo: Z ≈ 0 es normal para ese mes; |Z| > 1,5 señala anomalía fuerte.'],
      ['IEA Calibrado (Estrés Ambiental)','IEA = Σ w·Z\' + γ·max(0,Z\'ₛₘ)·max(0,Z\'ₜ)','Combina calor (+Z_T), falta de lluvia (−Z_P) y sequedad del suelo (−Z_SM), más el término no lineal γ cuando calor y suelo seco coinciden.','Cómo leerlo: IEA ≥ 0,89 indica estrés compuesto; IEA < 0 suele ser superávit benigno (fresco/húmedo).'],
      ['Prueba t de Welch','t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)','Compara el promedio del período elegido frente a la década base 2001–2010, sin asumir varianzas iguales entre ambos períodos.','Cómo leerlo: si p < 0,05, la diferencia de promedio respecto a 2001–2010 es estadísticamente significativa.'],
      ['Intervalos de Confianza (IC 95%)','IC₉₅ = x̄ ± t₀.₀₂₅ · (s / √n)','Estima el rango donde cae la media real con 95% de confianza (t de Student) e incluye el IC no paramétrico de la pendiente por década.','Cómo leerlo: si el IC de la pendiente no cruza el 0, confirma una tendencia sostenida.'],
      ['Theil–Sen, Mann–Kendall y FDR (q)','Pendiente mediana · prueba monótona · q','Theil–Sen calcula la mediana de pendientes entre pares de años (resiste valores atípicos); Mann–Kendall mide monotonicidad; q controla falsos positivos al probar las 7 provincias.','Cómo leerlo: p < 0,05 y q ≤ 0,05 (sin autocorrelación lag-1) respaldan señal real.']
    ]:[
      ['Deseasonalized Z-Score','Z = (X − μ) / s','Measures how many standard deviations a month deviates from its own 2001–2010 calendar-month average, removing normal dry/rainy seasonality.','How to read it: Z ≈ 0 is normal for that month; |Z| > 1.5 flags a strong anomaly.'],
      ['Calibrated IEA (Environmental Stress)','IEA = Σ w·Z\' + γ·max(0,Z\'ₛₘ)·max(0,Z\'ₜ)','Combines heat (+Z_T), rain deficit (−Z_P), and dry soil (−Z_SM), plus a non-linear coupling term γ when heat and dry soil occur together.','How to read it: IEA ≥ 0.89 signals compound stress; IEA < 0 indicates a benign cool/wet surplus.'],
      ['Welch Two-Sample t-Test','t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)','Compares the selected period mean against the 2001–2010 baseline without assuming equal variances between windows.','How to read it: p < 0.05 means the shift in average relative to 2001–2010 is statistically significant.'],
      ['95% Confidence Intervals','CI₉₅ = x̄ ± t₀.₀₂₅ · (s / √n)','Shows the 95% certainty range for the period mean (Student\'s t) alongside the non-parametric 95% CI for the decadal slope.','How to read it: if the slope CI does not include 0, it reinforces a sustained trend.'],
      ['Theil–Sen, Mann–Kendall & FDR (q)','Median slope · monotonic test · q','Theil–Sen takes the median pairwise slope (outlier-resistant); Mann–Kendall tests sustained monotonic direction; Benjamini–Hochberg q limits false positives across all 7 provinces.','How to read it: p < 0.05 and q ≤ 0.05 (without lag-1 autocorrelation) mark robust regional signals.']
    ];
    guideBody.innerHTML=cards.map(([title,formula,what,how])=>`<article class="calc-guide-card"><h4>${title}</h4><code>${formula}</code><p>${what}</p><small>${how}</small></article>`).join('');
  }
  setText('#scan-title',es?'¿DÓNDE ESTÁ CAMBIANDO? · 7 PROVINCIAS DE COSTA RICA':'WHERE IS IT CHANGING? · 7 PROVINCES OF COSTA RICA');
  setText('#scan-hint',es?'Hacé clic en cualquier provincia para inspeccionar su serie':'Click any province to inspect its series');

  setText('#pronostico .eyebrow',es?'05 / PERSPECTIVA A 7 DÍAS · CONTEXTO CORTO PLAZO':'05 / 7-DAY METEOROLOGICAL OUTLOOK · SHORT-TERM CONTEXT');
  const fcH2=document.querySelector('#pronostico h2');
  if(fcH2)fcH2.innerHTML=es?'El clima cambia. Anticipá el tiempo<span>.</span>':'Weather shifts. Stay ahead<span>.</span>';
  setText('#forecast-refresh',es?'↻ Actualizar pronóstico':'↻ Refresh forecast');
  setText('.forecast-badge',es?'PRONÓSTICO DE MODELOS':'MODEL FORECAST');
  setText('.forecast-heading a',es?'Fuentes y método ↗':'Sources & method ↗');
  setText('#forecast-download',es?'↓ Descargar pronóstico CSV':'↓ Download forecast CSV');
  setText('#pronostico>.science-note',es
    ?'El mapa superior muestra el histórico NASA. Este panel muestra pronósticos diarios de modelos meteorológicos para el punto seleccionado, con incertidumbre creciente a mayor plazo.'
    :'The map above shows NASA historical records. This panel shows daily weather-model forecasts for the selected point, with growing uncertainty at longer lead times.');

  setText('.research-title .eyebrow',es?'02 / CASOS DETECTIVESCOS':'02 / DETECTIVE CASE STUDIES');
  setText('.research-title h2',es?'Investigaciones guiadas':'Guided investigations');
  setText('.research-title p',es?'Compará cómo un mismo fenómeno cambia distinto entre regiones de Costa Rica.':'Compare how the same driver trends differently across Costa Rica.');
  const cards=document.querySelectorAll('.research-card');
  const cardData=es?[
    ['TEMPERATURA · VALLE CENTRAL VS. PACÍFICO NORTE','¿Los años recientes<br>han sido más cálidos?','Comparar Heredia y Guanacaste <b>↗</b>'],
    ['PRECIPITACIÓN · CARIBE VS. PACÍFICO','¿Las tendencias de lluvia difieren<br>entre vertientes?','Comparar Limón y Guanacaste <b>↗</b>'],
    ['HUMEDAD DEL SUELO · BOSQUE HÚMEDO VS. SECO','¿Qué cuenta el suelo<br>entre ecosistemas?','Comparar Sarapiquí y Guanacaste <b>↗</b>']
  ]:[
    ['TEMPERATURE · CENTRAL VALLEY VS. NORTH PACIFIC','Have recent years<br>grown warmer?','Compare Heredia & Guanacaste <b>↗</b>'],
    ['PRECIPITATION · CARIBBEAN VS. PACIFIC','Do rainfall trends differ<br>between coasts?','Compare Limón & Guanacaste <b>↗</b>'],
    ['SOIL MOISTURE · RAINFOREST VS. DRY FOREST','What does soil reveal<br>across ecosystems?','Compare Sarapiquí & Guanacaste <b>↗</b>']
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
