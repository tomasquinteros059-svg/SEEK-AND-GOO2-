"""Convierte lo extraído por la IA en tablas editables, y las tablas editadas de vuelta en datos.

No depende de Streamlit, así se puede probar con tests.
"""
from __future__ import annotations

import re
import sqlite3

import pandas as pd

from core import columnas
from core.esquemas import (CampoExtra, CampoFormulario, DocumentoTributario, Formulario, ItemLista,
                           LineaDetalle, Lista)
from core.validacion import (fecha_a_texto, formatear_rut, parsear_fecha, parsear_monto, parsear_numero,
                             pesos)

_RUTA = re.compile(r"^(\w+)\[(\d+)\](?:\.(\w+))?$")

NOMBRES_LINEA = {"descripcion": "Descripción", "cantidad": "Cantidad", "precio_unitario": "P. unitario",
                 "total": "Total", "texto": "Ítem", "marcado": "Marcado", "etiqueta": "Etiqueta", "valor": "Valor"}


def dudosos_simples(campos: list[str]) -> set[str]:
    return {c for c in campos if "[" not in c}


def dudosos_por_fila(campos: list[str], lista: str) -> dict[int, list[str]]:
    out: dict[int, list[str]] = {}
    for c in campos:
        m = _RUTA.match(c.strip())
        if m and m.group(1) == lista:
            out.setdefault(int(m.group(2)), []).append(m.group(3) or "fila")
    return out


def _marca(dudoso: bool) -> str:
    return "⚠ Revisar" if dudoso else ""


def _texto(v) -> str:
    if v is None or (isinstance(v, float) and v != v):
        return ""
    return str(v).strip()


def _o_none(v) -> str | None:
    t = _texto(v)
    return t or None


# ---------- Encabezado (tabla vertical Campo | Valor) ----------

def _nombres(conn: sqlite3.Connection, tipo: str) -> dict[str, str]:
    return {c.clave: c.nombre_visible for c in columnas.listar(conn, tipo)}


def _filas_extras(conn, tipo, extras: list[CampoExtra], dudosos: set[str]) -> list[dict]:
    valores = {e.clave: e.valor for e in extras}
    filas = []
    for c in columnas.extras_activas(conn, tipo):
        filas.append({"clave": f"extra:{c.clave}", "⚠": _marca(f"campos_extra.{c.clave}" in dudosos or c.clave in dudosos),
                      "Campo": c.nombre_visible, "Valor": _texto(valores.get(c.clave))})
    return filas


def encabezado_tributario(conn, doc: DocumentoTributario) -> pd.DataFrame:
    n = _nombres(conn, "boleta_factura")
    dud = dudosos_simples(doc.campos_dudosos)
    valores = {
        "fecha": fecha_a_texto(doc.fecha), "proveedor": _texto(doc.proveedor),
        "rut_proveedor": _texto(doc.rut_proveedor), "numero_documento": _texto(doc.numero_documento),
        "neto": pesos(doc.neto) if doc.neto is not None else "",
        "iva": pesos(doc.iva) if doc.iva is not None else "",
        "total": pesos(doc.total) if doc.total is not None else "",
    }
    filas = [{"clave": k, "⚠": _marca(k in dud), "Campo": n.get(k, k), "Valor": v} for k, v in valores.items()]
    filas += _filas_extras(conn, "boleta_factura", doc.campos_extra, dud)
    return pd.DataFrame(filas).set_index("clave")


def encabezado_simple(conn, tipo: str, titulo, fecha, extras, campos_dudosos) -> pd.DataFrame:
    n = _nombres(conn, tipo)
    dud = dudosos_simples(campos_dudosos)
    filas = [
        {"clave": "titulo", "⚠": _marca("titulo" in dud), "Campo": n.get("titulo", "Título"), "Valor": _texto(titulo)},
        {"clave": "fecha", "⚠": _marca("fecha" in dud), "Campo": n.get("fecha", "Fecha"), "Valor": fecha_a_texto(fecha)},
    ]
    filas += _filas_extras(conn, tipo, extras, dud)
    return pd.DataFrame(filas).set_index("clave")


def _extras_desde(enc: pd.DataFrame) -> list[CampoExtra]:
    return [CampoExtra(clave=k.split(":", 1)[1], valor=_o_none(v))
            for k, v in enc["Valor"].items() if str(k).startswith("extra:")]


def _fecha_iso(texto) -> str | None:
    t = _o_none(texto)
    if t is None:
        return None
    f = parsear_fecha(t)
    return f.isoformat() if f else t   # si no se entiende, se deja tal cual y la validación avisa


# ---------- Detalle (tablas de filas) ----------

