"""Modo demostración: responde como la IA, pero con datos guardados para las fotos de /ejemplos.

Sirve para probar la app sin clave de API y sin costo. Las respuestas están en
ejemplos/respuestas_demo/<nombre>.json.
"""
from __future__ import annotations

import json
import re
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
        from core import mensajes

        texto = "\n".join(b.get("text", "") for b in contenido if b.get("type") == "text")
        if esquema is mensajes.Interpretacion:
            instr = re.search(r"Instrucción: «(.*?)»", texto, re.S)
            nombres = re.search(r"Nombres: (.*)\.\n", texto)
            interp = mensajes.interpretar_local(instr.group(1) if instr else "",
                                                nombres.group(1).split(", ") if nombres else [])
            return interp, Uso(self.modelo, tokens_entrada=len(texto) // 4, tokens_salida=150)
        if esquema is mensajes.LoteRedactado:
            instr = re.search(r"Instrucción del dueño: «(.*?)»", texto, re.S)
            fecha = re.search(r"Fecha mencionada en la instrucción: .*?\((\d{4}-\d{2}-\d{2})\)", texto)
            canal = {"WhatsApp": "whatsapp", "Correo": "correo", "SMS": "sms"}[re.search(r"Canal: (\w+):", texto).group(1)]
            tono = re.search(r"Tono: (\w+):", texto).group(1).lower()
            datos = json.loads(texto.split("Destinatarios (JSON):\n", 1)[1])
            lote = mensajes.LoteRedactado(mensajes=[
                mensajes.redactar_local(instr.group(1) if instr else "", fecha.group(1) if fecha else None, d, canal, tono)
                for d in datos])
            return lote, Uso(self.modelo, tokens_entrada=len(texto) // 4, tokens_salida=60 * len(datos))
        for bloque in contenido:
            datos = bloque.get("source", {}).get("data")
            if datos and datos in self._respuestas:
                uso = Uso(self.modelo, tokens_entrada=2600, tokens_salida=900)
                return esquema.model_validate(self._respuestas[datos]), uso
        raise ErrorIA("Modo demostración: solo funciona con las fotos de la carpeta «ejemplos». "
                      "Para escanear tus propias fotos, configura tu clave de API y pon MODO_DEMO=0.")
