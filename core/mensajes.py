"""Mensajes a partir de una instrucción simple.

Flujo:
1. La IA convierte la instrucción en filtros (ej. "deben más de $50.000" → deuda > 50000)
   y anota lo que no esté claro.
2. El código aplica los filtros sobre los contactos (sin IA: no se inventan clientes ni montos).
   Los contactos sin teléfono o correo quedan aparte, con el motivo.
3. La IA redacta un mensaje por destinatario con sus datos reales.
"""
from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from pydantic import BaseModel, Field

from core import conocimiento
from core.conocimiento import Contacto, correo_valido
from core.ia import GeneradorIA, Uso
from core.validacion import normalizar_texto, parsear_fecha, parsear_monto, pesos

CANALES = {"whatsapp": "WhatsApp", "correo": "Correo", "sms": "SMS"}
TONOS = {"formal": "Formal", "cercano": "Cercano", "breve": "Breve"}
LIMITE_SMS = 160
TAMANO_LOTE = 30
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]

Operador = Literal[">", ">=", "<", "<=", "==", "!=", "contiene", "vacio", "no_vacio"]


class Filtro(BaseModel):
    campo: str = Field(description="nombre, telefono, correo, deuda, fecha_vencimiento, dias_atraso o una columna extra")
    operador: Operador
    valor: str | None = Field(description="Valor a comparar como texto: '50000', '2026-10-31', 'Juan Pérez'. null para vacio/no_vacio")


class Interpretacion(BaseModel):
    filtros: list[Filtro]
    todos: bool = Field(description="true si el mensaje es para todos los contactos")
    fecha_mencionada: str | None = Field(description="Fecha exacta aaaa-mm-dd si la instrucción menciona un día")
    proposito: str = Field(description="Qué hay que comunicar, en una frase")
    ambiguedades: list[str] = Field(description="Dudas reales que cambiarían a quién se escribe o qué se dice")


class MensajeRedactado(BaseModel):
    contacto_id: int
    asunto: str | None
    texto: str
    advertencia: str | None = Field(description="Qué dato faltó para este destinatario, o null")


class LoteRedactado(BaseModel):
    mensajes: list[MensajeRedactado]


@dataclass
class Mensaje:
    contacto_id: int
    nombre: str
    destino: str
    texto: str
    asunto: str | None = None
    advertencia: str | None = None


@dataclass
class Resultado:
    instruccion: str
    canal: str
    tono: str
    interpretacion: Interpretacion
    estado: str = "listo"          # "ambiguo" | "listo"
    elegidos: int = 0
    sin_contacto: list[tuple[str, str]] = field(default_factory=list)   # (nombre, motivo)
    mensajes: list[Mensaje] = field(default_factory=list)
    uso: Uso | None = None
    lote_id: int | None = None


# ---------------- Fechas ----------------

def fecha_larga(iso: str | None) -> str:
    f = parsear_fecha(iso) if iso else None
    return f"{DIAS[f.weekday()]} {f.day} de {MESES[f.month - 1]}" if f else (iso or "")


def proximo_dia(nombre: str, hoy: date) -> date | None:
    n = normalizar_texto(nombre)
    for i, d in enumerate(DIAS):
        if normalizar_texto(d) == n:
            dias = (i - hoy.weekday()) % 7 or 7
            return hoy + timedelta(days=dias)
    return None


# ---------------- Paso 1: interpretar ----------------

def _datos_contacto(c: Contacto) -> dict:
    return {"id": c.id, "nombre": c.nombre, "telefono": c.telefono, "correo": c.correo, "deuda": c.deuda,
            "fecha_vencimiento": c.fecha_vencimiento, "dias_atraso": c.dias_atraso, **{k: v for k, v in c.extra.items()}}


