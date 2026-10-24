/** Una regla del negocio que no se cumplió. El mensaje se puede mostrar tal cual. */
export class ErrorDeDominio extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeDominio";
    this.codigo = codigo;
  }
}
