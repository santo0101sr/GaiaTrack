import {getLang,setLang,tx} from './i18n.js';

// Set your final published Pitch Video URL here once uploaded (e.g. YouTube, Vimeo, Loom, or Drive link).
export let PITCH_VIDEO_URL='';

const PITCH_STORAGE_KEY='gaiatrack_pitch_url';
const DEMO_VIDEO_SRC='assets/gaiatrack-demo.mp4';
const PAPER_PDF_SRC='assets/gaia-eb-research-paper.pdf';
const BRAND_LOGO_SRC='assets/gaia-eb-final.png';

const AUTHORS=[
  {name:'Francinny Saldaña Abarca',initials:'FS'},
  {name:'Darren Araya Monge',initials:'DA'},
  {name:'Santiago Ramirez Víquez',initials:'SR'},
  {name:'Camila Garay Jiménez',initials:'CG'},
  {name:'Derling Torres Campos',initials:'DT'},
  {name:'Kendall Rojas Cartín',initials:'KR'}
];

function safeStorageGet(key){
  try{return typeof localStorage!=='undefined'?localStorage.getItem(key)||'':'';}catch{return '';}
}
function safeStorageSet(key,val){
  try{if(typeof localStorage!=='undefined'){if(val)localStorage.setItem(key,val);else localStorage.removeItem(key);}}catch{}
}
function sanitizeExternalUrl(raw){
  if(!raw||typeof raw!=='string')return '';
  const trimmed=raw.trim();
  if(!trimmed)return '';
  try{
    const parsed=new URL(trimmed,typeof location!=='undefined'?location.href:'https://localhost');
    if(parsed.protocol==='https:'||parsed.protocol==='http:')return parsed.href;
  }catch{}
  return '';
}

export function getPitchUrl(){
  try{
    if(typeof location!=='undefined'&&location.search){
      const param=new URLSearchParams(location.search).get('pitch');
      const validParam=sanitizeExternalUrl(param||'');
      if(validParam)return validParam;
    }
  }catch{}
  return sanitizeExternalUrl(safeStorageGet(PITCH_STORAGE_KEY)||PITCH_VIDEO_URL);
}

function shouldAutoOpenLanding(){
  try{
    if(typeof location==='undefined')return true;
    const params=new URLSearchParams(location.search||'');
    if(params.get('view')==='app')return false;
    const appHashes=new Set(['#tendencias','#explorador','#pronostico','#tiempo-actual']);
    if(appHashes.has(location.hash))return false;
  }catch{}
  return true;
}

let portal=null;
let pitchModal=null;
let openLandingBtn=null;

export function openLanding(){
  if(!portal)return;
  document.body.classList.add('landing-open');
  portal.setAttribute('aria-hidden','false');
  portal.scrollTop=0;
  syncLandingBtn();
}

export function closeLanding(target='app'){
  if(!portal)return;
  const video=portal.querySelector('#landing-demo-video');
  try{video?.pause?.();}catch{}
  document.body.classList.remove('landing-open');
  portal.setAttribute('aria-hidden','true');
  syncLandingBtn();

  const click=sel=>document.querySelector(sel)?.click();
  if(target==='trends'){
    click('#lab-mode');
  }else if(target==='forecast'){
    click('#forecast-mode');
  }else if(target==='radar'){
    if(document.body.classList.contains('lab-open'))click('#close-lab');
    const radarBtn=document.querySelector('#radar-mode-3d');
    if(radarBtn&&!radarBtn.classList.contains('chosen'))radarBtn.click();
  }else{
    if(document.body.classList.contains('lab-open'))click('#close-lab');
    const radarActive=document.querySelector('#radar-mode-3d')?.classList.contains('chosen');
    if(radarActive||document.body.classList.contains('intro-playing'))click('#region-mode');
  }
}

function syncLandingBtn(){
  if(!openLandingBtn)return;
  openLandingBtn.innerHTML=tx('✦ Overview','✦ Proyecto');
  openLandingBtn.setAttribute('aria-label',tx('Return to GaiaTrack project overview','Volver a la portada del proyecto GaiaTrack'));
}

function openPitchFlow(){
  const url=getPitchUrl();
  if(url){
    if(typeof window!=='undefined'&&window.open)window.open(url,'_blank','noopener,noreferrer');
    return;
  }
  showPitchModal();
}

function showPitchModal(){
  if(!pitchModal)return;
  const input=pitchModal.querySelector('#lp-pitch-url-input');
  const saved=getPitchUrl();
  if(input)input.value=saved;
  const msg=pitchModal.querySelector('#lp-pitch-feedback');
  if(msg)msg.textContent='';
  if(typeof pitchModal.showModal==='function')pitchModal.showModal();
  else pitchModal.setAttribute('open','');
}

function closePitchModal(){
  if(!pitchModal)return;
  if(typeof pitchModal.close==='function')pitchModal.close();
  else pitchModal.removeAttribute('open');
}

