# GaiaTrack — Costa Rica Environmental Observatory

## Preguntale a Gaia — OpenRouter

Copiá `.env.example` a `.env.local` y completá `OPENROUTER_API_KEY` y
`OPENROUTER_MODEL` con el ID exacto de un modelo compatible con **tool calling**.
Reiniciá `npm start` después de cambiar la configuración. No requiere instalar paquetes.
En Vercel, agregá ambas variables al entorno correspondiente y volvé a desplegar.
La clave permanece en el servidor; nunca la pongás en `public/` ni la subás al repositorio.

El botón “Preguntale a Gaia” permite conversar, seleccionar provincia/cantón,
comparar dos puntos, elegir variable, período, año, anomalías y abrir tendencias,
mapa, escena 3D, método, condiciones actuales o pronóstico. Ejemplo:
“Compará la lluvia entre las provincias de Limón y Guanacaste desde 2010”. Los períodos históricos
admitidos son 2001–2025. Si falta información, el asistente puede pedirla.

`POST /api/chat` comparte el mismo controlador local y en Vercel. El servidor
valida las acciones y calcula los resultados con datos reales. Los comandos claros,
las comparaciones y las preguntas frecuentes se resuelven en el navegador sin usar IA;
esa guía sigue disponible si el proveedor falla, no hay configuración o se pierde
la conexión después de cargar el histórico. No implica que la aplicación completa
funcione sin conexión: los mapas base y el tiempo actual requieren servicios externos.

Las consultas complejas usan **como máximo una llamada a OpenRouter**. El modelo
elige la selección y la aplicación calcula y redacta el resumen científico sin una
segunda generación. El catálogo del prompt es compacto y viajan solamente los últimos
cinco mensajes y la selección. Las series numéricas no se envían al modelo.
El historial visible está limitado a 24 elementos y la conversación a cinco
intercambios en memoria; “Nueva” los borra. No se usa localStorage.
Las respuestas libres de IA pueden contener errores: contrastalas con las fuentes.

El servidor agrupa solicitudes idénticas en curso, permite dos consultas de IA
simultáneas y conserva hasta 64 respuestas durante cinco minutos (un minuto si
abren tiempo o pronóstico). La clave del caché incluye el contexto, la selección,
el modelo y la credencial, mediante un hash; no se comparte por CDN. Un error de
cuota activa una pausa respetando `Retry-After`; no hay reintentos automáticos ni
cambio automático a modelos de pago. Los comandos locales siguen disponibles.
Hay límites de tamaño, tiempo, tokens y 30 mensajes/minuto por cliente en cada proceso.
Estos controles y el caché **no son globales ni persistentes entre reinicios o réplicas
de Vercel**. Para alta concurrencia necesitás límites distribuidos en la plataforma.
La cuota gratuita y la disponibilidad siguen dependiendo de OpenRouter/proveedor.

La escena 3D detiene su ciclo de renderizado mientras está oculta, se abre el
laboratorio o se oculta la pestaña. En pantallas pequeñas/equipos modestos usa
menos resolución y desactiva sombras; respeta movimiento reducido. Los datos
meteorológicos compartidos no vuelven a emitir eventos si son el mismo registro.

La animación del clima tiene un control independiente y activo por defecto:
pausar la ambientación decorativa no congela la lluvia. Las gotas usan trazos
con desvanecimiento; su densidad, velocidad y longitud aumentan con los mm/h
del proveedor, y su geometría permanece dentro del territorio seleccionado.
Las nubes usan densidad volumétrica procedural con bordes suaves, respetando
los límites del territorio. Son ilustraciones de las estimaciones del punto de
referencia; no representan un radar ni una distribución espacial observada.
El PNG de marca conserva su transparencia, sin un fondo aplicado por CSS.

