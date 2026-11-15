import {trend} from './science.js';
import {annualPoints} from './territories.js';
import {validateGaiaAction} from './gaia-actions.js';

export const GAIA_UNITS={T2M:'°C',T2M_MIN:'°C',T2M_MAX:'°C',PRECTOTCORR:'mm/año',ALLSKY_SFC_SW_DWN:'MJ/m²/día',GWETTOP:'índice 0–1',RH2M:'%'};
export const normalizeQuestion=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

// Conservative, deterministic shortcuts. Complex questions still go to the model.
export function resolveLocalRequest(question, selection, manifest) {
  const text=normalizeQuestion(question);
  if (/^(hola|buenas|que puedo investigar|que podes hacer|que puedes hacer|ayuda)$/.test(text)) return {reply:'Puedo comparar dos territorios, mostrar tendencias de temperatura o lluvia, abrir el pronóstico y explicar los datos. Probá: “Compará la lluvia entre las provincias de Limón y Guanacaste desde 2010”.'};
  if (/^(gracias|muchas gracias|pura vida|listo|ok|okay|perfecto|entendido|chau|adios)$/.test(text)) return {reply:'¡Con gusto! Si querés explorar otro territorio o revisar alguna tendencia, preguntame cuando quieras.'};
  if (/^(que es gaiatrack|que es esta app|que es esto|para que sirve|como funciona gaiatrack)$/.test(text)) return {reply:'GaiaTrack es un observatorio ambiental de Costa Rica. Combina datos históricos de NASA POWER (2001–2025), condiciones actuales y pronóstico de Open-Meteo, un radar de riesgo ecológico (con registros GBIF/UICN) y un simulador de escenarios climáticos.'};
  if (/^(como muevo el mapa|como funciona el mapa|como funciona el 3d|controles|como hago zoom|como giro el mapa|como uso el mapa)$/.test(text)) return {reply:'En la vista 3D podés arrastrar con clic izquierdo para mover el mapa, arrastrar con clic derecho para rotar la cámara y usar la rueda del ratón para hacer zoom. También podés hacer clic sobre cualquier provincia o cantón, o usar los selectores del panel derecho.'};
  if (/^(que variables hay|que mide|cuales son las unidades|que variables usa|que significa t2m|que es gwettop|que es prectotcorr|que es iea|que variables y unidades usa)$/.test(text)) return {reply:'Variables principales: T2M / T2M_MIN / T2M_MAX (temperatura media, mínima y máxima en °C), PRECTOTCORR (precipitación en mm/año), ALLSKY_SFC_SW_DWN (radiación solar en MJ/m²/día), GWETTOP (humedad superficial del suelo, índice 0–1) y RH2M (humedad relativa en %). El IEA resume estrés térmico e hídrico.'};
  if (/^(que es el riesgo ecologico|como se calcula el riesgo|que es el radar de riesgo|que es uicn|que es gbif)$/.test(text)) return {reply:'El modo Riesgo Ecológico combina anomalías térmicas e hídricas (NASA POWER y datos actuales), elevación (DEM) y registros de especies amenazadas de GBIF / UICN para estimar un puntaje de 0 a 100 por territorio.'};
  if (/^(que es el simulador|como uso el simulador|como funciona el simulador)$/.test(text)) return {reply:'El Simulador proyecta escenarios futuros por territorio usando la tendencia histórica (Theil–Sen) y la línea base estacional mensual, permitiéndote variar el horizonte y la variable climática.'};
  if (/^(como funciona el pronostico|que es el pronostico 3d|cada cuanto se actualiza)$/.test(text)) return {reply:'El pronóstico a 7 días y las condiciones actuales provienen de Open-Meteo (incluyendo ensamble GFS). En la escena 3D, las nubes y la lluvia representan estimaciones del modelo en puntos de referencia, no imágenes de radar o satélite.'};
  if (/^(que (es|significa) (la )?(significancia|significancia estadistica|una tendencia)|como interpreto (el )?valor p|que significa la significancia valor p)$/.test(text)) return {reply:'La pendiente indica cuánto cambia una variable por década. Mann–Kendall evalúa evidencia de una tendencia; p < 0,05 es una señal exploratoria si no se detecta dependencia temporal. No encontrar evidencia suficiente no demuestra ausencia de cambio. Una tendencia tampoco demuestra su causa.'};
  if (/^(de donde (son|vienen) (los )?datos|que datos (usas|usan)|cuales son (las )?fuentes)$/.test(text)) return {reply:'El histórico 2001–2025 usa NASA POWER. Son estimaciones para puntos de referencia, no promedios provinciales o cantonales. Las condiciones actuales y el pronóstico usan modelos meteorológicos de Open-Meteo. Consultá “Datos y método” para las unidades y limitaciones.'};
  if (!/^(mostra|muestra|abri|abre|compara|selecciona|llevame|quiero ver|ver |cambia|volve|volver)/.test(text)) return null;
  // Negation and causal/conditional requests need language understanding.
  if (/\b(no|excepto|sin|porque|por que|si|causa|explica\w*)\b/.test(text)) return null;
  const action={};
  if (/\b(pronostico|forecast|proximos dias)\b/.test(text)) action.view='forecast';
  else if (/\b(actual|ahora|hoy)\b/.test(text)) action.view='current';
  else if (/\b(metodo|fuentes)\b/.test(text)) action.view='method';
  else if (/\b(3d|tridimensional)\b/.test(text)) action.view='3d';
  else if (/\b(mapa|explorador)\b/.test(text)) action.view='explorer';
  else action.view='trends';
  const variables=[[/temperatura minima/,'T2M_MIN'],[/temperatura maxima/,'T2M_MAX'],[/temperatura|calor/,'T2M'],[/lluvia|precipitacion/,'PRECTOTCORR'],[/radiacion|solar/,'ALLSKY_SFC_SW_DWN'],[/humedad (del )?suelo/,'GWETTOP'],[/humedad (relativa|del aire)/,'RH2M']];
  const matches=variables.filter(([pattern])=>pattern.test(text));
  const specific=matches.filter(([,id])=>id!=='T2M'||!matches.some(([,other])=>['T2M_MIN','T2M_MAX'].includes(other)));
  if(specific.length>1)return null;
  if(specific.length)action.variable=specific[0][1];
  if(!specific.length&&!/\b(mapa|explorador|3d|tridimensional|metodo|fuentes|pronostico|actual|ahora|hoy|tendencias|anomalias)\b/.test(text))return null;
  const names=new Map();
  for(const site of manifest.sites){const name=normalizeQuestion(site.name);if(` ${text} `.includes(` ${name} `)){if(!names.has(name))names.set(name,[]);names.get(name).push(site);}}
  // Avoid matching short names embedded within a longer place name.
  const groups=[...names].filter(([name])=>![...names.keys()].some(other=>other!==name&&` ${other} `.includes(` ${name} `)));
  if(groups.length>2)return null;
  const resolved=[];
  for(const [name,group] of groups){
    const filtered=/\bprovincias?\b/.test(text)?group.filter(site=>site.type==='province'):/\bcanton(es)?\b/.test(text)?group.filter(site=>site.type==='canton'):group;
    const candidates=filtered.length?filtered:group;
    if(candidates.length!==1)return {reply:`¿Te referís a la provincia o al cantón de ${group[0].name}? Indicá “provincia” o “cantón” en la pregunta.`};
    resolved.push({site:candidates[0],position:text.indexOf(name)});
  }
  resolved.sort((a,b)=>a.position-b.position);
  if(resolved.length){action.site=resolved[0].site.id;action.compareSite=resolved[1]?.site.id??null;}
  if(/\bcompara/.test(text)&&resolved.length<2)return null;
  const years=text.match(/\b(?:19|20)\d{2}\b/g)?.map(Number)??[];
  if(years.length&&['forecast','current'].includes(action.view))return null;
  if(years.length>2)return null;
  if(years.some(year=>year<manifest.start||year>manifest.end))return {reply:`El histórico disponible va de ${manifest.start} a ${manifest.end}. Elegí un período dentro de ese rango.`};
  if(years.length===2){action.start=years[0];action.end=years[1];}
  else if(years.length===1){if(/\b(desde|a partir)\b/.test(text)){action.start=years[0];action.end=manifest.end;}else if(/\b(hasta)\b/.test(text)){action.end=years[0];}else if(action.view==='explorer'){action.year=years[0];}else return null;}
  if(/\banomalias?\b/.test(text))action.anomaly=true;
  if(!action.site&&!selection.site&&!['method','3d','explorer'].includes(action.view))return {reply:'¿Qué provincia o cantón querés investigar? Por ejemplo: “Mostrá la temperatura de la provincia de Heredia”.'};
  if(!resolved.length&&!specific.length&&!/\b(mapa|explorador|3d|tridimensional|metodo|fuentes|pronostico|actual|ahora|hoy|tendencias|anomalias)\b/.test(text))return null;
  const next={...selection,...action};
  try{validateGaiaAction(next,manifest.sites,manifest.start,manifest.end);if(next.start>next.end)throw Error();}catch{return {reply:'El período inicial debe ser menor o igual al final y estar dentro del histórico disponible.'};}
  return {action};
}

