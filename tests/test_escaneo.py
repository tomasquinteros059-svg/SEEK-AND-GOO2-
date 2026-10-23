"""Tests del escaneo con la IA simulada (no se hacen llamadas reales ni se gasta dinero)."""
import io
import json

import anthropic
import httpx2 as httpx
import pytest
from PIL import Image

from core import documentos, escaneo
from core.config import Config
from core.demo import ClienteDemo
from core.esquemas import ResultadoEscaneo
from core.ia import BETA_RESPALDO, ClienteIA, ErrorIA, Uso
from core.imagenes import ErrorArchivo, preparar
from tests.conftest import EJEMPLOS, IAFalsa, respuesta


def archivo(nombre="boleta_minimarket.jpg"):
    return preparar(nombre, (EJEMPLOS / nombre).read_bytes())


# ---------- Flujo de escaneo ----------

def test_boleta_se_extrae_y_cuadra(conn):
    ia = IAFalsa(respuesta("boleta_minimarket"))
    res = escaneo.escanear(ia, conn, archivo(), "automatico")
    assert res.error is None and res.tipo == "boleta_factura"
    doc = res.resultado.documento_tributario
    assert doc.total == 16730 and len(doc.lineas) == 4
    assert "lineas[3].descripcion" in doc.campos_dudosos
    assert [a for a in res.avisos if a.nivel == "error"] == []
    assert res.uso.costo_usd > 0
    # Se envió la imagen y la instrucción, con el esquema y esfuerzo medio
    llamada = ia.llamadas[0]
    assert llamada["contenido"][0]["type"] == "image"
    assert llamada["esquema"] is ResultadoEscaneo and llamada["effort"] == "medium"
    assert "NUNCA inventes" in llamada["system"]


def test_factura_con_error_de_suma(conn):
    res = escaneo.escanear(IAFalsa(respuesta("factura_con_error")), conn, archivo("factura_con_error.jpg"))
    assert any(a.nivel == "error" and "Neto + IVA" in a.mensaje for a in res.avisos)


def test_foto_borrosa_avisa_ilegible(conn):
    res = escaneo.escanear(IAFalsa(respuesta("foto_borrosa")), conn, archivo("foto_borrosa.jpg"))
    assert any("ilegible" in a.mensaje.lower() for a in res.avisos)
    assert res.resultado.documento_tributario is None   # no se inventan datos


def test_tipo_elegido_distinto_al_detectado(conn):
    res = escaneo.escanear(IAFalsa(respuesta("lista_feria_a_mano")), conn, archivo("lista_feria_a_mano.jpg"),
                           "boleta_factura")
    assert any("parece ser" in a.mensaje for a in res.avisos)


def test_error_de_ia_se_muestra_en_espanol(conn):
    ia = IAFalsa(error=ErrorIA("Llegaste al límite de uso de la API."))
    res = escaneo.escanear(ia, conn, archivo())
    assert res.error == "Llegaste al límite de uso de la API." and res.resultado is None


def test_detecta_duplicados(conn):
    a = archivo()
    primero = escaneo.escanear(IAFalsa(respuesta("boleta_minimarket")), conn, a)
    documentos.guardar_tributario(conn, primero.resultado.documento_tributario, hash_archivo=a.hash)
    segundo = escaneo.escanear(IAFalsa(respuesta("boleta_minimarket")), conn, a)
    assert segundo.duplicado_de is not None and segundo.misma_foto_de is not None


def test_prompt_incluye_columnas_extra_y_proveedores(conn):
    conn.execute("INSERT INTO columnas (tipo_documento, clave, nombre_visible, descripcion) "
                 "VALUES ('boleta_factura', 'forma_pago', 'Forma de pago', 'Efectivo o tarjeta')")
    documentos.guardar_tributario(conn, respuesta("factura_distribuidora").documento_tributario)
    system = escaneo.construir_system(conn, "El proveedor de harina es El Trigo.")
    assert 'clave "forma_pago"' in system
    assert "DISTRIBUIDORA EL TRIGO LTDA. (RUT 77.123.456-9)" in system
    assert "El proveedor de harina es El Trigo." in system


# ---------- Preparación de archivos ----------

def test_prepara_png_con_transparencia_y_reduce_tamano():
    img = Image.new("RGBA", (4000, 3000), (255, 0, 0, 128))
    buf = io.BytesIO(); img.save(buf, "PNG")
    prep = preparar("foto.png", buf.getvalue())
    assert prep.tipo_medio == "image/jpeg" and max(prep.ancho, prep.alto) == 2000


def test_prepara_heic():
    pillow_heif = pytest.importorskip("pillow_heif")
    buf = io.BytesIO()
    try:
        Image.new("RGB", (800, 600), "white").save(buf, format="HEIF")
    except Exception:
        pytest.skip("Este sistema no puede crear HEIC para la prueba")
    assert preparar("foto.heic", buf.getvalue()).tipo_medio == "image/jpeg"


def test_pdf_se_envia_como_documento():
    prep = preparar("factura.pdf", b"%PDF-1.4 contenido")
    assert prep.bloque_para_ia()["type"] == "document"


