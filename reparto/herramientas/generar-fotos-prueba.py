"""Fotos ficticias para las pruebas de la Fase 3.

  guia-firmada.jpg   una guía de despacho ficticia con firma y timbre (pesa > 8 KB: «sirve»)
  foto-negra.jpg     una foto en negro (pesa < 8 KB: el agente la rechaza sin gastar IA)
Uso: python3 herramientas/generar-fotos-prueba.py
"""
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(7)
im = Image.new("RGB", (1200, 900), (205, 200, 190))
d = ImageDraw.Draw(im)
for _ in range(9000):  # textura de papel y fondo, como una foto real
    x, y = random.randrange(1200), random.randrange(900)
    g = random.randrange(150, 230)
    d.point((x, y), fill=(g, g - 5, g - 12))
d.rectangle([150, 80, 1050, 820], fill=(250, 250, 245), outline=(40, 40, 40), width=4)
d.text((190, 110), "GUIA DE DESPACHO ELECTRONICA N 123456 (FICTICIA)", fill=(20, 20, 20))
d.text((190, 150), "Despachos Cordillera SpA  ->  Jumbo La Florida", fill=(20, 20, 20))
for i in range(12):
    d.text((190, 210 + i * 32), f"Item {i + 1}   Caja producto ficticio   1   bulto", fill=(30, 30, 30))
d.line([(650, 700), (700, 660), (760, 720), (820, 650), (900, 710)], fill=(10, 30, 120), width=5)  # firma
d.ellipse([300, 620, 480, 800], outline=(150, 20, 20), width=6)  # timbre
d.text((330, 700), "RECIBIDO", fill=(150, 20, 20))
im = im.filter(ImageFilter.GaussianBlur(0.6))
for destino in ("apps/movil/e2e/guia-firmada.jpg", "apps/web/e2e/archivos/guia-firmada.jpg"):
    im.save(destino, quality=85)
negra = Image.new("RGB", (640, 480), (3, 3, 3))
for destino in ("apps/movil/e2e/foto-negra.jpg", "apps/web/e2e/archivos/foto-negra.jpg"):
    negra.save(destino, quality=60)
print("listo")
