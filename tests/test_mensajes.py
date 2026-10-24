"""Tests de la generación de mensajes con la IA simulada."""
from datetime import date

import pytest

from core import conocimiento as k
from core import mensajes as m
from core.demo import ClienteDemo
from core.ia import ErrorIA
from tests.conftest import IAFalsa

HOY = date(2026, 10, 24)  # sábado


def cargar(conn):
    k.importar_contactos(conn, [
        {"nombre": "Juan Pérez", "telefono": "+56 9 8123 4567", "correo": "juan@correo.cl", "deuda": 72500, "fecha_vencimiento": "2026-10-20"},
        {"nombre": "Almacén Don Lucho", "telefono": "", "correo": "donlucho@almacen.cl", "deuda": 134000, "fecha_vencimiento": "2026-10-10"},
        {"nombre": "María Soto", "telefono": "+56 9 8765 4321", "correo": "", "deuda": 18900, "fecha_vencimiento": "2026-10-30"},
        {"nombre": "Carolina Muñoz", "telefono": "+56 9 7654 1122", "correo": "caro@correo", "deuda": 56300, "fecha_vencimiento": None},
    ])


class IAMensajes(IAFalsa):
    """Responde la interpretación fija y redacta usando los datos que recibe."""

    def __init__(self, interp, sin_responder=()):
        super().__init__()
        self.interp, self.sin_responder = interp, set(sin_responder)

    def generar(self, *, system, contenido, esquema, effort="medium", max_tokens=16000):
        self.llamadas.append({"esquema": esquema, "texto": contenido[0]["text"], "effort": effort})
        if esquema is m.Interpretacion:
            return self.interp, m.Uso("claude-opus-5-5", 800, 120)
        import json
        datos = json.loads(contenido[0]["text"].split("Destinatarios (JSON):\n", 1)[1])
        return m.LoteRedactado(mensajes=[
            m.MensajeRedactado(contacto_id=d["contacto_id"], asunto="Recordatorio", texto=f"Hola {d['nombre']}, debes {d['deuda']}.",
                               advertencia=None) for d in datos if d["nombre"] not in self.sin_responder]), m.Uso("claude-opus-5-5", 1500, 400)


DEUDA_50 = m.Interpretacion(filtros=[m.Filtro(campo="deuda", operador=">", valor="50000")], todos=False,
                            fecha_mencionada="2026-10-30", proposito="Recordar que el pago vence el viernes", ambiguedades=[])


def test_filtra_redacta_y_avisa_sin_telefono(conn):
    cargar(conn)
    ia = IAMensajes(DEUDA_50)
    res = m.generar(ia, conn, "Escríbeles a los clientes que deben más de $50.000 que el pago vence el viernes",
                    "whatsapp", "cercano", hoy=HOY)
    assert res.estado == "listo" and res.elegidos == 3
    assert [x.nombre for x in res.mensajes] == ["Carolina Muñoz", "Juan Pérez"]
    assert res.mensajes[1].texto == "Hola Juan Pérez, debes $72.500." and res.mensajes[1].destino == "+56 9 8123 4567"
    assert res.mensajes[1].asunto is None                      # WhatsApp no lleva asunto
    assert res.sin_contacto == [("Almacén Don Lucho", "no tiene teléfono")]
    prompt = ia.llamadas[1]["texto"]
    assert "viernes 30 de octubre" in prompt and "María Soto" not in prompt
    assert ia.llamadas[1]["effort"] == "low"
    assert res.uso.costo_usd > 0


def test_correo_necesita_correo_valido(conn):
    cargar(conn)
    res = m.generar(IAMensajes(DEUDA_50), conn, "x", "correo", "formal", hoy=HOY)
    assert ("Carolina Muñoz", "correo no válido") in res.sin_contacto
    assert [x.nombre for x in res.mensajes] == ["Almacén Don Lucho", "Juan Pérez"]
    assert res.mensajes[0].asunto == "Recordatorio"


