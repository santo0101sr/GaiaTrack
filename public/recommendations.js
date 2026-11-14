import {
  experimentalStressIndex,
  monthlyReference,
  pearsonCorrelation,
  precipitationAnomaly,
  simulateScenario,
  stressIndicators,
  temperatureAnomaly
} from './earth-pulse.js';

function resolveLang(explicit){
  if(explicit==='en'||explicit==='es')return explicit;
  try{
    if(typeof localStorage!=='undefined'){
      const saved=localStorage.getItem('gaiatrack_lang');
      return saved==='es'?'es':'en';
    }
  }catch{}
  return 'es';
}

const PROFILES = {
  'sarapiqui': {
    kind: 'rural-wet',
    es: { zone: 'Zona rural · Bosque lluvioso tropical', eco: 'Región de alta biodiversidad y ríos caudalosos. Los bosques ribereños filtran sedimentos y amortiguan crecidas repentinas.' },
    en: { zone: 'Rural zone · Tropical rainforest', eco: 'High-biodiversity region with fast-rising rivers. Riparian forests filter sediment and buffer sudden flash floods.' }
  },
  'limon': {
    kind: 'rural-wet',
    es: { zone: 'Costa Caribe · Bosque húmedo tropical', eco: 'Humedad constante y corredores biológicos costeros. La cobertura vegetal protege los suelos ante aguaceros intensos.' },
    en: { zone: 'Caribbean coast · Tropical moist forest', eco: 'Year-round humidity and coastal biological corridors. Vegetation cover shields soils against intense downpours.' }
  },
  'barva': {
    kind: 'mountain',
    es: { zone: 'Ladera volcánica · Bosque nuboso', eco: 'Zona clave de recarga acuífera y nacientes del Valle Central. La neblina aporta humedad directa a la vegetación.' },
    en: { zone: 'Volcanic slope · Cloud forest', eco: 'Key aquifer recharge zone and headwaters for the Central Valley. Cloud mist feeds moisture directly to foliage.' }
  },
  'san-rafael': {
    kind: 'mountain',
    es: { zone: 'Pie de monte · Zona eco-residencial', eco: 'Transición entre área urbana y bosque montano. Conservar árboles nativos y cercas vivas ayuda a aves y polinizadores.' },
    en: { zone: 'Foothills · Eco-residential zone', eco: 'Transition between urban neighborhoods and montane forest. Native trees and living fences support birds and pollinators.' }
  },
  'santa-barbara': {
    kind: 'mountain',
    es: { zone: 'Ladera rural · Microcuencas de montaña', eco: 'Suelos agrícolas y cafetales bajo sombra que retienen agua de lluvia y reducen la erosión en pendientes.' },
    en: { zone: 'Rural slope · Mountain micro-watersheds', eco: 'Agricultural soils and shade-grown coffee retain rainwater and curb erosion on steep slopes.' }
  },
  'san-isidro': {
    kind: 'mountain',
    es: { zone: 'Pie de monte · Corredor verde', eco: 'Quebradas de montaña sensibles a lluvias fuertes; mantener retiros con vegetación evita desbordamientos.' },
    en: { zone: 'Foothills · Green corridor', eco: 'Mountain streams sensitive to heavy rain; keeping vegetated riparian setbacks prevents flash overflow.' }
  },
  'cartago': {
    kind: 'mountain',
    es: { zone: 'Valle alto y laderas · Clima fresco', eco: 'Suelos volcánicos fértiles rodeados de montañas. Las lluvias continuas saturan rápido las pendientes agrícolas.' },
    en: { zone: 'High valley & slopes · Cool climate', eco: 'Fertile volcanic soils ringed by mountains. Persistent rain rapidly saturates hillside farmland.' }
  },
  'guanacaste': {
    kind: 'dry-coast',
    es: { zone: 'Pacífico Norte · Bosque tropical seco', eco: 'Ecosistema adaptado a marcada estación seca y alta radiación. El acolchado orgánico y árboles de sombra cuidan el suelo.' },
    en: { zone: 'North Pacific · Tropical dry forest', eco: 'Ecosystem adapted to a sharp dry season and intense sun. Organic mulch and shade trees protect soil moisture.' }
  },
  'puntarenas': {
    kind: 'dry-coast',
    es: { zone: 'Pacífico · Litoral y zonas rurales', eco: 'Brisa marina, calor sostenido y chubascos convectivos vespertinos. Proteger manglares y drenajes costeros es vital.' },
    en: { zone: 'Pacific coast · Littoral & rural areas', eco: 'Sea breezes, steady warmth, and afternoon convective showers. Protecting mangroves and coastal drainage is essential.' }
  },
  'alajuela': {
    kind: 'urban-valley',
    es: { zone: 'Valle y estribaciones · Mixto urbano-rural', eco: 'Combina áreas urbanas cálidas con zonas rurales en ascenso hacia la cordillera volcánica.' },
    en: { zone: 'Valley & foothills · Mixed urban-rural', eco: 'Blends warm urban centers with rural slopes climbing toward the volcanic cordillera.' }
  },
  'san-jose': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Corredor urbano', eco: 'Alta impermeabilización urbana acelera la escorrentía en aguaceros; parques y árboles urbanos reducen islas de calor.' },
    en: { zone: 'Central Valley · Urban corridor', eco: 'Dense pavement accelerates storm runoff; urban parks and tree canopy help cool heat islands.' }
  },
  'heredia': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Urbano-ecológico', eco: 'Entorno urbano con cercanía a corredores verdes. Arbolado nativo y jardines permeables alivian el calor y el drenaje.' },
    en: { zone: 'Central Valley · Urban-ecological', eco: 'Urban setting close to green corridors. Native trees and permeable gardens ease heat and storm drainage.' }
  },
  'santo-domingo': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Residencial y quebradas', eco: 'Microcuencas urbanas que responden rápido a tormentas de tarde; evitar residuos en alcantarillas previene anegamientos.' },
    en: { zone: 'Central Valley · Residential & streams', eco: 'Urban micro-basins respond rapidly to afternoon storms; keeping storm drains clear prevents street flooding.' }
  },
  'belen': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Zona baja y cálida', eco: 'Sector más cálido y plano del cantón. Sombra vegetal y recolección de agua pluvial optimizan el confort.' },
    en: { zone: 'Central Valley · Warm lower basin', eco: 'Warmest, flattest sector of the canton. Tree shade and rainwater harvesting improve thermal comfort.' }
  },
  'flores': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Corredor urbano compacto', eco: 'Territorio compacto donde techos verdes, jardines de lluvia y aceras arborizadas marcan gran diferencia térmica.' },
    en: { zone: 'Central Valley · Compact urban corridor', eco: 'Compact territory where green roofs, rain gardens, and shaded sidewalks make a measurable cooling difference.' }
  },
  'san-pablo': {
    kind: 'urban-valley',
    es: { zone: 'Valle Central · Urbano residencial', eco: 'Cercano a cauces del Virilla; mantener franjas verdes y drenajes limpios protege ante tormentas convectivas.' },
    en: { zone: 'Central Valley · Residential urban', eco: 'Near Virilla river tributaries; intact green buffers and clear drains protect against convective storms.' }
  }
};

