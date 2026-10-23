"""Preparación de fotos y PDF antes de enviarlos a la IA."""
from __future__ import annotations

import base64
import hashlib
import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

try:  # Fotos HEIC de iPhone
    from pillow_heif import register_heif_opener

    register_heif_opener()
    HEIC_DISPONIBLE = True
except ImportError:  # pragma: no cover
    HEIC_DISPONIBLE = False

EXTENSIONES_IMAGEN = {"jpg", "jpeg", "png", "webp", "heic", "heif"}
EXTENSIONES = EXTENSIONES_IMAGEN | {"pdf"}
LADO_MAXIMO = 2000          # px; suficiente para leer letra chica y más barato
LADO_MINIMO = 300           # px; menos que esto casi seguro no se puede leer
PDF_MAX_MB = 30


class ErrorArchivo(Exception):
    pass


@dataclass
class ArchivoPreparado:
    nombre: str
    es_pdf: bool
    datos: bytes            # JPEG optimizado, o el PDF original
    hash: str               # sha256 del archivo original (para detectar la misma foto)
    ancho: int = 0
    alto: int = 0
    aviso: str | None = None

    @property
    def tipo_medio(self) -> str:
        return "application/pdf" if self.es_pdf else "image/jpeg"

    def bloque_para_ia(self) -> dict:
        b64 = base64.standard_b64encode(self.datos).decode()
        tipo = "document" if self.es_pdf else "image"
        return {"type": tipo, "source": {"type": "base64", "media_type": self.tipo_medio, "data": b64}}


def preparar(nombre: str, datos: bytes) -> ArchivoPreparado:
    ext = Path(nombre).suffix.lower().lstrip(".")
    if ext not in EXTENSIONES:
        raise ErrorArchivo(f"«{nombre}»: formato no soportado. Usa JPG, PNG, HEIC o PDF.")
    if not datos:
        raise ErrorArchivo(f"«{nombre}» está vacío.")
    huella = hashlib.sha256(datos).hexdigest()

    if ext == "pdf":
        if not datos.startswith(b"%PDF"):
            raise ErrorArchivo(f"«{nombre}» no es un PDF válido.")
        if len(datos) > PDF_MAX_MB * 1024 * 1024:
            raise ErrorArchivo(f"«{nombre}» pesa más de {PDF_MAX_MB} MB.")
        return ArchivoPreparado(nombre=nombre, es_pdf=True, datos=datos, hash=huella)

    if ext in {"heic", "heif"} and not HEIC_DISPONIBLE:
        raise ErrorArchivo("Para fotos HEIC instala pillow-heif (pip install pillow-heif).")
    try:
        img = Image.open(io.BytesIO(datos))
        img.load()
    except (UnidentifiedImageError, OSError) as e:
        raise ErrorArchivo(f"«{nombre}» no se pudo abrir como imagen (¿archivo dañado?).") from e

    img = ImageOps.exif_transpose(img)  # gira según cómo se tomó la foto
    if img.mode != "RGB":
        fondo = Image.new("RGB", img.size, "white")
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            fondo.paste(img, mask=img.split()[-1])
        else:
            fondo.paste(img.convert("RGB"))
        img = fondo
    aviso = None
    if max(img.size) < LADO_MINIMO:
        aviso = "La foto tiene muy baja resolución; puede que no se lea bien."
    img.thumbnail((LADO_MAXIMO, LADO_MAXIMO))
    salida = io.BytesIO()
    img.save(salida, format="JPEG", quality=88, optimize=True)
    return ArchivoPreparado(
        nombre=nombre, es_pdf=False, datos=salida.getvalue(), hash=huella,
        ancho=img.width, alto=img.height, aviso=aviso,
    )
