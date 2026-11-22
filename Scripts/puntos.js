// =====================================================================
//  LoEntrego · Fondo de puntos (canvas, sin librerías)
//
//  Una trama plana de puntos. Dentro de nuestras zonas (Bogotá, Funza y
//  Soacha) los puntos brillan más, así la ciudad se lee solo con puntos.
//  Las entregas son puntos lima que avanzan por la trama, de cruce en
//  cruce, y al llegar sueltan una onda.
//
//  Opciones en el <canvas>:
//    data-zona="0.5,0.5,0.9"  centro (x, y) y tamaño de la ciudad, en
//                             fracciones del lienzo (tamaño = alto ocupado)
//  Liviano: la trama se dibuja una vez; por cuadro solo se mueven las
//  entregas. Se pausa fuera de pantalla y respeta "movimiento reducido".
// =====================================================================
(() => {
  'use strict';
  const canvas = document.getElementById('puntos');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const LIMA = '181, 219, 46';
  const PASO = 14;            // separación de la trama (px)
  const ENTREGAS = 14;        // entregas simultáneas
  const [ZX, ZY, ZS] = (canvas.dataset.zona || '0.5,0.5,0.9').split(',').map(Number);

  // Zonas de cobertura (mismas coordenadas que el mapa de la web)
  const B = { b5: [4.750, -74.130], b6: [4.725, -74.150], b7: [4.700, -74.180], b8: [4.665, -74.195], b9: [4.630, -74.205], b10: [4.600, -74.200], b11: [4.575, -74.190], b12: [4.545, -74.175] };
  const ZONAS = [
    [[4.795, -74.030], [4.805, -74.065], [4.800, -74.100], [4.780, -74.118], B.b5, B.b6, B.b7, B.b8, B.b9, B.b10, B.b11, B.b12, [4.510, -74.150], [4.480, -74.120], [4.470, -74.090], [4.500, -74.065], [4.550, -74.060], [4.600, -74.045], [4.655, -74.035], [4.725, -74.020]],
    [B.b5, B.b6, B.b7, B.b8, [4.655, -74.250], [4.700, -74.262], [4.760, -74.245], [4.768, -74.195], [4.760, -74.160]],
    [B.b8, B.b9, B.b10, B.b11, B.b12, [4.525, -74.200], [4.520, -74.245], [4.555, -74.285], [4.610, -74.280], [4.655, -74.250]],
  ];
  const pip = (la, lo, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i], [yj, xj] = poly[j];
      if ((yi > la) !== (yj > la) && lo < (xj - xi) * (la - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const LAT = [4.465, 4.81], LON = [-74.29, -74.015];   // caja de las zonas

  let W = 0, H = 0, DPR = 1, cols = 0, filas = 0, ox = 0, oy = 0;
  let ciudad = new Uint8Array(0);          // 1 = punto dentro de la ciudad
  let celdas = [];                         // índices de puntos de la ciudad
  const capa = document.createElement('canvas');

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight, d = Math.min(window.devicePixelRatio || 1, 2);
    if (w === W && h === H && d === DPR) return;
    W = w; H = h; DPR = d;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols = Math.ceil(W / PASO) + 1; filas = Math.ceil(H / PASO) + 1;
    ox = ((W - (cols - 1) * PASO) / 2); oy = ((H - (filas - 1) * PASO) / 2);

    // La ciudad, escalada para ocupar ZS del alto (o del ancho si no cabe)
    const kLat = (LAT[1] - LAT[0]), kLon = (LON[1] - LON[0]);
    const alto = Math.min(H * ZS, W * 0.95 * kLat / kLon);
    const ancho = alto * kLon / kLat;
    const x0 = W * ZX - ancho / 2, y0 = H * ZY - alto / 2;
    ciudad = new Uint8Array(cols * filas); celdas = [];
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const x = ox + c * PASO, y = oy + f * PASO;
      const lo = LON[0] + ((x - x0) / ancho) * kLon, la = LAT[1] - ((y - y0) / alto) * kLat;
      if (la < LAT[0] || la > LAT[1] || lo < LON[0] || lo > LON[1]) continue;
      if (ZONAS.some((z) => pip(la, lo, z))) { ciudad[f * cols + c] = 1; celdas.push(f * cols + c); }
    }

    // Trama fija
    capa.width = canvas.width; capa.height = canvas.height;
    const g = capa.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const dentro = ciudad[f * cols + c];
      g.fillStyle = dentro ? 'rgba(225, 220, 255, 0.5)' : 'rgba(225, 220, 255, 0.09)';
      const r = dentro ? 1.1 : 0.8;
      g.fillRect(ox + c * PASO - r, oy + f * PASO - r, r * 2, r * 2);
    }
    entregas = [];
    if (reduce) dibuja(0);
  }

  // ---------- Entregas: caminos de cruce en cruce dentro de la ciudad ----------
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function nueva(t) {
    if (!celdas.length) return null;
    let i = celdas[Math.floor(rnd() * celdas.length)];
    let c = i % cols, f = (i / cols) | 0;
    const camino = [[c, f]];
    let d = DIRS[Math.floor(rnd() * 4)];
    const largo = 8 + Math.floor(rnd() * 18);
    for (let k = 0; k < largo; k++) {
      if (rnd() < 0.22) d = DIRS[Math.floor(rnd() * 4)];               // a veces gira
      let nc = c + d[0], nf = f + d[1];
      if (nc < 0 || nf < 0 || nc >= cols || nf >= filas || !ciudad[nf * cols + nc]) {
        d = DIRS[Math.floor(rnd() * 4)]; continue;                       // borde de la ciudad: otra dirección
      }
      if (camino.length > 1) { const [pc, pf] = camino[camino.length - 2]; if (pc === nc && pf === nf) continue; }
      c = nc; f = nf; camino.push([c, f]);
    }
    if (camino.length < 4) return nueva(t);
    return { camino, t0: t + rnd() * 2, vel: 5 + rnd() * 4 };            // puntos por segundo
  }
  let entregas = [];
  const ondas = [];

  function dibuja(ms) {
    const t = ms / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(capa, 0, 0, W, H);
    while (entregas.length < ENTREGAS && celdas.length) entregas.push(nueva(t));
    const COLA = 6;
    entregas = entregas.filter((e) => {
      const n = e.camino.length - 1;
      const cab = (t - e.t0) * e.vel;            // posición continua de la cabeza
      if (cab < 0) return true;
      if (cab > n + COLA) return false;
      if (cab >= n && !e.llego) { e.llego = true; ondas.push({ p: e.camino[n], t }); }
      // la cola enciende los puntos por donde pasó
      for (let k = Math.max(0, Math.ceil(cab - COLA)); k <= Math.min(n, Math.floor(cab)); k++) {
        const a = 1 - (cab - k) / COLA;
        const [c, f] = e.camino[k];
        ctx.fillStyle = `rgba(${LIMA},${(a * 0.9).toFixed(3)})`;
        const r = 1.2 + a * 1.1;
        ctx.fillRect(ox + c * PASO - r, oy + f * PASO - r, r * 2, r * 2);
      }
      // la cabeza se desliza entre puntos (fluido, sin saltos)
      if (cab < n) {
        const k = Math.floor(cab), u = cab - k, [c1, f1] = e.camino[k], [c2, f2] = e.camino[k + 1];
        const x = ox + (c1 + (c2 - c1) * u) * PASO, y = oy + (f1 + (f2 - f1) * u) * PASO;
        ctx.fillStyle = `rgba(${LIMA},.25)`; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.fillStyle = `rgb(${LIMA})`; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill();
      }
      return true;
    });
    for (let i = ondas.length - 1; i >= 0; i--) {
      const o = ondas[i], k = (t - o.t) / 1.2;
      if (k > 1) { ondas.splice(i, 1); continue; }
      const x = ox + o.p[0] * PASO, y = oy + o.p[1] * PASO;
      ctx.strokeStyle = `rgba(${LIMA},${(0.8 * (1 - k)).toFixed(3)})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 3 + k * 14, 0, 7); ctx.stroke();
    }
  }

  // ---------- Bucle ----------
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let visible = true, raf = 0;
  const inicio = performance.now();
  const loop = (now) => { dibuja(now - inicio); raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0; };
  const kick = () => { if (!raf && visible && !document.hidden && !reduce) raf = requestAnimationFrame(loop); };
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  resize();
  kick();
})();
