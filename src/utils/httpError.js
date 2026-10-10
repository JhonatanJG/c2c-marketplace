// Error con código HTTP para que el manejador global responda de forma uniforme.
class HttpError extends Error {
  constructor(status, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}
module.exports = HttpError;
