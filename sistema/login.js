// =====================================================================
//  LoEntrego · Panel de sistema · Inicio de sesión
//  ⚠️ TEMPORAL: cuenta de prueba mientras no hay backend (usuario "sistema").
//  Con la API: POST /api/login y entra solo un usuario con rol "sistema".
// =====================================================================
(() => {
  'use strict';
  const DEMO = { usuario: 'sistema', clave: 'sistema123' };
  const $ = (id) => document.getElementById(id);
  const form = $('form'), error = $('error'), btn = $('entrar');

  if (sessionStorage.getItem('loentrego-sistema-token')) { location.replace('panel.html'); return; }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = $('usuario').value.trim().toLowerCase(), c = $('clave').value;
    error.textContent = '';
    if (!u || !c) { error.textContent = 'Escribe tu usuario y tu contraseña.'; return; }
    btn.disabled = true; btn.textContent = 'Entrando…';
    setTimeout(() => {
      if (u === DEMO.usuario && c === DEMO.clave) {
        // La sesión técnica dura solo mientras la pestaña esté abierta
        sessionStorage.setItem('loentrego-sistema-token', 'demo-sistema');
        location.href = 'panel.html';
        return;
      }
      error.textContent = 'Usuario o contraseña incorrectos.';
      btn.disabled = false; btn.textContent = 'Entrar';
      $('clave').value = ''; $('clave').focus();
    }, 400);
  });
})();
