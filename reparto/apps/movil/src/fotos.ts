// Fotos de documentos: se toman o eligen, se achican y se re-guardan como JPEG.
// Re-guardarla elimina los metadatos EXIF (incluida la ubicación), como exige la SPEC 9.
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "./supabase";

export type Foto = { uri: string; ancho: number; alto: number };

export async function tomarFoto(desde: "camara" | "galeria"): Promise<Foto | { error: string } | null> {
  const permiso = desde === "camara"
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) {
    return { error: desde === "camara" ? "Para tomar la foto, permite el uso de la cámara en los ajustes del teléfono." : "Permite el acceso a tus fotos en los ajustes del teléfono." };
  }
  const opciones: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, exif: false };
  const r = desde === "camara" ? await ImagePicker.launchCameraAsync(opciones) : await ImagePicker.launchImageLibraryAsync(opciones);
  const elegida = r.canceled ? null : r.assets[0];
  if (!elegida) return null;

  const lado = 1600;
  const contexto = ImageManipulator.manipulate(elegida.uri);
  if (Math.max(elegida.width, elegida.height) > lado) {
    contexto.resize(elegida.width >= elegida.height ? { width: lado } : { height: lado });
  }
  const imagen = await contexto.renderAsync();
  const guardada = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return { uri: guardada.uri, ancho: guardada.width, alto: guardada.height };
}

/** Sube la foto a la carpeta privada del conductor y devuelve su ruta. */
export async function subirDocumento(usuarioId: string, foto: Foto, nombre: string): Promise<string> {
  const bytes = await (await fetch(foto.uri)).arrayBuffer();
  const ruta = `${usuarioId}/${nombre}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("documentos").upload(ruta, bytes, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return ruta;
}