function buildContent(){
  const lang=getLang();
  const hasPitch=Boolean(getPitchUrl());
  const pitchBadge=hasPitch
    ?tx('Ready · External Pitch Link','Disponible · Enlace externo')
    :tx('Pending · Link Slot Ready','Próximamente · Espacio listo');
  const apaCitation=tx(
    'Saldaña Abarca, F., Araya Monge, D., Ramirez Víquez, S., Garay Jiménez, C., Torres Campos, D., & Rojas Cartín, K. (2026). GaiaTrack as a System for Detecting Environmental Stress and Simulating Nature-Based Interventions in Costa Rica. Gaia Environment & Benefits.',
    'Saldaña Abarca, F., Araya Monge, D., Ramirez Víquez, S., Garay Jiménez, C., Torres Campos, D., & Rojas Cartín, K. (2026). GaiaTrack como sistema de detección de estrés ambiental y simulación de intervenciones basadas en la naturaleza en Costa Rica. Gaia Environment & Benefits.'
  );

  return `
    <header class="lp-nav">
      <div class="lp-nav-inner">
        <a href="#lp-top" class="lp-brand" id="lp-brand-home">
          <span class="lp-logo-pill"><img src="${BRAND_LOGO_SRC}" alt="Gaia E&amp;B — Environment &amp; Benefits"></span>
          <span class="lp-brand-tag">GaiaTrack</span>
        </a>
        <nav class="lp-links" aria-label="${tx('Overview navigation','Navegación de portada')}">
          <a href="#lp-problem">${tx('Problem & Solution','Problema y Solución')}</a>
          <a href="#lp-pipeline">${tx('Pipeline','Pipeline')}</a>
          <a href="#lp-features">${tx('Modules','Módulos')}</a>
          <a href="#lp-demo">${tx('Demo & Cases','Demo y Casos')}</a>
          <a href="#lp-authors">${tx('Authors','Autores')}</a>
        </nav>
        <div class="lp-nav-actions">
          <div class="lp-lang-toggle" role="group" aria-label="${tx('Language','Idioma')}">
            <button type="button" data-lp-lang="en" class="${lang==='en'?'active':''}" aria-pressed="${lang==='en'}">EN</button>
            <button type="button" data-lp-lang="es" class="${lang==='es'?'active':''}" aria-pressed="${lang==='es'}">ES</button>
          </div>
          <a class="lp-btn lp-btn-secondary lp-btn-sm" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${tx('Paper PDF ↗','Paper PDF ↗')}</a>
          <button type="button" class="lp-btn lp-btn-primary lp-btn-sm" id="lp-nav-launch">${tx('Launch 3D App →','Ir a la App 3D →')}</button>
        </div>
      </div>
    </header>

    <div class="lp-shell" id="lp-top">
      <section class="lp-hero">
        <div>
          <span class="lp-eyebrow">NASA SPACE APPS CHALLENGE · GAIA E&amp;B · COSTA RICA</span>
          <h1>${tx(
            'Detecting <em>environmental stress</em> and simulating <em>nature-based interventions</em> across Costa Rica.',
            'Detección de <em>estrés ambiental</em> y simulación de <em>intervenciones basadas en la naturaleza</em> en Costa Rica.'
          )}</h1>
          <p class="lp-lead">${tx(
            'GaiaTrack (Gaia Environment & Benefits) integrates satellite observations, meteorological reanalysis, and cantonal 3D visualization to turn heterogeneous climate variables into traceable early warnings and nature-based planning across Costa Rica.',
            'GaiaTrack (Gaia Environment & Benefits) integra observaciones satelitales, reanálisis meteorológico y visualización 3D cantonal para convertir variables ambientales heterogéneas en alertas tempranas trazables y planificación basada en la naturaleza en Costa Rica.'
          )}</p>
          <div class="lp-hero-ctas">
            <button type="button" class="lp-btn lp-btn-primary" id="landing-enter-app">${tx('⌖ Launch 3D Observatory →','⌖ Entrar al Observatorio 3D →')}</button>
            <a class="lp-btn lp-btn-secondary" id="landing-paper-link" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${tx('📄 Read Research Paper (PDF) ↗','📄 Leer Paper Científico (PDF) ↗')}</a>
            <button type="button" class="lp-btn lp-btn-pitch" id="landing-pitch-btn">${tx('🎬 Presentation Pitch Video','🎬 Video de Presentación (Pitch)')}</button>
          </div>
          <div class="lp-pitch-status">
            <span>${tx('Pitch Video Status:','Estado del Video Pitch:')}</span>
            <strong>${pitchBadge}</strong>
            <span>· ${tx('Click Pitch to open or configure URL','Haz clic en Pitch para abrir o configurar enlace')}</span>
            <button type="button" id="lp-pitch-edit" style="color:#7fe3fa;font-size:11px;text-decoration:underline;cursor:pointer">${tx('Configure','Configurar')}</button>
          </div>
        </div>

        <div class="lp-hero-card">
          <div class="lp-orbit-ring" aria-hidden="true"></div>
          <div class="lp-orbit-ring r2" aria-hidden="true"></div>
          <div class="lp-logo-stage">
            <img src="${BRAND_LOGO_SRC}" alt="Gaia E&amp;B — Environment &amp; Benefits">
          </div>
          <div class="lp-card-badges">
            <div class="lp-mini-stat">
              <small>${tx('TERRITORIAL UNIT','UNIDAD TERRITORIAL')}</small>
              <strong>${tx('Canton × Month','Cantón × Mes')}</strong>
              <span>${tx('84 protocol cantons · 90 app sites','84 cantones protocolo · 90 sitios app')}</span>
            </div>
            <div class="lp-mini-stat">
              <small>${tx('MULTIVARIATE ENGINE','MOTOR MULTIVARIADO')}</small>
              <strong>IEA + Isolation Forest</strong>
              <span>${tx('Thermo-hydro coupling γ·zLST·(−zSM)','Acoplamiento térmico-hídrico')}</span>
            </div>
            <div class="lp-mini-stat">
              <small>${tx('DATA SOURCES','FUENTES DE DATOS')}</small>
              <strong>NASA POWER · GBIF</strong>
              <span>MODIS · Landsat · GPM · SMAP · Open-Meteo</span>
            </div>
            <div class="lp-mini-stat">
              <small>${tx('SCIENTIFIC RIGOR','RIGOR CIENTÍFICO')}</small>
              <strong>${tx('Zero Gap-Filling Fraud','Sin relleno ficticio')}</strong>
              <span>${tx('Strict chronological split','Partición cronológica estricta')}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="lp-metrics" aria-label="${tx('System highlights','Indicadores del sistema')}">
        <div class="lp-metric">
          <b>84 / 90</b>
          <strong>${tx('Cantonal Coverage','Cobertura Cantonal')}</strong>
          <p>${tx('7 provinces and municipal units mapped with harmonized administrative geometry.','7 provincias y unidades cantonales armonizadas con cartografía oficial.')}</p>
        </div>
        <div class="lp-metric">
          <b>2001–2025+</b>
          <strong>${tx('Longitudinal Observatory','Observatorio Longitudinal')}</strong>
          <p>${tx('25-year NASA POWER baselines paired with live 7-day ensemble outlooks.','Líneas base NASA POWER de 25 años junto con pronósticos por conjunto a 7 días.')}</p>
        </div>
        <div class="lp-metric">
          <b>5 Drivers + UICN</b>
          <strong>${tx('Ecological Risk Radar','Radar de Riesgo Ecológico')}</strong>
          <p>${tx('Surface/air temperature, rainfall, soil moisture, vegetation, and GBIF biodiversity.','Temperatura superficial/aire, lluvia, humedad del suelo, vegetación y biodiversidad.')}</p>
        </div>
        <div class="lp-metric">
          <b>4 SbN</b>
          <strong>${tx('Nature-Based Scenarios','Intervenciones SbN')}</strong>
          <p>${tx('Riparian corridors, urban canopy, agroforestry, and wetland restoration models.','Corredores ribereños, arborización urbana, agroforestería y humedales.')}</p>
        </div>
      </section>

      <section class="lp-section" id="lp-problem">
        <div class="lp-sec-head">
          <div>
            <span class="lp-sec-kicker">${tx('01 / PROBLEM & SOLUTION','01 / PROBLEMA Y SOLUCIÓN')}</span>
            <h2>${tx('Turning fragmented Earth data into cantonal decisions.','De datos satelitales fragmentados a decisiones cantonales.')}</h2>
          </div>
          <p class="lp-sec-sub">${tx(
            'Designed with strict separation between empirical observations, model imputations, and scenario simulations.',
            'Diseñado separando rigurosamente observaciones empíricas, imputaciones y escenarios simulados.'
          )}</p>
        </div>

        <div class="lp-two-col">
          <div class="lp-box is-problem">
            <span class="lp-box-tag">${tx('RESEARCH PROBLEM','PROBLEMA DE INVESTIGACIÓN')}</span>
            <h3>${tx('Why raw climate variables fall short','Por qué las variables aisladas no bastan')}</h3>
            <ul class="lp-list">
              <li>${tx('Satellite products (MODIS, Landsat, GPM, SMAP, POWER) arrive at incompatible spatial resolutions and sampling intervals.','Los productos satelitales (MODIS, Landsat, GPM, SMAP, POWER) se publican con resoluciones y frecuencias incompatibles.')}</li>
              <li>${tx('Satellite pixels do not match municipal boundaries where conservation budgets and local alerts are decided.','Las celdas satelitales no coinciden con los límites cantonales donde se planifican intervenciones.')}</li>
              <li>${tx('Comparing raw values confuses seasonal cycles with real stress, while national averages hide acute local hotspots.','Comparar valores brutos confunde estacionalidad con anomalías y oculta focos locales de degradación.')}</li>
              <li>${tx('Projections are often mistaken for certain forecasts or correlation for causation without independent checks.','Las proyecciones suelen confundirse con certeza o las correlaciones con causalidad sin validación externa.')}</li>
            </ul>
          </div>

          <div class="lp-box is-solution">
            <span class="lp-box-tag">${tx('THE GAIATRACK SOLUTION','NUESTRA SOLUCIÓN')}</span>
            <h3>${tx('Harmonized multivariate stress & SbN modeling','Detección multivariada y optimización SbN')}</h3>
            <ul class="lp-list">
              <li>${tx('Zonal statistics weighted by valid pixel coverage per canton, respecting cloud/quality masks without fabricating missing values.','Estadística zonal ponderada por área válida cantonal y máscaras de calidad sin sustituir faltantes con datos simulados.')}</li>
              <li>${tx('Monthly standardization z(c,m,y) on calibration baselines combined into an experimental Environmental Stress Index (IEA) and Isolation Forest.', 'Estandarización mensual z(c,m,y) integrada en el Índice de Estrés Ambiental (IEA) e Isolation Forest.')}</li>
              <li>${tx('Non-parametric statistical verification (Theil–Sen slope, Mann–Kendall trend, Welch t-test, chronological train/test splits).','Verificación estadística transparente (pendiente Theil–Sen, Mann–Kendall, prueba t de Welch y partición temporal estricta).')}</li>
              <li>${tx('Multicriteria Nature-Based Intervention simulation with budget constraints, uncertainty bands, and interactive 3D/2D exploration.','Simulación multicriterio de soluciones basadas en la naturaleza bajo restricciones presupuestarias e incertidumbre explícita.')}</li>
            </ul>
          </div>
        </div>

        <div class="lp-hypotheses">
          <article class="lp-hyp">
            <span>${tx('HYPOTHESIS H1 · SENSITIVITY','HIPÓTESIS H1 · SENSIBILIDAD')}</span>
            <p>${tx('The multivariate procedure exhibits greater sensitivity than univariate indicators for external stress events at comparable false-alarm rates.','El procedimiento multivariado alcanza mayor sensibilidad que indicadores univariados ante eventos externos, con falsas alarmas comparables.')}</p>
          </article>
          <article class="lp-hyp">
            <span>${tx('HYPOTHESIS H2 · LEAD TIME','HIPÓTESIS H2 · ANTICIPACIÓN')}</span>
            <p>${tx('Anomalies of soil moisture deficit (−zSM) and elevated surface temperature (+zLST) precede negative vegetation anomalies (−zNDVI).','La pérdida de humedad del suelo (−zSM) y el calentamiento superficial (+zLST) anteceden anomalías negativas de vegetación (−zNDVI).')}</p>
          </article>
          <article class="lp-hyp">
            <span>${tx('HYPOTHESIS H3 · ALLOCATION','HIPÓTESIS H3 · PRIORIZACIÓN')}</span>
            <p>${tx('Under explicit model assumptions, multicriteria SbN allocation outperforms uniform budget distribution in cost-to-benefit ratio.','Bajo supuestos explícitos del modelo, la selección multicriterio SbN supera una asignación uniforme de presupuesto en costo-beneficio.')}</p>
          </article>
        </div>
      </section>

      <section class="lp-section" id="lp-pipeline">
        <div class="lp-sec-head">
          <div>
            <span class="lp-sec-kicker">${tx('02 / END-TO-END ARCHITECTURE','02 / ARQUITECTURA DE PRINCIPIO A FIN')}</span>
            <h2>${tx('Five reproducible scientific stages.','Cinco etapas científicas reproducibles.')}</h2>
          </div>
          <p class="lp-sec-sub">${tx(
            'Inspired by traceable physics-and-AI Earth pipelines: every reading links back to source metadata and versioned manifests.',
            'Inspirado en flujos científicos reproducibles: cada métrica conserva trazabilidad de fuente, versión y cobertura.'
          )}</p>
        </div>
        <div class="lp-pipeline">
          <article class="lp-pipe-step">
            <span class="lp-pipe-num">01</span>
            <h4>${tx('Ingestion & QA','Ingesta y Calidad')}</h4>
            <p>${tx('MODIS, Landsat, GPM, SMAP, NASA POWER, FIRMS, GBIF, and Open-Meteo with quality flags and download logs.','MODIS, Landsat, GPM, SMAP, NASA POWER, FIRMS, GBIF y Open-Meteo con banderas de calidad.')}</p>
            <small>${tx('Zero synthetic fill','Sin relleno ficticio')}</small>
          </article>
          <article class="lp-pipe-step">
            <span class="lp-pipe-num">02</span>
            <h4>${tx('Zonal Harmonization','Armonización Zonal')}</h4>
            <p>${tx('Metric projection, pixel fraction weighting across cantonal polygons, and unified °C, mm, m³/m³ units.','Proyección métrica, ponderación de píxel por cantón y unidades unificadas (°C, mm, m³/m³).')}</p>
            <small>${tx('84 cantonal polygons','84 polígonos cantonales')}</small>
          </article>
          <article class="lp-pipe-step">
            <span class="lp-pipe-num">03</span>
            <h4>${tx('IEA & Isolation Forest','IEA e Isolation Forest')}</h4>
            <p>${tx('Calibration z-scores with candidate weights [0.28, 0.24, 0.20, 0.18, 0.10] and coupling term γ = 0.15.','Anomalías z con pesos candidatos [0.28, 0.24, 0.20, 0.18, 0.10] y acoplamiento γ = 0.15.')}</p>
            <small>${tx('Cross-sensor persistence','Persistencia temporal')}</small>
          </article>
          <article class="lp-pipe-step">
            <span class="lp-pipe-num">04</span>
            <h4>${tx('Blind Split Validation','Validación Temporal')}</h4>
            <p>${tx('Rolling-origin calibration, validation, and locked test blocks evaluated with sensitivity, F1, and lead time.','Bloques cronológicos de calibración/prueba evaluados por sensibilidad, F1 y anticipación.')}</p>
            <small>${tx('No data leakage','Sin fuga de información')}</small>
          </article>
          <article class="lp-pipe-step">
            <span class="lp-pipe-num">05</span>
            <h4>${tx('SbN Optimization & 3D','Optimización SbN y 3D')}</h4>
            <p>${tx('Pareto intervention scenarios under CMIP6/Open-Meteo projections plus interactive 3D cockpit.','Escenarios Pareto de intervención bajo proyecciones climáticas e interfaz 3D interactiva.')}</p>
            <small>${tx('Interactive decision support','Soporte de decisión')}</small>
          </article>
        </div>
      </section>

      <section class="lp-section" id="lp-features">
        <div class="lp-sec-head">
          <div>
            <span class="lp-sec-kicker">${tx('03 / LIVE PLATFORM MODULES','03 / FUNCIONALIDADES EN LA APLICACIÓN')}</span>
            <h2>${tx('Explore every module live in GaiaTrack.','Explorá cada módulo directamente en vivo.')}</h2>
          </div>
          <p class="lp-sec-sub">${tx(
            'Jump directly from any capability card into the corresponding view inside the interactive WebGL & analytics platform.',
            'Saltá desde cualquier tarjeta directamente a la vista interactiva correspondiente dentro de la plataforma.'
          )}</p>
        </div>

        <div class="lp-modules">
          <article class="lp-mod-card">
            <div class="lp-mod-top">
              <span class="lp-mod-icon">${tx('⌖ 3D TERRITORY','⌖ TERRITORIO 3D')}</span>
            </div>
            <h3>${tx('Costa Rica 3D Orbital Explorer','Explorador Orbital 3D de Costa Rica')}</h3>
            <p>${tx('Fly from orbital descent to all 7 provinces and 83 cantons in WebGL with dynamic elevation, rain fields, solar illumination, and instant meteorological readouts.', 'Volá desde órbita hacia las 7 provincias y 83 cantones en WebGL con relieve, campos de lluvia, luz solar y telemetría inmediata.')}</p>
            <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" data-launch="app">${tx('Open 3D Explorer →','Abrir Explorador 3D →')}</button>
          </article>

          <article class="lp-mod-card">
            <div class="lp-mod-top">
              <span class="lp-mod-icon">${tx('🌿 ECOLOGICAL RISK','🌿 RIESGO ECOLÓGICO')}</span>
            </div>
            <h3>${tx('Thermal, Hydro & IUCN Risk Radar','Radar Térmico, Hídrico y UICN')}</h3>
            <p>${tx('Color-codes cantonal topography using composite thermal stress, hydrological anomalies, DEM slope/elevation, and GBIF threatened species occurrences with a live Top 5 table.', 'Colorea los cantones integrando estrés térmico, balance hídrico, elevación DEM y especies amenazadas UICN (GBIF) con Top 5 en vivo.')}</p>
            <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" data-launch="radar">${tx('Open Risk Radar →','Abrir Radar Ecológico →')}</button>
          </article>

          <article class="lp-mod-card">
            <div class="lp-mod-top">
              <span class="lp-mod-icon">${tx('≋ TRENDS & EARTH PULSE','≋ TENDENCIAS E IEA')}</span>
            </div>
            <h3>${tx('Historical Series & Statistical Workbench','Banco Estadístico 2001–2025')}</h3>
            <p>${tx('Analyze 25-year annual series or anomalies, Theil–Sen slopes, two-sided Mann–Kendall significance, Welch t-tests vs. 2001–2010 baseline, CSV exports, and Earth Pulse scenario sliders.', 'Analizá series y anomalías 2001–2025, pendiente Theil–Sen, Mann–Kendall, prueba t de Welch, exportación CSV y simulador de estrés IEA.')}</p>
            <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" data-launch="trends">${tx('Open Trends Lab →','Abrir Laboratorio de Tendencias →')}</button>
          </article>

          <article class="lp-mod-card">
            <div class="lp-mod-top">
              <span class="lp-mod-icon">${tx('↗ 7-DAY & AI GUIDE','↗ PRONÓSTICO Y GAIA CHAT')}</span>
            </div>
            <h3>${tx('7-Day Forecast, SbN Guidance & Gaia Chat','Pronóstico 7 Días y Asistente Gaia')}</h3>
            <p>${tx('Inspect daily and ensemble spread (GFS P10–P90), territorial ecological recommendations, and query the AI assistant grounded in real observatory datasets.', 'Inspeccioná trayectorias diarias con banda P10–P90, guías ecológicas por territorio y el asistente conversacional con datos reales.')}</p>
            <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" data-launch="forecast">${tx('Open Forecast & Context →','Abrir Pronóstico 7 Días →')}</button>
          </article>
        </div>

        <div class="lp-formulas" aria-label="${tx('Core scientific equations','Ecuaciones científicas base')}">
          <div class="lp-formula-card">
            <span>NDVI &amp; EVI</span>
            <code>NDVI = (ρNIR − ρred) / (ρNIR + ρred)</code>
          </div>
          <div class="lp-formula-card">
            <span>MNDWI (Xu, 2006)</span>
            <code>MNDWI = (ρgreen − ρSWIR1) / (ρgreen + ρSWIR1)</code>
          </div>
          <div class="lp-formula-card">
            <span>${tx('WATER BALANCE','BALANCE HÍDRICO')}</span>
            <code>ΔS = P − ET − Q − D</code>
          </div>
          <div class="lp-formula-card">
            <span>${tx('ENERGY BALANCE','BALANCE DE ENERGÍA')}</span>
            <code>Rn − G = H + LE</code>
          </div>
          <div class="lp-formula-card">
            <span>${tx('CANTONAL ANOMALY','ANOMALÍA ESTANDARIZADA')}</span>
            <code>z(c,m,y) = [X(c,m,y) − μ(c,m)] / σ(c,m)</code>
          </div>
          <div class="lp-formula-card">
            <span>${tx('STRESS INDEX (IEA)','ÍNDICE DE ESTRÉS (IEA)')}</span>
            <code>IEA = Σ(wj · z′j) + γ · max(0, zLST) · max(0, −zSM)</code>
          </div>
        </div>
      </section>

      <section class="lp-section" id="lp-demo">
        <div class="lp-sec-head">
          <div>
            <span class="lp-sec-kicker">${tx('04 / USAGE DEMO & CASE STUDIES','04 / DEMOSTRACIÓN DE USO Y CASOS DE ESTUDIO')}</span>
            <h2>${tx('Watch GaiaTrack in action & explore NbS scenarios.','Demostración de uso en vivo y escenarios SbN.')}</h2>
          </div>
          <p class="lp-sec-sub">${tx(
            'Real 26-second interactive capture on top of Costa Rica NASA POWER & GBIF records, alongside preliminary Nature-Based Solution scenarios from Appendix A.',
            'Captura real de 26 segundos sobre datos NASA POWER y GBIF de Costa Rica, junto con los casos de intervención del Apéndice A.'
          )}</p>
        </div>

        <div class="lp-demo-layout">
          <div>
            <div class="lp-video-frame">
              <video id="landing-demo-video" src="${DEMO_VIDEO_SRC}" controls preload="metadata" playsinline muted loop></video>
            </div>
            <div class="lp-chapters" role="group" aria-label="${tx('Demo video chapters','Capítulos del video demo')}">
              <button type="button" class="lp-chap active" data-seek="0"><b>00:00</b><span>${tx('3D Canton Explorer','Explorador 3D')}</span></button>
              <button type="button" class="lp-chap" data-seek="7"><b>00:07</b><span>${tx('Ecological Risk Radar','Riesgo Ecológico')}</span></button>
              <button type="button" class="lp-chap" data-seek="14"><b>00:14</b><span>${tx('NASA Trends & IEA','Tendencias e IEA')}</span></button>
              <button type="button" class="lp-chap" data-seek="20"><b>00:20</b><span>${tx('7-Day Forecast & 3D','Pronóstico 7 Días')}</span></button>
            </div>
            <div class="lp-team-arch" style="margin-top:12px">
              <p><strong>${tx('Looking for the Presentation / Pitch Video?','¿Buscas el Video de Presentación o Pitch?')}</strong> ${tx('Access our dedicated project pitch link directly here alongside the technical walkthrough.', 'Accede aquí al enlace separado para el video pitch y presentación ejecutiva del equipo.')}</p>
              <button type="button" class="lp-btn lp-btn-pitch lp-btn-sm" id="landing-demo-pitch-btn">${tx('🎬 Open Pitch Link','🎬 Abrir Enlace Pitch')}</button>
            </div>
          </div>

          <div class="lp-sbn-stack">
            <article class="lp-sbn-card">
              <header>
                <strong>${tx('1. Urban Canopy & Green Corridors','1. Escenarios Urbanos y Corredores')}</strong>
                <span>450 ha</span>
              </header>
              <p>${tx('Preliminary modeled hypothesis: IEA attenuation from 2.25 to 1.18, surface temperature drop of 2.15 °C, and 3.2 million m³/year infiltration.', 'Planteamiento preliminar: reducción modelada del IEA de 2.25 a 1.18, descenso térmico de 2.15 °C e infiltración de 3.2 millones de m³/año.')}</p>
            </article>

            <article class="lp-sbn-card">
              <header>
                <strong>${tx('2. Agroproductive & Agroforestry Systems','2. Escenarios Agroproductivos')}</strong>
                <span>1,800 ha</span>
              </header>
              <p>${tx('Preliminary modeled hypothesis: IEA reduction from 2.34 to 1.29, temperature drop of 1.75 °C, and hydrological retention of 6.8 million m³/year.', 'Planteamiento preliminar: reducción modelada del IEA de 2.34 a 1.29, descenso térmico de 1.75 °C y retención hídrica de 6.8 millones de m³/año.')}</p>
            </article>

            <article class="lp-sbn-card">
              <header>
                <strong>${tx('3. Coastal & Wetland Restoration','3. Escenarios Costeros y Humedales')}</strong>
                <span>1,200 ha</span>
              </header>
              <p>${tx('Preliminary modeled hypothesis: IEA improvement from 2.38 to 1.35, 1.90 °C cooling, 74% fire-risk reduction, and 7.5 million m³/year storage.', 'Planteamiento preliminar: reducción modelada del IEA de 2.38 a 1.35, descenso de 1.90 °C, −74 % riesgo de fuego y 7.5 millones de m³/año.')}</p>
            </article>

            <div class="lp-integrity-note">
              <strong>${tx('Scientific Transparency (Paper Appendix A):','Transparencia Científica (Apéndice A):')}</strong>
              ${tx('The modeled reductions above belong to initial project hypotheses and remain pending full reproducible benchmark verification; they are never presented as confirmed field outcomes.', 'Las magnitudes numéricas anteriores corresponden al planteamiento inicial y permanecen pendientes de verificación reproducible; no se presentan como impactos confirmados en campo.')}
            </div>
          </div>
        </div>
      </section>

      <section class="lp-section" id="lp-authors">
        <div class="lp-sec-head">
          <div>
            <span class="lp-sec-kicker">${tx('05 / AUTHORS & RESEARCH PAPER','05 / AUTORES Y ARTÍCULO CIENTÍFICO')}</span>
            <h2>${tx('Interdisciplinary Research Team','Equipo Investigador y Autores')}</h2>
          </div>
          <p class="lp-sec-sub">${tx(
            'Six authors integrating data science, physical modeling, web engineering, and science communication in Costa Rica.',
            'Seis autores integrando ciencia de datos, modelación física, desarrollo web y comunicación científica en Costa Rica.'
          )}</p>
        </div>

        <div class="lp-authors-grid">
          ${AUTHORS.map(a=>`
            <article class="lp-author-card">
              <div class="lp-avatar" aria-hidden="true">${a.initials}</div>
              <div>
                <strong>${a.name}</strong>
                <small>${tx('Co-author · Gaia E&B Research Team','Coautoría · Equipo Gaia E&B')}</small>
              </div>
            </article>
          `).join('')}
        </div>

        <div class="lp-team-arch">
          <p><strong>${tx('Team Architecture (Appendix B):','Composición Interdisciplinaria (Apéndice B):')}</strong> ${tx('2 Specialists in Systems & Data Science · 1 Specialist in Electrical Engineering & Physical Modeling · 2 Web Platform Developers · 1 Specialist in Design & Science Communication.', '2 integrantes en sistemas y ciencia de datos · 1 en ingeniería eléctrica y modelación física · 2 en desarrollo web · 1 en diseño y comunicación científica.')}</p>
          <a class="lp-btn lp-btn-secondary lp-btn-sm" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${tx('Open Full English PDF (19 pp.) ↗','Abrir PDF Completo en Inglés (19 pp.) ↗')}</a>
        </div>

        <div class="lp-citation-box">
          <p class="lp-citation-text"><strong>${tx('Recommended Citation:','Cita Sugerida:')}</strong> ${apaCitation}</p>
          <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" id="lp-copy-cite">${tx('Copy Citation','Copiar Cita')}</button>
        </div>
      </section>

      <footer class="lp-footer">
        <span>Gaia E&amp;B · GaiaTrack Observatory · Costa Rica</span>
        <div class="lp-footer-links">
          <button type="button" id="lp-footer-app">${tx('Launch 3D Observatory','Ir al Observatorio 3D')}</button>
          <a href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${tx('Research Paper PDF','Paper PDF')}</a>
          <button type="button" id="lp-footer-pitch">${tx('Pitch Video','Video Pitch')}</button>
          <a href="credits.html">${tx('Sources & Licensing','Fuentes y Licencias')}</a>
        </div>
      </footer>
    </div>
  `;
}

