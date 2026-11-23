// =====================================================================
//  LoEntrego · Admin — Mapa: localidades y zonas de reparto
//
//  Dos tipos de zona, ambos como polígonos WGS84 (EPSG:4326, [lon, lat]):
//
//   1. LOCALIDADES (referencia, solo lectura): las 19 localidades de Bogotá,
//      los cuadrantes de Funza y las comunas de Soacha (Scripts/territorio.json).
//      Se colorean según la demanda de pedidos.
//   2. ZONAS DE REPARTO (editables): el área que atiende cada repartidor.
//      Son las que usa la AUTOASIGNACIÓN y se exportan a GeoJSON / PostGIS.
//
//  No se rastrea la ubicación de los repartidores: el mapa solo muestra
//  zonas asignadas y la demanda de pedidos.
//
//  ⚠️ Las cifras de pedidos son DATOS DE EJEMPLO hasta tener el backend.
// =====================================================================
(() => {
  'use strict';

  const CLAVE = 'loentrego-admin-zonas-v2';   // v2: se empieza sin zonas
  const PEDIDOS_POR_REPARTIDOR = 12;
  const FUENTE_UI = 'Poppins, system-ui, sans-serif';

  // Paleta de datos (marca + acentos del manual): un color por repartidor
  const COLORES_REP = ['#8FD3FF', '#FFB547', '#FF8FB1', '#7EE0C3', '#C3B9FF', '#FF9F6E', '#6FA8FF', '#F2DE6B'];
  // Demanda (localidades): de tranquila a caliente
  const NIVELES = [
    { id: 'caliente', label: 'Caliente', min: 55, color: '#FF6B83' },
    { id: 'alta', label: 'Alta', min: 35, color: '#FFB547' },
    { id: 'normal', label: 'Normal', min: 15, color: '#8FD3FF' },
    { id: 'tranquila', label: 'Tranquila', min: 0, color: '#9C8FFF' },
  ];
  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');

  // ---------- Cobertura de servicio (web) [lat, lon] ----------
  const B = { b5: [4.750, -74.130], b6: [4.725, -74.150], b7: [4.700, -74.180], b8: [4.665, -74.195], b9: [4.630, -74.205], b10: [4.600, -74.200], b11: [4.575, -74.190], b12: [4.545, -74.175] };
  const COBERTURA = {
    bogota: [[4.795, -74.030], [4.805, -74.065], [4.800, -74.100], [4.780, -74.118], B.b5, B.b6, B.b7, B.b8, B.b9, B.b10, B.b11, B.b12, [4.510, -74.150], [4.480, -74.120], [4.470, -74.090], [4.500, -74.065], [4.550, -74.060], [4.600, -74.045], [4.655, -74.035], [4.725, -74.020]],
    funza: [B.b5, B.b6, B.b7, B.b8, [4.655, -74.250], [4.700, -74.262], [4.760, -74.245], [4.768, -74.195], [4.760, -74.160]],
    soacha: [B.b8, B.b9, B.b10, B.b11, B.b12, [4.525, -74.200], [4.520, -74.245], [4.555, -74.285], [4.610, -74.280], [4.655, -74.250]],
  };
  const MUNICIPIOS = { bogota: 'Bogotá', funza: 'Funza', soacha: 'Soacha' };

  // ---------- Demanda de ejemplo por localidad: [pedidos hoy, minutos promedio] ----------
  const DEMANDA = {
    'bogota-chapinero': [64, 38], 'bogota-usaquen': [58, 41], 'bogota-suba': [52, 47], 'bogota-kennedy': [46, 52], 'bogota-engativa': [41, 44],
    'bogota-barrios-unidos': [30, 36], 'bogota-teusaquillo': [26, 33], 'bogota-fontibon': [22, 39], 'bogota-bosa': [21, 55], 'bogota-puente-aranda': [18, 35],
    'bogota-rafael-uribe-uribe': [14, 49], 'bogota-ciudad-bolivar': [12, 58], 'bogota-santa-fe': [11, 37], 'bogota-san-cristobal': [10, 51], 'bogota-los-martires': [9, 34],
    'bogota-tunjuelito': [9, 46], 'bogota-antonio-narino': [8, 36], 'bogota-la-candelaria': [6, 31], 'bogota-usme': [6, 61],
    'funza-cuadrante-1': [6, 33], 'funza-cuadrante-2': [4, 35], 'funza-cuadrante-3': [5, 34], 'funza-cuadrante-4': [2, 36], 'funza-zona-rural': [1, 48],
    'soacha-comuna-1-compartir': [8, 54], 'soacha-comuna-2-centro': [7, 50], 'soacha-comuna-3-la-despensa': [6, 52], 'soacha-comuna-4-cazuca': [3, 63],
    'soacha-comuna-5-san-mateo': [5, 55], 'soacha-comuna-6-san-humberto': [4, 57], 'soacha-corregimientos-rural': [1, 70],
  };

  // ---------- Zonas de reparto iniciales ----------
  const SEMILLAS = [
    { id: 'usaquen', nombre: 'Usaquén', municipio: 'bogota', centro: [4.722, -74.036], repartidores: ['r2'] },
    { id: 'suba', nombre: 'Suba', municipio: 'bogota', centro: [4.748, -74.086], repartidores: ['r2'] },
    { id: 'chapinero', nombre: 'Chapinero', municipio: 'bogota', centro: [4.650, -74.057], repartidores: ['r1'] },
    { id: 'barrios', nombre: 'Barrios Unidos', municipio: 'bogota', centro: [4.672, -74.085], repartidores: ['r1'] },
    { id: 'engativa', nombre: 'Engativá', municipio: 'bogota', centro: [4.706, -74.116], repartidores: ['r2'] },
    { id: 'fontibon', nombre: 'Fontibón', municipio: 'bogota', centro: [4.672, -74.150], repartidores: ['r3'] },
    { id: 'centro', nombre: 'Centro · Teusaquillo', municipio: 'bogota', centro: [4.610, -74.075], repartidores: ['r1'] },
    { id: 'puente', nombre: 'Puente Aranda', municipio: 'bogota', centro: [4.625, -74.112], repartidores: ['r3'] },
    { id: 'kennedy', nombre: 'Kennedy', municipio: 'bogota', centro: [4.628, -74.155], repartidores: ['r3'] },
    { id: 'bosa', nombre: 'Bosa', municipio: 'bogota', centro: [4.605, -74.188], repartidores: ['r4'] },
    { id: 'sur', nombre: 'Tunjuelito · C. Bolívar', municipio: 'bogota', centro: [4.565, -74.140], repartidores: ['r5'] },
    { id: 'usme', nombre: 'Usme · San Cristóbal', municipio: 'bogota', centro: [4.525, -74.100], repartidores: ['r6'] },
    { id: 'funza', nombre: 'Funza', municipio: 'funza', centro: [4.716, -74.214], repartidores: ['r2'] },
    { id: 'soacha', nombre: 'Soacha', municipio: 'soacha', centro: [4.585, -74.230], repartidores: ['r7'] },
  ];

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('es-CO');
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const KX = Math.cos(4.64 * Math.PI / 180);
  const riders = () => (window.LEAdmin && window.LEAdmin.riders) || [];
  const riderNombre = (id) => (riders().find((r) => r.id === id) || {}).nombre || id;
  const riderColor = (id) => { const i = riders().findIndex((r) => r.id === id); return COLORES_REP[(i < 0 ? 7 : i) % COLORES_REP.length]; };
  const iniciales = (n) => String(n).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'zona';
  let semilla = 11;
  const rnd = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // ---------- Geometría [lon, lat] ----------
  const dentroAnillo = (lon, lat, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  // par/impar: un anillo dentro de otro de la misma zona es un hueco
  const dentroZona = (lon, lat, z) => z.partes.reduce((n, ring) => n + (dentroAnillo(lon, lat, ring) ? 1 : 0), 0) % 2 === 1;
  const areaFirmada = (ring) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return a / 2; };
  const areaKm2 = (z) => poligonos(z).reduce((s, p) => s + Math.abs(areaFirmada(p[0])) - p.slice(1).reduce((h, r) => h + Math.abs(areaFirmada(r)), 0), 0) * 111.32 * 111.32 * KX;
  function centroide(ring) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    return a ? [cx / (3 * a), cy / (3 * a)] : ring[0];
  }
  const parteMayor = (z) => z.partes.reduce((m, r) => (Math.abs(areaFirmada(r)) > Math.abs(areaFirmada(m)) ? r : m), z.partes[0]);
  const cacheEtiqueta = new WeakMap();
  function puntoEtiqueta(z) {
    const clave = z.partes.map((r) => r.length + ':' + r[0]).join('|');
    const c0 = cacheEtiqueta.get(z);
    if (c0 && c0.clave === clave) return c0.p;
    const ring = parteMayor(z);
    let p = centroide(ring);
    if (!dentroAnillo(p[0], p[1], ring)) {
      let largo = -1;
      const ys = ring.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let k = 1; k < 12; k++) {
        const lat = y0 + (y1 - y0) * k / 12, xs = [];
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > lat) !== (yj > lat)) xs.push((xj - xi) * (lat - yi) / (yj - yi) + xi);
        }
        xs.sort((a, b) => a - b);
        for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > largo) { largo = xs[i + 1] - xs[i]; p = [(xs[i] + xs[i + 1]) / 2, lat]; }
      }
    }
    cacheEtiqueta.set(z, { clave, p });
    return p;
  }
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

  // Agrupa los anillos de una zona en polígonos [exterior, ...huecos]
  function poligonos(z) {
    const info = z.partes.map((r, i) => ({ r, i, a: Math.abs(areaFirmada(r)), dentroDe: z.partes.filter((o, j) => j !== i && dentroAnillo(r[0][0], r[0][1], o)).length }));
    const ext = info.filter((x) => x.dentroDe % 2 === 0), hue = info.filter((x) => x.dentroDe % 2 === 1);
    const polis = ext.map((e) => [e.r]);
    hue.forEach((h) => {
      const cand = ext.map((e, k) => [e, k]).filter(([e]) => dentroAnillo(h.r[0][0], h.r[0][1], e.r)).sort((a, b) => a[0].a - b[0].a)[0];
      if (cand) polis[cand[1]].push(h.r);
    });
    return polis;
  }
  const cerrado = (r) => { const c = r.map((p) => [p[0], p[1]]); c.push([c[0][0], c[0][1]]); return c; };
  const aPC = (z) => poligonos(z).map((p) => p.map(cerrado));
  // MultiPolygon de polygon-clipping -> anillos sin repetir el primer punto, sin migajas
  function dePC(mp) {
    const partes = [];
    mp.forEach((poli) => poli.forEach((ring) => {
      let r = ring.slice(0, -1).map(([x, y]) => [r6(x), r6(y)]);
      r = r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
      if (r.length >= 3 && Math.abs(areaFirmada(r)) > 2e-9) partes.push(r);
    }));
    return partes;
  }
  // La zona "ganadora" se queda con su área: a las demás se les resta (se parten y se adaptan)
  function recortarVecinas(ganadora) {
    const pc = window.polygonClipping;
    if (!pc) return [];
    const g = aPC(ganadora), eliminadas = [];
    zonas = zonas.filter((z) => {
      if (z === ganadora) return true;
      try {
        const res = dePC(pc.difference(aPC(z), g));
        if (!res.length) { eliminadas.push(z); return false; }
        z.partes = res;
      } catch { /* geometría rara: se deja igual */ }
      return true;
    });
    return eliminadas;
  }

  // Zonas de reparto iniciales: Voronoi de los centros recortado al municipio
  function recortarSemiplano(ring, ci, cj) {
    const mx = ((ci[0] + cj[0]) / 2) * KX, my = (ci[1] + cj[1]) / 2, nx = (cj[0] - ci[0]) * KX, ny = cj[1] - ci[1];
    const f = (p) => (p[0] * KX - mx) * nx + (p[1] - my) * ny;
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
      return { id: s.id, nombre: `Zona ${SEMILLAS.indexOf(s) + 1}`, municipio: s.municipio, repartidores: [...s.repartidores], capacidad: PEDIDOS_POR_REPARTIDOR, prioridad: 0, partes: [ring.map(([x, y]) => [r6(x), r6(y)])] };
    });
    // cortes sobre el borde de Funza/Soacha: vértices compartidos
    const sobre = (p, a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (L || 1);
      return t > 1e-6 && t < 1 - 1e-6 && Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / Math.sqrt(L || 1) < 2e-6;
    };
    const bog = zonas0.filter((z) => z.municipio === 'bogota').flatMap((z) => z.partes[0]);
    zonas0.filter((z) => z.municipio !== 'bogota').forEach((z) => {
      const ring = z.partes[0];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const en = bog.filter((p) => sobre(p, a, b) && !ring.some((w) => Math.abs(w[0] - p[0]) < 1e-6 && Math.abs(w[1] - p[1]) < 1e-6));
        if (!en.length) continue;
        en.sort((p, q) => Math.hypot(p[0] - a[0], p[1] - a[1]) - Math.hypot(q[0] - a[0], q[1] - a[1]));
        const u = en.filter((p, k) => !k || Math.abs(p[0] - en[k - 1][0]) > 1e-6 || Math.abs(p[1] - en[k - 1][1]) > 1e-6);
        ring.splice(i + 1, 0, ...u.map((p) => [...p])); i += u.length;
      }
    });
    return zonas0;
  }

  const COB_LONLAT = Object.values(COBERTURA).map((pol) => pol.map(([la, lo]) => [lo, la]));
  const enCobertura = ([lo, la]) => COB_LONLAT.some((r) => dentroAnillo(lo, la, r));

  // Un color propio para cada localidad (ninguno se repite): tonos repartidos con el ángulo áureo
  // Paleta de la marca (fríos, lavandas, menta, lima, ámbar y rosas), alternando familias para que vecinas no se parezcan
  const PALETA_LOC = ['#8FD3FF', '#FFB547', '#B79CFF', '#5EE0B8', '#FF8FB1', '#C7E356', '#5B8CFF', '#FFD97A', '#E58CF2', '#43C6E8',
    '#FF9F6E', '#9BE38A', '#9F7BFF', '#FF7A9C', '#2FD3A8', '#F2C14E', '#7FB0FF', '#F7A6D4', '#B5DB2E', '#8C6BFF',
    '#FFC1A1', '#6FE3E3', '#D6A8FF', '#FFE08A', '#4FA3FF', '#A8EFC9', '#FF9E9E', '#C6B6FF', '#E8F08A', '#9AD0F5', '#FFAEC2'];
  const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  const colorLocalidad = (i, a = 1) => hexA(PALETA_LOC[i % PALETA_LOC.length], a);

  // Tema: en claro el mapa va en papel (fondo claro, líneas oscuras)
  const esClaro = () => { const t = document.documentElement.dataset.tema; return t === 'claro' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches); };
  const T = () => esClaro()
    ? { calle: 'rgba(30,24,70,.22)', avenida: 'rgba(30,24,70,.5)', borde: 'rgba(30,24,70,.35)', cob: 'rgba(30,24,70,.45)', resalte: '#1B1370', relleno: 'rgba(27,19,112,.06)', etiFondo: 'rgba(255,255,255,.92)', etiTexto: '#1B1370', alfaLoc: 0.22 }
    : { calle: 'rgba(214,208,255,.16)', avenida: 'rgba(230,226,255,.32)', borde: 'rgba(236,233,248,.26)', cob: 'rgba(236,233,248,.32)', resalte: '#FFFFFF', relleno: 'rgba(255,255,255,.08)', etiFondo: 'rgba(18,12,82,.82)', etiTexto: '#F4F2FF', alfaLoc: 0.3 };
  document.addEventListener('le:tema', () => { callesSucias = true; if (typeof arrancar === 'function') arrancar(); });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { callesSucias = true; arrancar(); });

  // ---------- Estado ----------
  let zonas = [];        // zonas de reparto (editables)
  let territorio = [];   // localidades (solo lectura)
  let tipo = 'localidades';
  function cargar() {
    try {
      const d = JSON.parse(localStorage.getItem(CLAVE) || 'null');
      if (d && Array.isArray(d.zonas) && d.zonas.length) {
        zonas = d.zonas;
        // las zonas de reparto no llevan nombre de localidad
        zonas.forEach((z) => {
          const k = SEMILLAS.findIndex((x) => x.id === z.id);
          if (k >= 0 && SEMILLAS[k].nombre === z.nombre) z.nombre = `Zona ${k + 1}`;
          if (k >= 0 && !z.repartidores.length) z.repartidores = [...SEMILLAS[k].repartidores];   // ninguna zona sin repartidor
          z.repartidores = z.repartidores.slice(0, 1);
        });
        return;
      }
    } catch { /* datos dañados */ }
    zonas = [];   // todavía no hay repartidores en la plataforma: sin zonas iniciales
  }
  let avisoGuardado = 0;
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify({ version: 1, actualizado: new Date().toISOString(), zonas })); } catch { /* modo privado */ }
    const el = $('#mz-guardado');
    if (el) { el.textContent = 'Cambios guardados'; el.classList.add('ok'); clearTimeout(avisoGuardado); avisoGuardado = setTimeout(() => { el.classList.remove('ok'); el.textContent = 'Se guarda en este navegador'; }, 1800); }
    huboCambio();
  }

  // ---------- GeoJSON ----------
  const cerrar = (ring) => { const r = ring.map(([x, y]) => [r6(x), r6(y)]); const a = r[0], b = r[r.length - 1]; if (a[0] !== b[0] || a[1] !== b[1]) r.push([...a]); return r; };
  const antihorario = (ring) => (areaFirmada(ring) < 0 ? [...ring].reverse() : ring);
  const horario = (ring) => (areaFirmada(ring) > 0 ? [...ring].reverse() : ring);
  const geometria = (z) => {
    const polis = poligonos(z).map((p) => [cerrar(antihorario(p[0])), ...p.slice(1).map((h) => cerrar(horario(h)))]);
    return polis.length === 1 ? { type: 'Polygon', coordinates: polis[0] } : { type: 'MultiPolygon', coordinates: polis };
  };
  function aGeoJSON() {
    return {
      type: 'FeatureCollection', name: 'zonas_reparto_loentrego',
      features: zonas.map((z) => ({ type: 'Feature', id: z.id, properties: { id: z.id, nombre: z.nombre, municipio: z.municipio, repartidores: z.repartidores, capacidad_diaria: Number(z.capacidad) || PEDIDOS_POR_REPARTIDOR, prioridad: Number(z.prioridad) || 0 }, geometry: geometria(z) })),
    };
  }
  function territorioGeoJSON() {
    return { type: 'FeatureCollection', name: 'localidades_loentrego', features: territorio.map((t) => ({ type: 'Feature', id: t.id, properties: { id: t.id, nombre: t.nombre, municipio: t.municipio, tipo: t.tipo, aproximado: t.aproximado, fuente: t.fuente }, geometry: geometria(t) })) };
  }
  function partesDe(g) {
    const polis = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return polis.flatMap((p) => p.map((ring) => { const r = ring.map((c) => [r6(+c[0]), r6(+c[1])]); if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop(); return r; })).filter((r) => r.length >= 3);
  }
  function deGeoJSON(gj) {
    const avisos = [];
    let feats;
    if (gj && gj.type === 'FeatureCollection') feats = gj.features || [];
    else if (gj && gj.type === 'Feature') feats = [gj];
    else if (gj && (gj.type === 'Polygon' || gj.type === 'MultiPolygon')) feats = [{ type: 'Feature', properties: {}, geometry: gj }];
    else throw new Error('El archivo no es un GeoJSON de polígonos (FeatureCollection, Feature o Polygon).');
    const valido = (c) => Array.isArray(c) && c.length >= 2 && isFinite(c[0]) && isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
    const usados = new Set(), salida = [];
    feats.forEach((f, n) => {
      const g = f && f.geometry, p = (f && f.properties) || {};
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) { avisos.push(`Elemento ${n + 1}: no es un polígono, se omitió.`); return; }
      const polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      const partes = [];
      (polis || []).forEach((poli) => {
        if (!Array.isArray(poli) || !poli.length) return;
        poli.forEach((anillo) => {
          const ring = (anillo || []).filter(valido).map((c) => [r6(+c[0]), r6(+c[1])]);
          if (ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
          if (ring.length >= 3) partes.push(ring);
        });
      });
      if (!partes.length) { avisos.push(`Elemento ${n + 1}: sin coordenadas válidas, se omitió.`); return; }
      const [x, y] = partes[0][0];
      if (Math.abs(x) < 20 && Math.abs(y) > 60) { partes.forEach((r) => r.forEach((c) => c.reverse())); avisos.push(`"${p.nombre || n + 1}": venía como [lat, lon]; se invirtió a [lon, lat].`); }
      let id = String(p.id ?? f.id ?? slug(p.nombre || p.name || `zona-${n + 1}`));
      while (usados.has(id)) id += '-2';
      usados.add(id);
      const mun = String(p.municipio || '').toLowerCase();
      salida.push({
        id, nombre: String(p.nombre || p.name || `Zona ${n + 1}`),
        municipio: MUNICIPIOS[mun] ? mun : (Object.keys(MUNICIPIOS).find((k) => MUNICIPIOS[k].toLowerCase() === mun) || 'bogota'),
        repartidores: Array.isArray(p.repartidores) ? p.repartidores.map(String).slice(0, 1) : [],
        capacidad: Number(p.capacidad_diaria ?? p.capacidad) || PEDIDOS_POR_REPARTIDOR, prioridad: Number(p.prioridad) || 0, partes,
      });
    });
    if (!salida.length) throw new Error('No se encontró ninguna zona válida en el archivo.');
    return { zonas: salida, avisos };
  }
  function descargar(nombre, texto, tipoMime) {
    const url = URL.createObjectURL(new Blob([texto], { type: tipoMime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const sqlTexto = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  function aSQL() {
    const fecha = new Date().toISOString().slice(0, 10);
    const filas = aGeoJSON().features.map((f) => {
      const p = f.properties;
      return `INSERT INTO zonas_reparto (id, nombre, municipio, repartidores, capacidad_diaria, prioridad, geom)
VALUES (${sqlTexto(p.id)}, ${sqlTexto(p.nombre)}, ${sqlTexto(p.municipio)}, ARRAY[${p.repartidores.map(sqlTexto).join(', ')}]::text[], ${p.capacidad_diaria}, ${p.prioridad},
  ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${sqlTexto(JSON.stringify(f.geometry))}), 4326))))
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, municipio = EXCLUDED.municipio, repartidores = EXCLUDED.repartidores,
  capacidad_diaria = EXCLUDED.capacidad_diaria, prioridad = EXCLUDED.prioridad, geom = EXCLUDED.geom, actualizado = now();`;
    });
    const locs = territorioGeoJSON().features.map((f) => `INSERT INTO localidades (id, nombre, municipio, tipo, aproximado, geom)
VALUES (${sqlTexto(f.properties.id)}, ${sqlTexto(f.properties.nombre)}, ${sqlTexto(f.properties.municipio)}, ${sqlTexto(f.properties.tipo)}, ${f.properties.aproximado ? 'true' : 'false'},
  ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${sqlTexto(JSON.stringify(f.geometry))}), 4326))))
ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, aproximado = EXCLUDED.aproximado, geom = EXCLUDED.geom;`);
    return `-- LoEntrego · Zonas para PostGIS (generado desde el panel admin, ${fecha})
-- Coordenadas WGS84 (EPSG:4326). Ver docs/zonas-geojson-postgis.md

CREATE EXTENSION IF NOT EXISTS postgis;

-- Zonas de reparto: el área de cada repartidor (autoasignación)
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

-- Localidades (Bogotá), cuadrantes (Funza) y comunas (Soacha): referencia y reportes
CREATE TABLE IF NOT EXISTS localidades (
  id         text PRIMARY KEY,
  nombre     text NOT NULL,
  municipio  text NOT NULL,
  tipo       text NOT NULL,
  aproximado boolean NOT NULL DEFAULT false,
  geom       geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS localidades_geom_idx ON localidades USING GIST (geom);

BEGIN;
${filas.join('\n\n')}

${locs.join('\n')}
COMMIT;

-- Autoasignación: zona de reparto del punto (solape: mayor prioridad; hueco: la más cercana)
CREATE OR REPLACE FUNCTION zona_para_punto(lat double precision, lon double precision)
RETURNS TABLE (id text, nombre text, repartidores text[], dentro boolean)
LANGUAGE sql STABLE AS $$
  WITH p AS (SELECT ST_SetSRID(ST_MakePoint(lon, lat), 4326) AS g)
  SELECT z.id, z.nombre, z.repartidores, ST_Covers(z.geom, p.g) AS dentro
  FROM zonas_reparto z, p
  ORDER BY ST_Covers(z.geom, p.g) DESC, z.prioridad DESC, z.geom <-> p.g
  LIMIT 1;
$$;

-- Localidad de un punto (para reportes por localidad)
CREATE OR REPLACE FUNCTION localidad_para_punto(lat double precision, lon double precision)
RETURNS TABLE (id text, nombre text, municipio text)
LANGUAGE sql STABLE AS $$
  SELECT l.id, l.nombre, l.municipio FROM localidades l
  WHERE ST_Covers(l.geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326)) LIMIT 1;
$$;

-- Ejemplo:  SELECT * FROM zona_para_punto(4.6486, -74.0628);
`;
  }

  // ---------- Validación ----------
  const LAT = [4.465, 4.808], LON = [-74.288, -74.016];
  function validar() {
    const res = { solapes: new Map(), huecos: 0, muestras: 0, cruzadas: [] };
    zonas.forEach((z) => z.partes.forEach((r) => { if (autoCruce(r)) res.cruzadas.push(z.nombre); }));
    const cob = Object.values(COBERTURA).map((p) => p.map(([la, lo]) => [lo, la]));
    const N = 140, TOL = 2e-5;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const lon = LON[0] + (LON[1] - LON[0]) * i / N, lat = LAT[0] + (LAT[1] - LAT[0]) * j / N;
      if (!cob.some((r) => dentroAnillo(lon, lat, r))) continue;
      res.muestras++;
      const en = zonas.filter((z) => dentroZona(lon, lat, z) && distBorde(lon, lat, z) > TOL);
      if (!en.length && !zonas.some((z) => dentroZona(lon, lat, z) || distBorde(lon, lat, z) <= TOL)) res.huecos++;
      for (let a = 0; a < en.length; a++) for (let b = a + 1; b < en.length; b++) {
        const k = [en[a].nombre, en[b].nombre].sort().join(' y ');
        res.solapes.set(k, (res.solapes.get(k) || 0) + 1);
      }
    }
    return res;
  }

  // ---------- Autoasignación y localidad de un punto ----------
  function asignar(lat, lon) {
    const dentro = zonas.filter((z) => dentroZona(lon, lat, z)).sort((a, b) => (b.prioridad || 0) - (a.prioridad || 0));
    const loc = territorio.find((t) => dentroZona(lon, lat, t)) || null;
    if (dentro.length) return { zona: dentro[0], dentro: true, otras: dentro.slice(1), localidad: loc };
    if (!zonas.length) return { zona: null, dentro: false, localidad: loc };
    const cerca = zonas.map((z) => [z, distBorde(lon, lat, z)]).sort((a, b) => a[1] - b[1])[0];
    return { zona: cerca[0], dentro: false, km: cerca[1] * 111.32, localidad: loc };
  }

  // ---------- Estadísticas ----------
  let periodo = 'hoy';
  const PERIODOS = { hoy: [1, 'hoy'], mes: [26, 'en 1 mes'], semestre: [156, 'en 6 meses'], anio: [312, 'en 1 año'], historico: [720, 'en total'] };
  const factor = () => PERIODOS[periodo][0];
  const textoPeriodo = () => PERIODOS[periodo][1];
  function statsLocalidad(t) {
    const [p, tiempo] = DEMANDA[t.id] || [0, 0];
    const pedidos = Math.round(p * factor());
    const nivel = NIVELES.find((n) => p >= n.min);
    const entregados = Math.round(pedidos * 0.71), novedades = Math.round(pedidos * 0.05);
    const cubre = zonas.filter((z) => muestraCruza(z, t));
    return { pedidos, tiempo, nivel, entregados, novedades, enCurso: Math.max(0, pedidos - entregados - novedades), cubre, km2: areaKm2(t) };
  }
  // ¿la zona de reparto toca la localidad? (muestreo de los vértices y centros)
  const cacheCruce = new Map();
  function muestraCruza(z, t) {
    const clave = z.id + '|' + t.id + '|' + z.partes.map((r) => r.length + ':' + r[0]).join('/');
    if (cacheCruce.has(clave)) return cacheCruce.get(clave);
    const [cx, cy] = puntoEtiqueta(t);
    let si = dentroZona(cx, cy, z) || z.partes.some((r) => r.some(([lo, la]) => dentroZona(lo, la, t))) || t.partes.some((r) => r.some(([lo, la], i) => i % 3 === 0 && dentroZona(lo, la, z)));
    cacheCruce.set(clave, si);
    return si;
  }
  // pedidos de una zona de reparto: los puntos de demanda que caen dentro
  function statsReparto(z) {
    const dentro = puntos.filter(([lo, la]) => dentroZona(lo, la, z)).length;
    const pedidosDia = Math.round(dentro / 3);
    const r = z.repartidores.length, cap = Number(z.capacidad) || PEDIDOS_POR_REPARTIDOR;
    return { pedidos: Math.round(pedidosDia * factor()), repartidores: r, presion: r ? pedidosDia / r : pedidosDia ? 99 : 0, faltan: Math.max(0, Math.ceil(pedidosDia / cap) - r), km2: areaKm2(z) };
  }

  // ---------- Calles ----------
  let calles = null;
  function leerCalles(texto) {
    const av = [], ca = [];
    for (const ln of texto.split('\n')) {
      const t = ln[0];
      if (t !== 'A' && t !== 'C') continue;
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
      (t === 'A' ? av : ca).push(pts);
    }
    return { av, ca };
  }

  // ---------- Vista ----------
  let canvas, ctx, W = 0, H = 0, DPR = 1, esc0 = 1, bx = 0, by = 0, zoom = 1, panX = 0, panY = 0;
  const aPx = (lon, lat) => [(bx + (lon - LON[0]) * KX * esc0) * zoom + panX, (by + (LAT[1] - lat) * esc0) * zoom + panY];
  const aGeo = (x, y) => { const sx = (x - panX) / zoom, sy = (y - panY) / zoom; return [LON[0] + (sx - bx) / (KX * esc0), LAT[1] - (sy - by) / esc0]; };
  const capas = { calor: true, calles: true, localidades: true };
  let modo = 'ver';
  let elegida = null;        // índice en la lista del tipo activo
  let encima = null;
  let dibujo = [], prueba = null, cursor = null, callesSucias = true, arrastre = null, paneo = null, repNuevo = null;
  const capaCalles = document.createElement('canvas');
  const capaCalor = document.createElement('canvas');
  let puntos = [];
  const lista = () => (tipo === 'localidades' ? territorio : zonas);

  function medir() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // encuadre en el espacio libre que dejan los menús flotantes
    const ancho = W > 900;
    const panel = document.querySelector('.mz-panel');
    const pl = ancho ? 24 : 12, pr = ancho ? (panel ? panel.offsetWidth : 360) + 40 : 12;
    const pt = ancho ? 150 : (W < 640 ? 200 : 250), pb = ancho ? 60 : Math.round(H * 0.32);
    const spanX = (LON[1] - LON[0]) * KX, spanY = LAT[1] - LAT[0];
    esc0 = Math.min((W - pl - pr) / spanX, (H - pt - pb) / spanY);
    bx = pl + (W - pl - pr - spanX * esc0) / 2;
    by = pt + (H - pt - pb - spanY * esc0) / 2;
    callesSucias = true;
    pintarCalor();
  }

  // Pedidos de ejemplo: puntos dentro de cada localidad según su demanda
  function generar() {
    semilla = 11; puntos = [];
    const focos = [[-74.054, 4.668], [-74.042, 4.700], [-74.090, 4.755], [-74.150, 4.628], [-74.063, 4.651], [-74.220, 4.587]];
    territorio.forEach((t) => {
      const [cx, cy] = puntoEtiqueta(t);
      const n = (DEMANDA[t.id] || [0])[0] * 3;
      for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
        const f = rnd() < 0.3 ? focos[Math.floor(rnd() * focos.length)] : [cx, cy];
        const lon = f[0] + gauss() * 0.012, lat = f[1] + gauss() * 0.012;
        if (!dentroZona(lon, lat, t)) continue;
        puntos.push([lon, lat]); k++;
      }
    });
  }

  function pintarCalles() {
    capaCalles.width = canvas.width; capaCalles.height = canvas.height;
    const c = capaCalles.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    callesSucias = false;
    if (!capas.calles || !calles) return;
    const trazo = (l) => { c.beginPath(); for (const pts of l) pts.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); };
    c.lineJoin = 'round';
    c.strokeStyle = T().calle; c.lineWidth = 0.6; trazo(calles.ca);
    c.strokeStyle = T().avenida; c.lineWidth = 1.1; trazo(calles.av);
  }

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
    g.addColorStop(0, 'rgba(0,0,0,.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = g; s.fillRect(0, 0, sello.width, sello.width);
    for (const [lon, lat] of puntos) { const [x, y] = proj(lon, lat); c.drawImage(sello, x - rad, y - rad, rad * 2, rad * 2); }
    const img = c.getImageData(0, 0, capaCalor.width, capaCalor.height), d = img.data;
    // cielo -> ámbar -> coral: más color y se lee como "más caliente"
    const paleta = [[0, [143, 211, 255, 0]], [0.25, [143, 211, 255, 80]], [0.5, [255, 181, 71, 140]], [0.78, [255, 107, 131, 185]], [1, [255, 220, 230, 225]]];
    for (let i = 3; i < d.length; i += 4) {
      if (!d[i]) continue;
      const v = Math.min(1, (d[i] / 255) * 1.1);
      let j = 1; while (j < paleta.length - 1 && v > paleta[j][0]) j++;
      const [t0, c0] = paleta[j - 1], [t1, c1] = paleta[j], u = (v - t0) / (t1 - t0 || 1);
      for (let k = 0; k < 4; k++) d[i - 3 + k] = c0[k] + (c1[k] - c0[k]) * u;
    }
    c.putImageData(img, 0, 0);
  }

  function trazar(z) {
    ctx.beginPath();
    for (const ring of z.partes) { ring.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }
  }
  function imanVertice(x, y, excluir) {
    let mejor = null, d = 10;
    zonas.forEach((z, zi) => z.partes.forEach((ring, pi) => ring.forEach((v, vi) => {
      if (excluir && ((excluir.zi === zi && excluir.pi === pi && excluir.vi === vi) || v === excluir.v || (excluir.gemelos || []).includes(v))) return;
      const [px, py] = aPx(v[0], v[1]), dd = Math.hypot(px - x, py - y);
      if (dd < d) { d = dd; mejor = v; }
    })));
    return mejor;
  }
  function etiqueta(texto, x, y, fondo, color, punto) {
    const w = ctx.measureText(texto).width + (punto ? 26 : 16);
    ctx.fillStyle = fondo;
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x - w / 2, y - 11, w, 22, 11); else ctx.rect(x - w / 2, y - 11, w, 22); ctx.fill();
    if (punto) { ctx.fillStyle = punto; ctx.beginPath(); ctx.arc(x - w / 2 + 11, y, 4, 0, 7); ctx.fill(); }
    ctx.fillStyle = color; ctx.fillText(texto, x + (punto ? 5 : 0), y + 0.5);
  }

  function cuadro() {
    if (!W) return;
    if (callesSucias) pintarCalles();
    ctx.clearRect(0, 0, W, H);
    // todo se recorta a la zona de cobertura: fuera de ella no entregamos y no se dibuja nada
    const cob = new Path2D();
    Object.values(COBERTURA).forEach((pol) => { pol.forEach(([la, lo], i) => { const [x, y] = aPx(lo, la); i ? cob.lineTo(x, y) : cob.moveTo(x, y); }); cob.closePath(); });
    ctx.save(); ctx.clip(cob, 'nonzero');
    ctx.drawImage(capaCalles, 0, 0, W, H);
    const fs = Math.max(10.5, Math.min(12.5, W / 72));
    ctx.font = `600 ${fs}px ${FUENTE_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    if (capas.localidades) {
      territorio.forEach((t, i) => {
        trazar(t);
        if (t.tipo !== 'rural') { ctx.fillStyle = colorLocalidad(i, zonas.length ? T().alfaLoc * 0.6 : T().alfaLoc); ctx.fill('evenodd'); }
        ctx.strokeStyle = T().borde; ctx.lineWidth = 0.7; ctx.setLineDash(t.aproximado ? [1.5, 4] : [3, 4]); ctx.stroke(); ctx.setLineDash([]);
      });
    }
    if (capas.calor) { ctx.globalAlpha = zonas.length ? 0.6 : 1; ctx.drawImage(capaCalor, panX, panY, W * zoom, H * zoom); ctx.globalAlpha = 1; }
    zonas.forEach((z) => {
      trazar(z);
      const col = z.repartidores.length ? riderColor(z.repartidores[0]) : 'rgb(236,233,248)';
      ctx.fillStyle = `rgba(${col.startsWith('#') ? hex2rgb(col) : '236,233,248'},.24)`; ctx.fill('evenodd');
      ctx.setLineDash([5, 4]); ctx.strokeStyle = col.startsWith('#') ? `rgba(${hex2rgb(col)},.7)` : 'rgba(236,233,248,.45)'; ctx.lineWidth = 0.9; ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.restore();
    // borde suave de la cobertura
    ctx.setLineDash([4, 5]); ctx.strokeStyle = T().cob; ctx.lineWidth = 0.9; ctx.stroke(cob); ctx.setLineDash([]);
    const L = lista();
    if (encima && !(encima.t === tipo && encima.i === elegida) && modo !== 'dibujar') { const o = (encima.t === 'localidades' ? territorio : zonas)[encima.i]; if (o) { trazar(o); ctx.strokeStyle = T().resalte; ctx.lineWidth = 2; ctx.stroke(); } }
    if (elegida !== null && L[elegida]) {
      trazar(L[elegida]);
      ctx.fillStyle = T().relleno; ctx.fill('evenodd');
      ctx.strokeStyle = T().resalte; ctx.lineWidth = 2.6; ctx.stroke();
    }
    // nombres
    if (capas.localidades) {
      ctx.font = `600 ${fs}px ${FUENTE_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      territorio.forEach((z, i) => {
        const sel = tipo === 'localidades' && i === elegida;
        if (z.tipo === 'rural' && !sel) return;
        // la etiqueta va en la parte de la localidad que está dentro de la cobertura
        let pe = puntoEtiqueta(z);
        if (!enCobertura(pe)) {
          const ring = parteMayor(z), pts = [];
          const ys = ring.map((q) => q[1]), xs = ring.map((q) => q[0]);
          for (let i = 1; i < 14; i++) for (let j = 1; j < 14; j++) { const q = [Math.min(...xs) + (Math.max(...xs) - Math.min(...xs)) * i / 14, Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * j / 14]; if (dentroZona(q[0], q[1], z) && enCobertura(q)) pts.push(q); }
          if (!pts.length) return;
          pe = [pts.reduce((a, q) => a + q[0], 0) / pts.length, pts.reduce((a, q) => a + q[1], 0) / pts.length];
          if (!enCobertura(pe) || !dentroZona(pe[0], pe[1], z)) pe = pts[Math.floor(pts.length / 2)];
        }
        const [x, y] = aPx(...pe);
        if (x < -80 || y < -20 || x > W + 80 || y > H + 20) return;
        const corto = z.nombre.replace(/^(Funza|Soacha) · /, '').replace(/^Comuna (\d) · /, 'C$1 · ').split(' · ')[0];
        if (!sel && (zoom < 1.6 && areaKm2(z) < 6 || W < 640 && zoom < 2.2)) return;   // nombres chicos (o en pantallas chicas) solo al acercar
        etiqueta(corto, x, y, T().etiFondo, T().etiTexto);
      });
    }
    // edición
    if (tipo === 'reparto' && modo === 'editar' && elegida !== null && zonas[elegida]) {
      zonas[elegida].partes.forEach((ring) => ring.forEach((v, i) => {
        const w = ring[(i + 1) % ring.length], [x, y] = aPx(v[0], v[1]), [mx, my] = aPx((v[0] + w[0]) / 2, (v[1] + w[1]) / 2);
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.fillStyle = '#1B1370';
        ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, 7); ctx.fill(); ctx.stroke();
        const activo = arrastre && arrastre.v === v;
        ctx.fillStyle = activo ? '#B5DB2E' : '#FFFFFF'; ctx.strokeStyle = '#1B1370'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, activo ? 7 : 5.5, 0, 7); ctx.fill(); ctx.stroke();
      }));
    }
    if (modo === 'dibujar' && dibujo.length) {
      ctx.beginPath();
      dibujo.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (cursor) { const [x, y] = aPx(...cursor); ctx.lineTo(x, y); }
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
      if (dibujo.length > 2) { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill(); }
      dibujo.forEach(([lo, la], i) => { const [x, y] = aPx(lo, la); ctx.fillStyle = i ? '#FFFFFF' : '#B5DB2E'; ctx.beginPath(); ctx.arc(x, y, i ? 4.5 : 6, 0, 7); ctx.fill(); });
    }
    if (prueba) {
      const [x, y] = aPx(prueba.lon, prueba.lat);
      ctx.fillStyle = '#B5DB2E'; ctx.strokeStyle = '#12092E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y - 16, 8, Math.PI * 0.75, Math.PI * 2.25); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#12092E'; ctx.beginPath(); ctx.arc(x, y - 16, 3, 0, 7); ctx.fill();
    }
  }

  // ---------- Paneles ----------
  const nivelPill = (n) => `<span class="mz-nivel" data-nivel="${n.id}">${n.label}</span>`;
  const munTexto = (m) => (m === 'bogota' ? 'Bogotá D.C.' : `${MUNICIPIOS[m] || m}, Cundinamarca`);
  const tipoTexto = { localidad: 'Localidad', sector: 'Sector urbano', comuna: 'Comuna', rural: 'Zona rural' };
  const kpi = (tono, label, valor, pie, icono) => `<div class="kpi" data-tono="${tono}"><span class="kpi-label"><i class="kpi-ico">${icono}</i>${label}</span><span class="kpi-value">${valor}</span><span class="kpi-foot">${pie}</span></div>`;
  const ICO = {
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    caja: '<svg viewBox="0 0 24 24"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></svg>',
    moto: '<svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><path d="M8.5 17h7M15 6h2.5l2.5 8.5M11 10h5l-1.5 7"/></svg>',
    fuego: '<svg viewBox="0 0 24 24"><path d="M12 3s5 4.5 5 9.5A5 5 0 0 1 7 12.5C7 9.8 9 8 9 8s.5 3 2.5 3C11.5 7 12 3 12 3Z"/></svg>',
    mapa: '<svg viewBox="0 0 24 24"><path d="m9 4-6 2.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5Z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
  };

  function pintarResumen() {
    if (!$('#mz-kpis')) return;
    if (tipo === 'localidades') {
      const st = territorio.map(statsLocalidad);
      const total = st.reduce((s, x) => s + x.pedidos, 0);
      const iTop = st.reduce((m, x, i) => (x.pedidos > st[m].pedidos ? i : m), 0);
      const calientes = st.filter((x) => x.nivel.id === 'caliente').length;
      const sinCubrir = territorio.filter((t, i) => t.tipo !== 'rural' && !st[i].cubre.length).length;
      $('#mz-kpis').innerHTML = territorio.length ? `
        <div class="kpi kpi-hero"><span class="kpi-label">Localidad con más pedidos</span><span class="kpi-value mz-top">${esc(territorio[iTop].nombre.replace(/^(Funza|Soacha) · /, ''))}</span><span class="kpi-foot">${fmt(st[iTop].pedidos)} pedidos ${periodo === 'hoy' ? 'hoy' : 'en 7 días'}</span></div>
        ${kpi('cielo', `Pedidos ${periodo === 'hoy' ? 'hoy' : '7 días'}`, fmt(total), `en ${territorio.length} localidades y sectores`, ICO.caja)}
        ${kpi('coral', 'Zonas calientes', calientes, 'demanda alta de pedidos', ICO.fuego)}
        ${kpi('ambar', 'Sin zona de reparto', sinCubrir, sinCubrir ? 'localidades sin repartidor' : 'todas cubiertas', ICO.pin)}` : '';
    } else {
      const st = zonas.map(statsReparto);
      const conZona = new Set(zonas.flatMap((z) => z.repartidores));
      const sinRep = zonas.filter((z) => !z.repartidores.length).length;
      const sinRepPedidos = zonas.reduce((s, z, i) => s + (z.repartidores.length ? 0 : st[i].pedidos), 0);
      const km2 = st.reduce((s, x) => s + x.km2, 0);
      $('#mz-kpis').innerHTML = `
        <div class="kpi kpi-hero"><span class="kpi-label">Zonas de reparto</span><span class="kpi-value mz-top">${zonas.length}</span><span class="kpi-foot">${fmt(Math.round(km2))} km² asignables</span></div>
        ${kpi('cielo', 'Repartidores con zona', `${conZona.size}<small> / ${riders().length}</small>`, 'asignados en el mapa', ICO.moto)}
        ${kpi('ambar', 'Zonas sin repartidor', sinRep, sinRep ? 'sin autoasignación' : 'todas asignadas', ICO.mapa)}
        ${kpi('coral', 'Pedidos sin repartidor', fmt(sinRepPedidos), sinRepPedidos ? 'caen en zonas sin asignar' : 'todos con repartidor', ICO.caja)}`;
    }
  }

  // Cuántos repartidores le tocan a cada localidad: cada zona (1 repartidor) se reparte
  // entre las localidades según la fracción de su área que cae en cada una.
  const cacheReps = new Map();
  function repartidoresEn(t) {
    if (!cacheReps.size) {
      // por cada zona: área que cae en cada localidad, normalizada para que la zona sume 1 repartidor
      const pc = window.polygonClipping, acum = new Map(territorio.map((x) => [x.id, 0]));
      if (pc) zonas.forEach((z) => {
        if (!z.repartidores.length) return;
        const partes = territorio.map((loc) => {
          try { const inter = dePC(pc.intersection(aPC(z), aPC(loc))); return inter.length ? areaKm2({ partes: inter }) : 0; } catch { return 0; }
        });
        const tot = partes.reduce((x, y) => x + y, 0);
        if (tot > 0) territorio.forEach((loc, i) => acum.set(loc.id, acum.get(loc.id) + (partes[i] / tot) * z.repartidores.length));
      });
      acum.forEach((v, k) => cacheReps.set(k, Math.round(v * 100) / 100));
      if (!cacheReps.size) cacheReps.set('_', 0);
    }
    return cacheReps.get(t.id) || 0;
  }
  const fmtReps = (n) => `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} repartidor${n === 1 ? '' : 'es'}`;

  function pintarLista() {
    const box = $('#mz-lista');
    const conZonas = riders().map((r) => ({ id: r.id, nombre: r.nombre, color: riderColor(r.id) }))
      .map((g) => ({ ...g, mias: zonas.map((z, i) => [z, i]).filter(([z]) => z.repartidores.includes(g.id)) }))
      .filter((g) => g.mias.length);
    const porDemanda = capas.calor && zonas.length;
    $('#mz-lista-titulo').textContent = porDemanda ? 'Zonas por demanda' : 'Zonas de reparto';
    $('#mz-lista-sub').textContent = porDemanda ? 'pedidos ' + textoPeriodo() : 'autoasignación';
    let html;
    if (porDemanda) {
      const st = zonas.map(statsReparto);
      const max = Math.max(1, ...st.map((x) => x.pedidos));
      html = zonas.map((_, i) => i).sort((x, y) => st[y].pedidos - st[x].pedidos).map((i) => {
        const z = zonas[i], s2 = st[i], act = tipo === 'reparto' && elegida === i;
        const nivel = NIVELES.find((n) => s2.pedidos / factor() >= n.min);
        const rid = z.repartidores[0];
        return `<li><button type="button" class="mz-fila${act ? ' activa' : ''}" data-mz-zona="${i}" aria-pressed="${act}">
          <span class="mz-fila-top"><b>${esc(z.nombre)}</b>${nivelPill(nivel)}</span>
          <span class="mz-barra"><i style="--w:${(s2.pedidos / max) * 100}%;--c:${nivel.color}"></i></span>
          <span class="mz-fila-datos"><span>${fmt(s2.pedidos)} pedidos</span><span>${s2.km2.toFixed(1)} km²</span>${rid ? `<span><i class="mz-punto" style="--c:${riderColor(rid)}"></i>${esc(riderNombre(rid).split(' ')[0])}</span>` : ''}</span>
        </button></li>`;
      }).join('');
    } else html = conZonas.length ? conZonas.map((g) => `<li class="mz-grupo"><div class="mz-grupo-cab"><span class="mz-avatar" style="--c:${g.color}">${iniciales(g.nombre)}</span><b>${esc(g.nombre)}</b><small>${g.mias.length} zona${g.mias.length === 1 ? '' : 's'}</small></div>
        <ul>${g.mias.map(([z, i]) => { const s2 = statsReparto(z); const act = tipo === 'reparto' && elegida === i; return `<li><button type="button" class="mz-fila mini${act ? ' activa' : ''}" data-mz-zona="${i}" aria-pressed="${act}"><span class="mz-fila-top"><b>${esc(z.nombre)}</b><span class="mz-fila-datos"><span>${fmt(s2.pedidos)} pedidos</span><span>${s2.km2.toFixed(1)} km²</span></span></span></button></li>`; }).join('')}</ul></li>`).join('')
      : `<li class="mz-vacio mz-vacio-zonas">Aún no hay zonas de reparto. Cuando tengas repartidores, créalas con <b>+ Nueva zona</b>.</li>`;
    if (capas.localidades && territorio.length) {
      const st = territorio.map(statsLocalidad);
      const orden = territorio.map((_, i) => i).sort((x, y) => st[y].pedidos - st[x].pedidos);
      const max = Math.max(1, ...st.map((x) => x.pedidos));
      html += `<li class="mz-sep"><b>Localidades por demanda</b><small>pedidos ${textoPeriodo()}</small></li>` + orden.map((i) => {
        const t = territorio[i], s2 = st[i], act = tipo === 'localidades' && elegida === i;
        return `<li><button type="button" class="mz-fila${act ? ' activa' : ''}" data-mz-loc="${i}" aria-pressed="${act}">
          <span class="mz-fila-top"><b><i class="mz-punto" style="--c:${colorLocalidad(i)}"></i>${esc(t.nombre)}</b>${t.aproximado ? '<span class="mz-aprox" title="Límite aproximado">aprox.</span>' : ''}${nivelPill(s2.nivel)}</span>
          <span class="mz-barra"><i style="--w:${(s2.pedidos / max) * 100}%;--c:${s2.nivel.color}"></i></span>
          <span class="mz-fila-datos"><span>${fmt(s2.pedidos)} pedidos</span><span>${s2.tiempo} min</span><span>${fmtReps(repartidoresEn(t))}</span></span>
        </button></li>`;
      }).join('');
    }
    box.innerHTML = html;
  }

  function pintarDetalle() {
    const box = $('#mz-detalle');
    $('#view-mapa').dataset.detalle = modo === 'dibujar' || (elegida !== null && lista()[elegida]) ? 'si' : 'no';
    if (modo === 'dibujar') {
      const listo = repNuevo && dibujo.length > 2;
      box.innerHTML = `<header class="mz-det-cab"><div><small>Nueva zona de reparto</small><h3>${repNuevo ? 'Dibuja la zona' : '¿Para qué repartidor?'}</h3></div>
          <button type="button" class="mz-cerrar" data-mz-accion="cancelar-dibujo" aria-label="Cancelar">×</button></header>
        <p class="mz-paso"><span>1</span>Elige el repartidor</p>
        <div class="mz-reps-elegir" role="radiogroup" aria-label="Repartidor de la zona nueva">
          ${riders().map((r) => `<button type="button" role="radio" class="mz-rep-op" data-mz-rep="${esc(r.id)}" aria-checked="${repNuevo === r.id}" style="--c:${riderColor(r.id)}"><span class="mz-avatar" style="--c:${riderColor(r.id)}">${iniciales(r.nombre)}</span>${esc(r.nombre)}</button>`).join('')}
        </div>
        <p class="mz-paso${repNuevo ? '' : ' apagado'}"><span>2</span>Toca el mapa para marcar el contorno</p>
        <p class="mz-vacio">${dibujo.length ? `${dibujo.length} punto${dibujo.length === 1 ? '' : 's'} marcados.` : 'Cada toque agrega una esquina.'} Para terminar toca el primer punto o pulsa <kbd>Enter</kbd>. Las zonas de alrededor se recortan solas para que no queden encima.</p>
        <div class="mz-acciones"><button type="button" class="btn-ghost" data-mz-accion="deshacer-punto" ${dibujo.length ? '' : 'disabled'}>Quitar último</button><button type="button" class="mz-btn-lima" data-mz-accion="cerrar-dibujo" ${listo ? '' : 'disabled'}>Crear zona</button></div>`;
      return;
    }
    if (modo === 'probar') {
      const r = prueba && prueba.res;
      box.innerHTML = `<header class="mz-det-cab"><div><small>Autoasignación</small><h3>Probar un punto</h3></div></header>
        <form class="mz-probar" data-mz-form="probar"><label><span>Coordenada (latitud, longitud)</span>
          <input name="coord" inputmode="decimal" placeholder="4.6486, -74.0628" value="${prueba ? `${r6(prueba.lat)}, ${r6(prueba.lon)}` : ''}" autocomplete="off"></label>
          <button type="submit" class="mz-btn-lima">Probar</button></form>
        <p class="mz-vacio">También puedes tocar el mapa. Regla: la zona de reparto que contiene el punto (la de mayor prioridad si hay solape) o, si cae en un hueco, la más cercana.</p>
        ${r ? `<div class="mz-resultado ${r.dentro ? '' : 'alerta'}">
            <span class="mz-res-loc">${r.localidad ? `${esc(tipoTexto[r.localidad.tipo] || 'Localidad')}: <b>${esc(r.localidad.nombre)}</b>` : 'Fuera de las localidades cargadas'}</span>
            ${r.zona ? `<span>${r.dentro ? 'Zona de reparto' : 'Fuera de las zonas · la más cercana'}</span><strong>${esc(r.zona.nombre)}</strong>${r.dentro ? '' : `<small>a ${r.km.toFixed(2)} km del borde</small>`}
            <span class="mz-res-reps">${r.zona.repartidores.length ? r.zona.repartidores.map((id) => `<span class="mz-chip-rep" style="--c:${riderColor(id)}">${esc(riderNombre(id))}</span>`).join('') : 'Sin repartidor asignado a esta zona'}</span>` : '<span>No hay zonas de reparto.</span>'}
          </div>` : ''}`;
      return;
    }
    const L = lista();
    if (elegida === null || !L[elegida]) {
      box.innerHTML = modo === 'editar'
          ? `<p class="mz-vacio">Toca una zona para editarla. Arrastra un vértice para moverlo (los compartidos con zonas vecinas se mueven juntos; con <kbd>Alt</kbd> solo ese), arrastra un punto medio para agregar uno y haz doble clic en un vértice para borrarlo.</p>`
          : `<p class="mz-vacio">Toca una zona o una localidad para ver su detalle.</p>`;
      return;
    }
    if (tipo === 'localidades') {
      const t = L[elegida], s = statsLocalidad(t);
      const pct = s.pedidos ? Math.round((s.entregados / s.pedidos) * 100) : 0;
      const reps = [...new Set(s.cubre.flatMap((z) => z.repartidores))];
      box.innerHTML = `
        <header class="mz-det-cab"><div><small>${esc(tipoTexto[t.tipo] || 'Zona')} · ${munTexto(t.municipio)}</small><h3>${esc(t.nombre.replace(/^(Funza|Soacha) · /, ''))}</h3></div>${nivelPill(s.nivel)}
          <button type="button" class="mz-cerrar" data-mz-accion="cerrar" aria-label="Cerrar detalle">×</button></header>
        <dl class="mz-det-datos">
          <div data-tono="cielo"><dt>Pedidos</dt><dd>${fmt(s.pedidos)}</dd></div><div data-tono="lima"><dt>Entregados</dt><dd>${pct}%</dd></div><div data-tono="lavanda"><dt>En curso</dt><dd>${fmt(s.enCurso)}</dd></div>
          <div data-tono="ambar"><dt>Tiempo prom.</dt><dd>${s.tiempo}<small> min</small></dd></div><div data-tono="coral"><dt>Novedades</dt><dd>${fmt(s.novedades)}</dd></div><div><dt>Área</dt><dd>${s.km2.toFixed(1)}<small> km²</small></dd></div>
        </dl>
        <p class="mz-sub-titulo">Repartidores que la cubren</p>
        <p class="mz-res-reps">${reps.length ? reps.map((id) => `<span class="mz-chip-rep" style="--c:${riderColor(id)}">${esc(riderNombre(id))}</span>`).join('') : '<i class="mz-sin">Ninguna zona de reparto la cubre</i>'}</p>
        ${t.barrios ? `<details class="mz-barrios"><summary>${t.barrios.length} barrios</summary><p>${t.barrios.map(esc).join(' · ')}</p></details>` : ''}
        <p class="mz-fuente">${t.aproximado ? '<b>Límite aproximado.</b> Reemplázalo con el archivo oficial cuando lo tengas. ' : ''}Fuente: ${esc(t.fuente)}</p>`;
      return;
    }
    const z = zonas[elegida], s = statsReparto(z);
    if (modo === 'editar') {
      box.innerHTML = `<header class="mz-det-cab"><div><small>Editando zona</small><h3>${esc(z.nombre)}</h3></div>
          <button type="button" class="mz-cerrar" data-mz-accion="cerrar" aria-label="Cerrar">×</button></header>
        <p class="mz-vacio">Arrastra los puntos blancos para mover el borde, o los pequeños para agregar uno. Doble clic en un punto lo quita. Las zonas vecinas se adaptan solas.</p>
        <form class="mz-form" data-mz-form="zona">
          <label class="ancho"><span>Nombre</span><input name="nombre" value="${esc(z.nombre)}" required maxlength="40"></label>
          <fieldset class="ancho"><legend>Repartidor</legend>
            <div class="mz-reps-elegir">${riders().map((r) => `<label class="mz-rep-op" style="--c:${riderColor(r.id)}"><input type="radio" name="rep" value="${esc(r.id)}" ${z.repartidores[0] === r.id ? 'checked' : ''}><span class="mz-avatar" style="--c:${riderColor(r.id)}">${iniciales(r.nombre)}</span>${esc(r.nombre)}</label>`).join('')}</div>
          </fieldset>
          <label class="ancho"><span>Pedidos al día que puede hacer</span><input name="capacidad" type="number" min="1" step="1" value="${z.capacidad || PEDIDOS_POR_REPARTIDOR}"></label>
        </form>
        <div class="mz-acciones"><button type="button" class="btn-ghost danger" data-mz-accion="borrar-zona">Eliminar zona</button></div>`;
      return;
    }
    const locs = territorio.filter((t) => muestraCruza(z, t)).map((t) => t.nombre.replace(/^(Funza|Soacha) · /, ''));
    const consejo = !z.repartidores.length
      ? `<p class="mz-consejo alerta"><b>Sin repartidor.</b> Los pedidos de esta zona irán a la zona vecina más cercana. Asígnale uno en <b>Editar</b>.</p>`
      : z.repartidores.map((id) => {
          const suyas = zonas.filter((q) => q.repartidores.includes(id));
          const carga = Math.round(suyas.reduce((n, q) => n + statsReparto(q).pedidos / q.repartidores.length, 0));
          const cap = (Number(z.capacidad) || PEDIDOS_POR_REPARTIDOR) * factor();
          return `<p class="mz-consejo${carga > cap ? ' alerta' : ''}"><b>${esc(riderNombre(id).split(' ')[0])}</b>: ${fmt(carga)} pedidos ${textoPeriodo()} en ${suyas.length} zona${suyas.length > 1 ? 's' : ''}${carga > cap ? ` · supera su capacidad (${fmt(cap)})` : ''}.</p>`;
        }).join('');
    box.innerHTML = `
      <header class="mz-det-cab"><div><small>Zona de reparto · ${munTexto(z.municipio)}</small><h3>${esc(z.nombre)}</h3></div>
        <button type="button" class="mz-cerrar" data-mz-accion="cerrar" aria-label="Cerrar detalle">×</button></header>
      <p class="mz-res-reps">${z.repartidores.length ? z.repartidores.map((id) => `<span class="mz-chip-rep" style="--c:${riderColor(id)}">${esc(riderNombre(id))}</span>`).join('') : '<i class="mz-sin">Sin repartidor asignado</i>'}</p>
      <dl class="mz-det-datos">
        <div data-tono="cielo"><dt>Pedidos</dt><dd>${fmt(s.pedidos)}</dd></div><div data-tono="lavanda"><dt>Área</dt><dd>${s.km2.toFixed(1)}<small> km²</small></dd></div><div data-tono="ambar"><dt>Localidades</dt><dd>${territorio.filter((t) => muestraCruza(z, t)).length}</dd></div>
      </dl>
      ${consejo}
      <p class="mz-sub-titulo">Localidades que cubre</p>
      <p class="mz-locs">${locs.length ? locs.map(esc).join(' · ') : '—'}</p>
      <div class="mz-acciones"><button type="button" class="btn-ghost" data-mz-accion="editar-esta">Editar zona</button></div>`;
  }

  function pintarPaneles() { pintarResumen(); pintarLista(); pintarDetalle(); }
  let generarPendiente = 0;
  function huboCambio() { cacheCruce.clear(); cacheReps.clear(); pintarResumen(); pintarLista(); clearTimeout(generarPendiente); generarPendiente = setTimeout(arrancar, 50); }
  function cambiarTipo(t) {
    tipo = t; elegida = null; encima = null;

    cambiarModo(modo);
    pintarPaneles(); arrancar();
  }
  function cambiarModo(m) {
    modo = m;
    if (m !== 'dibujar') { dibujo = []; repNuevo = null; }
    if (m !== 'probar') prueba = null;
    $$('#mz-modo button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mzModo === m));
    const v = $('#view-mapa'); v.dataset.modo = m; v.dataset.tipo = tipo;
    pintarDetalle();
  }
  function aviso(msg, t = 'ok') {
    const el = $('#mz-aviso');
    el.innerHTML = msg; el.dataset.tipo = t; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, t === 'error' ? 9000 : 6000);
  }

  // ---------- Interacción ----------
  const posEvento = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function objetoEn(lon, lat, soloZonas) {
    for (let i = zonas.length - 1; i >= 0; i--) if (dentroZona(lon, lat, zonas[i])) return { t: 'reparto', i };
    if (!soloZonas && capas.localidades && enCobertura([lon, lat])) for (let i = territorio.length - 1; i >= 0; i--) if (dentroZona(lon, lat, territorio[i])) return { t: 'localidades', i };
    return null;
  }
  const mismo = (a, b) => Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;
  function gemelos(v) { const out = []; zonas.forEach((z) => z.partes.forEach((r) => r.forEach((w) => { if (w !== v && mismo(w, v)) out.push(w); }))); return out; }
  function partirBorde(a, b, medio) {
    zonas.forEach((z, zi) => z.partes.forEach((ring) => {
      if (zi === elegida && ring.includes(a) && ring.includes(b)) return;
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        if ((mismo(p, a) && mismo(q, b)) || (mismo(p, b) && mismo(q, a))) { ring.splice(i + 1, 0, [...medio]); return; }
      }
    }));
  }
  function handleEn(x, y) {
    if (tipo !== 'reparto' || modo !== 'editar' || elegida === null || !zonas[elegida]) return null;
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
      encima = objetoEn(lon, lat, modo === 'editar');
      canvas.style.cursor = h ? (h.tipo === 'v' ? 'grab' : 'copy') : modo === 'dibujar' || modo === 'probar' ? 'crosshair' : encima !== null ? 'pointer' : 'default';
      const tip = $('#mz-tip');
      if (encima !== null && modo === 'ver') {
        const z = (encima.t === 'localidades' ? territorio : zonas)[encima.i];
        const linea = encima.t === 'localidades' ? `${fmt(statsLocalidad(z).pedidos)} pedidos · ${esc(tipoTexto[z.tipo] || '')}` : (z.repartidores.length ? z.repartidores.map((id) => esc(riderNombre(id))).join(', ') : 'Sin repartidor');
        tip.innerHTML = `<b>${esc(z.nombre)}</b><span>${linea}</span>`;
        tip.hidden = false;
        tip.style.transform = `translate(${Math.min(x + 14, W - 220)}px, ${Math.min(y + 14, H - 50)}px)`;
      } else tip.hidden = true;
    });
    canvas.addEventListener('pointerup', (e) => {
      const [x, y] = posEvento(e);
      if (arrastre) {
        arrastre = null;
        const z = zonas[elegida];
        if (z) { const q = recortarVecinas(z); elegida = zonas.indexOf(z); if (q.length) aviso(`Se eliminaron zonas que quedaron cubiertas: ${q.map((x) => esc(x.nombre)).join(', ')}.`); }
        guardar(); pintarDetalle(); return;
      }
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
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = posEvento(e); acercar(e.deltaY < 0 ? 1.2 : 1 / 1.2, x, y); }, { passive: false });
  }
  function clic(x, y) {
    const [lon, lat] = aGeo(x, y);
    if (modo === 'dibujar') {
      if (!repNuevo) { aviso('Primero elige el repartidor de la zona.', 'error'); return; }
      if (dibujo.length > 2) { const [fx, fy] = aPx(...dibujo[0]); if (Math.hypot(fx - x, fy - y) < 10) { cerrarDibujo(); return; } }
      const iman = imanVertice(x, y);
      dibujo.push(iman ? [...iman] : [r6(lon), r6(lat)]);
      pintarDetalle(); return;
    }
    if (modo === 'probar') { probar(lat, lon); return; }
    const o = objetoEn(lon, lat, modo === 'editar');
    if (!o) { elegida = null; }
    else if (o.t === tipo && o.i === elegida && modo === 'ver') elegida = null;
    else { tipo = o.t; elegida = o.i; }
    pintarLista(); pintarDetalle();
  }
  // Zoom animado: se interpola hacia el destino en ~320 ms (suavizado)
  let anim = null;
  function limitar(z, px, py) {
    if (z <= 1) return [1, 0, 0];
    return [z, Math.min(W * 0.4, Math.max(W * (0.6 - z), px)), Math.min(H * 0.4, Math.max(H * (0.6 - z), py))];
  }
  function animarA(nz, npx, npy, ms = 320) {
    const [z1, x1, y1] = limitar(nz, npx, npy);
    anim = { z0: zoom, x0: panX, y0: panY, z1, x1, y1, t0: performance.now(), ms };
    arrancar();
  }
  function pasoAnim(now) {
    if (!anim) return false;
    const k = Math.min(1, (now - anim.t0) / anim.ms), e = 1 - Math.pow(1 - k, 3);
    // interpolación geométrica del zoom: se siente uniforme al acercar y alejar
    zoom = anim.z0 * Math.pow(anim.z1 / anim.z0, e);
    const f = (zoom - anim.z0) / ((anim.z1 - anim.z0) || 1);
    panX = anim.x0 + (anim.x1 - anim.x0) * (anim.z1 === anim.z0 ? e : f);
    panY = anim.y0 + (anim.y1 - anim.y0) * (anim.z1 === anim.z0 ? e : f);
    callesSucias = true;
    if (k >= 1) { zoom = anim.z1; panX = anim.x1; panY = anim.y1; anim = null; }
    return true;
  }
  function acercar(f, x = W / 2, y = H / 2) {
    const base = anim ? anim.z1 : zoom, bx0 = anim ? anim.x1 : panX, by0 = anim ? anim.y1 : panY;
    const nz = Math.max(1, Math.min(14, base * f));
    animarA(nz, x - (x - bx0) * (nz / base), y - (y - by0) * (nz / base), 260);
  }
  function limitarVista() {
    if (zoom <= 1) { zoom = 1; panX = 0; panY = 0; return; }
    panX = Math.min(W * 0.4, Math.max(W * (0.6 - zoom), panX));
    panY = Math.min(H * 0.4, Math.max(H * (0.6 - zoom), panY));
  }
  function encuadrar(z) {
    // medir en la vista sin zoom
    const xs = [], ys = [];
    z.partes.forEach((r) => r.forEach(([lo, la]) => { const sx = bx + (lo - LON[0]) * KX * esc0, sy = by + (LAT[1] - la) * esc0; xs.push(sx); ys.push(sy); }));
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const nz = Math.max(1, Math.min(6, Math.min(W / (w * 1.6 || 1), H / (h * 1.6 || 1))));
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    animarA(nz, W / 2 - cx * nz, H / 2 - cy * nz);
  }
  function borrarVertice(pi, vi) {
    const ring = zonas[elegida].partes[pi];
    if (ring.length <= 3) { aviso('Un polígono necesita al menos 3 vértices.', 'error'); return; }
    const v = ring[vi];
    zonas.forEach((z) => z.partes.forEach((r) => { if (r !== ring && r.length > 3) { const k = r.findIndex((w) => mismo(w, v)); if (k >= 0) r.splice(k, 1); } }));
    ring.splice(vi, 1); guardar(); pintarDetalle();
  }
  function cerrarDibujo() {
    if (!repNuevo) { aviso('Primero elige el repartidor de la zona.', 'error'); return; }
    if (dibujo.length < 3) { aviso('Marca al menos 3 puntos para crear la zona.', 'error'); return; }
    if (autoCruce(dibujo)) { aviso('El contorno se cruza consigo mismo. Quita el último punto y vuelve a marcarlo.', 'error'); return; }
    let n = zonas.length + 1;
    while (zonas.some((z) => z.id === `zona-${n}` || z.nombre === `Zona ${n}`)) n++;
    const [lo, la] = centroide(dibujo);
    const mun = Object.entries(COBERTURA).find(([, pol]) => dentroAnillo(lo, la, pol.map(([y, x]) => [x, y])));
    const nueva = { id: `zona-${n}`, nombre: `Zona ${n}`, municipio: mun ? mun[0] : 'bogota', repartidores: [repNuevo], capacidad: PEDIDOS_POR_REPARTIDOR, prioridad: 0, partes: [dibujo.map((q) => [...q])] };
    zonas.push(nueva);
    const quitadas = recortarVecinas(nueva);
    dibujo = []; repNuevo = null;
    elegida = zonas.indexOf(nueva);
    cambiarModo('ver'); guardar(); pintarDetalle();
    aviso(`Zona creada para <b>${esc(riderNombre(nueva.repartidores[0]))}</b>. Las zonas de alrededor se ajustaron a su borde.${quitadas.length ? `<br>Quedaron cubiertas por completo y se eliminaron: ${quitadas.map((z) => esc(z.nombre)).join(', ')}.` : ''}`);
  }
  function probar(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) { aviso('Escribe la coordenada como <b>latitud, longitud</b> (por ejemplo 4.6486, -74.0628).', 'error'); return; }
    if (Math.abs(lat) > 20 && Math.abs(lon) < 20) [lat, lon] = [lon, lat];
    prueba = { lat, lon, res: asignar(lat, lon) };
    if (tipo === 'reparto' && prueba.res.zona) elegida = zonas.indexOf(prueba.res.zona);
    else if (tipo === 'localidades' && prueba.res.localidad) elegida = territorio.indexOf(prueba.res.localidad);
    pintarLista(); pintarDetalle(); arrancar();
  }

  // ---------- Herramientas ----------
  function cerrarMenu() { const m = $('#mz-menu'); if (m) { m.hidden = true; $('[data-mz-accion="menu"]').setAttribute('aria-expanded', 'false'); } }
  function enlazarHerramientas() {
    const vista = $('#view-mapa');
    vista.addEventListener('click', (e) => {
      const t = e.target.closest('[data-mz-tipo]');
      if (t) { cambiarTipo(t.dataset.mzTipo); return; }
      const capa = e.target.closest('[data-capa]');
      if (capa) {
        capas[capa.dataset.capa] = !capas[capa.dataset.capa];
        capa.setAttribute('aria-pressed', capas[capa.dataset.capa]);
        if (capa.dataset.capa === 'calor') { pintarCalor(); pintarLista(); }
        if (capa.dataset.capa === 'localidades') { if (tipo === 'localidades') { tipo = 'reparto'; elegida = null; } pintarLista(); pintarDetalle(); }
        arrancar(); return;
      }
      const per = e.target.closest('[data-periodo]');
      if (per) { periodo = per.dataset.periodo; $$('#mz-periodo button').forEach((b) => b.setAttribute('aria-pressed', b === per)); pintarPaneles(); return; }
      const m = e.target.closest('[data-mz-modo]');
      if (m) { if (m.dataset.mzModo !== 'ver' && tipo !== 'reparto') { tipo = 'reparto'; elegida = null; } cambiarModo(m.dataset.mzModo); pintarLista(); arrancar(); return; }
      const filaLoc = e.target.closest('[data-mz-loc]');
      if (filaLoc) {
        const i = Number(filaLoc.dataset.mzLoc);
        if (tipo === 'localidades' && elegida === i) elegida = null; else { tipo = 'localidades'; elegida = i; encuadrar(territorio[i]); }
        pintarLista(); pintarDetalle(); arrancar(); return;
      }
      const fila = e.target.closest('[data-mz-zona]');
      if (fila) {
        const i = Number(fila.dataset.mzZona);
        if (tipo !== 'reparto') { tipo = 'reparto'; elegida = null; }
        elegida = elegida === i && modo === 'ver' ? null : i;
        if (elegida !== null && (modo === 'editar' || tipo === 'localidades')) encuadrar(lista()[elegida]);
        pintarLista(); pintarDetalle(); arrancar(); return;
      }
      const op = e.target.closest('[data-mz-rep]');
      if (op) { repNuevo = op.dataset.mzRep; pintarDetalle(); arrancar(); return; }
      const b = e.target.closest('[data-mz-accion]');
      if (!b) { if (!e.target.closest('#mz-menu')) cerrarMenu(); return; }
      const acc = b.dataset.mzAccion;
      if (acc !== 'menu') cerrarMenu();
      if (acc === 'menu') { const mm = $('#mz-menu'); mm.hidden = !mm.hidden; b.setAttribute('aria-expanded', String(!mm.hidden)); }
      else if (acc === 'cerrar') { elegida = null; pintarLista(); pintarDetalle(); }
      else if (acc === 'editar-esta') { cambiarModo('editar'); if (elegida !== null) encuadrar(zonas[elegida]); }
      else if (acc === 'borrar-vertice') { const [pi, vi] = b.dataset.v.split(',').map(Number); borrarVertice(pi, vi); }
      else if (acc === 'borrar-zona') { if (!confirm(`¿Eliminar la zona "${zonas[elegida].nombre}"? Puedes recuperarla importando un GeoJSON guardado.`)) return; zonas.splice(elegida, 1); elegida = null; guardar(); pintarDetalle(); }
      else if (acc === 'deshacer-punto') { dibujo.pop(); pintarDetalle(); arrancar(); }
      else if (acc === 'cancelar-dibujo') { dibujo = []; repNuevo = null; cambiarModo('ver'); arrancar(); }
      else if (acc === 'cerrar-dibujo') cerrarDibujo();
      else if (acc === 'acercar') acercar(1.4);
      else if (acc === 'alejar') acercar(1 / 1.4);
      else if (acc === 'encuadrar') { animarA(1, 0, 0); }
      else if (acc === 'exportar') { descargar('zonas-reparto-loentrego.geojson', JSON.stringify(aGeoJSON(), null, 2), 'application/geo+json'); aviso(`Zonas de reparto descargadas (${zonas.length}) · GeoJSON WGS84.`); }
      else if (acc === 'exportar-localidades') { descargar('localidades-loentrego.geojson', JSON.stringify(territorioGeoJSON(), null, 2), 'application/geo+json'); aviso(`Localidades descargadas (${territorio.length}) · GeoJSON WGS84.`); }
      else if (acc === 'sql') { descargar('zonas-loentrego.sql', aSQL(), 'application/sql'); aviso('SQL para PostGIS descargado: zonas de reparto, localidades, índices y funciones <code>zona_para_punto</code> y <code>localidad_para_punto</code>.'); }
      else if (acc === 'importar') $('#mz-archivo').click();
      else if (acc === 'validar') informeValidacion();
      else if (acc === 'restablecer') { if (!confirm('¿Volver a las zonas de reparto iniciales? Se perderán los cambios que no hayas exportado.')) return; zonas = zonasIniciales(); elegida = null; guardar(); pintarDetalle(); aviso('Zonas de reparto iniciales restablecidas.'); }
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.mz-menu-wrap')) cerrarMenu(); });
    vista.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-mz-form]');
      if (!f) return;
      e.preventDefault();
      if (f.dataset.mzForm === 'probar') { const [a, b] = String(f.coord.value).split(/[,;\s]+/).filter(Boolean).map(Number); probar(a, b); }
    });
    vista.addEventListener('change', (e) => {
      const f = e.target.closest('[data-mz-form="zona"]');
      if (f && elegida !== null && tipo === 'reparto') {
        const z = zonas[elegida];
        z.nombre = f.nombre.value.trim() || z.nombre;
        z.capacidad = Math.max(1, Number(f.capacidad.value) || PEDIDOS_POR_REPARTIDOR);
        const elegido = $('input[name="rep"]:checked', f);
        if (elegido) z.repartidores = [elegido.value];   // siempre uno: no hay zonas sin repartidor
        guardar();
        $('.mz-det-cab h3').textContent = z.nombre;
        return;
      }
      const v = e.target.closest('[data-mz-vert]');
      if (v && elegida !== null) {
        const [pi, vi, k] = v.dataset.mzVert.split(',').map(Number), n = Number(String(v.value).replace(',', '.'));
        const ok = isFinite(n) && (k === 1 ? Math.abs(n) <= 90 : Math.abs(n) <= 180);
        if (!ok) { v.value = zonas[elegida].partes[pi][vi][k]; aviso('Coordenada no válida. Usa grados decimales, por ejemplo 4.6486 y -74.0628.', 'error'); return; }
        const v0 = zonas[elegida].partes[pi][vi];
        for (const w of [v0, ...gemelos(v0)]) w[k] = r6(n);
        guardar(); arrancar();
      }
    });
    $('#mz-archivo').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = '';
      if (!archivo) return;
      try {
        const { zonas: nuevas, avisos } = deGeoJSON(JSON.parse(await archivo.text()));
        if (!confirm(`El archivo tiene ${nuevas.length} zona${nuevas.length > 1 ? 's' : ''} de reparto. ¿Reemplazar las ${zonas.length} actuales?`)) return;
        zonas = nuevas; elegida = null; zoom = 1; panX = 0; panY = 0; callesSucias = true;
        tipo = 'reparto';
        guardar(); pintarDetalle(); arrancar();
        aviso(`Importadas ${nuevas.length} zonas de reparto.${avisos.length ? '<br>' + avisos.slice(0, 4).map(esc).join('<br>') : ''}`, avisos.length ? 'error' : 'ok');
      } catch (err) {
        aviso(esc(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err.message), 'error');
      }
    });
    document.addEventListener('keydown', (e) => {
      if ($('#view-mapa').hidden || /input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') { cerrarMenu(); if (modo === 'dibujar' && dibujo.length) { dibujo = []; pintarDetalle(); } else if (modo !== 'ver') cambiarModo('ver'); else { elegida = null; pintarPaneles(); } }
      else if (e.key === 'Enter' && modo === 'dibujar') cerrarDibujo();
      else if (e.key === 'Backspace' && modo === 'dibujar') { e.preventDefault(); dibujo.pop(); pintarDetalle(); }
      else if (e.key === '+' || e.key === '=') acercar(1.3);
      else if (e.key === '-') acercar(1 / 1.3);
      else return;
      arrancar();
    });
  }
  function informeValidacion() {
    const v = validar(), prob = [];
    if (v.cruzadas.length) prob.push(`Se cruzan consigo mismas: <b>${v.cruzadas.map(esc).join(', ')}</b>`);
    if (v.solapes.size) prob.push(`Solapes: ${[...v.solapes.keys()].slice(0, 5).map((k) => `<b>${esc(k)}</b>`).join(', ')}${v.solapes.size > 5 ? '…' : ''} (se resuelven por prioridad)`);
    const pct = v.muestras ? (v.huecos / v.muestras) * 100 : 0;
    if (pct >= 0.5) prob.push(`Huecos: el ${pct.toFixed(1)}% de la cobertura no tiene zona (se asigna la más cercana)`);
    const sinRep = zonas.filter((z) => !z.repartidores.length).map((z) => z.nombre);
    if (sinRep.length) prob.push(`Sin repartidor: ${sinRep.slice(0, 4).map(esc).join(', ')}${sinRep.length > 4 ? '…' : ''}`);
    aviso(prob.length ? `<b>Revisión de zonas de reparto</b><br>${prob.join('<br>')}` : `<b>Zonas en orden.</b> Sin solapes, sin huecos y todas con repartidor (${zonas.length} zonas).`, prob.length ? 'error' : 'ok');
  }

  // ---------- Montaje ----------
  let montado = false, raf = 0;
  function bucle(now) { raf = 0; if (!canvas.isConnected || canvas.offsetParent === null || document.hidden) return; const animando = pasoAnim(now || performance.now()); cuadro(); if (arrastre || paneo || animando) raf = requestAnimationFrame(bucle); }
  function arrancar() { if (canvas && !raf) raf = requestAnimationFrame(bucle); }   // se dibuja solo cuando algo cambia

  function montar() {
    if (!montado) {
      montado = true;
      canvas = $('#mz-mapa'); ctx = canvas.getContext('2d');
      cargar();
      enlazarMapa(); enlazarHerramientas();
      new ResizeObserver(() => { if (canvas.offsetParent !== null) { medir(); arrancar(); } }).observe(canvas);
      document.addEventListener('visibilitychange', arrancar);
      fetch('../Scripts/territorio.json?v=1').then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((gj) => {
          territorio = gj.features.map((f) => ({ ...f.properties, partes: partesDe(f.geometry) })).filter((t) => t.partes.length);
          generar(); pintarCalor(); cacheCruce.clear(); pintarPaneles(); arrancar();
        })
        .catch(() => aviso('No se pudieron cargar las localidades.', 'error'));
      fetch('../Scripts/bogota-calles.txt?v=1').then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => { calles = leerCalles(t); callesSucias = true; arrancar(); })
        .catch(() => { /* sin calles */ });
      window.addEventListener('storage', (e) => { if (e.key === CLAVE) { cargar(); elegida = null; huboCambio(); pintarDetalle(); } });
    }
    tipo = 'reparto'; cambiarModo(modo); pintarPaneles(); arrancar();
    requestAnimationFrame(() => { medir(); arrancar(); });
  }

  // API para el equipo técnico / backend (no aparece en la interfaz)
  window.LEMapa = { montar, zonasGeoJSON: () => aGeoJSON(), localidadesGeoJSON: () => territorioGeoJSON(), asignar, sql: () => aSQL() };
})();
