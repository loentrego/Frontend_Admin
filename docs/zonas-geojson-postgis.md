# Zonas de reparto: GeoJSON y PostGIS

El panel admin (sección **Mapa**) edita las zonas de reparto como polígonos reales.
Este documento explica el formato que exporta y cómo usarlo en el backend para la
**autoasignación** de pedidos.

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

El botón **SQL PostGIS** descarga `zonas-loentrego.sql`, que hace todo esto:

1. Activa la extensión `postgis`.
2. Crea la tabla `zonas_reparto` con un índice espacial **GIST**.
3. Inserta o actualiza cada zona (`ON CONFLICT (id) DO UPDATE`). Usa `ST_MakeValid` por si algún polígono quedó cruzado.
4. Crea la función `zona_para_punto(lat, lon)`.

```bash
psql "$DATABASE_URL" -f zonas-loentrego.sql
```

### Opción B: importar el GeoJSON con `ogr2ogr`

```bash
ogr2ogr -f PostgreSQL PG:"$DATABASE_URL" zonas-loentrego.geojson \
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

La regla es la misma en PostGIS y en el botón **Probar punto** del panel:

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
- Antes de importar, usa **Validar** en el panel. Revisa solapes, huecos y polígonos que se cruzan, con una muestra cada unos 200 m.

## 4. Editar en el panel

- **Editar zonas**:
  - Arrastra un vértice para moverlo. Los vértices compartidos con zonas vecinas se mueven juntos, así no se abren huecos. Con <kbd>Alt</kbd> se mueve solo ese.
  - Arrastra un punto medio para agregar un vértice.
  - Haz doble clic en un vértice para borrarlo.
  - Las coordenadas de cada vértice también se pueden escribir a mano.
- **+ Nueva zona**: toca el mapa para poner cada vértice; se pegan a los vértices vecinos. Para cerrar, toca el primer punto, haz doble clic o pulsa <kbd>Enter</kbd>.
- **Probar punto**: escribe `latitud, longitud` o toca el mapa.
- Los cambios se guardan en el navegador (`localStorage`, clave `loentrego-admin-zonas-v1`) hasta que exista el backend. Para conservarlos o compartirlos, **exporta el GeoJSON**.

Desde el código, `window.LEMapa.zonasGeoJSON()` devuelve las zonas actuales y
`window.LEMapa.asignar(lat, lon)` aplica la misma regla de autoasignación.
