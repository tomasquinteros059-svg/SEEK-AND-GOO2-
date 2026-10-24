"""Página 4: crear mensajes (WhatsApp, correo o SMS) a partir de una instrucción simple."""
from __future__ import annotations

import streamlit as st

from core import documentos, ui
from core import mensajes as m
from core.ia import ErrorIA
from core.validacion import pesos

st.set_page_config(page_title="Mensajes · Asistente de Negocio", page_icon="✉️", layout="wide")
ui.barra_lateral()
conn = ui.conexion()
st.session_state.setdefault("instruccion", "Escríbeles a los clientes que deben más de $50.000 que el pago vence el viernes")

st.title("✉️ Crear mensajes")
st.write("Escribe qué quieres decir y a quién. El asistente busca a los destinatarios en tus contactos y escribe un "
         "mensaje para cada uno. **No se envía nada**: revisas, editas y copias.")

EJEMPLOS = {
    "Recordatorio a una persona": "Recuérdale a Juan Pérez que su pago vence el día 5 y agradécele por ser cliente frecuente",
    "Aviso a todos": "Avisa a todos los clientes que el lunes cerramos por inventario",
    "Deudas vencidas": "Escríbeles a los clientes con deuda vencida que se pongan al día",
}


def usar_ejemplo(texto: str) -> None:
    st.session_state.instruccion = texto


st.text_area("Instrucción", key="instruccion", height=90)
cols = st.columns(len(EJEMPLOS))
for col, (etiqueta, texto) in zip(cols, EJEMPLOS.items()):
    col.button(etiqueta, on_click=usar_ejemplo, args=(texto,), width="stretch")
a, b = st.columns(2)
canal = a.radio("Canal", list(m.CANALES), format_func=m.CANALES.get, horizontal=True)
tono = b.radio("Tono", list(m.TONOS), format_func=m.TONOS.get, horizontal=True, index=1)


def ejecutar(**kwargs) -> None:
    ia, error = ui.cliente_ia()
    if ia is None:
        st.error(error)
        return
    with st.spinner("El asistente está trabajando… puede tardar hasta un minuto."):
        try:
            res = m.generar(ia, conn, st.session_state.instruccion, canal, tono, **kwargs)
        except (ErrorIA, ValueError) as e:
            st.error(getattr(e, "mensaje", None) or str(e))
            return
    if res.uso and not ui.config().modo_demo:
        documentos.registrar_uso(conn, "mensajes", res.uso)
    if res.estado == "listo" and res.mensajes:
        m.guardar_lote(conn, res)
    st.session_state.resultado = res


def guardar_edicion(x: m.Mensaje, clave: str, res: m.Resultado) -> None:
    x.texto = st.session_state[f"texto_{clave}"].strip()
    if res.canal == "correo":
        x.asunto = st.session_state.get(f"asunto_{clave}") or None
    if res.lote_id:
        m.actualizar_mensaje(conn, res.lote_id, x.contacto_id, x.texto, x.asunto)
    st.session_state[f"edit_{clave}"] = False


if st.button("✍️ Generar mensajes", type="primary"):
    ejecutar()

res: m.Resultado | None = st.session_state.get("resultado")
if res:
    st.divider()
    with st.container(border=True):
        st.subheader("Entendí esto")
        st.write(res.interpretacion.proposito)
        partes = [f"`{m.describir_filtro(f)}`" for f in res.interpretacion.filtros] or ["`Todos los contactos`"]
        if res.interpretacion.fecha_mencionada:
            partes.append(f"`Fecha: {m.fecha_larga(res.interpretacion.fecha_mencionada)}`")
        st.markdown("Criterio: " + " · ".join(partes))  # el $ dentro de `código` no necesita escape
        st.caption(f"{res.elegidos} contacto(s) cumplen el criterio · canal {m.CANALES[res.canal]} · tono {m.TONOS[res.tono].lower()}")

    if res.estado == "ambiguo":
        for duda in res.interpretacion.ambiguedades:
            st.warning(ui.md("Duda: " + duda), icon="❓")
        st.write("Corrige la instrucción y vuelve a generar, o continúa si la interpretación de arriba es correcta.")
        if st.button("Continuar de todas formas"):
            ejecutar(interpretacion=res.interpretacion, ignorar_dudas=True)
            st.rerun()

    if res.sin_contacto:
        st.error(ui.md("**No se puede escribir a:** " + ", ".join(f"{n} ({motivo})" for n, motivo in res.sin_contacto) +
                       ". Completa sus datos en «Conocimiento» → «Clientes y contactos»."))
    if res.estado == "listo" and res.elegidos == 0:
        st.warning("Ningún contacto cumple con lo pedido. Revisa la instrucción o los datos de tus clientes.")

    if res.mensajes:
        cab, botones = st.columns([3, 2])
        cab.subheader(f"{len(res.mensajes)} mensaje(s) por {m.CANALES[res.canal]}")
        botones.button("📤 Enviar (próximamente)", disabled=True, width="stretch",
                       help="En esta versión no se envía nada. El envío se podrá conectar más adelante.")
        if res.uso:
            st.caption(f"Costo{' estimado' if ui.config().modo_demo else ''} del lote: {ui.costo(res.uso.costo_usd)}")
        with st.expander("📋 Copiar todos"):
            st.code("\n\n———\n\n".join(m.texto_para_copiar(x, res.canal) for x in res.mensajes), language=None,
                    wrap_lines=True)
        st.caption("Toca el ícono de copiar (arriba a la derecha de cada mensaje) para copiarlo.")
        for x in res.mensajes:
            with st.container(border=True):
                izq, der = st.columns([3, 2])
                izq.markdown(f"**{x.nombre}**")
                der.caption(x.destino or "")
                clave = f"{res.lote_id}_{x.contacto_id}"
                if st.toggle("Editar", key=f"edit_{clave}"):
                    if res.canal == "correo":
                        st.text_input("Asunto", value=x.asunto or "", key=f"asunto_{clave}")
                    st.text_area("Mensaje", value=x.texto, key=f"texto_{clave}", height=120)
                    st.button("Guardar cambios", key=f"g_{clave}", on_click=guardar_edicion, args=(x, clave, res))
                else:
                    st.code((f"Asunto: {x.asunto}\n\n" if x.asunto else "") + x.texto, language=None, wrap_lines=True)
                limite = m.LIMITE_SMS if res.canal == "sms" else None
                largo = len(x.texto)
                texto_largo = f"{largo} caracteres" + (f" / {limite}" if limite else "")
                (st.error if limite and largo > limite else st.caption)(texto_largo)
                if x.advertencia:
                    st.warning(ui.md(x.advertencia))

# ---------- Historial ----------
st.divider()
with st.expander("🕘 Historial de mensajes generados"):
    lotes = m.listar_lotes(conn)
    if not lotes:
        st.caption("Aún no has generado mensajes.")
    for lote in lotes:
        st.markdown(f"**{lote['instruccion']}**")
        st.caption(f"{lote['creado_en']} · {len(lote['mensajes'])} mensaje(s) · {m.CANALES.get(lote['canal'])} · "
                   f"{m.TONOS.get(lote['tono'], '').lower()}")
        st.code("\n\n———\n\n".join(m.texto_para_copiar(x, lote["canal"]) for x in lote["mensajes"]) or "(sin mensajes)",
                language=None, wrap_lines=True)
        if st.button("Borrar del historial", key=f"borrar_lote_{lote['id']}"):
            m.borrar_lote(conn, lote["id"])
            st.rerun()
