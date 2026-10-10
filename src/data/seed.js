// Datos de demostración (el modelo es simulado y vive en memoria, así que al
// reiniciar la función serverless se vuelve a cargar este conjunto inicial).
// IMPORTANTE: los ids son FIJOS. Vercel puede ejecutar varias copias de la función a la vez
// y todas deben "ver" los mismos productos, imágenes y usuarios de ejemplo.
//   Usuarios de prueba: ana@demo.com y luis@demo.com  /  contraseña: Demo1234
const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const productModel = require('../models/productModel');
const storage = require('../services/imageStorageService');
const { BCRYPT_ROUNDS } = require('../config/config');

// Imagen de ejemplo (SVG) para que el catálogo se vea completo sin subir archivos.
const svg = (emoji, c1, c2) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
  `<rect width="600" height="450" fill="url(#g)"/><text x="300" y="275" font-size="190" text-anchor="middle">${emoji}</text></svg>`
);

function cargar() {
  const hash = bcrypt.hashSync('Demo1234', BCRYPT_ROUNDS);
  const ana = userModel.crear({ id: 'seed-user-ana', nombre: 'Ana Torres', email: 'ana@demo.com', passwordHash: hash, telefono: '3001234567' });
  const luis = userModel.crear({ id: 'seed-user-luis', nombre: 'Luis Pérez', email: 'luis@demo.com', passwordHash: hash, telefono: '3109876543' });

  const ejemplos = [
    [ana, 'Portátil Lenovo IdeaPad 15"', 'Intel Core i5, 8 GB de RAM, SSD de 256 GB. Poco uso, incluye cargador original y funda.', 1450000, 'tecnologia', '💻', '#0ea5e9', '#6366f1'],
    [ana, 'Audífonos inalámbricos Bluetooth', 'Cancelación de ruido, 20 horas de batería. Estuche de carga incluido, como nuevos.', 180000, 'tecnologia', '🎧', '#8b5cf6', '#ec4899'],
    [luis, 'Bicicleta de montaña rin 29', 'Cuadro de aluminio, 21 velocidades, frenos de disco. Recién ajustada y lista para rodar.', 950000, 'deportes', '🚲', '#10b981', '#14b8a6'],
    [luis, 'Silla ergonómica de escritorio', 'Espaldar en malla, apoyabrazos regulables y soporte lumbar. Ideal para teletrabajo.', 320000, 'hogar', '🪑', '#f59e0b', '#ef4444'],
    [ana, 'Chaqueta de cuero talla M', 'Cuero genuino color negro, forro interno, excelente estado. Muy poco uso.', 230000, 'moda', '🧥', '#64748b', '#0f172a'],
    [luis, 'Colección de libros de programación', 'Seis libros: Clean Code, Patrones de diseño, Algoritmos, entre otros. Buen estado.', 140000, 'libros', '📚', '#f97316', '#eab308'],
    [ana, 'Casco para moto certificado', 'Casco integral talla L con visor oscuro adicional. Sin golpes ni caídas.', 210000, 'vehiculos', '🪖', '#ef4444', '#b91c1c'],
    [luis, 'Set de bloques de construcción', 'Más de 800 piezas compatibles con LEGO, caja original e instrucciones.', 85000, 'juguetes', '🧱', '#22c55e', '#06b6d4']
  ];

  ejemplos.forEach(([vendedor, titulo, descripcion, precio, categoria, emoji, c1, c2], i) => {
    const imagen = storage.subirBufferInterno(svg(emoji, c1, c2), 'image/svg+xml', `seed-img-${i + 1}`);
    productModel.crear({
      id: `seed-prod-${i + 1}`,
      creadoEn: new Date(Date.UTC(2026, 9, 1, 12) - i * 3600_000).toISOString(), // orden estable de publicación
      titulo, descripcion, precio, categoria, imagenes: [imagen], vendedorId: vendedor.id, vendedorNombre: vendedor.nombre
    });
  });
}

module.exports = { cargar };