def prompt_interpretar(instruccion: str, contactos: list[Contacto], hoy: date) -> str:
    extras = sorted({k for c in contactos for k in c.extra})
    nombres = ", ".join(c.nombre for c in contactos[:60])
    return f"""Eres el asistente de un pequeño negocio en Chile. Convierte la instrucción del dueño en filtros sobre su lista de contactos. Todavía NO escribas mensajes.

Hoy es {DIAS[hoy.weekday()]} {hoy:%d-%m-%Y} ({hoy.isoformat()}).
Campos de cada contacto: nombre, telefono, correo, deuda (pesos), fecha_vencimiento (aaaa-mm-dd), dias_atraso (días desde que venció; negativo si aún no vence){", columnas extra: " + ", ".join(extras) if extras else ""}.
Hay {len(contactos)} contactos. Nombres: {nombres}.

Instrucción: «{instruccion}»

Reglas:
- Montos, fechas y nombres de la instrucción se convierten en filtros. "deben más de $50.000" → campo deuda, operador ">", valor "50000".
- Si es para todos, deja "filtros" vacío y "todos" en true.
- Si menciona un día ("el viernes", "el 5"), calcula la fecha futura más próxima en "fecha_mencionada".
- En "ambiguedades" anota solo dudas reales que cambiarían a quién se escribe o qué se dice. No inventes dudas.
- No inventes campos que no existen."""


def interpretar(ia: GeneradorIA, instruccion: str, contactos: list[Contacto], hoy: date | None = None
                ) -> tuple[Interpretacion, Uso]:
    hoy = hoy or date.today()
    return ia.generar(system="Respondes solo con los datos pedidos, en español de Chile.",
                      contenido=[{"type": "text", "text": prompt_interpretar(instruccion, contactos, hoy)}],
                      esquema=Interpretacion, effort="medium", max_tokens=4000)


# ---------------- Paso 2: filtrar (sin IA) ----------------

NOMBRES_CAMPO = {"deuda": "Deuda", "fecha_vencimiento": "Vencimiento", "dias_atraso": "Días de atraso",
                 "nombre": "Nombre", "telefono": "Teléfono", "correo": "Correo"}
NOMBRES_OPERADOR = {">": "mayor a", ">=": "desde", "<": "menor a", "<=": "hasta", "==": "es", "!=": "no es",
                    "contiene": "contiene", "vacio": "está vacío", "no_vacio": "tiene dato"}


def describir_filtro(f: Filtro) -> str:
    """Ej: 'Deuda mayor a $50.000'."""
    valor = f.valor or ""
    if f.campo == "deuda" and parsear_monto(valor) is not None:
        valor = pesos(parsear_monto(valor))
    elif f.campo == "fecha_vencimiento" and parsear_fecha(valor):
        valor = parsear_fecha(valor).strftime("%d-%m-%Y")
    if f.operador in ("vacio", "no_vacio"):
        valor = ""
    return f"{NOMBRES_CAMPO.get(f.campo, f.campo)} {NOMBRES_OPERADOR.get(f.operador, f.operador)} {valor}".strip()

def _comparar(a, op: str, b) -> bool:
    return {">": a > b, ">=": a >= b, "<": a < b, "<=": a <= b, "==": a == b, "!=": a != b}.get(op, False)


def cumple(c: dict, f: Filtro) -> bool:
    v = c.get(f.campo)
    vacio = v is None or str(v).strip() == ""
    if f.operador == "vacio":
        return vacio
    if f.operador == "no_vacio":
        return not vacio
    if vacio:
        return False
    if f.campo == "fecha_vencimiento":
        a, b = parsear_fecha(str(v)), parsear_fecha(str(f.valor or ""))
        return bool(a and b) and _comparar(a, f.operador, b)
    if f.operador in (">", ">=", "<", "<=") or isinstance(v, (int, float)):
        a = v if isinstance(v, (int, float)) else parsear_monto(str(v))
        b = parsear_monto(f.valor) if f.valor is not None else None
        if a is not None and b is not None:
            return _comparar(a, f.operador, b)
    a, b = normalizar_texto(str(v)), normalizar_texto(str(f.valor or ""))
    if f.operador == "contiene":
        return b in a
    if f.operador == "==":
        return a == b or (f.campo == "nombre" and bool(b) and b in a)
    if f.operador == "!=":
        return a != b
    return False


def filtrar(contactos: list[Contacto], interp: Interpretacion) -> list[Contacto]:
    if not interp.filtros:
        return list(contactos)
    return [c for c in contactos if all(cumple(_datos_contacto(c), f) for f in interp.filtros)]


