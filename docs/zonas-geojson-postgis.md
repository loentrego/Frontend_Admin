# Zonas: GeoJSON y PostGIS

La sección **Mapa** del panel admin maneja dos tipos de zona, ambos como polígonos
WGS84 (EPSG:4326):

| Tipo | Qué es | Se edita | Para qué |
|------|--------|----------|----------|
| **Localidades** | Las 19 localidades urbanas de Bogotá, 4 cuadrantes urbanos + zona rural de Funza y 6 comunas + corregimientos de Soacha (`Scripts/territorio.json`). | No (referencia) | Ver la demanda por localidad y armar reportes. |
| **Zonas de reparto** | El área que atiende cada repartidor. | Sí | La **autoasignación** de pedidos. |

El panel no rastrea la ubicación de los repartidores: solo muestra las zonas
asignadas y la demanda de pedidos.

### Fuentes de las localidades

- **Bogotá**: localidades de *Code for Germany · click_that_hood* (`bogota.geojson`). No incluye Sumapaz, que es rural.
- **Funza**: límite municipal de OpenStreetMap (relación 1413037, ODbL) y 35 barrios agrupados por **cuadrante**, tomados de datos municipales.
- **Soacha**: límite municipal de OpenStreetMap (relación 1413196, ODbL).
  - **Las 6 comunas son aproximadas**: no encontramos los límites oficiales en una fuente descargable.
  - En el mapa se dibujan con borde discontinuo y la etiqueta "aprox.".
  - Hay que reemplazarlas con el shapefile oficial de la Secretaría de Planeación de Soacha.
- El script que arma el archivo está en `docs/territorio.py`. Ahí están las fuentes, la simplificación (unos 13 m) y los puntos de referencia de las comunas.

Antes de usar las localidades en producción, revisa las licencias de las fuentes de
Bogotá y de los barrios de Funza.

## 1. Formato del GeoJSON

- Estándar **GeoJSON (RFC 7946)**.
- Coordenadas **WGS84**, en el orden **`[longitud, latitud]`**. En PostGIS equivale a **SRID 4326**.
- Cada zona es un `Feature` de tipo `Polygon`, o `MultiPolygon` si tiene varias partes.
- Los anillos van cerrados (el primer punto se repite al final) y en sentido antihorario.
- Las coordenadas tienen 6 decimales, unos 11 cm de precisión.

```json
{
  "type": "FeatureCollection",
  "name": "zonas_reparto_loentrego",
  "features": [
    {
      "type": "Feature",
      "id": "chapinero",
      "properties": {
        "id": "chapinero",
        "nombre": "Chapinero",
        "municipio": "bogota",
        "repartidores": ["r1"],
        "capacidad_diaria": 12,
        "prioridad": 0
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-74.0571, 4.6203], [-74.0443, 4.6672], [-74.0711, 4.6630], [-74.0571, 4.6203]]]
      }
    }
  ]
}
```

| Propiedad          | Tipo       | Para qué sirve |
|--------------------|------------|----------------|
| `id`               | texto      | Identificador estable de la zona (clave primaria). |
| `nombre`           | texto      | Nombre visible. |
| `municipio`        | texto      | `bogota`, `funza` o `soacha`. |
| `repartidores`     | texto[]    | IDs de los repartidores que atienden la zona. |
| `capacidad_diaria` | entero     | Pedidos al día por repartidor; el panel lo usa para calcular "faltan N repartidores". |
| `prioridad`        | entero     | Si dos zonas se solapan, gana la de mayor prioridad. |

Al importar, el panel acepta un `FeatureCollection`, un `Feature` suelto o una geometría
`Polygon` o `MultiPolygon` suelta. También:

- Corrige las coordenadas si vienen como `[lat, lon]`.
- Ignora los huecos internos.
- Avisa de todo lo que cambió.

## 2. Llevarlo a PostGIS

### Opción A: el SQL que genera el panel

`window.LEMapa.sql()` genera el script (por ejemplo, desde la consola del navegador en el panel). El script hace todo esto:

1. Activa la extensión `postgis`.
2. Crea la tabla `zonas_reparto` con un índice espacial **GIST**.
3. Crea también la tabla `localidades`, con su propio índice espacial.
4. Inserta o actualiza cada zona de reparto y cada localidad (`ON CONFLICT (id) DO UPDATE`). Usa `ST_MakeValid` por si algún polígono quedó cruzado.
5. Crea las funciones `zona_para_punto(lat, lon)`, para la autoasignación, y `localidad_para_punto(lat, lon)`, para los reportes.

```bash
psql "$DATABASE_URL" -f zonas-loentrego.sql
```

