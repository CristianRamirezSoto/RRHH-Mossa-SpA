# Publicar RRHH Mossaspa en una URL publica

La app es Vite + React, asi que se puede publicar como sitio estatico. Supabase queda como backend.

## Opcion recomendada: Vercel

Sirve para tener una URL estable, por ejemplo:

`https://rrhh-mossaspa.vercel.app`

### Pasos

1. Sube el proyecto a GitHub.
2. Entra a `https://vercel.com`.
3. Crea un proyecto nuevo e importa el repositorio.
4. Configura:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. En `Environment Variables`, agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_DOCUMENT_BUCKET`
   - `VITE_ADMIN_EMAIL`
   - `VITE_HR_WHATSAPP_NUMBER`
6. Deploy.

## Configuracion obligatoria en Supabase

Cuando tengas la URL publica, ve a:

`Supabase > Authentication > URL Configuration`

Configura:

- Site URL:
  - `https://TU-URL-PUBLICA`
- Redirect URLs:
  - `https://TU-URL-PUBLICA/*`
  - `http://localhost:5173/*`

Esto evita problemas de login cuando la app ya no corre solo localmente.

## Opcion rapida: Cloudflare Tunnel

Sirve para mostrar lo que corre en tu computador sin subirlo aun.

1. Levanta la app local:
   - `npm run dev`
2. Crea un tunel publico hacia `http://localhost:5173`.
3. Usa la URL temporal que entregue Cloudflare.

Esta opcion es buena para una prueba rapida, pero no es lo ideal para uso diario.

## Recomendacion

Para presentarlo bien:

1. Usar Vercel para URL estable.
2. Mantener Supabase como backend.
3. Configurar correctamente las variables de entorno.
4. Agregar la URL publica en Supabase Auth.
5. Probar login, colaboradores, solicitudes, marcaje y descarga de asistencia desde otro computador o celular.