def test_instruccion_ambigua_se_detiene(conn):
    cargar(conn)
    interp = DEUDA_50.model_copy(update={"ambiguedades": ["¿Qué viernes? Hoy es sábado."]})
    ia = IAMensajes(interp)
    res = m.generar(ia, conn, "que paguen el viernes", "sms", "breve", hoy=HOY)
    assert res.estado == "ambiguo" and res.mensajes == [] and len(ia.llamadas) == 1
    res2 = m.generar(ia, conn, "que paguen el viernes", "sms", "breve", interpretacion=interp, ignorar_dudas=True, hoy=HOY)
    assert res2.estado == "listo" and len(res2.mensajes) == 2


def test_contacto_sin_respuesta_y_sms_largo(conn):
    cargar(conn)
    res = m.generar(IAMensajes(DEUDA_50, sin_responder={"Juan Pérez"}), conn, "x", "sms", "breve", hoy=HOY)
    juan = next(x for x in res.mensajes if x.nombre == "Juan Pérez")
    assert juan.texto == "" and "no escribió" in juan.advertencia


def test_filtros():
    c = {"nombre": "Juan Pérez", "deuda": 72500, "fecha_vencimiento": "2026-10-20", "dias_atraso": 4, "telefono": ""}
    F = m.Filtro
    assert m.cumple(c, F(campo="deuda", operador=">", valor="$50.000"))
    assert not m.cumple(c, F(campo="deuda", operador="<", valor="50000"))
    assert m.cumple(c, F(campo="nombre", operador="==", valor="juan perez"))
    assert m.cumple(c, F(campo="fecha_vencimiento", operador="<", valor="2026-10-24"))
    assert m.cumple(c, F(campo="dias_atraso", operador=">", valor="0"))
    assert m.cumple(c, F(campo="telefono", operador="vacio", valor=None))
    assert not m.cumple(c, F(campo="comuna", operador="==", valor="Maipú"))


def test_errores_y_validaciones(conn):
    with pytest.raises(ValueError, match="No tienes contactos"):
        m.generar(IAMensajes(DEUDA_50), conn, "hola", "whatsapp", "cercano")
    cargar(conn)
    with pytest.raises(ValueError):
        m.generar(IAMensajes(DEUDA_50), conn, "  ", "whatsapp", "cercano")
    with pytest.raises(ErrorIA):
        m.generar(IAFalsa(error=ErrorIA("Sin conexión")), conn, "hola", "whatsapp", "cercano")


def test_guardar_lote_y_editar(conn):
    cargar(conn)
    res = m.generar(IAMensajes(DEUDA_50), conn, "x", "whatsapp", "cercano", hoy=HOY)
    lote = m.guardar_lote(conn, res)
    m.actualizar_mensaje(conn, lote, res.mensajes[0].contacto_id, "Texto corregido", None)
    guardado = m.listar_lotes(conn)[0]
    assert guardado["mensajes"][0]["texto"] == "Texto corregido" and guardado["mensajes"][0]["editado"] == 1
    assert "Para: Carolina Muñoz (+56 9 7654 1122)\nTexto corregido" == m.texto_para_copiar(guardado["mensajes"][0], "whatsapp")


def test_modo_demo_sin_ia(conn):
    cargar(conn)
    res = m.generar(ClienteDemo(), conn, "Escríbeles a los clientes que deben más de $50.000 que el pago vence el viernes",
                    "whatsapp", "cercano", hoy=HOY)
    assert [x.nombre for x in res.mensajes] == ["Carolina Muñoz", "Juan Pérez"]
    assert "$72.500" in res.mensajes[1].texto and "viernes 30 de octubre" in res.mensajes[1].texto
    uno = m.generar(ClienteDemo(), conn, "Recuérdale a María Soto que pase a buscar su pedido", "sms", "formal", hoy=HOY)
    assert [x.nombre for x in uno.mensajes] == ["María Soto"]


def test_envio_no_hace_nada_todavia():
    from core.envio import obtener_enviador
    r = obtener_enviador("whatsapp").enviar("+56 9 1111 2222", "hola")
    assert not r.enviado and "no está activado" in r.detalle
