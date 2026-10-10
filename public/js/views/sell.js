// HU-02: publicación de un producto para la venta  ·  listado de mis publicaciones.
import { api, obtenerCategorias, ApiError } from '../api.js';
import { html, montar, crearValidacion, ponerCargando, navegar, toast, formatoCOP, comprimirImagen, mostrarAlerta } from '../utils.js';
import { tarjetaProducto } from './catalog.js';

const MAX_IMAGENES = 4;

export async function publicar({ app }) {
  const categorias = await obtenerCategorias();
  const imagenes = []; // data URLs ya comprimidas, en el orden en que se mostrarán

  montar(app, html`
    <section class="panel narrow" style="max-width:720px">
      <h1>Publica un producto</h1>
      <p class="muted">Completa los datos. El botón se activa cuando todos los campos obligatorios estén correctos.</p>
      <div id="form-alert" role="alert"></div>
      <form id="form-producto" novalidate>
        <div class="field">
          <label for="f-titulo">Título <span class="req" aria-hidden="true">*</span></label>
          <input id="f-titulo" name="titulo" maxlength="80" aria-describedby="e-titulo" required placeholder="Ej: Bicicleta de montaña rin 29">
          <p class="field-error" id="e-titulo" role="alert"></p>
        </div>
        <div class="field">
          <label for="f-descripcion">Descripción <span class="req" aria-hidden="true">*</span></label>
          <textarea id="f-descripcion" name="descripcion" maxlength="1000" aria-describedby="e-descripcion h-desc" required placeholder="Estado, características, accesorios incluidos…"></textarea>
          <p class="hint" id="h-desc"><span id="contador">0</span>/1000 caracteres (mínimo 10)</p>
          <p class="field-error" id="e-descripcion" role="alert"></p>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label for="f-precio">Precio (COP) <span class="req" aria-hidden="true">*</span></label>
            <input id="f-precio" name="precio" type="number" min="1" step="1" inputmode="numeric" aria-describedby="e-precio h-precio" required placeholder="150000">
            <p class="hint" id="h-precio" aria-live="polite"></p>
            <p class="field-error" id="e-precio" role="alert"></p>
          </div>
          <div class="field">
            <label for="f-categoria">Categoría <span class="req" aria-hidden="true">*</span></label>
            <select id="f-categoria" name="categoria" aria-describedby="e-categoria" required>
              <option value="">Selecciona…</option>
              ${categorias.map((c) => html`<option value="${c.id}">${c.nombre}</option>`)}
            </select>
            <p class="field-error" id="e-categoria" role="alert"></p>
          </div>
        </div>

        <div class="field">
          <span class="label">Imágenes <span class="req" aria-hidden="true">*</span></span>
          <div class="dropzone">
            <label for="f-imagenes">Elige hasta ${MAX_IMAGENES} fotos (JPG, PNG o WEBP). La primera será la principal.</label>
            <input id="f-imagenes" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby="e-imagenes">
          </div>
          <p class="field-error" id="e-imagenes" role="alert"></p>
          <div class="previews" id="previews" aria-live="polite"></div>
        </div>

        <button class="btn btn-primary btn-block btn-lg" id="btn-publicar" type="submit" disabled>Publicar producto</button>
      </form>
    </section>`);

  const form = app.querySelector('#form-producto');
  const boton = app.querySelector('#btn-publicar');
  const alerta = app.querySelector('#form-alert');
  const errorImagenes = app.querySelector('#e-imagenes');

  // Botón de envío deshabilitado hasta que todo sea válido (incluye al menos 1 imagen)
  const actualizarBoton = () => { boton.disabled = !(validacion.esValido() && imagenes.length > 0); };

  const validacion = crearValidacion(form, {
    titulo: (v) => (v.trim().length < 3 ? 'El título es obligatorio (mínimo 3 caracteres).' : ''),
    descripcion: (v) => (v.trim().length < 10 ? 'La descripción es obligatoria (mínimo 10 caracteres).' : ''),
    precio: (v) => (!(Number(v) > 0) ? 'Ingresa un precio mayor que 0.' : ''),
    categoria: (v) => (!v ? 'Selecciona una categoría.' : '')
  }, { alCambiar: actualizarBoton });

  form.elements.descripcion.addEventListener('input', (e) => { app.querySelector('#contador').textContent = e.target.value.length; });
  form.elements.precio.addEventListener('input', (e) => {
    app.querySelector('#h-precio').textContent = Number(e.target.value) > 0 ? formatoCOP(Number(e.target.value)) : '';
  });

  // Previsualización de las imágenes antes de confirmar la publicación
  function pintarPrevios() {
    app.querySelector('#previews').innerHTML = html`${imagenes.map((src, i) => html`
      <div class="preview">
        <img src="${src}" alt="Vista previa de la imagen ${i + 1}">
        ${i === 0 ? html`<span class="principal">Principal</span>` : ''}
        <button type="button" data-i="${i}" aria-label="Quitar imagen ${i + 1}">×</button>
      </div>`)}`.s;
    errorImagenes.textContent = imagenes.length ? '' : errorImagenes.textContent;
  }

  app.querySelector('#previews').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    imagenes.splice(Number(b.dataset.i), 1);
    pintarPrevios();
    actualizarBoton();
  });

  app.querySelector('#f-imagenes').addEventListener('change', async (e) => {
    const archivos = [...e.target.files];
    e.target.value = '';
    errorImagenes.textContent = '';
    for (const archivo of archivos) {
      if (imagenes.length >= MAX_IMAGENES) { errorImagenes.textContent = `Máximo ${MAX_IMAGENES} imágenes por producto.`; break; }
      if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) { errorImagenes.textContent = 'Solo se permiten imágenes JPG, PNG o WEBP.'; continue; }
      try { imagenes.push(await comprimirImagen(archivo)); }
      catch { errorImagenes.textContent = `No se pudo procesar “${archivo.name}”.`; }
    }
    pintarPrevios();
    actualizarBoton();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alerta.innerHTML = '';
    if (!validacion.validarTodo() || !imagenes.length) return;
    const v = Object.fromEntries(new FormData(form));
    ponerCargando(boton, true, 'Publicando…');
    try {
      const { producto } = await api('POST', '/products', {
        titulo: v.titulo.trim(), descripcion: v.descripcion.trim(), precio: Number(v.precio), categoria: v.categoria, imagenes
      });
      toast('¡Producto publicado con éxito!');
      navegar(`/producto/${producto.id}`);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.detalles.length) validacion.errorServidor(err.detalles);
      else mostrarAlerta(alerta, err.message);
      ponerCargando(boton, false);
      actualizarBoton();
    }
  });
}

export async function misPublicaciones({ app, activo }) {
  const { data } = await api('GET', '/products/mine');
  if (!activo()) return;
  montar(app, html`
    <div class="page-head">
      <h1>Mis publicaciones</h1>
      <a class="btn btn-primary" href="#/vender">+ Publicar producto</a>
    </div>
    ${data.length === 0 ? html`
      <div class="empty"><div class="big" aria-hidden="true">📦</div>
        <h2>Aún no has publicado productos</h2>
        <p>Publica tu primer producto y empieza a vender.</p></div>`
    : html`<div class="grid">${data.map(tarjetaProducto)}</div>`}`);
}
