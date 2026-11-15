import {getLang,setLang,tx} from './i18n.js';

// Paste the final Pitch Video URL here when ready; UI stays hidden while empty.
export const PITCH_VIDEO_URL='';

const DEMO_VIDEO_SRC='assets/gaiatrack-demo.mp4';
const PAPER_PDF_SRC='assets/gaia-eb-research-paper.pdf';
const BRAND_LOGO_SRC='assets/gaia-eb-final.png';

const AUTHORS=[
  {name:'Francinny Saldaña Abarca',initials:'FS',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Darren Araya Monge',initials:'DA',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Santiago Ramirez Víquez',initials:'SR',role:['Electrical Eng. & Physical Modeling','Ing. Eléctrica y Modelación Física']},
  {name:'Camila Garay Jiménez',initials:'CG',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Derling Torres Campos',initials:'DT',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Kendall Rojas Cartín',initials:'KR',role:['Design & Science Communication','Diseño y Comunicación Científica']}
];

let portal=null;
let hasEnteredApp=false;

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
  return sanitizeExternalUrl(PITCH_VIDEO_URL);
}

// Dormant slot: returns pitch button HTML only once PITCH_VIDEO_URL is populated.
function renderPitchButton(label){
  const url=getPitchUrl();
  if(!url)return '';
  return `<a class="lp-btn lp-btn-secondary lp-btn-xl" id="landing-pitch-btn" href="${url}" target="_blank" rel="noopener">${label}</a>`;
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

function pauseDemoVideo(){
  const video=portal?.querySelector('#landing-demo-video');
  try{video?.pause?.();}catch{}
}

export function openLanding(){
  if(!portal||hasEnteredApp)return;
  portal.hidden=false;
  document.body.classList.add('landing-open');
  portal.setAttribute('aria-hidden','false');
  portal.scrollTop=0;
}

export function closeLanding(target='app'){
  if(!portal)return;
  hasEnteredApp=true;
  pauseDemoVideo();
  document.body.classList.remove('landing-open');
  portal.hidden=true;
  portal.setAttribute('aria-hidden','true');

  if(typeof window!=='undefined'){
    window.dispatchEvent?.(new Event('resize'));
  }

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

function buildBenefitsBlock(){
  const benefits=[
    {
      num:tx('25 Years · 2001–2025','25 Años · 2001–2025'),
      title:tx('Longitudinal NASA Detection','Detección Longitudinal NASA'),
      desc:tx('300 months of real NASA POWER, MERRA-2, MODIS, GPM, and SMAP records to uncover what is changing, where, and by how much.','300 meses de datos reales (NASA POWER, MERRA-2, MODIS, GPM y SMAP) para descubrir qué cambia, dónde y cuánto.')
    },
    {
      num:tx('7 Variables · 84 Cantons','7 Variables · 84 Cantones'),
      title:tx('Multi-Scale Regional Contrast','Contraste Regional Multiescala'),
      desc:tx('Detects diverging trends across 7 provinces, 84 cantons, and 479 districts (Pacific vs. Caribbean, rainforest vs. dry forest).','Detecta tendencias opuestas entre 7 provincias, 84 cantones y 479 distritos (Pacífico vs. Caribe, bosque húmedo vs. seco).')
    },
    {
      num:tx('α = 0.05 · 95% CI','α = 0.05 · IC 95%'),
      title:tx('Statistical Significance (Trend Detective)','Significancia Estadística (Trend Detective)'),
      desc:tx('Theil–Sen rate of change, Mann–Kendall trend test, Welch t-test vs. 2001–2010 baseline, and deseasonalized Z-scores.','Tasa de cambio Theil–Sen, prueba Mann–Kendall, t-test de Welch vs. base 2001–2010 y anomalías Z-score sin estacionalidad.')
    },
    {
      num:tx('89% · 1–2 Months','89% · 1–2 Meses'),
      title:tx('Early Trend Warning Lead','Alerta Temprana de Tendencias'),
      desc:tx('Soil moisture deficit (−zSM) and surface heat (+zLST) warn 1 to 2 months before negative vegetation change (r = −0.76, p < 0.0001).','Humedad del suelo (−zSM) y calor superficial (+zLST) anticipan 1–2 meses antes la caída vegetal (r = −0.76, p < 0.0001).')
    },
    {
      num:'−44.8% · −32.6%',
      title:tx('Mitigation & Prioritization (IEA & NbS)','Mitigación y Priorización (IEA y SbN)'),
      desc:tx('Projected 44.8% reduction in composite environmental stress and 32.6% cost savings via multicriteria NbS prioritization.','Reducción proyectada de −44.8% en estrés ambiental compuesto y −32.6% de ahorro en costos mediante priorización multicriterio.')
    },
    {
      num:tx('−2.15 °C · 17.5M m³/yr','−2.15 °C · 17.5M m³/año'),
      title:tx('Quantified Environmental Benefit','Beneficio Ambiental Cuantificado'),
      desc:tx('Modeled surface cooling of −1.75 to −2.15 °C, −74% fire risk, and 17.5M m³/yr water retained across urban, agroforestry, and wetlands.','Enfriamiento superficial de −1.75 a −2.15 °C, −74% riesgo de fuego y 17.5M m³/año retenidos entre urbano, agroforestal y humedales.')
    }
  ];

  const scenarios=[
    {
      title:tx('Urban Green Corridors · 450 ha','Corredores Urbanos GAM · 450 ha'),
      metrics:tx('IEA 2.25 → 1.18 · −2.15 °C · 3.2M m³/yr','IEA 2.25 → 1.18 · −2.15 °C · 3.2M m³/año')
    },
    {
      title:tx('Agroforestry Systems · 1,800 ha','Sistemas Agroforestales · 1,800 ha'),
      metrics:tx('IEA 2.34 → 1.29 · −1.75 °C · 6.8M m³/yr','IEA 2.34 → 1.29 · −1.75 °C · 6.8M m³/año')
    },
    {
      title:tx('Wetlands & Coast · 1,200 ha','Humedales y Costas · 1,200 ha'),
      metrics:tx('−1.90 °C · −74% fire risk · 7.5M m³/yr','−1.90 °C · −74% riesgo de fuego · 7.5M m³/año')
    }
  ];

  return `
    <div class="lp-block">
      <span class="lp-slide-kicker">${tx('EARTH SYSTEM TREND DETECTIVE · QUANTIFIED BENEFITS','EARTH SYSTEM TREND DETECTIVE · BENEFICIOS CUANTIFICADOS')}</span>
      <h2 class="lp-slide-heading">${tx('What is changing, where, how much — and is it significant?','¿Qué está cambiando, dónde, cuánto y con qué significancia?')}</h2>
      <div class="lp-benefits-grid">
        ${benefits.map(b=>`
          <article class="lp-benefit-card">
            <span class="lp-benefit-num">${b.num}</span>
            <strong class="lp-benefit-title">${b.title}</strong>
            <p class="lp-benefit-desc">${b.desc}</p>
          </article>
        `).join('')}
      </div>
      <div class="lp-scenario-strip">
        ${scenarios.map(s=>`
          <div class="lp-scenario-pill">
            <strong>${s.title}</strong>
            <span>${s.metrics}</span>
          </div>
        `).join('')}
      </div>
      <p class="lp-note-lg">${tx('Empirical NASA POWER trends (2001–2025) paired with preliminary modeled Nature-Based Solution impact scenarios from the research study (Appendix A).','Tendencias empíricas NASA POWER (2001–2025) junto con escenarios preliminares modelados de Soluciones Basadas en la Naturaleza del estudio (Apéndice A).')}</p>
    </div>
  `;
}

function buildContent(){
  const lang=getLang();
  const pitchHtml=renderPitchButton(tx('🎬 Watch Pitch Video ↗','🎬 Ver Video Pitch ↗'));
  const enterLabel=tx('⌖ Enter 3D Application →','⌖ Entrar a la Aplicación 3D →');
  const paperLabel=tx('📄 Research Paper (PDF) ↗','📄 Paper Científico (PDF) ↗');

  return `
    <div class="lp-corner-lang" role="group" aria-label="${tx('Language','Idioma')}">
      <button type="button" data-lp-lang="en" class="${lang==='en'?'active':''}" aria-pressed="${lang==='en'}">EN</button>
      <button type="button" data-lp-lang="es" class="${lang==='es'?'active':''}" aria-pressed="${lang==='es'}">ES</button>
    </div>

    <div class="lp-giant-slide">
      <section class="lp-hero-block">
        <div class="lp-hero-logo">
          <img src="${BRAND_LOGO_SRC}" alt="Gaia E&amp;B — Environment &amp; Benefits">
        </div>
        <span class="lp-slide-kicker">2026 NASA SPACE APPS CHALLENGE · EARTH SYSTEM TREND DETECTIVE</span>
        <h1 class="lp-title-xl">${tx(
          'Detect <em>environmental trends</em> and quantify <em>nature-based solutions</em> across Costa Rica.',
          'Detectá <em>tendencias ambientales</em> y cuantificá <em>soluciones basadas en la naturaleza</em> en Costa Rica.'
        )}</h1>
        <p class="lp-lead-xl">${tx(
          'GaiaTrack turns 25 years of NASA Earth science observations into interactive 3D exploration, rigorous statistical significance testing (Mann–Kendall, Theil–Sen, Welch t-test), and measurable cantonal decisions.',
          'GaiaTrack transforma 25 años de observaciones de la NASA en exploración 3D interactiva, pruebas rigurosas de significancia estadística (Mann–Kendall, Theil–Sen, t-test) y decisiones cantonales medibles.'
        )}</p>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" id="landing-enter-app" data-enter-app>${enterLabel}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-xl" id="landing-paper-link" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          ${pitchHtml}
        </div>
      </section>

      ${buildBenefitsBlock()}

      <section class="lp-block">
        <span class="lp-slide-kicker">${tx('LIVE WALKTHROUGH DEMO','DEMOSTRACIÓN DE USO EN VIVO')}</span>
        <h2 class="lp-slide-heading">${tx('Explore 3D cantons, Ecological Risk & 25-year NASA trends.','Explorá cantones 3D, Riesgo Ecológico y tendencias NASA.')}</h2>
        <div class="lp-video-stage">
          <div class="lp-video-frame">
            <video id="landing-demo-video" src="${DEMO_VIDEO_SRC}" controls preload="metadata" playsinline muted loop></video>
          </div>
        </div>
      </section>

      <section class="lp-block">
        <span class="lp-slide-kicker">${tx('AUTHORS & CHALLENGE MISSION','AUTORES Y DESAFÍO NASA')}</span>
        <h2 class="lp-slide-heading">${tx('Built in Costa Rica by the Gaia E&B Research Team.','Creado en Costa Rica por el equipo Gaia E&B.')}</h2>
        <div class="lp-authors-grid">
          ${AUTHORS.map(a=>`
            <article class="lp-author-card">
              <div class="lp-avatar" aria-hidden="true">${a.initials}</div>
              <div>
                <strong>${a.name}</strong>
                <small>${tx(a.role[0],a.role[1])}</small>
              </div>
            </article>
          `).join('')}
        </div>
        <div class="lp-nasa-banner">
          <strong>🚀 2026 NASA Space Apps Challenge · Be An Earth System Trend Detective!</strong>
          <p>${tx(
            'Created for the 2026 NASA International Space Apps Challenge (Earth System Trend Detective) — visualizing MODIS, GPM, SMAP, MERRA-2 & NASA POWER time series and validating regional trends with Mann–Kendall, Theil–Sen, Welch t-tests & 95% confidence intervals.',
            'Desarrollado para el 2026 NASA Space Apps Challenge (Earth System Trend Detective) — visualizando series temporales de MODIS, GPM, SMAP, MERRA-2 y NASA POWER, y verificando tendencias regionales con Mann–Kendall, Theil–Sen, pruebas t de Welch e intervalos de confianza del 95%.'
          )}</p>
        </div>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" data-enter-app>${enterLabel}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-xl" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          ${pitchHtml}
        </div>
      </section>
    </div>
  `;
}

function render(){
  if(!portal)return;
  portal.innerHTML=buildContent();
  wireEvents();
}

function wireEvents(){
  if(!portal)return;
  portal.querySelectorAll('[data-enter-app]').forEach(btn=>{
    btn.addEventListener('click',()=>closeLanding('app'));
  });
  portal.querySelectorAll('[data-lp-lang]').forEach(btn=>{
    btn.addEventListener('click',()=>setLang(btn.getAttribute('data-lp-lang')));
  });
}

export function initLanding(){
  if(typeof document==='undefined')return;
  portal=document.getElementById('landing-portal');
  if(!portal){
    portal=document.createElement('section');
    portal.id='landing-portal';
    portal.setAttribute('aria-label',tx('GaiaTrack Welcome Screen','Pantalla de Bienvenida GaiaTrack'));
    document.body.append(portal);
  }

  render();
  if(shouldAutoOpenLanding()&&!hasEnteredApp){
    openLanding();
  }else{
    portal.hidden=true;
    document.body.classList.remove('landing-open');
    portal.setAttribute('aria-hidden','true');
  }

  document.addEventListener('gaiatrack:lang',()=>{
    if(!hasEnteredApp)render();
  });
}

initLanding();
