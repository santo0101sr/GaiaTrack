import {getLang,setLang,tx} from './i18n.js';

// Paste the final Pitch Video URL here when ready; UI stays hidden while empty.
export const PITCH_VIDEO_URL='';

const DEMO_VIDEO_SRC='assets/gaiatrack-demo.mp4';
const PAPER_PDF_SRC='assets/gaia-eb-research-paper.pdf';
const BRAND_LOGO_SRC='assets/gaia-eb-final.png';
const TOTAL_SLIDES=4;

const AUTHORS=[
  {name:'Francinny Saldaña Abarca',initials:'FS',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Darren Araya Monge',initials:'DA',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Santiago Ramirez Víquez',initials:'SR',role:['Electrical Eng. & Physical Modeling','Ing. Eléctrica y Modelación Física']},
  {name:'Camila Garay Jiménez',initials:'CG',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Derling Torres Campos',initials:'DT',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Kendall Rojas Cartín',initials:'KR',role:['Design & Science Communication','Diseño y Comunicación Científica']}
];

let portal=null;
let currentSlide=0;
let hasEnteredApp=false;
let keyHandlerBound=false;

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

export function goToSlide(index){
  const next=Math.max(0,Math.min(TOTAL_SLIDES-1,Number(index)||0));
  if(next!==2&&currentSlide===2)pauseDemoVideo();
  currentSlide=next;
  syncSlideView();
}

function syncSlideView(){
  if(!portal)return;
  portal.querySelectorAll('.lp-slide').forEach((slide,idx)=>{
    const active=idx===currentSlide;
    slide.classList.toggle('is-active',active);
    slide.setAttribute('aria-hidden',String(!active));
  });
  portal.querySelectorAll('.lp-dot').forEach((dot,idx)=>{
    const active=idx===currentSlide;
    dot.classList.toggle('active',active);
    dot.setAttribute('aria-selected',String(active));
  });
  const prevBtn=portal.querySelector('#lp-prev');
  const nextBtn=portal.querySelector('#lp-next');
  if(prevBtn)prevBtn.disabled=currentSlide===0;
  if(nextBtn)nextBtn.disabled=currentSlide===TOTAL_SLIDES-1;
  portal.scrollTop=0;
}

