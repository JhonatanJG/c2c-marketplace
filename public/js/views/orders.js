// HU-04: proceso de compra (checkout, recibo) y listado de pedidos.
import { api, session, ApiError } from '../api.js';
import { html, raw, montar, crearValidacion, ponerCargando, navegar, toast, formatoCOP, formatoFecha, luhn, mostrarAlerta, ESTADO_PEDIDO, METODO_PAGO } from '../utils.js';

const TELEFONO_RE = /^\+?[0-9\s-]{7,15}$/;
const idCorto = (id) => id.slice(0, 8).toUpperCase();

export async function checkout({ app, params, activo }) {
  const { producto: p } = await api('GET', `/products/${params[0]}`);
  if (!activo()) return;

  // Reglas de negocio también reflejadas en la interfaz
  if (p.vendedorId === session.usuario.id || p.estado !== 'disponible') {
    montar(app, html`
      <section class="panel narrow">
        <h1>No puedes comprar este producto</h1>
        <p>${p.vendedorId === session.usuario.id ? 'Es una de tus publicaciones.' : 'Este producto ya no está disponible.'}</p>
        <a class="btn btn-primary" href="#/">Volver al catálogo</a>
      </section>`);
    return;
  }

  montar(app, html`
    <p><a href="#/producto/${p.id}">← Volver al producto</a></p>
    <h1>Finalizar compra</h1>
    <div class="checkout">
      <form class="panel" id="form-checkout" novalidate>
        <div id="form-alert" role="alert"></div>

        <h2>Dirección de entrega</h2>
        <div class="form-grid two">
          <div class="field">
            <label for="f-receptor">Quién recibe <span class="req" aria-hidden="true">*</span></label>
            <input id="f-receptor" name="receptor" autocomplete="name" aria-describedby="e-receptor" required value="${session.usuario.nombre}">
            <p class="field-error" id="e-receptor" role="alert"></p>
          </div>
          <div class="field">
            <label for="f-telefonoEntrega">Teléfono de contacto <span class="req" aria-hidden="true">*</span></label>
            <input id="f-telefonoEntrega" name="telefonoEntrega" type="tel" autocomplete="tel" aria-describedby="e-telefonoEntrega" required value="${session.usuario.telefono || ''}">
            <p class="field-error" id="e-telefonoEntrega" role="alert"></p>
          </div>
        </div>
        <div class="form-grid two">
          <div class="field">
            <label for="f-direccion">Dirección <span class="req" aria-hidden="true">*</span></label>
            <input id="f-direccion" name="direccion" autocomplete="street-address" aria-describedby="e-direccion" required placeholder="Calle 10 # 5-20, apto 301">
            <p class="field-error" id="e-direccion" role="alert"></p>
          </div>
          <div class="field">
            <label for="f-ciudad">Ciudad <span class="req" aria-hidden="true">*</span></label>
            <input id="f-ciudad" name="ciudad" autocomplete="address-level2" aria-describedby="e-ciudad" required placeholder="Chía">
            <p class="field-error" id="e-ciudad" role="alert"></p>
          </div>
        </div>

        <h2 style="margin-top:8px">Método de pago</h2>
        <div class="pay-options">
          <label class="pay-option"><input type="radio" name="metodoPago" value="tarjeta" checked> 💳 Tarjeta de crédito / débito</label>
          <label class="pay-option"><input type="radio" name="metodoPago" value="pse"> 🏦 PSE (débito desde tu banco)</label>
          <label class="pay-option"><input type="radio" name="metodoPago" value="mercadopago"> 🟦 MercadoPago</label>
        </div>

        <div id="bloque-tarjeta">
          <p class="test-cards">Pasarela simulada · Aprobada: <strong>4242 4242 4242 4242</strong> · Rechazada: <strong>4000 0000 0000 0002</strong> · cualquier fecha futura y CVV.</p>
          <div class="field">
            <label for="f-numeroTarjeta">Número de tarjeta <span class="req" aria-hidden="true">*</span></label>
            <input id="f-numeroTarjeta" name="numeroTarjeta" inputmode="numeric" autocomplete="cc-number" aria-describedby="e-numeroTarjeta" placeholder="4242 4242 4242 4242" maxlength="23">
            <p class="field-error" id="e-numeroTarjeta" role="alert"></p>
          </div>
          <div class="form-grid two">
            <div class="field">
              <label for="f-vencimiento">Vencimiento (MM/AA) <span class="req" aria-hidden="true">*</span></label>
              <input id="f-vencimiento" name="vencimiento" inputmode="numeric" autocomplete="cc-exp" aria-describedby="e-vencimiento" placeholder="12/30" maxlength="5">
              <p class="field-error" id="e-vencimiento" role="alert"></p>
            </div>
            <div class="field">
              <label for="f-cvv">CVV <span class="req" aria-hidden="true">*</span></label>
              <input id="f-cvv" name="cvv" inputmode="numeric" autocomplete="cc-csc" aria-describedby="e-cvv" placeholder="123" maxlength="4">
              <p class="field-error" id="e-cvv" role="alert"></p>
            </div>
          </div>
        </div>

        <button class="btn btn-accent btn-block btn-lg" type="submit" id="btn-pagar">Pagar ${formatoCOP(p.precio)}</button>
      </form>

      <aside class="panel summary" aria-label="Resumen de la compra">
        <h2>Resumen</h2>
        <div class="summary-item">
          <img src="${p.imagenes[0]}" alt="">
          <div><strong>${p.titulo}</strong><br><span class="muted">Vendedor: ${p.vendedorNombre}</span></div>
        </div>
        <div class="total-row"><span>Total</span><span>${formatoCOP(p.precio)}</span></div>
        <p class="muted" style="margin-top:10px">Envío con seguimiento incluido (simulado).</p>
      </aside>
    </div>`);

  const form = app.querySelector('#form-checkout');
  const alerta = app.querySelector('#form-alert');
  const boton = app.querySelector('#btn-pagar');
  const bloqueTarjeta = app.querySelector('#bloque-tarjeta');
  const conTarjeta = (t) => t.metodoPago === 'tarjeta';

  const validacion = crearValidacion(form, {
    receptor: (v) => (v.trim().length < 3 ? 'Indica quién recibe el pedido.' : ''),
    direccion: (v) => (v.trim().length < 5 ? 'Ingresa una dirección válida (calle, número y barrio).' : ''),
    ciudad: (v) => (v.trim().length < 2 ? 'Ingresa la ciudad de entrega.' : ''),
    telefonoEntrega: (v) => (!TELEFONO_RE.test(v.trim()) ? 'Ingresa un teléfono válido (7 a 15 dígitos).' : ''),
    numeroTarjeta: (v, t) => (!conTarjeta(t) ? '' : !v.trim() ? 'Ingresa el número de tarjeta.' : !luhn(v) ? 'El número de tarjeta no es válido.' : ''),
    vencimiento: (v, t) => {
      if (!conTarjeta(t)) return '';
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(v)) return 'Usa el formato MM/AA.';
      const [mm, aa] = v.split('/').map(Number);
      return new Date(2000 + aa, mm, 0, 23, 59, 59) < new Date() ? 'La tarjeta está vencida.' : '';
    },
    cvv: (v, t) => (!conTarjeta(t) ? '' : !/^\d{3,4}$/.test(v) ? 'El CVV debe tener 3 o 4 dígitos.' : '')
  });

  // Formato automático de tarjeta (grupos de 4) y vencimiento (MM/AA)
  form.elements.numeroTarjeta.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  });
  form.elements.vencimiento.addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'metodoPago') bloqueTarjeta.hidden = e.target.value !== 'tarjeta';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alerta.innerHTML = '';
    if (!validacion.validarTodo()) return;
    const v = Object.fromEntries(new FormData(form));

    const cuerpo = {
      productId: p.id,
      direccionEntrega: { receptor: v.receptor.trim(), direccion: v.direccion.trim(), ciudad: v.ciudad.trim(), telefono: v.telefonoEntrega.trim() },
      metodoPago: v.metodoPago
    };
    if (v.metodoPago === 'tarjeta') cuerpo.tarjeta = { numero: v.numeroTarjeta, vencimiento: v.vencimiento, cvv: v.cvv };

    ponerCargando(boton, true, 'Procesando pago…');
    try {
      const { pedido } = await api('POST', '/orders', cuerpo);
      toast('¡Pago aprobado! Tu compra fue registrada.');
      navegar(`/pedido/${pedido.id}`); // pantalla de confirmación / recibo
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;
      if (err.detalles.length) validacion.errorServidor(err.detalles);
      else mostrarAlerta(alerta, err.message);
      ponerCargando(boton, false);
    }
  });
}

