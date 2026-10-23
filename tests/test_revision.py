from core import revision
from core.esquemas import CampoExtra
from tests.conftest import respuesta


def test_ida_y_vuelta_sin_cambios(conn):
    d = respuesta("boleta_minimarket").documento_tributario
    enc, lin = revision.encabezado_tributario(conn, d), revision.lineas_tributario(d)
    assert revision.tributario_desde_edicion("boleta", enc, lin, d) == d


def test_marca_campos_dudosos(conn):
    d = respuesta("boleta_minimarket").documento_tributario
    lin = revision.lineas_tributario(d)
    assert lin.loc[3, "⚠"].startswith("⚠") and lin.loc[0, "⚠"] == ""
    lista = respuesta("lista_feria_a_mano").lista
    enc = revision.encabezado_simple(conn, "lista", lista.titulo, lista.fecha, lista.campos_extra, lista.campos_dudosos)
    assert enc.loc["fecha", "⚠"] and not enc.loc["titulo", "⚠"]


def test_aplica_correcciones_del_usuario(conn):
    d = respuesta("factura_con_error").documento_tributario
    enc, lin = revision.encabezado_tributario(conn, d), revision.lineas_tributario(d)
    enc.loc["total", "Valor"] = "$256.683"
    enc.loc["fecha", "Valor"] = "04/10/2026"
    enc.loc["rut_proveedor", "Valor"] = "771234569"
    lin.loc[len(lin)] = ["", None, None, None, None]   # fila vacía agregada sin querer
    nuevo = revision.tributario_desde_edicion("factura", enc, lin, d)
    assert nuevo.total == 256683
    assert nuevo.fecha == "2026-10-04"
    assert nuevo.rut_proveedor == "77.123.456-9"
    assert len(nuevo.lineas) == 4


def test_columnas_extra_y_renombradas(conn):
    conn.execute("INSERT INTO columnas (tipo_documento, clave, nombre_visible, descripcion, orden) "
                 "VALUES ('boleta_factura', 'forma_pago', 'Forma de pago', 'Efectivo, débito, etc.', 20)")
    conn.execute("UPDATE columnas SET nombre_visible='Emisor' WHERE clave='proveedor' AND tipo_documento='boleta_factura'")
    d = respuesta("boleta_minimarket").documento_tributario.model_copy(
        update={"campos_extra": [CampoExtra(clave="forma_pago", valor="Débito")]})
    enc = revision.encabezado_tributario(conn, d)
    assert enc.loc["proveedor", "Campo"] == "Emisor"
    assert enc.loc["extra:forma_pago", "Valor"] == "Débito"
    nuevo = revision.tributario_desde_edicion("boleta", enc, revision.lineas_tributario(d), d)
    assert nuevo.campos_extra == [CampoExtra(clave="forma_pago", valor="Débito")]
