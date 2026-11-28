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
  "name": "zonas_loentrego",
  "features": [
    {
      "type": "Feature",
      "id": "chapinero",
      "properties": {
        "id": "chapinero",
        "nombre": "Chapinero",
        "area_id": "bogota",
        "repartidor_id": "r1",
        "capacidad_diaria": 12
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-74.0571, 4.6203], [-74.0443, 4.6672], [-74.0711, 4.6630], [-74.0571, 4.6203]]]
      }
    }
  ]
}
```

Las propiedades tienen los mismos nombres que las columnas de la tabla `zonas` de la base (Técnico):

| Propiedad          | Tipo   | Para qué sirve |
|--------------------|--------|----------------|
| `id`               | texto  | Identificador estable de la zona (clave primaria). |
| `nombre`           | texto  | Nombre visible. |
| `area_id`          | texto  | Área de cobertura: `bogota`, `funza` o `soacha`. |
| `repartidor_id`    | texto  | El repartidor de la zona. **Uno solo** y obligatorio (un repartidor puede tener varias zonas). |
| `capacidad_diaria` | entero | Pedidos al día que aguanta la zona; con esto se calcula su carga. |

Al importar, el panel acepta un `FeatureCollection`, un `Feature` suelto o una geometría
`Polygon` o `MultiPolygon` suelta. También:

- Acepta el formato anterior (`municipio`, `repartidores`) y lo convierte.
- Corrige las coordenadas si vienen como `[lat, lon]`.
- Avisa de todo lo que cambió.

## 2. Cómo se guarda en la base

Todo el contorno va en **una sola columna** `contorno` de tipo `geometry(MultiPolygon, 4326)`
(no hay una fila por punto). Así PostGIS responde "¿en qué zona cae este punto?" con un índice
espacial, y maneja zonas en varias partes, huecos y bordes compartidos con la vecina.

### Opción A: el SQL que genera el panel

`window.LEMapa.sql()` genera los `INSERT … ON CONFLICT (id) DO UPDATE` para la tabla `zonas`
(la tabla y sus índices ya están en `tecnico_loentrego/db/esquema.sql`). Usa `ST_MakeValid`
por si algún polígono quedó cruzado. `repartidor_id` debe ser el id (uuid) del repartidor en la base.

```bash
psql "$DATABASE_URL" -f zonas-loentrego.sql
```

### Opción B: desde el backend (API)

```sql
INSERT INTO zonas (id, nombre, area_id, repartidor_id, capacidad_diaria, contorno)
VALUES ($1, $2, $3, $4, $5, ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($6), 4326))))
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre, area_id = EXCLUDED.area_id, repartidor_id = EXCLUDED.repartidor_id,
  capacidad_diaria = EXCLUDED.capacidad_diaria, contorno = EXCLUDED.contorno, archivado_en = NULL;
```

Aquí `$6` es `feature.geometry` en texto JSON. Para devolverla al panel: `ST_AsGeoJSON(contorno)`.

## 3. Autoasignación

La regla es la misma en PostGIS y en `window.LEMapa.asignar()`:

1. Se usa la zona que **contiene** el punto de entrega (`ST_Covers`: un punto justo sobre el borde también cuenta).
2. Si no cae en ninguna (un hueco, o fuera de la cobertura), se usa la **zona más cercana** (`<->`, que aprovecha el índice GIST) y el pedido queda marcado `fuera_de_zona` para revisión.
3. El pedido va al **repartidor de esa zona**, si está activo.

El backend la llama al crear el pedido (las coordenadas no se guardan) y guarda el repartidor y la tarifa que devuelve:

```sql
SELECT * FROM zona_para_punto(4.6486, -74.0628);
-- id | nombre | dentro | repartidor_id | tarifa
```

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
- La interfaz no tiene menú de archivos. El GeoJSON y el SQL se obtienen desde el código (ver abajo).
- Si una zona queda totalmente dentro de otra, la de afuera conserva un **hueco**. En el GeoJSON sale como un anillo interior, y PostGIS lo maneja igual.
- Los cambios se guardan en el navegador (`localStorage`, clave `loentrego-admin-zonas-v2`) hasta que exista el backend.

Desde el código, para el backend o el equipo técnico (no aparece en la interfaz):

- `window.LEMapa.zonasGeoJSON()` devuelve las zonas (con `area_id` y `repartidor_id`).
- `window.LEMapa.localidadesGeoJSON()` devuelve las localidades (solo para dibujar el mapa; la base no las guarda).
- `window.LEMapa.asignar(lat, lon)` aplica la regla de autoasignación y además devuelve la localidad del punto.
- `window.LEMapa.sql()` devuelve el SQL para cargar las zonas en la tabla `zonas` de la base.
