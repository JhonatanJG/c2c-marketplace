// HU-03: búsqueda y filtrado de productos  ·  detalle del producto (entrada a HU-04).
import { api, obtenerCategorias, session } from '../api.js';
import { html, raw, montar, navegar, queryString, formatoCOP, formatoFecha, iniciales, ESTADO_PRODUCTO } from '../utils.js';

export const tarjetaProducto = (p) => html`
  <a class="card" href="#/producto/${p.id}">
    <img class="card-img" src="${p.imagenes[0]}" alt="${p.titulo}" loading="lazy">
    <div class="card-body">
      <h3 class="card-title">${p.titulo}</h3>
      <span class="price">${formatoCOP(p.precio)}</span>
      <div class="card-meta">
        <span>${p.vendedorNombre}</span>
        ${p.estado !== 'disponible' ? html`<span class="chip ${ESTADO_PRODUCTO[p.estado].clase}">${ESTADO_PRODUCTO[p.estado].texto}</span>` : ''}
      </div>
    </div>
  </a>`;

export async function explorar({ app, query, activo }) {
  const categorias = await obtenerCategorias();
  const f = {
    search: query.search || '', category: query.category || '',
    minPrice: query.minPrice || '', maxPrice: query.maxPrice || '',
    sort: query.sort || 'recientes', limit: query.limit || '8', page: query.page || '1'
  };
  const respuesta = await api('GET', `/products?${queryString(f)}`);
  if (!activo()) return;
  const { data, pagination } = respuesta;

  const enlacePagina = (n) => `#/?${queryString({ ...f, page: n > 1 ? n : '' })}`;
  const hayFiltros = f.search || f.category || f.minPrice || f.maxPrice;

  montar(app, html`
    <div class="page-head">
      <h1>${f.search ? `Resultados para “${f.search}”` : 'Explora productos'}</h1>
      <p class="muted" aria-live="polite">${pagination.total} ${pagination.total === 1 ? 'producto' : 'productos'}</p>
    </div>

    <div class="explorar-grid">
      <aside>
        <details class="filters" id="filtros">
          <summary>Filtros</summary>
          <form id="form-filtros" novalidate>
            <fieldset>
              <legend>Categoría</legend>
              <label class="radio-row"><input type="radio" name="category" value="" ${!f.category ? raw('checked') : ''}> Todas</label>
              ${categorias.map((c) => html`
                <label class="radio-row"><input type="radio" name="category" value="${c.id}" ${f.category === c.id ? raw('checked') : ''}> ${c.nombre}</label>`)}
            </fieldset>

            <fieldset>
              <legend>Rango de precio (COP)</legend>
              <div class="price-row">
                <div><label class="sr-only" for="minPrice">Precio mínimo</label><input id="minPrice" name="minPrice" type="number" min="0" step="1000" placeholder="Mín." value="${f.minPrice}"></div>
                <div><label class="sr-only" for="maxPrice">Precio máximo</label><input id="maxPrice" name="maxPrice" type="number" min="0" step="1000" placeholder="Máx." value="${f.maxPrice}"></div>
              </div>
              <p class="field-error" id="e-precio" role="alert"></p>
            </fieldset>

            <div class="field">
              <label for="sort">Ordenar por</label>
              <select id="sort" name="sort">
                <option value="recientes" ${f.sort === 'recientes' ? raw('selected') : ''}>Más recientes</option>
                <option value="precio_asc" ${f.sort === 'precio_asc' ? raw('selected') : ''}>Precio: menor a mayor</option>
                <option value="precio_desc" ${f.sort === 'precio_desc' ? raw('selected') : ''}>Precio: mayor a menor</option>
              </select>
            </div>
            <div class="field">
              <label for="limit">Resultados por página</label>
              <select id="limit" name="limit">
                ${['8', '12', '24'].map((n) => html`<option value="${n}" ${f.limit === n ? raw('selected') : ''}>${n}</option>`)}
              </select>
            </div>
            <button class="btn btn-primary btn-block" type="submit">Aplicar filtros</button>
            ${hayFiltros ? html`<p style="text-align:center;margin:12px 0 0"><a href="#/">Limpiar filtros</a></p>` : ''}
          </form>
        </details>
      </aside>

      <section aria-label="Resultados">
        ${data.length === 0 ? html`
          <div class="empty"><div class="big" aria-hidden="true">🔍</div>
            <h2>No encontramos productos</h2>
            <p>Prueba con otras palabras o ajusta los filtros.</p>
            <a class="btn" href="#/">Ver todos los productos</a></div>`
        : html`<div class="grid">${data.map(tarjetaProducto)}</div>`}

        ${pagination.totalPages > 1 ? html`
          <nav class="pagination" aria-label="Paginación">
            <a class="btn" href="${enlacePagina(pagination.page - 1)}" ${pagination.page <= 1 ? raw('aria-disabled="true" tabindex="-1"') : ''}>← Anterior</a>
            <span>Página ${pagination.page} de ${pagination.totalPages}</span>
            <a class="btn" href="${enlacePagina(pagination.page + 1)}" ${pagination.page >= pagination.totalPages ? raw('aria-disabled="true" tabindex="-1"') : ''}>Siguiente →</a>
          </nav>` : ''}
      </section>
    </div>`);

  // Filtros desplegables en móvil, laterales (abiertos) en escritorio
  const panel = app.querySelector('#filtros');
  if (window.matchMedia('(min-width: 900px)').matches) panel.open = true;

  const form = app.querySelector('#form-filtros');
  const aplicar = () => {
    const v = Object.fromEntries(new FormData(form));
    const min = v.minPrice === '' ? null : Number(v.minPrice);
    const max = v.maxPrice === '' ? null : Number(v.maxPrice);
    const error = form.querySelector('#e-precio');
    if (min !== null && max !== null && min > max) { error.textContent = 'El precio mínimo no puede superar al máximo.'; return; }
    error.textContent = '';
    navegar(`/?${queryString({ search: f.search, category: v.category, minPrice: v.minPrice, maxPrice: v.maxPrice, sort: v.sort !== 'recientes' ? v.sort : '', limit: v.limit !== '8' ? v.limit : '' })}`);
  };
  form.addEventListener('submit', (e) => { e.preventDefault(); aplicar(); });
  form.addEventListener('change', (e) => { if (e.target.name !== 'minPrice' && e.target.name !== 'maxPrice') aplicar(); });
}

