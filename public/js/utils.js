// Utilidades compartidas por todas las vistas.

// ---- Plantillas HTML con escape automático (previene XSS con texto escrito por usuarios) ----
class Seguro { constructor(s) { this.s = s; } }
export const raw = (s) => new Seguro(s);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function pintar(v) {
  if (v instanceof Seguro) return v.s;
  if (Array.isArray(v)) return v.map(pintar).join('');
  if (v === null || v === undefined || v === false) return '';
  return esc(v);
}
export function html(partes, ...valores) {
  return new Seguro(partes.reduce((acc, p, i) => acc + p + (i < valores.length ? pintar(valores[i]) : ''), ''));
}
export const montar = (contenedor, plantilla) => { contenedor.innerHTML = plantilla.s; };

// ---- Navegación (hash routing) ----
export const navegar = (ruta) => { location.hash = ruta; };
export function queryString(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  return p.toString();
}

// ---- Formato ----
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const formatoCOP = (n) => cop.format(n);
export const formatoFecha = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
export const iniciales = (nombre = '?') => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const ESTADO_PRODUCTO = {
  disponible: { texto: 'Disponible', clase: 'chip-ok' },
  reservado: { texto: 'Reservado', clase: 'chip-reserved' },
  vendido: { texto: 'Vendido', clase: 'chip-sold' }
};
export const ESTADO_PEDIDO = { creado: 'Creado', pagado: 'Pagado', en_envio: 'En envío' };
export const METODO_PAGO = { tarjeta: 'Tarjeta', pse: 'PSE', mercadopago: 'MercadoPago' };

export function debounce(fn, ms = 350) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---- Notificaciones tipo "toast" ----
export function toast(mensaje, tipo = 'ok') {
  const cont = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'error' ? 'error' : ''}`;
  el.textContent = mensaje;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---- Validación en tiempo real de formularios ----
// reglas: { nombreCampo: (valor, todosLosValores) => 'mensaje de error' | '' }
export function crearValidacion(form, reglas, { dependientes = {}, alCambiar } = {}) {
  const tocados = new Set();
  const valores = () => Object.fromEntries(new FormData(form).entries());

  function mostrar(nombre, mensaje) {
    const campo = form.elements[nombre];
    const zona = form.querySelector(`#e-${nombre}`);
    if (zona) zona.textContent = mensaje || '';
    if (campo && campo.setAttribute) {
      campo.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
      campo.classList.toggle('invalid', Boolean(mensaje));
    }
  }

  function validarCampo(nombre, forzar = false) {
    const regla = reglas[nombre];
    if (!regla) return true;
    const v = valores();
    const mensaje = regla(v[nombre] ?? '', v);
    if (forzar || tocados.has(nombre)) mostrar(nombre, mensaje);
    return !mensaje;
  }

  const esValido = () => { const v = valores(); return Object.keys(reglas).every((n) => !reglas[n](v[n] ?? '', v)); };

  function validarTodo() {
    let primero = null;
    for (const n of Object.keys(reglas)) {
      if (!validarCampo(n, true) && !primero) primero = n;
    }
    if (primero) form.elements[primero]?.focus();
    return !primero;
  }

  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (n) {
      validarCampo(n);
      (dependientes[n] || []).forEach((d) => tocados.has(d) && validarCampo(d));
    }
    alCambiar?.();
  });
  form.addEventListener('focusout', (e) => {
    const n = e.target.name;
    if (n && reglas[n]) { tocados.add(n); validarCampo(n); }
  });

  function errorServidor(detalles = []) {
    detalles.forEach((d) => { tocados.add(d.campo); mostrar(d.campo, d.mensaje); });
    if (detalles[0]) form.elements[detalles[0].campo]?.focus();
  }

  return { esValido, validarTodo, errorServidor, mostrar };
}

// Muestra un mensaje de error general del formulario y lo trae a la vista (el botón suele estar abajo).
export function mostrarAlerta(zona, mensaje) {
  zona.innerHTML = html`<div class="alert alert-error">${mensaje}</div>`.s;
  zona.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export const ponerCargando = (boton, cargando, textoCarga = 'Procesando…') => {
  if (cargando) { boton.dataset.texto = boton.textContent; boton.textContent = textoCarga; }
  else if (boton.dataset.texto) { boton.textContent = boton.dataset.texto; }
  boton.disabled = cargando;
  boton.classList.toggle('loading', cargando);
};

// ---- Imágenes: redimensiona y comprime en el navegador antes de enviarlas ----
export function comprimirImagen(archivo, maxLado = 900, maxBytes = 420 * 1024) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // fondo blanco para PNG con transparencia
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      let calidad = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', calidad);
      while (dataUrl.length * 0.75 > maxBytes && calidad > 0.35) {
        calidad -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', calidad);
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

// Algoritmo de Luhn (mismo que el backend) para validar la tarjeta mientras se escribe.
export function luhn(numero) {
  const d = String(numero).replace(/\s|-/g, '');
  if (!/^\d{13,19}$/.test(d)) return false;
  let suma = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    suma += n; alt = !alt;
  }
  return suma % 10 === 0;
}