def _df_detalle(filas: list[dict], dudosos: dict[int, list[str]], columnas_df: list[str]) -> pd.DataFrame:
    df = pd.DataFrame(filas, columns=columnas_df)
    df.insert(0, "⚠", [
        ("⚠ " + ", ".join(NOMBRES_LINEA.get(c, c) for c in dudosos[i])) if i in dudosos else ""
        for i in range(len(df))
    ])
    return df


def lineas_tributario(doc: DocumentoTributario) -> pd.DataFrame:
    filas = [{"Descripción": l.descripcion, "Cantidad": l.cantidad, "P. unitario": l.precio_unitario,
              "Total": l.total} for l in doc.lineas]
    df = _df_detalle(filas, dudosos_por_fila(doc.campos_dudosos, "lineas"),
                     ["Descripción", "Cantidad", "P. unitario", "Total"])
    return df.astype({"Cantidad": "float64", "P. unitario": "Int64", "Total": "Int64"})


def items_lista(lista: Lista) -> pd.DataFrame:
    filas = [{"Ítem": _texto(i.texto), "Cantidad": _texto(i.cantidad), "Marcado": bool(i.marcado)} for i in lista.items]
    return _df_detalle(filas, dudosos_por_fila(lista.campos_dudosos, "items"), ["Ítem", "Cantidad", "Marcado"])


def campos_formulario(form: Formulario) -> pd.DataFrame:
    filas = [{"Etiqueta": _texto(c.etiqueta), "Valor": _texto(c.valor)} for c in form.campos]
    return _df_detalle(filas, dudosos_por_fila(form.campos_dudosos, "campos"), ["Etiqueta", "Valor"])


def _filas_validas(df: pd.DataFrame, columnas_datos: list[str]):
    for _, fila in df.iterrows():
        if all(_texto(fila.get(c)) == "" for c in columnas_datos):
            continue  # fila vacía agregada por error
        yield fila


# ---------- De tablas editadas a datos ----------

def tributario_desde_edicion(tipo: str, enc: pd.DataFrame, lineas: pd.DataFrame,
                             original: DocumentoTributario) -> DocumentoTributario:
    v = enc["Valor"]
    rut = _o_none(v.get("rut_proveedor"))
    return DocumentoTributario(
        tipo=tipo if tipo in ("boleta", "factura") else original.tipo,
        fecha=_fecha_iso(v.get("fecha")),
        proveedor=_o_none(v.get("proveedor")),
        rut_proveedor=formatear_rut(rut) if rut else None,
        numero_documento=_o_none(v.get("numero_documento")),
        lineas=[
            LineaDetalle(descripcion=_o_none(f.get("Descripción")), cantidad=parsear_numero(f.get("Cantidad")),
                         precio_unitario=parsear_monto(f.get("P. unitario")), total=parsear_monto(f.get("Total")))
            for f in _filas_validas(lineas, ["Descripción", "Cantidad", "P. unitario", "Total"])
        ],
        neto=parsear_monto(_o_none(v.get("neto"))),
        iva=parsear_monto(_o_none(v.get("iva"))),
        total=parsear_monto(_o_none(v.get("total"))),
        campos_extra=_extras_desde(enc),
        campos_dudosos=original.campos_dudosos,
        observaciones=original.observaciones,
    )


def lista_desde_edicion(enc: pd.DataFrame, items: pd.DataFrame, original: Lista) -> Lista:
    v = enc["Valor"]
    return Lista(
        titulo=_o_none(v.get("titulo")), fecha=_fecha_iso(v.get("fecha")),
        items=[ItemLista(texto=_o_none(f.get("Ítem")), cantidad=_o_none(f.get("Cantidad")),
                         marcado=bool(f.get("Marcado")) if f.get("Marcado") == f.get("Marcado") else None)
               for f in _filas_validas(items, ["Ítem", "Cantidad"])],
        campos_extra=_extras_desde(enc), campos_dudosos=original.campos_dudosos,
        observaciones=original.observaciones,
    )


def formulario_desde_edicion(enc: pd.DataFrame, campos: pd.DataFrame, original: Formulario) -> Formulario:
    v = enc["Valor"]
    return Formulario(
        titulo=_o_none(v.get("titulo")), fecha=_fecha_iso(v.get("fecha")),
        campos=[CampoFormulario(etiqueta=_texto(f.get("Etiqueta")) or "(sin etiqueta)", valor=_o_none(f.get("Valor")))
                for f in _filas_validas(campos, ["Etiqueta", "Valor"])],
        campos_extra=_extras_desde(enc), campos_dudosos=original.campos_dudosos,
        observaciones=original.observaciones,
    )
