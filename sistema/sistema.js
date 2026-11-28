// =====================================================================
//  LoEntrego · Panel de sistema (aparte del panel de operación)
//
//  Lee y cambia el servidor a través de la API, nunca directo:
//    GET  /api/sistema/estado                  servidor, servicios, sitios, recursos, respaldo, certificados
//    GET  /api/sistema/recursos?rango=5m|24h   serie de CPU, RAM y red
//    GET  /api/sistema/canales · PUT /api/sistema/canales                (tabla estado_canales)
//    PUT  /api/sistema/sitios/:sitio/mantenimiento { activo }            (archivo /srv/loentrego/mantenimiento/:sitio.on)
//    GET  /api/sistema/mantenimientos · POST · DELETE /:id                (tabla mantenimientos)
//    GET  /api/sistema/nginx · PUT /api/sistema/nginx/:archivo { habilitado }
//    POST /api/sistema/nginx/probar (nginx -t) · POST /api/sistema/nginx/aplicar (probar + recargar)
//    GET  /api/sistema/respaldos · POST /api/sistema/respaldos            (vps/respaldo.sh)
//    GET  /api/sistema/seguridad · DELETE /api/sistema/bloqueos/:ip      (intentos_ingreso, fail2ban, errores 5xx)
//  Mientras no hay backend: sin datos, o "datos de ejemplo" si se pide (guardados solo en este navegador).
// =====================================================================
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 0) => Number(n).toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d });
  const bytes = (b) => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (b >= 1024 && i < 4) { b /= 1024; i++; } return `${fmt(b, i > 1 ? 1 : 0)} ${u[i]}`; };
  const red = (kbps) => (kbps >= 1000 ? `${fmt(kbps / 1000, 1)} Mb/s` : `${fmt(kbps)} kb/s`);
  const fecha = (iso, conHora = true) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', ...(conHora ? { hour: '2-digit', minute: '2-digit' } : {}) });
  const hace = (iso) => {
    const s = Math.round((Date.now() - new Date(iso)) / 1000);
    if (s < 60) return 'hace un momento'; if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`; return `hace ${Math.round(s / 86400)} días`;
  };
  const duracion = (s) => { const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60); return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`; };
  const dias = (iso) => Math.ceil((new Date(iso) - Date.now()) / 86400000);

  // ---------------- Fuente de datos: API real, ejemplo o nada ----------------
  const K_EJ = 'loentrego-sistema-ejemplo', K_DATOS = 'loentrego-sistema-ejemplo-datos';
  let fuente = 'buscando';   // 'api' | 'ejemplo' | 'sin'
  let datos = null;          // último /estado

  async function pedir(metodo, ruta, cuerpo) {
    if (fuente === 'ejemplo') return Ejemplo.responder(metodo, ruta, cuerpo);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await fetch(ruta, { method: metodo, signal: ctl.signal, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('loentrego-sistema-token')}` },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      if (r.status === 401) { salir(); throw new Error('Sesión vencida'); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.mensaje || `Error ${r.status}`);
      return j;
    } finally { clearTimeout(t); }
  }

  // ---------------- Datos de ejemplo (solo para ver el panel sin servidor) ----------------
  const Ejemplo = (() => {
    const ahora = Date.now(), min = 60000, h = 60 * min, d = 24 * h;
    const iso = (ms) => new Date(ms).toISOString();
    const base = () => ({
      canales: [
        { canal: 'App LoEntrego', estado: 'ok', texto: 'Activa', orden: 1 },
        { canal: 'Página web', estado: 'ok', texto: 'Activa', orden: 2 },
        { canal: 'Operación', estado: 'ok', texto: 'Funcionando', orden: 3 },
        { canal: 'Atención', estado: 'ok', texto: 'Correo activo', orden: 4 },
      ],
      sitiosMant: { web: false, app: false, admin: false },
      mantenimientos: [],
      nginx: [
        { archivo: 'loentrego.conf', habilitado: true, aplicado: true, dominios: ['loentrego.com', 'www.loentrego.com', 'app.loentrego.com', 'admin.loentrego.com'] },
        { archivo: 'sistema.conf', habilitado: true, aplicado: true, dominios: ['sistema.loentrego.com'] },
        { archivo: 'default', habilitado: false, aplicado: true, dominios: ['_ (cualquier otro)'] },
      ],
      respaldos: Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, fecha: iso(ahora - (i * d) - 6 * h), bytes: 38e6 - i * 9e5, segundos: 41 + (i % 3) * 6, ok: true })),
      bloqueadas: [{ ip: '185.220.101.4', motivo: 'Muchos intentos por SSH', hasta: iso(ahora + 50 * min) }, { ip: '45.148.10.62', motivo: 'Muchos intentos en /api/login', hasta: iso(ahora + 3 * h) }],
    });
    let s;
    try { s = JSON.parse(localStorage.getItem(K_DATOS)) || base(); } catch { s = base(); }
    const guardar = () => { try { localStorage.setItem(K_DATOS, JSON.stringify(s)); } catch { /* */ } };

    // Recursos que se mueven un poco (paseo aleatorio)
    let r = { cpu: 18, ram: 46, rx: 320, tx: 140 };
    const mover = (v, lo, hi, paso) => Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * paso));
    const serie5m = Array.from({ length: 60 }, (_, i) => { r = { cpu: mover(r.cpu, 4, 85, 12), ram: mover(r.ram, 38, 70, 2), rx: mover(r.rx, 40, 1800, 220), tx: mover(r.tx, 20, 900, 120) }; return { t: iso(ahora - (59 - i) * 5000), ...r }; });
    const serie24h = Array.from({ length: 48 }, (_, i) => { const hora = new Date(ahora - (47 - i) * 30 * min).getHours(); const carga = hora >= 8 && hora <= 18 ? 1 : 0.35; return { t: iso(ahora - (47 - i) * 30 * min), cpu: 6 + carga * 30 + Math.random() * 10, ram: 42 + carga * 14 + Math.random() * 4, rx: 80 + carga * 900 + Math.random() * 200, tx: 40 + carga * 420 + Math.random() * 90 }; });
    function tic() { r = { cpu: mover(r.cpu, 4, 85, 12), ram: mover(r.ram, 38, 70, 2), rx: mover(r.rx, 40, 1800, 220), tx: mover(r.tx, 20, 900, 120) }; serie5m.push({ t: iso(Date.now()), ...r }); serie5m.shift(); }

    function estado() {
      return {
        servidor: { nombre: 'loentrego-vps', so: 'Ubuntu 24.04 LTS', vcpu: 2, uptime_s: 19 * 86400 + 6 * 3600 + 1200 },
        servicios: [
          { id: 'nginx', nombre: 'Nginx', version: '1.24', activo: true, desde: iso(ahora - 19 * d), nota: 'Sirve los sitios y pasa /api' },
          { id: 'api', nombre: 'API LoEntrego', version: 'Node 22', activo: true, desde: iso(ahora - 2 * d - 3 * h), nota: 'Puerto 3000 · systemd' },
          { id: 'postgresql', nombre: 'PostgreSQL', version: '16 + PostGIS', activo: true, desde: iso(ahora - 19 * d), nota: 'Solo localhost' },
          { id: 'redis', nombre: 'Redis', version: '7', activo: true, desde: iso(ahora - 19 * d), nota: 'Límites de intentos' },
          { id: 'fail2ban', nombre: 'fail2ban', version: '1.0', activo: true, desde: iso(ahora - 19 * d), nota: 'Bloquea IPs que insisten' },
        ],
        sitios: ['web', 'app', 'admin'].map((k) => ({ id: k, dominio: { web: 'loentrego.com', app: 'app.loentrego.com', admin: 'admin.loentrego.com' }[k],
          http: s.sitiosMant[k] ? 503 : 200, ms: 90 + Math.round(Math.random() * 120), mantenimiento: s.sitiosMant[k] })),
        recursos: { cpu: r.cpu, ram_usada: r.ram / 100 * 4 * 1024 ** 3, ram_total: 4 * 1024 ** 3, disco_usado: 31.6 * 1024 ** 3, disco_total: 100 * 1024 ** 3,
          carga: [r.cpu / 50, r.cpu / 55 + 0.1, 0.42], red_rx: r.rx, red_tx: r.tx, pg_conexiones: 7, pg_max: 100 },
        respaldo: s.respaldos[0],
        certificados: [{ dominio: 'loentrego.com', vence: iso(ahora + 71 * d) }, { dominio: 'app.loentrego.com', vence: iso(ahora + 71 * d) }, { dominio: 'admin.loentrego.com', vence: iso(ahora + 71 * d) }, { dominio: 'sistema.loentrego.com', vence: iso(ahora + 12 * d) }],
      };
    }
    const contenido = {
      'loentrego.conf': '# Los 3 sitios: web, app y admin\nserver {\n  listen 80;\n  server_name loentrego.com www.loentrego.com;\n  root /srv/loentrego/www/web;\n  include /etc/nginx/snippets/loentrego-comun.conf;\n  location / {\n    if (-f /srv/loentrego/mantenimiento/web.on) { return 503; }\n    try_files $uri $uri/ =404;\n  }\n}\n# … app.loentrego.com y admin.loentrego.com (ver backend_loentrego/nginx/loentrego.conf)',
      'sistema.conf': '# Panel de sistema: solo desde IPs permitidas\nserver {\n  listen 80;\n  server_name sistema.loentrego.com;\n  root /srv/loentrego/www/admin/sistema;\n  allow 190.0.0.0/8;   # ← IP de la oficina\n  deny all;\n  include /etc/nginx/snippets/loentrego-api.conf;\n}',
      default: '# Sitio por defecto de Nginx (página "Welcome to nginx")\nserver {\n  listen 80 default_server;\n  root /var/www/html;\n}',
    };

    async function responder(m, ruta, b) {
      await new Promise((ok) => setTimeout(ok, 250));
      const [, , , rec, id, extra] = ruta.split('?')[0].split('/');   // /api/sistema/<rec>/<id>/<extra>
      if (rec === 'estado') return estado();
      if (rec === 'recursos') return { puntos: ruta.includes('24h') ? serie24h : serie5m };
      if (rec === 'canales') { if (m === 'PUT') { s.canales = b.canales; guardar(); } return { canales: s.canales }; }
      if (rec === 'sitios' && extra === 'mantenimiento') { s.sitiosMant[id] = !!b.activo; guardar(); return { ok: true }; }
      if (rec === 'mantenimientos') {
        if (m === 'POST') { s.mantenimientos.push({ id: 'm' + Date.now(), ...b, creado: iso(Date.now()) }); guardar(); }
        if (m === 'DELETE') { s.mantenimientos = s.mantenimientos.filter((x) => x.id !== id); guardar(); }
        return { mantenimientos: s.mantenimientos };
      }
      if (rec === 'nginx') {
        if (m === 'PUT') { const x = s.nginx.find((n) => n.archivo === id); x.habilitado = !!b.habilitado; x.aplicado = false; guardar(); }
        if (id === 'probar' || id === 'aplicar') {
          const salida = 'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful';
          if (id === 'aplicar') { s.nginx.forEach((n) => { n.aplicado = true; }); guardar(); }
          return { ok: true, salida: id === 'aplicar' ? salida + '\nNginx recargado sin cortar conexiones.' : salida };
        }
        return { sitios: s.nginx.map((n) => ({ ...n, contenido: contenido[n.archivo] || '' })) };
      }
      if (rec === 'respaldos') {
        if (m === 'POST') { s.respaldos.unshift({ id: 'r' + Date.now(), fecha: iso(Date.now()), bytes: s.respaldos[0].bytes + 2e5, segundos: 44, ok: true }); s.respaldos = s.respaldos.slice(0, 14); guardar(); }
        return { respaldos: s.respaldos, destino: 'Copia cifrada fuera del VPS', retencion_dias: 14 };
      }
      if (rec === 'bloqueos' && m === 'DELETE') { s.bloqueadas = s.bloqueadas.filter((x) => x.ip !== decodeURIComponent(id)); guardar(); return { ok: true }; }
      if (rec === 'seguridad') {
        return {
          intentos: [
            { usuario: 'admin', ip: '45.148.10.62', cuando: iso(ahora - 12 * min), veces: 9 },
            { usuario: 'demo', ip: '181.51.32.9', cuando: iso(ahora - 2 * h), veces: 2 },
            { usuario: 'root', ip: '185.220.101.4', cuando: iso(ahora - 5 * h), veces: 14 },
          ],
          bloqueadas: s.bloqueadas,
          errores: [
            { cuando: iso(ahora - 26 * min), codigo: 502, ruta: 'POST /api/pedidos', detalle: 'La API no respondió (se reinició)' },
            { cuando: iso(ahora - 3 * h), codigo: 500, ruta: 'GET /api/admin/resumen?periodo=1a', detalle: 'Tiempo de espera de la base' },
          ],
        };
      }
      throw new Error('Ruta de ejemplo desconocida: ' + ruta);
    }
    return { responder, tic, borrar: () => { localStorage.removeItem(K_DATOS); } };
  })();

  // ---------------- Interfaz común ----------------
  function toast(msg, tipo = 'ok') {
    const t = $('#toast'); t.textContent = msg; t.dataset.tipo = tipo; t.classList.add('ver');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('ver'), 2800);
  }
  function confirmar(titulo, html, textoSi = 'Confirmar', peligro = false) {
    const d = $('#dialogo');
    $('#dlg-titulo').textContent = titulo; $('#dlg-texto').innerHTML = html;
    const si = $('#dlg-si'); si.textContent = textoSi; si.classList.toggle('peligro', peligro);
    d.showModal();
    return new Promise((ok) => d.addEventListener('close', () => ok(d.returnValue === 'si'), { once: true }));
  }
  const vacio = (txt) => `<div class="vacio"><span class="vacio-ico" aria-hidden="true"></span><p>${txt}</p></div>`;
  const sinDatos = () => vacio('Sin conexión con el servidor. Cuando exista el backend, aquí aparecerán los datos reales.');
  const medidor = (pct, color) => `<span class="medidor" style="--p:${Math.max(0, Math.min(100, pct)).toFixed(1)};--c:${color}"><i></i></span>`;
  const tono = (pct) => (pct >= 90 ? 'var(--fail)' : pct >= 75 ? 'var(--warn)' : 'var(--ok)');

  function modoConexion() {
    const c = $('#conexion');
    c.dataset.modo = fuente;
    c.querySelector('span').textContent = { api: 'En vivo', ejemplo: 'Datos de ejemplo', sin: 'Sin conexión', buscando: 'Conectando…' }[fuente];
    $('#aviso-sin').hidden = fuente !== 'sin';
    $('#aviso-ej').hidden = fuente !== 'ejemplo';
  }

  // ---------------- Gráficas (SVG) ----------------
  function grafica(puntos, series, { max = null, unidad = '', ancho = 640 } = {}) {
    if (!puntos.length) return '';
    const W = ancho, H = 170, P = { l: unidad === 'red' ? 64 : 40, r: 10, t: 10, b: 22 };
    const top = max ?? Math.max(1, ...puntos.flatMap((p) => series.map((s) => p[s.k]))) * 1.15;
    const x = (i) => P.l + (i / (puntos.length - 1)) * (W - P.l - P.r);
    const y = (v) => P.t + (1 - v / top) * (H - P.t - P.b);
    const lineas = series.map((s) => {
      const pts = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p[s.k]).toFixed(1)}`).join(' ');
      return `<polygon points="${P.l},${H - P.b} ${pts} ${W - P.r},${H - P.b}" fill="${s.c}" opacity=".12"/><polyline points="${pts}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round"/>`;
    }).join('');
    const guias = [0, 0.5, 1].map((f) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(top * f)}" y2="${y(top * f)}" class="guia"/><text x="${P.l - 6}" y="${y(top * f) + 4}" text-anchor="end">${unidad === '%' ? fmt(top * f) + '%' : unidad === 'red' ? red(top * f) : fmt(top * f)}</text>`).join('');
    const horas = [0, Math.floor(puntos.length / 2), puntos.length - 1].map((i) => `<text x="${x(i)}" y="${H - 5}" text-anchor="${i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'}">${new Date(puntos[i].t).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</text>`).join('');
    return `<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfica">${guias}${lineas}${horas}</svg>`;
  }

  // ---------------- Vistas ----------------
  const V = {};

  V.estado = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const e = datos = await pedir('GET', '/api/sistema/estado');
    const r = e.recursos;
    const ramPct = (r.ram_usada / r.ram_total) * 100, discoPct = (r.disco_usado / r.disco_total) * 100;
    const alertas = [];
    e.servicios.filter((s) => !s.activo).forEach((s) => alertas.push(['fail', `${s.nombre} está detenido.`]));
    if (discoPct >= 80) alertas.push(['warn', `El disco va en ${fmt(discoPct)} %.`]);
    if (ramPct >= 85) alertas.push(['warn', `La memoria va en ${fmt(ramPct)} %.`]);
    e.certificados.filter((c) => dias(c.vence) <= 15).forEach((c) => alertas.push(['warn', `El certificado HTTPS de ${c.dominio} vence en ${dias(c.vence)} días.`]));
    if (!e.respaldo || (Date.now() - new Date(e.respaldo.fecha)) > 26 * 3600000) alertas.push(['warn', 'No hay respaldo de la base en las últimas 26 horas.']);
    e.sitios.filter((s) => s.mantenimiento).forEach((s) => alertas.push(['info', `${s.dominio} está en mantenimiento.`]));
    e.sitios.filter((s) => !s.mantenimiento && s.http >= 500).forEach((s) => alertas.push(['fail', `${s.dominio} responde ${s.http}.`]));

    el.innerHTML = `
      <div class="salud ${alertas.some((a) => a[0] === 'fail') ? 'mal' : alertas.length ? 'ojo' : 'bien'}">
        <span class="salud-ico" aria-hidden="true"></span>
        <div><b>${alertas.some((a) => a[0] === 'fail') ? 'Hay algo caído' : alertas.length ? 'Todo arriba, con avisos' : 'Todo funciona'}</b>
          <small>${esc(e.servidor.nombre)} · ${esc(e.servidor.so)} · encendido hace ${duracion(e.servidor.uptime_s)}</small></div>
      </div>
      ${alertas.length ? `<ul class="alertas">${alertas.map(([t, m]) => `<li data-t="${t}">${esc(m)}</li>`).join('')}</ul>` : ''}
      <div class="tarjetas">
        <article class="tarj"><small>CPU (${e.servidor.vcpu} núcleos)</small><b>${fmt(r.cpu)}<span>%</span></b>${medidor(r.cpu, tono(r.cpu))}<em>Carga ${r.carga.map((c) => fmt(c, 2)).join(' · ')}</em></article>
        <article class="tarj"><small>Memoria</small><b>${fmt(ramPct)}<span>%</span></b>${medidor(ramPct, tono(ramPct))}<em>${bytes(r.ram_usada)} de ${bytes(r.ram_total)}</em></article>
        <article class="tarj"><small>Disco</small><b>${fmt(discoPct)}<span>%</span></b>${medidor(discoPct, tono(discoPct))}<em>${bytes(r.disco_usado)} de ${bytes(r.disco_total)}</em></article>
        <article class="tarj"><small>Red ahora</small><b class="b-red">↓ ${red(r.red_rx)}</b><em>↑ ${red(r.red_tx)} · ${r.pg_conexiones} conexiones a la base</em></article>
      </div>
      <div class="dos">
        <article class="caja"><header><h2>Servicios</h2></header>
          <ul class="filas">${e.servicios.map((s) => `<li><span class="punto ${s.activo ? 'ok' : 'fail'}"></span><span class="fila-main"><b>${esc(s.nombre)}</b><small>${esc(s.version)} · ${esc(s.nota)}</small></span><span class="fila-lado">${s.activo ? `activo ${hace(s.desde).replace('hace ', 'hace ')}` : '<b class="rojo">detenido</b>'}</span></li>`).join('')}</ul>
        </article>
        <article class="caja"><header><h2>Sitios</h2><a href="#mantenimiento">Mantenimiento</a></header>
          <ul class="filas">${e.sitios.map((s) => `<li><span class="punto ${s.mantenimiento ? 'warn' : s.http < 400 ? 'ok' : 'fail'}"></span><span class="fila-main"><b>${esc(s.dominio)}</b><small>${s.mantenimiento ? 'En mantenimiento (responde 503 a propósito)' : `Responde ${s.http}`}</small></span><span class="fila-lado mono">${s.ms} ms</span></li>`).join('')}</ul>
        </article>
      </div>`;
  };

  let rango = '5m';
  V.recursos = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const [e, s] = await Promise.all([pedir('GET', '/api/sistema/estado'), pedir('GET', `/api/sistema/recursos?rango=${rango}`)]);
    const p = s.puntos, r = e.recursos;
    el.innerHTML = `
      <div class="cab">
        <p class="sub">${rango === '5m' ? 'Últimos 5 minutos, se actualiza cada 5 segundos.' : 'Últimas 24 horas, un punto cada media hora.'}</p>
        <div class="seg" role="group" aria-label="Rango"><button type="button" data-rango="5m" aria-pressed="${rango === '5m'}">En vivo</button><button type="button" data-rango="24h" aria-pressed="${rango === '24h'}">24 horas</button></div>
      </div>
      <div class="graficas">
        <article class="caja"><header><h2>CPU</h2><span class="dato" style="--c:var(--cielo)">${fmt(r.cpu)} %</span></header>${grafica(p, [{ k: 'cpu', c: 'var(--cielo)' }], { max: 100, unidad: '%' })}</article>
        <article class="caja"><header><h2>Memoria</h2><span class="dato" style="--c:var(--lavanda)">${fmt((r.ram_usada / r.ram_total) * 100)} %</span></header>${grafica(p, [{ k: 'ram', c: 'var(--lavanda)' }], { max: 100, unidad: '%' })}</article>
        <article class="caja ancha"><header><h2>Red</h2><span class="leyenda"><i style="--c:var(--lima)"></i>Entra ${red(r.red_rx)} <i style="--c:var(--ambar)"></i>Sale ${red(r.red_tx)}</span></header>${grafica(p, [{ k: 'rx', c: 'var(--lima)' }, { k: 'tx', c: 'var(--ambar)' }], { unidad: 'red', ancho: 1300 })}</article>
      </div>
      <div class="tarjetas tres">
        <article class="tarj"><small>Carga del sistema</small><b>${r.carga.map((c) => fmt(c, 2)).join(' · ')}</b><em>1, 5 y 15 minutos · ${e.servidor.vcpu} núcleos</em></article>
        <article class="tarj"><small>Conexiones a PostgreSQL</small><b>${r.pg_conexiones}<span> / ${r.pg_max}</span></b>${medidor((r.pg_conexiones / r.pg_max) * 100, tono((r.pg_conexiones / r.pg_max) * 100))}</article>
        <article class="tarj"><small>Disco libre</small><b>${bytes(r.disco_total - r.disco_usado)}</b>${medidor((r.disco_usado / r.disco_total) * 100, tono((r.disco_usado / r.disco_total) * 100))}</article>
      </div>`;
  };

  let canalesEdit = null;
  V.canales = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    if (!canalesEdit) canalesEdit = (await pedir('GET', '/api/sistema/canales')).canales.map((c) => ({ ...c }));
    const est = { ok: 'Activo', warn: 'Mantenimiento', fail: 'Sin servicio' };
    el.innerHTML = `
      <p class="sub">Lo que muestra la página de mantenimiento en "Estado de los servicios". Cambiarlo aquí no apaga nada: solo informa.</p>
      <div class="dos">
        <article class="caja"><header><h2>Canales</h2></header>
          <ul class="canales">${canalesEdit.map((c, i) => `
            <li>
              <b>${esc(c.canal)}</b>
              <div class="seg seg-est" role="radiogroup" aria-label="Estado de ${esc(c.canal)}">${Object.entries(est).map(([k, t]) => `<button type="button" role="radio" data-canal="${i}" data-est="${k}" aria-checked="${c.estado === k}">${t}</button>`).join('')}</div>
              <input class="entrada" data-canal-texto="${i}" value="${esc(c.texto)}" maxlength="40" aria-label="Texto de ${esc(c.canal)}">
            </li>`).join('')}</ul>
          <div class="acciones"><button type="button" class="btn-primario" data-accion="guardar-canales">Guardar y publicar</button></div>
        </article>
        <article class="caja"><header><h2>Así se ve</h2><small>Página de mantenimiento</small></header>
          <ul class="vista-previa">${canalesEdit.map((c) => `<li><span class="punto ${c.estado}"></span><span><b>${esc(c.canal)}</b><small>${esc(c.texto)}</small></span></li>`).join('')}</ul>
        </article>
      </div>`;
  };

  V.mantenimiento = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const [e, m] = await Promise.all([pedir('GET', '/api/sistema/estado'), pedir('GET', '/api/sistema/mantenimientos')]);
    const ahora = Date.now();
    const estadoDe = (x) => (new Date(x.inicio) > ahora ? 'programado' : !x.regreso || new Date(x.regreso) > ahora ? 'en curso' : 'terminado');
    const local = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 16); };
    const lista = [...m.mantenimientos].sort((a, b) => b.inicio.localeCompare(a.inicio));
    el.innerHTML = `
      <div class="dos">
        <article class="caja"><header><h2>Ahora mismo</h2></header>
          <p class="sub">Encenderlo muestra "Volvemos pronto" en ese sitio de inmediato. No toca código ni reinicia nada.</p>
          <ul class="interruptores">${e.sitios.map((s) => `
            <li><span class="fila-main"><b>${esc(s.dominio)}</b><small>${s.mantenimiento ? 'En mantenimiento' : 'Funcionando normal'}</small></span>
              <button type="button" class="switch" role="switch" aria-checked="${s.mantenimiento}" data-sitio="${s.id}" aria-label="Mantenimiento de ${esc(s.dominio)}"><i></i></button></li>`).join('')}</ul>
        </article>
        <article class="caja"><header><h2>Programar</h2></header>
          <form class="formulario" id="form-mant">
            <fieldset class="chips"><legend>Sitios</legend>${e.sitios.map((s) => `<label><input type="checkbox" name="sitios" value="${s.id}" ${s.id === 'app' ? 'checked' : ''}><span>${esc(s.dominio)}</span></label>`).join('')}</fieldset>
            <div class="dos-campos">
              <label class="campo"><span>Empieza</span><input type="datetime-local" name="inicio" required value="${local(ahora + 86400000)}"></label>
              <label class="campo"><span>Regreso estimado</span><input type="datetime-local" name="regreso" value="${local(ahora + 86400000 + 2 * 3600000)}"></label>
            </div>
            <label class="campo"><span>Mensaje para la gente (opcional)</span><input type="text" name="mensaje" maxlength="120" placeholder="Estamos mejorando la app para ti."></label>
            <div class="acciones"><button type="submit" class="btn-primario">Programar mantenimiento</button></div>
          </form>
        </article>
      </div>
      <article class="caja"><header><h2>Programados y anteriores</h2></header>
        ${lista.length ? `<ul class="filas">${lista.map((x) => { const st = estadoDe(x); return `<li><span class="punto ${st === 'en curso' ? 'warn' : st === 'programado' ? 'info' : 'off'}"></span>
          <span class="fila-main"><b>${(x.sitios || []).map((k) => ({ web: 'Web', app: 'App', admin: 'Admin' }[k] || k)).join(' · ')} · ${fecha(x.inicio)}${x.regreso ? ` → ${fecha(x.regreso)}` : ''}</b><small>${esc(x.mensaje || 'Sin mensaje')}</small></span>
          <span class="fila-lado"><span class="pill" data-st="${st}">${st}</span>${st === 'programado' ? `<button type="button" class="btn-sec sm" data-accion="cancelar-mant" data-id="${x.id}">Cancelar</button>` : ''}</span></li>`; }).join('')}</ul>`
          : vacio('No hay mantenimientos programados.')}
      </article>`;
  };

  V.nginx = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const n = await pedir('GET', '/api/sistema/nginx');
    const pendientes = n.sitios.some((x) => !x.aplicado);
    el.innerHTML = `
      <div class="nota">
        <b>Cómo funciona:</b> cada archivo de <code>sites-available</code> es un sitio; si está en <code>sites-enabled</code>, Nginx lo sirve.
        Aquí solo se activa o desactiva y se aplica con <b>Probar y aplicar</b>: primero corre <code>nginx -t</code> y, si hay un error, no recarga nada.
        La configuración no se edita desde el panel: se cambia en el repositorio <code>backend_loentrego/nginx</code> y se despliega.
      </div>
      ${pendientes ? '<div class="pendiente">Hay cambios sin aplicar. Nginx sigue usando la configuración anterior hasta que toques "Probar y aplicar".</div>' : ''}
      <div class="acciones izq">
        <button type="button" class="btn-sec" data-accion="nginx-probar">Probar configuración</button>
        <button type="button" class="btn-primario" data-accion="nginx-aplicar" ${pendientes ? '' : 'disabled'}>Probar y aplicar</button>
      </div>
      <pre class="consola" id="nginx-salida" hidden></pre>
      <ul class="sitios-nginx">${n.sitios.map((x) => `
        <li class="caja">
          <div class="sn-cab">
            <span class="fila-main"><b class="mono">${esc(x.archivo)}</b><small>${x.dominios.map(esc).join(' · ')}</small></span>
            <span class="sn-estado">${x.aplicado ? '' : '<span class="pill" data-st="programado">sin aplicar</span>'}<span class="sn-txt">${x.habilitado ? 'Habilitado' : 'Deshabilitado'}</span>
              <button type="button" class="switch" role="switch" aria-checked="${x.habilitado}" data-nginx="${esc(x.archivo)}" aria-label="Habilitar ${esc(x.archivo)}"><i></i></button></span>
          </div>
          <details><summary>Ver configuración</summary><pre class="codigo">${esc(x.contenido)}</pre></details>
        </li>`).join('')}</ul>`;
  };

  V.respaldos = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const [e, rs] = await Promise.all([pedir('GET', '/api/sistema/estado'), pedir('GET', '/api/sistema/respaldos')]);
    const u = rs.respaldos[0];
    el.innerHTML = `
      <div class="dos">
        <article class="caja"><header><h2>Respaldos de la base</h2><button type="button" class="btn-primario sm" data-accion="respaldar">Respaldar ahora</button></header>
          <div class="destacado"><small>Último</small><b>${u ? hace(u.fecha) : 'Nunca'}</b><em>${u ? `${fecha(u.fecha)} · ${bytes(u.bytes)} · ${u.segundos} s` : ''}</em></div>
          <p class="sub">Cada noche a las 3:00. ${esc(rs.destino)}; se guardan ${rs.retencion_dias} días.</p>
          <ul class="filas compactas">${rs.respaldos.map((x) => `<li><span class="punto ${x.ok ? 'ok' : 'fail'}"></span><span class="fila-main"><b>${fecha(x.fecha)}</b></span><span class="fila-lado mono">${bytes(x.bytes)}</span></li>`).join('')}</ul>
        </article>
        <article class="caja"><header><h2>Certificados HTTPS</h2><small>Let's Encrypt · se renuevan solos</small></header>
          <ul class="filas">${e.certificados.map((c) => { const d = dias(c.vence); return `<li><span class="punto ${d <= 7 ? 'fail' : d <= 20 ? 'warn' : 'ok'}"></span><span class="fila-main"><b>${esc(c.dominio)}</b><small>Vence el ${fecha(c.vence, false)}</small></span><span class="fila-lado"><span><b>${d}</b> días</span></span></li>`; }).join('')}</ul>
          <p class="sub">Certbot intenta renovar 30 días antes. Si alguno baja de 20 días, algo falló en la renovación.</p>
        </article>
      </div>`;
  };

  V.seguridad = async (el) => {
    if (fuente === 'sin') { el.innerHTML = sinDatos(); return; }
    const s = await pedir('GET', '/api/sistema/seguridad');
    el.innerHTML = `
      <div class="dos">
        <article class="caja"><header><h2>Intentos de ingreso fallidos</h2><small>Últimas 24 h</small></header>
          ${s.intentos.length ? `<ul class="filas">${s.intentos.map((x) => `<li><span class="punto ${x.veces >= 5 ? 'fail' : 'warn'}"></span><span class="fila-main"><b>${esc(x.usuario)}</b><small class="mono">${esc(x.ip)}</small></span><span class="fila-lado"><span><b>${x.veces}</b> intentos</span><small>${hace(x.cuando)}</small></span></li>`).join('')}</ul>` : vacio('Ningún intento fallido.')}
        </article>
        <article class="caja"><header><h2>IPs bloqueadas</h2><small>fail2ban</small></header>
          ${s.bloqueadas.length ? `<ul class="filas">${s.bloqueadas.map((x) => `<li><span class="punto fail"></span><span class="fila-main"><b class="mono">${esc(x.ip)}</b><small>${esc(x.motivo)}</small></span><span class="fila-lado"><small>hasta ${fecha(x.hasta)}</small><button type="button" class="btn-sec sm" data-accion="desbloquear" data-ip="${esc(x.ip)}">Desbloquear</button></span></li>`).join('')}</ul>` : vacio('No hay IPs bloqueadas.')}
        </article>
      </div>
      <article class="caja"><header><h2>Errores recientes del servidor</h2><small>Respuestas 5xx</small></header>
        ${s.errores.length ? `<ul class="filas">${s.errores.map((x) => `<li><span class="codigo-http">${x.codigo}</span><span class="fila-main"><b class="mono">${esc(x.ruta)}</b><small>${esc(x.detalle)}</small></span><span class="fila-lado"><small>${hace(x.cuando)}</small></span></li>`).join('')}</ul>` : vacio('Sin errores recientes.')}
      </article>`;
  };

  // ---------------- Navegación ----------------
  let actual = 'estado';
  async function ir(v) {
    if (!V[v]) v = 'estado';
    actual = v;
    $$('.vista').forEach((s) => { s.hidden = s.id !== `v-${v}`; });
    $$('[data-ir]').forEach((a) => a.toggleAttribute('aria-current', a.dataset.ir === v));
    const el = $(`#v-${v}`);
    $('#titulo').textContent = el.dataset.titulo;
    document.title = `${el.dataset.titulo} · Sistema · LoEntrego`;
    try { await V[v](el); } catch (err) { el.innerHTML = vacio(`No se pudo cargar: ${esc(err.message)}`); }
  }

  // ---------------- Acciones ----------------
  const acciones = {
    salir: () => salir(),
    ejemplo: () => { sessionStorage.setItem(K_EJ, '1'); fuente = 'ejemplo'; modoConexion(); ir(actual); },
    'sin-ejemplo': () => { sessionStorage.removeItem(K_EJ); Ejemplo.borrar(); fuente = 'sin'; canalesEdit = null; modoConexion(); ir(actual); },
    'guardar-canales': async () => {
      $$('[data-canal-texto]').forEach((i) => { canalesEdit[+i.dataset.canalTexto].texto = i.value.trim() || canalesEdit[+i.dataset.canalTexto].texto; });
      await pedir('PUT', '/api/sistema/canales', { canales: canalesEdit });
      toast('Canales publicados en la página de mantenimiento'); ir('canales');
    },
    'cancelar-mant': async (b) => {
      if (!await confirmar('Cancelar mantenimiento', '<p>Se quita de la lista y no se activará.</p>', 'Cancelar mantenimiento', true)) return;
      await pedir('DELETE', `/api/sistema/mantenimientos/${b.dataset.id}`); toast('Mantenimiento cancelado'); ir('mantenimiento');
    },
    'nginx-probar': async () => {
      const r = await pedir('POST', '/api/sistema/nginx/probar');
      const s = $('#nginx-salida'); s.hidden = false; s.textContent = r.salida; s.dataset.ok = r.ok;
    },
    'nginx-aplicar': async () => {
      if (!await confirmar('Probar y aplicar', '<p>Se corre <code>nginx -t</code>. Si pasa, Nginx se recarga sin cortar las conexiones abiertas. Si falla, no se aplica nada.</p>', 'Probar y aplicar')) return;
      const r = await pedir('POST', '/api/sistema/nginx/aplicar');
      toast(r.ok ? 'Nginx recargado' : 'La prueba falló: no se aplicó nada', r.ok ? 'ok' : 'error');
      await ir('nginx');
      const s = $('#nginx-salida'); s.hidden = false; s.textContent = r.salida; s.dataset.ok = r.ok;
    },
    respaldar: async (b) => {
      b.disabled = true; b.textContent = 'Respaldando…';
      await pedir('POST', '/api/sistema/respaldos'); toast('Respaldo listo'); ir('respaldos');
    },
    desbloquear: async (b) => {
      if (!await confirmar('Desbloquear IP', `<p>La IP <code>${esc(b.dataset.ip)}</code> podrá volver a intentar entrar.</p>`, 'Desbloquear')) return;
      await pedir('DELETE', `/api/sistema/bloqueos/${encodeURIComponent(b.dataset.ip)}`); toast('IP desbloqueada'); ir('seguridad');
    },
  };

  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest('[data-accion]');
    if (a) { ev.preventDefault(); try { await acciones[a.dataset.accion](a); } catch (err) { toast(err.message, 'error'); } return; }
    const rg = ev.target.closest('[data-rango]');
    if (rg) { rango = rg.dataset.rango; ir('recursos'); return; }
    const ce = ev.target.closest('[data-canal][data-est]');
    if (ce) { canalesEdit[+ce.dataset.canal].estado = ce.dataset.est; $$('[data-canal-texto]').forEach((i) => { canalesEdit[+i.dataset.canalTexto].texto = i.value; }); V.canales($('#v-canales')); return; }
    const tm = ev.target.closest('button[data-tema]');
    if (tm) { localStorage.setItem('loentrego-sistema-tema', tm.dataset.tema); document.documentElement.dataset.tema = tm.dataset.tema; marcarTema(); return; }
    const sw = ev.target.closest('[data-sitio]');
    if (sw) {
      const activar = sw.getAttribute('aria-checked') !== 'true';
      const dom = (datos?.sitios || []).find((x) => x.id === sw.dataset.sitio)?.dominio || sw.dataset.sitio;
      if (!await confirmar(activar ? 'Poner en mantenimiento' : 'Quitar mantenimiento',
        activar ? `<p><b>${esc(dom)}</b> mostrará "Volvemos pronto" a todo el que entre, desde ya.</p>` : `<p><b>${esc(dom)}</b> vuelve a funcionar normal.</p>`,
        activar ? 'Poner en mantenimiento' : 'Quitar mantenimiento', activar)) return;
      try { await pedir('PUT', `/api/sistema/sitios/${sw.dataset.sitio}/mantenimiento`, { activo: activar }); toast(activar ? `${dom} en mantenimiento` : `${dom} funcionando`); ir('mantenimiento'); } catch (err) { toast(err.message, 'error'); }
      return;
    }
    const ng = ev.target.closest('[data-nginx]');
    if (ng) {
      const hab = ng.getAttribute('aria-checked') !== 'true';
      const txt = hab ? `<p>Se enlaza <code>${esc(ng.dataset.nginx)}</code> en <code>sites-enabled</code>. No se aplica hasta "Probar y aplicar".</p>`
        : `<p>Se quita <code>${esc(ng.dataset.nginx)}</code> de <code>sites-enabled</code>. Al aplicar, sus dominios dejan de responder.</p>${ng.dataset.nginx === 'loentrego.conf' ? '<p class="rojo"><b>Ojo:</b> este archivo sirve la web, la app y el panel. Desactivarlo deja todo fuera de línea.</p>' : ''}`;
      if (!await confirmar(hab ? 'Habilitar sitio' : 'Deshabilitar sitio', txt, hab ? 'Habilitar' : 'Deshabilitar', !hab)) return;
      try { await pedir('PUT', `/api/sistema/nginx/${encodeURIComponent(ng.dataset.nginx)}`, { habilitado: hab }); ir('nginx'); } catch (err) { toast(err.message, 'error'); }
    }
  });

  document.addEventListener('submit', async (ev) => {
    if (ev.target.id !== 'form-mant') return;
    ev.preventDefault();
    const f = new FormData(ev.target);
    const sitios = f.getAll('sitios');
    if (!sitios.length) { toast('Elige al menos un sitio', 'error'); return; }
    const inicio = new Date(f.get('inicio')), regreso = f.get('regreso') ? new Date(f.get('regreso')) : null;
    if (regreso && regreso <= inicio) { toast('El regreso debe ser después del inicio', 'error'); return; }
    try {
      await pedir('POST', '/api/sistema/mantenimientos', { sitios, inicio: inicio.toISOString(), regreso: regreso ? regreso.toISOString() : null, mensaje: f.get('mensaje').trim() || null });
      toast('Mantenimiento programado'); ir('mantenimiento');
    } catch (err) { toast(err.message, 'error'); }
  });

  function marcarTema() { const t = document.documentElement.dataset.tema; $$('button[data-tema]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tema === t))); }
  function salir() { sessionStorage.removeItem('loentrego-sistema-token'); location.replace('index.html'); }

  // ---------------- Arranque ----------------
  async function arrancar() {
    marcarTema(); modoConexion();
    try { await pedir('GET', '/api/sistema/estado'); fuente = 'api'; }
    catch { fuente = sessionStorage.getItem(K_EJ) === '1' ? 'ejemplo' : 'sin'; }
    modoConexion();
    window.addEventListener('hashchange', () => ir(location.hash.slice(1)));
    await ir(location.hash.slice(1) || 'estado');
    // En vivo: refresca Estado y Recursos cada 5 s
    setInterval(() => {
      if (fuente === 'sin' || document.hidden) return;
      if (fuente === 'ejemplo') Ejemplo.tic();
      if (actual === 'estado' || (actual === 'recursos' && rango === '5m')) V[actual]($(`#v-${actual}`)).catch(() => {});
    }, 5000);
  }
  arrancar();
})();
