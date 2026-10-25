// Una entrega y sus reglas (SPEC 3.12: dominio como clases que protegen sus
// invariantes).
//
// Decisiones del cliente que viven aquí:
//   - Entregar exige al menos una foto y un mensaje (escrito o dictado).
//   - "No entregado" exige motivo, foto y mensaje. El estado es `fallida`.
//   - Si el administrador canceló mientras el conductor estaba sin señal y el
//     conductor entregó, gana el hecho físico: queda `entregada` y se marca
//     para que una persona la revise (SPEC 6).

import { ErrorDeDominio } from "./errores";
import { type EstadoEntrega, esFinal, puedePasar } from "./estados";

export type Cierre = {
  /** Identificadores de las fotos ya guardadas en el teléfono o en el servidor. */
  fotos: readonly string[];
  /** Lo que escribió o dictó el conductor. */
  mensaje: string;
};

export type NoEntregado = Cierre & { motivo: string };

export type DatosEntrega = {
  id: string;
  estado: EstadoEntrega;
  requiereRevision?: boolean;
};

export class Entrega {
  readonly id: string;
  #estado: EstadoEntrega;
  #requiereRevision: boolean;
  #mensaje: string | null = null;
  #motivo: string | null = null;
  #fotos: readonly string[] = [];

  constructor(datos: DatosEntrega) {
    if (!datos.id.trim()) throw new ErrorDeDominio("sin_id", "La entrega no tiene identificador.");
    this.id = datos.id;
    this.#estado = datos.estado;
    this.#requiereRevision = datos.requiereRevision ?? false;
  }

  get estado(): EstadoEntrega {
    return this.#estado;
  }

  /** Quedó en un estado que una persona debe revisar (por ejemplo, entregada después de cancelada). */
  get requiereRevision(): boolean {
    return this.#requiereRevision;
  }

  get mensaje(): string | null {
    return this.#mensaje;
  }

  get motivo(): string | null {
    return this.#motivo;
  }

  get fotos(): readonly string[] {
    return this.#fotos;
  }

  /** Cambio de estado del recorrido (publicar, en camino, cerca, llegó). No sirve para cerrar. */
  avanzarA(nuevo: EstadoEntrega): void {
    if (nuevo === "entregada" || nuevo === "fallida") {
      throw new ErrorDeDominio(
        "cierre_sin_datos",
        "Para cerrar una entrega se usa marcarEntregada o marcarNoEntregada.",
      );
    }
    if (nuevo === "cancelada") {
      this.cancelar();
      return;
    }
    this.#exigirPaso(nuevo);
    this.#estado = nuevo;
  }

  cancelar(): void {
    this.#exigirPaso("cancelada");
    this.#estado = "cancelada";
  }

  marcarEntregada(cierre: Cierre): void {
    const { fotos, mensaje } = Entrega.#revisarCierre(cierre);
    if (this.#estado === "cancelada") {
      // Gana el hecho físico: el paquete ya está en manos del cliente.
      this.#requiereRevision = true;
    } else {
      this.#exigirPaso("entregada");
    }
    this.#estado = "entregada";
    this.#fotos = fotos;
    this.#mensaje = mensaje;
  }

  marcarNoEntregada(datos: NoEntregado): void {
    const motivo = datos.motivo.trim();
    if (!motivo) throw new ErrorDeDominio("sin_motivo", "Elige el motivo por el que no se entregó.");
    const { fotos, mensaje } = Entrega.#revisarCierre(datos);
    this.#exigirPaso("fallida");
    this.#estado = "fallida";
    this.#fotos = fotos;
    this.#mensaje = mensaje;
    this.#motivo = motivo;
  }

  static #revisarCierre(cierre: Cierre): { fotos: readonly string[]; mensaje: string } {
    const fotos = cierre.fotos.filter((f) => f.trim() !== "");
    if (fotos.length === 0) throw new ErrorDeDominio("sin_foto", "Falta la foto de la entrega.");
    const mensaje = cierre.mensaje.trim();
    if (!mensaje) throw new ErrorDeDominio("sin_mensaje", "Falta el mensaje para el cliente.");
    return { fotos, mensaje };
  }

  #exigirPaso(nuevo: EstadoEntrega): void {
    if (puedePasar(this.#estado, nuevo)) return;
    throw new ErrorDeDominio(
      esFinal(this.#estado) ? "estado_final" : "paso_invalido",
      `Una entrega ${this.#estado.replace("_", " ")} no puede pasar a ${nuevo.replace("_", " ")}.`,
    );
  }
}

/** Motivos de "No entregado" (se eligen con un toque, SPEC 8: nada que obligue a escribir al volante). */
export const MOTIVOS_NO_ENTREGA = [
  "Local cerrado",
  "Fuera del horario de recepción",
  "Rechazado por el cliente",
  "Dirección incorrecta",
  "Sin acceso al local",
  "Nadie recibe",
  "Otro",
] as const;
