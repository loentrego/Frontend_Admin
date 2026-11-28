# Panel de sistema

UI aparte del panel de operación (`Pages/paneladmin.html`). Comparte solo los logos de `img/`: tiene su propio login, HTML, estilos y código.

| Archivo | Qué es |
|---|---|
| `index.html` + `login.js` | Acceso técnico. Prueba: usuario `sistema`, clave `sistema123` (temporal, sin backend). La sesión dura mientras la pestaña esté abierta. |
| `panel.html` + `sistema.js` + `sistema.css` | El panel. |

## Secciones

- **Estado**: salud general, alertas, CPU, memoria, disco, red, servicios (Nginx, API, PostgreSQL, Redis, fail2ban) y sitios.
- **Recursos**: gráficas de CPU, memoria y red en vivo (cada 5 s) o de 24 h; carga, conexiones a la base y disco libre.
- **Canales**: el "Estado de los servicios" que muestra la página de mantenimiento (tabla `estado_canales`).
- **Mantenimiento**: poner un sitio en mantenimiento ya, o programarlo con inicio, regreso y mensaje (tabla `mantenimientos`).
- **Nginx**: habilitar o deshabilitar archivos de `sites-available`; "Probar y aplicar" corre `nginx -t` y recarga solo si pasa. La configuración no se edita aquí.
- **Respaldos y HTTPS**: último respaldo, respaldar ahora y días que le quedan a cada certificado.
- **Seguridad**: intentos de ingreso fallidos, IPs bloqueadas por fail2ban (con desbloquear) y errores 5xx recientes.

## Datos

Todo pasa por la API (`/api/sistema/…`, ver Técnico). Sin backend, el panel dice "Sin conexión" y ofrece **Ver con datos de ejemplo**, marcados como tales; esos cambios solo se guardan en el navegador.

## Seguridad

- La API debe aceptar estas rutas solo para usuarios con rol `sistema`.
- Las acciones sobre el servidor (Nginx, mantenimiento, fail2ban, respaldos) las ejecuta la API con scripts fijos autorizados en `sudoers`, nunca comandos libres.
- Recomendado: restringir `/sistema/` por IP en Nginx (ejemplo comentado en `backend_loentrego/nginx/loentrego.conf`).
