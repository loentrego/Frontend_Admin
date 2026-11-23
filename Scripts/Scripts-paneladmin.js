// =====================================================================
//  LoEntrego · Admin — Panel de administrador (estilo "Noche")
//
//  ⚠️ DATOS DE PRUEBA: mientras no exista el backend, los pedidos viven
//  en el navegador (localStorage). AppWeb y Admin se publican en el mismo
//  dominio (loentrego.github.io), así que COMPARTEN estos datos: lo que
//  marca el repartidor en AppWeb se ve aquí, y si el admin reasigna un
//  pedido, el repartidor deja de verlo. Al conectar la API, reemplazar
//  `store` por llamadas a los endpoints.
// =====================================================================
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // ---------- Catálogos (mismos que AppWeb) ----------
  const ZONAS = { bogota: 'Bogotá', funza: 'Funza', soacha: 'Soacha' };
  const ESTADOS = {
    por_recoger:  { label: 'Por recoger',  paso: 0, tono: 'wait' },
    recogido:     { label: 'Recogido',     paso: 1, tono: 'move' },
    en_camino:    { label: 'En camino',    paso: 2, tono: 'move' },
    entregado:    { label: 'Entregado',    paso: 3, tono: 'ok' },
    no_entregado: { label: 'No entregado', paso: -1, tono: 'fail' },
  };
  const FLUJO = ['por_recoger', 'recogido', 'en_camino', 'entregado'];
  const FINALES = ['entregado', 'no_entregado'];
  const MOTIVOS = { no_contesta: 'No contesta', direccion: 'Dirección errada', rechazado: 'Rechazó el pedido', ausente: 'No había nadie', otro: 'Otro motivo' };

  const RIDERS = [
    { id: 'r1', nombre: 'Camilo Restrepo', celular: '3001234567', vehiculo: 'Moto · ABC12D' },
    { id: 'r2', nombre: 'Laura Jiménez', celular: '3116547890', vehiculo: 'Moto · XYZ98K' },
    { id: 'r3', nombre: 'Andrés Torres', celular: '3204561278', vehiculo: 'Bicicleta' },
  ];
  // El mapa de zonas usa esta lista para asignar repartidores a cada zona
  window.LEAdmin = { riders: RIDERS };
  const ADMIN = { nombre: 'Fernando Ramírez', rol: 'Administrador general', correo: 'fernando@loentrego.com', celular: '300 123 4567' };

  // ---------- Utilidades ----------
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const initials = (name) => String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const phone = (v) => String(v).replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  const now = () => new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const riderOf = (o) => o.repartidor || 'r1';
  const rider = (id) => RIDERS.find((r) => r.id === id) || RIDERS[0];
  const lastTime = (o) => (o.historial || []).at(-1)?.[1] || '';

  // ---------- Datos de prueba compartidos ----------
  const KEY = 'loentrego-demo-v2';
  const EXTRAS_KEY = 'loentrego-demo-extras-v1';
  const SEED = [
    { id: 'p1', codigo: 'LE-1041', nombre: 'Marcela Ortiz', direccion: 'Calle 116 #19-40, apto 302', zona: 'bogota', telefono: '3127890123', cobro: 32000, notas: 'Dejar con el celador', estado: 'entregado',
      historial: [['por_recoger', '08:05'], ['recogido', '08:40'], ['en_camino', '08:52'], ['entregado', '09:31']] },
    { id: 'p2', codigo: 'LE-1042', nombre: 'Andrea Gómez', direccion: 'Calle 72 #10-34', zona: 'bogota', telefono: '3001234567', cobro: 45000, notas: 'Entregar en portería, preguntar por Sr. Gómez', estado: 'en_camino',
      historial: [['por_recoger', '08:12'], ['recogido', '08:40'], ['en_camino', '09:40']] },
    { id: 'p3', codigo: 'LE-1043', nombre: 'Julián Ríos', direccion: 'Carrera 15 #8-21, casa 4', zona: 'funza', telefono: '3154567890', cobro: 28000, notas: 'Tocar el timbre de la reja verde', estado: 'recogido',
      historial: [['por_recoger', '08:20'], ['recogido', '08:41']] },
    { id: 'p4', codigo: 'LE-1044', nombre: 'Sofía Herrera', direccion: 'Calle 13 #7-45', zona: 'soacha', telefono: '3205558877', cobro: 0, notas: '', estado: 'por_recoger',
      historial: [['por_recoger', '09:05']] },
    { id: 'p5', codigo: 'LE-1045', nombre: 'Daniel Castro', direccion: 'Av. Boyacá #63-20', zona: 'bogota', telefono: '3112223344', cobro: 61500, notas: 'Llamar antes de llegar', estado: 'por_recoger',
      historial: [['por_recoger', '09:18']] },
    { id: 'p6', codigo: 'LE-1040', nombre: 'Paula Medina', direccion: 'Calle 45 #22-10', zona: 'bogota', telefono: '3019876543', cobro: 19900, notas: '', estado: 'no_entregado', motivo: 'no_contesta',
      historial: [['por_recoger', '07:50'], ['recogido', '08:10'], ['en_camino', '08:15'], ['no_entregado', '08:48']] },
  ];
  // Pedidos de otros repartidores (solo los conoce el admin)
  const EXTRAS = [
    { id: 'x1', codigo: 'LE-1030', nombre: 'Carolina Vega', direccion: 'Cra 7 #116-40, Usaquén', zona: 'bogota', telefono: '3108887766', cobro: 52300, notas: '', estado: 'entregado', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '07:30'], ['recogido', '07:55'], ['en_camino', '08:05'], ['entregado', '08:40']] },
    { id: 'x2', codigo: 'LE-1031', nombre: 'Felipe Rojas', direccion: 'Cl 127 #45-12, Suba', zona: 'bogota', telefono: '3157774411', cobro: 18500, notas: 'Apto 1204', estado: 'en_camino', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '07:40'], ['recogido', '08:00'], ['en_camino', '09:10']] },
    { id: 'x3', codigo: 'LE-1032', nombre: 'Natalia Cruz', direccion: 'Calle 3 #12-08', zona: 'funza', telefono: '3014445566', cobro: 0, notas: '', estado: 'por_recoger', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '09:20']] },
    { id: 'x4', codigo: 'LE-1033', nombre: 'Jorge Peña', direccion: 'Cra 68 #24-56, Kennedy', zona: 'bogota', telefono: '3209991122', cobro: 24800, notas: '', estado: 'recogido', repartidor: 'r3', comercio: 'Café Origen',
      historial: [['por_recoger', '08:30'], ['recogido', '09:02']] },
    { id: 'x5', codigo: 'LE-1034', nombre: 'Lina Morales', direccion: 'Cl 100 #15-30, Usaquén', zona: 'bogota', telefono: '3113332211', cobro: 37500, notas: 'Oficina 402', estado: 'entregado', repartidor: 'r3', comercio: 'Café Origen',
      historial: [['por_recoger', '07:15'], ['recogido', '07:35'], ['en_camino', '07:40'], ['entregado', '08:12']] },
  ];

  const store = {
    all() {
      let list;
      try { list = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { list = null; }
      if (!Array.isArray(list)) list = structuredClone(SEED);
      // Agrega una sola vez los pedidos de los otros repartidores
      let extrasDone = false;
      try { extrasDone = localStorage.getItem(EXTRAS_KEY) === '1'; } catch { /* sin almacenamiento */ }
      if (!extrasDone && !list.some((o) => o.id === 'x1')) {
        list = [...list, ...structuredClone(EXTRAS)];
        this.save(list, true);
        try { localStorage.setItem(EXTRAS_KEY, '1'); } catch { /* modo privado */ }
      }
      return list;
    },
    save(list, silent = false) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* modo privado */ }
      if (!silent) document.dispatchEvent(new CustomEvent('le:orders'));
    },
    get(id) { return this.all().find((o) => o.id === id); },
    update(id, fn) {
      const list = this.all();
      const o = list.find((x) => x.id === id);
      if (!o) return null;
      fn(o);
      this.save(list);
      return o;
    },
    reset() {
      try { localStorage.removeItem(EXTRAS_KEY); } catch { /* */ }
      this.save(structuredClone(SEED), true);
      this.all();
      document.dispatchEvent(new CustomEvent('le:orders'));
    },
  };
  // Cambios hechos en otra pestaña (p. ej. el repartidor en AppWeb)
  window.addEventListener('storage', (e) => { if (e.key === KEY) document.dispatchEvent(new CustomEvent('le:orders')); });

  // ---------- Piezas ----------
  const pill = (estado) => `<span class="pill" data-tono="${ESTADOS[estado].tono}">${ESTADOS[estado].label}</span>`;

  function track(o) {
    const fail = o.estado === 'no_entregado';
    const reached = fail ? Math.max(0, ...(o.historial || []).map(([e]) => ESTADOS[e]?.paso ?? 0)) : ESTADOS[o.estado].paso;
    const nodes = FLUJO.map((_, i) => {
      let c = i <= reached ? 'done' : '';
      if (!fail && i === reached && o.estado !== 'entregado') c += ' current';
      if (fail && i === 3) c = 'fail';
      return `<i class="tk-node ${c}" style="--i:${i}"></i>`;
    }).join('');
    return `<span class="tk" data-estado="${o.estado}" style="--p:${reached / 3}" aria-hidden="true"><i class="tk-fill"></i>${nodes}</span>`;
  }

  function toast(msg, type = 'ok') {
    const region = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.type = type;
    el.textContent = msg;
    region.append(el);
    setTimeout(() => { el.dataset.leaving = ''; setTimeout(() => el.remove(), 250); }, 2600);
  }

  // Números que suben al entrar a una vista
  function countUp(root) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    $$('[data-count-to]', root).forEach((el) => {
      const target = Number(el.dataset.countTo) || 0;
      const isMoney = el.dataset.money === '1';
      const t0 = performance.now();
      const dur = 700;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const v = Math.round(target * (1 - Math.pow(1 - k, 3)));
        el.textContent = isMoney ? money(v) : v;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  // ---------- Navegación entre vistas ----------
  const VIEWS = {
    resumen: { title: 'Resumen del día', render: renderResumen },
    pedidos: { title: 'Pedidos', render: renderPedidos },
    repartidores: { title: 'Repartidores', render: renderRepartidores },
    mapa: { title: 'Mapa de zonas', render: () => window.LEMapa && window.LEMapa.montar() },
    enlaces: { title: 'Enlaces de registro', render: renderEnlaces },
    intercambio: { title: 'Intercambio de repartidor', render: renderIntercambio },
  };
  let view = 'resumen';

  function go(v, { push = true } = {}) {
    if (!VIEWS[v]) v = 'resumen';
    view = v;
    $$('[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === v ? 'page' : 'false'));
    $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
    $('#page-title').textContent = VIEWS[v].title;
    VIEWS[v].render();
    const sec = $('#view-' + v);
    sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter');
    countUp(sec);
    if (push) history.replaceState(null, '', '#' + v);
    $('.main').scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
  }

  // ---------- Resumen ----------
  function renderResumen() {
    const all = store.all();
    const by = (f) => all.filter(f);
    const k = {
      total: all.length,
      curso: by((o) => !FINALES.includes(o.estado)).length,
      entregados: by((o) => o.estado === 'entregado').length,
      novedades: by((o) => o.estado === 'no_entregado').length,
      cobrado: by((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0),
      porCobrar: by((o) => !FINALES.includes(o.estado)).reduce((s, o) => s + (o.cobro || 0), 0),
    };
    const pct = k.total ? Math.round((k.entregados / k.total) * 100) : 0;
    $('#kpis').innerHTML = `
      <article class="kpi kpi-hero"><span class="kpi-label">Pedidos de hoy</span><b class="kpi-value" data-count-to="${k.total}">${k.total}</b>
        <span class="kpi-bar"><i style="--w:${pct}%"></i></span><span class="kpi-foot">${pct}% entregado</span></article>
      <article class="kpi"><span class="kpi-label"><i class="dot" data-tono="move"></i>En curso</span><b class="kpi-value" data-count-to="${k.curso}">${k.curso}</b></article>
      <article class="kpi"><span class="kpi-label"><i class="dot" data-tono="ok"></i>Entregados</span><b class="kpi-value" data-count-to="${k.entregados}">${k.entregados}</b></article>
      <article class="kpi"><span class="kpi-label"><i class="dot" data-tono="fail"></i>Novedades</span><b class="kpi-value" data-count-to="${k.novedades}">${k.novedades}</b></article>
      <article class="kpi kpi-money"><span class="kpi-label">Efectivo cobrado</span><b class="kpi-value" data-money="1" data-count-to="${k.cobrado}">${money(k.cobrado)}</b><span class="kpi-foot">${money(k.porCobrar)} por cobrar</span></article>`;

    $('#riders-today').innerHTML = RIDERS.map((r) => {
      const mine = all.filter((o) => riderOf(o) === r.id);
      const done = mine.filter((o) => FINALES.includes(o.estado)).length;
      const cash = mine.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0);
      return `<li class="rt-row">
        <span class="avatar">${initials(r.nombre)}</span>
        <span class="rt-main"><b>${r.nombre}</b><span class="rt-bar"><i style="--w:${mine.length ? (done / mine.length) * 100 : 0}%"></i></span></span>
        <span class="rt-side"><b>${done}/${mine.length}</b><small>${money(cash)}</small></span>
      </li>`;
    }).join('');

    const events = all.flatMap((o) => (o.historial || []).map(([e, h]) => ({ o, e, h })))
      .sort((a, b) => b.h.localeCompare(a.h)).slice(0, 8);
    $('#activity').innerHTML = events.map(({ o, e, h }) => `
      <li class="act"><span class="act-time">${h}</span><i class="dot" data-tono="${ESTADOS[e].tono}"></i>
        <span class="act-text"><b>${o.codigo}</b> · ${o.nombre} — ${ESTADOS[e].label.toLowerCase()}${e === 'no_entregado' && o.motivo ? ` (${MOTIVOS[o.motivo].toLowerCase()})` : ''}</span>
        <span class="act-who">${rider(riderOf(o)).nombre.split(' ')[0]}</span></li>`).join('');
  }

  // ---------- Pedidos ----------
  let filtro = 'todos';
  let agrupar = true;
  const FILTROS = {
    todos: () => true,
    por_recoger: (o) => o.estado === 'por_recoger',
    curso: (o) => o.estado === 'recogido' || o.estado === 'en_camino',
    entregado: (o) => o.estado === 'entregado',
    no_entregado: (o) => o.estado === 'no_entregado',
  };

  function orderRow(o) {
    return `<button type="button" class="row" data-action="open-order" data-id="${o.id}" data-estado="${o.estado}">
      <span class="row-code">${o.codigo}</span>
      <span class="row-main"><b>${esc(o.nombre)}</b><small>${esc(o.direccion)} · ${ZONAS[o.zona] || ''}</small></span>
      <span class="row-track">${track(o)}</span>
      <span class="row-amount">${o.cobro > 0 ? money(o.cobro) : '<small>Pagado</small>'}</span>
      ${pill(o.estado)}
    </button>`;
  }

  function renderPedidos() {
    const all = store.all();
    const term = ($('#search').value || '').trim().toLowerCase();
    const counts = Object.fromEntries(Object.keys(FILTROS).map((k) => [k, all.filter(FILTROS[k]).length]));
    $$('[data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] ?? 0; });
    $$('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === filtro)));
    $$('[data-group]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.group === 'si') === agrupar)));

    const list = all.filter(FILTROS[filtro]).filter((o) => !term
      || [o.codigo, o.nombre, o.direccion, rider(riderOf(o)).nombre].some((v) => String(v).toLowerCase().includes(term)))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const box = $('#orders');
    if (!list.length) {
      box.innerHTML = `<div class="empty"><span class="isotipo"></span><p>No hay pedidos que coincidan.</p></div>`;
      return;
    }
    if (agrupar) {
      box.innerHTML = RIDERS.map((r) => {
        const mine = list.filter((o) => riderOf(o) === r.id);
        if (!mine.length) return '';
        return `<section class="group"><header class="group-head"><span class="avatar">${initials(r.nombre)}</span>
          <span><b>${r.nombre}</b><small>${phone(r.celular)} · ${r.vehiculo}</small></span>
          <span class="group-count">${mine.length} pedido${mine.length === 1 ? '' : 's'}</span></header>
          <div class="rows">${mine.map(orderRow).join('')}</div></section>`;
      }).join('');
    } else {
      box.innerHTML = `<div class="rows">${list.map(orderRow).join('')}</div>`;
    }
  }

  // ---------- Detalle del pedido (panel lateral) ----------
  let currentId = null;
  function renderDrawer() {
    const o = store.get(currentId);
    if (!o) return closeDrawer();
    const hist = Object.fromEntries((o.historial || []).map(([e, h]) => [e, h]));
    const steps = o.estado === 'no_entregado' ? [...FLUJO.slice(0, 3).filter((e) => hist[e]), 'no_entregado'] : FLUJO;
    $('#drawer-body').innerHTML = `
      <div class="ticket">
        <div class="ticket-top">${pill(o.estado)}<span class="ticket-code">${o.codigo}</span></div>
        <h2 id="drawer-title">${esc(o.nombre)}</h2>
        <p class="ticket-sub">${esc(o.direccion)} · ${ZONAS[o.zona] || ''}</p>
        <div class="ticket-amount"><span>${o.cobro > 0 ? 'Cobro contraentrega' : 'Pedido pagado'}</span><b>${money(o.cobro)}</b></div>
      </div>

      <p class="label">Seguimiento</p>
      <ol class="timeline">${steps.map((e) => {
        const cls = e === 'no_entregado' ? 'fail' : hist[e] ? 'done' : 'todo';
        return `<li class="${cls}"><i></i><span>${ESTADOS[e].label}${e === 'no_entregado' && o.motivo ? ' · ' + MOTIVOS[o.motivo] : ''}</span><time>${hist[e] || '—'}</time></li>`;
      }).join('')}</ol>

      <p class="label" id="lbl-estado">Cambiar estado</p>
      <div class="seg" role="radiogroup" aria-labelledby="lbl-estado">
        ${Object.keys(ESTADOS).map((e) => `<button type="button" role="radio" aria-checked="${o.estado === e}" data-action="set-estado" data-estado="${e}" data-tono="${ESTADOS[e].tono}">${ESTADOS[e].label}</button>`).join('')}
      </div>

      <p class="label"><label for="reassign">Repartidor asignado</label></p>
      <select id="reassign" class="select" data-action-change="reassign">
        ${RIDERS.map((r) => `<option value="${r.id}"${riderOf(o) === r.id ? ' selected' : ''}>${r.nombre} · ${r.vehiculo}</option>`).join('')}
      </select>

      <p class="label">Datos</p>
      <dl class="data">
        <div><dt>Recibe</dt><dd>${esc(o.nombre)} · <a href="tel:+57${o.telefono}">${phone(o.telefono)}</a></dd></div>
        <div><dt>Comercio</dt><dd>${esc(o.comercio || 'Tienda Central')}</dd></div>
        <div><dt>Notas</dt><dd>${esc(o.notas) || 'Sin notas'}</dd></div>
      </dl>`;
  }
  function openDrawer(id) {
    currentId = id;
    renderDrawer();
    const d = $('#drawer');
    d.dataset.state = 'open';
    d.setAttribute('aria-hidden', 'false');
    $('.drawer-panel', d).focus({ preventScroll: true });
  }
  function closeDrawer() {
    const d = $('#drawer');
    d.dataset.state = 'closed';
    d.setAttribute('aria-hidden', 'true');
    currentId = null;
  }

  // ---------- Repartidores ----------
  function renderRepartidores() {
    const all = store.all();
    $('#riders').innerHTML = RIDERS.map((r) => {
      const mine = all.filter((o) => riderOf(o) === r.id);
      const done = mine.filter((o) => FINALES.includes(o.estado)).length;
      const cash = mine.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0);
      const pend = mine.filter((o) => !FINALES.includes(o.estado)).reduce((s, o) => s + (o.cobro || 0), 0);
      const fails = mine.filter((o) => o.estado === 'no_entregado').length;
      return `<article class="rider-card">
        <header><span class="avatar lg">${initials(r.nombre)}</span><span><b>${r.nombre}</b><small>${r.vehiculo} · ${phone(r.celular)}</small></span>
          <a class="icon-link" href="https://wa.me/57${r.celular}" target="_blank" rel="noopener" aria-label="Escribir a ${r.nombre} por WhatsApp">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4Z"/><path d="M9 9.5c.3 2 2.5 4.2 4.5 4.5l1-1.3 2 .9c-.3 1.3-1.4 2-2.7 1.8-3-.5-5.7-3.2-6.2-6.2-.2-1.3.5-2.4 1.8-2.7l.9 2Z"/></svg></a></header>
        <div class="rc-progress"><span><b>${done}</b> de ${mine.length} completados</span><span class="rt-bar"><i style="--w:${mine.length ? (done / mine.length) * 100 : 0}%"></i></span></div>
        <dl class="rc-stats"><div><dt>Cobrado</dt><dd>${money(cash)}</dd></div><div><dt>Por cobrar</dt><dd>${money(pend)}</dd></div><div><dt>Novedades</dt><dd>${fails}</dd></div></dl>
        <ul class="rc-list">${mine.sort((a, b) => FINALES.includes(a.estado) - FINALES.includes(b.estado)).map((o) =>
          `<li><button type="button" data-action="open-order" data-id="${o.id}"><span>${o.codigo}</span><b>${esc(o.nombre)}</b>${pill(o.estado)}</button></li>`).join('') || '<li class="muted">Sin pedidos asignados</li>'}</ul>
      </article>`;
    }).join('');
  }

  // ---------- Enlaces de registro ----------
  const LINKS_KEY = 'loentrego-admin-links';
  const loadLinks = () => { try { return JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch { return []; } };
  const saveLinks = (l) => { try { localStorage.setItem(LINKS_KEY, JSON.stringify(l)); } catch { /* */ } };
  const fmtDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  function renderEnlaces() {
    const links = loadLinks().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    $('#links').innerHTML = links.length ? links.map((l) => {
      const active = new Date(l.expiresAt) > new Date();
      return `<li class="link-row">
        <span class="badge" data-type="${l.type}">${l.type === 'repartidor' ? 'Repartidor' : 'Comercio'}</span>
        <code class="link-url" title="${esc(l.url)}">${esc(l.url)}</code>
        <span class="link-meta">${fmtDate(l.createdAt)}</span>
        <span class="pill" data-tono="${active ? 'ok' : 'fail'}">${active ? 'Activo' : 'Expirado'}</span>
        <button type="button" class="btn-sm" data-action="copy-link" data-url="${esc(l.url)}">Copiar</button>
        <button type="button" class="btn-sm danger" data-action="delete-link" data-id="${l.id}" aria-label="Eliminar enlace">Eliminar</button>
      </li>`;
    }).join('') : '<li class="empty"><span class="isotipo"></span><p>Todavía no has generado ningún enlace.</p></li>';
  }

  function generateLink(type) {
    const input = $('#base-' + type);
    const base = input.value.trim() || input.placeholder;
    const token = (Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)).toUpperCase();
    const url = `${base}${base.includes('?') ? '&' : '?'}token=${token}`;
    const nowD = new Date();
    const links = loadLinks();
    links.push({ id: token, type, url, createdAt: nowD.toISOString(), expiresAt: new Date(nowD.getTime() + 864e5).toISOString() });
    saveLinks(links);
    renderEnlaces();
    toast(`Enlace de ${type} creado · válido 24 h`);
  }

  // ---------- Intercambio ----------
  const EX_KEY = 'loentrego-admin-exchanges';
  const loadEx = () => { try { return JSON.parse(localStorage.getItem(EX_KEY) || '[]'); } catch { return []; } };

  function renderIntercambio() {
    const all = store.all();
    const from = $('#ex-from');
    const to = $('#ex-to');
    const pkg = $('#ex-package');
    const keepFrom = from.value || 'r1';
    from.innerHTML = RIDERS.map((r) => `<option value="${r.id}">${r.nombre}</option>`).join('');
    from.value = keepFrom;
    const keepTo = to.value && to.value !== from.value ? to.value : RIDERS.find((r) => r.id !== from.value).id;
    to.innerHTML = RIDERS.filter((r) => r.id !== from.value).map((r) => `<option value="${r.id}">${r.nombre}</option>`).join('');
    to.value = keepTo;
    const active = all.filter((o) => riderOf(o) === from.value && !FINALES.includes(o.estado));
    pkg.innerHTML = active.length
      ? active.map((o) => `<option value="${o.id}">${o.codigo} · ${o.nombre} (${ESTADOS[o.estado].label.toLowerCase()})</option>`).join('')
      : '<option value="">No tiene pedidos activos</option>';
    pkg.disabled = !active.length;
    $('#btn-exchange').disabled = !active.length;

    const ex = loadEx().slice().reverse();
    $('#ex-history').innerHTML = ex.length ? ex.map((h) => `
      <li class="hist"><code>${h.codigo}</code><span>${h.from}</span><span class="arrow">→</span><span>${h.to}</span><time>${fmtDate(h.at)}</time></li>`).join('')
      : '<li class="empty"><span class="isotipo"></span><p>Todavía no se ha hecho ningún intercambio.</p></li>';
  }

  function doExchange() {
    const id = $('#ex-package').value;
    const toId = $('#ex-to').value;
    if (!id) return;
    const o = store.update(id, (x) => { x.repartidor = toId; });
    const ex = loadEx();
    ex.push({ codigo: o.codigo, from: rider($('#ex-from').value).nombre, to: rider(toId).nombre, at: new Date().toISOString() });
    try { localStorage.setItem(EX_KEY, JSON.stringify(ex.slice(-30))); } catch { /* */ }
    toast(`${o.codigo} ahora lo entrega ${rider(toId).nombre}`);
    renderIntercambio();
  }

  // ---------- Acciones (delegación) ----------
  const actions = {
    'open-order': (el) => openDrawer(el.dataset.id),
    'close-drawer': () => closeDrawer(),
    'set-estado': (el) => {
      const e = el.dataset.estado;
      const o = store.update(currentId, (x) => {
        if (x.estado === e) return;
        x.estado = e;
        x.historial = [...(x.historial || []), [e, now()]];
        if (e === 'no_entregado' && !x.motivo) x.motivo = 'otro';
      });
      toast(`${o.codigo}: ${ESTADOS[e].label.toLowerCase()}`);
    },
    filter: (el) => { filtro = el.dataset.filter; renderPedidos(); },
    group: (el) => { agrupar = el.dataset.group === 'si'; renderPedidos(); },
    'gen-link': (el) => generateLink(el.dataset.type),
    'copy-link': async (el) => {
      try { await navigator.clipboard.writeText(el.dataset.url); el.textContent = 'Copiado'; el.dataset.ok = ''; }
      catch { el.textContent = 'No se pudo'; }
      setTimeout(() => { el.textContent = 'Copiar'; delete el.dataset.ok; }, 1600);
    },
    'delete-link': (el) => { saveLinks(loadLinks().filter((l) => l.id !== el.dataset.id)); renderEnlaces(); toast('Enlace eliminado'); },
    exchange: () => doExchange(),
    'toggle-account': (el) => {
      const menu = $('#account-menu');
      const open = menu.dataset.state !== 'open';
      menu.dataset.state = open ? 'open' : 'closed';
      el.setAttribute('aria-expanded', String(open));
    },
    'reset-demo': () => { store.reset(); toast('Datos de prueba restablecidos'); },
    logout: () => { localStorage.removeItem('auth_token'); window.location.href = '../index.html'; },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) { const fn = actions[el.dataset.action]; if (fn) { e.preventDefault(); fn(el, e); } return; }
    // Cerrar menú de cuenta al hacer clic fuera
    const menu = $('#account-menu');
    if (menu.dataset.state === 'open' && !e.target.closest('.account')) {
      menu.dataset.state = 'closed';
      $('[data-action="toggle-account"]').setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'reassign') {
      const o = store.update(currentId, (x) => { x.repartidor = e.target.value; });
      toast(`${o.codigo} reasignado a ${rider(e.target.value).nombre}`);
    }
    if (e.target.id === 'ex-from' || e.target.id === 'ex-to') renderIntercambio();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if ($('#drawer').dataset.state === 'open') closeDrawer();
      $('#account-menu').dataset.state = 'closed';
    }
    // Atajo: "/" enfoca la búsqueda de pedidos
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      if (view !== 'pedidos') go('pedidos');
      $('#search').focus();
    }
  });
  document.addEventListener('le:orders', () => {
    VIEWS[view].render();
    if (currentId) renderDrawer();
  });

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', () => {
    $$('[data-admin-name]').forEach((el) => { el.textContent = el.dataset.adminName === 'first' ? ADMIN.nombre.split(' ')[0] : ADMIN.nombre; });
    $$('[data-admin-initials]').forEach((el) => { el.textContent = initials(ADMIN.nombre); });
    $('#today').textContent = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#search').addEventListener('input', () => { if (view !== 'pedidos') go('pedidos'); else renderPedidos(); });
    window.addEventListener('hashchange', () => go(location.hash.slice(1), { push: false }));
    go(location.hash.slice(1) || 'resumen', { push: false });
  });
})();
