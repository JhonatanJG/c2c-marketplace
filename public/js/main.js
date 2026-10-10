// Punto de entrada del frontend: enrutador (hash), barra superior y manejo de sesión.
import { session, restaurarSesion, cerrarSesion, eventos, ApiError } from './api.js';
import { html, montar, navegar, queryString, toast, iniciales } from './utils.js';
import * as auth from './views/auth.js';
import * as catalog from './views/catalog.js';
import * as sell from './views/sell.js';
import * as orders from './views/orders.js';

const app = document.getElementById('app');
const acciones = document.getElementById('nav-actions');
const formBusqueda = document.getElementById('search-form');
const campoBusqueda = document.getElementById('q');

// Tabla de rutas: patrón -> vista. "privada" exige sesión; "soloInvitado" redirige si ya hay sesión.
const rutas = [
  { patron: /^\/$/, vista: catalog.explorar },
  { patron: /^\/producto\/([^/]+)$/, vista: catalog.detalle },
  { patron: /^\/registro$/, vista: auth.registro, soloInvitado: true },
  { patron: /^\/login$/, vista: auth.login, soloInvitado: true },
  { patron: /^\/vender$/, vista: sell.publicar, privada: true },
  { patron: /^\/mis-publicaciones$/, vista: sell.misPublicaciones, privada: true },
  { patron: /^\/checkout\/([^/]+)$/, vista: orders.checkout, privada: true },
  { patron: /^\/pedido\/([^/]+)$/, vista: orders.recibo, privada: true },
  { patron: /^\/mis-pedidos$/, vista: orders.misPedidos, privada: true }
];

function leerHash() {
  const [ruta, qs = ''] = (location.hash.slice(1) || '/').split('?');
  return { ruta, query: Object.fromEntries(new URLSearchParams(qs)) };
}

let ultimoRender = 0; // evita que una respuesta lenta pise a una navegación más reciente

async function enrutar() {
  const id = ++ultimoRender;
  const { ruta, query } = leerHash();
  const definicion = rutas.find((r) => r.patron.test(ruta));

  campoBusqueda.value = ruta === '/' ? query.search || '' : '';

  if (!definicion) {
    montar(app, html`<div class="empty"><div class="big" aria-hidden="true">🧭</div><h1>Página no encontrada</h1><a class="btn btn-primary" href="#/">Ir al inicio</a></div>`);
    return;
  }
  if (definicion.privada && !session.token) {
    navegar(`/login?${queryString({ next: location.hash.slice(1) })}`);
    return;
  }
  if (definicion.soloInvitado && session.token) {
    navegar('/');
    return;
  }

  montar(app, html`<div class="loading" role="status">Cargando…</div>`);
  try {
    await definicion.vista({ app, params: definicion.patron.exec(ruta).slice(1), query, activo: () => id === ultimoRender });
  } catch (err) {
    if (id !== ultimoRender) return;
    if (err instanceof ApiError && err.status === 401 && definicion.privada) return; // la sesión se cerró: eventos 'sesion' redirige
    console.error(err);
    montar(app, html`
      <div class="empty"><div class="big" aria-hidden="true">⚠️</div>
        <h1>${err instanceof ApiError ? err.message : 'Algo salió mal'}</h1>
        <p>${err instanceof ApiError ? '' : 'Intenta recargar la página.'}</p>
        <a class="btn btn-primary" href="#/">Volver al catálogo</a></div>`);
  }
  if (id === ultimoRender) {
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }
}

// ---- Barra superior: acciones según la sesión ----
function pintarAcciones() {
  if (!session.token) {
    montar(acciones, html`
      <a class="btn" href="#/login">Ingresar</a>
      <a class="btn btn-primary" href="#/registro">Registrarse</a>`);
    return;
  }
  const u = session.usuario;
  montar(acciones, html`
    <a class="btn btn-accent" href="#/vender">+ Vender</a>
    <details class="menu" id="menu-usuario">
      <summary class="btn" aria-label="Menú de usuario"><span class="avatar" style="width:28px;height:28px;font-size:.8rem" aria-hidden="true">${iniciales(u.nombre)}</span> ${u.nombre.split(' ')[0]} ▾</summary>
      <div class="menu-panel">
        <div class="menu-user">${u.email}</div>
        <a href="#/mis-publicaciones">Mis publicaciones</a>
        <a href="#/mis-pedidos">Mis compras</a>
        <a href="#/mis-pedidos?rol=vendedor">Mis ventas</a>
        <hr>
        <button type="button" id="btn-salir">Cerrar sesión</button>
      </div>
    </details>`);
  document.getElementById('btn-salir').addEventListener('click', () => {
    cerrarSesion();
    toast('Sesión cerrada.');
    navegar('/');
  });
}

eventos.addEventListener('sesion', () => {
  pintarAcciones();
  if (!session.token && rutas.find((r) => r.patron.test(leerHash().ruta))?.privada) {
    toast('Tu sesión terminó. Inicia sesión de nuevo.', 'error');
    navegar(`/login?${queryString({ next: location.hash.slice(1) })}`);
  }
});

// Cierra el menú de usuario al hacer clic fuera o al navegar
document.addEventListener('click', (e) => {
  const menu = document.getElementById('menu-usuario');
  if (menu?.open && (!menu.contains(e.target) || e.target.closest('.menu-panel a'))) menu.open = false;
});

// HU-03: la búsqueda de la barra superior lleva al catálogo con ?search=
formBusqueda.addEventListener('submit', (e) => {
  e.preventDefault();
  navegar(`/?${queryString({ search: campoBusqueda.value.trim() })}`);
});

window.addEventListener('hashchange', enrutar);

(async () => {
  await restaurarSesion();
  pintarAcciones();
  enrutar();
})();
