# Guion de validación

Sirve para decidir si conviene invertir en construir la app, antes de escribir código.

Hay dos pruebas separadas:
1. **Prueba de GPS:** responde a la pregunta que puede matar la idea, si los conductores aceptan el rastreo.
2. **Prueba del prototipo:** responde si las pantallas se entienden y si las funciones son las que la gente quiere.

---

## Prueba 1: GPS durante la jornada (la más importante)

El prototipo HTML **no puede responder** esta pregunta, porque no usa GPS real. Se mide con una herramienta que ya existe y es gratis: *compartir ubicación en tiempo real* de Google Maps.

- **Quiénes:** 5 conductores reales de tu empresa.
- **Cuánto:** 5 días hábiles.
- **Cómo:**
  1. Cada conductor comparte su ubicación en tiempo real con el administrador **solo durante la jornada** y la apaga al terminar.
  2. El administrador anota cada día si pudo ver a cada conductor durante toda la jornada.
  3. Al final, entrevista corta de 10 minutos con cada conductor.

**Preguntas para el conductor** (hacerlas tal cual, sin defender la idea):
1. ¿Cuánta batería te quedaba al final del día, comparado con un día normal?
2. ¿Hubo algún momento en que lo apagaste o se cortó? ¿Por qué?
3. ¿Qué te molestó de que te vieran en el mapa?
4. Si la app te avisara sola a los clientes cuando vas llegando, ¿eso compensaría que te vean? ¿Por qué?
5. ¿Usarías una app así todos los días si la empresa te lo pide? ¿Y si fuera opcional?

**Resultado:**
- **Sigue:** 3 o más de 5 conductores la mantuvieron activa al menos 4 de 5 días y responden "sí" a la pregunta 5.
- **Para y repensar:** 3 o más de 5 se niegan, la apagan seguido o reportan un problema serio de batería. Esto coincide con el criterio de muerte del encargo.

---

## Prueba 2: recorrido del prototipo

- **Quiénes:**
  - 2 administradores: tú y otra persona que despache, si es posible de otra empresa;
  - los mismos 5 conductores;
  - 5 receptores (clientes reales o personas que reciben paquetes seguido).
- **Duración:** 15 a 20 minutos por persona, una por una.
- **Material:** el prototipo abierto en un teléfono (conductor y receptor) o en un computador (administrador). El caso de referencia está en `01-caso-real.md`.

**Cómo conducir la sesión:**
1. Explica: "Es un dibujo de una app, nada funciona de verdad. Si algo no se entiende es culpa del dibujo, no tuya".
2. Pide tareas, no opiniones. Ejemplos:
   - **Conductor:** "Empieza tu jornada", "Avisa que vas atrasado por un choque", "Registra que te pagaron en efectivo sin señal".
   - **Receptor:** "Averigua a qué hora llega tu paquete", "Avisa que ya transferiste", "Llama al conductor".
   - **Administrador:** "Crea una entrega que se cobra en destino", "Pídele al asistente que avise a un cliente que hay retraso", "Mira quién va atrasado en el sector Sur".
3. Observa en silencio. Anota dónde duda más de 5 segundos y qué toca primero.
4. Al final, haz estas preguntas:
   - ¿Qué de esto usarías mañana?
   - ¿Qué sobra?
   - ¿Qué falta para dejar de usar WhatsApp en esto?
   - (Administrador) ¿Le confiarías al asistente que mande mensajes a tus clientes? ¿Con qué condición?
   - (Receptor) ¿Instalarías una app para esto, o prefieres el enlace con código?

**Resultado:**
- **Sigue:** se cumplen las tres condiciones siguientes:
  - al menos 4 de 5 personas de cada perfil completan sus tareas sin ayuda;
  - los 2 administradores dicen que dejarían de usar WhatsApp para avisos y comprobantes;
  - al menos 1 administrador usaría el asistente para escribir a sus clientes.
- **Ajustar:** las tareas fallan pero el interés es alto. Se corrigen las pantallas y se repite con 3 personas.
- **Para:** los administradores no ven valor en reemplazar WhatsApp, o los receptores no abrirían ni el enlace.

---

## Qué se entrega al terminar
Una tabla con una fila por persona: perfil, tareas logradas y fallidas, citas textuales, y la decisión (sigue, ajustar o para). Esa tabla entra en la Etapa C y ajusta la especificación.
