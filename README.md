# Tierras Extranjerizadas - Argentina

![Screenshot](screenshot.png)

Visualizador web para explorar la extranjerizacion de tierras rurales por
departamento y provincia en Argentina. Incluye mapa interactivo, tabla, charts,
buscador y un panel de fuentes con descargas.

## Que es y para que sirve
- Muestra que porcentaje del territorio rural esta en manos extranjeras por
  departamento y provincia.
- Permite identificar concentraciones territoriales (niveles alto, sobre promedio,
  normal) y comparar provincias.
- Ofrece acceso directo a los datos abiertos usados en la visualizacion.

## Uso rapido (visor)
Necesitas servir el sitio con un servidor estatico (por el uso de `fetch`).

```bash
python3 -m http.server 8000
```

Luego abrir: `http://localhost:8000`

Nota: el visor carga Leaflet, Chart.js y tiles desde CDN, por lo que necesita
conexion a internet.

## Funcionalidades
- Mapa con capas de provincias, departamentos y puntos con popups.
- Capa de propietarios destacados (Benetton, Lewis, Glencore) con links a Google Maps y Street View.
- Controles de mapa: Home, Ajustar a datos, selector de capas.
- Filtros globales sincronizados: provincia, departamento, nivel, rango de porcentaje.
- Todos los filtros afectan mapa, tabla y charts simultáneamente.
- Tabla ordenable con click para centrar el mapa.
- Charts configurables desde YAML (incluye chart de propietarios).
- Buscador con autocompletado (departamentos y provincias).
- Vista "Datos" con fuentes y descargas.

## Estructura del proyecto
- `index.html`: layout principal y carga de modulos.
- `css/styles.css`: estilos del visor.
- `js/`: modulos de la app (mapa, tabla, charts, filtros, busqueda, etc).
- `config/`: configuracion de app, charts y fuentes.
- `data/`: datos crudos y documentos de referencia.
- `data/web/`: datos procesados para el navegador (GeoJSON y stats).
- `scripts/prepare_data.py`: pipeline de preparacion de datos.

## Datos y fuentes
Fuentes principales (con enlaces a origen):
- Registro Nacional de Tierras Rurales (RNTR):
  https://www.argentina.gob.ar/justicia/registro-nacional-tierras-rurales
- Instituto Geografico Nacional (IGN):
  https://www.ign.gob.ar/
- Investigacion "Quienes son los duenos de las tierras en la Argentina" (Chequeado):
  https://chequeado.com/investigacion/quienes-son-los-duenos-de-las-tierras-en-la-argentina/

Archivos locales relevantes:
- RNTR (datos base):
  - `data/Tierras.gpkg`
  - `data/extranjerizacion_por_departamento_pdf.pdf`
- IGN (geometrias oficiales):
  - `data/ign_departamentos.gpkg`
  - `data/ign_provincias.gpkg`
- Chequeado (investigacion y anexos):
  - `data/duenostierra.pdf`
  - `data/duenostierra_text.txt`
  - `data/chequeado_departamentos.csv`
  - `data/chequeado_propietarios.csv`
  - `data/chequeado_nacionalidades.csv`
- QGIS (proyectos de referencia):
  - `data/qgis_layers_project.qgz`
  - `data/layers_total_geopackage.qgz`

Licencias: cada fuente mantiene su licencia (ver `config/sources.json`).

## Pipeline de datos (generacion)
El script `scripts/prepare_data.py`:
- Lee `data/Tierras.gpkg` y extrae los datos de extranjerizacion.
- Toma geometrias de IGN para provincias y departamentos.
- Une datos + geometrias, simplifica geometria y genera GeoJSON optimizados.
- Genera `data/web/stats.json` para la tabla y charts.

Requisitos:
- Python 3
- `shapely` (para leer WKB y simplificar geometria)

Ejecucion:
```bash
pip install shapely
python3 scripts/prepare_data.py
```

Salidas generadas:
- `data/web/provincias.geojson`
- `data/web/departamentos.geojson`
- `data/web/puntos.geojson`
- `data/web/propietarios.json` (datos de propietarios identificados)
- `data/web/stats.json`

## Configuracion
- `config/config.json`: titulo, subtitulo, mapa, colores y thresholds.
- `config/charts.yaml`: charts (tipo, fuente, campos, orden, limites).
- `config/sources.json`: tarjetas y descargas en la vista "Datos".
- `config/layers.json`: cargado por la app, pero actualmente no se usa para
  construir las capas (las capas se definen en `js/map.js`).

Nota: el nivel (`alto`, `sobre_promedio`, `normal`) se calcula en el pipeline y se
guarda en los datos. Si cambias thresholds en `config/config.json`, regenera los
datos para mantener consistencia.

## Formato de datos web
Propiedades comunes (departamentos y puntos):
- `nombre`, `provincia`, `total_ha`, `extranjerizada_ha`, `porcentaje`, `nivel`

Provincias:
- `nombre`, `nombre_completo`, `total_ha`, `extranjerizada_ha`, `porcentaje`, `nivel`

`data/web/stats.json`:
- `departamentos`: lista con las propiedades anteriores (para tabla y charts).
- `provincias`: lista agregada por provincia.
- `summary`: conteos para charts de distribucion.

## Tecnologia
- Leaflet (mapa)
- Chart.js (charts)
- js-yaml (parseo de YAML)
- HTML/CSS/JS sin build step
