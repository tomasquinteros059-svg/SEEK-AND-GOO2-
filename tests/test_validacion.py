from core.esquemas import DocumentoTributario, LineaDetalle
from core.validacion import (buscar_duplicado, formatear_rut, parsear_fecha, parsear_monto, rut_valido,
                             validar_documento)
from core import documentos


def doc(**kw) -> DocumentoTributario:
    base = dict(tipo="factura", fecha="2026-10-03", proveedor="Distribuidora El Trigo Ltda.",
                rut_proveedor="77.123.456-9", numero_documento="10238",
                lineas=[LineaDetalle(descripcion="Harina", cantidad=4, precio_unitario=18500, total=74000),
                        LineaDetalle(descripcion="Azúcar", cantidad=2, precio_unitario=21900, total=43800)],
                neto=117800, iva=22382, total=140182, campos_extra=[], campos_dudosos=[], observaciones=None)
    base.update(kw)
    return DocumentoTributario(**base)


def mensajes(avisos):
    return " | ".join(a.mensaje for a in avisos)


def test_rut():
    assert rut_valido("76.543.210-3")
    assert rut_valido("77123456-9")
    assert rut_valido("11.111.111-1")
    assert not rut_valido("77.123.456-1")
    assert not rut_valido("")
    assert formatear_rut("771234569") == "77.123.456-9"


def test_montos_y_fechas():
    assert parsear_monto("$ 12.345") == 12345
    assert parsear_monto("1.234.567") == 1234567
    assert parsear_monto(12990) == 12990
    assert parsear_monto("") is None
    assert parsear_monto("abc") is None
    assert str(parsear_fecha("14-10-2026")) == "2026-10-14"
    assert str(parsear_fecha("2026-10-14")) == "2026-10-14"
    assert parsear_fecha("ayer") is None


def test_factura_que_cuadra_no_tiene_avisos():
    assert validar_documento(doc()) == []


def test_neto_mas_iva_distinto_de_total():
    avisos = validar_documento(doc(total=150182))
    assert any(a.nivel == "error" and a.campo == "total" for a in avisos), mensajes(avisos)


def test_suma_de_lineas_distinta_del_neto():
    avisos = validar_documento(doc(neto=120000, iva=22800, total=142800))
    assert any("suma de las líneas" in a.mensaje for a in avisos), mensajes(avisos)


def test_iva_que_no_es_19_por_ciento():
    avisos = validar_documento(doc(iva=20000, total=137800))
    assert any(a.campo == "iva" for a in avisos), mensajes(avisos)


def test_linea_mal_multiplicada():
    lineas = [LineaDetalle(descripcion="Harina", cantidad=4, precio_unitario=18500, total=70000)]
    avisos = validar_documento(doc(lineas=lineas, neto=70000, iva=13300, total=83300))
    assert any(a.campo == "lineas[0].total" for a in avisos), mensajes(avisos)


def test_boleta_con_precios_iva_incluido_cuadra_con_total():
    boleta = doc(tipo="boleta", neto=None, iva=None, total=117800)
    assert validar_documento(boleta) == []


def test_rut_invalido_y_fecha_futura():
    avisos = validar_documento(doc(rut_proveedor="77.123.456-1", fecha="2099-01-01"))
    campos = {a.campo for a in avisos}
    assert {"rut_proveedor", "fecha"} <= campos


def test_campos_ilegibles_no_generan_falsos_errores():
    avisos = validar_documento(doc(neto=None, iva=None, total=None, lineas=[]))
    assert all(a.nivel != "error" for a in avisos)


def test_duplicados_por_numero_y_proveedor(conn):
    documentos.guardar_tributario(conn, doc())
    assert buscar_duplicado(conn, "DISTRIBUIDORA EL TRIGO LTDA", None, "010238") is not None
    assert buscar_duplicado(conn, "Otro proveedor", "77123456-9", "10238") is not None   # mismo RUT
    assert buscar_duplicado(conn, "Otro proveedor", None, "10238") is None
    assert buscar_duplicado(conn, "Distribuidora El Trigo", None, "99999") is None
