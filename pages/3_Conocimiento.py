"""Página 3: base de conocimiento (contactos, notas y documentos del negocio)."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from core import conocimiento as k
from core import ui
from core.validacion import fecha_a_texto, pesos

st.set_page_config(page_title="Conocimiento · Asistente de Negocio", page_icon="📚", layout="wide")
ui.barra_lateral()
conn = ui.conexion()

st.title("📚 Base de conocimiento")
st.write("Lo que le cuentes al asistente sobre tu negocio. Lo usa para reconocer proveedores al escanear y para "
         "escribir los mensajes. Puedes ver, editar y borrar todo.")

tab_c, tab_n, tab_d = st.tabs(["👥 Clientes y contactos", "📝 Notas", "📄 Documentos"])

# ---------------- Contactos ----------------
with tab_c:
    st.subheader("Importar desde Excel o CSV")
    archivo = st.file_uploader("Lista de clientes (la primera fila debe tener los títulos)", type=["xlsx", "csv"],
                               key=f"contactos_archivo_{st.session_state.get('n_import', 0)}")
    if archivo is not None:
        try:
            tabla = k.leer_tabla(archivo.name, archivo.getvalue())
        except k.ErrorConocimiento as e:
            st.error(str(e))
        else:
            st.write(f"**{archivo.name}** · {len(tabla.filas)} filas. Revisa qué columna corresponde a cada dato:")
            sugerido = k.adivinar_mapeo(tabla.cabeceras)
            opciones = [None] + list(range(len(tabla.cabeceras)))
            columnas_ui = st.columns(len(k.CAMPOS_CONTACTO))
            mapeo = {}
            for col_ui, (campo, (etiqueta, _)) in zip(columnas_ui, k.CAMPOS_CONTACTO.items()):
                mapeo[campo] = col_ui.selectbox(
                    etiqueta + (" *" if campo == "nombre" else ""), opciones,
                    index=opciones.index(sugerido[campo]), key=f"mapa_{campo}_{archivo.name}",
                    format_func=lambda i: "— No usar —" if i is None else tabla.cabeceras[i])
            try:
                nuevos = k.contactos_desde_tabla(tabla, mapeo)
            except k.ErrorConocimiento as e:
                st.warning(str(e))
            else:
                vista = pd.DataFrame([{"Nombre": c["nombre"], "Teléfono": c["telefono"], "Correo": c["correo"],
                                       "Deuda": pesos(c["deuda"]) if c["deuda"] is not None else "",
                                       "Vence": fecha_a_texto(c["fecha_vencimiento"]),
                                       "Otras columnas": ", ".join(f"{a}: {b}" for a, b in c["extra"].items())}
                                      for c in nuevos[:5]])
                st.dataframe(vista, hide_index=True, width="stretch")
                reemplazar = st.checkbox("Reemplazar los contactos que ya tengo", key="reemplazar")
                if st.button(f"Importar {len(nuevos)} contactos", type="primary"):
                    n = k.importar_contactos(conn, nuevos, reemplazar=reemplazar, origen=archivo.name)
                    st.toast(f"{n} contactos importados", icon="✅")
                    st.session_state["n_import"] = st.session_state.get("n_import", 0) + 1
                    st.rerun()

    st.subheader("Tus contactos")
    contactos = k.listar_contactos(conn)
    df = pd.DataFrame([{
        "id": c.id, "Nombre": c.nombre, "Teléfono": c.telefono, "Correo": c.correo, "Deuda": c.deuda,
        "Vence": fecha_a_texto(c.fecha_vencimiento),
        "Falta": " · ".join(x for x in ("sin teléfono" if not c.telefono else "",
                                         "sin correo" if not c.correo else "") if x),
    } for c in contactos], columns=["id", "Nombre", "Teléfono", "Correo", "Deuda", "Vence", "Falta"])
    df = df.astype({"Deuda": "Int64"})
    estilo = df.style.apply(lambda fila: [ui.AMARILLO if (col == "Falta" and fila["Falta"]) else "" for col in fila.index], axis=1)
    editado = st.data_editor(
        estilo, key="tabla_contactos", num_rows="dynamic", hide_index=True, width="stretch", disabled=["Falta"],
        column_config={"id": None, "Deuda": st.column_config.NumberColumn("Deuda ($)", format="%d", step=1),
                       "Vence": st.column_config.TextColumn("Vence", help="dd-mm-aaaa"),
                       "Falta": st.column_config.TextColumn("Revisar")},
    )
    st.caption("Lo marcado en amarillo falta: al crear mensajes el asistente avisará en vez de inventarlo. "
               "Para borrar, selecciona la fila y presiona la papelera de la tabla.")
    if st.button("💾 Guardar cambios de contactos"):
        errores = []
        ids_vivos = set()
        for _, fila in editado.iterrows():
            datos = {"nombre": fila["Nombre"] if pd.notna(fila["Nombre"]) else "",
                     "telefono": fila["Teléfono"] if pd.notna(fila["Teléfono"]) else "",
                     "correo": fila["Correo"] if pd.notna(fila["Correo"]) else "",
                     "deuda": int(fila["Deuda"]) if pd.notna(fila["Deuda"]) else None,
                     "fecha_vencimiento": fila["Vence"] if pd.notna(fila["Vence"]) and fila["Vence"] else None}
            cid = int(fila["id"]) if pd.notna(fila["id"]) else None
            if not datos["nombre"] and cid is None:
                continue  # fila vacía
            try:
                ids_vivos.add(k.guardar_contacto(conn, datos, cid))
            except k.ErrorConocimiento as e:
                errores.append(str(e))
        for c in contactos:
            if c.id not in ids_vivos:
                k.borrar_contacto(conn, c.id)
        if errores:
            st.error(" ".join(sorted(set(errores))))
        else:
            st.toast("Contactos guardados", icon="✅")
            st.rerun()

# ---------------- Notas ----------------
with tab_n:
    with st.form("nueva_nota", clear_on_submit=True):
        texto = st.text_area("Nueva nota", placeholder="Ej: El cliente Juan Pérez paga siempre los días 5.")
        if st.form_submit_button("Guardar nota", type="primary"):
            try:
                k.agregar_nota(conn, texto)
                st.toast("Nota guardada", icon="✅")
            except k.ErrorConocimiento as e:
                st.warning(str(e))
    notas = k.listar_notas(conn)
    if not notas:
        st.caption("Sin notas todavía.")
    for n in notas:
        with st.container(border=True):
            nuevo = st.text_area("Nota", value=n["texto"], key=f"nota_{n['id']}", label_visibility="collapsed")
            a, b, _ = st.columns([1, 1, 4])
            if a.button("Guardar", key=f"g_{n['id']}") and nuevo != n["texto"]:
                try:
                    k.actualizar_nota(conn, n["id"], nuevo)
                    st.rerun()
                except k.ErrorConocimiento as e:
                    st.warning(str(e))
            if b.button("Borrar", key=f"b_{n['id']}"):
                k.borrar_nota(conn, n["id"])
                st.rerun()

# ---------------- Documentos ----------------
with tab_d:
    st.write("Sube información del negocio: lista de precios, condiciones de pago, horarios, etc. "
             "El texto se lee en tu computador, sin usar IA.")
    subidos = st.file_uploader("PDF, Word, Excel o TXT", type=sorted(k.EXTENSIONES_ARCHIVO), accept_multiple_files=True,
                               key="docs_conocimiento")
    if subidos and st.button("Agregar a la base de conocimiento", type="primary"):
        for f in subidos:
            try:
                _, recortado = k.guardar_archivo(conn, f.name, f.getvalue())
                st.success(f"Listo: {f.name}" + (" (se guardaron los primeros 40.000 caracteres)" if recortado else ""))
            except k.ErrorConocimiento as e:
                st.error(str(e))
    archivos = k.listar_archivos(conn)
    if not archivos:
        st.caption("No has subido documentos.")
    for a in archivos:
        with st.expander(f"{a['nombre']} · {len(a['texto_extraido']):,} caracteres".replace(",", ".")):
            st.text(a["texto_extraido"][:3000] + ("\n…" if len(a["texto_extraido"]) > 3000 else ""))
            if st.button("Borrar", key=f"borrar_archivo_{a['id']}"):
                k.borrar_archivo(conn, a["id"])
                st.rerun()
