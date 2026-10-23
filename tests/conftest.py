import json
from pathlib import Path

import pytest

from core import db
from core.esquemas import ResultadoEscaneo
from core.ia import ErrorIA, Uso

RAIZ = Path(__file__).resolve().parent.parent
EJEMPLOS = RAIZ / "ejemplos"


def respuesta(nombre: str) -> ResultadoEscaneo:
    datos = json.loads((EJEMPLOS / "respuestas_demo" / f"{nombre}.json").read_text(encoding="utf-8"))
    return ResultadoEscaneo.model_validate(datos)


class IAFalsa:
    """Simula a Claude: devuelve una respuesta fija y guarda lo que se le pidió."""

    def __init__(self, resultado=None, error: ErrorIA | None = None):
        self.resultado, self.error, self.llamadas = resultado, error, []

    def generar(self, *, system, contenido, esquema, effort="medium", max_tokens=16000):
        self.llamadas.append({"system": system, "contenido": contenido, "esquema": esquema, "effort": effort})
        if self.error:
            raise self.error
        return self.resultado, Uso("claude-opus-5-5", tokens_entrada=3000, tokens_salida=1000)


@pytest.fixture
def conn():
    c = db.conectar(":memory:")
    yield c
    c.close()
