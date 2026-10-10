// Capa de acceso al backend: sesión (JWT) + wrapper de fetch hacia /api (pasa por el proxy inverso).
const CLAVE = 'c2c.sesion';

export const session = { token: null, usuario: null };
export const eventos = new EventTarget(); // emite "sesion" cuando cambia el estado de autenticación

export class ApiError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles || [];
  }
}

// El almacenamiento del navegador puede no estar disponible (modo privado): siempre con try/catch.
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(session)); } catch { /* sin persistencia */ }
}

export function iniciarSesion({ token, usuario }) {
  session.token = token;
  session.usuario = usuario;
  guardar();
  eventos.dispatchEvent(new Event('sesion'));
}

export function cerrarSesion() {
  session.token = null;
  session.usuario = null;
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
  eventos.dispatchEvent(new Event('sesion'));
}

// Al cargar la página: recupera el token guardado y lo valida contra el backend.
export async function restaurarSesion() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE));
    if (!guardada?.token) return;
    session.token = guardada.token;
    session.usuario = guardada.usuario;
    const { usuario } = await api('GET', '/auth/me');
    session.usuario = usuario;
  } catch {
    cerrarSesion();
  }
}

export async function api(metodo, ruta, cuerpo) {
  const headers = {};
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(`/api${ruta}`, { method: metodo, headers, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }

  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && session.token) cerrarSesion(); // token vencido o inválido
    throw new ApiError(res.status, datos?.error || 'Ocurrió un error inesperado.', datos?.detalles);
  }
  return datos;
}

let categoriasCache = null;
export async function obtenerCategorias() {
  if (!categoriasCache) categoriasCache = (await api('GET', '/products/categories')).data;
  return categoriasCache;
}
