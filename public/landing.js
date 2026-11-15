import {getLang,getTheme,setLang,toggleTheme,tx,locale} from './i18n.js';
import {icon} from './icons.js';
import {
  DATA_VARIABLES_COUNT,
  MERRA2_RES,
  CERES_RES,
  REAL_DATA_SOURCES,
  MODELED_NBS_SCENARIOS,
  deriveManifestFacts,
  computeSiteTrendHighlight
} from './site-facts.js';

// Paste the final Pitch Video URL here when ready; UI stays hidden while empty.
export const PITCH_VIDEO_URL='';

const DEMO_VIDEO_SRC='assets/gaiatrack-demo.mp4';
const PAPER_PDF_SRC='assets/gaia-eb-research-paper.pdf';
const BRAND_LOGO_SRC='assets/gaia-eb-final.png';

// Optional creator photos live strictly in code (`photo: ''` shows initials while empty).
export const AUTHORS=[
  {name:'Francinny Saldaña Abarca',initials:'FS',photo:'',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Darren Araya Monge',initials:'DA',photo:'',role:['Systems & Data Science','Sistemas y Ciencia de Datos']},
  {name:'Santiago Ramirez Víquez',initials:'SR',photo:'',role:['Electrical Eng. & Physical Modeling','Ing. Eléctrica y Modelación Física']},
  {name:'Camila Garay Jiménez',initials:'CG',photo:'',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Derling Torres Campos',initials:'DT',photo:'',role:['Web Platform Engineering','Desarrollo de Plataforma Web']},
  {name:'Kendall Rojas Cartín',initials:'KR',photo:'',role:['Design & Science Communication','Diseño y Comunicación Científica']}
];

export function renderAuthorAvatar(author){
  const safePhoto=sanitizeExternalUrl(author?.photo);
  if(safePhoto){
    const escapedPhoto=safePhoto.replace(/"/g,'&quot;');
    const safeName=String(author?.name||'').replace(/"/g,'&quot;');
    return `<div class="lp-avatar has-photo"><img src="${escapedPhoto}" alt="${safeName}" loading="lazy"></div>`;
  }
  return `<div class="lp-avatar" aria-hidden="true">${author?.initials||''}</div>`;
}

let portal=null;
let hasEnteredApp=false;
let authorIndex=0;
let landingFacts=null;
let trendCompare=null;

function fmtNum(n,d=1){
  return Number.isFinite(n)?new Intl.NumberFormat(locale(),{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
}
function fmtSigned(n,d=2){
  return Number.isFinite(n)?((n>0?'+':'')+fmtNum(n,d)):'—';
}

export function setLandingFacts({manifest=null,annual=null,sectorsCount=null,districtsCount=null}={}){
  if(manifest){
    landingFacts=deriveManifestFacts(manifest,{sectorsCount,districtsCount});
  }
  if(annual){
    const heredia=computeSiteTrendHighlight(annual,'heredia','T2M');
    const guanacaste=computeSiteTrendHighlight(annual,'guanacaste','T2M');
    if(heredia||guanacaste)trendCompare={heredia,guanacaste};
  }
  if(portal&&!hasEnteredApp)render();
}

async function hydrateLandingFacts(){
  if(typeof fetch!=='function')return;
  try{
    const fetchJson=url=>fetch(url).then(r=>r.ok?r.json():null).catch(()=>null);
    const [manifest,annual,sectors,districtBorders]=await Promise.all([
      fetchJson('data/manifest.json?v=18'),
      fetchJson('data/annual.json?v=18'),
      fetchJson('data/sectors.json?v=2'),
      fetchJson('data/district-borders.json?v=1')
    ]);
    const sectorsCount=sectors?Object.values(sectors).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0):null;
    const districtsCount=districtBorders?Object.values(districtBorders).reduce((sum,list)=>sum+(Array.isArray(list)?list.length:0),0):null;
    if(manifest||annual)setLandingFacts({manifest,annual,sectorsCount,districtsCount});
  }catch{}
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
  document.body.setAttribute?.('data-landing-entered',target);
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

function formatP(p){
  if(!Number.isFinite(p))return '—';
  return p<0.001?'< 0.001':`= ${fmtNum(p,3)}`;
}

function buildHeroTrendPreview(){
  const h=trendCompare?.heredia;
  const g=trendCompare?.guanacaste;
  const startY=h?.points?.[0]?.year??2001;
  const endY=h?.latestPoint?.year??2025;
  const hZ=h?.zPoints||[];
  const gZ=g?.zPoints||[];

  if(!hZ.length&&!gZ.length){
    return `<div class="lp-preview-card" aria-label="${tx('Live NASA POWER trend preview','Vista previa de tendencia NASA POWER')}">
      <div class="lp-preview-head">
        <div>
          <span class="lp-badge is-observed">${tx('OBSERVED NASA POWER · 2001–2025','DATO OBSERVADO NASA POWER · 2001–2025')}</span>
          <strong>${tx('Mean temperature Z-score · Heredia vs. Guanacaste','Z-score de temperatura media · Heredia vs. Guanacaste')}</strong>
        </div>
        <span class="lp-preview-meta">${tx('Loading series…','Cargando serie…')}</span>
      </div>
      <svg class="lp-preview-svg" viewBox="0 0 640 210" role="img" aria-label="${tx('NASA POWER time series preview','Vista previa de serie NASA POWER')}">
        <rect x="44" y="16" width="218" height="162" fill="var(--surface-subtle)" opacity="0.5"/>
        <line x1="44" y1="97" x2="620" y2="97" stroke="var(--border)" stroke-dasharray="4 4"/>
        <text x="332" y="101" text-anchor="middle" fill="var(--muted)" font-size="12">${tx('Fetching NASA POWER annual telemetry…','Cargando telemetría anual NASA POWER…')}</text>
      </svg>
    </div>`;
  }

  const allPts=[...hZ,...gZ];
  const vals=allPts.map(p=>p.value);
  let min=Math.min(-2.1,...vals),max=Math.max(2.3,...vals);
  const pad=(max-min||1)*0.12;min-=pad;max+=pad;
  const W=640,H=210,L=44,R=16,T=18,B=30;
  const x=yr=>L+((yr-startY)/(Math.max(1,endY-startY)))*(W-L-R);
  const y=v=>T+((max-v)/(max-min||1))*(H-T-B);
  const lineD=pts=>pts.map((p,i)=>`${i?'L':'M'}${x(p.year).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  // 2001-2010 reference baseline window
  const baseX1=x(Math.max(startY,2001)),baseX2=x(Math.min(endY,2010));
  const baseBand=baseX2>baseX1?`<rect x="${baseX1.toFixed(1)}" y="${T}" width="${(baseX2-baseX1).toFixed(1)}" height="${H-T-B}" fill="var(--accent)" opacity="0.06"/><text x="${(baseX1+6).toFixed(1)}" y="${T+12}" fill="var(--muted)" font-size="9">${tx('2001–2010 baseline','Base 2001–2010')}</text>`:'';

  // Theil-Sen fitted slope & 95% CI cone (in Z units centered at mid-series)
  let senHtml='';
  if(hZ.length>=2&&Number.isFinite(h.zSlopePerDecade)){
    const slopeZ=h.zSlopePerDecade/10;
    const midIdx=Math.floor(hZ.length/2);
    const midYr=hZ[midIdx].year;
    const midVal=h?.zTrend?h.zTrend.intercept+h.zTrend.slope*midYr:hZ[midIdx].value;
    const yStart=midVal+slopeZ*(startY-midYr);
    const yEnd=midVal+slopeZ*(endY-midYr);
    if(h.slopeCIDecade&&Number.isFinite(h.baseStd)&&h.baseStd>0){
      const lowZ=(h.slopeCIDecade.lower/10)/h.baseStd;
      const highZ=(h.slopeCIDecade.upper/10)/h.baseStd;
      const y1L=midVal+lowZ*(startY-midYr),y1H=midVal+highZ*(startY-midYr);
      const y2L=midVal+lowZ*(endY-midYr),y2H=midVal+highZ*(endY-midYr);
      senHtml+=`<polygon points="${x(startY).toFixed(1)},${y(y1L).toFixed(1)} ${x(endY).toFixed(1)},${y(y2L).toFixed(1)} ${x(endY).toFixed(1)},${y(y2H).toFixed(1)} ${x(startY).toFixed(1)},${y(y1H).toFixed(1)}" fill="var(--accent)" opacity="0.13"/>`;
    }
    senHtml+=`<line x1="${x(startY).toFixed(1)}" y1="${y(yStart).toFixed(1)}" x2="${x(endY).toFixed(1)}" y2="${y(yEnd).toFixed(1)}" stroke="var(--accent)" stroke-width="1.75" stroke-dasharray="5 4"/>`;
  }

  const hSlope=h&&Number.isFinite(h.slopePerDecade)?`${fmtSigned(h.slopePerDecade,2)} °C/${tx('dec','déc')}`:'—';
  const gSlope=g&&Number.isFinite(g.slopePerDecade)?`${fmtSigned(g.slopePerDecade,2)} °C/${tx('dec','déc')}`:'—';
  const hCi=h?.slopeCIDecade?`[${fmtSigned(h.slopeCIDecade.lower,2)}, ${fmtSigned(h.slopeCIDecade.upper,2)}]`:'';

  return `<div class="lp-preview-card" aria-label="${tx('Live NASA POWER trend preview','Vista previa de tendencia NASA POWER')}">
    <div class="lp-preview-head">
      <div>
        <span class="lp-badge is-observed">${tx('OBSERVED TELEMETRY · NASA POWER 2001–2025','TELEMETRÍA OBSERVADA · NASA POWER 2001–2025')}</span>
        <strong>${tx('Annual Mean Temperature (Z-Score vs. 2001–2010)','Temperatura media anual (Z-score vs. 2001–2010)')}</strong>
      </div>
      <div class="lp-preview-legend">
        <span><i class="is-h"></i> Heredia ${hSlope} ${hCi} (p ${formatP(h?.mkP)})</span>
        <span><i class="is-g"></i> Guanacaste ${gSlope} (p ${formatP(g?.mkP)})</span>
      </div>
    </div>
    <svg class="lp-preview-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${tx('Heredia and Guanacaste annual temperature Z-score 2001–2025','Serie anual de temperatura en Heredia y Guanacaste 2001–2025')}">
      ${baseBand}
      ${[-2,0,2].map(zTick=>`<line x1="${L}" x2="${W-R}" y1="${y(zTick).toFixed(1)}" y2="${y(zTick).toFixed(1)}" stroke="${zTick===0?'var(--z-zero)':'var(--border)'}" stroke-dasharray="${zTick===0?'4 3':'2 5'}" opacity="${zTick===0?0.75:0.5}"/><text x="${L-8}" y="${(y(zTick)+3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10">${zTick>0?'+2Z':zTick<0?'−2Z':'0'}</text>`).join('')}
      ${senHtml}
      ${gZ.length?`<path d="${lineD(gZ)}" fill="none" stroke="var(--blue)" stroke-width="1.8" opacity="0.9"/>`:''}
      ${hZ.length?`<path d="${lineD(hZ)}" fill="none" stroke="var(--accent)" stroke-width="2.2"/>`:''}
      ${hZ.map(p=>`<circle cx="${x(p.year).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.5" fill="var(--accent)"/>`).join('')}
      ${[2001,2007,2013,2019,2025].map(yr=>`<text x="${x(yr).toFixed(1)}" y="${H-8}" text-anchor="middle" fill="var(--muted)" font-size="10">${yr}</text>`).join('')}
    </svg>
    <p class="lp-preview-foot">${tx('Dashed line & band: Theil–Sen decadal slope and non-parametric 95% confidence interval for Heredia. Data stays strictly observed; no synthetic gap-filling.','Línea y banda punteadas: pendiente decadal Theil–Sen e intervalo de confianza no paramétrico al 95 % para Heredia. Datos exclusivamente observados.')}</p>
  </div>`;
}

function buildBenefitsBlock(){
  const f=landingFacts;
  const provN=f?.provincesCount??7;
  const cantonN=f?.cantonsCount??83;
  const metCells=f?.uniqueCantonMetCells??20;
  const radCells=f?.uniqueCantonRadCells??10;
  const refPts=f?.sectorsCount??f?.districtsCount??479;
  const startY=f?.startYear??2001;
  const endY=f?.endYear??2025;
  const yearsN=f?.yearsCount??25;
  const monthsN=f?.monthsCount??300;
  const varsN=f?.variablesCount??DATA_VARIABLES_COUNT;

  const h=trendCompare?.heredia;
  const g=trendCompare?.guanacaste;
  const sourceListHtml=REAL_DATA_SOURCES.map(src=>`<li><strong>${src.name}</strong> — ${tx(src.scopeEn,src.scopeEs)}</li>`).join('');

  return `
    <div class="lp-block">
      <div class="lp-evidence-grid">
        <div class="lp-evidence-col">
          <span class="lp-badge is-observed">${tx('OBSERVED COVERAGE · VERIFIED SOURCES','COBERTURA OBSERVADA · FUENTES VERIFICADAS')}</span>
          <h2 class="lp-slide-heading">${tx('What is changing, where, how much — and is it significant?','¿Qué está cambiando, dónde, cuánto y con qué significancia?')}</h2>
          <p class="lp-body">${tx(
            `${yearsN} complete years (${monthsN} months, ${startY}–${endY}) across ${varsN} NASA POWER variables (MERRA-2 ${MERRA2_RES.latDeg}°×${MERRA2_RES.lonDeg}° and CERES SYN1DEG ${CERES_RES.latDeg}°×${CERES_RES.lonDeg}°), combined with Open-Meteo GFS ensemble forecasts, GBIF IUCN occurrence records, and Copernicus DEM elevation.`,
            `${yearsN} años completos (${monthsN} meses, ${startY}–${endY}) en ${varsN} variables NASA POWER (MERRA-2 ${MERRA2_RES.latDeg}°×${MERRA2_RES.lonDeg}° y CERES SYN1DEG ${CERES_RES.latDeg}°×${CERES_RES.lonDeg}°), junto con pronósticos Open-Meteo GFS, registros UICN vía GBIF y elevación Copernicus DEM.`
          )}</p>
        </div>
        <dl class="lp-facts-list">
          <div>
            <dt>${tx('Territorial footprint','Cobertura territorial')}</dt>
            <dd>${tx(`${provN} provinces · ${cantonN} cantons · ${refPts} district microclimates`,`${provN} provincias · ${cantonN} cantones · ${refPts} microclimas distritales`)}</dd>
          </div>
          <div>
            <dt>${tx('True satellite resolution','Resolución real satelital')}</dt>
            <dd>${tx(`${cantonN} cantons share ${metCells} unique MERRA-2 grid cells and ${radCells} CERES cells; grid deduplication prevents pseudo-replication.`,`Los ${cantonN} cantones comparten ${metCells} celdas únicas MERRA-2 y ${radCells} celdas CERES; el agrupamiento evita pseudorreplicación.`)}</dd>
          </div>
          <div>
            <dt>${tx('Statistical suite','Métodos estadísticos')}</dt>
            <dd>${tx(
              `Theil–Sen slope + 95% CI, Mann–Kendall p-value (lag-1 guarded), Welch t-test vs. 2001–2010, and Benjamini–Hochberg FDR q.${h&&Number.isFinite(h.slopePerDecade)?` Heredia T2M Z = ${fmtSigned(h.latestZ,2)}; Guanacaste ${fmtSigned(g?.slopePerDecade,2)} °C/dec.`:''}`,
              `Pendiente Theil–Sen + IC 95 %, prueba Mann–Kendall (con alerta lag-1), t de Welch vs. 2001–2010 y control FDR q.${h&&Number.isFinite(h.slopePerDecade)?` Z en Heredia = ${fmtSigned(h.latestZ,2)}; Guanacaste ${fmtSigned(g?.slopePerDecade,2)} °C/déc.`:''}`
            )}</dd>
          </div>
          <div>
            <dt>${tx('Auditable indices','Índices auditables')}</dt>
            <dd>${tx('Deseasonalized Z-scores, thermo-hydro IEA stress index (threshold 0.89), and exploratory 0–100 Ecological Risk with explicit weights.','Z-scores sin estacionalidad, índice compuesto IEA (umbral 0,89) y Riesgo Ecológico exploratorio 0–100 con pesos publicados.')}</dd>
          </div>
        </dl>
      </div>

      <details class="lp-sources-details">
        <summary>${tx('Inspect verified data sources and physical units','Ver fuentes reales verificadas y unidades físicas')}</summary>
        <ul>${sourceListHtml}</ul>
      </details>

      <div class="lp-modeled-section">
        <div class="lp-group-head">
          <span class="lp-badge is-modeled">${tx('MODELED SCENARIO · NOT OBSERVED · TO BE VERIFIED','RESULTADO MODELADO, NO OBSERVADO · POR VERIFICAR')}</span>
          <h3 class="lp-modeled-heading">${tx('Preliminary Nature-Based Solution estimates (Research Paper Appendix A)','Estimaciones preliminares de Soluciones Basadas en la Naturaleza (Apéndice A)')}</h3>
        </div>
        <div class="lp-table-scroll">
          <table class="lp-modeled-table">
            <thead>
              <tr>
                <th>${tx('Territory / Intervention','Territorio / Intervención')}</th>
                <th>${tx('Modeled Outcome (Appendix A)','Resultado modelado (Apéndice A)')}</th>
                <th>${tx('Verification Status','Estado')}</th>
              </tr>
            </thead>
            <tbody>
              ${MODELED_NBS_SCENARIOS.map(s=>`
                <tr>
                  <td><strong>${tx(s.nameEn,s.nameEs)}</strong></td>
                  <td>${tx(s.summaryEn,s.summaryEs)}</td>
                  <td><span class="lp-verify-tag">${tx('to be verified','por verificar')}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p class="lp-note-sm">${tx('Appendix A NbS projections are modeled literature scenarios separated from telemetry; observed charts and 3D indicators never blend modeled outcomes with real records.','Las cifras del Apéndice A corresponden a escenarios modelados separados de la telemetría; los gráficos y el observatorio 3D nunca mezclan resultados modelados con datos reales.')}</p>
      </div>
    </div>
  `;
}

function visibleAuthorCols(){
  const w=typeof window!=='undefined'&&Number.isFinite(window.innerWidth)?window.innerWidth:1280;
  if(w<=680)return 1;
  if(w<=980)return 2;
  return 3;
}

function clampAuthorIndex(){
  const maxIdx=Math.max(0,AUTHORS.length-visibleAuthorCols());
  authorIndex=Math.max(0,Math.min(authorIndex,maxIdx));
  return maxIdx;
}

function syncAuthorsCarousel(){
  if(!portal)return;
  const maxIdx=clampAuthorIndex();
  const track=portal.querySelector?.('.lp-authors-track');
  if(track?.style?.setProperty)track.style.setProperty('--lp-idx',String(authorIndex));
  if(track)track.setAttribute?.('data-author-index',String(authorIndex));
  portal.querySelectorAll?.('[data-author-dot]')?.forEach?.((dot,i)=>{
    const active=i===authorIndex;
    dot.classList?.toggle?.('active',active);
    dot.setAttribute?.('aria-selected',String(active));
    if(dot.hidden!==undefined)dot.hidden=i>maxIdx;
  });
}

function stepAuthors(delta){
  const maxIdx=Math.max(0,AUTHORS.length-visibleAuthorCols());
  if(maxIdx<=0){authorIndex=0;syncAuthorsCarousel();return;}
  authorIndex=(authorIndex+delta+(maxIdx+1))%(maxIdx+1);
  syncAuthorsCarousel();
}

function buildContent(){
  const lang=getLang();
  const light=getTheme()==='light';
  const maxIdx=clampAuthorIndex();
  const pitchHtml=renderPitchButton(`${icon('video')} ${tx('Watch Pitch Video','Ver Video Pitch')}`);
  const enterLabel=`${tx('Explore Costa Rica','Explorar Costa Rica')} ${icon('arrow-right')}`;
  const paperLabel=`${icon('file-text')} ${tx('Research Paper (PDF)','Paper Científico (PDF)')}`;

  return `
    <div class="lp-corner-lang" role="group" aria-label="${tx('Language & Theme','Idioma y Tema')}">
      <button type="button" id="lp-theme-toggle" class="lp-theme-btn" data-theme-toggle data-lp-theme aria-pressed="${light}" aria-label="${light?tx('Switch to dark mode','Cambiar a modo oscuro'):tx('Switch to light mode','Cambiar a modo claro')}">${icon(light?'moon':'sun')} ${light?tx('Dark','Oscuro'):tx('Light','Claro')}</button>
      <span class="lp-corner-sep" aria-hidden="true"></span>
      <button type="button" data-lp-lang="en" class="${lang==='en'?'active':''}" aria-pressed="${lang==='en'}">EN</button>
      <button type="button" data-lp-lang="es" class="${lang==='es'?'active':''}" aria-pressed="${lang==='es'}">ES</button>
    </div>

    <div class="lp-giant-slide">
      <section class="lp-hero-block">
        <div class="lp-hero-logo">
          <img src="${BRAND_LOGO_SRC}" alt="Gaia E&amp;B — Environment &amp; Benefits">
        </div>
        <h1 class="lp-title-xl">${tx(
          'Detect environmental trends and quantify nature-based solutions across Costa Rica.',
          'Detecta tendencias ambientales y cuantifica soluciones basadas en la naturaleza en Costa Rica.'
        )}</h1>
        <p class="lp-lead-xl">${tx(
          'GaiaTrack turns 25 years of NASA Earth science observations into interactive 3D exploration, statistical significance testing (Mann–Kendall, Theil–Sen, Welch t-test), and territorial analysis.',
          'GaiaTrack transforma 25 años de observaciones de NASA Earth Science en exploración 3D interactiva, pruebas de significancia estadística (Mann–Kendall, Theil–Sen, prueba t de Welch) y análisis territorial.'
        )}</p>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" id="landing-enter-app" data-enter-app>${enterLabel}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-lg" id="landing-paper-link" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          <a class="lp-btn lp-btn-ghost lp-btn-lg" href="#lp-demo-section">${icon('play')} ${tx('Watch demo','Ver demo')}</a>
          ${pitchHtml}
        </div>
        ${buildHeroTrendPreview()}
      </section>

      ${buildBenefitsBlock()}

      <section class="lp-block" id="lp-demo-section">
        <h2 class="lp-slide-heading">${tx('Explore 3D cantons, Ecological Risk & 25-year NASA trends','Explora cantones 3D, Riesgo Ecológico y tendencias NASA')}</h2>
        <div class="lp-video-stage">
          <div class="lp-video-frame">
            <video id="landing-demo-video" src="${DEMO_VIDEO_SRC}" controls preload="metadata" playsinline muted loop></video>
          </div>
        </div>
      </section>

      <section class="lp-block">
        <h2 class="lp-slide-heading">${tx('Gaia E&B Research Team · Costa Rica','Equipo investigador Gaia E&B · Costa Rica')}</h2>
        <div class="lp-authors-carousel" role="region" aria-label="${tx('Creators carousel','Carrusel de creadores')}">
          <button type="button" class="lp-carousel-btn" id="lp-authors-prev" aria-label="${tx('Previous creators','Creadores anteriores')}">${icon('chevron-left')}</button>
          <div class="lp-authors-viewport">
            <div class="lp-authors-track" style="--lp-idx:${authorIndex}" data-author-index="${authorIndex}">
              ${AUTHORS.map(a=>`
                <article class="lp-author-card">
                  ${renderAuthorAvatar(a)}
                  <div>
                    <strong>${a.name}</strong>
                    <small>${tx(a.role[0],a.role[1])}</small>
                  </div>
                </article>
              `).join('')}
            </div>
          </div>
          <button type="button" class="lp-carousel-btn" id="lp-authors-next" aria-label="${tx('Next creators','Siguientes creadores')}">${icon('chevron-right')}</button>
        </div>
        <div class="lp-authors-dots" role="tablist" aria-label="${tx('Carousel pages','Páginas del carrusel')}">
          ${AUTHORS.map((_,idx)=>`<button type="button" class="lp-author-dot ${idx===authorIndex?'active':''}" data-author-dot="${idx}" aria-label="${tx(`Slide ${idx+1}`,`Posición ${idx+1}`)}" aria-selected="${idx===authorIndex}"${idx>maxIdx?' hidden':''}></button>`).join('')}
        </div>
        <div class="lp-cta-row">
          <button type="button" class="lp-btn lp-btn-primary lp-btn-xl" data-enter-app>${enterLabel}</button>
          <a class="lp-btn lp-btn-secondary lp-btn-lg" href="${PAPER_PDF_SRC}" target="_blank" rel="noopener">${paperLabel}</a>
          ${pitchHtml}
        </div>
      </section>
    </div>
    <p class="lp-nasa-footnote">2026 NASA Space Apps Challenge · Earth System Trend Detective</p>
  `;
}

function render(){
  if(!portal)return;
  const prevVideo=portal.querySelector?.('#landing-demo-video');
  const videoTime=prevVideo&&Number.isFinite(prevVideo.currentTime)?prevVideo.currentTime:0;
  const wasPaused=prevVideo?prevVideo.paused:true;
  portal.innerHTML=buildContent();
  wireEvents();
  syncAuthorsCarousel();
  const nextVideo=portal.querySelector?.('#landing-demo-video');
  if(nextVideo&&videoTime>0){
    try{nextVideo.currentTime=videoTime;if(!wasPaused)nextVideo.play?.();}catch{}
  }
}

function wireEvents(){
  if(!portal)return;
  portal.querySelectorAll('[data-enter-app]').forEach(btn=>{
    btn.addEventListener('click',()=>closeLanding('app'));
  });
  portal.querySelectorAll('[data-lp-lang]').forEach(btn=>{
    btn.addEventListener('click',()=>setLang(btn.getAttribute('data-lp-lang')));
  });
  portal.querySelectorAll('[data-lp-theme]').forEach(btn=>{
    btn.addEventListener('click',()=>toggleTheme());
  });
  portal.querySelector('#lp-authors-prev')?.addEventListener('click',()=>stepAuthors(-1));
  portal.querySelector('#lp-authors-next')?.addEventListener('click',()=>stepAuthors(1));
  portal.querySelectorAll('[data-author-dot]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const idx=Number(btn.getAttribute('data-author-dot'));
      if(Number.isFinite(idx)){authorIndex=idx;syncAuthorsCarousel();}
    });
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
    hydrateLandingFacts();
  }else{
    portal.hidden=true;
    document.body.classList.remove('landing-open');
    portal.setAttribute('aria-hidden','true');
  }

  document.addEventListener('gaiatrack:lang',()=>{
    if(!hasEnteredApp)render();
  });
  if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
    window.addEventListener('resize',()=>{
      if(!hasEnteredApp)syncAuthorsCarousel();
    });
  }
}

initLanding();
