"""Configuración leída desde el archivo .env (la clave de API nunca va en el código)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parent.parent
load_dotenv(RAIZ / ".env")

MODELO_POR_DEFECTO = "claude-opus-5-5"

# Precios en US$ por millón de tokens (entrada, salida, lectura de caché, escritura de caché).
# Incluye los modelos a los que puede pasar el respaldo automático.
PRECIOS_USD_MTOK: dict[str, dict[str, float]] = {
    "claude-opus-5-5": {"entrada": 4.0, "salida": 20.0, "cache_lectura": 0.20, "cache_escritura": 5.0},
    "claude-opus-5": {"entrada": 5.0, "salida": 25.0, "cache_lectura": 0.50, "cache_escritura": 6.25},
    "claude-opus-4-8": {"entrada": 5.0, "salida": 25.0, "cache_lectura": 0.50, "cache_escritura": 6.25},
    "claude-sonnet-5-5": {"entrada": 2.0, "salida": 10.0, "cache_lectura": 0.20, "cache_escritura": 2.50},
}

IVA = 0.19


def _bool(valor: str | None, defecto: bool) -> bool:
    if valor is None or valor.strip() == "":
        return defecto
    return valor.strip().lower() in {"1", "true", "si", "sí", "yes"}


@dataclass
class Config:
    api_key: str | None
    modelo: str
    dolar_clp: float
    usar_respaldo: bool
    modo_demo: bool
    datos_dir: Path

    @property
    def ruta_db(self) -> Path:
        return self.datos_dir / "negocio.db"

    @property
    def clave_configurada(self) -> bool:
        return bool(self.api_key) and not self.api_key.endswith("...")


def cargar() -> Config:
    datos = Path(os.getenv("DATOS_DIR") or "datos")
    if not datos.is_absolute():
        datos = RAIZ / datos
    datos.mkdir(parents=True, exist_ok=True)
    try:
        dolar = float(os.getenv("DOLAR_CLP") or 950)
    except ValueError:
        dolar = 950.0
    return Config(
        api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        modelo=os.getenv("MODELO") or MODELO_POR_DEFECTO,
        dolar_clp=dolar,
        usar_respaldo=_bool(os.getenv("USAR_RESPALDO"), True),
        modo_demo=_bool(os.getenv("MODO_DEMO"), False),
        datos_dir=datos,
    )
