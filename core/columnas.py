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
