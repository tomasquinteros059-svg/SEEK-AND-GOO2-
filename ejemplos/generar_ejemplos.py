"""Genera las fotos de ejemplo (simuladas) usadas en el modo demostración y en los tests.

Uso:  python ejemplos/generar_ejemplos.py
"""
from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

CARPETA = Path(__file__).parent
FUENTES = Path("/usr/share/fonts/truetype/dejavu")


def fuente(tam: int, negrita: bool = False, mono: bool = False, oblicua: bool = False):
    nombre = "DejaVuSansMono" if mono else "DejaVuSans"
    if negrita:
        nombre += "-Bold"
    elif oblicua:
        nombre += "-Oblique" if mono else "-Oblique"
    for ruta in (FUENTES / f"{nombre}.ttf", FUENTES / "DejaVuSans.ttf"):
        if ruta.exists():
            return ImageFont.truetype(str(ruta), tam)
    return ImageFont.load_default(size=tam)


def miles(n: int) -> str:
    return "$" + f"{n:,}".replace(",", ".")


def papel(ancho, alto, color=(250, 250, 246)):
    img = Image.new("RGB", (ancho, alto), color)
    rnd = random.Random(1)
    px = img.load()
    for _ in range(ancho * alto // 40):  # textura leve de papel
        x, y = rnd.randrange(ancho), rnd.randrange(alto)
        g = rnd.randint(-10, 0)
        r, gg, b = px[x, y]
        px[x, y] = (r + g, gg + g, b + g)
    return img


def foto(img: Image.Image, angulo: float, fondo=(90, 80, 70)) -> Image.Image:
    """Simula una foto: papel girado sobre una mesa."""
    margen = 80
    lienzo = Image.new("RGB", (img.width + 2 * margen, img.height + 2 * margen), fondo)
    lienzo.paste(img, (margen, margen))
    return lienzo.rotate(angulo, resample=Image.BICUBIC, fillcolor=fondo, expand=False)


def boleta() -> Image.Image:
    lineas = [("Pan marraqueta 1 kg", 2, 2290), ("Leche entera 1 L", 3, 1190),
              ("Huevos docena", 1, 3990), ("Café molido 250 g", 1, 4590)]
    img = papel(620, 1050)
    d = ImageDraw.Draw(img)
    m = fuente(22, mono=True)
    mb = fuente(24, negrita=True, mono=True)
    y = 40
    for t, f in [("MINIMARKET LA ESQUINA SPA", mb), ("RUT: 76.543.210-3", m), ("Av. Matta 1234, Santiago", m),
                 ("", m), ("BOLETA ELECTRONICA", mb), ("N° 0045821", mb), ("Fecha: 14-10-2026  18:42", m)]:
        d.text((310, y), t, font=f, fill=(20, 20, 20), anchor="mt")
        y += 36
    y += 10
    d.line((30, y, 590, y), fill=(60, 60, 60), width=2); y += 20
    total = 0
    for desc, cant, pu in lineas:
        sub = cant * pu; total += sub
        d.text((40, y), desc, font=m, fill=(20, 20, 20)); y += 30
        d.text((60, y), f"{cant} x {miles(pu)}", font=m, fill=(20, 20, 20))
        d.text((580, y), miles(sub), font=m, fill=(20, 20, 20), anchor="ra"); y += 40
    d.line((30, y, 590, y), fill=(60, 60, 60), width=2); y += 25
    d.text((40, y), "TOTAL", font=mb, fill=(0, 0, 0))
    d.text((580, y), miles(total), font=mb, fill=(0, 0, 0), anchor="ra"); y += 60
    d.text((310, y), "El IVA de esta boleta es: " + miles(round(total * 19 / 119)), font=fuente(18, mono=True),
           fill=(40, 40, 40), anchor="mt"); y += 50
    d.text((310, y), "Gracias por su compra", font=m, fill=(40, 40, 40), anchor="mt")
    return foto(img, 2.0)


def factura(error: bool = False) -> Image.Image:
    lineas = [("Harina 25 kg", 4, 18500), ("Azúcar 25 kg", 2, 21900), ("Levadura 500 g", 10, 2350),
              ("Mantequilla 5 kg", 3, 24800)]
    img = papel(1100, 1300, (253, 253, 253))
    d = ImageDraw.Draw(img)
    f, fb, ft = fuente(24), fuente(26, negrita=True), fuente(34, negrita=True)
    d.text((60, 60), "DISTRIBUIDORA EL TRIGO LTDA.", font=ft, fill=(25, 40, 90))
    d.text((60, 110), "Giro: Venta al por mayor de alimentos", font=f, fill=(30, 30, 30))
    d.text((60, 145), "Camino Lo Boza 456, Pudahuel", font=f, fill=(30, 30, 30))
    d.rectangle((700, 50, 1040, 200), outline=(200, 20, 20), width=4)
    for i, t in enumerate(["R.U.T.: 77.123.456-9", "FACTURA ELECTRÓNICA", "N° 10238"]):
        d.text((870, 75 + i * 40), t, font=fb, fill=(200, 20, 20), anchor="mt")
    d.text((60, 240), "Fecha emisión: 03-10-2026", font=f, fill=(30, 30, 30))
    d.text((60, 280), "Señor(es): Panadería Doña Rosa", font=f, fill=(30, 30, 30))
    y = 350
    d.rectangle((50, y, 1050, y + 45), fill=(225, 230, 240))
    for x, t in [(70, "Descripción"), (560, "Cant."), (700, "P. Unitario"), (900, "Total")]:
        d.text((x, y + 10), t, font=fb, fill=(20, 20, 20))
    y += 60
    neto = 0
    for desc, cant, pu in lineas:
        sub = cant * pu; neto += sub
        d.text((70, y), desc, font=f, fill=(20, 20, 20))
        d.text((600, y), str(cant), font=f, fill=(20, 20, 20), anchor="ra")
        d.text((850, y), miles(pu), font=f, fill=(20, 20, 20), anchor="ra")
        d.text((1030, y), miles(sub), font=f, fill=(20, 20, 20), anchor="ra")
        y += 45
    iva = round(neto * 0.19)
    total = neto + iva + (10000 if error else 0)
    y += 40
    for t, v in [("MONTO NETO", neto), ("IVA 19%", iva), ("TOTAL", total)]:
        d.text((800, y), t, font=fb, fill=(20, 20, 20), anchor="ra")
        d.text((1030, y), miles(v), font=fb, fill=(20, 20, 20), anchor="ra")
        y += 45
    return foto(img, -1.5)


def lista_a_mano() -> Image.Image:
    img = papel(800, 1000, (255, 253, 235))
    d = ImageDraw.Draw(img)
    for y in range(120, 1000, 60):
        d.line((0, y, 800, y), fill=(170, 200, 230), width=2)
    d.line((90, 0, 90, 1000), fill=(230, 140, 140), width=2)
    tinta = (25, 45, 140)
    d.text((110, 60), "Pedido feria - sábado", font=fuente(40, oblicua=True), fill=tinta)
    items = [("2 kg tomates", False), ("1 malla papas", True), ("3 paltas", False),
             ("cilantro", False), ("6 limones", True), ("1/2 kg porotos verdes", False)]
    rnd = random.Random(3)
    y = 130
    for t, marcado in items:
        capa = Image.new("RGBA", (680, 60), (0, 0, 0, 0))
        dc = ImageDraw.Draw(capa)
        dc.text((5, 5), "- " + t, font=fuente(36, oblicua=True), fill=tinta + (255,))
        capa = capa.rotate(rnd.uniform(-2.5, 2.5), resample=Image.BICUBIC)
        img.paste(capa, (110 + rnd.randint(-5, 5), y), capa)
        if marcado:
            d.line((115, y + 30, 115 + len(t) * 20 + 40, y + 26), fill=tinta, width=4)
        y += 120
    return foto(img, 3.0, (120, 100, 80))


def formulario() -> Image.Image:
    img = papel(900, 1000, (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((450, 50), "FICHA DE INSCRIPCIÓN CLIENTE", font=fuente(34, negrita=True), fill=(20, 20, 20), anchor="mt")
    campos = [("Nombre completo", "María José Soto Pérez"), ("RUT", "15.234.876-2"),
              ("Teléfono", "+56 9 8765 4321"), ("Correo", "mjsoto@correo.cl"),
              ("Dirección", "Los Aromos 345, Maipú"), ("Fecha", "12-10-2026")]
    y = 150
    for etiqueta, valor in campos:
        d.text((60, y), etiqueta + ":", font=fuente(26, negrita=True), fill=(30, 30, 30))
        d.line((330, y + 34, 840, y + 34), fill=(120, 120, 120), width=2)
        d.text((340, y - 2), valor, font=fuente(30, oblicua=True), fill=(20, 40, 150))
        y += 95
    d.text((60, y + 20), "¿Desea recibir ofertas por WhatsApp?", font=fuente(24), fill=(30, 30, 30))
    d.rectangle((560, y + 18, 590, y + 48), outline=(30, 30, 30), width=2)
    d.text((600, y + 20), "Sí", font=fuente(24), fill=(30, 30, 30))
    d.line((563, y + 33, 573, y + 45), fill=(20, 40, 150), width=4)
    d.line((573, y + 45, 590, y + 15), fill=(20, 40, 150), width=4)
    return foto(img, -1.0, (70, 70, 75))


def main() -> None:
    boleta().save(CARPETA / "boleta_minimarket.jpg", quality=90)
    factura().save(CARPETA / "factura_distribuidora.jpg", quality=90)
    factura(error=True).save(CARPETA / "factura_con_error.jpg", quality=90)
    lista_a_mano().save(CARPETA / "lista_feria_a_mano.jpg", quality=90)
    formulario().save(CARPETA / "formulario_cliente.jpg", quality=90)
    boleta().filter(ImageFilter.GaussianBlur(9)).save(CARPETA / "foto_borrosa.jpg", quality=80)
    print("Ejemplos generados en", CARPETA)


if __name__ == "__main__":
    main()
