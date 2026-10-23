"""Piezas de interfaz compartidas por todas las páginas de Streamlit."""
from __future__ import annotations

import sqlite3

import streamlit as st

from core import config as cfg
from core import db, documentos
from core.ia import ClienteIA, ErrorIA, GeneradorIA, formatear_costo

AMARILLO = "background-color: #fff3b0; color: #5c4400"


@st.cache_resource
def _conexion(ruta: str) -> sqlite3.Connection:
    return db.conectar(ruta)


def config() -> cfg.Config:
    return cfg.cargar()


def conexion() -> sqlite3.Connection:
    return _conexion(str(config().ruta_db))


def cliente_ia() -> tuple[GeneradorIA | None, str | None]:
    """Devuelve (cliente, mensaje_de_error)."""
    c = config()
    if c.modo_demo:
        from core.demo import ClienteDemo

        return ClienteDemo(modelo=c.modelo), None
    try:
        return ClienteIA(c), None
    except ErrorIA as e:
        return None, e.mensaje


def md(texto: str) -> str:
    """Escapa el signo $ para que Streamlit no lo interprete como fórmula matemática."""
    return texto.replace("$", "\\$")


def costo(usd: float) -> str:
    """Costo listo para mostrar en Markdown."""
    return md(formatear_costo(usd, config().dolar_clp))


def barra_lateral() -> None:
    c = config()
    with st.sidebar:
        if c.modo_demo:
            st.info("🧪 **Modo demostración**: respuestas simuladas, sin costo. Solo funciona con las fotos de «ejemplos».")
        elif c.clave_configurada:
            st.success(f"✅ IA conectada ({c.modelo})")
        else:
            st.error("⚠️ Falta la clave de API en el archivo .env")
        conn = conexion()
        st.caption("Gasto en IA")
        st.markdown(f"Hoy: **{costo(documentos.costo_total(conn, solo_hoy=True))}**  \n"
                    f"Total: {costo(documentos.costo_total(conn))}")
