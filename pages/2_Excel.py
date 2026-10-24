"""Página 2: columnas configurables y descarga del Excel."""
from __future__ import annotations

from datetime import date

import pandas as pd
import streamlit as st

from core import columnas, documentos, excel, ui
from core.validacion import fecha_a_texto, pesos

st.set_page_config(page_title="Excel · Asistente de Negocio", page_icon="📊", layout="wide")
ui.barra_lateral()
conn = ui.conexion()
MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

st.title("📊 Excel")
st.write("Una hoja por tipo de documento, el detalle de productos y una hoja **Resumen** con totales por mes y "
         "por proveedor. Montos con signo $ y punto de miles, fechas dd-mm-aaaa.")

# ---------- Descargas ----------
docs = documentos.obtener_todos(conn)
c1, c2 = st.columns(2, gap="large")
with c1:
    st.subheader("Crear un Excel nuevo")
    if docs:
        st.download_button("⬇️ Descargar Excel", data=excel.crear_libro(conn), type="primary",
                           file_name=f"documentos_{date.today():%Y-%m-%d}.xlsx", mime=MIME_XLSX)
    else:
        st.info("Todavía no hay documentos guardados. Escanea alguno primero.")
    ruta_local = ui.config().datos_dir / "documentos.xlsx"
    st.caption(ui.md(f"Además, cada vez que guardas un documento se actualiza el archivo `{ruta_local}`."))
with c2:
    st.subheader("Agregar a un Excel existente")
    existente = st.file_uploader("Sube tu Excel (.xlsx)", type=["xlsx"], key="existente")
    if existente is not None:
        try:
            res = excel.agregar_a_existente(conn, existente.getvalue())
        except ValueError as e:
            st.error(str(e))
        else:
            st.success(f"Se agregaron {res.agregados} documento(s)." +
                       (f" {res.omitidos} ya estaban en el archivo y no se repitieron." if res.omitidos else ""))
            nombre = existente.name.removesuffix(".xlsx") + "_actualizado.xlsx"
            st.download_button("⬇️ Descargar Excel actualizado", data=res.contenido, file_name=nombre, mime=MIME_XLSX,
                               type="primary")

# ---------- Columnas ----------
st.divider()
st.header("Columnas")
st.write("Renombra, oculta, ordena o agrega columnas. Las columnas nuevas se le piden a la IA en los próximos escaneos.")
tipo = st.radio("Tipo de documento", list(columnas.TIPOS_DOCUMENTO), format_func=columnas.TIPOS_DOCUMENTO.get,
                horizontal=True)
cols = columnas.listar(conn, tipo)
df = pd.DataFrame([{"id": c.id, "Nombre": c.nombre_visible, "Qué debe buscar la IA": c.descripcion,
                    "Visible": c.activa, "Orden": c.orden, "Tipo": "Base" if c.es_base else "Agregada"} for c in cols])
editado = st.data_editor(
    df, key=f"cols_{tipo}", hide_index=True, width="stretch", disabled=["id", "Tipo"],
    column_config={"id": None, "Orden": st.column_config.NumberColumn(step=1, width=80),
                   "Visible": st.column_config.CheckboxColumn(width=80),
                   "Qué debe buscar la IA": st.column_config.TextColumn(help="Solo para columnas agregadas")},
)
if st.button("💾 Guardar cambios de columnas"):
    try:
        for _, fila in editado.iterrows():
            original = next(c for c in cols if c.id == fila["id"])
            columnas.actualizar(conn, original.id, nombre_visible=str(fila["Nombre"] or ""),
                                descripcion=None if original.es_base else str(fila["Qué debe buscar la IA"] or ""),
                                activa=bool(fila["Visible"]), orden=int(fila["Orden"] or 0))
    except ValueError as e:
        st.error(str(e))
    else:
        st.toast("Columnas guardadas", icon="✅")
        st.rerun()

with st.form("nueva_columna", clear_on_submit=True):
    st.markdown("**Agregar columna**")
    a, b = st.columns(2)
    nombre = a.text_input("Nombre", placeholder="Ej: Forma de pago")
    desc = b.text_input("Qué debe buscar la IA (opcional)", placeholder="Ej: efectivo, débito o crédito")
    if st.form_submit_button("Agregar"):
        try:
            columnas.agregar(conn, tipo, nombre, desc)
        except ValueError as e:
            st.error(str(e))
        else:
            st.toast(f"Columna «{nombre}» agregada", icon="✅")
            st.rerun()

agregadas = [c for c in cols if not c.es_base]
if agregadas:
    with st.expander("Borrar una columna agregada"):
        elegida = st.selectbox("Columna", agregadas, format_func=lambda c: c.nombre_visible)
        if st.button("🗑️ Borrar columna"):
            columnas.borrar(conn, elegida.id)
            st.rerun()

# ---------- Documentos guardados ----------
st.divider()
st.header("Documentos guardados")
if not docs:
    st.caption("No hay documentos.")
else:
    tabla = pd.DataFrame([{
        "#": d["id"], "Tipo": d["tipo"].capitalize(), "Fecha": fecha_a_texto(d.get("fecha")),
        "Proveedor / título": d.get("proveedor") or d.get("titulo") or "", "N°": d.get("numero_documento") or "",
        "Total": pesos(d.get("total")) if d.get("total") is not None else "", "Archivo": d.get("archivo_nombre") or "",
    } for d in reversed(docs)])
    st.dataframe(tabla, hide_index=True, width="stretch")
    with st.expander("Borrar un documento"):
        opcion = st.selectbox("Documento", tabla["#"].tolist(),
                              format_func=lambda i: " · ".join(str(x) for x in tabla[tabla["#"] == i].iloc[0, 1:5] if x))
        if st.button("🗑️ Borrar documento"):
            documentos.borrar(conn, int(opcion))
            excel.actualizar_archivo_local(conn, ruta_local)
            st.rerun()
