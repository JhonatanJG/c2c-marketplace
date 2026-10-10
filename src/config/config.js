// Configuración central de la plataforma C2C.
// En Vercel, define JWT_SECRET en Project Settings > Environment Variables.
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'c2c-secreto-solo-para-desarrollo',
  JWT_EXPIRES_IN: '2h',
  BCRYPT_ROUNDS: 10,

  CATEGORIAS: [
    { id: 'tecnologia', nombre: 'Tecnología' },
    { id: 'hogar', nombre: 'Hogar' },
    { id: 'moda', nombre: 'Moda' },
    { id: 'deportes', nombre: 'Deportes' },
    { id: 'vehiculos', nombre: 'Vehículos y repuestos' },
    { id: 'libros', nombre: 'Libros' },
    { id: 'juguetes', nombre: 'Juguetes' },
    { id: 'otros', nombre: 'Otros' }
  ],

  METODOS_PAGO: ['tarjeta', 'pse', 'mercadopago'],

  MAX_IMAGENES: 4,
  MAX_IMAGEN_BYTES: 500 * 1024, // 500 KB por imagen ya decodificada

  PAGINACION: { LIMITE_DEFECTO: 8, LIMITE_MAXIMO: 24 }
};
