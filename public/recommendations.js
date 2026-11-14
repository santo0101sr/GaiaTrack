import {
  experimentalStressIndex,
  monthlyReference,
  pearsonCorrelation,
  precipitationAnomaly,
  simulateScenario,
  stressIndicators,
  temperatureAnomaly
} from './earth-pulse.js';

const PROFILES = {
  'sarapiqui': { zone: 'Zona rural · Bosque lluvioso tropical', eco: 'Región de alta biodiversidad y ríos caudalosos. Los bosques ribereños filtran sedimentos y amortiguan crecidas repentinas.', kind: 'rural-wet' },
  'limon': { zone: 'Costa Caribe · Bosque húmedo tropical', eco: 'Humedad constante y corredores biológicos costeros. La cobertura vegetal protege los suelos ante aguaceros intensos.', kind: 'rural-wet' },
  'barva': { zone: 'Ladera volcánica · Bosque nuboso', eco: 'Zona clave de recarga acuífera y nacientes del Valle Central. La neblina aporta humedad directa a la vegetación.', kind: 'mountain' },
  'san-rafael': { zone: 'Pie de monte · Zona eco-residencial', eco: 'Transición entre área urbana y bosque montano. Conservar árboles nativos y cercas vivas ayuda a aves y polinizadores.', kind: 'mountain' },
  'santa-barbara': { zone: 'Ladera rural · Microcuencas de montaña', eco: 'Suelos agrícolas y cafetales bajo sombra que retienen agua de lluvia y reducen la erosión en pendientes.', kind: 'mountain' },
  'san-isidro': { zone: 'Pie de monte · Corredor verde', eco: 'Quebradas de montaña sensibles a lluvias fuertes; mantener retiros con vegetación evita desbordamientos.', kind: 'mountain' },
  'cartago': { zone: 'Valle alto y laderas · Clima fresco', eco: 'Suelos volcánicos fértiles rodeados de montañas. Las lluvias continuas saturan rápido las pendientes agrícolas.', kind: 'mountain' },
  'guanacaste': { zone: 'Pacífico Norte · Bosque tropical seco', eco: 'Ecosistema adaptado a marcada estación seca y alta radiación. El acolchado orgánico y árboles de sombra cuidan el suelo.', kind: 'dry-coast' },
  'puntarenas': { zone: 'Pacífico · Litoral y zonas rurales', eco: 'Brisa marina, calor sostenido y chubascos convectivos vespertinos. Proteger manglares y drenajes costeros es vital.', kind: 'dry-coast' },
  'alajuela': { zone: 'Valle y estribaciones · Mixto urbano-rural', eco: 'Combina áreas urbanas cálidas con zonas rurales en ascenso hacia la cordillera volcánica.', kind: 'urban-valley' },
  'san-jose': { zone: 'Valle Central · Corredor urbano', eco: 'Alta impermeabilización urbana acelera la escorrentía en aguaceros; parques y árboles urbanos reducen islas de calor.', kind: 'urban-valley' },
  'heredia': { zone: 'Valle Central · Urbano-ecológico', eco: 'Entorno urbano con cercanía a corredores verdes. Arbolado nativo y jardines permeables alivian el calor y el drenaje.', kind: 'urban-valley' },
  'santo-domingo': { zone: 'Valle Central · Residencial y quebradas', eco: 'Microcuencas urbanas que responden rápido a tormentas de tarde; evitar residuos en alcantarillas previene anegamientos.', kind: 'urban-valley' },
  'belen': { zone: 'Valle Central · Zona baja y cálida', eco: 'Sector más cálido y plano del cantón. Sombra vegetal y recolección de agua pluvial optimizan el confort.', kind: 'urban-valley' },
  'flores': { zone: 'Valle Central · Corredor urbano compacto', eco: 'Territorio compacto donde techos verdes, jardines de lluvia y aceras arborizadas marcan gran diferencia térmica.', kind: 'urban-valley' },
  'san-pablo': { zone: 'Valle Central · Urbano residencial', eco: 'Cercano a cauces del Virilla; mantener franjas verdes y drenajes limpios protege ante tormentas convectivas.', kind: 'urban-valley' }
};

export function territoryProfile(siteId) {
  return PROFILES[siteId] || {
    zone: 'Territorio de Costa Rica',
    eco: 'Monitoreo continuo de temperatura, lluvia, radiación solar y humedad superficial del suelo.',
    kind: 'urban-valley'
  };
}

export function nearestSite(lat, lon, sites = []) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !sites.length) return null;
  const rad = Math.PI / 180;
  let best = null, bestKm = Infinity;
  for (const s of sites) {
    const dLat = (s.latitude - lat) * rad;
    const dLon = (s.longitude - lon) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(s.latitude * rad) * Math.sin(dLon / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
  }
  return best ? { site: best, distanceKm: bestKm } : null;
}

