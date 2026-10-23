"""Cliente de Claude: llamadas con salida estructurada, costos y errores en español."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, TypeVar

import anthropic
from pydantic import BaseModel, ValidationError

from core.config import PRECIOS_USD_MTOK, Config

T = TypeVar("T", bound=BaseModel)

BETA_RESPALDO = "server-side-fallback-2026-07-01"


class ErrorIA(Exception):
    """Error con un mensaje listo para mostrar al usuario."""

    def __init__(self, mensaje: str, tecnico: str | None = None, reintentable: bool = False):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.tecnico = tecnico
        self.reintentable = reintentable


@dataclass
class Uso:
    modelo: str
    tokens_entrada: int = 0
    tokens_salida: int = 0
    cache_lectura: int = 0
    cache_escritura: int = 0

    @property
    def costo_usd(self) -> float:
        p = PRECIOS_USD_MTOK.get(self.modelo) or PRECIOS_USD_MTOK["claude-opus-5-5"]
        return (
            self.tokens_entrada * p["entrada"]
            + self.tokens_salida * p["salida"]
            + self.cache_lectura * p["cache_lectura"]
            + self.cache_escritura * p["cache_escritura"]
        ) / 1_000_000

    def __add__(self, otro: "Uso") -> "Uso":
        return Uso(
            modelo=self.modelo,
            tokens_entrada=self.tokens_entrada + otro.tokens_entrada,
            tokens_salida=self.tokens_salida + otro.tokens_salida,
            cache_lectura=self.cache_lectura + otro.cache_lectura,
            cache_escritura=self.cache_escritura + otro.cache_escritura,
        )


def formatear_costo(usd: float, dolar_clp: float) -> str:
    clp = round(usd * dolar_clp)
    return f"US$ {usd:.3f} (≈ ${clp:,} CLP)".replace(",", ".")


class GeneradorIA(Protocol):
    """Lo que la app necesita de la IA. Los tests y el modo demo usan versiones falsas."""

    def generar(
        self,
        *,
        system: str,
        contenido: list[dict[str, Any]],
        esquema: type[T],
        effort: str = "medium",
        max_tokens: int = 16000,
    ) -> tuple[T, Uso]: ...


class ClienteIA:
    def __init__(self, config: Config, cliente: anthropic.Anthropic | None = None):
        self.config = config
        self._respaldo = config.usar_respaldo
        if cliente is not None:
            self._cliente = cliente
        else:
            if not config.clave_configurada:
                raise ErrorIA(
                    "No hay clave de API. Copia .env.example como .env y escribe tu clave en ANTHROPIC_API_KEY."
                )
            self._cliente = anthropic.Anthropic(api_key=config.api_key, timeout=180.0, max_retries=2)

    def generar(
        self,
        *,
        system: str,
        contenido: list[dict[str, Any]],
        esquema: type[T],
        effort: str = "medium",
        max_tokens: int = 16000,
    ) -> tuple[T, Uso]:
        kwargs: dict[str, Any] = dict(
            model=self.config.modelo,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": contenido}],
            output_format=esquema,
            output_config={"effort": effort},
        )
        try:
            try:
                respuesta = self._llamar(kwargs)
            except anthropic.BadRequestError as e:
                # Si la cuenta no tiene habilitado el respaldo automático, se reintenta sin él.
                texto = str(e).lower()
                if not (self._respaldo and ("fallback" in texto or "anthropic-beta" in texto)):
                    raise
                self._respaldo = False
                respuesta = self._llamar(kwargs)
        except anthropic.APIError as e:
            raise traducir_error(e) from e
        except ValidationError as e:
            raise ErrorIA("La respuesta de la IA no tenía el formato esperado. Intenta de nuevo.", str(e)) from e

        u = respuesta.usage
        uso = Uso(
            modelo=getattr(respuesta, "model", None) or self.config.modelo,
            tokens_entrada=u.input_tokens or 0,
            tokens_salida=u.output_tokens or 0,
            cache_lectura=getattr(u, "cache_read_input_tokens", 0) or 0,
            cache_escritura=getattr(u, "cache_creation_input_tokens", 0) or 0,
        )
        if respuesta.stop_reason == "refusal":
            raise ErrorIA("La IA no pudo procesar este contenido (lo rechazó por política de uso).")
        if respuesta.stop_reason == "max_tokens":
            raise ErrorIA("El documento es demasiado largo para procesarlo de una vez. Prueba dividiéndolo.")
        datos = getattr(respuesta, "parsed_output", None)
        if datos is None:
            raise ErrorIA("La respuesta de la IA no tenía el formato esperado. Intenta de nuevo.")
        return datos, uso

    def _llamar(self, kwargs: dict[str, Any]):
        extra: dict[str, Any] = {}
        if self._respaldo:
            extra = {
                "extra_headers": {"anthropic-beta": BETA_RESPALDO},
                "extra_body": {"fallbacks": "default"},
            }
        return self._cliente.messages.parse(**kwargs, **extra)

def traducir_error(e: Exception) -> ErrorIA:
    """Convierte errores del SDK en mensajes claros en español."""
    if isinstance(e, ErrorIA):
        return e
    tecnico = str(e)
    if isinstance(e, anthropic.APITimeoutError):
        return ErrorIA("La IA tardó demasiado en responder. Intenta de nuevo.", tecnico, True)
    if isinstance(e, anthropic.APIConnectionError):
        return ErrorIA("No hay conexión con la IA. Revisa tu internet e intenta de nuevo.", tecnico, True)
    if isinstance(e, anthropic.APIStatusError):
        codigo = e.status_code
        if codigo == 401:
            return ErrorIA("La clave de API no es válida. Revísala en el archivo .env (ANTHROPIC_API_KEY).", tecnico)
        if codigo == 402:
            return ErrorIA("Tu cuenta de Anthropic no tiene saldo o hay un problema de facturación.", tecnico)
        if codigo == 403:
            return ErrorIA("Tu clave de API no tiene permiso para usar este modelo.", tecnico)
        if codigo == 404:
            return ErrorIA("El modelo configurado no está disponible para tu cuenta. Revisa MODELO en .env.", tecnico)
        if codigo == 413:
            return ErrorIA("El archivo es demasiado grande. Usa una foto más liviana o un PDF con menos páginas.", tecnico)
        if codigo == 429:
            return ErrorIA("Llegaste al límite de uso de la API. Espera un minuto e intenta de nuevo.", tecnico, True)
        if codigo >= 500:
            return ErrorIA("El servicio de IA está saturado o con problemas. Intenta en unos minutos.", tecnico, True)
        if codigo == 400:
            msg = getattr(e, "message", "") or ""
            if "image" in msg.lower():
                return ErrorIA("La imagen no se pudo leer (formato dañado o no soportado).", tecnico)
            return ErrorIA(f"La IA no aceptó la solicitud: {msg}", tecnico)
    return ErrorIA("Ocurrió un error inesperado al hablar con la IA.", tecnico)