export async function recibo({ app, params, activo }) {
  const { pedido: o } = await api('GET', `/orders/${params[0]}`);
  if (!activo()) return;
  const soyComprador = o.compradorId === session.usuario.id;

  montar(app, html`
    <section class="panel receipt">
      <div class="check" aria-hidden="true">✓</div>
      <h1>${soyComprador ? '¡Compra exitosa!' : 'Detalle de la venta'}</h1>
      <p class="muted">${soyComprador ? 'Te enviamos la confirmación a tu correo.' : 'Prepara el envío para el comprador.'}</p>
      <dl>
        <dt>N.º de pedido</dt><dd>${idCorto(o.id)}</dd>
        <dt>Producto</dt><dd><a href="#/producto/${o.productoId}">${o.productoTitulo}</a></dd>
        <dt>Total pagado</dt><dd>${formatoCOP(o.monto)}</dd>
        <dt>Método de pago</dt><dd>${METODO_PAGO[o.metodoPago]}${o.ultimos4 ? ` •••• ${o.ultimos4}` : ''}</dd>
        <dt>Estado</dt><dd><span class="chip chip-ok">${ESTADO_PEDIDO[o.estado] || o.estado}</span></dd>
        <dt>${soyComprador ? 'Vendedor' : 'Comprador'}</dt><dd>${soyComprador ? o.vendedorNombre : o.compradorNombre}</dd>
        <dt>Entrega en</dt><dd>${o.direccionEntrega.direccion}, ${o.direccionEntrega.ciudad}<br>Recibe: ${o.direccionEntrega.receptor} · ${o.direccionEntrega.telefono}</dd>
        <dt>Seguimiento</dt><dd>${o.trackingId ? `${o.trackingId} (${o.transportadora})` : 'Pendiente de asignar'}</dd>
        ${o.entregaEstimada ? html`<dt>Entrega estimada</dt><dd>${formatoFecha(o.entregaEstimada + 'T12:00:00')}</dd>` : ''}
        <dt>Fecha</dt><dd>${formatoFecha(o.creadoEn)}</dd>
      </dl>
      <div class="actions-row">
        <button class="btn" type="button" id="btn-imprimir">Imprimir recibo</button>
        <a class="btn" href="#/mis-pedidos">Ver mis pedidos</a>
        <a class="btn btn-primary" href="#/">Seguir explorando</a>
      </div>
    </section>`);
  app.querySelector('#btn-imprimir').addEventListener('click', () => window.print());
}

