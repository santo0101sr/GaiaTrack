# GaiaTrack — Costa Rica Environmental Observatory

**Earth-System-Trend-Detective** web observatory built with vanilla ES modules, Leaflet, Three.js WebGL, and Node.js weather APIs for all **7 provinces and 83 cantons of Costa Rica** (90 NASA POWER reference points, 2001–2025).

> **Bilingual interface:** Starts in **English** with an interactive **EN / ES** toggle in the header and 3D HUD.
> **Real data only:** Historical series come from NASA POWER (MERRA-2 & CERES); current conditions and 7-day forecasts come from Open-Meteo. No synthetic or simulated environmental series are substituted for missing observations.

---

## Alignment with 2026 NASA Space Apps Challenge (*Earth-System-Trend-Detective*)

1. **Select Earth science variables (`public/app.js`):** Mean/Min/Max temperature (`T2M`, `T2M_MIN`, `T2M_MAX`), downward solar radiation (`ALLSKY_SFC_SW_DWN`), bias-corrected precipitation (`PRECTOTCORR`), surface soil moisture wetness index (`GWETTOP`), and 2 m relative humidity (`RH2M`), each with plain-language scientific definitions and spatial resolution notes (`0.5° × 0.625°` MERRA-2, `1° × 1°` CERES).
2. **Focus by territory (`public/territories.js`):** Interactive explorer covering Costa Rica's 7 provinces (`san-jose`, `alajuela`, `cartago`, `heredia`, `guanacaste`, `puntarenas`, `limon`) and 83 cantons (`data/cantons.geojson`), using interior polygon reference points rather than simulated territorial averages.
3. **Time series & seasonal cycle removal (`public/science.js`):** Daily NASA POWER observations (2001–2025) aggregated monthly (requiring ≥ 90% valid days) and annually (requiring 12 valid months) to dampen intra-annual seasonal cycles, with raw values or anomalies relative to the `2001–2010` internal reference baseline.
4. **Statistical trend & significance (`#tendencias`):**
   - **5-step live Detective workflow bar:** Variable → Region → Period → Visual Trend → Significance.
   - **Theil–Sen robust slope estimator** (rate of change per decade) + **two-sided Mann–Kendall test** (`p < 0.05` threshold, requiring `n ≥ 10` complete years, tie & continuity corrections) + **lag-1 residual autocorrelation check** (`|r| > 1.96/√n`).
   - **Trend Verdict Banner & interactive `?` explainer** summarizing results and flagging autocorrelation or short windows.
   - **Regional 7-Province Scan (`Where is it changing?`):** Computes Theil–Sen slope and Mann–Kendall significance simultaneously across all 7 provinces of Costa Rica for the selected variable and period.
   - **Guided Detective Case Studies:** One-click contrasting regional comparisons (Heredia vs. Guanacaste temperature, Limón vs. Guanacaste rainfall, Sarapiquí vs. Guanacaste soil moisture) plus Pearson correlation (`r`) and Earth Pulse solar irradiance sensitivity exploration (`public/earth-pulse.js`).

---

## Local Development & Verification

Requires **Node.js 24+** (`26.x` in CI / `package.json`). No runtime npm dependencies are required.

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