Los indicadores actuales priorizan los puntos cantonales disponibles sobre los
puntos provinciales: un cantón con lluvia permanece visible aunque el punto de
su provincia reporte cero. Una estimación provincial solo se usa como respaldo
cuando no hay muestras cantonales válidas para esa provincia; no se superponen
ambos niveles ni se rellenan cantones faltantes como si estuvieran medidos.
El estado de precipitación permite abrir la lista de puntos con lluvia, su tasa
equivalente en mm/h y la hora del modelo, y seleccionar uno en el mapa.
El acumulado reportado determina si se dibuja lluvia; un código general de cielo
actual no cancela la precipitación de un intervalo precedente. Nubosidad sola
no crea lluvia. Los datos ausentes o caducados no se muestran como lluvia cero.
Los trazos orientados a la cámara aumentan en densidad, grosor, longitud y
velocidad con la intensidad. La escena sigue representando estimaciones de
modelos por punto; no informa la distribución espacial de un radar observado.
Las pruebas usan respuestas controladas y no consumen créditos; la validación real
del modelo elegido requiere completar las dos variables.

**Earth-System-Trend-Detective** web observatory built with vanilla ES modules, Leaflet, Three.js WebGL, and Node.js weather APIs for all **7 provinces and 83 cantons of Costa Rica** (90 NASA POWER reference points, 2001–2025).

> **Bilingual interface:** Starts in **English** with an interactive **EN / ES** toggle in the header and 3D HUD.
> **Real data only:** Historical series come from NASA POWER (MERRA-2 & CERES); current conditions and 7-day forecasts come from Open-Meteo. No synthetic or simulated environmental series are substituted for missing observations.

---

## Alignment with 2026 NASA Space Apps Challenge (*Earth-System-Trend-Detective*)

1. **Select Earth science variables (`public/app.js`):** Mean/Min/Max temperature (`T2M`, `T2M_MIN`, `T2M_MAX`), downward solar radiation (`ALLSKY_SFC_SW_DWN`), bias-corrected precipitation (`PRECTOTCORR`), surface soil moisture wetness index (`GWETTOP`), and 2 m relative humidity (`RH2M`), each with plain-language scientific definitions and spatial resolution notes (`0.5° × 0.625°` MERRA-2, `1° × 1°` CERES).
2. **Focus by territory (`public/territories.js`):** Interactive explorer covering Costa Rica's 7 provinces (`san-jose`, `alajuela`, `cartago`, `heredia`, `guanacaste`, `puntarenas`, `limon`) and 83 cantons (`data/cantons.geojson`), using interior polygon reference points rather than simulated territorial averages.
3. **Time series & seasonal cycle removal (`public/science.js`):** Daily NASA POWER satellite and reanalysis estimates (2001–2025) aggregated monthly (requiring ≥ 90% valid days) and annually (requiring 12 valid months) to dampen intra-annual seasonal cycles, with raw values or anomalies relative to the `2001–2010` internal reference baseline.
4. **Statistical trend & significance (`#tendencias`):**
   - **5-step live Detective workflow bar:** Variable → Region → Period → Visual Trend → Significance.
   - **Theil–Sen robust slope estimator** (rate of change per decade) + **two-sided Mann–Kendall test** (`p < 0.05` threshold, requiring `n ≥ 10` complete years, tie & continuity corrections) + **lag-1 residual autocorrelation check** (`|r| > 1.96/√n`).
   - **Trend Verdict Banner & interactive `?` explainer** summarizing results and flagging autocorrelation or short windows.
   - **Regional 7-Province Scan (`Where is it changing?`):** Computes Theil–Sen slope and Mann–Kendall significance simultaneously across all 7 provinces of Costa Rica for the selected variable and period.
   - **Guided Detective Case Studies:** One-click contrasting regional comparisons (Heredia vs. Guanacaste temperature, Limón vs. Guanacaste rainfall, Sarapiquí vs. Guanacaste soil moisture) plus Pearson correlation (`r`) and Earth Pulse solar irradiance sensitivity exploration (`public/earth-pulse.js`).

---

## Local Development & Verification

Requires **Node.js 26.x**, matching CI and `package.json`. No runtime npm dependencies are required.

- `npm start` or `npm run dev` — serve static files + `/api/current` & `/api/forecast` locally at `http://127.0.0.1:4173`.
- `npm test` — run unit tests (`tests/*.test.mjs`) with Node's built-in test runner.
- `npm run build` — run deployment validation (`scripts/validate-deploy.mjs`), checking JS/MJS syntax and historical JSON integrity for all 90 manifest sites.
- `npm run data` / `npm run data:refresh` — fetch / refresh historical NASA POWER datasets for manifest sites.

---

## Entrada inmersiva 3D

