// HU-01: Registro de usuarios (+ inicio de sesión).
import { api, iniciarSesion, ApiError } from '../api.js';
import { html, montar, crearValidacion, ponerCargando, navegar, toast, mostrarAlerta } from '../utils.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO_RE = /^\+?[0-9\s-]{7,15}$/;

// Fortaleza de la contraseña: 1 = débil (no permitida), 2 = media, 3 = fuerte.
export function evaluarPassword(p) {
  if (!p) return { nivel: 0, texto: '' };
  const base = p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  if (!base) return { nivel: 1, texto: 'Débil: usa 8 o más caracteres con letras y números.' };
  const extras = [/[a-z]/.test(p) && /[A-Z]/.test(p), /[^A-Za-z0-9]/.test(p), p.length >= 12].filter(Boolean).length;
  return extras >= 2 ? { nivel: 3, texto: 'Contraseña fuerte.' } : { nivel: 2, texto: 'Media: añade mayúsculas, símbolos o más longitud.' };
}

const destinoSeguro = (next) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/');

const campoPassword = (id, etiqueta, autocompletar) => html`
  <div class="field">
    <label for="f-${id}">${etiqueta} <span class="req" aria-hidden="true">*</span></label>
    <div class="password-wrap">
      <input id="f-${id}" name="${id}" type="password" autocomplete="${autocompletar}" aria-describedby="e-${id}" required>
      <button type="button" class="toggle-pass" data-target="f-${id}" aria-label="Mostrar u ocultar ${etiqueta.toLowerCase()}">Ver</button>
    </div>
    <p class="field-error" id="e-${id}" role="alert"></p>
  </div>`;

function activarVerPassword(form) {
  form.querySelectorAll('.toggle-pass').forEach((b) => b.addEventListener('click', () => {
    const input = form.querySelector(`#${b.dataset.target}`);
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    b.textContent = mostrar ? 'Ocultar' : 'Ver';
  }));
}

export async function registro({ app, query }) {
  montar(app, html`
    <section class="panel narrow">
      <h1>Crea tu cuenta</h1>
      <p class="muted">Regístrate para comprar y vender productos en la red C2C.</p>
      <div id="form-alert" role="alert"></div>
      <form id="form-registro" novalidate>
        <div class="field">
          <label for="f-nombre">Nombre completo <span class="req" aria-hidden="true">*</span></label>
          <input id="f-nombre" name="nombre" autocomplete="name" aria-describedby="e-nombre" required maxlength="60">
          <p class="field-error" id="e-nombre" role="alert"></p>
        </div>
        <div class="field">
          <label for="f-email">Correo electrónico <span class="req" aria-hidden="true">*</span></label>
          <input id="f-email" name="email" type="email" autocomplete="email" aria-describedby="e-email" required>
          <p class="field-error" id="e-email" role="alert"></p>
        </div>
        <div class="field">
          <label for="f-telefono">Teléfono <span class="req" aria-hidden="true">*</span></label>
          <input id="f-telefono" name="telefono" type="tel" autocomplete="tel" inputmode="tel" aria-describedby="e-telefono" required placeholder="3001234567">
          <p class="field-error" id="e-telefono" role="alert"></p>
        </div>
        ${campoPassword('password', 'Contraseña', 'new-password')}
        <div class="strength" id="fuerza" data-nivel="0" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="strength-text" id="fuerza-texto" aria-live="polite"></p>
        ${campoPassword('confirmar', 'Confirmar contraseña', 'new-password')}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Crear cuenta</button>
      </form>
      <p class="muted" style="margin-top:16px">¿Ya tienes cuenta? <a href="#/login${query.next ? `?next=${encodeURIComponent(query.next)}` : ''}">Inicia sesión</a></p>
    </section>`);

  const form = app.querySelector('#form-registro');
  const alerta = app.querySelector('#form-alert');
  const boton = form.querySelector('button[type="submit"]');
  activarVerPassword(form);

  const validacion = crearValidacion(form, {
    nombre: (v) => (v.trim().length < 2 ? 'El nombre es obligatorio.' : ''),
    email: (v) => (!v.trim() ? 'El correo es obligatorio.' : !EMAIL_RE.test(v.trim()) ? 'Escribe un correo válido, por ejemplo nombre@dominio.com.' : ''),
    telefono: (v) => (!v.trim() ? 'El teléfono es obligatorio.' : !TELEFONO_RE.test(v.trim()) ? 'Escribe un teléfono válido (7 a 15 dígitos).' : ''),
    password: (v) => (!v ? 'La contraseña es obligatoria.' : v.length < 8 ? 'Usa mínimo 8 caracteres.' : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Combina letras y números.' : ''),
    confirmar: (v, t) => (!v ? 'Confirma tu contraseña.' : v !== t.password ? 'Las contraseñas no coinciden.' : '')
  }, { dependientes: { password: ['confirmar'] } });

  // Medidor de fortaleza en tiempo real
  form.elements.password.addEventListener('input', (e) => {
    const { nivel, texto } = evaluarPassword(e.target.value);
    app.querySelector('#fuerza').dataset.nivel = nivel;
    app.querySelector('#fuerza-texto').textContent = texto;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alerta.innerHTML = '';
    if (!validacion.validarTodo()) return;

    const { nombre, email, telefono, password } = Object.fromEntries(new FormData(form));
    ponerCargando(boton, true, 'Creando cuenta…');
    try {
      const datos = await api('POST', '/auth/register', { nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim(), password });
      iniciarSesion(datos);
      toast(`¡Bienvenido, ${datos.usuario.nombre.split(' ')[0]}! Tu cuenta fue creada.`);
      navegar(destinoSeguro(query.next));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.detalles.length) validacion.errorServidor(err.detalles);
      else mostrarAlerta(alerta, err.message);
    } finally {
      ponerCargando(boton, false);
    }
  });
}

