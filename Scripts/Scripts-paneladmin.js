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
    { id: 'r1', nombre: 'Camilo Restrepo', celular: '3001234567' },
    { id: 'r2', nombre: 'Laura Jiménez', celular: '3116547890' },
    { id: 'r3', nombre: 'Andrés Torres', celular: '3204561278' },
    { id: 'r4', nombre: 'Juliana Pardo', celular: '3012223344' },
    { id: 'r5', nombre: 'Mateo Rincón', celular: '3135556677' },
    { id: 'r6', nombre: 'Diana Salazar', celular: '3178889900' },
    { id: 'r7', nombre: 'Kevin Castaño', celular: '3221114455' },
  ];
  // Cada repartidor tiene un color (el mismo en el mapa de zonas)
  const COLORES_REP = ['#8FD3FF', '#FFB547', '#FF8FB1', '#7EE0C3', '#C3B9FF', '#FF9F6E', '#6FA8FF', '#F2DE6B'];
  const riderStyle = (id) => `style="--c:${COLORES_REP[Math.max(0, RIDERS.findIndex((r) => r.id === id)) % COLORES_REP.length]}"`;
  // El mapa de zonas usa esta lista para asignar repartidores a cada zona
  window.LEAdmin = { riders: RIDERS };
  const ADMIN = { nombre: 'Fernando Ramírez', rol: 'Administrador general', correo: 'fernando@loentrego.com', celular: '300 123 4567' };

  // ---------- Utilidades ----------
  const money = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const fmt = (n) => Number(n || 0).toLocaleString('es-CO');
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
    { id: 'p1', codigo: 'LOE-0001041', nombre: 'Marcela Ortiz', direccion: 'Calle 116 #19-40, apto 302', zona: 'bogota', telefono: '3127890123', cobro: 32000, notas: 'Dejar con el celador', estado: 'entregado',
      historial: [['por_recoger', '08:05'], ['recogido', '08:40'], ['en_camino', '08:52'], ['entregado', '09:31']] },
    { id: 'p2', codigo: 'LOE-0001042', nombre: 'Andrea Gómez', direccion: 'Calle 72 #10-34', zona: 'bogota', telefono: '3001234567', cobro: 45000, notas: 'Entregar en portería, preguntar por Sr. Gómez', estado: 'en_camino',
      historial: [['por_recoger', '08:12'], ['recogido', '08:40'], ['en_camino', '09:40']] },
    { id: 'p3', codigo: 'LOE-0001043', nombre: 'Julián Ríos', direccion: 'Carrera 15 #8-21, casa 4', zona: 'funza', telefono: '3154567890', cobro: 28000, notas: 'Tocar el timbre de la reja verde', estado: 'recogido',
      historial: [['por_recoger', '08:20'], ['recogido', '08:41']] },
    { id: 'p4', codigo: 'LOE-0001044', nombre: 'Sofía Herrera', direccion: 'Calle 13 #7-45', zona: 'soacha', telefono: '3205558877', cobro: 0, notas: '', estado: 'por_recoger',
      historial: [['por_recoger', '09:05']] },
    { id: 'p5', codigo: 'LOE-0001045', nombre: 'Daniel Castro', direccion: 'Av. Boyacá #63-20', zona: 'bogota', telefono: '3112223344', cobro: 61500, notas: 'Llamar antes de llegar', estado: 'por_recoger',
      historial: [['por_recoger', '09:18']] },
    { id: 'p6', codigo: 'LOE-0001040', nombre: 'Paula Medina', direccion: 'Calle 45 #22-10', zona: 'bogota', telefono: '3019876543', cobro: 19900, notas: '', estado: 'no_entregado', motivo: 'no_contesta',
      historial: [['por_recoger', '07:50'], ['recogido', '08:10'], ['en_camino', '08:15'], ['no_entregado', '08:48']] },
  ];
  // Pedidos de otros repartidores (solo los conoce el admin)
  const EXTRAS = [
    { id: 'x1', codigo: 'LOE-0001030', nombre: 'Carolina Vega', direccion: 'Cra 7 #116-40, Usaquén', zona: 'bogota', telefono: '3108887766', cobro: 52300, notas: '', estado: 'entregado', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '07:30'], ['recogido', '07:55'], ['en_camino', '08:05'], ['entregado', '08:40']] },
    { id: 'x2', codigo: 'LOE-0001031', nombre: 'Felipe Rojas', direccion: 'Cl 127 #45-12, Suba', zona: 'bogota', telefono: '3157774411', cobro: 18500, notas: 'Apto 1204', estado: 'en_camino', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '07:40'], ['recogido', '08:00'], ['en_camino', '09:10']] },
    { id: 'x3', codigo: 'LOE-0001032', nombre: 'Natalia Cruz', direccion: 'Calle 3 #12-08', zona: 'funza', telefono: '3014445566', cobro: 0, notas: '', estado: 'por_recoger', repartidor: 'r2', comercio: 'Moda Kira',
      historial: [['por_recoger', '09:20']] },
    { id: 'x4', codigo: 'LOE-0001033', nombre: 'Jorge Peña', direccion: 'Cra 68 #24-56, Kennedy', zona: 'bogota', telefono: '3209991122', cobro: 24800, notas: '', estado: 'recogido', repartidor: 'r3', comercio: 'Café Origen',
      historial: [['por_recoger', '08:30'], ['recogido', '09:02']] },
    { id: 'x5', codigo: 'LOE-0001034', nombre: 'Lina Morales', direccion: 'Cl 100 #15-30, Usaquén', zona: 'bogota', telefono: '3113332211', cobro: 37500, notas: 'Oficina 402', estado: 'entregado', repartidor: 'r3', comercio: 'Café Origen',
      historial: [['por_recoger', '07:15'], ['recogido', '07:35'], ['en_camino', '07:40'], ['entregado', '08:12']] },
  ];

  // Pedidos guardados con el formato viejo (LE-1042) pasan a 3 letras + 7 números (LOE-0001042)
  const migrarCodigo = (o) => (o && /^LE-\d+$/.test(o.codigo) ? { ...o, codigo: 'LOE-' + o.codigo.slice(3).padStart(7, '0') } : o);

  const store = {
    all() {
      let list;
      try { list = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { list = null; }
      if (!Array.isArray(list)) list = structuredClone(SEED);
      else if (list.some((o) => /^LE-\d+$/.test(o?.codigo))) { list = list.map(migrarCodigo); this.save(list, true); }
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
    comercios: { title: 'Comercios', render: renderComercios },
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
    document.body.dataset.vista = v;
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
  // Periodo del resumen (las cifras históricas son de ejemplo hasta tener el backend)
  const PERIODOS = { hoy: [1, 'de hoy', 'hoy'], mes: [26, 'del último mes', 'en 1 mes'], semestre: [156, 'de los últimos 6 meses', 'en 6 meses'], anio: [312, 'del último año', 'en 1 año'], historico: [720, 'desde el inicio', 'en total'] };
  let resPeriodo = 'hoy';
  function renderResumen() {
    const all = store.all();
    const by = (f) => all.filter(f);
    const [f, txt, corto] = PERIODOS[resPeriodo];
    $('#res-periodo-txt').textContent = txt;
    const k = {
      total: all.length * f,
      curso: resPeriodo === 'hoy' ? by((o) => !FINALES.includes(o.estado)).length : 0,
      entregados: by((o) => o.estado === 'entregado').length * f,
      novedades: by((o) => o.estado === 'no_entregado').length * f,
      cobrado: by((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0) * f,
      porCobrar: by((o) => !FINALES.includes(o.estado)).reduce((s, o) => s + (o.cobro || 0), 0),
    };
    const cerrados = k.entregados + k.novedades;
    const pct = k.total ? Math.round((k.entregados / k.total) * 100) : 0;
    $('#kpis').innerHTML = `
      <article class="kpi kpi-hero"><span class="kpi-label">Pedidos ${corto}</span><b class="kpi-value" data-count-to="${k.total}">${k.total}</b>
        <span class="kpi-bar"><i style="--w:${pct}%"></i></span><span class="kpi-foot">${pct}% entregado</span></article>
      ${resPeriodo === 'hoy'
        ? `<article class="kpi" data-tono="cielo"><span class="kpi-label"><i class="dot" data-tono="move"></i>En curso</span><b class="kpi-value" data-count-to="${k.curso}">${k.curso}</b></article>`
        : `<article class="kpi" data-tono="cielo"><span class="kpi-label"><i class="dot" data-tono="move"></i>Efectividad</span><b class="kpi-value">${cerrados ? Math.round((k.entregados / cerrados) * 100) : 0}%</b></article>`}
      <article class="kpi" data-tono="menta"><span class="kpi-label"><i class="dot" data-tono="ok"></i>Entregados</span><b class="kpi-value" data-count-to="${k.entregados}">${k.entregados}</b></article>
      <article class="kpi" data-tono="coral"><span class="kpi-label"><i class="dot" data-tono="fail"></i>Novedades</span><b class="kpi-value" data-count-to="${k.novedades}">${k.novedades}</b></article>
      <article class="kpi kpi-money" data-tono="ambar"><span class="kpi-label">Efectivo cobrado</span><b class="kpi-value" data-money="1" data-count-to="${k.cobrado}">${money(k.cobrado)}</b><span class="kpi-foot">${money(k.porCobrar)} por cobrar</span></article>`;

    // Reputación y redes: todavía no están vinculadas
    const pronto = '<div class="red-num"><span class="red-pronto">Muy pronto</span></div><p class="red-pie">Todavía no está vinculada.</p>';
    $('#redes').innerHTML = `
      <article class="red-card es-pronto" data-red="google"><header><span class="red-ico">G</span><b>Google Business</b><small>reseñas</small></header>${pronto}</article>
      <article class="red-card es-pronto" data-red="instagram"><header><span class="red-ico">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg></span><b>Instagram</b><small>@loentrego</small></header>${pronto}</article>
      <article class="red-card es-pronto" data-red="facebook"><header><span class="red-ico">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8a0 0 0 0 1 0 0Z"/></svg></span><b>Facebook</b><small>LoEntrego</small></header>${pronto}</article>
      <p class="red-nota">Google Business, Instagram y Facebook todavía no están vinculados. Muy pronto verás aquí las reseñas y los seguidores.</p>`;

    // Listas que se mueven hacia abajo (se duplican para un ciclo continuo)
    const filasRep = RIDERS.map((r) => {
      const mine = all.filter((o) => riderOf(o) === r.id);
      const done = mine.filter((o) => FINALES.includes(o.estado)).length;
      const cash = mine.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0);
      return `<li class="rt-row">
        <span class="avatar rep" ${riderStyle(r.id)}>${initials(r.nombre)}</span>
        <span class="rt-main"><b>${r.nombre}</b><span class="rt-bar"><i style="--w:${mine.length ? (done / mine.length) * 100 : 0}%"></i></span></span>
        <span class="rt-side"><b>${done}/${mine.length}</b><small>${money(cash)}</small></span>
      </li>`;
    }).join('');
    $('#riders-today').innerHTML = filasRep + filasRep.replace(/<li class="rt-row">/g, '<li class="rt-row" aria-hidden="true">');

    $$('.corredor').forEach((c) => { const n = c.firstElementChild.children.length / 2; c.style.setProperty('--dur', `${Math.max(14, n * 3.2)}s`); });
    renderSolicitudes();
  }

  // ---------- Solicitudes del formulario Únete (web) ----------
  // Llegan del formulario de loentrego.com/unete. Con el backend vendrán de GET /api/admin/solicitudes
  // (tabla solicitudes_comercio); mientras tanto se leen de este navegador. No dependen del periodo.
  const SOL_KEY = 'loentrego-admin-solicitudes';
  const loadSol = () => { try { return JSON.parse(localStorage.getItem(SOL_KEY) || '[]'); } catch { return []; } };
  const saveSol = (l) => { try { localStorage.setItem(SOL_KEY, JSON.stringify(l)); } catch { /* */ } };
  const hace = (iso) => {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return 'ahora'; if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60); if (h < 24) return `hace ${h} h`;
    return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  function renderSolicitudes() {
    const lista = loadSol().filter((x) => x.estado !== 'contactada').sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    const n = $('#sol-n');
    n.hidden = !lista.length; n.textContent = lista.length;
    $('#solicitudes').innerHTML = lista.length ? lista.map((x) => `
      <li class="sol-row">
        <span class="avatar com">${initials(x.comercio || '?')}</span>
        <span class="sol-main"><b>${esc(x.comercio)}</b><small>${esc(x.ubicacion)}${x.pedidos_diarios ? ` · ${esc(x.pedidos_diarios)} pedidos al día` : ''}</small>${x.mensaje ? `<small class="sol-msg">${esc(x.mensaje)}</small>` : ''}</span>
        <span class="sol-side"><a href="tel:+57${esc(String(x.celular).replace(/\D/g, ''))}">${phone(x.celular)}</a><small>${hace(x.creado)}</small>
          <button type="button" class="sol-ok" data-action="sol-contactada" data-id="${esc(x.id)}">Ya la contacté</button></span>
      </li>`).join('')
      : '<li class="sol-vacio"><span class="isotipo"></span><p>No hay solicitudes nuevas.<br>Aquí llegan los comercios que llenan el formulario Únete de la web.</p></li>';
  }

  // ---------- Pedidos ----------
  let filtro = 'todos';
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

    const list = all.filter(FILTROS[filtro]).filter((o) => !term
      || [o.codigo, o.nombre, o.direccion, rider(riderOf(o)).nombre].some((v) => String(v).toLowerCase().includes(term)))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    const box = $('#orders');
    if (!list.length) {
      box.innerHTML = `<div class="empty"><span class="isotipo"></span><p>No hay pedidos que coincidan.</p></div>`;
      return;
    }
    // Siempre agrupado por repartidor
    box.innerHTML = RIDERS.map((r) => {
      const mine = list.filter((o) => riderOf(o) === r.id);
      if (!mine.length) return '';
      return `<section class="group"><header class="group-head"><span class="avatar rep" ${riderStyle(r.id)}>${initials(r.nombre)}</span>
        <span><b>${r.nombre}</b><small>${phone(r.celular)}</small></span>
        <span class="group-count">${mine.length} pedido${mine.length === 1 ? '' : 's'}</span></header>
        <div class="rows">${mine.map(orderRow).join('')}</div></section>`;
    }).join('');
  }

  // ---------- Buscador global ----------
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function buscar() {
    const box = $('#search-results'), q = norm($('#search').value.trim());
    if (!q) { box.hidden = true; $('#search').setAttribute('aria-expanded', 'false'); return; }
    const all = store.all();
    const ped = all.filter((o) => norm(`${o.codigo} ${o.nombre} ${o.direccion} ${comercioDe(o)}`).includes(q)).slice(0, 5);
    const com = COMERCIOS.filter((c) => norm(`${c.nombre} ${c.categoria} ${c.zona} ${c.contacto}`).includes(q)).slice(0, 4);
    const rep = RIDERS.filter((r) => norm(`${r.nombre} ${r.celular}`).includes(q)).slice(0, 4);
    const grupo = (tit, items) => items.length ? `<p class="sr-tit">${tit}</p>${items.join('')}` : '';
    box.innerHTML = grupo('Pedidos', ped.map((o) => `<button type="button" class="sr-item" data-action="abrir" data-tipo="pedido" data-id="${o.id}"><span class="sr-ico">${o.codigo.slice(-4)}</span><span><b>${esc(o.nombre)}</b><small>${o.codigo} · ${esc(comercioDe(o))}</small></span>${pill(o.estado)}</button>`))
      + grupo('Comercios', com.map((c) => `<button type="button" class="sr-item" data-action="abrir" data-tipo="comercio" data-id="${c.id}"><span class="sr-ico">${initials(c.nombre)}</span><span><b>${esc(c.nombre)}</b><small>${esc(c.categoria)} · ${esc(c.zona)}</small></span></button>`))
      + grupo('Repartidores', rep.map((r) => `<button type="button" class="sr-item" data-action="abrir" data-tipo="repartidor" data-id="${r.id}"><span class="sr-ico rep" ${riderStyle(r.id)}>${initials(r.nombre)}</span><span><b>${esc(r.nombre)}</b><small>${phone(r.celular)}</small></span></button>`))
      || '<p class="sr-vacio">Sin resultados</p>';
    box.hidden = false; $('#search').setAttribute('aria-expanded', 'true');
  }
  function cerrarBusqueda() { $('#search-results').hidden = true; $('#search').setAttribute('aria-expanded', 'false'); }

  // Ficha de comercio o repartidor: mismo diseño del detalle del pedido
  function abrirFicha(tipoF, id) {
    const all = store.all();
    let tit, sub, extra, lista, datos;
    if (tipoF === 'comercio') {
      const c = COMERCIOS.find((x) => x.id === id); if (!c) return;
      lista = all.filter((o) => comercioDe(o) === c.nombre);
      tit = c.nombre; sub = `${c.categoria} · ${c.zona}`; extra = `Cliente desde ${c.desde}`;
      datos = `<div><dt>Contacto</dt><dd>${esc(c.contacto)} · <a href="tel:+57${c.celular}">${phone(c.celular)}</a></dd></div><div><dt>Zona</dt><dd>${esc(c.zona)}</dd></div>`;
    } else {
      const r = RIDERS.find((x) => x.id === id); if (!r) return;
      lista = all.filter((o) => riderOf(o) === r.id);
      tit = r.nombre; sub = phone(r.celular); extra = 'Repartidor';
      datos = `<div><dt>Celular</dt><dd><a href="tel:+57${r.celular}">${phone(r.celular)}</a></dd></div>`;
    }
    const s2 = resumen(lista);
    currentId = null;
    $('#drawer-body').innerHTML = `
      <div class="ticket">
        <div class="ticket-top"><span class="pill" data-tono="move">${extra}</span></div>
        <h2 id="drawer-title">${esc(tit)}</h2>
        <p class="ticket-sub">${esc(sub)}</p>
        <div class="ticket-amount"><span>${tipoF === 'comercio' ? 'Recaudado hoy' : 'Cobrado hoy'}</span><b>${money(s2.cobrado)}</b></div>
      </div>
      <p class="label">Hoy</p>
      <dl class="st-datos">
        ${dato('cielo', 'Pedidos', s2.total)}${dato('menta', 'Efectividad', s2.efectividad === null ? '—' : s2.efectividad + '%')}${dato('coral', 'Novedades', s2.novedades)}
      </dl>
      <p class="label">Pedidos de hoy</p>
      <ul class="rc-list">${lista.map((o) => `<li><button type="button" data-action="open-order" data-id="${o.id}"><span>${o.codigo}</span><b>${esc(o.nombre)}</b>${pill(o.estado)}</button></li>`).join('') || '<li class="muted">Sin pedidos hoy</li>'}</ul>
      <p class="label">Datos</p>
      <dl class="data">${datos}</dl>`;
    const d = $('#drawer');
    d.dataset.state = 'open'; d.setAttribute('aria-hidden', 'false');
    $('.drawer-panel', d).focus({ preventScroll: true });
  }

  // ---------- Tema: claro / oscuro / auto ----------
  function aplicarTema(t) {
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem('loentrego-admin-tema', t); } catch { /* */ }
    $$('[data-action="tema"]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tema === t)));
    document.dispatchEvent(new CustomEvent('le:tema'));
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
        ${RIDERS.map((r) => `<option value="${r.id}"${riderOf(o) === r.id ? ' selected' : ''}>${r.nombre}</option>`).join('')}
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

  // ---------- Estadísticas: utilidades compartidas (Repartidores y Comercios) ----------
  //  Las cifras de hoy salen de los pedidos; el histórico de la semana es de ejemplo
  //  (determinístico por id) hasta tener el backend.
  const COMERCIOS = [
    { id: 'tienda-central', nombre: 'Tienda Central', categoria: 'Tienda de barrio', celular: '3001112233', zona: 'Chapinero', desde: 'mar 2024' },
    { id: 'moda-kira', nombre: 'Moda Kira', categoria: 'Ropa y accesorios', celular: '3154448899', zona: 'Usaquén', desde: 'jul 2023' },
    { id: 'cafe-origen', nombre: 'Café Origen', categoria: 'Café y tostado', celular: '3205557711', zona: 'Teusaquillo', desde: 'ene 2025' },
    { id: 'libreria-paramo', nombre: 'Librería Páramo', categoria: 'Libros', celular: '3016663322', zona: 'La Candelaria', desde: 'sep 2024' },
    { id: 'verde-market', nombre: 'Verde Market', categoria: 'Mercado orgánico', celular: '3127774455', zona: 'Funza', desde: 'may 2025' },
  ];
  const comercioDe = (o) => o.comercio || 'Tienda Central';
  const semilla = (txt) => { let h = 2166136261; for (const c of String(txt)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296; };
  const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  function semana(id, base) {
    const r = semilla(id);
    return DIAS.map((d, i) => Math.max(0, Math.round(base * (0.55 + r() * 0.9) * (i === 6 ? 0.4 : i === 5 ? 0.75 : 1))));
  }
  const mins = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
  function tiempoEntrega(lista) {
    const t = lista.filter((o) => o.estado === 'entregado').map((o) => {
      const h = o.historial || [], a = h.find((x) => x[0] === 'recogido') || h[0], b = h.find((x) => x[0] === 'entregado');
      return a && b ? mins(b[1]) - mins(a[1]) : null;
    }).filter((x) => x !== null && x >= 0);
    return t.length ? Math.round(t.reduce((s, x) => s + x, 0) / t.length) : null;
  }
  function resumen(lista) {
    const entregados = lista.filter((o) => o.estado === 'entregado').length;
    const novedades = lista.filter((o) => o.estado === 'no_entregado').length;
    const cerrados = entregados + novedades;
    return {
      total: lista.length, entregados, novedades, curso: lista.length - cerrados,
      efectividad: cerrados ? Math.round((entregados / cerrados) * 100) : null,
      cobrado: lista.filter((o) => o.estado === 'entregado').reduce((s, o) => s + (o.cobro || 0), 0),
      porCobrar: lista.filter((o) => !FINALES.includes(o.estado)).reduce((s, o) => s + (o.cobro || 0), 0),
      tiempo: tiempoEntrega(lista),
    };
  }
  // Periodo de las métricas de Repartidores y Comercios. "Día" sale de los pedidos reales;
  // lo demás es de ejemplo hasta tener el backend (vistas v_metricas_repartidor y v_metricas_comercio).
  const PERIODOS_ST = { dia: ['del día', 'hoy', 1], semana: ['de la semana', 'en la semana', 6.2], mes: ['del mes', 'en el mes', 26], '6m': ['de los últimos 6 meses', 'en 6 meses', 150], ano: ['del año', 'en el año', 300], historico: ['de todo el histórico', 'en total', 520] };
  let stPeriodo = 'dia';
  function enPeriodo(id, base, hoy) {
    if (stPeriodo === 'dia') return hoy;
    const r = semilla(id + ':' + stPeriodo);
    const total = Math.round(base * PERIODOS_ST[stPeriodo][2] * (0.85 + r() * 0.3));
    const efectividad = 86 + Math.round(r() * 12);
    const entregados = Math.round((total * efectividad) / 100);
    const ticket = 38000 + Math.round(r() * 30) * 1000;
    return { total, entregados, novedades: total - entregados, curso: 0, efectividad,
      tiempo: 38 + Math.round(r() * 20), cobrado: Math.round(entregados * 0.7) * ticket, porCobrar: hoy.porCobrar, ticket };
  }
  function cabPeriodo(s, conBarra) {
    const [, corto] = PERIODOS_ST[stPeriodo];
    if (stPeriodo === 'dia') {
      const avance = s.total ? Math.round(((s.entregados + s.novedades) / s.total) * 100) : 0;
      return conBarra
        ? `<div class="st-hoy"><span><b>${s.entregados + s.novedades}</b> de ${s.total} pedidos cerrados hoy</span><span class="st-pct">${avance}%</span></div><span class="st-barra"><i style="--w:${avance}%"></i></span>`
        : `<span>${s.total ? `<b>${s.total}</b> pedido${s.total > 1 ? 's' : ''} hoy · ${s.curso} en curso` : 'Sin pedidos hoy'}</span>`;
    }
    const txt = `<b>${s.total.toLocaleString('es-CO')}</b> pedidos ${corto}`;
    return conBarra
      ? `<div class="st-hoy"><span>${txt}</span><span class="st-pct">${s.efectividad}%</span></div><span class="st-barra"><i style="--w:${s.efectividad}%"></i></span>`
      : `<span>${txt}</span>`;
  }
  function kpisPeriodo(lista, sel, quien) {
    const t = lista.reduce((a, s) => ({ total: a.total + s.total, entregados: a.entregados + s.entregados, novedades: a.novedades + s.novedades, curso: a.curso + s.curso, cobrado: a.cobrado + s.cobrado, porCobrar: a.porCobrar + s.porCobrar }), { total: 0, entregados: 0, novedades: 0, curso: 0, cobrado: 0, porCobrar: 0 });
    const cerr = t.entregados + t.novedades;
    const ef = cerr ? Math.round((t.entregados / cerr) * 100) : null;
    const activos = lista.filter((s) => s.total).length;
    const [, corto] = PERIODOS_ST[stPeriodo];
    $$('[data-st-txt]').forEach((el) => { el.textContent = PERIODOS_ST[stPeriodo][0]; });
    $$('[data-st-periodo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stPeriodo === stPeriodo)));
    $(sel).innerHTML = `
      <div class="kpi kpi-hero"><span class="kpi-label">${quien} con pedidos</span><span class="kpi-value">${activos}<small style="font-size:.5em;opacity:.7"> / ${lista.length}</small></span><span class="kpi-foot">${corto}</span></div>
      <div class="kpi" data-tono="cielo"><span class="kpi-label">Pedidos</span><span class="kpi-value">${t.total.toLocaleString('es-CO')}</span><span class="kpi-foot">${stPeriodo === 'dia' ? `${t.curso} en curso` : corto}</span></div>
      <div class="kpi" data-tono="menta"><span class="kpi-label">Efectividad</span><span class="kpi-value">${ef === null ? '—' : ef + '%'}</span><span class="kpi-foot">entregados / cerrados</span></div>
      <div class="kpi" data-tono="ambar"><span class="kpi-label">Recaudo</span><span class="kpi-value" style="font-size:1.6rem">${money(t.cobrado)}</span><span class="kpi-foot">${money(t.porCobrar)} por cobrar ahora</span></div>`;
  }
  function barras(datos, color) {
    const max = Math.max(1, ...datos);
    return `<div class="st-barras" style="--c:${color}">${datos.map((v, i) => `<span title="${DIAS[i]}: ${v} pedidos"><i style="--h:${(v / max) * 100}%"></i><small>${DIAS[i]}</small></span>`).join('')}</div>`;
  }
  const dato = (tono, label, valor, pie = '') => `<div class="st-dato" data-tono="${tono}"><dt>${label}</dt><dd>${valor}</dd>${pie ? `<small>${pie}</small>` : ''}</div>`;
  function zonasDe(riderId) {
    // zonas guardadas por el mapa; si aún no se ha abierto, las iniciales (una por repartidor según el mapa)
    const INICIALES = {};
    try { const d = JSON.parse(localStorage.getItem('loentrego-admin-zonas-v2') || 'null'); return d ? d.zonas.filter((z) => (z.repartidores || []).includes(riderId)).length : (INICIALES[riderId] ?? 0); } catch { return INICIALES[riderId] ?? 0; }
  }

  // ---------- Repartidores: estadísticas por repartidor ----------
  function renderRepartidores() {
    const all = store.all();
    const statsR = RIDERS.map((r) => enPeriodo(r.id, 9, resumen(all.filter((o) => riderOf(o) === r.id))));
    kpisPeriodo(statsR, '#rep-kpis', 'Repartidores');
    $('#riders').innerHTML = RIDERS.map((r, idx) => {
      const s = statsR[idx];
      const color = COLORES_REP[idx % COLORES_REP.length];
      const zonas = zonasDe(r.id);
      return `<article class="st-card" style="--c:${color}">
        <header class="st-cab"><span class="avatar lg rep" style="--c:${color}">${initials(r.nombre)}</span>
          <span class="st-quien"><b>${esc(r.nombre)}</b><small>${phone(r.celular)}</small></span></header>
        ${cabPeriodo(s, true)}
        <dl class="st-datos">
          ${dato('menta', 'Efectividad', s.efectividad === null ? '—' : s.efectividad + '%', 'de los cerrados')}
          ${dato('cielo', 'Tiempo prom.', s.tiempo === null ? '—' : s.tiempo + '<small> min</small>', 'por entrega')}
          ${dato('coral', 'Novedades', s.novedades.toLocaleString('es-CO'), PERIODOS_ST[stPeriodo][1])}
          ${dato('lima', 'Cobrado', money(s.cobrado), 'contraentrega')}
          ${dato('ambar', 'Por cobrar', money(s.porCobrar), 'en ruta ahora')}
          ${dato('lavanda', 'Zonas', zonas === null ? '—' : zonas, 'en el mapa')}
        </dl>
      </article>`;
    }).join('');
  }

  // ---------- Comercios: estadísticas por comercio ----------
  function renderComercios() {
    const all = store.all();
    const filas = COMERCIOS.map((c) => ({ c, lista: all.filter((o) => comercioDe(o) === c.nombre) }));
    filas.forEach((f) => { f.s = enPeriodo(f.c.id, 6 + (f.c.id.length % 5), resumen(f.lista)); });
    kpisPeriodo(filas.map((f) => f.s), '#com-kpis', 'Comercios');
    $('#comercios').innerHTML = filas.sort((a, b) => b.s.total - a.s.total).map(({ c, lista, s }, i) => {
      const color = COLORES_REP[(i + 3) % COLORES_REP.length];
      const reps = [...new Set(lista.map(riderOf))].map((id) => rider(id).nombre.split(' ')[0]);
      const ticket = s.ticket ? s.ticket : lista.filter((o) => o.cobro).length ? Math.round(lista.filter((o) => o.cobro).reduce((x, o) => x + o.cobro, 0) / lista.filter((o) => o.cobro).length) : null;
      return `<article class="st-card" style="--c:${color}">
        <header class="st-cab"><span class="avatar lg rep" style="--c:${color}">${initials(c.nombre)}</span>
          <span class="st-quien"><b>${esc(c.nombre)}</b><small>${esc(c.categoria)} · ${esc(c.zona)}</small></span></header>
        <div class="st-hoy">${cabPeriodo(s, false)}<span class="st-chip">Cliente desde ${esc(c.desde)}</span></div>
        <dl class="st-datos">
          ${dato('menta', 'Efectividad', s.efectividad === null ? '—' : s.efectividad + '%', 'de los cerrados')}
          ${dato('cielo', 'Tiempo prom.', s.tiempo === null ? '—' : s.tiempo + '<small> min</small>', 'por entrega')}
          ${dato('coral', 'Novedades', s.novedades.toLocaleString('es-CO'), PERIODOS_ST[stPeriodo][1])}
          ${dato('lima', 'Recaudado', money(s.cobrado), 'contraentrega')}
          ${dato('ambar', 'Ticket prom.', ticket === null ? '—' : money(ticket), 'por pedido')}
          ${dato('lavanda', 'Repartidores', reps.length || '—', reps.join(', ') || 'sin asignar')}
        </dl>
        <p class="st-contacto">Celular: <b>${phone(c.celular)}</b></p>
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
    const keepFrom = from.value;
    const keepPkg = pkg.value;
    from.innerHTML = '<option value="">Elige quién lo tiene</option>' + RIDERS.map((r) => `<option value="${r.id}">${r.nombre}</option>`).join('');
    from.value = keepFrom;
    const keepTo = to.value !== from.value ? to.value : '';
    to.innerHTML = '<option value="">Elige quién lo entrega ahora</option>' + RIDERS.filter((r) => r.id !== from.value).map((r) => `<option value="${r.id}">${r.nombre}</option>`).join('');
    to.value = keepTo;
    const active = from.value ? all.filter((o) => riderOf(o) === from.value && !FINALES.includes(o.estado)) : [];
    pkg.innerHTML = !from.value
      ? '<option value="">Primero elige el repartidor actual</option>'
      : active.length
        ? '<option value="">Elige el paquete</option>' + active.map((o) => `<option value="${o.id}">${o.codigo} · ${o.nombre} (${ESTADOS[o.estado].label.toLowerCase()})</option>`).join('')
        : '<option value="">No tiene pedidos activos</option>';
    pkg.value = active.some((o) => o.id === keepPkg) ? keepPkg : '';
    pkg.disabled = !active.length;
    $('#btn-exchange').disabled = !(from.value && to.value && pkg.value);

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
    $('#ex-from').value = ''; $('#ex-to').value = ''; $('#ex-package').value = '';
    renderIntercambio();
  }

  // ---------- Acciones (delegación) ----------
  const actions = {
    'sol-contactada': (el) => { saveSol(loadSol().map((x) => (x.id === el.dataset.id ? { ...x, estado: 'contactada' } : x))); renderSolicitudes(); toast('Solicitud marcada como contactada'); },
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
    abrir: (el) => { cerrarBusqueda(); if (el.dataset.tipo === 'pedido') openDrawer(el.dataset.id); else abrirFicha(el.dataset.tipo, el.dataset.id); },
    tema: (el) => aplicarTema(el.dataset.tema),
    logout: () => { localStorage.removeItem('auth_token'); window.location.href = '../index.html'; },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) { const fn = actions[el.dataset.action]; if (fn) { e.preventDefault(); fn(el, e); } return; }
    const rp = e.target.closest('[data-res-periodo]');
    const sp = e.target.closest('[data-st-periodo]');
    if (sp) { stPeriodo = sp.dataset.stPeriodo; renderRepartidores(); renderComercios(); return; }
    if (rp) { resPeriodo = rp.dataset.resPeriodo; $$('[data-res-periodo]').forEach((b) => b.setAttribute('aria-pressed', String(b === rp))); renderResumen(); countUp($('#view-resumen')); return; }
    if (!e.target.closest('.search')) cerrarBusqueda();
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
    if (e.target.id === 'ex-from' || e.target.id === 'ex-to' || e.target.id === 'ex-package') renderIntercambio();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrarBusqueda();
      if ($('#drawer').dataset.state === 'open') closeDrawer();
      $('#account-menu').dataset.state = 'closed';
    }
    // Atajo: "/" enfoca la búsqueda de pedidos
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
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
    $('#search').addEventListener('input', () => { buscar(); if (view === 'pedidos') renderPedidos(); });
    $('#search').addEventListener('focus', buscar);
    aplicarTema(localStorage.getItem('loentrego-admin-tema') || 'auto');
    window.addEventListener('hashchange', () => go(location.hash.slice(1), { push: false }));
    go(location.hash.slice(1) || 'resumen', { push: false });
  });
})();
