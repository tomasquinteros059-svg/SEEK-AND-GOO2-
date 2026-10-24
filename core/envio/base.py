"""Interfaz para enviar mensajes.

Para conectar un servicio real más adelante (WhatsApp Business API, correo SMTP,
un proveedor de SMS), basta con crear una clase con el método `enviar` y
devolverla desde `obtener_enviador`. El resto de la app no cambia.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ResultadoEnvio:
    enviado: bool
    detalle: str


class Enviador(Protocol):
    canal: str

    def enviar(self, destino: str, texto: str, asunto: str | None = None) -> ResultadoEnvio: ...


@dataclass
class SoloTexto:
    """Implementación actual: no envía nada."""

    canal: str

    def enviar(self, destino: str, texto: str, asunto: str | None = None) -> ResultadoEnvio:
        return ResultadoEnvio(False, "El envío automático no está activado en esta versión. Copia el mensaje y envíalo tú.")


def obtener_enviador(canal: str) -> Enviador:
    # Aquí se conectarán los servicios reales, por ejemplo:
    #   if canal == "correo" and config.smtp_configurado: return EnviadorSMTP(...)
    return SoloTexto(canal)
