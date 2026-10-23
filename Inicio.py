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

col1, col2 = st.columns(2)
with col1:
    st.page_link("pages/1_Escanear.py", label="**Escanear documentos**", icon="📷")
    st.caption("Sube fotos o PDF, revisa lo extraído y guárdalo.")
with col2:
    st.markdown("🚧 **Próximamente:** Excel · Base de conocimiento · Mensajes")
