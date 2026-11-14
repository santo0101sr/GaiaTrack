# GaiaTrack

Observatorio interactivo de la provincia de Heredia, Costa Rica. Versión local para NASA Space Apps. No utiliza Sites ni está publicado.

## Abrir

Requiere Node.js 20 o superior. No requiere instalar paquetes.

```powershell
npm start
```

Abrir http://127.0.0.1:4173. No abrir `index.html` directamente: el pronóstico necesita el servidor local.

## Funciones

- Mapa de los diez cantones con puntos de referencia interiores y selector accesible.
- Histórico real NASA POWER 2001–2025: temperatura media, promedio de mínimas diarias, promedio de máximas diarias, radiación solar, precipitación, humedad superficial del suelo y humedad relativa del aire.
- Pronóstico real de los próximos siete días desde mañana, vía Open-Meteo; consulta actualizable y caché de 30 minutos.
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


## OpenWeather: condiciones actuales
Copiar .env.example a .env y definir OPENWEATHER_API_KEY. La clave solo se lee en el servidor; .env está excluido de Git y fuera del directorio público. El endpoint /api/current?site=heredia consulta Current Weather con unidades métricas e idioma español, valida el cantón y conserva los resultados en memoria por diez minutos. La web muestra fecha del dato del proveedor y de consulta; no presenta los mínimos/máximos espaciales de Current Weather como extremos diarios. Valores no reportados no se convierten en cero. Si la clave es rechazada (401), el error se muestra sin inventar condiciones. OpenWeather aporta condiciones actuales; NASA POWER y Open-Meteo mantienen histórico y pronósticos de las variables que no cubre este endpoint. Documentación: https://openweathermap.org/current

