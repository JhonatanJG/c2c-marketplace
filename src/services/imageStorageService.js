// Simula el almacenamiento externo de imágenes (AWS S3 / Cloudinary del diagrama C4).
// Recibe la imagen en base64, la valida y devuelve una URL pública.
// En producción bastaría con reemplazar el cuerpo de `subirDataUrl` por el SDK de Cloudinary/S3.
const crypto = require('crypto');
const HttpError = require('../utils/httpError');
const { MAX_IMAGEN_BYTES } = require('../config/config');

const almacen = new Map(); // id -> { buffer, mime }
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

// Verifica la "firma" real del archivo para no confiar solo en el tipo declarado.
function firmaCoincide(buffer, mime) {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === 'image/png') return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return false;
}

function guardar(buffer, mime, idFijo) {
  const id = idFijo || crypto.randomBytes(12).toString('hex');
  almacen.set(id, { buffer, mime });
  return { id, url: `/api/products/images/${id}` };
}

function subirDataUrl(dataUrl) {
  const m = typeof dataUrl === 'string' ? DATA_URL_RE.exec(dataUrl) : null;
  if (!m) throw new HttpError(400, 'Formato de imagen no válido (solo JPG, PNG o WEBP en base64).');
  const buffer = Buffer.from(m[2], 'base64');
  if (buffer.length > MAX_IMAGEN_BYTES) throw new HttpError(413, `Cada imagen debe pesar menos de ${MAX_IMAGEN_BYTES / 1024} KB.`);
  if (!firmaCoincide(buffer, m[1])) throw new HttpError(400, 'El contenido del archivo no corresponde a una imagen válida.');
  return guardar(buffer, m[1]).url;
}

// Uso interno (datos de ejemplo). No pasa por la validación del usuario.
const subirBufferInterno = (buffer, mime, id) => guardar(buffer, mime, id).url;

const obtener = (id) => almacen.get(id);

module.exports = { subirDataUrl, subirBufferInterno, obtener };
