# Reparto

App de reparto de paquetes: **conductor** y **receptor** (app Android e iPhone) y **administrador** (panel web), con agentes de IA, WhatsApp oficial y llamadas automáticas.

- `SPEC.md` y `docs/` vienen de `tomasquinteros059-svg/Seek-and-go` (rama `ccr-bbb4d59d-o8lo2o`, commit `e5021c7`) y se amplían aquí.
- Diseño de la ampliación: `docs/agentes-y-whatsapp.md`.
- Estado de la construcción: `docs/fase-0.md` (y una guía por cada fase siguiente).

## Estructura (SPEC 3.13)
```
apps/movil         App Expo (conductor y receptor), Android e iPhone
apps/web           Next.js (panel del administrador y web del receptor)
paquetes/dominio   Clases y reglas compartidas (sin pantallas)
paquetes/ui-tokens Colores, tipografías y medidas
supabase/          Migraciones SQL, reglas RLS, funciones y pruebas de base de datos
docs/              Documentos del proyecto
```

## Empezar
Necesitas Node 22.
```bash
cd reparto
npm install
npm run verificar   # tipos, estilo y pruebas
npm run web         # panel en http://localhost:3000
```

El resto de este repositorio (`core/`, `pages/`, `Inicio.py`) es otro proyecto ("Asistente de Negocio") y no se toca.