def separar_por_canal(contactos: list[Contacto], canal: str) -> tuple[list[Contacto], list[tuple[str, str]]]:
    con, sin = [], []
    for c in contactos:
        if canal == "correo":
            if correo_valido(c.correo):
                con.append(c)
            else:
                sin.append((c.nombre, "correo no válido" if c.correo else "no tiene correo"))
        elif re.sub(r"\D", "", c.telefono or ""):
            con.append(c)
        else:
            sin.append((c.nombre, "no tiene teléfono"))
    return con, sin


def destino(c: Contacto, canal: str) -> str:
    return c.correo if canal == "correo" else c.telefono


# ---------------- Paso 3: redactar ----------------

REGLAS_CANAL = {
    "whatsapp": "WhatsApp: para leer en el celular, máximo 3 o 4 líneas, sin asunto (asunto null). Puede llevar 1 emoji si el tono lo permite.",
    "correo": "Correo: con un asunto corto y un cuerpo con saludo, mensaje y despedida con el nombre del negocio si se conoce.",
    "sms": f"SMS: máximo {LIMITE_SMS} caracteres en total, sin emojis, sin asunto (asunto null).",
}
REGLAS_TONO = {
    "formal": "Formal: trato de usted, cordial y respetuoso.",
    "cercano": "Cercano: amable y cálido, trato de tú, como un comerciante de barrio que conoce a su cliente.",
    "breve": "Breve: lo mínimo necesario, directo.",
}


def prompt_redactar(instruccion: str, interp: Interpretacion, destinatarios: list[Contacto], canal: str, tono: str,
                    contexto: str, hoy: date) -> str:
    datos = [{"contacto_id": c.id, "nombre": c.nombre, "deuda": pesos(c.deuda) if c.deuda is not None else None,
              "fecha_vencimiento": fecha_larga(c.fecha_vencimiento) if c.fecha_vencimiento else None,
              "dias_atraso": c.dias_atraso, **({"otros_datos": c.extra} if c.extra else {})} for c in destinatarios]
    fecha = f"\nFecha mencionada en la instrucción: {fecha_larga(interp.fecha_mencionada)} ({interp.fecha_mencionada})." \
        if interp.fecha_mencionada else ""
    ctx = f"\n\nInformación del negocio (úsala si sirve, por ejemplo para datos de pago o la firma):\n{contexto}" if contexto else ""
    return f"""Escribe un mensaje personalizado para cada destinatario, en español de Chile.

Instrucción del dueño: «{instruccion}»
Propósito: {interp.proposito}{fecha}
Hoy es {DIAS[hoy.weekday()]} {hoy:%d-%m-%Y}.
Canal: {REGLAS_CANAL[canal]}
Tono: {REGLAS_TONO[tono]}{ctx}

Reglas:
- Usa SOLO los datos de cada destinatario. No inventes montos, fechas, descuentos ni datos de pago que no aparezcan aquí.
- Montos con formato chileno ($72.500).
- Si a un destinatario le falta un dato necesario, escribe el mensaje sin ese dato y explica qué falta en "advertencia".
- Devuelve un mensaje por cada contacto_id, en el mismo orden.

Destinatarios (JSON):
{json.dumps(datos, ensure_ascii=False)}"""


def redactar(ia: GeneradorIA, instruccion: str, interp: Interpretacion, destinatarios: list[Contacto], canal: str,
             tono: str, contexto: str = "", hoy: date | None = None) -> tuple[list[Mensaje], Uso | None]:
    hoy = hoy or date.today()
    mensajes: list[Mensaje] = []
    uso_total: Uso | None = None
    for i in range(0, len(destinatarios), TAMANO_LOTE):
        lote = destinatarios[i:i + TAMANO_LOTE]
        resp, uso = ia.generar(
            system="Escribes mensajes claros para clientes de un pequeño negocio chileno.",
            contenido=[{"type": "text", "text": prompt_redactar(instruccion, interp, lote, canal, tono, contexto, hoy)}],
            esquema=LoteRedactado, effort="low", max_tokens=16000)
        uso_total = uso if uso_total is None else uso_total + uso
        por_id = {m.contacto_id: m for m in resp.mensajes}
        for c in lote:
            m = por_id.get(c.id)
            if m is None:
                mensajes.append(Mensaje(c.id, c.nombre, destino(c, canal), "", None,
                                        "La IA no escribió un mensaje para este contacto. Escríbelo o vuelve a generar."))
                continue
            advertencia = m.advertencia
            if canal == "sms" and len(m.texto) > LIMITE_SMS:
                advertencia = ((advertencia + " ") if advertencia else "") + f"Tiene {len(m.texto)} caracteres; un SMS admite {LIMITE_SMS}."
            mensajes.append(Mensaje(c.id, c.nombre, destino(c, canal), m.texto.strip(),
                                    m.asunto if canal == "correo" else None, advertencia))
    return mensajes, uso_total


