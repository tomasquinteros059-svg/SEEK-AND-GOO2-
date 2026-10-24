"""Columnas configurables por tipo de documento.

Las columnas "base" vienen con la app (se pueden renombrar u ocultar, no borrar).
Las columnas que agrega el usuario se piden a la IA como "campos extra".
"""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from dataclasses import dataclass

TIPOS_DOCUMENTO = {
    "boleta_factura": "Boletas y Facturas",
    "lista": "Listas",
    "formulario": "Formularios",
}

COLUMNAS_BASE: dict[str, list[tuple[str, str]]] = {
    "boleta_factura": [
        ("fecha", "Fecha"),
        ("tipo", "Tipo"),
        ("proveedor", "Proveedor"),
        ("rut_proveedor", "RUT"),
        ("numero_documento", "N° documento"),
        ("neto", "Neto"),
        ("iva", "IVA"),
        ("total", "Total"),
    ],
    "lista": [
        ("fecha", "Fecha"),
        ("titulo", "Título"),
        ("texto", "Ítem"),
        ("cantidad", "Cantidad"),
        ("marcado", "Marcado"),
    ],
    "formulario": [
        ("fecha", "Fecha"),
        ("titulo", "Título"),
    ],
}


@dataclass
class Columna:
    id: int
    tipo_documento: str
    clave: str
    nombre_visible: str
    descripcion: str
    orden: int
    activa: bool
    es_base: bool


def inicializar(conn: sqlite3.Connection) -> None:
    for tipo, cols in COLUMNAS_BASE.items():
        for orden, (clave, nombre) in enumerate(cols):
            conn.execute(
                "INSERT OR IGNORE INTO columnas (tipo_documento, clave, nombre_visible, orden, es_base) "
                "VALUES (?, ?, ?, ?, 1)",
                (tipo, clave, nombre, orden),
            )


def _fila(r: sqlite3.Row) -> Columna:
    return Columna(
        id=r["id"],
        tipo_documento=r["tipo_documento"],
        clave=r["clave"],
        nombre_visible=r["nombre_visible"],
        descripcion=r["descripcion"],
        orden=r["orden"],
        activa=bool(r["activa"]),
        es_base=bool(r["es_base"]),
    )


def listar(conn: sqlite3.Connection, tipo: str, solo_activas: bool = False) -> list[Columna]:
    sql = "SELECT * FROM columnas WHERE tipo_documento = ?"
    if solo_activas:
        sql += " AND activa = 1"
    sql += " ORDER BY orden, id"
    return [_fila(r) for r in conn.execute(sql, (tipo,))]


def extras_activas(conn: sqlite3.Connection, tipo: str) -> list[Columna]:
    return [c for c in listar(conn, tipo, solo_activas=True) if not c.es_base]


def clave_desde_nombre(nombre: str) -> str:
    texto = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^a-zA-Z0-9]+", "_", texto).strip("_").lower()
    return texto or "campo"


def agregar(conn: sqlite3.Connection, tipo: str, nombre: str, descripcion: str = "") -> Columna:
    """Agrega una columna nueva (la IA la llenará en los próximos escaneos)."""
    nombre = nombre.strip()
    if not nombre:
        raise ValueError("La columna necesita un nombre.")
    if tipo not in TIPOS_DOCUMENTO:
        raise ValueError("Tipo de documento desconocido.")
    existentes = {c.clave for c in listar(conn, tipo)}
    nombres = {c.nombre_visible.lower() for c in listar(conn, tipo)}
    if nombre.lower() in nombres:
        raise ValueError(f"Ya existe una columna «{nombre}».")
    base = clave_desde_nombre(nombre)[:40]
    clave, n = base, 2
    while clave in existentes:
        clave, n = f"{base}_{n}", n + 1
    orden = (conn.execute("SELECT COALESCE(MAX(orden), 0) FROM columnas WHERE tipo_documento = ?", (tipo,)).fetchone()[0]) + 1
    conn.execute(
        "INSERT INTO columnas (tipo_documento, clave, nombre_visible, descripcion, orden, activa, es_base) VALUES (?,?,?,?,?,1,0)",
        (tipo, clave, nombre, descripcion.strip(), orden),
    )
    conn.commit()
    return next(c for c in listar(conn, tipo) if c.clave == clave)


def actualizar(conn: sqlite3.Connection, col_id: int, *, nombre_visible: str | None = None,
               descripcion: str | None = None, activa: bool | None = None, orden: int | None = None) -> None:
    campos, valores = [], []
    if nombre_visible is not None:
        if not nombre_visible.strip():
            raise ValueError("El nombre de la columna no puede quedar vacío.")
        campos.append("nombre_visible = ?"); valores.append(nombre_visible.strip())
    if descripcion is not None:
        campos.append("descripcion = ?"); valores.append(descripcion.strip())
    if activa is not None:
        campos.append("activa = ?"); valores.append(1 if activa else 0)
    if orden is not None:
        campos.append("orden = ?"); valores.append(int(orden))
    if campos:
        conn.execute(f"UPDATE columnas SET {', '.join(campos)} WHERE id = ?", (*valores, col_id))
        conn.commit()


def borrar(conn: sqlite3.Connection, col_id: int) -> None:
    """Borra una columna agregada por el usuario. Las columnas base solo se pueden ocultar."""
    fila = conn.execute("SELECT es_base FROM columnas WHERE id = ?", (col_id,)).fetchone()
    if fila is None:
        return
    if fila["es_base"]:
        raise ValueError("Las columnas base no se borran; puedes ocultarlas.")
    conn.execute("DELETE FROM columnas WHERE id = ?", (col_id,))
    conn.commit()