export async function login({ app, query }) {
  montar(app, html`
    <section class="panel narrow">
      <h1>Iniciar sesión</h1>
      <p class="muted">Ingresa para publicar y comprar productos.</p>
      <div class="alert alert-info">Cuentas de prueba: <strong>ana@demo.com</strong> o <strong>luis@demo.com</strong> · contraseña <strong>Demo1234</strong></div>
      <div id="form-alert" role="alert"></div>
      <form id="form-login" novalidate>
        <div class="field">
          <label for="f-email">Correo electrónico</label>
          <input id="f-email" name="email" type="email" autocomplete="email" aria-describedby="e-email" required>
          <p class="field-error" id="e-email" role="alert"></p>
        </div>
        ${campoPassword('password', 'Contraseña', 'current-password')}
        <button class="btn btn-primary btn-block btn-lg" type="submit">Ingresar</button>
      </form>
      <p class="muted" style="margin-top:16px">¿No tienes cuenta? <a href="#/registro${query.next ? `?next=${encodeURIComponent(query.next)}` : ''}">Regístrate</a></p>
    </section>`);

  const form = app.querySelector('#form-login');
  const alerta = app.querySelector('#form-alert');
  const boton = form.querySelector('button[type="submit"]');
  activarVerPassword(form);

  const validacion = crearValidacion(form, {
    email: (v) => (!v.trim() ? 'El correo es obligatorio.' : !EMAIL_RE.test(v.trim()) ? 'Escribe un correo válido.' : ''),
    password: (v) => (!v ? 'La contraseña es obligatoria.' : '')
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alerta.innerHTML = '';
    if (!validacion.validarTodo()) return;
    const { email, password } = Object.fromEntries(new FormData(form));
    ponerCargando(boton, true, 'Ingresando…');
    try {
      const datos = await api('POST', '/auth/login', { email: email.trim(), password });
      iniciarSesion(datos);
      toast(`Hola de nuevo, ${datos.usuario.nombre.split(' ')[0]}.`);
      navegar(destinoSeguro(query.next));
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      mostrarAlerta(alerta, err.message);
    } finally {
      ponerCargando(boton, false);
    }
  });
}
