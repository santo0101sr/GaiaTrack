# GaiaTrack

GitHub está conectado al proyecto `gaiatrack` de Vercel. Cada push a `main` dispara un despliegue a producción; las otras ramas generan vistas previas. Las APIs meteorológicas no requieren claves ni planes de pago. Para publicar cambios: `git add`, `git commit` y `git push`.

Observatorio interactivo de la provincia de Heredia, Costa Rica. Proyecto para NASA Space Apps. Publicado en https://gaiatrack.vercel.app con despliegue automático desde GitHub.

## Abrir

Requiere Node.js 24. No requiere instalar paquetes.

```powershell
npm start
```

Abrir http://127.0.0.1:4173. No abrir `index.html` directamente: el pronóstico necesita el servidor local.

## Funciones

- Mapa de los diez cantones con puntos de referencia interiores y selector accesible.
- Histórico real NASA POWER 2001–2025: temperatura media, promedio de mínimas diarias, promedio de máximas diarias, radiación solar, precipitación, humedad superficial del suelo y humedad relativa del aire.
- Pronóstico real de los próximos siete días desde mañana, vía Open-Meteo; consulta actualizable y caché compartida de hasta una hora.
- Dispersión P10–P90 de temperatura media diaria calculada de 31 miembros GFS vía Open-Meteo. Es otro producto distinto del pronóstico principal de selección automática; no es un intervalo de confianza calibrado.
- Comparación histórica, anomalías, reproducción temporal, pendiente Theil–Sen, Mann–Kendall exploratorio y exportaciones CSV.

## Datos y reproducibilidad

`public/data/manifest.json` conserva procedencia y fecha de consulta. Cada cantón tiene un JSON mensual derivado y `raw-<canton>.json` con la respuesta diaria original de NASA. `public/data/forecast/` conserva respuestas de pronóstico y conjuntos originales junto a las agregaciones mostradas.

Actualizar histórico: `npm run data`. Consultar o actualizar pronósticos: botón de la web; el servidor consulta la fuente y conserva el resultado. Si la fuente falla, solo reutiliza una copia con siete días futuros disponibles y muestra una advertencia. Nunca rellena con datos simulados.

El mapa requiere internet para las teselas OpenStreetMap; los límites y el histórico están incluidos. Las tipografías tienen respaldo del sistema si Google Fonts no está disponible. Leaflet 1.9.4 se incluye localmente, licencia BSD-2-Clause.

## Límites científicos

Un punto interior calculado por cantón no es una cabecera, estación meteorológica ni promedio espacial del cantón. La cuadrícula meteorológica NASA es amplia (0,5° × 0,625°; radiación 1° × 1°), por lo que cantones cercanos pueden compartir datos. La elevación del punto puede diferir de zonas pobladas. La interfaz indica ubicación y resolución. El pronóstico usa ese mismo punto solicitado y muestra la elevación de referencia del proveedor.

NASA POWER es un producto de modelos y observaciones satelitales; no son mediciones locales directas. Los pronósticos son resultados meteorológicos con incertidumbre. No se atribuye una tendencia local al cambio climático global de forma automática.

El índice histórico de humedad `GWETTOP` (0–1) no equivale a la humedad volumétrica 0–1 cm del pronóstico (m³/m³). Las unidades y definiciones se muestran separadas.

El histórico se agrega desde datos diarios, con al menos 90 % de días válidos por mes y 12 meses válidos por año. Temperaturas y otras medias se ponderan por días del mes; lluvia se acumula. Si faltaran días, la acumulación estimaría el mes desde la media de días válidos. Referencia de anomalías 2001–2010, no normal climatológica de 30 años. Mann–Kendall bilateral con empates y continuidad; mínimo 10 años para p. Se marca autocorrelación residual de orden 1 para revisión sin corregir p; sin corrección de comparaciones múltiples.

## Verificación

```powershell
npm test
```

## Fuentes y licencias

- NASA POWER: https://power.larc.nasa.gov/docs/ (MERRA-2 y productos solares NASA).
- Pronóstico Open-Meteo: https://open-meteo.com/en/docs (CC BY 4.0; API gratuita para uso no comercial).
- GFS ensemble: https://open-meteo.com/en/docs/ensemble-api
- Límites: geoBoundaries gbOpen CRI ADM2, representación 2020, Wikimedia Commons, CC0 1.0. https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/
- Mapa: © OpenStreetMap contributors. https://www.openstreetmap.org/copyright
- Leaflet: https://leafletjs.com (BSD-2-Clause).

Proyecto independiente, no oficial de NASA. No emite alertas oficiales.

## Experiencia 3D
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
