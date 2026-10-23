"""Página 1: escanear fotos y PDF, revisar lo extraído y guardarlo."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from core import documentos, revision, ui
from core.escaneo import TIPOS, ResultadoArchivo, escanear
from core.imagenes import EXTENSIONES, ErrorArchivo, preparar
from core.validacion import (Aviso, buscar_duplicado, normalizar_numero, normalizar_texto,
                             validar_documento)

st.set_page_config(page_title="Escanear · Asistente de Negocio", page_icon="📷", layout="wide")
ui.barra_lateral()
conn = ui.conexion()
st.session_state.setdefault("pendientes", [])   # lista de dict {uid, res}
st.session_state.setdefault("contador", 0)

st.title("📷 Escanear documentos")
st.write("Sube una o varias fotos (JPG, PNG, HEIC) o PDF. Revisa los datos antes de guardar: "
         "lo marcado en **amarillo** la IA no lo pudo leer con seguridad.")

# ---------- Subida ----------
with st.form("subir", clear_on_submit=True):
    archivos = st.file_uploader("Fotos o PDF", type=sorted(EXTENSIONES), accept_multiple_files=True)
    tipo = st.selectbox("Tipo de documento", list(TIPOS), format_func=TIPOS.get)
    enviar = st.form_submit_button("🔍 Escanear", type="primary")

if enviar:
    ia, error_ia = ui.cliente_ia()
    if not archivos:
        st.warning("Primero elige al menos un archivo.")
    elif ia is None:
        st.error(error_ia)
    else:
        barra = st.progress(0.0, text="Preparando…")
        costo_lote = 0.0
        for n, f in enumerate(archivos, start=1):
            barra.progress((n - 1) / len(archivos), text=f"Leyendo {f.name} ({n} de {len(archivos)})…")
            try:
                prep = preparar(f.name, f.getvalue())
            except ErrorArchivo as e:
                st.error(str(e))
                continue
            res = escanear(ia, conn, prep, tipo)
            if res.uso and not ui.config().modo_demo:   # en modo demo no hay gasto real
                documentos.registrar_uso(conn, "escaneo", res.uso)
                costo_lote += res.uso.costo_usd
            st.session_state.contador += 1
            st.session_state.pendientes.append({"uid": st.session_state.contador, "res": res})
        barra.progress(1.0, text="Listo")
        st.toast(f"Escaneo terminado. Costo del lote: {ui.costo(costo_lote)}", icon="✅")


# ---------- Revisión ----------

def estilo_dudosos(df: pd.DataFrame, columnas_marcadas: list[str]):
    """Pinta de amarillo las columnas fijas (⚠ y nombre del campo) de las filas dudosas."""
    def fila(r):
        amarilla = bool(r["⚠"])
        return [ui.AMARILLO if amarilla and c in columnas_marcadas else "" for c in r.index]
    return df.style.apply(fila, axis=1)


def mostrar_avisos(avisos: list[Aviso]) -> None:
    for a in avisos:
        (st.error if a.nivel == "error" else st.warning)(ui.md(a.mensaje), icon="❗" if a.nivel == "error" else "⚠️")


def editor_encabezado(df: pd.DataFrame, key: str) -> pd.DataFrame:
    return st.data_editor(
        estilo_dudosos(df, ["⚠", "Campo"]), key=key, width="stretch", hide_index=True,
        disabled=["⚠", "Campo"],
        column_config={"⚠": st.column_config.TextColumn("", width="small"),
                       "Valor": st.column_config.TextColumn("Valor", width="large")},
    )


def editor_detalle(df: pd.DataFrame, key: str, config: dict) -> pd.DataFrame:
    return st.data_editor(
        estilo_dudosos(df, ["⚠"]), key=key, width="stretch", num_rows="dynamic",
        hide_index=True, disabled=["⚠"],
        column_config={"⚠": st.column_config.TextColumn("Revisar", width=105), **config},
    )


def duplicado_en_pendientes(uid: int, doc) -> bool:
    num = normalizar_numero(doc.numero_documento)
    if not num:
        return False
    for p in st.session_state.pendientes:
        if p["uid"] >= uid:
            break
        r = p["res"].resultado
        otro = r.documento_tributario if r else None
        if otro and normalizar_numero(otro.numero_documento) == num and (
            normalizar_texto(otro.proveedor) == normalizar_texto(doc.proveedor)
            or (otro.rut_proveedor and otro.rut_proveedor == doc.rut_proveedor)
        ):
            return True
    return False


def quitar(uid: int) -> None:
    st.session_state.pendientes = [p for p in st.session_state.pendientes if p["uid"] != uid]


def tarjeta(uid: int, res: ResultadoArchivo) -> None:
    r = res.resultado
    etiqueta = TIPOS.get(r.tipo_detectado, "No reconocido") if r else "Error"
    with st.container(border=True):
        st.subheader(f"{res.nombre} · {etiqueta}")
        col_img, col_datos = st.columns([1, 2.6], gap="medium")
        with col_img:
            if res.archivo.es_pdf:
                st.info("📄 Documento PDF")
            else:
                st.image(res.archivo.datos, width="stretch")
            if res.uso:
                st.caption(f"Costo{' estimado' if ui.config().modo_demo else ''} de este escaneo: {ui.costo(res.uso.costo_usd)}")
        with col_datos:
            if res.error:
                st.error(res.error)
                st.button("Quitar", key=f"quitar{uid}", on_click=quitar, args=(uid,))
                return
            avisos = [a for a in res.avisos if a.campo == ""]
            if res.misma_foto_de:
                avisos.append(Aviso("advertencia", "duplicado", f"Esta misma foto ya se escaneó y guardó (documento #{res.misma_foto_de})."))
            if r.tipo_detectado == "boleta_factura" and r.documento_tributario:
                guardar, avisos = seccion_tributario(uid, res, avisos)
            elif r.tipo_detectado == "lista" and r.lista:
                guardar, avisos = seccion_lista(uid, res, avisos)
            elif r.tipo_detectado == "formulario" and r.formulario:
                guardar, avisos = seccion_formulario(uid, res, avisos)
            else:
                mostrar_avisos(avisos)
                st.button("Quitar", key=f"quitar{uid}", on_click=quitar, args=(uid,))
                return
            observ = getattr(r.documento_tributario or r.lista or r.formulario, "observaciones", None)
            if observ:
                st.info(ui.md(f"Nota de la IA: {observ}"), icon="📝")
            hay_duplicado = any(a.campo == "duplicado" for a in avisos)
            confirmar = True
            if hay_duplicado:
                confirmar = st.checkbox("Guardar de todas formas", key=f"forzar{uid}")
            b1, b2 = st.columns(2)
            if b1.button("💾 Guardar", key=f"guardar{uid}", type="primary", disabled=not confirmar,
                         width="stretch"):
                try:
                    doc_id = guardar()
                except Exception as e:  # datos inválidos tras la edición
                    st.error(f"No se pudo guardar: {e}")
                else:
                    quitar(uid)
                    st.toast(f"Guardado como documento #{doc_id}", icon="💾")
                    st.rerun()
            b2.button("🗑️ Descartar", key=f"descartar{uid}", on_click=quitar, args=(uid,), width="stretch")


def seccion_tributario(uid: int, res: ResultadoArchivo, avisos: list[Aviso]):
    original = res.resultado.documento_tributario
    tipo = st.radio("Tipo", ["boleta", "factura"], index=0 if original.tipo == "boleta" else 1,
                    horizontal=True, key=f"tipo{uid}", format_func=str.capitalize)
    enc = editor_encabezado(revision.encabezado_tributario(conn, original), key=f"enc{uid}")
    st.markdown("**Detalle de productos**")
    lineas = editor_detalle(revision.lineas_tributario(original), key=f"lin{uid}", config={
        "Descripción": st.column_config.TextColumn("Descripción", width=190),
        "Cantidad": st.column_config.NumberColumn("Cant.", min_value=0, format="%g", width=70),
        "P. unitario": st.column_config.NumberColumn("P. unit. ($)", min_value=0, step=1, format="%d", width=100),
        "Total": st.column_config.NumberColumn("Total ($)", step=1, format="%d", width=100),
    })
    doc = revision.tributario_desde_edicion(tipo, enc, lineas, original)
    # Validación en vivo con los valores corregidos
    avisos = avisos + validar_documento(doc)
    dup = buscar_duplicado(conn, doc.proveedor, doc.rut_proveedor, doc.numero_documento)
    if dup:
        avisos.append(Aviso("advertencia", "duplicado", f"Este documento ya está guardado (#{dup}): mismo proveedor y N° {doc.numero_documento}."))
    elif duplicado_en_pendientes(uid, doc):
        avisos.append(Aviso("advertencia", "duplicado", "Este documento aparece dos veces en esta revisión (mismo proveedor y número)."))
    problemas_suma = [a for a in avisos if a.campo in ("neto", "iva", "total") or a.campo.startswith("lineas[")]
    if not problemas_suma and doc.lineas and doc.total is not None:
        st.success("Las sumas cuadran", icon="✅")
    mostrar_avisos(avisos)
    return (lambda: documentos.guardar_tributario(conn, doc, archivo_nombre=res.nombre, hash_archivo=res.archivo.hash,
                                                  costo_usd=res.uso.costo_usd if res.uso else 0)), avisos


def seccion_lista(uid: int, res: ResultadoArchivo, avisos: list[Aviso]):
    original = res.resultado.lista
    enc = editor_encabezado(revision.encabezado_simple(conn, "lista", original.titulo, original.fecha,
                                                       original.campos_extra, original.campos_dudosos), key=f"enc{uid}")
    st.markdown("**Ítems**")
    items = editor_detalle(revision.items_lista(original), key=f"items{uid}", config={
        "Ítem": st.column_config.TextColumn("Ítem", width="medium"),
        "Marcado": st.column_config.CheckboxColumn("Marcado / tachado"),
    })
    mostrar_avisos(avisos)
    lista = revision.lista_desde_edicion(enc, items, original)
    return (lambda: documentos.guardar_lista(conn, lista, archivo_nombre=res.nombre, hash_archivo=res.archivo.hash,
                                             costo_usd=res.uso.costo_usd if res.uso else 0)), avisos


def seccion_formulario(uid: int, res: ResultadoArchivo, avisos: list[Aviso]):
    original = res.resultado.formulario
    enc = editor_encabezado(revision.encabezado_simple(conn, "formulario", original.titulo, original.fecha,
                                                       original.campos_extra, original.campos_dudosos), key=f"enc{uid}")
    st.markdown("**Campos del formulario**")
    campos = editor_detalle(revision.campos_formulario(original), key=f"campos{uid}", config={
        "Valor": st.column_config.TextColumn("Valor", width="large"),
    })
    mostrar_avisos(avisos)
    form = revision.formulario_desde_edicion(enc, campos, original)
    return (lambda: documentos.guardar_formulario(conn, form, archivo_nombre=res.nombre, hash_archivo=res.archivo.hash,
                                                  costo_usd=res.uso.costo_usd if res.uso else 0)), avisos


pendientes = st.session_state.pendientes
if pendientes:
    st.divider()
    st.header(f"Revisar antes de guardar ({len(pendientes)})")
    total = sum(p["res"].uso.costo_usd for p in pendientes if p["res"].uso)
    st.caption(f"Costo de los escaneos pendientes: {ui.costo(total)}")
    for p in list(pendientes):
        tarjeta(p["uid"], p["res"])

# ---------- Guardados ----------
st.divider()
st.header("Documentos guardados")
filas = documentos.listar(conn)
if not filas:
    st.caption("Todavía no hay documentos guardados.")
else:
    df = pd.DataFrame([dict(f) for f in filas])
    df["fecha"] = df["fecha"].map(lambda x: revision.fecha_a_texto(x) if x else "")
    df["total"] = df["total"].map(lambda x: revision.pesos(x) if pd.notna(x) else "")
    st.dataframe(df.rename(columns={"id": "#", "tipo": "Tipo", "fecha": "Fecha", "proveedor": "Proveedor",
                                    "numero_documento": "N°", "total": "Total", "archivo_nombre": "Archivo",
                                    "creado_en": "Guardado"}), hide_index=True, width="stretch")
