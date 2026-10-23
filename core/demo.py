"""Modo demostración: responde como la IA, pero con datos guardados para las fotos de /ejemplos.

Sirve para probar la app sin clave de API y sin costo. Las respuestas están en
ejemplos/respuestas_demo/<nombre>.json.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from core.config import RAIZ
from core.ia import ErrorIA, Uso
from core.imagenes import EXTENSIONES, preparar

CARPETA = RAIZ / "ejemplos"


class ClienteDemo:
    def __init__(self, carpeta: Path = CARPETA, modelo: str = "claude-opus-5-5"):
        self.modelo = modelo
        self._respuestas: dict[str, dict] = {}
        for ruta in carpeta.iterdir():
            if ruta.suffix.lower().lstrip(".") not in EXTENSIONES:
                continue
            fixture = carpeta / "respuestas_demo" / f"{ruta.stem}.json"
            if fixture.exists():
                prep = preparar(ruta.name, ruta.read_bytes())
                b64 = prep.bloque_para_ia()["source"]["data"]
                self._respuestas[b64] = json.loads(fixture.read_text(encoding="utf-8"))

    def generar(self, *, system: str, contenido: list[dict[str, Any]], esquema, effort="medium", max_tokens=16000):
        for bloque in contenido:
            datos = bloque.get("source", {}).get("data")
            if datos and datos in self._respuestas:
                uso = Uso(self.modelo, tokens_entrada=2600, tokens_salida=900)
                return esquema.model_validate(self._respuestas[datos]), uso
        raise ErrorIA("Modo demostración: solo funciona con las fotos de la carpeta «ejemplos». "
                      "Para escanear tus propias fotos, configura tu clave de API y pon MODO_DEMO=0.")