export function openLanding(){
  if(!portal||hasEnteredApp)return;
  portal.hidden=false;
  document.body.classList.add('landing-open');
  portal.setAttribute('aria-hidden','false');
  syncSlideView();
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

function buildBenefitsSlide(){
  const benefits=[
    {
      num:'−44.8%',
      title:tx('Projected IEA Stress Reduction','Reducción Proyectada de Estrés (IEA)'),
      desc:tx('Composite environmental stress decrease from multicriteria Nature-Based Solutions.','Menor estrés ambiental compuesto mediante Soluciones Basadas en la Naturaleza.')
    },
    {
      num:'−32.6%',
      title:tx('Estimated Intervention Savings','Ahorro Estimado en Costos'),
      desc:tx('Higher impact per dollar compared with uniform, unprioritized gray infrastructure.','Mayor retorno frente a asignación uniforme o infraestructura gris convencional.')
    },
    {
      num:'89% · 1–2m',
      title:tx('Early Cantonal Warning Lead','Anticipación en 89% de Cantones'),
      desc:tx('Soil moisture (−zSM) and thermal anomalies warn 1 to 2 months before vegetation loss.','Humedad del suelo y calor superficial alertan 1–2 meses antes de la caída de vegetación.')
    },
    {
      num:'−2.15 °C',
      title:tx('Urban Surface Cooling (GAM)','Enfriamiento Superficial Urbano'),
      desc:tx('Modeled thermal drop across 450 ha of urban tree canopy and green corridors.','Descenso térmico modelado en 450 ha de arborización y corredores verdes urbanos.')
    },
    {
      num:tx('17.5M m³/yr','17.5M m³/año'),
      title:tx('Annual Water Infiltrated & Stored','Agua Infiltrada y Retenida al Año'),
      desc:tx('Combined 3.2M urban, 6.8M agroforestry, and 7.5M wetland restoration capacity.','Capacidad combinada anual entre corredores urbanos, agroforestería y humedales.')
    },
    {
      num:tx('84 Cantons','84 Cantones'),
      title:tx('National Satellite Coverage','Cobertura Nacional en Tiempo Real'),
      desc:tx('7 provinces fusing NASA POWER, MODIS, SMAP, GPM, GBIF biodiversity & 7-day forecasts.','7 provincias integrando NASA POWER, MODIS, SMAP, GPM, GBIF y pronóstico 7 días.')
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
    <span class="lp-slide-kicker">${tx('QUANTIFIED IMPACT & SOLUTION','SOLUCIÓN Y BENEFICIOS CUANTIFICADOS')}</span>
    <h2 class="lp-slide-heading">${tx('Satellite intelligence built for measurable climate action.','Inteligencia satelital enfocada en impacto medible.')}</h2>
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
    <p class="lp-note-lg">${tx('Values summarize preliminary research-paper models (Appendix A) alongside 25-year empirical NASA POWER observatory series.','Las cifras resumen metas modeladas preliminares del estudio (Apéndice A) junto con series empíricas NASA POWER de 25 años.')}</p>
  `;
}

function buildContent(){
  const lang=getLang();
  const pitchHtml=renderPitchButton(tx('🎬 Watch Pitch Video ↗','🎬 Ver Video Pitch ↗'));
  const enterLabel=tx('⌖ Enter 3D Application →','⌖ Entrar a la Aplicación 3D →');
  const paperLabel=tx('📄 Research Paper (PDF) ↗','📄 Paper Científico (PDF) ↗');
  const slideNames=[
    tx('01 · Start','01 · Inicio'),
    tx('02 · Benefits','02 · Beneficios'),
    tx('03 · Live Demo','03 · Demo'),
    tx('04 · Team & NASA','04 · Equipo & NASA')
  ];

  return `
    <div class="lp-corner-lang" role="group" aria-label="${tx('Language','Idioma')}">
      <button type="button" data-lp-lang="en" class="${lang==='en'?'active':''}" aria-pressed="${lang==='en'}">EN</button>
      <button type="button" data-lp-lang="es" class="${lang==='es'?'active':''}" aria-pressed="${lang==='es'}">ES</button>
    </div>

    <div class="lp-slider-shell">
      <section class="lp-slide ${currentSlide===0?'is-active':''}" data-slide-panel="0" aria-hidden="${currentSlide!==0}">
        <div class="lp-hero-logo">
          <img src="${BRAND_LOGO_SRC}" alt="Gaia E&amp;B — Environment &amp; Benefits">
        </div>
        <h1 class="lp-title-xl">${tx(
          'Detect <em>environmental stress</em> across Costa Rica before degradation becomes irreversible.',
          'Detectá el <em>estrés ambiental</em> en Costa Rica antes de que el daño sea irreversible.'
        )}</h1>
        <p class="lp-lead-xl">${tx(
          'GaiaTrack unites 25 years of NASA Earth data, 3D cantonal exploration, and Nature-Based Solution planning across all 7 provinces and 84 cantons.',
          'GaiaTrack integra 25 años de datos NASA, visualización 3D por cantón y planificación basada en la naturaleza en las 7 provincias de Costa Rica.'
        )}</p>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" id="landing-enter-app" data-enter-app>${enterLabel}</button>
          <button type="button" class="lp-btn lp-btn-secondary lp-btn-xl" id="lp-start-next" data-go-next>${tx('See Quantified Impact →','Ver Beneficios Cuantificados →')}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-xl" id="landing-paper-link" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          ${pitchHtml}
        </div>
      </section>

      <section class="lp-slide ${currentSlide===1?'is-active':''}" data-slide-panel="1" aria-hidden="${currentSlide!==1}">
        ${buildBenefitsSlide()}
      </section>

      <section class="lp-slide ${currentSlide===2?'is-active':''}" data-slide-panel="2" aria-hidden="${currentSlide!==2}">
        <span class="lp-slide-kicker">${tx('PLATFORM WALKTHROUGH','DEMOSTRACIÓN EN VIVO')}</span>
        <h2 class="lp-slide-heading">${tx('Explore 3D cantons, Ecological Risk & 25-year NASA trends.','Explorá cantones 3D, Riesgo Ecológico y tendencias NASA.')}</h2>
        <div class="lp-video-stage">
          <div class="lp-video-frame">
            <video id="landing-demo-video" src="${DEMO_VIDEO_SRC}" controls preload="metadata" playsinline muted loop></video>
          </div>
          <div class="lp-chapters" role="group" aria-label="${tx('Demo chapters','Capítulos del video')}">
            <button type="button" class="lp-chap active" data-seek="0"><b>00:00</b><span>${tx('3D Canton Explorer','Explorador 3D')}</span></button>
            <button type="button" class="lp-chap" data-seek="7"><b>00:07</b><span>${tx('Ecological Risk','Riesgo Ecológico')}</span></button>
            <button type="button" class="lp-chap" data-seek="14"><b>00:14</b><span>${tx('NASA Trends & IEA','Tendencias e IEA')}</span></button>
            <button type="button" class="lp-chap" data-seek="20"><b>00:20</b><span>${tx('7-Day Forecast','Pronóstico 7 Días')}</span></button>
          </div>
        </div>
      </section>

      <section class="lp-slide ${currentSlide===3?'is-active':''}" data-slide-panel="3" aria-hidden="${currentSlide!==3}">
        <span class="lp-slide-kicker">${tx('AUTHORS & MISSION','AUTORES Y PROPÓSITO')}</span>
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
          <strong>🚀 NASA Space Apps Challenge · Costa Rica</strong>
          <p>${tx(
            'Developed for the NASA International Space Apps Challenge — transforming open NASA Earth observations into accessible climate intelligence.',
            'Proyecto desarrollado para el NASA Space Apps Challenge — convirtiendo datos abiertos de la NASA en decisiones climáticas y ecológicas locales.'
          )}</p>
        </div>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" data-enter-app>${enterLabel}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-xl" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          ${pitchHtml}
        </div>
      </section>
    </div>

    <div class="lp-slider-bar" role="region" aria-label="${tx('Presentation slides','Diapositivas de bienvenida')}">
      <div class="lp-slider-nav">
        <button type="button" class="lp-btn lp-btn-secondary lp-btn-lg" id="lp-prev" ${currentSlide===0?'disabled':''}>${tx('← Previous','← Anterior')}</button>
      </div>
      <div class="lp-slider-dots" role="tablist" aria-label="${tx('Slides','Diapositivas')}">
        ${slideNames.map((label,idx)=>`
          <button type="button" class="lp-dot ${currentSlide===idx?'active':''}" data-slide="${idx}" role="tab" aria-selected="${currentSlide===idx}">${label}</button>
        `).join('')}
      </div>
      <div class="lp-slider-nav">
        <button type="button" class="lp-btn lp-btn-secondary lp-btn-lg" id="lp-next" ${currentSlide===TOTAL_SLIDES-1?'disabled':''}>${tx('Next →','Siguiente →')}</button>
        <button type="button" class="lp-btn lp-btn-primary lp-btn-lg" id="lp-dock-enter" data-enter-app>${tx('Open App 3D →','Ir a la App 3D →')}</button>
      </div>
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
  portal.querySelector('#lp-prev')?.addEventListener('click',()=>goToSlide(currentSlide-1));
  portal.querySelector('#lp-next')?.addEventListener('click',()=>goToSlide(currentSlide+1));
  portal.querySelector('[data-go-next]')?.addEventListener('click',()=>goToSlide(currentSlide+1));
  portal.querySelectorAll('[data-slide]').forEach(btn=>{
    btn.addEventListener('click',()=>goToSlide(Number(btn.getAttribute('data-slide'))));
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

  if(!keyHandlerBound){
    keyHandlerBound=true;
    document.addEventListener('keydown',e=>{
      if(!document.body.classList.contains('landing-open'))return;
      if(e.key==='ArrowRight'&&currentSlide<TOTAL_SLIDES-1)goToSlide(currentSlide+1);
      else if(e.key==='ArrowLeft'&&currentSlide>0)goToSlide(currentSlide-1);
    });
  }
  document.addEventListener('gaiatrack:lang',()=>{
    if(!hasEnteredApp)render();
  });
}

initLanding();
