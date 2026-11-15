# GaiaTrack — Observatorio Ambiental 3D de Costa Rica

Observatorio ambiental interactivo para **Costa Rica** (7 provincias, 83 cantones y 479 distritos) desarrollado con ES Modules, Three.js WebGL, Leaflet y servicios Node.js sobre **datos científicos y meteorológicos reales** (sin datos ambientales simulados).

---

## Equipo Creador

| Integrante | Rol | Correo de contacto |
| --- | --- | --- |
| **Santiago Joel Ramírez Víquez** | Desarrollo de Página Web | santo0101sr@gmail.com |
| **Kendall Rojas Cartín** | Desarrollo de Página Web | kendallrc05@gmail.com |
| **Camila Garay Jiménez** | Diseño UI/UX | Camy.sanji@gmail.com |
| **Derling Torres Campos** | Investigación / Recolección API | derling072008@gmail.com |
| **Francinny Saldaña Abarca** | Investigación / Trabajo Escrito | francinnygabriela28@gmail.com |
| **Darren Araya Monge** | Investigación / Trabajo Escrito | DarrenAraya08@gmail.com |

---

## Funcionalidades Principales

1. **Territorio 3D Interactivo (`public/scene.js`)**
   - Mapa 3D WebGL de Costa Rica con selección por **Provincia → Cantón → Distrito**.
   - Representación volumétrica de nubosidad y lluvia en tiempo real basada en las observaciones actuales reportadas por Open-Meteo.
2. **Radar de Riesgo Ecológico (`public/ecological-risk.js`)**
   - Índice exploratorio `0–100` que integra presión térmica e hídrica (**NASA POWER 2001–2025** + temperatura actual **Open-Meteo**), sensibilidad biológica y especies amenazadas (**GBIF / Lista Roja UICN**) y elevación (**Copernicus DEM**).
3. **Predictor en Tiempo Real (`public/simulator.js`, `public/predictor.js`)**
   - **Próximas 48 h:** curva horaria continua en tiempo real (Open-Meteo, hora oficial de Costa Rica `UTC-6`) con inspección interactiva al pasar el mouse.
   - **Próximos 7 días:** pronóstico diario con banda de incertidumbre del conjunto **GFS P10–P90**.
   - **Próximos 12 meses:** modelo estacional con normal mensual **NASA POWER (2001–2025)** + persistencia empírica de la anomalía actual (`AR(1)`) + banda histórica `P10–P90`.
   - **Próximos años (2026–2050):** tendencia robusta **Theil–Sen** anclada a la serie completa, intervalo de confianza al 95 % y banda de variabilidad interanual (`±1σ`).
   - **Récords Históricos (2001–2025)** y resumen por variable (`T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN`, `GWETTOP`, `RH2M`).
4. **Preguntale a Gaia (`api/chat.mjs`, `server/gaia-chat.mjs`)**
   - Asistente científico con comandos locales instantáneos y soporte opcional para **OpenRouter** (`OPENROUTER_API_KEY` y `OPENROUTER_MODEL` en `.env.local`), restringido a datos reales verificados.

---

## Fuentes de Datos Reales

- **NASA POWER (2001–2025):** series diarias/mensuales/anuales de temperatura, precipitación, radiación solar, humedad del suelo y humedad relativa (`MERRA-2` y `CERES`) para los 90 puntos territoriales de referencia.
- **Open-Meteo & GFS Ensemble:** condiciones actuales (`/api/current`), serie horaria y pronóstico a 7 días (`/api/forecast`).
- **GBIF API / UICN & Copernicus DEM:** registros biológicos georreferenciados, especies amenazadas y elevación territorial.
- **Cartografía:** límites territoriales de Costa Rica (`geoBoundaries`, `Natural Earth`).

---

## Desarrollo Local y Verificación

Requiere **Node.js 26.x** (según `package.json`). No requiere instalar dependencias externas de `npm`.

```bash
# Iniciar servidor local y APIs en http://127.0.0.1:4173
npm start

# Ejecutar todas las pruebas automatizadas
npm test

# Validar archivos de despliegue y datos de los 90 territorios
npm run build
```

### Variables de entorno opcionales (`.env.local`)
Copiá `.env.example` a `.env.local` si deseás habilitar consultas libres con IA en **Preguntale a Gaia**:
- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`

*(Nunca subas `.env.local`, `.cache/` ni `.vercel/` al repositorio.)*

---

## Aviso Legal, NASA Space Apps Challenge y Licencia No Comercial

- **Proyecto de Hackathon:** GaiaTrack fue diseñado y desarrollado específicamente para el hackathon **NASA International Space Apps Challenge**.
- **Sin afiliación oficial:** Este es un proyecto independiente. **No es una aplicación oficial de la NASA**, ni cuenta con patrocinio, aval o respaldo institucional de la NASA (de acuerdo con las *NASA Media Usage Guidelines*).
- **Uso de datos científicos:** Todos los datos mostrados provienen de fuentes abiertas y públicas (**NASA POWER / MERRA-2 / CERES**, **Open-Meteo / GFS**, **GBIF / UICN**, **Copernicus DEM**, **geoBoundaries** y **Natural Earth**). No contiene ni redistribuye información clasificada o confidencial.
- **Prohibido el uso comercial o con fines de lucro:** El código fuente original de este repositorio se publica bajo la licencia **PolyForm Noncommercial 1.0.0** ([LICENSE](LICENSE)). Se permite su consulta, estudio y uso educativo o de investigación **estrictamente sin fines de lucro**. Queda prohibida su venta, explotación comercial o redistribución con fines comerciales (incluyendo las restricciones de uso no comercial de las APIs gratuitas de Open-Meteo y Vercel Hobby; ver [docs/LICENSING.md](docs/LICENSING.md)).