function buildPitchModalHtml(){
  const hasPitch=Boolean(getPitchUrl());
  return `
    <span class="lp-sec-kicker">${tx('PRESENTATION / PITCH VIDEO','VIDEO DE PRESENTACIÓN / PITCH')}</span>
    <h3>${tx('Project Pitch Video Link','Enlace al Video de Presentación (Pitch)')}</h3>
    <p>${hasPitch
      ?tx('Your pitch presentation video link is linked and opens directly in a new tab. You can update or clear it below.', 'El enlace al video pitch ya está vinculado y se abrirá en una pestaña nueva. Podés actualizarlo o quitarlo aquí.')
      :tx('The final pitch video URL has not been published yet. Paste your YouTube, Vimeo, Loom, or Google Drive presentation URL below to activate the live link immediately in this browser.', 'El enlace definitivo del video pitch aún está pendiente de publicación. Podés pegar la URL de YouTube, Vimeo, Loom o Drive abajo para activarlo de inmediato en esta sesión, o ver la demo técnica de 26 s.')
    }</p>
    <div class="lp-pitch-input-row">
      <input type="url" id="lp-pitch-url-input" placeholder="https://www.youtube.com/watch?v=..." aria-label="${tx('Pitch video URL','URL del video pitch')}">
      <button type="button" class="lp-btn lp-btn-primary lp-btn-sm" id="lp-pitch-save">${tx('Save & Open ↗','Guardar y abrir ↗')}</button>
    </div>
    <p id="lp-pitch-feedback" style="font-size:12px;color:#81e8bf;min-height:18px;margin-bottom:6px"></p>
    <div class="lp-modal-actions">
      <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" id="lp-pitch-clear">${tx('Reset Link','Limpiar enlace')}</button>
      <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" id="lp-pitch-watch-demo">${tx('▶ Watch 26s Tech Demo','▶ Ver Demo Técnica (26 s)')}</button>
      <button type="button" class="lp-btn lp-btn-secondary lp-btn-sm" id="lp-pitch-close">${tx('Close','Cerrar')}</button>
    </div>
  `;
}

