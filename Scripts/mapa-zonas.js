// =====================================================================
//  LoEntrego · Admin — Mapa y editor de zonas de reparto
//
//  Las zonas son polígonos reales en WGS84 (EPSG:4326, [longitud, latitud]),
//  el mismo formato que usa GeoJSON (RFC 7946) y que PostGIS importa directo.
//  Sirven para la AUTOASIGNACIÓN: el punto de entrega de un pedido cae en
//  una zona y esa zona dice qué repartidores la atienden.
//
//  Qué se puede hacer:
//    · Ver: calor de pedidos, presión por zona, calles y repartidores.
//    · Editar: mover / agregar / borrar vértices (se pegan a los vértices
//      vecinos para no dejar huecos ni solapes), datos de la zona y
//      coordenadas escritas a mano.
//    · Nueva zona: dibujar un polígono punto a punto.
//    · Probar punto: escribir o tocar una coordenada y ver a qué zona y
//      repartidores se asignaría (misma regla que el SQL exportado).
//    · Importar / exportar GeoJSON, exportar SQL para PostGIS y validar.
//  Todo se guarda en este navegador (localStorage) hasta tener backend.
//
//  ⚠️ Las cifras de pedidos y repartidores por zona son DATOS DE EJEMPLO.
// =====================================================================
(() => {
  'use strict';

  const LIMA = '181, 219, 46';
  const CLAVE = 'loentrego-admin-zonas-v1';
  const PEDIDOS_POR_REPARTIDOR = 12;   // capacidad de referencia por día (si la zona no define otra)

  // ---------- Cobertura (polígonos de la web, [lat, lon]) ----------
  const B = { b5: [4.750, -74.130], b6: [4.725, -74.150], b7: [4.700, -74.180], b8: [4.665, -74.195], b9: [4.630, -74.205], b10: [4.600, -74.200], b11: [4.575, -74.190], b12: [4.545, -74.175] };
  const COBERTURA = {
    bogota: [[4.795, -74.030], [4.805, -74.065], [4.800, -74.100], [4.780, -74.118], B.b5, B.b6, B.b7, B.b8, B.b9, B.b10, B.b11, B.b12, [4.510, -74.150], [4.480, -74.120], [4.470, -74.090], [4.500, -74.065], [4.550, -74.060], [4.600, -74.045], [4.655, -74.035], [4.725, -74.020]],
    funza: [B.b5, B.b6, B.b7, B.b8, [4.655, -74.250], [4.700, -74.262], [4.760, -74.245], [4.768, -74.195], [4.760, -74.160]],
    soacha: [B.b8, B.b9, B.b10, B.b11, B.b12, [4.525, -74.200], [4.520, -74.245], [4.555, -74.285], [4.610, -74.280], [4.655, -74.250]],
  };
  const MUNICIPIOS = { bogota: 'Bogotá', funza: 'Funza', soacha: 'Soacha' };

  // ---------- Zonas iniciales y datos de ejemplo ----------
  //  demo: [pedidos hoy, repartidores, minutos promedio, entregados, novedades]
  const SEMILLAS = [
    { id: 'usaquen',   nombre: 'Usaquén',                 municipio: 'bogota', centro: [4.722, -74.036], demo: [58, 5, 41, 40, 1], repartidores: ['r2'] },
    { id: 'suba',      nombre: 'Suba',                    municipio: 'bogota', centro: [4.748, -74.086], demo: [52, 4, 47, 33, 3], repartidores: ['r2'] },
    { id: 'chapinero', nombre: 'Chapinero',               municipio: 'bogota', centro: [4.650, -74.057], demo: [64, 5, 38, 47, 2], repartidores: ['r1'] },
    { id: 'barrios',   nombre: 'Barrios Unidos',          municipio: 'bogota', centro: [4.672, -74.085], demo: [34, 3, 36, 26, 1], repartidores: ['r1'] },
    { id: 'engativa',  nombre: 'Engativá',                municipio: 'bogota', centro: [4.706, -74.116], demo: [41, 4, 44, 28, 2], repartidores: [] },
    { id: 'fontibon',  nombre: 'Fontibón',                municipio: 'bogota', centro: [4.672, -74.150], demo: [22, 2, 39, 17, 0], repartidores: [] },
    { id: 'centro',    nombre: 'Centro · Teusaquillo',    municipio: 'bogota', centro: [4.610, -74.075], demo: [29, 3, 33, 22, 1], repartidores: ['r1'] },
    { id: 'puente',    nombre: 'Puente Aranda',           municipio: 'bogota', centro: [4.625, -74.112], demo: [18, 2, 35, 14, 0], repartidores: ['r3'] },
    { id: 'kennedy',   nombre: 'Kennedy',                 municipio: 'bogota', centro: [4.628, -74.155], demo: [46, 3, 52, 27, 4], repartidores: ['r3'] },
    { id: 'bosa',      nombre: 'Bosa',                    municipio: 'bogota', centro: [4.605, -74.188], demo: [21, 2, 55, 11, 2], repartidores: [] },
    { id: 'sur',       nombre: 'Tunjuelito · C. Bolívar', municipio: 'bogota', centro: [4.565, -74.140], demo: [14, 2, 58, 8, 1], repartidores: [] },
    { id: 'usme',      nombre: 'Usme · San Cristóbal',    municipio: 'bogota', centro: [4.525, -74.100], demo: [8, 1, 61, 5, 1], repartidores: [] },
    { id: 'funza',     nombre: 'Funza',                   municipio: 'funza',  centro: [4.716, -74.214], demo: [16, 2, 34, 12, 0], repartidores: ['r2'] },
    { id: 'soacha',    nombre: 'Soacha',                  municipio: 'soacha', centro: [4.585, -74.230], demo: [27, 2, 57, 15, 2], repartidores: [] },
  ];
  const DEMO = Object.fromEntries(SEMILLAS.map((z) => [z.id, z.demo]));
  const NIVELES = [
    { id: 'caliente', label: 'Caliente', min: 13 },
    { id: 'alta', label: 'Alta', min: 10.5 },
    { id: 'normal', label: 'Normal', min: 7 },
    { id: 'tranquila', label: 'Tranquila', min: 0 },
  ];
  const RELLENO = { caliente: 0.22, alta: 0.16, normal: 0.11, tranquila: 0.06 };

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('es-CO');
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const KX = Math.cos(4.64 * Math.PI / 180);                // corrección de longitud a esta latitud
  const riders = () => (window.LEAdmin && window.LEAdmin.riders) || [];
  const riderNombre = (id) => (riders().find((r) => r.id === id) || {}).nombre || id;
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zona';
  let semilla = 11;
  const rnd = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // Geometría en [lon, lat]
  const dentroAnillo = (lon, lat, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const dentroZona = (lon, lat, z) => z.partes.some((ring) => dentroAnillo(lon, lat, ring));
  const areaFirmada = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return a / 2; };
  function centroide(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (!a) return ring[0];
    return [cx / (3 * a), cy / (3 * a)];
  }
  const parteMayor = (z) => z.partes.reduce((m, r) => (Math.abs(areaFirmada(r)) > Math.abs(areaFirmada(m)) ? r : m), z.partes[0]);
  function puntoEtiqueta(z) {
    const ring = parteMayor(z);
    const c = centroide(ring);
    if (dentroAnillo(c[0], c[1], ring)) return c;
    // cóncavo: el tramo horizontal más largo dentro de la zona
    let mejor = c, largo = -1;
    const ys = ring.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (let k = 1; k < 10; k++) {
      const lat = y0 + (y1 - y0) * k / 10, xs = [];
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat)) xs.push((xj - xi) * (lat - yi) / (yj - yi) + xi);
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > largo) { largo = xs[i + 1] - xs[i]; mejor = [(xs[i] + xs[i + 1]) / 2, lat]; }
    }
    return mejor;
  }
  // distancia (en grados con corrección) de un punto al borde de una zona
  function distBorde(lon, lat, z) {
    let d = Infinity;
    for (const ring of z.partes) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0] * KX, ay = ring[j][1], bx2 = ring[i][0] * KX, by2 = ring[i][1], px = lon * KX, py = lat;
      const dx = bx2 - ax, dy = by2 - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
      d = Math.min(d, Math.hypot(px - ax - t * dx, py - ay - t * dy));
    }
    return d;
  }
  const seCortan = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };
  function autoCruce(ring) {
    const n = ring.length;
    for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (seCortan(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) return true;
    }
    return false;
  }

  // Zonas iniciales: Voronoi de los centros recortado al municipio (polígonos exactos)
  function recortarSemiplano(ring, ci, cj) {
    const mx = ((ci[0] + cj[0]) / 2) * KX, my = (ci[1] + cj[1]) / 2, nx = (cj[0] - ci[0]) * KX, ny = cj[1] - ci[1];
    const f = (p) => (p[0] * KX - mx) * nx + (p[1] - my) * ny;   // <= 0: más cerca de ci
    const out = [];
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length], fp = f(p), fq = f(q);
      if (fp <= 0) out.push(p);
      if ((fp <= 0) !== (fq <= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return out;
  }
  function zonasIniciales() {
    const cob = Object.fromEntries(Object.entries(COBERTURA).map(([k, v]) => [k, v.map(([la, lo]) => [lo, la])]));
    const zonas0 = SEMILLAS.map((s) => {
      let ring = cob[s.municipio];
      const c = [s.centro[1], s.centro[0]];
      if (s.municipio === 'bogota') for (const o of SEMILLAS) if (o !== s && o.municipio === 'bogota') ring = recortarSemiplano(ring, c, [o.centro[1], o.centro[0]]);
      ring = ring.map(([x, y]) => [r6(x), r6(y)]);
      return { id: s.id, nombre: s.nombre, municipio: s.municipio, repartidores: [...s.repartidores], capacidad: PEDIDOS_POR_REPARTIDOR, prioridad: 0, partes: [ring] };
    });
    // Los cortes de las zonas de Bogotá que caen sobre el borde de Funza o Soacha se agregan
    // también a esos polígonos: así son vértices compartidos y se mueven juntos al editar.
    const sobre = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (L || 1);
      return t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(L || 1) < 2e-6;
    };
    const bogota = zonas0.filter((z) => z.municipio === 'bogota').flatMap((z) => z.partes[0]);
    zonas0.filter((z) => z.municipio !== 'bogota').forEach((z) => {
      const ring = z.partes[0];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const enBorde = bogota.filter((p) => sobre(p, a, b) && !ring.some((w) => Math.abs(w[0] - p[0]) < 1e-6 && Math.abs(w[1] - p[1]) < 1e-6));
        if (!enBorde.length) continue;
        enBorde.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
        const unicos = enBorde.filter((p, k) => !k || Math.abs(p[0] - enBorde[k - 1][0]) > 1e-6 || Math.abs(p[1] - enBorde[k - 1][1]) > 1e-6);
        ring.splice(i + 1, 0, ...unicos.map((p) => [...p]));
        i += unicos.length;
      }
    });
    return zonas0;
  }

  // ---------- Guardado ----------
  let zonas = [];
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (d && Array.isArray(d.zonas) && d.zonas.length) { zonas = d.zonas; return; }
    } catch { /* datos dañados: se usan los iniciales */ }
    zonas = zonasIniciales();
  }
  let avisoGuardado = 0;
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ version: 1, actualizado: new Date().toISOString(), zonas })); } catch { /* modo privado */ }
    const el = $('#mz-guardado');
    if (el) { el.textContent = 'Guardado en este navegador'; el.classList.add('ok'); clearTimeout(avisoGuardado); avisoGuardado = setTimeout(() => el.classList.remove('ok'), 1600); }
    huboCambio();
  }

  // ---------- GeoJSON ----------
  const cerrar = (ring) => { const r = ring.map(([x, y]) => [r6(x), r6(y)]); const a = r[0], b = r[r.length - 1]; if (a[0] !== b[0] || a[1] !== b[1]) r.push([...a]); return r; };
  const antihorario = (ring) => (areaFirmada(ring) < 0 ? [...ring].reverse() : ring);   // regla de la mano derecha (RFC 7946)
  function aGeoJSON() {
    return {
      type: 'FeatureCollection',
      name: 'zonas_reparto_loentrego',
      // RFC 7946: coordenadas WGS84 [longitud, latitud]; equivale a EPSG:4326 en PostGIS
      features: zonas.map((z) => {
        const anillos = z.partes.map((r) => cerrar(antihorario(r)));
        return {
          type: 'Feature',
          id: z.id,
          properties: { id: z.id, nombre: z.nombre, municipio: z.municipio, repartidores: z.repartidores, capacidad_diaria: Number(z.capacidad) || PEDIDOS_POR_REPARTIDOR, prioridad: Number(z.prioridad) || 0 },
          geometry: anillos.length === 1 ? { type: 'Polygon', coordinates: [anillos[0]] } : { type: 'MultiPolygon', coordinates: anillos.map((r) => [r]) },
        };
      }),
    };
  }
  function deGeoJSON(gj) {
    const avisos = [];
    let feats;
    if (gj && gj.type === 'FeatureCollection') feats = gj.features || [];
    else if (gj && gj.type === 'Feature') feats = [gj];
    else if (gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon')) feats = [{ type: 'Feature', properties: {}, geometry: gj }];
    else throw new Error('El archivo no es un GeoJSON de polígonos (FeatureCollection, Feature o Polygon).');
    const valido = (c) => Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
    const usados = new Set();
    const salida = [];
    feats.forEach((f, n) => {
      const g = f && f.geometry, p = (f && f.properties) || {};
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) { avisos.push(`Elemento ${n + 1}: no es un polígono, se omitió.`); return; }
      const polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const partes = [];
      (polis || []).forEach((poli) => {
        if (!Array.isArray(poli) || !poli.length) return;
        if (poli.length > 1) avisos.push(`"${p.nombre || p.name || n + 1}": tenía huecos internos; se conservó solo el borde exterior.`);
        const ring = (poli[0] || []).filter(valido).map((c) => [r6(+c[0]), r6(+c[1])]);
        if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
        if (ring.length >= 3) partes.push(ring);
      });
      if (!partes.length) { avisos.push(`Elemento ${n + 1}: sin coordenadas válidas, se omitió.`); return; }
      // deben venir como [lon, lat]; si parecen invertidas (Colombia: lat ~4, lon ~-74), se corrigen
      const [x, y] = partes[0][0];
      if (Math.abs(x) < 20 && Math.abs(y) > 60) { partes.forEach((r) => r.forEach((c) => c.reverse())); avisos.push(`"${p.nombre || n + 1}": las coordenadas venían como [lat, lon]; se invirtieron a [lon, lat].`); }
      let id = String(p.id ?? f.id ?? slug(p.nombre || p.name || `zona-${n + 1}`));
      while (usados.has(id)) id += '-2';
      usados.add(id);
      const mun = String(p.municipio || '').toLowerCase();
      salida.push({
        id, nombre: String(p.nombre || p.name || `Zona ${n + 1}`),
        municipio: MUNICIPIOS[mun] ? mun : (Object.keys(MUNICIPIOS).find((k) => MUNICIPIOS[k].toLowerCase() === mun) || 'bogota'),
        repartidores: Array.isArray(p.repartidores) ? p.repartidores.map(String) : [],
        capacidad: Number(p.capacidad_diaria ?? p.capacidad) || PEDIDOS_POR_REPARTIDOR,
        prioridad: Number(p.prioridad) || 0,
        partes,
      });
    });
    if (!salida.length) throw new Error('No se encontró ninguna zona válida en el archivo.');
    return { zonas: salida, avisos };
  }
  function descargar(nombre, texto, tipo) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const sqlTexto = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  function aSQL() {
    const fecha = new Date().toISOString().slice(0, 10);
    const filas = aGeoJSON().features.map((f) => {
      const p = f.properties;
      const reps = 'ARRAY[' + p.repartidores.map(sqlTexto).join(', ') + ']::text[]';
      return `INSERT INTO zonas_reparto (id, nombre, municipio, repartidores, capacidad_diaria, prioridad, geom)
VALUES (${sqlTexto(p.id)}, ${sqlTexto(p.nombre)}, ${sqlTexto(p.municipio)}, ${reps}, ${p.capacidad_diaria}, ${p.prioridad},
  ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${sqlTexto(JSON.stringify(f.geometry))}), 4326))))
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, municipio = EXCLUDED.municipio, repartidores = EXCLUDED.repartidores,
  capacidad_diaria = EXCLUDED.capacidad_diaria, prioridad = EXCLUDED.prioridad, geom = EXCLUDED.geom, actualizado = now();`;
    });
    return `-- LoEntrego · Zonas de reparto para PostGIS (generado desde el panel admin, ${fecha})
-- Coordenadas WGS84 (EPSG:4326). Ver docs/zonas-geojson-postgis.md

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS zonas_reparto (
  id               text PRIMARY KEY,
  nombre           text NOT NULL,
  municipio        text NOT NULL,
  repartidores     text[] NOT NULL DEFAULT '{}',
  capacidad_diaria integer NOT NULL DEFAULT ${PEDIDOS_POR_REPARTIDOR},
  prioridad        integer NOT NULL DEFAULT 0,
  geom             geometry(MultiPolygon, 4326) NOT NULL,
  actualizado      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zonas_reparto_geom_idx ON zonas_reparto USING GIST (geom);

BEGIN;
${filas.join('\n\n')}
COMMIT;

-- Autoasignación: zona del punto de entrega (si hay solape, gana la de mayor prioridad;
-- si el punto cae en un hueco, la zona más cercana).
CREATE OR REPLACE FUNCTION zona_para_punto(lat double precision, lon double precision)
RETURNS TABLE (id text, nombre text, repartidores text[], dentro boolean)
LANGUAGE sql STABLE AS $$
  WITH p AS (SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS g)
  SELECT z.id, z.nombre, z.repartidores, ST_Covers(z.geom, p.g) AS dentro
  FROM zonas_reparto z, p
  ORDER BY ST_Covers(z.geom, p.g) DESC, z.prioridad DESC, z.geom <-> p.g
  LIMIT 1;
$$;

-- Ejemplo:  SELECT * FROM zona_para_punto(4.6486, -74.0628);
`;
  }

  // ---------- Validación (solapes, huecos y polígonos cruzados) ----------
  function validar() {
    const res = { solapes: new Map(), huecos: 0, muestras: 0, cruzadas: [], pocos: [] };
    zonas.forEach((z) => z.partes.forEach((r) => { if (r.length < 3) res.pocos.push(z.nombre); else if (autoCruce(r)) res.cruzadas.push(z.nombre); }));
    const cob = Object.values(COBERTURA).map((p) => p.map(([la, lo]) => [lo, la]));
    const N = 140;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const lon = LON[0] + (LON[1] - LON[0]) * i / N, lat = LAT[0] + (LAT[1] - LAT[0]) * j / N;
      if (!cob.some((r) => dentroAnillo(lon, lat, r))) continue;
      res.muestras++;
      // tolerancia ~2 m: un punto justo sobre un borde compartido no es solape ni hueco
      const TOL = 2e-5;
      const en = zonas.filter((z) => dentroZona(lon, lat, z) && distBorde(lon, lat, z) > TOL);
      if (!en.length && !zonas.some((z) => dentroZona(lon, lat, z) || distBorde(lon, lat, z) <= TOL)) res.huecos++;
      for (let a = 0; a < en.length; a++) for (let b = a + 1; b < en.length; b++) {
        const k = [en[a].nombre, en[b].nombre].sort().join(' y ');
        res.solapes.set(k, (res.solapes.get(k) || 0) + 1);
      }
    }
    return res;
  }

  // ---------- Autoasignación (misma regla que el SQL) ----------
  function asignar(lat, lon) {
    const dentro = zonas.filter((z) => dentroZona(lon, lat, z)).sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
    if (dentro.length) return { zona: dentro[0], dentro: true, otras: dentro.slice(1) };
    if (!zonas.length) return null;
    const cerca = zonas.map((z) => [z, distBorde(lon, lat, z)]).sort((a, b) => a[1] - b[1])[0];
    return { zona: cerca[0], dentro: false, km: cerca[1] * 111.32 };
  }

  // ---------- Estadísticas (ejemplo) ----------
  let periodo = 'hoy';
  function stats(z) {
    const [p, r, t, e, n] = DEMO[z.id] || [0, z.repartidores.length, 0, 0, 0];
    const k = periodo === 'hoy' ? 1 : 6.6;
    const cap = Number(z.capacidad) || PEDIDOS_POR_REPARTIDOR;
    const presion = r ? p / r : (p ? 99 : 0);
    const nivel = NIVELES.find((x) => presion >= x.min);
    const pedidos = Math.round(p * k), entregados = Math.round(e * k), novedades = Math.round(n * k);
    return { pedidos, repartidores: r, tiempo: t, entregados, novedades, enCurso: Math.max(0, pedidos - entregados - novedades), presion, nivel, faltan: Math.max(0, Math.ceil(p / cap) - r) };
  }

  // ---------- Calles (archivo compacto de la web) ----------
  let calles = null;
  function leerCalles(texto) {
    const av = [], ca = [];
    for (const ln of texto.split('\n')) {
      const tipo = ln[0];
      if (tipo !== 'A' && tipo !== 'C') continue;
      const pts = [];
      let i = 1, la = 0, lo = 0;
      while (i < ln.length) {
        for (let k = 0; k < 2; k++) {
          let r = 0, sh = 0, b;
          do { b = ln.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32);
          const v = r & 1 ? ~(r >> 1) : r >> 1;
          if (k) lo += v; else la += v;
        }
        pts.push([lo / 5000, la / 5000]);
      }
      (tipo === 'A' ? av : ca).push(pts);
    }
    return { av, ca };
  }

  // ---------- Vista: proyección, zoom y desplazamiento ----------
  const LAT = [4.462, 4.812], LON = [-74.292, -74.012];
  let canvas, ctx, W = 0, H = 0, DPR = 1, esc0 = 1, bx = 0, by = 0, zoom = 1, panX = 0, panY = 0;
  const aPx = (lon, lat) => [(bx + (lon - LON[0]) * KX * esc0) * zoom + panX, (by + (LAT[1] - lat) * esc0) * zoom + panY];
  const aGeo = (x, y) => { const sx = (x - panX) / zoom, sy = (y - panY) / zoom; return [LON[0] + (sx - bx) / (KX * esc0), LAT[1] - (sy - by) / esc0]; };

  const capas = { calor: true, zonas: true, calles: true, repartidores: true };
  let modo = 'ver';            // ver | editar | dibujar | probar
  let elegida = null;          // índice de zona
  let encima = null;           // zona bajo el cursor
  let dibujo = [];             // puntos de la zona nueva [lon, lat]
  let prueba = null;           // { lon, lat, res }
  let cursor = null;           // [lon, lat]
  let callesSucias = true;
  let arrastre = null;         // { zi, pi, vi, v } vértice que se mueve
  let paneo = null;            // { x, y, px, py, movido }
  const capaCalles = document.createElement('canvas');
  const capaCalor = document.createElement('canvas');
  let puntos = [], motos = [];

  function medir() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const pad = 18;
    esc0 = Math.min((W - pad * 2) / ((LON[1] - LON[0]) * KX), (H - pad * 2) / (LAT[1] - LAT[0]));
    bx = (W - (LON[1] - LON[0]) * KX * esc0) / 2;
    by = (H - (LAT[1] - LAT[0]) * esc0) / 2;
    callesSucias = true;
    pintarCalor();
  }

  // Pedidos de ejemplo (para el calor) y repartidores, dentro de cada zona
  function generar() {
    semilla = 11; puntos = []; motos = [];
    const focos = [[-74.054, 4.668], [-74.042, 4.700], [-74.090, 4.755], [-74.150, 4.628], [-74.063, 4.651], [-74.220, 4.587]];
    zonas.forEach((z) => {
      const s = stats(z), [cx, cy] = puntoEtiqueta(z);
      const n = (DEMO[z.id] || [0])[0] * 3;
      for (let k = 0, t = 0; k < n && t < n * 25; t++) {
        const f = rnd() < 0.35 ? focos[Math.floor(rnd() * focos.length)] : [cx, cy];
        const lon = f[0] + gauss() * 0.011, lat = f[1] + gauss() * 0.011;
        if (!dentroZona(lon, lat, z)) continue;
        puntos.push([lon, lat]); k++;
      }
      for (let k = 0; k < s.repartidores; k++) {
        let p = [cx, cy];
        for (let t = 0; t < 40; t++) { const lon = cx + gauss() * 0.01, lat = cy + gauss() * 0.01; if (dentroZona(lon, lat, z)) { p = [lon, lat]; break; } }
        motos.push({ zona: z.id, p: [...p], meta: [...p], fase: rnd() * 6 });
      }
    });
  }

  function pintarCalles() {
    capaCalles.width = canvas.width; capaCalles.height = canvas.height;
    const c = capaCalles.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    callesSucias = false;
    if (!capas.calles || !calles) return;
    const trazo = (lista) => {
      c.beginPath();
      for (const pts of lista) pts.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke();
    };
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(200,190,255,.15)'; c.lineWidth = 0.6; trazo(calles.ca);
    c.strokeStyle = 'rgba(220,214,255,.32)'; c.lineWidth = 1.1; trazo(calles.av);
  }

  // Calor: se pinta una vez en la vista completa y se escala con el zoom
  function pintarCalor() {
    if (!canvas || !W) return;
    capaCalor.width = canvas.width; capaCalor.height = canvas.height;
    const c = capaCalor.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (!capas.calor || !puntos.length) return;
    const proj = (lon, lat) => [bx + (lon - LON[0]) * KX * esc0, by + (LAT[1] - lat) * esc0];
    const rad = Math.max(14, esc0 * 0.012);
    const sello = document.createElement('canvas');
    sello.width = sello.height = Math.ceil(rad * 2 * DPR);
    const s = sello.getContext('2d'), g = s.createRadialGradient(sello.width / 2, sello.width / 2, 0, sello.width / 2, sello.width / 2, sello.width / 2);
    g.addColorStop(0, 'rgba(0,0,0,.075)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = g; s.fillRect(0, 0, sello.width, sello.width);
    for (const [lon, lat] of puntos) { const [x, y] = proj(lon, lat); c.drawImage(sello, x - rad, y - rad, rad * 2, rad * 2); }
    const img = c.getImageData(0, 0, capaCalor.width, capaCalor.height), d = img.data;
    const paleta = [[0, [52, 34, 168, 0]], [0.2, [110, 98, 220, 70]], [0.45, [169, 155, 255, 130]], [0.72, [181, 219, 46, 175]], [1, [236, 252, 170, 220]]];
    for (let i = 3; i < d.length; i += 4) {
      if (!d[i]) continue;
      const v = Math.min(1, (d[i] / 255) * 1.15);
      let j = 1; while (j < paleta.length - 1 && v > paleta[j][0]) j++;
      const [t0, c0] = paleta[j - 1], [t1, c1] = paleta[j], u = (v - t0) / (t1 - t0 || 1);
      for (let k = 0; k < 4; k++) d[i - 3 + k] = c0[k] + (c1[k] - c0[k]) * u;
    }
    c.putImageData(img, 0, 0);
  }

  function trazarZona(z) {
    ctx.beginPath();
    for (const ring of z.partes) { ring.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
  }

  // Vértices de otras zonas cercanos al cursor (para pegar bordes)
  function imanVertice(x, y, excluir) {
    let mejor = null, d = 10;
    zonas.forEach((z, zi) => z.partes.forEach((ring, pi) => ring.forEach((v, vi) => {
      if (excluir && ((excluir.zi === zi && excluir.pi === pi && excluir.vi === vi) || v === excluir.v || (excluir.gemelos || []).includes(v))) return;
      const [px, py] = aPx(v[0], v[1]), dd = Math.hypot(px - x, py - y);
      if (dd < d) { d = dd; mejor = v; }
    })));
    return mejor;
  }

  function cuadro(ms) {
    if (!W) return;
    if (callesSucias) pintarCalles();
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(capaCalles, 0, 0, W, H);
    const st = zonas.map(stats);
    zonas.forEach((z, i) => {
      trazarZona(z);
      if (capas.zonas) { ctx.fillStyle = `rgba(150,135,255,${RELLENO[st[i].nivel.id]})`; ctx.fill('evenodd'); }
      ctx.strokeStyle = 'rgba(231,228,250,.42)'; ctx.lineWidth = 1; ctx.stroke();
    });
    if (capas.calor) ctx.drawImage(capaCalor, panX, panY, W * zoom, H * zoom);
    if (encima !== null && encima !== elegida && zonas[encima] && modo !== 'dibujar') { trazarZona(zonas[encima]); ctx.strokeStyle = 'rgba(231,228,250,.85)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    if (elegida !== null && zonas[elegida]) {
      trazarZona(zonas[elegida]);
      ctx.fillStyle = `rgba(${LIMA},.1)`; ctx.fill('evenodd');
      ctx.strokeStyle = `rgb(${LIMA})`; ctx.lineWidth = 2.2; ctx.stroke();
    }
    // repartidores
    if (capas.repartidores && modo === 'ver') {
      const t = ms / 1000;
      for (const m of motos) {
        const z = zonas.find((q) => q.id === m.zona);
        if (!z) continue;
        m.p[0] += (m.meta[0] - m.p[0]) * 0.008; m.p[1] += (m.meta[1] - m.p[1]) * 0.008;
        if (Math.abs(m.meta[0] - m.p[0]) + Math.abs(m.meta[1] - m.p[1]) < 0.0006) {
          for (let k = 0; k < 10; k++) { const lon = m.p[0] + gauss() * 0.008, lat = m.p[1] + gauss() * 0.008; if (dentroZona(lon, lat, z)) { m.meta = [lon, lat]; break; } }
        }
        const [x, y] = aPx(m.p[0], m.p[1]), k = (t * 0.6 + m.fase) % 1;
        ctx.strokeStyle = `rgba(${LIMA},${0.55 * (1 - k)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 4 + k * 10, 0, 7); ctx.stroke();
        ctx.fillStyle = '#12092E'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.fillStyle = `rgb(${LIMA})`; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
      }
    }
    // nombres
    const fs = Math.max(10, Math.min(12.5, W / 70));
    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    zonas.forEach((z, i) => {
      const [x, y] = aPx(...puntoEtiqueta(z));
      if (x < -60 || y < -20 || x > W + 60 || y > H + 20) return;
      const nombre = z.nombre.split(' · ')[0], w = ctx.measureText(nombre).width + 14;
      ctx.fillStyle = 'rgba(11,8,38,.74)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 10, w, 20, 10); else ctx.rect(x - w / 2, y - 10, w, 20); ctx.fill();
      ctx.fillStyle = st[i].nivel.id === 'caliente' ? `rgb(${LIMA})` : '#E7E4FA';
      ctx.fillText(nombre, x, y + 0.5);
    });
    // edición: vértices y puntos medios
    if (modo === 'editar' && elegida !== null && zonas[elegida]) {
      zonas[elegida].partes.forEach((ring) => ring.forEach((v, i) => {
        const w = ring[(i + 1) % ring.length], [x, y] = aPx(v[0], v[1]), [mx, my] = aPx((v[0] + w[0]) / 2, (v[1] + w[1]) / 2);
        ctx.strokeStyle = `rgba(${LIMA},.8)`; ctx.lineWidth = 1.5; ctx.fillStyle = '#12092E';
        ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, 7); ctx.fill(); ctx.stroke();
        const activo = arrastre && arrastre.v === v;
        ctx.fillStyle = activo ? '#fff' : `rgb(${LIMA})`; ctx.strokeStyle = '#12092E'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, activo ? 7 : 5.5, 0, 7); ctx.fill(); ctx.stroke();
      }));
    }
    // zona nueva en dibujo
    if (modo === 'dibujar' && dibujo.length) {
      ctx.beginPath();
      dibujo.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (cursor) { const [x, y] = aPx(...cursor); ctx.lineTo(x, y); }
      ctx.strokeStyle = `rgb(${LIMA})`; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      if (dibujo.length > 2) { ctx.fillStyle = `rgba(${LIMA},.1)`; ctx.fill(); }
      dibujo.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); ctx.fillStyle = i ? `rgb(${LIMA})` : '#fff'; ctx.beginPath(); ctx.arc(x, y, i ? 4.5 : 6, 0, 7); ctx.fill(); });
    }
    // punto de prueba (pin)
    if (prueba) {
      const [x, y] = aPx(prueba.lon, prueba.lat);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12092E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y - 16, 8, Math.PI * 0.75, Math.PI * 2.25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgb(${LIMA})`; ctx.beginPath(); ctx.arc(x, y - 16, 3.2, 0, 7); ctx.fill();
    }
  }

  // ---------- Paneles ----------
  const nivelPill = (n) => `<span class="mz-nivel" data-nivel="${n.id}">${n.label}</span>`;
  const munTexto = (m) => (m === 'bogota' ? 'Bogotá' : `${MUNICIPIOS[m] || m}, Cundinamarca`);

  function pintarResumen() {
    const st = zonas.map(stats);
    const total = st.reduce((s, x) => s + x.pedidos, 0), motosN = st.reduce((s, x) => s + x.repartidores, 0);
    const calientes = st.filter((x) => x.nivel.id === 'caliente').length, faltan = st.reduce((s, x) => s + x.faltan, 0);
    const iTop = st.reduce((m, x, i) => (x.presion > st[m].presion ? i : m), 0);
    const top = zonas[iTop];
    $('#mz-kpis').innerHTML = `
      <div class="kpi kpi-hero"><span class="kpi-label">Zona más caliente</span><span class="kpi-value mz-top">${top ? esc(top.nombre.split(' · ')[0]) : '—'}</span><span class="kpi-foot">${top ? st[iTop].presion.toFixed(1) + ' pedidos por repartidor' : 'sin zonas'}</span></div>
      <div class="kpi"><span class="kpi-label">Pedidos ${periodo === 'hoy' ? 'hoy' : '7 días'}</span><span class="kpi-value">${fmt(total)}</span><span class="kpi-foot">en ${zonas.length} zonas</span></div>
      <div class="kpi"><span class="kpi-label">Repartidores en calle</span><span class="kpi-value">${motosN}</span><span class="kpi-foot">${motosN ? (total / motosN / (periodo === 'hoy' ? 1 : 6.6)).toFixed(1) + ' pedidos c/u al día' : '—'}</span></div>
      <div class="kpi"><span class="kpi-label">Zonas calientes</span><span class="kpi-value">${calientes}</span><span class="kpi-foot">${faltan ? `faltan ${faltan} repartidores` : 'capacidad suficiente'}</span></div>`;
  }

  function pintarLista() {
    const st = zonas.map(stats);
    const orden = zonas.map((_, i) => i).sort((a, b) => st[b].presion - st[a].presion);
    const max = Math.max(1, ...st.map((x) => Math.min(x.presion, 20)));
    $('#mz-lista').innerHTML = orden.map((i) => {
      const z = zonas[i], s = st[i];
      return `<li><button type="button" class="mz-fila${elegida === i ? ' activa' : ''}" data-mz-zona="${i}" aria-pressed="${elegida === i}">
        <span class="mz-fila-top"><b>${esc(z.nombre)}</b>${nivelPill(s.nivel)}</span>
        <span class="mz-barra"><i style="--w:${(Math.min(s.presion, 20) / max) * 100}%" data-nivel="${s.nivel.id}"></i></span>
        <span class="mz-fila-datos"><span>${fmt(s.pedidos)} pedidos</span><span>${s.repartidores} repartidores</span>${s.tiempo ? `<span>${s.tiempo} min</span>` : ''}</span>
      </button></li>`;
    }).join('') || '<li class="mz-vacio">No hay zonas. Dibuja una o importa un GeoJSON.</li>';
  }

  function pintarDetalle() {
    const box = $('#mz-detalle');
    if (modo === 'dibujar') {
      box.innerHTML = `<header class="mz-det-cab"><div><small>Nueva zona</small><h3>Dibuja el polígono</h3></div></header>
        <ol class="mz-pasos"><li>Toca el mapa para poner cada vértice; se pega a los vértices de las zonas vecinas.</li><li>Para cerrar, toca el primer punto, haz doble clic o pulsa <kbd>Enter</kbd>.</li><li><kbd>Esc</kbd> cancela · <kbd>Retroceso</kbd> quita el último punto.</li></ol>
        <p class="mz-coord-dato">${dibujo.length} punto${dibujo.length === 1 ? '' : 's'}</p>
        <div class="mz-acciones"><button type="button" class="btn-ghost" data-mz-accion="deshacer-punto" ${dibujo.length ? '' : 'disabled'}>Quitar último</button><button type="button" class="mz-btn-lima" data-mz-accion="cerrar-dibujo" ${dibujo.length > 2 ? '' : 'disabled'}>Cerrar zona</button></div>`;
      return;
    }
    if (modo === 'probar') {
      const r = prueba && prueba.res;
      box.innerHTML = `<header class="mz-det-cab"><div><small>Autoasignación</small><h3>Probar un punto</h3></div></header>
        <form class="mz-probar" data-mz-form="probar"><label><span>Coordenada (latitud, longitud)</span>
          <input name="coord" inputmode="decimal" placeholder="4.6486, -74.0628" value="${prueba ? `${r6(prueba.lat)}, ${r6(prueba.lon)}` : ''}" autocomplete="off"></label>
          <button type="submit" class="mz-btn-lima">Probar</button></form>
        <p class="mz-vacio">También puedes tocar el mapa. Se aplica la misma regla del SQL: la zona que contiene el punto (la de mayor prioridad si hay solape) o, si cae en un hueco, la más cercana.</p>
        ${r ? `<div class="mz-resultado ${r.dentro ? '' : 'alerta'}">
            <span>${r.dentro ? 'Cae en' : 'Fuera de las zonas · la más cercana es'}</span><b>${esc(r.zona.nombre)}</b>
            ${r.dentro ? '' : `<small>a ${r.km.toFixed(2)} km del borde</small>`}
            <span class="mz-res-reps">${r.zona.repartidores.length ? 'Repartidores: ' + r.zona.repartidores.map((id) => esc(riderNombre(id))).join(', ') : 'Sin repartidores asignados a esta zona'}</span>
            ${r.otras && r.otras.length ? `<small>También la cubren: ${r.otras.map((z) => esc(z.nombre)).join(', ')} (menor prioridad)</small>` : ''}
          </div>` : ''}`;
      return;
    }
    if (elegida === null || !zonas[elegida]) {
      box.innerHTML = modo === 'editar'
        ? `<p class="mz-vacio">Toca una zona para editar sus vértices y sus datos. Arrastra un vértice para moverlo (los vértices compartidos con zonas vecinas se mueven juntos; con <kbd>Alt</kbd> solo ese), arrastra un punto medio para agregar uno y haz doble clic en un vértice para borrarlo.</p>`
        : `<p class="mz-vacio">Toca una zona en el mapa o en la lista para ver su detalle.</p>`;
      return;
    }
    const z = zonas[elegida], s = stats(z);
    if (modo === 'editar') {
      const verts = z.partes.map((ring, pi) => ring.map((v, vi) => `<tr><td>${z.partes.length > 1 ? pi + 1 + '.' : ''}${vi + 1}</td>
          <td><input aria-label="Latitud del vértice ${vi + 1}" data-mz-vert="${pi},${vi},1" value="${v[1]}" inputmode="decimal"></td>
          <td><input aria-label="Longitud del vértice ${vi + 1}" data-mz-vert="${pi},${vi},0" value="${v[0]}" inputmode="decimal"></td>
          <td><button type="button" class="mz-x" data-mz-accion="borrar-vertice" data-v="${pi},${vi}" aria-label="Borrar vértice ${vi + 1}" ${ring.length <= 3 ? 'disabled' : ''}>×</button></td></tr>`).join('')).join('');
      box.innerHTML = `<header class="mz-det-cab"><div><small>Editando zona · id <code>${esc(z.id)}</code></small><h3>${esc(z.nombre)}</h3></div>
          <button type="button" class="mz-cerrar" data-mz-accion="cerrar" aria-label="Cerrar">×</button></header>
        <form class="mz-form" data-mz-form="zona">
          <label class="ancho"><span>Nombre</span><input name="nombre" value="${esc(z.nombre)}" required maxlength="60"></label>
          <label><span>Municipio</span><select name="municipio">${Object.entries(MUNICIPIOS).map(([k, v]) => `<option value="${k}" ${k === z.municipio ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label><span>Prioridad</span><input name="prioridad" type="number" step="1" value="${z.prioridad || 0}" title="Si dos zonas se solapan, gana la de mayor prioridad"></label>
          <label class="ancho"><span>Pedidos al día por repartidor</span><input name="capacidad" type="number" min="1" step="1" value="${z.capacidad || PEDIDOS_POR_REPARTIDOR}"></label>
          <fieldset class="ancho"><legend>Repartidores de la zona</legend>
            ${riders().map((r) => `<label class="mz-check"><input type="checkbox" name="rep" value="${esc(r.id)}" ${z.repartidores.includes(r.id) ? 'checked' : ''}> ${esc(r.nombre)}</label>`).join('') || '<small>No hay repartidores registrados.</small>'}
          </fieldset>
        </form>
        <details class="mz-vertices" open><summary>Vértices (${z.partes.reduce((n, r) => n + r.length, 0)}) · lat / lon WGS84</summary>
          <div class="mz-tabla"><table><thead><tr><th>#</th><th>Latitud</th><th>Longitud</th><th></th></tr></thead><tbody>${verts}</tbody></table></div></details>
        <div class="mz-acciones"><button type="button" class="btn-ghost danger" data-mz-accion="borrar-zona">Eliminar zona</button></div>`;
      return;
    }
    const pct = s.pedidos ? Math.round((s.entregados / s.pedidos) * 100) : 0;
    const consejo = s.faltan
      ? `<p class="mz-consejo alerta"><b>Faltan ${s.faltan} repartidor${s.faltan > 1 ? 'es' : ''}</b> para atender la demanda con holgura (${z.capacidad || PEDIDOS_POR_REPARTIDOR} pedidos por repartidor al día).</p>`
      : `<p class="mz-consejo">Capacidad suficiente: ${s.presion.toFixed(1)} pedidos por repartidor.</p>`;
    box.innerHTML = `
      <header class="mz-det-cab"><div><small>${munTexto(z.municipio)}</small><h3>${esc(z.nombre)}</h3></div>${nivelPill(s.nivel)}
        <button type="button" class="mz-cerrar" data-mz-accion="cerrar" aria-label="Cerrar detalle">×</button></header>
      <dl class="mz-det-datos">
        <div><dt>Pedidos</dt><dd>${fmt(s.pedidos)}</dd></div><div><dt>Entregados</dt><dd>${pct}%</dd></div><div><dt>En curso</dt><dd>${fmt(s.enCurso)}</dd></div>
        <div><dt>Repartidores</dt><dd>${s.repartidores}</dd></div><div><dt>Tiempo prom.</dt><dd>${s.tiempo}<small> min</small></dd></div><div><dt>Novedades</dt><dd>${fmt(s.novedades)}</dd></div>
      </dl>
      <div class="mz-progreso"><span>Entregados</span><span class="mz-barra"><i style="--w:${pct}%" data-nivel="caliente"></i></span></div>
      ${consejo}
      <p class="mz-asignados"><span>Asignados para autoasignación:</span> ${z.repartidores.length ? z.repartidores.map((id) => `<b>${esc(riderNombre(id))}</b>`).join(', ') : '<i>ninguno</i>'}</p>
      <div class="mz-acciones"><button type="button" class="btn-ghost" data-mz-accion="editar-esta">Editar zona</button></div>`;
  }

  function pintarPaneles() { pintarResumen(); pintarLista(); pintarDetalle(); }
  let generarPendiente = 0;
  function huboCambio() {
    pintarResumen(); pintarLista();
    clearTimeout(generarPendiente);
    generarPendiente = setTimeout(() => { generar(); pintarCalor(); }, 250);   // recalcular el calor al terminar de editar
  }
  function cambiarModo(m) {
    modo = m;
    if (m !== 'dibujar') dibujo = [];
    if (m !== 'probar') prueba = null;
    $$('#mz-modo button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mzModo === m));
    $('#view-mapa').dataset.modo = m;
    pintarDetalle();
  }
  function aviso(msg, tipo = 'ok') {
    const el = $('#mz-aviso');
    el.innerHTML = msg; el.dataset.tipo = tipo; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, tipo === 'error' ? 9000 : 6000);
  }

  // ---------- Interacción en el mapa ----------
  const posEvento = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const zonaEn = (lon, lat) => { for (let i = zonas.length - 1; i >= 0; i--) if (dentroZona(lon, lat, zonas[i])) return i; return null; };

  function handleEn(x, y) {
    if (modo !== 'editar' || elegida === null || !zonas[elegida]) return null;
    const z = zonas[elegida];
    for (let pi = 0; pi < z.partes.length; pi++) {
      const ring = z.partes[pi];
      for (let vi = 0; vi < ring.length; vi++) { const [px, py] = aPx(...ring[vi]); if (Math.hypot(px - x, py - y) < 9) return { tipo: 'v', pi, vi }; }
      for (let vi = 0; vi < ring.length; vi++) {
        const a = ring[vi], b = ring[(vi + 1) % ring.length], [mx, my] = aPx((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        if (Math.hypot(mx - x, my - y) < 8) return { tipo: 'm', pi, vi };
      }
    }
    return null;
  }

  // Vértices compartidos: el mismo punto en varias zonas (bordes comunes)
  const mismo = (a, b) => Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;
  function gemelos(v) {
    const out = [];
    zonas.forEach((z) => z.partes.forEach((ring) => ring.forEach((w) => { if (w !== v && mismo(w, v)) out.push(w); })));
    return out;
  }
  // Agrega el punto medio en todas las zonas que comparten el borde a-b
  function partirBorde(a, b, medio) {
    zonas.forEach((z, zi) => z.partes.forEach((ring) => {
      if (zi === elegida && ring.includes(a) && ring.includes(b)) return;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        if ((mismo(p, a) && mismo(q, b)) || (mismo(p, b) && mismo(q, a))) { ring.splice(i + 1, 0, [...medio]); return; }
      }
    }));
  }

  function enlazarMapa() {
    canvas.addEventListener('pointerdown', (e) => {
      const [x, y] = posEvento(e);
      canvas.setPointerCapture(e.pointerId);
      const h = handleEn(x, y);
      if (h) {
        const ring = zonas[elegida].partes[h.pi];
        if (h.tipo === 'm') {
          const a = ring[h.vi], b = ring[(h.vi + 1) % ring.length], medio = [r6((a[0] + b[0]) / 2), r6((a[1] + b[1]) / 2)];
          if (!e.altKey) partirBorde(a, b, medio);
          ring.splice(h.vi + 1, 0, medio); h.vi += 1;
        }
        const v = ring[h.vi];
        // con Alt se mueve solo este vértice; si no, también sus gemelos en las zonas vecinas
        arrastre = { zi: elegida, pi: h.pi, vi: h.vi, v, gemelos: e.altKey ? [] : gemelos(v) };
        arrancar();
        return;
      }
      paneo = { x, y, px: panX, py: panY, movido: false };
    });
    canvas.addEventListener('pointermove', (e) => {
      const [x, y] = posEvento(e);
      const [lon, lat] = aGeo(x, y);
      cursor = [lon, lat];
      $('#mz-cursor').textContent = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      arrancar();
      if (arrastre) {
        const iman = imanVertice(x, y, arrastre);
        const nx = r6(iman ? iman[0] : lon), ny = r6(iman ? iman[1] : lat);
        for (const w of [arrastre.v, ...arrastre.gemelos]) { w[0] = nx; w[1] = ny; }
        return;
      }
      if (paneo) {
        if (Math.hypot(x - paneo.x, y - paneo.y) > 4) paneo.movido = true;
        if (paneo.movido && zoom > 1) { panX = paneo.px + x - paneo.x; panY = paneo.py + y - paneo.y; limitarVista(); callesSucias = true; }
        return;
      }
      const h = handleEn(x, y);
      encima = zonaEn(lon, lat);
      canvas.style.cursor = h ? (h.tipo === 'v' ? 'grab' : 'copy') : modo === 'dibujar' || modo === 'probar' ? 'crosshair' : encima !== null ? 'pointer' : 'default';
      const tip = $('#mz-tip');
      if (encima !== null && modo === 'ver') {
        const s = stats(zonas[encima]);
        tip.innerHTML = `<b>${esc(zonas[encima].nombre)}</b><span>${fmt(s.pedidos)} pedidos · ${s.repartidores} repartidores</span>`;
        tip.hidden = false;
        tip.style.transform = `translate(${Math.min(x + 14, W - 210)}px, ${Math.min(y + 14, H - 50)}px)`;
      } else tip.hidden = true;
    });
    canvas.addEventListener('pointerup', (e) => {
      const [x, y] = posEvento(e);
      if (arrastre) { arrastre = null; guardar(); pintarDetalle(); return; }
      if (paneo && !paneo.movido) clic(x, y);
      paneo = null;
    });
    canvas.addEventListener('pointercancel', () => { arrastre = null; paneo = null; });
    canvas.addEventListener('pointerleave', () => { $('#mz-tip').hidden = true; encima = null; });
    canvas.addEventListener('dblclick', (e) => {
      const [x, y] = posEvento(e);
      if (modo === 'dibujar') { e.preventDefault(); if (dibujo.length > 3) dibujo.pop(); cerrarDibujo(); return; }
      const h = handleEn(x, y);
      if (h && h.tipo === 'v') borrarVertice(h.pi, h.vi);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = posEvento(e);
      acercar(e.deltaY < 0 ? 1.2 : 1 / 1.2, x, y);
    }, { passive: false });
  }

  function clic(x, y) {
    const [lon, lat] = aGeo(x, y);
    if (modo === 'dibujar') {
      if (dibujo.length > 2) { const [fx, fy] = aPx(...dibujo[0]); if (Math.hypot(fx - x, fy - y) < 10) { cerrarDibujo(); return; } }
      const iman = imanVertice(x, y);
      dibujo.push(iman ? [...iman] : [r6(lon), r6(lat)]);
      pintarDetalle();
      return;
    }
    if (modo === 'probar') { probar(lat, lon); return; }
    const z = zonaEn(lon, lat);
    elegida = z === elegida && modo === 'ver' ? null : z;
    pintarLista(); pintarDetalle();
  }

  function acercar(f, x = W / 2, y = H / 2) {
    const nz = Math.max(1, Math.min(14, zoom * f));
    panX = x - (x - panX) * (nz / zoom); panY = y - (y - panY) * (nz / zoom);
    zoom = nz; limitarVista(); callesSucias = true; arrancar();
  }
  function limitarVista() {
    if (zoom <= 1) { zoom = 1; panX = 0; panY = 0; return; }
    panX = Math.min(W * 0.4, Math.max(W * (0.6 - zoom), panX));
    panY = Math.min(H * 0.4, Math.max(H * (0.6 - zoom), panY));
  }
  function encuadrar(z) {
    zoom = 1; panX = 0; panY = 0;
    const xs = [], ys = [];
    z.partes.forEach((r) => r.forEach(([lo, la]) => { const [x, y] = aPx(lo, la); xs.push(x); ys.push(y); }));
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const nz = Math.max(1, Math.min(6, Math.min(W / (w * 1.6 || 1), H / (h * 1.6 || 1))));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    zoom = nz; panX = W / 2 - cx * nz; panY = H / 2 - cy * nz; limitarVista(); callesSucias = true; arrancar();
  }

  function borrarVertice(pi, vi) {
    const ring = zonas[elegida].partes[pi];
    if (ring.length <= 3) { aviso('Un polígono necesita al menos 3 vértices.', 'error'); return; }
    const v = ring[vi];
    zonas.forEach((z) => z.partes.forEach((r) => { if (r !== ring && r.length > 3) { const k = r.findIndex((w) => mismo(w, v)); if (k >= 0) r.splice(k, 1); } }));
    ring.splice(vi, 1); guardar(); pintarDetalle();
  }
  function cerrarDibujo() {
    if (dibujo.length < 3) { aviso('Pon al menos 3 puntos para cerrar la zona.', 'error'); return; }
    const cruzado = autoCruce(dibujo);
    let n = zonas.length + 1, id = `zona-${n}`;
    while (zonas.some((z) => z.id === id)) id = `zona-${++n}`;
    const [lo, la] = centroide(dibujo);
    const mun = Object.entries(COBERTURA).find(([, p]) => dentroAnillo(lo, la, p.map(([a, b]) => [b, a])));
    zonas.push({ id, nombre: `Zona nueva ${n}`, municipio: mun ? mun[0] : 'bogota', repartidores: [], capacidad: PEDIDOS_POR_REPARTIDOR, prioridad: 0, partes: [dibujo.map((p) => [...p])] });
    dibujo = [];
    elegida = zonas.length - 1;
    cambiarModo('editar');
    guardar();
    aviso(cruzado ? 'Zona creada, pero el polígono se cruza consigo mismo: mueve los vértices para corregirlo.' : 'Zona creada. Ponle nombre y asigna sus repartidores.', cruzado ? 'error' : 'ok');
  }
  function probar(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) { aviso('Escribe la coordenada como <b>latitud, longitud</b> (por ejemplo 4.6486, -74.0628).', 'error'); return; }
    if (Math.abs(lat) > 20 && Math.abs(lon) < 20) [lat, lon] = [lon, lat];   // escrita al revés
    prueba = { lat, lon, res: asignar(lat, lon) };
    if (prueba.res) elegida = zonas.indexOf(prueba.res.zona);
    pintarLista(); pintarDetalle(); arrancar();
  }

  // ---------- Barra de herramientas ----------
  function enlazarHerramientas() {
    const vista = $('#view-mapa');
    vista.addEventListener('click', (e) => {
      const capa = e.target.closest('[data-capa]');
      if (capa) {
        capas[capa.dataset.capa] = !capas[capa.dataset.capa];
        capa.setAttribute('aria-pressed', capas[capa.dataset.capa]);
        if (capa.dataset.capa === 'calor') pintarCalor(); else callesSucias = true;
        arrancar();
        return;
      }
      const per = e.target.closest('[data-periodo]');
      if (per) { periodo = per.dataset.periodo; $$('#mz-periodo button').forEach((b) => b.setAttribute('aria-pressed', b === per)); pintarPaneles(); return; }
      const m = e.target.closest('[data-mz-modo]');
      if (m) { cambiarModo(m.dataset.mzModo); arrancar(); return; }
      const fila = e.target.closest('[data-mz-zona]');
      if (fila) {
        const i = Number(fila.dataset.mzZona);
        elegida = elegida === i && modo === 'ver' ? null : i;
        if (elegida !== null && modo === 'editar') encuadrar(zonas[elegida]);
        pintarLista(); pintarDetalle(); arrancar();
        return;
      }
      const b = e.target.closest('[data-mz-accion]');
      if (!b) return;
      const acc = b.dataset.mzAccion;
      if (acc === 'cerrar') { elegida = null; pintarLista(); pintarDetalle(); }
      else if (acc === 'editar-esta') { cambiarModo('editar'); if (elegida !== null) encuadrar(zonas[elegida]); }
      else if (acc === 'borrar-vertice') { const [pi, vi] = b.dataset.v.split(',').map(Number); borrarVertice(pi, vi); }
      else if (acc === 'borrar-zona') {
        if (!confirm(`¿Eliminar la zona "${zonas[elegida].nombre}"? Puedes recuperarla importando un GeoJSON guardado.`)) return;
        zonas.splice(elegida, 1); elegida = null; guardar(); pintarDetalle();
      }
      else if (acc === 'deshacer-punto') { dibujo.pop(); pintarDetalle(); }
      else if (acc === 'cerrar-dibujo') cerrarDibujo();
      else if (acc === 'acercar') acercar(1.4);
      else if (acc === 'alejar') acercar(1 / 1.4);
      else if (acc === 'encuadrar') { zoom = 1; panX = 0; panY = 0; callesSucias = true; arrancar(); }
      else if (acc === 'exportar') { descargar('zonas-loentrego.geojson', JSON.stringify(aGeoJSON(), null, 2), 'application/geo+json'); aviso(`GeoJSON con ${zonas.length} zonas descargado (WGS84 · EPSG:4326).`); }
      else if (acc === 'sql') { descargar('zonas-loentrego.sql', aSQL(), 'application/sql'); aviso('SQL para PostGIS descargado: tabla, índice espacial, zonas y función <code>zona_para_punto</code>.'); }
      else if (acc === 'importar') $('#mz-archivo').click();
      else if (acc === 'validar') informeValidacion();
      else if (acc === 'restablecer') {
        if (!confirm('¿Volver a las zonas iniciales? Se perderán los cambios que no hayas exportado.')) return;
        zonas = zonasIniciales(); elegida = null; guardar(); pintarDetalle(); aviso('Zonas iniciales restablecidas.');
      }
    });
    vista.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-mz-form]');
      if (!f) return;
      e.preventDefault();
      if (f.dataset.mzForm === 'probar') { const [a, b] = String(f.coord.value).split(/[,;\s]+/).filter(Boolean).map(Number); probar(a, b); }
    });
    vista.addEventListener('change', (e) => {
      const f = e.target.closest('[data-mz-form="zona"]');
      if (f && elegida !== null) {
        const z = zonas[elegida];
        z.nombre = f.nombre.value.trim() || z.nombre;
        z.municipio = f.municipio.value;
        z.prioridad = Number(f.prioridad.value) || 0;
        z.capacidad = Math.max(1, Number(f.capacidad.value) || PEDIDOS_POR_REPARTIDOR);
        z.repartidores = $$('input[name="rep"]:checked', f).map((i) => i.value);
        guardar();
        $('.mz-det-cab h3').textContent = z.nombre;
        return;
      }
      const v = e.target.closest('[data-mz-vert]');
      if (v && elegida !== null) {
        const [pi, vi, k] = v.dataset.mzVert.split(',').map(Number), n = Number(String(v.value).replace(',', '.'));
        const ok = isFinite(n) && (k === 1 ? Math.abs(n) <= 90 : Math.abs(n) <= 180);
        if (!ok) { v.value = zonas[elegida].partes[pi][vi][k]; aviso('Coordenada no válida. Usa grados decimales, por ejemplo 4.6486 y -74.0628.', 'error'); return; }
        const v0 = zonas[elegida].partes[pi][vi], g = gemelos(v0);
        for (const w of [v0, ...g]) w[k] = r6(n);
        guardar(); arrancar();
      }
    });
    $('#mz-archivo').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const { zonas: nuevas, avisos } = deGeoJSON(JSON.parse(await archivo.text()));
        if (!confirm(`El archivo tiene ${nuevas.length} zona${nuevas.length > 1 ? 's' : ''}. ¿Reemplazar las ${zonas.length} zonas actuales?`)) return;
        zonas = nuevas; elegida = null; zoom = 1; panX = 0; panY = 0; callesSucias = true;
        guardar(); pintarDetalle(); arrancar();
        aviso(`Importadas ${nuevas.length} zonas.${avisos.length ? '<br>' + avisos.slice(0, 4).map(esc).join('<br>') : ''}`, avisos.length ? 'error' : 'ok');
      } catch (err) {
        aviso(esc(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message), 'error');
      }
    });
    document.addEventListener('keydown', (e) => {
      if ($('#view-mapa').hidden || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') { if (modo === 'dibujar' && dibujo.length) { dibujo = []; pintarDetalle(); } else if (modo !== 'ver') cambiarModo('ver'); else { elegida = null; pintarPaneles(); } }
      else if (e.key === 'Enter' && modo === 'dibujar') cerrarDibujo();
      else if (e.key === 'Backspace' && modo === 'dibujar') { e.preventDefault(); dibujo.pop(); pintarDetalle(); }
      else if (e.key === '+' || e.key === '=') acercar(1.3);
      else if (e.key === '-') acercar(1 / 1.3);
      else return;
      arrancar();
    });
  }

  function informeValidacion() {
    const v = validar();
    const prob = [];
    if (v.cruzadas.length) prob.push(`Se cruzan consigo mismas: <b>${v.cruzadas.map(esc).join(', ')}</b>`);
    if (v.pocos.length) prob.push(`Con menos de 3 vértices: <b>${v.pocos.map(esc).join(', ')}</b>`);
    if (v.solapes.size) prob.push(`Solapes: ${[...v.solapes.keys()].slice(0, 5).map((k) => `<b>${esc(k)}</b>`).join(', ')}${v.solapes.size > 5 ? '…' : ''} (se resuelven por prioridad)`);
    const pctHueco = v.muestras ? (v.huecos / v.muestras) * 100 : 0;
    if (pctHueco >= 0.5) prob.push(`Huecos: el ${pctHueco.toFixed(1)}% de la cobertura no tiene zona (se asigna la más cercana)`);
    aviso(prob.length ? `<b>Revisión de zonas</b><br>${prob.join('<br>')}` : `<b>Zonas en orden.</b> Sin solapes, sin huecos y sin polígonos cruzados (${zonas.length} zonas).`, prob.length ? 'error' : 'ok');
  }

  // ---------- Montaje ----------
  let montado = false, raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function bucle(now) {
    if (!canvas.isConnected || canvas.offsetParent === null || document.hidden) { raf = 0; return; }
    cuadro(now);
    raf = reduce && !arrastre && !paneo ? 0 : requestAnimationFrame(bucle);
  }
  function arrancar() { if (canvas && !raf) raf = requestAnimationFrame(bucle); }

  function montar() {
    if (!montado) {
      montado = true;
      canvas = $('#mz-mapa'); ctx = canvas.getContext('2d');
      cargar(); generar();
      enlazarMapa(); enlazarHerramientas();
      new ResizeObserver(() => { if (canvas.offsetParent !== null) { medir(); arrancar(); } }).observe(canvas);
      document.addEventListener('visibilitychange', arrancar);
      fetch('../Scripts/bogota-calles.txt?v=1').then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => { calles = leerCalles(t); callesSucias = true; arrancar(); })
        .catch(() => { /* sin calles: el mapa sigue con zonas y calor */ });
      // otra pestaña del panel cambió las zonas
      window.addEventListener('storage', (e) => { if (e.key === CLAVE) { cargar(); elegida = null; huboCambio(); pintarDetalle(); } });
    }
    cambiarModo(modo);
    pintarPaneles();
    requestAnimationFrame(() => { medir(); arrancar(); });
  }

  // API pública: el panel monta la vista; zonasGeoJSON y asignar quedan listas para el backend
  window.LEMapa = { montar, zonasGeoJSON: () => aGeoJSON(), asignar };
})();
