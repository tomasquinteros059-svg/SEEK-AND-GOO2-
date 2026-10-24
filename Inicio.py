"""Asistente de Negocio — página de inicio.

Ejecutar con:  streamlit run Inicio.py
"""
import streamlit as st

from core import ui

st.set_page_config(page_title="Asistente de Negocio", page_icon="🧾", layout="wide")
ui.barra_lateral()

st.title("🧾 Asistente de Negocio")
st.write("Digitaliza boletas, facturas, listas y formularios, guárdalos en Excel y prepara mensajes para tus clientes.")

c = ui.config()
if not c.modo_demo and not c.clave_configurada:
    st.warning(
        "**Falta configurar la clave de API.**\n\n"
        "1. Copia el archivo `.env.example` y renómbralo como `.env`.\n"
        "2. Escribe tu clave en `ANTHROPIC_API_KEY=`.\n"
        "3. Reinicia la app.\n\n"
        "Para probar sin clave, pon `MODO_DEMO=1` en `.env` y usa las fotos de la carpeta `ejemplos`."
    )

PAGINAS = [
    ("pages/1_Escanear.py", "Escanear documentos", "📷", "Sube fotos o PDF, revisa lo extraído y guárdalo."),
    ("pages/2_Excel.py", "Excel", "📊", "Descarga el Excel o agrega a uno existente. Configura las columnas."),
    ("pages/3_Conocimiento.py", "Base de conocimiento", "📚", "Clientes, notas y documentos de tu negocio."),
    ("pages/4_Mensajes.py", "Crear mensajes", "✉️", "WhatsApp, correo o SMS a partir de una instrucción simple."),
]
cols = st.columns(2)
for i, (ruta, titulo, icono, desc) in enumerate(PAGINAS):
    with cols[i % 2].container(border=True):
        st.page_link(ruta, label=f"**{titulo}**", icon=icono)
        st.caption(desc)
