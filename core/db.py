"""Base de datos SQLite: un solo archivo con todo lo del negocio."""
from __future__ import annotations

import sqlite3
from pathlib import Path

ESQUEMA = """
CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL,                 -- boleta | factura | lista | formulario
    fecha TEXT,                         -- aaaa-mm-dd
    proveedor TEXT,
    rut_proveedor TEXT,
    numero_documento TEXT,
    neto INTEGER,
    iva INTEGER,
    total INTEGER,
    datos_json TEXT NOT NULL DEFAULT '{}',          -- listas, formularios y campos extra
    campos_dudosos_json TEXT NOT NULL DEFAULT '[]',
    archivo_nombre TEXT,
    hash_archivo TEXT,
    costo_usd REAL NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_documentos_hash ON documentos(hash_archivo);

CREATE TABLE IF NOT EXISTS lineas_documento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento_id INTEGER NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    descripcion TEXT,
    cantidad REAL,
    precio_unitario INTEGER,
    total INTEGER
);

CREATE TABLE IF NOT EXISTS columnas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_documento TEXT NOT NULL,       -- boleta_factura | lista | formulario
    clave TEXT NOT NULL,
    nombre_visible TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    orden INTEGER NOT NULL DEFAULT 0,
    activa INTEGER NOT NULL DEFAULT 1,
    es_base INTEGER NOT NULL DEFAULT 0,
    UNIQUE (tipo_documento, clave)
);

CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    etiquetas TEXT NOT NULL DEFAULT '',
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS archivos_conocimiento (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    texto_extraido TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS contactos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    correo TEXT,
    deuda INTEGER,
    fecha_vencimiento TEXT,
    extra_json TEXT NOT NULL DEFAULT '{}',
    origen TEXT,
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS lotes_mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instruccion TEXT NOT NULL,
    canal TEXT NOT NULL,
    tono TEXT NOT NULL,
    filtro_json TEXT NOT NULL DEFAULT '{}',
    avisos_json TEXT NOT NULL DEFAULT '[]',
    costo_usd REAL NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS mensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lote_id INTEGER NOT NULL REFERENCES lotes_mensajes(id) ON DELETE CASCADE,
    contacto_id INTEGER REFERENCES contactos(id) ON DELETE SET NULL,
    destinatario TEXT NOT NULL,
    destino TEXT,
    asunto TEXT,
    texto TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'borrador',
    editado INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS uso_ia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operacion TEXT NOT NULL,
    modelo TEXT,
    tokens_entrada INTEGER NOT NULL DEFAULT 0,
    tokens_salida INTEGER NOT NULL DEFAULT 0,
    costo_usd REAL NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
"""


def conectar(ruta: str | Path) -> sqlite3.Connection:
    """Abre (o crea) la base de datos y deja las tablas y columnas base listas."""
    conn = sqlite3.connect(str(ruta), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(ESQUEMA)
    from core import columnas  # evita import circular

    columnas.inicializar(conn)
    conn.commit()
    return conn