# ---------------- Todo junto ----------------

def generar(ia: GeneradorIA, conn: sqlite3.Connection, instruccion: str, canal: str, tono: str, *,
            interpretacion: Interpretacion | None = None, ignorar_dudas: bool = False,
            hoy: date | None = None) -> Resultado:
    """Interpreta, filtra y redacta. Si hay dudas y no se pidió ignorarlas, se detiene antes de redactar."""
    instruccion = instruccion.strip()
    if not instruccion:
        raise ValueError("Escribe primero qué quieres comunicar.")
    if canal not in CANALES or tono not in TONOS:
        raise ValueError("Canal o tono no válido.")
    contactos = conocimiento.listar_contactos(conn)
    if not contactos:
        raise ValueError("No tienes contactos. Agrégalos en «Conocimiento» → «Clientes y contactos».")
    uso: Uso | None = None
    if interpretacion is None:
        interpretacion, uso = interpretar(ia, instruccion, contactos, hoy)
    res = Resultado(instruccion, canal, tono, interpretacion, uso=uso)
    elegidos = filtrar(contactos, interpretacion)
    res.elegidos = len(elegidos)
    con_dato, res.sin_contacto = separar_por_canal(elegidos, canal)
    if interpretacion.ambiguedades and not ignorar_dudas:
        res.estado = "ambiguo"
        return res
    if con_dato:
        res.mensajes, uso2 = redactar(ia, instruccion, interpretacion, con_dato, canal, tono,
                                      conocimiento.contexto_negocio(conn, 6000), hoy)
        if uso2:
            res.uso = uso2 if res.uso is None else res.uso + uso2
    res.estado = "listo"
    return res


def guardar_lote(conn: sqlite3.Connection, res: Resultado) -> int:
    cur = conn.execute(
        "INSERT INTO lotes_mensajes (instruccion, canal, tono, filtro_json, avisos_json, costo_usd) VALUES (?,?,?,?,?,?)",
        (res.instruccion, res.canal, res.tono, res.interpretacion.model_dump_json(),
         json.dumps([f"{n}: {m}" for n, m in res.sin_contacto], ensure_ascii=False), res.uso.costo_usd if res.uso else 0))
    lote_id = cur.lastrowid
    conn.executemany(
        "INSERT INTO mensajes (lote_id, contacto_id, destinatario, destino, asunto, texto) VALUES (?,?,?,?,?,?)",
        [(lote_id, m.contacto_id, m.nombre, m.destino, m.asunto, m.texto) for m in res.mensajes])
    conn.commit()
    res.lote_id = lote_id
    return lote_id


def actualizar_mensaje(conn: sqlite3.Connection, lote_id: int, contacto_id: int, texto: str, asunto: str | None) -> None:
    conn.execute("UPDATE mensajes SET texto = ?, asunto = ?, editado = 1 WHERE lote_id = ? AND contacto_id = ?",
                 (texto, asunto, lote_id, contacto_id))
    conn.commit()


def listar_lotes(conn: sqlite3.Connection, limite: int = 20) -> list[dict]:
    lotes = []
    for l in conn.execute("SELECT * FROM lotes_mensajes ORDER BY id DESC LIMIT ?", (limite,)):
        msjs = conn.execute("SELECT * FROM mensajes WHERE lote_id = ? ORDER BY id", (l["id"],)).fetchall()
        lotes.append({**dict(l), "mensajes": [dict(m) for m in msjs]})
    return lotes


