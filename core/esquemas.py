"""Esquemas de lo que la IA debe devolver. El SDK los convierte a JSON Schema
y valida la respuesta, así que los datos siempre llegan con este formato."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CampoExtra(BaseModel):
    clave: str = Field(description="Clave exacta de la columna extra pedida")
    valor: str | None = Field(description="Valor tal como se ve en el documento, o null si no aparece")


class LineaDetalle(BaseModel):
    descripcion: str | None
    cantidad: float | None
    precio_unitario: int | None = Field(description="Pesos chilenos, sin decimales")
    total: int | None = Field(description="Total de la línea en pesos chilenos")


class DocumentoTributario(BaseModel):
    tipo: Literal["boleta", "factura"]
    fecha: str | None = Field(description="Formato aaaa-mm-dd. null si no se lee")
    proveedor: str | None = Field(description="Razón social o nombre del emisor")
    rut_proveedor: str | None = Field(description="RUT del emisor, ej. 76.123.456-7")
    numero_documento: str | None = Field(description="Folio / N° de boleta o factura")
    lineas: list[LineaDetalle]
    neto: int | None
    iva: int | None
    total: int | None
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str] = Field(
        description="Rutas de campos ilegibles o de baja confianza, ej. 'fecha', 'lineas[2].cantidad'"
    )
    observaciones: str | None


class ItemLista(BaseModel):
    texto: str | None
    cantidad: str | None
    marcado: bool | None = Field(description="true si está tachado o con check")


class Lista(BaseModel):
    titulo: str | None
    fecha: str | None = Field(description="Formato aaaa-mm-dd. null si no aparece")
    items: list[ItemLista]
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str] = Field(description="Ej. 'titulo', 'items[3].texto'")
    observaciones: str | None


class CampoFormulario(BaseModel):
    etiqueta: str
    valor: str | None


class Formulario(BaseModel):
    titulo: str | None
    fecha: str | None = Field(description="Formato aaaa-mm-dd. null si no aparece")
    campos: list[CampoFormulario]
    campos_extra: list[CampoExtra]
    campos_dudosos: list[str] = Field(description="Ej. 'campos[1].valor'")
    observaciones: str | None


TipoDetectado = Literal["boleta_factura", "lista", "formulario", "otro"]


class ResultadoEscaneo(BaseModel):
    tipo_detectado: TipoDetectado
    legible: bool = Field(description="false si la foto está tan borrosa o cortada que no se puede leer")
    motivo_ilegible: str | None
    documento_tributario: DocumentoTributario | None
    lista: Lista | None
    formulario: Formulario | None