export async function detalle({ app, params, activo }) {
  const { producto: p } = await api('GET', `/products/${params[0]}`);
  if (!activo()) return;

  const categorias = await obtenerCategorias();
  const categoria = categorias.find((c) => c.id === p.categoria)?.nombre || p.categoria;
  const estado = ESTADO_PRODUCTO[p.estado];
  const esMio = session.usuario?.id === p.vendedorId;
  const disponible = p.estado === 'disponible';

  let boton;
  if (esMio) boton = html`<button class="btn btn-block btn-lg" disabled>Es tu publicación</button>`;
  else if (!disponible) boton = html`<button class="btn btn-block btn-lg" disabled>${estado.texto}</button>`;
  else boton = html`<a class="btn btn-accent btn-block btn-lg" id="btn-comprar" href="#/checkout/${p.id}">Comprar ahora</a>`;

  montar(app, html`
    <p><a href="#/">← Volver al catálogo</a></p>
    <div class="detail">
      <div>
        <img class="gallery-main" id="galeria" src="${p.imagenes[0]}" alt="${p.titulo}">
        ${p.imagenes.length > 1 ? html`
          <div class="thumbs" role="group" aria-label="Imágenes del producto">
            ${p.imagenes.map((src, i) => html`
              <button type="button" data-src="${src}" aria-label="Ver imagen ${i + 1}" aria-current="${String(i === 0)}"><img src="${src}" alt=""></button>`)}
          </div>` : ''}
      </div>

      <div class="panel">
        <span class="chip">${categoria}</span> <span class="chip ${estado.clase}">${estado.texto}</span>
        <h1 style="margin-top:12px">${p.titulo}</h1>
        <div class="detail-price">${formatoCOP(p.precio)}</div>
        ${boton}
        <div class="seller-box">
          <div class="avatar" aria-hidden="true">${iniciales(p.vendedorNombre)}</div>
          <div><strong>${p.vendedorNombre}</strong><br><span class="muted">Publicado el ${formatoFecha(p.creadoEn)}</span></div>
        </div>
        <h2>Descripción</h2>
        <p class="detail-desc">${p.descripcion}</p>
      </div>
    </div>`);

  // Galería: cambiar la imagen principal
  const principal = app.querySelector('#galeria');
  app.querySelectorAll('.thumbs button').forEach((b) => b.addEventListener('click', () => {
    principal.src = b.dataset.src;
    app.querySelectorAll('.thumbs button').forEach((x) => x.setAttribute('aria-current', String(x === b)));
  }));

  // Compra requiere sesión: si no hay, se envía al login y se regresa al checkout
  app.querySelector('#btn-comprar')?.addEventListener('click', (e) => {
    if (!session.token) {
      e.preventDefault();
      navegar(`/login?next=${encodeURIComponent(`/checkout/${p.id}`)}`);
    }
  });
}