def borrar_lote(conn: sqlite3.Connection, lote_id: int) -> None:
    conn.execute("DELETE FROM lotes_mensajes WHERE id = ?", (lote_id,))
    conn.commit()


def texto_para_copiar(m: Mensaje | dict, canal: str) -> str:
    g = (lambda k: m.get(k)) if isinstance(m, dict) else (lambda k: getattr(m, k))
    nombre = g("nombre") if not isinstance(m, dict) else m.get("destinatario")
    cabecera = f"Para: {nombre}" + (f" ({g('destino')})" if g("destino") else "")
    if canal == "correo" and g("asunto"):
        return f"{cabecera}\nAsunto: {g('asunto')}\n\n{g('texto')}"
    return f"{cabecera}\n{g('texto')}"


# ---------------- Modo sin IA (demostración) ----------------

def interpretar_local(instruccion: str, nombres: list[str], hoy: date | None = None) -> Interpretacion:
    """Entiende instrucciones simples sin IA. Se usa en el modo demostración."""
    hoy = hoy or date.today()
    t = instruccion.lower()
    filtros: list[Filtro] = []
    m = re.search(r"(más de|mas de|mayor a|sobre|menos de|menor a|bajo)\s*\$?\s*([\d.]+)", t)
    if m:
        filtros.append(Filtro(campo="deuda", operador="<" if re.search("menos|menor|bajo", m.group(1)) else ">",
                              valor=str(parsear_monto(m.group(2)))))
    elif re.search(r"deud|deben|debe", t):
        filtros.append(Filtro(campo="deuda", operador=">", valor="0"))
    if "vencid" in t:
        filtros.append(Filtro(campo="dias_atraso", operador=">", valor="0"))
    for n in nombres:
        if n and normalizar_texto(n) in normalizar_texto(t):
            filtros = [Filtro(campo="nombre", operador="==", valor=n)]
            break
    fecha = None
    dm = re.search(r"(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)", t)
    if dm:
        f = proximo_dia(dm.group(1), hoy)
        fecha = f.isoformat() if f else None
    return Interpretacion(filtros=filtros, todos=not filtros, fecha_mencionada=fecha, proposito=instruccion,
                          ambiguedades=[])


def redactar_local(instruccion: str, fecha_mencionada: str | None, d: dict, canal: str, tono: str) -> MensajeRedactado:
    nombre = d["nombre"].split()[0]
    fecha = fecha_larga(fecha_mencionada) if fecha_mencionada else d.get("fecha_vencimiento")
    monto = d.get("deuda")
    if re.search(r"deud|deben|debe|pago|venc", instruccion, re.I):
        if tono == "formal":
            texto = f"Estimado/a {d['nombre']}: le recordamos que tiene un saldo pendiente{' de ' + monto if monto else ''}" \
                    f"{', con vencimiento el ' + fecha if fecha else ''}. Quedamos atentos. Saludos cordiales."
        elif tono == "breve":
            texto = f"{nombre}: saldo pendiente{' ' + monto if monto else ''}{', vence el ' + fecha if fecha else ''}. Gracias."
        else:
            texto = f"Hola {nombre}, ¿cómo estás? Te recuerdo que tienes un saldo pendiente{' de ' + monto if monto else ''}" \
                    f"{' que vence el ' + fecha if fecha else ''}. ¡Muchas gracias!"
        asunto = "Recordatorio de pago"
    else:
        cuerpo = re.sub(r"^(avisa|escr[ií]beles|escribe|dile|diles|recu[eé]rdale|recu[eé]rdales)\s+(a\s+)?(todos\s+)?(los\s+)?"
                        r"(clientes\s+)?(que\s+)?", "", instruccion, flags=re.I)
        texto = f"Estimado/a {d['nombre']}: {cuerpo}. Saludos cordiales." if tono == "formal" else f"Hola {nombre}, {cuerpo}. ¡Saludos!"
        asunto = "Aviso importante"
    if canal == "sms" and len(texto) > LIMITE_SMS:
        texto = texto[:LIMITE_SMS - 1] + "…"
    return MensajeRedactado(contacto_id=d["contacto_id"], asunto=asunto if canal == "correo" else None, texto=texto,
                            advertencia=None)
