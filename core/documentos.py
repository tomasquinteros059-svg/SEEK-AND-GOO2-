"""Guardar y consultar documentos escaneados en SQLite."""
from __future__ import annotations

import json
import sqlite3

from core.esquemas import DocumentoTributario, Formulario, Lista
from core.ia import Uso


def guardar_tributario(conn, doc: DocumentoTributario, *, archivo_nombre=None, hash_archivo=None, costo_usd=0.0) -> int:
    extras = {c.clave: c.valor for c in doc.campos_extra}
    cur = conn.execute(
        "INSERT INTO documentos (tipo, fecha, proveedor, rut_proveedor, numero_documento, neto, iva, total, "
        "datos_json, campos_dudosos_json, archivo_nombre, hash_archivo, costo_usd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (doc.tipo, doc.fecha, doc.proveedor, doc.rut_proveedor, doc.numero_documento, doc.neto, doc.iva, doc.total,
         json.dumps({"extras": extras, "observaciones": doc.observaciones}, ensure_ascii=False),
         json.dumps(doc.campos_dudosos, ensure_ascii=False), archivo_nombre, hash_archivo, costo_usd),
    )
    doc_id = cur.lastrowid
    conn.executemany(
        "INSERT INTO lineas_documento (documento_id, descripcion, cantidad, precio_unitario, total) VALUES (?,?,?,?,?)",
        [(doc_id, l.descripcion, l.cantidad, l.precio_unitario, l.total) for l in doc.lineas],
    )
    conn.commit()
    return doc_id


def guardar_lista(conn, lista: Lista, **kw) -> int:
    return _guardar_generico(conn, "lista", lista.fecha, lista.model_dump(), lista.campos_dudosos, **kw)


def guardar_formulario(conn, form: Formulario, **kw) -> int:
    return _guardar_generico(conn, "formulario", form.fecha, form.model_dump(), form.campos_dudosos, **kw)


def _guardar_generico(conn, tipo, fecha, datos, dudosos, *, archivo_nombre=None, hash_archivo=None, costo_usd=0.0) -> int:
    cur = conn.execute(
        "INSERT INTO documentos (tipo, fecha, datos_json, campos_dudosos_json, archivo_nombre, hash_archivo, costo_usd) "
        "VALUES (?,?,?,?,?,?,?)",
        (tipo, fecha, json.dumps(datos, ensure_ascii=False), json.dumps(dudosos, ensure_ascii=False),
         archivo_nombre, hash_archivo, costo_usd),
    )
    conn.commit()
    return cur.lastrowid


def registrar_uso(conn: sqlite3.Connection, operacion: str, uso: Uso) -> None:
    conn.execute(
        "INSERT INTO uso_ia (operacion, modelo, tokens_entrada, tokens_salida, costo_usd) VALUES (?,?,?,?,?)",
        (operacion, uso.modelo, uso.tokens_entrada + uso.cache_lectura + uso.cache_escritura,
         uso.tokens_salida, uso.costo_usd),
    )
    conn.commit()


def costo_total(conn: sqlite3.Connection, solo_hoy: bool = False) -> float:
    sql = "SELECT COALESCE(SUM(costo_usd), 0) FROM uso_ia"
    if solo_hoy:
        sql += " WHERE date(creado_en) = date('now', 'localtime')"
    return float(conn.execute(sql).fetchone()[0])


def listar(conn: sqlite3.Connection, limite: int = 50) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT id, tipo, fecha, proveedor, numero_documento, total, archivo_nombre, creado_en "
        "FROM documentos ORDER BY id DESC LIMIT ?", (limite,)
    ).fetchall()


def borrar(conn: sqlite3.Connection, doc_id: int) -> None:
    conn.execute("DELETE FROM documentos WHERE id = ?", (doc_id,))
    conn.commit()


def obtener_todos(conn: sqlite3.Connection) -> list[dict]:
    """Todos los documentos con sus líneas y datos extra, del más antiguo al más nuevo."""
    docs = []
    lineas: dict[int, list[dict]] = {}
    for l in conn.execute("SELECT * FROM lineas_documento ORDER BY id"):
        lineas.setdefault(l["documento_id"], []).append(
            {"descripcion": l["descripcion"], "cantidad": l["cantidad"], "precio_unitario": l["precio_unitario"], "total": l["total"]})
    for f in conn.execute("SELECT * FROM documentos ORDER BY id"):
        d = dict(f)
        datos = json.loads(d.pop("datos_json") or "{}")
        d["campos_dudosos"] = json.loads(d.pop("campos_dudosos_json") or "[]")
        if d["tipo"] in ("boleta", "factura"):
            d["extras"] = datos.get("extras", {})
            d["observaciones"] = datos.get("observaciones")
            d["lineas"] = lineas.get(d["id"], [])
        else:
            d["extras"] = {e["clave"]: e["valor"] for e in datos.get("campos_extra", [])}
            d["titulo"] = datos.get("titulo")
            d["items"] = datos.get("items", [])
            d["campos"] = datos.get("campos", [])
            d["observaciones"] = datos.get("observaciones")
        docs.append(d)
    return docs
