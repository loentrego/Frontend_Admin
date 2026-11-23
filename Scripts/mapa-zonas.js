// =====================================================================
//  LoEntrego · Admin — Mapa de zonas
//
//  Bogotá, Funza y Soacha con sus calles reales (OpenStreetMap), divididas
//  en zonas operativas. Capas: calor (dónde se concentran los pedidos),
//  zonas (color según la presión pedidos/repartidor), calles y repartidores.
//
//  ⚠️ DATOS DE EJEMPLO: las cifras por zona son de prueba mientras no
//  exista el backend. Al conectar la API, reemplazar `ZONAS[].hoy` y los
//  puntos de pedidos por los datos reales (mismo formato).
// =====================================================================
(() => {
  'use strict';

  const LIMA = [181, 219, 46];

  // ---------- Cobertura (mismos polígonos de la web) ----------
  const B = { b5: [4.750, -74.130], b6: [4.725, -74.150], b7: [4.700, -74.180], b8: [4.665, -74.195], b9: [4.630, -74.205], b10: [4.600, -74.200], b11: [4.575, -74.190], b12: [4.545, -74.175] };
  const POLI = {
    bogota: [[4.795, -74.030], [4.805, -74.065], [4.800, -74.100], [4.780, -74.118], B.b5, B.b6, B.b7, B.b8, B.b9, B.b10, B.b11, B.b12, [4.510, -74.150], [4.480, -74.120], [4.470, -74.090], [4.500, -74.065], [4.550, -74.060], [4.600, -74.045], [4.655, -74.035], [4.725, -74.020]],
    funza: [B.b5, B.b6, B.b7, B.b8, [4.655, -74.250], [4.700, -74.262], [4.760, -74.245], [4.768, -74.195], [4.760, -74.160]],
    soacha: [B.b8, B.b9, B.b10, B.b11, B.b12, [4.525, -74.200], [4.520, -74.245], [4.555, -74.285], [4.610, -74.280], [4.655, -74.250]],
  };

  // ---------- Zonas operativas (datos de ejemplo) ----------
  //  hoy: [pedidos, repartidores, minutos promedio, entregados, novedades]
  const ZONAS = [
    { id: 'usaquen',   nombre: 'Usaquén',                 municipio: 'bogota', centro: [4.722, -74.036], hoy: [58, 5, 41, 40, 1] },
    { id: 'suba',      nombre: 'Suba',                    municipio: 'bogota', centro: [4.748, -74.086], hoy: [52, 4, 47, 33, 3] },
    { id: 'chapinero', nombre: 'Chapinero',               municipio: 'bogota', centro: [4.650, -74.057], hoy: [64, 5, 38, 47, 2] },
    { id: 'barrios',   nombre: 'Barrios Unidos',          municipio: 'bogota', centro: [4.672, -74.085], hoy: [34, 3, 36, 26, 1] },
    { id: 'engativa',  nombre: 'Engativá',                municipio: 'bogota', centro: [4.706, -74.116], hoy: [41, 4, 44, 28, 2] },
    { id: 'fontibon',  nombre: 'Fontibón',                municipio: 'bogota', centro: [4.672, -74.150], hoy: [22, 2, 39, 17, 0] },
    { id: 'centro',    nombre: 'Centro · Teusaquillo',    municipio: 'bogota', centro: [4.610, -74.075], hoy: [29, 3, 33, 22, 1] },
    { id: 'puente',    nombre: 'Puente Aranda',           municipio: 'bogota', centro: [4.625, -74.112], hoy: [18, 2, 35, 14, 0] },
    { id: 'kennedy',   nombre: 'Kennedy',                 municipio: 'bogota', centro: [4.628, -74.155], hoy: [46, 3, 52, 27, 4] },
    { id: 'bosa',      nombre: 'Bosa',                    municipio: 'bogota', centro: [4.605, -74.188], hoy: [21, 2, 55, 11, 2] },
    { id: 'sur',       nombre: 'Tunjuelito · C. Bolívar', municipio: 'bogota', centro: [4.565, -74.140], hoy: [14, 2, 58, 8, 1] },
    { id: 'usme',      nombre: 'Usme · San Cristóbal',    municipio: 'bogota', centro: [4.525, -74.100], hoy: [8, 1, 61, 5, 1] },
    { id: 'funza',     nombre: 'Funza',                   municipio: 'funza',  centro: [4.716, -74.214], hoy: [16, 2, 34, 12, 0] },
    { id: 'soacha',    nombre: 'Soacha',                  municipio: 'soacha', centro: [4.585, -74.230], hoy: [27, 2, 57, 15, 2] },
  ];
  const NIVELES = [
    { id: 'caliente', label: 'Caliente', min: 13, color: [181, 219, 46] },
    { id: 'alta', label: 'Alta', min: 10.5, color: [215, 242, 90] },
    { id: 'normal', label: 'Normal', min: 7, color: [169, 155, 255] },
    { id: 'tranquila', label: 'Tranquila', min: 0, color: [110, 98, 200] },
  ];
  const RELLENO = { caliente: 0.2, alta: 0.15, normal: 0.1, tranquila: 0.06 };
  const PEDIDOS_POR_REPARTIDOR = 12;   // capacidad de referencia por día

  // ---------- Utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('es-CO');
  const pip = (la, lo, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  let semilla = 11;
  const rnd = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // Periodo: hoy o últimos 7 días (ejemplo: escala las cifras)
  let periodo = 'hoy';
  function stats(z) {
    const [p, r, t, e, n] = z.hoy;
    const k = periodo === 'hoy' ? 1 : 6.6;
    const pedidos = Math.round(p * k), entregados = Math.round(e * k), novedades = Math.round(n * k);
    const presion = p / r;   // pedidos por repartidor (en el día)
    const nivel = NIVELES.find((x) => presion >= x.min);
    const faltan = Math.max(0, Math.ceil(p / PEDIDOS_POR_REPARTIDOR) - r);
    return { pedidos, repartidores: r, tiempo: t, entregados, novedades, enCurso: Math.max(0, pedidos - entregados - novedades), presion, nivel, faltan };
  }

  // ---------- Calles (mismo archivo compacto de la web) ----------
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
        pts.push([la / 5000, lo / 5000]);
      }
      (tipo === 'A' ? av : ca).push(pts);
    }
    return { av, ca };
  }

  // ---------- Estado de la vista ----------
  const capas = { calor: true, zonas: true, calles: true, repartidores: true };
  let montado = false, canvas, ctx, W = 0, H = 0, DPR = 1;
  let escala = 1, x0 = 0, y0 = 0;
  const LAT = [4.462, 4.812], LON = [-74.292, -74.012];
  const KX = Math.cos(4.64 * Math.PI / 180);
  const CEL = 4;                       // tamaño de celda para pintar zonas (px)
  let celdas = null, cols = 0, filas = 0;
  const base = document.createElement('canvas');     // zonas + calles + etiquetas
  const calor = document.createElement('canvas');    // mapa de calor
  const marco = document.createElement('canvas');    // borde de la zona elegida
  let elegida = null, encima = null;
  let puntos = [];                      // pedidos (lat, lon) para el calor
  let motos = [];                       // repartidores en el mapa

  const aPx = (la, lo) => [x0 + (lo - LON[0]) * KX * escala, y0 + (LAT[1] - la) * escala];
  const aGeo = (x, y) => [LAT[1] - (y - y0) / escala, LON[0] + (x - x0) / (KX * escala)];

  function zonaDe(la, lo) {
    if (pip(la, lo, POLI.funza)) return ZONAS.findIndex((z) => z.id === 'funza');
    if (pip(la, lo, POLI.soacha)) return ZONAS.findIndex((z) => z.id === 'soacha');
    if (!pip(la, lo, POLI.bogota)) return -1;
    let mejor = -1, d = Infinity;
    ZONAS.forEach((z, i) => {
      if (z.municipio !== 'bogota') return;
      const dd = (z.centro[0] - la) ** 2 + ((z.centro[1] - lo) * KX) ** 2;
      if (dd < d) { d = dd; mejor = i; }
    });
    return mejor;
  }

  // ---------- Datos de ejemplo: pedidos y repartidores ----------
  function generar() {
    semilla = 11;
    puntos = []; motos = [];
    // focos comerciales (más pedidos alrededor)
    const focos = [[4.668, -74.054], [4.700, -74.042], [4.755, -74.090], [4.628, -74.150], [4.651, -74.063], [4.587, -74.220]];
    ZONAS.forEach((z, i) => {
      const n = z.hoy[0] * 3;
      for (let k = 0, intentos = 0; k < n && intentos < n * 20; intentos++) {
        const cerca = rnd() < 0.35 ? focos[Math.floor(rnd() * focos.length)] : z.centro;
        const la = cerca[0] + gauss() * 0.011, lo = cerca[1] + gauss() * 0.011;
        if (zonaDe(la, lo) !== i) continue;
        puntos.push([la, lo]); k++;
      }
      for (let k = 0; k < z.hoy[1]; k++) {
        let p = z.centro;
        for (let t = 0; t < 40; t++) {
          const la = z.centro[0] + gauss() * 0.01, lo = z.centro[1] + gauss() * 0.01;
          if (zonaDe(la, lo) === i) { p = [la, lo]; break; }
        }
        motos.push({ zona: i, p: [...p], meta: [...p], fase: rnd() * 6 });
      }
    });
  }

  // ---------- Pintado ----------
  function medir() {
    const r = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const pad = 16;
    escala = Math.min((W - pad * 2) / ((LON[1] - LON[0]) * KX), (H - pad * 2) / (LAT[1] - LAT[0]));
    x0 = (W - (LON[1] - LON[0]) * KX * escala) / 2;
    y0 = (H - (LAT[1] - LAT[0]) * escala) / 2;
    // celdas: a qué zona pertenece cada cuadrito del lienzo
    cols = Math.ceil(W / CEL); filas = Math.ceil(H / CEL);
    celdas = new Int8Array(cols * filas);
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const [la, lo] = aGeo(c * CEL + CEL / 2, f * CEL + CEL / 2);
      celdas[f * cols + c] = la < LAT[0] || la > LAT[1] ? -1 : zonaDe(la, lo);
    }
    pintarBase(); pintarCalor(); pintarMarco();
  }

  function nuevaCapa(cv) {
    cv.width = canvas.width; cv.height = canvas.height;
    const c = cv.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    return c;
  }

  function pintarBase() {
    const c = nuevaCapa(base);
    const st = ZONAS.map(stats);
    // relleno de cada zona según su nivel
    if (capas.zonas) {
      for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
        const z = celdas[f * cols + k];
        if (z < 0) continue;
        c.fillStyle = `rgba(150,135,255,${RELLENO[st[z].nivel.id]})`;
        c.fillRect(k * CEL, f * CEL, CEL, CEL);
      }
    } else {
      c.fillStyle = 'rgba(169,155,255,.06)';
      for (let i = 0; i < celdas.length; i++) if (celdas[i] >= 0) c.fillRect((i % cols) * CEL, ((i / cols) | 0) * CEL, CEL, CEL);
    }
    // calles reales
    if (capas.calles && calles) {
      const trazo = (lista) => {
        c.beginPath();
        for (const pts of lista) pts.forEach(([la, lo], i) => { const [x, y] = aPx(la, lo); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.stroke();
      };
      c.lineJoin = 'round';
      c.strokeStyle = 'rgba(200,190,255,.16)'; c.lineWidth = 0.6; trazo(calles.ca);
      c.strokeStyle = 'rgba(220,214,255,.34)'; c.lineWidth = 1.1; trazo(calles.av);
    }
    // bordes entre zonas
    c.fillStyle = 'rgba(231,228,250,.32)';
    for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
      const z = celdas[f * cols + k];
      const der = k + 1 < cols ? celdas[f * cols + k + 1] : -1, aba = f + 1 < filas ? celdas[(f + 1) * cols + k] : -1;
      if (z !== der && (z >= 0 || der >= 0)) c.fillRect((k + 1) * CEL - 0.5, f * CEL, 1, CEL);
      if (z !== aba && (z >= 0 || aba >= 0)) c.fillRect(k * CEL, (f + 1) * CEL - 0.5, CEL, 1);
    }
    pintarNombres();
  }

  const nombres = document.createElement('canvas');   // nombres de zona (encima del calor)
  function pintarNombres() {
    const c = nuevaCapa(nombres);
    const st = ZONAS.map(stats);
    const fs = Math.max(10, Math.min(12.5, W / 70));
    c.font = `600 ${fs}px Inter, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    ZONAS.forEach((z, i) => {
      const [x, y] = aPx(...z.centro);
      const nombre = z.nombre.split(' · ')[0];
      const w = c.measureText(nombre).width + 14;
      c.fillStyle = 'rgba(11,8,38,.72)';
      c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 10, w, 20, 10) : c.rect(x - w / 2, y - 10, w, 20); c.fill();
      c.fillStyle = st[i].nivel.id === 'caliente' ? `rgb(${LIMA})` : '#E7E4FA';
      c.fillText(nombre, x, y + 0.5);
    });
  }

  // Mapa de calor: se suma la intensidad de cada pedido y se colorea
  function pintarCalor() {
    const c = nuevaCapa(calor);
    if (!capas.calor) return;
    const rad = Math.max(14, escala * 0.012);
    const sello = document.createElement('canvas');
    sello.width = sello.height = Math.ceil(rad * 2 * DPR);
    const s = sello.getContext('2d'), g = s.createRadialGradient(sello.width / 2, sello.width / 2, 0, sello.width / 2, sello.width / 2, sello.width / 2);
    g.addColorStop(0, 'rgba(0,0,0,.075)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    s.fillStyle = g; s.fillRect(0, 0, sello.width, sello.width);
    for (const [la, lo] of puntos) { const [x, y] = aPx(la, lo); c.drawImage(sello, x - rad, y - rad, rad * 2, rad * 2); }
    // colorear: índigo -> lavanda -> lima -> blanco lima
    const img = c.getImageData(0, 0, calor.width, calor.height), d = img.data;
    const paleta = [[0, [52, 34, 168, 0]], [0.2, [110, 98, 220, 70]], [0.45, [169, 155, 255, 130]], [0.72, [181, 219, 46, 175]], [1, [236, 252, 170, 220]]];
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i] / 255;
      if (!a) continue;
      const v = Math.min(1, a * 1.15);
      let j = 1; while (j < paleta.length - 1 && v > paleta[j][0]) j++;
      const [t0, c0] = paleta[j - 1], [t1, c1] = paleta[j], u = (v - t0) / (t1 - t0 || 1);
      d[i - 3] = c0[0] + (c1[0] - c0[0]) * u; d[i - 2] = c0[1] + (c1[1] - c0[1]) * u; d[i - 1] = c0[2] + (c1[2] - c0[2]) * u; d[i] = c0[3] + (c1[3] - c0[3]) * u;
    }
    c.putImageData(img, 0, 0);
  }

  // Borde lima alrededor de la zona elegida
  function pintarMarco() {
    const c = nuevaCapa(marco);
    const z = elegida;
    if (z === null) return;
    c.fillStyle = 'rgba(181,219,46,.12)';
    for (let i = 0; i < celdas.length; i++) if (celdas[i] === z) c.fillRect((i % cols) * CEL, ((i / cols) | 0) * CEL, CEL, CEL);
    c.fillStyle = `rgb(${LIMA})`;
    for (let f = 0; f < filas; f++) for (let k = 0; k < cols; k++) {
      const a = celdas[f * cols + k] === z;
      const der = k + 1 < cols && celdas[f * cols + k + 1] === z, aba = f + 1 < filas && celdas[(f + 1) * cols + k] === z;
      if (a !== der) c.fillRect((k + 1) * CEL - 1, f * CEL, 2, CEL);
      if (a !== aba) c.fillRect(k * CEL, (f + 1) * CEL - 1, CEL, 2);
    }
  }

  function cuadro(ms) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, W, H);
    if (capas.calor) ctx.drawImage(calor, 0, 0, W, H);
    ctx.drawImage(marco, 0, 0, W, H);
    if (capas.repartidores) {
      const t = ms / 1000;
      for (const m of motos) {
        // se mueve despacio hacia un punto cercano de su zona
        m.p[0] += (m.meta[0] - m.p[0]) * 0.008; m.p[1] += (m.meta[1] - m.p[1]) * 0.008;
        if (Math.abs(m.meta[0] - m.p[0]) + Math.abs(m.meta[1] - m.p[1]) < 0.0006) {
          const z = ZONAS[m.zona];
          for (let k = 0; k < 10; k++) {
            const la = m.p[0] + gauss() * 0.008, lo = m.p[1] + gauss() * 0.008;
            if (zonaDe(la, lo) === m.zona && Math.hypot(la - z.centro[0], lo - z.centro[1]) < 0.03) { m.meta = [la, lo]; break; }
          }
        }
        const [x, y] = aPx(...m.p), k = (t * 0.6 + m.fase) % 1;
        ctx.strokeStyle = `rgba(${LIMA},${0.55 * (1 - k)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, 4 + k * 10, 0, 7); ctx.stroke();
        ctx.fillStyle = '#12092E'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.fillStyle = `rgb(${LIMA})`; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
      }
    }
    ctx.drawImage(nombres, 0, 0, W, H);   // nombres siempre encima
  }

  // ---------- Panel lateral ----------
  function nivelPill(n) { return `<span class="mz-nivel" data-nivel="${n.id}">${n.label}</span>`; }

  function pintarResumen() {
    const st = ZONAS.map(stats);
    const total = st.reduce((s, x) => s + x.pedidos, 0);
    const motosN = st.reduce((s, x) => s + x.repartidores, 0);
    const calientes = ZONAS.filter((_, i) => st[i].nivel.id === 'caliente');
    const faltan = st.reduce((s, x) => s + x.faltan, 0);
    const top = ZONAS[st.indexOf(st.reduce((a, b) => (b.presion > a.presion ? b : a)))];
    $('#mz-kpis').innerHTML = `
      <div class="kpi kpi-hero"><span class="kpi-label">Zona más caliente</span><span class="kpi-value mz-top">${esc(top.nombre.split(' · ')[0])}</span><span class="kpi-foot">${stats(top).presion.toFixed(1)} pedidos por repartidor</span></div>
      <div class="kpi"><span class="kpi-label">Pedidos ${periodo === 'hoy' ? 'hoy' : '7 días'}</span><span class="kpi-value">${fmt(total)}</span><span class="kpi-foot">en ${ZONAS.length} zonas</span></div>
      <div class="kpi"><span class="kpi-label">Repartidores en calle</span><span class="kpi-value">${motosN}</span><span class="kpi-foot">${(total / motosN / (periodo === 'hoy' ? 1 : 6.6)).toFixed(1)} pedidos c/u al día</span></div>
      <div class="kpi"><span class="kpi-label">Zonas calientes</span><span class="kpi-value">${calientes.length}</span><span class="kpi-foot">${faltan ? `faltan ${faltan} repartidores` : 'capacidad suficiente'}</span></div>`;
  }

  function pintarLista() {
    const st = ZONAS.map(stats);
    const orden = ZONAS.map((z, i) => i).sort((a, b) => st[b].presion - st[a].presion);
    const max = Math.max(...st.map((x) => x.presion));
    $('#mz-lista').innerHTML = orden.map((i) => {
      const z = ZONAS[i], s = st[i];
      return `<li><button type="button" class="mz-fila${elegida === i ? ' activa' : ''}" data-zona="${i}" aria-pressed="${elegida === i}">
        <span class="mz-fila-top"><b>${esc(z.nombre)}</b>${nivelPill(s.nivel)}</span>
        <span class="mz-barra"><i style="--w:${(s.presion / max) * 100}%" data-nivel="${s.nivel.id}"></i></span>
        <span class="mz-fila-datos"><span>${fmt(s.pedidos)} pedidos</span><span>${s.repartidores} repartidores</span><span>${s.tiempo} min</span></span>
      </button></li>`;
    }).join('');
  }

  function pintarDetalle() {
    const box = $('#mz-detalle');
    if (elegida === null) {
      box.innerHTML = `<p class="mz-vacio">Toca una zona en el mapa o en la lista para ver su detalle.</p>`;
      return;
    }
    const z = ZONAS[elegida], s = stats(z);
    const pct = s.pedidos ? Math.round((s.entregados / s.pedidos) * 100) : 0;
    const consejo = s.faltan
      ? `<p class="mz-consejo alerta"><b>Faltan ${s.faltan} repartidor${s.faltan > 1 ? 'es' : ''}</b> para atender la demanda con holgura (${PEDIDOS_POR_REPARTIDOR} pedidos por repartidor al día).</p>`
      : `<p class="mz-consejo">Capacidad suficiente: ${s.presion.toFixed(1)} pedidos por repartidor.</p>`;
    box.innerHTML = `
      <header class="mz-det-cab"><div><small>${z.municipio === 'bogota' ? 'Bogotá' : z.municipio === 'funza' ? 'Funza, Cundinamarca' : 'Soacha, Cundinamarca'}</small><h3>${esc(z.nombre)}</h3></div>${nivelPill(s.nivel)}
        <button type="button" class="mz-cerrar" data-zona="cerrar" aria-label="Cerrar detalle">×</button></header>
      <dl class="mz-det-datos">
        <div><dt>Pedidos</dt><dd>${fmt(s.pedidos)}</dd></div>
        <div><dt>Entregados</dt><dd>${pct}%</dd></div>
        <div><dt>En curso</dt><dd>${fmt(s.enCurso)}</dd></div>
        <div><dt>Repartidores</dt><dd>${s.repartidores}</dd></div>
        <div><dt>Tiempo prom.</dt><dd>${s.tiempo}<small> min</small></dd></div>
        <div><dt>Novedades</dt><dd>${fmt(s.novedades)}</dd></div>
      </dl>
      <div class="mz-progreso"><span>Entregados</span><span class="mz-barra"><i style="--w:${pct}%" data-nivel="caliente"></i></span></div>
      ${consejo}`;
  }

  function elegir(i) {
    elegida = i === elegida ? null : i;
    pintarMarco(); pintarLista(); pintarDetalle();
  }

  // ---------- Montaje ----------
  let raf = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function bucle(now) {
    if (!canvas.isConnected || canvas.offsetParent === null || document.hidden) { raf = 0; return; }
    cuadro(now);
    raf = reduce ? 0 : requestAnimationFrame(bucle);
  }
  const arrancar = () => { if (!raf) raf = requestAnimationFrame(bucle); };

  function montar() {
    if (!montado) {
      montado = true;
      canvas = $('#mz-mapa'); ctx = canvas.getContext('2d');
      generar();
      new ResizeObserver(() => { if (canvas.offsetParent !== null) { medir(); arrancar(); } }).observe(canvas);
      document.addEventListener('visibilitychange', arrancar);
      fetch('../Scripts/bogota-calles.txt?v=1').then((r) => (r.ok ? r.text() : Promise.reject()))
        .then((t) => { calles = leerCalles(t); if (W) pintarBase(); })
        .catch(() => { /* sin calles: el mapa sigue con zonas y calor */ });

      // capas
      $('#mz-capas').addEventListener('click', (e) => {
        const b = e.target.closest('[data-capa]'); if (!b) return;
        capas[b.dataset.capa] = !capas[b.dataset.capa];
        b.setAttribute('aria-pressed', capas[b.dataset.capa]);
        if (b.dataset.capa === 'calor') pintarCalor(); else pintarBase();
        arrancar();
      });
      // periodo
      $('#mz-periodo').addEventListener('click', (e) => {
        const b = e.target.closest('[data-periodo]'); if (!b) return;
        periodo = b.dataset.periodo;
        $('#mz-periodo').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
        pintarResumen(); pintarLista(); pintarDetalle();
      });
      // elegir zona desde la lista o el detalle
      document.querySelector('#view-mapa').addEventListener('click', (e) => {
        const b = e.target.closest('[data-zona]'); if (!b || b.closest('#mz-capas')) return;
        if (b.dataset.zona === 'cerrar') { elegida = null; pintarMarco(); pintarLista(); pintarDetalle(); return; }
        elegir(Number(b.dataset.zona));
      });
      // elegir y señalar zona en el mapa
      const zonaEn = (e) => {
        const r = canvas.getBoundingClientRect();
        const k = Math.floor((e.clientX - r.left) / CEL), f = Math.floor((e.clientY - r.top) / CEL);
        return k >= 0 && f >= 0 && k < cols && f < filas ? celdas[f * cols + k] : -1;
      };
      const tip = $('#mz-tip');
      canvas.addEventListener('pointermove', (e) => {
        const z = zonaEn(e);
        canvas.style.cursor = z >= 0 ? 'pointer' : 'default';
        if (z < 0) { tip.hidden = true; encima = null; return; }
        if (z !== encima) {
          encima = z;
          const s = stats(ZONAS[z]);
          tip.innerHTML = `<b>${esc(ZONAS[z].nombre)}</b><span>${fmt(s.pedidos)} pedidos · ${s.repartidores} repartidores</span>`;
        }
        const r = canvas.getBoundingClientRect();
        tip.hidden = false;
        tip.style.transform = `translate(${Math.min(e.clientX - r.left + 14, r.width - 200)}px, ${e.clientY - r.top + 14}px)`;
      });
      canvas.addEventListener('pointerleave', () => { tip.hidden = true; encima = null; });
      canvas.addEventListener('click', (e) => { const z = zonaEn(e); if (z >= 0) elegir(z); });
    }
    pintarResumen(); pintarLista(); pintarDetalle();
    requestAnimationFrame(() => { medir(); arrancar(); });
  }

  window.LEMapa = { montar };
})();
