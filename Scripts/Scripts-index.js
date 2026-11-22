// ============ Admin · Inicio de sesión ============
(() => {
  'use strict';

  // ⚠️ TEMPORAL: cuenta de prueba mientras no hay backend.
  // Entra al panel sin llamar a la API. QUITAR al conectar los endpoints.
  const DEMO = { usuario: 'admin', password: 'admin123' };

  const $ = (id) => document.getElementById(id);
  const form = $('login-form');
  const user = $('usuario');
  const pass = $('password');
  const btn = $('submit-btn');
  const formError = $('form-error');

  function fieldError(input, msg) {
    const hint = $('err-' + input.id);
    input.setAttribute('aria-invalid', String(Boolean(msg)));
    input.classList.toggle('invalid', Boolean(msg));
    if (hint) hint.textContent = msg || '';
  }

  function shake() {
    const card = document.querySelector('.card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  }

  $('toggle-pass').addEventListener('click', (e) => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(show));
    e.currentTarget.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  [user, pass].forEach((i) => i.addEventListener('input', () => { fieldError(i, ''); formError.textContent = ''; }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    formError.textContent = '';
    const u = user.value.trim();
    const p = pass.value;
    fieldError(user, u ? '' : 'Ingresa tu usuario.');
    fieldError(pass, p ? '' : 'Ingresa tu contraseña.');
    if (!u || !p) { shake(); (u ? pass : user).focus(); return; }

    btn.disabled = true;
    btn.querySelector('.submit-text').textContent = 'Entrando…';
    setTimeout(() => {
      if (u.toLowerCase() === DEMO.usuario && p === DEMO.password) {
        localStorage.setItem('auth_token', 'demo-admin');
        document.body.classList.add('leaving');
        setTimeout(() => { window.location.href = 'Pages/paneladmin.html'; }, 350);
        return;
      }
      // Aquí irá la llamada a la API de autenticación real
      formError.textContent = 'Usuario o contraseña incorrectos.';
      btn.disabled = false;
      btn.querySelector('.submit-text').textContent = 'Entrar al panel';
      pass.value = '';
      pass.focus();
      shake();
    }, 450);
  });
})();
