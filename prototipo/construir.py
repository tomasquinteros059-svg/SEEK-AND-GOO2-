"""Arma prototipo/index.html: incluye las fotos de ejemplo y sus respuestas simuladas."""
import base64, io, json
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
fuente = (RAIZ / "prototipo" / "fuente.html").read_text(encoding="utf-8")

def foto(nombre, lado=900):
    img = Image.open(RAIZ / "ejemplos" / nombre).convert("RGB")
    img.thumbnail((lado, lado))
    b = io.BytesIO(); img.save(b, "JPEG", quality=78, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()

def respuesta(nombre):
    r = json.loads((RAIZ / "ejemplos" / "respuestas_demo" / f"{nombre}.json").read_text(encoding="utf-8"))
    for k in ("documento_tributario", "lista", "formulario"):
        if r.get(k):
            r[k]["extras"] = {c["clave"]: c["valor"] for c in r[k].pop("campos_extra", [])}
    return r

html = (fuente.replace("__FOTO_BOLETA__", foto("boleta_minimarket.jpg"))
        .replace("__FOTO_FACTURA__", foto("factura_con_error.jpg"))
        .replace("__FOTO_LISTA__", foto("lista_feria_a_mano.jpg"))
        .replace("__RESPUESTAS__", json.dumps({"boleta": respuesta("boleta_minimarket"),
                                               "factura": respuesta("factura_con_error"),
                                               "lista": respuesta("lista_feria_a_mano")}, ensure_ascii=False)))
(RAIZ / "prototipo" / "index.html").write_text(html, encoding="utf-8")
print("index.html:", len(html) // 1024, "KB")