function render(){
  if(!portal)return;
  portal.innerHTML=buildContent();
  if(pitchModal)pitchModal.innerHTML=buildPitchModalHtml();
  wireEvents();
  syncLandingBtn();
}

function wireEvents(){
  if(!portal)return;
  portal.querySelector('#landing-enter-app')?.addEventListener('click',()=>closeLanding('app'));
  portal.querySelector('#lp-nav-launch')?.addEventListener('click',()=>closeLanding('app'));
  portal.querySelector('#lp-footer-app')?.addEventListener('click',()=>closeLanding('app'));
  portal.querySelector('#lp-brand-home')?.addEventListener('click',e=>{e.preventDefault();portal.scrollTo?.({top:0,behavior:'smooth'});});

  portal.querySelector('#landing-pitch-btn')?.addEventListener('click',openPitchFlow);
  portal.querySelector('#landing-demo-pitch-btn')?.addEventListener('click',openPitchFlow);
  portal.querySelector('#lp-footer-pitch')?.addEventListener('click',openPitchFlow);
  portal.querySelector('#lp-pitch-edit')?.addEventListener('click',showPitchModal);

  portal.querySelectorAll('[data-launch]').forEach(btn=>{
    btn.addEventListener('click',()=>closeLanding(btn.getAttribute('data-launch')));
  });
  portal.querySelectorAll('[data-lp-lang]').forEach(btn=>{
    btn.addEventListener('click',()=>setLang(btn.getAttribute('data-lp-lang')));
  });

  const video=portal.querySelector('#landing-demo-video');
  const chaps=portal.querySelectorAll('.lp-chap');
  chaps.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const sec=Number(btn.getAttribute('data-seek'))||0;
      chaps.forEach(c=>c.classList.toggle('active',c===btn));
      if(video){
        video.currentTime=sec;
        video.play?.().catch(()=>{});
      }
    });
  });
  video?.addEventListener('timeupdate',()=>{
    const t=video.currentTime||0;
    let activeIdx=0;
    if(t>=20)activeIdx=3;
    else if(t>=14)activeIdx=2;
    else if(t>=7)activeIdx=1;
    chaps.forEach((c,i)=>c.classList.toggle('active',i===activeIdx));
  });

  portal.querySelector('#lp-copy-cite')?.addEventListener('click',async e=>{
    const btn=e.currentTarget;
    const text=portal.querySelector('.lp-citation-text')?.textContent?.replace(/^[^:]+:\s*/,'')||'';
    try{await navigator?.clipboard?.writeText?.(text);}catch{}
    if(btn)btn.textContent=tx('Copied ✓','Copiado ✓');
    setTimeout(()=>{if(btn)btn.textContent=tx('Copy Citation','Copiar Cita');},1800);
  });

  if(pitchModal){
    pitchModal.querySelector('#lp-pitch-close')?.addEventListener('click',closePitchModal);
    pitchModal.querySelector('#lp-pitch-watch-demo')?.addEventListener('click',()=>{
      closePitchModal();
      portal.querySelector('#lp-demo')?.scrollIntoView?.({behavior:'smooth'});
      const v=portal.querySelector('#landing-demo-video');
      v?.play?.().catch(()=>{});
    });
    pitchModal.querySelector('#lp-pitch-clear')?.addEventListener('click',()=>{
      safeStorageSet(PITCH_STORAGE_KEY,'');
      render();
      closePitchModal();
    });
    pitchModal.querySelector('#lp-pitch-save')?.addEventListener('click',()=>{
      const raw=pitchModal.querySelector('#lp-pitch-url-input')?.value||'';
      const valid=sanitizeExternalUrl(raw);
      const fb=pitchModal.querySelector('#lp-pitch-feedback');
      if(!valid){
        if(fb)fb.textContent=tx('Please enter a valid http(s):// video URL.','Ingresá un enlace válido que comience con https:// o http://.');
        return;
      }
      safeStorageSet(PITCH_STORAGE_KEY,valid);
      render();
      closePitchModal();
      if(typeof window!=='undefined'&&window.open)window.open(valid,'_blank','noopener,noreferrer');
    });
  }
}

export function initLanding(){
  if(typeof document==='undefined')return;
  const nav=document.querySelector('.topbar nav');
  if(nav&&!document.getElementById('open-landing-btn')){
    openLandingBtn=document.createElement('button');
    openLandingBtn.type='button';
    openLandingBtn.id='open-landing-btn';
    openLandingBtn.addEventListener('click',openLanding);
    nav.prepend(openLandingBtn);
  }else{
    openLandingBtn=document.getElementById('open-landing-btn');
  }

  portal=document.getElementById('landing-portal');
  if(!portal){
    portal=document.createElement('section');
    portal.id='landing-portal';
    portal.setAttribute('aria-label',tx('GaiaTrack Project Overview','Portada del Proyecto GaiaTrack'));
    document.body.append(portal);
  }

  pitchModal=document.getElementById('landing-pitch-modal');
  if(!pitchModal){
    pitchModal=document.createElement('dialog');
    pitchModal.id='landing-pitch-modal';
    document.body.append(pitchModal);
  }

  render();
  if(shouldAutoOpenLanding())openLanding();
  else{
    document.body.classList.remove('landing-open');
    portal.setAttribute('aria-hidden','true');
  }
  document.addEventListener('gaiatrack:lang',render);
}

initLanding();