@pytest.mark.parametrize("nombre,datos", [("hoja.xlsx", b"x"), ("foto.jpg", b"no es imagen"),
                                          ("doc.pdf", b"nada"), ("vacio.png", b"")])
def test_archivos_invalidos(nombre, datos):
    with pytest.raises(ErrorArchivo):
        preparar(nombre, datos)


def test_foto_muy_pequena_avisa():
    buf = io.BytesIO(); Image.new("RGB", (200, 150), "white").save(buf, "JPEG")
    assert preparar("chica.jpg", buf.getvalue()).aviso


# ---------- Cliente real de Claude con HTTP simulado ----------

def config(**kw):
    base = dict(api_key="sk-ant-prueba", modelo="claude-opus-5-5", dolar_clp=950.0, usar_respaldo=True,
                modo_demo=False, datos_dir=EJEMPLOS)
    base.update(kw)
    return Config(**base)


def cliente_http(manejador):
    return anthropic.Anthropic(api_key="sk-ant-prueba", base_url="http://prueba.local", max_retries=0,
                               http_client=httpx.Client(transport=httpx.MockTransport(manejador)))


def mensaje_api(texto: str, stop="end_turn"):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-opus-5-5",
            "content": [{"type": "text", "text": texto}], "stop_reason": stop, "stop_sequence": None,
            "usage": {"input_tokens": 3000, "output_tokens": 1000, "cache_read_input_tokens": 0,
                      "cache_creation_input_tokens": 0}}


def test_cliente_envia_esquema_esfuerzo_y_respaldo():
    pedidos = []
    contenido = respuesta("factura_distribuidora").model_dump_json()

    def manejador(req: httpx.Request):
        pedidos.append(req)
        return httpx.Response(200, json=mensaje_api(contenido))

    ia = ClienteIA(config(), cliente=cliente_http(manejador))
    datos, uso = ia.generar(system="reglas", contenido=[{"type": "text", "text": "hola"}], esquema=ResultadoEscaneo)
    cuerpo = json.loads(pedidos[0].content)
    assert cuerpo["model"] == "claude-opus-5-5"
    assert cuerpo["output_config"]["effort"] == "medium"
    assert cuerpo["output_config"]["format"]["type"] == "json_schema"
    assert cuerpo["fallbacks"] == "default"
    assert BETA_RESPALDO in pedidos[0].headers["anthropic-beta"]
    assert datos.documento_tributario.total == 256683
    assert uso.costo_usd == pytest.approx((3000 * 4 + 1000 * 20) / 1e6)


def test_si_la_cuenta_no_tiene_respaldo_reintenta_sin_el():
    llamadas = []

    def manejador(req):
        llamadas.append(json.loads(req.content))
        if "fallbacks" in llamadas[-1]:
            return httpx.Response(400, json={"type": "error", "error": {"type": "invalid_request_error",
                                  "message": "Unexpected value(s) for the `anthropic-beta` header."}})
        return httpx.Response(200, json=mensaje_api(respuesta("boleta_minimarket").model_dump_json()))

    ia = ClienteIA(config(), cliente=cliente_http(manejador))
    datos, _ = ia.generar(system="x", contenido=[{"type": "text", "text": "x"}], esquema=ResultadoEscaneo)
    assert datos.tipo_detectado == "boleta_factura" and len(llamadas) == 2 and "fallbacks" not in llamadas[1]


@pytest.mark.parametrize("codigo,frase", [(401, "clave de API no es válida"), (429, "límite de uso"),
                                          (529, "saturado"), (413, "demasiado grande")])
def test_errores_http_en_espanol(codigo, frase):
    def manejador(req):
        return httpx.Response(codigo, json={"type": "error", "error": {"type": "x", "message": "x"}})

    ia = ClienteIA(config(usar_respaldo=False), cliente=cliente_http(manejador))
    with pytest.raises(ErrorIA, match=frase):
        ia.generar(system="x", contenido=[{"type": "text", "text": "x"}], esquema=ResultadoEscaneo)


def test_sin_conexion():
    def manejador(req):
        raise httpx.ConnectError("sin red")

    ia = ClienteIA(config(usar_respaldo=False), cliente=cliente_http(manejador))
    with pytest.raises(ErrorIA, match="conexión"):
        ia.generar(system="x", contenido=[{"type": "text", "text": "x"}], esquema=ResultadoEscaneo)


def test_sin_clave_de_api():
    with pytest.raises(ErrorIA, match="No hay clave"):
        ClienteIA(config(api_key=None))


def test_modo_demo_reconoce_las_fotos_de_ejemplo():
    demo = ClienteDemo()
    datos, uso = demo.generar(system="", contenido=[archivo("formulario_cliente.jpg").bloque_para_ia()],
                              esquema=ResultadoEscaneo)
    assert datos.tipo_detectado == "formulario" and isinstance(uso, Uso)
    otra = io.BytesIO(); Image.new("RGB", (800, 800), "white").save(otra, "JPEG")
    with pytest.raises(ErrorIA, match="Modo demostración"):
        demo.generar(system="", contenido=[preparar("x.jpg", otra.getvalue()).bloque_para_ia()],
                     esquema=ResultadoEscaneo)
