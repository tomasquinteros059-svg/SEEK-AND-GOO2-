"""Escaneo de documentos: arma el prompt, llama a la IA y revisa el resultado."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from core import columnas
from core.esquemas import ResultadoEscaneo
from core.ia import ErrorIA, GeneradorIA, Uso
from core.imagenes import ArchivoPreparado
from core.validacion import Aviso, buscar_duplicado, buscar_por_hash, validar_documento

TIPOS = {
    "automatico": "Automático (detectar)",
    "boleta_factura": "Boleta / Factura",
    "lista": "Lista (escrita a mano o impresa)",
    "formulario": "Formulario",
}

REGLAS = """Eres un asistente que digitaliza documentos de un pequeño negocio en Chile.
Lees fotos o PDF de boletas, facturas, listas escritas a mano y formularios, y devuelves sus datos.

Reglas obligatorias:
1. NUNCA inventes ni supongas datos. Si un campo no se ve, está cortado o no se entiende, déjalo en null
   y agrega su ruta a "campos_dudosos" (ej. "fecha", "lineas[2].cantidad", "items[0].texto").
2. Si lees un valor pero no estás seguro (letra difícil, borroso, número que podría ser otro),
   escríbelo igual y agrega su ruta a "campos_dudosos".
3. Montos en pesos chilenos como números enteros, sin puntos ni signo $ (ej. "$12.990" → 12990).
4. Fechas en formato aaaa-mm-dd. Los documentos chilenos usan día/mes/año.
5. RUT tal como aparece, con guion y dígito verificador (ej. 76.123.456-7).
6. Copia los textos tal como están escritos (no corrijas nombres de productos ni de personas).
7. Si la foto está tan borrosa, oscura o cortada que no se puede leer, pon legible=false y explica
   el motivo en "motivo_ilegible" en español. No adivines el contenido.
8. Llena solo el bloque que corresponde al tipo de documento (documento_tributario, lista o formulario)
   y deja los otros en null.
9. Boletas: normalmente solo traen total (IVA incluido); deja neto e iva en null si no aparecen.
   Facturas: neto, IVA (19%) y total. No calcules valores que no estén escritos.
10. En "observaciones" anota en español lo que el usuario deba revisar (ej. "esquina inferior rota").
"""


@dataclass
class ResultadoArchivo:
    nombre: str
    archivo: ArchivoPreparado
    tipo_pedido: str
    resultado: ResultadoEscaneo | None = None
    uso: Uso | None = None
    avisos: list[Aviso] = field(default_factory=list)
    error: str | None = None
    duplicado_de: int | None = None     # id del documento ya guardado
    misma_foto_de: int | None = None    # misma foto exacta ya escaneada

    @property
    def tipo(self) -> str | None:
        return self.resultado.tipo_detectado if self.resultado else None


def proveedores_conocidos(conn: sqlite3.Connection, limite: int = 200) -> list[tuple[str, str | None]]:
    filas = conn.execute(
        "SELECT proveedor, rut_proveedor, COUNT(*) n FROM documentos "
        "WHERE proveedor IS NOT NULL AND tipo IN ('boleta','factura') "
        "GROUP BY lower(proveedor), rut_proveedor ORDER BY n DESC LIMIT ?",
        (limite,),
    ).fetchall()
    return [(f["proveedor"], f["rut_proveedor"]) for f in filas]


def construir_system(conn: sqlite3.Connection, contexto_extra: str = "") -> str:
    partes = [REGLAS]
    extras = []
    for tipo, nombre in columnas.TIPOS_DOCUMENTO.items():
        for c in columnas.extras_activas(conn, tipo):
            desc = f" — {c.descripcion}" if c.descripcion else ""
            extras.append(f'- [{nombre}] clave "{c.clave}": {c.nombre_visible}{desc}')
    if extras:
        partes.append(
            "Columnas extra que el usuario pidió. Inclúyelas en \"campos_extra\" (clave exacta) para el tipo "
            "que corresponda, con valor null si no aparecen en el documento:\n" + "\n".join(extras)
        )
    provs = proveedores_conocidos(conn)
    if provs:
        lineas = "\n".join(f"- {p}" + (f" (RUT {r})" if r else "") for p, r in provs)
        partes.append(
            "Proveedores ya conocidos. Úsalos SOLO para escribir el nombre igual que antes cuando el RUT "
            "o el nombre visible en el documento coincidan claramente. Si no coinciden, copia lo que se ve:\n"
            + lineas
        )
    if contexto_extra.strip():
        partes.append("Información del negocio entregada por el usuario:\n" + contexto_extra.strip())
    return "\n\n".join(partes)


def instruccion_usuario(tipo: str) -> str:
    if tipo == "automatico":
        return "Identifica qué tipo de documento es y extrae sus datos."
    return f"El usuario indica que este documento es: {TIPOS[tipo]}. Extrae sus datos."


def escanear(
    ia: GeneradorIA,
    conn: sqlite3.Connection,
    archivo: ArchivoPreparado,
    tipo: str = "automatico",
    contexto_extra: str = "",
) -> ResultadoArchivo:
    res = ResultadoArchivo(nombre=archivo.nombre, archivo=archivo, tipo_pedido=tipo)
    res.misma_foto_de = buscar_por_hash(conn, archivo.hash)
    if archivo.aviso:
        res.avisos.append(Aviso("advertencia", "", archivo.aviso))
    try:
        datos, uso = ia.generar(
            system=construir_system(conn, contexto_extra),
            contenido=[archivo.bloque_para_ia(), {"type": "text", "text": instruccion_usuario(tipo)}],
            esquema=ResultadoEscaneo,
            effort="medium",
        )
    except ErrorIA as e:
        res.error = e.mensaje
        return res
    res.resultado, res.uso = datos, uso
    revisar(conn, res)
    return res


def revisar(conn: sqlite3.Connection, res: ResultadoArchivo) -> None:
    """Agrega avisos de legibilidad, tipo, sumas y duplicados."""
    r = res.resultado
    if r is None:
        return
    if not r.legible:
        res.avisos.append(Aviso("error", "", "Foto ilegible: " + (r.motivo_ilegible or "toma una foto más nítida.")))
    if res.tipo_pedido != "automatico" and r.tipo_detectado not in (res.tipo_pedido, "otro"):
        res.avisos.append(Aviso("advertencia", "",
            f"Elegiste «{TIPOS[res.tipo_pedido]}», pero parece ser «{TIPOS.get(r.tipo_detectado, r.tipo_detectado)}»."))
    if r.tipo_detectado == "otro" and r.legible:
        res.avisos.append(Aviso("advertencia", "", "No se reconoció como boleta, factura, lista ni formulario."))
    bloque = {"boleta_factura": r.documento_tributario, "lista": r.lista, "formulario": r.formulario}.get(r.tipo_detectado)
    if r.legible and r.tipo_detectado != "otro" and bloque is None:
        res.avisos.append(Aviso("error", "", "La IA no entregó datos para este documento."))
    doc = r.documento_tributario
    if r.tipo_detectado == "boleta_factura" and doc is not None:
        res.avisos.extend(validar_documento(doc))
        res.duplicado_de = buscar_duplicado(conn, doc.proveedor, doc.rut_proveedor, doc.numero_documento)
