"""Revisiones automáticas: sumas, IVA, RUT, fechas y duplicados."""
from __future__ import annotations

import re
import sqlite3
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime

from core.config import IVA
from core.esquemas import DocumentoTributario

TOLERANCIA = 2  # pesos de diferencia aceptados por redondeo


@dataclass
class Aviso:
    nivel: str      # "error" | "advertencia"
    campo: str
    mensaje: str


def pesos(n: int | float | None) -> str:
    if n is None:
        return "—"
    return "$" + f"{int(round(n)):,}".replace(",", ".")


# ---------- RUT ----------

def limpiar_rut(rut: str) -> str:
    return re.sub(r"[^0-9kK]", "", rut or "").upper()


def rut_valido(rut: str | None) -> bool:
    limpio = limpiar_rut(rut or "")
    if len(limpio) < 2 or not limpio[:-1].isdigit():
        return False
    cuerpo, dv = limpio[:-1], limpio[-1]
    suma, factor = 0, 2
    for d in reversed(cuerpo):
        suma += int(d) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - suma % 11
    esperado = {11: "0", 10: "K"}.get(resto, str(resto))
    return dv == esperado


def formatear_rut(rut: str | None) -> str | None:
    if not rut:
        return rut
    limpio = limpiar_rut(rut)
    if len(limpio) < 2:
        return rut
    cuerpo, dv = limpio[:-1], limpio[-1]
    if not cuerpo.isdigit():
        return rut
    return f"{int(cuerpo):,}".replace(",", ".") + "-" + dv


# ---------- Fechas y montos ----------

def parsear_fecha(texto: str | None) -> date | None:
    if not texto:
        return None
    texto = str(texto).strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%y", "%d/%m/%y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def fecha_a_texto(iso: str | None) -> str:
    """aaaa-mm-dd → dd-mm-aaaa para mostrar."""
    f = parsear_fecha(iso)
    return f.strftime("%d-%m-%Y") if f else (iso or "")


def parsear_monto(valor) -> int | None:
    """Acepta 12345, '12.345', '$ 12.345', '12345.0'."""
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        if valor != valor:  # NaN
            return None
        return int(round(valor))
    texto = str(valor).strip().replace("$", "").replace(" ", "")
    if not texto:
        return None
    if re.fullmatch(r"-?\d+[.,]\d{1,2}", texto):   # decimal real: 12345.5
        return int(round(float(texto.replace(",", "."))))
    texto = texto.replace(".", "").replace(",", "")
    return int(texto) if re.fullmatch(r"-?\d+", texto) else None


def parsear_numero(valor) -> float | None:
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return None if valor != valor else float(valor)
    texto = str(valor).strip().replace(",", ".")
    try:
        return float(texto) if texto else None
    except ValueError:
        return None


# ---------- Validación de boletas y facturas ----------

def validar_documento(doc: DocumentoTributario) -> list[Aviso]:
    avisos: list[Aviso] = []

    for i, l in enumerate(doc.lineas, start=1):
        if l.cantidad is not None and l.precio_unitario is not None and l.total is not None:
            calculado = l.cantidad * l.precio_unitario
            if abs(calculado - l.total) > TOLERANCIA:
                avisos.append(Aviso("advertencia", f"lineas[{i - 1}].total",
                    f"Línea {i}: {l.cantidad:g} × {pesos(l.precio_unitario)} = {pesos(calculado)}, "
                    f"pero dice {pesos(l.total)}."))

    totales_lineas = [l.total for l in doc.lineas if l.total is not None]
    suma = sum(totales_lineas) if totales_lineas else None
    if suma is not None and len(totales_lineas) == len(doc.lineas):
        cuadra_neto = doc.neto is not None and abs(suma - doc.neto) <= TOLERANCIA
        cuadra_total = doc.total is not None and abs(suma - doc.total) <= TOLERANCIA
        if not cuadra_neto and not cuadra_total and (doc.neto is not None or doc.total is not None):
            ref = "neto" if doc.neto is not None else "total"
            valor = doc.neto if doc.neto is not None else doc.total
            avisos.append(Aviso("error", ref,
                f"La suma de las líneas ({pesos(suma)}) no cuadra con el {ref} ({pesos(valor)})."))

    if doc.neto is not None and doc.iva is not None and doc.total is not None:
        if abs(doc.neto + doc.iva - doc.total) > TOLERANCIA:
            avisos.append(Aviso("error", "total",
                f"Neto + IVA = {pesos(doc.neto + doc.iva)}, pero el total dice {pesos(doc.total)}."))
    if doc.neto is not None and doc.iva is not None and doc.iva > 0:
        esperado = round(doc.neto * IVA)
        if abs(esperado - doc.iva) > max(TOLERANCIA, len(doc.lineas)):
            avisos.append(Aviso("advertencia", "iva",
                f"El IVA ({pesos(doc.iva)}) no es el 19% del neto (debería ser ≈ {pesos(esperado)})."))
    if doc.tipo == "factura" and doc.total is not None and (doc.neto is None or doc.iva is None):
        avisos.append(Aviso("advertencia", "neto", "Factura sin neto o IVA legible."))

    if doc.rut_proveedor and not rut_valido(doc.rut_proveedor):
        avisos.append(Aviso("advertencia", "rut_proveedor",
            f"El RUT {doc.rut_proveedor} no es válido (dígito verificador no calza)."))

    if doc.fecha:
        f = parsear_fecha(doc.fecha)
        if f is None:
            avisos.append(Aviso("advertencia", "fecha", f"No se entiende la fecha «{doc.fecha}»."))
        elif f > date.today():
            avisos.append(Aviso("advertencia", "fecha", f"La fecha {f:%d-%m-%Y} está en el futuro."))
    return avisos


# ---------- Duplicados ----------

def normalizar_texto(texto: str | None) -> str:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\b(ltda|spa|s\.?a\.?|eirl|limitada)\b", "", t)
    return re.sub(r"[^a-z0-9]", "", t)


def normalizar_numero(numero: str | None) -> str:
    return re.sub(r"[^0-9a-zA-Z]", "", numero or "").lstrip("0").upper()


def buscar_duplicado(
    conn: sqlite3.Connection, proveedor: str | None, rut: str | None, numero: str | None
) -> int | None:
    """Devuelve el id de un documento ya guardado con el mismo N° y mismo proveedor (o RUT)."""
    num = normalizar_numero(numero)
    if not num:
        return None
    rut_l, prov_n = limpiar_rut(rut or ""), normalizar_texto(proveedor)
    filas = conn.execute(
        "SELECT id, proveedor, rut_proveedor, numero_documento FROM documentos "
        "WHERE numero_documento IS NOT NULL AND tipo IN ('boleta', 'factura')"
    ).fetchall()
    for f in filas:
        if normalizar_numero(f["numero_documento"]) != num:
            continue
        if rut_l and limpiar_rut(f["rut_proveedor"] or "") == rut_l:
            return f["id"]
        if prov_n and normalizar_texto(f["proveedor"]) == prov_n:
            return f["id"]
    return None


def buscar_por_hash(conn: sqlite3.Connection, huella: str) -> int | None:
    fila = conn.execute("SELECT id FROM documentos WHERE hash_archivo = ? LIMIT 1", (huella,)).fetchone()
    return fila["id"] if fila else None