export function territoryProfile(siteId, lang) {
  const l = resolveLang(lang);
  const entry = PROFILES[siteId];
  if (entry) return { zone: entry[l].zone, eco: entry[l].eco, kind: entry.kind };
  return l === 'en'
    ? { zone: 'Costa Rica territory', eco: 'Continuous monitoring of temperature, rainfall, solar radiation, and surface soil moisture.', kind: 'urban-valley' }
    : { zone: 'Territorio de Costa Rica', eco: 'Monitoreo continuo de temperatura, lluvia, radiación solar y humedad superficial del suelo.', kind: 'urban-valley' };
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

export function evaluateTerritoryMetrics(monthlyRows = [], weather = {}, { month = currentCostaRicaMonth(), forecastDays = [], scenario = null, lang } = {}) {
  if (!Array.isArray(monthlyRows) || !monthlyRows.length) return null;
  const l = resolveLang(lang);
  const refT = monthlyReference(monthlyRows, 'T2M', month, 2001, 2025);
  const refP = monthlyReference(monthlyRows, 'PRECTOTCORR', month, 2001, 2025);
  const refS = monthlyReference(monthlyRows, 'GWETTOP', month, 2001, 2025);

  const monthRows = monthlyRows.filter(r => r.month === month).sort((a, b) => a.year - b.year);
  const latestMonth = monthRows.at(-1) || {};
  const historyYear = latestMonth.year || 2025;

  // Align temporal scales per Earth Pulse Section 7:
  // Prefer 24-hour daily mean temperature (forecastDays[0].T2M) to match the 24h NASA monthly mean;
  // fall back to live instantaneous reading or latest NASA monthly closure only when daily mean is unavailable.
  const hasDaily24h = Number.isFinite(forecastDays?.[0]?.T2M);
  const tempScale = hasDaily24h ? 'daily-24h' : Number.isFinite(weather.temperature) ? 'instant' : 'nasa-month';
  const baseTemp = hasDaily24h
    ? forecastDays[0].T2M
    : Number.isFinite(weather.temperature)
      ? weather.temperature
      : latestMonth.T2M;

  const baseObs = {
    t: baseTemp,
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

  let ieaLevel = l === 'en' ? 'No baseline' : 'Sin referencia';
  if (Number.isFinite(ieaResult.iea)) {
    if (ieaResult.iea >= 1.0) ieaLevel = l === 'en' ? 'High stress' : 'Estrés elevado';
    else if (ieaResult.iea >= 0.35) ieaLevel = l === 'en' ? 'Moderate stress' : 'Estrés moderado';
    else if (ieaResult.iea > -0.35) ieaLevel = l === 'en' ? 'Usual range' : 'Rango habitual';
    else ieaLevel = l === 'en' ? 'Favorable condition' : 'Condición favorable';
  }

  const ieaNote = l === 'en'
    ? 'Experimental index using equal initial weights (not an official ecosystem health classification).'
    : ieaResult.note;

  return {
    month,
    historyYear,
    tempScale,
    isScenario: Boolean(scenario && (scenario.deltaT || scenario.deltaPPercent)),
    refs: { t: refT, p: refP, sm: refS },
    observed: activeObs,
    anomalies: { tempC: anomT, precipAbs: anomP.abs, precipPct: anomP.pct },
    indicators,
    iea: ieaResult.iea,
    ieaLevel,
    ieaNote,
    activeIndicators: ieaResult.activeCount,
    pearsonTP: rTP
  };
}

export function buildRecommendations(siteId, weather = {}, forecastDays = [], options = {}) {
  const l = resolveLang(options.lang);
  const en = l === 'en';
  const profile = territoryProfile(siteId, l);
  const metrics = options.monthly ? evaluateTerritoryMetrics(options.monthly, weather, { ...options, forecastDays, lang: l }) : null;
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
    tips.push(en ? {
      tag: '⚡ Heavy rain & lightning',
      tone: 'alert',
      title: mountainOrRural ? 'Caution near rivers, roads & open terrain' : 'Heavy downpour & lightning risk',
      body: mountainOrRural
        ? 'Avoid crossing swollen rivers or streams, take shelter indoors during thunder (away from isolated trees or fences), and watch steep rural embankments.'
        : 'Check downspouts and storm drains to prevent flash ponding, avoid open areas during lightning, and keep extra braking distance.'
    } : {
      tag: '⚡ Lluvia fuerte y rayería',
      tone: 'alert',
      title: mountainOrRural ? 'Precaución en cauces, caminos y zonas abiertas' : 'Aguacero intenso y riesgo de rayería',
      body: mountainOrRural
        ? 'Evitá cruzar ríos o quebradas crecidas, resguardate bajo techo ante truenos (lejos de árboles aislados o cercas) y vigilá taludes en caminos rurales.'
        : 'Revisá bajantes y alcantarillas para evitar anegamientos rápidos, evitá zonas abiertas durante actividad eléctrica y conducí con distancia extra.'
    });
  } else if (rainRate !== null && rainRate > 0) {
    tips.push(en ? {
      tag: '🌧 Light rain',
      tone: 'rain',
      title: 'Active rainfall in your area',
      body: profile.kind === 'mountain'
        ? 'Expect mist-reduced visibility and wet slopes. Good window for rainwater harvesting in gardens.'
        : 'Gentle rain cooling the air and recharging soil; bring a raincoat or umbrella if heading out.'
    } : {
      tag: '🌧 Lluvia ligera',
      tone: 'rain',
      title: 'Lluvia activa en tu zona',
      body: profile.kind === 'mountain'
        ? 'Esperá visibilidad reducida por neblina y calzada húmeda en pendientes. Buen momento para captar agua de lluvia para huertas.'
        : 'Lluvia suave que refresca el ambiente y recarga jardines; tené a mano capa o paraguas si salís.'
    });
  } else if (clouds !== null && clouds >= 80 && temp !== null && temp <= 20) {
    tips.push(en ? {
      tag: '☁ Overcast sky',
      tone: 'calm',
      title: 'Cloudy & cool conditions',
      body: 'Dense cloud cover with possible light mountain drizzle; comfortable for light walks with a warm layer.'
    } : {
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
      const signT = metrics.anomalies.tempC >= 0 ? '+' : '';
      tips.push(en ? {
        tag: `🌡 Thermal anomaly (${signT}${metrics.anomalies.tempC.toFixed(1)} °C)`,
        tone: 'sun',
        title: `Temperature above monthly baseline (Z = +${zT.toFixed(1)})`,
        body: profile.kind === 'dry-coast'
          ? 'Unusually warm for this month: prioritize hydration, livestock/crop shade, and off-peak irrigation.'
          : 'Exceeds the historical average for this calendar month; ventilate rooms and limit midday sun exposure.'
      } : {
        tag: `🌡 Anomalía térmica (+${metrics.anomalies.tempC.toFixed(1)} °C)`,
        tone: 'sun',
        title: `Temperatura por encima de lo habitual para el mes (Z = +${zT.toFixed(1)})`,
        body: profile.kind === 'dry-coast'
          ? 'Calor anómalo para la época: priorizá hidratación, sombra en ganado/cultivos y riego fuera de horas pico.'
          : 'Supera la referencia histórica de este mismo mes; ventilá espacios y evitá exposición solar intensa al mediodía.'
      });
    }
    if (zP !== null && zP <= -1.0) {
      tips.push(en ? {
        tag: '🌵 Seasonal water deficit',
        tone: 'alert',
        title: `Rainfall below monthly mean (Iₚ = +${metrics.indicators.I_P.toFixed(1)})`,
        body: `Deficit in NASA ${metrics.historyYear} closure vs. 2001–2025 baseline for this month: avoid agricultural burning and retain soil moisture with mulch.`
      } : {
        tag: '🌵 Déficit hídrico estacional',
        tone: 'alert',
        title: `Lluvia por debajo del promedio del mes (Iₚ = +${metrics.indicators.I_P.toFixed(1)})`,
        body: `Déficit en cierre NASA ${metrics.historyYear} respecto a 2001–2025 para este mes: evitá quemas agrícolas y protegé la humedad del suelo con cobertura orgánica.`
      });
    } else if (zP !== null && zP >= 1.2 && !(rainRate !== null && rainRate >= 3.5)) {
      tips.push(en ? {
        tag: '🌊 Monthly rainfall surplus',
        tone: 'rain',
        title: `Monthly accumulation above historical baseline (${metrics.historyYear})`,
        body: mountainOrRural
          ? 'Exceeds the monthly historical baseline: keep runoff channels clear and monitor hillside soils.'
          : 'Higher moisture load than the monthly norm; check storm drains and roofs ahead of afternoon showers.'
      } : {
        tag: '🌊 Exceso de lluvia mensual',
        tone: 'rain',
        title: `Acumulación mensual superior a la referencia histórica (${metrics.historyYear})`,
        body: mountainOrRural
          ? 'Supera su referencia histórica de precipitación: mantené limpios canales de escorrentía y vigilá suelos en pendiente.'
          : 'Mayor carga hídrica que el promedio del mes; revisá drenajes pluviales y techos antes de aguaceros vespertinos.'
      });
    }
  }

  // 3. Soil & UV / radiation & wind rules
  if (soil !== null && soil >= 0.36) {
    tips.push(en ? {
      tag: '🌱 Saturated soil',
      tone: mountainOrRural ? 'alert' : 'eco',
      title: 'High surface soil moisture',
      body: mountainOrRural
        ? 'Ground is heavily saturated: skip irrigation and watch rural slopes or drainage channels before extra rain.'
        : 'Pause watering in gardens and green areas to prevent waterlogging and nutrient runoff.'
    } : {
      tag: '🌱 Suelo saturado',
      tone: mountainOrRural ? 'alert' : 'eco',
      title: 'Alta humedad en el suelo superficial',
      body: mountainOrRural
        ? 'El terreno está muy húmedo: no requiere riego y conviene vigilar laderas o drenajes rurales ante lluvias adicionales.'
        : 'Suspendé el riego en jardines y áreas verdes para evitar encharcamientos y pérdida de nutrientes.'
    });
  } else if (soil !== null && soil < 0.22) {
    tips.push(en ? {
      tag: '💧 Dry soil',
      tone: 'sun',
      title: 'Low surface moisture',
      body: 'If tending gardens or young trees, water early morning or dusk and add leaf litter mulch to slow evaporation.'
    } : {
      tag: '💧 Suelo seco',
      tone: 'sun',
      title: 'Baja humedad superficial',
      body: 'Si tenés huerta o árboles jóvenes, regá al atardecer o muy temprano y usá hojarasca como acolchado para retener humedad.'
    });
  }

  if ((solar !== null && solar >= 650) || (temp !== null && temp >= 29)) {
    tips.push(en ? {
      tag: '☼ Solar & heat load',
      tone: 'sun',
      title: 'High solar exposure',
      body: 'Wear sunscreen, a hat, and hydrate frequently between 10:00 AM and 3:00 PM; shield sun-sensitive crops in rural plots.'
    } : {
      tag: '☼ Radiación y calor',
      tone: 'sun',
      title: 'Exposición solar elevada',
      body: 'Usá bloqueador, gorra e hidratación frecuente entre 10:00 a. m. y 3:00 p. m.; en zonas rurales, protegé cultivos sensibles al sol directo.'
    });
  } else if (wind !== null && wind >= 7) {
    tips.push(en ? {
      tag: '🌬 Brisk wind',
      tone: 'calm',
      title: 'Noticeable gusts',
      body: 'Secure lightweight items on patios or roofs and watch for dry branches along tree-lined trails.'
    } : {
      tag: '🌬 Viento acelerado',
      tone: 'calm',
      title: 'Ráfagas perceptibles',
      body: 'Asegurá objetos livianos en patios o techos y cuidá ramas secas cerca de senderos arbolados.'
    });
  }

  const rainyTomorrow = forecastDays?.[0]?.PRECTOTCORR >= 8;
  if (rainyTomorrow && tips.length < 3) {
    tips.push(en ? {
      tag: '📅 Next 24 hours',
      tone: 'rain',
      title: 'Significant rain expected tomorrow',
      body: 'Plan outdoor activities or fieldwork during morning hours before afternoon downpours build.'
    } : {
      tag: '📅 Próximas 24 h',
      tone: 'rain',
      title: 'Se prevén lluvias importantes mañana',
      body: 'Planificá actividades al aire libre o labores agrícolas para las horas de la mañana antes de los aguaceros de la tarde.'
    });
  }

  tips.push({
    tag: en ? '🌿 Local ecology' : '🌿 Ecología local',
    tone: 'eco',
    title: profile.zone,
    body: profile.eco
  });

  return { profile, metrics, tips: tips.slice(0, 4) };
}