Entrada inmersiva WebGL con Three.js 0.160.1, geometría cantonal real extruida de forma decorativa, vista orbital con países Natural Earth, selección por clic, cámara al arrastrar y zoom con rueda. Laboratorio y pronósticos se abren sobre la escena. Animación opcional, respeto por movimiento reducido y botón de pantalla completa. Las alturas y partículas son escenografía; no simulan relieve o meteorología. Three.js: MIT; Natural Earth: dominio público.


## Vercel
El proyecto incluye vercel.json, funciones Node.js para /api/current y /api/forecast y validación con npm run build. Vercel sirve public/ como salida estática. Las funciones incluyen los datos cantonales necesarios; la caché de pronóstico usa memoria y no escribe en el sistema de archivos de Vercel.

Vincular cuenta: vercel login. Vincular proyecto: vercel link. No se requieren variables secretas ni suscripciones meteorológicas. Despliegue de prueba: npm run deploy. Producción: npm run deploy:prod. La carpeta .vercel/ contiene la vinculación local y está ignorada por Git. Para despliegues automáticos desde GitHub, conectar el repositorio privado en el proyecto de Vercel.


## Datos sin suscripción y caché compartida
- NASA POWER: histórico descargado de antemano, sin consultas meteorológicas al abrir la web; archivos estáticos con caché de una hora.
- Open-Meteo: condiciones actuales cada 15 minutos y pronósticos/conjunto GFS cada 60 minutos. Las condiciones son estimaciones de modelos, no una transmisión desde una estación local.
- CDN de Vercel: comparte cada respuesta por cantón entre visitantes. Navegador: hasta 60 segundos por respuesta HTTP y caché por cantón en la aplicación. Memoria de función: solicitudes simultáneas agrupadas, más espera de 15 minutos ante HTTP 429.
- El botón de actualización respeta la vigencia; parámetros para saltar la caché redirigen a la URL canónica. Los errores no se almacenan en el CDN. El pronóstico no se conserva más allá de medianoche de Costa Rica.
- Los endpoints omiten las matrices de origen de pronóstico para reducir transferencia; las fuentes y sus enlaces siguen disponibles y las respuestas originales de referencia permanecen en public/data/forecast.
- Los datos actuales indican el intervalo real de precipitación (normalmente 15 minutos), radiación en W/m² y contenido volumétrico de humedad del suelo en m³/m³. Estas magnitudes no se confunden con las agregaciones diarias o anuales.
- Sin base de datos, cron ni APIs de pago. Uso educativo/no comercial sujeto a las cuotas gratuitas de Open-Meteo y Vercel Hobby, con atribución CC BY 4.0. La caché CDN puede evictarse o variar por región; reduce solicitudes, pero no garantiza disponibilidad ilimitada ni un máximo absoluto global.
## Atmósfera conectada y línea de tiempo 3D
La escena traduce radiación, cobertura nubosa, precipitación y humedad del suelo a efectos ilustrativos en el punto seleccionado. La línea de tiempo contiene 168 horas de pronóstico, accesos por día, reproducción y acercamiento de cámara. No simula física atmosférica ni efemérides solares. Se reutilizan las consultas cacheadas del panel, sin solicitudes extra durante la reproducción. Ver /credits.html y docs/LICENSING.md: esta versión en Vercel es de prueba y aún requiere migración de fuentes/alojamiento antes de uso comercial.


## Proveedor confirmado
Por instrucción del responsable, que informa haber consultado y confirmado las condiciones comerciales aplicables a su proyecto, Open-Meteo queda seleccionado para condiciones actuales y pronósticos, incluidos radiación y humedad superficial del suelo. Esta anotación registra su confirmación sin certificar una autorización particular del proveedor. Se conservan atribuciones, caché compartida y NASA POWER para el histórico. Vercel se mantiene para pruebas. Las rutas activas no dependen de MET Norway ni requieren METNO_TERMS_ACCEPTED o METNO_USER_AGENT.

## Province and canton navigation

Choose a province to isolate and frame its territory, then select one of its cantons from the list, map labels, or canton selector. The Costa Rica breadcrumb returns to all seven provinces. The laboratory and weather panels follow the same selection. NASA POWER and Open-Meteo provide model-based estimates for reference points, not province-wide averages or guaranteed conditions at every location; the 3D atmosphere is illustrative.