function currentCostaRicaMonth() {
  const m = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Costa_Rica', month: 'numeric' }).format(new Date()));
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : new Date().getUTCMonth() + 1;
}

export function evaluateTerritoryMetrics(monthlyRows = [], weather = {}, { month = currentCostaRicaMonth(), scenario = null } = {}) {
  if (!Array.isArray(monthlyRows) || !monthlyRows.length) return null;
  const refT = monthlyReference(monthlyRows, 'T2M', month, 2001, 2025);
  const refP = monthlyReference(monthlyRows, 'PRECTOTCORR', month, 2001, 2025);
  const refS = monthlyReference(monthlyRows, 'GWETTOP', month, 2001, 2025);

  const monthRows = monthlyRows.filter(r => r.month === month).sort((a, b) => a.year - b.year);
  const latestMonth = monthRows.at(-1) || {};

  // Align sources strictly by unit and scale:
  // Temperature uses °C (live T2M or latest monthly T2M); precipitation & GWETTOP stay on NASA POWER daily/monthly units.
  const baseObs = {
    t: Number.isFinite(weather.temperature) ? weather.temperature : latestMonth.T2M,
    p: Number.isFinite(latestMonth.PRECTOTCORR) ? latestMonth.PRECTOTCORR : refP.mean,
    sm: Number.isFinite(latestMonth.GWETTOP) ? latestMonth.GWETTOP : refS.mean,
    ndvi: null
  };

  const activeObs = scenario ? simulateScenario(baseObs, scenario) : baseObs;
  const anomT = temperatureAnomaly(activeObs.t, refT.mean);
  const anomP = precipitationAnomaly(activeObs.p, refP.mean);
  const indicators = stressIndicators(activeObs, { t: refT, p: refP, sm: refS });
  const ieaResult = experimentalStressIndex(indicators);

  const rTP = pearsonCorrelation(
    monthRows.map(r => r.T2M),
    monthRows.map(r => r.PRECTOTCORR)
  );

  let ieaLevel = 'Sin referencia';
  if (Number.isFinite(ieaResult.iea)) {
    if (ieaResult.iea >= 1.0) ieaLevel = 'Estrés elevado';
    else if (ieaResult.iea >= 0.35) ieaLevel = 'Estrés moderado';
    else if (ieaResult.iea > -0.35) ieaLevel = 'Rango habitual';
    else ieaLevel = 'Condición favorable';
  }

  return {
    month,
    isScenario: Boolean(scenario && (scenario.deltaT || scenario.deltaPPercent)),
    refs: { t: refT, p: refP, sm: refS },
    observed: activeObs,
    anomalies: { tempC: anomT, precipAbs: anomP.abs, precipPct: anomP.pct },
    indicators,
    iea: ieaResult.iea,
    ieaLevel,
    ieaNote: ieaResult.note,
    activeIndicators: ieaResult.activeCount,
    pearsonTP: rTP
  };
}