export async function misPedidos({ app, query, activo }) {
  const rol = query.rol === 'vendedor' ? 'vendedor' : 'comprador';
  const { data } = await api('GET', `/orders?rol=${rol}`);
  if (!activo()) return;

  montar(app, html`
    <div class="page-head"><h1>Mis pedidos</h1></div>
    <div class="tabs" role="navigation" aria-label="Tipo de pedidos">
      <a href="#/mis-pedidos" ${rol === 'comprador' ? raw('aria-current="page"') : ''}>Mis compras</a>
      <a href="#/mis-pedidos?rol=vendedor" ${rol === 'vendedor' ? raw('aria-current="page"') : ''}>Mis ventas</a>
    </div>
    ${data.length === 0 ? html`
      <div class="empty"><div class="big" aria-hidden="true">🧾</div>
        <h2>${rol === 'comprador' ? 'Aún no has comprado nada' : 'Aún no has vendido nada'}</h2>
        <a class="btn" href="#/">Explorar productos</a></div>`
    : data.map((o) => html`
      <a class="row-card" href="#/pedido/${o.id}">
        <img src="${o.productoImagen}" alt="">
        <div class="grow">
          <strong>${o.productoTitulo}</strong><br>
          <span class="muted">Pedido ${idCorto(o.id)} · ${formatoFecha(o.creadoEn)} · ${rol === 'comprador' ? `Vendedor: ${o.vendedorNombre}` : `Comprador: ${o.compradorNombre}`}</span>
        </div>
        <div style="text-align:right"><div class="price">${formatoCOP(o.monto)}</div><span class="chip chip-ok">${ESTADO_PEDIDO[o.estado] || o.estado}</span></div>
      </a>`)}`);
}