export function historicalEvidence(selection,manifest,annual){
  return [...new Set([selection.site,selection.compareSite].filter(Boolean))].map(id=>{
    const site=manifest.sites.find(item=>item.id===id);
    const series=annualPoints(annual,id,selection.variable).filter(point=>point.year>=selection.start&&point.year<=selection.end);
    const result=trend(series);
    return {site:id,name:site.name,latitude:site.latitude,longitude:site.longitude,variable:selection.variable,unit:GAIA_UNITS[selection.variable],period:[selection.start,selection.end],
      slopePerDecade:result.slope===null?null:result.slope*10,p:result.p,validYears:result.n,autocorrelated:result.autocorrelated,
      significant:result.p!==null&&result.p<.05&&!result.autocorrelated,
      source:'NASA POWER; punto de referencia, no promedio territorial',sourceURL:site.url??'https://power.larc.nasa.gov/',sourceRetrievedAt:site.sourceRetrievedAt??null,
      method:'Theil–Sen y Mann–Kendall bilateral exploratorio; mínimo 10 años para p. La dependencia temporal se advierte, no se corrige. Resultado individual sin corrección múltiple.'};
  });
}

export function summarizeEvidence(selection,evidence,weather=null){
  const views={trends:'tendencias',explorer:'el mapa',forecast:'el pronóstico',current:'las condiciones actuales',method:'datos y método','3d':'la escena 3D'};
  const intro=`Abrí ${views[selection.view]??'tendencias'}${evidence.length?' para '+evidence.map(item=>item.name).join(' y '):''}.`;
  if(['forecast','current'].includes(selection.view))return `${intro} ${weather?.error?'El servicio meteorológico no está disponible en este momento.':weather?'Consultá los valores y la fecha de actualización en el panel meteorológico. Son estimaciones de modelos, no mediciones de una estación.':'El panel consultará los modelos meteorológicos disponibles.'}`;
  if(['method','3d'].includes(selection.view))return intro;
  const number=n=>new Intl.NumberFormat('es-CR',{maximumFractionDigits:3}).format(n);
  const lines=evidence.map(item=>{
    if(item.slopePerDecade===null)return `${item.name}: datos insuficientes para estimar una tendencia.`;
    const conclusion=item.p===null?'Período insuficiente para informar significancia.':item.autocorrelated?'La dependencia temporal exige revisar la significancia.':item.significant?'Señal estadística exploratoria.':'Sin evidencia suficiente de una tendencia.';
    return `${item.name}, ${item.period.join('–')}: ${item.slopePerDecade>0?'+':''}${number(item.slopePerDecade)} ${item.unit} por década (${item.validYears} años válidos${item.p===null?'':`, p ${item.p<.001?'< 0,001':'= '+number(item.p)}`}). ${conclusion}`;
  });
  return [intro,...lines,evidence.length?'Fuente: NASA POWER. Puntos de referencia; no promedios territoriales. Una tendencia no demuestra su causa.':''].filter(Boolean).join('\n\n');
}