### Opción B: importar el GeoJSON con `ogr2ogr`

```bash
ogr2ogr -f PostgreSQL PG:"$DATABASE_URL" zonas-reparto-loentrego.geojson \
  -nln zonas_reparto_import -nlt PROMOTE_TO_MULTI -lco GEOMETRY_NAME=geom -t_srs EPSG:4326
```

### Opción C: desde el backend (API)

```sql
INSERT INTO zonas_reparto (id, nombre, municipio, repartidores, capacidad_diaria, prioridad, geom)
VALUES ($1, $2, $3, $4, $5, $6, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($7), 4326))))
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre, municipio = EXCLUDED.municipio, repartidores = EXCLUDED.repartidores,
  capacidad_diaria = EXCLUDED.capacidad_diaria, prioridad = EXCLUDED.prioridad,
  geom = EXCLUDED.geom, actualizado = now();
```

Aquí `$7` es `feature.geometry` en texto JSON.

## 3. Autoasignación

La regla es la misma en PostGIS y en `window.LEMapa.asignar()`:

1. Se usa la zona que **contiene** el punto de entrega. Se usa `ST_Covers`, así que un punto justo sobre el borde también cuenta.
2. Si varias zonas lo contienen (solape), gana la de **mayor `prioridad`**.
3. Si no cae en ninguna (un hueco, o fuera de la cobertura), se usa la **zona más cercana** (`<->`, que aprovecha el índice GIST).

```sql
SELECT * FROM zona_para_punto(4.6486, -74.0628);
-- id | nombre | repartidores | dentro
```

Para asignar un pedido nuevo, con el punto geocodificado de su dirección:

```sql
UPDATE pedidos p
SET zona_id = z.id
FROM LATERAL zona_para_punto(p.lat, p.lon) z
WHERE p.id = $1;
```

Después el backend elige al repartidor dentro de `z.repartidores`. Por ejemplo, el que
tenga menos pedidos activos, o el más cercano según su última ubicación.

Recomendaciones:

- Guarda el punto del pedido como `geography(Point, 4326)` o `geometry(Point, 4326)`. Si vas a buscar repartidores por distancia, crea también un índice GIST para esos puntos.
- Si el resultado trae `dentro = false`, márcalo para revisión: la dirección quedó fuera de las zonas.
- Antes de importar, usa **⋯ → Revisar zonas** en el panel. Revisa solapes, huecos, polígonos cruzados y zonas sin repartidor, con una muestra cada unos 200 m.

## 4. Editar en el panel

El mapa ocupa toda la pantalla y los menús flotan encima. El panel no muestra
coordenadas: el usuario solo ve zonas, repartidores y demanda.

En la pestaña **Zonas de reparto**:

- **Toda zona tiene repartidor.** No se puede crear ni dejar una zona sin repartidor: el formulario usa una sola opción, que es obligatoria.
- **+ Nueva zona**: primero se elige el repartidor y después se marca el contorno en el mapa.
  - Al crearla, las zonas de alrededor **se recortan** para que no queden encima. Si una zona queda cubierta por completo, se elimina y el panel avisa.
  - El recorte usa la librería `polygon-clipping` (MIT), guardada en `Scripts/vendor/`.
- **Editar**:
  - Arrastra un punto blanco para mover el borde, o uno pequeño para agregar un punto. Doble clic quita un punto.
  - Los puntos compartidos con zonas vecinas se mueven juntos.
  - Al soltar un punto, la zona editada conserva su área y las vecinas se recortan.
- **Menú ⋯**:
  - *Revisar zonas*: busca solapes, huecos y polígonos cruzados.
  - *Descargar zonas*: baja el GeoJSON de este documento.
  - *Cargar zonas desde archivo…*: sube un GeoJSON.
  - *Volver a las zonas iniciales*.
- Si una zona queda totalmente dentro de otra, la de afuera conserva un **hueco**. En el GeoJSON sale como un anillo interior, y PostGIS lo maneja igual.
- Los cambios se guardan en el navegador (`localStorage`, clave `loentrego-admin-zonas-v1`) hasta que exista el backend.

Desde el código, para el backend o el equipo técnico (no aparece en la interfaz):

- `window.LEMapa.zonasGeoJSON()` devuelve las zonas de reparto.
- `window.LEMapa.localidadesGeoJSON()` devuelve las localidades.
- `window.LEMapa.asignar(lat, lon)` aplica la regla de autoasignación y además devuelve la localidad del punto.
- `window.LEMapa.sql()` devuelve el SQL para PostGIS (tablas, índices, datos y funciones).
