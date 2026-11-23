"""Arma Scripts/territorio.json: localidades de Bogotá + sectores de Funza + comunas de Soacha.

Fuentes:
  - Bogotá: 19 localidades urbanas (codeforgermany/click_that_hood, bogota.geojson).
  - Funza: límite municipal de OpenStreetMap (relación 1413037, ODbL) y 35 barrios
    con su cuadrante (datos municipales publicados en el repositorio SECUSEO).
  - Soacha: límite municipal de OpenStreetMap (relación 1413196, ODbL). Las comunas
    se APROXIMAN (Voronoi desde un punto de referencia por comuna, recortado al área
    urbana de servicio) porque no hay límites oficiales descargables.
Uso: python3 -I territorio.py <carpeta_geo> <salida.json>
"""
import json, sys, unicodedata
from shapely.geometry import shape, mapping, Point, Polygon, MultiPolygon
from shapely.ops import unary_union, voronoi_diagram
from shapely import set_precision

geo, out = sys.argv[1], sys.argv[2]
TOL = 0.00012          # ~13 m: suficiente a la escala del panel
CERO = lambda g: set_precision(g, 1e-6)

def slug(s):
    s = unicodedata.normalize('NFD', s.strip().lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    import re
    return re.sub(r'-+', '-', ''.join(c if c.isalnum() else '-' for c in s)).strip('-')

def limpiar(g):
    g = g.buffer(0).simplify(TOL, preserve_topology=True)
    if isinstance(g, Polygon): g = MultiPolygon([g])
    # sin huecos internos (el panel trabaja con bordes exteriores) y sin migajas
    partes = [Polygon(p.exterior) for p in g.geoms if p.area > 2e-7]
    return CERO(MultiPolygon(partes) if len(partes) > 1 else partes[0])

feats = []
def add(nombre, municipio, tipo, g, fuente, aproximado=False, extra=None):
    g = limpiar(g)
    pid = slug(nombre) if slug(nombre).startswith(municipio) else slug(f'{municipio}-{nombre}')
    props = {'id': pid, 'nombre': nombre, 'municipio': municipio, 'tipo': tipo, 'aproximado': aproximado, 'fuente': fuente}
    if extra: props.update(extra)
    feats.append({'type': 'Feature', 'id': props['id'], 'properties': props, 'geometry': mapping(g)})

# ---------- Bogotá: localidades ----------
NOMBRES = {'Usaquen': 'Usaquén', 'Engativa': 'Engativá', 'Fontibon': 'Fontibón', 'Antonio Narino': 'Antonio Nariño', 'Los Martires': 'Los Mártires',
           'San Cristobal': 'San Cristóbal', 'Ciudad Bolivar': 'Ciudad Bolívar'}
bog = json.load(open(f'{geo}/cth_bogota.geojson'))
for f in bog['features']:
    n = f['properties']['name'].strip()
    add(NOMBRES.get(n, n), 'bogota', 'localidad', shape(f['geometry']), 'Code for Germany · click_that_hood (localidades de Bogotá)')
bogota_union = unary_union([shape(f['geometry']).buffer(0) for f in bog['features']])

def municipio(path):
    d = json.load(open(path))
    f = d['features'][0] if d.get('type') == 'FeatureCollection' else d
    return shape(f['geometry']).buffer(0)

# ---------- Funza: sectores urbanos por cuadrante + zona rural ----------
funza = municipio(f'{geo}/osm_funza.geojson').difference(bogota_union)
barrios = json.load(open(f'{geo}/funza_barrios.geojson'))['features']
por_cuadrante = {}
for b in barrios:
    por_cuadrante.setdefault(b['properties']['Cuadrante'], []).append(b)
urbano = []
for c in sorted(por_cuadrante):
    grupo = por_cuadrante[c]
    g = unary_union([shape(b['geometry']).buffer(0.0004) for b in grupo]).buffer(-0.0004).intersection(funza)
    urbano.append(g)
    nombres = sorted({b['properties']['NOMBRE'].title() for b in grupo})
    add(f'Funza · Cuadrante {c}', 'funza', 'sector', g, 'Alcaldía de Funza (barrios por cuadrante) · OSM', extra={'barrios': nombres})
rural = funza.difference(unary_union(urbano).buffer(0.0002))
add('Funza · Zona rural', 'funza', 'rural', rural, 'OpenStreetMap (límite municipal, ODbL)')

# ---------- Soacha: 6 comunas (aproximadas) + corregimientos ----------
soacha = municipio(f'{geo}/osm_soacha.geojson').difference(bogota_union)
# área urbana de servicio (mismo polígono de cobertura de la web, [lon, lat])
B = {'b8': (-74.195, 4.665), 'b9': (-74.205, 4.630), 'b10': (-74.200, 4.600), 'b11': (-74.190, 4.575), 'b12': (-74.175, 4.545)}
servicio = Polygon([B['b8'], B['b9'], B['b10'], B['b11'], B['b12'], (-74.200, 4.525), (-74.245, 4.520), (-74.285, 4.555), (-74.280, 4.610), (-74.250, 4.655)])
# envolvente aproximada del casco urbano (las comunas no llegan a la zona rural)
casco = Polygon([(-74.2470, 4.6000), (-74.2330, 4.6125), (-74.2060, 4.6130), (-74.1900, 4.6060), (-74.1715, 4.5920), (-74.1730, 4.5700),
                 (-74.1930, 4.5530), (-74.2250, 4.5480), (-74.2450, 4.5630)])
urb = soacha.intersection(servicio).intersection(casco)
# punto de referencia de cada comuna (aproximado)
COMUNAS = [
    ('Comuna 1 · Compartir', (-74.2290, 4.5975)),
    ('Comuna 2 · Centro', (-74.2175, 4.5800)),
    ('Comuna 3 · La Despensa', (-74.2060, 4.5995)),
    ('Comuna 4 · Cazucá', (-74.1830, 4.5850)),
    ('Comuna 5 · San Mateo', (-74.1990, 4.5865)),
    ('Comuna 6 · San Humberto', (-74.2260, 4.5640)),
]
from shapely.geometry import MultiPoint
vor = voronoi_diagram(MultiPoint([Point(p) for _, p in COMUNAS]), envelope=urb.envelope.buffer(0.05))
celdas = list(vor.geoms)
for nombre, p in COMUNAS:
    cel = next(c for c in celdas if c.contains(Point(p)))
    add(f'Soacha · {nombre}', 'soacha', 'comuna', cel.intersection(urb), 'OpenStreetMap (límite municipal) · comunas aproximadas', aproximado=True)
add('Soacha · Corregimientos (rural)', 'soacha', 'rural', soacha.difference(urb.buffer(0.0002)), 'OpenStreetMap (límite municipal, ODbL)')

gj = {'type': 'FeatureCollection', 'name': 'territorio_loentrego',
      'fuentes': ['Localidades de Bogotá: Code for Germany, click_that_hood', 'Límites municipales de Funza y Soacha: © colaboradores de OpenStreetMap (ODbL)', 'Barrios de Funza por cuadrante: datos municipales', 'Comunas de Soacha: límites APROXIMADOS, reemplazar por el archivo oficial de la Secretaría de Planeación'],
      'features': feats}
txt = json.dumps(gj, ensure_ascii=False, separators=(',', ':'))
open(out, 'w').write(txt)
import gzip
print(len(feats), 'zonas', len(txt) // 1024, 'KB', len(gzip.compress(txt.encode())) // 1024, 'KB gz')
for f in feats:
    g = shape(f['geometry'])
    print(f"  {f['properties']['nombre']:<38} {f['properties']['tipo']:<9} pts={sum(len(p.exterior.coords) for p in (g.geoms if hasattr(g, 'geoms') else [g])):>4}  area={g.area * 12321:.1f} km2")
