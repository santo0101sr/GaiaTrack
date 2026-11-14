# Revisión de licencias y ruta comercial

Revisión documental al 14 de noviembre de 2026. Vercel se mantiene exclusivamente para pruebas por decisión del usuario. Esta revisión no certifica ausencia de riesgos legales; identifica condiciones y pendientes concretos.

## Proveedor seleccionado y confirmación del responsable

El responsable de GaiaTrack indicó en esta conversación que consultó el uso comercial de Open-Meteo y confirmó que puede utilizarlo para su proyecto. Por instrucción expresa se selecciona Open-Meteo para condiciones actuales, radiación, suelo y pronósticos, y se conserva NASA POWER para el histórico. Esta anotación registra la confirmación del responsable; no es una verificación independiente de una autorización particular del proveedor. No se han contratado planes ni activado cobros. Vercel permanece como entorno de pruebas.

## Diferencia esencial

Los derechos sobre los datos no equivalen al derecho a usar gratis un servicio de API. Los datos de Open-Meteo están bajo CC BY 4.0, con reutilización comercial, atribución y declaración de modificaciones. El acceso a su API gratuita está restringido a usos no comerciales. Vercel Hobby también limita el alojamiento a uso personal/no comercial. La aplicación actual no se presenta como lista para comercializar con esos servicios.

- https://open-meteo.com/en/terms
- https://open-meteo.com/en/pricing
- https://vercel.com/legal/terms
- https://vercel.com/docs/limits/fair-use-guidelines

## Alternativas gratuitas con uso comercial

| Opción | Evidencia primaria | Límites / pendientes para GaiaTrack |
| --- | --- | --- |
| Visual Crossing Free | Su documentación permite uso comercial incluso en Free; 1.000 registros/día; acceso a condiciones, pronósticos e histórico. | Requiere cuenta y clave. Sin método de pago, la documentación indica corte al agotar cuota. Confirmar contrato y atribución, columnas solares y cobertura/plan de humedad del suelo. No asumir que un campo documentado está incluido en Free. |
| WeatherAPI Free | Su web permite uso comercial en Free: 100.000 consultas/mes, sin tarjeta. | Pronóstico gratuito de tres días, insuficiente para los siete días actuales. Los productos Solar Energy y Agriculture tienen condiciones/planes diferentes. No afirmar equivalencia completa con Open-Meteo. |
| NOAA GFS directo (NOMADS) | Datos producidos por NWS/NOAA de dominio público salvo identificación distinta; NOMADS ofrece GFS 0,25° global cada seis horas. | Procesar GRIB2 y verificar parámetros/unidades, intervalo y profundidad de suelo. No es un reemplazo directo de una API JSON. Respetar política de descargas, incluyendo pausas. |

Fuentes:
- https://www.visualcrossing.com/resources/documentation/what-can-i-do-with-the-visual-crossing-weather-free-plan/
- https://www.visualcrossing.com/resources/blog/how-do-i-get-free-weather-api-access/
- https://www.visualcrossing.com/weather-data-pricing/
- https://www.weatherapi.com/
- https://www.weatherapi.com/pricing
- https://www.weather.gov/disclaimer
- https://nomads.ncep.noaa.gov/
- https://nomads.ncep.noaa.gov/info.php?page=gribfilter

Alternativas documentadas para referencia. La decisión vigente del responsable es utilizar Open-Meteo; no se ha abierto cuenta ni contratado plan con estas alternativas.

## Otros componentes

- NASA POWER: conservar reconocimiento a NASA/POWER, ASDC, CERES y MERRA-2 según los productos. No usar logos ni implicar respaldo de NASA. Revisar condiciones específicas por producto antes de un lanzamiento comercial; la política general no garantiza derechos sobre cualquier contenido de terceros. https://power.larc.nasa.gov/docs/acknowledgements/ ; https://science.data.nasa.gov/about/license ; https://www.nasa.gov/nasa-brand-center/images-and-media/
- OpenStreetMap: ODbL, con atribución visible; la política de teselas es distinta de la licencia de datos y no promete servicio ilimitado. https://www.openstreetmap.org/copyright ; https://operations.osmfoundation.org/policies/tiles/
- Natural Earth: dominio público, incluido uso comercial. https://www.naturalearthdata.com/about/terms-of-use/
- geoBoundaries CRI ADM2: metadatos del paquete declaran CC0 1.0; fuente Wikimedia Commons, 2020. Conservar procedencia. https://www.geoboundaries.org/api/current/gbOpen/CRI/ADM2/
- Three.js: MIT; Leaflet: BSD-2-Clause. Licencias incluidas en public/vendor.
- Tipografías DM Sans y Space Grotesk: verificar licencia de cada familia; Google Fonts permite usos comerciales según las licencias individuales. https://developers.google.com/fonts/faq

El inventario visible y las transformaciones están en `/credits.html`. Las partículas, las alturas y el símbolo solar no son imágenes satelitales ni una simulación física: traducen a escalas ilustrativas los datos del punto de referencia. Se indican unidades y campos desconocidos.

## Antes de comercializar

1. Completar prueba técnica y contractual de la fuente alternativa para todas las variables, profundidades e intervalos.
2. Mantener atribución y avisos de cambios, y revisar redistribución/descargas CSV según el contrato elegido.
3. Elegir alojamiento compatible con uso comercial; Vercel Hobby se conserva para pruebas.
4. Verificar marcas, nombre GaiaTrack, privacidad y términos propios según el modelo comercial concreto. No se ha realizado búsqueda registral de marca ni revisión jurídica integral.
