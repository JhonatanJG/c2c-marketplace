// Prueba de humo de HU-01..HU-04. Ejecuta: npm test
const assert = require('node:assert/strict');
const app = require('../server');

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;

async function api(method, ruta, { body, token } = {}) {
  const res = await fetch(base + ruta, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const paso = (t) => console.log('✔', t);

(async () => {
  // HU-01
  let r = await api('POST', '/auth/register', { body: { nombre: '', email: 'x', password: '123', telefono: '1' } });
  assert.equal(r.status, 400); assert.equal(r.data.detalles.length, 4); paso('HU-01 rechaza datos inválidos');

  r = await api('POST', '/auth/register', { body: { nombre: 'Jhon Test', email: 'jhon@test.com', password: 'Clave1234', telefono: '3188114770' } });
  assert.equal(r.status, 201); assert.ok(r.data.token); assert.equal(r.data.usuario.passwordHash, undefined);
  const jhon = r.data; paso('HU-01 registra y devuelve JWT (sin hash)');

  r = await api('POST', '/auth/register', { body: { nombre: 'Otro', email: 'JHON@test.com', password: 'Clave1234', telefono: '3188114770' } });
  assert.equal(r.status, 409); paso('HU-01 correo duplicado -> 409');

  r = await api('POST', '/auth/login', { body: { email: 'jhon@test.com', password: 'mala1234' } });
  assert.equal(r.status, 401);
  r = await api('POST', '/auth/login', { body: { email: 'ana@demo.com', password: 'Demo1234' } });
  assert.equal(r.status, 200); const ana = r.data; paso('login correcto / incorrecto');

  // HU-03
  r = await api('GET', '/products?limit=3');
  assert.equal(r.status, 200); assert.equal(r.data.data.length, 3); assert.equal(r.data.pagination.total, 8); paso('HU-03 paginación');
  r = await api('GET', '/products?search=portatil');
  assert.equal(r.data.data.length, 1); paso('HU-03 búsqueda sin tildes');
  r = await api('GET', '/products?search=port&category=tecnologia');
  assert.equal(r.data.data.length, 1); paso('HU-03 búsqueda por prefijo + categoría');
  r = await api('GET', '/products?minPrice=100000&maxPrice=300000&sort=precio_asc');
  assert.deepEqual(r.data.data.map((p) => p.precio), [140000, 180000, 210000, 230000]); paso('HU-03 rango de precios + orden');
  r = await api('GET', '/products?minPrice=500&maxPrice=100');
  assert.equal(r.status, 400); paso('HU-03 valida parámetros');

  // HU-02
  r = await api('POST', '/products', { body: {} });
  assert.equal(r.status, 401); paso('HU-02 exige token');
  r = await api('POST', '/products', { token: jhon.token, body: { titulo: 'a', precio: -1 } });
  assert.equal(r.status, 400); paso('HU-02 valida campos');
  r = await api('POST', '/products', { token: jhon.token, body: { titulo: 'Teclado mecánico', descripcion: 'Teclado mecánico switches rojos, en buen estado.', precio: 120000, categoria: 'tecnologia', imagenes: ['data:image/png;base64,AAAA'] } });
  assert.equal(r.status, 400); paso('HU-02 rechaza imagen falsa');
  r = await api('POST', '/products', { token: jhon.token, body: { titulo: 'Teclado mecánico', descripcion: 'Teclado mecánico switches rojos, en buen estado.', precio: 120000, categoria: 'tecnologia', imagenes: [PNG_1X1] } });
  assert.equal(r.status, 201); const teclado = r.data.producto;
  assert.equal(teclado.vendedorId, jhon.usuario.id); assert.match(teclado.imagenes[0], /^\/api\/products\/images\//); paso('HU-02 publica y vincula al vendedor');
  const img = await fetch(`http://localhost:${server.address().port}${teclado.imagenes[0]}`);
  assert.equal(img.status, 200); assert.equal(img.headers.get('content-type'), 'image/png'); paso('HU-02 la URL de la imagen funciona');

  // HU-04
  const entrega = { receptor: 'Jhon Test', direccion: 'Calle 1 # 2-3', ciudad: 'Chía', telefono: '3188114770' };
  const buenaTarjeta = { numero: '4242 4242 4242 4242', vencimiento: '12/39', cvv: '123' };
  r = await api('POST', '/orders', { token: jhon.token, body: { productId: teclado.id, direccionEntrega: entrega, metodoPago: 'pse' } });
  assert.equal(r.status, 403); paso('HU-04 no permite comprar el propio producto');

  r = await api('POST', '/orders', { token: ana.token, body: { productId: teclado.id, direccionEntrega: entrega, metodoPago: 'tarjeta', tarjeta: { ...buenaTarjeta, numero: '4000 0000 0000 0002' } } });
  assert.equal(r.status, 402);
  r = await api('GET', `/products/${teclado.id}`);
  assert.equal(r.data.producto.estado, 'disponible'); paso('HU-04 pago rechazado -> producto sigue disponible');

  r = await api('POST', '/orders', { token: ana.token, body: { productId: teclado.id, direccionEntrega: entrega, metodoPago: 'tarjeta', tarjeta: buenaTarjeta } });
  assert.equal(r.status, 201); assert.equal(r.data.pedido.estado, 'en_envio'); assert.equal(r.data.pedido.ultimos4, '4242');
  assert.ok(r.data.pedido.trackingId); assert.equal(JSON.stringify(r.data).includes('4242 4242'), false);
  const pedido = r.data.pedido; paso('HU-04 compra aprobada con tracking y sin datos de tarjeta');

  r = await api('GET', `/products/${teclado.id}`);
  assert.equal(r.data.producto.estado, 'vendido'); paso('HU-04 producto pasa a "vendido"');
  r = await api('POST', '/orders', { token: ana.token, body: { productId: teclado.id, direccionEntrega: entrega, metodoPago: 'pse' } });
  assert.equal(r.status, 409); paso('HU-04 evita compras duplicadas');

  r = await api('GET', '/products?search=teclado');
  assert.equal(r.data.data.length, 0); paso('HU-03 oculta productos vendidos');

  r = await api('GET', `/orders/${pedido.id}`, { token: jhon.token });
  assert.equal(r.status, 200);
  r = await api('GET', `/orders/${pedido.id}`, { token: (await api('POST', '/auth/login', { body: { email: 'luis@demo.com', password: 'Demo1234' } })).data.token });
  assert.equal(r.status, 403); paso('HU-04 el pedido solo lo ven comprador y vendedor');
  r = await api('GET', '/orders?rol=vendedor', { token: jhon.token });
  assert.equal(r.data.data.length, 1); paso('listado de ventas / compras');

  console.log('\nTodas las pruebas pasaron.');
  server.close();
})().catch((e) => { console.error('✘ FALLÓ:', e.message); server.close(); process.exit(1); });