export function buildRecommendations(siteId, weather = {}, forecastDays = [], options = {}) {
  const profile = territoryProfile(siteId);
  const metrics = options.monthly ? evaluateTerritoryMetrics(options.monthly, weather, options) : null;
  const tips = [];

  const precip = Number.isFinite(weather.precipitation) ? weather.precipitation : null;
  const interval = weather.intervalSeconds > 0 ? weather.intervalSeconds : 3600;
  const rainRate = precip !== null ? precip * (3600 / interval) : null;
  const clouds = Number.isFinite(weather.clouds) ? weather.clouds : null;
  const solar = Number.isFinite(weather.solarRadiation) ? weather.solarRadiation : null;
  const soil = Number.isFinite(weather.soilMoisture) ? weather.soilMoisture : null;
  const temp = Number.isFinite(weather.temperature) ? weather.temperature : null;
  const wind = Number.isFinite(weather.windSpeed) ? weather.windSpeed : null;
  const mountainOrRural = profile.kind === 'rural-wet' || profile.kind === 'mountain';

  // 1. Live storm / rain + wind risk
  if (rainRate !== null && rainRate >= 3.5) {
    tips.push({
      tag: '⚡ Lluvia fuerte y rayería',
      tone: 'alert',
      title: mountainOrRural ? 'Precaución en cauces, caminos y zonas abiertas' : 'Aguacero intenso y riesgo de rayería',
      body: mountainOrRural
        ? 'Evitá cruzar ríos o quebradas crecidas, resguardate bajo techo ante truenos (lejos de árboles aislados o cercas) y vigilá taludes en caminos rurales.'
        : 'Revisá bajantes y alcantarillas para evitar anegamientos rápidos, evitá zonas abiertas durante actividad eléctrica y conducí con distancia extra.'
    });
  } else if (rainRate !== null && rainRate > 0) {
    tips.push({
      tag: '🌧 Lluvia ligera',
      tone: 'rain',
      title: 'Lluvia activa en tu zona',
      body: profile.kind === 'mountain'
        ? 'Esperá visibilidad reducida por neblina y calzada húmeda en pendientes. Buen momento para captar agua de lluvia para huertas.'
        : 'Lluvia suave que refresca el ambiente y recarga jardines; tené a mano capa o paraguas si salís.'
    });
  } else if (clouds !== null && clouds >= 80 && temp !== null && temp <= 20) {
    tips.push({
      tag: '☁ Cielo cubierto',
      tone: 'calm',
      title: 'Ambiente nublado y fresco',
      body: 'Alta nubosidad con posible llovizna intermitente en zonas altas; ideal para caminatas suaves cuidando el abrigo ligero.'
    });
  }

  // 2. Multi-metric seasonal anomaly & IEA stress rules (Earth Pulse)
  if (metrics) {
    const zT = metrics.indicators.I_T;
    const zP = metrics.indicators.I_P !== null ? -metrics.indicators.I_P : null;
    if (zT !== null && zT >= 1.2) {
      tips.push({
        tag: `🌡 Anomalía térmica (+${metrics.anomalies.tempC.toFixed(1)} °C)`,
        tone: 'sun',
        title: `Temperatura por encima de lo habitual para el mes (Z = +${zT.toFixed(1)})`,
        body: profile.kind === 'dry-coast'
          ? 'Calor anómalo para la época: priorizá hidratación, sombra en ganado/cultivos y riego fuera de horas pico.'
          : 'Supera la referencia histórica de este mismo mes; ventilá espacios y evitá exposición solar intensa al mediodía.'
      });
    }
    if (zP !== null && zP <= -1.0) {
      tips.push({
        tag: '🌵 Déficit hídrico estacional',
        tone: 'alert',
        title: `Lluvia por debajo del promedio del mes (Iₚ = +${metrics.indicators.I_P.toFixed(1)})`,
        body: 'Déficit respecto a años anteriores para este mismo mes: evitá quemas agrícolas o forestales y protegé la humedad del suelo con cobertura orgánica.'
      });
    } else if (zP !== null && zP >= 1.2 && !(rainRate !== null && rainRate >= 3.5)) {
      tips.push({
        tag: '🌊 Exceso de lluvia mensual',
        tone: 'rain',
        title: 'Acumulación mensual superior a la referencia histórica',
        body: mountainOrRural
          ? 'El mes supera su referencia histórica de precipitación: mantené limpios canales de escorrentía y vigilá suelos en pendiente.'
          : 'Mayor carga hídrica que el promedio del mes; revisá drenajes pluviales y techos antes de aguaceros vespertinos.'
      });
    }
  }

  // 3. Soil & UV / radiation & wind rules
  if (soil !== null && soil >= 0.36) {
    tips.push({
      tag: '🌱 Suelo saturado',
      tone: mountainOrRural ? 'alert' : 'eco',
      title: 'Alta humedad en el suelo superficial',
      body: mountainOrRural
        ? 'El terreno está muy húmedo: no requiere riego y conviene vigilar laderas o drenajes rurales ante lluvias adicionales.'
        : 'Suspendé el riego en jardines y áreas verdes para evitar encharcamientos y pérdida de nutrientes.'
    });
  } else if (soil !== null && soil < 0.22) {
    tips.push({
      tag: '💧 Suelo seco',
      tone: 'sun',
      title: 'Baja humedad superficial',
      body: 'Si tenés huerta o árboles jóvenes, regá al atardecer o muy temprano y usá hojarasca como acolchado para retener humedad.'
    });
  }

  if ((solar !== null && solar >= 650) || (temp !== null && temp >= 29)) {
    tips.push({
      tag: '☼ Radiación y calor',
      tone: 'sun',
      title: 'Exposición solar elevada',
      body: 'Usá bloqueador, gorra e hidratación frecuente entre 10:00 a. m. y 3:00 p. m.; en zonas rurales, protegé cultivos sensibles al sol directo.'
    });
  } else if (wind !== null && wind >= 7) {
    tips.push({
      tag: '🌬 Viento acelerado',
      tone: 'calm',
      title: 'Ráfagas perceptibles',
      body: 'Asegurá objetos livianos en patios o techos y cuidá ramas secas cerca de senderos arbolados.'
    });
  }

  const rainyTomorrow = forecastDays?.[0]?.PRECTOTCORR >= 8;
  if (rainyTomorrow && tips.length < 3) {
    tips.push({
      tag: '📅 Próximas 24 h',
      tone: 'rain',
      title: 'Se prevén lluvias importantes mañana',
      body: 'Planificá actividades al aire libre o labores agrícolas para las horas de la mañana antes de los aguaceros de la tarde.'
    });
  }

  tips.push({
    tag: '🌿 Ecología local',
    tone: 'eco',
    title: profile.zone,
    body: profile.eco
  });

  return { profile, metrics, tips: tips.slice(0, 4) };
}
